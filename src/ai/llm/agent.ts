import { Tile, getTileDisplay } from '../../core/tile';
import { Player } from '../../core/player';
import { GameState } from '../../core/game';
import { AIConfig, AIDecision, createAIConfig } from '../base';
import { LLMConfig, buildLLMPrompt, parseLLMResponse } from './index';
import { callLLM } from './providers';

// LLM AI is async, so it doesn't implement AIAgent directly
// Use createLLMAgent() which returns an async function

export interface LLMAIAgent {
  config: AIConfig;
  decide: (player: Player, gameState: GameState) => Promise<Tile>;
  decideMeld: (player: Player, availableActions: unknown[], gameState: GameState) => AIDecision;
  decideSelfDrawn: (player: Player, availableActions: unknown[], gameState: GameState) => AIDecision;
}

export function createLLMAgent(
  llmConfig: LLMConfig,
  difficulty: 'easy' | 'normal' | 'hard' = 'normal'
): LLMAIAgent {
  const config = createAIConfig(difficulty);

  async function decide(player: Player, gameState: GameState): Promise<Tile> {
    const prompt = buildLLMPrompt(player, gameState);

    try {
      const response = await callLLM(prompt, llmConfig);
      const tileName = parseLLMResponse(response.content);

      if (tileName) {
        const tile = player.hand.find((t) => {
          const display = getTileDisplay(t);
          return display.includes(tileName) || tileName.includes(display);
        });

        if (tile) {
          return tile;
        }
      }

      console.warn('LLM response parsing failed, using fallback');
      return player.hand[0];
    } catch (error) {
      console.error('LLM AI error:', error);
      return player.hand[0];
    }
  }

  function decideMeld(player: Player, availableActions: unknown[], gameState: GameState): AIDecision {
    return { action: 'pass' };
  }

  function decideSelfDrawn(player: Player, availableActions: unknown[], gameState: GameState): AIDecision {
    return { action: 'pass' };
  }

  return {
    config,
    decide,
    decideMeld,
    decideSelfDrawn,
  };
}
