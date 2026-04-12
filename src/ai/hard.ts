import { Tile, Suit, isSameTile, isNumberSuit } from '../core/tile';
import { Player } from '../core/player';
import { GameState } from '../core/game';
import { MeldAction } from '../core/meld';
import { AIAgent, AIConfig, AIDecision, createAIConfig } from './base';
import {
  calculateShanten,
  getImprovementCount,
  assessDanger,
  analyzeHandStructure,
  estimateRemainingUseful,
} from './helpers';
import { countTiles, getTileKey } from '../utils/tileHelper';

export class HardAI implements AIAgent {
  config: AIConfig = createAIConfig('hard');

  async decideDiscard(player: Player, gameState: GameState): Promise<Tile> {
    const hand = player.hand;
    if (hand.length === 0) throw new Error('No tiles in hand');

    const playerIndex = this.getPlayerIndex(player, gameState);
    const remainingDeck = this.estimateRemainingDeck(gameState);
    const shanten = calculateShanten(hand);
    const usefulTiles = estimateRemainingUseful(hand, gameState);

    const dangerAssessments = assessDanger(hand, gameState, playerIndex);

    const shouldDefend = this.shouldDefend(gameState, playerIndex, shanten, usefulTiles);

    let bestTile = hand[0];
    let bestScore = -Infinity;

    const debugChoices: { tileId: string; shanten: number; improvements: number; danger: number; tileValue: number; score: number }[] = [];

    for (let i = 0; i < hand.length; i++) {
      const testHand = hand.filter((_, idx) => idx !== i);
      const newShanten = calculateShanten(testHand);
      const improvements = getImprovementCount(testHand, remainingDeck);
      const danger = dangerAssessments.find(d => d.tile.id === hand[i].id)?.danger ?? 0;

      let score: number;
      if (shouldDefend) {
        score = -danger * 3 + (shanten - newShanten) * 100 + improvements * 0.3;
      } else {
        // 向聽數變化是壓倒性優先級（×100），improvements 只是同向聽數時的次要參考
        score = (shanten - newShanten) * 100 + improvements * 0.5 - danger * 0.1;
      }

      const tileValue = this.evaluateTileValue(hand[i], hand);
      // tileValue 只在同向聽數時做微調
      score -= tileValue * 0.1;

      debugChoices.push({ tileId: hand[i].id, shanten: newShanten, improvements, danger, tileValue, score });

      if (score > bestScore) {
        bestScore = score;
        bestTile = hand[i];
      }
    }

    console.log(`[DEBUG decideDiscard HARD #${playerIndex}] bestTile=${bestTile.id} score=${bestScore.toFixed(2)} defend=${shouldDefend} shanten=${shanten} hand=${hand.length} options=${debugChoices.length}`, debugChoices.map(c => `${c.tileId}(s=${c.shanten},i=${c.improvements},d=${c.danger},v=${c.tileValue},score=${c.score.toFixed(2)})`).join(' | '));

    return bestTile;
  }

  async decideMeld(player: Player, availableActions: MeldAction[], gameState: GameState): Promise<AIDecision> {
    const playerIndex = this.getPlayerIndex(player, gameState);
    const currentShanten = calculateShanten(player.hand);
    const usefulTiles = estimateRemainingUseful(player.hand, gameState);
    const shouldDefend = this.shouldDefend(gameState, playerIndex, currentShanten, usefulTiles);

    const huAction = availableActions.find(a => a.type === 'hu');
    if (huAction) {
      return { action: 'meld', meldAction: huAction };
    }

    const gangAction = availableActions.find(a => a.type === 'gang');
    if (gangAction) {
      if (!shouldDefend || currentShanten <= 1) {
        return { action: 'meld', meldAction: gangAction };
      }
    }

    const pengAction = availableActions.find(a => a.type === 'peng');
    if (pengAction) {
      const testHand = player.hand.filter(
        t => !pengAction.tiles.some(pt => isSameTile(pt, t))
      );
      const newShanten = calculateShanten(testHand);

      if (newShanten < currentShanten) {
        const meldedTile = pengAction.meld.tiles[0];
        if (!shouldDefend || this.isTileSafe(meldedTile, gameState, playerIndex)) {
          return { action: 'meld', meldAction: pengAction };
        }
      }

      if (newShanten === currentShanten && !shouldDefend) {
        const structure = analyzeHandStructure(player.hand);
        if (structure.pairs.length >= 2) {
          return { action: 'meld', meldAction: pengAction };
        }
      }
    }

    const chiActions = availableActions.filter(a => a.type === 'chi');
    if (chiActions.length > 0 && !shouldDefend) {
      let bestChi: MeldAction | null = null;
      let bestShanten = currentShanten;

      for (const chi of chiActions) {
        const testHand = player.hand.filter(
          t => !chi.tiles.some(ct => isSameTile(ct, t))
        );
        const newShanten = calculateShanten(testHand);
        if (newShanten < bestShanten) {
          bestShanten = newShanten;
          bestChi = chi;
        }
      }

      if (bestChi) {
        return { action: 'meld', meldAction: bestChi };
      }
    }

    return { action: 'pass' };
  }

  async decideSelfDrawn(player: Player, availableActions: MeldAction[], gameState: GameState): Promise<AIDecision> {
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
      const playerIndex = this.getPlayerIndex(player, gameState);
      const currentShanten = calculateShanten(player.hand);

      if (currentShanten <= 2) {
        return { action: 'meld', meldAction: upgradeActions[0] };
      }

      if (!this.shouldDefend(gameState, playerIndex, currentShanten, 0)) {
        return { action: 'meld', meldAction: upgradeActions[0] };
      }
    }

    return { action: 'pass' };
  }

  getThinkTime(): number {
    const { thinkTimeMin, thinkTimeMax } = this.config;
    return thinkTimeMin + Math.random() * (thinkTimeMax - thinkTimeMin);
  }

  private shouldDefend(
    gameState: GameState,
    playerIndex: number,
    shanten: number,
    _usefulTiles: number
  ): boolean {
    for (let i = 0; i < gameState.players.length; i++) {
      if (i === playerIndex) continue;
      const otherPlayer = gameState.players[i];

      if (otherPlayer.hand.length <= 3) {
        return true;
      }

      if (otherPlayer.hand.length <= 6 && shanten > 2) {
        return true;
      }
    }

    if (shanten <= 1) return false;

    const remaining = gameState.wall.tiles.length - gameState.wall.position;
    if (remaining < 20 && shanten > 2) {
      return true;
    }

    return false;
  }

  private isTileSafe(tile: Tile, gameState: GameState, playerIndex: number): boolean {
    for (let i = 0; i < gameState.players.length; i++) {
      if (i === playerIndex) continue;

      for (const d of gameState.players[i].discards) {
        if (isSameTile(d, tile)) return true;
      }
    }

    return false;
  }

  private evaluateTileValue(tile: Tile, hand: Tile[]): number {
    let value = 0;
    const counts = countTiles(hand);
    const key = getTileKey(tile);
    const count = counts.get(key) ?? 0;

    if (count >= 3) value += 3;
    else if (count === 2) value += 2;
    else if (count === 1) value += 1;

    if (isNumberSuit(tile)) {
      const suit = tile.suit;
      const val = tile.value;

      const hasNear = hand.some(
        t => t.id !== tile.id && t.suit === suit && Math.abs(t.value - val) <= 2
      );
      if (hasNear) value += 1;

      if ((val === 1 || val === 9) && !hand.some(
        t => t.id !== tile.id && t.suit === suit && Math.abs(t.value - val) === 1
      )) {
        value -= 1;
      }
    }

    if (tile.suit === Suit.JIAN) value += 2;
    if (tile.suit === Suit.FENG) value += 1;

    return value;
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
