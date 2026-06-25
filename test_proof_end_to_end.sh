#!/bin/bash
set -e

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║     Proof of Claw - End-to-End Proof Generation Test          ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

cd proof_of_claw

echo "Test 1: Proof Generation Requires Guest ELF"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cargo test test_proof_generation_requires_guest_elf -- --nocapture
echo "Passed"
echo ""

echo "Test 2: Receipt Verification Rejects Invalid Data"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cargo test test_verify_receipt_rejects_invalid_data -- --nocapture
echo "Passed"
echo ""

echo "Test 3: IronClaw Trace Conversion"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cargo test test_ironclaw_trace_conversion -- --nocapture
echo "Passed"
echo ""

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                    ALL TESTS PASSED                            ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "Summary:"
echo "  - Proof generation: Requires real guest ELF (no mock fallback)"
echo "  - Receipt verification: Rejects non-RISC-Zero data"
echo "  - IronClaw integration: Working"
echo ""
echo "Next Steps:"
echo "  1. Build the guest ELF:"
echo "     cd zkvm && cargo risczero build --release"
echo ""
echo "  2. Or use Boundless (recommended):"
echo "     - No local proving setup required"
echo "     - Decentralized proving network"
echo ""
echo "  3. Deploy contracts:"
echo "     cd contracts && forge script script/Deploy0GTestnet.s.sol --broadcast"
echo ""
