// 境界系统:查表晋升 + 突破事件
import { bus, Events } from '../core/EventBus';
import { LEVELS, SKINS, SCENES, BGMS, LevelConfig } from '../data/configs';
import { ensurePlay } from './playRules';
import type { Game } from '../Game';

export class LevelSystem {
  private game: Game;
  /** 当前境界缓存(避免每次查表) */
  private currentIndex = -1;

  constructor(game: Game) {
    this.game = game;
  }

  /** 入灭后功德归零,境界留在到过的最高阶 */
  get peakIndex(): number {
    const play = ensurePlay(this.game.save);
    return Math.max(this.levelIndexOf(this.game.save.merit), play.levelPeak || 0);
  }

  get current(): LevelConfig {
    return LEVELS[this.peakIndex];
  }

  get next(): LevelConfig | null {
    const idx = this.peakIndex;
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
    const play = ensurePlay(this.game.save);
    if (this.currentIndex === -1) {
      this.currentIndex = Math.max(idx, play.levelPeak || 0);
      play.levelPeak = this.currentIndex;
      this.applyUnlocks(this.currentIndex);
      return;
    }
    const peak = play.levelPeak || 0;
    if (idx > peak) {
      for (let i = peak + 1; i <= idx; i++) {
        this.applyUnlocks(i);
        bus.emit(Events.LEVEL_UP, { levelIndex: i, name: LEVELS[i].name, unlocks: LEVELS[i].unlocks });
      }
      play.levelPeak = idx;
      this.currentIndex = idx;
      this.game.saveManager.markDirty();
    }
  }

  /** 入灭前记下最高境界,避免功德清零后掉回凡夫 */
  rememberPeak(): void {
    const play = ensurePlay(this.game.save);
    const idx = Math.max(this.levelIndexOf(this.game.save.merit), play.levelPeak || 0, Math.max(this.currentIndex, 0));
    play.levelPeak = idx;
    this.currentIndex = idx;
    this.applyUnlocks(idx);
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
    const base = 1 + this.peakIndex * 0.2;
    const mul = this.game.gongfa ? this.game.gongfa.offlineMul() : 1;
    return base * mul;
  }
}
