import { Tile, Suit, getTileUnicode, getTileDisplay } from '../../core/tile';
import { Player } from '../../core/player';
import { GameState } from '../../core/game';

export interface LLMConfig {
  provider: 'minimax' | 'openrouter' | 'gemini';
  apiKey: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
}

export interface LLMAgent {
  decide: (
    player: Player,
    gameState: GameState,
    config: LLMConfig
  ) => Promise<Tile>;
}

export function buildLLMPrompt(
  player: Player,
  gameState: GameState
): string {
  const playerIndex = gameState.players.findIndex((p) => p.id === player.id);

  // Get all visible information
  const allDiscards: { player: string; tiles: string }[] = gameState.players.map((p, i) => ({
    player: i === playerIndex ? '自己' : `玩家${i}`,
    tiles: p.discards.map(getTileDisplay).join(', ') || '無',
  }));

  const myHandSorted = [...player.hand].sort((a, b) => {
    if (a.suit !== b.suit) return a.suit.localeCompare(b.suit);
    return a.value - b.value;
  });

  const myHandDisplay = myHandSorted.map(getTileDisplay).join(' ');

  let prompt = `你是專業的台灣16張麻將玩家。

【你的資訊】
- 你的位置：${player.id}
- 你的麻將牌：${myHandDisplay}
- 總共 ${player.hand.length} 張

【其他玩家的捨牌】
${allDiscards.map((d) => `- ${d.player}：${d.tiles}`).join('\n')}

【牌牆】
牌牆剩餘：${gameState.wall.tiles.length - gameState.wall.position} 張

【遊戲狀態】
目前輪到：玩家 ${gameState.currentPlayer}
`;

  // Add waiting tiles info if available
  if (player.melds.length > 0) {
    const myMelds = player.melds.map((m) => m.tiles.map(getTileDisplay).join('')).join(' ');
    prompt += `\n你的吃碰槓組：${myMelds}`;
  }

  prompt += `
【任務】
請選擇一張要打出去的麻將牌。
規則：
1. 優先打沒有連續性的孤張牌
2. 避免打可能讓別人胡的危險牌
3. 如果是字牌（東南西北中發白）且沒有對子，通常先打

請用以下格式回覆：
思維過程：[你的思考]
選擇的牌：[牌名，例如：三萬]
`;

  return prompt;
}

export function parseLLMResponse(response: string): string | null {
  const match = response.match(/選擇的牌[：:]\s*(.+)/);
  if (match) {
    return match[1].trim();
  }
  return null;
}
