// ZK Memory Card Reveal Circuit
// Proves: I know the value at position X in a deck with commitment C
// Without revealing the entire deck

use std::hash::pedersen_hash;

// For 2x2 grid: 4 cards (2 pairs)
global DECK_SIZE: u32 = 4;

fn main(
    // Private inputs (known only to prover)
    deck: [Field; 4],           // The full deck [0, 1, 0, 1] or similar
    salt: Field,                // Random salt for commitment
    
    // Public inputs (known to everyone)
    position: pub u32,          // Which card position (0-3)
    revealed_value: pub Field,  // The value being revealed (0 or 1)
    commitment: pub Field       // Pedersen hash of deck + salt
) {
    // 1. Verify position is valid (0-3 for 2x2 grid)
    assert(position < DECK_SIZE, "Position out of bounds");
    
    // 2. Verify revealed value matches deck at position
    let actual_value = deck[position];
    assert(actual_value == revealed_value, "Revealed value doesn't match deck");
    
    // 3. Verify commitment matches hash(deck + salt)
    // Concatenate deck and salt for hashing
    let mut preimage: [Field; 5] = [0; 5];
    preimage[0] = deck[0];
    preimage[1] = deck[1];
    preimage[2] = deck[2];
    preimage[3] = deck[3];
    preimage[4] = salt;
    
    let computed_commitment = pedersen_hash(preimage);
    assert(computed_commitment == commitment, "Commitment doesn't match");
}

// Test to verify the circuit works
#[test]
fn test_valid_reveal() {
    // Setup test data
    let deck = [0, 1, 0, 1]; // 2 pairs: two 0s and two 1s
    let salt = 12345;
    let position: u32 = 1;
    let revealed_value = 1;
    
    // Compute commitment
    let mut preimage: [Field; 5] = [0; 5];
    preimage[0] = deck[0];
    preimage[1] = deck[1];
    preimage[2] = deck[2];
    preimage[3] = deck[3];
    preimage[4] = salt;
    let commitment = pedersen_hash(preimage);
    
    // This should pass
    main(deck, salt, position, revealed_value, commitment);
}

#[test(should_fail)]
fn test_invalid_reveal() {
    // Setup test data
    let deck = [0, 1, 0, 1];
    let salt = 12345;
    let position: u32 = 1;
    let revealed_value = 0; // Wrong value! Deck has 1 at position 1
    
    // Compute commitment
    let mut preimage: [Field; 5] = [0; 5];
    preimage[0] = deck[0];
    preimage[1] = deck[1];
    preimage[2] = deck[2];
    preimage[3] = deck[3];
    preimage[4] = salt;
    let commitment = pedersen_hash(preimage);
    
    // This should fail
    main(deck, salt, position, revealed_value, commitment);
}

#[test(should_fail)]
fn test_invalid_commitment() {
    // Setup test data
    let deck = [0, 1, 0, 1];
    let salt = 12345;
    let position: u32 = 1;
    let revealed_value = 1;
    
    let fake_commitment = 99999; // Wrong commitment!
    
    // This should fail
    main(deck, salt, position, revealed_value, fake_commitment);
}
