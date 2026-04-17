import { Tile, getTileDisplay, Suit } from '../../core/tile';
import { Player } from '../../core/player';
import { GameState } from '../../core/game';
import { MeldAction } from '../../core/meld';
import { calculateShanten, assessDanger } from '../helpers';
import { getTileKey } from '../../utils/tileHelper';

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

  // Sort hand for display
  const myHandSorted = [...player.hand].sort((a, b) => {
    if (a.suit !== b.suit) return a.suit.localeCompare(b.suit);
    return a.value - b.value;
  });
  const handTiles = myHandSorted.map(getTileDisplay);

  // Calculate shanten number
  const shanten = calculateShanten(player.hand);

  // Melds format helper
  const formatMelds = (melds: any[]) => melds.map(m => {
    const tiles = m.tiles.map(getTileDisplay).join('');
    return `${m.type === 'chi' ? '吃' : m.type === 'peng' ? '碰' : m.type === 'gang' ? '槓' : '暗槓'} ${tiles}`;
  });

  // Danger assessment
  const dangerAssessments = assessDanger(player.hand, gameState, playerIndex);
  
  const safe_tiles: string[] = [];
  const medium_risk_tiles: string[] = [];
  const high_risk_tiles: string[] = [];

  const seen = new Set<string>();

  dangerAssessments.forEach(da => {
    const name = getTileDisplay(da.tile);
    if (seen.has(name)) return;
    seen.add(name);

    // Provide reasoning if any (e.g. "三元牌")
    const desc = da.reason ? `${name}(${da.reason})` : name;
    
    // Danger <= 1 is generally safe/low risk
    if (da.danger <= 1) {
      safe_tiles.push(desc);
    } else if (da.danger <= 3) {
      medium_risk_tiles.push(desc);
    } else {
      high_risk_tiles.push(desc);
    }
  });

  // Build opponents info
  const opponents = gameState.players
    .filter((_, idx) => idx !== playerIndex)
    .map(p => {
      const uniqueDiscards = Array.from(new Set(p.discards.map(getTileDisplay)));
      return {
        melds: formatMelds(p.melds),
        discards_summary: uniqueDiscards.slice(0, 5) // Just showing the first few discards as relatively safe
      };
    });

  const payload = {
    task: "decide_discard",
    my_state: {
      hand: handTiles,
      shanten,
      melds: formatMelds(player.melds)
    },
    risk_analysis: {
      safe_tiles,
      medium_risk_tiles,
      high_risk_tiles
    },
    opponents,
    system_instruction: "你是一個專業的台灣16張麻將AI。請根據 my_state 與 risk_analysis 決定要打哪一張牌。說明：'shanten' 代表向聽數（距離聽牌還差幾張，0 代表已聽牌，數值越小越接近胡牌）。必須嚴格回傳JSON格式，欄位順序：先 'tile_name' (決定打出的牌名，必須在hand清單中)，再 'reasoning' (你的戰略思考，最多100個字元，簡短說明)。絕對不要輸出JSON以外的文字。",
    _final_instruction: "=== 絕對限制 ===\n1. 只能輸出JSON物件，禁止任何其他文字\n2. JSON欄位順序必須是：先 tile_name，再 reasoning\n3. tile_name 必須是 my_state.hand 陣列中的其中一個值，原樣複製，不要修改\n4. 禁止在 hand 陣列中加入任何說明文字\n5. 禁止輸出 markdown 格式\n6. reasoning 欄位最多100個字元，簡短說明即可\n7. 必須使用繁體中文牌名（如：一萬、二索、三筒、東、南、西、北、中、發、白），禁止使用簡體中文（如：一万）\n8. 正確範例：{\"tile_name\": \"東\", \"reasoning\": \"打掉孤張風牌\"}"
  };

  return JSON.stringify(payload, null, 2);
}

function normalizeTileName(tileName: string): string {
  const simplifiedToTraditional: Record<string, string> = {
    '万': '萬',
    '东': '東',
    '发': '發',
  };
  
  return tileName.split('').map(char => simplifiedToTraditional[char] || char).join('');
}

export function parseLLMResponse(response: string): string | null {
  try {
    const cleaned = response.replace(/```json\n?|```\n?/g, '').trim();
    console.log('[LLM Parse] Cleaned response:', cleaned);
    const parsed = JSON.parse(cleaned);
    console.log('[LLM Parse] Parsed JSON:', parsed);
    if (parsed.tile_name && typeof parsed.tile_name === 'string') {
      const normalizedTileName = normalizeTileName(parsed.tile_name);
      console.log('[LLM Parse] Found tile_name:', parsed.tile_name, '-> normalized:', normalizedTileName);
      return normalizedTileName;
    }
    console.warn('[LLM Parse] tile_name field missing or wrong type. Parsed:', parsed);
  } catch (e) {
    console.warn('[LLM Parse] JSON parse error:', e);
    console.warn('[LLM Parse] Raw response:', response);
  }

  const match = response.match(/選擇的牌[：:]\s*(.+)/);
  if (match) {
    const normalizedTileName = normalizeTileName(match[1].trim());
    console.log('[LLM Parse] Regex fallback found:', match[1].trim(), '-> normalized:', normalizedTileName);
    return normalizedTileName;
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
      case 'gang': {
        const isUpgrade = player.melds.some(
          m => m.type === 'peng' && m.tiles.some(t => getTileDisplay(t) === tilesDisplay.split(' ')[0])
        );
        actionName = isUpgrade ? '加槓' : '槓';
        description = isUpgrade
          ? `將碰 ${tilesDisplay} 升級為槓`
          : `槓 ${tilesDisplay}（${drawnTileDisplay}）`;
        break;
      }
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
