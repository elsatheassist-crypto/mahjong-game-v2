import { Tile } from './tile';
import { Meld } from './player';
import { WinType, getWinType, checkWin } from './win';

export interface ScoreBreakdown {
  total: number;
  details: ScoreDetail[];
}

export interface ScoreDetail {
  name: string;
  tai: number;
  type: WinType | string;
}

export function calculateScore(
  hand: Tile[],
  melds: Meld[],
  specialType?: string
): number {
  return calculateScoreBreakdown(hand, melds, specialType).total;
}

export function calculateScoreBreakdown(
  hand: Tile[],
  melds: Meld[],
  specialType?: string
): ScoreBreakdown {
  const details: ScoreDetail[] = [];
  const winResult = checkWin(hand, melds);

  if (!winResult.isWin) {
    return { total: 0, details: [] };
  }

  const winType = getWinType(hand, melds);

  if (specialType === 'tianhu') {
    details.push({ name: '天胡', tai: 16, type: 'tianhu' });
  }
  if (specialType === 'dihu') {
    details.push({ name: '地胡', tai: 16, type: 'dihu' });
  }
  if (winType === 'dasi_xi') {
    details.push({ name: '大四喜', tai: 16, type: 'dasi_xi' });
  }

  if (specialType === 'renhu') {
    details.push({ name: '人胡', tai: 8, type: 'renhu' });
  }
  if (winType === 'dasanyuan') {
    details.push({ name: '大三元', tai: 8, type: 'dasanyuan' });
  }
  if (winType === 'ziyise') {
    details.push({ name: '字一色', tai: 8, type: 'ziyise' });
  }
  if (winType === 'qingyise') {
    details.push({ name: '清一色', tai: 8, type: 'qingyise' });
  }

  if (winType === 'hunyise') {
    details.push({ name: '混一色', tai: 4, type: 'hunyise' });
  }
  if (winType === 'pengpenghu') {
    details.push({ name: '碰碰胡', tai: 4, type: 'pengpenghu' });
  }

  if (winType === 'quanqiuren') {
    details.push({ name: '全求人', tai: 2, type: 'quanqiuren' });
  }

  if (specialType === 'zimo') {
    details.push({ name: '自摸', tai: 1, type: 'zimo' });
  }
  if (winType === 'menqing') {
    details.push({ name: '門清', tai: 1, type: 'menqing' });
  }
  if (winType === 'pinghu') {
    details.push({ name: '平胡', tai: 1, type: 'pinghu' });
  }
  if (specialType === 'haidilaoyue') {
    details.push({ name: '海底撈月', tai: 1, type: 'haidilaoyue' });
  }
  if (specialType === 'hediayuyu') {
    details.push({ name: '河底撈魚', tai: 1, type: 'hediayuyu' });
  }
  if (specialType === 'gangshanghua') {
    details.push({ name: '槓上開花', tai: 1, type: 'gangshanghua' });
  }
  if (specialType === 'qiangganghu') {
    details.push({ name: '搶槓胡', tai: 1, type: 'qiangganghu' });
  }

  if (details.length === 0) {
    details.push({ name: '基本胡', tai: 0, type: 'standard' });
  }

  const total = details.reduce((sum, d) => sum + d.tai, 0);
  return { total, details };
}
