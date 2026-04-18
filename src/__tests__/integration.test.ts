
import { startGame } from '../core/game';
import { compensateFlowers } from '../core/game';
import { createInitialState } from '../core/game';
import { Suit } from '../core/tile';

describe('flower compensation in game flow', () => {
  it('should compensate flower tiles after startGame', () => {
    let state = createInitialState();
    state = startGame(state);
    state = compensateFlowers(state);
    
    const allFlowers = state.players.flatMap(p => p.flowers);
    console.log('Flowers after startGame and compensateFlowers:', allFlowers.length);
    // There should be some flowers!
  });
});
