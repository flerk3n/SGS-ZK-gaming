import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}


export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CBRXX5LIJH4V2LTQLTIXL4T5MQHFP6JH4JK6EFQJY4G2UZ4YGO25TYKS",
  }
} as const

export const Errors = {
  1: {message:"GameNotFound"},
  2: {message:"GameNotActive"},
  3: {message:"NotYourTurn"},
  4: {message:"CardAlreadyMatched"},
  5: {message:"InvalidProof"},
  6: {message:"InvalidPosition"},
  7: {message:"NotPlayer"}
}

export type DataKey = {tag: "Game", values: readonly [u32]} | {tag: "GameHubAddress", values: void} | {tag: "Admin", values: void};

export type CardState = {tag: "FaceDown", values: void} | {tag: "Matched", values: void};


export interface GameState {
  cards: Array<CardState>;
  current_turn: string;
  deck_commitment: Buffer;
  flip_one: Option<u32>;
  flip_one_value: Option<u32>;
  is_active: boolean;
  pairs_found: u32;
  player1: string;
  player1_points: i128;
  player2: string;
  player2_points: i128;
  score1: u32;
  score2: u32;
  session_id: u32;
}

export interface Client {
  /**
   * Construct and simulate a get_hub transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get the current GameHub contract address
   * 
   * # Returns
   * * `Address` - The GameHub contract address
   */
  get_hub: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a set_hub transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Set a new GameHub contract address
   * 
   * # Arguments
   * * `new_hub` - The new GameHub contract address
   */
  set_hub: ({new_hub}: {new_hub: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Update the contract WASM hash (upgrade contract)
   * 
   * # Arguments
   * * `new_wasm_hash` - The hash of the new WASM binary
   */
  upgrade: ({new_wasm_hash}: {new_wasm_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_game transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get game information.
   * 
   * # Arguments
   * * `session_id` - The session ID of the game
   * 
   * # Returns
   * * `GameState` - The complete game state
   */
  get_game: ({session_id}: {session_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<GameState>>>

  /**
   * Construct and simulate a flip_card transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Flip a card with ZK proof verification.
   * Players submit a position, revealed value, and ZK proof that the reveal is honest.
   * 
   * **ZK Proof:** The proof demonstrates that:
   * 1. The prover knows the full deck that matches the on-chain commitment
   * 2. The revealed value is actually at the claimed position
   * 3. The deck has not been tampered with since commitment
   * 
   * # Arguments
   * * `session_id` - The session ID of the game
   * * `player` - Address of the player making the flip
   * * `position` - Card position to flip (0-15)
   * * `revealed_value` - The card value being revealed (1-8, each appears twice)
   * * `proof` - ZK proof bytes (Noir/Barretenberg generated)
   * * `public_inputs` - Public inputs for verification [position, deck_commitment, revealed_value]
   */
  flip_card: ({session_id, player, position, revealed_value, proof, public_inputs}: {session_id: u32, player: string, position: u32, revealed_value: u32, proof: Buffer, public_inputs: Array<Buffer>}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get the current admin address
   * 
   * # Returns
   * * `Address` - The admin address
   */
  get_admin: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a set_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Set a new admin address
   * 
   * # Arguments
   * * `new_admin` - The new admin address
   */
  set_admin: ({new_admin}: {new_admin: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a start_game transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Start a new game between two players with points and a committed deck.
   * This creates a session in the Game Hub and locks points before starting the game.
   * 
   * **CRITICAL:** This method requires authorization from THIS contract (not players).
   * The Game Hub will call `game_id.require_auth()` which checks this contract's address.
   * 
   * # Arguments
   * * `session_id` - Unique session identifier (u32)
   * * `player1` - Address of first player
   * * `player2` - Address of second player
   * * `player1_points` - Points amount committed by player 1
   * * `player2_points` - Points amount committed by player 2
   * * `deck_commitment` - Poseidon hash of the shuffled deck + salt (32 bytes)
   */
  start_game: ({session_id, player1, player2, player1_points, player2_points, deck_commitment}: {session_id: u32, player1: string, player2: string, player1_points: i128, player2_points: i128, deck_commitment: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {admin, game_hub}: {admin: string, game_hub: string},
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy({admin, game_hub}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAABwAAAAAAAAAMR2FtZU5vdEZvdW5kAAAAAQAAAAAAAAANR2FtZU5vdEFjdGl2ZQAAAAAAAAIAAAAAAAAAC05vdFlvdXJUdXJuAAAAAAMAAAAAAAAAEkNhcmRBbHJlYWR5TWF0Y2hlZAAAAAAABAAAAAAAAAAMSW52YWxpZFByb29mAAAABQAAAAAAAAAPSW52YWxpZFBvc2l0aW9uAAAAAAYAAAAAAAAACU5vdFBsYXllcgAAAAAAAAc=",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAAAwAAAAEAAAAAAAAABEdhbWUAAAABAAAABAAAAAAAAAAAAAAADkdhbWVIdWJBZGRyZXNzAAAAAAAAAAAAAAAAAAVBZG1pbgAAAA==",
        "AAAAAgAAAAAAAAAAAAAACUNhcmRTdGF0ZQAAAAAAAAIAAAAAAAAAAAAAAAhGYWNlRG93bgAAAAAAAAAAAAAAB01hdGNoZWQA",
        "AAAAAQAAAAAAAAAAAAAACUdhbWVTdGF0ZQAAAAAAAA4AAAAAAAAABWNhcmRzAAAAAAAD6gAAB9AAAAAJQ2FyZFN0YXRlAAAAAAAAAAAAAAxjdXJyZW50X3R1cm4AAAATAAAAAAAAAA9kZWNrX2NvbW1pdG1lbnQAAAAD7gAAACAAAAAAAAAACGZsaXBfb25lAAAD6AAAAAQAAAAAAAAADmZsaXBfb25lX3ZhbHVlAAAAAAPoAAAABAAAAAAAAAAJaXNfYWN0aXZlAAAAAAAAAQAAAAAAAAALcGFpcnNfZm91bmQAAAAABAAAAAAAAAAHcGxheWVyMQAAAAATAAAAAAAAAA5wbGF5ZXIxX3BvaW50cwAAAAAACwAAAAAAAAAHcGxheWVyMgAAAAATAAAAAAAAAA5wbGF5ZXIyX3BvaW50cwAAAAAACwAAAAAAAAAGc2NvcmUxAAAAAAAEAAAAAAAAAAZzY29yZTIAAAAAAAQAAAAAAAAACnNlc3Npb25faWQAAAAAAAQ=",
        "AAAAAAAAAF5HZXQgdGhlIGN1cnJlbnQgR2FtZUh1YiBjb250cmFjdCBhZGRyZXNzCgojIFJldHVybnMKKiBgQWRkcmVzc2AgLSBUaGUgR2FtZUh1YiBjb250cmFjdCBhZGRyZXNzAAAAAAAHZ2V0X2h1YgAAAAAAAAAAAQAAABM=",
        "AAAAAAAAAF5TZXQgYSBuZXcgR2FtZUh1YiBjb250cmFjdCBhZGRyZXNzCgojIEFyZ3VtZW50cwoqIGBuZXdfaHViYCAtIFRoZSBuZXcgR2FtZUh1YiBjb250cmFjdCBhZGRyZXNzAAAAAAAHc2V0X2h1YgAAAAABAAAAAAAAAAduZXdfaHViAAAAABMAAAAA",
        "AAAAAAAAAHFVcGRhdGUgdGhlIGNvbnRyYWN0IFdBU00gaGFzaCAodXBncmFkZSBjb250cmFjdCkKCiMgQXJndW1lbnRzCiogYG5ld193YXNtX2hhc2hgIC0gVGhlIGhhc2ggb2YgdGhlIG5ldyBXQVNNIGJpbmFyeQAAAAAAAAd1cGdyYWRlAAAAAAEAAAAAAAAADW5ld193YXNtX2hhc2gAAAAAAAPuAAAAIAAAAAA=",
        "AAAAAAAAAIFHZXQgZ2FtZSBpbmZvcm1hdGlvbi4KCiMgQXJndW1lbnRzCiogYHNlc3Npb25faWRgIC0gVGhlIHNlc3Npb24gSUQgb2YgdGhlIGdhbWUKCiMgUmV0dXJucwoqIGBHYW1lU3RhdGVgIC0gVGhlIGNvbXBsZXRlIGdhbWUgc3RhdGUAAAAAAAAIZ2V0X2dhbWUAAAABAAAAAAAAAApzZXNzaW9uX2lkAAAAAAAEAAAAAQAAA+kAAAfQAAAACUdhbWVTdGF0ZQAAAAAAAAM=",
        "AAAAAAAAAtxGbGlwIGEgY2FyZCB3aXRoIFpLIHByb29mIHZlcmlmaWNhdGlvbi4KUGxheWVycyBzdWJtaXQgYSBwb3NpdGlvbiwgcmV2ZWFsZWQgdmFsdWUsIGFuZCBaSyBwcm9vZiB0aGF0IHRoZSByZXZlYWwgaXMgaG9uZXN0LgoKKipaSyBQcm9vZjoqKiBUaGUgcHJvb2YgZGVtb25zdHJhdGVzIHRoYXQ6CjEuIFRoZSBwcm92ZXIga25vd3MgdGhlIGZ1bGwgZGVjayB0aGF0IG1hdGNoZXMgdGhlIG9uLWNoYWluIGNvbW1pdG1lbnQKMi4gVGhlIHJldmVhbGVkIHZhbHVlIGlzIGFjdHVhbGx5IGF0IHRoZSBjbGFpbWVkIHBvc2l0aW9uCjMuIFRoZSBkZWNrIGhhcyBub3QgYmVlbiB0YW1wZXJlZCB3aXRoIHNpbmNlIGNvbW1pdG1lbnQKCiMgQXJndW1lbnRzCiogYHNlc3Npb25faWRgIC0gVGhlIHNlc3Npb24gSUQgb2YgdGhlIGdhbWUKKiBgcGxheWVyYCAtIEFkZHJlc3Mgb2YgdGhlIHBsYXllciBtYWtpbmcgdGhlIGZsaXAKKiBgcG9zaXRpb25gIC0gQ2FyZCBwb3NpdGlvbiB0byBmbGlwICgwLTE1KQoqIGByZXZlYWxlZF92YWx1ZWAgLSBUaGUgY2FyZCB2YWx1ZSBiZWluZyByZXZlYWxlZCAoMS04LCBlYWNoIGFwcGVhcnMgdHdpY2UpCiogYHByb29mYCAtIFpLIHByb29mIGJ5dGVzIChOb2lyL0JhcnJldGVuYmVyZyBnZW5lcmF0ZWQpCiogYHB1YmxpY19pbnB1dHNgIC0gUHVibGljIGlucHV0cyBmb3IgdmVyaWZpY2F0aW9uIFtwb3NpdGlvbiwgZGVja19jb21taXRtZW50LCByZXZlYWxlZF92YWx1ZV0AAAAJZmxpcF9jYXJkAAAAAAAABgAAAAAAAAAKc2Vzc2lvbl9pZAAAAAAABAAAAAAAAAAGcGxheWVyAAAAAAATAAAAAAAAAAhwb3NpdGlvbgAAAAQAAAAAAAAADnJldmVhbGVkX3ZhbHVlAAAAAAAEAAAAAAAAAAVwcm9vZgAAAAAAAA4AAAAAAAAADXB1YmxpY19pbnB1dHMAAAAAAAPqAAAD7gAAACAAAAABAAAD6QAAAAIAAAAD",
        "AAAAAAAAAEhHZXQgdGhlIGN1cnJlbnQgYWRtaW4gYWRkcmVzcwoKIyBSZXR1cm5zCiogYEFkZHJlc3NgIC0gVGhlIGFkbWluIGFkZHJlc3MAAAAJZ2V0X2FkbWluAAAAAAAAAAAAAAEAAAAT",
        "AAAAAAAAAEpTZXQgYSBuZXcgYWRtaW4gYWRkcmVzcwoKIyBBcmd1bWVudHMKKiBgbmV3X2FkbWluYCAtIFRoZSBuZXcgYWRtaW4gYWRkcmVzcwAAAAAACXNldF9hZG1pbgAAAAAAAAEAAAAAAAAACW5ld19hZG1pbgAAAAAAABMAAAAA",
        "AAAAAAAAAopTdGFydCBhIG5ldyBnYW1lIGJldHdlZW4gdHdvIHBsYXllcnMgd2l0aCBwb2ludHMgYW5kIGEgY29tbWl0dGVkIGRlY2suClRoaXMgY3JlYXRlcyBhIHNlc3Npb24gaW4gdGhlIEdhbWUgSHViIGFuZCBsb2NrcyBwb2ludHMgYmVmb3JlIHN0YXJ0aW5nIHRoZSBnYW1lLgoKKipDUklUSUNBTDoqKiBUaGlzIG1ldGhvZCByZXF1aXJlcyBhdXRob3JpemF0aW9uIGZyb20gVEhJUyBjb250cmFjdCAobm90IHBsYXllcnMpLgpUaGUgR2FtZSBIdWIgd2lsbCBjYWxsIGBnYW1lX2lkLnJlcXVpcmVfYXV0aCgpYCB3aGljaCBjaGVja3MgdGhpcyBjb250cmFjdCdzIGFkZHJlc3MuCgojIEFyZ3VtZW50cwoqIGBzZXNzaW9uX2lkYCAtIFVuaXF1ZSBzZXNzaW9uIGlkZW50aWZpZXIgKHUzMikKKiBgcGxheWVyMWAgLSBBZGRyZXNzIG9mIGZpcnN0IHBsYXllcgoqIGBwbGF5ZXIyYCAtIEFkZHJlc3Mgb2Ygc2Vjb25kIHBsYXllcgoqIGBwbGF5ZXIxX3BvaW50c2AgLSBQb2ludHMgYW1vdW50IGNvbW1pdHRlZCBieSBwbGF5ZXIgMQoqIGBwbGF5ZXIyX3BvaW50c2AgLSBQb2ludHMgYW1vdW50IGNvbW1pdHRlZCBieSBwbGF5ZXIgMgoqIGBkZWNrX2NvbW1pdG1lbnRgIC0gUG9zZWlkb24gaGFzaCBvZiB0aGUgc2h1ZmZsZWQgZGVjayArIHNhbHQgKDMyIGJ5dGVzKQAAAAAACnN0YXJ0X2dhbWUAAAAAAAYAAAAAAAAACnNlc3Npb25faWQAAAAAAAQAAAAAAAAAB3BsYXllcjEAAAAAEwAAAAAAAAAHcGxheWVyMgAAAAATAAAAAAAAAA5wbGF5ZXIxX3BvaW50cwAAAAAACwAAAAAAAAAOcGxheWVyMl9wb2ludHMAAAAAAAsAAAAAAAAAD2RlY2tfY29tbWl0bWVudAAAAAPuAAAAIAAAAAEAAAPpAAAAAgAAAAM=",
        "AAAAAAAAAKNJbml0aWFsaXplIHRoZSBjb250cmFjdCB3aXRoIEdhbWVIdWIgYWRkcmVzcyBhbmQgYWRtaW4KCiMgQXJndW1lbnRzCiogYGFkbWluYCAtIEFkbWluIGFkZHJlc3MgKGNhbiB1cGdyYWRlIGNvbnRyYWN0KQoqIGBnYW1lX2h1YmAgLSBBZGRyZXNzIG9mIHRoZSBHYW1lSHViIGNvbnRyYWN0AAAAAA1fX2NvbnN0cnVjdG9yAAAAAAAAAgAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAAhnYW1lX2h1YgAAABMAAAAA" ]),
      options
    )
  }
  public readonly fromJSON = {
    get_hub: this.txFromJSON<string>,
        set_hub: this.txFromJSON<null>,
        upgrade: this.txFromJSON<null>,
        get_game: this.txFromJSON<Result<GameState>>,
        flip_card: this.txFromJSON<Result<void>>,
        get_admin: this.txFromJSON<string>,
        set_admin: this.txFromJSON<null>,
        start_game: this.txFromJSON<Result<void>>
  }
}