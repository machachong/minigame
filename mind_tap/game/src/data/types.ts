// 存档数据模型(本地镜像与云端 profiles 保持一致)
export interface DailyState {
  dateKey: string;          // YYYY-MM-DD(UTC+8)
  taps: number;             // 今日敲击数
  claimed: boolean;         // 今日功课宝箱是否已领
  streak: number;           // 连续完成天数
  shareMeritClaimed: boolean; // 今日分享功德是否已领
  adWatch: Record<string, number>; // 广告点位当日观看次数
}

export interface Inventory {
  skins: string[];
  scenes: string[];
  bgms: string[];
}

export interface SaveData {
  version: number;
  merit: number;            // 累计功德
  totalTaps: number;        // 累计敲击
  skinId: string;
  sceneId: string;
  bgmId: string;
  soundOn: boolean;
  vibrateOn: boolean;
  inventory: Inventory;
  daily: DailyState;
  lastSeenAt: number;       // 上次离开时间戳(ms)
  lastSyncAt: number;       // 上次云同步时间戳(ms)
  offlineClaimedAt: number; // 上次离线收益领取时间戳(ms)
  pendingTaps: number;      // 未上报云端的敲击数
  pendingMerit: number;     // 未上报云端的功德增量
  guided: boolean;          // 新手引导已完成
  nickname: string;
  extra: Record<string, any>; // 二期扩展位(功法/舍利子/事件)
}

export const SAVE_VERSION = 1;

export function createDefaultSave(): SaveData {
  const now = Date.now();
  return {
    version: SAVE_VERSION,
    merit: 0,
    totalTaps: 0,
    skinId: 'classic_wood',
    sceneId: 'temple',
    bgmId: 'none',
    soundOn: true,
    vibrateOn: true,
    inventory: { skins: ['classic_wood'], scenes: ['temple'], bgms: [] },
    daily: {
      dateKey: '',
      taps: 0,
      claimed: false,
      streak: 0,
      shareMeritClaimed: false,
      adWatch: {},
    },
    lastSeenAt: now,
    lastSyncAt: 0,
    offlineClaimedAt: 0,
    pendingTaps: 0,
    pendingMerit: 0,
    guided: false,
    nickname: '',
    extra: {},
  };
}

/** 旧版本存档迁移入口(按 version 逐级升级) */
export function migrateSave(data: any): SaveData {
  const def = createDefaultSave();
  if (!data || typeof data !== 'object') return def;
  // 浅合并 + 深合并关键子对象,缺失字段补默认
  const merged: SaveData = {
    ...def,
    ...data,
    inventory: { ...def.inventory, ...(data.inventory || {}) },
    daily: { ...def.daily, ...(data.daily || {}) },
    extra: { ...(data.extra || {}) },
  };
  merged.version = SAVE_VERSION;
  return merged;
}
