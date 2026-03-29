import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGameStore, HybridConfig } from '../stores/gameStore';

describe('HybridConfig', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.setState({
      hybridConfig: {
        discard: 'algorithm',
        meld: 'algorithm',
        hu: 'algorithm',
      },
    });
  });

  describe('default values', () => {
    it('should have algorithm as default for all actions', () => {
      const { hybridConfig } = useGameStore.getState();

      expect(hybridConfig.discard).toBe('algorithm');
      expect(hybridConfig.meld).toBe('algorithm');
      expect(hybridConfig.hu).toBe('algorithm');
    });
  });

  describe('setHybridConfig', () => {
    it('should update discard config', () => {
      const { setHybridConfig } = useGameStore.getState();

      setHybridConfig({ discard: 'llm' });

      const { hybridConfig } = useGameStore.getState();
      expect(hybridConfig.discard).toBe('llm');
      expect(hybridConfig.meld).toBe('algorithm');
      expect(hybridConfig.hu).toBe('algorithm');
    });

    it('should update meld config', () => {
      const { setHybridConfig } = useGameStore.getState();

      setHybridConfig({ meld: 'llm' });

      const { hybridConfig } = useGameStore.getState();
      expect(hybridConfig.discard).toBe('algorithm');
      expect(hybridConfig.meld).toBe('llm');
      expect(hybridConfig.hu).toBe('algorithm');
    });

    it('should update hu config', () => {
      const { setHybridConfig } = useGameStore.getState();

      setHybridConfig({ hu: 'llm' });

      const { hybridConfig } = useGameStore.getState();
      expect(hybridConfig.discard).toBe('algorithm');
      expect(hybridConfig.meld).toBe('algorithm');
      expect(hybridConfig.hu).toBe('llm');
    });

    it('should update multiple configs at once', () => {
      const { setHybridConfig } = useGameStore.getState();

      setHybridConfig({ discard: 'llm', meld: 'llm' });

      const { hybridConfig } = useGameStore.getState();
      expect(hybridConfig.discard).toBe('llm');
      expect(hybridConfig.meld).toBe('llm');
      expect(hybridConfig.hu).toBe('algorithm');
    });

    it('should update all configs', () => {
      const { setHybridConfig } = useGameStore.getState();

      setHybridConfig({ discard: 'llm', meld: 'llm', hu: 'llm' });

      const { hybridConfig } = useGameStore.getState();
      expect(hybridConfig.discard).toBe('llm');
      expect(hybridConfig.meld).toBe('llm');
      expect(hybridConfig.hu).toBe('llm');
    });
  });

  describe('localStorage persistence', () => {
    it('should save to localStorage when setHybridConfig is called', () => {
      const { setHybridConfig } = useGameStore.getState();

      setHybridConfig({ discard: 'llm', meld: 'llm', hu: 'llm' });

      const stored = localStorage.getItem('mahjong-hybrid-config');
      expect(stored).toBeTruthy();

      const parsed = JSON.parse(stored!);
      expect(parsed.discard).toBe('llm');
      expect(parsed.meld).toBe('llm');
      expect(parsed.hu).toBe('llm');
    });

    it('should load from localStorage on initialization', () => {
      const savedConfig: HybridConfig = {
        discard: 'llm',
        meld: 'algorithm',
        hu: 'llm',
      };
      localStorage.setItem('mahjong-hybrid-config', JSON.stringify(savedConfig));

      useGameStore.setState({
        hybridConfig: savedConfig,
      });

      const { hybridConfig } = useGameStore.getState();
      expect(hybridConfig.discard).toBe('llm');
      expect(hybridConfig.meld).toBe('algorithm');
      expect(hybridConfig.hu).toBe('llm');
    });

    it('should handle invalid localStorage data gracefully', () => {
      localStorage.setItem('mahjong-hybrid-config', 'invalid json');

      const { hybridConfig } = useGameStore.getState();
      expect(hybridConfig.discard).toBe('algorithm');
      expect(hybridConfig.meld).toBe('algorithm');
      expect(hybridConfig.hu).toBe('algorithm');
    });

    it('should handle partial localStorage data', () => {
      localStorage.setItem('mahjong-hybrid-config', JSON.stringify({ discard: 'llm' }));

      const { hybridConfig } = useGameStore.getState();
      expect(hybridConfig.discard).toBe('algorithm');
      expect(hybridConfig.meld).toBe('algorithm');
      expect(hybridConfig.hu).toBe('algorithm');
    });
  });
});
