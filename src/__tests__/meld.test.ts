import { describe, it, expect } from 'vitest';
import { getAvailableActions } from '../core/meld';
import { canWinByClaimingDiscard } from '../core/win';
import { Suit, createTile } from '../core/tile';
import { Player } from '../core/player';

describe('meld', () => {
  describe('getAvailableActions', () => {
    it('should include hu action when canWin is true', () => {
      const player: Player = {
        id: 'south',
        hand: [
          createTile(Suit.WAN, 1), createTile(Suit.WAN, 1), createTile(Suit.WAN, 1),
          createTile(Suit.WAN, 2), createTile(Suit.WAN, 3), createTile(Suit.WAN, 4),
          createTile(Suit.WAN, 5), createTile(Suit.WAN, 6), createTile(Suit.WAN, 7),
          createTile(Suit.TIAO, 1), createTile(Suit.TIAO, 2), createTile(Suit.TIAO, 3),
          createTile(Suit.TONG, 1), createTile(Suit.TONG, 1),
          createTile(Suit.TIAO, 4), createTile(Suit.TIAO, 5),
        ],
        melds: [],
        discards: [],
        flowers: [],
        isHuman: true,
        score: 0,
      };

      const discard = createTile(Suit.TIAO, 6);
      const actions = getAvailableActions(player, discard, 'east', 'south', true);

      const huAction = actions.find((a) => a.type === 'hu');
      expect(huAction).toBeDefined();
      expect(huAction?.type).toBe('hu');
    });

    it('should not include hu action when canWin is false', () => {
      const player: Player = {
        id: 'south',
        hand: [
          createTile(Suit.WAN, 1), createTile(Suit.WAN, 1), createTile(Suit.WAN, 1),
          createTile(Suit.WAN, 2), createTile(Suit.WAN, 3), createTile(Suit.WAN, 4),
          createTile(Suit.WAN, 5), createTile(Suit.WAN, 6), createTile(Suit.WAN, 7),
          createTile(Suit.TIAO, 1), createTile(Suit.TIAO, 2), createTile(Suit.TIAO, 3),
          createTile(Suit.TONG, 1), createTile(Suit.TONG, 1),
          createTile(Suit.TIAO, 4), createTile(Suit.TIAO, 5),
        ],
        melds: [],
        discards: [],
        flowers: [],
        isHuman: true,
        score: 0,
      };

      const discard = createTile(Suit.TIAO, 6);
      const actions = getAvailableActions(player, discard, 'east', 'south', false);

      const huAction = actions.find((a) => a.type === 'hu');
      expect(huAction).toBeUndefined();
    });

    it('should include peng action when player has 2 matching tiles', () => {
      const player: Player = {
        id: 'south',
        hand: [
          createTile(Suit.WAN, 1), createTile(Suit.WAN, 1),
          createTile(Suit.WAN, 2), createTile(Suit.WAN, 3), createTile(Suit.WAN, 4),
          createTile(Suit.WAN, 5), createTile(Suit.WAN, 6), createTile(Suit.WAN, 7),
          createTile(Suit.TIAO, 1), createTile(Suit.TIAO, 2), createTile(Suit.TIAO, 3),
          createTile(Suit.TONG, 1), createTile(Suit.TONG, 1),
          createTile(Suit.TIAO, 4), createTile(Suit.TIAO, 5),
        ],
        melds: [],
        discards: [],
        flowers: [],
        isHuman: true,
        score: 0,
      };

      const discard = createTile(Suit.WAN, 1);
      const actions = getAvailableActions(player, discard, 'east', 'south', false);

      const pengAction = actions.find((a) => a.type === 'peng');
      expect(pengAction).toBeDefined();
      expect(pengAction?.type).toBe('peng');
    });

    it('should include chi action when player can form sequence with left neighbor discard', () => {
      const player: Player = {
        id: 'south',
        hand: [
          createTile(Suit.WAN, 2), createTile(Suit.WAN, 3),
          createTile(Suit.WAN, 4), createTile(Suit.WAN, 5), createTile(Suit.WAN, 6),
          createTile(Suit.WAN, 7), createTile(Suit.WAN, 8), createTile(Suit.WAN, 9),
          createTile(Suit.TIAO, 1), createTile(Suit.TIAO, 2), createTile(Suit.TIAO, 3),
          createTile(Suit.TONG, 1), createTile(Suit.TONG, 1),
          createTile(Suit.TIAO, 4), createTile(Suit.TIAO, 5),
        ],
        melds: [],
        discards: [],
        flowers: [],
        isHuman: true,
        score: 0,
      };

      const discard = createTile(Suit.WAN, 1);
      const actions = getAvailableActions(player, discard, 'east', 'south', false);

      const chiAction = actions.find((a) => a.type === 'chi');
      expect(chiAction).toBeDefined();
      expect(chiAction?.type).toBe('chi');
    });
  });

  describe('canWinByClaimingDiscard', () => {
    it('should return true for a winning hand', () => {
      const hand = [
        createTile(Suit.WAN, 1), createTile(Suit.WAN, 1), createTile(Suit.WAN, 1),
        createTile(Suit.WAN, 2), createTile(Suit.WAN, 3), createTile(Suit.WAN, 4),
        createTile(Suit.WAN, 5), createTile(Suit.WAN, 6), createTile(Suit.WAN, 7),
        createTile(Suit.TIAO, 1), createTile(Suit.TIAO, 2), createTile(Suit.TIAO, 3),
        createTile(Suit.TONG, 1), createTile(Suit.TONG, 1),
        createTile(Suit.TIAO, 4), createTile(Suit.TIAO, 5),
      ];

      const discard = createTile(Suit.TIAO, 6);
      const result = canWinByClaimingDiscard(hand, [], discard);

      expect(result).toBe(true);
    });

    it('should return false for a non-winning hand', () => {
      const hand = [
        createTile(Suit.WAN, 1), createTile(Suit.WAN, 1), createTile(Suit.WAN, 1),
        createTile(Suit.WAN, 2), createTile(Suit.WAN, 3), createTile(Suit.WAN, 4),
        createTile(Suit.WAN, 5), createTile(Suit.WAN, 6), createTile(Suit.WAN, 7),
        createTile(Suit.TIAO, 1), createTile(Suit.TIAO, 2), createTile(Suit.TIAO, 3),
        createTile(Suit.TONG, 1), createTile(Suit.TONG, 1),
        createTile(Suit.TIAO, 4), createTile(Suit.TIAO, 5),
      ];

      const discard = createTile(Suit.FENG, 1);
      const result = canWinByClaimingDiscard(hand, [], discard);

      expect(result).toBe(false);
    });
  });
});
