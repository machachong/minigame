// 缓动函数 + 补间动画驱动
export const Easing = {
  linear: (t: number) => t,
  easeOutQuad: (t: number) => t * (2 - t),
  easeInQuad: (t: number) => t * t,
  easeOutCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  easeOutBack: (t: number) => {
    const c = 1.70158;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  },
  easeInOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
};

interface Tween {
  duration: number;
  elapsed: number;
  update: (t: number) => void;
  complete?: () => void;
  easing: (t: number) => number;
  done: boolean;
}

interface Delayed {
  at: number;
  cb: () => void;
  done: boolean;
}

// 每帧由 GameLoop 驱动;管理所有 UI 动画
export class Ticker {
  private tweens: Tween[] = [];
  private delayed: Delayed[] = [];
  private now = 0;

  /** duration 毫秒内,update 收到缓动后的 t(0→1) */
  to(
    duration: number,
    update: (t: number) => void,
    opts?: { easing?: (t: number) => number; complete?: () => void }
  ): void {
    this.tweens.push({
      duration: Math.max(1, duration),
      elapsed: 0,
      update,
      complete: opts?.complete,
      easing: opts?.easing ?? Easing.easeOutQuad,
      done: false,
    });
  }

  /** 延迟执行(毫秒) */
  delay(ms: number, cb: () => void): void {
    this.delayed.push({ at: this.now + ms, cb, done: false });
  }

  update(dtMs: number): void {
    this.now += dtMs;

    for (const tw of this.tweens) {
      if (tw.done) continue;
      tw.elapsed += dtMs;
      const t = Math.min(1, tw.elapsed / tw.duration);
      tw.update(tw.easing(t));
      if (t >= 1) {
        tw.done = true;
        try {
          tw.complete?.();
        } catch (e) {
          console.error('[Ticker] complete error:', e);
        }
      }
    }
    if (this.tweens.length > 64) this.tweens = this.tweens.filter((t) => !t.done);
    else this.tweens = this.tweens.filter((t) => !t.done);

    for (const d of this.delayed) {
      if (!d.done && this.now >= d.at) {
        d.done = true;
        try {
          d.cb();
        } catch (e) {
          console.error('[Ticker] delay cb error:', e);
        }
      }
    }
    this.delayed = this.delayed.filter((d) => !d.done);
  }
}
