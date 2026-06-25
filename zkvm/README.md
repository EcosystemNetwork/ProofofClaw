# RISC Zero zkVM Programs

## Prerequisites

To build and run RISC Zero proofs locally, you need:

```bash
# Install RISC Zero toolchain
curl -L https://risczero.com/install | bash
rzup install

# Verify installation
cargo risczero --version
```

## Building

```bash
# Build guest program first
cd guest
cargo build --release --target riscv32im-risc0-zkvm-elf

# Then build host
cd ../host
cargo build --release
```

## Running Locally

```bash
cd host
cargo run --release
```

## Note

For production use, you can use **Boundless** (RISC Zero's proving marketplace) instead of local proving:
- No GPU required
- Proof generation outsourced to network
- ~$0.30-$30 per proof depending on complexity
- Much faster than local CPU proving

See `../agent/src/proof_generator.rs` for Boundless integration.
