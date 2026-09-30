// 木鱼年轮与今日修行。年轮不加成功德，短课奖励固定 +20。

export type LessonId = 'settle' | 'once' | 'listen' | 'copy';

export interface LessonDef {
  id: LessonId;
  name: string;
  goal: number;
}

export const RING_TAPS = [100, 500, 2000, 8000, 30000];
export const RING_SLOTS = 5;
export const NOTCH_CAP = 8;
export const SETTLE_GAP_MS = 400;
export const SETTLE_GOAL = 8;
export const ONCE_WAIT_MS = 1200;
export const LISTEN_MS = 20000;
export const COPY_DOTS = 6;
export const COPY_HIT_R = 28;
export const PRACTICE_REWARD = 20;
export const PRACTICE_STREAK_GLOW = 7;

export const LESSONS: LessonDef[] = [
  { id: 'settle', name: '安住', goal: SETTLE_GOAL },
  { id: 'once', name: '一击', goal: 1 },
  { id: 'listen', name: '静听', goal: 20 },
  { id: 'copy', name: '抄经', goal: COPY_DOTS },
];

export const COPY_CHARS = ['心', '安', '定', '静'];

export const VERSES: Record<LessonId, string[]> = {
  settle: [
    '慢一点，这一下才算数',
    '间隔里也有木头的声音',
    '不必赶，鱼还在',
    '手松一点，再敲',
    '八下安住，刚刚好',
    '太急的一下，就让它过去',
    '今天的节奏，由你放慢',
  ],
  once: [
    '一击之后，看涟漪走完',
    '停住，比再敲更难',
    '这一下已经够了',
    '等它散尽，再离开',
    '木鱼记得刚才那一声',
    '手放下，光还在散',
    '只留一下，其余都是余韵',
  ],
  listen: [
    '二十秒，只听不敲',
    '雨声也是功课',
    '手放下的时候，房间安静了',
    '不必填满每一秒',
    '静听本身就是一下',
    '木鱼先歇着',
    '回来的时候，它还在',
  ],
  copy: [
    '点对了，字才留下',
    '六下，沿着弧走',
    '点错了也不必重来',
    '顺着点，不要跳',
    '这一笔很短',
    '点完，字就留在鱼上',
    '慢慢点，鱼认得这个顺序',
  ],
};
