import { Tile, getTileDisplay } from '../../core/tile';
import { Player } from '../../core/player';
import { GameState } from '../../core/game';
import { MeldAction } from '../../core/meld';
import { AIConfig, AIDecision, createAIConfig, AIDifficulty } from '../base';
import { createAI } from '../index';
import { LLMConfig, buildLLMPrompt, parseLLMResponse, buildSelfDrawnPrompt, parseSelfDrawnResponse, buildMeldPrompt, parseMeldResponse } from './index';
import { callLLM } from './providers';

// LLM AI is async, so it doesn't implement AIAgent directly
// Use createLLMAgent() which returns an async function

export interface LLMAIAgent {
  config: AIConfig;
  decide: (player: Player, gameState: GameState) => Promise<{ tile: Tile; reasoning: string | null }>;
  decideMeld: (player: Player, availableActions: MeldAction[], gameState: GameState) => Promise<AIDecision>;
  decideSelfDrawn: (player: Player, availableActions: MeldAction[], gameState: GameState) => Promise<AIDecision>;
}

export function createLLMAgent(
  llmConfig: LLMConfig,
  difficulty: AIDifficulty = 'normal'
): LLMAIAgent {
  const config = createAIConfig(difficulty);
  const fallbackAI = createAI(difficulty);

  async function decide(player: Player, gameState: GameState): Promise<{ tile: Tile; reasoning: string | null }> {
    const prompt = buildLLMPrompt(player, gameState);

    try {
      const response = await callLLM(prompt, llmConfig);
      const { tileName, reasoning } = parseLLMResponse(response.content);

      if (tileName) {
        const handDisplays = player.hand.map(t => getTileDisplay(t));
        console.log('[LLM Agent] Looking for tile:', tileName, 'in hand:', handDisplays);
        
        const tile = player.hand.find((t) => {
          const display = getTileDisplay(t);
          const match = display.includes(tileName) || tileName.includes(display);
          if (match) {
            console.log('[LLM Agent] Matched:', display, 'with:', tileName);
          }
          return match;
        });

        if (tile) {
          return { tile, reasoning: reasoning ?? null };
        }
        console.warn('[LLM Agent] Tile not found in hand:', tileName);
      }

      console.warn('LLM failed, using fallback AI');
      const fallbackTile = await fallbackAI.decideDiscard(player, gameState);
      return { tile: fallbackTile, reasoning: null };
    } catch (error) {
      console.error('LLM AI error:', error);
      const fallbackTile = await fallbackAI.decideDiscard(player, gameState);
      return { tile: fallbackTile, reasoning: null };
    }
  }

  async function decideMeld(player: Player, availableActions: MeldAction[], gameState: GameState): Promise<AIDecision> {
    // If no actions available, pass
    if (availableActions.length === 0) {
      return { action: 'pass' };
    }

    const prompt = buildMeldPrompt(player, availableActions, gameState);

    try {
      const response = await callLLM(prompt, llmConfig);
      const choiceStr = parseMeldResponse(response.content);

      if (choiceStr) {
        const choiceIndex = parseInt(choiceStr, 10) - 1;
        if (choiceIndex >= 0 && choiceIndex < availableActions.length) {
          const selectedAction = availableActions[choiceIndex];
          return { action: 'meld', meldAction: selectedAction };
        }
        // Check if choice is pass (last option)
        if (choiceIndex === availableActions.length) {
          return { action: 'pass' };
        }
      }

      console.warn('LLM meld failed, using fallback AI');
      return fallbackAI.decideMeld(player, availableActions, gameState);
    } catch (error) {
      console.error('LLM AI meld error:', error);
      return fallbackAI.decideMeld(player, availableActions, gameState);
    }
  }

  async function decideSelfDrawn(
    player: Player,
    availableActions: MeldAction[],
    gameState: GameState
  ): Promise<AIDecision> {
    // If no actions available, pass
    if (availableActions.length === 0) {
      return { action: 'pass' };
    }

    // Get the drawn tile from game state
    const drawnTile = gameState.wall.tiles[gameState.wall.position - 1];
    if (!drawnTile) {
      return { action: 'pass' };
    }

    const prompt = buildSelfDrawnPrompt(player, drawnTile, availableActions, gameState);

    try {
      const response = await callLLM(prompt, llmConfig);
      const choiceStr = parseSelfDrawnResponse(response.content);

      if (choiceStr) {
        const choiceIndex = parseInt(choiceStr, 10) - 1;
        if (choiceIndex >= 0 && choiceIndex < availableActions.length) {
          const selectedAction = availableActions[choiceIndex];
          return { action: 'meld', meldAction: selectedAction };
        }
      }

      console.warn('LLM self-drawn failed, using fallback AI');
      return fallbackAI.decideSelfDrawn(player, availableActions, gameState);
    } catch (error) {
      console.error('LLM AI self-drawn error:', error);
      return fallbackAI.decideSelfDrawn(player, availableActions, gameState);
    }
  }

  return {
    config,
    decide,
    decideMeld,
    decideSelfDrawn,
  };
}
