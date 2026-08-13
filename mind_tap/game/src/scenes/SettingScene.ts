// 设置面板(内容超高时支持垂直滚动,适配小屏)
import { Scene } from '../core/Scene';
import { STRINGS } from '../data/strings';
import { UIContainer } from '../ui/Node';
import { Button, Label, Toggle } from '../ui/widgets';
import { clamp } from '../utils/format';
import type { Game } from '../Game';

export class SettingScene extends Scene {
  private ui = new UIContainer();       // 固定:标题 + 返回
  private content = new UIContainer();  // 可滚动内容
  private scrollY = 0;
  private maxScroll = 0;
  private dragging = false;
  private dragStartY = 0;
  private scrollStartY = 0;

  constructor(game: Game) {
    super(game);
  }

  enter(): void {
    const { width, contentTop, contentBottom } = this.game.renderer;
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
    this.content.add(soundToggle);
    y += 52;

    const vibrateToggle = new Toggle('震动', save.vibrateOn, toggleW);
    vibrateToggle.x = 24;
    vibrateToggle.y = y;
    vibrateToggle.onChange = (v) => {
      save.vibrateOn = v;
      this.game.saveManager.markDirty();
    };
    this.content.add(vibrateToggle);
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
    this.content.add(bgmToggle);
    y += 72;

    // 木鱼音色切换
    const tapLabel = new Label(STRINGS.tapSoundLabel, 15, '#C9B98A');
    tapLabel.align = 'left';
    tapLabel.x = 24;
    tapLabel.y = y;
    this.content.add(tapLabel);
    y += 30;

    const btnW = (width - 48 - 12) / 2;
    const current = (save.tapSound === 'wooden' || save.tapSound === 'crisp' || save.tapSound === 'thump')
      ? save.tapSound : 'resonant';
    const makeStyle = (active: boolean) => ({
      bg: active ? 'rgba(232,184,75,0.28)' : 'rgba(255,255,255,0.05)',
      bgPressed: 'rgba(232,184,75,0.4)',
      textColor: active ? '#E8B84B' : '#C9B98A',
      border: active ? '#E8B84B' : 'rgba(255,255,255,0.1)',
      font: 14,
      radius: 10,
    });

    const items: Array<{ id: 'resonant' | 'wooden' | 'crisp' | 'thump'; label: string }> = [
      { id: 'resonant', label: STRINGS.tapSoundResonant },
      { id: 'wooden', label: STRINGS.tapSoundWooden },
      { id: 'crisp', label: STRINGS.tapSoundCrisp },
      { id: 'thump', label: STRINGS.tapSoundThump },
    ];
    items.forEach((item, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const btn = new Button(item.label, btnW, 40, makeStyle(current === item.id));
      btn.x = 24 + col * (btnW + 12);
      btn.y = y + row * 48;
      btn.onTap = () => this.selectTapSound(item.id);
      this.content.add(btn);
    });
    y += 48 * 2 + 16;

    // 版本信息(随内容滚动,不再固定底部)
    const ver = new Label(`${STRINGS.title} v1.0.0 · 极简扁平禅意风`, 12, '#666');
    ver.x = width / 2;
    ver.y = y + 20;
    this.content.add(ver);
    y += 60;

    // 可滚动范围
    this.maxScroll = Math.max(0, y + 16 - contentBottom + 16);
    this.scrollY = clamp(this.scrollY, 0, this.maxScroll);
  }

  private selectTapSound(style: 'resonant' | 'wooden' | 'crisp' | 'thump'): void {
    const save = this.game.save;
    if (save.tapSound === style) return;
    save.tapSound = style;
    this.game.audio.setTapSound(style);
    this.game.audio.playTap(this.game.skin.currentSkin); // 立即试听
    this.game.saveManager.markDirty();
    this.rebuild();
  }

  private rebuild(): void {
    this.ui.removeAll();
    this.content.removeAll();
    this.enter();
  }

  exit(): void {
    this.ui.removeAll();
    this.content.removeAll();
    this.scrollY = 0;
  }

  update(): void {}

  render(ctx: CanvasRenderingContext2D): void {
    const { width, height, contentTop, contentBottom } = this.game.renderer;
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#1A2332');
    grad.addColorStop(1, '#0D1420');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // 滚动内容:裁剪 + 平移
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, contentTop, width, contentBottom - contentTop);
    ctx.clip();
    ctx.translate(0, -this.scrollY);
    this.content.render(ctx);
    ctx.restore();

    // 固定 UI 在上层
    this.ui.render(ctx);

    // 可滚动底部渐变提示
    if (this.maxScroll > 0 && this.scrollY < this.maxScroll - 1) {
      const fadeH = 40;
      const fade = ctx.createLinearGradient(0, contentBottom - fadeH, 0, contentBottom);
      fade.addColorStop(0, 'rgba(13,20,32,0)');
      fade.addColorStop(1, 'rgba(13,20,32,0.9)');
      ctx.fillStyle = fade;
      ctx.fillRect(0, contentBottom - fadeH, width, fadeH);
    }
  }

  onTouchStart(x: number, y: number): boolean {
    if (this.ui.dispatchTouch('start', x, y)) return true;
    this.dragging = true;
    this.dragStartY = y;
    this.scrollStartY = this.scrollY;
    return this.content.dispatchTouch('start', x, y + this.scrollY);
  }

  onTouchEnd(x: number, y: number): void {
    this.ui.dispatchTouch('end', x, y);
    const moved = Math.abs(y - this.dragStartY);
    if (this.dragging && moved < 8) {
      this.content.dispatchTouch('end', x, y + this.scrollY);
    } else {
      this.content.dispatchTouch('end', x, -9999);
    }
    this.dragging = false;
  }

  onTouchMove(x: number, y: number): void {
    this.ui.dispatchTouch('move', x, y);
    if (this.dragging) {
      const dy = y - this.dragStartY;
      this.scrollY = clamp(this.scrollStartY - dy, 0, this.maxScroll);
    }
    this.content.dispatchTouch('move', x, y + this.scrollY);
  }
}
