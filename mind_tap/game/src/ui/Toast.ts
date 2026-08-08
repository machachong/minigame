// 全局 Toast(轻提示),由 Game 渲染在场景之上
import { roundRect } from './widgets';

interface ToastItem {
  text: string;
  until: number;
}

export class Toast {
  private items: ToastItem[] = [];

  show(text: string, durationMs = 1800): void {
    this.items.push({ text, until: Date.now() + durationMs });
    if (this.items.length > 3) this.items.shift();
  }

  render(ctx: CanvasRenderingContext2D, screenW: number, screenH: number): void {
    const now = Date.now();
    this.items = this.items.filter((t) => t.until > now);
    if (!this.items.length) return;

    ctx.save();
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let y = screenH * 0.68;
    for (const item of this.items) {
      const remain = item.until - now;
      const alpha = Math.min(1, remain / 300);
      const metrics = ctx.measureText(item.text);
      const w = metrics.width + 36;
      ctx.globalAlpha = alpha * 0.85;
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      roundRect(ctx, (screenW - w) / 2, y - 16, w, 32, 16);
      ctx.fill();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#F5EDD8';
      ctx.fillText(item.text, screenW / 2, y);
      y -= 40;
    }
    ctx.restore();
  }
}
