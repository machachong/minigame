// 敲击过程中的随机事件:烦恼气泡、佛光、菩提子。不走广告。
import { ensurePlay } from './playRules';
import type { Game } from '../Game';

export class EventSystem {
  bubble: { x: number; y: number; life: number } | null = null;
  private pointer = { x: 0, y: 0 };
  private tapsSinceAura = 0;

  constructor(private game: Game) {}

  notePointer(x: number, y: number): void {
    this.pointer.x = x;
    this.pointer.y = y;
  }

  /** 每次有效敲击后掷事件。气泡另算一次额外功德。 */
  onTap(): void {
    this.tapsSinceAura += 1;
    const play = ensurePlay(this.game.save);
    if (!this.bubble && Math.random() < 0.05) {
      this.bubble = {
        x: this.pointer.x + (Math.random() * 80 - 40),
        y: this.pointer.y - 70,
        life: 6000,
      };
    }
    if (this.tapsSinceAura >= 28 && Math.random() < 0.35) {
      this.tapsSinceAura = 0;
      this.game.save.extra.auraUntil = Date.now() + 30_000;
      this.game.toast.show('佛光普照,30 秒功德翻倍');
    }
    if (Math.random() < 0.035) {
      play.bodhi += 1;
      this.game.toast.show(`菩提子 ${play.bodhi}`);
      this.game.saveManager.markDirty();
    }
  }

  update(dt: number): void {
    if (!this.bubble) return;
    this.bubble.life -= dt;
    if (this.bubble.life <= 0) this.bubble = null;
  }

  hitBubble(x: number, y: number): boolean {
    if (!this.bubble) return false;
    const dx = x - this.bubble.x;
    const dy = y - this.bubble.y;
    return dx * dx + dy * dy <= 36 * 36;
  }

  pop(): number {
    this.bubble = null;
    const bonus = Math.max(1, Math.round(8 * this.game.merit.meritPerTap * this.game.gongfa.bubbleMul()));
    this.game.merit.addMerit(bonus, 'bubble');
    return bonus;
  }
}
