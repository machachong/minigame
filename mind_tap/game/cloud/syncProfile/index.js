// 存档同步云函数:字段级合并 + 防刷校验
// 防刷:敲击频率上限 15 次/秒 × 时间窗口;异常增量截断
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const MAX_TAPS_PER_SECOND = 15;

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { tapsDelta = 0, meritDelta = 0, profile: clientProfile } = event;
  const now = new Date();

  const profiles = db.collection('profiles');
  const res = await profiles.where({ _openid: OPENID }).limit(1).get();
  if (res.data.length === 0) return { ok: false, err: 'no_profile' };

  const doc = res.data[0];
  const lastSync = doc.lastSyncAt ? new Date(doc.lastSyncAt).getTime() : now.getTime();
  const elapsedSec = Math.max(1, (now.getTime() - lastSync) / 1000);

  // 防刷:时间窗口内允许的最大敲击数(宽松 2 倍,避免误伤)
  const maxAllowed = Math.ceil(elapsedSec * MAX_TAPS_PER_SECOND * 2);
  let taps = Math.max(0, Math.floor(tapsDelta));
  let truncated = false;
  if (taps > maxAllowed) {
    taps = maxAllowed;
    truncated = true;
    console.warn(`[syncProfile] 异常增量截断: ${tapsDelta} → ${taps} (openid=${OPENID})`);
  }
  const merit = Math.max(0, Math.floor(meritDelta));

  const updateData = {
    totalTaps: _.inc(taps),
    merit: _.inc(merit),
    lastSyncAt: now,
    lastSeenAt: now,
  };

  // 字段级合并:客户端带来的非数值字段直接覆盖(皮肤/设置等)
  if (clientProfile) {
    if (clientProfile.skinId) updateData.skinId = clientProfile.skinId;
    if (clientProfile.sceneId) updateData.sceneId = clientProfile.sceneId;
    if (clientProfile.bgmId) updateData.bgmId = clientProfile.bgmId;
    if (typeof clientProfile.soundOn === 'boolean') updateData.soundOn = clientProfile.soundOn;
    if (typeof clientProfile.vibrateOn === 'boolean') updateData.vibrateOn = clientProfile.vibrateOn;
    if (clientProfile.inventory) updateData.inventory = clientProfile.inventory;
  }

  await profiles.doc(doc._id).update({ data: updateData });

  return { ok: true, truncated, serverTime: now.getTime() };
};
