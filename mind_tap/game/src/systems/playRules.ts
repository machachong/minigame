import type { SaveData } from '../data/types';
import { CHARTS, NOTE_CAP, type ChartDef, type GradeId, type Note } from '../data/play';

export interface PlayState {
  learned: string[];
  slots: string[];
  mastered: string[];
  mantra: string;
  energy: number;
  bodhi: number;
  relics: number;
  cycle: number;
  levelPeak: number;
  grades: Record<string, string>;
  pendingRebirth: boolean;
}

const GRADE_RANK: Record<string, number> = { fail: 1, entry: 2, insight: 3, supreme: 4 };

export function ensurePlay(save: SaveData): PlayState {
  const raw = (save.extra.play || {}) as Partial<PlayState>;
  const play: PlayState = {
    learned: Array.isArray(raw.learned) ? raw.learned : [],
    slots: Array.isArray(raw.slots) ? raw.slots : [],
    mastered: Array.isArray(raw.mastered) ? raw.mastered : [],
    mantra: raw.mantra || '',
    energy: raw.energy || 0,
    bodhi: raw.bodhi || 0,
    relics: raw.relics || 0,
    cycle: raw.cycle || 0,
    levelPeak: raw.levelPeak || 0,
    grades: raw.grades || {},
    pendingRebirth: !!raw.pendingRebirth,
  };
  save.extra.play = play;
  return play;
}

export function buildChart(def: ChartDef): Note[] {
  const notes: Note[] = [];
  let t = 1;
  let i = 0;
  while (t < def.duration - 0.25 && notes.length < NOTE_CAP) {
    const type = def.cycle[i % def.cycle.length];
    const pos = 0.22 + ((i * 47) % 56) / 100;
    const dur = type === 'tap' ? undefined : Math.max(0.28, def.gap * 0.85);
    const to = type === 'slide'
      ? (pos > 0.5 ? Math.max(0.18, pos - 0.28) : Math.min(0.82, pos + 0.28))
      : undefined;
    notes.push({ t: round3(t), type, pos: round3(pos), dur, to });
    t += def.gap + (type === 'tap' ? 0 : (dur || 0) * 0.45);
    i += 1;
  }
  return notes;
}

export function judgeDelta(deltaMs: number, perfectMs: number, goodMs: number): 'perfect' | 'good' | 'miss' {
  const d = Math.abs(deltaMs);
  if (d <= perfectMs) return 'perfect';
  if (d <= goodMs) return 'good';
  return 'miss';
}

export function gradeOf(perfect: number, good: number, miss: number): GradeId {
  const total = perfect + good + miss;
  if (total <= 0) return 'fail';
  const hit = (perfect + good) / total;
  if (miss === 0 && perfect / total >= 0.95) return 'supreme';
  if (hit >= 0.95) return 'insight';
  if (hit >= 0.8) return 'entry';
  return 'fail';
}

export function betterGrade(a: string, b: string): string {
  return (GRADE_RANK[a] || 0) >= (GRADE_RANK[b] || 0) ? a : b;
}

/** 另一台设备的功法进度并进来,不覆盖更高的评价 */
export function mergePlay(local: PlayState, cloud: Partial<PlayState> | null | undefined): void {
  if (!cloud) return;
  const learned = new Set([...(local.learned || []), ...((cloud.learned as string[]) || [])]);
  local.learned = Array.from(learned);
  const mastered = new Set([...(local.mastered || []), ...((cloud.mastered as string[]) || [])]);
  local.mastered = Array.from(mastered).filter((id) => local.learned.includes(id));
  const grades = { ...(cloud.grades || {}) };
  Object.keys(local.grades || {}).forEach((id) => {
    grades[id] = betterGrade(local.grades[id], grades[id] || '');
  });
  local.grades = grades;
  if (!local.slots.length && Array.isArray(cloud.slots)) local.slots = cloud.slots.filter((id) => local.learned.includes(id));
  if (!local.mantra && cloud.mantra) local.mantra = cloud.mantra;
  local.bodhi = Math.max(local.bodhi || 0, cloud.bodhi || 0);
  local.energy = Math.max(local.energy || 0, cloud.energy || 0);
  local.levelPeak = Math.max(local.levelPeak || 0, cloud.levelPeak || 0);
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function selfCheckPlayRules(): void {
  const chart = CHARTS[0];
  const notes = buildChart(chart);
  if (notes.length < 8 || notes.length > NOTE_CAP) throw new Error('chart length');
  for (let i = 1; i < notes.length; i++) {
    if (notes[i].t - notes[i - 1].t < chart.gap - 0.001) throw new Error('notes too dense');
  }
  if (judgeDelta(40, 80, 140) !== 'perfect') throw new Error('perfect');
  if (judgeDelta(100, 80, 140) !== 'good') throw new Error('good');
  if (judgeDelta(200, 80, 140) !== 'miss') throw new Error('miss');
  if (gradeOf(10, 0, 0) !== 'supreme') throw new Error('supreme');
  if (gradeOf(9, 1, 0) !== 'insight') throw new Error('insight');
  if (gradeOf(8, 0, 2) !== 'entry') throw new Error('entry');
  if (gradeOf(5, 0, 5) !== 'fail') throw new Error('fail');
  if (betterGrade('entry', 'supreme') !== 'supreme') throw new Error('rank');
}
