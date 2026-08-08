// 格式化与日期工具
export function dateKeyOf(ts: number): string {
  // UTC+8 日期戳 YYYY-MM-DD
  const d = new Date(ts + 8 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

export function todayKey(): string {
  return dateKeyOf(Date.now());
}

/** 大数字格式化:≥10000 用「万」 */
export function fmtNumber(n: number): string {
  if (n < 10000) return String(Math.floor(n));
  if (n < 100000000) {
    const w = n / 10000;
    return (w >= 100 ? Math.floor(w) : w.toFixed(1)) + '万';
  }
  const y = n / 100000000;
  return (y >= 100 ? Math.floor(y) : y.toFixed(1)) + '亿';
}

/** 时长格式化:1.5h / 25min */
export function fmtDuration(ms: number): string {
  const min = ms / 60000;
  if (min < 60) return `${Math.floor(min)}分钟`;
  const h = min / 60;
  return `${h.toFixed(1)}小时`;
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
