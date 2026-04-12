import { Suit, Tile, isSameTile, isNumberSuit } from './tile';
import { Meld } from './player';
import { sortTiles, getTileKey, countTiles, groupBySuit, removeTiles } from '../utils/tileHelper';

export interface WinResult {
  isWin: boolean;
  winType: WinType | null;
  waitingTiles: Tile[];
}

export type WinType =
  | 'tianhu' | 'dihu' | 'dasi_xi' | 'dasanyuan' | 'ziyise'
  | 'qingyise' | 'hunyise' | 'pengpenghu' | 'quanqiuren'
  | 'gangshanghua' | 'gangshangkaihua' | 'zimo' | 'menqing'
  | 'pinghu' | 'haidilaoyue' | 'hediayuyu' | 'qiangganghu'
  | 'standard';

/**
 * Check if tiles can be divided into groups of (AAA or ABC)
 * Assumes tiles are sorted and count is multiple of 3
 */
function canFormGroups(tiles: Tile[]): boolean {
  if (tiles.length === 0) return true;
  if (tiles.length % 3 !== 0) return false;

  const sorted = sortTiles(tiles);
  const first = sorted[0];

  // Option A: Try triplet (AAA)
  let tripletCount = 0;
  for (const t of sorted) {
    if (isSameTile(t, first)) tripletCount++;
  }
  if (tripletCount >= 3) {
    const remaining = removeTiles(sorted, [first, first, first]);
    if (canFormGroups(remaining)) return true;
  }

  // Option B: Try sequence (ABC) - only for number suits
  if (isNumberSuit(first)) {
    const val1 = first.value + 1;
    const val2 = first.value + 2;
    if (val1 <= 9 && val2 <= 9) {
      const tile1 = sorted.find(t => t.suit === first.suit && t.value === val1);
      const tile2 = sorted.find(t => t.suit === first.suit && t.value === val2);
      if (tile1 && tile2) {
        const remaining = removeTiles(sorted, [first, tile1, tile2]);
        if (canFormGroups(remaining)) return true;
      }
    }
  }

  return false;
}

/**
 * Check if hand can win (standard mahjong win)
 * Win = 5 groups (AAA or ABC) + 1 pair (AA) = 17 tiles total
 */
export function checkWin(hand: Tile[], melds: Meld[]): WinResult {
  // Calculate total tiles
  const meldTiles = melds.reduce((sum, m) => sum + m.tiles.length, 0);
  const totalTiles = hand.length + meldTiles;

  // Calculate expected tile count: 17 + number of gang melds (each gang adds 1 tile)
  const gangCount = melds.filter(m => m.tiles.length === 4).length;
  const expectedTiles = 17 + gangCount;

  if (totalTiles !== expectedTiles) {
    console.log(`[DEBUG checkWin] hand=${hand.length} meldTiles=${meldTiles} total=${totalTiles} expected=${expectedTiles} (gangs=${gangCount}) → skip`);
    return { isWin: false, winType: null, waitingTiles: [] };
  }

  // Try each possible pair as the eye
  const sorted = sortTiles(hand);
  const pairs: Tile[][] = [];
  const usedPairs = new Set<string>();

  for (let i = 0; i < sorted.length - 1; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      if (isSameTile(sorted[i], sorted[j])) {
        const key = getTileKey(sorted[i]);
        if (!usedPairs.has(key)) {
          usedPairs.add(key);
          pairs.push([sorted[i], sorted[j]]);
        }
        break;
      }
    }
  }

  // Try each pair as eye
  for (const pair of pairs) {
    const remaining = removeTiles(hand, pair);
    if (canFormGroups(remaining)) {
      return { isWin: true, winType: 'standard', waitingTiles: [] };
    }
  }

  return { isWin: false, winType: null, waitingTiles: [] };
}

/**
 * Check if tile is an honor tile (feng or jian)
 */
function isHonorTile(tile: Tile): boolean {
  return tile.suit === Suit.FENG || tile.suit === Suit.JIAN;
}

/**
 * Check if all tiles are honor tiles
 */
function allHonorTiles(tiles: Tile[]): boolean {
  return tiles.every(isHonorTile);
}

/**
 * Check if all tiles are the same number suit
 */
function allSameSuit(tiles: Tile[]): boolean {
  if (tiles.length === 0) return false;
  const suit = tiles[0].suit;
  return tiles.every(t => t.suit === suit);
}

/**
 * Check if tiles contain only one number suit (may have honors)
 */
function oneNumberSuitWithHonors(tiles: Tile[]): boolean {
  const numberSuits = new Set<Suit>();
  for (const t of tiles) {
    if (isNumberSuit(t)) {
      numberSuits.add(t.suit);
    }
  }
  return numberSuits.size === 1;
}

/**
 * Check if meld is a triplet (peng or angang)
 */
function isTripletMeld(meld: Meld): boolean {
  return meld.type === 'peng' || meld.type === 'angang';
}

/**
 * Check if meld is a sequence (chi)
 */
function isSequenceMeld(meld: Meld): boolean {
  return meld.type === 'chi';
}

/**
 * Check if meld contains only honor tiles
 */
function isHonorMeld(meld: Meld): boolean {
  return meld.tiles.every(isHonorTile);
}

/**
 * Check if meld is a wind triplet
 */
function isWindTriplet(meld: Meld): boolean {
  return meld.tiles.length >= 3 && meld.tiles.every(t => t.suit === Suit.FENG);
}

/**
 * Check if meld is a jian triplet (中發白)
 */
function isJianTriplet(meld: Meld): boolean {
  return meld.tiles.length >= 3 && meld.tiles.every(t => t.suit === Suit.JIAN);
}

/**
 * Determine the special win type
 * Checks in priority order (highest first)
 */
export function getWinType(hand: Tile[], melds: Meld[]): WinType | null {
  const allTiles = [...hand, ...melds.flatMap(m => m.tiles)];

  // 大四喜: 4 melds are all wind triplets
  const windTriplets = melds.filter(isWindTriplet);
  if (windTriplets.length >= 4) {
    return 'dasi_xi';
  }

  // 大三元: 3 melds are jian triplets
  const jianTriplets = melds.filter(isJianTriplet);
  if (jianTriplets.length >= 3) {
    return 'dasanyuan';
  }

  // 字一色: All tiles are honors
  if (allHonorTiles(allTiles)) {
    return 'ziyise';
  }

  // 清一色: All tiles same number suit
  if (allSameSuit(allTiles) && isNumberSuit(allTiles[0])) {
    return 'qingyise';
  }

  // 混一色: One number suit + honors
  if (oneNumberSuitWithHonors(allTiles) && !allSameSuit(allTiles)) {
    const hasHonors = allTiles.some(isHonorTile);
    if (hasHonors) {
      return 'hunyise';
    }
  }

  // 碰碰胡: All melds are triplets/quads, no sequences
  const hasSequence = melds.some(isSequenceMeld);
  if (!hasSequence && melds.length > 0) {
    // Check if hand can form only triplets + pair
    const sorted = sortTiles(hand);
    let canBePengPeng = false;
    for (let i = 0; i < sorted.length - 1; i++) {
      if (isSameTile(sorted[i], sorted[i + 1])) {
        const pair = [sorted[i], sorted[i + 1]];
        const remaining = removeTiles(hand, pair);
        // Remaining should be all triplets
        const counts = countTiles(remaining);
        let allTriplets = true;
        for (const count of counts.values()) {
          if (count !== 3) {
            allTriplets = false;
            break;
          }
        }
        if (allTriplets) {
          canBePengPeng = true;
          break;
        }
      }
    }
    if (canBePengPeng) {
      return 'pengpenghu';
    }
  }

  // 全求人: All melds from others, hand has only 1 tile
  if (hand.length === 1 && melds.length > 0) {
    const allFromOthers = melds.every(m => m.source !== 'self');
    if (allFromOthers) {
      return 'quanqiuren';
    }
  }

  // 平胡: All sequences, no triplets, no honors
  if (melds.length > 0) {
    const allSequences = melds.every(isSequenceMeld);
    const noHonors = !allTiles.some(isHonorTile);
    if (allSequences && noHonors) {
      return 'pinghu';
    }
  }

  // 門清: No melds (all concealed)
  if (melds.length === 0) {
    return 'menqing';
  }

  return 'standard';
}

/**
 * Get all tiles that would complete the hand (for hints)
 * Hand should have 15 tiles, adding one tile makes 16 for check
 */
export function getWaitingTiles(hand: Tile[], melds: Meld[]): Tile[] {
  if (hand.length !== 15) {
    return [];
  }

  const waitingTiles: Tile[] = [];
  const meldTiles = melds.reduce((sum, m) => sum + m.tiles.length, 0);

  // Generate all possible tiles (136 tiles in mahjong)
  const allPossibleTiles: Tile[] = [];

  // Number suits: 1-9 for wan, tiao, tong (4 of each)
  for (const suit of [Suit.WAN, Suit.TIAO, Suit.TONG]) {
    for (let value = 1; value <= 9; value++) {
      for (let i = 0; i < 4; i++) {
        allPossibleTiles.push({ id: `${suit}-${value}-${i}`, suit, value });
      }
    }
  }

  // Feng: 1-4 (東南西北)
  for (let value = 1; value <= 4; value++) {
    for (let i = 0; i < 4; i++) {
      allPossibleTiles.push({ id: `feng-${value}-${i}`, suit: Suit.FENG, value });
    }
  }

  // Jian: 1-3 (中發白)
  for (let value = 1; value <= 3; value++) {
    for (let i = 0; i < 4; i++) {
      allPossibleTiles.push({ id: `jian-${value}-${i}`, suit: Suit.JIAN, value });
    }
  }

  // Check each possible tile
  const checkedKeys = new Set<string>();
  for (const tile of allPossibleTiles) {
    const key = getTileKey(tile);
    if (checkedKeys.has(key)) continue;
    checkedKeys.add(key);

    // Count how many of this tile are already in hand + melds
    const handCount = hand.filter(t => isSameTile(t, tile)).length;
    const meldCount = melds.flatMap(m => m.tiles).filter(t => isSameTile(t, tile)).length;
    const totalCount = handCount + meldCount;

    // Can't have more than 4 of any tile
    if (totalCount >= 4) continue;

    // Try adding this tile
    const testHand = [...hand, tile];
    const result = checkWin(testHand, melds);
    if (result.isWin) {
      waitingTiles.push(tile);
    }
  }

  return waitingTiles;
}

/**
 * Check if hand is one tile away from winning (聽牌)
 * Hand should have 15 tiles
 */
export function isReady(hand: Tile[], melds: Meld[]): boolean {
  return getWaitingTiles(hand, melds).length > 0;
}

/**
 * Check if player can win by claiming a discarded tile
 * Total tiles (hand + melds) must be 16, adding the discard makes 17
 *
 * @param hand - Player's current hand
 * @param melds - Player's current melds
 * @param discard - The tile that was discarded
 * @returns true if claiming this discard results in a winning hand
 */
export function canWinByClaimingDiscard(hand: Tile[], melds: Meld[], discard: Tile): boolean {
  const meldTiles = melds.reduce((sum, m) => sum + m.tiles.length, 0);
  const totalTiles = hand.length + meldTiles;
  if (totalTiles !== 16) return false;
  const testHand = [...hand, discard];
  const result = checkWin(testHand, melds);
  return result.isWin;
}
