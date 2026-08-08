// 好友功德榜:开放数据域(sharedCanvas)
// 主域只负责:上传自己分数(节流)+ 把 sharedCanvas 画到屏幕
import { Scene } from '../core/Scene';
import { RANK_UPLOAD_INTERVAL_MS } from '../data/configs';
import { UIContainer } from '../ui/Node';
import { Button, Label } from '../ui/widgets';
import { fmtNumber } from '../utils/format';
import type { Game } from '../Game';

export class RankScene extends Scene {
  private ui = new UIContainer();
  private openCtx: any = null;
  private sharedCanvas: any = null;
  private lastUpload = 0;
  private loading = true;

  constructor(game: Game) {
    super(game);
  }

  enter(): void {
    const { width, height, contentTop } = this.game.renderer;

    const title = new Label('功德榜', 22, '#E8B84B');
    title.bold = true;
    title.x = width / 2;
    title.y = contentTop + 24;
    this.ui.add(title);

    const back = new Button('返回', 64, 32, { font: 13 });
    back.x = 16;
    back.y = contentTop + 8;
    back.onTap = () => this.game.scenes.pop();
    this.ui.add(back);

    // 上传自己分数
    this.uploadScore();

    // 挂载开放数据域
    try {
      this.openCtx = wx.getOpenDataContext();
      this.sharedCanvas = this.openCtx.canvas;
      // 通知开放域渲染排行榜
      this.openCtx.postMessage({
        type: 'renderRank',
        width: width,
        height: height - contentTop - 60,
        dpr: this.game.renderer.dpr,
        myMerit: Math.floor(this.game.save.merit),
      });
      this.loading = false;
    } catch (e) {
      console.warn('[Rank] 开放数据域不可用:', e);
      this.loading = false;
    }
  }

  exit(): void {
    this.ui.removeAll();
    // 通知开放域停止渲染
    try {
      this.openCtx?.postMessage({ type: 'stop' });
    } catch (e) {
      /* ignore */
    }
  }

  private uploadScore(): void {
    const now = Date.now();
    if (now - this.lastUpload < RANK_UPLOAD_INTERVAL_MS) return;
    this.lastUpload = now;
    try {
      wx.setUserCloudStorage({
        KVDataList: [
          { key: 'merit', value: String(Math.floor(this.game.save.merit)) },
          { key: 'level', value: this.game.levelSystem.current.name },
        ],
      });
    } catch (e) {
      console.warn('[Rank] 上传分数失败:', e);
    }
  }

  update(): void {}

  render(ctx: CanvasRenderingContext2D): void {
    const { width, height, contentTop } = this.game.renderer;
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#1A2332');
    grad.addColorStop(1, '#0D1420');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // 自己的成绩卡
    const myY = contentTop + 60;
    ctx.fillStyle = 'rgba(232,184,75,0.12)';
    ctx.fillRect(16, myY, width - 32, 48);
    ctx.fillStyle = '#F5EDD8';
    ctx.font = '15px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      `我:${this.game.levelSystem.current.name} · 功德 ${fmtNumber(Math.floor(this.game.save.merit))}`,
      28, myY + 24
    );

    // 排行榜区域(sharedCanvas)
    const listY = myY + 64;
    const listH = height - listY - 40;
    if (this.sharedCanvas && !this.loading) {
      // 把开放域画布绘制到主 canvas
      ctx.drawImage(this.sharedCanvas, 16, listY, width - 32, listH);
    } else {
      ctx.fillStyle = '#9A8F74';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(this.loading ? '加载中...' : '排行榜暂不可用', width / 2, listY + 60);
    }

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
