use risc0_binfmt::compute_image_id;
use std::fs;

fn main() {
    let elf_path = std::env::args()
        .nth(1)
        .unwrap_or_else(|| "../target/riscv32im-risc0-zkvm-elf/release/proof-of-claw-guest".to_string());

    let elf_bytes = fs::read(&elf_path).expect("Failed to read ELF file");
    let image_id = compute_image_id(&elf_bytes).expect("Failed to compute image ID");

    println!("ELF path: {}", elf_path);
    println!("ELF size: {} bytes", elf_bytes.len());
    println!("Image ID: 0x{}", hex::encode(image_id.as_bytes()));
}
