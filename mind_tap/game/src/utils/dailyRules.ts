// 每日功课跨天规则。云函数 syncProfile / dailyClaim 必须保持同一口径。
import type { DailyState } from '../data/types';

export function rollDaily(daily: DailyState, today: string, yesterday: string): DailyState {
  if (daily.dateKey === today) return daily;
  // 只有「昨天领过」才保住连续天数；隔天或昨天没领，断签
  const streak = daily.dateKey === yesterday && daily.claimed ? daily.streak : 0;
  const practiceStreak = daily.dateKey === yesterday && daily.practiceDone ? daily.practiceStreak : 0;
  return {
    dateKey: today,
    taps: 0,
    claimed: false,
    streak,
    shareMeritClaimed: false,
    adWatch: {},
    practiceProgress: 0,
    practiceDone: false,
    practiceStreak,
  };
}

export function selfCheckDailyRules(): void {
  const yesterday = '2026-09-29';
  const today = '2026-09-30';
  const base = {
    dateKey: yesterday,
    taps: 100,
    claimed: true,
    streak: 3,
    shareMeritClaimed: true,
    adWatch: { offline_double: 1 },
    practiceProgress: 4,
    practiceDone: true,
    practiceStreak: 2,
  };
  const kept = rollDaily(base, today, yesterday);
  if (kept.streak !== 3 || kept.claimed || kept.taps !== 0 || kept.shareMeritClaimed) {
    throw new Error('yesterday claimed should keep streak and reset the day');
  }
  if (kept.practiceDone || kept.practiceProgress !== 0 || kept.practiceStreak !== 2) {
    throw new Error('yesterday practice should keep streak and reset progress');
  }
  const skipped = rollDaily({ ...base, dateKey: '2026-09-20' }, today, yesterday);
  if (skipped.streak !== 0 || skipped.practiceStreak !== 0) throw new Error('skipped day should break streak');
  const same = rollDaily({ ...base, dateKey: today, taps: 12, streak: 2, practiceProgress: 3 }, today, yesterday);
  if (same.taps !== 12 || same.streak !== 2 || same.practiceProgress !== 3) {
    throw new Error('same day must not reset');
  }
}
