import { Suit, Tile, isSameTile, isNumberSuit } from './tile';
import { Player, Meld } from './player';
import { countTiles, getTileKey } from '../utils/tileHelper';

/**
 * Represents an available meld action with specific tiles
 */
export interface MeldAction {
  type: 'chi' | 'peng' | 'gang' | 'angang' | 'hu';
  tiles: Tile[];  // Tiles from hand to form the meld (plus the discard for chi/peng/gang)
  meld: Meld;     // The resulting meld
}

/**
 * Check if player can chi (eat) the discard tile
 * Chi: Form a sequence (ABC) using the discard
 * Only valid for number suits
 *
 * @param player - The player attempting to chi
 * @param discard - The tile that was discarded
 * @param discarderSeat - Seat position of the player who discarded
 * @param playerSeat - Seat position of the player attempting to chi
 */
export function canChi(
  player: Player,
  discard: Tile,
  discarderSeat: 'east' | 'south' | 'west' | 'north',
  playerSeat: 'east' | 'south' | 'west' | 'north'
): boolean {
  // Chi only allowed from the player on the left (previous player in turn order)
  const seats: ('east' | 'south' | 'west' | 'north')[] = ['east', 'south', 'west', 'north'];
  const discarderIndex = seats.indexOf(discarderSeat);
  const playerIndex = seats.indexOf(playerSeat);
  const leftNeighborIndex = (playerIndex + 3) % 4; // Previous player

  if (discarderIndex !== leftNeighborIndex) {
    return false;
  }

  // Only number suits can be chi'd
  if (!isNumberSuit(discard)) {
    return false;
  }

  // Check all possible sequences
  const handCounts = countTiles(player.hand);

  // Pattern 1: X + discard + Z (e.g., 4 + 5 + 6)
  const valPlus1 = discard.value + 1;
  const valPlus2 = discard.value + 2;
  if (valPlus1 <= 9 && valPlus2 <= 9) {
    const key1 = getTileKey({ id: '', suit: discard.suit, value: valPlus1 });
    const key2 = getTileKey({ id: '', suit: discard.suit, value: valPlus2 });
    if ((handCounts.get(key1) ?? 0) >= 1 && (handCounts.get(key2) ?? 0) >= 1) {
      return true;
    }
  }

  // Pattern 2: X + Y + discard (e.g., 3 + 4 + 5)
  const valMinus1 = discard.value - 1;
  const valMinus2 = discard.value - 2;
  if (valMinus1 >= 1 && valMinus2 >= 1) {
    const key1 = getTileKey({ id: '', suit: discard.suit, value: valMinus2 });
    const key2 = getTileKey({ id: '', suit: discard.suit, value: valMinus1 });
    if ((handCounts.get(key1) ?? 0) >= 1 && (handCounts.get(key2) ?? 0) >= 1) {
      return true;
    }
  }

  // Pattern 3: X + discard + Y (e.g., 4 + 5 + 6, middle position)
  if (valMinus1 >= 1 && valPlus1 <= 9) {
    const key1 = getTileKey({ id: '', suit: discard.suit, value: valMinus1 });
    const key2 = getTileKey({ id: '', suit: discard.suit, value: valPlus1 });
    if ((handCounts.get(key1) ?? 0) >= 1 && (handCounts.get(key2) ?? 0) >= 1) {
      return true;
    }
  }

  return false;
}

/**
 * Get all possible chi combinations for a discard tile
 */
export function getChiOptions(player: Player, discard: Tile): MeldAction[] {
  if (!isNumberSuit(discard)) {
    return [];
  }

  const options: MeldAction[] = [];

  // Helper to find a tile in hand by suit and value
  const findTileInHand = (suit: Suit, value: number): Tile | undefined => {
    return player.hand.find(t => t.suit === suit && t.value === value);
  };

  // Pattern 1: discard as first tile (discard + X + Y)
  const valPlus1 = discard.value + 1;
  const valPlus2 = discard.value + 2;
  if (valPlus1 <= 9 && valPlus2 <= 9) {
    const tile1 = findTileInHand(discard.suit, valPlus1);
    const tile2 = findTileInHand(discard.suit, valPlus2);
    if (tile1 && tile2) {
      options.push({
        type: 'chi',
        tiles: [tile1, tile2],
        meld: {
          type: 'chi',
          tiles: [discard, tile1, tile2],
          source: discard,
        },
      });
    }
  }

  // Pattern 2: discard as last tile (X + Y + discard)
  const valMinus1 = discard.value - 1;
  const valMinus2 = discard.value - 2;
  if (valMinus1 >= 1 && valMinus2 >= 1) {
    const tile1 = findTileInHand(discard.suit, valMinus2);
    const tile2 = findTileInHand(discard.suit, valMinus1);
    if (tile1 && tile2) {
      options.push({
        type: 'chi',
        tiles: [tile1, tile2],
        meld: {
          type: 'chi',
          tiles: [tile1, tile2, discard],
          source: discard,
        },
      });
    }
  }

  // Pattern 3: discard as middle tile (X + discard + Y)
  if (valMinus1 >= 1 && valPlus1 <= 9) {
    const tile1 = findTileInHand(discard.suit, valMinus1);
    const tile2 = findTileInHand(discard.suit, valPlus1);
    if (tile1 && tile2) {
      options.push({
        type: 'chi',
        tiles: [tile1, tile2],
        meld: {
          type: 'chi',
          tiles: [tile1, discard, tile2],
          source: discard,
        },
      });
    }
  }

  return options;
}

/**
 * Check if player can peng (pong) the discard tile
 * Peng: Form a triplet (AAA) using the discard + 2 tiles from hand
 *
 * @param player - The player attempting to peng
 * @param discard - The tile that was discarded
 */
export function canPeng(player: Player, discard: Tile): boolean {
  const key = getTileKey(discard);
  const handCounts = countTiles(player.hand);
  const count = handCounts.get(key) ?? 0;

  return count >= 2;
}

/**
 * Get peng meld action for a discard tile
 */
export function getPengOption(player: Player, discard: Tile): MeldAction | null {
  if (!canPeng(player, discard)) {
    return null;
  }

  // Find the 2 tiles in hand that match the discard
  const matchingTiles: Tile[] = [];
  for (const tile of player.hand) {
    if (isSameTile(tile, discard)) {
      matchingTiles.push(tile);
      if (matchingTiles.length === 2) break;
    }
  }

  return {
    type: 'peng',
    tiles: matchingTiles,
    meld: {
      type: 'peng',
      tiles: [...matchingTiles, discard],
      source: discard,
    },
  };
}

/**
 * Check if player can gang (kong) the discard tile
 * Gang from discard: Form a quad (AAAA) using the discard + 3 tiles from hand
 *
 * @param player - The player attempting to gang
 * @param discard - The tile that was discarded
 */
export function canGang(player: Player, discard: Tile): boolean {
  const key = getTileKey(discard);
  const handCounts = countTiles(player.hand);
  const count = handCounts.get(key) ?? 0;

  return count >= 3;
}

/**
 * Check if player can upgrade a peng to gang (self-draw)
 * When a player already has a peng meld and draws the 4th tile
 *
 * @param player - The player with the peng
 * @param drawnTile - The tile just drawn
 */
export function canUpgradePengToGang(player: Player, drawnTile: Tile): boolean {
  return player.melds.some(
    meld => meld.type === 'peng' && isSameTile(meld.tiles[0], drawnTile)
  );
}

/**
 * Check if player can perform an angang (concealed gang)
 * All 4 tiles are in hand
 *
 * @param player - The player attempting angang
 */
export function canAngang(player: Player): MeldAction[] {
  const handCounts = countTiles(player.hand);
  const angangOptions: MeldAction[] = [];

  for (const [key, count] of handCounts.entries()) {
    if (count === 4) {
      const tiles = player.hand.filter(t => getTileKey(t) === key);
      angangOptions.push({
        type: 'angang',
        tiles: tiles,
        meld: {
          type: 'angang',
          tiles: tiles,
          source: 'self',
        },
      });
    }
  }

  return angangOptions;
}

/**
 * Get gang meld action for a discard tile
 */
export function getGangOption(player: Player, discard: Tile): MeldAction | null {
  if (!canGang(player, discard)) {
    return null;
  }

  // Find the 3 tiles in hand that match the discard
  const matchingTiles: Tile[] = [];
  for (const tile of player.hand) {
    if (isSameTile(tile, discard)) {
      matchingTiles.push(tile);
      if (matchingTiles.length === 3) break;
    }
  }

  return {
    type: 'gang',
    tiles: matchingTiles,
    meld: {
      type: 'gang',
      tiles: [...matchingTiles, discard],
      source: discard,
    },
  };
}

/**
 * Get all available meld actions for a player given a discard
 * Priority: 胡 (hu) > 槓 (gang) > 碰 (peng) > 吃 (chi)
 *
 * @param player - The player checking available actions
 * @param discard - The tile that was discarded
 * @param discarderSeat - Seat position of the player who discarded
 * @param playerSeat - Seat position of the current player
 * @param canWin - Whether the player can win with this discard
 */
export function getAvailableActions(
  player: Player,
  discard: Tile,
  discarderSeat: 'east' | 'south' | 'west' | 'north',
  playerSeat: 'east' | 'south' | 'west' | 'north',
  canWin: boolean = false
): MeldAction[] {
  const actions: MeldAction[] = [];

  // Priority 1: 胡 (Win) - checked externally, add if available
  if (canWin) {
    actions.push({
      type: 'hu',
      tiles: [],
      meld: {
        type: 'chi', // Placeholder, not a real meld
        tiles: [],
        source: discard,
      },
    });
  }

  // Priority 2: 槓 (Gang)
  const gangOption = getGangOption(player, discard);
  if (gangOption) {
    actions.push(gangOption);
  }

  // Priority 3: 碰 (Peng)
  const pengOption = getPengOption(player, discard);
  if (pengOption) {
    actions.push(pengOption);
  }

  // Priority 4: 吃 (Chi) - only from left neighbor
  if (canChi(player, discard, discarderSeat, playerSeat)) {
    const chiOptions = getChiOptions(player, discard);
    actions.push(...chiOptions);
  }

  return actions;
}

/**
 * Check if player has any self-draw meld actions (angang or upgrade peng)
 * Called after a player draws a tile
 */
export function getSelfDrawnActions(player: Player, drawnTile: Tile): MeldAction[] {
  const actions: MeldAction[] = [];

  // Check for angang (concealed gang)
  const angangOptions = canAngang(player);
  actions.push(...angangOptions);

  // Check for upgrade peng to gang
  if (canUpgradePengToGang(player, drawnTile)) {
    const meld = player.melds.find(
      m => m.type === 'peng' && isSameTile(m.tiles[0], drawnTile)
    );
    if (meld) {
      actions.push({
        type: 'gang',
        tiles: [drawnTile],
        meld: {
          type: 'gang',
          tiles: [...meld.tiles, drawnTile],
          source: 'self',
        },
      });
    }
  }

  return actions;
}
