import { Tile, Suit, isSameTile } from '../core/tile';
import { GameState } from '../core/game';
import { getTileKey, countTiles } from '../utils/tileHelper';

/**
 * Shanten for 17-tile hand: 5 melds + 1 pair = win.
 * Formula: shanten = 10 - 2×complete - incomplete (pair found)
 *          shanten = 10 - 2×complete - incomplete - 1 (no pair)
 */
export function calculateShanten(tiles: Tile[]): number {
  if (tiles.length === 0) return 0;

  const tileCounts = countTiles(tiles);
  const sortedKeys = Array.from(tileCounts.keys()).sort();

  let bestScore = -1;

  function search(
    counts: Map<string, number>,
    keys: string[],
    keyIdx: number,
    complete: number,
    incomplete: number,
    hasPair: boolean
  ): void {
    let idx = keyIdx;
    while (idx < keys.length && (counts.get(keys[idx]) ?? 0) === 0) {
      idx++;
    }

    if (idx >= keys.length) {
      const score = 2 * complete + incomplete + (hasPair ? 1 : 0);
      if (score > bestScore) bestScore = score;
      return;
    }

    const key = keys[idx];
    const [suit, valueStr] = key.split('-');
    const value = parseInt(valueStr);
    const count = counts.get(key)!;

    if (count >= 3) {
      counts.set(key, count - 3);
      search(counts, keys, idx, complete + 1, incomplete, hasPair);
      counts.set(key, count);
    }

    if (suit !== 'feng' && suit !== 'jian' && value <= 7) {
      const key2 = `${suit}-${value + 1}`;
      const key3 = `${suit}-${value + 2}`;
      const c2 = counts.get(key2) ?? 0;
      const c3 = counts.get(key3) ?? 0;
      if (c2 > 0 && c3 > 0) {
        counts.set(key, count - 1);
        counts.set(key2, c2 - 1);
        counts.set(key3, c3 - 1);
        search(counts, keys, idx, complete + 1, incomplete, hasPair);
        counts.set(key, count);
        counts.set(key2, c2);
        counts.set(key3, c3);
      }
    }

    if (count >= 2 && !hasPair) {
      counts.set(key, count - 2);
      search(counts, keys, idx, complete, incomplete + 1, true);
      counts.set(key, count);
    }

    counts.set(key, 0);
    search(counts, keys, idx + 1, complete, incomplete, hasPair);
    counts.set(key, count);
  }

  search(tileCounts, sortedKeys, 0, 0, 0, false);

  if (bestScore < 0) return 8;
  return 10 - bestScore;
}

export interface TileEvaluation {
  tile: Tile;
  shanten: number;
  improvementCount: number;
  efficiency: number;
  dangerLevel: number;
}

export function getImprovementCount(hand: Tile[], remainingDeck: Tile[]): number {
  const currentShanten = calculateShanten(hand);
  const checkedKeys = new Set<string>();
  let count = 0;

  for (const tile of remainingDeck) {
    const key = getTileKey(tile);
    if (checkedKeys.has(key)) continue;
    checkedKeys.add(key);

    const inHand = hand.filter(t => isSameTile(t, tile)).length;
    if (inHand >= 4) continue;

    const testHand = [...hand, tile];
    if (calculateShanten(testHand) < currentShanten) {
      count++;
    }
  }

  return count;
}

export function evaluateDiscards(
  hand: Tile[],
  remainingDeck: Tile[]
): TileEvaluation[] {
  const evaluations: TileEvaluation[] = [];

  for (let i = 0; i < hand.length; i++) {
    const tile = hand[i];
    const testHand = hand.filter((_, idx) => idx !== i);
    const newShanten = calculateShanten(testHand);
    const improvements = getImprovementCount(testHand, remainingDeck);

    evaluations.push({
      tile,
      shanten: newShanten,
      improvementCount: improvements,
      efficiency: improvements,
      dangerLevel: 0,
    });
  }

  evaluations.sort((a, b) => {
    if (a.shanten !== b.shanten) return b.shanten - a.shanten;
    return b.improvementCount - a.improvementCount;
  });

  return evaluations;
}

export interface DangerAssessment {
  tile: Tile;
  danger: number;
  reason: string;
}

export function calculateTileDanger(
  tile: Tile,
  gameState: GameState,
  _playerIndex: number
): number {
  let danger = 0;

  if (tile.suit === Suit.JIAN) {
    danger += 4;
  } else if (tile.suit === Suit.FENG) {
    danger += 3;
  } else if (tile.value === 1 || tile.value === 9) {
    danger += 2;
  } else if (tile.value === 2 || tile.value === 8) {
    danger += 1;
  }

  let discardedCount = 0;
  for (const player of gameState.players) {
    for (const d of player.discards) {
      if (isSameTile(d, tile)) discardedCount++;
    }
  }

  let meldCount = 0;
  for (const player of gameState.players) {
    for (const meld of player.melds) {
      for (const t of meld.tiles) {
        if (isSameTile(t, tile)) meldCount++;
      }
    }
  }

  const totalVisible = discardedCount + meldCount;

  if (totalVisible >= 3) {
    danger = Math.max(0, danger - 4);
  } else if (totalVisible >= 2) {
    danger = Math.max(0, danger - 2);
  } else if (totalVisible >= 1) {
    danger = Math.max(0, danger - 1);
  }

  return danger;
}

export function assessDanger(
  hand: Tile[],
  gameState: GameState,
  playerIndex: number
): DangerAssessment[] {
  return hand.map(tile => ({
    tile,
    danger: calculateTileDanger(tile, gameState, playerIndex),
    reason: getDangerReason(tile, gameState),
  }));
}

function getDangerReason(tile: Tile, gameState: GameState): string {
  if (tile.suit === Suit.JIAN) return '三元牌';
  if (tile.suit === Suit.FENG) return '風牌';

  let discardedCount = 0;
  for (const player of gameState.players) {
    for (const d of player.discards) {
      if (isSameTile(d, tile)) discardedCount++;
    }
  }
  if (discardedCount === 0) return '未出現';
  if (discardedCount >= 3) return '已安全';
  return '';
}

export interface HandStructure {
  pairs: Tile[][];
  potentialTriplets: Tile[][];
  potentialSequences: Tile[][];
  isolatedTiles: Tile[];
  honorTiles: Tile[];
}

export function analyzeHandStructure(hand: Tile[]): HandStructure {
  const counts = countTiles(hand);
  const pairs: Tile[][] = [];
  const potentialTriplets: Tile[][] = [];
  const potentialSequences: Tile[][] = [];
  const isolatedTiles: Tile[] = [];
  const honorTiles: Tile[] = [];

  const processedKeys = new Set<string>();
  for (const [key, count] of counts) {
    if (processedKeys.has(key)) continue;
    processedKeys.add(key);

    const tiles = hand.filter(t => getTileKey(t) === key);
    if (count >= 3) {
      potentialTriplets.push(tiles.slice(0, 3));
    } else if (count === 2) {
      pairs.push(tiles);
    }
  }

  const numberSuits = [Suit.WAN, Suit.TIAO, Suit.TONG];
  for (const suit of numberSuits) {
    const suitTiles = hand.filter(t => t.suit === suit);
    const suitCounts = countTiles(suitTiles);

    for (let v = 1; v <= 7; v++) {
      const hasV = (suitCounts.get(`${suit}-${v}`) ?? 0) > 0;
      const hasV1 = (suitCounts.get(`${suit}-${v + 1}`) ?? 0) > 0;
      const hasV2 = (suitCounts.get(`${suit}-${v + 2}`) ?? 0) > 0;

      if (hasV && hasV1 && hasV2) {
        const seq = [
          suitTiles.find(t => t.value === v)!,
          suitTiles.find(t => t.value === v + 1)!,
          suitTiles.find(t => t.value === v + 2)!,
        ];
        potentialSequences.push(seq);
      }
    }
  }

  for (const tile of hand) {
    const key = getTileKey(tile);
    if ((counts.get(key) ?? 0) === 1) {
      if (tile.suit === Suit.FENG || tile.suit === Suit.JIAN) {
        honorTiles.push(tile);
      } else {
        const isConnected = hand.some(
          t =>
            t.id !== tile.id &&
            t.suit === tile.suit &&
            Math.abs(t.value - tile.value) <= 2
        );
        if (!isConnected) {
          isolatedTiles.push(tile);
        }
      }
    }
  }

  return { pairs, potentialTriplets, potentialSequences, isolatedTiles, honorTiles };
}

export function estimateRemainingUseful(hand: Tile[], gameState: GameState): number {
  const remaining = getRemainingDeckEstimate(gameState);
  const currentShanten = calculateShanten(hand);
  let useful = 0;

  const checkedKeys = new Set<string>();
  for (const tile of remaining) {
    const key = getTileKey(tile);
    if (checkedKeys.has(key)) continue;
    checkedKeys.add(key);

    const testHand = [...hand, tile];
    if (calculateShanten(testHand) < currentShanten) {
      useful += remaining.filter(t => isSameTile(t, tile)).length;
    }
  }

  return useful;
}

function getRemainingDeckEstimate(gameState: GameState): Tile[] {
  const allKnownTiles: Tile[] = [];

  for (const player of gameState.players) {
    allKnownTiles.push(...player.hand);
    allKnownTiles.push(...player.discards);
    for (const meld of player.melds) {
      allKnownTiles.push(...meld.tiles);
    }
  }

  const fullDeck = generateFullDeck();
  const remaining = [...fullDeck];
  for (const known of allKnownTiles) {
    const idx = remaining.findIndex(t => isSameTile(t, known));
    if (idx !== -1) {
      remaining.splice(idx, 1);
    }
  }

  return remaining;
}

function generateFullDeck(): Tile[] {
  const deck: Tile[] = [];

  for (const suit of [Suit.WAN, Suit.TIAO, Suit.TONG]) {
    for (let value = 1; value <= 9; value++) {
      for (let i = 0; i < 4; i++) {
        deck.push({ id: `${suit}-${value}-${i}`, suit, value });
      }
    }
  }

  for (let value = 1; value <= 4; value++) {
    for (let i = 0; i < 4; i++) {
      deck.push({ id: `feng-${value}-${i}`, suit: Suit.FENG, value });
    }
  }

  for (let value = 1; value <= 3; value++) {
    for (let i = 0; i < 4; i++) {
      deck.push({ id: `jian-${value}-${i}`, suit: Suit.JIAN, value });
    }
  }

  return deck;
}
