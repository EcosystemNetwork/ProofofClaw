#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Proof of Claw — Multi-Chain Deployment Script
# ═══════════════════════════════════════════════════════════════════════════════
#
# Usage:
#   ./deploy_multichain.sh <chain>
#
# Chains:
#   sepolia        Ethereum Sepolia testnet
#   mainnet        Ethereum mainnet (requires confirmation)
#   0g-testnet     0G Galileo testnet
#   0g-mainnet     0G mainnet (requires confirmation)
#   all-testnets   Deploy to all testnets sequentially
#
# Required env vars:
#   PRIVATE_KEY          Deployer wallet private key
#   RISC_ZERO_IMAGE_ID   RISC Zero guest image ID (auto-detected from proof_output.json)
#
# Optional env vars:
#   ETHERSCAN_API_KEY    For contract verification
#   DEPLOY_FULL_SUITE    Deploy all contracts (default: true)

set -euo pipefail

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ── Helpers ───────────────────────────────────────────────────────────────────
info()  { echo -e "${CYAN}[INFO]${NC} $1"; }
ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ── Validate environment ─────────────────────────────────────────────────────
[[ -z "${PRIVATE_KEY:-}" ]] && err "PRIVATE_KEY not set. Export it first: export PRIVATE_KEY=0x..."

if [[ -z "${RISC_ZERO_IMAGE_ID:-}" ]]; then
  if [[ -f "proof_output.json" ]]; then
    RISC_ZERO_IMAGE_ID=$(grep -o '"image_id": "[^"]*"' proof_output.json | cut -d'"' -f4)
    export RISC_ZERO_IMAGE_ID
    info "Auto-detected image ID from proof_output.json: ${RISC_ZERO_IMAGE_ID}"
  else
    err "RISC_ZERO_IMAGE_ID not set and proof_output.json not found"
  fi
fi

# ── Chain configuration ──────────────────────────────────────────────────────
declare -A CHAIN_RPC CHAIN_ID CHAIN_VERIFY_URL CHAIN_VERIFY_KEY CHAIN_LABEL CHAIN_TESTNET

CHAIN_LABEL[sepolia]="Ethereum Sepolia"
CHAIN_RPC[sepolia]="${SEPOLIA_RPC_URL:-https://rpc.sepolia.org}"
CHAIN_ID[sepolia]=11155111
CHAIN_VERIFY_URL[sepolia]="https://api-sepolia.etherscan.io/api"
CHAIN_VERIFY_KEY[sepolia]="${ETHERSCAN_API_KEY:-}"
CHAIN_TESTNET[sepolia]=true

CHAIN_LABEL[mainnet]="Ethereum Mainnet"
CHAIN_RPC[mainnet]="${MAINNET_RPC_URL:-https://eth.llamarpc.com}"
CHAIN_ID[mainnet]=1
CHAIN_VERIFY_URL[mainnet]="https://api.etherscan.io/api"
CHAIN_VERIFY_KEY[mainnet]="${ETHERSCAN_API_KEY:-}"
CHAIN_TESTNET[mainnet]=false

CHAIN_LABEL[0g-testnet]="0G Testnet (Galileo)"
CHAIN_RPC[0g-testnet]="https://evmrpc-testnet.0g.ai"
CHAIN_ID[0g-testnet]=16602
CHAIN_VERIFY_URL[0g-testnet]="https://chainscan-galileo.0g.ai/open/api"
CHAIN_VERIFY_KEY[0g-testnet]=""
CHAIN_TESTNET[0g-testnet]=true

CHAIN_LABEL[0g-mainnet]="0G Mainnet"
CHAIN_RPC[0g-mainnet]="https://evmrpc.0g.ai"
CHAIN_ID[0g-mainnet]=16605
CHAIN_VERIFY_URL[0g-mainnet]="https://chainscan.0g.ai/open/api"
CHAIN_VERIFY_KEY[0g-mainnet]=""
CHAIN_TESTNET[0g-mainnet]=false

# ── Deploy function ──────────────────────────────────────────────────────────
deploy_chain() {
  local chain="$1"
  local label="${CHAIN_LABEL[$chain]}"
  local rpc="${CHAIN_RPC[$chain]}"
  local is_testnet="${CHAIN_TESTNET[$chain]}"
  local verify_key="${CHAIN_VERIFY_KEY[$chain]}"

  echo ""
  echo "═══════════════════════════════════════════════════════════"
  info "Deploying to ${label} (chain ${CHAIN_ID[$chain]})"
  echo "═══════════════════════════════════════════════════════════"

  # Mainnet confirmation gate
  if [[ "$is_testnet" != "true" ]]; then
    warn "This is a MAINNET deployment. Funds are at risk."
    read -p "Type 'deploy' to confirm: " confirm
    [[ "$confirm" != "deploy" ]] && { warn "Aborted."; return 1; }
  fi

  local verify_args=""
  if [[ -n "$verify_key" ]]; then
    verify_args="--verify --etherscan-api-key $verify_key"
  fi

  cd "$(dirname "$0")/contracts"

  forge script script/DeployMultiChain.s.sol:DeployMultiChainScript \
    --rpc-url "$rpc" \
    --broadcast \
    $verify_args \
    -vvvv

  cd ..

  ok "Deployment to ${label} complete!"
  echo ""

  # Save deployment record
  local record_file="deployments/${chain}-$(date +%Y%m%d-%H%M%S).log"
  mkdir -p deployments
  echo "Chain: ${label} (${CHAIN_ID[$chain]})" > "$record_file"
  echo "Deployed at: $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$record_file"
  echo "Image ID: ${RISC_ZERO_IMAGE_ID}" >> "$record_file"
  info "Deployment record saved to ${record_file}"
}

# ── Main ─────────────────────────────────────────────────────────────────────
CHAIN="${1:-}"

if [[ -z "$CHAIN" ]]; then
  echo ""
  echo "Proof of Claw — Multi-Chain Deployment"
  echo ""
  echo "Usage: $0 <chain>"
  echo ""
  echo "Testnets:"
  echo "  sepolia       Ethereum Sepolia"
  echo "  0g-testnet    0G Galileo testnet"
  echo ""
  echo "Mainnets:"
  echo "  mainnet       Ethereum mainnet"
  echo "  0g-mainnet    0G mainnet"
  echo ""
  echo "Special:"
  echo "  all-testnets  Deploy to all testnets"
  echo ""
  exit 0
fi

if [[ "$CHAIN" == "all-testnets" ]]; then
  info "Deploying to all testnets..."
  for net in sepolia 0g-testnet; do
    deploy_chain "$net" || warn "Skipping ${net} due to error"
  done
  ok "All testnet deployments complete!"
elif [[ -n "${CHAIN_RPC[$CHAIN]:-}" ]]; then
  deploy_chain "$CHAIN"
else
  err "Unknown chain: ${CHAIN}. Run without arguments to see available chains."
fi
