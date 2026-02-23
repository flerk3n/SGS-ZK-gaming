# ZK Memory Card Reveal - RISC Zero Implementation

Zero-Knowledge proof circuit for verifying card reveals in the ZK Memory game without exposing the full deck.

## Overview

This RISC Zero zkVM program proves: "I know the value at position X in a deck with commitment C" without revealing the entire deck.

**Proof System:** RISC Zero (STARK-based)
**Language:** Pure Rust
**Hash Function:** SHA-256

## Structure

```
card_reveal_risc/
├── methods/
│   ├── guest/          # Guest program (runs in zkVM)
│   │   └── src/
│   │       └── main.rs # Proof logic
│   └── src/
│       └── lib.rs      # Generated code (ELF + Image ID)
├── host/
│   └── src/
│       └── main.rs     # Host program (proof generation)
└── Cargo.toml
```

## Guest Program (Proof Logic)

The guest program runs inside the RISC Zero zkVM and performs the verification:

```rust
fn main() {
    // Read private inputs (only prover knows)
    let deck: [u8; 4] = env::read();
    let salt: String = env::read();
    
    // Read public inputs (everyone knows)
    let position: u32 = env::read();
    let revealed_value: u8 = env::read();
    let commitment: [u8; 32] = env::read();
    
    // Verify position bounds (0-3 for 2x2 grid)
    assert!(position < 4);
    
    // Verify revealed value matches deck at position
    assert_eq!(deck[position as usize], revealed_value);
    
    // Verify commitment matches SHA-256(deck + salt)
    let mut hasher = Sha256::new();
    hasher.update(&deck);
    hasher.update(salt.as_bytes());
    let computed: [u8; 32] = hasher.finalize().into();
    assert_eq!(computed, commitment);
    
    // Write public outputs to journal
    env::commit(&position);
    env::commit(&revealed_value);
    env::commit(&commitment);
}
```

## Host Program (Proof Generation)

The host program runs on the user's machine and generates the proof:

```rust
fn main() {
    // Setup inputs
    let deck: [u8; 4] = [0, 1, 0, 1];
    let salt = "random-salt-12345".to_string();
    let position: u32 = 1;
    let revealed_value: u8 = 1;
    
    // Compute commitment
    let mut hasher = Sha256::new();
    hasher.update(&deck);
    hasher.update(salt.as_bytes());
    let commitment: [u8; 32] = hasher.finalize().into();
    
    // Build executor environment
    let env = ExecutorEnv::builder()
        .write(&deck).unwrap()
        .write(&salt).unwrap()
        .write(&position).unwrap()
        .write(&revealed_value).unwrap()
        .write(&commitment).unwrap()
        .build().unwrap();

    // Generate proof
    let prover = default_prover();
    let prove_info = prover.prove(env, CARD_REVEAL_GUEST_ELF).unwrap();
    let receipt = prove_info.receipt;
    
    // Verify proof
    receipt.verify(CARD_REVEAL_GUEST_ID).unwrap();
}
```

## Installation

```bash
# Install RISC Zero toolchain
curl -L https://risczero.com/install | bash
rzup

# Verify installation
cargo risczero --version
# cargo-risczero 3.0.5
```

## Usage

### Build

```bash
cargo build --release
```

This compiles both the guest program (for zkVM) and the host program.

### Run Proof Generation

```bash
cargo run --release
```

**Output:**
```
Generating proof for card reveal:
  Deck: [0, 1, 0, 1]
  Salt: random-salt-12345
  Position: 1
  Revealed Value: 1
  Commitment: [1d, 7f, e8, 14, ...]

Generating proof...
Proof generated successfully!
  Cycles: 65536
  Journal (public outputs): 136 bytes

Verifying proof...
✓ Proof verified successfully!
```

### Test

```bash
cargo test
```

## Performance

- **Proof Size:** ~200KB
- **Proving Time:** 5-10 seconds
- **Verification Time:** ~100ms
- **Cycles:** 65,536

## Integration

### Backend Service

Create a backend service to generate and verify proofs:

```rust
use risc0_zkvm::Receipt;

pub fn generate_card_reveal_proof(
    deck: [u8; 4],
    salt: String,
    position: u32,
    revealed_value: u8,
) -> Result<Receipt, Error> {
    // Compute commitment
    let mut hasher = Sha256::new();
    hasher.update(&deck);
    hasher.update(salt.as_bytes());
    let commitment: [u8; 32] = hasher.finalize().into();
    
    // Build environment
    let env = ExecutorEnv::builder()
        .write(&deck)?
        .write(&salt)?
        .write(&position)?
        .write(&revealed_value)?
        .write(&commitment)?
        .build()?;
    
    // Generate proof
    let prover = default_prover();
    let prove_info = prover.prove(env, CARD_REVEAL_GUEST_ELF)?;
    
    Ok(prove_info.receipt)
}

pub fn verify_card_reveal_proof(receipt: &Receipt) -> Result<(), Error> {
    receipt.verify(CARD_REVEAL_GUEST_ID)?;
    Ok(())
}
```

### Frontend Integration

```typescript
// Call backend to generate proof
async function generateProof(
  deck: number[],
  salt: string,
  position: number,
  revealedValue: number
): Promise<Uint8Array> {
  const response = await fetch('/api/generate-proof', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deck, salt, position, revealedValue })
  });
  
  const { receipt } = await response.json();
  return new Uint8Array(receipt);
}

// Use in game
const proof = await generateProof(
  [0, 1, 0, 1],
  'random-salt-12345',
  1,
  1
);

// Submit to contract
await contract.flip_card({
  session_id: sessionId,
  player: playerAddress,
  position: 1,
  revealed_value: 1,
  proof: Buffer.from(proof),
  public_inputs: [...]
});
```

## Comparison with Noir

| Feature | RISC Zero | Noir |
|---------|-----------|------|
| Proof Size | ~200KB | ~200 bytes |
| Proving Time | 5-10s | ~100ms |
| Language | Rust | Noir DSL |
| Stellar Support | Not yet | Protocol 25 |
| Works Today | ✅ Yes | ⏳ Waiting |

## Advantages

- ✅ Works immediately (no Protocol 25 needed)
- ✅ Pure Rust (no new language)
- ✅ Standard SHA-256 hashing
- ✅ Easy to debug
- ✅ Flexible (can prove any Rust code)

## Disadvantages

- ❌ Large proofs (~200KB)
- ❌ Slow proving (5-10s)
- ❌ No on-chain verification yet
- ❌ Requires backend service

## Next Steps

1. Create backend service for proof generation
2. Add API endpoints for frontend
3. Integrate with ZK Memory game
4. Deploy to production
5. Monitor performance and costs

## Resources

- [RISC Zero Documentation](https://dev.risczero.com/)
- [RISC Zero GitHub](https://github.com/risc0/risc0)
- [ZK Memory Game](../../contracts/zk-memory/)
- [Proof Comparison](../ZK_PROOF_COMPARISON.md)

## License

Same as parent project
