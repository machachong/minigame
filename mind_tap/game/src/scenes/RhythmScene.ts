// 听经:音符落到判定线时点按 / 长按 / 滑动。不走主界面的 80ms 防抖。
import { Scene } from '../core/Scene';
import { UIContainer } from '../ui/Node';
import { Button } from '../ui/widgets';
import { CHARTS, GRADE_NAME, type GradeId, type Note } from '../data/play';
import { buildChart, gradeOf, judgeDelta } from '../systems/playRules';
import type { Game } from '../Game';

interface LiveNote extends Note {
  state: 'wait' | 'hold' | 'perfect' | 'good' | 'miss';
}

export class RhythmScene extends Scene {
  preciseTouch = true;
  private chartId: string;
  private notes: LiveNote[] = [];
  private songT = -2.2;
  private counts = { perfect: 0, good: 0, miss: 0 };
  private grade: GradeId | null = null;
  private finger: { x: number; y: number; down: boolean } = { x: 0, y: 0, down: false };
  private ui = new UIContainer();

  constructor(game: Game, chartId: string) {
    super(game);
    this.chartId = chartId;
  }

  enter(): void {
    const def = CHARTS.find((c) => c.id === this.chartId) || CHARTS[0];
    this.notes = buildChart(def).map((n) => ({ ...n, state: 'wait' as const }));
    const { width, contentTop } = this.game.renderer;
    const back = new Button('返回', 64, 32, { font: 13 });
    back.x = 12;
    back.y = contentTop + 8;
    back.onTap = () => this.game.scenes.pop();
    this.ui.add(back);
    void width;
  }

  exit(): void {
    this.ui.removeAll();
  }

  update(dt: number): void {
    if (this.grade) return;
    this.songT += dt / 1000;
    const def = this.def;
    const good = (def.goodMs + this.game.gongfa.perfectPad()) / 1000;
    this.notes.forEach((n) => {
      if (n.state === 'perfect' || n.state === 'good' || n.state === 'miss') return;
      const end = n.t + (n.dur || 0);
      if (this.songT > end + good) this.mark(n, 'miss');
    });
    if (this.songT > def.duration + 0.4 && this.notes.every((n) => n.state !== 'wait' && n.state !== 'hold')) {
      this.finish();
    }
  }

  private get def() {
    return CHARTS.find((c) => c.id === this.chartId) || CHARTS[0];
  }

  render(ctx: CanvasRenderingContext2D): void {
    const { width, height, contentTop } = this.game.renderer;
    ctx.fillStyle = '#10161c';
    ctx.fillRect(0, 0, width, height);

    const hitY = height * 0.74;
    ctx.strokeStyle = 'rgba(232,184,75,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(24, hitY);
    ctx.lineTo(width - 24, hitY);
    ctx.stroke();

    ctx.fillStyle = '#E8B84B';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(this.def.name, width / 2, contentTop + 28);

    if (this.songT < 0) {
      ctx.font = 'bold 42px sans-serif';
      ctx.fillText(String(Math.ceil(-this.songT)), width / 2, height * 0.42);
    }

    const speed = height * 0.42;
    this.notes.forEach((n) => {
      const y = hitY - (n.t - this.songT) * speed;
      if (y < -30 || y > height + 20) return;
      const x = 24 + n.pos * (width - 48);
      const warn = n.t - this.songT < 0.8 && n.t - this.songT > -0.2;
      ctx.globalAlpha = n.state === 'miss' ? 0.25 : 1;
      ctx.fillStyle = n.state === 'perfect' ? '#E8B84B' : n.state === 'good' ? '#F5EDD8' : warn ? '#F2D48A' : '#8AA0B4';
      ctx.beginPath();
      ctx.arc(x, y, n.type === 'tap' ? 14 : 16, 0, Math.PI * 2);
      ctx.fill();
      if (n.type !== 'tap' && n.dur) {
        const y2 = hitY - (n.t + n.dur - this.songT) * speed;
        ctx.strokeStyle = ctx.fillStyle;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(n.to != null ? 24 + n.to * (width - 48) : x, y2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    });

    if (this.finger.down) {
      ctx.strokeStyle = 'rgba(245,237,216,0.7)';
      ctx.beginPath();
      ctx.arc(this.finger.x, this.finger.y, 18, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (this.grade) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#E8B84B';
      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(GRADE_NAME[this.grade], width / 2, height * 0.4);
      ctx.fillStyle = '#F5EDD8';
      ctx.font = '16px sans-serif';
      ctx.fillText(`完美 ${this.counts.perfect}  好 ${this.counts.good}  失误 ${this.counts.miss}`, width / 2, height * 0.48);
      ctx.fillStyle = '#9A8F74';
      ctx.fillText('轻触返回', width / 2, height * 0.58);
    }

    this.ui.render(ctx);
  }

  onTouchStart(x: number, y: number): boolean {
    if (this.grade) {
      this.game.scenes.pop();
      return true;
    }
    if (this.ui.dispatchTouch('start', x, y)) return true;
    this.finger = { x, y, down: true };
    const note = this.pick(x, false);
    if (!note) return true;
    if (note.type === 'tap') this.resolveTap(note);
    else note.state = 'hold';
    return true;
  }

  onTouchMove(x: number, y: number): void {
    this.finger.x = x;
    this.finger.y = y;
    this.ui.dispatchTouch('move', x, y);
    const slide = this.notes.find((n) => n.state === 'hold' && n.type === 'slide');
    if (!slide || slide.to == null) return;
    const { width } = this.game.renderer;
    const px = (x - 24) / (width - 48);
    if (Math.abs(px - slide.to) <= 0.16) this.resolveTap(slide);
  }

  onTouchEnd(x: number, y: number): void {
    this.finger.down = false;
    this.ui.dispatchTouch('end', x, y);
    const hold = this.notes.find((n) => n.state === 'hold' && n.type === 'hold');
    if (!hold) return;
    const target = hold.t + (hold.dur || 0);
    const delta = (this.songT - target) * 1000;
    const def = this.def;
    const pad = this.game.gongfa.perfectPad();
    const judged = judgeDelta(delta, def.perfectMs + pad, def.goodMs + pad);
    this.mark(hold, judged === 'miss' ? 'miss' : judged);
  }

  private pick(x: number, includeHold: boolean): LiveNote | null {
    const { width } = this.game.renderer;
    const px = (x - 24) / (width - 48);
    const def = this.def;
    const pad = this.game.gongfa.perfectPad();
    let best: LiveNote | null = null;
    let bestAbs = Infinity;
    this.notes.forEach((n) => {
      if (n.state !== 'wait') return;
      if (!includeHold && n.type !== 'tap' && n.type !== 'hold' && n.type !== 'slide') return;
      const delta = Math.abs(this.songT - n.t) * 1000;
      if (delta > def.goodMs + pad) return;
      if (Math.abs(px - n.pos) > 0.2) return;
      if (delta < bestAbs) {
        best = n;
        bestAbs = delta;
      }
    });
    return best;
  }

  private resolveTap(note: LiveNote): void {
    const def = this.def;
    const pad = this.game.gongfa.perfectPad();
    const judged = judgeDelta((this.songT - note.t) * 1000, def.perfectMs + pad, def.goodMs + pad);
    this.mark(note, judged);
  }

  private mark(note: LiveNote, state: 'perfect' | 'good' | 'miss'): void {
    if (note.state === 'perfect' || note.state === 'good' || note.state === 'miss') return;
    note.state = state;
    this.counts[state] += 1;
    if (state !== 'miss') this.game.audio.playTap(this.game.skin.currentSkin);
  }

  private finish(): void {
    const grade = gradeOf(this.counts.perfect, this.counts.good, this.counts.miss);
    this.grade = grade;
    const play = this.game.gongfa.play;
    const prev = play.grades[this.chartId] || '';
    const rank = (g: string) => ({ fail: 1, entry: 2, insight: 3, supreme: 4 }[g] || 0);
    if (rank(grade) >= rank(prev)) play.grades[this.chartId] = grade;
    if (grade !== 'fail') {
      this.game.gongfa.learn(this.def.gongfaId, grade);
      if (this.chartId === 'huayan') this.game.gongfa.learn('dayuan', grade);
      const merit = this.counts.perfect * 2 + this.counts.good;
      if (merit > 0) this.game.merit.addMerit(merit, 'rhythm');
    }
    this.game.saveManager.markDirty();
  }
}
