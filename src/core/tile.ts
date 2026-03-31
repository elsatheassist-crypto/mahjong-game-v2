export enum Suit {
  WAN = 'wan',
  TIAO = 'tiao',
  TONG = 'tong',
  FENG = 'feng',
  JIAN = 'jian',
}

export interface Tile {
  id: string;
  suit: Suit;
  value: number;
}

export const TILE_DISPLAY: Record<Suit, Record<number, string>> = {
  [Suit.WAN]: {
    1: '一萬',
    2: '二萬',
    3: '三萬',
    4: '四萬',
    5: '五萬',
    6: '六萬',
    7: '七萬',
    8: '八萬',
    9: '九萬',
  },
  [Suit.TIAO]: {
    1: '一索',
    2: '二索',
    3: '三索',
    4: '四索',
    5: '五索',
    6: '六索',
    7: '七索',
    8: '八索',
    9: '九索',
  },
  [Suit.TONG]: {
    1: '一筒',
    2: '二筒',
    3: '三筒',
    4: '四筒',
    5: '五筒',
    6: '六筒',
    7: '七筒',
    8: '八筒',
    9: '九筒',
  },
  [Suit.FENG]: {
    1: '東',
    2: '南',
    3: '西',
    4: '北',
  },
  [Suit.JIAN]: {
    1: '中',
    2: '發',
    3: '白',
  },
};

export const TILE_UNICODE: Record<Suit, Record<number, string>> = {
  [Suit.WAN]: {
    1: '🀇',
    2: '🀈',
    3: '🀉',
    4: '🀊',
    5: '🀋',
    6: '🀌',
    7: '🀍',
    8: '🀎',
    9: '🀏',
  },
  [Suit.TIAO]: {
    1: '🀐',
    2: '🀑',
    3: '🀒',
    4: '🀓',
    5: '🀔',
    6: '🀕',
    7: '🀖',
    8: '🀗',
    9: '🀘',
  },
  [Suit.TONG]: {
    1: '🀙',
    2: '🀚',
    3: '🀛',
    4: '🀜',
    5: '🀝',
    6: '🀞',
    7: '🀟',
    8: '🀠',
    9: '🀡',
  },
  [Suit.FENG]: {
    1: '🀀',
    2: '🀁',
    3: '🀂',
    4: '🀃',
  },
  [Suit.JIAN]: {
    1: '\uD83C\uDC04\uFE0E',
    2: '\uD83C\uDC05\uFE0E',
    3: '\uD83C\uDC06\uFE0E',
  },
};

export function createTile(suit: Suit, value: number): Tile {
  // Use crypto.randomUUID for truly unique IDs
  const id = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${suit}-${value}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  return {
    id,
    suit,
    value,
  };
}

export function getTileDisplay(tile: Tile): string {
  return TILE_DISPLAY[tile.suit][tile.value];
}

export function getTileUnicode(tile: Tile): string {
  return TILE_UNICODE[tile.suit][tile.value];
}

export function compareTiles(a: Tile, b: Tile): number {
  const suitOrder = [Suit.WAN, Suit.TIAO, Suit.TONG, Suit.FENG, Suit.JIAN];
  const suitDiff = suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit);
  if (suitDiff !== 0) return suitDiff;
  return a.value - b.value;
}

export function isSameTile(a: Tile, b: Tile): boolean {
  return a.suit === b.suit && a.value === b.value;
}

export function isNumberSuit(tile: Tile): boolean {
  return tile.suit === Suit.WAN || tile.suit === Suit.TIAO || tile.suit === Suit.TONG;
}
