# AI Agent Handoff Document - ZK Memory Game

## 🎯 Current State

**Contract Status:** ✅ COMPLETE & DEPLOYED
- Contract ID: `CCVCRG4PUD7T5DQVIPMXIMFM6S3PGIMKOPSFG6V35EF7Q4U6P3ZV6OKT`
- Network: Stellar Testnet
- Bindings: Generated and copied to frontend

**Frontend Status:** 📝 READY TO IMPLEMENT
- Scaffolded from number-guess template
- Needs transformation to ZK Memory card game UI

## 📚 Essential Files to Read

### Understanding the Project:
1. `AGENTS.md` - Stellar Game Studio patterns and guidelines (MUST READ)
2. `zk_memory_game_guide.md` - Original ZK Memory game requirements
3. `ZK_MEMORY_IMPLEMENTATION_PLAN.md` - Complete implementation plan
4. `FRONTEND_IMPLEMENTATION_SUMMARY.md` - Frontend strategy

### Contract Reference:
5. `contracts/zk-memory/src/lib.rs` - Completed smart contract
6. `zk-memory-frontend/src/games/zk-memory/bindings.ts` - Generated TypeScript bindings

### Files to Modify:
7. `zk-memory-frontend/src/games/zk-memory/zkMemoryService.ts` - Service layer
8. `zk-memory-frontend/src/games/zk-memory/ZkMemoryGame.tsx` - UI component

### Reference Implementation:
9. `sgs_frontend/src/games/number-guess/NumberGuessGame.tsx` - Working example
10. `sgs_frontend/src/games/number-guess/numberGuessService.ts` - Service pattern

## 🎮 Game Mechanics Summary

### Contract Interface:
```rust
// Start game with deck commitment
fn start_game(
    env: Env,
    session_id: u32,
    player1: Address,
    player2: Address,
    player1_points: i128,
    player2_points: i128,
    deck_commitment: BytesN<32>  // Poseidon hash of shuffled deck + salt
)

// Flip a card
fn flip_card(
    env: Env,
    session_id: u32,
    player: Address,
    position: u32,  // 0-15 for 4x4 grid
    revealed_value: u32,  // Card value (0-7, 8 pairs)
    proof: BytesN<256>,  // ZK proof (mock for now)
    public_inputs: BytesN<128>  // Public inputs (mock for now)
)

// Query game state
fn get_game(env: Env, session_id: u32) -> GameState
```

### Game State:
```rust
pub struct GameState {
    pub session_id: u32,
    pub player1: Address,
    pub player2: Address,
    pub player1_score: u32,
    pub player2_score: u32,
    pub current_turn: Address,
    pub cards: Vec<CardState>,  // 16 cards
    pub deck_commitment: BytesN<32>,
    pub first_flip_position: Option<u32>,
    pub first_flip_value: Option<u32>,
    pub pairs_found: u32,
    pub game_over: bool,
    pub winner: Option<Address>,
}

pub enum CardState {
    FaceDown,
    Matched,
}
```

### Game Flow:
1. Player 1 creates game with deck commitment (shuffled deck hash)
2. Player 2 joins (multi-sig flow from number-guess)
3. Players take turns flipping cards:
   - First flip: Store position and value
   - Second flip: Check for match
     - Match: Mark both as Matched, increment score, keep turn
     - No match: Switch turns, reset flip state
4. Game ends when all 8 pairs found (pairs_found == 8)
5. Winner determined by highest score

## 🔨 Implementation Tasks

### Task 1: Update zkMemoryService.ts

**Remove:**
- `makeGuess()` method
- `revealWinner()` method

**Update:**
- `startGame()` to accept `deckCommitment: string` parameter

**Add:**
```typescript
async flipCard(
  sessionId: number,
  player: string,
  position: number,
  revealedValue: number,
  proof: string,  // Hex string for BytesN<256>
  publicInputs: string,  // Hex string for BytesN<128>
  signer: any
): Promise<any>
```

**Reference:** Look at `numberGuessService.ts` for the pattern of calling contract methods with signer.

### Task 2: Create deckUtils.ts

Create `zk-memory-frontend/src/games/zk-memory/deckUtils.ts`:

```typescript
// Fisher-Yates shuffle
export function shuffleDeck(): number[] {
  // Create 8 pairs (0-7, each appears twice)
  const deck = [...Array(8).keys(), ...Array(8).keys()];
  // Shuffle using Fisher-Yates
  // Return shuffled 16-card deck
}

// Simple SHA-256 hash for commitment (mock Poseidon)
export async function generateCommitment(
  deck: number[],
  salt: string
): Promise<string> {
  // Hash deck + salt using Web Crypto API
  // Return hex string (32 bytes)
}

// Create committed deck
export async function createCommittedDeck(): Promise<{
  deck: number[];
  salt: string;
  commitment: string;
}> {
  const deck = shuffleDeck();
  const salt = crypto.randomUUID();
  const commitment = await generateCommitment(deck, salt);
  return { deck, salt, commitment };
}
```

### Task 3: Update ZkMemoryGame.tsx

**Replace the guess/reveal UI with:**

1. **4x4 Card Grid:**
   - 16 cards in a grid layout
   - Each card shows:
     - Face down: Card back image/placeholder
     - Matched: Card value (0-7) or emoji
     - Flipped: Card value during reveal

2. **Game State Display:**
   - Player 1 score
   - Player 2 score
   - Current turn indicator
   - Pairs found counter (X/8)

3. **Card Flip Logic:**
   - On card click:
     - Check if it's player's turn
     - Check if card is already matched
     - Get revealed value from local deck state
     - Generate mock proof (empty bytes)
     - Call `flipCard()` service method
     - Update UI based on result

4. **Game Completion:**
   - Detect when pairs_found == 8
   - Show winner announcement
   - Display final scores

**State Management:**
```typescript
const [deck, setDeck] = useState<number[]>([]);
const [salt, setSalt] = useState<string>('');
const [commitment, setCommitment] = useState<string>('');
const [gameState, setGameState] = useState<GameState | null>(null);
```

**Mock Proof Generation:**
```typescript
// For development, send empty bytes
const mockProof = '0x' + '00'.repeat(256);  // 256 bytes of zeros
const mockPublicInputs = '0x' + '00'.repeat(128);  // 128 bytes of zeros
```

### Task 4: Wire Up the Flow

**Game Creation (Player 1):**
1. Generate committed deck using `createCommittedDeck()`
2. Store deck, salt, commitment in state
3. Call `startGame()` with commitment
4. Share session ID with Player 2

**Game Join (Player 2):**
1. Import session ID (same multi-sig flow as number-guess)
2. Player 2 doesn't need the deck (it's committed)

**Card Flip:**
1. Player clicks card
2. Get revealed value from local deck state (Player 1 only)
3. Call `flipCard()` with mock proof
4. Poll `get_game()` to update UI
5. Show match/no-match feedback

## 🚨 Important Notes

### Multi-Sig Flow:
- Keep the existing multi-sig flow from number-guess template
- Player 1 creates and prepares transaction
- Player 2 imports and signs
- This pattern is already working, don't change it

### Mock Proofs:
- Contract accepts all proofs in development mode
- Send empty bytes for proof and public_inputs
- Focus on game mechanics working correctly

### Deck Commitment:
- Only Player 1 needs the actual deck (to reveal cards)
- Player 2 trusts the commitment
- In production, ZK proofs ensure Player 1 can't cheat

### Error Handling:
- Contract will reject invalid moves (wrong turn, already matched, etc.)
- Show user-friendly error messages
- Reference contract error enums in `bindings.ts`

## 🧪 Testing Checklist

1. ✅ Game creation with deck commitment
2. ✅ Player 2 can join
3. ✅ Players can flip cards
4. ✅ Matches are detected correctly
5. ✅ Scores increment on match
6. ✅ Turn switches on no-match
7. ✅ Game ends when all pairs found
8. ✅ Winner determined correctly
9. ✅ Game Hub integration (start_game/end_game called)

## 🔗 Quick Reference Commands

```bash
# Run frontend dev server
cd zk-memory-frontend
bun run dev

# Or use the game-specific dev command
bun run dev:game zk-memory

# Build contract (if needed)
bun run build zk-memory

# Regenerate bindings (if contract changes)
bun run bindings zk-memory
```

## 📝 Key Patterns from AGENTS.md

1. Every game must call Game Hub `start_game` and `end_game` ✅
2. Use temporary storage with 30-day TTL ✅
3. Two-player enforcement ✅
4. Deterministic randomness (deck is pre-shuffled and committed) ✅
5. Player authentication via `require_auth()` ✅

## 🎯 Success Criteria

The implementation is complete when:
1. Two players can create and join a game
2. Players can flip cards and see matches
3. Scores update correctly
4. Game ends when all pairs found
5. Winner is determined by highest score
6. Game Hub integration works (check deployment.json for mock-game-hub)

## 💡 Tips for AI Agents

1. **Start with the service layer** - Get `zkMemoryService.ts` working first
2. **Reference number-guess** - It's a working example of the same patterns
3. **Keep it simple** - Mock proofs, simple hash for commitment
4. **Test incrementally** - Test each piece as you build it
5. **Follow SGS patterns** - Everything in AGENTS.md is important

Good luck! The contract is solid and ready. Focus on making the frontend fun and intuitive.
