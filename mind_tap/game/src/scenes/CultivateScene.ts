// 修行面板:境界总览 + 皮肤/场景/BGM 装备
import { Scene } from '../core/Scene';
import { SKINS, SCENES, BGMS } from '../data/configs';
import { UIContainer } from '../ui/Node';
import { Button, Label, roundRect } from '../ui/widgets';
import { fmtNumber } from '../utils/format';
import type { Game } from '../Game';

export class CultivateScene extends Scene {
  private ui = new UIContainer();

  constructor(game: Game) {
    super(game);
  }

  enter(): void {
    const { width, contentTop } = this.game.renderer;

    const title = new Label('修行', 22, '#E8B84B');
    title.bold = true;
    title.x = width / 2;
    title.y = contentTop + 24;
    this.ui.add(title);

    const back = new Button('返回', 64, 32, { font: 13 });
    back.x = 16;
    back.y = contentTop + 8;
    back.onTap = () => this.game.scenes.pop();
    this.ui.add(back);

    this.buildList();
  }

  exit(): void {
    this.ui.removeAll();
  }

  private buildList(): void {
    const { width, contentTop, contentBottom } = this.game.renderer;
    const save = this.game.save;
    const levelIdx = this.game.levelSystem.current.index;

    let y = contentTop + 60;

    // 境界卡
    const level = this.game.levelSystem.current;
    const next = this.game.levelSystem.next;
    const infoText = next
      ? `${level.name} → ${next.name}(还需 ${fmtNumber(next.merit - save.merit)} 功德)`
      : `${level.name}(已至最高境界)`;
    const info = new Label(infoText, 14, '#F5EDD8');
    info.x = width / 2;
    info.y = y;
    this.ui.add(info);
    y += 40;

    // 皮肤区
    y = this.buildSection('木鱼皮肤', SKINS.map(s => ({
      id: s.id,
      name: s.name,
      desc: s.bonus > 0 ? `功德 +${s.bonus * 100}%` : '初始',
      unlocked: s.unlockLevel <= levelIdx,
      equipped: save.skinId === s.id,
      onTap: () => {
        if (this.game.skin.equipSkin(s.id)) {
          this.game.toast.show(`已装备「${s.name}」`);
          this.rebuild();
        }
      },
    })), y);

    // 场景区
    y = this.buildSection('修行场景', SCENES.map(s => ({
      id: s.id,
      name: s.name,
      desc: s.unlockLevel > 0 ? `境界 ${'罗汉'}` : '初始',
      unlocked: s.unlockLevel <= levelIdx,
      equipped: save.sceneId === s.id,
      onTap: () => {
        if (this.game.skin.equipScene(s.id)) {
          this.game.toast.show(`已切换「${s.name}」`);
          this.rebuild();
        }
      },
    })), y);

    // BGM 区
    this.buildSection('佛乐', BGMS.filter(b => b.id !== 'none').map(b => ({
      id: b.id,
      name: b.name,
      desc: b.url ? '' : '(素材待上传)',
      unlocked: b.unlockLevel <= levelIdx && !!b.url,
      equipped: save.bgmId === b.id,
      onTap: () => {
        if (!b.url) return;
        save.bgmId = save.bgmId === b.id ? 'none' : b.id;
        this.game.audio.playBgm(save.bgmId);
        this.game.saveManager.markDirty();
        this.rebuild();
      },
    })), y);
  }

  private buildSection(
    title: string,
    items: Array<{ id: string; name: string; desc: string; unlocked: boolean; equipped: boolean; onTap: () => void }>,
    startY: number
  ): number {
    const { width } = this.game.renderer;
    const label = new Label(title, 15, '#C9B98A');
    label.align = 'left';
    label.x = 24;
    label.y = startY;
    this.ui.add(label);

    let y = startY + 24;
    const itemW = (width - 48 - 16) / 2;
    const itemH = 56;

    items.forEach((item, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const btn = new Button('', itemW, itemH, {
        bg: item.equipped ? 'rgba(232,184,75,0.25)' : 'rgba(255,255,255,0.05)',
        bgPressed: 'rgba(232,184,75,0.4)',
        textColor: item.unlocked ? '#F5EDD8' : '#666',
        radius: 12,
        border: item.equipped ? '#E8B84B' : 'rgba(255,255,255,0.1)',
      });
      btn.x = 24 + col * (itemW + 16);
      btn.y = y + row * (itemH + 12);
      btn.label = `${item.name}${item.equipped ? ' ✓' : item.unlocked ? '' : ' 🔒'}`;
      btn.enabled = item.unlocked;
      btn.onTap = item.onTap;
      this.ui.add(btn);

      const desc = new Label(item.desc, 11, '#9A8F74');
      desc.x = btn.x + itemW / 2;
      desc.y = btn.y + itemH + 2;
      // 不占高度,仅展示
    });

    return y + Math.ceil(items.length / 2) * (itemH + 12) + 24;
  }

  private rebuild(): void {
    this.ui.removeAll();
    this.enter();
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
