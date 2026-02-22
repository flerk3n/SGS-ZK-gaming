# ZK Memory Frontend Implementation Summary

## Current Status
- ✅ Contract deployed: `CCVCRG4PUD7T5DQVIPMXIMFM6S3PGIMKOPSFG6V35EF7Q4U6P3ZV6OKT`
- ✅ Bindings generated and copied to frontend
- ✅ Frontend scaffolded from number-guess template

## Key Changes Needed

### 1. Update zkMemoryService.ts
The service currently has number-guess methods (makeGuess, revealWinner).
Need to replace with:
- `flipCard(sessionId, player, position, revealedValue, proof, publicInputs, signer)`
- Remove `makeGuess()` and `revealWinner()`
- Update `startGame()` to accept `deckCommitment` parameter

### 2. Update ZkMemoryGame.tsx
The component currently implements number-guess UI.
Need to replace with:
- 4x4 card grid (16 cards)
- Card flip interaction
- Score display for both players
- Current turn indicator
- Match/no-match feedback
- Game completion detection

### 3. Add Deck Utilities
Create simple utilities for:
- Deck shuffling (Fisher-Yates)
- Commitment generation (mock Poseidon hash for now)
- Store deck + salt in React state

### 4. Game Flow
1. Player 1 creates game with deck commitment
2. Player 2 joins (same multi-sig flow as number-guess)
3. Players take turns flipping cards
4. Each flip calls `flipCard()` with mock proof
5. Game ends when all 8 pairs found
6. Winner determined by score

## Implementation Strategy

Since the frontend is quite large and complex, we'll:
1. Keep the multi-sig flow (it's already working)
2. Replace the game UI (guess/reveal → card grid)
3. Update service methods (makeGuess/revealWinner → flipCard)
4. Add simple deck utilities
5. Test with mock proofs

## Simplified Approach for Demo

For initial testing without actual ZK proofs:
- Use simple hash for deck commitment (SHA-256)
- Send empty proof bytes
- Contract accepts all proofs (development mode)
- Focus on game mechanics working correctly

## Files to Modify

### 1. zkMemoryService.ts
**Location:** `zk-memory-frontend/src/games/zk-memory/zkMemoryService.ts`

**Changes:**
- Remove `makeGuess()` method
- Remove `revealWinner()` method
- Update `startGame()` to accept `deckCommitment: string` parameter
- Add `flipCard(sessionId, player, position, revealedValue, proof, publicInputs, signer)` method

**Reference:** `sgs_frontend/src/games/number-guess/numberGuessService.ts` for pattern

### 2. deckUtils.ts (NEW FILE)
**Location:** `zk-memory-frontend/src/games/zk-memory/deckUtils.ts`

**Functions to implement:**
```typescript
export function shuffleDeck(): number[]
export async function generateCommitment(deck: number[], salt: string): Promise<string>
export async function createCommittedDeck(): Promise<{deck: number[], salt: string, commitment: string}>
```

### 3. ZkMemoryGame.tsx
**Location:** `zk-memory-frontend/src/games/zk-memory/ZkMemoryGame.tsx`

**Major changes:**
- Replace guess/reveal UI with 4x4 card grid
- Add card flip interaction
- Display scores and current turn
- Show matched cards
- Call flipCard() on card click with mock proof
- Detect game completion (all 8 pairs found)

**Reference:** `sgs_frontend/src/games/number-guess/NumberGuessGame.tsx` for multi-sig flow

## Implementation Order

1. **Start with deckUtils.ts** - Create the utility functions first
2. **Update zkMemoryService.ts** - Get the service layer working
3. **Update ZkMemoryGame.tsx** - Build the UI last

This order ensures each layer is ready before the next depends on it.

## Testing Strategy

1. Test deck shuffling and commitment generation
2. Test service methods with mock data
3. Test UI with dev wallets
4. Test full two-player flow
5. Verify Game Hub integration

Let's start with the service layer first, then move to the UI.
