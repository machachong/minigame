// 境界系统:查表晋升 + 突破事件
import { bus, Events } from '../core/EventBus';
import { LEVELS, SKINS, SCENES, BGMS, LevelConfig } from '../data/configs';
import type { Game } from '../Game';

export class LevelSystem {
  private game: Game;
  /** 当前境界缓存(避免每次查表) */
  private currentIndex = -1;

  constructor(game: Game) {
    this.game = game;
  }

  get current(): LevelConfig {
    const idx = this.levelIndexOf(this.game.save.merit);
    return LEVELS[idx];
  }

  get next(): LevelConfig | null {
    const idx = this.levelIndexOf(this.game.save.merit);
    return idx < LEVELS.length - 1 ? LEVELS[idx + 1] : null;
  }

  levelIndexOf(merit: number): number {
    let idx = 0;
    for (let i = 0; i < LEVELS.length; i++) {
      if (merit >= LEVELS[i].merit) idx = i;
      else break;
    }
    return idx;
  }

  /** 距下一境界进度 0~1(已满级返回 1) */
  get progress(): number {
    const cur = this.current;
    const nxt = this.next;
    if (!nxt) return 1;
    const span = nxt.merit - cur.merit;
    return Math.min(1, Math.max(0, (this.game.save.merit - cur.merit) / span));
  }

  /** 检查并触发晋升(功德变化后调用) */
  checkLevelUp(): void {
    const idx = this.levelIndexOf(this.game.save.merit);
    if (this.currentIndex === -1) {
      // 首次初始化,不触发演出
      this.currentIndex = idx;
      this.applyUnlocks(idx);
      return;
    }
    if (idx > this.currentIndex) {
      for (let i = this.currentIndex + 1; i <= idx; i++) {
        this.applyUnlocks(i);
        bus.emit(Events.LEVEL_UP, { levelIndex: i, name: LEVELS[i].name, unlocks: LEVELS[i].unlocks });
      }
      this.currentIndex = idx;
      this.game.saveManager.markDirty();
    }
  }

  /** 解锁内容入库 */
  private applyUnlocks(levelIndex: number): void {
    const save = this.game.save;
    const addUnique = (arr: string[], id: string) => {
      if (!arr.includes(id)) arr.push(id);
    };
    // 按配置表发放该境界及之前所有解锁(兼容跳阶/恢复存档)
    for (const s of SKINS) if (s.unlockLevel <= levelIndex) addUnique(save.inventory.skins, s.id);
    for (const s of SCENES) if (s.unlockLevel <= levelIndex) addUnique(save.inventory.scenes, s.id);
    for (const b of BGMS) if (b.unlockLevel <= levelIndex && b.id !== 'none') addUnique(save.inventory.bgms, b.id);
  }

  /** 离线收益境界系数 */
  get offlineCoeff(): number {
    return 1 + this.current.index * 0.2;
  }
}
