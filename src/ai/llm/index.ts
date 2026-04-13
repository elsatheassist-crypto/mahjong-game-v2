import { Tile, getTileDisplay } from '../../core/tile';
import { Player } from '../../core/player';
import { GameState } from '../../core/game';
import { MeldAction } from '../../core/meld';

export interface LLMConfig {
  provider: 'minimax' | 'openrouter' | 'gemini';
  apiKey: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
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
請從你的麻將牌中選擇一張要打出去的牌。
你只能選擇上面【你的麻將牌】列表中顯示的牌。

規則：
1. 優先打沒有連續性的孤張牌
2. 避免打可能讓別人胡的危險牌
3. 如果是字牌（東南西北中發白）且沒有對子，通常先打

重要：請直接輸出JSON格式，不要輸出任何其他文字或思考過程。
格式如下（只需要這個JSON）：
{"tile_name":"選擇的牌名"}

正確範例：
- 手牌：一萬 二萬 三萬 五索 五索 東 東 → 輸出：{"tile_name":"東"}
- 手牌：二筒 四筒 六筒 八筒 八筒 → 輸出：{"tile_name":"四筒"}

錯誤範例（絕對不要這樣）：
- 不要輸出思考過程
- 不要輸出markdown格式
- 不要選擇不在手牌中的牌
`;

  return prompt;
}

export function parseLLMResponse(response: string): string | null {
  // Try JSON parsing first
  try {
    // Strip markdown code blocks if present
    const cleaned = response.replace(/```json\n?|```\n?/g, '').trim();
    console.log('[LLM Parse] Cleaned response:', cleaned);
    const parsed = JSON.parse(cleaned);
    console.log('[LLM Parse] Parsed JSON:', parsed);
    if (parsed.tile_name && typeof parsed.tile_name === 'string') {
      console.log('[LLM Parse] Found tile_name:', parsed.tile_name);
      return parsed.tile_name;
    }
    console.warn('[LLM Parse] tile_name field missing or wrong type. Parsed:', parsed);
  } catch (e) {
    console.warn('[LLM Parse] JSON parse error:', e);
    console.warn('[LLM Parse] Raw response:', response);
  }

  // Regex fallback for backward compatibility
  const match = response.match(/選擇的牌[：:]\s*(.+)/);
  if (match) {
    console.log('[LLM Parse] Regex fallback found:', match[1].trim());
    return match[1].trim();
  }

  console.warn('[LLM Parse] All parsing failed. Response:', response);
  return null;
}

/**
 * Build prompt for self-drawn meld decisions (angang, upgrade peng to gang, hu)
 */
export function buildSelfDrawnPrompt(
  player: Player,
  drawnTile: Tile,
  availableActions: MeldAction[],
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
  const drawnTileDisplay = getTileDisplay(drawnTile);

  // Format available actions as numbered choices
  const actionChoices = availableActions.map((action, index) => {
    const tilesDisplay = action.tiles.map(getTileDisplay).join(' ');
    let actionName = '';
    let description = '';

    switch (action.type) {
      case 'angang':
        actionName = '暗槓';
        description = `槓 ${tilesDisplay}（自己摸到的牌）`;
        break;
      case 'gang':
        // Check if this is an upgrade from peng
        const isUpgrade = player.melds.some(
          m => m.type === 'peng' && m.tiles.some(t => getTileDisplay(t) === tilesDisplay.split(' ')[0])
        );
        actionName = isUpgrade ? '加槓' : '槓';
        description = isUpgrade
          ? `將碰 ${tilesDisplay} 升級為槓`
          : `槓 ${tilesDisplay}（${drawnTileDisplay}）`;
        break;
      case 'hu':
        actionName = '胡牌';
        description = '自摸胡牌！';
        break;
      default:
        actionName = action.type;
        description = tilesDisplay;
    }

    return `${index + 1}. ${actionName}：${description}`;
  }).join('\n');

  let prompt = `你是專業的台灣16張麻將玩家。

【你的資訊】
- 你的位置：${player.id}
- 你的麻將牌：${myHandDisplay}
- 總共 ${player.hand.length} 張

【摸到的牌】
${drawnTileDisplay}

【其他玩家的捨牌】
${allDiscards.map((d) => `- ${d.player}：${d.tiles}`).join('\n')}

【牌牆】
牌牆剩餘：${gameState.wall.tiles.length - gameState.wall.position} 張

【遊戲狀態】
目前輪到：玩家 ${gameState.currentPlayer}
`;

  // Add existing melds info if available
  if (player.melds.length > 0) {
    const myMelds = player.melds.map((m) => m.tiles.map(getTileDisplay).join('')).join(' ');
    prompt += `\n你的吃碰槓組：${myMelds}`;
  }

  // Add available self-drawn actions
  prompt += `
【可執行的動作】
${actionChoices || '無'}

【任務】
請選擇要執行的動作（暗槓、加槓、胡牌）或放棄。
規則：
1. 如果可以胡牌，原則上應該胡牌
2. 暗槓會讓手牌減少一張，但有機會獲得更多台數
3. 加槓可以將碰轉為槓，增加台數
4. 如果沒有特別的優勢，可以選擇放棄

重要：請直接輸出JSON格式，不要輸出任何其他文字或思考過程。
格式如下（只需要這個JSON）：
{"action_index":1}

正確範例：
- 選項1:胡牌, 選項2:暗槓 → 輸出：{"action_index":1}
- 選項1:pass → 輸出：{"action_index":1}

錯誤範例（絕對不要這樣）：
- 不要輸出思考過程
- 不要輸出markdown格式
- 不要選擇不存在的編號
`;

  return prompt;
}

/**
 * Parse LLM response to extract chosen self-drawn action
 * Returns the action type string or null if parsing fails
 */
export function parseSelfDrawnResponse(response: string): string | null {
  // Try JSON parsing first
  try {
    const cleaned = response.replace(/```json\n?|```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    console.log('[LLM SelfDrawn Parse] Parsed JSON:', parsed);
    if (typeof parsed.action_index === 'number') {
      console.log('[LLM SelfDrawn Parse] Found action_index:', parsed.action_index);
      return parsed.action_index.toString();
    }
    console.warn('[LLM SelfDrawn Parse] action_index missing or wrong type. Parsed:', parsed);
  } catch (e) {
    console.warn('[LLM SelfDrawn Parse] JSON parse error:', e);
    console.warn('[LLM SelfDrawn Parse] Raw response:', response);
  }

  const match = response.match(/選擇的動作[：:]\s*(\d+)/);
  if (match) {
    console.log('LLM self-drawn parsed via regex fallback:', match[1]);
    return match[1];
  }

  console.warn('LLM self-drawn parsing failed. Response:', response);
  return null;
}

/**
 * Build a prompt for LLM to decide meld action (chi/peng/gang/hu/pass)
 * when another player discards a tile
 */
export function buildMeldPrompt(
  player: Player,
  availableActions: MeldAction[],
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

  // Format available actions as numbered choices
  const actionChoices = availableActions.map((action, index) => {
    const tilesDisplay = action.tiles.map(getTileDisplay).join(' ');
    let actionName = '';
    let description = '';

    switch (action.type) {
      case 'chi':
        actionName = '吃';
        description = `吃 ${tilesDisplay}`;
        break;
      case 'peng':
        actionName = '碰';
        description = `碰 ${tilesDisplay}`;
        break;
      case 'gang':
        actionName = '槓';
        description = `槓 ${tilesDisplay}`;
        break;
      case 'hu':
        actionName = '胡';
        description = '胡牌！';
        break;
      default:
        actionName = action.type;
        description = tilesDisplay;
    }

    return `${index + 1}. ${actionName}：${description}`;
  }).join('\n');

  // Add pass option
  const passOptionNum = availableActions.length + 1;

  const lastDiscard = gameState.lastDiscard;
  const discardDisplay = lastDiscard ? getTileDisplay(lastDiscard) : '未知';
  const discardPlayer = gameState.lastDiscardPlayer !== null
    ? gameState.players[gameState.lastDiscardPlayer].id
    : '未知';

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
${discardPlayer} 打出：${discardDisplay}
`;

  // Add existing melds info if available
  if (player.melds.length > 0) {
    const myMelds = player.melds.map((m) => m.tiles.map(getTileDisplay).join('')).join(' ');
    prompt += `\n你的吃碰槓組：${myMelds}`;
  }

   // Add available meld actions
   prompt += `
【可執行的動作】
${actionChoices || '無'}
${passOptionNum}. pass：放棄

【任務】
請從上面的編號選項中選擇一個動作（吃、碰、槓、胡）或放棄。
只能選擇上面列出的編號（1到${passOptionNum}）。

規則：
1. 如果可以胡牌，原則上應該胡牌
2. 槓 > 碰 > 吃（優先順序）
3. 吃只能從上家（左邊的玩家）的捨牌
4. 如果沒有好的組合，選擇 pass

重要：請直接輸出JSON格式，不要輸出任何其他文字或思考過程。
格式如下（只需要這個JSON）：
{"action_index":1}

正確範例：
- 選項1:吃 二萬三萬四萬, 選項2:pass → 輸出：{"action_index":1}
- 選項1:碰 五索, 選項2:pass → 輸出：{"action_index":2}

錯誤範例（絕對不要這樣）：
- 不要輸出思考過程
- 不要輸出markdown格式
- 不要選擇不存在的編號
`;

  return prompt;
}

/**
 * Parse LLM response to extract chosen meld action index
 * Returns the action index string (1-based) or null if parsing fails
 */
export function parseMeldResponse(response: string): string | null {
  try {
    const cleaned = response.replace(/```json\n?|```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    console.log('[LLM Meld Parse] Parsed JSON:', parsed);
    if (typeof parsed.action_index === 'number') {
      console.log('[LLM Meld Parse] Found action_index:', parsed.action_index);
      return parsed.action_index.toString();
    }
    console.warn('[LLM Meld Parse] action_index missing or wrong type. Parsed:', parsed);
  } catch (e) {
    console.warn('[LLM Meld Parse] JSON parse error:', e);
    console.warn('[LLM Meld Parse] Raw response:', response);
  }

  const match = response.match(/選擇的動作[：:]\s*(\d+)/);
  if (match) {
    console.log('LLM meld parsed via regex fallback:', match[1]);
    return match[1];
  }

  console.warn('LLM meld parsing failed. Response:', response);
  return null;
}
