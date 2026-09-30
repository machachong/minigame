// 每日功课领奖 + 分享得功德(每日一次,防刷)
// 防刷:功课 taps 只能由 syncProfile 累计(服务端权威),客户端不可直接传值绕过
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const DAILY_GOAL = 100;
const REWARDS = [66, 88, 108, 168];
const SHARE_REWARD = 100;
const AD_LIMITS = { merit_double: 3, offline_double: 1, skin_trial: 1 };
const AD_DAILY_TOTAL = 6;

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

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { type = 'quest' } = event; // 'quest' | 'share'
  const today = todayKey();

  const profiles = db.collection('profiles');
  const res = await profiles.where({ _openid: OPENID }).limit(1).get();
  if (res.data.length === 0) return { ok: false, err: 'no_profile' };

  const doc = res.data[0];

  if (type === 'ad') {
    const tag = event.tag;
    if (!AD_LIMITS[tag]) return { ok: false, err: 'bad_tag' };
    const daily = rollServerDaily(doc.daily, today, 0);
    const watch = { ...(daily.adWatch || {}) };
    const total = Object.keys(watch).reduce((sum, key) => sum + (watch[key] || 0), 0);
    if (total >= AD_DAILY_TOTAL || (watch[tag] || 0) >= AD_LIMITS[tag]) {
      return { ok: false, err: 'limit' };
    }
    watch[tag] = (watch[tag] || 0) + 1;
    daily.adWatch = watch;
    await profiles.doc(doc._id).update({ data: { daily } });
    return { ok: true };
  }

  // 分享得功德。先按当天滚动,避免昨天的已领标记带到今天
  if (type === 'share') {
    const daily = rollServerDaily(doc.daily, today, 0);
    if (daily.shareMeritClaimed) return { ok: false, err: 'already_claimed' };
    daily.shareMeritClaimed = true;
    await profiles.doc(doc._id).update({
      data: {
        daily,
        merit: _.inc(SHARE_REWARD),
      },
    });
    return { ok: true, reward: SHARE_REWARD };
  }

  // 每日功课宝箱:taps 以 syncProfile 写入的当天计数为准
  const daily = doc.daily || {};
  if (daily.dateKey === today && daily.claimed) {
    return { ok: false, err: 'already_claimed' };
  }
  if (daily.dateKey !== today || (daily.taps || 0) < DAILY_GOAL) {
    return { ok: false, err: 'not_enough_taps' };
  }

  // 连续天数已在跨天时裁过,这里只 +1
  const streak = (daily.streak || 0) + 1;
  const reward = REWARDS[Math.floor(Math.random() * REWARDS.length)];

  await profiles.doc(doc._id).update({
    data: {
      daily: {
        dateKey: today,
        taps: daily.taps || 0,
        claimed: true,
        streak,
        shareMeritClaimed: !!daily.shareMeritClaimed,
        adWatch: daily.adWatch || {},
        practiceProgress: daily.practiceProgress || 0,
        practiceDone: !!daily.practiceDone,
        practiceStreak: daily.practiceStreak || 0,
      },
      merit: _.inc(reward),
    },
  });

  return { ok: true, reward, streak };
};
