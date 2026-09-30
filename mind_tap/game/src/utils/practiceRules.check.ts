import { COPY_DOTS, LESSONS, LISTEN_MS, ONCE_WAIT_MS, SETTLE_GAP_MS } from '../data/practice';
import {
  applyCopy,
  applyOnceTap,
  applySettle,
  copyCharOf,
  dayIndexOf,
  lessonOf,
  listenReady,
  notchCount,
  onceReady,
  practiceLabel,
  ringCount,
  ringPitch,
  ringRadiusRatio,
  verseOf,
} from './practiceRules';

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function selfCheckPracticeRules(): void {
  assert(ringCount(0) === 0 && ringCount(99) === 0, 'below 100 has no ring');
  assert(ringCount(100) === 1 && ringCount(499) === 1, 'first ring at 100');
  assert(ringCount(500) === 2 && ringCount(2000) === 3 && ringCount(8000) === 4, 'rings step');
  assert(ringCount(30000) === 5 && ringCount(999999) === 5, 'fifth ring caps');
  assert(ringPitch(0) === 1 && Math.abs(ringPitch(30000) - 0.9) < 1e-9, 'pitch caps at 0.9');
  assert(ringRadiusRatio(0) === 0.72 && Math.abs(ringRadiusRatio(4) - 0.28) < 1e-9, 'ring radii');
  assert(notchCount(0) === 0 && notchCount(3) === 3 && notchCount(9) === 8, 'notch cap 8');

  const origin = dayIndexOf('2026-01-01');
  assert(origin === 0 && lessonOf(origin).id === 'settle', 'epoch lesson is settle');
  assert(lessonOf(1).id === 'once' && lessonOf(2).id === 'listen' && lessonOf(3).id === 'copy', 'lesson cycle');
  assert(lessonOf(4).id === 'settle', 'lesson wraps');
  assert(verseOf(0) !== verseOf(4), 'same lesson next week changes verse');
  assert(copyCharOf(3) === '心' && copyCharOf(7) === '安', 'copy char follows copy days');

  const early = applySettle(0, 1000, 0);
  assert(early.countMerit && early.progress === 1 && early.lastAt === 1000, 'first settle tap counts');
  const fast = applySettle(1, 1000 + SETTLE_GAP_MS - 1, 1000);
  assert(!fast.countMerit && fast.progress === 1 && fast.hint === '太急', 'fast settle tap ignored');
  const slow = applySettle(7, 5000, 1000);
  assert(slow.done && slow.progress === 8, 'eighth settle tap finishes');

  assert(applyOnceTap().progress === 1, 'once tap arms the wait');
  assert(!onceReady(ONCE_WAIT_MS - 1) && onceReady(ONCE_WAIT_MS), 'once waits 1.2s');
  assert(!listenReady(LISTEN_MS - 1) && listenReady(LISTEN_MS), 'listen waits 20s');

  const miss = applyCopy(2, 0);
  assert(miss.shake && miss.progress === 2 && !miss.countMerit, 'wrong copy dot keeps progress');
  const hit = applyCopy(2, 2);
  assert(hit.countMerit && hit.progress === 3 && !hit.shake, 'next copy dot advances');
  const last = applyCopy(COPY_DOTS - 1, COPY_DOTS - 1);
  assert(last.done, 'sixth copy dot finishes');

  assert(practiceLabel(LESSONS[0], 0, false) === '今日 · 安住', 'idle label');
  assert(practiceLabel(LESSONS[0], 3, false) === '今日 · 安住 3/8', 'progress label');
  assert(practiceLabel(LESSONS[2], 5000, false) === '今日 · 静听 5/20', 'listen label uses seconds');
  assert(practiceLabel(LESSONS[0], 8, true) === '今日修行已圆满', 'done label');
}

selfCheckPracticeRules();
console.log('practice rules ok');
