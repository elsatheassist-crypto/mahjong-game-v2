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

  let prompt = `你的麻將牌：${myHandDisplay}

請選擇一張牌打出。只能從上面列出的牌中選擇。

回覆格式：{"tile_name":"牌名"}

例如：{"tile_name":"三萬"}`;

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

  let prompt = `摸到：${drawnTileDisplay}

你的牌：${myHandDisplay}

可選動作：
${actionChoices || '無'}

請選擇一個編號（1-${availableActions.length || 1}）：

回覆格式：{"action_index":編號}`;

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

  let prompt = `對方打出：${discardDisplay}

你的牌：${myHandDisplay}

可選動作：
${actionChoices || '無'}
${passOptionNum}. pass

請選擇一個編號（1-${passOptionNum}）：

回覆格式：{"action_index":編號}`;

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
