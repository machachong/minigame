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
const SCENE_UNLOCKS = { temple: 0, bamboo: 3 };
const BGM_UNLOCKS = { xinjing: 1, dabeizhou: 2, jingangjing: 3 };

function todayKey() {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
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
  return list.filter((id) => unlockMap[id] !== undefined && unlockMap[id] <= levelIdx);
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

  // 每日功课 taps 累计(防刷:只能由 syncProfile 累计,客户端不可直接写)
  const srvDaily = doc.daily || {};
  if (srvDaily.dateKey === today) {
    updateData['daily.taps'] = (srvDaily.taps || 0) + taps;
  } else {
    // 跨天:重置当天计数(claimed/shareMeritClaimed 由 dailyClaim 单独管理)
    updateData['daily.dateKey'] = today;
    updateData['daily.taps'] = taps;
  }

  await profiles.doc(doc._id).update({ data: updateData });

  return { ok: true, truncated, serverTime: now.getTime() };
};
