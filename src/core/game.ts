import { Tile, Suit } from './tile';
import { Wall, createWall, drawTile, drawMultipleTiles, getRemainingCount } from './wall';
import { Player, PlayerSeat, createPlayer, addTileToHand, discardTile } from './player';
import { canChi, canPeng } from './meld';
import { canWinByClaimingDiscard } from './win';

export enum GamePhase {
  INIT = 'init',
  DEALING = 'dealing',
  PLAYING = 'playing',
  WAITING = 'waiting',
  GAME_OVER = 'game_over',
}

export type ActionType = 'draw' | 'discard' | 'chi' | 'peng' | 'gang' | 'hu' | 'pass' | 'angang';

export interface GameState {
  phase: GamePhase;
  currentPlayer: number;
  wall: Wall;
  players: Player[];
  lastDiscard: Tile | null;
  lastDiscardPlayer: number | null;
  winner: number | null;
  round: number;
  turnAction: 'draw' | 'discard' | 'waiting';
  wind: PlayerSeat;
  lastAction?: ActionType;
  discardSequence: Tile[];
}

export function createInitialState(): GameState {
  const seats: PlayerSeat[] = ['east', 'south', 'west', 'north'];
  const players = seats.map((seat, index) => createPlayer(seat, index === 0));

  return {
    phase: GamePhase.INIT,
    currentPlayer: 0,
    wall: createWall(),
    players,
    lastDiscard: null,
    lastDiscardPlayer: null,
    winner: null,
    round: 1,
    turnAction: 'draw',
    wind: 'east',
    discardSequence: [],
  };
}

export function startGame(state: GameState): GameState {
  let wall = createWall();
  const players = [...state.players];

  // Reset all players
  for (let i = 0; i < 4; i++) {
    players[i] = {
      ...players[i],
      hand: [],
      melds: [],
      discards: [],
    };
  }

  // Deal: dealer gets 17 tiles (1 + 16), others get 16 tiles
  for (let i = 0; i < 4; i++) {
    const count = i === 0 ? 17 : 16;
    const result = drawMultipleTiles(wall, count);
    players[i] = { ...players[i], hand: result.tiles };
    wall = result.wall;
  }

  return {
    ...state,
    phase: GamePhase.PLAYING,
    currentPlayer: 0,
    wall,
    players,
    lastDiscard: null,
    lastDiscardPlayer: null,
    winner: null,
    turnAction: 'discard',
    wind: 'east',
  };
}

export function playerDrawTile(state: GameState, playerIndex: number): GameState {
  if (state.phase !== GamePhase.PLAYING) return state;
  if (state.currentPlayer !== playerIndex) return state;
  if (state.turnAction !== 'draw') return state;

  const result = drawTile(state.wall);
  if (result.tile === null) {
    return { ...state, phase: GamePhase.GAME_OVER };
  }

  const players = [...state.players];
  players[playerIndex] = addTileToHand(players[playerIndex], result.tile!);

  return {
    ...state,
    wall: result.wall,
    players,
    turnAction: 'discard',
    lastAction: 'draw',
  };
}

export function playerDiscardTile(state: GameState, playerIndex: number, tileId: string): GameState {
  if (state.phase !== GamePhase.PLAYING) return state;
  if (state.currentPlayer !== playerIndex) return state;
  if (state.turnAction !== 'discard') return state;

  const result = discardTile(state.players[playerIndex], tileId);
  if (result.tile === null) return state;

  const players = [...state.players];
  players[playerIndex] = result.player;

  // Set to waiting state - allow other players to claim chi/peng/gang/hu
  // Do NOT advance currentPlayer yet - wait for other players to act
  return {
    ...state,
    players,
    lastDiscard: result.tile,
    lastDiscardPlayer: playerIndex,
    turnAction: 'waiting',
    lastAction: 'discard',
    discardSequence: [...state.discardSequence, result.tile],
  };
}

export function nextTurn(state: GameState): GameState {
  if (state.phase !== GamePhase.PLAYING) return state;
  if (state.turnAction !== 'draw') return state;

  const result = drawTile(state.wall);
  if (result.tile === null) {
    return { ...state, phase: GamePhase.GAME_OVER };
  }

  const players = [...state.players];
  players[state.currentPlayer] = addTileToHand(players[state.currentPlayer], result.tile!);

  return {
    ...state,
    wall: result.wall,
    players,
    turnAction: 'discard',
    lastAction: 'draw',
  };
}

export function aiDiscardTile(state: GameState, tile: Tile): GameState {
  if (state.phase !== GamePhase.PLAYING) return state;
  if (state.turnAction !== 'discard') return state;

  const result = discardTile(state.players[state.currentPlayer], tile.id);
  if (result.tile === null) return state;

  const players = [...state.players];
  players[state.currentPlayer] = result.player;

  const discarderIndex = state.currentPlayer;

  return {
    ...state,
    players,
    lastDiscard: result.tile,
    lastDiscardPlayer: discarderIndex,
    turnAction: 'waiting',
    lastAction: 'discard',
    discardSequence: [...state.discardSequence, result.tile],
  };
}

function canPlayerActOnDiscard(state: GameState, playerIndex: number): boolean {
  if (!state.lastDiscard || state.lastDiscardPlayer === null) return false;
  if (playerIndex === state.lastDiscardPlayer) return false;

  const player = state.players[playerIndex];
  const discard = state.lastDiscard;
  const discarderSeat = state.players[state.lastDiscardPlayer].id;
  const playerSeat = player.id;

  if (canChi(player, discard, discarderSeat, playerSeat)) return true;
  if (canPeng(player, discard)) return true;
  if (canWinByClaimingDiscard(player.hand, player.melds, discard)) return true;

  return false;
}

export function skipAction(state: GameState): GameState {
  const discarderIdx = state.lastDiscardPlayer ?? -1;
  const currentIdx = state.currentPlayer;
  let nextIdx = (currentIdx + 1) % 4;
  let skipped = 0;

  while (skipped < 3) {
    if (nextIdx === discarderIdx) {
      return {
        ...state,
        currentPlayer: (discarderIdx + 1) % 4,
        turnAction: 'draw',
      };
    }
    if (canPlayerActOnDiscard(state, nextIdx)) {
      return {
        ...state,
        currentPlayer: nextIdx,
      };
    }
    nextIdx = (nextIdx + 1) % 4;
    skipped++;
  }

  return {
    ...state,
    currentPlayer: (discarderIdx + 1) % 4,
    turnAction: 'draw',
  };
}

export function getCurrentPlayer(state: GameState): Player {
  return state.players[state.currentPlayer];
}

export function getPlayer(state: GameState, index: number): Player {
  return state.players[index];
}

export function getHumanPlayer(state: GameState): Player | undefined {
  return state.players.find((p) => p.isHuman);
}

export function isGameOver(state: GameState): boolean {
  return state.phase === GamePhase.GAME_OVER || state.winner !== null;
}

export function getRemainingTiles(state: GameState): number {
  return getRemainingCount(state.wall);
}

export function checkWin(state: GameState, playerIndex: number): boolean {
  const player = state.players[playerIndex];
  const handSize = player.hand.length;

  // Standard win: 17 tiles (after drawing)
  // or 16 tiles when someone else discards
  return handSize === 17 || handSize === 16;
}

export function setWinner(state: GameState, winnerIndex: number): GameState {
  return {
    ...state,
    phase: GamePhase.GAME_OVER,
    winner: winnerIndex,
  };
}

/**
 * Remove tiles from player's hand by IDs
 */
function removeTilesFromHandByIds(player: Player, tileIds: string[]): Player {
  let hand = [...player.hand];
  for (const id of tileIds) {
    const idx = hand.findIndex(t => t.id === id);
    if (idx !== -1) {
      hand = [...hand.slice(0, idx), ...hand.slice(idx + 1)];
    }
  }
  return { ...player, hand };
}

/**
 * Player claims chi (eat) - forms a sequence meld
 * Removes tiles from hand, adds meld, discards the claimed tile from discard pile
 * Player must then discard a tile
 */
export function playerChi(
  state: GameState,
  playerIndex: number,
  handTileIds: string[],
  meldTiles: Tile[]
): GameState {
  if (state.phase !== GamePhase.PLAYING) return state;
  if (state.turnAction !== 'waiting') return state;
  if (!state.lastDiscard || state.lastDiscardPlayer === null) return state;

  const players = [...state.players];
  const player = players[playerIndex];

  // Remove tiles from hand
  const updatedPlayer = removeTilesFromHandByIds(player, handTileIds);

  // Add the meld
  const meld = {
    type: 'chi' as const,
    tiles: meldTiles,
    source: state.lastDiscard,
  };
  updatedPlayer.melds = [...updatedPlayer.melds, meld];
  players[playerIndex] = updatedPlayer;

  return {
    ...state,
    players,
    currentPlayer: playerIndex,
    turnAction: 'discard',
    lastDiscard: null,
    lastDiscardPlayer: null,
  };
}

/**
 * Player claims peng (pong) - forms a triplet meld
 * Removes tiles from hand, adds meld
 * Player must then discard a tile
 */
export function playerPeng(
  state: GameState,
  playerIndex: number,
  handTileIds: string[],
  meldTiles: Tile[]
): GameState {
  if (state.phase !== GamePhase.PLAYING) return state;
  if (state.turnAction !== 'waiting') return state;
  if (!state.lastDiscard || state.lastDiscardPlayer === null) return state;

  const players = [...state.players];
  const player = players[playerIndex];

  // Remove tiles from hand
  const updatedPlayer = removeTilesFromHandByIds(player, handTileIds);

  // Add the meld
  const meld = {
    type: 'peng' as const,
    tiles: meldTiles,
    source: state.lastDiscard,
  };
  updatedPlayer.melds = [...updatedPlayer.melds, meld];
  players[playerIndex] = updatedPlayer;

  return {
    ...state,
    players,
    currentPlayer: playerIndex,
    turnAction: 'discard',
    lastDiscard: null,
    lastDiscardPlayer: null,
  };
}
