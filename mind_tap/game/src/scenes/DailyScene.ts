// 每日功课面板:进度 + 领奖 + 每日一偈
import { Scene } from '../core/Scene';
import { UIContainer } from '../ui/Node';
import { Button, Label, roundRect } from '../ui/widgets';
import { STRINGS } from '../data/strings';
import type { Game } from '../Game';

export class DailyScene extends Scene {
  private ui = new UIContainer();

  constructor(game: Game) {
    super(game);
  }

  enter(): void {
    const { width, contentTop } = this.game.renderer;
    const p = this.game.daily.progress;

    const title = new Label(STRINGS.dailyTitle, 22, '#E8B84B');
    title.bold = true;
    title.x = width / 2;
    title.y = contentTop + 24;
    this.ui.add(title);

    const back = new Button('返回', 64, 32, { font: 13 });
    back.x = 16;
    back.y = contentTop + 8;
    back.onTap = () => this.game.scenes.pop();
    this.ui.add(back);

    // 进度
    const prog = new Label(STRINGS.dailyProgress(p.taps, p.goal), 18, '#F5EDD8');
    prog.x = width / 2;
    prog.y = contentTop + 80;
    this.ui.add(prog);

    // 进度条
    // (render 中绘制)

    // 领取按钮
    const claimBtn = new Button(
      p.claimed ? STRINGS.dailyClaimed : p.done ? STRINGS.dailyClaim : `还需 ${p.goal - p.taps} 下`,
      180, 44
    );
    claimBtn.x = (width - 180) / 2;
    claimBtn.y = contentTop + 130;
    claimBtn.enabled = p.done && !p.claimed;
    claimBtn.onTap = async () => {
      const r = await this.game.daily.claim();
      if (r.ok) {
        this.game.toast.show(`获得功德 +${r.reward}!连续 ${r.streak} 天`);
        this.rebuild();
      } else {
        this.game.toast.show('领取失败,稍后再试');
      }
    };
    this.ui.add(claimBtn);

    // 连续天数
    const streak = new Label(`连续修行 ${this.game.daily.streak} 天`, 13, '#9A8F74');
    streak.x = width / 2;
    streak.y = contentTop + 195;
    this.ui.add(streak);

    // 每日一偈
    const verseTitle = new Label('每日一偈', 16, '#C9B98A');
    verseTitle.x = width / 2;
    verseTitle.y = contentTop + 245;
    this.ui.add(verseTitle);

    const verse = new Label(this.game.dailyVerse, 15, '#F5EDD8');
    verse.x = width / 2;
    verse.y = contentTop + 280;
    this.ui.add(verse);

    const shareBtn = new Button('转发偈语 +100 功德', 200, 40, { font: 14 });
    shareBtn.x = (width - 200) / 2;
    shareBtn.y = contentTop + 315;
    shareBtn.onTap = () => this.game.share.share('verse');
    this.ui.add(shareBtn);
  }

  exit(): void {
    this.ui.removeAll();
  }

  private rebuild(): void {
    this.ui.removeAll();
    this.enter();
  }

  update(): void {}

  render(ctx: CanvasRenderingContext2D): void {
    const { width, height, contentTop } = this.game.renderer;
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#1A2332');
    grad.addColorStop(1, '#0D1420');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // 进度条
    const p = this.game.daily.progress;
    const barW = width * 0.6;
    const barX = (width - barW) / 2;
    const barY = contentTop + 100;
    ctx.fillStyle = 'rgba(232,184,75,0.15)';
    roundRect(ctx, barX, barY, barW, 8, 4);
    ctx.fill();
    ctx.fillStyle = '#E8B84B';
    roundRect(ctx, barX, barY, barW * (p.taps / p.goal), 8, 4);
    ctx.fill();

    this.ui.render(ctx);
  }

  onTouchStart(x: number, y: number): boolean {
    return this.ui.dispatchTouch('start', x, y);
  }
  onTouchEnd(x: number, y: number): void {
    this.ui.dispatchTouch('end', x, y);
  }
  onTouchMove(x: number, y: number): void {
    this.ui.dispatchTouch('move', x, y);
  }
}
