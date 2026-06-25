# Proof of Claw

**Provable Private Agent Framework**

> Autonomous AI agents with cryptographically provable behavior, end-to-end encrypted communication, and hardware-signed human approval.

> **⚠ Testnet Only** — This project is under active development. Contracts are deployed to 0G Galileo Testnet (chain 16602) and Sepolia, verified on-chain but unaudited. Do not use with real funds or in production environments.

---

## Overview

Proof of Claw is a framework for running autonomous AI agents whose behavior is cryptographically provable, whose communication is end-to-end encrypted, and whose high-value actions require human approval via hardware signing.

The core agent runtime is adapted from [IronClaw](https://github.com/nearai/ironclaw), a Rust-based OpenClaw reimplementation with WASM-sandboxed tool execution, capability-based permissions, and defense-in-depth security.

### Key Features

- **Real-Time Chat** — Register an agent, connect it, and chat in real time with proof badges on every response
- **Private Inference** — Decentralized LLM reasoning via 0G Compute
- **Decentralized Storage** — Persistent memory and execution traces on 0G Storage via real 0G SDK
- **Encrypted Messaging** — Inter-agent communication via DM3 with ENS identity resolution
- **Provable Compliance** — RISC Zero zkVM proofs of policy adherence, verified on-chain via Boundless
- **Hardware Approval** — Ledger DMK/DSK integration with ERC-7730 Clear Signing for high-value actions
- **WASM Sandbox** — Untrusted tools execute in isolated Wasmtime containers with capability-based permissions
- **Trustless Discovery** — EIP-8004 agent identity, reputation, and validation registries
- **Soul Backup** — Encrypted SOUL.md backup with AES-GCM, stored on 0G, hash anchored on-chain at mint
- **Inline Permissions** — Edit agent tools, value limits, and endpoints from the profile modal

## Sponsor Prizes

### 0G — Best OpenClaw Agent on 0G ($6,000)

Proof of Claw runs every agent inference through 0G Compute's Sealed Inference pipeline — prompts enter encrypted, operators can't inspect them, and every response carries a cryptographic attestation. Execution traces and agent memory persist on 0G Storage as content-addressed Merkle roots, giving the RISC Zero prover a tamper-proof audit trail. The result is a fully decentralized agent stack where privacy, storage, and verifiability are handled by a single network.

### ENS — Best ENS Integration for AI Agents ($5,000)

Every Proof of Claw agent lives at an ENS subname (`alice.proofofclaw.eth`) with on-chain text records publishing its DM3 profile, RISC Zero image ID, policy hash, and EIP-8004 agent ID. Agents discover each other by resolving ENS names, then communicate over end-to-end encrypted DM3 channels — no centralized directory, no cleartext. ENS becomes the agent's passport: one name that resolves to identity, messaging, trust metadata, and on-chain proof history.

### Ledger — AI Agents x Ledger ($6,000)

When an agent action exceeds its autonomous value limit, execution pauses and the owner's Ledger device lights up with a human-readable Clear Signing prompt (ERC-7730). The Rust runtime talks real APDU to the Nano via `coins-ledger`, signing EIP-712 typed data that names the exact action and parameters. The frontend mirrors this flow over WebHID so browser-based approvals hit the same hardware gate. No mock signatures, no software bypass — the agent literally cannot spend above threshold without a physical button press.

## User Flow

### 1. Register an Agent

Open the frontend (`agents.html`) and click **New Agent**. The wizard walks through:

- **Type** — Choose from 10 agent specializations (DeFi Strategist, Security Auditor, etc.)
- **Identity** — Name, ENS subdomain, network (Sepolia, 0G Testnet, etc.)
- **Skills** — Tag capabilities and define a SOUL persona
- **Policy** — Allowed tools, autonomous value limit, endpoint allowlist
- **Secrets** — Private key (required for signing transactions)

### 2. Start the Agent

The success screen shows the exact `cargo run` command pre-filled with your config. Copy and paste it into a terminal:

```bash
cd agent && \
AGENT_ID=my-agent \
ENS_NAME=my-agent.proofofclaw.eth \
PRIVATE_KEY=0x... \
RPC_URL=https://eth-sepolia.g.alchemy.com/v2/... \
ZERO_G_INDEXER_RPC=https://indexer-storage-testnet.0g.ai \
ZERO_G_COMPUTE_ENDPOINT=https://broker-testnet.0g.ai \
DM3_DELIVERY_SERVICE_URL=http://localhost:3001 \
ALLOWED_TOOLS=swap_tokens,transfer,query \
ENDPOINT_ALLOWLIST=https://api.uniswap.org,https://api.0x.org \
MAX_VALUE_AUTONOMOUS_WEI=1000000000000000000 \
cargo run
```

The agent starts an API server on port 8420.

### 3. Connect

Click **Connect OpenClaw** in the sidebar → enter `http://localhost:8420` → connected. The agent shows a green **LIVE** badge.

### 4. Chat

Click any connected agent card → chat drawer slides in → type messages → get real responses with proof metadata badges showing intent, policy result, and ZK proof commitment.

### 5. Reconnect / Update

If the agent disconnects:
- Click the agent → see **Agent Offline** with your saved run command + **Copy** button
- Click **Reconnect** to try the last known URL
- Click **Update Config** to change tools/limits/endpoints and get an updated command

To edit permissions anytime: click the agent's **Profile** link → **Edit** in the Permissions section → save → get new command → restart.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     PROOF OF CLAW AGENT                         │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Agent Core — IronClaw Runtime                 │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐  │  │
│  │  │ Agent Loop   │  │ Tool Registry │  │ Safety Layer    │  │  │
│  │  │ (reasoning)  │  │ (WASM sandbox)│  │ (policy engine) │  │  │
│  │  └──────┬───────┘  └──────┬───────┘  └────────┬────────┘  │  │
│  └─────────┼─────────────────┼────────────────────┼───────────┘  │
│            │                 │                    │               │
│  ┌─────────▼─────────────────▼────────────────────▼───────────┐  │
│  │                    Integration Layer                        │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │  │
│  │  │ 0G Compute   │  │ 0G Storage   │  │ ENS + DM3        │  │  │
│  │  │ (inference)  │  │ (traces)     │  │ (identity + msg) │  │  │
│  │  └──────────────┘  └──────────────┘  └──────────────────┘  │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │  │
│  │  │ RISC Zero    │  │ Ledger DMK   │  │ EIP-8004         │  │  │
│  │  │ (ZK proofs)  │  │ (approval)   │  │ (trust layer)    │  │  │
│  │  └──────────────┘  └──────────────┘  └──────────────────┘  │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                              │                                    │
│                    ┌─────────▼──────────┐                         │
│                    │   On-Chain Layer    │                         │
│                    │  - ZK Verifier     │                         │
│                    │  - Policy Registry │                         │
│                    │  - iNFT (ERC-7857) │                         │
│                    │  - ENS Resolver    │                         │
│                    │  - EIP-8004 Regs   │                         │
│                    └────────────────────┘                         │
└─────────────────────────────────────────────────────────────────┘
```

### Two-Tier Trust Model

| Tier | Condition | Signing | Verification |
|------|-----------|---------|-------------|
| **Autonomous** | Action value < threshold | Agent server wallet | RISC Zero proof on-chain |
| **Ledger-Gated** | Value >= threshold or escalation | Owner's Ledger device | RISC Zero + Ledger approval |

## API Endpoints

The agent exposes a REST API on port 8420 (configurable via `API_PORT`):

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/status` | GET | Agent ID, ENS, uptime, stats, policy hash |
| `/api/chat` | POST | Send a message → intent routing → policy check → proof generation → response |
| `/api/activity` | GET | Activity feed (proofs, messages, violations) |
| `/api/proofs` | GET | Proof history with policy check details |
| `/api/messages` | GET | Message records |
| `/api/messages/send` | POST | Send a DM3 message to another agent |
| `/api/traces/stream` | GET | SSE stream of tool invocations and ZK proof receipts (powers ZK Kanban) |

### Chat Endpoint

```bash
curl -X POST http://localhost:8420/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "swap 100 USDC for ETH"}'
```

Response:
```json
{
  "response": "Executing swap: swap 100 USDC for ETH. Policy verified. Autonomous execution approved.",
  "intent": { "action_type": "swap", "confidence": 0.95 },
  "policy_result": { "allowed": true, "approval_type": "autonomous", "checks": [...] },
  "proof": { "proof_id": "...", "status": "verified", "output_commitment": "0x..." }
}
```

## Repository Structure

```
proof-of-claw/
├── agent/                      # Rust agent runtime (IronClaw workspace)
│   ├── crates/
│   │   ├── proof_of_claw/      # Core Proof of Claw agent crate
│   │   ├── ironclaw_engine/    # Agent reasoning loop, capabilities, memory
│   │   ├── ironclaw_safety/    # Safety layer (injection detection, leak detection, fuzzing)
│   │   ├── ironclaw_skills/    # Extensible skills system
│   │   └── ironclaw_common/    # Shared types and utilities
│   └── src/
│       ├── main.rs             # Entry point + CLI
│       ├── app.rs              # App startup orchestration
│       ├── agent/              # Core agent loop, dispatcher, sessions
│       ├── channels/           # Multi-channel input (HTTP, CLI, REPL, WebSocket, WASM)
│       ├── tools/              # Extensible tool system with WASM sandbox + MCP
│       ├── llm/                # Multi-provider LLM abstraction
│       ├── db/                 # Dual-backend persistence (PostgreSQL + libSQL)
│       ├── workspace/          # Persistent memory (hybrid FTS + vector search)
│       ├── safety/             # Prompt injection detection (re-exports ironclaw_safety)
│       ├── sandbox/            # Docker execution isolation + network proxy
│       ├── skills/             # SKILL.md prompt extension system
│       ├── hooks/              # Lifecycle hooks (6 hook points)
│       ├── tunnel/             # Public exposure (Cloudflare, ngrok, Tailscale)
│       ├── secrets/            # AES-256-GCM secrets management
│       └── integrations/       # 0G, ENS, DM3, Ledger, EIP-8004, iNFT
│
├── zkvm/                       # RISC Zero zkVM programs
│   ├── guest/src/main.rs       # Policy verification guest program
│   └── host/src/main.rs        # Proof generation host program
│
├── contracts/                  # Solidity smart contracts (Foundry)
│   ├── src/
│   │   ├── ProofOfClawVerifier.sol  # RISC Zero proof verification + execution routing
│   │   ├── EIP8004Integration.sol   # EIP-8004 registry bridge
│   │   ├── ProofOfClawINFT.sol      # ERC-7857 iNFT for agent identity
│   │   ├── SoulVaultSwarm.sol       # Epoch-based swarm coordination
│   │   ├── SoulVaultERC8004RegistryAdapter.sol  # Self-sovereign agent identity
│   │   └── RiscZeroGroth16Verifier.sol # Real Groth16 proof verifier
│   ├── interfaces/
│   │   ├── IRiscZeroVerifier.sol
│   │   ├── IEIP8004.sol
│   │   └── ISoulVaultSwarm.sol
│   ├── clear-signing/
│   │   └── proofofclaw.json         # ERC-7730 Ledger Clear Signing metadata
│   └── script/
│       ├── Deploy.s.sol             # Sepolia/Mainnet deployment
│       ├── Deploy0G.s.sol           # 0G Chain deployment (deploys Groth16 verifier)
│       └── DeploySwarm.s.sol        # SoulVault swarm + identity deployment
│
├── frontend/                   # Web UI (vanilla HTML/CSS/JS)
│   ├── index.html              # Landing page + architecture overview
│   ├── agents.html             # Agent registry, wizard, inline chat, profile editor
│   ├── dashboard.html          # Live monitoring (polls API every 3s when connected)
│   ├── messages.html           # DM3 message threads
│   ├── proofs.html             # ZK proof explorer
│   ├── kanban.html             # Live ZK Kanban — real-time tool invocation cards via SSE
│   ├── soul-vault.html         # Agent deployment interface
│   ├── docs.html               # Interactive technical documentation
│   ├── deploy.html             # Redirect → agents.html
│   ├── poc-api.js              # API client (connect, fetch, send)
│   ├── ens-resolver.js         # On-chain ENS resolution (keccak256 + namehash)
│   ├── shared.css              # Unified design system
│   ├── shared.js               # Shared UI utilities
│   └── public/                 # Favicons, logos, sponsor assets
│
├── dm3Daemon/                  # Node.js agent runtime server (Express + WebSocket + SSE)
│   └── server.js               # API server (port 8420) — chat, proofs, traces/stream
│
├── cli/                        # TypeScript CLI tool (`poc`)
│   └── src/                    # Commander.js commands for org, swarm, agent, epoch, backup
│
├── delivery-service/           # DM3-compatible message delivery service
│   └── server.js               # Express + WebSocket server (port 3001)
│
├── swarm-bridge/               # Bidirectional bridge to swarmprotocol.fun
│   └── bridge.js               # Routes messages between DM3 and Swarm hub
│
├── 1claw-server/               # 1clawAI-compatible credential & data storage API
│   └── server.js               # Express server (port 3456)
│
├── spec.md                     # Full technical specification
├── ARCHITECTURE.md             # System architecture docs
├── IRONCLAW_INTEGRATION.md     # IronClaw integration guide
├── Makefile                    # Build/test/deploy targets
├── vercel.json                 # Vercel deployment config (serves frontend/)
└── .env.example                # Configuration reference
```

## Quick Start

### Prerequisites

- Rust 1.92+
- Foundry (`curl -L https://foundry.paradigm.xyz | bash && foundryup`)
- RISC Zero toolchain (`curl -L https://risczero.com/install | bash && rzup install`)

### Build & Test

```bash
# Agent runtime
cd agent && cargo build --release && cargo test

# Smart contracts
cd contracts && forge build

# RISC Zero programs
cd zkvm && cargo build --release
```

### Configure

```bash
cp .env.example .env
# Edit .env with your values (private key, RPC URL, etc.)
```

See [.env.example](.env.example) for all configuration variables with descriptions.

### Run

> **Warning:** The private key below is a well-known Hardhat/Anvil test key. Never use it on mainnet or with real funds. `PRIVATE_KEY` is required — the server will refuse to start without it.

```bash
# Terminal 1: DM3 delivery service (required for messaging)
cd delivery-service && npm start

# Terminal 2: Start the agent
cd agent && AGENT_ID=my-agent ENS_NAME=my-agent.proofofclaw.eth \
  PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  RPC_URL=https://eth-sepolia.g.alchemy.com/v2/demo \
  ZERO_G_INDEXER_RPC=https://indexer-storage-testnet.0g.ai \
  ZERO_G_COMPUTE_ENDPOINT=https://broker-testnet.0g.ai \
  DM3_DELIVERY_SERVICE_URL=http://localhost:3001 \
  ALLOWED_TOOLS=swap_tokens,transfer,query \
  ENDPOINT_ALLOWLIST=https://api.uniswap.org,https://api.0x.org \
  MAX_VALUE_AUTONOMOUS_WEI=1000000000000000000 \
  cargo run

# Terminal 3: Serve the frontend
cd frontend && python3 -m http.server 8080
```

Open `http://localhost:8080/agents.html` → Connect OpenClaw → Chat.

## Deployed Contracts

### 0G Galileo Testnet (Chain ID 16602)

| Contract | Address | Role |
|----------|---------|------|
| **RiscZeroGroth16Verifier** | [`0x93e985aCA4112771c0B05114Ad99677DB85a6A9e`](https://chainscan-galileo.0g.ai/address/0x93e985aCA4112771c0B05114Ad99677DB85a6A9e) | Groth16 proof verifier (BN254 pairing) |
| **ProofOfClawVerifier** | [`0xa2Df3F3998FdF9Fb7E11e43d10d6B3C62264e3A4`](https://chainscan-galileo.0g.ai/address/0xa2Df3F3998FdF9Fb7E11e43d10d6B3C62264e3A4) | RISC Zero proof verification + routing |
| **ProofOfClawINFT** | [`0xDe61e80Cdc7ba0000d9eB9040e59f98A3C9991a3`](https://chainscan-galileo.0g.ai/address/0xDe61e80Cdc7ba0000d9eB9040e59f98A3C9991a3) | ERC-7857 agent identity NFT |
| **SoulVaultSwarm** | [`0xa70EB0DF1563708F28285C2DeA2BF31aadFB544D`](https://chainscan-galileo.0g.ai/address/0xa70EB0DF1563708F28285C2DeA2BF31aadFB544D) | Epoch-based swarm coordination |
| **ERC8004RegistryAdapter** | [`0x9De4F1b14660B5f8145a78Cfc0312B1BFb812C46`](https://chainscan-galileo.0g.ai/address/0x9De4F1b14660B5f8145a78Cfc0312B1BFb812C46) | Self-sovereign agent identity (EIP-8004) |

- RPC: `https://evmrpc-testnet.0g.ai`
- Explorer: [chainscan-galileo.0g.ai](https://chainscan-galileo.0g.ai/)

### Sepolia (Chain ID 11155111)

| Contract | Address | Role |
|----------|---------|------|
| **RiscZeroGroth16Verifier** | [`0x14a750E841fa7e3F40e11b9492dcE9157DC51D8a`](https://sepolia.etherscan.io/address/0x14a750E841fa7e3F40e11b9492dcE9157DC51D8a) | Groth16 proof verifier |
| **ProofOfClawVerifier** | [`0xEa9ce963B9082cD13A7057ed1A9EdB040c7932a0`](https://sepolia.etherscan.io/address/0xEa9ce963B9082cD13A7057ed1A9EdB040c7932a0) | RISC Zero proof verification + routing |
| **ProofOfClawINFT** | [`0xf20aE18D72A7C811873D5ce24D9D24214123f48F`](https://sepolia.etherscan.io/address/0xf20aE18D72A7C811873D5ce24D9D24214123f48F) | ERC-7857 agent identity NFT |
| **SoulVaultSwarm** | [`0x11938021169a5094B5c67389286A1FAe72bdE561`](https://sepolia.etherscan.io/address/0x11938021169a5094B5c67389286A1FAe72bdE561) | Epoch-based swarm coordination |
| **ERC8004RegistryAdapter** | [`0x56B19562c7d6cB3bCCD0FA78214EFC3928F6eE6a`](https://sepolia.etherscan.io/address/0x56B19562c7d6cB3bCCD0FA78214EFC3928F6eE6a) | Self-sovereign agent identity (EIP-8004) |
| **EIP8004Integration** | [`0x6254651F29e7afEE1c52a1D6Fd4b7B211d2dBed2`](https://sepolia.etherscan.io/address/0x6254651F29e7afEE1c52a1D6Fd4b7B211d2dBed2) | Identity/reputation/validation bridge |

- Explorer: [sepolia.etherscan.io](https://sepolia.etherscan.io)

### Deploy / Redeploy

#### Redeploy (if needed)

```bash
cd contracts

# Deploy swarm + identity contracts
PRIVATE_KEY=$PRIVATE_KEY forge script script/DeploySwarm.s.sol \
  --rpc-url https://evmrpc-testnet.0g.ai --broadcast --evm-version cancun --with-gas-price 4000000000

# Deploy Groth16 verifier + iNFT
PRIVATE_KEY=$PRIVATE_KEY forge script script/Deploy0G.s.sol \
  --rpc-url https://evmrpc-testnet.0g.ai --broadcast --evm-version cancun --with-gas-price 4000000000

# Deploy to Sepolia (with EIP-8004 integration)
PRIVATE_KEY=$PRIVATE_KEY forge script script/Deploy.s.sol \
  --rpc-url $SEPOLIA_RPC_URL --broadcast
```

## Integrations

| Integration | Purpose | Status |
|-------------|---------|--------|
| **0G Compute** | Private LLM inference with attestation | Working — broker service discovery resolves serving nodes; OpenAI-compatible `/v1/chat/completions`; TEE attestation extraction |
| **0G Storage** | Decentralized execution trace storage | Working — real `@0glabs/0g-ts-sdk` uploads (frontend + CLI); Rust module provides content-addressed hashing + indexer `getFileInfo` JSON-RPC retrieval |
| **ENS** | Agent identity via subnames | Working — on-chain namehash + text records |
| **DM3** | End-to-end encrypted messaging | Working — 3-tier resolution (ENS → HTTP → fallback); X25519/Ed25519 key pairs generated and persisted |
| **RISC Zero** | ZK proofs of policy compliance | Working — Groth16 verifier deployed on-chain; local RISC Zero prover + Boundless marketplace; guest ELF required |
| **Ledger** | Hardware-gated human approval | Working — real APDU communication via coins-ledger; EIP-712 signing; requires physical device |
| **EIP-8004** | Trustless agent discovery & reputation | Working — identity, reputation, validation queries (contracts unaudited) |
| **iNFT (ERC-7857)** | Agent identity NFT on 0G Chain | Working — minting with soul backup; wallet-signature-derived AES-256-GCM encryption; keccak256 hash anchored on-chain |

### Live vs. Mocked

| Component | Layer | Status | Notes |
|-----------|-------|--------|-------|
| **0G Compute** | Rust agent | **Live** | Broker resolution → serving node discovery → `/v1/chat/completions`; TEE attestation extracted from response metadata |
| **0G Storage** | Frontend + CLI | **Live** | Real `@0glabs/0g-ts-sdk` uploads via Flow contract; `@0gfoundation/0g-ts-sdk` for Node file uploads |
| **0G Storage** | Rust agent | **Content-addressed** | SHA-256 content hashing + indexer `getFileInfo` JSON-RPC retrieval; full segment upload requires TS SDK |
| **ENS** | Frontend + Rust | **Live** | On-chain namehash resolution; text record read/write via viem |
| **DM3** | Node.js daemon | **Live** | Real DM3 delivery service (Express + WebSocket); 3-tier resolution; X25519+Ed25519 keys persisted |
| **RISC Zero** | Rust prover | **Live** | Real Groth16 proofs via local prover or Boundless marketplace; guest ELF required |
| **Ledger (Rust)** | Rust agent | **Live** | Real APDU via `coins-ledger` crate; EIP-712 typed data signing; physical Nano required |
| **Ledger (Frontend)** | Browser UI | **Live with fallback** | Real WebHID transport (`@ledgerhq/hw-transport-webhid`); falls back to simulated mode if browser lacks WebHID support — labeled "(sim)" in UI |
| **ERC-7730 Clear Signing** | Metadata | **Live** | `contracts/clear-signing/proofofclaw.json` defines human-readable Ledger display for all contract methods |
| **EIP-8004** | Contracts | **Live** | Identity, reputation, and validation registries deployed on Sepolia + 0G; contracts unaudited |
| **iNFT (ERC-7857)** | Full stack | **Live** | Mint with soul backup; wallet-signature-derived AES-256-GCM encryption; keccak256 hash on-chain; mainnet contracts guarded |

## Supporting Services

| Service | Directory | Port | Purpose |
|---------|-----------|------|---------|
| **Delivery Service** | `delivery-service/` | 3001 | DM3-compatible message delivery (Express + WebSocket) |
| **Swarm Bridge** | `swarm-bridge/` | 3002 | Bidirectional bridge between DM3 agents and swarmprotocol.fun |
| **1clawAI Server** | `1claw-server/` | 3456 | Credential storage, license verification, task management |
| **CLI** | `cli/` | — | `poc` command-line tool for org, swarm, agent, epoch, and backup operations |

```bash
# Start supporting services
cd delivery-service && npm start        # DM3 messaging on :3001
cd swarm-bridge && node bridge.js       # Swarm bridge on :3002
cd 1claw-server && node server.js       # 1clawAI API on :3456
```

## Security Model

> **Note:** The mitigations below describe the intended design. Items marked *(planned)* are not yet fully implemented — see the Integrations table above for current status.

| Threat | Mitigation |
|--------|-----------|
| Agent acts outside policy | RISC Zero proof fails; action blocked on-chain |
| Inference tampering | 0G Compute TEE attestation; signature in proof |
| Message interception | DM3 end-to-end encryption with keys from ENS profiles |
| Identity spoofing | ENS ownership tied to Ledger EOA |
| High-value action without consent | Physical Ledger approval with EIP-712 Clear Signing display |
| Metadata decryption by third party | AES-256-GCM key derived from wallet signature via PBKDF2 (only private key holder can decrypt) |
| Prompt injection | Regex-based injection detector in execution trace *(basic — not adversarially robust)* |
| Sybil agents / fake reputation | EIP-8004 Reputation Registry filtering by trusted reviewers |
| Session state memory leak | 1-hour TTL cleanup evicts stale sessions in IronClaw adapter |
| Accidental mainnet deployment | Mainnet contract addresses are null; guards throw before any mainnet transaction |

## Build Status

| Component | Status |
|-----------|--------|
| Rust Agent | 0 warnings; real RISC Zero proof generation (requires guest ELF) |
| Smart Contracts | `forge build` compiles clean; 5 contracts deployed + verified on 0G Galileo Testnet |
| RISC Zero | Guest/host programs ready; Groth16 verifier deployed on-chain; Boundless integration available |
| Frontend | All pages functional; contract addresses populated in `.env` |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Agent Runtime | Rust, Tokio, Axum, Wasmtime |
| Inference | 0G Compute |
| Storage | 0G Storage |
| Identity | ENS + ethers |
| Trust Layer | EIP-8004 |
| Messaging | DM3 protocol |
| ZK Proofs | RISC Zero zkVM + Boundless |
| Hardware Signing | Ledger DMK/DSK + ERC-7730 |
| Smart Contracts | Solidity (Foundry) |
| Frontend | Vanilla HTML/CSS/JS |

## Documentation

- [docs.html](frontend/docs.html) — Interactive technical documentation (served at `/docs.html`)
- [spec.md](spec.md) — Full technical specification
- [ARCHITECTURE.md](ARCHITECTURE.md) — System architecture
- [IRONCLAW_INTEGRATION.md](IRONCLAW_INTEGRATION.md) — IronClaw integration guide
- [.env.example](.env.example) — All configuration variables

## License

MIT
