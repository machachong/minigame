// 听经、功法、入灭。广告和钥匙不参与这一层,听经随时可进。

export type NoteType = 'tap' | 'hold' | 'slide';
export type GradeId = 'supreme' | 'insight' | 'entry' | 'fail';

export interface Note {
  t: number;
  type: NoteType;
  pos: number;
  dur?: number;
  to?: number;
}

export interface ChartDef {
  id: string;
  name: string;
  unlockLevel: number;
  gongfaId: string;
  duration: number;
  gap: number;
  perfectMs: number;
  goodMs: number;
  cycle: NoteType[];
}

export interface GongfaDef {
  id: string;
  name: string;
  desc: string;
}

export const REBIRTH_MERIT = 1_000_000;
export const RELIC_FLAT = 0.5;
export const ENERGY_MAX = 100;
export const BODHI_COST = 10;
export const NOTE_CAP = 40;

export const GRADE_NAME: Record<GradeId, string> = {
  supreme: '无上正觉',
  insight: '明心见性',
  entry: '初窥门径',
  fail: '杂念纷飞',
};

export const CHARTS: ChartDef[] = [
  { id: 'xinjing', name: '心经', unlockLevel: 0, gongfaId: 'jingxin', duration: 22, gap: 0.9, perfectMs: 80, goodMs: 140, cycle: ['tap', 'tap', 'tap', 'hold'] },
  { id: 'dabei', name: '大悲咒', unlockLevel: 1, gongfaId: 'cibei', duration: 24, gap: 0.64, perfectMs: 60, goodMs: 120, cycle: ['tap', 'tap', 'slide', 'tap'] },
  { id: 'jingang', name: '金刚经', unlockLevel: 2, gongfaId: 'bore', duration: 26, gap: 0.5, perfectMs: 50, goodMs: 110, cycle: ['tap', 'hold', 'tap', 'slide'] },
  { id: 'lengyan', name: '楞严咒', unlockLevel: 3, gongfaId: 'pomo', duration: 26, gap: 0.42, perfectMs: 48, goodMs: 100, cycle: ['tap', 'slide', 'hold', 'tap'] },
  { id: 'huayan', name: '华严经', unlockLevel: 4, gongfaId: 'fajie', duration: 28, gap: 0.36, perfectMs: 45, goodMs: 90, cycle: ['tap', 'slide', 'tap', 'hold'] },
];

export const GONGFA: GongfaDef[] = [
  { id: 'jingxin', name: '静心咒', desc: '敲击功德 +8%' },
  { id: 'cibei', name: '慈悲愿', desc: '连击不断的时间更长' },
  { id: 'bore', name: '般若力', desc: '听经判定更宽' },
  { id: 'pomo', name: '破魔印', desc: '驱散烦恼时功德更多' },
  { id: 'fajie', name: '法界观', desc: '离线禅修收益翻倍' },
  { id: 'dayuan', name: '大愿力', desc: '每日功课圆满时额外功德' },
];

export const MANTRAS = [
  { id: 'daming', name: '六字真言', unlockLevel: 1, desc: '能量满后一次 +80 功德' },
  { id: 'wangsheng', name: '净土莲华', unlockLevel: 3, desc: '能量满后 20 秒功德翻倍' },
];

export function slotCount(levelIndex: number): number {
  if (levelIndex >= 4) return 3;
  if (levelIndex >= 2) return 2;
  return 1;
}
