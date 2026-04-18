import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSelfDrawnActions, canAngang, canUpgradePengToGang } from '../core/meld';
import { Suit, createTile } from '../core/tile';
import { Player, Meld } from '../core/player';

describe('self-drawn flow', () => {
  describe('getSelfDrawnActions', () => {
    it('should return angang action when player has 4 identical tiles in hand', () => {
      const player: Player = {
        id: 'east',
        hand: [
          createTile(Suit.WAN, 1), createTile(Suit.WAN, 1),
          createTile(Suit.WAN, 1), createTile(Suit.WAN, 1),
          createTile(Suit.WAN, 2), createTile(Suit.WAN, 3),
          createTile(Suit.WAN, 4), createTile(Suit.WAN, 5),
          createTile(Suit.WAN, 6), createTile(Suit.WAN, 7),
          createTile(Suit.WAN, 8), createTile(Suit.WAN, 9),
          createTile(Suit.TIAO, 1), createTile(Suit.TIAO, 2),
          createTile(Suit.TIAO, 3), createTile(Suit.TONG, 1),
        ],
        melds: [],
        discards: [],
        flowers: [],
        isHuman: false,
        score: 0,
      };

      const drawnTile = createTile(Suit.WAN, 1);
      const actions = getSelfDrawnActions(player, drawnTile);

      const angangAction = actions.find(a => a.type === 'angang');
      expect(angangAction).toBeDefined();
      expect(angangAction?.type).toBe('angang');
      expect(angangAction?.tiles.length).toBe(4);
    });

    it('should return gang action when player can upgrade peng to gang', () => {
      const pengMeld: Meld = {
        type: 'peng',
        tiles: [
          createTile(Suit.WAN, 1),
          createTile(Suit.WAN, 1),
          createTile(Suit.WAN, 1),
        ],
        source: createTile(Suit.WAN, 1),
      };

      const player: Player = {
        id: 'east',
        hand: [
          createTile(Suit.WAN, 1),
          createTile(Suit.WAN, 2), createTile(Suit.WAN, 3),
          createTile(Suit.WAN, 4), createTile(Suit.WAN, 5),
          createTile(Suit.WAN, 6), createTile(Suit.WAN, 7),
          createTile(Suit.WAN, 8), createTile(Suit.WAN, 9),
          createTile(Suit.TIAO, 1), createTile(Suit.TIAO, 2),
          createTile(Suit.TIAO, 3), createTile(Suit.TONG, 1),
          createTile(Suit.TONG, 2), createTile(Suit.TONG, 3),
        ],
        melds: [pengMeld],
        discards: [],
        flowers: [],
        isHuman: false,
        score: 0,
      };

      const drawnTile = createTile(Suit.WAN, 1);
      const actions = getSelfDrawnActions(player, drawnTile);

      const gangAction = actions.find(a => a.type === 'gang');
      expect(gangAction).toBeDefined();
      expect(gangAction?.type).toBe('gang');
    });

    it('should return empty array when no self-drawn actions available', () => {
      const player: Player = {
        id: 'east',
        hand: [
          createTile(Suit.WAN, 1), createTile(Suit.WAN, 2),
          createTile(Suit.WAN, 3), createTile(Suit.WAN, 4),
          createTile(Suit.WAN, 5), createTile(Suit.WAN, 6),
          createTile(Suit.WAN, 7), createTile(Suit.WAN, 8),
          createTile(Suit.WAN, 9), createTile(Suit.TIAO, 1),
          createTile(Suit.TIAO, 2), createTile(Suit.TIAO, 3),
          createTile(Suit.TONG, 1), createTile(Suit.TONG, 2),
          createTile(Suit.TONG, 3), createTile(Suit.FENG, 1),
        ],
        melds: [],
        discards: [],
        flowers: [],
        isHuman: false,
        score: 0,
      };

      const drawnTile = createTile(Suit.FENG, 2);
      const actions = getSelfDrawnActions(player, drawnTile);

      expect(actions.length).toBe(0);
    });

    it('should return both angang and gang when both available', () => {
      const pengMeld: Meld = {
        type: 'peng',
        tiles: [
          createTile(Suit.WAN, 2),
          createTile(Suit.WAN, 2),
          createTile(Suit.WAN, 2),
        ],
        source: createTile(Suit.WAN, 2),
      };

      const player: Player = {
        id: 'east',
        hand: [
          createTile(Suit.WAN, 1), createTile(Suit.WAN, 1),
          createTile(Suit.WAN, 1), createTile(Suit.WAN, 1),
          createTile(Suit.WAN, 2),
          createTile(Suit.WAN, 3), createTile(Suit.WAN, 4),
          createTile(Suit.WAN, 5), createTile(Suit.WAN, 6),
          createTile(Suit.WAN, 7), createTile(Suit.WAN, 8),
          createTile(Suit.WAN, 9), createTile(Suit.TIAO, 1),
          createTile(Suit.TIAO, 2), createTile(Suit.TIAO, 3),
          createTile(Suit.TONG, 1),
        ],
        melds: [pengMeld],
        discards: [],
        flowers: [],
        isHuman: false,
        score: 0,
      };

      const drawnTile = createTile(Suit.WAN, 2);
      const actions = getSelfDrawnActions(player, drawnTile);

      expect(actions.length).toBe(2);
      const angangAction = actions.find(a => a.type === 'angang');
      const gangAction = actions.find(a => a.type === 'gang');
      expect(angangAction).toBeDefined();
      expect(gangAction).toBeDefined();
    });
  });

  describe('canAngang', () => {
    it('should return true when player has 4 identical tiles', () => {
      const player: Player = {
        id: 'east',
        hand: [
          createTile(Suit.WAN, 1), createTile(Suit.WAN, 1),
          createTile(Suit.WAN, 1), createTile(Suit.WAN, 1),
        ],
        melds: [],
        discards: [],
        flowers: [],
        isHuman: false,
        score: 0,
      };

      const result = canAngang(player);
      expect(result.length).toBe(1);
      expect(result[0].type).toBe('angang');
    });

    it('should return empty when no 4 identical tiles', () => {
      const player: Player = {
        id: 'east',
        hand: [
          createTile(Suit.WAN, 1), createTile(Suit.WAN, 1),
          createTile(Suit.WAN, 1),
        ],
        melds: [],
        discards: [],
        flowers: [],
        isHuman: false,
        score: 0,
      };

      const result = canAngang(player);
      expect(result.length).toBe(0);
    });
  });

  describe('canUpgradePengToGang', () => {
    it('should return true when player has peng and draws matching tile', () => {
      const pengMeld: Meld = {
        type: 'peng',
        tiles: [
          createTile(Suit.WAN, 1),
          createTile(Suit.WAN, 1),
          createTile(Suit.WAN, 1),
        ],
        source: createTile(Suit.WAN, 1),
      };

      const player: Player = {
        id: 'east',
        hand: [createTile(Suit.WAN, 1)],
        melds: [pengMeld],
        discards: [],
        flowers: [],
        isHuman: false,
        score: 0,
      };

      const drawnTile = createTile(Suit.WAN, 1);
      const result = canUpgradePengToGang(player, drawnTile);
      expect(result).toBe(true);
    });

    it('should return false when no matching peng', () => {
      const pengMeld: Meld = {
        type: 'peng',
        tiles: [
          createTile(Suit.WAN, 1),
          createTile(Suit.WAN, 1),
          createTile(Suit.WAN, 1),
        ],
        source: createTile(Suit.WAN, 1),
      };

      const player: Player = {
        id: 'east',
        hand: [createTile(Suit.WAN, 2)],
        melds: [pengMeld],
        discards: [],
        flowers: [],
        isHuman: false,
        score: 0,
      };

      const drawnTile = createTile(Suit.WAN, 2);
      const result = canUpgradePengToGang(player, drawnTile);
      expect(result).toBe(false);
    });
  });
});