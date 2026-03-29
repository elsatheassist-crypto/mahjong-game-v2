import { Tile } from '../core/tile';
import { Player } from '../core/player';
import { GameState } from '../core/game';
import { MeldAction } from '../core/meld';
import { AIAgent, AIConfig, AIDecision, createAIConfig, randomChoice } from './base';

export class EasyAI implements AIAgent {
  config: AIConfig = createAIConfig('easy');

  async decideDiscard(player: Player, gameState: GameState): Promise<Tile> {
    return randomChoice(player.hand);
  }

  async decideMeld(player: Player, availableActions: MeldAction[], gameState: GameState): Promise<AIDecision> {
    const huAction = availableActions.find(action => action.type === 'hu');
    if (huAction) {
      return { action: 'meld', meldAction: huAction };
    }

    if (Math.random() < 0.7) {
      return { action: 'meld', meldAction: availableActions[0] };
    }
    return { action: 'pass' };
  }

  async decideSelfDrawn(player: Player, availableActions: MeldAction[], gameState: GameState): Promise<AIDecision> {
    const huAction = availableActions.find(action => action.type === 'hu');
    if (huAction) {
      return { action: 'meld', meldAction: huAction };
    }

    if (Math.random() < 0.5) {
      return { action: 'meld', meldAction: availableActions[0] };
    }
    return { action: 'pass' };
  }

  getThinkTime(): number {
    const { thinkTimeMin, thinkTimeMax } = this.config;
    return thinkTimeMin + Math.random() * (thinkTimeMax - thinkTimeMin);
  }
}
