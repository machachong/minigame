// 基础控件:Label / Button / Panel / Toggle
import { UINode, TouchPhase } from './Node';

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export class Label extends UINode {
  text = '';
  font = 16;
  color = '#FFFFFF';
  align: CanvasTextAlign = 'center';
  bold = false;
  alpha = 1;

  constructor(text = '', font = 16, color = '#FFFFFF') {
    super();
    this.text = text;
    this.font = font;
    this.color = color;
  }

  protected draw(ctx: CanvasRenderingContext2D): void {
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    ctx.font = `${this.bold ? 'bold ' : ''}${this.font}px sans-serif`;
    ctx.textAlign = this.align;
    ctx.textBaseline = 'middle';
    ctx.fillText(this.text, this.absX, this.absY);
    ctx.globalAlpha = 1;
  }
}

export interface ButtonStyle {
  bg: string;
  bgPressed: string;
  textColor: string;
  font?: number;
  radius?: number;
  border?: string;
}

export const defaultBtnStyle: ButtonStyle = {
  bg: 'rgba(232,184,75,0.16)',
  bgPressed: 'rgba(232,184,75,0.35)',
  textColor: '#E8B84B',
  font: 15,
  radius: 20,
  border: 'rgba(232,184,75,0.5)',
};

export class Button extends UINode {
  label: string;
  style: ButtonStyle;
  onTap: (() => void) | null = null;
  enabled = true;
  private pressed = false;

  constructor(label: string, w: number, h: number, style?: Partial<ButtonStyle>) {
    super();
    this.label = label;
    this.w = w;
    this.h = h;
    this.style = { ...defaultBtnStyle, ...(style || {}) };
  }

  protected draw(ctx: CanvasRenderingContext2D): void {
    const { absX, absY, w, h } = this;
    const s = this.style;
    ctx.globalAlpha = this.enabled ? 1 : 0.4;
    ctx.fillStyle = this.pressed ? s.bgPressed : s.bg;
    roundRect(ctx, absX, absY, w, h, s.radius ?? 20);
    ctx.fill();
    if (s.border) {
      ctx.strokeStyle = s.border;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.fillStyle = s.textColor;
    ctx.font = `${s.font ?? 15}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.label, absX + w / 2, absY + h / 2 + 1);
    ctx.globalAlpha = 1;
  }

  protected onTouch(phase: TouchPhase, px: number, py: number): boolean {
    if (!this.enabled) return this.hitTest(px, py);
    if (phase === 'start' && this.hitTest(px, py)) {
      this.pressed = true;
      return true;
    }
    if (phase === 'end' && this.pressed) {
      this.pressed = false;
      if (this.hitTest(px, py)) this.onTap?.();
      return true;
    }
    if (phase === 'move' && this.pressed) return true;
    return false;
  }
}

export class Panel extends UINode {
  bg = 'rgba(13,20,32,0.92)';
  border = 'rgba(232,184,75,0.35)';
  radius = 16;

  protected draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = this.bg;
    roundRect(ctx, this.absX, this.absY, this.w, this.h, this.radius);
    ctx.fill();
    ctx.strokeStyle = this.border;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

/** 开关控件 */
export class Toggle extends UINode {
  value = true;
  label = '';
  onChange: ((v: boolean) => void) | null = null;
  private pressed = false;

  constructor(label: string, value: boolean, w = 200, h = 44) {
    super();
    this.label = label;
    this.value = value;
    this.w = w;
    this.h = h;
  }

  protected draw(ctx: CanvasRenderingContext2D): void {
    const { absX, absY, h, w } = this;
    ctx.fillStyle = '#F5EDD8';
    ctx.font = '15px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.label, absX, absY + h / 2);
    // 开关
    const sw = 46;
    const sh = 26;
    const sx = absX + w - sw;
    const sy = absY + (h - sh) / 2;
    ctx.fillStyle = this.value ? 'rgba(232,184,75,0.8)' : 'rgba(255,255,255,0.15)';
    roundRect(ctx, sx, sy, sw, sh, sh / 2);
    ctx.fill();
    ctx.fillStyle = '#FFF';
    ctx.beginPath();
    ctx.arc(sx + (this.value ? sw - sh / 2 : sh / 2), sy + sh / 2, sh / 2 - 3, 0, Math.PI * 2);
    ctx.fill();
  }

  protected onTouch(phase: TouchPhase, px: number, py: number): boolean {
    if (phase === 'start' && this.hitTest(px, py)) {
      this.pressed = true;
      return true;
    }
    if (phase === 'end' && this.pressed) {
      this.pressed = false;
      if (this.hitTest(px, py)) {
        this.value = !this.value;
        this.onChange?.(this.value);
      }
      return true;
    }
    return false;
  }
}
