// 功法只在装备后生效。无上正觉让该功法效果再 +20%。
import { ENERGY_MAX, GONGFA, MANTRAS, RELIC_FLAT, slotCount } from '../data/play';
import type { GradeId } from '../data/play';
import { ensurePlay, type PlayState } from './playRules';
import type { Game } from '../Game';

export class GongfaSystem {
  constructor(private game: Game) {}

  get play(): PlayState {
    return ensurePlay(this.game.save);
  }

  slotMax(): number {
    return slotCount(this.game.levelSystem.peakIndex);
  }

  private amp(id: string): number {
    return this.play.mastered.includes(id) ? 1.2 : 1;
  }

  private equipped(id: string): boolean {
    return this.play.slots.includes(id);
  }

  meritBonus(): number {
    return this.equipped('jingxin') ? 0.08 * this.amp('jingxin') : 0;
  }

  relicFlat(): number {
    return (this.play.relics || 0) * RELIC_FLAT;
  }

  offlineMul(): number {
    if (!this.equipped('fajie')) return 1;
    return 1 + this.amp('fajie');
  }

  comboExtra(): number {
    return this.equipped('cibei') ? Math.round(400 * this.amp('cibei')) : 0;
  }

  bubbleMul(): number {
    return this.equipped('pomo') ? 1.5 * this.amp('pomo') : 1;
  }

  perfectPad(): number {
    return this.equipped('bore') ? Math.round(20 * this.amp('bore')) : 0;
  }

  dailyBonus(): number {
    return this.equipped('dayuan') ? Math.round(30 * this.amp('dayuan')) : 0;
  }

  refresh(): void {
    const play = this.play;
    const max = this.slotMax();
    play.slots = play.slots.filter((id) => play.learned.includes(id)).slice(0, max);
    if (play.mantra && !this.mantraUnlocked(play.mantra)) play.mantra = '';
    this.game.combo.extraResetMs = this.comboExtra();
  }

  mantraUnlocked(id: string): boolean {
    const def = MANTRAS.find((m) => m.id === id);
    return !!def && this.game.levelSystem.peakIndex >= def.unlockLevel;
  }

  learn(id: string, grade: GradeId): void {
    const play = this.play;
    if (!play.learned.includes(id)) play.learned.push(id);
    if (grade === 'supreme' && !play.mastered.includes(id)) play.mastered.push(id);
    const prev = play.grades[id] || '';
    const rank = (g: string) => ({ fail: 1, entry: 2, insight: 3, supreme: 4 }[g] || 0);
    if (rank(grade) >= rank(prev)) play.grades[id] = grade;
    this.refresh();
    this.game.saveManager.markDirty();
  }

  toggleSlot(id: string): string {
    const play = this.play;
    if (!play.learned.includes(id)) return '尚未领悟';
    if (play.slots.includes(id)) {
      play.slots = play.slots.filter((x) => x !== id);
      this.refresh();
      this.game.saveManager.markDirty();
      return '已卸下';
    }
    if (play.slots.length >= this.slotMax()) return `功法槽已满(${this.slotMax()})`;
    play.slots.push(id);
    this.refresh();
    this.game.saveManager.markDirty();
    const name = GONGFA.find((g) => g.id === id)?.name || id;
    return `已装备「${name}」`;
  }

  setMantra(id: string): void {
    if (!this.mantraUnlocked(id)) return;
    this.play.mantra = this.play.mantra === id ? '' : id;
    this.game.saveManager.markDirty();
  }

  onTap(): void {
    const play = this.play;
    if (play.energy < ENERGY_MAX) play.energy += 1;
  }

  cast(): string | null {
    const play = this.play;
    if (!play.mantra || play.energy < ENERGY_MAX) return null;
    play.energy = 0;
    this.game.saveManager.markDirty();
    if (play.mantra === 'daming') {
      this.game.merit.addMerit(80, 'mantra');
      return '六字真言:功德 +80';
    }
    this.game.save.extra.auraUntil = Date.now() + 20_000;
    return '净土莲华:20 秒内功德翻倍';
  }
}
