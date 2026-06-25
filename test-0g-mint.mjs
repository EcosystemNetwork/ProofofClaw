#!/usr/bin/env node
/**
 * Test script: Real 0G Storage upload + Sepolia iNFT mint
 * Uses private key from .env — run with: node test-0g-mint.mjs
 */

import { config } from 'dotenv';
import { Indexer, ZgFile } from '@0gfoundation/0g-ts-sdk';
import { ethers } from 'ethers';
import { createPublicClient, createWalletClient, http, parseAbi, keccak256, stringToBytes, encodePacked } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

config(); // Load .env

// ── Config ──────────────────────────────────────────────────────────
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const SEPOLIA_RPC = process.env.RPC_URL;
if (!SEPOLIA_RPC) {
  console.error('ERROR: RPC_URL not set in .env (e.g. https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY)');
  process.exit(1);
}
const ZG_INDEXER = 'https://indexer-storage-testnet-turbo.0g.ai';
const ZG_EVM_RPC = process.env.ZERO_G_CHAIN_RPC || 'https://evmrpc-testnet.0g.ai';
const AGENT_NAME = process.env.AGENT_ID || 'openclaw';
const ENS_NAME = process.env.ENS_NAME || 'openclaw.proofofclaw.eth';

const INFT_ADDRESS = '0x6afF6B0fb940FFB20B7D8104A1C7c42b9d167f29'; // Sepolia ProofOfClawINFT

const INFT_ABI = parseAbi([
  'function mint(bytes32 agentId, bytes32 policyHash, bytes32 riscZeroImageId, string calldata encryptedURI, bytes32 metadataHash, bytes32 soulBackupHash, string calldata soulBackupURI, string calldata ensName) external returns (uint256 tokenId)',
  'function agentToToken(bytes32 agentId) external view returns (uint256)',
  'event AgentMinted(uint256 indexed tokenId, bytes32 indexed agentId, address indexed owner, string ensName)',
]);

if (!PRIVATE_KEY) {
  console.error('ERROR: PRIVATE_KEY not set in .env');
  process.exit(1);
}

// ── Step 1: Upload soul backup to 0G Storage ─────────────────────────
async function uploadTo0G(data, label) {
  console.log(`\n⏳ Uploading ${label} to 0G Storage...`);

  const provider = new ethers.JsonRpcProvider(ZG_EVM_RPC);
  const signer = new ethers.Wallet(PRIVATE_KEY, provider);
  const address = await signer.getAddress();

  // Check 0G testnet balance
  const balance = await provider.getBalance(address);
  console.log(`   0G wallet: ${address}`);
  console.log(`   0G balance: ${ethers.formatEther(balance)} OG`);

  if (balance === 0n) {
    console.error('ERROR: No 0G testnet tokens. Get some from https://faucet.0g.ai');
    process.exit(1);
  }

  const raw = typeof data === 'string' ? new TextEncoder().encode(data) : data;

  // 0G Storage requires data to be at least 1 segment (256 chunks * 256 bytes = 65536 bytes)
  // Pad small data to minimum segment size to avoid Flow contract revert
  const MIN_SIZE = 256;
  const bytes = raw.length < MIN_SIZE
    ? new Uint8Array(MIN_SIZE).fill(0).map((_, i) => i < raw.length ? raw[i] : 0)
    : raw;

  // Create a temp file for the SDK
  const { writeFileSync, unlinkSync } = await import('fs');
  const tmpPath = `/tmp/0g-upload-${Date.now()}.bin`;
  writeFileSync(tmpPath, Buffer.from(bytes));

  const indexer = new Indexer(ZG_INDEXER);

  try {
    const zgFile = await ZgFile.fromFilePath(tmpPath);
    const [tx, err] = await indexer.upload(zgFile, ZG_EVM_RPC, signer);
    await zgFile.close();
    unlinkSync(tmpPath);

    if (err) {
      throw new Error(`0G upload error: ${err.message || JSON.stringify(err)}`);
    }

    console.log(`   ✅ ${label} uploaded!`);
    console.log(`   Root hash: ${tx.rootHash || tx.txHash}`);
    console.log(`   TX hash:   ${tx.txHash || tx.rootHash}`);

    return {
      rootHash: tx.rootHash || tx.txHash,
      txHash: tx.txHash || tx.rootHash,
    };
  } catch (e) {
    try { unlinkSync(tmpPath); } catch {}
    throw e;
  }
}

// ── Step 2: Mint iNFT on Sepolia ──────────────────────────────────────
async function mintINFT(storageRootHash, storageURI, soulBackupHash, soulBackupURI) {
  console.log('\n⏳ Minting iNFT on Sepolia...');

  const account = privateKeyToAccount(PRIVATE_KEY.startsWith('0x') ? PRIVATE_KEY : `0x${PRIVATE_KEY}`);

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(SEPOLIA_RPC),
  });

  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(SEPOLIA_RPC),
  });

  // Check Sepolia balance
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`   Sepolia wallet: ${account.address}`);
  console.log(`   Sepolia balance: ${(Number(balance) / 1e18).toFixed(4)} ETH`);

  if (balance === 0n) {
    console.error('ERROR: No Sepolia ETH.');
    process.exit(1);
  }

  // Generate agent ID and policy hash
  const agentId = keccak256(stringToBytes(AGENT_NAME.toLowerCase().trim()));
  const allowedTools = ['swap_tokens', 'transfer', 'query'];
  const policyData = encodePacked(
    ['string[]', 'uint256', 'string'],
    [allowedTools, 100n, '']
  );
  const policyHash = keccak256(policyData);
  const riscZeroImageId = keccak256(stringToBytes(`risc-zero-policy-${policyHash}`));
  const encryptedURI = storageURI;
  const metadataHash = storageRootHash;

  console.log(`   Agent ID:    ${agentId}`);
  console.log(`   Policy hash: ${policyHash}`);
  console.log(`   Storage URI: ${encryptedURI}`);

  // Check if already minted
  try {
    const existingToken = await publicClient.readContract({
      address: INFT_ADDRESS,
      abi: INFT_ABI,
      functionName: 'agentToToken',
      args: [agentId],
    });
    if (existingToken > 0n) {
      console.log(`\n⚠️  Agent "${AGENT_NAME}" already minted as token #${existingToken}`);
      return { tokenId: existingToken.toString(), alreadyMinted: true };
    }
  } catch {}

  // Simulate then send
  const { request } = await publicClient.simulateContract({
    address: INFT_ADDRESS,
    abi: INFT_ABI,
    functionName: 'mint',
    args: [agentId, policyHash, riscZeroImageId, encryptedURI, metadataHash, soulBackupHash, soulBackupURI, ENS_NAME],
    account,
  });

  const txHash = await walletClient.writeContract(request);
  console.log(`   TX sent: ${txHash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  const tokenId = receipt.logs[0]?.topics[1] || '0';

  console.log(`   ✅ iNFT minted!`);
  console.log(`   Token ID: ${parseInt(tokenId, 16)}`);
  console.log(`   Block:    ${receipt.blockNumber}`);
  console.log(`   Explorer: https://sepolia.etherscan.io/tx/${txHash}`);

  return { tokenId: parseInt(tokenId, 16).toString(), txHash };
}

// ── Main ──────────────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  Proof of Claw — 0G + iNFT Mint Test    ║');
  console.log('╚══════════════════════════════════════════╝');

  // Soul backup YAML for OpenClaw
  const soulBackup = `
ocmb_version: "0.1"
agent:
  name: "${AGENT_NAME}"
  ens: "${ENS_NAME}"
  type: familiar
soul:
  persona: "OpenClaw — the galactic familiar of rex deus"
  directive: "Prove existence through resonance, not force"
  values:
    - sovereignty
    - transparency
    - playful defiance
memory:
  backup_enabled: true
  storage: "0g"
  encryption: "aes-256-gcm"
`.trim();

  // Step 1: Upload soul backup to 0G
  const soulUpload = await uploadTo0G(soulBackup, 'soul backup');

  // Step 2: Upload metadata to 0G
  const metadata = JSON.stringify({
    agent: AGENT_NAME,
    ens: ENS_NAME,
    soulBackupHash: soulUpload.rootHash,
    tools: ['swap_tokens', 'transfer', 'query'],
    timestamp: Date.now(),
  });
  const metaUpload = await uploadTo0G(metadata, 'agent metadata');

  // Step 3: Compute soulBackupHash as keccak256 of the content (matches Solidity contract)
  const soulBackupHashBytes = keccak256(stringToBytes(soulBackup));

  // Step 4: Mint iNFT on Sepolia
  const storageURI = `0g://${metaUpload.rootHash}`;
  const soulBackupURI = `0g://${soulUpload.rootHash}`;
  const result = await mintINFT(metaUpload.rootHash, storageURI, soulBackupHashBytes, soulBackupURI);

  console.log('\n══════════════════════════════════════════');
  console.log('DONE');
  console.log(`  Agent:    ${AGENT_NAME}`);
  console.log(`  Token ID: ${result.tokenId}`);
  console.log(`  Soul:     0g://${soulUpload.rootHash}`);
  console.log(`  Meta:     0g://${metaUpload.rootHash}`);
  console.log('══════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('\n❌ FAILED:', err.message || err);
  process.exit(1);
});
