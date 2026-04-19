import { describe, expect, it } from 'vitest';
import { compensateFlowers, createInitialState, startGame } from '../core/game';
import { Suit } from '../core/tile';

describe('flower compensation in game flow', () => {
  it('should compensate flower tiles after startGame', () => {
    let state = createInitialState();
    state = startGame(state);
    state = compensateFlowers(state);

    const allFlowers = state.players.flatMap((player) => player.flowers);
    expect(allFlowers.every((tile) => tile.suit === Suit.FLOWER)).toBe(true);
  });
});
