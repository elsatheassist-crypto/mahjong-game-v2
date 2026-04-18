
import { createFullDeck } from '../core/wall';
import { Suit } from '../core/tile';
import { compensateFlowers } from '../core/game';
import { GameState, GamePhase } from '../core/game';
import { Player } from '../core/player';

describe('flower compensation', () => {
  it('should compensate flower tiles', () => {
    const deck = createFullDeck();
    const flowerTile = deck.find(t => t.suit === Suit.FLOWER);
    
    // Create a dummy state with a flower tile in hand
    const player: Player = {
        id: 'east',
        isHuman: true,
        hand: [flowerTile!, ...deck.filter(t => t.suit !== Suit.FLOWER).slice(0, 15)],
        melds: [],
        discards: [],
        flowers: [],
        score: 0,
    };
    
    const state: GameState = {
        phase: GamePhase.PLAYING,
        currentPlayer: 0,
        wall: { tiles: deck, position: 1 },
        players: [player, ...Array(3).fill(player)],
        lastDiscard: null,
        lastDiscardPlayer: null,
        winner: null,
        winType: null,
        round: 1,
        turnAction: 'draw',
        wind: 'east',
        discardSequence: [],
    };
    
    const newState = compensateFlowers(state);
    expect(newState.players[0].flowers.length).toBe(1);
    expect(newState.players[0].hand.length).toBe(16);
  });
});
