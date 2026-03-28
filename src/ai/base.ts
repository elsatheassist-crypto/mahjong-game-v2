import { Tile } from '../core/tile';
import { Player } from '../core/player';
import { GameState, ActionType } from '../core/game';
import { MeldAction } from '../core/meld';

/**
 * AI difficulty levels
 */
export type AIDifficulty = 'easy' | 'normal' | 'hard';

/**
 * AI configuration
 */
export interface AIConfig {
  difficulty: AIDifficulty;
  /** Think time in milliseconds (min) */
  thinkTimeMin: number;
  /** Think time in milliseconds (max) */
  thinkTimeMax: number;
}

/**
 * Decision result from AI
 */
export interface AIDecision {
  /** Action type: discard tile or meld action */
  action: 'discard' | 'meld' | 'pass';
  /** Tile to discard (if action is 'discard') */
  tile?: Tile;
  /** Meld action to perform (if action is 'meld') */
  meldAction?: MeldAction;
}

/**
 * Base AI agent interface
 */
export interface AIAgent {
  /** Configuration */
  config: AIConfig;
  /**
   * Decide what tile to discard from hand
   * @param player - The AI player
   * @param gameState - Current game state
   * @returns The tile to discard
   */
  decideDiscard(player: Player, gameState: GameState): Tile;
  /**
   * Decide whether to perform a meld action (chi/peng/gang)
   * @param player - The AI player
   * @param availableActions - Available meld actions
   * @param gameState - Current game state
   * @returns Decision: meld action or pass
   */
  decideMeld(
    player: Player,
    availableActions: MeldAction[],
    gameState: GameState
  ): AIDecision;
  /**
   * Decide whether to perform self-drawn actions (angang, upgrade)
   * @param player - The AI player
   * @param availableActions - Available actions after draw
   * @param gameState - Current game state
   * @returns Decision
   */
  decideSelfDrawn(
    player: Player,
    availableActions: MeldAction[],
    gameState: GameState
  ): AIDecision;
  /**
   * Get random think time in milliseconds
   */
  getThinkTime(): number;
}

/**
 * Create AI config based on difficulty
 */
export function createAIConfig(difficulty: AIDifficulty): AIConfig {
  switch (difficulty) {
    case 'easy':
      return { difficulty, thinkTimeMin: 500, thinkTimeMax: 1000 };
    case 'normal':
      return { difficulty, thinkTimeMin: 1000, thinkTimeMax: 2000 };
    case 'hard':
      return { difficulty, thinkTimeMin: 2000, thinkTimeMax: 3000 };
  }
}

/**
 * Get random element from array
 */
export function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Shuffle array in place
 */
export function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
