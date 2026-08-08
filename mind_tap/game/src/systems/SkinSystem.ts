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
    return SKINS.find((s) => s.id === this.game.save.skinId) || SKINS[0];
  }

  get currentScene(): SceneConfig {
    return SCENES.find((s) => s.id === this.game.save.sceneId) || SCENES[0];
  }

  isSkinUnlocked(id: string): boolean {
    return this.game.save.inventory.skins.includes(id);
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
