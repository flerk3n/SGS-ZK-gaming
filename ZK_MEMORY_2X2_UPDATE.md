# ZK Memory Game - 2x2 Grid Update

## Changes Made

Updated the ZK Memory game from a 4x4 grid (16 cards, 8 pairs) to a 2x2 grid (4 cards, 2 pairs) for easier testing.

### Contract Changes

**File: `contracts/zk-memory/src/lib.rs`**

1. Updated `GameState` struct comments:
   - `cards: Vec<CardState>` - Changed from "16 cards (4x4 grid)" to "4 cards (2x2 grid)"
   - `pairs_found: u32` - Changed from "Total pairs found (0-8)" to "Total pairs found (0-2)"

2. Updated `start_game()` function:
   - Changed card initialization from 16 to 4 cards
   ```rust
   // Initialize 4 cards as FaceDown (2x2 grid)
   let mut cards: Vec<CardState> = Vec::new(&env);
   for _ in 0..4 {
       cards.push_back(CardState::FaceDown);
   }
   ```

3. Updated `flip_card()` function:
   - Changed position validation from `< 16` to `< 4`
   ```rust
   // Verify position is valid (0-3 for 2x2 grid)
   if position >= 4 {
       return Err(Error::InvalidPosition);
   }
   ```
   
   - Changed game completion check from 8 pairs to 2 pairs
   ```rust
   // Check if game is over (all 2 pairs found)
   if game.pairs_found == 2 {
   ```

### Frontend Changes

**File: `zk-memory-frontend/src/games/zk-memory/deckUtils.ts`**

1. Updated `shuffleDeck()`:
   - Changed from 8 pairs (values 0-7) to 2 pairs (values 0-1)
   - Returns 4 cards instead of 16
   ```typescript
   // Create 2 pairs (0-1, each value appears twice)
   const deck = [...Array(2).keys(), ...Array(2).keys()];
   ```

2. Updated comments:
   - `generateCommitment()` - Changed from "Array of 16 card values" to "Array of 4 card values"
   - `generateMockPublicInputs()` - Changed position range from "0-15" to "0-3" and value range from "0-7" to "0-1"

**File: `zk-memory-frontend/src/games/zk-memory/ZkMemoryGame.tsx`**

1. Updated UI grid:
   - Changed from `grid-cols-4` to `grid-cols-2` (4x4 to 2x2)

2. Updated game completion checks:
   - Changed all `pairs_found === 8` to `pairs_found === 2`
   - Updated display text from "Pairs Found: X / 8" to "Pairs Found: X / 2"

### Deployment

1. Built contract: `bun run build zk-memory`
2. Deployed new contract instance:
   - New Contract ID: `CBRXX5LIJH4V2LTQLTIXL4T5MQHFP6JH4JK6EFQJY4G2UZ4YGO25TYKS`
   - Old Contract ID: `CCVCRG4PUD7T5DQVIPMXIMFM6S3PGIMKOPSFG6V35EF7Q4U6P3ZV6OKT`
3. Generated new bindings: `bun run bindings zk-memory`
4. Copied bindings to frontend: `cp bindings/zk_memory/src/index.ts zk-memory-frontend/src/games/zk-memory/bindings.ts`
5. Updated `.env` with new contract ID
6. Updated `deployment.json` with new contract ID

### Testing Instructions

1. Start the dev server:
   ```bash
   bun run dev:game zk-memory
   ```

2. Test flow:
   - Player 1 creates a game (generates 2x2 deck with 2 pairs)
   - Player 1 exports auth entry + deck data
   - Player 2 imports both and starts the game
   - Players take turns flipping cards
   - Game completes after finding 2 pairs (4 cards total)

### Benefits of 2x2 Grid

1. **Faster Testing**: Games complete in 2-4 moves instead of 8-16
2. **Easier Debugging**: Fewer cards means simpler state to track
3. **Network Friendly**: Fewer transactions needed per game
4. **Quick Validation**: Can test full game flow in under a minute

### Game Mechanics (Unchanged)

- First flip: Store position and value, keep turn
- Second flip with match: Mark cards matched, increment score, keep turn
- Second flip no match: Switch turn to other player
- Game ends when all 2 pairs are found
- Winner is player with most pairs (or tie if equal)

### Files Modified

- `contracts/zk-memory/src/lib.rs`
- `zk-memory-frontend/src/games/zk-memory/deckUtils.ts`
- `zk-memory-frontend/src/games/zk-memory/ZkMemoryGame.tsx`
- `.env`
- `deployment.json`
- `zk-memory-frontend/src/games/zk-memory/bindings.ts` (regenerated)

### Next Steps

1. Test the 2x2 game thoroughly
2. Once validated, can scale back up to 4x4 if desired
3. Consider adding difficulty levels (2x2, 3x3, 4x4) as a future enhancement
