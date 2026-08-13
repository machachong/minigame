// 主场景:木鱼敲击(本游戏 90% 的体验在这里)
// 职责:敲击判定 → 三路反馈(视/听/触)→ 飘字/涟漪 → 连击 → 突破演出 → 弹层
import { Scene } from '../core/Scene';
import { bus, Events } from '../core/EventBus';
import { FEEL, OFFLINE_UNLOCK_LEVEL } from '../data/configs';
import { STRINGS, COMBO_TEXTS, TUTORIAL_STEPS } from '../data/strings';
import { fmtNumber, fmtDuration, clamp } from '../utils/format';
import { ObjectPool } from '../utils/pool';
import { UIContainer } from '../ui/Node';
import { Button, Panel, Label, roundRect } from '../ui/widgets';
import { CultivateScene } from './CultivateScene';
import { DailyScene } from './DailyScene';
import { RankScene } from './RankScene';
import { SettingScene } from './SettingScene';
import type { Game } from '../Game';

interface FloatText {
  x: number; y: number; vy: number;
  text: string; color: string; size: number;
  life: number; maxLife: number; active: boolean;
}

interface Ripple {
  x: number; y: number; r: number; maxR: number;
  life: number; maxLife: number; active: boolean;
}

export class HomeScene extends Scene {
  private ui = new UIContainer();
  private unsubscribe: (() => void)[] = [];

  // 木鱼状态
  private fishY = 0;
  private fishR = 0;
  private squash = 1;          // scaleY 按压回弹
  private glowPulse = 0;       // 常驻呼吸光晕

  // 特效池
  private floats: FloatText[] = [];
  private floatPool = new ObjectPool<FloatText>(
    () => ({ x: 0, y: 0, vy: 0, text: '', color: '', size: 16, life: 0, maxLife: 0, active: false }),
    (o) => { o.active = false; }
  );
  private ripples: Ripple[] = [];
  private ripplePool = new ObjectPool<Ripple>(
    () => ({ x: 0, y: 0, r: 0, maxR: 0, life: 0, maxLife: 0, active: false }),
    (o) => { o.active = false; }
  );

  // 弹层
  private showOffline = false;
  private offlineInfo: { merit: number; hours: number } | null = null;
  private offlineDoubleBtn: { x: number; y: number; w: number; h: number } | null = null;
  private showBreakthrough = false;
  private breakthroughInfo: { name: string; unlocks: string[] } | null = null;
  private showTutorial = false;
  private tutorialStep = 0;

  // 顶部 UI 引用
  private meritLabel!: Label;
  private levelLabel!: Label;
  private syncTipLabel!: Label;
  private meritDoubleBtn!: Button;

  constructor(game: Game) {
    super(game);
  }

  enter(): void {
    const { width, height, contentBottom } = this.game.renderer;
    this.fishY = height * 0.52;
    this.fishR = Math.min(width * 0.22, 90);

    this.buildUI();
    this.bindEvents();

    // 新手引导
    if (!this.game.save.guided) {
      this.showTutorial = true;
      this.tutorialStep = 0;
    }

    // 离线收益检查(罗汉解锁 + 离线 ≥3 分钟)
    this.checkOfflineReward();

    // BGM 恢复
    if (this.game.save.bgmId !== 'none') {
      this.game.audio.playBgm(this.game.save.bgmId);
    }
  }

  exit(): void {
    this.unsubscribe.forEach((fn) => fn());
    this.unsubscribe = [];
    this.ui.removeAll();
  }

  // ---------- UI 搭建 ----------
  private buildUI(): void {
    const { width, contentTop, contentBottom } = this.game.renderer;
    const scene = this.game.skin.currentScene;

    // 顶部:功德数
    this.meritLabel = new Label('0', 34, scene.textMain);
    this.meritLabel.bold = true;
    this.meritLabel.x = width / 2;
    this.meritLabel.y = contentTop + 30;
    this.ui.add(this.meritLabel);

    // 境界 + 进度
    this.levelLabel = new Label('', 14, scene.textSub);
    this.levelLabel.x = width / 2;
    this.levelLabel.y = contentTop + 62;
    this.ui.add(this.levelLabel);

    // 同步状态提示
    this.syncTipLabel = new Label('', 11, '#7A6F55');
    this.syncTipLabel.x = width / 2;
    this.syncTipLabel.y = contentTop + 84;
    this.ui.add(this.syncTipLabel);

    // 底部导航
    const navY = contentBottom - 30;
    const btnW = 68;
    const btnH = 40;
    const gap = (width - btnW * 4) / 5;
    const navs: Array<[string, () => void]> = [
      [STRINGS.navCultivate, () => this.game.scenes.push(new CultivateScene(this.game))],
      [STRINGS.navDaily, () => this.game.scenes.push(new DailyScene(this.game))],
      [STRINGS.navRank, () => this.game.scenes.push(new RankScene(this.game))],
      [STRINGS.navSettings, () => this.game.scenes.push(new SettingScene(this.game))],
    ];
    navs.forEach(([label, cb], i) => {
      const btn = new Button(label, btnW, btnH);
      btn.x = gap + (btnW + gap) * i;
      btn.y = navY;
      btn.onTap = cb;
      this.ui.add(btn);
    });

    // 分享按钮(右上)
    const shareBtn = new Button(STRINGS.shareBtn, 96, 34, { font: 13 });
    shareBtn.x = width - 106;
    shareBtn.y = contentTop + 8;
    shareBtn.onTap = () => this.game.share.share('button');
    this.ui.add(shareBtn);

    // 静心加成按钮(左上,激励视频:10 分钟内功德翻倍)
    this.meritDoubleBtn = new Button(STRINGS.adMeritDouble, 96, 34, { font: 13 });
    this.meritDoubleBtn.x = 10;
    this.meritDoubleBtn.y = contentTop + 8;
    this.meritDoubleBtn.onTap = () => {
      this.game.ad.show('merit_double', () => {
        this.game.save.extra.meritDoubleUntil = Date.now() + 10 * 60 * 1000;
        this.game.saveManager.markDirty();
        this.game.toast.show('静心加成:10 分钟内功德翻倍');
        this.refreshHUD();
      });
    };
    this.ui.add(this.meritDoubleBtn);

    this.refreshHUD();
  }

  private refreshHUD(): void {
    const save = this.game.save;
    const level = this.game.levelSystem.current;
    const next = this.game.levelSystem.next;
    this.meritLabel.text = fmtNumber(Math.floor(save.merit));

    if (next) {
      const remain = Math.ceil(next.merit - save.merit);
      this.levelLabel.text = `${level.name} · ${STRINGS.nextLevelPrefix}${next.name}${STRINGS.nextLevelSuffix} ${fmtNumber(remain)} ${STRINGS.meritUnit}`;
    } else {
      this.levelLabel.text = `${level.name} · 已臻化境`;
    }

    this.syncTipLabel.text = this.game.sync.state === 'guest' ? STRINGS.guestTip : '';
    this.syncTipLabel.color = this.game.sync.state === 'guest' ? '#B8955A' : '#7A6F55';

    // 静心加成按钮状态(剩余时间)
    const until = this.game.save.extra.meritDoubleUntil || 0;
    if (until > Date.now()) {
      const remainMin = Math.max(1, Math.ceil((until - Date.now()) / 60000));
      this.meritDoubleBtn.label = `加成中 ${remainMin}分`;
      this.meritDoubleBtn.style.textColor = '#E8B84B';
    } else {
      this.meritDoubleBtn.label = STRINGS.adMeritDouble;
      this.meritDoubleBtn.style.textColor = '#E8B84B';
    }
  }

  // ---------- 事件订阅 ----------
  private bindEvents(): void {
    this.unsubscribe.push(
      bus.on(Events.MERIT_CHANGED, () => this.refreshHUD()),
      bus.on(Events.LEVEL_UP, (p) => this.onLevelUp(p)),
      bus.on(Events.SYNC_STATE, () => this.refreshHUD()),
      bus.on(Events.COMBO_MILESTONE, (p) => {
        const text = COMBO_TEXTS[p.combo];
        if (text) {
          this.spawnFloat(this.game.renderer.cx, this.fishY - this.fishR - 40, text, '#E8B84B', 20);
          this.game.audio.playComboChime();
        }
      }),
      bus.on(Events.DAILY_GOAL, () => {
        this.game.toast.show(STRINGS.dailyGoalDone);
      }),
      bus.on(Events.OFFLINE_REWARD, (p) => {
        if (p?.check) this.checkOfflineReward();
      })
    );
  }

  // ---------- 敲击 ----------
  onTouchStart(x: number, y: number): boolean {
    // 弹层优先
    if (this.showOffline && this.offlineInfo) {
      // 命中"看视频翻倍"按钮 → 看广告后翻倍领取
      const btn = this.offlineDoubleBtn;
      if (btn && x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
        const merit = this.offlineInfo.merit;
        this.game.ad.show('offline_double', () => {
          this.game.sync.claimOfflineReward(merit, true).then((actual) => {
            if (actual > 0) this.game.toast.show(`闭关功德 +${fmtNumber(actual)}`);
          });
        });
        this.showOffline = false;
        this.offlineInfo = null;
        return true;
      }
      // 其他区域 = 普通领取
      this.dismissOverlays();
      return true;
    }
    if (this.showBreakthrough) {
      this.dismissOverlays();
      return true;
    }
    if (this.showTutorial) {
      this.advanceTutorial();
      return true;
    }
    // UI 按钮
    if (this.ui.dispatchTouch('start', x, y)) return true;

    // 木鱼命中(宽松判定:半径 ×1.3)
    const dx = x - this.game.renderer.cx;
    const dy = y - this.fishY;
    if (dx * dx + dy * dy <= this.fishR * this.fishR * 1.69) {
      this.doTap(x, y);
      return true;
    }
    return false;
  }

  onTouchEnd(x: number, y: number): void {
    this.ui.dispatchTouch('end', x, y);
  }

  onTouchMove(x: number, y: number): void {
    this.ui.dispatchTouch('move', x, y);
  }

  private doTap(x: number, y: number): void {
    const gain = this.game.merit.onTap();

    // 视觉:按压 + 涟漪 + 飘字
    this.squash = FEEL.squashScale;
    this.game.ticker.to(FEEL.squashMs, (t) => {
      this.squash = FEEL.squashScale + (1 - FEEL.squashScale) * t;
    });
    this.spawnRipple(x, y);
    this.spawnFloat(
      this.game.renderer.cx + (Math.random() * 40 - 20),
      this.fishY - this.fishR - 10,
      `+${gain % 1 === 0 ? gain : gain.toFixed(1)}`,
      '#F5EDD8',
      17
    );

    // 听觉 + 触觉
    this.game.audio.playTap(this.game.skin.currentSkin);
    if (this.game.save.vibrateOn) {
      try { wx.vibrateShort({ type: 'light' }); } catch (e) { /* ignore */ }
    }

    // 连击
    this.game.combo.onTap();
  }

  // ---------- 特效 ----------
  private spawnFloat(x: number, y: number, text: string, color: string, size: number): void {
    const f = this.floatPool.obtain();
    f.x = x; f.y = y; f.vy = -FEEL.floatRisePx / (FEEL.floatFadeMs / 1000);
    f.text = text; f.color = color; f.size = size;
    f.life = FEEL.floatFadeMs; f.maxLife = FEEL.floatFadeMs; f.active = true;
    this.floats.push(f);
  }

  private spawnRipple(x: number, y: number): void {
    if (this.game.renderer.lowEnd && this.ripples.length > 6) return; // 低端机限流
    const r = this.ripplePool.obtain();
    r.x = x; r.y = y; r.r = this.fishR * 0.4; r.maxR = this.fishR * 1.8;
    r.life = 500; r.maxLife = 500; r.active = true;
    this.ripples.push(r);
  }

  // ---------- 弹层 ----------
  private onLevelUp(p: any): void {
    this.breakthroughInfo = { name: p.name, unlocks: p.unlocks || [] };
    this.showBreakthrough = true;
    this.game.audio.playBreakthrough();
    this.game.analytics.track('level_up', { level: p.name });
    if (this.game.save.vibrateOn) {
      try { wx.vibrateLong(); } catch (e) { /* ignore */ }
    }
  }

  private async checkOfflineReward(): Promise<void> {
    const save = this.game.save;
    const levelIdx = this.game.levelSystem.current.index;
    if (levelIdx < OFFLINE_UNLOCK_LEVEL) return;
    const info = await this.game.sync.calcOfflineReward();
    if (info && info.merit > 0) {
      this.offlineInfo = info;
      this.showOffline = true;
    }
  }

  private dismissOverlays(): void {
    if (this.showOffline && this.offlineInfo) {
      // 点击空白 = 普通领取
      const merit = this.offlineInfo.merit;
      this.game.sync.claimOfflineReward(merit, false).then((actual) => {
        if (actual > 0) this.game.toast.show(`闭关功德 +${fmtNumber(actual)}`);
      });
    }
    this.showOffline = false;
    this.offlineInfo = null;
    this.showBreakthrough = false;
    this.breakthroughInfo = null;
  }

  private advanceTutorial(): void {
    this.tutorialStep += 1;
    if (this.tutorialStep >= TUTORIAL_STEPS.length) {
      this.showTutorial = false;
      this.game.save.guided = true;
      this.game.saveManager.markDirty();
    }
  }

  // ---------- 帧更新 ----------
  update(dt: number): void {
    // 呼吸光晕
    this.glowPulse = (this.glowPulse + dt / 2000) % 1;

    // 飘字
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.life -= dt;
      f.y += f.vy * (dt / 1000);
      if (f.life <= 0) {
        this.floats.splice(i, 1);
        this.floatPool.release(f);
      }
    }
    // 涟漪
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.life -= dt;
      r.r = r.maxR * (1 - r.life / r.maxLife) * 0.6 + this.fishR * 0.4;
      if (r.life <= 0) {
        this.ripples.splice(i, 1);
        this.ripplePool.release(r);
      }
    }
  }

  // ---------- 渲染 ----------
  render(ctx: CanvasRenderingContext2D): void {
    const { width, height } = this.game.renderer;
    const scene = this.game.skin.currentScene;
    const skin = this.game.skin.currentSkin;
    const cx = this.game.renderer.cx;

    // 背景
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, scene.bgTop);
    grad.addColorStop(1, scene.bgBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // 场景装饰
    this.drawSceneDecor(ctx, scene);

    // 呼吸光晕
    const pulse = 0.5 + 0.5 * Math.sin(this.glowPulse * Math.PI * 2);
    const glowR = this.fishR * (1.6 + pulse * 0.15);
    const glow = ctx.createRadialGradient(cx, this.fishY, this.fishR * 0.5, cx, this.fishY, glowR);
    glow.addColorStop(0, `rgba(232,184,75,${0.12 + pulse * 0.06})`);
    glow.addColorStop(1, 'rgba(232,184,75,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, this.fishY, glowR, 0, Math.PI * 2);
    ctx.fill();

    // 连击渐隐光晕(中断提示)
    const fade = this.game.combo.fadeHint;
    if (fade > 0 && this.game.combo.combo > 0) {
      ctx.strokeStyle = `rgba(232,184,75,${fade * 0.4})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, this.fishY, this.fishR + 14, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 木鱼(按压形变)
    this.drawFish(ctx, cx, this.fishY, this.fishR, this.squash, skin);

    // 涟漪
    for (const r of this.ripples) {
      const alpha = (r.life / r.maxLife) * 0.5;
      ctx.strokeStyle = `rgba(232,184,75,${alpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 飘字
    for (const f of this.floats) {
      const alpha = f.life / f.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = f.color;
      ctx.font = `bold ${f.size}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;

    // 连击数
    if (this.game.combo.combo >= 5) {
      ctx.fillStyle = '#E8B84B';
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${this.game.combo.combo} 连击`, cx, this.fishY + this.fishR + 40);
    }

    // UI
    this.ui.render(ctx);

    // 进度条(境界)
    this.drawLevelProgress(ctx);

    // 弹层
    if (this.showOffline && this.offlineInfo) this.drawOfflineDialog(ctx);
    if (this.showBreakthrough && this.breakthroughInfo) this.drawBreakthrough(ctx);
    if (this.showTutorial) this.drawTutorial(ctx);
  }

  private drawFish(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number, r: number,
    squashY: number,
    skin: { body: string; bodyDark: string; highlight: string; mouth: string }
  ): void {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, squashY);

    // 鱼身(椭圆渐变)
    const bodyGrad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    bodyGrad.addColorStop(0, skin.highlight);
    bodyGrad.addColorStop(0.5, skin.body);
    bodyGrad.addColorStop(1, skin.bodyDark);
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 0.92, 0, 0, Math.PI * 2);
    ctx.fill();

    // 鱼口(上部横缝)
    ctx.strokeStyle = skin.mouth;
    ctx.lineWidth = r * 0.1;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-r * 0.45, -r * 0.15);
    ctx.quadraticCurveTo(0, -r * 0.35, r * 0.45, -r * 0.15);
    ctx.stroke();

    // 底座阴影
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.95, r * 0.8, r * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private drawSceneDecor(ctx: CanvasRenderingContext2D, scene: { accent: string }): void {
    const { width, height } = this.game.renderer;
    ctx.strokeStyle = scene.accent;
    ctx.globalAlpha = 0.08;
    ctx.lineWidth = 1;
    // 远山轮廓
    ctx.beginPath();
    ctx.moveTo(0, height * 0.75);
    for (let x = 0; x <= width; x += width / 6) {
      ctx.lineTo(x, height * 0.75 - Math.sin(x * 0.02) * 30 - 20);
    }
    ctx.lineTo(width, height * 0.75);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  private drawLevelProgress(ctx: CanvasRenderingContext2D): void {
    const { width, contentTop } = this.game.renderer;
    const p = this.game.levelSystem.progress;
    const barW = width * 0.4;
    const barX = (width - barW) / 2;
    const barY = contentTop + 72;
    ctx.fillStyle = 'rgba(232,184,75,0.15)';
    roundRect(ctx, barX, barY, barW, 3, 1.5);
    ctx.fill();
    ctx.fillStyle = '#E8B84B';
    if (p > 0) {
      roundRect(ctx, barX, barY, barW * p, 3, 1.5);
      ctx.fill();
    }
  }

  // ---------- 弹层绘制 ----------
  private drawDim(ctx: CanvasRenderingContext2D, alpha = 0.7): void {
    const { width, height } = this.game.renderer;
    ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    ctx.fillRect(0, 0, width, height);
  }

  private drawOfflineDialog(ctx: CanvasRenderingContext2D): void {
    if (!this.offlineInfo) return;
    const { width, height } = this.game.renderer;
    this.drawDim(ctx);

    const pw = width * 0.78;
    const ph = 250;
    const px = (width - pw) / 2;
    const py = (height - ph) / 2 - 20;

    ctx.fillStyle = 'rgba(26,35,50,0.98)';
    roundRect(ctx, px, py, pw, ph, 18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(232,184,75,0.4)';
    ctx.stroke();

    ctx.fillStyle = '#E8B84B';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(STRINGS.offlineTitle, width / 2, py + 44);

    ctx.fillStyle = '#F5EDD8';
    ctx.font = '16px sans-serif';
    const lines = STRINGS.offlineBody(fmtDuration(this.offlineInfo.hours * 3600000), this.offlineInfo.merit).split('\n');
    lines.forEach((line, i) => ctx.fillText(line, width / 2, py + 92 + i * 26));

    // 双按钮:看视频翻倍 + 直接领取
    const btnW = (pw - 56) / 2;
    const btnH = 44;
    const btnY = py + ph - 64;
    const doubleX = px + 20;
    const claimX = px + 20 + btnW + 16;

    // 翻倍按钮(金色)
    ctx.fillStyle = 'rgba(232,184,75,0.22)';
    roundRect(ctx, doubleX, btnY, btnW, btnH, 22);
    ctx.fill();
    ctx.strokeStyle = '#E8B84B';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#E8B84B';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(STRINGS.offlineDouble, doubleX + btnW / 2, btnY + btnH / 2 + 1);

    // 直接领取按钮(次要)
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    roundRect(ctx, claimX, btnY, btnW, btnH, 22);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#F5EDD8';
    ctx.font = '15px sans-serif';
    ctx.fillText(STRINGS.offlineClaim, claimX + btnW / 2, btnY + btnH / 2 + 1);

    this.offlineDoubleBtn = { x: doubleX, y: btnY, w: btnW, h: btnH };
  }

  private drawBreakthrough(ctx: CanvasRenderingContext2D): void {
    if (!this.breakthroughInfo) return;
    const { width, height } = this.game.renderer;
    this.drawDim(ctx, 0.8);

    // 金色光柱
    const cx = width / 2;
    const cy = height / 2;
    const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, 200);
    grad.addColorStop(0, 'rgba(232,184,75,0.4)');
    grad.addColorStop(1, 'rgba(232,184,75,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#E8B84B';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(STRINGS.breakthroughTitle, cx, cy - 80);

    ctx.fillStyle = '#F5EDD8';
    ctx.font = 'bold 48px sans-serif';
    ctx.fillText(this.breakthroughInfo.name, cx, cy - 20);

    ctx.font = '15px sans-serif';
    ctx.fillStyle = '#C9B98A';
    this.breakthroughInfo.unlocks.forEach((u, i) => {
      ctx.fillText(`解锁:${u}`, cx, cy + 30 + i * 26);
    });

    ctx.fillStyle = '#7A6F55';
    ctx.font = '13px sans-serif';
    ctx.fillText(STRINGS.breakthroughTap, cx, height * 0.82);
  }

  private drawTutorial(ctx: CanvasRenderingContext2D): void {
    const { width, height } = this.game.renderer;
    this.drawDim(ctx, 0.6);

    const text = TUTORIAL_STEPS[this.tutorialStep];
    ctx.fillStyle = '#F5EDD8';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, width / 2, height * 0.3);

    // 手指提示(圈住木鱼)
    ctx.strokeStyle = 'rgba(232,184,75,0.8)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.arc(this.game.renderer.cx, this.fishY, this.fishR + 20, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#9A8F74';
    ctx.font = '13px sans-serif';
    ctx.fillText(`${this.tutorialStep + 1}/${TUTORIAL_STEPS.length} · 轻触继续`, width / 2, height * 0.82);
  }
}
