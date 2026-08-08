// 设置面板
import { Scene } from '../core/Scene';
import { STRINGS } from '../data/strings';
import { UIContainer } from '../ui/Node';
import { Button, Label, Toggle } from '../ui/widgets';
import type { Game } from '../Game';

export class SettingScene extends Scene {
  private ui = new UIContainer();

  constructor(game: Game) {
    super(game);
  }

  enter(): void {
    const { width, contentTop } = this.game.renderer;
    const save = this.game.save;

    const title = new Label('设置', 22, '#E8B84B');
    title.bold = true;
    title.x = width / 2;
    title.y = contentTop + 24;
    this.ui.add(title);

    const back = new Button('返回', 64, 32, { font: 13 });
    back.x = 16;
    back.y = contentTop + 8;
    back.onTap = () => this.game.scenes.pop();
    this.ui.add(back);

    let y = contentTop + 70;
    const toggleW = width - 48;

    const soundToggle = new Toggle('音效', save.soundOn, toggleW);
    soundToggle.x = 24;
    soundToggle.y = y;
    soundToggle.onChange = (v) => {
      save.soundOn = v;
      this.game.audio.setSoundOn(v);
      this.game.saveManager.markDirty();
    };
    this.ui.add(soundToggle);
    y += 52;

    const vibrateToggle = new Toggle('震动', save.vibrateOn, toggleW);
    vibrateToggle.x = 24;
    vibrateToggle.y = y;
    vibrateToggle.onChange = (v) => {
      save.vibrateOn = v;
      this.game.saveManager.markDirty();
    };
    this.ui.add(vibrateToggle);
    y += 52;

    const bgmToggle = new Toggle('佛乐', save.bgmId !== 'none', toggleW);
    bgmToggle.x = 24;
    bgmToggle.y = y;
    bgmToggle.onChange = (v) => {
      if (!v) {
        save.bgmId = 'none';
        this.game.audio.stopBgm();
      } else {
        // 恢复默认已解锁 BGM
        save.bgmId = save.inventory.bgms[0] || 'none';
        this.game.audio.playBgm(save.bgmId);
      }
      this.game.saveManager.markDirty();
    };
    this.ui.add(bgmToggle);
    y += 72;

    // 版本信息
    const ver = new Label(`${STRINGS.title} v1.0.0 · 极简扁平禅意风`, 12, '#666');
    ver.x = width / 2;
    ver.y = this.game.renderer.contentBottom - 40;
    this.ui.add(ver);
  }

  exit(): void {
    this.ui.removeAll();
  }

  update(): void {}

  render(ctx: CanvasRenderingContext2D): void {
    const { width, height } = this.game.renderer;
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#1A2332');
    grad.addColorStop(1, '#0D1420');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
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
