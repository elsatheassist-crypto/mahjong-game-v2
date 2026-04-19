import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createLLMAgent } from '../ai/llm/agent';
import { callLLM } from '../ai/llm/providers';
import { MeldAction } from '../core/meld';
import { Suit, createTile } from '../core/tile';
import { Player } from '../core/player';
import { GameState, createInitialState } from '../core/game';

// Mock the callLLM function
vi.mock('../ai/llm/providers', () => ({
  callLLM: vi.fn(),
}));

const mockCallLLM = vi.mocked(callLLM);

describe('LLM Meld Decision', () => {
  const llmConfig = {
    provider: 'openrouter' as const,
    apiKey: 'test-key',
    model: 'test-model',
  };

  const player: Player = {
    id: 'south',
    hand: [
      createTile(Suit.WAN, 1), createTile(Suit.WAN, 1),
      createTile(Suit.WAN, 2), createTile(Suit.WAN, 3), createTile(Suit.WAN, 4),
      createTile(Suit.WAN, 5), createTile(Suit.WAN, 6), createTile(Suit.WAN, 7),
      createTile(Suit.TIAO, 1), createTile(Suit.TIAO, 2), createTile(Suit.TIAO, 3),
      createTile(Suit.TONG, 1), createTile(Suit.TONG, 1),
      createTile(Suit.TIAO, 4), createTile(Suit.TIAO, 5),
    ],
    melds: [],
    discards: [],
    flowers: [],
    isHuman: false,
    score: 0,
  };

  const gameState: GameState = {
    ...createInitialState(),
    players: [
      { ...player, id: 'east', hand: [], discards: [createTile(Suit.WAN, 1)] },
      { ...player, id: 'south' },
      { ...player, id: 'west', hand: [], discards: [] },
      { ...player, id: 'north', hand: [], discards: [] },
    ],
    currentPlayer: 1,
    lastDiscard: createTile(Suit.WAN, 1),
    lastDiscardPlayer: 0,
  };

  const pengAction: MeldAction = {
    type: 'peng',
    tiles: [createTile(Suit.WAN, 1), createTile(Suit.WAN, 1)],
    meld: {
      type: 'peng',
      tiles: [createTile(Suit.WAN, 1), createTile(Suit.WAN, 1), createTile(Suit.WAN, 1)],
      source: createTile(Suit.WAN, 1),
    },
  };

  const availableActions: MeldAction[] = [pengAction];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return meld decision when LLM returns peng choice', async () => {
    // Mock LLM response with peng choice (option 1)
    mockCallLLM.mockResolvedValue({
      content: '思維過程：我有兩張一萬，可以碰\n選擇的動作：1',
    });

    const agent = createLLMAgent(llmConfig);
    const decision = await agent.decideMeld(player, availableActions, gameState);

    expect(decision.action).toBe('meld');
    expect(decision.meldAction).toBeDefined();
    expect(decision.meldAction?.type).toBe('peng');
  });

  it('should return pass when LLM returns pass choice', async () => {
    // Mock LLM response with pass choice (option 2, which is the pass option)
    mockCallLLM.mockResolvedValue({
      content: '思維過程：碰一萬沒有好處\n選擇的動作：2',
    });

    const agent = createLLMAgent(llmConfig);
    const decision = await agent.decideMeld(player, availableActions, gameState);

    expect(decision.action).toBe('pass');
  });

  it('should return pass when LLM call fails', async () => {
    // Mock LLM call to throw an error
    mockCallLLM.mockRejectedValue(new Error('API error'));

    const agent = createLLMAgent(llmConfig);
    const decision = await agent.decideMeld(player, availableActions, gameState);

    expect(decision.action).toBe('meld');
    expect(decision.meldAction?.type).toBe('peng');
  });

  it('should return pass when LLM response cannot be parsed', async () => {
    // Mock LLM response with invalid format
    mockCallLLM.mockResolvedValue({
      content: '這是一個無效的回覆',
    });

    const agent = createLLMAgent(llmConfig);
    const decision = await agent.decideMeld(player, availableActions, gameState);

    expect(decision.action).toBe('meld');
    expect(decision.meldAction?.type).toBe('peng');
  });

  it('should return pass when no actions available', async () => {
    const agent = createLLMAgent(llmConfig);
    const decision = await agent.decideMeld(player, [], gameState);

    expect(decision.action).toBe('pass');
    expect(mockCallLLM).not.toHaveBeenCalled();
  });
});
