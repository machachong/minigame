// 全部数值与资源配置表(手感调参集中在这里,支持开发期热改)

// ---------- 云开发 ----------
export const CLOUD_ENV = 'kxcf-prod'; // 云环境 ID(部署时在云开发控制台创建)

// ---------- 境界 ----------
export interface LevelConfig {
  index: number;
  name: string;
  merit: number;        // 到达该境界所需累计功德
  unlocks: string[];    // 解锁内容描述(展示用)
}

export const LEVELS: LevelConfig[] = [
  { index: 0, name: '凡夫', merit: 0, unlocks: [] },
  { index: 1, name: '居士', merit: 1000, unlocks: ['皮肤「檀木」', '佛乐《心经》'] },
  { index: 2, name: '比丘', merit: 10000, unlocks: ['皮肤「冰种翡翠」', '佛乐《大悲咒》'] },
  { index: 3, name: '罗汉', merit: 100000, unlocks: ['离线禅修', '场景「竹林幽潭」', '佛乐《金刚经》'] },
  { index: 4, name: '菩萨', merit: 1000000, unlocks: ['称号飘字'] },
  { index: 5, name: '佛', merit: 10000000, unlocks: ['终极特效'] },
];

// ---------- 木鱼皮肤 ----------
export interface SkinConfig {
  id: string;
  name: string;
  bonus: number;          // 功德加成 0.05 = +5%
  unlockLevel: number;    // 解锁所需境界 index
  // 音色
  freq: number;           // 基频 Hz
  decay: number;          // 衰减秒
  wave: OscillatorType;
  // 配色
  body: string;           // 木鱼主体色
  bodyDark: string;       // 暗部
  highlight: string;      // 高光
  mouth: string;          // 鱼口
}

export const SKINS: SkinConfig[] = [
  {
    id: 'classic_wood', name: '经典木色', bonus: 0, unlockLevel: 0,
    freq: 180, decay: 0.28, wave: 'sine',
    body: '#8B5A2B', bodyDark: '#5D3A1A', highlight: '#C89B6D', mouth: '#3A2410',
  },
  {
    id: 'sandalwood', name: '檀木', bonus: 0.05, unlockLevel: 1,
    freq: 145, decay: 0.34, wave: 'sine',
    body: '#6B3A2A', bodyDark: '#452216', highlight: '#A67B5B', mouth: '#2E160C',
  },
  {
    id: 'jade', name: '冰种翡翠', bonus: 0.1, unlockLevel: 2,
    freq: 255, decay: 0.22, wave: 'triangle',
    body: '#5FA98A', bodyDark: '#3A7A60', highlight: '#A8D8C0', mouth: '#24503C',
  },
];

// ---------- 场景 ----------
export interface SceneConfig {
  id: string;
  name: string;
  unlockLevel: number;
  bgTop: string;
  bgBottom: string;
  accent: string;         // 装饰色(灯焰/竹叶)
  textMain: string;       // 主文案色
  textSub: string;        // 次文案色
}

export const SCENES: SceneConfig[] = [
  {
    id: 'temple', name: '青灯古佛', unlockLevel: 0,
    bgTop: '#1A2332', bgBottom: '#0D1420', accent: '#E8B84B',
    textMain: '#F5EDD8', textSub: '#9A8F74',
  },
  {
    id: 'bamboo', name: '竹林幽潭', unlockLevel: 3,
    bgTop: '#16302A', bgBottom: '#0A1A16', accent: '#7BC496',
    textMain: '#E8F2E4', textSub: '#8AA893',
  },
];

// ---------- BGM(音频文件上传云存储后回填 url) ----------
export interface BgmConfig {
  id: string;
  name: string;
  unlockLevel: number;
  url: string; // 为空则不展示(素材未上传)
}

export const BGMS: BgmConfig[] = [
  { id: 'none', name: '无', unlockLevel: 0, url: '' },
  { id: 'xinjing', name: '心经', unlockLevel: 1, url: '' },
  { id: 'dabeizhou', name: '大悲咒', unlockLevel: 2, url: '' },
  { id: 'jingangjing', name: '金刚经', unlockLevel: 3, url: '' },
];

// ---------- 每日功课 ----------
export const DAILY_TAP_GOAL = 100;
export const DAILY_REWARDS = [66, 88, 108, 168]; // 宝箱随机功德
export const SHARE_MERIT = 100;                  // 每日首次分享双方功德

// ---------- 离线禅修 ----------
export const OFFLINE_TAPS_PER_HOUR = 300;
export const OFFLINE_CAP_HOURS = 12;
export const OFFLINE_LEVEL_COEFF = 0.2; // 每阶境界 +20%
export const OFFLINE_UNLOCK_LEVEL = 3;  // 罗汉解锁

// ---------- 云同步 ----------
export const SYNC_CONFIG = {
  loginTimeoutMs: 2500,   // 登录超时 → 游客模式
  tapBatchSize: 50,       // 攒够 N 次敲击触发上报
  flushIntervalMs: 30000, // 定时上报
  maxTapsPerSecond: 15,   // 服务端防刷频率上限
};

// ---------- 广告(流量主开通后回填 adUnitId;开发期 DEV_MOCK_ADS=true 直接发放奖励) ----------
export const DEV_MOCK_ADS = true;
export const AD_UNIT_ID = ''; // 例:adunit-xxxxxxxxxxxxxxxx
export const AD_LIMITS: Record<string, number> = {
  merit_double: 3,    // 静心加成(今日功德翻倍)
  offline_double: 1,  // 离线收益翻倍
  skin_trial: 1,      // 皮肤试用
};
export const AD_DAILY_TOTAL = 6;

// ---------- 排行榜 ----------
export const RANK_UPLOAD_INTERVAL_MS = 30000;

// ---------- 手感 ----------
export const FEEL = {
  tapMergeMs: 80,        // 该间隔内的重复 touchstart 合并(防抖动)
  squashScale: 0.9,      // 木鱼按压 scaleY
  squashMs: 100,         // 回弹时长
  floatRisePx: 40,       // 飘字上浮距离
  floatFadeMs: 600,      // 飘字渐隐
  comboResetMs: 1500,    // 连击中断判定
  comboMilestones: [10, 50, 100, 300, 500, 1000],
};
