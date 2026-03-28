import { Tile, compareTiles } from './tile';

export type PlayerSeat = 'east' | 'south' | 'west' | 'north';

export type MeldType = 'chi' | 'peng' | 'gang' | 'angang';

export interface Meld {
  type: MeldType;
  tiles: Tile[];
  source: 'self' | Tile;
}

export interface Player {
  id: PlayerSeat;
  hand: Tile[];
  melds: Meld[];
  discards: Tile[];
  isHuman: boolean;
  score: number;
}

export function createPlayer(id: PlayerSeat, isHuman: boolean = false): Player {
  return {
    id,
    hand: [],
    melds: [],
    discards: [],
    isHuman,
    score: 0,
  };
}

export function sortHand(hand: Tile[]): Tile[] {
  return [...hand].sort(compareTiles);
}

export function addTileToHand(player: Player, tile: Tile): Player {
  return {
    ...player,
    hand: sortHand([...player.hand, tile]),
  };
}

export function removeTileFromHand(player: Player, tileId: string): Player {
  const index = player.hand.findIndex((t) => t.id === tileId);
  if (index === -1) return player;

  const newHand = [...player.hand];
  newHand.splice(index, 1);

  return {
    ...player,
    hand: newHand,
  };
}

export function discardTile(player: Player, tileId: string): { player: Player; tile: Tile | null } {
  const tile = player.hand.find((t) => t.id === tileId);
  if (!tile) return { player, tile: null };

  return {
    player: {
      ...removeTileFromHand(player, tileId),
      discards: [...player.discards, tile],
    },
    tile,
  };
}

export function addMeld(player: Player, meld: Meld): Player {
  return {
    ...player,
    melds: [...player.melds, meld],
  };
}

export function getPlayerTileCount(player: Player): number {
  return player.hand.length + player.melds.reduce((sum, m) => sum + m.tiles.length, 0);
}

export function isReady(player: Player): boolean {
  return getPlayerTileCount(player) === 17 || getPlayerTileCount(player) === 16;
}
