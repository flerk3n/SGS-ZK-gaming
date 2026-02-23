/**
 * Noir Proof Generation for ZK Memory Game
 * Uses Noir.js and Barretenberg to generate Groth16 proofs
 */

import { Noir } from '@noir-lang/noir_js';
import { BarretenbergBackend } from '@noir-lang/backend_barretenberg';
// @ts-ignore - JSON import
import circuit from './card_reveal.json';

/**
 * Compute Pedersen commitment matching the Noir circuit
 * The circuit uses: pedersen_hash([deck[0], deck[1], deck[2], deck[3], salt])
 * 
 * We compute this by executing the circuit once with dummy values to get the commitment,
 * then use that commitment for the actual proof generation.
 * 
 * @param deck - The full deck (4 cards)
 * @param saltField - Salt as field element string
 * @returns Commitment as hex string (32 bytes)
 */
async function computePedersenCommitment(deck: number[], saltField: string): Promise<string> {
  console.log('[Noir] Computing Pedersen commitment...');
  
  // Create backend and Noir instance
  const backend = new BarretenbergBackend(circuit);
  const noir = new Noir(circuit);
  
  // Execute circuit with dummy values to compute the commitment
  // The circuit will compute: pedersen_hash([deck[0], deck[1], deck[2], deck[3], salt])
  const inputs = {
    deck: deck.map(v => v.toString()),
    salt: saltField,
    position: 0,  // Dummy position
    revealed_value: deck[0].toString(),  // Dummy value (must match deck[0])
    commitment: '0'  // Placeholder - circuit will compute internally
  };
  
  try {
    // Execute to get witness
    const { witness } = await noir.execute(inputs);
    
    // Generate a proof to extract the public inputs (which include the commitment)
    const { publicInputs } = await backend.generateProof(witness);
    
    // Public inputs from the circuit are: [position, revealed_value, commitment]
    // The commitment is the 3rd public input (index 2)
    if (publicInputs && publicInputs.length >= 3) {
      const commitmentField = publicInputs[2];
      console.log('[Noir] Computed Pedersen commitment:', commitmentField);
      
      // Convert field element to 32-byte hex string
      // Field elements are represented as hex strings by Barretenberg
      const commitmentHex = commitmentField.startsWith('0x') 
        ? commitmentField.slice(2) 
        : commitmentField;
      
      // Pad to 32 bytes (64 hex chars)
      const paddedHex = commitmentHex.padStart(64, '0');
      
      return paddedHex;
    } else {
      throw new Error('Failed to extract commitment from public inputs');
    }
  } catch (error) {
    console.error('[Noir] Failed to compute Pedersen commitment:', error);
    throw error;
  }
}

/**
 * Generate a Noir proof for card reveal
 * 
 * @param deck - The full deck (4 cards)
 * @param salt - Random salt string
 * @param position - Card position (0-3)
 * @param revealedValue - The revealed value (0 or 1)
 * @returns Proof data (proof bytes, public inputs, and commitment)
 */
export async function generateNoirProof(
  deck: number[],
  salt: string,
  position: number,
  revealedValue: number
): Promise<{ proof: Uint8Array; publicInputs: Uint8Array[]; commitment: string }> {
  try {
    console.log('[Noir] Generating proof...');
    console.log('[Noir] Deck:', deck);
    console.log('[Noir] Salt:', salt);
    console.log('[Noir] Position:', position);
    console.log('[Noir] Revealed Value:', revealedValue);

    // Convert salt to Field (hash it to get a field element)
    const encoder = new TextEncoder();
    const saltBytes = encoder.encode(salt);
    const saltHash = await crypto.subtle.digest('SHA-256', saltBytes);
    const saltArray = new Uint8Array(saltHash);
    
    // Take first 31 bytes to ensure it fits in a field element
    // (Field elements are ~254 bits, so 31 bytes = 248 bits is safe)
    const saltField = '0x' + Array.from(saltArray.slice(0, 31))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    console.log('[Noir] Salt field:', saltField);

    // STEP 1: Compute the Pedersen commitment (matches circuit)
    console.log('[Noir] Computing Pedersen commitment...');
    const commitmentHex = await computePedersenCommitment(deck, saltField);
    console.log('[Noir] Pedersen commitment:', commitmentHex);
    
    // Convert commitment to field element for circuit input
    const commitmentField = '0x' + commitmentHex;

    // STEP 2: Generate the actual proof with the correct commitment
    console.log('[Noir] Generating proof with Barretenberg...');
    
    const inputs = {
      deck: deck.map(v => v.toString()),
      salt: saltField,
      position: position,
      revealed_value: revealedValue.toString(),
      commitment: commitmentField
    };

    // Create backend and Noir instance
    const backend = new BarretenbergBackend(circuit);
    const noir = new Noir(circuit);
    
    // Generate the proof
    const { witness } = await noir.execute(inputs);
    const proofData = await backend.generateProof(witness);

    console.log('[Noir] Proof generated successfully!');
    console.log('[Noir] Proof size:', proofData.proof.length, 'bytes');
    console.log('[Noir] Public inputs:', proofData.publicInputs);

    // Convert to format expected by contract
    // Contract expects: [position, commitment, revealed_value]
    const positionBytes = new Uint8Array(32);
    new DataView(positionBytes.buffer).setUint32(28, position, false); // Big-endian at end

    const valueBytes = new Uint8Array(32);
    new DataView(valueBytes.buffer).setUint32(28, revealedValue, false); // Big-endian at end

    // Commitment bytes (32 bytes)
    const commitmentBytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      commitmentBytes[i] = parseInt(commitmentHex.slice(i * 2, i * 2 + 2), 16);
    }

    return {
      proof: proofData.proof,
      publicInputs: [positionBytes, commitmentBytes, valueBytes],
      commitment: commitmentHex
    };
  } catch (error) {
    console.error('[Noir] Failed to generate proof:', error);
    throw error;
  }
}

/**
 * NOTE: The circuit file (card_reveal.json) needs to be copied from:
 * circuits/card_reveal/target/card_reveal.json
 * 
 * To update the circuit:
 * 1. Make changes to circuits/card_reveal/src/main.nr
 * 2. Run: nargo compile (in circuits/card_reveal directory)
 * 3. Copy circuits/card_reveal/target/card_reveal.json to this directory
 */
