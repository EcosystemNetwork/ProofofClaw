#!/bin/bash
# Swap from Mock to Real RISC Zero Groth16 Verifier
#
# This script:
#   1. Deploys RiscZeroGroth16Verifier with the VK from your RISC Zero trusted setup
#   2. Updates the existing ProofOfClawVerifier to point to the real verifier
#   3. Updates the image ID to match your compiled guest
#   4. Prints the new verifier address for .env
#
# Prerequisites:
#   - forge installed (foundry)
#   - PRIVATE_KEY set (must be ProofOfClawVerifier owner)
#   - PROOF_OF_CLAW_VERIFIER_ADDRESS set (existing verifier contract)
#   - RISC_ZERO_IMAGE_ID set (from guest compilation)
#
# Usage:
#   ./scripts/swap-to-real-verifier.sh
#   # or with explicit key:
#   PRIVATE_KEY=0x... PROOF_OF_CLAW_VERIFIER_ADDRESS=0x... ./scripts/swap-to-real-verifier.sh

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Load .env if present
if [ -f "$(dirname "$0")/../.env" ]; then
    set -a
    source "$(dirname "$0")/../.env"
    set +a
fi

# Validate required env vars
if [ -z "$PRIVATE_KEY" ]; then
    echo -e "${RED}Error: PRIVATE_KEY not set${NC}"
    exit 1
fi

if [ -z "$PROOF_OF_CLAW_VERIFIER_ADDRESS" ]; then
    # Try the generic verifier address from .env
    if [ -n "$RISC_ZERO_VERIFIER_ADDRESS" ]; then
        echo -e "${YELLOW}PROOF_OF_CLAW_VERIFIER_ADDRESS not set, but this script needs the ProofOfClawVerifier address, not the IRiscZeroVerifier.${NC}"
    fi
    echo -e "${RED}Error: PROOF_OF_CLAW_VERIFIER_ADDRESS not set${NC}"
    echo "Set this to your deployed ProofOfClawVerifier contract address"
    exit 1
fi

if [ -z "$RISC_ZERO_IMAGE_ID" ]; then
    echo -e "${RED}Error: RISC_ZERO_IMAGE_ID not set${NC}"
    echo "Build the guest first: cd zkvm && cargo +risc0 build --release --target riscv32im-risc0-zkvm-elf -p proof-of-claw-guest"
    exit 1
fi

RPC_URL="${ZERO_G_CHAIN_RPC:-https://evmrpc-testnet.0g.ai}"

echo -e "${YELLOW}====================================${NC}"
echo -e "${YELLOW}Swapping to Real RISC Zero Verifier${NC}"
echo -e "${YELLOW}====================================${NC}"
echo ""
echo "  ProofOfClawVerifier: $PROOF_OF_CLAW_VERIFIER_ADDRESS"
echo "  Image ID:            $RISC_ZERO_IMAGE_ID"
echo "  RPC:                 $RPC_URL"
echo ""

cd "$(dirname "$0")/../contracts"

# Dry run
echo -e "${YELLOW}Running dry run...${NC}"
PRIVATE_KEY="$PRIVATE_KEY" \
PROOF_OF_CLAW_VERIFIER_ADDRESS="$PROOF_OF_CLAW_VERIFIER_ADDRESS" \
RISC_ZERO_IMAGE_ID="$RISC_ZERO_IMAGE_ID" \
forge script script/DeployRealVerifier.s.sol \
    --rpc-url "$RPC_URL" \
    --evm-version cancun \
    -vvv 2>&1 | tail -20

echo ""
echo -e "${GREEN}Dry run passed. Deploy for real? (y/n)${NC}"
read -r response

if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    echo -e "${YELLOW}Broadcasting...${NC}"

    PRIVATE_KEY="$PRIVATE_KEY" \
    PROOF_OF_CLAW_VERIFIER_ADDRESS="$PROOF_OF_CLAW_VERIFIER_ADDRESS" \
    RISC_ZERO_IMAGE_ID="$RISC_ZERO_IMAGE_ID" \
    forge script script/DeployRealVerifier.s.sol \
        --rpc-url "$RPC_URL" \
        --broadcast \
        --evm-version cancun \
        -vvv

    echo ""
    echo -e "${GREEN}Done! Update your .env:${NC}"
    echo -e "  ${YELLOW}RISC_ZERO_VERIFIER_ADDRESS=<new address from output above>${NC}"
    echo ""
    echo -e "${GREEN}Next: generate a real Groth16 proof and test verifyAndExecute()${NC}"
else
    echo -e "${YELLOW}Cancelled${NC}"
fi
