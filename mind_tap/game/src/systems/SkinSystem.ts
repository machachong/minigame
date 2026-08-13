// 皮肤/场景装配系统
import { bus, Events } from '../core/EventBus';
import { SKINS, SCENES, SkinConfig, SceneConfig } from '../data/configs';
import type { Game } from '../Game';

export class SkinSystem {
  private game: Game;

  constructor(game: Game) {
    this.game = game;
  }

  get currentSkin(): SkinConfig {
    // 皮肤试用(看广告解锁的限时试用)优先
    const trial = this.game.save.extra.skinTrial as { id?: string; until?: number } | undefined;
    if (trial && trial.id && trial.until && trial.until > Date.now()) {
      const trialSkin = SKINS.find((s) => s.id === trial.id);
      if (trialSkin) return trialSkin;
    }
    return SKINS.find((s) => s.id === this.game.save.skinId) || SKINS[0];
  }

  get currentScene(): SceneConfig {
    return SCENES.find((s) => s.id === this.game.save.sceneId) || SCENES[0];
  }

  isSkinUnlocked(id: string): boolean {
    return this.game.save.inventory.skins.includes(id);
  }

  /** 皮肤试用(激励视频解锁,限时 30 分钟) */
  trialSkin(id: string, minutes = 30): boolean {
    const skin = SKINS.find((s) => s.id === id);
    if (!skin) return false;
    this.game.save.extra.skinTrial = { id, until: Date.now() + minutes * 60000 };
    this.game.saveManager.markDirty();
    bus.emit(Events.SKIN_CHANGED, { id });
    return true;
  }

  isSceneUnlocked(id: string): boolean {
    return this.game.save.inventory.scenes.includes(id);
  }

  equipSkin(id: string): boolean {
    if (!this.isSkinUnlocked(id)) return false;
    this.game.save.skinId = id;
    this.game.saveManager.markDirty();
    bus.emit(Events.SKIN_CHANGED, { id });
    return true;
  }

  equipScene(id: string): boolean {
    if (!this.isSceneUnlocked(id)) return false;
    this.game.save.sceneId = id;
    this.game.saveManager.markDirty();
    bus.emit(Events.SCENE_CHANGED, { id });
    return true;
  }
}
