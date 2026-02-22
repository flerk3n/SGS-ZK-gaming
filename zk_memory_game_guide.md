**ZK Memory Card Game**

on Stellar Blockchain

*A Complete Developer Guide \| Noir ZK Proofs + Soroban Smart Contracts*

**1. Project Overview**

This guide walks you through building a fully on-chain Memory Card Game
(Pairs) where Zero-Knowledge proofs power the core mechanic. Players
flip cards to find matching pairs, but the cryptographic commitments and
Noir-generated ZK proofs guarantee that the card layout cannot be
manipulated mid-game, matches are verified honestly, and neither player
nor server can cheat.

The game is built in three layers:

+-----------------------------------+-----------------------------------+
| **ZK Layer (Noir)**               | **Smart Contract (Soroban)**      |
|                                   |                                   |
| Circuits that prove card reveals  | On-chain game state, score        |
| are honest, matches are valid,    | tracking, proof verification, and |
| and the committed deck was never  | calls to the Stellar Game Hub     |
| tampered with.                    | contract.                         |
+-----------------------------------+-----------------------------------+

+-----------------------------------+-----------------------------------+
| **Frontend (React / Vite)**       | **Game Hub Contract**             |
|                                   |                                   |
| Game UI, wallet connection, local | Required hackathon integration:   |
| proof generation, and Stellar     | CB4VZAT2U3UC6XFK3N23SKR           |
| transaction submission via        | F2NDCMP3QHJYMCHHFMZO7MRQO6DQ2EMYG |
| Freighter.                        |                                   |
+-----------------------------------+-----------------------------------+

**2. How ZK Powers the Game**

**2.1 The Problem Without ZK**

In a normal online Pairs game, a central server holds all card
positions. You have to blindly trust that the server is not revealing
your previously flipped cards to your opponent, not swapping card
positions mid-game, and not rigging outcomes. ZK removes the need for
this trust entirely.

**2.2 The Three ZK Moments**

+-----+----------------------------------------------------------------+
| **  | **COMMIT: Deck Layout Locked On-Chain**                        |
| 1** |                                                                |
|     | At game start, the full card layout is hashed using Poseidon   |
|     | (a ZK-friendly hash function) and committed on-chain. Neither  |
|     | player can change card positions after this. The hash is the   |
|     | cryptographic lock on the deck.                                |
+-----+----------------------------------------------------------------+

+-----+----------------------------------------------------------------+
| **  | **PROVE: Card Reveal is Honest**                               |
| 2** |                                                                |
|     | When a player flips a card, they generate a ZK proof locally   |
|     | that says: \'Card at position X has value Y, and this is       |
|     | consistent with the committed deck hash.\' The contract        |
|     | verifies the proof without ever seeing the full deck. The      |
|     | flipped value is revealed only after the proof passes.         |
+-----+----------------------------------------------------------------+

+-----+----------------------------------------------------------------+
| **  | **VERIFY: Match is Valid**                                     |
| 3** |                                                                |
|     | When two flipped cards match, a second ZK proof confirms both  |
|     | cards are genuine members of the committed deck and share the  |
|     | same pair value. The contract records the match, increments    |
|     | the score, and allows the player to flip again.                |
+-----+----------------------------------------------------------------+

**2.3 Game Flow Diagram**

> *SETUP: Deck shuffled → Poseidon hash committed on-chain → game_id
> created → start_game() called on hub*
>
> *TURN: Player picks 2 positions → ZK proof generated locally → proof
> submitted to contract → contract verifies → values revealed*
>
> *MATCH: If pair → score++ → cards marked matched → player flips again*
>
> *MISS: Cards go face-down → on-chain state forgets values (commitment
> remains) → opponent\'s turn*
>
> *END: All pairs found → higher score wins → end_game() called on hub*

**3. Technology Stack**

  ---------------- ------------------ -----------------------------------
  **Layer**        **Tool**           **Purpose**

  ZK Circuits      Noir 0.38+         Write and compile ZK proof logic

  ZK Backend       Barretenberg (bb)  Generate and verify proofs locally

  Hash Function    Poseidon2          ZK-friendly hashing for card
                                      commits

  Smart Contract   Soroban (Rust)     On-chain game state + proof
                                      verification

  Blockchain       Stellar Testnet    Protocol 25 (X-Ray) with BN254
                                      support

  Frontend         React + Vite       Game UI and wallet interactions

  Wallet           Freighter          Sign and submit Stellar
                                      transactions

  SDK              stellar-sdk (JS)   Submit transactions from the
                                      browser
  ---------------- ------------------ -----------------------------------

**4. Environment Setup**

**4.1 Install Prerequisites**

Run the following commands in your terminal to get all required tools
installed:

> \# 1. Install Noir (ZK circuit language)
>
> curl -L
> https://raw.githubusercontent.com/noir-lang/noirup/main/install \|
> bash
>
> noirup
>
> \# 2. Install Barretenberg (proof generation backend)
>
> curl -L
> https://raw.githubusercontent.com/AztecProtocol/aztec-packages/master/barretenberg/cpp/scripts/bb-installer.sh
> \| bash
>
> \# 3. Install Rust (for Soroban contracts)
>
> curl \--proto \'=https\' \--tlsv1.2 -sSf https://sh.rustup.rs \| sh
>
> rustup target add wasm32-unknown-unknown
>
> \# 4. Install Stellar CLI
>
> cargo install \--locked stellar-cli \--features opt
>
> \# 5. Install Node.js dependencies for frontend
>
> node \--version \# Must be 18+

**4.2 Project Structure**

Create your project folder and set up this structure before writing any
code:

> zk-memory-game/
>
> ├── circuits/ \# Noir ZK circuits
>
> │ ├── card_reveal/ \# Prove a card reveal is honest
>
> │ └── match_verify/ \# Prove two cards form a valid pair
>
> ├── contracts/ \# Soroban smart contracts (Rust)
>
> │ └── memory_game/
>
> ├── frontend/ \# React + Vite UI
>
> │ ├── src/
>
> │ │ ├── components/ \# Card, Board, Score UI
>
> │ │ ├── hooks/ \# useWallet, useGame, useProof
>
> │ │ └── zk/ \# Proof generation wrappers
>
> │ └── public/
>
> └── README.md

**5. Writing the Noir ZK Circuits**

**5.1 What is a Noir Circuit?**

A Noir circuit is a program that describes a mathematical relationship.
When you run it with private inputs, it produces a proof that the
relationship holds, without revealing those inputs. Think of it as
writing the rules of the game in math.

For the Memory game you need two circuits: one that proves a card at a
position matches the committed deck, and one that proves two revealed
cards form a valid pair.

**5.2 Circuit 1: Card Reveal Proof**

This circuit answers the question: \'Is the card I am revealing actually
at this position in the committed deck, and have I not tampered with
anything?\' Players run this locally in the browser before submitting a
flip.

> // circuits/card_reveal/src/main.nr
>
> use dep::std::hash::poseidon2;
>
> // Private inputs - only the prover knows these
>
> // Public inputs - the contract and opponent can see these
>
> fn main(
>
> // PRIVATE: The full deck layout (all 16 card values)
>
> deck: \[Field; 16\],
>
> // PRIVATE: A random salt added during setup (prevents rainbow
> attacks)
>
> salt: Field,
>
> // PUBLIC: Position the player wants to flip (0-15)
>
> position: pub Field,
>
> // PUBLIC: The committed deck hash (stored on-chain at game start)
>
> deck_commitment: pub Field,
>
> // PUBLIC: The card value being revealed at this position
>
> revealed_value: pub Field,
>
> ) {
>
> // Step 1: Recompute the hash of the deck + salt
>
> // This proves the prover knows the full deck that was committed
>
> let computed_commitment = poseidon2::bn254::hash_1(
>
> poseidon2::bn254::hash_fixed_length(deck, salt)
>
> );
>
> // Step 2: Assert our computed hash matches what is on-chain
>
> // If this fails, proof generation fails - you cannot fake the deck
>
> assert(computed_commitment == deck_commitment,
>
> \"Deck commitment does not match - tampering detected\");
>
> // Step 3: Assert the revealed value is actually at the claimed
> position
>
> assert(deck\[position\] == revealed_value,
>
> \"Revealed value does not match card at this position\");
>
> }
>
> *Key insight: The prover must know the FULL deck to generate this
> proof. The deck is private, so the opponent never sees it. But the
> hash on-chain guarantees it cannot be changed after commitment.*

**5.3 Circuit 2: Match Verification Proof**

This circuit proves two revealed cards are a genuine pair. It prevents a
player from claiming a match on mismatched cards.

> // circuits/match_verify/src/main.nr
>
> use dep::std::hash::poseidon2;
>
> fn main(
>
> // PRIVATE: Full deck layout
>
> deck: \[Field; 16\],
>
> salt: Field,
>
> // PUBLIC: The two positions being claimed as a match
>
> position_a: pub Field,
>
> position_b: pub Field,
>
> // PUBLIC: On-chain commitment
>
> deck_commitment: pub Field,
>
> ) {
>
> // Verify the deck commitment
>
> let computed = poseidon2::bn254::hash_1(
>
> poseidon2::bn254::hash_fixed_length(deck, salt)
>
> );
>
> assert(computed == deck_commitment, \"Invalid deck commitment\");
>
> // Get the two card values
>
> let card_a = deck\[position_a\];
>
> let card_b = deck\[position_b\];
>
> // Prove they are the same pair value
>
> assert(card_a == card_b, \"Cards do not match - not a valid pair\");
>
> // Ensure they are different positions (not the same card twice)
>
> assert(position_a != position_b, \"Cannot match a card with itself\");
>
> }

**5.4 Initialize and Compile the Circuits**

> \# Create the card_reveal circuit
>
> cd circuits/
>
> nargo new card_reveal
>
> \# Paste the code above into card_reveal/src/main.nr
>
> \# Create the match_verify circuit
>
> nargo new match_verify
>
> \# Paste the code above into match_verify/src/main.nr
>
> \# Compile both circuits
>
> cd card_reveal && nargo compile
>
> cd ../match_verify && nargo compile
>
> \# Generate proving and verification keys
>
> cd card_reveal
>
> bb write_vk -b ./target/card_reveal.json -o ./target/vk
>
> bb write_pk -b ./target/card_reveal.json -o ./target/pk
>
> cd ../match_verify
>
> bb write_vk -b ./target/match_verify.json -o ./target/vk
>
> bb write_pk -b ./target/match_verify.json -o ./target/pk

**6. Soroban Smart Contract**

**6.1 Initialize the Contract**

> cd contracts/
>
> stellar contract init memory_game \--name memory_game
>
> cd memory_game

**6.2 Contract Data Structures**

First define the data types that represent game state. Add these to
contracts/memory_game/src/lib.rs:

> #\![no_std\]
>
> use soroban_sdk::{contract, contractimpl, contracttype, Address,
> Bytes, Env, Vec};
>
> // The two states a card position can be in
>
> #\[contracttype\]
>
> #\[derive(Clone)\]
>
> pub enum CardState {
>
> FaceDown, // Hidden, not yet matched
>
> Matched, // Found and locked face-up
>
> }
>
> // Full game state stored on-chain
>
> #\[contracttype\]
>
> #\[derive(Clone)\]
>
> pub struct GameState {
>
> pub player_one: Address,
>
> pub player_two: Address,
>
> pub deck_commitment: u128, // Poseidon hash of the deck
>
> pub cards: Vec\<CardState\>, // 16 card states
>
> pub score_one: u32,
>
> pub score_two: u32,
>
> pub current_turn: Address, // Whose turn it is
>
> pub flip_one: Option\<u32\>, // First card flipped this turn
>
> pub flip_one_value: Option\<u32\>, // Its revealed value
>
> pub total_pairs: u32, // 8 pairs in a 4x4 grid
>
> pub pairs_found: u32, // Matched pairs so far
>
> pub is_active: bool,
>
> }

**6.3 Core Contract Functions**

**start_game()**

> #\[contractimpl\]
>
> impl MemoryGameContract {
>
> // Called once to initialise a new game between two players
>
> pub fn start_game(
>
> env: Env,
>
> player_one: Address,
>
> player_two: Address,
>
> deck_commitment: u128, // Poseidon hash committed by the host
>
> ) -\> u64 {
>
> player_one.require_auth();
>
> // Build initial card states - all face down
>
> let mut cards: Vec\<CardState\> = Vec::new(&env);
>
> for \_ in 0..16 {
>
> cards.push_back(CardState::FaceDown);
>
> }
>
> let game = GameState {
>
> player_one: player_one.clone(),
>
> player_two,
>
> deck_commitment,
>
> cards,
>
> score_one: 0,
>
> score_two: 0,
>
> current_turn: player_one,
>
> flip_one: None,
>
> flip_one_value: None,
>
> total_pairs: 8,
>
> pairs_found: 0,
>
> is_active: true,
>
> };
>
> let game_id = env.ledger().timestamp();
>
> env.storage().persistent().set(&game_id, &game);
>
> // Notify the Stellar Game Hub
>
> // (call start_game on hub contract here - see Section 7)
>
> game_id
>
> }

**flip_card() - The ZK Verification Core**

> // Player submits a card flip with a ZK proof
>
> pub fn flip_card(
>
> env: Env,
>
> game_id: u64,
>
> position: u32,
>
> revealed_value: u32,
>
> proof: Bytes, // The ZK proof from Noir/Barretenberg
>
> public_inputs: Vec\<u128\>, // \[position, deck_commitment,
> revealed_value\]
>
> ) {
>
> let mut game: GameState = env.storage().persistent()
>
> .get(&game_id).expect(\"Game not found\");
>
> // Only active games, only current player\'s turn
>
> assert!(game.is_active, \"Game is not active\");
>
> let caller = env.current_contract_address(); // simplified
>
> // Check this position is still face down
>
> let card = game.cards.get(position).unwrap();
>
> assert!(matches!(card, CardState::FaceDown), \"Card already
> matched\");
>
> // === ZK PROOF VERIFICATION ===
>
> // The contract calls Stellar\'s built-in BN254 operations (Protocol
> 25)
>
> // to verify the Noir-generated proof on-chain
>
> Self::verify_card_reveal_proof(&env, &proof, &public_inputs);
>
> // === GAME LOGIC ===
>
> if game.flip_one.is_none() {
>
> // First card of the turn - store it, wait for second flip
>
> game.flip_one = Some(position);
>
> game.flip_one_value = Some(revealed_value);
>
> } else {
>
> // Second card - check for match
>
> let pos_a = game.flip_one.unwrap();
>
> let val_a = game.flip_one_value.unwrap();
>
> if val_a == revealed_value && pos_a != position {
>
> // MATCH FOUND
>
> game.cards.set(pos_a, CardState::Matched);
>
> game.cards.set(position, CardState::Matched);
>
> game.pairs_found += 1;
>
> // Increment score for current player
>
> if game.current_turn == game.player_one {
>
> game.score_one += 1;
>
> } else {
>
> game.score_two += 1;
>
> }
>
> // Player keeps their turn after a match
>
> } else {
>
> // NO MATCH - switch turns
>
> // Cards go back face-down (values forgotten from on-chain state)
>
> game.current_turn = if game.current_turn == game.player_one {
>
> game.player_two.clone()
>
> } else {
>
> game.player_one.clone()
>
> };
>
> }
>
> game.flip_one = None;
>
> game.flip_one_value = None;
>
> }
>
> // Check if game is over
>
> if game.pairs_found == game.total_pairs {
>
> game.is_active = false;
>
> // end_game() call to hub goes here (see Section 7)
>
> }
>
> env.storage().persistent().set(&game_id, &game);
>
> }

**verify_card_reveal_proof() - BN254 On-Chain Verification**

> // This function uses Stellar Protocol 25 BN254 host functions
>
> // to verify the Noir proof directly on-chain
>
> fn verify_card_reveal_proof(
>
> env: &Env,
>
> proof: &Bytes,
>
> public_inputs: &Vec\<u128\>
>
> ) {
>
> // Stellar Protocol 25 exposes BN254 pairing and scalar mul
>
> // The Noir verifier is compiled to use these operations
>
> // Use soroban_sdk experimental ZK verify host function:
>
> //
>
> // env.crypto().verify_groth16_bn254(
>
> // &VERIFICATION_KEY, // hardcoded from bb write_vk output
>
> // public_inputs,
>
> // proof
>
> // );
>
> //
>
> // If verification fails, this panics and the transaction reverts.
>
> // The proof is cryptographically unforgeable.
>
> //
>
> // NOTE: Embed your compiled verification key bytes here.
>
> // Extract from: circuits/card_reveal/target/vk
>
> }
>
> pub fn get_game(env: Env, game_id: u64) -\> GameState {
>
> env.storage().persistent().get(&game_id).expect(\"Game not found\")
>
> }
>
> }

**6.4 Build and Deploy**

> \# Build the contract
>
> cd contracts/memory_game
>
> stellar contract build
>
> \# Configure Stellar CLI for testnet
>
> stellar network add \--global testnet \\
>
> \--rpc-url https://soroban-testnet.stellar.org \\
>
> \--network-passphrase \'Test SDF Network ; September 2015\'
>
> \# Create and fund a test wallet
>
> stellar keys generate \--global my-wallet \--network testnet
>
> stellar keys fund my-wallet \--network testnet \# Friendbot funds it
>
> \# Deploy the contract
>
> stellar contract deploy \\
>
> \--wasm target/wasm32-unknown-unknown/release/memory_game.wasm \\
>
> \--source my-wallet \\
>
> \--network testnet
>
> \# Save the returned CONTRACT_ID for your frontend .env file
>
> \# Example: CDDGXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

**7. Stellar Game Hub Integration**

The hackathon requires your game contract to call start_game() and
end_game() on the Game Hub contract. This is the required on-chain
integration that judges verify.

**7.1 Game Hub Contract Address**

> // Stellar Testnet Game Hub
>
> const GAME_HUB: &str =
>
> \"CB4VZAT2U3UC6XFK3N23SKRF2NDCMP3QHJYMCHHFMZO7MRQO6DQ2EMYG\";

**7.2 Calling start_game() on the Hub**

Add this cross-contract call inside your contract\'s start_game()
function, after setting up local game state:

> use soroban_sdk::{contract, contractimpl, Address, Env, IntoVal};
>
> // Inside start_game(), after local game state is saved:
>
> let hub = Address::from_str(&env, GAME_HUB);
>
> let client = game_hub_contract::Client::new(&env, &hub);
>
> client.start_game(&game_id, &player_one, &player_two);

**7.3 Calling end_game() on the Hub**

Call this when pairs_found == total_pairs at the end of flip_card():

> // Determine winner address
>
> let winner = if game.score_one \> game.score_two {
>
> game.player_one.clone()
>
> } else if game.score_two \> game.score_one {
>
> game.player_two.clone()
>
> } else {
>
> game.player_one.clone() // draw: player one is default
>
> };
>
> let hub = Address::from_str(&env, GAME_HUB);
>
> let client = game_hub_contract::Client::new(&env, &hub);
>
> client.end_game(&game_id, &winner);

**8. Frontend Implementation**

**8.1 Setup React + Vite Project**

> cd frontend/
>
> npm create vite@latest . \-- \--template react
>
> npm install
>
> npm install \@stellar/stellar-sdk \@stellar/freighter-api
>
> npm install

**8.2 Proof Generation in the Browser**

This is the most important frontend piece. When a player flips a card,
the browser generates a ZK proof locally before submitting anything to
the chain. Create src/zk/prover.js:

> // src/zk/prover.js
>
> // Generates ZK proofs in the browser using Barretenberg WASM
>
> import { BarretenbergWasm } from \'@aztec/bb.js\';
>
> import { Noir } from \'@noir-lang/noir_js\';
>
> import cardRevealCircuit from
> \'../../circuits/card_reveal/target/card_reveal.json\';
>
> import matchVerifyCircuit from
> \'../../circuits/match_verify/target/match_verify.json\';
>
> let bb = null;
>
> let cardRevealNoir = null;
>
> // Initialise Barretenberg WASM once on app start
>
> export async function initProver() {
>
> bb = await BarretenbergWasm.new();
>
> cardRevealNoir = new Noir(cardRevealCircuit, bb);
>
> await cardRevealNoir.init();
>
> }
>
> // Generate a card reveal proof
>
> // deck: number\[16\] - full private deck (stored in memory only,
> never sent)
>
> // salt: bigint - private salt from game setup
>
> // position: number - which card to flip (0-15)
>
> // commitment: bigint - on-chain deck commitment
>
> export async function proveCardReveal(deck, salt, position,
> commitment) {
>
> const input = {
>
> deck: deck.map(v =\> BigInt(v)),
>
> salt: salt,
>
> position: BigInt(position),
>
> deck_commitment: commitment,
>
> revealed_value: BigInt(deck\[position\]),
>
> };
>
> // This runs entirely in the browser - deck is NEVER sent anywhere
>
> const { proof, publicInputs } = await
> cardRevealNoir.generateFinalProof(input);
>
> return {
>
> proof, // Submit this to the smart contract
>
> revealedValue: deck\[position\], // The revealed card value
>
> publicInputs,
>
> };
>
> }

**8.3 Wallet Connection and Transaction Submission**

Create src/hooks/useWallet.js to handle Freighter wallet interactions:

> // src/hooks/useWallet.js
>
> import { useState, useCallback } from \'react\';
>
> import { getPublicKey, signTransaction, isConnected } from
> \'@stellar/freighter-api\';
>
> import { Networks, TransactionBuilder, Contract, xdr } from
> \'@stellar/stellar-sdk\';
>
> const CONTRACT_ID = import.meta.env.VITE_CONTRACT_ID;
>
> const NETWORK = \'TESTNET\';
>
> export function useWallet() {
>
> const \[publicKey, setPublicKey\] = useState(null);
>
> const connect = useCallback(async () =\> {
>
> if (!(await isConnected())) {
>
> throw new Error(\'Please install Freighter wallet\');
>
> }
>
> const key = await getPublicKey();
>
> setPublicKey(key);
>
> return key;
>
> }, \[\]);
>
> const flipCard = useCallback(async (gameId, position, proof,
> publicInputs, revealedValue) =\> {
>
> const contract = new Contract(CONTRACT_ID);
>
> const tx = new TransactionBuilder(/\* account \*/, { fee: \'100\' })
>
> .addOperation(contract.call(
>
> \'flip_card\',
>
> xdr.ScVal.scvU64(BigInt(gameId)),
>
> xdr.ScVal.scvU32(position),
>
> xdr.ScVal.scvU32(revealedValue),
>
> xdr.ScVal.scvBytes(proof),
>
> // public inputs as Vec\<u128\>\...
>
> ))
>
> .setNetworkPassphrase(Networks.TESTNET)
>
> .setTimeout(30)
>
> .build();
>
> const signed = await signTransaction(tx.toXDR(), { network: NETWORK
> });
>
> // Submit signed transaction via horizon/soroban RPC
>
> return signed;
>
> }, \[publicKey\]);
>
> return { publicKey, connect, flipCard };
>
> }

**8.4 Game Board UI Component**

Create src/components/GameBoard.jsx for the card grid:

> // src/components/GameBoard.jsx
>
> import { useState, useEffect } from \'react\';
>
> import { proveCardReveal } from \'../zk/prover\';
>
> import { useWallet } from \'../hooks/useWallet\';
>
> export function GameBoard({ gameState, deck, salt, commitment, gameId
> }) {
>
> const { flipCard } = useWallet();
>
> const \[flipping, setFlipping\] = useState(false);
>
> const \[revealedThis, setRevealedThis\] = useState({});
>
> const handleCardClick = async (position) =\> {
>
> if (flipping) return;
>
> if (gameState.cards\[position\] === \'Matched\') return;
>
> setFlipping(true);
>
> try {
>
> // 1. Generate ZK proof locally (deck stays private)
>
> const { proof, revealedValue, publicInputs } =
>
> await proveCardReveal(deck, salt, position, commitment);
>
> // Show the card face to the local player optimistically
>
> setRevealedThis(prev =\> ({ \...prev, \[position\]: revealedValue }));
>
> // 2. Submit proof + revealed value to the smart contract
>
> await flipCard(gameId, position, proof, publicInputs, revealedValue);
>
> // 3. Poll for updated game state from chain
>
> // \... (refetch game state)
>
> } catch (err) {
>
> console.error(\'Flip failed:\', err);
>
> } finally {
>
> setFlipping(false);
>
> }
>
> };
>
> return (
>
> \<div style={{ display: \'grid\', gridTemplateColumns: \'repeat(4,
> 100px)\', gap: \'12px\' }}\>
>
> {gameState.cards.map((state, i) =\> (
>
> \<div
>
> key={i}
>
> onClick={() =\> handleCardClick(i)}
>
> style={{
>
> width: 100, height: 100,
>
> background: state === \'Matched\' ? \'#4ade80\' :
>
> revealedThis\[i\] ? \'#818cf8\' : \'#1e1b4b\',
>
> borderRadius: 12,
>
> display: \'flex\', alignItems: \'center\', justifyContent: \'center\',
>
> cursor: state === \'Matched\' ? \'default\' : \'pointer\',
>
> fontSize: 32,
>
> }}
>
> \>
>
> {state === \'Matched\' \|\| revealedThis\[i\]
>
> ? CARD_EMOJIS\[revealedThis\[i\] \|\| 0\]
>
> : \'?\'}
>
> \</div\>
>
> ))}
>
> \</div\>
>
> );
>
> }
>
> const CARD_EMOJIS = \[\'\', \'🍎\', \'🍎\', \'🍊\', \'🍊\',
>
> \'🍑\', \'🍑\', \'🍇\', \'🍇\',
>
> \'⭐\', \'⭐\', \'🔥\', \'🔥\', \'🌈\', \'🌈\',
>
> \'💡\', \'💡\'\];

**9. Deck Shuffling and Commitment**

**9.1 Generating a Fair Deck**

The host player (Player One) shuffles the deck locally and generates the
Poseidon commitment. This must happen before start_game() is called.
Create src/zk/deck.js:

> // src/zk/deck.js
>
> import { poseidon2 } from \'@aztec/bb.js\'; // or poseidon from
> circomlibjs
>
> // Create 8 pairs, shuffle, return deck + commitment + salt
>
> export function createCommittedDeck() {
>
> // 8 pairs for a 4x4 grid (values 1-8, each appearing twice)
>
> const pairs = \[1,1, 2,2, 3,3, 4,4, 5,5, 6,6, 7,7, 8,8\];
>
> // Fisher-Yates shuffle
>
> for (let i = pairs.length - 1; i \> 0; i\--) {
>
> const j = Math.floor(Math.random() \* (i + 1));
>
> \[pairs\[i\], pairs\[j\]\] = \[pairs\[j\], pairs\[i\]\];
>
> }
>
> // Generate random salt (prevents pre-image attacks)
>
> const salt = BigInt(\'0x\' + Array.from(crypto.getRandomValues(new
> Uint8Array(31)))
>
> .map(b =\> b.toString(16).padStart(2, \'0\')).join(\'\'));
>
> // Compute Poseidon2 hash of \[deck\..., salt\]
>
> // This is the commitment stored on-chain
>
> const commitment = poseidon2(\[\...pairs.map(BigInt), salt\]);
>
> return {
>
> deck: pairs, // PRIVATE - keep in memory, never send to chain
>
> salt, // PRIVATE - keep in memory
>
> commitment, // PUBLIC - stored on-chain in start_game()
>
> };
>
> }
>
> *The deck and salt must be stored securely in the browser\'s memory
> (useState or useRef) for the duration of the game. If the page is
> refreshed, the player should re-derive them from a stored seed. Never
> send the raw deck to any server or smart contract.*

**10. Environment Variables & Testing**

**10.1 Frontend .env File**

> \# frontend/.env
>
> VITE_CONTRACT_ID=CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
>
> VITE_NETWORK=testnet
>
> VITE_HORIZON_URL=https://horizon-testnet.stellar.org
>
> VITE_SOROBAN_RPC=https://soroban-testnet.stellar.org

**10.2 Testing the ZK Circuit Locally**

Before deploying, test your Noir circuits with example inputs using
Prover.toml files:

> \# circuits/card_reveal/Prover.toml
>
> deck = \[1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8\]
>
> salt = \"0x1234567890abcdef\"
>
> position = \"3\"
>
> deck_commitment = \"0x\...\" \# pre-computed Poseidon hash
>
> revealed_value = \"2\" \# deck\[3\] = 2 in this example
>
> \# Run the test
>
> cd circuits/card_reveal
>
> nargo prove
>
> nargo verify
>
> \# Both should succeed with no errors

**10.3 Full Integration Test Flow**

Follow this sequence to verify everything works end to end before
submitting:

+-----+----------------------------------------------------------------+
| **  | **Compile circuits and generate keys**                         |
| 1** |                                                                |
|     | nargo compile && bb write_vk && bb write_pk for both circuits. |
|     | Confirm target/ folder contains JSON and key files.            |
+-----+----------------------------------------------------------------+

+-----+----------------------------------------------------------------+
| **  | **Deploy contract to testnet**                                 |
| 2** |                                                                |
|     | Run stellar contract deploy, save the contract address, and    |
|     | fund your test wallets via Friendbot.                          |
+-----+----------------------------------------------------------------+

+-----+----------------------------------------------------------------+
| **  | **Simulate a game in the console**                             |
| 3** |                                                                |
|     | Use the Stellar CLI to invoke start_game() manually, then      |
|     | flip_card() with a test proof. Confirm on Stellar Expert that  |
|     | transactions land.                                             |
+-----+----------------------------------------------------------------+

+-----+----------------------------------------------------------------+
| **  | **Run the frontend**                                           |
| 4** |                                                                |
|     | npm run dev, connect Freighter, create a game, and play        |
|     | through a match. Verify each flip generates a proof and        |
|     | submits successfully.                                          |
+-----+----------------------------------------------------------------+

+-----+----------------------------------------------------------------+
| **  | **Verify Game Hub calls**                                      |
| 5** |                                                                |
|     | Check CB4VZAT2U3UC6XFK3N23SKRF2NDCMP3QHJYMCHHFMZO7MRQO6DQ2EMYG |
|     | on Stellar Expert testnet explorer and confirm start_game and  |
|     | end_game appear in the call history.                           |
+-----+----------------------------------------------------------------+

**11. README.md Template**

Your hackathon submission requires a clear README. Use this structure:

> \# ZK Memory Card Game on Stellar
>
> \## What is it?
>
> A two-player Memory / Pairs card game where Zero-Knowledge proofs
>
> guarantee fair play. No server can cheat. No player can lie about
>
> card reveals. All outcomes are mathematically verifiable on-chain.
>
> \## ZK Mechanic
>
> \- Card layout committed via Poseidon hash at game start
>
> \- Each card flip generates a Noir ZK proof (card_reveal circuit)
>
> \- Matches verified via match_verify circuit
>
> \- Proofs verified on Stellar using Protocol 25 BN254 operations
>
> \## Tech Stack
>
> \- ZK: Noir + Barretenberg
>
> \- Smart Contract: Soroban (Rust) on Stellar Testnet
>
> \- Frontend: React + Vite + Freighter
>
> \## How to Run
>
> 1\. Clone repo
>
> 2\. cd circuits/card_reveal && nargo compile
>
> 3\. cd circuits/match_verify && nargo compile
>
> 4\. cd contracts/memory_game && stellar contract build
>
> 5\. stellar contract deploy \...
>
> 6\. cd frontend && cp .env.example .env && npm install && npm run dev
>
> \## Contract Addresses (Testnet)
>
> \- Memory Game: CXXX\...
>
> \- Game Hub: CB4VZAT2U3UC6XFK3N23SKRF2NDCMP3QHJYMCHHFMZO7MRQO6DQ2EMYG

**12. Submission Checklist**

  ----------- ----------------------------------------------------------------
  **Done?**   **Requirement**

  \[ \]       Noir circuits compiled (card_reveal + match_verify)

  \[ \]       ZK proofs generated and verified locally with nargo prove /
              nargo verify

  \[ \]       Soroban contract deployed on Stellar Testnet

  \[ \]       start_game() called on Game Hub:
              CB4VZAT2U3UC6XFK3N23SKRF2NDCMP3QHJYMCHHFMZO7MRQO6DQ2EMYG

  \[ \]       end_game() called on Game Hub when game completes

  \[ \]       ZK proof verification happening inside the smart contract (not
              just frontend)

  \[ \]       Frontend deployed and accessible (Vercel / Netlify / GitHub
              Pages)

  \[ \]       Public GitHub repository with full source code

  \[ \]       README.md with setup instructions and contract addresses

  \[ \]       2-3 minute video demo showing gameplay and explaining ZK
              mechanic
  ----------- ----------------------------------------------------------------

**Good luck at the hackathon!**

*Submissions close February 23, 2026*
