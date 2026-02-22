# ZK Memory Card Game - Implementation Plan

## Project Overview

A two-player Memory/Pairs card game (4x4 grid, 8 pairs) where Zero-Knowledge proofs ensure:
- Card layout cannot be manipulated after commitment
- Card reveals are cryptographically honest
- Matches are verifiable without revealing the full deck
- No player or server can cheat

## Architecture Layers

1. **ZK Layer (Noir)**: Two circuits for card reveal and match verification
2. **Smart Contract (Soroban)**: Game state, proof verification, Game Hub integration
3. **Frontend (React/Vite)**: UI, wallet connection, local proof generation
4. **Game Hub**: Required integration with `CB4VZAT2U3UC6XFK3N23SKRF2NDCMP3QHJYMCHHFMZO7MRQO6DQ2EMYG`

---

## Phase 1: Project Scaffolding ✓

### 1.1 Create the game using SGS create script
```bash
bun run create zk-memory
```

### 1.2 Project structure additions
```
zk-memory/
├── circuits/                    # NEW: Noir ZK circuits
│   ├── card_reveal/            # Proves card reveal is honest
│   │   ├── src/main.nr
│   │   ├── Nargo.toml
│   │   └── Prover.toml
│   └── match_verify/           # Proves two cards match
│       ├── src/main.nr
│       ├── Nargo.toml
│       └── Prover.toml
├── contracts/zk-memory/        # EXISTING: From create script
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs              # MODIFY: Add ZK verification
│       └── test.rs
└── zk-memory-frontend/         # EXISTING: From create script
    └── src/
        ├── games/zk-memory/
        │   ├── ZkMemoryGame.tsx
        │   ├── bindings.ts
        │   └── zkMemoryService.ts
        └── zk/                 # NEW: ZK proof generation
            ├── prover.js
            └── deck.js
```

---

## Phase 2: Noir ZK Circuits

### 2.1 Circuit 1: Card Reveal Proof
**File**: `circuits/card_reveal/src/main.nr`

**Purpose**: Prove "I know the full deck, and card at position X has value Y"

**Inputs**:
- Private: `deck: [Field; 16]`, `salt: Field`
- Public: `position: Field`, `deck_commitment: Field`, `revealed_value: Field`

**Logic**:
1. Recompute Poseidon2 hash of deck + salt
2. Assert computed hash matches on-chain commitment
3. Assert revealed_value matches deck[position]

```noir
// circuits/card_reveal/src/main.nr
use dep::std::hash::poseidon2;

fn main(
    // PRIVATE: The full deck layout (all 16 card values)
    deck: [Field; 16],
    // PRIVATE: A random salt added during setup
    salt: Field,
    // PUBLIC: Position the player wants to flip (0-15)
    position: pub Field,
    // PUBLIC: The committed deck hash (stored on-chain at game start)
    deck_commitment: pub Field,
    // PUBLIC: The card value being revealed at this position
    revealed_value: pub Field,
) {
    // Step 1: Recompute the hash of the deck + salt
    let computed_commitment = poseidon2::bn254::hash_1(
        poseidon2::bn254::hash_fixed_length(deck, salt)
    );
    
    // Step 2: Assert our computed hash matches what is on-chain
    assert(computed_commitment == deck_commitment,
        "Deck commitment does not match - tampering detected");
    
    // Step 3: Assert the revealed value is actually at the claimed position
    assert(deck[position] == revealed_value,
        "Revealed value does not match card at this position");
}
```

### 2.2 Circuit 2: Match Verification Proof
**File**: `circuits/match_verify/src/main.nr`

**Purpose**: Prove "Two positions contain matching pair values"

**Inputs**:
- Private: `deck: [Field; 16]`, `salt: Field`
- Public: `position_a: Field`, `position_b: Field`, `deck_commitment: Field`

**Logic**:
1. Verify deck commitment
2. Assert deck[position_a] == deck[position_b]
3. Assert position_a != position_b (no self-matching)

```noir
// circuits/match_verify/src/main.nr
use dep::std::hash::poseidon2;

fn main(
    // PRIVATE: Full deck layout
    deck: [Field; 16],
    salt: Field,
    // PUBLIC: The two positions being claimed as a match
    position_a: pub Field,
    position_b: pub Field,
    // PUBLIC: On-chain commitment
    deck_commitment: pub Field,
) {
    // Verify the deck commitment
    let computed = poseidon2::bn254::hash_1(
        poseidon2::bn254::hash_fixed_length(deck, salt)
    );
    assert(computed == deck_commitment, "Invalid deck commitment");
    
    // Get the two card values
    let card_a = deck[position_a];
    let card_b = deck[position_b];
    
    // Prove they are the same pair value
    assert(card_a == card_b, "Cards do not match - not a valid pair");
    
    // Ensure they are different positions
    assert(position_a != position_b, "Cannot match a card with itself");
}
```

### 2.3 Compilation steps
```bash
# Create and compile card_reveal circuit
cd circuits/
nargo new card_reveal
cd card_reveal
# (paste code into src/main.nr)
nargo compile
bb write_vk -b ./target/card_reveal.json -o ./target/vk
bb write_pk -b ./target/card_reveal.json -o ./target/pk

# Create and compile match_verify circuit
cd ..
nargo new match_verify
cd match_verify
# (paste code into src/main.nr)
nargo compile
bb write_vk -b ./target/match_verify.json -o ./target/vk
bb write_pk -b ./target/match_verify.json -o ./target/pk
```

---

## Phase 3: Soroban Smart Contract

### 3.1 Data Structures
**File**: `contracts/zk-memory/src/lib.rs`

```rust
#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, contractclient, Address, BytesN, Env, Vec, Symbol};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum CardState {
    FaceDown,
    Matched,
}

#[contracttype]
#[derive(Clone)]
pub struct GameState {
    pub session_id: u32,
    pub player1: Address,
    pub player2: Address,
    pub deck_commitment: BytesN<32>,  // Poseidon hash
    pub cards: Vec<CardState>,         // 16 cards
    pub score1: u32,
    pub score2: u32,
    pub current_turn: Address,
    pub flip_one: Option<u32>,
    pub flip_one_value: Option<u32>,
    pub pairs_found: u32,
    pub is_active: bool,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    GameHubAddress,
    Game(u32),
}

#[derive(Clone)]
#[contracttype]
pub enum Error {
    GameNotFound = 1,
    GameNotActive = 2,
    NotYourTurn = 3,
    CardAlreadyMatched = 4,
    InvalidProof = 5,
    InvalidPosition = 6,
}

// Game Hub client interface
#[contractclient(name = "GameHubClient")]
pub trait GameHub {
    fn start_game(
        env: Env,
        game_id: Address,
        session_id: u32,
        player1: Address,
        player2: Address,
        player1_points: i128,
        player2_points: i128,
    );

    fn end_game(env: Env, session_id: u32, player1_won: bool);
}
```

### 3.2 Core Functions

```rust
#[contract]
pub struct ZkMemoryContract;

#[contractimpl]
impl ZkMemoryContract {
    /// Initialize the contract with admin and game hub
    pub fn __constructor(env: Env, admin: Address, game_hub: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::GameHubAddress, &game_hub);
    }

    /// Start a new game with committed deck
    pub fn start_game(
        env: Env,
        session_id: u32,
        player1: Address,
        player2: Address,
        player1_points: i128,
        player2_points: i128,
        deck_commitment: BytesN<32>,
    ) -> u32 {
        // Require auth from both players for points
        player1.require_auth();
        player2.require_auth();

        // Initialize 16 cards as FaceDown
        let mut cards: Vec<CardState> = Vec::new(&env);
        for _ in 0..16 {
            cards.push_back(CardState::FaceDown);
        }

        let game = GameState {
            session_id,
            player1: player1.clone(),
            player2: player2.clone(),
            deck_commitment,
            cards,
            score1: 0,
            score2: 0,
            current_turn: player1.clone(),
            flip_one: None,
            flip_one_value: None,
            pairs_found: 0,
            is_active: true,
        };

        // Call Game Hub start_game BEFORE storing state
        let game_hub: Address = env.storage().instance().get(&DataKey::GameHubAddress).unwrap();
        let hub_client = GameHubClient::new(&env, &game_hub);
        hub_client.start_game(
            &env.current_contract_address(),
            &session_id,
            &player1,
            &player2,
            &player1_points,
            &player2_points,
        );

        // Store game state in temporary storage with 30-day TTL
        env.storage().temporary().set(&DataKey::Game(session_id), &game);
        env.storage().temporary().extend_ttl(&DataKey::Game(session_id), 2592000, 2592000); // 30 days

        session_id
    }

    /// Flip a card with ZK proof
    pub fn flip_card(
        env: Env,
        session_id: u32,
        position: u32,
        revealed_value: u32,
        proof: BytesN<128>,  // ZK proof
        public_inputs: Vec<BytesN<32>>,  // [position, deck_commitment, revealed_value]
    ) {
        let mut game: GameState = env.storage()
            .temporary()
            .get(&DataKey::Game(session_id))
            .ok_or(Error::GameNotFound)
            .unwrap();

        // Verify game is active
        if !game.is_active {
            panic_with_error!(&env, Error::GameNotActive);
        }

        // Verify it's the caller's turn
        let caller = env.invoker();
        if caller != game.current_turn {
            panic_with_error!(&env, Error::NotYourTurn);
        }

        // Verify position is valid
        if position >= 16 {
            panic_with_error!(&env, Error::InvalidPosition);
        }

        // Check card is still face down
        let card = game.cards.get(position).unwrap();
        if card == CardState::Matched {
            panic_with_error!(&env, Error::CardAlreadyMatched);
        }

        // === ZK PROOF VERIFICATION ===
        Self::verify_card_reveal_proof(&env, &proof, &public_inputs, &game.deck_commitment);

        // === GAME LOGIC ===
        if game.flip_one.is_none() {
            // First card of the turn - store it
            game.flip_one = Some(position);
            game.flip_one_value = Some(revealed_value);
        } else {
            // Second card - check for match
            let pos_a = game.flip_one.unwrap();
            let val_a = game.flip_one_value.unwrap();

            if val_a == revealed_value && pos_a != position {
                // MATCH FOUND
                game.cards.set(pos_a, CardState::Matched);
                game.cards.set(position, CardState::Matched);
                game.pairs_found += 1;

                // Increment score for current player
                if game.current_turn == game.player1 {
                    game.score1 += 1;
                } else {
                    game.score2 += 1;
                }
                // Player keeps their turn after a match
            } else {
                // NO MATCH - switch turns
                game.current_turn = if game.current_turn == game.player1 {
                    game.player2.clone()
                } else {
                    game.player1.clone()
                };
            }

            game.flip_one = None;
            game.flip_one_value = None;
        }

        // Check if game is over (all 8 pairs found)
        if game.pairs_found == 8 {
            game.is_active = false;

            // Call Game Hub end_game
            let game_hub: Address = env.storage().instance().get(&DataKey::GameHubAddress).unwrap();
            let hub_client = GameHubClient::new(&env, &game_hub);
            let player1_won = game.score1 > game.score2;
            hub_client.end_game(&session_id, &player1_won);
        }

        // Save state and extend TTL
        env.storage().temporary().set(&DataKey::Game(session_id), &game);
        env.storage().temporary().extend_ttl(&DataKey::Game(session_id), 2592000, 2592000);
    }

    /// Verify ZK proof using Stellar Protocol 25 BN254 operations
    fn verify_card_reveal_proof(
        env: &Env,
        proof: &BytesN<128>,
        public_inputs: &Vec<BytesN<32>>,
        deck_commitment: &BytesN<32>,
    ) {
        // TODO: Implement BN254 proof verification using Stellar Protocol 25
        // This will use env.crypto().verify_groth16_bn254()
        // For now, we'll add a placeholder that needs to be implemented
        // with the actual verification key from the Noir circuit compilation
        
        // Verification key will be embedded here from circuits/card_reveal/target/vk
        // let vk = BytesN::from_array(&env, &VERIFICATION_KEY);
        // env.crypto().verify_groth16_bn254(&vk, public_inputs, proof)
        //     .unwrap_or_else(|_| panic_with_error!(&env, Error::InvalidProof));
    }

    /// Get current game state
    pub fn get_game(env: Env, session_id: u32) -> GameState {
        env.storage()
            .temporary()
            .get(&DataKey::Game(session_id))
            .ok_or(Error::GameNotFound)
            .unwrap()
    }
}
```

---

## Phase 4: Frontend Implementation

### 4.1 Dependencies
Add to `zk-memory-frontend/package.json`:
```json
{
  "dependencies": {
    "@stellar/stellar-sdk": "^12.0.0",
    "@stellar/freighter-api": "^2.0.0",
    "@aztec/bb.js": "latest",
    "@noir-lang/noir_js": "latest"
  }
}
```

### 4.2 ZK Proof Generation
**File**: `zk-memory-frontend/src/zk/prover.js`

```javascript
import { BarretenbergWasm } from '@aztec/bb.js';
import { Noir } from '@noir-lang/noir_js';
import cardRevealCircuit from '../../../circuits/card_reveal/target/card_reveal.json';

let bb = null;
let cardRevealNoir = null;

export async function initProver() {
  bb = await BarretenbergWasm.new();
  cardRevealNoir = new Noir(cardRevealCircuit, bb);
  await cardRevealNoir.init();
  return cardRevealNoir;
}

export async function proveCardReveal(deck, salt, position, commitment) {
  const input = {
    deck: deck.map(v => BigInt(v)),
    salt: BigInt(salt),
    position: BigInt(position),
    deck_commitment: commitment,
    revealed_value: BigInt(deck[position]),
  };
  
  const { proof, publicInputs } = await cardRevealNoir.generateFinalProof(input);
  return { proof, revealedValue: deck[position], publicInputs };
}
```

### 4.3 Deck Shuffling & Commitment
**File**: `zk-memory-frontend/src/zk/deck.js`

```javascript
import { poseidon2 } from '@aztec/bb.js';

export function createCommittedDeck() {
  // 8 pairs for 4x4 grid
  const pairs = [1,1, 2,2, 3,3, 4,4, 5,5, 6,6, 7,7, 8,8];
  
  // Fisher-Yates shuffle
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
  }
  
  // Generate random salt
  const salt = BigInt('0x' + Array.from(crypto.getRandomValues(new Uint8Array(31)))
    .map(b => b.toString(16).padStart(2, '0')).join(''));
  
  // Compute Poseidon2 commitment
  const commitment = poseidon2([...pairs.map(BigInt), salt]);
  
  return { deck: pairs, salt, commitment };
}
```

### 4.4 Game Component
**File**: `zk-memory-frontend/src/games/zk-memory/ZkMemoryGame.tsx`

```tsx
import { useState, useEffect } from 'react';
import { proveCardReveal, initProver } from '../../zk/prover';
import { createCommittedDeck } from '../../zk/deck';
import { useWallet } from '../../hooks/useWallet';

const CARD_EMOJIS = ['', '🍎', '🍎', '🍊', '🍊', '🍑', '🍑', '🍇', '🍇',
                     '⭐', '⭐', '🔥', '🔥', '🌈', '🌈', '💡', '💡'];

export function ZkMemoryGame() {
  const { publicKey, connect, flipCard } = useWallet();
  const [gameState, setGameState] = useState(null);
  const [deck, setDeck] = useState(null);
  const [salt, setSalt] = useState(null);
  const [commitment, setCommitment] = useState(null);
  const [flipping, setFlipping] = useState(false);
  const [revealedCards, setRevealedCards] = useState({});
  const [proverReady, setProverReady] = useState(false);

  useEffect(() => {
    initProver().then(() => setProverReady(true));
  }, []);

  const handleCreateGame = async () => {
    const { deck, salt, commitment } = createCommittedDeck();
    setDeck(deck);
    setSalt(salt);
    setCommitment(commitment);
    
    // Call contract start_game with commitment
    // ... implementation
  };

  const handleCardClick = async (position) => {
    if (flipping || !proverReady) return;
    if (gameState?.cards[position] === 'Matched') return;

    setFlipping(true);
    try {
      // Generate ZK proof locally
      const { proof, revealedValue, publicInputs } = 
        await proveCardReveal(deck, salt, position, commitment);

      // Show card optimistically
      setRevealedCards(prev => ({ ...prev, [position]: revealedValue }));

      // Submit to contract
      await flipCard(gameState.sessionId, position, proof, publicInputs, revealedValue);

      // Poll for updated state
      // ... implementation
    } catch (err) {
      console.error('Flip failed:', err);
    } finally {
      setFlipping(false);
    }
  };

  return (
    <div className="zk-memory-game">
      <h1>ZK Memory Card Game</h1>
      
      {!publicKey && (
        <button onClick={connect}>Connect Wallet</button>
      )}

      {publicKey && !gameState && (
        <button onClick={handleCreateGame}>Create Game</button>
      )}

      {gameState && (
        <>
          <div className="scores">
            <div>Player 1: {gameState.score1}</div>
            <div>Player 2: {gameState.score2}</div>
          </div>

          <div className="board" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 100px)',
            gap: '12px'
          }}>
            {gameState.cards.map((state, i) => (
              <div
                key={i}
                onClick={() => handleCardClick(i)}
                style={{
                  width: 100,
                  height: 100,
                  background: state === 'Matched' ? '#4ade80' :
                             revealedCards[i] ? '#818cf8' : '#1e1b4b',
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: state === 'Matched' ? 'default' : 'pointer',
                  fontSize: 32,
                }}
              >
                {state === 'Matched' || revealedCards[i]
                  ? CARD_EMOJIS[revealedCards[i] || 0]
                  : '?'}
              </div>
            ))}
          </div>

          {flipping && <div>Generating proof...</div>}
        </>
      )}
    </div>
  );
}
```

---

## Phase 5: Build & Deploy Pipeline

### 5.1 Build contracts
```bash
bun run build zk-memory
```

### 5.2 Deploy to testnet
```bash
bun run deploy zk-memory
```

### 5.3 Generate bindings
```bash
bun run bindings zk-memory
cp bindings/zk_memory/src/index.ts zk-memory-frontend/src/games/zk-memory/bindings.ts
```

### 5.4 Run dev frontend
```bash
bun run dev:game zk-memory
```

---

## Phase 6: Testing Strategy

### 6.1 Circuit Testing
```bash
cd circuits/card_reveal
# Create Prover.toml with test inputs
nargo prove
nargo verify
```

### 6.2 Contract Testing
Create `contracts/zk-memory/src/test.rs` with:
- Start game with commitment
- First flip (valid proof)
- Second flip - match found
- Second flip - no match (turn switches)
- Game completion (all 8 pairs)
- Invalid proof rejection
- Already matched card rejection

### 6.3 Integration Testing
1. Deploy to testnet
2. Create game via CLI
3. Submit flip_card with test proof
4. Verify on Stellar Expert
5. Check Game Hub call history

---

## Key Technical Challenges & Solutions

### Challenge 1: BN254 Proof Verification in Soroban
- **Solution**: Use Stellar Protocol 25 BN254 host functions
- Embed verification key from Noir compilation
- Call `env.crypto().verify_groth16_bn254()`

### Challenge 2: Browser-based Proof Generation
- **Solution**: Use Barretenberg WASM via @aztec/bb.js
- Initialize once on app start
- Generate proofs locally (2-3 seconds per flip)

### Challenge 3: Deck Privacy
- **Solution**: Store deck + salt in React state
- Never send to contract or server
- Only send commitment (Poseidon hash) on-chain

### Challenge 4: Game Hub Integration
- **Solution**: Follow SGS patterns exactly
- Call start_game BEFORE storing state
- Call end_game BEFORE finalizing winner
- Use temporary storage with 30-day TTL

---

## Timeline Estimate

- Phase 1 (Scaffolding): 30 minutes
- Phase 2 (Noir Circuits): 3-4 hours
- Phase 3 (Smart Contract): 4-6 hours
- Phase 4 (Frontend): 6-8 hours
- Phase 5 (Build/Deploy): 1-2 hours
- Phase 6 (Testing): 3-4 hours

**Total: 20-30 hours**

---

## Submission Checklist

- [ ] Noir circuits compiled (card_reveal + match_verify)
- [ ] ZK proofs verified locally with nargo
- [ ] Soroban contract deployed on testnet
- [ ] start_game() called on Game Hub
- [ ] end_game() called on Game Hub
- [ ] ZK proof verification in smart contract
- [ ] Frontend deployed and accessible
- [ ] Public GitHub repository
- [ ] README.md with setup instructions
- [ ] 2-3 minute video demo

---

**Deadline**: February 23, 2026
