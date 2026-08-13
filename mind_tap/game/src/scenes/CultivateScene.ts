// 修行面板:境界总览 + 皮肤/场景/BGM 装备 + 木鱼音色
// 内容超高时支持垂直滚动(拖动 + 裁剪),适配小屏设备
import { Scene } from '../core/Scene';
import { SKINS, SCENES, BGMS, LEVELS } from '../data/configs';
import { STRINGS } from '../data/strings';
import { UIContainer } from '../ui/Node';
import { Button, Label, roundRect } from '../ui/widgets';
import { fmtNumber, clamp } from '../utils/format';
import type { Game } from '../Game';

export class CultivateScene extends Scene {
  private ui = new UIContainer();       // 固定 UI:标题 + 返回
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
    this.content.removeAll();
    this.scrollY = 0;
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
    this.content.add(info);
    y += 44;

    // 皮肤区
    y = this.buildSection('木鱼皮肤', SKINS.map(s => ({
      id: s.id,
      name: s.name,
      desc: s.bonus > 0 ? `功德 +${s.bonus * 100}%` : '初始',
      unlocked: s.unlockLevel <= levelIdx,
      equipped: save.skinId === s.id,
      onTap: () => {
        if (this.game.skin.isSkinUnlocked(s.id)) {
          if (this.game.skin.equipSkin(s.id)) {
            this.game.toast.show(`已装备「${s.name}」`);
            this.rebuild();
          }
        } else {
          // 未解锁 → 看视频限时试用(激励点位:皮肤试用)
          this.game.ad.show('skin_trial', () => {
            this.game.skin.trialSkin(s.id);
            this.game.toast.show(`已试用「${s.name}」30 分钟`);
            this.rebuild();
          });
        }
      },
    })), y);

    // 场景区
    y = this.buildSection('修行场景', SCENES.map(s => ({
      id: s.id,
      name: s.name,
      desc: s.unlockLevel > 0 ? `境界 ${LEVELS[s.unlockLevel].name}` : '初始',
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
    y = this.buildSection('佛乐', BGMS.filter(b => b.id !== 'none').map(b => ({
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

    // 木鱼音色区(与设置页共用 tapSound 存档字段)
    y = this.buildSection('木鱼音色', [
      {
        id: 'resonant',
        name: STRINGS.tapSoundResonant,
        desc: '圆润共鸣',
        unlocked: true,
        equipped: save.tapSound !== 'wooden' && save.tapSound !== 'crisp',
        onTap: () => this.selectTapSound('resonant'),
      },
      {
        id: 'wooden',
        name: STRINGS.tapSoundWooden,
        desc: '干脆木质',
        unlocked: true,
        equipped: save.tapSound === 'wooden',
        onTap: () => this.selectTapSound('wooden'),
      },
      {
        id: 'crisp',
        name: STRINGS.tapSoundCrisp,
        desc: '明亮清脆',
        unlocked: true,
        equipped: save.tapSound === 'crisp',
        onTap: () => this.selectTapSound('crisp'),
      },
      {
        id: 'thump',
        name: STRINGS.tapSoundThump,
        desc: '低沉浑厚',
        unlocked: true,
        equipped: save.tapSound === 'thump',
        onTap: () => this.selectTapSound('thump'),
      },
    ], y);

    // 计算可滚动范围(内容超出视口才可滚)
    const viewportH = contentBottom - contentTop;
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
    this.content.add(label);

    let y = startY + 26;
    const itemW = (width - 48 - 16) / 2;
    const itemH = 56;
    const rowGap = 28; // 行距(给描述文字留空间)

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
      btn.y = y + row * (itemH + rowGap);
      btn.label = `${item.name}${item.equipped ? ' ✓' : item.unlocked ? '' : ' 🔒'}`;
      btn.enabled = item.unlocked;
      btn.onTap = item.onTap;
      this.content.add(btn);

      const desc = new Label(item.desc, 11, '#9A8F74');
      desc.x = btn.x + itemW / 2;
      desc.y = btn.y + itemH + 10;
      this.content.add(desc);
    });

    const rows = Math.ceil(items.length / 2);
    return y + rows * (itemH + rowGap) + 20;
  }

  private rebuild(): void {
    this.ui.removeAll();
    this.content.removeAll();
    this.enter();
  }

  update(): void {}

  render(ctx: CanvasRenderingContext2D): void {
    const { width, height, contentTop, contentBottom } = this.game.renderer;
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#1A2332');
    grad.addColorStop(1, '#0D1420');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // 滚动内容:裁剪到安全区 + 垂直平移
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, contentTop, width, contentBottom - contentTop);
    ctx.clip();
    ctx.translate(0, -this.scrollY);
    this.content.render(ctx);
    ctx.restore();

    // 固定 UI(标题/返回)在上层
    this.ui.render(ctx);

    // 可滚动时的底部渐变提示
    if (this.maxScroll > 0 && this.scrollY < this.maxScroll - 1) {
      const fadeH = 40;
      const fade = ctx.createLinearGradient(0, contentBottom - fadeH, 0, contentBottom);
      fade.addColorStop(0, 'rgba(13,20,32,0)');
      fade.addColorStop(1, 'rgba(13,20,32,0.9)');
      ctx.fillStyle = fade;
      ctx.fillRect(0, contentBottom - fadeH, width, fadeH);
    }
  }

  // ---------- 触摸:拖动滚动 + 点击区分 ----------
  onTouchStart(x: number, y: number): boolean {
    if (this.ui.dispatchTouch('start', x, y)) return true;
    this.dragging = true;
    this.dragStartY = y;
    this.scrollStartY = this.scrollY;
    return this.content.dispatchTouch('start', x, y + this.scrollY);
  }

  onTouchMove(x: number, y: number): void {
    this.ui.dispatchTouch('move', x, y);
    if (this.dragging) {
      const dy = y - this.dragStartY;
      this.scrollY = clamp(this.scrollStartY - dy, 0, this.maxScroll);
    }
    this.content.dispatchTouch('move', x, y + this.scrollY);
  }

  onTouchEnd(x: number, y: number): void {
    this.ui.dispatchTouch('end', x, y);
    const moved = Math.abs(y - this.dragStartY);
    if (this.dragging && moved < 8) {
      // 轻微移动视为点击,正常分发
      this.content.dispatchTouch('end', x, y + this.scrollY);
    } else {
      // 拖动则清除按钮按下态(传不可命中坐标,避免误触)
      this.content.dispatchTouch('end', x, -9999);
    }
    this.dragging = false;
  }
}
