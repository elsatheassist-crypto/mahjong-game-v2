import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as aiModule from '../ai';
import * as llmAgentModule from '../ai/llm/agent';
import { callLLM } from '../ai/llm/providers';
import type { AIAgent, AIDecision } from '../ai/base';
import { createInitialState, GamePhase, type GameState } from '../core/game';
import type { MeldAction } from '../core/meld';
import { Suit, createTile, type Tile } from '../core/tile';
import { useGameStore } from '../stores/gameStore';

vi.mock('../ai/llm/providers', () => ({
  callLLM: vi.fn(),
}));

const TEST_TILE: Tile = {
  id: 'test-tile',
  suit: Suit.WAN,
  value: 1,
};

const baseCreateAI = (): AIAgent => ({
  config: { difficulty: 'normal', thinkTimeMin: 0, thinkTimeMax: 0 },
  decideDiscard: vi.fn(),
  decideMeld: vi.fn().mockResolvedValue({ action: 'pass' } satisfies AIDecision),
  decideSelfDrawn: vi.fn().mockResolvedValue({ action: 'pass' } satisfies AIDecision),
  getThinkTime: vi.fn().mockReturnValue(0),
});

function flushMicrotasks(): Promise<void> {
  return Promise.resolve().then(() => undefined);
}

function createWaitingState(lastDiscard: Tile = createTile(Suit.WAN, 3)): GameState {
  const humanHand = [
    createTile(Suit.WAN, 1),
    createTile(Suit.WAN, 2),
    createTile(Suit.WAN, 4),
    createTile(Suit.WAN, 5),
    createTile(Suit.WAN, 3),
    createTile(Suit.WAN, 3),
    createTile(Suit.WAN, 3),
    createTile(Suit.TIAO, 1),
    createTile(Suit.TIAO, 2),
    createTile(Suit.TIAO, 3),
    createTile(Suit.TONG, 1),
    createTile(Suit.TONG, 1),
    createTile(Suit.TONG, 2),
    createTile(Suit.TONG, 2),
    createTile(Suit.FENG, 1),
    createTile(Suit.FENG, 1),
  ];

  return {
    ...createInitialState(),
    phase: GamePhase.PLAYING,
    currentPlayer: 0,
    turnAction: 'waiting',
    lastDiscard,
    lastDiscardPlayer: 1,
    discardSequence: [lastDiscard],
    players: [
      {
        id: 'south',
        hand: humanHand,
        melds: [],
        discards: [],
        flowers: [],
        isHuman: true,
        score: 0,
      },
      {
        id: 'east',
        hand: [],
        melds: [],
        discards: [lastDiscard],
        flowers: [],
        isHuman: false,
        score: 0,
      },
      {
        id: 'west',
        hand: [],
        melds: [],
        discards: [],
        flowers: [],
        isHuman: false,
        score: 0,
      },
      {
        id: 'north',
        hand: [],
        melds: [],
        discards: [],
        flowers: [],
        isHuman: false,
        score: 0,
      },
    ],
  };
}

function createDiscardState(hand: Tile[] = [TEST_TILE]): GameState {
  const initialState = createInitialState();
  const players = [...initialState.players];

  players[0] = {
    ...players[0],
    hand,
  };

  return {
    ...initialState,
    phase: GamePhase.PLAYING,
    currentPlayer: 0,
    turnAction: 'discard',
    players,
  };
}

function createHumanDrawState(remainingTiles = 17): GameState {
  const initialState = createInitialState();

  return {
    ...initialState,
    phase: GamePhase.PLAYING,
    currentPlayer: 0,
    turnAction: 'draw',
    wall: {
      tiles: Array.from({ length: remainingTiles }, (_, index) =>
        createTile(Suit.WAN, (index % 9) + 1)
      ),
      position: 0,
    },
  };
}

function createAiWaitingPassToHumanWaitingState(): GameState {
  const lastDiscard = createTile(Suit.WAN, 3);
  const initialState = createInitialState();
  const players = [...initialState.players];

  players[0] = {
    ...players[0],
    hand: [
      createTile(Suit.WAN, 3),
      createTile(Suit.WAN, 3),
      createTile(Suit.WAN, 1),
      createTile(Suit.WAN, 2),
    ],
  };

  return {
    ...initialState,
    phase: GamePhase.PLAYING,
    currentPlayer: 3,
    turnAction: 'waiting',
    lastDiscard,
    lastDiscardPlayer: 2,
    discardSequence: [lastDiscard],
    players,
  };
}

function createAiWaitingPassToHumanDrawState(): GameState {
  const lastDiscard = createTile(Suit.WAN, 7);
  const initialState = createInitialState();

  return {
    ...initialState,
    phase: GamePhase.PLAYING,
    currentPlayer: 2,
    turnAction: 'waiting',
    lastDiscard,
    lastDiscardPlayer: 3,
    discardSequence: [lastDiscard],
  };
}

function installAssistSpy() {
  const assistSpy = vi.fn();
  useGameStore.setState({ startHumanAssistIfNeeded: assistSpy });
  return assistSpy;
}

describe('human assist store', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.useRealTimers();
    useGameStore.getState().cancelAutoPlay();
    useGameStore.setState(useGameStore.getInitialState(), true);
  });

  afterEach(() => {
    useGameStore.getState().cancelAutoPlay();
    vi.useRealTimers();
  });

  it('should have correct defaults', () => {
    const state = useGameStore.getState();

    expect(state.assistMode).toBe('none');
    expect(state.humanAiMode).toBe('algorithm');
    expect(state.autoPlayDelay).toBe(1500);
    expect(state.currentHint).toBeNull();
    expect(state.isHintLoading).toBe(false);
    expect(state.hintTurnId).toBe('');
  });

  it('should update assist setters without persisting to localStorage', () => {
    const { setAssistMode, setHumanAiMode, setAutoPlayDelay } = useGameStore.getState();

    setAssistMode('hint');
    setHumanAiMode('llm');
    setAutoPlayDelay(900);

    const state = useGameStore.getState();
    expect(state.assistMode).toBe('hint');
    expect(state.humanAiMode).toBe('llm');
    expect(state.autoPlayDelay).toBe(900);
    expect(localStorage.getItem('mahjong-human-assist')).toBeNull();
    expect(localStorage.length).toBe(0);
  });

  it('should allow assist hint state to be updated without persistence', () => {
    useGameStore.setState({
      currentHint: {
        action: 'discard',
        tile: TEST_TILE,
        reason: 'keep better shape',
      },
      isHintLoading: true,
      hintTurnId: 'turn-1',
    });

    const state = useGameStore.getState();
    expect(state.currentHint).toEqual({
      action: 'discard',
      tile: TEST_TILE,
      reason: 'keep better shape',
    });
    expect(state.isHintLoading).toBe(true);
    expect(state.hintTurnId).toBe('turn-1');
    expect(localStorage.length).toBe(0);
  });

  it('should resolve discard hints and delayed auto-play from algorithm decisions', async () => {
    vi.useFakeTimers();

    const mockAI = baseCreateAI();
    vi.mocked(mockAI.decideDiscard).mockResolvedValue(TEST_TILE);
    vi.spyOn(aiModule, 'createAI').mockReturnValue(mockAI);

    useGameStore.setState({
      state: createDiscardState(),
      assistMode: 'auto',
      humanAiMode: 'algorithm',
      autoPlayDelay: 25,
    });

    useGameStore.getState().startHumanAssistIfNeeded();

    expect(useGameStore.getState().isHintLoading).toBe(true);
    expect(useGameStore.getState().currentHint).toBeNull();

    await flushMicrotasks();

    let state = useGameStore.getState();
    expect(mockAI.decideDiscard).toHaveBeenCalled();
    expect(state.currentHint).toEqual({
      action: '出牌',
      tile: TEST_TILE,
      reason: '演算法建議先打出這張牌。',
    });
    expect(state.isHintLoading).toBe(false);
    expect(state.state.lastDiscard).toBeNull();

    await vi.advanceTimersByTimeAsync(24);
    expect(useGameStore.getState().state.lastDiscard).toBeNull();

    await vi.advanceTimersByTimeAsync(1);

    state = useGameStore.getState();
    expect(state.currentHint).toBeNull();
    expect(state.isHintLoading).toBe(false);
    expect(state.hintTurnId).toBe('');
    expect(state.state.lastDiscard?.id).toBe(TEST_TILE.id);
    expect(state.state.turnAction).toBe('waiting');
  });


  it('should start discard auto-play when auto mode is enabled during a human discard turn', async () => {
    vi.useFakeTimers();

    const mockAI = baseCreateAI();
    vi.mocked(mockAI.decideDiscard).mockResolvedValue(TEST_TILE);
    vi.spyOn(aiModule, 'createAI').mockReturnValue(mockAI);

    useGameStore.setState({
      state: createDiscardState(),
      assistMode: 'none',
      humanAiMode: 'algorithm',
      autoPlayDelay: 25,
    });

    useGameStore.getState().setAssistMode('auto');
    await vi.advanceTimersByTimeAsync(0);
    await flushMicrotasks();

    expect(mockAI.decideDiscard).toHaveBeenCalled();
    expect(useGameStore.getState().currentHint).toEqual({
      action: '出牌',
      tile: TEST_TILE,
      reason: '演算法建議先打出這張牌。',
    });

    await vi.advanceTimersByTimeAsync(25);

    const state = useGameStore.getState();
    expect(state.currentHint).toBeNull();
    expect(state.state.lastDiscard?.id).toBe(TEST_TILE.id);
    expect(state.state.turnAction).toBe('waiting');
  });

  it('should use llm discard fallback hints when the llm call fails', async () => {
    const mockAI = baseCreateAI();
    vi.mocked(mockAI.decideDiscard).mockResolvedValue(TEST_TILE);
    vi.spyOn(aiModule, 'createAI').mockReturnValue(mockAI);
    vi.mocked(callLLM).mockRejectedValueOnce(new Error('LLM unavailable'));

    useGameStore.setState({
      state: createDiscardState(),
      assistMode: 'hint',
      humanAiMode: 'llm',
      llmConfig: {
        provider: 'openrouter',
        apiKey: 'test-key',
        model: 'test-model',
      },
    });

    useGameStore.getState().startHumanAssistIfNeeded();
    await flushMicrotasks();
    await flushMicrotasks();

    const state = useGameStore.getState();
    expect(mockAI.decideDiscard).toHaveBeenCalled();
    expect(state.currentHint).toEqual({
      action: '出牌',
      tile: TEST_TILE,
      reason: 'AI 助手建議先打出這張牌。',
    });
    expect(state.isHintLoading).toBe(false);
  });

  it('should build waiting-phase meld hints from algorithm decisions', async () => {
    const waitingState = createWaitingState();
    const lastDiscard = waitingState.lastDiscard;
    expect(lastDiscard).toBeDefined();
    if (!lastDiscard) {
      throw new Error('Expected waiting state to include last discard');
    }
    const pengTiles = waitingState.players[0].hand.filter((tile) => tile.suit === Suit.WAN && tile.value === 3).slice(0, 2);
    const pengAction: MeldAction = {
      type: 'peng',
      tiles: pengTiles,
      meld: {
        type: 'peng',
        tiles: [...pengTiles, lastDiscard],
        source: lastDiscard,
      },
    };
    const mockAI = baseCreateAI();
    vi.mocked(mockAI.decideMeld).mockResolvedValue({ action: 'meld', meldAction: pengAction });
    vi.spyOn(aiModule, 'createAI').mockReturnValue(mockAI);

    useGameStore.setState({
      state: waitingState,
      assistMode: 'hint',
      humanAiMode: 'algorithm',
    });

    useGameStore.getState().startHumanAssistIfNeeded();
    await flushMicrotasks();

    const state = useGameStore.getState();
    expect(mockAI.decideMeld).toHaveBeenCalled();
    expect(state.currentHint).toEqual({ action: '碰', meldAction: pengAction });
    expect(state.isHintLoading).toBe(false);
  });

  it('should build waiting-phase pass hints from llm decisions', async () => {
    const mockDecideMeld = vi.fn().mockResolvedValue({ action: 'pass' } satisfies AIDecision);
    vi.spyOn(llmAgentModule, 'createLLMAgent').mockReturnValue({
      config: { difficulty: 'normal', thinkTimeMin: 0, thinkTimeMax: 0 },
      decide: vi.fn(),
      decideMeld: mockDecideMeld,
      decideSelfDrawn: vi.fn(),
    });

    useGameStore.setState({
      state: createWaitingState(),
      assistMode: 'hint',
      humanAiMode: 'llm',
      llmConfig: {
        provider: 'openrouter',
        apiKey: 'test-key',
        model: 'test-model',
      },
    });

    useGameStore.getState().startHumanAssistIfNeeded();
    await flushMicrotasks();

    const state = useGameStore.getState();
    expect(mockDecideMeld).toHaveBeenCalled();
    expect(state.currentHint).toEqual({ action: '過' });
    expect(state.isHintLoading).toBe(false);
  });

  it('should use llm waiting fallback hints when the llm response is invalid', async () => {
    const mockAI = baseCreateAI();
    vi.mocked(mockAI.decideMeld).mockResolvedValue({ action: 'pass' } satisfies AIDecision);
    vi.spyOn(aiModule, 'createAI').mockReturnValue(mockAI);
    vi.mocked(callLLM).mockResolvedValueOnce({ content: '無法解析的回覆' });

    useGameStore.setState({
      state: createWaitingState(),
      assistMode: 'hint',
      humanAiMode: 'llm',
      llmConfig: {
        provider: 'openrouter',
        apiKey: 'test-key',
        model: 'test-model',
      },
    });

    useGameStore.getState().startHumanAssistIfNeeded();
    await flushMicrotasks();
    await flushMicrotasks();

    const state = useGameStore.getState();
    expect(mockAI.decideMeld).toHaveBeenCalled();
    expect(state.currentHint).toEqual({ action: '過' });
    expect(state.isHintLoading).toBe(false);
  });

  it('should preserve the selected chi option for waiting-phase auto play', async () => {
    vi.useFakeTimers();

    const waitingState = createWaitingState();
    const lastDiscard = waitingState.lastDiscard;
    expect(lastDiscard).toBeDefined();
    if (!lastDiscard) {
      throw new Error('Expected waiting state to include last discard');
    }
    const chiTiles = waitingState.players[0].hand;
    const selectedChi: MeldAction = {
      type: 'chi',
      tiles: [chiTiles[1], chiTiles[2]],
      meld: {
        type: 'chi',
        tiles: [chiTiles[1], lastDiscard, chiTiles[2]],
        source: lastDiscard,
      },
    };
    const mockAI = baseCreateAI();
    vi.mocked(mockAI.decideMeld).mockResolvedValue({ action: 'meld', meldAction: selectedChi });
    vi.spyOn(aiModule, 'createAI').mockReturnValue(mockAI);

    useGameStore.setState({
      state: waitingState,
      assistMode: 'auto',
      humanAiMode: 'algorithm',
      autoPlayDelay: 25,
    });

    useGameStore.getState().startHumanAssistIfNeeded();
    await flushMicrotasks();

    expect(useGameStore.getState().currentHint).toEqual({ action: '吃', meldAction: selectedChi });

    await vi.advanceTimersByTimeAsync(25);

    const state = useGameStore.getState();
    expect(state.currentHint).toBeNull();
    expect(state.chiOptionSelect).toEqual([]);
    expect(state.state.turnAction).toBe('discard');
    expect(state.state.lastDiscard).toBeNull();
    expect(state.state.players[0].melds).toHaveLength(1);
    expect(state.state.players[0].melds[0].tiles).toEqual(selectedChi.meld.tiles);
  });


  it('should start waiting auto-play when auto mode is enabled during a human waiting turn', async () => {
    vi.useFakeTimers();

    const waitingState = createWaitingState();
    const lastDiscard = waitingState.lastDiscard;
    expect(lastDiscard).toBeDefined();
    if (!lastDiscard) {
      throw new Error('Expected waiting state to include last discard');
    }

    const chiTiles = waitingState.players[0].hand;
    const selectedChi: MeldAction = {
      type: 'chi',
      tiles: [chiTiles[1], chiTiles[2]],
      meld: {
        type: 'chi',
        tiles: [chiTiles[1], lastDiscard, chiTiles[2]],
        source: lastDiscard,
      },
    };
    const mockAI = baseCreateAI();
    vi.mocked(mockAI.decideMeld).mockResolvedValue({ action: 'meld', meldAction: selectedChi });
    vi.spyOn(aiModule, 'createAI').mockReturnValue(mockAI);

    useGameStore.setState({
      state: waitingState,
      assistMode: 'none',
      humanAiMode: 'algorithm',
      autoPlayDelay: 25,
    });

    useGameStore.getState().setAssistMode('auto');
    await vi.advanceTimersByTimeAsync(0);
    await flushMicrotasks();

    expect(mockAI.decideMeld).toHaveBeenCalled();
    expect(useGameStore.getState().currentHint).toEqual({ action: '吃', meldAction: selectedChi });

    await vi.advanceTimersByTimeAsync(25);

    const state = useGameStore.getState();
    expect(state.currentHint).toBeNull();
    expect(state.state.turnAction).toBe('discard');
    expect(state.state.lastDiscard).toBeNull();
    expect(state.state.players[0].melds).toHaveLength(1);
    expect(state.state.players[0].melds[0].tiles).toEqual(selectedChi.meld.tiles);
  });

  it('should drop stale waiting hints before commit and before auto execution', async () => {
    vi.useFakeTimers();

    let resolveDecision: ((decision: AIDecision) => void) | undefined;
    const pendingDecision = new Promise<AIDecision>((resolve) => {
      resolveDecision = resolve;
    });
    const mockAI = baseCreateAI();
    vi.mocked(mockAI.decideMeld).mockReturnValue(pendingDecision);
    vi.spyOn(aiModule, 'createAI').mockReturnValue(mockAI);

    useGameStore.setState({
      state: createWaitingState(),
      assistMode: 'auto',
      humanAiMode: 'algorithm',
      autoPlayDelay: 25,
    });

    useGameStore.getState().startHumanAssistIfNeeded();
    useGameStore.setState({
      state: {
        ...createWaitingState(),
        turnAction: 'discard',
        lastDiscard: null,
        lastDiscardPlayer: null,
        discardSequence: [],
      },
      hintTurnId: 'stale-turn',
      currentHint: null,
      isHintLoading: false,
    });

    expect(resolveDecision).toBeTypeOf('function');
    resolveDecision?.({ action: 'pass' });
    await flushMicrotasks();
    await vi.advanceTimersByTimeAsync(25);

    const state = useGameStore.getState();
    expect(state.currentHint).toBeNull();
    expect(state.isHintLoading).toBe(false);
    expect(state.state.turnAction).toBe('discard');
    expect(state.state.lastDiscard).toBeNull();
  });

  it('should cancel pending auto-play when the human discards manually', async () => {
    vi.useFakeTimers();

    const mockAI = baseCreateAI();
    vi.mocked(mockAI.decideDiscard).mockResolvedValue(TEST_TILE);
    vi.spyOn(aiModule, 'createAI').mockReturnValue(mockAI);

    useGameStore.setState({
      state: createDiscardState(),
      assistMode: 'auto',
      humanAiMode: 'algorithm',
      autoPlayDelay: 25,
    });

    useGameStore.getState().startHumanAssistIfNeeded();
    await flushMicrotasks();

    useGameStore.getState().discardTile(TEST_TILE.id);

    let state = useGameStore.getState();
    expect(state.assistMode).toBe('auto');
    expect(state.currentHint).toBeNull();
    expect(state.isHintLoading).toBe(false);
    expect(state.hintTurnId).toBe('');

    await vi.advanceTimersByTimeAsync(25);

    state = useGameStore.getState();
    expect(state.state.lastDiscard?.id).toBe(TEST_TILE.id);
    expect(state.state.turnAction).toBe('waiting');
  });

  it('should clear pending assist when starting a new game', async () => {
    vi.useFakeTimers();

    const mockAI = baseCreateAI();
    vi.mocked(mockAI.decideDiscard).mockResolvedValue(TEST_TILE);
    vi.spyOn(aiModule, 'createAI').mockReturnValue(mockAI);

    useGameStore.setState({
      state: createDiscardState(),
      assistMode: 'auto',
      humanAiMode: 'algorithm',
      autoPlayDelay: 25,
    });

    useGameStore.getState().startHumanAssistIfNeeded();
    await flushMicrotasks();

    useGameStore.getState().startNewGame();
    await vi.advanceTimersByTimeAsync(25);

    const state = useGameStore.getState();
    expect(state.assistMode).toBe('auto');
    expect(state.currentHint).toBeNull();
    expect(state.isHintLoading).toBe(false);
    expect(state.hintTurnId).toBe('');
    expect(state.state.lastDiscard?.id).not.toBe(TEST_TILE.id);
  });

  it('should clear pending assist when assist mode is turned off', async () => {
    vi.useFakeTimers();

    const mockAI = baseCreateAI();
    vi.mocked(mockAI.decideDiscard).mockResolvedValue(TEST_TILE);
    vi.spyOn(aiModule, 'createAI').mockReturnValue(mockAI);

    useGameStore.setState({
      state: createDiscardState(),
      assistMode: 'auto',
      humanAiMode: 'algorithm',
      autoPlayDelay: 25,
    });

    useGameStore.getState().startHumanAssistIfNeeded();
    await flushMicrotasks();

    useGameStore.getState().setAssistMode('none');
    await vi.advanceTimersByTimeAsync(25);

    const state = useGameStore.getState();
    expect(state.assistMode).toBe('none');
    expect(state.currentHint).toBeNull();
    expect(state.isHintLoading).toBe(false);
    expect(state.hintTurnId).toBe('');
    expect(state.state.lastDiscard).toBeNull();
  });

  it('should cancel pending auto-play when manually cancelling assist', async () => {
    vi.useFakeTimers();

    const mockAI = baseCreateAI();
    vi.mocked(mockAI.decideDiscard).mockResolvedValue(TEST_TILE);
    vi.spyOn(aiModule, 'createAI').mockReturnValue(mockAI);

    useGameStore.setState({
      state: createDiscardState(),
      assistMode: 'auto',
      humanAiMode: 'algorithm',
      autoPlayDelay: 25,
    });

    useGameStore.getState().startHumanAssistIfNeeded();
    await flushMicrotasks();

    useGameStore.getState().cancelAutoPlay();
    await vi.advanceTimersByTimeAsync(25);

    const state = useGameStore.getState();
    expect(state.assistMode).toBe('none');
    expect(state.currentHint).toBeNull();
    expect(state.isHintLoading).toBe(false);
    expect(state.hintTurnId).toBe('');
    expect(state.state.lastDiscard).toBeNull();
    expect(state.state.turnAction).toBe('discard');
  });

  it('should schedule assist after drawTile moves the human into discard', async () => {
    vi.useFakeTimers();

    const assistSpy = installAssistSpy();
    useGameStore.setState({
      state: createHumanDrawState(),
      assistMode: 'hint',
      currentHint: { action: '過' },
      isHintLoading: true,
      hintTurnId: 'stale-turn',
    });

    useGameStore.getState().drawTile();

    expect(assistSpy).not.toHaveBeenCalled();
    expect(useGameStore.getState().state.turnAction).toBe('discard');
    expect(useGameStore.getState().currentHint).toBeNull();
    expect(useGameStore.getState().isHintLoading).toBe(false);
    expect(useGameStore.getState().hintTurnId).toBe('');

    await vi.advanceTimersByTimeAsync(0);

    expect(assistSpy).toHaveBeenCalledTimes(1);
  });

  it('should schedule assist after an ai waiting pass hands control to the human', async () => {
    vi.useFakeTimers();

    const assistSpy = installAssistSpy();
    useGameStore.setState({
      state: createAiWaitingPassToHumanWaitingState(),
      assistMode: 'hint',
    });

    await useGameStore.getState().executeAITurn();

    expect(assistSpy).not.toHaveBeenCalled();
    expect(useGameStore.getState().state.currentPlayer).toBe(0);
    expect(useGameStore.getState().state.turnAction).toBe('waiting');

    await vi.advanceTimersByTimeAsync(0);

    expect(assistSpy).toHaveBeenCalledTimes(1);
  });

  it('should schedule assist when an ai waiting pass returns the human to draw', async () => {
    vi.useFakeTimers();

    const assistSpy = installAssistSpy();
    useGameStore.setState({
      state: createAiWaitingPassToHumanDrawState(),
      assistMode: 'hint',
      currentHint: { action: '過' },
      isHintLoading: true,
      hintTurnId: 'stale-turn',
    });

    await useGameStore.getState().executeAITurn();
    await vi.advanceTimersByTimeAsync(0);

    const state = useGameStore.getState();
    expect(assistSpy).toHaveBeenCalledTimes(1);
    expect(state.state.currentPlayer).toBe(0);
    expect(state.state.turnAction).toBe('draw');
    expect(state.currentHint).toBeNull();
    expect(state.isHintLoading).toBe(false);
    expect(state.hintTurnId).toBe('');
  });

  it('should not schedule assist when drawTile ends in reveal', async () => {
    vi.useFakeTimers();

    const assistSpy = installAssistSpy();
    useGameStore.setState({
      state: createHumanDrawState(16),
      assistMode: 'hint',
      currentHint: { action: '過' },
      isHintLoading: true,
      hintTurnId: 'stale-turn',
    });

    useGameStore.getState().drawTile();
    await vi.advanceTimersByTimeAsync(0);

    const state = useGameStore.getState();
    expect(assistSpy).not.toHaveBeenCalled();
    expect(state.state.phase).toBe(GamePhase.REVEAL);
    expect(state.currentHint).toBeNull();
    expect(state.isHintLoading).toBe(false);
    expect(state.hintTurnId).toBe('');
  });

  it('should not schedule assist when confirmReveal moves to game over', async () => {
    vi.useFakeTimers();

    const assistSpy = installAssistSpy();
    useGameStore.setState({
      state: {
        ...createInitialState(),
        phase: GamePhase.REVEAL,
      },
      assistMode: 'hint',
      currentHint: { action: '過' },
      isHintLoading: true,
      hintTurnId: 'stale-turn',
    });

    useGameStore.getState().confirmReveal();
    await vi.advanceTimersByTimeAsync(0);

    const state = useGameStore.getState();
    expect(assistSpy).not.toHaveBeenCalled();
    expect(state.state.phase).toBe(GamePhase.GAME_OVER);
    expect(state.currentHint).toBeNull();
    expect(state.isHintLoading).toBe(false);
    expect(state.hintTurnId).toBe('');
  });
});
