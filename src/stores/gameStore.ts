import { create } from 'zustand';
import {
  GameState,
  GamePhase,
  createInitialState,
  startGame as startGameCore,
  playerDrawTile as playerDrawTileCore,
  playerDiscardTile as playerDiscardTileCore,
  nextTurn,
  aiDiscardTile,
  skipAction,
  setWinner,
  getCurrentPlayer,
  playerChi,
  playerPeng,
} from '../core/game';
import { Tile } from '../core/tile';
import { createAI } from '../ai';
import { createLLMAgent } from '../ai/llm/agent';
import { buildLLMPrompt, parseLLMResponse } from '../ai/llm';
import { callLLM } from '../ai/llm/providers';
import { getChiOptions, getPengOption } from '../core/meld';

export type AIDifficulty = 'easy' | 'normal' | 'hard';
export type AIMode = 'algorithm' | 'llm' | 'hybrid';

interface LLMConfigData {
  provider: 'minimax' | 'openrouter' | 'gemini';
  apiKey: string;
  model: string;
}

interface GameStore {
  state: GameState;
  difficulty: AIDifficulty;
  aiMode: AIMode;
  soundEnabled: boolean;
  isAITurn: boolean;
  selectedTileId: string | null;
  lastDrawnTileId: string | null;
  llmConfig: LLMConfigData | null;
  isLLMThinking: boolean;

  startNewGame: () => void;
  setDifficulty: (d: AIDifficulty) => void;
  setAIMode: (m: AIMode) => void;
  setSoundEnabled: (e: boolean) => void;
  setLLMConfig: (c: LLMConfigData | null) => void;

  selectTile: (tileId: string | null) => void;
  drawTile: () => void;
  discardTile: (tileId: string) => void;
  passAction: () => void;
  chiAction: () => void;
  pengAction: () => void;
  winAction: () => void;
  executeAITurn: () => void;
  startAITurnIfNeeded: () => void;
}

// OpenRouter config for Jason
const JASON_OPENROUTER_CONFIG: LLMConfigData = {
  provider: 'openrouter',
  apiKey: 'YOUR_OPENROUTER_API_KEY',
  model: 'openrouter/free',
};

export const useGameStore = create<GameStore>((set, get) => ({
  state: createInitialState(),
  difficulty: 'normal',
  aiMode: 'algorithm',
  soundEnabled: true,
  isAITurn: false,
  selectedTileId: null,
  lastDrawnTileId: null,
  llmConfig: JASON_OPENROUTER_CONFIG,
  isLLMThinking: false,

  startNewGame: () => {
    const newState = startGameCore(createInitialState());
    set({ state: newState, selectedTileId: null, lastDrawnTileId: null, isAITurn: false, isLLMThinking: false });

    if (newState.currentPlayer !== 0) {
      setTimeout(() => get().startAITurnIfNeeded(), 500);
    }
  },

  setDifficulty: (difficulty) => set({ difficulty }),
  setAIMode: (aiMode) => set({ aiMode }),
  setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
  setLLMConfig: (llmConfig) => set({ llmConfig }),

  selectTile: (tileId) => set({ selectedTileId: tileId }),

  drawTile: () => {
    const { state } = get();
    if (state.phase !== GamePhase.PLAYING) return;
    if (state.currentPlayer !== 0) return;
    if (state.turnAction !== 'draw') return;

    const newState = nextTurn(state);
    if (newState.phase === GamePhase.GAME_OVER) {
      set({ state: newState });
      return;
    }

    // Get the newly drawn tile (last in hand)
    const drawnTile = newState.players[0].hand[newState.players[0].hand.length - 1];

    set({ state: newState, selectedTileId: null, lastDrawnTileId: drawnTile?.id || null });
  },

  discardTile: (tileId) => {
    const { state } = get();
    if (state.phase !== GamePhase.PLAYING) return;
    if (state.currentPlayer !== 0) return;
    if (state.turnAction !== 'discard') return;

    const result = playerDiscardTileCore(state, 0, tileId);
    if (result.lastDiscard) {
      set({ state: result, selectedTileId: null, lastDrawnTileId: null });
      setTimeout(() => get().passAction(), 100);
    }
  },

  passAction: () => {
    const { state } = get();
    const newState = skipAction(state);
    set({ state: newState });

    if (newState.phase === GamePhase.PLAYING && newState.currentPlayer !== 0) {
      setTimeout(() => get().startAITurnIfNeeded(), 300);
    }
  },

  chiAction: () => {
    const { state } = get();
    if (state.phase !== GamePhase.PLAYING) return;
    if (state.turnAction !== 'waiting') return;
    if (!state.lastDiscard || state.lastDiscardPlayer === null) return;

    const humanPlayer = state.players[0];
    const discarderSeat = state.players[state.lastDiscardPlayer].id;
    const chiOptions = getChiOptions(humanPlayer, state.lastDiscard);

    if (chiOptions.length === 0) return;

    const chiOption = chiOptions[0];
    const handTileIds = chiOption.tiles.map(t => t.id);
    const newState = playerChi(state, 0, handTileIds, chiOption.meld.tiles);

    set({ state: newState, selectedTileId: null, lastDrawnTileId: null });
  },

  pengAction: () => {
    const { state } = get();
    if (state.phase !== GamePhase.PLAYING) return;
    if (state.turnAction !== 'waiting') return;
    if (!state.lastDiscard || state.lastDiscardPlayer === null) return;

    const humanPlayer = state.players[0];
    const pengOption = getPengOption(humanPlayer, state.lastDiscard);

    if (!pengOption) return;

    const handTileIds = pengOption.tiles.map(t => t.id);
    const newState = playerPeng(state, 0, handTileIds, pengOption.meld.tiles);

    set({ state: newState, selectedTileId: null, lastDrawnTileId: null });
  },

  winAction: () => {
    const { state } = get();
    if (state.phase !== GamePhase.PLAYING) return;

    const newState = setWinner(state, 0);
    set({ state: newState, selectedTileId: null, lastDrawnTileId: null });
  },

  startAITurnIfNeeded: () => {
    const { state } = get();
    if (state.phase !== GamePhase.PLAYING) return;
    if (state.currentPlayer === 0) return;

    set({ isAITurn: true });
    get().executeAITurn();
  },

  executeAITurn: () => {
    const { state, difficulty, aiMode, llmConfig } = get();
    if (state.phase !== GamePhase.PLAYING) return;
    if (state.currentPlayer === 0) {
      set({ isAITurn: false });
      return;
    }

    if (state.turnAction === 'draw') {
      // AI draws a tile
      const newState = nextTurn(state);
      if (newState.phase === GamePhase.GAME_OVER) {
        set({ state: newState, isAITurn: false });
        return;
      }

      set({ state: newState });
      // After drawing, AI needs to discard
      setTimeout(() => get().executeAITurn(), 800);
    } else if (state.turnAction === 'discard') {
      // AI needs to decide which tile to discard
      const aiPlayer = getCurrentPlayer(state);

      if (aiMode === 'algorithm') {
        // Pure algorithm AI
        const ai = createAI(difficulty);
        const thinkTime = ai.getThinkTime();

        try {
          const tileToDiscard = ai.decideDiscard(aiPlayer, state);
          if (tileToDiscard) {
            const newState = aiDiscardTile(state, tileToDiscard);
            set({ state: newState });

            if (newState.phase === GamePhase.PLAYING) {
              if (newState.currentPlayer === 0) {
                set({ isAITurn: false });
              } else {
                setTimeout(() => get().executeAITurn(), thinkTime);
              }
            } else {
              set({ isAITurn: false });
            }
          }
        } catch (e) {
          console.error('Algorithm AI error:', e);
          fallbackAIDiscard(state, set, get);
        }
      } else if (aiMode === 'llm' && llmConfig) {
        // Pure LLM AI - call API for every decision
        set({ isLLMThinking: true });

        const llmAgent = createLLMAgent({
          provider: llmConfig.provider,
          apiKey: llmConfig.apiKey,
          model: llmConfig.model,
        });

        llmAgent.decide(aiPlayer, state).then((tileToDiscard) => {
          const currentState = get().state;
          if (currentState.phase !== GamePhase.PLAYING) {
            set({ isLLMThinking: false, isAITurn: false });
            return;
          }

          const newState = aiDiscardTile(currentState, tileToDiscard);
          set({ state: newState, isLLMThinking: false });

          if (newState.phase === GamePhase.PLAYING) {
            if (newState.currentPlayer === 0) {
              set({ isAITurn: false });
            } else {
              setTimeout(() => get().executeAITurn(), 500);
            }
          } else {
            set({ isAITurn: false });
          }
        }).catch((e) => {
          console.error('LLM AI error:', e);
          set({ isLLMThinking: false });
          // Fallback to algorithm AI
          const ai = createAI(difficulty);
          try {
            const tile = ai.decideDiscard(aiPlayer, state);
            const newState = aiDiscardTile(state, tile);
            set({ state: newState, isAITurn: false });
          } catch (e2) {
            fallbackAIDiscard(state, set, get);
          }
        });
      } else if (aiMode === 'hybrid' && llmConfig) {
        // Hybrid mode: Algorithm for discard, LLM for meld decisions
        const ai = createAI(difficulty);

        // Use algorithm for discard decision (faster, free)
        try {
          const tileToDiscard = ai.decideDiscard(aiPlayer, state);
          if (tileToDiscard) {
            const newState = aiDiscardTile(state, tileToDiscard);
            set({ state: newState });

            if (newState.phase === GamePhase.PLAYING) {
              if (newState.currentPlayer === 0) {
                set({ isAITurn: false });
              } else {
                setTimeout(() => get().executeAITurn(), ai.getThinkTime());
              }
            } else {
              set({ isAITurn: false });
            }
          }
        } catch (e) {
          console.error('Hybrid AI error:', e);
          fallbackAIDiscard(state, set, get);
        }
      } else {
        // No LLM config, fall back to algorithm
        const ai = createAI(difficulty);
        try {
          const tile = ai.decideDiscard(aiPlayer, state);
          const newState = aiDiscardTile(state, tile);
          set({ state: newState, isAITurn: false });
        } catch (e2) {
          fallbackAIDiscard(state, set, get);
        }
      }
    } else if (state.turnAction === 'waiting') {
      const newState = skipAction(state);
      set({ state: newState });

      if (newState.phase === GamePhase.PLAYING && newState.currentPlayer !== 0) {
        setTimeout(() => get().executeAITurn(), 300);
      } else {
        set({ isAITurn: false });
      }
    }
  },
}));

// Helper function for AI fallback
function fallbackAIDiscard(
  state: GameState,
  set: (state: Partial<ReturnType<typeof useGameStore.getState>>) => void,
  get: () => GameStore
) {
  const aiPlayer = getCurrentPlayer(state);
  const firstTile = aiPlayer.hand[0];
  if (firstTile) {
    const newState = aiDiscardTile(state, firstTile);
    set({ state: newState, isAITurn: false });
  } else {
    set({ isAITurn: false });
  }
}

// Type for GameStore
interface GameStore {
  state: GameState;
  difficulty: AIDifficulty;
  aiMode: AIMode;
  soundEnabled: boolean;
  isAITurn: boolean;
  selectedTileId: string | null;
  llmConfig: LLMConfigData | null;
  isLLMThinking: boolean;
  startNewGame: () => void;
  setDifficulty: (d: AIDifficulty) => void;
  setAIMode: (m: AIMode) => void;
  setSoundEnabled: (e: boolean) => void;
  setLLMConfig: (c: LLMConfigData | null) => void;
  selectTile: (tileId: string | null) => void;
  drawTile: () => void;
  discardTile: (tileId: string) => void;
  passAction: () => void;
  chiAction: () => void;
  pengAction: () => void;
  winAction: () => void;
  executeAITurn: () => void;
  startAITurnIfNeeded: () => void;
}
