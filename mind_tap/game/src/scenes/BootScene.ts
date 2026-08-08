// 启动场景:资源自检 + 云登录等待 + 过渡动画
// 设计:不阻塞!云登录最多等 2.5s,超时直接进主页(游客模式)
import { Scene } from '../core/Scene';
import { STRINGS } from '../data/strings';
import { HomeScene } from './HomeScene';
import type { Game } from '../Game';

export class BootScene extends Scene {
  private progress = 0;
  private dots = 0;
  private startTime = 0;
  private entered = false;

  constructor(game: Game) {
    super(game);
  }

  enter(): void {
    this.startTime = Date.now();
    // 动画进度条(假进度,真等待在 sync.init 里)
    this.game.ticker.to(2000, (t) => {
      this.progress = t;
    });
    // 最长 2.5s 必进主页(弱网首启容错)
    this.game.ticker.delay(2500, () => this.goHome());
  }

  private goHome(): void {
    if (this.entered) return;
    this.entered = true;
    this.game.scenes.replace(new HomeScene(this.game));
  }

  exit(): void {}

  update(dt: number): void {
    this.dots = Math.floor((Date.now() - this.startTime) / 400) % 4;
    // 提前登录成功且进度走完 → 提前进
    if (this.progress >= 1 && this.game.sync.state === 'online') this.goHome();
  }

  render(ctx: CanvasRenderingContext2D): void {
    const { width, height } = this.game.renderer;
    // 背景
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#1A2332');
    grad.addColorStop(1, '#0D1420');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;

    // 木鱼剪影
    ctx.fillStyle = 'rgba(232,184,75,0.12)';
    ctx.beginPath();
    ctx.arc(cx, cy - 60, 80, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#E8B84B';
    ctx.font = 'bold 56px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(STRINGS.title, cx, cy - 50);

    ctx.fillStyle = '#9A8F74';
    ctx.font = '16px sans-serif';
    ctx.fillText(STRINGS.subtitle, cx, cy + 20);

    // 进度条
    const barW = width * 0.5;
    const barH = 4;
    const barX = cx - barW / 2;
    const barY = cy + 80;
    ctx.fillStyle = 'rgba(232,184,75,0.15)';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = '#E8B84B';
    ctx.fillRect(barX, barY, barW * this.progress, barH);

    // 加载文案
    ctx.fillStyle = '#9A8F74';
    ctx.font = '13px sans-serif';
    ctx.fillText('正在静心' + '.'.repeat(this.dots), cx, barY + 30);
  }
}
