// 每日功课领奖 + 分享得功德(每日一次,防刷)
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const DAILY_GOAL = 100;
const REWARDS = [66, 88, 108, 168];
const SHARE_REWARD = 100;

function todayKey() {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { type = 'quest' } = event; // 'quest' | 'share'
  const today = todayKey();

  const profiles = db.collection('profiles');
  const res = await profiles.where({ _openid: OPENID }).limit(1).get();
  if (res.data.length === 0) return { ok: false, err: 'no_profile' };

  const doc = res.data[0];
  const daily = doc.daily || {};

  // 分享得功德
  if (type === 'share') {
    if (daily.dateKey === today && daily.shareMeritClaimed) {
      return { ok: false, err: 'already_claimed' };
    }
    await profiles.doc(doc._id).update({
      data: {
        'daily.dateKey': today,
        'daily.shareMeritClaimed': true,
        merit: _.inc(SHARE_REWARD),
      },
    });
    return { ok: true, reward: SHARE_REWARD };
  }

  // 每日功课宝箱
  if (daily.dateKey === today && daily.claimed) {
    return { ok: false, err: 'already_claimed' };
  }
  if ((daily.taps || 0) < DAILY_GOAL && daily.dateKey === today) {
    return { ok: false, err: 'not_enough_taps' };
  }

  // 连续天数:昨天完成过 → +1;否则重置为 1
  const yesterday = new Date(Date.now() + 8 * 3600 * 1000 - 86400000).toISOString().slice(0, 10);
  const streak = daily.dateKey === yesterday && daily.claimed ? (daily.streak || 0) + 1 : 1;

  const reward = REWARDS[Math.floor(Math.random() * REWARDS.length)];

  await profiles.doc(doc._id).update({
    data: {
      'daily.dateKey': today,
      'daily.claimed': true,
      'daily.streak': streak,
      merit: _.inc(reward),
    },
  });

  return { ok: true, reward, streak };
};
