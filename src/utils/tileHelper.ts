import { Suit, Tile, compareTiles, isSameTile, isNumberSuit } from '../core/tile';

/**
 * Sort tiles by suit then value using compareTiles
 */
export function sortTiles(tiles: Tile[]): Tile[] {
  return [...tiles].sort(compareTiles);
}

/**
 * Get unique key for a tile: `${suit}-${value}`
 */
export function getTileKey(tile: Tile): string {
  return `${tile.suit}-${tile.value}`;
}

/**
 * Count occurrences of each tile by key
 */
export function countTiles(tiles: Tile[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const tile of tiles) {
    const key = getTileKey(tile);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/**
 * Group tiles by suit
 */
export function groupBySuit(tiles: Tile[]): Record<Suit, Tile[]> {
  const groups: Record<Suit, Tile[]> = {
    [Suit.WAN]: [],
    [Suit.TIAO]: [],
    [Suit.TONG]: [],
    [Suit.FENG]: [],
    [Suit.JIAN]: [],
    [Suit.FLOWER]: [],
  };
  for (const tile of tiles) {
    groups[tile.suit].push(tile);
  }
  // Sort each group by value
  for (const suit of Object.keys(groups) as Suit[]) {
    groups[suit].sort((a, b) => a.value - b.value);
  }
  return groups;
}

/**
 * Find all pairs (AA) in tiles
 */
export function findPairs(tiles: Tile[]): Tile[][] {
  const pairs: Tile[][] = [];
  const sorted = sortTiles(tiles);
  const used = new Set<number>();

  for (let i = 0; i < sorted.length - 1; i++) {
    if (used.has(i)) continue;
    for (let j = i + 1; j < sorted.length; j++) {
      if (used.has(j)) continue;
      if (isSameTile(sorted[i], sorted[j])) {
        pairs.push([sorted[i], sorted[j]]);
        used.add(i);
        used.add(j);
        break;
      }
    }
  }
  return pairs;
}

/**
 * Find all triplets (AAA) in tiles
 */
export function findTriplets(tiles: Tile[]): Tile[][] {
  const triplets: Tile[][] = [];
  const sorted = sortTiles(tiles);
  const used = new Set<number>();

  for (let i = 0; i < sorted.length - 2; i++) {
    if (used.has(i)) continue;
    for (let j = i + 1; j < sorted.length - 1; j++) {
      if (used.has(j)) continue;
      if (!isSameTile(sorted[i], sorted[j])) continue;
      for (let k = j + 1; k < sorted.length; k++) {
        if (used.has(k)) continue;
        if (isSameTile(sorted[i], sorted[k])) {
          triplets.push([sorted[i], sorted[j], sorted[k]]);
          used.add(i);
          used.add(j);
          used.add(k);
          break;
        }
      }
    }
  }
  return triplets;
}

/**
 * Check if 3 tiles form a valid sequence (same suit, consecutive values)
 * Only valid for number suits (wan/tiao/tong)
 */
export function canFormSequence(t1: Tile, t2: Tile, t3: Tile): boolean {
  // Must all be number suits
  if (!isNumberSuit(t1) || !isNumberSuit(t2) || !isNumberSuit(t3)) {
    return false;
  }
  // Must be same suit
  if (t1.suit !== t2.suit || t2.suit !== t3.suit) {
    return false;
  }
  // Sort by value and check consecutive
  const values = [t1.value, t2.value, t3.value].sort((a, b) => a - b);
  return values[1] === values[0] + 1 && values[2] === values[1] + 1;
}

/**
 * Find all sequences (ABC) in tiles — number suits only
 */
export function findSequences(tiles: Tile[]): Tile[][] {
  const sequences: Tile[][] = [];
  const groups = groupBySuit(tiles);
  const numberSuits = [Suit.WAN, Suit.TIAO, Suit.TONG];

  for (const suit of numberSuits) {
    const suitTiles = groups[suit];
    if (suitTiles.length < 3) continue;

    const used = new Set<number>();
    for (let i = 0; i < suitTiles.length - 2; i++) {
      if (used.has(i)) continue;
      for (let j = i + 1; j < suitTiles.length - 1; j++) {
        if (used.has(j)) continue;
        for (let k = j + 1; k < suitTiles.length; k++) {
          if (used.has(k)) continue;
          if (canFormSequence(suitTiles[i], suitTiles[j], suitTiles[k])) {
            sequences.push([suitTiles[i], suitTiles[j], suitTiles[k]]);
            used.add(i);
            used.add(j);
            used.add(k);
            break;
          }
        }
      }
    }
  }
  return sequences;
}

/**
 * Remove specific tiles from source array
 * Removes first occurrence of each tile in toRemove
 */
export function removeTiles(source: Tile[], toRemove: Tile[]): Tile[] {
  const result = [...source];
  const removed = new Set<number>();

  for (const target of toRemove) {
    for (let i = 0; i < result.length; i++) {
      if (removed.has(i)) continue;
      if (isSameTile(result[i], target)) {
        removed.add(i);
        break;
      }
    }
  }

  return result.filter((_, i) => !removed.has(i));
}

/**
 * Find tiles that improve hand (reduce shanten)
 * Returns tiles from remainingDeck that would be useful additions
 * 
 * Note: Full shanten calculation is complex. This is a simplified version
 * that identifies tiles forming new pairs, triplets, or sequences with existing hand.
 */
export function getEffectiveTiles(hand: Tile[], remainingDeck: Tile[]): Tile[] {
  const effective: Tile[] = [];
  const deckCounts = countTiles(remainingDeck);
  const handCounts = countTiles(hand);
  const checked = new Set<string>();

  for (const deckTile of remainingDeck) {
    const key = getTileKey(deckTile);
    if (checked.has(key)) continue;
    checked.add(key);

    // Check if this tile forms a pair with hand
    if (handCounts.has(key)) {
      effective.push(deckTile);
      continue;
    }

    // Check if this tile completes a sequence with hand (number suits only)
    if (isNumberSuit(deckTile)) {
      const suit = deckTile.suit;
      const val = deckTile.value;

      // Check for potential sequences: X?Z (gap), XY? (end), ?YZ (start)
      const hasValMinus1 = hand.some(t => t.suit === suit && t.value === val - 1);
      const hasValMinus2 = hand.some(t => t.suit === suit && t.value === val - 2);
      const hasValPlus1 = hand.some(t => t.suit === suit && t.value === val + 1);
      const hasValPlus2 = hand.some(t => t.suit === suit && t.value === val + 2);

      // XY? pattern: need val-2 and val-1
      if (hasValMinus1 && hasValMinus2) {
        effective.push(deckTile);
        continue;
      }
      // ?YZ pattern: need val+1 and val+2
      if (hasValPlus1 && hasValPlus2) {
        effective.push(deckTile);
        continue;
      }
      // X?Z pattern: need val-1 and val+1
      if (hasValMinus1 && hasValPlus1) {
        effective.push(deckTile);
        continue;
      }
      // XY pattern (two consecutive with this completing): need val-1 only
      if (hasValMinus1 && val <= 9) {
        effective.push(deckTile);
        continue;
      }
      // YZ pattern: need val+1 only
      if (hasValPlus1 && val >= 1) {
        effective.push(deckTile);
        continue;
      }
    }
  }

  return sortTiles(effective);
}
