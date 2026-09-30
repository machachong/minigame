// 听经入口:选经文、装备功法和真言。列表超出屏幕时可滚动。
import { Scene } from '../core/Scene';
import { UIContainer } from '../ui/Node';
import { Button, Label } from '../ui/widgets';
import { CHARTS, ENERGY_MAX, GONGFA, GRADE_NAME, MANTRAS } from '../data/play';
import { clamp } from '../utils/format';
import { RhythmScene } from './RhythmScene';
import type { Game } from '../Game';

export class SutraScene extends Scene {
  private ui = new UIContainer();
  private content = new UIContainer();
  private scrollY = 0;
  private maxScroll = 0;
  private dragging = false;
  private dragStartY = 0;
  private scrollStartY = 0;

  enter(): void {
    const { width, contentTop, contentBottom } = this.game.renderer;
    const play = this.game.gongfa.play;
    this.game.gongfa.refresh();

    const title = new Label('听经', 22, '#E8B84B');
    title.bold = true;
    title.x = width / 2;
    title.y = contentTop + 24;
    this.ui.add(title);

    const back = new Button('返回', 64, 32, { font: 13 });
    back.x = 16;
    back.y = contentTop + 8;
    back.onTap = () => this.game.scenes.pop();
    this.ui.add(back);

    let y = contentTop + 62;
    const slotTip = new Label(`功法槽 ${play.slots.length}/${this.game.gongfa.slotMax()} · 点已领悟的功法装备`, 12, '#9A8F74');
    slotTip.x = width / 2;
    slotTip.y = y;
    this.content.add(slotTip);
    y += 28;

    CHARTS.forEach((chart) => {
      const open = this.game.levelSystem.peakIndex >= chart.unlockLevel;
      const grade = play.grades[chart.id];
      const gradeName = grade ? GRADE_NAME[grade as keyof typeof GRADE_NAME] || grade : '未听';
      const btn = new Button(open ? `${chart.name}  ${gradeName}` : `${chart.name}  未解锁`, width - 48, 40, { font: 15 });
      btn.x = 24;
      btn.y = y;
      btn.enabled = open;
      btn.onTap = () => this.game.scenes.push(new RhythmScene(this.game, chart.id));
      this.content.add(btn);
      y += 48;
    });

    y += 8;
    GONGFA.forEach((g) => {
      const owned = play.learned.includes(g.id);
      const on = play.slots.includes(g.id);
      const btn = new Button(owned ? `${on ? '● ' : ''}${g.name}  ${g.desc}` : `${g.name}  听经领悟`, width - 48, 36, { font: 13 });
      btn.x = 24;
      btn.y = y;
      btn.enabled = owned;
      btn.onTap = () => {
        this.game.toast.show(this.game.gongfa.toggleSlot(g.id));
        this.rebuild();
      };
      this.content.add(btn);
      y += 42;
    });

    MANTRAS.forEach((m) => {
      const open = this.game.gongfa.mantraUnlocked(m.id);
      const on = play.mantra === m.id;
      const btn = new Button(open ? `${on ? '● ' : ''}${m.name}` : `${m.name}  境界不足`, (width - 60) / 2, 36, { font: 13 });
      btn.x = m.id === 'daming' ? 24 : width / 2 + 6;
      btn.y = y;
      btn.enabled = open;
      btn.onTap = () => {
        this.game.gongfa.setMantra(m.id);
        this.rebuild();
      };
      this.content.add(btn);
    });
    y += 44;
    const energy = new Label(`真言能量 ${Math.min(play.energy, ENERGY_MAX)}/${ENERGY_MAX}`, 12, '#9A8F74');
    energy.x = width / 2;
    energy.y = y;
    this.content.add(energy);
    y += 28;

    this.maxScroll = Math.max(0, y - contentBottom + 16);
  }

  private rebuild(): void {
    const y = this.scrollY;
    this.ui.removeAll();
    this.content.removeAll();
    this.enter();
    this.scrollY = clamp(y, 0, this.maxScroll);
  }

  exit(): void {
    this.ui.removeAll();
    this.content.removeAll();
  }

  update(): void {}

  render(ctx: CanvasRenderingContext2D): void {
    const { width, height, contentTop, contentBottom } = this.game.renderer;
    ctx.fillStyle = '#121820';
    ctx.fillRect(0, 0, width, height);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, contentTop + 52, width, contentBottom - contentTop - 52);
    ctx.clip();
    ctx.translate(0, -this.scrollY);
    this.content.render(ctx);
    ctx.restore();
    this.ui.render(ctx);
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
    if (this.dragging && moved < 8) this.content.dispatchTouch('end', x, y + this.scrollY);
    else this.content.dispatchTouch('end', x, -9999);
    this.dragging = false;
  }

  onTouchMove(x: number, y: number): void {
    if (!this.dragging) return;
    this.scrollY = clamp(this.scrollStartY - (y - this.dragStartY), 0, this.maxScroll);
  }
}
