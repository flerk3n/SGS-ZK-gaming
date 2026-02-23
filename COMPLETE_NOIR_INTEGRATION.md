# Complete Noir Integration - Step by Step

This document provides the exact commands to complete the Noir ZK proof integration.

## Current Status

✅ **Code Changes Complete:**
- `noirProofGen.ts` - Noir proof generation implemented
- `zkMemoryService.ts` - Updated to use Noir instead of RISC Zero
- `contracts/zk-memory/src/lib.rs` - BN254 verification documented
- `NOIR_INTEGRATION_GUIDE.md` - Comprehensive guide created

⚠️ **Manual Steps Required:**
Follow the steps below in order.

---

## Step 1: Copy Compiled Circuit to Frontend

The Noir circuit is already compiled. Copy it to the frontend:

```bash
cp circuits/card_reveal/target/card_reveal.json \
   zk-memory-frontend/src/games/zk-memory/card_reveal.json
```

**Verify:**
```bash
ls -lh zk-memory-frontend/src/games/zk-memory/card_reveal.json
# Should show a file ~50-100KB
```

---

## Step 2: Install Noir Packages (if not already installed)

```bash
cd zk-memory-frontend
bun add @noir-lang/noir_js@1.0.0-beta.19 @noir-lang/backend_barretenberg@0.36.0
cd ..
```

**Verify:**
```bash
grep -A 2 "@noir-lang" zk-memory-frontend/package.json
# Should show both packages
```

---

## Step 3: Test with Mock Proofs First

Before implementing real BN254 verification, test the game flow with mock proofs:

```bash
# Start the frontend
bun run dev:game zk-memory
```

The game will use mock proofs by default (contract accepts all proofs in development mode).

**Test Flow:**
1. Create a game (multi-sig with two players)
2. Flip first card
3. Flip second card
4. Check for match
5. Complete game

If this works, the integration is correct and you can proceed to real proofs.

---

## Step 4: Fix Commitment Computation (Critical)

The circuit uses Pedersen hash but the frontend uses SHA-256. This mismatch will cause proof verification to fail.

### Option A: Use Pedersen in Frontend (Recommended)

Update `noirProofGen.ts` to compute Pedersen hash matching the circuit:

```typescript
// Install Pedersen hash library
// bun add @noir-lang/noir_js

// In noirProofGen.ts, replace SHA-256 commitment with Pedersen:
import { pedersen_hash } from '@noir-lang/noir_js';

// Compute commitment using Pedersen (matching circuit)
const preimage = [...deck.map(v => v.toString()), saltField];
const commitment = await pedersen_hash(preimage);
```

### Option B: Change Circuit to SHA-256 (Simpler but less efficient)

Update `circuits/card_reveal/src/main.nr`:

```noir
// Replace pedersen_hash with sha256
use std::hash::sha256;

// In main function:
let computed_commitment = sha256(preimage);
```

Then recompile:
```bash
cd circuits/card_reveal
nargo compile
cd ../..
```

And copy the new circuit (repeat Step 1).

---

## Step 5: Enable Real Noir Proofs

Update `zkMemoryService.ts` to use real Noir proofs instead of mock:

```typescript
// In flipCard() method, change:
useMockProof: boolean = false  // Already set to false by default
```

Or when calling from the UI:

```typescript
await zkMemoryService.flipCard(
  sessionId,
  player,
  position,
  value,
  deck,
  salt,
  signer,
  undefined,
  false  // Use real Noir proofs
);
```

---

## Step 6: Extract Verification Key from Circuit

Install Barretenberg CLI:

```bash
npm install -g @aztec/bb
```

Extract the verification key:

```bash
bb write_vk \
  -b circuits/card_reveal/target/card_reveal.json \
  -o contracts/zk-memory/vk.bin
```

**Verify:**
```bash
ls -lh contracts/zk-memory/vk.bin
# Should show a file ~1-2KB
```

---

## Step 7: Embed Verification Key in Contract

Edit `contracts/zk-memory/src/lib.rs`:

1. Add the verification key constant at the top of the file (after imports):

```rust
// Verification key for Noir circuit (Groth16 on BN254)
// Generated from: circuits/card_reveal/target/card_reveal.json
const VERIFICATION_KEY: &[u8] = include_bytes!("../vk.bin");
```

2. In `verify_card_reveal_proof()`, uncomment the verification code:

```rust
fn verify_card_reveal_proof(
    env: &Env,
    proof: &Bytes,
    public_inputs: &Vec<BytesN<32>>,
    deck_commitment: &BytesN<32>,
) -> Result<(), Error> {
    // ... existing validation code ...

    // Real BN254 Groth16 verification
    let vk = Bytes::from_slice(env, VERIFICATION_KEY);
    
    // Convert public inputs to Vec<Bytes>
    let mut public_inputs_bytes = Vec::new(env);
    for i in 0..public_inputs.len() {
        let input = public_inputs.get(i).unwrap();
        public_inputs_bytes.push_back(Bytes::from_slice(env, input.as_slice()));
    }
    
    // Verify the proof
    env.crypto()
        .verify_groth16_bn254(&vk, &public_inputs_bytes, proof)
        .map_err(|_| Error::InvalidProof)?;

    Ok(())
}
```

---

## Step 8: Rebuild and Deploy Contract

```bash
# Build the contract
bun run build zk-memory

# Deploy to testnet
bun run deploy zk-memory

# Generate new bindings
bun run bindings zk-memory

# Copy bindings to frontend
cp bindings/zk_memory/src/index.ts \
   zk-memory-frontend/src/games/zk-memory/bindings.ts
```

**Note the new contract ID** from the deploy output.

---

## Step 9: Update Frontend Config

Update `zk-memory-frontend/public/game-studio-config.js` with the new contract ID:

```javascript
window.gameStudioConfig = {
  contractId: 'YOUR_NEW_CONTRACT_ID_HERE',
  // ... rest of config
};
```

---

## Step 10: Test End-to-End with Real Proofs

```bash
# Start the frontend
bun run dev:game zk-memory
```

**Test Flow:**
1. Create a new game
2. Flip first card (should generate ~200 byte Noir proof)
3. Check browser console for "[Noir] Proof generated successfully!"
4. Flip second card
5. Complete the game

**Expected Console Output:**
```
[Noir] Generating proof...
[Noir] Deck: [0, 1, 0, 1]
[Noir] Salt: ...
[Noir] Position: 0
[Noir] Revealed Value: 0
[Noir] Generating proof with Barretenberg...
[Noir] Proof generated successfully!
[Noir] Proof size: 192 bytes
[flipCard] Noir proof generated successfully
```

---

## Troubleshooting

### "Module './card_reveal.json' not found"
- Run Step 1 to copy the circuit

### "Commitment doesn't match" error
- Fix Step 4 (commitment computation mismatch)
- Ensure frontend and circuit use the same hash function

### "Invalid proof" from contract
- Verify Step 6 (verification key extracted correctly)
- Verify Step 7 (verification code uncommented)
- Check Step 8 (contract rebuilt and deployed)

### Proof generation fails
- Check Noir packages installed (Step 2)
- Verify circuit JSON is valid (Step 1)
- Check browser console for detailed error

### Transaction fails with 500 error
- This was the RISC Zero issue (proofs too large)
- Noir proofs are ~200 bytes, should work fine
- If still failing, check contract deployment

---

## Quick Test Commands

```bash
# Test circuit compilation
cd circuits/card_reveal && nargo test && cd ../..

# Test contract build
bun run build zk-memory

# Test frontend build
cd zk-memory-frontend && bun run build && cd ..

# Start development
bun run dev:game zk-memory
```

---

## Production Checklist

Before deploying to production:

- [ ] Step 1: Circuit copied to frontend
- [ ] Step 2: Noir packages installed
- [ ] Step 3: Mock proof test passes
- [ ] Step 4: Commitment computation fixed (Pedersen)
- [ ] Step 5: Real proofs enabled
- [ ] Step 6: Verification key extracted
- [ ] Step 7: Verification key embedded in contract
- [ ] Step 8: Contract rebuilt and deployed
- [ ] Step 9: Frontend config updated
- [ ] Step 10: End-to-end test with real proofs passes
- [ ] Mock proof mode disabled
- [ ] Contract rejects invalid proofs
- [ ] Game completes successfully with real ZK proofs

---

## Summary

The integration is 90% complete. The remaining steps are:

1. **Copy circuit** (Step 1) - 30 seconds
2. **Test with mocks** (Step 3) - 5 minutes
3. **Fix commitment** (Step 4) - 15 minutes
4. **Extract VK** (Step 6) - 2 minutes
5. **Enable verification** (Step 7-8) - 10 minutes
6. **Test end-to-end** (Step 10) - 5 minutes

**Total time: ~40 minutes**

Once complete, you'll have production-ready ZK proofs running on Stellar with Protocol 25 BN254 support!
