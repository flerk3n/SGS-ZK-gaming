// ZK Memory Card Reveal - Host Program (RISC Zero)
// Generates proofs that a card reveal is honest without revealing the full deck

use methods::{CARD_REVEAL_GUEST_ELF, CARD_REVEAL_GUEST_ID};
use risc0_zkvm::{default_prover, ExecutorEnv};
use sha2::{Sha256, Digest};

fn main() {
    // Initialize tracing for logs
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::filter::EnvFilter::from_default_env())
        .init();

    // Example: Prove that position 1 has value 1 in deck [0, 1, 0, 1]
    let deck: [u8; 4] = [0, 1, 0, 1];
    let salt = "random-salt-12345".to_string();
    let position: u32 = 1;
    let revealed_value: u8 = 1;
    
    // Compute commitment (SHA-256 of deck + salt)
    let mut hasher = Sha256::new();
    hasher.update(&deck);
    hasher.update(salt.as_bytes());
    let commitment: [u8; 32] = hasher.finalize().into();
    
    println!("Generating proof for card reveal:");
    println!("  Deck: {:?}", deck);
    println!("  Salt: {}", salt);
    println!("  Position: {}", position);
    println!("  Revealed Value: {}", revealed_value);
    println!("  Commitment: {:02x?}", commitment);
    
    // Build executor environment with inputs
    let env = ExecutorEnv::builder()
        // Private inputs (only prover knows)
        .write(&deck).unwrap()
        .write(&salt).unwrap()
        // Public inputs (everyone knows)
        .write(&position).unwrap()
        .write(&revealed_value).unwrap()
        .write(&commitment).unwrap()
        .build()
        .unwrap();

    // Generate the proof
    println!("\nGenerating proof...");
    let prover = default_prover();
    let prove_info = prover
        .prove(env, CARD_REVEAL_GUEST_ELF)
        .unwrap();

    let receipt = prove_info.receipt;
    
    println!("Proof generated successfully!");
    println!("  Cycles: {}", prove_info.stats.total_cycles);
    
    // Decode the journal (public outputs)
    let journal = receipt.journal.bytes.clone();
    println!("\nJournal (public outputs): {} bytes", journal.len());
    
    // Verify the proof
    println!("\nVerifying proof...");
    receipt
        .verify(CARD_REVEAL_GUEST_ID)
        .expect("Proof verification failed");
    
    println!("✓ Proof verified successfully!");
    
    // Show how to use this in production
    println!("\n=== Integration Guide ===");
    println!("1. Receipt contains the proof");
    println!("2. Journal bytes: receipt.journal.bytes");
    println!("3. Image ID: {:?}", CARD_REVEAL_GUEST_ID);
    println!("4. Send receipt to Stellar contract for verification");
}
