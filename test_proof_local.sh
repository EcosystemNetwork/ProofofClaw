#!/bin/bash
set -e

echo "=== Proof of Claw - Local Proof Generation Test ==="
echo ""

echo "1. Testing proof generation with mock data..."
cd agent
cargo test proof_generator --lib -- --nocapture

echo ""
echo "2. Running end-to-end proof test..."
cargo test test_proof_generation_mock -- --nocapture

echo ""
echo "✅ All proof tests passed!"
echo ""
echo "Note: This uses mock proof generation for testing."
echo "For production, you would:"
echo "  - Install RISC Zero toolchain: curl -L https://risczero.com/install | bash"
echo "  - Build guest program: cd zkvm/guest && cargo build --release"
echo "  - Or use Boundless proving marketplace (recommended)"
