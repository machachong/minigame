// 离线收益权威结算:以云端 lastSeenAt 为准,客户端仅展示预估值
// 防刷:翻倍(doubled)必须当日广告已观看,服务端记录次数,客户端不可直接传 true
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const TAPS_PER_HOUR = 300;
const CAP_HOURS = 12;
const LEVEL_COEFF = 0.2; // 每阶 +20%
const OFFLINE_UNLOCK_LEVEL = 3; // 罗汉解锁

// 境界表(与客户端 configs.ts 保持一致)
const LEVELS = [0, 1000, 10000, 100000, 1000000, 10000000];

function todayKey() {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

function levelIndexOf(merit) {
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    if (merit >= LEVELS[i]) idx = i;
  }
  return idx;
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { doubled = false } = event;
  const now = new Date();
  const today = todayKey();

  const profiles = db.collection('profiles');
  const res = await profiles.where({ _openid: OPENID }).limit(1).get();
  if (res.data.length === 0) return { ok: false, err: 'no_profile' };

  const doc = res.data[0];
  const lastSeen = doc.lastSeenAt ? new Date(doc.lastSeenAt).getTime() : now.getTime();
  const hours = Math.min((now.getTime() - lastSeen) / 3600000, CAP_HOURS);

  // 罗汉(境界 3)解锁离线禅修
  const levelIdx = levelIndexOf(doc.merit || 0);
  if (levelIdx < OFFLINE_UNLOCK_LEVEL) return { ok: false, err: 'not_unlocked', merit: 0 };

  if (hours < 0.05) return { ok: true, merit: 0, hours: 0 }; // 不足 3 分钟

  // 翻倍必须当日广告已观看(每日 1 次),服务端校验
  const daily = doc.daily || {};
  if (doubled) {
    const watched = daily.dateKey === today && (daily.adWatch && daily.adWatch.offline_double || 0) > 0;
    if (!watched) {
      return { ok: false, err: 'doubled_not_authorized', merit: 0 };
    }
  }

  const coeff = 1 + levelIdx * LEVEL_COEFF;
  let merit = Math.floor(TAPS_PER_HOUR * hours * coeff);
  if (doubled) merit *= 2;

  const updateData = {
    merit: _.inc(merit),
    offlineClaimedAt: now,
    lastSeenAt: now,
  };
  if (doubled) {
    updateData['daily.dateKey'] = today;
    updateData['daily.adWatch.offline_double'] = _.inc(1);
  }

  await profiles.doc(doc._id).update({ data: updateData });

  return { ok: true, merit, hours: Math.round(hours * 100) / 100 };
};
