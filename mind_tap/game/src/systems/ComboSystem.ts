// 连击系统:计数、里程碑文案、中断渐隐提示
import { bus, Events } from '../core/EventBus';
import { FEEL } from '../data/configs';

export class ComboSystem {
  combo = 0;
  /** 距中断剩余时间(用于渐隐光晕提示) */
  private resetTimer = 0;
  private hitMilestones: Set<number> = new Set();

  onTap(): void {
    this.combo += 1;
    this.resetTimer = FEEL.comboResetMs;
    bus.emit(Events.COMBO_CHANGED, { combo: this.combo });

    if (FEEL.comboMilestones.includes(this.combo) && !this.hitMilestones.has(this.combo)) {
      this.hitMilestones.add(this.combo);
      bus.emit(Events.COMBO_MILESTONE, { combo: this.combo });
    }
  }

  update(dtMs: number): void {
    if (this.combo === 0) return;
    this.resetTimer -= dtMs;
    if (this.resetTimer <= 0) {
      this.combo = 0;
      this.hitMilestones.clear();
      bus.emit(Events.COMBO_CHANGED, { combo: 0 });
    }
  }

  /** 中断前 1.5s 渐隐系数(1→0) */
  get fadeHint(): number {
    if (this.combo === 0) return 0;
    return Math.max(0, Math.min(1, this.resetTimer / FEEL.comboResetMs));
  }
}
