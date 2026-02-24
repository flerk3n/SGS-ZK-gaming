# Stellar Game Studio

Development Tools For Web3 Game Builders On Stellar.

Ecosystem ready game templates and examples ready to scaffold into your development workflow, including a fully functional ZK Memory Card Game with zero-knowledge proofs.

**Start here:** [Stellar Game Studio](https://jamesbachini.github.io/Stellar-Game-Studio/)

## Why this exists

Stellar Game Studio is a toolkit for shipping web3 games quickly and efficiently. It pairs Stellar smart contract patterns with a ready-made frontend stack and deployment scripts, so you can focus on game design and gameplay mechanics.

## What you get

- Battle-tested Soroban patterns for two-player games
- A ecosystem ready mock game hub contract that standardizes lifecycle and scoring
- Deterministic randomness guidance and reference implementations
- ZK Memory Card Game with Noir zero-knowledge proofs
- One-command scaffolding for contracts + standalone frontend
- Testnet setup that generates wallets, deploys contracts, and wires bindings
- A production build flow that outputs a deployable frontend

## Quick Start (Dev)

```bash
# Fork the repo, then:
git clone https://github.com/jamesbachini/Stellar-Game-Studio
cd Stellar-Game-Studio
bun install

# Build + deploy contracts to testnet, generate bindings, write .env
bun run setup

# Scaffold a game + dev frontend
bun run create my-game

# Run the standalone dev frontend with testnet wallet switching
bun run dev:game my-game
```

## ZK Memory Card Game

A two-player memory card matching game with zero-knowledge proof verification using Noir.

### Features

- **Zero-Knowledge Proofs**: Uses Noir (Groth16) to prove card reveals without exposing the deck
- **Pedersen Commitments**: Cryptographic commitments to the shuffled deck
- **Multi-Signature Auth**: Both players must authorize game creation
- **Small Proof Size**: ~200 bytes (perfect for Stellar RPC)
- **BN254 Verification**: Ready for on-chain proof verification (Stellar Protocol 25+)

### How Zero-Knowledge Proofs Are Used

The ZK Memory game uses zero-knowledge proofs to ensure fair play while keeping the deck hidden. Here's how:

**The Problem**: In a traditional memory card game, one player shuffles the deck. But how can the other player trust that the deck is fair and that revealed cards are genuine?

**The ZK Solution**:

1. **Commitment Phase** (Game Creation)
   - Player 1 shuffles a deck of 4 cards (2 pairs: 0, 0, 1, 1)
   - A cryptographic commitment is generated using Pedersen hash: `commitment = pedersen_hash([card0, card1, card2, card3, salt])`
   - This commitment is stored on-chain
   - The commitment binds Player 1 to this specific deck without revealing the cards

2. **Proof Phase** (Card Flipping)
   - When a player flips a card, they must prove they know:
     - The complete deck that matches the commitment
     - The salt used in the commitment
     - That the card at position X has value Y
   - A Noir ZK proof is generated that proves all of this WITHOUT revealing:
     - The other cards in the deck
     - The salt value
     - Any information about unflipped cards

3. **Verification Phase**
   - The smart contract receives:
     - The proof (~200 bytes)
     - Public inputs: position, commitment, revealed_value
   - The contract verifies the proof using BN254 elliptic curve cryptography
   - If valid, the card flip is accepted and the game state updates

**Why This Matters**:
- **No Cheating**: Player 1 cannot change the deck mid-game (bound by commitment)
- **Privacy**: Unflipped cards remain hidden (zero-knowledge property)
- **Trustless**: No need to trust Player 1 - the math guarantees fairness
- **Efficient**: Proofs are only ~200 bytes (perfect for blockchain)

**Technical Implementation**:
- **Circuit**: Noir language (similar to Rust)
- **Proof System**: Groth16 (via Barretenberg backend)
- **Commitment**: Pedersen hash (elliptic curve based)
- **Verification**: BN254 pairing check on Stellar (Protocol 25+)

### How It Works

1. **Game Creation**
   - Player 1 creates a shuffled deck and generates a Pedersen commitment
   - Both players authorize the game with their points
   - Deck commitment is stored on-chain

2. **Card Flipping**
   - Players take turns flipping cards
   - Each flip generates a Noir ZK proof proving the card is genuine
   - Proof is verified on-chain (development mode for testing)

3. **Winning**
   - First player to find 2 matching pairs wins
   - Game Hub records the winner and distributes points

### Running ZK Memory

```bash
# Run the ZK Memory frontend
bun run dev:game zk-memory

# Or navigate directly
cd zk-memory-frontend
bun run dev
```

Open `http://localhost:3000` and:
1. Create a game (Player 1)
2. Share the auth entry with Player 2 (contains everything needed)
3. Player 2 imports the auth entry and starts the game
4. Both players flip cards to find matches

### Deck Data Encryption

The deck data is automatically encrypted and embedded within the auth entry, making sharing simple and secure:

**How It Works**:
1. Player 1 creates a game and generates a shuffled deck
2. The deck data is encrypted using AES-256-GCM with a random key
3. Both the encrypted deck and encryption key are embedded in the auth entry
4. Player 1 shares ONE item: the auth entry
5. Player 2 imports the auth entry and automatically decrypts the deck data

**Security Features**:
- AES-256-GCM encryption (authenticated encryption)
- Random encryption key per game
- Encryption key embedded securely in the auth entry
- Only Player 2 can decrypt (requires their wallet signature)
- Zero-knowledge proofs ensure fair play even with deck knowledge

**Why Deck Sharing Is Needed**:
- Both players need the deck to generate ZK proofs when flipping cards
- The commitment binds Player 1 to the deck (prevents cheating)
- ZK proofs ensure neither player can cheat, even knowing the deck
- Encryption protects the deck during transmission

### ZK Memory Architecture

**Contract** (`contracts/zk-memory/`)
- Stores game state with 30-day TTL
- Verifies ZK proofs (development mode accepts all proofs)
- Enforces turn-based gameplay
- Calls Game Hub for lifecycle events

**Circuit** (`circuits/card_reveal/`)
- Noir circuit for card reveal proofs
- Uses Pedersen hash for commitments
- Public inputs: position, commitment, revealed_value
- Compiled with Noir 1.0.0-beta.19

**Frontend** (`zk-memory-frontend/`)
- React + TypeScript + Vite
- Noir.js for proof generation
- Barretenberg backend (Groth16)
- Multi-signature transaction flow

### ZK Memory Tech Stack

- **Smart Contract**: Soroban (Rust)
- **ZK Circuit**: Noir 1.0.0-beta.19
- **Proof System**: Groth16 (via Barretenberg)
- **Frontend**: React 19 + TypeScript + Vite
- **Wallet**: Freighter + CreitTech Stellar Wallets Kit
- **Commitment**: Pedersen hash
- **Proof Size**: ~200 bytes

### Production Deployment

To enable on-chain proof verification:

1. **Extract Verification Key**
```bash
cd circuits/card_reveal
bb write_vk -b target/card_reveal.json -o ../../contracts/zk-memory/vk.bin
```

2. **Enable BN254 Verification**
Uncomment the verification code in `contracts/zk-memory/src/lib.rs`:
```rust
fn verify_card_reveal_proof(...) -> bool {
    env.crypto().bn254_verify_groth16_proof(
        vk_bytes,
        proof,
        &public_inputs
    )
}
```

3. **Rebuild and Deploy**
```bash
bun run build zk-memory
bun run deploy zk-memory
bun run bindings zk-memory
```

## Publish (Production)

```bash
# Export a production container and build it (uses CreitTech wallet kit v2)
bun run publish my-game --build

# Update runtime config in the output
# dist/my-game-frontend/public/game-studio-config.js
```

## Project Structure

```
├── contracts/               # Soroban contracts for games + mock Game Hub
│   ├── zk-memory/          # ZK Memory Card Game contract
│   ├── number-guess/       # Number guessing game
│   ├── twenty-one/         # Blackjack-style game
│   ├── dice-duel/          # Dice rolling game
│   └── mock-game-hub/      # Game Hub mock for testing
├── circuits/                # Zero-knowledge circuits
│   └── card_reveal/        # Noir circuit for card reveals
├── template_frontend/       # Standalone number-guess example frontend
├── zk-memory-frontend/      # ZK Memory standalone frontend
├── <game>-frontend/         # Other standalone game frontends
├── sgs_frontend/            # Documentation site (builds to docs/)
├── scripts/                 # Build & deployment automation
└── bindings/                # Generated TypeScript bindings
```

## Commands

```bash
bun run setup                         # Build + deploy testnet contracts, generate bindings
bun run build [game-name]             # Build all or selected contracts
bun run deploy [game-name]            # Deploy all or selected contracts to testnet
bun run bindings [game-name]          # Generate bindings for all or selected contracts
bun run create my-game                # Scaffold contract + standalone frontend
bun run dev:game my-game              # Run a standalone frontend with dev wallet switching
bun run publish my-game --build       # Export + build production frontend
```

## Ecosystem Constraints

- Every game must call `start_game` and `end_game` on the Game Hub contract:
  Testnet: CB4VZAT2U3UC6XFK3N23SKRF2NDCMP3QHJYMCHHFMZO7MRQO6DQ2EMYG
- Game Hub enforces exactly two players per session.
- Keep randomness deterministic between simulation and submission.
- Prefer temporary storage with a 30-day TTL for game state.

## Game Hub Interface

```rust
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

    fn end_game(
        env: Env,
        session_id: u32,
        player1_won: bool
    );
}
```

## Prerequisites

- **Bun**: JavaScript runtime and package manager
- **Rust**: For Soroban contract development
- **Stellar CLI**: For contract deployment
- **Noir** (for ZK Memory): Zero-knowledge circuit compiler
  ```bash
  curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash
  noirup -v 1.0.0-beta.19
  ```
- **Barretenberg** (for ZK Memory): Proof generation backend
  ```bash
  # Installed automatically via npm when running ZK Memory
  ```

## Notes

- Dev wallets are generated during `bun run setup` and stored in the root `.env`.
- Production builds read runtime config from `public/game-studio-config.js`.
- ZK Memory uses Noir 1.0.0-beta.19 for circuit compilation.
- Proof verification is in development mode by default (accepts all proofs).
- For production, extract the verification key and enable BN254 verification.

## Studio Reference

Run the studio frontend locally (from `sgs_frontend/`):
```bash
bun run dev
```

Build docs into `docs/`:
```bash
bun --cwd=sgs_frontend run build:docs
```

## Troubleshooting

### ZK Memory Issues

**Circuit compilation fails:**
```bash
# Ensure Noir version matches
nargo --version  # Should be 1.0.0-beta.19
noirup -v 1.0.0-beta.19

# Recompile circuit
cd circuits/card_reveal
nargo compile

# Copy to frontend
cp target/card_reveal.json ../../zk-memory-frontend/src/games/zk-memory/
```

**Proof generation fails:**
- Check browser console for errors
- Verify circuit file exists: `zk-memory-frontend/src/games/zk-memory/card_reveal.json`
- Ensure Noir packages are installed: `@noir-lang/noir_js@1.0.0-beta.19`

**Transaction fails:**
- Check if it's your turn
- Verify card isn't already matched
- Check network status (testnet can be congested)

## Links

- [Stellar Developers](https://developers.stellar.org/)
- [Noir Language](https://noir-lang.org/)
- [James Bachini](https://jamesbachini.com)
- [YouTube](https://www.youtube.com/c/JamesBachini)
- [Newsletter](https://bachini.substack.com)
- [Twitter](https://x.com/james_bachini)
- [LinkedIn](https://www.linkedin.com/in/james-bachini/)
- [GitHub](https://github.com/jamesbachini)

## 📄 License

MIT License - see LICENSE file

**Built with ❤️ for Stellar developers**
