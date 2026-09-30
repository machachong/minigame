import {
  COPY_CHARS,
  COPY_DOTS,
  LESSONS,
  LISTEN_MS,
  NOTCH_CAP,
  ONCE_WAIT_MS,
  RING_SLOTS,
  RING_TAPS,
  SETTLE_GAP_MS,
  SETTLE_GOAL,
  VERSES,
  type LessonDef,
  type LessonId,
} from '../data/practice';

export function ringCount(totalTaps: number): number {
  let n = 0;
  for (let i = 0; i < RING_TAPS.length; i++) {
    if (totalTaps >= RING_TAPS[i]) n += 1;
  }
  return n;
}

/** 第 index 圈（0 为最外圈）相对鱼半径的比例 */
export function ringRadiusRatio(index: number): number {
  if (RING_SLOTS <= 1) return 0.72;
  return 0.72 - (index * (0.72 - 0.28)) / (RING_SLOTS - 1);
}

export function ringPitch(totalTaps: number): number {
  return 1 - 0.02 * ringCount(totalTaps);
}

export function notchCount(cycle: number): number {
  const n = Math.floor(cycle);
  if (n <= 0) return 0;
  return n > NOTCH_CAP ? NOTCH_CAP : n;
}

/** 北京时间日期 YYYY-MM-DD 距 2026-01-01 的天数 */
export function dayIndexOf(dateKey: string): number {
  const parts = dateKey.split('-');
  if (parts.length !== 3) return 0;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!y || !m || !d) return 0;
  const utc = Date.UTC(y, m - 1, d);
  const origin = Date.UTC(2026, 0, 1);
  return Math.floor((utc - origin) / 86400000);
}

export function lessonOf(dayIndex: number): LessonDef {
  const i = ((dayIndex % LESSONS.length) + LESSONS.length) % LESSONS.length;
  return LESSONS[i];
}

export function verseOf(dayIndex: number): string {
  const lesson = lessonOf(dayIndex);
  const lines = VERSES[lesson.id];
  const i = Math.floor(dayIndex / LESSONS.length) % lines.length;
  return lines[i];
}

export function copyCharOf(dayIndex: number): string {
  const i = ((Math.floor(dayIndex / LESSONS.length) % COPY_CHARS.length) + COPY_CHARS.length) % COPY_CHARS.length;
  return COPY_CHARS[i];
}

/** 抄经点在鱼身局部坐标中的位置，单位是鱼半径 */
export function copyDotOffset(index: number): { x: number; y: number } {
  const t = (index + 0.5) / COPY_DOTS;
  return {
    x: -0.55 + t * 1.1,
    y: -0.08 - Math.sin(t * Math.PI) * 0.42,
  };
}

export function practiceLabel(lesson: LessonDef, progress: number, done: boolean): string {
  if (done) return '今日修行已圆满';
  if (progress <= 0) return `今日 · ${lesson.name}`;
  if (lesson.id === 'listen') {
    const sec = Math.min(lesson.goal, Math.floor(progress / 1000));
    return `今日 · ${lesson.name} ${sec}/${lesson.goal}`;
  }
  return `今日 · ${lesson.name} ${progress}/${lesson.goal}`;
}

export interface SettleResult {
  progress: number;
  countMerit: boolean;
  done: boolean;
  lastAt: number;
  hint: string;
}

export function applySettle(progress: number, now: number, lastAt: number): SettleResult {
  if (lastAt > 0 && now - lastAt < SETTLE_GAP_MS) {
    return { progress, countMerit: false, done: false, lastAt, hint: '太急' };
  }
  const next = progress + 1;
  return { progress: next, countMerit: true, done: next >= SETTLE_GOAL, lastAt: now, hint: '' };
}

export function applyOnceTap(): { progress: number; countMerit: boolean } {
  return { progress: 1, countMerit: true };
}

export function onceReady(waitMs: number): boolean {
  return waitMs >= ONCE_WAIT_MS;
}

export function listenReady(elapsedMs: number): boolean {
  return elapsedMs >= LISTEN_MS;
}

export interface CopyResult {
  progress: number;
  countMerit: boolean;
  done: boolean;
  shake: boolean;
}

export function applyCopy(progress: number, hitIndex: number): CopyResult {
  if (hitIndex === progress) {
    const next = progress + 1;
    return { progress: next, countMerit: true, done: next >= COPY_DOTS, shake: false };
  }
  return { progress, countMerit: false, done: false, shake: true };
}

export function lessonIdOf(dayIndex: number): LessonId {
  return lessonOf(dayIndex).id;
}
