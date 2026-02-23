// ZK Memory Card Reveal Circuit (RISC Zero)
// Proves: I know the value at position X in a deck with commitment C
// Without revealing the entire deck

use risc0_zkvm::guest::env;
use sha2::{Sha256, Digest};

// For 2x2 grid: 4 cards (2 pairs)
const DECK_SIZE: usize = 4;

fn main() {
    // Read private inputs (known only to prover)
    let deck: [u8; DECK_SIZE] = env::read();  // The full deck [0, 1, 0, 1] or similar
    let salt: String = env::read();            // Random salt for commitment
    
    // Read public inputs (known to everyone)
    let position: u32 = env::read();           // Which card position (0-3)
    let revealed_value: u8 = env::read();      // The value being revealed (0 or 1)
    let commitment: [u8; 32] = env::read();    // SHA-256 hash of deck + salt
    
    // 1. Verify position is valid (0-3 for 2x2 grid)
    assert!(position < DECK_SIZE as u32, "Position out of bounds");
    
    // 2. Verify revealed value matches deck at position
    let actual_value = deck[position as usize];
    assert_eq!(actual_value, revealed_value, "Revealed value doesn't match deck");
    
    // 3. Verify commitment matches hash(deck + salt)
    let mut hasher = Sha256::new();
    hasher.update(&deck);
    hasher.update(salt.as_bytes());
    let computed_commitment: [u8; 32] = hasher.finalize().into();
    
    assert_eq!(computed_commitment, commitment, "Commitment doesn't match");
    
    // Write public outputs to the journal
    // These will be verified by the contract
    env::commit(&position);
    env::commit(&revealed_value);
    env::commit(&commitment);
}
