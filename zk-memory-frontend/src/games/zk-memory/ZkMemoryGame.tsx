import { useState, useEffect, useRef } from 'react';
import { ZkMemoryService } from './zkMemoryService';
import { useWallet } from '@/hooks/useWallet';
import { ZK_MEMORY_CONTRACT } from '@/utils/constants';
import { devWalletService, DevWalletService } from '@/services/devWalletService';
import { createCommittedDeck, hexToBuffer, generateMockProof, generateMockPublicInputs } from './deckUtils';
import type { GameState, CardState } from './bindings';

const createRandomSessionId = (): number => {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    let value = 0;
    const buffer = new Uint32Array(1);
    while (value === 0) {
      crypto.getRandomValues(buffer);
      value = buffer[0];
    }
    return value;
  }
  return (Math.floor(Math.random() * 0xffffffff) >>> 0) || 1;
};

const zkMemoryService = new ZkMemoryService(ZK_MEMORY_CONTRACT);

interface ZkMemoryGameProps {
  userAddress: string;
  currentEpoch: number;
  availablePoints: bigint;
  initialXDR?: string | null;
  initialSessionId?: number | null;
  onStandingsRefresh: () => void;
  onGameComplete: () => void;
}

export function ZkMemoryGame({
  userAddress,
  availablePoints,
  initialXDR,
  initialSessionId,
  onStandingsRefresh,
  onGameComplete
}: ZkMemoryGameProps) {
  const DEFAULT_POINTS = '0.1';
  const { getContractSigner, walletType } = useWallet();
  
  // Game state
  const [sessionId, setSessionId] = useState<number>(() => createRandomSessionId());
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [deck, setDeck] = useState<number[]>([]);
  const [salt, setSalt] = useState<string>('');
  const [commitment, setCommitment] = useState<string>('');
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [gamePhase, setGamePhase] = useState<'create' | 'playing' | 'complete'>('create');
  
  // Multi-sig state
  const [createMode, setCreateMode] = useState<'create' | 'import'>('create');
  const [exportedAuthEntryXDR, setExportedAuthEntryXDR] = useState<string | null>(null);
  const [exportedDeckData, setExportedDeckData] = useState<string | null>(null);
  const [importAuthEntryXDR, setImportAuthEntryXDR] = useState('');
  const [importDeckData, setImportDeckData] = useState('');
  const [importPlayer2Points, setImportPlayer2Points] = useState(DEFAULT_POINTS);
  
  // Player state
  const [player1Address, setPlayer1Address] = useState(userAddress);
  const [player1Points, setPlayer1Points] = useState(DEFAULT_POINTS);
  const [player2Address, setPlayer2Address] = useState('');
  const [player2Points, setPlayer2Points] = useState(DEFAULT_POINTS);
  
  const actionLock = useRef(false);
  const POINTS_DECIMALS = 7;

  useEffect(() => {
    setPlayer1Address(userAddress);
    
    // Refresh game state when user address changes (wallet switch)
    if (gamePhase === 'playing' && sessionId) {
      zkMemoryService.getGame(sessionId).then(game => {
        if (game) {
          setGameState(game);
          console.log('[Wallet Switch] Game state refreshed for new user:', userAddress.slice(0, 8));
        }
      }).catch(err => {
        console.error('[Wallet Switch] Error refreshing game state:', err);
      });
    }
  }, [userAddress, gamePhase, sessionId]);

  // Poll game state
  useEffect(() => {
    if (gamePhase === 'playing' && sessionId) {
      const interval = setInterval(async () => {
        try {
          const game = await zkMemoryService.getGame(sessionId);
          if (game) {
            setGameState(game);
            // Check if game is complete
            if (game.pairs_found === 2) {
              setGamePhase('complete');
              setSuccess('Game complete! Winner: ' + (game.score1 > game.score2 ? 'Player 1' : game.score1 < game.score2 ? 'Player 2' : 'Tie'));
            }
          }
        } catch (err) {
          console.error('Error polling game state:', err);
        }
      }, 3000); // Increased from 2000 to 3000ms to reduce network load
      return () => clearInterval(interval);
    }
  }, [gamePhase, sessionId]);

  const parsePoints = (value: string): bigint | null => {
    try {
      const cleaned = value.replace(/[^\d.]/g, '');
      if (!cleaned || cleaned === '.') return null;
      const [whole = '0', fraction = ''] = cleaned.split('.');
      const paddedFraction = fraction.padEnd(POINTS_DECIMALS, '0').slice(0, POINTS_DECIMALS);
      return BigInt(whole + paddedFraction);
    } catch {
      return null;
    }
  };

  const handleCreateGame = async () => {
    if (actionLock.current || loading) return;
    actionLock.current = true;
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Generate committed deck
      const { deck: newDeck, salt: newSalt, commitment: newCommitment } = await createCommittedDeck();
      setDeck(newDeck);
      setSalt(newSalt);
      setCommitment(newCommitment);

      const p1Points = parsePoints(player1Points);
      const p2Points = parsePoints(player2Points);
      
      if (!p1Points || !p2Points) {
        throw new Error('Invalid points amount');
      }

      if (!player2Address) {
        throw new Error('Player 2 address is required');
      }

      const signer = await getContractSigner();
      const commitmentBuffer = hexToBuffer(newCommitment);

      // Prepare auth entry for Player 1
      const authEntryXDR = await zkMemoryService.prepareStartGame(
        sessionId,
        player1Address,
        player2Address,
        p1Points,
        p2Points,
        commitmentBuffer,
        signer
      );

      setExportedAuthEntryXDR(authEntryXDR);
      
      // Export deck data for Player 2 (in production, this would be encrypted)
      const deckData = JSON.stringify({ deck: newDeck, salt: newSalt, commitment: newCommitment });
      setExportedDeckData(deckData);
      
      setSuccess('Game prepared! Player 1 (you) will go first. Share both the auth entry AND deck data with Player 2.');
    } catch (err: any) {
      setError(err.message || 'Failed to create game');
      console.error('Create game error:', err);
    } finally {
      setLoading(false);
      actionLock.current = false;
    }
  };

  const handleImportAndStart = async () => {
    if (actionLock.current || loading) return;
    actionLock.current = true;
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Parse the auth entry to get session info
      const parsed = zkMemoryService.parseAuthEntry(importAuthEntryXDR);
      
      // Import the deck data from Player 1
      if (!importDeckData) {
        throw new Error('Deck data is required. Player 1 should share this with the auth entry.');
      }
      
      const deckInfo = JSON.parse(importDeckData);
      setDeck(deckInfo.deck);
      setSalt(deckInfo.salt);
      setCommitment(deckInfo.commitment);
      
      const p2Points = parsePoints(importPlayer2Points);
      if (!p2Points) {
        throw new Error('Invalid points amount');
      }

      const signer = await getContractSigner();
      const commitmentBuffer = hexToBuffer(deckInfo.commitment);

      // Import and sign
      const fullTxXDR = await zkMemoryService.importAndSignAuthEntry(
        importAuthEntryXDR,
        userAddress,
        p2Points,
        commitmentBuffer,
        signer
      );

      // Finalize and submit
      console.log('[ImportAndStart] Calling finalizeStartGame...');
      await zkMemoryService.finalizeStartGame(fullTxXDR, userAddress, signer);
      console.log('[ImportAndStart] Game successfully created on blockchain!');

      setSessionId(parsed.sessionId);
      
      // Load initial game state
      const game = await zkMemoryService.getGame(parsed.sessionId);
      if (game) {
        setGameState(game);
        console.log('[ImportAndStart] Initial game state loaded:', {
          currentTurn: game.current_turn,
          player1: game.player1.slice(0, 8),
          player2: game.player2.slice(0, 8),
          isPlayer1Turn: game.current_turn === game.player1
        });
        
        // Show helpful message about whose turn it is
        if (game.current_turn === game.player1) {
          setSuccess('Game started! Player 1 goes first. ' + 
            (userAddress === game.player1 ? 'It\'s your turn!' : 'Waiting for Player 1...'));
        }
      }
      
      setGamePhase('playing');
      setSuccess('Game started! Both players can now flip cards.');
      onStandingsRefresh();
      
      // Debug: Log the complete game state
      console.log('[ImportAndStart] Complete game state:', JSON.stringify({
        sessionId: parsed.sessionId,
        player1: game?.player1,
        player2: game?.player2,
        currentTurn: game?.current_turn,
        userAddress: userAddress,
        isPlayer1: userAddress === game?.player1,
        isPlayer2: userAddress === game?.player2,
        isMyTurn: userAddress === game?.current_turn
      }, null, 2));
    } catch (err: any) {
      setError(err.message || 'Failed to start game');
      console.error('Import and start error:', err);
    } finally {
      setLoading(false);
      actionLock.current = false;
    }
  };

  const handleFlipCard = async (position: number) => {
    if (actionLock.current || loading) return;
    if (!gameState) return;
    
    console.log('[FlipCard] Current game state:', {
      currentTurn: gameState.current_turn,
      userAddress,
      isMyTurn: gameState.current_turn === userAddress,
      flipOne: gameState.flip_one,
      position
    });
    
    // Check if it's player's turn
    if (gameState.current_turn !== userAddress) {
      setError(`Not your turn! Current turn: ${gameState.current_turn.slice(0, 8)}...`);
      return;
    }

    // Check if card is already matched
    const card = gameState.cards[position];
    if (card.tag === 'Matched') {
      setError('Card already matched!');
      return;
    }

    actionLock.current = true;
    setLoading(true);
    setError(null);

    try {
      const revealedValue = deck[position];
      const proof = generateMockProof();
      const publicInputs = generateMockPublicInputs(position, commitment, revealedValue);
      
      console.log('[FlipCard] Flipping card:', { position, revealedValue, commitment: commitment.slice(0, 16) + '...' });
      
      const signer = await getContractSigner();
      
      // Retry logic for network congestion
      let retries = 3;
      let lastError: any = null;
      
      while (retries > 0) {
        try {
          await zkMemoryService.flipCard(
            sessionId,
            userAddress,
            position,
            revealedValue,
            proof,
            publicInputs,
            signer
          );
          
          setSuccess('Card flipped! Waiting for blockchain confirmation...');
          
          // Wait a moment for blockchain to process
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          // Refresh game state multiple times to ensure we get the updated state
          let game = null;
          for (let i = 0; i < 3; i++) {
            game = await zkMemoryService.getGame(sessionId);
            if (game) {
              console.log(`[FlipCard] Updated game state (attempt ${i + 1}):`, {
                currentTurn: game.current_turn,
                flipOne: game.flip_one,
                pairsFound: game.pairs_found
              });
              
              // If this was the second flip and flip_one is now null, the turn has been processed
              if (gameState.flip_one !== null && game.flip_one === null) {
                break; // State has updated
              }
              
              // Wait a bit before next check
              if (i < 2) {
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            }
          }
          
          if (game) {
            setGameState(game);
            
            // Check if game is complete
            if (game.pairs_found === 2) {
              setGamePhase('complete');
              setSuccess('Game complete! Winner: ' + (game.score1 > game.score2 ? 'Player 1' : game.score1 < game.score2 ? 'Player 2' : 'Tie'));
            } else {
              setSuccess('Card flipped! ' + (game.current_turn === userAddress ? 'Still your turn!' : 'Opponent\'s turn now.'));
            }
          }
          
          return; // Success, exit
        } catch (err: any) {
          lastError = err;
          const errorMsg = err.message || String(err);
          
          console.error('[FlipCard] Error:', errorMsg);
          
          // Check if it's a TRY_AGAIN_LATER or txBadSeq error
          if ((errorMsg.includes('TRY_AGAIN_LATER') || errorMsg.includes('txBadSeq')) && retries > 1) {
            console.log(`Network busy, retrying... (${retries - 1} attempts left)`);
            retries--;
            // Wait a bit before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 1000 * (4 - retries)));
            continue;
          }
          
          // Check if it's a NotYourTurn error - this means state is stale
          if (errorMsg.includes('Error(Contract, #3)')) {
            console.log('NotYourTurn error - refreshing game state...');
            const game = await zkMemoryService.getGame(sessionId);
            if (game) {
              setGameState(game);
            }
            throw new Error('Game state was stale. Please try again - it should be your turn now.');
          }
          
          // Other errors or last retry failed
          throw err;
        }
      }
      
      // If we get here, all retries failed
      throw lastError;
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to flip card';
      setError(errorMsg.includes('TRY_AGAIN_LATER') 
        ? 'Network is busy. Please try again in a moment.' 
        : errorMsg
      );
      console.error('Flip card error:', err);
    } finally {
      setLoading(false);
      actionLock.current = false;
    }
  };

  const handleStartNewGame = () => {
    if (gameState && gamePhase === 'complete') {
      onGameComplete();
    }
    
    actionLock.current = false;
    setGamePhase('create');
    setSessionId(createRandomSessionId());
    setGameState(null);
    setDeck([]);
    setSalt('');
    setCommitment('');
    setLoading(false);
    setError(null);
    setSuccess(null);
    setCreateMode('create');
    setExportedAuthEntryXDR(null);
    setExportedDeckData(null);
    setImportAuthEntryXDR('');
    setImportDeckData('');
    setImportPlayer2Points(DEFAULT_POINTS);
    setPlayer1Address(userAddress);
    setPlayer1Points(DEFAULT_POINTS);
    setPlayer2Address('');
    setPlayer2Points(DEFAULT_POINTS);
  };

  const renderCard = (position: number, card: CardState) => {
    const isMatched = card.tag === 'Matched';
    const isFlipped = gameState?.flip_one === position;
    const value = isMatched || isFlipped ? deck[position] : null;
    
    // Disable card if:
    // - Loading (transaction in progress)
    // - Already matched
    // - Not player's turn
    // - This is the first flipped card (can't flip same card twice)
    const isDisabled = loading || isMatched || gameState?.current_turn !== userAddress || isFlipped;
    
    return (
      <button
        key={position}
        onClick={() => handleFlipCard(position)}
        disabled={isDisabled}
        className={`
          w-20 h-28 rounded-lg border-2 flex items-center justify-center text-2xl font-bold
          transition-all duration-200
          ${isMatched 
            ? 'bg-green-100 border-green-500 cursor-not-allowed' 
            : isFlipped
            ? 'bg-yellow-100 border-yellow-500 cursor-not-allowed'
            : isDisabled
            ? 'bg-gray-300 border-gray-400 cursor-not-allowed'
            : 'bg-blue-500 border-blue-700 hover:bg-blue-600 cursor-pointer'
          }
          ${loading ? 'opacity-50' : ''}
        `}
      >
        {isMatched ? `✓ ${value}` : isFlipped ? `${value}` : '?'}
      </button>
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">ZK Memory Card Game</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {success}
        </div>
      )}

      {gamePhase === 'create' && (
        <div className="space-y-4">
          <div className="flex gap-4 mb-4">
            <button
              onClick={() => setCreateMode('create')}
              className={`px-4 py-2 rounded ${createMode === 'create' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            >
              Create Game
            </button>
            <button
              onClick={() => setCreateMode('import')}
              className={`px-4 py-2 rounded ${createMode === 'import' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            >
              Join Game
            </button>
          </div>

          {createMode === 'create' && (
            <div className="space-y-4">
              <div>
                <label className="block mb-2">Session ID</label>
                <input
                  type="number"
                  value={sessionId}
                  onChange={(e) => setSessionId(Number(e.target.value))}
                  className="w-full p-2 border rounded"
                />
              </div>
              <div>
                <label className="block mb-2">Player 1 (You)</label>
                <input
                  type="text"
                  value={player1Address}
                  readOnly
                  className="w-full p-2 border rounded bg-gray-100"
                />
              </div>
              <div>
                <label className="block mb-2">Player 1 Points</label>
                <input
                  type="text"
                  value={player1Points}
                  onChange={(e) => setPlayer1Points(e.target.value)}
                  className="w-full p-2 border rounded"
                />
              </div>
              <div>
                <label className="block mb-2">Player 2 Address</label>
                <input
                  type="text"
                  value={player2Address}
                  onChange={(e) => setPlayer2Address(e.target.value)}
                  className="w-full p-2 border rounded"
                  placeholder="G..."
                />
              </div>
              <div>
                <label className="block mb-2">Player 2 Points</label>
                <input
                  type="text"
                  value={player2Points}
                  onChange={(e) => setPlayer2Points(e.target.value)}
                  className="w-full p-2 border rounded"
                />
              </div>
              <button
                onClick={handleCreateGame}
                disabled={loading}
                className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Game'}
              </button>

              {exportedAuthEntryXDR && exportedDeckData && (
                <div className="mt-4 p-4 bg-gray-100 rounded space-y-4">
                  <div>
                    <p className="font-bold mb-2">1. Auth Entry (share with Player 2):</p>
                    <textarea
                      value={exportedAuthEntryXDR}
                      readOnly
                      className="w-full p-2 border rounded font-mono text-xs"
                      rows={3}
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(exportedAuthEntryXDR);
                        setSuccess('Auth entry copied to clipboard!');
                      }}
                      className="mt-2 bg-green-500 text-white px-4 py-2 rounded"
                    >
                      Copy Auth Entry
                    </button>
                  </div>
                  
                  <div>
                    <p className="font-bold mb-2">2. Deck Data (share with Player 2):</p>
                    <textarea
                      value={exportedDeckData}
                      readOnly
                      className="w-full p-2 border rounded font-mono text-xs"
                      rows={2}
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(exportedDeckData);
                        setSuccess('Deck data copied to clipboard!');
                      }}
                      className="mt-2 bg-green-500 text-white px-4 py-2 rounded"
                    >
                      Copy Deck Data
                    </button>
                  </div>
                  
                  <p className="text-sm text-gray-600 mt-2">
                    Note: In production, the deck would be encrypted before sharing. For development, we share it in plain text.
                  </p>
                </div>
              )}
            </div>
          )}

          {createMode === 'import' && (
            <div className="space-y-4">
              <div>
                <label className="block mb-2">1. Auth Entry XDR from Player 1</label>
                <textarea
                  value={importAuthEntryXDR}
                  onChange={(e) => setImportAuthEntryXDR(e.target.value)}
                  className="w-full p-2 border rounded font-mono text-xs"
                  rows={3}
                  placeholder="Paste auth entry XDR here..."
                />
              </div>
              <div>
                <label className="block mb-2">2. Deck Data from Player 1</label>
                <textarea
                  value={importDeckData}
                  onChange={(e) => setImportDeckData(e.target.value)}
                  className="w-full p-2 border rounded font-mono text-xs"
                  rows={2}
                  placeholder="Paste deck data here..."
                />
              </div>
              <div>
                <label className="block mb-2">Your Points (Player 2)</label>
                <input
                  type="text"
                  value={importPlayer2Points}
                  onChange={(e) => setImportPlayer2Points(e.target.value)}
                  className="w-full p-2 border rounded"
                />
              </div>
              <button
                onClick={handleImportAndStart}
                disabled={loading || !importAuthEntryXDR || !importDeckData}
                className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 disabled:opacity-50"
              >
                {loading ? 'Starting...' : 'Import and Start Game'}
              </button>
            </div>
          )}
        </div>
      )}

      {gamePhase === 'playing' && gameState && (
        <div className="space-y-6">
          {loading && (
            <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded mb-4">
              ⏳ Processing transaction... Please wait for blockchain confirmation.
            </div>
          )}
          
          <div className="bg-gray-100 p-4 rounded">
            <div className="grid grid-cols-2 gap-4">
              <div className={gameState.current_turn === gameState.player1 ? 'font-bold text-blue-600' : ''}>
                <p className="font-bold">Player 1 Score: {gameState.score1}</p>
                <p className="text-sm text-gray-600">{gameState.player1.slice(0, 8)}...</p>
                {gameState.current_turn === gameState.player1 && <p className="text-xs text-blue-600">← Current Turn</p>}
              </div>
              <div className={gameState.current_turn === gameState.player2 ? 'font-bold text-blue-600' : ''}>
                <p className="font-bold">Player 2 Score: {gameState.score2}</p>
                <p className="text-sm text-gray-600">{gameState.player2.slice(0, 8)}...</p>
                {gameState.current_turn === gameState.player2 && <p className="text-xs text-blue-600">← Current Turn</p>}
              </div>
            </div>
            <div className="mt-4">
              <p className="font-bold">
                {gameState.current_turn === userAddress ? '🎮 Your Turn!' : '⏳ Opponent\'s Turn'}
              </p>
              <p className="text-sm">Pairs Found: {gameState.pairs_found} / 2</p>
              {gameState.flip_one !== undefined && gameState.flip_one !== null && (
                <p className="text-sm text-yellow-600 mt-2">
                  First card flipped at position {gameState.flip_one} (value: {gameState.flip_one_value})
                </p>
              )}
              <div className="mt-2 text-xs text-gray-500">
                <p>Your address: {userAddress.slice(0, 12)}...</p>
                <p>Current turn: {gameState.current_turn.slice(0, 12)}...</p>
                <p>Match: {userAddress === gameState.current_turn ? 'YES ✓' : 'NO ✗'}</p>
              </div>
            </div>
            <button
              onClick={async () => {
                const game = await zkMemoryService.getGame(sessionId);
                if (game) {
                  setGameState(game);
                  console.log('[Manual Refresh] Game state:', game);
                  setSuccess('Game state refreshed!');
                }
              }}
              className="mt-2 w-full bg-gray-300 text-gray-700 py-1 rounded text-sm"
            >
              🔄 Refresh Game State
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {gameState.cards.map((card, index) => renderCard(index, card))}
          </div>

          <button
            onClick={handleStartNewGame}
            className="w-full bg-gray-500 text-white py-2 rounded hover:bg-gray-600"
          >
            New Game
          </button>
        </div>
      )}

      {gamePhase === 'complete' && gameState && (
        <div className="space-y-6">
          <div className="bg-green-100 p-6 rounded text-center">
            <h2 className="text-2xl font-bold mb-4">Game Complete!</h2>
            <p className="text-xl">
              {gameState.score1 > gameState.score2 
                ? 'Player 1 Wins!' 
                : gameState.score1 < gameState.score2 
                ? 'Player 2 Wins!' 
                : 'It\'s a Tie!'}
            </p>
            <p className="mt-2">Final Score: {gameState.score1} - {gameState.score2}</p>
          </div>

          <button
            onClick={handleStartNewGame}
            className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600"
          >
            Start New Game
          </button>
        </div>
      )}
    </div>
  );
}
