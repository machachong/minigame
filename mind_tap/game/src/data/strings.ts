// 文案集中管理:偈语、连击文案、UI 文案
// 合规注意:禁用「随喜/供养/添灯油/祈福必应」等宗教献金暗示词

export const STRINGS = {
  title: '敲到成佛',
  subtitle: '一敲一世界,一念一菩提',

  guestTip: '离线禅修中,联网后自动同步',
  offlineTitle: '闭关收益',
  offlineBody: (hours: string, merit: number) => `闭关 ${hours} 小时\n静修功德 +${merit}`,
  offlineClaim: '领取',
  offlineDouble: '看视频翻倍',

  breakthroughTitle: '境界突破',
  breakthroughTap: '轻触继续',

  dailyTitle: '每日功课',
  dailyProgress: (taps: number, goal: number) => `今日功课 ${taps}/${goal}`,
  dailyClaim: '领取宝箱',
  dailyClaimed: '今日已领取',
  dailyGoalDone: '今日功课圆满',

  shareTitle: '我在《敲到成佛》修行,快来一起攒功德!',
  shareBtn: '分享 +100',

  navCultivate: '修行',
  navDaily: '功课',
  navRank: '排行',
  navSettings: '设置',

  adMeritDouble: '静心加成',
  adOfflineDouble: '离线翻倍',
  adLimitReached: '明日再来',
  adNotReady: '广告加载中,稍后再试',

  nextLevelPrefix: '距',
  nextLevelSuffix: '还差',
  meritUnit: '功德',

  confirmClear: '清除本地数据将丢失未同步进度,确定吗?',

  tapSoundLabel: '木鱼音色',
  tapSoundResonant: '腔体共鸣',
  tapSoundWooden: '木质敲击',
  tapSoundCrisp: '清脆实木',
  tapSoundThump: '咚咚木鱼',
};

// 连击里程碑文案
export const COMBO_TEXTS: Record<number, string> = {
  10: '心静如水',
  50: '法喜充满',
  100: '功德无量',
  300: '渐入佳境',
  500: '心无挂碍',
  1000: '明心见性',
};

// 每日一偈池
export const VERSES: string[] = [
  '菩提本无树,明镜亦非台',
  '一切有为法,如梦幻泡影',
  '应无所住,而生其心',
  '色即是空,空即是色',
  '一念放下,万般自在',
  '心若不动,风又奈何',
  '浮生若茶,苦后方知甘甜',
  '春有百花秋有月,夏有凉风冬有雪',
  '若无闲事挂心头,便是人间好时节',
  '千山鸟飞绝,万径人踪灭',
  '行到水穷处,坐看云起时',
  '本来无一物,何处惹尘埃',
  '竹影扫阶尘不动,月穿潭底水无痕',
  '不是风动,不是幡动,仁者心动',
  '万古长空,一朝风月',
  '溪声便是广长舌,山色无非清净身',
  '人生如逆旅,我亦是行人',
  '此心安处是吾乡',
  '问渠那得清如许,为有源头活水来',
  '不畏浮云遮望眼,自缘身在最高层',
];

// 新手引导
export const TUTORIAL_STEPS = [
  '轻触木鱼,开始修行',
  '每敲一下,功德 +1',
  '点击「修行」查看境界',
];
