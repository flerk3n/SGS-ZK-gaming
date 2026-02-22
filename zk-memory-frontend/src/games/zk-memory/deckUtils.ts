/**
 * Deck utilities for ZK Memory game
 * Handles deck shuffling and commitment generation
 */

/**
 * Fisher-Yates shuffle algorithm
 * Creates a deck with 2 pairs (values 0-1, each appears twice)
 * Returns a shuffled array of 4 cards
 */
export function shuffleDeck(): number[] {
  // Create 2 pairs (0-1, each value appears twice)
  const deck = [...Array(2).keys(), ...Array(2).keys()];
  
  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  
  return deck;
}

/**
 * Generate a commitment hash for the deck
 * Uses SHA-256 (mock Poseidon hash for development)
 * 
 * @param deck - Array of 4 card values
 * @param salt - Random salt string
 * @returns Hex string (32 bytes) representing the commitment
 */
export async function generateCommitment(
  deck: number[],
  salt: string
): Promise<string> {
  // Combine deck and salt into a single string
  const data = JSON.stringify({ deck, salt });
  
  // Convert to Uint8Array
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  
  // Hash using Web Crypto API (SHA-256)
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  
  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex;
}

/**
 * Create a committed deck ready for game creation
 * Shuffles the deck, generates a random salt, and creates a commitment
 * 
 * @returns Object containing deck, salt, and commitment
 */
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

/**
 * Convert hex string to Buffer for contract calls
 * @param hex - Hex string (with or without 0x prefix)
 * @returns Buffer
 */
export function hexToBuffer(hex: string): Buffer {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  return Buffer.from(cleanHex, 'hex');
}

/**
 * Generate mock proof bytes for development
 * Contract accepts all proofs in development mode
 * 
 * @returns Buffer of 256 zero bytes
 */
export function generateMockProof(): Buffer {
  return Buffer.alloc(256, 0);
}

/**
 * Generate mock public inputs for development
 * Contract expects exactly 3 BytesN<32> values:
 * 1. position (as 32-byte value)
 * 2. deck_commitment (the actual commitment)
 * 3. revealed_value (as 32-byte value)
 * 
 * @param position - Card position (0-3)
 * @param deckCommitment - The deck commitment hex string
 * @param revealedValue - The card value (0-1)
 * @returns Array of 3 Buffers (each 32 bytes)
 */
export function generateMockPublicInputs(
  position: number,
  deckCommitment: string,
  revealedValue: number
): Buffer[] {
  // Create 32-byte buffers for each public input
  
  // 1. Position as 32-byte buffer (big-endian u32 padded to 32 bytes)
  const positionBuffer = Buffer.alloc(32, 0);
  positionBuffer.writeUInt32BE(position, 28); // Write at the end (big-endian)
  
  // 2. Deck commitment (already 32 bytes)
  const commitmentBuffer = hexToBuffer(deckCommitment);
  
  // 3. Revealed value as 32-byte buffer (big-endian u32 padded to 32 bytes)
  const valueBuffer = Buffer.alloc(32, 0);
  valueBuffer.writeUInt32BE(revealedValue, 28); // Write at the end (big-endian)
  
  return [positionBuffer, commitmentBuffer, valueBuffer];
}
