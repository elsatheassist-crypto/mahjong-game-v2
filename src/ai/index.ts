import { AIAgent, AIDifficulty } from './base';
import { EasyAI } from './easy';
import { NormalAI } from './normal';
import { HardAI } from './hard';

export type { AIAgent, AIDifficulty, AIConfig, AIDecision } from './base';
export { EasyAI } from './easy';
export { NormalAI } from './normal';
export { HardAI } from './hard';

export function createAI(difficulty: AIDifficulty): AIAgent {
  switch (difficulty) {
    case 'easy':
      return new EasyAI();
    case 'normal':
      return new NormalAI();
    case 'hard':
      return new HardAI();
  }
}
