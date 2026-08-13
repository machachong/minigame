// 分享系统:分享卡绘制(Canvas 离屏)+ 带参分享 + 分享得功德
import { STRINGS } from '../data/strings';
import type { Game } from '../Game';

export class ShareSystem {
  private game: Game;
  private cardCanvas: any = null; // 复用离屏 canvas,避免每次分享新建泄漏

  constructor(game: Game) {
    this.game = game;
    this.registerShareMenu();
  }

  /** 被动分享(右上角菜单) */
  private registerShareMenu(): void {
    try {
      wx.showShareMenu({ withShareTicket: false, menus: ['shareAppMessage'] });
      wx.onShareAppMessage(() => this.buildShareMessage('menu'));
    } catch (e) {
      console.warn('[Share] menu 注册失败:', e);
    }
  }

  /** 主动分享(按钮触发) */
  share(source: 'button' | 'verse' = 'button'): void {
    try {
      wx.shareAppMessage(this.buildShareMessage(source));
      // 分享成功回调:微信无法可靠区分成功/取消,统一按"调起即成功" + 服务端每日限一次防刷
      this.handleShared();
    } catch (e) {
      console.warn('[Share] 分享失败:', e);
    }
  }

  private buildShareMessage(source: string): any {
    const save = this.game.save;
    const levelName = this.game.levelSystem.current.name;
    return {
      title: `我已是${levelName},功德 ${Math.floor(save.merit)},来《敲到成佛》一起修行!`,
      imageUrl: this.renderShareCard(),
      query: `from=${source}&t=${Date.now()}`,
    };
  }

  /** Canvas 离屏绘制分享卡(5:4),复用画布 */
  private renderShareCard(): string {
    try {
      if (!this.cardCanvas) this.cardCanvas = wx.createCanvas();
      const canvas = this.cardCanvas;
      const W = 500;
      const H = 400;
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');

      // 背景
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      const scene = this.game.skin.currentScene;
      grad.addColorStop(0, scene.bgTop);
      grad.addColorStop(1, scene.bgBottom);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // 光晕
      const radial = ctx.createRadialGradient(W / 2, H / 2 - 30, 10, W / 2, H / 2 - 30, 180);
      radial.addColorStop(0, 'rgba(232,184,75,0.35)');
      radial.addColorStop(1, 'rgba(232,184,75,0)');
      ctx.fillStyle = radial;
      ctx.fillRect(0, 0, W, H);

      // 木鱼剪影(简化圆角)
      ctx.fillStyle = 'rgba(232,184,75,0.25)';
      ctx.beginPath();
      ctx.arc(W / 2, H / 2 - 40, 70, 0, Math.PI * 2);
      ctx.fill();

      // 境界徽章
      const levelName = this.game.levelSystem.current.name;
      ctx.fillStyle = '#E8B84B';
      ctx.font = 'bold 44px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(levelName, W / 2, H / 2 - 20);

      // 功德数
      ctx.fillStyle = '#F5EDD8';
      ctx.font = '24px sans-serif';
      ctx.fillText(`功德 ${Math.floor(this.game.save.merit)}`, W / 2, H / 2 + 24);

      // 偈语
      const verse = this.game.dailyVerse || STRINGS.shareTitle;
      ctx.fillStyle = scene.textSub;
      ctx.font = '18px sans-serif';
      ctx.fillText(verse, W / 2, H - 70);

      // 标题
      ctx.fillStyle = '#F5EDD8';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(STRINGS.title, W / 2, H - 36);

      return canvas.toTempFilePathSync({
        x: 0, y: 0, width: W, height: H,
        destWidth: W, destHeight: H,
      });
    } catch (e) {
      console.warn('[Share] 分享卡绘制失败:', e);
      return '';
    }
  }

  private handleShared(): void {
    this.game.daily.claimShareMerit().then((ok) => {
      if (ok) this.game.toast.show('分享成功,功德 +100');
    });
  }
}
