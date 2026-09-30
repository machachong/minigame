// 每日功课 + 每日一偈(日留存双钩子)
import { bus, Events } from '../core/EventBus';
import { AD_LIMITS, DAILY_TAP_GOAL, STREAK_ORNAMENT_DAYS, STREAK_ORNAMENT_ID } from '../data/configs';
import { STRINGS } from '../data/strings';
import { dateKeyOf, todayKey } from '../utils/format';
import { rollDaily } from '../utils/dailyRules';
import type { Game } from '../Game';
import type { AdTag } from './AdSystem';

export class DailySystem {
  private game: Game;

  constructor(game: Game) {
    this.game = game;
  }

  /** 日期变化时重置(每次启动/跨天时调用) */
  rolloverIfNeeded(): void {
    const save = this.game.save;
    const today = todayKey();
    if (save.daily.dateKey === today) return;
    const yesterday = dateKeyOf(Date.now() - 86400000);
    save.daily = rollDaily(save.daily, today, yesterday);
    this.game.saveManager.markDirty();
  }

  onTap(): void {
    const save = this.game.save;
    const before = save.daily.taps;
    save.daily.taps += 1;
    if (before < DAILY_TAP_GOAL && save.daily.taps >= DAILY_TAP_GOAL) {
      bus.emit(Events.DAILY_GOAL, {});
      const bonus = this.game.gongfa.dailyBonus();
      if (bonus > 0) this.game.merit.addMerit(bonus, 'dayuan');
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
      this.grantStreakOrnament(save.daily.streak);
      this.game.merit.addMerit(reward, 'daily_guest');
      bus.emit(Events.DAILY_CLAIMED, { reward, streak: save.daily.streak });
      this.game.saveManager.markDirty();
      return { ok: true, reward, streak: save.daily.streak };
    }

    try {
      // 先强制上报当日 taps,确保云端累计 ≥ 目标后再领奖
      await this.game.sync.flush();
      const res = await wx.cloud.callFunction({ name: 'dailyClaim', data: {} });
      const r = res.result || {};
      if (r.ok) {
        save.daily.claimed = true;
        save.daily.streak = r.streak || save.daily.streak + 1;
        this.grantStreakOrnament(save.daily.streak);
        // 云端已入账,本地仅镜像,避免双倍
        this.game.merit.applyCloudReward(r.reward, 'daily');
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
        // 云端已入账,本地仅镜像,避免双倍
        this.game.merit.applyCloudReward(r.reward || 100, 'share');
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

  /**
   * 广告看完后记一次。在线时先写云端,离线翻倍才认这次记录;
   * 云端拒绝(超限)则本地也不记,避免和频控不一致。
   */
  async recordAd(tag: AdTag): Promise<boolean> {
    if (this.remain(tag) <= 0) return false;
    if (this.game.sync.state === 'guest') {
      this.adWatched(tag);
      return true;
    }
    try {
      const res = await wx.cloud.callFunction({ name: 'dailyClaim', data: { type: 'ad', tag } });
      const r = res.result || {};
      if (!r.ok) return false;
      this.adWatched(tag);
      return true;
    } catch (e) {
      console.warn('[Daily] ad record 失败:', e);
      return false;
    }
  }

  private remain(tag: string): number {
    return this.adRemain(tag, AD_LIMITS[tag] || 1);
  }

  private grantStreakOrnament(streak: number): void {
    if (streak < STREAK_ORNAMENT_DAYS) return;
    if (this.game.save.extra.ornamentId) return;
    this.game.save.extra.ornamentId = STREAK_ORNAMENT_ID;
    this.game.toast.show(STRINGS.ornamentGot);
  }

  adTotalToday(): number {
    return Object.values(this.game.save.daily.adWatch).reduce((a, b) => a + b, 0);
  }
}
