import { Tile, Suit, isSameTile } from '../core/tile';
import { Player } from '../core/player';
import { GameState } from '../core/game';
import { MeldAction } from '../core/meld';
import { AIAgent, AIConfig, AIDecision, createAIConfig } from './base';
import { calculateShanten, calculateTileDanger, getImprovementCount } from './helpers';

export class NormalAI implements AIAgent {
  config: AIConfig = createAIConfig('normal');

  async decideDiscard(player: Player, gameState: GameState): Promise<Tile> {
    const hand = player.hand;
    if (hand.length === 0) throw new Error('No tiles in hand');

    const remainingDeck = this.estimateRemainingDeck(gameState);
    let bestTile = hand[0];
    let bestScore = Infinity;

    for (let i = 0; i < hand.length; i++) {
      const testHand = hand.filter((_, idx) => idx !== i);
      const shanten = calculateShanten(testHand);
      const improvements = getImprovementCount(testHand, remainingDeck);
      const danger = calculateTileDanger(hand[i], gameState, this.getPlayerIndex(player, gameState));

      const score = shanten * 10 - improvements + danger * 0.5;

      if (score < bestScore) {
        bestScore = score;
        bestTile = hand[i];
      }
    }

    return bestTile;
  }

  async decideMeld(player: Player, availableActions: MeldAction[], _gameState: GameState): Promise<AIDecision> {
    const huAction = availableActions.find(a => a.type === 'hu');
    if (huAction) {
      return { action: 'meld', meldAction: huAction };
    }

    const gangAction = availableActions.find(a => a.type === 'gang');
    if (gangAction) {
      return { action: 'meld', meldAction: gangAction };
    }

    const pengAction = availableActions.find(a => a.type === 'peng');
    if (pengAction) {
      const currentShanten = calculateShanten(player.hand);
      const testHand = player.hand.filter(
        t => !pengAction.tiles.some(pt => isSameTile(pt, t))
      );
      if (calculateShanten(testHand) <= currentShanten) {
        return { action: 'meld', meldAction: pengAction };
      }
    }

    const chiActions = availableActions.filter(a => a.type === 'chi');
    if (chiActions.length > 0) {
      const currentShanten = calculateShanten(player.hand);
      for (const chi of chiActions) {
        const testHand = player.hand.filter(
          t => !chi.tiles.some(ct => isSameTile(ct, t))
        );
        if (calculateShanten(testHand) < currentShanten) {
          return { action: 'meld', meldAction: chi };
        }
      }
    }

    if (Math.random() < 0.3 && availableActions.length > 0) {
      return { action: 'meld', meldAction: availableActions[0] };
    }

    return { action: 'pass' };
  }

  async decideSelfDrawn(_player: Player, availableActions: MeldAction[], _gameState: GameState): Promise<AIDecision> {
    const huAction = availableActions.find(a => a.type === 'hu');
    if (huAction) {
      return { action: 'meld', meldAction: huAction };
    }

    const angangActions = availableActions.filter(a => a.type === 'angang');
    if (angangActions.length > 0) {
      return { action: 'meld', meldAction: angangActions[0] };
    }

    const upgradeActions = availableActions.filter(
      a => a.type === 'gang' && a.tiles.length === 1
    );
    if (upgradeActions.length > 0) {
      if (Math.random() < 0.7) {
        return { action: 'meld', meldAction: upgradeActions[0] };
      }
    }

    return { action: 'pass' };
  }

  getThinkTime(): number {
    const { thinkTimeMin, thinkTimeMax } = this.config;
    return thinkTimeMin + Math.random() * (thinkTimeMax - thinkTimeMin);
  }

  private getPlayerIndex(player: Player, gameState: GameState): number {
    return gameState.players.findIndex(p => p.id === player.id);
  }

  private estimateRemainingDeck(gameState: GameState): Tile[] {
    const allKnownTiles: Tile[] = [];

    for (const p of gameState.players) {
      allKnownTiles.push(...p.hand);
      allKnownTiles.push(...p.discards);
      for (const meld of p.melds) {
        allKnownTiles.push(...meld.tiles);
      }
    }

    const fullDeck = this.generateFullDeck();
    const remaining = [...fullDeck];

    for (const known of allKnownTiles) {
      const idx = remaining.findIndex(t => isSameTile(t, known));
      if (idx !== -1) {
        remaining.splice(idx, 1);
      }
    }

    return remaining;
  }

  private generateFullDeck(): Tile[] {
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
}
