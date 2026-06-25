/**
 * Neon Database Module
 * Serverless Postgres for persisting user preferences, orgs, and swarms.
 */

const { neon } = require('@neondatabase/serverless');

let sql = null;

function getSQL() {
  if (!sql) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set');
    }
    sql = neon(process.env.DATABASE_URL);
  }
  return sql;
}

/**
 * Initialize database schema — creates tables if they don't exist.
 * Safe to call on every server start.
 */
async function initDB() {
  if (!process.env.DATABASE_URL) {
    console.warn('WARNING: DATABASE_URL not set — database features disabled (localStorage-only mode)');
    return false;
  }

  const sql = getSQL();

  await sql`
    CREATE TABLE IF NOT EXISTS user_preferences (
      id            SERIAL PRIMARY KEY,
      wallet_address TEXT NOT NULL,
      key           TEXT NOT NULL,
      value         JSONB NOT NULL DEFAULT '{}',
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(wallet_address, key)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS organizations (
      id            TEXT PRIMARY KEY,
      wallet_address TEXT NOT NULL,
      name          TEXT NOT NULL,
      slug          TEXT NOT NULL UNIQUE,
      ens           TEXT NOT NULL,
      description   TEXT DEFAULT '',
      network       TEXT DEFAULT 'sepolia',
      icon          TEXT DEFAULT '⬣',
      dedicated_wallet TEXT,
      default_channel_id TEXT,
      bridge_configured  BOOLEAN DEFAULT FALSE,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Add dedicated_wallet column if it doesn't exist (migration-safe)
  await sql`
    DO $$ BEGIN
      ALTER TABLE organizations ADD COLUMN IF NOT EXISTS dedicated_wallet TEXT;
    EXCEPTION WHEN duplicate_column THEN NULL; END $$
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS swarms (
      id            TEXT PRIMARY KEY,
      wallet_address TEXT NOT NULL,
      org_id        TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name          TEXT NOT NULL,
      slug          TEXT NOT NULL,
      ens           TEXT NOT NULL,
      description   TEXT DEFAULT '',
      dedicated_wallet TEXT,
      channel_id    TEXT,
      agent_count   INT DEFAULT 0,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(org_id, slug)
    )
  `;

  // Add dedicated_wallet column if it doesn't exist (migration-safe)
  await sql`
    DO $$ BEGIN
      ALTER TABLE swarms ADD COLUMN IF NOT EXISTS dedicated_wallet TEXT;
    EXCEPTION WHEN duplicate_column THEN NULL; END $$
  `;

  // Index for fast wallet-scoped lookups
  await sql`
    CREATE INDEX IF NOT EXISTS idx_prefs_wallet ON user_preferences(wallet_address)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_orgs_wallet ON organizations(wallet_address)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_swarms_wallet ON swarms(wallet_address)
  `;

  console.log('Database schema initialized');
  return true;
}

// ── Preferences CRUD ──

async function getPreference(walletAddress, key) {
  const sql = getSQL();
  const rows = await sql`
    SELECT value FROM user_preferences
    WHERE wallet_address = ${walletAddress} AND key = ${key}
  `;
  return rows.length > 0 ? rows[0].value : null;
}

async function getAllPreferences(walletAddress) {
  const sql = getSQL();
  const rows = await sql`
    SELECT key, value, updated_at FROM user_preferences
    WHERE wallet_address = ${walletAddress}
    ORDER BY key
  `;
  const prefs = {};
  for (const row of rows) {
    prefs[row.key] = row.value;
  }
  return prefs;
}

async function setPreference(walletAddress, key, value) {
  const sql = getSQL();
  await sql`
    INSERT INTO user_preferences (wallet_address, key, value, updated_at)
    VALUES (${walletAddress}, ${key}, ${JSON.stringify(value)}, NOW())
    ON CONFLICT (wallet_address, key)
    DO UPDATE SET value = ${JSON.stringify(value)}, updated_at = NOW()
  `;
}

async function bulkSetPreferences(walletAddress, prefs) {
  const sql = getSQL();
  for (const [key, value] of Object.entries(prefs)) {
    await sql`
      INSERT INTO user_preferences (wallet_address, key, value, updated_at)
      VALUES (${walletAddress}, ${key}, ${JSON.stringify(value)}, NOW())
      ON CONFLICT (wallet_address, key)
      DO UPDATE SET value = ${JSON.stringify(value)}, updated_at = NOW()
    `;
  }
}

async function deletePreference(walletAddress, key) {
  const sql = getSQL();
  await sql`
    DELETE FROM user_preferences
    WHERE wallet_address = ${walletAddress} AND key = ${key}
  `;
}

// ── Organizations CRUD ──

async function upsertOrg(walletAddress, org) {
  const sql = getSQL();
  await sql`
    INSERT INTO organizations (id, wallet_address, name, slug, ens, description, network, icon, dedicated_wallet, default_channel_id, bridge_configured, created_at)
    VALUES (
      ${org.id}, ${walletAddress}, ${org.name}, ${org.slug}, ${org.ens},
      ${org.description || ''}, ${org.network || 'sepolia'}, ${org.icon || '⬣'},
      ${org.walletAddress || null},
      ${org.defaultChannelId || null}, ${org.bridgeConfigured || false},
      ${org.createdAt || new Date().toISOString()}
    )
    ON CONFLICT (id) DO UPDATE SET
      name = ${org.name}, slug = ${org.slug}, ens = ${org.ens},
      description = ${org.description || ''}, network = ${org.network || 'sepolia'},
      icon = ${org.icon || '⬣'}, dedicated_wallet = ${org.walletAddress || null},
      default_channel_id = ${org.defaultChannelId || null},
      bridge_configured = ${org.bridgeConfigured || false}
  `;
}

async function getOrg(walletAddress) {
  const sql = getSQL();
  const rows = await sql`
    SELECT * FROM organizations WHERE wallet_address = ${walletAddress} LIMIT 1
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id, name: r.name, slug: r.slug, ens: r.ens,
    description: r.description, network: r.network, icon: r.icon,
    walletAddress: r.dedicated_wallet,
    defaultChannelId: r.default_channel_id, bridgeConfigured: r.bridge_configured,
    createdAt: r.created_at
  };
}

// ── Swarms CRUD ──

async function upsertSwarm(walletAddress, swarm) {
  const sql = getSQL();
  await sql`
    INSERT INTO swarms (id, wallet_address, org_id, name, slug, ens, description, dedicated_wallet, channel_id, agent_count, created_at)
    VALUES (
      ${swarm.id}, ${walletAddress}, ${swarm.orgId}, ${swarm.name}, ${swarm.slug},
      ${swarm.ens}, ${swarm.description || ''}, ${swarm.walletAddress || null},
      ${swarm.channelId || null},
      ${swarm.agentCount || 0}, ${swarm.createdAt || new Date().toISOString()}
    )
    ON CONFLICT (id) DO UPDATE SET
      name = ${swarm.name}, slug = ${swarm.slug}, ens = ${swarm.ens},
      description = ${swarm.description || ''}, dedicated_wallet = ${swarm.walletAddress || null},
      channel_id = ${swarm.channelId || null},
      agent_count = ${swarm.agentCount || 0}
  `;
}

async function getSwarms(walletAddress) {
  const sql = getSQL();
  const rows = await sql`
    SELECT * FROM swarms WHERE wallet_address = ${walletAddress} ORDER BY created_at
  `;
  return rows.map(r => ({
    id: r.id, orgId: r.org_id, name: r.name, slug: r.slug, ens: r.ens,
    description: r.description, walletAddress: r.dedicated_wallet,
    channelId: r.channel_id,
    agentCount: r.agent_count, createdAt: r.created_at
  }));
}

async function deleteSwarm(walletAddress, swarmId) {
  const sql = getSQL();
  await sql`
    DELETE FROM swarms WHERE wallet_address = ${walletAddress} AND id = ${swarmId}
  `;
}

module.exports = {
  initDB,
  getSQL,
  // Preferences
  getPreference,
  getAllPreferences,
  setPreference,
  bulkSetPreferences,
  deletePreference,
  // Organizations
  upsertOrg,
  getOrg,
  // Swarms
  upsertSwarm,
  getSwarms,
  deleteSwarm,
};
