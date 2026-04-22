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
  compensateFlowers,
  checkFlowerWin,
  getRemainingTiles,
} from '../core/game';
import { drawTile } from '../core/wall';
import { createAI } from '../ai';
import { createLLMAgent } from '../ai/llm/agent';
import { AIDecision } from '../ai/base';
import { calculateShanten } from '../ai/helpers';
import { canWinByClaimingDiscard, checkWin } from '../core/win';
import { Tile, Suit, isSameTile } from '../core/tile';
import { getChiOptions, getPengOption, getGangOption, getAvailableActions, getSelfDrawnActions, MeldAction } from '../core/meld';
import { calculateScoreBreakdown } from '../core/score';

let humanAssistAutoPlayTimeout: ReturnType<typeof setTimeout> | null = null;

const RESET_ASSIST_TRANSIENT_STATE: Pick<GameStore, 'currentHint' | 'isHintLoading' | 'hintTurnId'> = {
  currentHint: null,
  isHintLoading: false,
  hintTurnId: '',
};

export type AIDifficulty = 'easy' | 'normal' | 'hard';
export type AIMode = 'algorithm' | 'llm' | 'hybrid';
export type TileSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'auto';
export type AssistMode = 'none' | 'hint' | 'auto';
export type HumanAiMode = 'algorithm' | 'llm';
export type HumanAssistHint = { action: string; tile?: Tile; meldAction?: MeldAction; reason?: string } | null;

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
  assistMode: AssistMode;
  humanAiMode: HumanAiMode;
  autoPlayDelay: number;
  soundEnabled: boolean;
  tileSize: TileSize;
  isAITurn: boolean;
  selectedTileId: string | null;
  lastDrawnTileId: string | null;
  llmConfig: LLMConfigData | null;
  hybridConfig: HybridConfig;
  isLLMThinking: boolean;
  chiOptionSelect: MeldAction[];
  currentHint: HumanAssistHint;
  isHintLoading: boolean;
  hintTurnId: string;

  startNewGame: () => void;
  setDifficulty: (d: AIDifficulty) => void;
  setAIMode: (m: AIMode) => void;
  setAssistMode: (m: AssistMode) => void;
  setHumanAiMode: (m: HumanAiMode) => void;
  setAutoPlayDelay: (delay: number) => void;
  setSoundEnabled: (e: boolean) => void;
  setTileSize: (s: TileSize) => void;
  setLLMConfig: (c: LLMConfigData | null) => void;
  setHybridConfig: (c: Partial<HybridConfig>) => void;

  selectTile: (tileId: string | null) => void;
  drawTile: () => void;
  discardTile: (tileId: string) => void;
  passAction: () => void;
  chiAction: () => void;
  chiActionWithOption: (option: MeldAction) => void;
  pengAction: () => void;
  gangAction: () => void;
  winAction: () => void;
  confirmReveal: () => void;
  executeAITurn: () => Promise<void>;
  cancelAutoPlay: () => void;
  startAITurnIfNeeded: () => void;
  startHumanAssistIfNeeded: () => void;
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
    // Ignore invalid localStorage data.
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
    // Ignore localStorage write failures.
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
    // Ignore invalid localStorage data.
  }
  return DEFAULT_HYBRID_CONFIG;
}

function saveHybridConfig(config: HybridConfig): void {
  try {
    localStorage.setItem(HYBRID_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Ignore localStorage write failures.
  }
}

const TILE_SIZE_STORAGE_KEY = 'mahjong-tile-size';
const DEFAULT_TILE_SIZE: TileSize = 'auto';

function loadTileSize(): TileSize {
  try {
    const stored = localStorage.getItem(TILE_SIZE_STORAGE_KEY);
    if (stored) {
      const size = stored as TileSize;
      if (['xs', 'sm', 'md', 'lg', 'xl', 'auto'].includes(size)) {
        return size;
      }
    }
  } catch {
    // Ignore invalid localStorage data.
  }
  return DEFAULT_TILE_SIZE;
}

function saveTileSize(size: TileSize): void {
  try {
    localStorage.setItem(TILE_SIZE_STORAGE_KEY, size);
  } catch {
    // Ignore localStorage write failures.
  }
}

function clearHumanAssistAutoPlayTimeout(): void {
  if (humanAssistAutoPlayTimeout) {
    clearTimeout(humanAssistAutoPlayTimeout);
    humanAssistAutoPlayTimeout = null;
  }
}

function clearPendingAssist(set: (state: Partial<GameStore>) => void): void {
  clearHumanAssistAutoPlayTimeout();
  set(RESET_ASSIST_TRANSIENT_STATE);
}

function isHumanAssistableTurn(state: GameState): boolean {
  return (
    state.phase === GamePhase.PLAYING &&
    state.currentPlayer === 0 &&
    (state.turnAction === 'discard' || state.turnAction === 'waiting' || state.turnAction === 'draw')
  );
}

function syncHumanAssistAfterTransition(
  set: (state: Partial<GameStore>) => void,
  get: () => GameStore,
  state: GameState
): void {
  clearPendingAssist(set);

  if (!isHumanAssistableTurn(state)) {
    return;
  }

  setTimeout(() => get().startHumanAssistIfNeeded(), 0);
}

function getCurrentSelfDrawnTile(state: GameStore): Tile | null {
  if (!state.lastDrawnTileId) {
    return null;
  }

  return state.state.players[0].hand.find((tile) => tile.id === state.lastDrawnTileId) ?? null;
}

function executeHumanSelfDrawnKong(
  set: (state: Partial<GameStore>) => void,
  get: () => GameStore,
  state: GameState,
  meldAction: MeldAction
): void {
  const humanPlayer = state.players[0];

  if (meldAction.type === 'angang') {
    const tileIdsToRemove = new Set(meldAction.tiles.map((tile) => tile.id));
    const updatedHand = humanPlayer.hand.filter((tile) => !tileIdsToRemove.has(tile.id));
    const updatedMelds = [...humanPlayer.melds, meldAction.meld];
    const drawResult = drawTile(state.wall);
    const players = [...state.players];
    const replacementTile = drawResult.tile;

    if (replacementTile) {
      updatedHand.push(replacementTile);
    }

    players[0] = {
      ...humanPlayer,
      hand: updatedHand,
      melds: updatedMelds,
    };

    const newState: GameState = {
      ...state,
      wall: drawResult.wall,
      players,
      turnAction: 'discard',
      lastAction: 'angang',
      lastMeldAction: replacementTile
        ? {
            type: 'gang',
            player: 0,
            tile: replacementTile,
          }
        : undefined,
    };

    set({
      state: newState,
      selectedTileId: null,
      lastDrawnTileId: replacementTile ? replacementTile.id : null,
    });
    syncHumanAssistAfterTransition(set, get, newState);
    return;
  }

  const drawnTileId = get().lastDrawnTileId;
  const drawnTile = humanPlayer.hand.find((tile) => tile.id === drawnTileId) ?? meldAction.tiles[0];
  const oldPeng = humanPlayer.melds.find(
    (meld) => meld.type === 'peng' && isSameTile(meld.tiles[0], drawnTile)
  );

  if (!oldPeng) {
    return;
  }

  const updatedHand = humanPlayer.hand.filter((tile) => tile.id !== drawnTile.id);
  const updatedMelds = [
    ...humanPlayer.melds.filter((meld) => meld !== oldPeng),
    meldAction.meld,
  ];
  const players = [...state.players];

  players[0] = {
    ...humanPlayer,
    hand: updatedHand,
    melds: updatedMelds,
  };

  const newState: GameState = {
    ...state,
    players,
    turnAction: 'discard',
    lastAction: 'gang',
    lastMeldAction: {
      type: 'gang',
      player: 0,
      tile: drawnTile,
    },
  };

  set({
    state: newState,
    selectedTileId: null,
    lastDrawnTileId: null,
  });
  syncHumanAssistAfterTransition(set, get, newState);
}

export const useGameStore = create<GameStore>((set, get) => ({
  state: createInitialState(),
  difficulty: 'hard',
  aiMode: 'algorithm',
  assistMode: 'none',
  humanAiMode: 'algorithm',
  autoPlayDelay: 1500,
  soundEnabled: true,
  tileSize: loadTileSize(),
  isAITurn: false,
  selectedTileId: null,
  lastDrawnTileId: null,
  llmConfig: loadLLMConfig(),
  hybridConfig: loadHybridConfig(),
  isLLMThinking: false,
  chiOptionSelect: [],
  currentHint: null,
  isHintLoading: false,
  hintTurnId: '',

  startNewGame: () => {
    let newState = startGameCore(createInitialState());

    // 檢查是否有花牌胡牌（七搶一或八仙過海）
    const flowerWinResult = checkFlowerWin(newState);
    if (flowerWinResult.winner !== null) {
      newState = setWinner(newState, flowerWinResult.winner, 'flower');
    }

    clearPendingAssist(set);

    set({
      state: newState,
      selectedTileId: null,
      lastDrawnTileId: null,
      isAITurn: false,
      isLLMThinking: false,
      chiOptionSelect: [],
    });

    if (newState.currentPlayer !== 0 && newState.phase !== GamePhase.REVEAL) {
      setTimeout(() => get().startAITurnIfNeeded(), 500);
    } else {
      syncHumanAssistAfterTransition(set, get, newState);
    }
  },

  setDifficulty: (difficulty) => set({ difficulty }),
  setAIMode: (aiMode) => set({ aiMode }),
  setAssistMode: (assistMode) => {
    clearPendingAssist(set);
    set({ assistMode });

    if (assistMode !== 'none' && isHumanAssistableTurn(get().state)) {
      setTimeout(() => get().startHumanAssistIfNeeded(), 0);
    }
  },
  setHumanAiMode: (humanAiMode) => set({ humanAiMode }),
  setAutoPlayDelay: (autoPlayDelay) => set({ autoPlayDelay }),
  setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
  setTileSize: (tileSize) => {
    saveTileSize(tileSize);
    set({ tileSize });
  },
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

    // 檢查流局條件（鐵八墩規則：剩餘牌數 <= 16 張時流局）
    if (getRemainingTiles(state) <= 16) {
      clearPendingAssist(set);
      set({
        state: {
          ...state,
          phase: GamePhase.REVEAL,
          winner: null,
          winType: null,
        },
      });
      return;
    }

    const drawnResult = drawTile(state.wall);
    if (drawnResult.tile === null) {
      clearPendingAssist(set);
      set({
        state: {
          ...state,
          phase: GamePhase.REVEAL,
          winner: null,
          winType: null,
        },
      });
      return;
    }

    const drawnTile = drawnResult.tile;
    const newWall = drawnResult.wall;

    const players = [...state.players];
    players[0] = { ...players[0], hand: [...players[0].hand, drawnTile] };

    let newState: GameState = {
      ...state,
      wall: newWall,
      players,
      turnAction: 'discard',
      lastAction: 'draw',
    };

    // 摸牌後檢查並補花
    newState = compensateFlowers(newState);

    // 檢查花牌胡牌（七搶一或八仙過海）
    const flowerWinResult = checkFlowerWin(newState);
    if (flowerWinResult.winner !== null) {
      newState = setWinner(newState, flowerWinResult.winner, 'flower');
      clearPendingAssist(set);
    }

    set({ state: newState, selectedTileId: null, lastDrawnTileId: drawnTile.id });
    syncHumanAssistAfterTransition(set, get, newState);
  },

  discardTile: (tileId) => {
    clearPendingAssist(set);

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
    clearPendingAssist(set);
    const { state } = get();
    const newState = skipAction(state);

    // 檢查是否需要進入流局（鐵八墩規則：剩餘牌數 <= 16 張時流局）
    if (newState.phase === GamePhase.PLAYING && newState.turnAction === 'draw') {
      if (getRemainingTiles(newState) <= 16) {
        set({
          state: {
            ...newState,
            phase: GamePhase.REVEAL,
            winner: null,
            winType: null,
          },
          chiOptionSelect: [],
        });
        return;
      }
    }

    set({ state: newState, chiOptionSelect: [] });

    if (newState.phase === GamePhase.PLAYING && newState.currentPlayer !== 0) {
      setTimeout(() => get().startAITurnIfNeeded(), 300);
    } else {
      syncHumanAssistAfterTransition(set, get, newState);
    }
  },

  chiAction: () => {
    clearPendingAssist(set);

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
    syncHumanAssistAfterTransition(set, get, newState);
  },

  chiActionWithOption: (chiOption: MeldAction) => {
    clearPendingAssist(set);

    const { state } = get();
    if (state.phase !== GamePhase.PLAYING) return;
    if (state.turnAction !== 'waiting') return;
    if (!state.lastDiscard || state.lastDiscardPlayer === null) return;

    const handTileIds = chiOption.tiles.map(t => t.id);
    const newState = playerChi(state, 0, handTileIds, chiOption.meld.tiles);

    set({ state: newState, selectedTileId: null, lastDrawnTileId: null, chiOptionSelect: [] });
    syncHumanAssistAfterTransition(set, get, newState);
  },

  pengAction: () => {
    clearPendingAssist(set);

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
    syncHumanAssistAfterTransition(set, get, newState);
  },

  gangAction: () => {
    clearPendingAssist(set);

    const { state } = get();
    if (state.phase !== GamePhase.PLAYING) return;
    if (state.turnAction !== 'waiting') return;
    if (!state.lastDiscard || state.lastDiscardPlayer === null) return;

    const humanPlayer = state.players[0];
    const gangOption = getGangOption(humanPlayer, state.lastDiscard);

    if (!gangOption) return;

    const handTileIds = gangOption.tiles.map((t: Tile) => t.id);
    const newState = playerGang(state, 0, handTileIds, gangOption.meld.tiles);

    set({ state: newState, selectedTileId: null, lastDrawnTileId: null, chiOptionSelect: [] });
    syncHumanAssistAfterTransition(set, get, newState);
  },

  winAction: () => {
    clearPendingAssist(set);

    const { state } = get();
    if (state.phase !== GamePhase.PLAYING) return;

    const winType = state.turnAction === 'discard' ? 'zimo' : 'dianpao';
    const newState = setWinner(state, 0, winType);
    set({ state: newState, selectedTileId: null });
  },

  confirmReveal: () => {
    const { state } = get();
    if (state.phase !== GamePhase.REVEAL) return;

    const players = [...state.players];
    let finalBreakdown = undefined;

    if (state.winner !== null) {
      const winner = players[state.winner];
      const winType = state.winType === 'zimo' ? 'zimo' : undefined;
      const scoreResult = calculateScoreBreakdown(winner.hand, winner.melds, winType);
      finalBreakdown = scoreResult;

      players[state.winner] = {
        ...winner,
        score: winner.score + scoreResult.total,
      };
    }

    const newState: GameState = {
      ...state,
      phase: GamePhase.GAME_OVER,
      winScoreBreakdown: finalBreakdown,
      players,
    };

    clearPendingAssist(set);
    set({ state: newState, lastDrawnTileId: null });
  },

  cancelAutoPlay: () => {
    clearPendingAssist(set);
    set({ assistMode: 'none' });
  },

  startAITurnIfNeeded: () => {
    const { state } = get();
    if (state.phase !== GamePhase.PLAYING) return;
    if (state.currentPlayer === 0) return;

    set({ isAITurn: true });
    get().executeAITurn();
  },

  startHumanAssistIfNeeded: () => {
    const { state, assistMode, humanAiMode, llmConfig, difficulty, autoPlayDelay } = get();

    if (assistMode === 'none') return;
    if (state.phase !== GamePhase.PLAYING) return;
    if (state.currentPlayer !== 0) return;

    if (state.turnAction === 'draw') {
      if (assistMode === 'auto') {
        clearHumanAssistAutoPlayTimeout();
        const turnId = `draw-${state.currentPlayer}-${Date.now()}-${Math.random()}`;
        set({ hintTurnId: turnId });

        // 摸牌動作不需要太長的延遲，固定 800ms 讓節奏順暢即可
        const autoPlayTimeout = setTimeout(() => {
          if (humanAssistAutoPlayTimeout === autoPlayTimeout) {
            humanAssistAutoPlayTimeout = null;
          }

          const currentStore = get();
          if (
            currentStore.hintTurnId === turnId &&
            currentStore.assistMode === 'auto' &&
            currentStore.state.phase === GamePhase.PLAYING &&
            currentStore.state.currentPlayer === 0 &&
            currentStore.state.turnAction === 'draw'
          ) {
            currentStore.drawTile();
          }
        }, 800);
        humanAssistAutoPlayTimeout = autoPlayTimeout;
      }
      return; // 摸牌階段不論是提示或託管，都不需要進行 AI 算牌
    }

    if (state.turnAction !== 'discard' && state.turnAction !== 'waiting') return;

    clearHumanAssistAutoPlayTimeout();

    const humanPlayer = state.players[0];
    const currentSelfDrawnTile = getCurrentSelfDrawnTile(get());
    const turnId = `${state.turnAction}-${state.currentPlayer}-${Date.now()}-${Math.random()}`;

    set({
      hintTurnId: turnId,
      isHintLoading: true,
      currentHint: null,
    });

    if (state.turnAction === 'discard') {
      const startDiscardAssist = () => {
        const hintPromise = humanAiMode === 'llm' && llmConfig
          ? createLLMAgent({
              provider: llmConfig.provider,
              apiKey: llmConfig.apiKey,
              model: llmConfig.model,
            }, difficulty).decide(humanPlayer, state)
          : createAI(difficulty).decideDiscard(humanPlayer, state).then((tile) => ({ tile, reasoning: null }));

        void hintPromise
          .then((result) => {
            const currentStore = get();
            const currentState = currentStore.state;

            if (
              currentStore.hintTurnId !== turnId ||
              currentState.phase !== GamePhase.PLAYING ||
              currentState.currentPlayer !== 0 ||
              currentState.turnAction !== 'discard'
            ) {
              return;
            }

            const { tile, reasoning } = result;
            set({
              currentHint: {
                action: '出牌',
                tile,
                reason: reasoning ?? undefined,
              },
              isHintLoading: false,
            });

            if (currentStore.assistMode === 'auto') {
              clearHumanAssistAutoPlayTimeout();
              const autoPlayTimeout = setTimeout(() => {
                if (humanAssistAutoPlayTimeout === autoPlayTimeout) {
                  humanAssistAutoPlayTimeout = null;
                }

                const latestStore = get();
                const latestState = latestStore.state;

                if (
                  latestStore.assistMode !== 'auto' ||
                  latestStore.hintTurnId !== turnId ||
                  latestState.phase !== GamePhase.PLAYING ||
                  latestState.currentPlayer !== 0 ||
                  latestState.turnAction !== 'discard'
                ) {
                  return;
                }

                latestStore.discardTile(tile.id);
              }, currentStore.autoPlayDelay);
              humanAssistAutoPlayTimeout = autoPlayTimeout;
            }
          })
          .catch((error) => {
            console.error('Human assist discard error:', error);

            const currentStore = get();
            const currentState = currentStore.state;

            if (
              currentStore.hintTurnId !== turnId ||
              currentState.phase !== GamePhase.PLAYING ||
              currentState.currentPlayer !== 0 ||
              currentState.turnAction !== 'discard'
            ) {
              return;
            }

            set({ isHintLoading: false, currentHint: null });
          });
      };

    const winResult = checkWin(humanPlayer.hand, humanPlayer.melds);
    if (winResult.isWin) {
      clearHumanAssistAutoPlayTimeout();
      const zimoTurnId = `${state.turnAction}-${state.currentPlayer}-${Date.now()}-${Math.random()}`;

      set({
        hintTurnId: zimoTurnId,
        currentHint: {
          action: '胡牌',
          reason: '已達成自摸條件。',
        },
        isHintLoading: false,
      });

      if (assistMode === 'auto') {
        const autoPlayTimeout = setTimeout(() => {
          if (humanAssistAutoPlayTimeout === autoPlayTimeout) {
            humanAssistAutoPlayTimeout = null;
          }

          const currentStore = get();
          const currentState = currentStore.state;

          if (
            currentStore.hintTurnId !== zimoTurnId ||
            currentStore.assistMode !== 'auto' ||
            currentState.phase !== GamePhase.PLAYING ||
            currentState.currentPlayer !== 0 ||
            currentState.turnAction !== 'discard'
          ) {
            return;
          }

          currentStore.winAction();
        }, autoPlayDelay);
        humanAssistAutoPlayTimeout = autoPlayTimeout;
      }

      return;
    }

      if (currentSelfDrawnTile) {
        const selfDrawnActions = getSelfDrawnActions(humanPlayer, currentSelfDrawnTile);

        if (selfDrawnActions.length > 0) {
          const selfDrawnDecisionPromise = humanAiMode === 'llm' && llmConfig
            ? createLLMAgent({
                provider: llmConfig.provider,
                apiKey: llmConfig.apiKey,
                model: llmConfig.model,
              }, difficulty).decideSelfDrawn(humanPlayer, selfDrawnActions, state)
            : createAI(difficulty).decideSelfDrawn(humanPlayer, selfDrawnActions, state);

          void selfDrawnDecisionPromise
            .then((decision) => {
              const currentStore = get();
              const currentState = currentStore.state;

              if (
                currentStore.hintTurnId !== turnId ||
                currentState.phase !== GamePhase.PLAYING ||
                currentState.currentPlayer !== 0 ||
                currentState.turnAction !== 'discard'
              ) {
                return;
              }

              if (decision.action === 'meld' && decision.meldAction) {
                const meldAction = decision.meldAction;
                let hint: HumanAssistHint;

                if (meldAction.type === 'angang') {
                  hint = {
                    action: '槓',
                    meldAction,
                    reason: humanAiMode === 'llm'
                      ? 'AI 助手建議先進行暗槓。'
                      : '演算法建議先進行暗槓。',
                  };
                } else if (meldAction.type === 'gang') {
                  hint = {
                    action: '槓',
                    meldAction,
                    reason: humanAiMode === 'llm'
                      ? 'AI 助手建議先進行補槓。'
                      : '演算法建議先進行補槓。',
                  };
                } else {
                  startDiscardAssist();
                  return;
                }

                set({ currentHint: hint, isHintLoading: false });

                if (assistMode === 'auto') {
                  clearHumanAssistAutoPlayTimeout();
                  const autoPlayTimeout = setTimeout(() => {
                    if (humanAssistAutoPlayTimeout === autoPlayTimeout) {
                      humanAssistAutoPlayTimeout = null;
                    }

                    const currentStore = get();
                    const currentState = currentStore.state;

                    if (
                      currentStore.hintTurnId !== turnId ||
                      currentStore.assistMode !== 'auto' ||
                      currentState.phase !== GamePhase.PLAYING ||
                      currentState.currentPlayer !== 0 ||
                      currentState.turnAction !== 'discard'
                    ) {
                      return;
                    }

                    executeHumanSelfDrawnKong(set, get, currentState, meldAction);
                  }, currentStore.autoPlayDelay);
                  humanAssistAutoPlayTimeout = autoPlayTimeout;
                }

                return;
              }

              startDiscardAssist();
            })
            .catch((error) => {
              console.error('Human assist self-drawn error:', error);
              startDiscardAssist();
            });
          return;
        }
      }

      startDiscardAssist();
      return;
    }

    const lastDiscard = state.lastDiscard;
    const lastDiscardPlayer = state.lastDiscardPlayer;
    if (!lastDiscard || lastDiscardPlayer === null) {
      set({ isHintLoading: false, currentHint: null });
      return;
    }

    const canWin = canWinByClaimingDiscard(humanPlayer.hand, humanPlayer.melds, lastDiscard);
    const availableActions = getAvailableActions(
      humanPlayer,
      lastDiscard,
      state.players[lastDiscardPlayer].id,
      humanPlayer.id,
      canWin
    );

    const waitingDecisionPromise = humanAiMode === 'llm' && llmConfig
      ? createLLMAgent({
          provider: llmConfig.provider,
          apiKey: llmConfig.apiKey,
          model: llmConfig.model,
        }, difficulty).decideMeld(humanPlayer, availableActions, state)
      : createAI(difficulty).decideMeld(humanPlayer, availableActions, state);

    void waitingDecisionPromise
      .then((decision) => {
        const currentStore = get();
        const currentState = currentStore.state;

        if (
          currentStore.hintTurnId !== turnId ||
          currentState.phase !== GamePhase.PLAYING ||
          currentState.currentPlayer !== 0 ||
          currentState.turnAction !== 'waiting' ||
          !currentState.lastDiscard ||
          currentState.lastDiscardPlayer === null
        ) {
          return;
        }

        let hint: HumanAssistHint;
        if (decision.action === 'meld' && decision.meldAction) {
          if (decision.meldAction.type === 'hu') {
            hint = { action: '胡牌' };
          } else if (decision.meldAction.type === 'peng') {
            hint = { action: '碰', meldAction: decision.meldAction };
          } else if (decision.meldAction.type === 'gang') {
            hint = { action: '槓', meldAction: decision.meldAction };
          } else if (decision.meldAction.type === 'chi') {
            hint = { action: '吃', meldAction: decision.meldAction };
          } else {
            hint = { action: '過' };
          }
        } else {
          hint = { action: '過' };
        }

        if (get().hintTurnId !== turnId) {
          return;
        }

        set({ currentHint: hint, isHintLoading: false });

        if (currentStore.assistMode === 'auto') {
          clearHumanAssistAutoPlayTimeout();
          const autoPlayTimeout = setTimeout(() => {
            if (humanAssistAutoPlayTimeout === autoPlayTimeout) {
              humanAssistAutoPlayTimeout = null;
            }

            const latestStore = get();
            const latestState = latestStore.state;

            if (
              latestStore.assistMode !== 'auto' ||
              latestStore.hintTurnId !== turnId ||
              latestState.phase !== GamePhase.PLAYING ||
              latestState.currentPlayer !== 0 ||
              latestState.turnAction !== 'waiting' ||
              !latestState.lastDiscard ||
              latestState.lastDiscardPlayer === null
            ) {
              return;
            }

            if (hint.action === '胡牌') {
              latestStore.winAction();
            } else if (hint.action === '碰') {
              latestStore.pengAction();
            } else if (hint.action === '槓') {
              latestStore.gangAction();
            } else if (hint.action === '吃' && hint.meldAction) {
              latestStore.chiActionWithOption(hint.meldAction);
            } else {
              latestStore.passAction();
            }
          }, currentStore.autoPlayDelay);
          humanAssistAutoPlayTimeout = autoPlayTimeout;
        }
      })
      .catch((error) => {
        console.error('Human assist waiting error:', error);

        const currentStore = get();
        const currentState = currentStore.state;

        if (
          currentStore.hintTurnId !== turnId ||
          currentState.phase !== GamePhase.PLAYING ||
          currentState.currentPlayer !== 0 ||
          currentState.turnAction !== 'waiting' ||
          !currentState.lastDiscard ||
          currentState.lastDiscardPlayer === null
        ) {
          return;
        }

        set({ isHintLoading: false, currentHint: null });
      });
  },

  executeAITurn: async () => {
    const { state, difficulty, aiMode, llmConfig, hybridConfig } = get();
    if (state.phase !== GamePhase.PLAYING) return;
    if (state.currentPlayer === 0) {
      set({ isAITurn: false });
      return;
    }

    if (state.turnAction === 'draw') {
      // 檢查流局條件（鐵八墩規則：剩餘牌數 <= 16 張時流局）
      if (getRemainingTiles(state) <= 16) {
        clearPendingAssist(set);
        set({
          state: {
            ...state,
            phase: GamePhase.REVEAL,
            winner: null,
            winType: null,
          },
          isAITurn: false,
        });
        return;
      }

      // AI draws a tile
      let newState = nextTurn(state);
      if (newState.phase === GamePhase.GAME_OVER) {
        clearPendingAssist(set);
        set({ state: newState, isAITurn: false });
        return;
      }

      // AI 摸牌後檢查並補花
      newState = compensateFlowers(newState);

       // 檢查花牌胡牌（七搶一或八仙過海）
        const flowerWinResult = checkFlowerWin(newState);
        if (flowerWinResult.winner !== null) {
          newState = setWinner(newState, flowerWinResult.winner, 'flower');
          clearPendingAssist(set);
          set({ state: newState, isAITurn: false });
          return;
        }

      // Get the drawn tile (the tile at wall.position - 1 is the last drawn)
      const drawnTile = newState.wall.tiles[newState.wall.position - 1];
      const aiPlayer = getCurrentPlayer(newState);

      // DEBUG: log AI hand status after drawing
      const { calculateShanten } = await import('../ai/helpers');
      const aiShanten = calculateShanten(aiPlayer.hand);
      const aiMelds = aiPlayer.melds.length;
      const aiHandSize = aiPlayer.hand.length;
      const aiMeldTiles = aiPlayer.melds.reduce((s, m) => s + m.tiles.length, 0);
      const tileStr = (t: Tile) => `${t.suit[0]}${t.value}`;
      console.log(`[DEBUG AI #${newState.currentPlayer}] drawn=${drawnTile?.id} handSize=${aiHandSize} melds=${aiMelds}(${aiMeldTiles}tiles) total=${aiHandSize+aiMeldTiles} shanten=${aiShanten}`);
      console.log(`[DEBUG AI #${newState.currentPlayer} hand]`, aiPlayer.hand.map(tileStr).join(' '), '| melds:', aiPlayer.melds.map(m => m.type + ':' + m.tiles.map(tileStr).join('')).join(' '));

      // Check for self-drawn win (自摸) before other actions
      const winResult = checkWin(aiPlayer.hand, aiPlayer.melds);
      if (winResult.isWin) {
        const winState = setWinner(newState, newState.currentPlayer, 'zimo');
        clearPendingAssist(set);
        set({ state: winState, isAITurn: false });
        return;
      }

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
            const winState = setWinner(newState, newState.currentPlayer, 'zimo');
            clearPendingAssist(set);
            set({ state: winState, isAITurn: false });
            return;
          } else if (meldAction.type === 'angang') {
            // Execute angang (concealed kong): remove 4 tiles from hand, add meld, draw replacement tile
            // For angang, no existing meld to replace - just add new meld
            let wall = newState.wall;
            const players = [...newState.players];
            const player = players[newState.currentPlayer];

            const tileIdsToRemove = meldAction.tiles.map(t => t.id);
            const updatedHand = player.hand.filter(t => !tileIdsToRemove.includes(t.id));

            const updatedMelds = [...player.melds, meldAction.meld];

            const drawResult = drawTile(wall);
            if (drawResult.tile) {
              updatedHand.push(drawResult.tile);
              wall = drawResult.wall;
            }

            players[newState.currentPlayer] = {
              ...player,
              hand: updatedHand,
              melds: updatedMelds,
            };

            const meldState: GameState = {
              ...newState,
              wall,
              players,
              turnAction: 'discard',
              lastAction: meldAction.type,
              lastMeldAction: {
                type: 'gang',
                player: newState.currentPlayer,
                tile: drawnTile!,
              },
            };

            set({ state: meldState });
            setTimeout(() => get().executeAITurn(), 800);
            return;
          } else if (meldAction.type === 'gang' && meldAction.meld.source === 'self') {
            // Upgrade peng to gang (補槓): replace existing peng with gang
            // The meldAction.meld.tiles = [...oldPeng.tiles, drawnTile] = 4 tiles
            // We must remove the old peng AND add the new gang
            const players = [...newState.players];
            const player = players[newState.currentPlayer];

            // Find and remove the old peng meld that matches the drawn tile
            const oldPeng = player.melds.find(
              m => m.type === 'peng' && isSameTile(m.tiles[0], drawnTile!)
            );
            if (!oldPeng) {
              console.error('[ERROR] Upgrade peng to gang but no matching peng found');
              return;
            }

            // Remove the drawn tile from hand (it was already added to hand in draw phase)
            const updatedHand = player.hand.filter(t => t.id !== drawnTile!.id);

            // Remove old peng meld, add new gang meld
            const updatedMelds = [
              ...player.melds.filter(m => m !== oldPeng),
              meldAction.meld,
            ];

            // 補槓：補完後要摸牌，但補槓本身就是摸牌後的動作，已經在 hand 裡了
            // 不需要再補一張，直接進入丢牌階段
            players[newState.currentPlayer] = {
              ...player,
              hand: updatedHand,
              melds: updatedMelds,
            };

            const meldState: GameState = {
              ...newState,
              players,
              turnAction: 'discard',
              lastAction: 'gang',
              lastMeldAction: {
                type: 'gang',
                player: newState.currentPlayer,
                tile: drawnTile!,
              },
            };

            set({ state: meldState });
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
            // DEBUG: log discard decision result
            const aiPlayerIdx = state.currentPlayer;
            const afterHand = newState.players[aiPlayerIdx].hand;
            const tileStr = (t: Tile) => `${t.suit[0]}${t.value}`;
            console.log(`[DEBUG discardResult #${aiPlayerIdx}] discarded=${tileToDiscard.id} beforeSize=${aiPlayer.hand.length} afterSize=${afterHand.length} shanten=${calculateShanten(afterHand)} hand=${afterHand.map(tileStr).join(' ')}`);
            set({ state: newState });

            if (newState.phase === GamePhase.PLAYING) {
              if (newState.currentPlayer === 0) {
                set({ isAITurn: false });
                syncHumanAssistAfterTransition(set, get, newState);
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

        llmAgent.decide(aiPlayer, state).then((result) => {
          const currentState = get().state;
          if (currentState.phase !== GamePhase.PLAYING) {
            set({ isLLMThinking: false, isAITurn: false });
            return;
          }

          const newState = aiDiscardTile(currentState, result.tile);
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
          syncHumanAssistAfterTransition(set, get, newState);
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

          llmAgent.decide(aiPlayer, state).then((result) => {
            const currentState = get().state;
            if (currentState.phase !== GamePhase.PLAYING) {
              set({ isLLMThinking: false, isAITurn: false });
              return;
            }

            const newState = aiDiscardTile(currentState, result.tile);
          set({ state: newState, isLLMThinking: false });

          if (newState.phase === GamePhase.PLAYING) {
            if (newState.currentPlayer === 0) {
              set({ isAITurn: false });
              syncHumanAssistAfterTransition(set, get, newState);
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
              syncHumanAssistAfterTransition(set, get, newState);
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
                  syncHumanAssistAfterTransition(set, get, newState);
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
        syncHumanAssistAfterTransition(set, get, newState);
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
            newState = setWinner(state, state.currentPlayer, 'dianpao');
            clearPendingAssist(set);
            set({ state: newState, isAITurn: false });
            return;
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

          // Bug fix: check for win after forming meld from discard (peng/chi/gang).
          // This handles the case where forming a meld completes a winning hand.
          if (meldAction.type === 'peng' || meldAction.type === 'gang' || meldAction.type === 'chi') {
            const afterMeldPlayer = newState.players[newState.currentPlayer];
            const winResult = checkWin(afterMeldPlayer.hand, afterMeldPlayer.melds);
            if (winResult.isWin) {
              const winState = setWinner(newState, newState.currentPlayer, 'zimo');
              clearPendingAssist(set);
              set({ state: winState, isAITurn: false });
              return;
            }
          }

          set({ state: newState });

          if (newState.phase === GamePhase.PLAYING && newState.currentPlayer !== 0) {
            setTimeout(() => get().executeAITurn(), 500);
          } else {
            set({ isAITurn: false });
            syncHumanAssistAfterTransition(set, get, newState);
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
        syncHumanAssistAfterTransition(set, get, newState);
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
    syncHumanAssistAfterTransition(set, get, newState);
  } else {
    set({ isAITurn: false });
  }
}
