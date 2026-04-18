import { Tile, Suit, createTile } from './tile';

export function createFullDeck(): Tile[] {
  const deck: Tile[] = [];

  const numberSuits = [Suit.WAN, Suit.TIAO, Suit.TONG];
  for (const suit of numberSuits) {
    for (let value = 1; value <= 9; value++) {
      for (let copy = 0; copy < 4; copy++) {
        deck.push(createTile(suit, value));
      }
    }
  }

  for (let value = 1; value <= 4; value++) {
    for (let copy = 0; copy < 4; copy++) {
      deck.push(createTile(Suit.FENG, value));
    }
  }

  for (let value = 1; value <= 3; value++) {
    for (let copy = 0; copy < 4; copy++) {
      deck.push(createTile(Suit.JIAN, value));
    }
  }

  // Flower tiles: 1 copy each (not 4 copies)
  for (let value = 1; value <= 8; value++) {
    deck.push(createTile(Suit.FLOWER, value));
  }

  return deck;
}

export function shuffleDeck(deck: Tile[]): Tile[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export interface Wall {
  tiles: Tile[];
  position: number;
}

export function createWall(): Wall {
  const deck = createFullDeck();
  return {
    tiles: shuffleDeck(deck),
    position: 0,
  };
}

export function drawTile(wall: Wall): { tile: Tile | null; wall: Wall } {
  if (wall.position >= wall.tiles.length) {
    return { tile: null, wall };
  }

  const tile = wall.tiles[wall.position];
  return {
    tile,
    wall: {
      ...wall,
      position: wall.position + 1,
    },
  };
}

export function drawMultipleTiles(wall: Wall, count: number): { tiles: Tile[]; wall: Wall } {
  const tiles: Tile[] = [];
  let currentWall = wall;

  for (let i = 0; i < count; i++) {
    const result = drawTile(currentWall);
    if (result.tile === null) break;
    tiles.push(result.tile);
    currentWall = result.wall;
  }

  return { tiles, wall: currentWall };
}

export function getRemainingCount(wall: Wall): number {
  return wall.tiles.length - wall.position;
}
