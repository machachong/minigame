// 每日功课 + 每日一偈(日留存双钩子)
import { bus, Events } from '../core/EventBus';
import { DAILY_TAP_GOAL } from '../data/configs';
import { todayKey } from '../utils/format';
import type { Game } from '../Game';

export class DailySystem {
  private game: Game;

  constructor(game: Game) {
    this.game = game;
  }

  /** 日期变化时重置(每次启动/跨天时调用) */
  rolloverIfNeeded(): void {
    const save = this.game.save;
    const today = todayKey();
    if (save.daily.dateKey !== today) {
      // 连续天数:昨天完成过才 +1,否则断签
      const yesterday = todayKey() === save.daily.dateKey; // 占位,精确逻辑在云端
      save.daily = {
        dateKey: today,
        taps: 0,
        claimed: false,
        streak: save.daily.claimed ? save.daily.streak : 0,
        shareMeritClaimed: false,
        adWatch: {},
      };
      this.game.saveManager.markDirty();
    }
  }

  onTap(): void {
    const save = this.game.save;
    const before = save.daily.taps;
    save.daily.taps += 1;
    if (before < DAILY_TAP_GOAL && save.daily.taps >= DAILY_TAP_GOAL) {
      bus.emit(Events.DAILY_GOAL, {});
    }
  }

  get progress(): { taps: number; goal: number; done: boolean; claimed: boolean } {
    const d = this.game.save.daily;
    return {
      taps: Math.min(d.taps, DAILY_TAP_GOAL),
      goal: DAILY_TAP_GOAL,
      done: d.taps >= DAILY_TAP_GOAL,
      claimed: d.claimed,
    };
  }

  get streak(): number {
    return this.game.save.daily.streak;
  }

  /** 领取每日功课宝箱(云端权威) */
  async claim(): Promise<{ ok: boolean; reward?: number; streak?: number }> {
    const save = this.game.save;
    if (!this.progress.done || save.daily.claimed) return { ok: false };

    if (this.game.sync.state === 'guest') {
      // 游客模式本地发放,联网后由云端校准
      const reward = 88;
      save.daily.claimed = true;
      save.daily.streak += 1;
      this.game.merit.addMerit(reward, 'daily_guest');
      bus.emit(Events.DAILY_CLAIMED, { reward, streak: save.daily.streak });
      this.game.saveManager.markDirty();
      return { ok: true, reward, streak: save.daily.streak };
    }

    try {
      const res = await wx.cloud.callFunction({ name: 'dailyClaim', data: {} });
      const r = res.result || {};
      if (r.ok) {
        save.daily.claimed = true;
        save.daily.streak = r.streak || save.daily.streak + 1;
        this.game.merit.addMerit(r.reward, 'daily');
        bus.emit(Events.DAILY_CLAIMED, { reward: r.reward, streak: save.daily.streak });
        this.game.saveManager.markDirty();
        return { ok: true, reward: r.reward, streak: save.daily.streak };
      }
    } catch (e) {
      console.warn('[Daily] claim 失败:', e);
    }
    return { ok: false };
  }

  /** 分享得功德(每日首次,云端校验) */
  async claimShareMerit(): Promise<boolean> {
    const save = this.game.save;
    if (save.daily.shareMeritClaimed) return false;
    if (this.game.sync.state === 'guest') {
      save.daily.shareMeritClaimed = true;
      this.game.merit.addMerit(100, 'share_guest');
      this.game.saveManager.markDirty();
      return true;
    }
    try {
      const res = await wx.cloud.callFunction({ name: 'dailyClaim', data: { type: 'share' } });
      const r = res.result || {};
      if (r.ok) {
        save.daily.shareMeritClaimed = true;
        this.game.merit.addMerit(r.reward || 100, 'share');
        this.game.saveManager.markDirty();
        return true;
      }
    } catch (e) {
      console.warn('[Daily] share claim 失败:', e);
    }
    return false;
  }

  /** 广告点位当日剩余次数 */
  adRemain(tag: string, limit: number): number {
    const used = this.game.save.daily.adWatch[tag] || 0;
    return Math.max(0, limit - used);
  }

  adWatched(tag: string): void {
    const d = this.game.save.daily;
    d.adWatch[tag] = (d.adWatch[tag] || 0) + 1;
    this.game.saveManager.markDirty();
  }

  adTotalToday(): number {
    return Object.values(this.game.save.daily.adWatch).reduce((a, b) => a + b, 0);
  }
}
