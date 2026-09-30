// 云同步服务:登录状态机 + 本地镜像 + 批量上报 + 游客降级
// 状态机: guest(超时降级,可玩) → online(已登录) → syncing → online/error
import { bus, Events } from '../core/EventBus';
import { CLOUD_ENV, SYNC_CONFIG } from '../data/configs';
import { todayKey } from '../utils/format';
import { ensurePlay, mergePlay } from './playRules';
import type { Game } from '../Game';

export type SyncState = 'guest' | 'online' | 'syncing' | 'error';

export class SyncService {
  private game: Game;
  state: SyncState = 'guest';
  private openid = '';
  private flushTimer: any = null;
  private retryTimer: any = null;
  private syncing = false;

  constructor(game: Game) {
    this.game = game;
  }

  /** 启动登录(带 2.5s 超时降级) */
  async init(): Promise<void> {
    if (typeof wx.cloud === 'undefined') {
      console.warn('[Sync] 基础库不支持云开发,进入游客模式');
      this.setState('guest');
      return;
    }
    try {
      wx.cloud.init({ env: CLOUD_ENV, traceUser: false });
    } catch (e) {
      console.warn('[Sync] cloud.init 失败:', e);
      this.setState('guest');
      return;
    }

    const loginPromise = this.doLogin();
    const timeoutPromise = new Promise<'timeout'>((resolve) =>
      setTimeout(() => resolve('timeout'), SYNC_CONFIG.loginTimeoutMs)
    );
    const result = await Promise.race([loginPromise, timeoutPromise]);
    if (result === 'timeout') {
      console.warn('[Sync] 登录超时,游客模式');
      this.setState('guest');
      this.scheduleRetry();
    }
  }

  private async doLogin(): Promise<void> {
    try {
      const res = await wx.cloud.callFunction({ name: 'login', data: {} });
      const { openid, profile } = res.result || {};
      if (!openid) throw new Error('no openid');
      this.openid = openid;
      this.setState('online');
      // 字段级合并:本地有未同步增量时保留本地,否则以云端为权威
      await this.mergeFromCloud(profile);
      // 启动定时上报
      this.startFlushTimer();
      // 上报存量
      this.flush();
    } catch (e) {
      console.warn('[Sync] login 云函数失败:', e);
      this.setState('guest');
      this.scheduleRetry();
    }
  }

  /** 同一世取较大功德。入灭后轮次更高的那一侧为准,避免清零被旧档加回去。 */
  private async mergeFromCloud(profile: any): Promise<void> {
    if (!profile) return;
    const save = this.game.save;
    const play = ensurePlay(save);
    let cloudMerit = profile.merit || 0;
    let cloudCycle = profile.cycle || 0;
    if (play.pendingRebirth && play.cycle > cloudCycle) {
      const pushed = await this.pushRebirth();
      if (pushed) {
        cloudMerit = 0;
        cloudCycle = play.cycle;
      }
    }
    if (cloudCycle > play.cycle) {
      save.merit = cloudMerit;
      play.cycle = cloudCycle;
      play.relics = profile.relics || play.relics;
      play.pendingRebirth = false;
      save.pendingMerit = 0;
    } else if (!(play.pendingRebirth && play.cycle > (profile.cycle || 0))) {
      save.merit = Math.max(save.merit, cloudMerit);
      play.pendingRebirth = false;
    }
    save.totalTaps = Math.max(save.totalTaps, profile.totalTaps || 0);
    this.mergePractice(profile.daily);
    if (profile.extraPlay) mergePlay(play, profile.extraPlay);
    play.levelPeak = Math.max(play.levelPeak || 0, profile.levelPeak || 0);
    // 库存:永远取并集(另一台设备解锁的内容要能同步过来)
    if (profile.inventory) {
      save.inventory.skins = Array.from(new Set([...save.inventory.skins, ...(profile.inventory.skins || [])]));
      save.inventory.scenes = Array.from(new Set([...save.inventory.scenes, ...(profile.inventory.scenes || [])]));
      save.inventory.bgms = Array.from(new Set([...save.inventory.bgms, ...(profile.inventory.bgms || [])]));
    }
    // 装备:本地装备失效时回退云端(仅当云端装备在本地库存内)
    if (!save.inventory.skins.includes(save.skinId) && profile.skinId && save.inventory.skins.includes(profile.skinId)) {
      save.skinId = profile.skinId;
    }
    if (!save.inventory.scenes.includes(save.sceneId) && profile.sceneId && save.inventory.scenes.includes(profile.sceneId)) {
      save.sceneId = profile.sceneId;
    }
    // 本地有增量 → 由 flush 上报;云端数据由服务端累加
    save.lastSyncAt = Date.now();
    this.game.saveManager.markDirty();
    this.game.levelSystem.checkLevelUp(); // 校准境界
  }

  /** 同一天的修行进度取较大值，换设备登录不会把今天清掉 */
  private mergePractice(cloudDaily: any): void {
    const save = this.game.save;
    if (!cloudDaily || cloudDaily.dateKey !== todayKey() || save.daily.dateKey !== cloudDaily.dateKey) return;
    save.daily.practiceDone = !!(save.daily.practiceDone || cloudDaily.practiceDone);
    save.daily.practiceProgress = Math.max(save.daily.practiceProgress || 0, cloudDaily.practiceProgress || 0);
    save.daily.practiceStreak = Math.max(save.daily.practiceStreak || 0, cloudDaily.practiceStreak || 0);
  }

  /** 敲击后调用:攒批或到量即上报 */
  onLocalTap(): void {
    if (this.state !== 'online') return;
    if (this.game.save.pendingTaps >= SYNC_CONFIG.tapBatchSize) this.flush();
  }

  private startFlushTimer(): void {
    if (this.flushTimer) clearInterval(this.flushTimer);
    this.flushTimer = setInterval(() => {
      if (this.game.save.pendingTaps > 0) this.flush();
    }, SYNC_CONFIG.flushIntervalMs);
  }

  private scheduleRetry(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => {
      console.log('[Sync] 静默重试登录...');
      this.init();
    }, 15000);
  }

  /** 上报增量到云端(节流 + 防重入) */
  /** presence=true:切后台时即使没有增量,也刷新云端 lastSeenAt */
  async flush(presence = false): Promise<void> {
    if (this.state === 'guest' || this.syncing) return;
    const save = this.game.save;
    if (!presence && save.pendingTaps === 0 && save.pendingMerit === 0) return;

    this.syncing = true;
    const taps = save.pendingTaps;
    const merit = save.pendingMerit;
    // 先清零本地待同步量,失败再加回(避免重复)
    save.pendingTaps = 0;
    save.pendingMerit = 0;

    try {
      const res = await wx.cloud.callFunction({
        name: 'syncProfile',
        data: {
          tapsDelta: taps,
          meritDelta: merit,
          profile: {
            skinId: save.skinId,
            sceneId: save.sceneId,
            bgmId: save.bgmId,
            soundOn: save.soundOn,
            vibrateOn: save.vibrateOn,
            tapSound: save.tapSound,
            inventory: save.inventory,
            play: ensurePlay(save),
            practice: {
              dateKey: save.daily.dateKey,
              practiceProgress: save.daily.practiceProgress || 0,
              practiceDone: !!save.daily.practiceDone,
              practiceStreak: save.daily.practiceStreak || 0,
            },
          },
        },
      });
      const r = res.result || {};
      if (r.ok) {
        save.lastSyncAt = Date.now();
        this.setState('online');
      } else {
        throw new Error(r.err || 'sync failed');
      }
    } catch (e) {
      console.warn('[Sync] flush 失败,增量回滚:', e);
      save.pendingTaps += taps;
      save.pendingMerit += merit;
    } finally {
      this.syncing = false;
      this.game.saveManager.markDirty();
    }
  }

  /** 在线入灭。服务端把功德清零并加一轮,本地再开始累计。 */
  async pushRebirth(): Promise<boolean> {
    if (this.state === 'guest') return false;
    try {
      const res = await wx.cloud.callFunction({ name: 'syncProfile', data: { rebirth: true } });
      const r = res.result || {};
      if (!r.ok) return false;
      const play = ensurePlay(this.game.save);
      play.cycle = r.cycle;
      play.relics = r.relics;
      play.pendingRebirth = false;
      this.game.saveManager.markDirty();
      return true;
    } catch (e) {
      console.warn('[Sync] 入灭失败:', e);
      return false;
    }
  }

  /** 离线收益:客户端展示预估值,权威结算走云函数 */
  async calcOfflineReward(): Promise<{ merit: number; hours: number } | null> {
    const save = this.game.save;
    const hours = Math.min(
      (Date.now() - save.lastSeenAt) / 3600000,
      12
    );
    if (hours < 0.05) return null; // 不足 3 分钟不给
    // 预估:等效 300 次/小时 × 境界系数
    const merit = Math.floor(300 * hours * this.game.levelSystem.offlineCoeff);
    return { merit, hours };
  }

  async claimOfflineReward(expectedMerit: number, doubled: boolean): Promise<number> {
    if (this.state === 'guest') {
      // 游客模式:本地直接结算(联网后由 merge 校准)
      const amount = expectedMerit * (doubled ? 2 : 1);
      this.game.merit.addMerit(amount, 'offline_guest');
      this.markOfflineClaimed();
      return amount;
    }
    try {
      const res = await wx.cloud.callFunction({
        name: 'offlineCalc',
        data: { doubled },
      });
      const r = res.result || {};
      if (r.ok && r.merit > 0) {
        // 云端已入账,本地仅镜像,避免双倍
        this.game.merit.applyCloudReward(r.merit, 'offline');
        this.markOfflineClaimed();
        return r.merit;
      }
    } catch (e) {
      console.warn('[Sync] 离线结算失败:', e);
    }
    return 0;
  }

  /** 领过之后把离开时间拨到现在,避免回到前台又弹出同一笔 */
  private markOfflineClaimed(): void {
    const now = Date.now();
    this.game.save.lastSeenAt = now;
    this.game.save.offlineClaimedAt = now;
    this.game.saveManager.markDirty();
  }

  private setState(s: SyncState): void {
    this.state = s;
    bus.emit(Events.SYNC_STATE, s);
  }

  destroy(): void {
    if (this.flushTimer) clearInterval(this.flushTimer);
    if (this.retryTimer) clearTimeout(this.retryTimer);
  }
}
