// 存档同步云函数:字段级合并 + 防刷校验
// 防刷:敲击频率上限 15 次/秒 × 时间窗口;异常增量截断;
//       meritDelta 上限(敲击 + 离线/宝箱/分享奖励);库存只接受已解锁项
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const MAX_TAPS_PER_SECOND = 15;
// 单次上报允许的最大非敲击奖励(离线翻倍 12h×300×系数≈1.4 万,留余量)
const MAX_BONUS_MERIT = 20000;
// 敲击功德系数上限(皮肤最高 +10%,留余量)
const MAX_MERIT_PER_TAP = 2;

// 与客户端 configs.ts 保持一致:境界门槛 / 皮肤 / 场景 / BGM 解锁等级
const LEVEL_MERITS = [0, 1000, 10000, 100000, 1000000, 10000000];
const SKIN_UNLOCKS = { classic_wood: 0, sandalwood: 1, jade: 2 };
const EXTRA_SKINS = { mist: true, sunbird: true };
const SCENE_UNLOCKS = { temple: 0, bamboo: 3, ridge: 4 };
const BGM_UNLOCKS = { xinjing: 1, dabeizhou: 2, jingangjing: 3 };

function todayKey() {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

function yesterdayKey() {
  const d = new Date(Date.now() + 8 * 3600 * 1000 - 86400000);
  return d.toISOString().slice(0, 10);
}

function practiceOf(daily, sameDay, yesterday) {
  if (sameDay) {
    return {
      practiceProgress: daily.practiceProgress || 0,
      practiceDone: !!daily.practiceDone,
      practiceStreak: daily.practiceStreak || 0,
    };
  }
  return {
    practiceProgress: 0,
    practiceDone: false,
    practiceStreak: daily.dateKey === yesterday && daily.practiceDone ? (daily.practiceStreak || 0) : 0,
  };
}

/** 同一天取进度较大的一侧，避免云同步把今日修行盖掉 */
function takePractice(rolled, client) {
  if (!client || client.dateKey !== rolled.dateKey) return rolled;
  const incoming = Math.max(0, Math.min(20000, Math.floor(Number(client.practiceProgress) || 0)));
  rolled.practiceProgress = Math.max(rolled.practiceProgress || 0, incoming);
  rolled.practiceDone = !!(rolled.practiceDone || client.practiceDone);
  rolled.practiceStreak = Math.max(
    rolled.practiceStreak || 0,
    Math.max(0, Math.min(9999, Math.floor(Number(client.practiceStreak) || 0)))
  );
  return rolled;
}

/** 与客户端 dailyRules.rollDaily 同一口径;tapsToAdd 只加在当天 */
function rollServerDaily(prev, today, tapsToAdd) {
  const daily = prev || {};
  if (daily.dateKey === today) {
    return {
      dateKey: today,
      taps: (daily.taps || 0) + tapsToAdd,
      claimed: !!daily.claimed,
      streak: daily.streak || 0,
      shareMeritClaimed: !!daily.shareMeritClaimed,
      adWatch: daily.adWatch || {},
      ...practiceOf(daily, true, ''),
    };
  }
  const yesterday = yesterdayKey();
  return {
    dateKey: today,
    taps: tapsToAdd,
    claimed: false,
    streak: daily.dateKey === yesterday && daily.claimed ? (daily.streak || 0) : 0,
    shareMeritClaimed: false,
    adWatch: {},
    ...practiceOf(daily, false, yesterday),
  };
}

function levelIndexOf(merit) {
  let idx = 0;
  for (let i = 0; i < LEVEL_MERITS.length; i++) {
    if (merit >= LEVEL_MERITS[i]) idx = i;
  }
  return idx;
}

/** 过滤未解锁项(服务端权威,防伪造库存) */
function filterUnlocked(list, unlockMap, levelIdx) {
  if (!Array.isArray(list)) return [];
  return list.filter((id) => (unlockMap[id] !== undefined && unlockMap[id] <= levelIdx) || EXTRA_SKINS[id]);
}

const GONGFA_IDS = ['jingxin', 'cibei', 'bore', 'pomo', 'fajie', 'dayuan'];
const MANTRA_IDS = ['daming', 'wangsheng', ''];

function sanitizePlay(clientPlay, doc) {
  const src = clientPlay || {};
  const learned = (Array.isArray(src.learned) ? src.learned : []).filter((id) => GONGFA_IDS.includes(id));
  const mastered = (Array.isArray(src.mastered) ? src.mastered : []).filter((id) => learned.includes(id));
  const slots = (Array.isArray(src.slots) ? src.slots : []).filter((id) => learned.includes(id)).slice(0, 3);
  const levelPeak = Math.max(doc.levelPeak || 0, Math.max(0, Math.min(5, Math.floor(src.levelPeak || 0))));
  return {
    learned,
    mastered,
    slots,
    mantra: MANTRA_IDS.includes(src.mantra) ? src.mantra : '',
    energy: Math.max(0, Math.min(100, Math.floor(src.energy || 0))),
    bodhi: Math.max(0, Math.min(999, Math.floor(src.bodhi || 0))),
    grades: src.grades && typeof src.grades === 'object' ? src.grades : {},
    levelPeak,
    cycle: doc.cycle || 0,
    relics: doc.relics || 0,
    pendingRebirth: false,
  };
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { tapsDelta = 0, meritDelta = 0, profile: clientProfile } = event;
  const now = new Date();
  const today = todayKey();

  const profiles = db.collection('profiles');
  const res = await profiles.where({ _openid: OPENID }).limit(1).get();
  if (res.data.length === 0) return { ok: false, err: 'no_profile' };

  const doc = res.data[0];

  if (event.rebirth) {
    if ((doc.merit || 0) < 1000000) return { ok: false, err: 'not_enough', merit: doc.merit || 0 };
    const cycle = (doc.cycle || 0) + 1;
    const relics = (doc.relics || 0) + 1;
    await profiles.doc(doc._id).update({
      data: { merit: 0, cycle, relics, lastSyncAt: now, lastSeenAt: now },
    });
    return { ok: true, cycle, relics, merit: 0 };
  }

  const lastSync = doc.lastSyncAt ? new Date(doc.lastSyncAt).getTime() : now.getTime();
  const elapsedSec = Math.max(1, (now.getTime() - lastSync) / 1000);

  // 防刷 1:时间窗口内允许的最大敲击数(宽松 2 倍,避免误伤)
  const maxAllowed = Math.ceil(elapsedSec * MAX_TAPS_PER_SECOND * 2);
  let taps = Math.max(0, Math.floor(tapsDelta));
  let truncated = false;
  if (taps > maxAllowed) {
    taps = maxAllowed;
    truncated = true;
    console.warn(`[syncProfile] 异常增量截断: ${tapsDelta} → ${taps} (openid=${OPENID})`);
  }

  // 防刷 2:功德增量上限(敲击部分 ≤ taps×系数 + 单次奖励余量)
  let merit = Math.max(0, Math.floor(meritDelta));
  const meritCap = taps * MAX_MERIT_PER_TAP + MAX_BONUS_MERIT;
  if (merit > meritCap) {
    console.warn(`[syncProfile] 功德增量截断: ${merit} → ${meritCap} (openid=${OPENID})`);
    merit = meritCap;
    truncated = true;
  }

  // 用更新后功德计算境界,再决定库存/装备合法性
  const nextMerit = (doc.merit || 0) + merit;
  const levelIdx = levelIndexOf(nextMerit);

  const updateData = {
    totalTaps: _.inc(taps),
    merit: _.inc(merit),
    lastSyncAt: now,
    lastSeenAt: now,
  };

  // 字段级合并:客户端带来的非数值字段,仅接受已解锁项
  if (clientProfile) {
    if (clientProfile.skinId && SKIN_UNLOCKS[clientProfile.skinId] <= levelIdx) {
      updateData.skinId = clientProfile.skinId;
    }
    if (clientProfile.sceneId && SCENE_UNLOCKS[clientProfile.sceneId] <= levelIdx) {
      updateData.sceneId = clientProfile.sceneId;
    }
    if (clientProfile.bgmId && (BGM_UNLOCKS[clientProfile.bgmId] !== undefined ? BGM_UNLOCKS[clientProfile.bgmId] <= levelIdx : false)) {
      updateData.bgmId = clientProfile.bgmId;
    }
    if (typeof clientProfile.soundOn === 'boolean') updateData.soundOn = clientProfile.soundOn;
    if (typeof clientProfile.vibrateOn === 'boolean') updateData.vibrateOn = clientProfile.vibrateOn;
    if (['resonant', 'wooden', 'crisp', 'thump'].includes(clientProfile.tapSound)) updateData.tapSound = clientProfile.tapSound;
    if (clientProfile.inventory) {
      updateData.inventory = {
        skins: Array.from(new Set([
          ...(doc.inventory && doc.inventory.skins ? doc.inventory.skins : []),
          ...filterUnlocked(clientProfile.inventory.skins, SKIN_UNLOCKS, levelIdx),
        ])),
        scenes: Array.from(new Set([
          ...(doc.inventory && doc.inventory.scenes ? doc.inventory.scenes : []),
          ...filterUnlocked(clientProfile.inventory.scenes, SCENE_UNLOCKS, levelIdx),
        ])),
        bgms: Array.from(new Set([
          ...(doc.inventory && doc.inventory.bgms ? doc.inventory.bgms : []),
          ...filterUnlocked(clientProfile.inventory.bgms, BGM_UNLOCKS, levelIdx),
        ])),
      };
    }
  }

  // 每日功课:跨天必须清掉昨天的领取标记,否则第二天永远领不到
  updateData.daily = takePractice(
    rollServerDaily(doc.daily, today, taps),
    clientProfile && clientProfile.practice
  );

  const play = sanitizePlay(clientProfile && clientProfile.play, doc);
  updateData.extraPlay = play;
  updateData.levelPeak = play.levelPeak;

  await profiles.doc(doc._id).update({ data: updateData });

  return { ok: true, truncated, serverTime: now.getTime() };
};
