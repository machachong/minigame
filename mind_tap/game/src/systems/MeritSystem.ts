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

  /** 单次敲击功德(一期无功法) */
  get meritPerTap(): number {
    return 1 * (1 + this.skinBonus);
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

  /** 直接加功德(离线收益/宝箱/分享奖励) */
  addMerit(amount: number, _reason: string): void {
    const save = this.game.save;
    save.merit += amount;
    save.pendingMerit += amount;
    this.game.saveManager.markDirty();
    bus.emit(Events.MERIT_CHANGED, { merit: save.merit, gain: amount });
    this.game.levelSystem.checkLevelUp();
  }
}
