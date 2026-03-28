import { Tile } from '../core/tile';
import { Player } from '../core/player';
import { GameState } from '../core/game';
import { MeldAction } from '../core/meld';
import { AIAgent, AIConfig, AIDecision, createAIConfig, randomChoice } from './base';

export class EasyAI implements AIAgent {
  config: AIConfig = createAIConfig('easy');

  decideDiscard(player: Player, gameState: GameState): Tile {
    return randomChoice(player.hand);
  }

  decideMeld(player: Player, availableActions: MeldAction[], gameState: GameState): AIDecision {
    const huAction = availableActions.find(action => action.type === 'hu');
    if (huAction) {
      return { action: 'meld', meldAction: huAction };
    }

    if (Math.random() < 0.7) {
      return { action: 'meld', meldAction: availableActions[0] };
    }
    return { action: 'pass' };
  }

  decideSelfDrawn(player: Player, availableActions: MeldAction[], gameState: GameState): AIDecision {
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
