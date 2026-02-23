# Testing RISC Zero Integration with ZK Memory Game

This guide walks through testing the complete RISC Zero proof system with the ZK Memory game.

## Prerequisites

1. **RISC Zero installed:**
```bash
curl -L https://risczero.com/install | bash
rzup
cargo risczero --version  # Should show v3.0.5
```

2. **Bun installed** (for frontend):
```bash
curl -fsSL https://bun.sh/install | bash
```

3. **Stellar CLI** (for contract deployment):
```bash
cargo install --locked stellar-cli
```

## Step 1: Build the Proof Service

```bash
cd circuits/card_reveal_risc/proof-service
cargo build --release
```

This will:
- Compile the guest program (zkVM code)
- Compile the host program (proof generation)
- Build the proof service API

## Step 2: Start the Proof Service

```bash
cd circuits/card_reveal_risc/proof-service
cargo run --release
```

You should see:
```
🚀 ZK Memory Proof Service running on http://127.0.0.1:3001
📝 Endpoints:
   GET  /health - Health check
   POST /generate-proof - Generate ZK proof
   POST /verify-proof - Verify ZK proof
```

Leave this running in a terminal.

## Step 3: Test the Proof Service

In a new terminal, test the service:

```bash
# Health check
curl http://localhost:3001/health

# Generate a proof
curl -X POST http://localhost:3001/generate-proof \
  -H "Content-Type: application/json" \
  -d '{
    "deck": [0, 1, 0, 1],
    "salt": "test-salt-12345",
    "position": 1,
    "revealed_value": 1
  }'
```

You should see a JSON response with `proof`, `journal`, and `commitment` fields.

## Step 4: Start the Frontend

In a new terminal:

```bash
cd zk-memory-frontend
bun install
bun run dev
```

The frontend will start on `http://localhost:5173`

## Step 5: Play a Game with RISC Zero Proofs

1. **Open the game** in your browser: `http://localhost:5173`

2. **Create a game:**
   - Enter Player 2 address
   - Set points (e.g., 0.1)
   - Click "Create Game"

3. **Flip cards:**
   - When you flip a card, the frontend will:
     - Call the proof service at `http://localhost:3001/generate-proof`
     - Generate a real RISC Zero proof (takes 5-10 seconds)
     - Submit the proof to the contract
   
4. **Watch the console:**
   - Frontend console: Shows proof generation requests
   - Proof service terminal: Shows proof generation progress
   - Look for: `✅ Proof generated successfully!`

## Expected Behavior

### First Card Flip
```
[FlipCard] Flipping card: { position: 0, revealedValue: 0 }
[FlipCard] Using RISC Zero proof generation
[flipCard] Generating RISC Zero proof...
[flipCard] RISC Zero proof generated successfully
Card flipped! Waiting for blockchain confirmation...
```

### Proof Service Logs
```
📥 Received proof request for position 0
🔐 Commitment: 1d7fe814490d006224...
⚙️  Generating proof...
✅ Proof generated! Cycles: 65536
```

### If Proof Service is Down
The system will automatically fall back to mock proofs:
```
[flipCard] Failed to generate RISC Zero proof, falling back to mock
```

## Troubleshooting

### Proof Service Won't Start

**Error:** `error: could not compile`
```bash
# Make sure RISC Zero is installed
rzup
# Rebuild
cd circuits/card_reveal_risc
cargo clean
cargo build --release
```

### CORS Errors in Browser

The proof service has CORS enabled for all origins. If you still see CORS errors:
1. Check the proof service is running on port 3001
2. Check browser console for the exact error
3. Try accessing `http://localhost:3001/health` directly

### Proof Generation Takes Too Long

RISC Zero proofs take 5-10 seconds. This is normal. The frontend shows:
- "Card flipped! Waiting for blockchain confirmation..."

If it takes longer than 15 seconds:
1. Check proof service logs for errors
2. Check your CPU usage (proof generation is CPU-intensive)
3. Consider using mock proofs for faster testing

### Frontend Can't Connect to Proof Service

**Error:** `Failed to generate RISC Zero proof: fetch failed`

1. **Check proof service is running:**
```bash
curl http://localhost:3001/health
```

2. **Check the port:**
The service runs on port 3001 by default. Make sure nothing else is using that port.

3. **Check frontend is calling correct URL:**
The frontend calls `http://localhost:3001/generate-proof`

## Performance Comparison

| Proof Type | Generation Time | Proof Size | User Experience |
|------------|----------------|------------|-----------------|
| Mock | Instant | 256 bytes | Smooth |
| RISC Zero | 5-10 seconds | ~200KB | Noticeable delay |
| Noir (future) | ~100ms | ~200 bytes | Smooth |

## Testing Checklist

- [ ] Proof service starts without errors
- [ ] Health endpoint responds
- [ ] Can generate proof via curl
- [ ] Frontend connects to proof service
- [ ] First card flip generates RISC Zero proof
- [ ] Second card flip generates RISC Zero proof
- [ ] Game completes successfully
- [ ] Fallback to mock proofs works when service is down

## Next Steps

Once testing is complete:

1. **Deploy proof service** to a server (not localhost)
2. **Update frontend** to use production proof service URL
3. **Add authentication** to proof service (prevent abuse)
4. **Monitor performance** and costs
5. **Consider caching** proofs for common scenarios

## Switching Back to Mock Proofs

To use mock proofs instead of RISC Zero:

1. **Stop the proof service** (Ctrl+C)
2. **Or** set `useMockProof: true` in the frontend:

```typescript
await zkMemoryService.flipCard(
  sessionId,
  userAddress,
  position,
  revealedValue,
  deck,
  salt,
  signer,
  undefined,
  true  // useMockProof: true
);
```

## Resources

- [RISC Zero Documentation](https://dev.risczero.com/)
- [ZK Memory Game Documentation](../../../ZK_MEMORY_COMPLETE.md)
- [Proof Comparison](../../../ZK_PROOF_COMPARISON.md)
