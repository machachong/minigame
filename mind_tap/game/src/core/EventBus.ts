// 全局事件总线:模块间解耦通信
export type EventHandler = (payload?: any) => void;

export class EventBus {
  private handlers: Map<string, Set<EventHandler>> = new Map();

  on(event: string, handler: EventHandler): () => void {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  off(event: string, handler: EventHandler): void {
    this.handlers.get(event)?.delete(handler);
  }

  emit(event: string, payload?: any): void {
    const set = this.handlers.get(event);
    if (!set) return;
    set.forEach((h) => {
      try {
        h(payload);
      } catch (e) {
        console.error(`[EventBus] handler error on "${event}":`, e);
      }
    });
  }

  clear(event?: string): void {
    if (event) this.handlers.delete(event);
    else this.handlers.clear();
  }
}

export const bus = new EventBus();

// 事件名常量,避免字符串散落
export const Events = {
  MERIT_CHANGED: 'merit:changed',       // { merit, gain }
  COMBO_CHANGED: 'combo:changed',       // { combo }
  COMBO_MILESTONE: 'combo:milestone',   // { combo } 10/50/100
  LEVEL_UP: 'level:up',                 // { levelIndex, name }
  DAILY_GOAL: 'daily:goal',             // 今日功课敲满 100
  DAILY_CLAIMED: 'daily:claimed',       // { reward, streak }
  SKIN_CHANGED: 'skin:changed',
  SCENE_CHANGED: 'scene:changed',
  SYNC_STATE: 'sync:state',             // 'online' | 'guest' | 'syncing' | 'error'
  OFFLINE_REWARD: 'offline:reward',     // { merit, hours }
  SAVE_DIRTY: 'save:dirty',
} as const;
