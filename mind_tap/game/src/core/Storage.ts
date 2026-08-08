// 本地存档:全量 JSON 镜像 + 写入节流
import { SaveData, createDefaultSave, migrateSave } from '../data/types';

const SAVE_KEY = 'kxcf_save_v1';

export class Storage {
  /** 读取本地存档(无则返回默认) */
  static load(): SaveData {
    try {
      const raw = wx.getStorageSync(SAVE_KEY);
      if (!raw) return createDefaultSave();
      return migrateSave(JSON.parse(raw as string));
    } catch (e) {
      console.warn('[Storage] load failed, use default:', e);
      return createDefaultSave();
    }
  }

  static write(data: SaveData): void {
    try {
      wx.setStorageSync(SAVE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('[Storage] write failed:', e);
    }
  }

  static clear(): void {
    try {
      wx.removeStorageSync(SAVE_KEY);
    } catch (e) {
      /* ignore */
    }
  }
}

/** 写入节流:≥1s 或关键节点强写 */
export class SaveManager {
  private data: SaveData;
  private dirty = false;
  private lastWrite = 0;

  constructor(data: SaveData) {
    this.data = data;
  }

  get save(): SaveData {
    return this.data;
  }

  /** 标记脏,由 tick 节流落盘 */
  markDirty(): void {
    this.dirty = true;
  }

  tick(): void {
    if (!this.dirty) return;
    const now = Date.now();
    if (now - this.lastWrite < 1000) return;
    this.flush();
  }

  /** 立即落盘(切后台/关键节点调用) */
  flush(): void {
    this.data.lastSeenAt = Date.now();
    Storage.write(this.data);
    this.dirty = false;
    this.lastWrite = Date.now();
  }

  hasPending(): boolean {
    return this.dirty;
  }
}
