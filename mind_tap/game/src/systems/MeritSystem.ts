// 功德结算系统(配置驱动)
// 公式:单次功德 = 1 × (1 + 皮肤加成);连击不直接加功德(防无脑狂敲/防刷)
import { bus, Events } from '../core/EventBus';
import { SKINS } from '../data/configs';
import type { Game } from '../Game';

export class MeritSystem {
  private game: Game;

  constructor(game: Game) {
    this.game = game;
  }

  /** 当前皮肤加成系数 */
  get skinBonus(): number {
    const skin = SKINS.find((s) => s.id === this.game.save.skinId);
    return skin ? skin.bonus : 0;
  }

  /** 单次敲击功德(一期无功法;静心加成 buff 内翻倍) */
  get meritPerTap(): number {
    const buff = (this.game.save.extra.meritDoubleUntil || 0) > Date.now() ? 2 : 1;
    return 1 * (1 + this.skinBonus) * buff;
  }

  /** 一次敲击结算(由 HomeScene 判定后调用,每帧至多 1 次) */
  onTap(): number {
    const gain = this.meritPerTap;
    const save = this.game.save;
    save.merit += gain;
    save.totalTaps += 1;
    save.pendingTaps += 1;
    save.pendingMerit += gain;
    this.game.saveManager.markDirty();

    bus.emit(Events.MERIT_CHANGED, { merit: save.merit, gain });
    this.game.levelSystem.checkLevelUp();
    this.game.daily.onTap();
    this.game.sync.onLocalTap();
    return gain;
  }

  /** 直接加功德(游客模式本地结算,或本地发放的奖励) */
  addMerit(amount: number, _reason: string): void {
    const save = this.game.save;
    save.merit += amount;
    save.pendingMerit += amount;
    this.game.saveManager.markDirty();
    bus.emit(Events.MERIT_CHANGED, { merit: save.merit, gain: amount });
    this.game.levelSystem.checkLevelUp();
  }

  /**
   * 云端已入账的奖励:本地只更新镜像,不进入 pendingMerit,
   * 避免下次 flush 时重复上报导致双倍发放(宝箱/分享/离线收益)。
   */
  applyCloudReward(amount: number, _reason: string): void {
    const save = this.game.save;
    save.merit += amount;
    this.game.saveManager.markDirty();
    bus.emit(Events.MERIT_CHANGED, { merit: save.merit, gain: amount });
    this.game.levelSystem.checkLevelUp();
  }
}
