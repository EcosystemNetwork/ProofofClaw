fn main() {
    // Guest ELF is included directly via include_bytes! in main.rs
    // No need for risc0_build::embed_methods() since we compile the guest separately
    // with: cargo +risc0 build --release --target riscv32im-risc0-zkvm-elf -p proof-of-claw-guest
}
