// 入灭:功德从零再计,境界和已解锁内容保留,获得一颗舍利子。
import { REBIRTH_MERIT } from '../data/play';
import { ensurePlay } from './playRules';
import type { Game } from '../Game';

export class RebirthSystem {
  constructor(private game: Game) {}

  can(): boolean {
    return this.game.save.merit >= REBIRTH_MERIT;
  }

  async perform(): Promise<boolean> {
    if (!this.can()) return false;
    const save = this.game.save;
    const play = ensurePlay(save);
    this.game.levelSystem.rememberPeak();
    if (this.game.sync.state === 'guest') {
      play.cycle += 1;
      play.relics += 1;
      play.pendingRebirth = true;
    } else {
      const ok = await this.game.sync.pushRebirth();
      if (!ok) return false;
    }
    save.merit = 0;
    save.pendingMerit = 0;
    if (!save.inventory.skins.includes('sunbird')) save.inventory.skins.push('sunbird');
    this.game.saveManager.markDirty();
    this.game.levelSystem.rememberPeak();
    return true;
  }
}
