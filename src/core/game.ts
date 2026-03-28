import { Tile, Suit } from './tile';
import { Wall, createWall, drawTile, drawMultipleTiles, getRemainingCount } from './wall';
import { Player, PlayerSeat, createPlayer, addTileToHand, discardTile } from './player';

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

  const nextPlayer = (playerIndex + 1) % 4;

  return {
    ...state,
    players,
    lastDiscard: result.tile,
    lastDiscardPlayer: playerIndex,
    currentPlayer: nextPlayer,
    turnAction: 'draw',
    lastAction: 'discard',
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

  const nextPlayer = (state.currentPlayer + 1) % 4;

  return {
    ...state,
    players,
    lastDiscard: result.tile,
    lastDiscardPlayer: state.currentPlayer,
    currentPlayer: nextPlayer,
    turnAction: 'draw',
    lastAction: 'discard',
  };
}

export function skipAction(state: GameState): GameState {
  // When player passes on chi/peng/gang, continue to next player or normal flow
  return {
    ...state,
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
