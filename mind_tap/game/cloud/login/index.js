// 登录云函数:获取 openid、创建用户与存档
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const DEFAULT_PROFILE = {
  merit: 0,
  totalTaps: 0,
  skinId: 'classic_wood',
  sceneId: 'temple',
  bgmId: 'none',
  soundOn: true,
  vibrateOn: true,
  inventory: { skins: ['classic_wood'], scenes: ['temple'], bgms: [] },
  daily: { dateKey: '', taps: 0, claimed: false, streak: 0, shareMeritClaimed: false, adWatch: {} },
  lastSeenAt: null,
  lastSyncAt: null,
  offlineClaimedAt: 0,
  extra: {},
};

exports.main = async () => {
  const { OPENID } = cloud.getWXContext();
  const now = new Date();

  const users = db.collection('users');
  const profiles = db.collection('profiles');

  const existing = await users.where({ _openid: OPENID }).limit(1).get();
  const isNew = existing.data.length === 0;

  if (isNew) {
    await users.add({
      data: { _openid: OPENID, nickname: '', avatarUrl: '', createdAt: now, updatedAt: now },
    });
    await profiles.add({
      data: { _openid: OPENID, ...DEFAULT_PROFILE, lastSeenAt: now, lastSyncAt: now },
    });
  }

  const profileRes = await profiles.where({ _openid: OPENID }).limit(1).get();
  return {
    openid: OPENID,
    isNew,
    profile: profileRes.data[0] || null,
    serverTime: now.getTime(),
  };
};
