import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGameStore } from '../stores/gameStore';
import { createAI } from '../ai';
import { createLLMAgent } from '../ai/llm/agent';
import { GamePhase } from '../core/game';
import { Tile, createTile, Suit } from '../core/tile';
import { Player, PlayerSeat, Meld } from '../core/player';
import { MeldAction } from '../core/meld';

vi.mock('../ai/llm/providers', () => ({
  callLLM: vi.fn().mockResolvedValue({ content: '1' }),
}));

describe('AI Integration Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    useGameStore.setState({
      state: {
        phase: GamePhase.PLAYING,
        currentPlayer: 1,
        wall: {
          tiles: [],
          position: 0,
        },
        players: [],
        lastDiscard: null,
        lastDiscardPlayer: null,
        winner: null,
        winType: null,
        round: 1,
        turnAction: 'draw',
        wind: 'east',
        discardSequence: [],
      },
      difficulty: 'normal',
      aiMode: 'algorithm',
      llmConfig: null,
      hybridConfig: {
        discard: 'algorithm',
        meld: 'algorithm',
        hu: 'algorithm',
      },
      isAITurn: false,
      isLLMThinking: false,
    });
  });

  describe('AI Turn Cycle', () => {
    it('should create algorithm AI with correct difficulty', () => {
      const easyAI = createAI('easy');
      const normalAI = createAI('normal');
      const hardAI = createAI('hard');

      expect(easyAI.config.difficulty).toBe('easy');
      expect(normalAI.config.difficulty).toBe('normal');
      expect(hardAI.config.difficulty).toBe('hard');
    });

    it('should have think time within expected range', () => {
      const ai = createAI('normal');
      const thinkTime = ai.getThinkTime();

      expect(thinkTime).toBeGreaterThanOrEqual(1000);
      expect(thinkTime).toBeLessThanOrEqual(2000);
    });

    it('should have different think times for different difficulties', () => {
      const easyAI = createAI('easy');
      const hardAI = createAI('hard');

      expect(easyAI.config.thinkTimeMin).toBeLessThan(hardAI.config.thinkTimeMin);
    });
  });

  describe('Meld Decision Flow', () => {
    it('should create LLM agent with config', () => {
      const llmConfig = {
        provider: 'openrouter' as const,
        apiKey: 'test-key',
        model: 'test-model',
      };

      const llmAgent = createLLMAgent(llmConfig, 'normal');

      expect(llmAgent.config.difficulty).toBe('normal');
      expect(typeof llmAgent.decide).toBe('function');
      expect(typeof llmAgent.decideMeld).toBe('function');
      expect(typeof llmAgent.decideSelfDrawn).toBe('function');
    });

     it('should return pass decision when no actions available', async () => {
       const llmConfig = {
         provider: 'openrouter' as const,
         apiKey: 'test-key',
         model: 'test-model',
       };

       const llmAgent = createLLMAgent(llmConfig, 'normal');

       const mockPlayer: Player = {
         id: 'east',
         hand: [],
         melds: [],
         discards: [],
         flowers: [],
         isHuman: false,
         score: 0,
       };

       const decision = await llmAgent.decideMeld(mockPlayer, [], {} as any);

       expect(decision.action).toBe('pass');
       expect(decision.meldAction).toBeUndefined();
     });

     it('should return pass decision when self-drawn with no actions', async () => {
       const llmConfig = {
         provider: 'openrouter' as const,
         apiKey: 'test-key',
         model: 'test-model',
       };

       const llmAgent = createLLMAgent(llmConfig, 'normal');

       const mockPlayer: Player = {
         id: 'east',
         hand: [],
         melds: [],
         discards: [],
         flowers: [],
         isHuman: false,
         score: 0,
       };

       const decision = await llmAgent.decideSelfDrawn(mockPlayer, [], {} as any);

       expect(decision.action).toBe('pass');
     });
  });

  describe('Hybrid Mode', () => {
    it('should use algorithm for discard when hybrid config is algorithm', () => {
      useGameStore.setState({
        aiMode: 'hybrid',
        llmConfig: {
          provider: 'openrouter',
          apiKey: 'test-key',
          model: 'test-model',
        },
        hybridConfig: {
          discard: 'algorithm',
          meld: 'algorithm',
          hu: 'algorithm',
        },
      });

      const { hybridConfig: updatedConfig } = useGameStore.getState();
      expect(updatedConfig.discard).toBe('algorithm');
    });

    it('should use LLM for discard when hybrid config is llm', () => {
      useGameStore.setState({
        aiMode: 'hybrid',
        llmConfig: {
          provider: 'openrouter',
          apiKey: 'test-key',
          model: 'test-model',
        },
        hybridConfig: {
          discard: 'llm',
          meld: 'llm',
          hu: 'llm',
        },
      });

      const { hybridConfig } = useGameStore.getState();
      expect(hybridConfig.discard).toBe('llm');
      expect(hybridConfig.meld).toBe('llm');
      expect(hybridConfig.hu).toBe('llm');
    });

    it('should update hybrid config partially', () => {
      const { setHybridConfig } = useGameStore.getState();

      setHybridConfig({ discard: 'llm' });

      const { hybridConfig } = useGameStore.getState();
      expect(hybridConfig.discard).toBe('llm');
      expect(hybridConfig.meld).toBe('algorithm');
      expect(hybridConfig.hu).toBe('algorithm');
    });
  });

  describe('LLM Fallback', () => {
    const createMockGameState = (playerId: string) => ({
      phase: GamePhase.PLAYING,
      currentPlayer: 0,
      wall: {
        tiles: [createTile(Suit.WAN, 1)],
        position: 1,
      },
       players: [
         {
           id: playerId,
           hand: [],
           melds: [],
           discards: [],
           flowers: [],
           isHuman: false,
           score: 0,
         },
       ] as Player[],
      lastDiscard: null,
      lastDiscardPlayer: null,
      winner: null,
      winType: null,
      round: 1,
      turnAction: 'discard' as const,
      wind: 'east' as const,
      discardSequence: [],
    });

    it('should fallback to algorithm when LLM call fails', async () => {
      const { callLLM } = await import('../ai/llm/providers');

      vi.mocked(callLLM).mockRejectedValueOnce(new Error('LLM API Error'));

      const llmConfig = {
        provider: 'openrouter' as const,
        apiKey: 'test-key',
        model: 'test-model',
      };

      const llmAgent = createLLMAgent(llmConfig, 'normal');

      const mockTile = createTile(Suit.WAN, 1);
      const mockPlayer: Player = {
        id: 'east',
        hand: [mockTile],
        melds: [],
        discards: [],
        flowers: [],
        isHuman: false,
        score: 0,
      };

      const gameState = createMockGameState('east');
      const result = await llmAgent.decide(mockPlayer, gameState);

      expect(result).toBeDefined();
      expect(result.tile.id).toBe(mockTile.id);
    });

    it('should fallback to pass when LLM meld call fails', async () => {
      const { callLLM } = await import('../ai/llm/providers');

      vi.mocked(callLLM).mockRejectedValueOnce(new Error('LLM API Error'));

      const llmConfig = {
        provider: 'openrouter' as const,
        apiKey: 'test-key',
        model: 'test-model',
      };

      const llmAgent = createLLMAgent(llmConfig, 'normal');

      const mockPlayer: Player = {
        id: 'east',
        hand: [],
        melds: [],
        discards: [],
        flowers: [],
        isHuman: false,
        score: 0,
      };

      const mockAction: MeldAction = {
        type: 'peng',
        tiles: [],
        meld: {
          type: 'peng',
          tiles: [],
          source: 'self',
        },
      };

      const gameState = createMockGameState('east');
      const decision = await llmAgent.decideMeld(mockPlayer, [mockAction], gameState);

      expect(decision.action).toBe('meld');
      expect(decision.meldAction?.type).toBe('peng');
    });

    it('should fallback to pass when LLM self-drawn call fails', async () => {
      const { callLLM } = await import('../ai/llm/providers');

      vi.mocked(callLLM).mockRejectedValueOnce(new Error('LLM API Error'));

      const llmConfig = {
        provider: 'openrouter' as const,
        apiKey: 'test-key',
        model: 'test-model',
      };

      const llmAgent = createLLMAgent(llmConfig, 'normal');

      const mockPlayer: Player = {
        id: 'east',
        hand: [],
        melds: [],
        discards: [],
        flowers: [],
        isHuman: false,
        score: 0,
      };

      const mockAction: MeldAction = {
        type: 'gang',
        tiles: [],
        meld: {
          type: 'gang',
          tiles: [],
          source: 'self',
        },
      };

      const gameState = createMockGameState('east');
      const decision = await llmAgent.decideSelfDrawn(mockPlayer, [mockAction], gameState);

      expect(decision.action).toBe('pass');
    });
  });

  describe('Game Store AI Mode', () => {
    it('should set AI mode to algorithm', () => {
      const { setAIMode } = useGameStore.getState();

      setAIMode('algorithm');

      const { aiMode } = useGameStore.getState();
      expect(aiMode).toBe('algorithm');
    });

    it('should set AI mode to llm', () => {
      const { setAIMode } = useGameStore.getState();

      setAIMode('llm');

      const { aiMode } = useGameStore.getState();
      expect(aiMode).toBe('llm');
    });

    it('should set AI mode to hybrid', () => {
      const { setAIMode } = useGameStore.getState();

      setAIMode('hybrid');

      const { aiMode } = useGameStore.getState();
      expect(aiMode).toBe('hybrid');
    });

    it('should set LLM config', () => {
      const { setLLMConfig } = useGameStore.getState();

      const config = {
        provider: 'minimax' as const,
        apiKey: 'test-key',
        model: 'test-model',
      };

      setLLMConfig(config);

      const { llmConfig } = useGameStore.getState();
      expect(llmConfig).toEqual(config);
    });

    it('should clear LLM config when null is passed', () => {
      useGameStore.setState({
        llmConfig: {
          provider: 'openrouter',
          apiKey: 'test-key',
          model: 'test-model',
        },
      });

      const { setLLMConfig } = useGameStore.getState();
      setLLMConfig(null);

      const { llmConfig } = useGameStore.getState();
      expect(llmConfig).toBeNull();
    });
  });

  describe('AIDecision interface', () => {
    it('should have correct structure for discard decision', () => {
      const mockTile = createTile(Suit.WAN, 1);

      const decision = {
        action: 'discard' as const,
        tile: mockTile,
      };

      expect(decision.action).toBe('discard');
      expect(decision.tile).toBeDefined();
      expect(decision.tile!.suit).toBe(Suit.WAN);
    });

    it('should have correct structure for meld decision', () => {
      const mockAction: MeldAction = {
        type: 'peng',
        tiles: [],
        meld: {
          type: 'peng',
          tiles: [],
          source: 'self',
        },
      };

      const decision = {
        action: 'meld' as const,
        meldAction: mockAction,
      };

      expect(decision.action).toBe('meld');
      expect(decision.meldAction).toBeDefined();
      expect(decision.meldAction!.type).toBe('peng');
    });

    it('should have correct structure for pass decision', () => {
      const decision: { action: 'pass' } = {
        action: 'pass',
      };

      expect(decision.action).toBe('pass');
    });
  });
});
