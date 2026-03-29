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
  playerGang,
} from '../core/game';
import { drawTile } from '../core/wall';
import { createAI } from '../ai';
import { createLLMAgent } from '../ai/llm/agent';
import { AIDecision } from '../ai/base';
import { canWinByClaimingDiscard } from '../core/win';
import { getChiOptions, getPengOption, getAvailableActions, getSelfDrawnActions, MeldAction } from '../core/meld';

export type AIDifficulty = 'easy' | 'normal' | 'hard';
export type AIMode = 'algorithm' | 'llm' | 'hybrid';

interface LLMConfigData {
  provider: 'minimax' | 'openrouter' | 'gemini';
  apiKey: string;
  model: string;
}

export type HybridConfig = {
  discard: 'algorithm' | 'llm';
  meld: 'algorithm' | 'llm';
  hu: 'algorithm' | 'llm';
};

interface GameStore {
  state: GameState;
  difficulty: AIDifficulty;
  aiMode: AIMode;
  soundEnabled: boolean;
  isAITurn: boolean;
  selectedTileId: string | null;
  lastDrawnTileId: string | null;
  llmConfig: LLMConfigData | null;
  hybridConfig: HybridConfig;
  isLLMThinking: boolean;
  chiOptionSelect: MeldAction[];

  startNewGame: () => void;
  setDifficulty: (d: AIDifficulty) => void;
  setAIMode: (m: AIMode) => void;
  setSoundEnabled: (e: boolean) => void;
  setLLMConfig: (c: LLMConfigData | null) => void;
  setHybridConfig: (c: Partial<HybridConfig>) => void;

  selectTile: (tileId: string | null) => void;
  drawTile: () => void;
  discardTile: (tileId: string) => void;
  passAction: () => void;
  chiAction: () => void;
  chiActionWithOption: (option: MeldAction) => void;
  pengAction: () => void;
  winAction: () => void;
  executeAITurn: () => Promise<void>;
  startAITurnIfNeeded: () => void;
}

const STORAGE_KEY = 'mahjong-llm-config';

function loadLLMConfig(): LLMConfigData | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const config = JSON.parse(stored);
      if (config.provider && config.apiKey && config.model) {
        return config;
      }
    }
  } catch {
  }
  return null;
}

function saveLLMConfig(config: LLMConfigData | null): void {
  try {
    if (config) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
  }
}

const HYBRID_STORAGE_KEY = 'mahjong-hybrid-config';
const DEFAULT_HYBRID_CONFIG: HybridConfig = {
  discard: 'algorithm',
  meld: 'algorithm',
  hu: 'algorithm',
};

function loadHybridConfig(): HybridConfig {
  try {
    const stored = localStorage.getItem(HYBRID_STORAGE_KEY);
    if (stored) {
      const config = JSON.parse(stored);
      if (
        config &&
        typeof config.discard === 'string' &&
        typeof config.meld === 'string' &&
        typeof config.hu === 'string'
      ) {
        return {
          discard: config.discard === 'llm' ? 'llm' : 'algorithm',
          meld: config.meld === 'llm' ? 'llm' : 'algorithm',
          hu: config.hu === 'llm' ? 'llm' : 'algorithm',
        };
      }
    }
  } catch {
  }
  return DEFAULT_HYBRID_CONFIG;
}

function saveHybridConfig(config: HybridConfig): void {
  try {
    localStorage.setItem(HYBRID_STORAGE_KEY, JSON.stringify(config));
  } catch {
  }
}

export const useGameStore = create<GameStore>((set, get) => ({
  state: createInitialState(),
  difficulty: 'normal',
  aiMode: 'algorithm',
  soundEnabled: true,
  isAITurn: false,
  selectedTileId: null,
  lastDrawnTileId: null,
  llmConfig: loadLLMConfig(),
  hybridConfig: loadHybridConfig(),
  isLLMThinking: false,
  chiOptionSelect: [],

  startNewGame: () => {
    const newState = startGameCore(createInitialState());
    set({ state: newState, selectedTileId: null, lastDrawnTileId: null, isAITurn: false, isLLMThinking: false, chiOptionSelect: [] });

    if (newState.currentPlayer !== 0) {
      setTimeout(() => get().startAITurnIfNeeded(), 500);
    }
  },

  setDifficulty: (difficulty) => set({ difficulty }),
  setAIMode: (aiMode) => set({ aiMode }),
  setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
  setLLMConfig: (llmConfig) => {
    saveLLMConfig(llmConfig);
    set({ llmConfig });
  },
  setHybridConfig: (partialConfig) => {
    const currentConfig = get().hybridConfig;
    const newConfig: HybridConfig = {
      discard: partialConfig.discard ?? currentConfig.discard,
      meld: partialConfig.meld ?? currentConfig.meld,
      hu: partialConfig.hu ?? currentConfig.hu,
    };
    saveHybridConfig(newConfig);
    set({ hybridConfig: newConfig });
  },

  selectTile: (tileId) => set({ selectedTileId: tileId }),

  drawTile: () => {
    const { state } = get();
    if (state.phase !== GamePhase.PLAYING) return;
    if (state.currentPlayer !== 0) return;
    if (state.turnAction !== 'draw') return;

    const drawnResult = drawTile(state.wall);
    if (drawnResult.tile === null) {
      set({ state: { ...state, phase: GamePhase.GAME_OVER } });
      return;
    }

    const drawnTile = drawnResult.tile;
    const newWall = drawnResult.wall;

    const players = [...state.players];
    players[0] = { ...players[0], hand: [...players[0].hand, drawnTile] };

    const newState: GameState = {
      ...state,
      wall: newWall,
      players,
      turnAction: 'discard',
      lastAction: 'draw',
    };

    set({ state: newState, selectedTileId: null, lastDrawnTileId: drawnTile.id });
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
    set({ state: newState, chiOptionSelect: [] });

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
    const chiOptions = getChiOptions(humanPlayer, state.lastDiscard);

    if (chiOptions.length === 0) return;

    if (chiOptions.length > 1) {
      set({ chiOptionSelect: chiOptions });
      return;
    }

    const chiOption = chiOptions[0];
    const handTileIds = chiOption.tiles.map(t => t.id);
    const newState = playerChi(state, 0, handTileIds, chiOption.meld.tiles);

    set({ state: newState, selectedTileId: null, lastDrawnTileId: null, chiOptionSelect: [] });
  },

  chiActionWithOption: (chiOption: MeldAction) => {
    const { state } = get();
    if (state.phase !== GamePhase.PLAYING) return;
    if (state.turnAction !== 'waiting') return;
    if (!state.lastDiscard || state.lastDiscardPlayer === null) return;

    const handTileIds = chiOption.tiles.map(t => t.id);
    const newState = playerChi(state, 0, handTileIds, chiOption.meld.tiles);

    set({ state: newState, selectedTileId: null, lastDrawnTileId: null, chiOptionSelect: [] });
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

    set({ state: newState, selectedTileId: null, lastDrawnTileId: null, chiOptionSelect: [] });
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

  executeAITurn: async () => {
    const { state, difficulty, aiMode, llmConfig, hybridConfig } = get();
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

      // Get the drawn tile (the tile at wall.position - 1 is the last drawn)
      const drawnTile = newState.wall.tiles[newState.wall.position - 1];
      const aiPlayer = getCurrentPlayer(newState);

      // Check for self-drawn actions (angang, upgrade peng to gang)
      const selfDrawnActions = drawnTile ? getSelfDrawnActions(aiPlayer, drawnTile) : [];

      if (selfDrawnActions.length > 0) {
        let decision: AIDecision;

        const shouldUseLLMForSelfDrawn =
          (aiMode === 'llm' && llmConfig) ||
          (aiMode === 'hybrid' && llmConfig && hybridConfig.hu === 'llm');

        if (shouldUseLLMForSelfDrawn) {
          set({ isLLMThinking: true });
          const llmAgent = createLLMAgent({
            provider: llmConfig!.provider,
            apiKey: llmConfig!.apiKey,
            model: llmConfig!.model,
          });
          try {
            decision = await llmAgent.decideSelfDrawn(aiPlayer, selfDrawnActions, newState);
            set({ isLLMThinking: false });
          } catch (e) {
            console.error('LLM self-drawn decision error:', e);
            set({ isLLMThinking: false });
            const ai = createAI(difficulty);
            decision = await ai.decideSelfDrawn(aiPlayer, selfDrawnActions, newState);
          }
        } else {
          const ai = createAI(difficulty);
          decision = await ai.decideSelfDrawn(aiPlayer, selfDrawnActions, newState);
        }

        if (decision.action === 'meld' && decision.meldAction) {
          const meldAction = decision.meldAction;

          if (meldAction.type === 'hu') {
            // Self-drawn win
            const winState = setWinner(newState, newState.currentPlayer);
            set({ state: winState, isAITurn: false });
            return;
          } else if (meldAction.type === 'angang' || meldAction.type === 'gang') {
            // Execute gang meld: remove tiles from hand, add meld
            const players = [...newState.players];
            const player = players[newState.currentPlayer];

            // Remove the tiles used in the meld from hand
            const tileIdsToRemove = meldAction.tiles.map(t => t.id);
            let updatedHand = [...player.hand];
            for (const id of tileIdsToRemove) {
              const idx = updatedHand.findIndex(t => t.id === id);
              if (idx !== -1) {
                updatedHand = [...updatedHand.slice(0, idx), ...updatedHand.slice(idx + 1)];
              }
            }

            // Add the meld
            const updatedPlayer = {
              ...player,
              hand: updatedHand,
              melds: [...player.melds, meldAction.meld],
            };
            players[newState.currentPlayer] = updatedPlayer;

            const meldState: GameState = {
              ...newState,
              players,
              turnAction: 'discard',
              lastAction: meldAction.type,
              lastMeldAction: {
                type: meldAction.type === 'angang' ? 'gang' : 'gang',
                player: newState.currentPlayer,
                tile: drawnTile!,
              },
            };

            set({ state: meldState });
            // After meld, AI needs to discard
            setTimeout(() => get().executeAITurn(), 800);
            return;
          }
        }
      }

      // No self-drawn actions or passed, continue to discard
      set({ state: newState });
      // After drawing, AI needs to discard
      setTimeout(() => get().executeAITurn(), 800);
    } else if (state.turnAction === 'discard') {
      const aiPlayer = getCurrentPlayer(state);

      if (aiMode === 'algorithm') {
        const ai = createAI(difficulty);
        const thinkTime = ai.getThinkTime();

        try {
          const tileToDiscard = await ai.decideDiscard(aiPlayer, state);
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
        }).catch(async (e) => {
          console.error('LLM AI error:', e);
          set({ isLLMThinking: false });
          const ai = createAI(difficulty);
          try {
          const tile = await ai.decideDiscard(aiPlayer, state);
          const newState = aiDiscardTile(state, tile);
          set({ state: newState, isAITurn: false });
        } catch (e2) {
          fallbackAIDiscard(state, set, get);
        }
      });
    } else if (aiMode === 'hybrid' && llmConfig) {
        const shouldUseLLMForDiscard = hybridConfig.discard === 'llm';

        if (shouldUseLLMForDiscard) {
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
          }).catch(async (e) => {
            console.error('Hybrid LLM discard error:', e);
            set({ isLLMThinking: false });
            const ai = createAI(difficulty);
            try {
              const tile = await ai.decideDiscard(aiPlayer, state);
              const newState = aiDiscardTile(state, tile);
              set({ state: newState, isAITurn: false });
            } catch (e2) {
              fallbackAIDiscard(state, set, get);
            }
          });
        } else {
          const ai = createAI(difficulty);

          try {
            const tileToDiscard = await ai.decideDiscard(aiPlayer, state);
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
            console.error('Hybrid algorithm discard error:', e);
            fallbackAIDiscard(state, set, get);
          }
        }
      } else {
        // No LLM config, fall back to algorithm
        const ai = createAI(difficulty);
        try {
        const tile = await ai.decideDiscard(aiPlayer, state);
        const newState = aiDiscardTile(state, tile);
        set({ state: newState, isAITurn: false });
      } catch (e2) {
        fallbackAIDiscard(state, set, get);
      }
    }
  } else if (state.turnAction === 'waiting') {
      const aiPlayer = getCurrentPlayer(state);
      const canWin = canWinByClaimingDiscard(aiPlayer.hand, aiPlayer.melds, state.lastDiscard!);
      const availableActions = getAvailableActions(aiPlayer, state.lastDiscard!, state.players[state.lastDiscardPlayer!].id, aiPlayer.id, canWin);

      if (availableActions.length > 0) {
        let decision: AIDecision;

        const shouldUseLLMForMeld =
          (aiMode === 'llm' && llmConfig) ||
          (aiMode === 'hybrid' && llmConfig && hybridConfig.meld === 'llm');

        if (shouldUseLLMForMeld) {
          set({ isLLMThinking: true });
          const llmAgent = createLLMAgent({
            provider: llmConfig!.provider,
            apiKey: llmConfig!.apiKey,
            model: llmConfig!.model,
          });
          try {
            decision = await llmAgent.decideMeld(aiPlayer, availableActions, state);
            set({ isLLMThinking: false });
          } catch (e) {
            console.error('LLM meld decision error:', e);
            set({ isLLMThinking: false });
            const ai = createAI(difficulty);
            decision = await ai.decideMeld(aiPlayer, availableActions, state);
          }
        } else {
          const ai = createAI(difficulty);
          decision = await ai.decideMeld(aiPlayer, availableActions, state);
        }

        if (decision.action === 'meld' && decision.meldAction) {
          let newState: GameState;
          const meldAction = decision.meldAction;

          if (meldAction.type === 'hu') {
            newState = setWinner(state, state.currentPlayer);
          } else if (meldAction.type === 'peng') {
            const handTileIds = meldAction.tiles.map(t => t.id);
            newState = playerPeng(state, state.currentPlayer, handTileIds, meldAction.meld.tiles);
          } else if (meldAction.type === 'gang') {
            const handTileIds = meldAction.tiles.map(t => t.id);
            newState = playerGang(state, state.currentPlayer, handTileIds, meldAction.meld.tiles);
          } else if (meldAction.type === 'chi') {
            const handTileIds = meldAction.tiles.map(t => t.id);
            newState = playerChi(state, state.currentPlayer, handTileIds, meldAction.meld.tiles);
          } else {
            newState = skipAction(state);
          }

          set({ state: newState });

          if (newState.phase === GamePhase.PLAYING && newState.currentPlayer !== 0) {
            setTimeout(() => get().executeAITurn(), 500);
          } else {
            set({ isAITurn: false });
          }
          return;
        }
      }

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
