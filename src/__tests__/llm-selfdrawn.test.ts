import { describe, it, expect, vi, beforeEach, MockedFunction } from 'vitest';
import { Suit, createTile } from '../core/tile';
import { Player } from '../core/player';
import { GameState, GamePhase } from '../core/game';
import { MeldAction } from '../core/meld';
import { createLLMAgent } from '../ai/llm/agent';
import { LLMConfig, buildSelfDrawnPrompt, parseSelfDrawnResponse } from '../ai/llm/index';
import { callLLM } from '../ai/llm/providers';

vi.mock('../ai/llm/providers', () => ({
  callLLM: vi.fn(),
}));

describe('LLM self-drawn decision', () => {
  let mockCallLLM: MockedFunction<typeof callLLM>;
  let llmConfig: LLMConfig;

  beforeEach(() => {
    mockCallLLM = vi.mocked(callLLM);
    llmConfig = {
      provider: 'openrouter',
      apiKey: 'test-key',
      model: 'test-model',
      temperature: 0.7,
    };
  });

  describe('buildSelfDrawnPrompt', () => {
    it('should build prompt with available actions', () => {
      const player: Player = {
        id: 'south',
        hand: [
          createTile(Suit.WAN, 1), createTile(Suit.WAN, 1), createTile(Suit.WAN, 1),
          createTile(Suit.WAN, 1), createTile(Suit.WAN, 2), createTile(Suit.WAN, 3),
          createTile(Suit.WAN, 4), createTile(Suit.WAN, 5), createTile(Suit.WAN, 6),
          createTile(Suit.TIAO, 1), createTile(Suit.TIAO, 2), createTile(Suit.TIAO, 3),
          createTile(Suit.TONG, 1), createTile(Suit.TONG, 1),
          createTile(Suit.TIAO, 4), createTile(Suit.TIAO, 5),
        ],
        melds: [],
        discards: [],
        flowers: [],
        isHuman: true,
        score: 0,
      };

      const drawnTile = createTile(Suit.WAN, 1);
      const availableActions: MeldAction[] = [
        {
          type: 'angang',
          tiles: [
            createTile(Suit.WAN, 1),
            createTile(Suit.WAN, 1),
            createTile(Suit.WAN, 1),
            createTile(Suit.WAN, 1),
          ],
          meld: {
            type: 'angang',
            tiles: [
              createTile(Suit.WAN, 1),
              createTile(Suit.WAN, 1),
              createTile(Suit.WAN, 1),
              createTile(Suit.WAN, 1),
            ],
            source: 'self',
          },
        },
      ];

      const gameState: GameState = {
        phase: GamePhase.PLAYING,
        players: [player],
        wall: { tiles: [], position: 0 },
        currentPlayer: 0,
        lastDiscard: null,
        lastDiscardPlayer: null,
        winner: null,
        winType: null,
        round: 1,
        turnAction: 'draw',
        wind: 'south',
        discardSequence: [],
      };

      const prompt = buildSelfDrawnPrompt(player, drawnTile, availableActions, gameState);

      expect(prompt).toContain('摸到的牌');
      expect(prompt).toContain('可執行的動作');
      expect(prompt).toContain('暗槓');
    });
  });

  describe('parseSelfDrawnResponse', () => {
    it('should parse valid response with choice number', () => {
      const response = `思維過程：我想要槓牌
選擇的動作：1`;

      const result = parseSelfDrawnResponse(response);
      expect(result).toBe('1');
    });

    it('should parse response with colon separator', () => {
      const response = `思維過程：選擇胡牌
選擇的動作: 2`;

      const result = parseSelfDrawnResponse(response);
      expect(result).toBe('2');
    });

    it('should return null for invalid response', () => {
      const response = `這不是有效的回覆`;

      const result = parseSelfDrawnResponse(response);
      expect(result).toBeNull();
    });
  });

  describe('decideSelfDrawn', () => {
    it('should return correct AIDecision when LLM returns angang', async () => {
      const player: Player = {
        id: 'south',
        hand: [
          createTile(Suit.WAN, 1), createTile(Suit.WAN, 1), createTile(Suit.WAN, 1),
          createTile(Suit.WAN, 1), createTile(Suit.WAN, 2), createTile(Suit.WAN, 3),
          createTile(Suit.WAN, 4), createTile(Suit.WAN, 5), createTile(Suit.WAN, 6),
          createTile(Suit.TIAO, 1), createTile(Suit.TIAO, 2), createTile(Suit.TIAO, 3),
          createTile(Suit.TONG, 1), createTile(Suit.TONG, 1),
          createTile(Suit.TIAO, 4), createTile(Suit.TIAO, 5),
        ],
        melds: [],
        discards: [],
        flowers: [],
        isHuman: true,
        score: 0,
      };

      const drawnTile = createTile(Suit.WAN, 1);
      const availableActions: MeldAction[] = [
        {
          type: 'angang',
          tiles: [
            createTile(Suit.WAN, 1),
            createTile(Suit.WAN, 1),
            createTile(Suit.WAN, 1),
            createTile(Suit.WAN, 1),
          ],
          meld: {
            type: 'angang',
            tiles: [
              createTile(Suit.WAN, 1),
              createTile(Suit.WAN, 1),
              createTile(Suit.WAN, 1),
              createTile(Suit.WAN, 1),
            ],
            source: 'self',
          },
        },
      ];

      const wallTiles = [drawnTile];
      const gameState: GameState = {
        phase: GamePhase.PLAYING,
        players: [player],
        wall: { tiles: wallTiles, position: 1 },
        currentPlayer: 0,
        lastDiscard: null,
        lastDiscardPlayer: null,
        winner: null,
        winType: null,
        round: 1,
        turnAction: 'draw',
        wind: 'south',
        discardSequence: [],
      };

      mockCallLLM.mockResolvedValue({
        content: `思維過程：我要暗槓
選擇的動作：1`,
      });

      const agent = createLLMAgent(llmConfig, 'normal');
      const result = await agent.decideSelfDrawn(player, availableActions, gameState);

      expect(result.action).toBe('meld');
      expect(result.meldAction).toBeDefined();
      expect(result.meldAction?.type).toBe('angang');
    });

    it('should return pass when LLM call fails', async () => {
      const player: Player = {
        id: 'south',
        hand: [
          createTile(Suit.WAN, 1), createTile(Suit.WAN, 1), createTile(Suit.WAN, 1),
          createTile(Suit.WAN, 1), createTile(Suit.WAN, 2), createTile(Suit.WAN, 3),
          createTile(Suit.WAN, 4), createTile(Suit.WAN, 5), createTile(Suit.WAN, 6),
          createTile(Suit.TIAO, 1), createTile(Suit.TIAO, 2), createTile(Suit.TIAO, 3),
          createTile(Suit.TONG, 1), createTile(Suit.TONG, 1),
          createTile(Suit.TIAO, 4), createTile(Suit.TIAO, 5),
        ],
        melds: [],
        discards: [],
        flowers: [],
        isHuman: true,
        score: 0,
      };

      const drawnTile = createTile(Suit.WAN, 1);
      const availableActions: MeldAction[] = [
        {
          type: 'angang',
          tiles: [
            createTile(Suit.WAN, 1),
            createTile(Suit.WAN, 1),
            createTile(Suit.WAN, 1),
            createTile(Suit.WAN, 1),
          ],
          meld: {
            type: 'angang',
            tiles: [
              createTile(Suit.WAN, 1),
              createTile(Suit.WAN, 1),
              createTile(Suit.WAN, 1),
              createTile(Suit.WAN, 1),
            ],
            source: 'self',
          },
        },
      ];

      const wallTiles = [drawnTile];
      const gameState: GameState = {
        phase: GamePhase.PLAYING,
        players: [player],
        wall: { tiles: wallTiles, position: 1 },
        currentPlayer: 0,
        lastDiscard: null,
        lastDiscardPlayer: null,
        winner: null,
        winType: null,
        round: 1,
        turnAction: 'draw',
        wind: 'south',
        discardSequence: [],
      };

      mockCallLLM.mockRejectedValue(new Error('LLM API error'));

      const agent = createLLMAgent(llmConfig, 'normal');
      const result = await agent.decideSelfDrawn(player, availableActions, gameState);

      expect(result.action).toBe('meld');
      expect(result.meldAction?.type).toBe('angang');
    });

    it('should return pass when no actions available', async () => {
const player: Player = {
        id: 'south',
        hand: [
          createTile(Suit.WAN, 1), createTile(Suit.WAN, 1), createTile(Suit.WAN, 1),
          createTile(Suit.WAN, 1), createTile(Suit.WAN, 2), createTile(Suit.WAN, 3),
          createTile(Suit.WAN, 4), createTile(Suit.WAN, 5), createTile(Suit.WAN, 6),
          createTile(Suit.TIAO, 1), createTile(Suit.TIAO, 2), createTile(Suit.TIAO, 3),
          createTile(Suit.TONG, 1), createTile(Suit.TONG, 1),
          createTile(Suit.TIAO, 4), createTile(Suit.TIAO, 5),
        ],
        melds: [],
        discards: [],
        flowers: [],
        isHuman: true,
        score: 0,
      };

      const drawnTile = createTile(Suit.WAN, 8);
      const availableActions: MeldAction[] = [];

      const wallTiles = [drawnTile];
      const gameState: GameState = {
        phase: GamePhase.PLAYING,
        players: [player],
        wall: { tiles: wallTiles, position: 1 },
        currentPlayer: 0,
        lastDiscard: null,
        lastDiscardPlayer: null,
        winner: null,
        winType: null,
        round: 1,
        turnAction: 'draw',
        wind: 'south',
        discardSequence: [],
      };

      const agent = createLLMAgent(llmConfig, 'normal');
      const result = await agent.decideSelfDrawn(player, availableActions, gameState);

      expect(result.action).toBe('pass');
    });
  });
});
