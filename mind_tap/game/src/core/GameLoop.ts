// 主循环:RAF 驱动、切后台停帧、低端机降频
export type FrameCallback = (dtMs: number) => void;

export class GameLoop {
  private running = false;
  private lastTime = 0;
  private cb: FrameCallback | null = null;
  private accumulator = 0;
  /** 低端机 30fps 运行 */
  lowFpsMode = false;

  start(cb: FrameCallback): void {
    this.cb = cb;
    this.running = true;
    this.lastTime = Date.now();
    requestAnimationFrame(this.tick);
  }

  private tick = (): void => {
    if (!this.running) return;
    const now = Date.now();
    let dt = now - this.lastTime;
    this.lastTime = now;
    if (dt > 100) dt = 100; // 切后台回来避免大步长跳变

    if (this.lowFpsMode) {
      // 30fps:攒够 33ms 才跑一帧
      this.accumulator += dt;
      if (this.accumulator >= 33) {
        this.cb?.(this.accumulator);
        this.accumulator = 0;
      }
    } else {
      this.cb?.(dt);
    }
    requestAnimationFrame(this.tick);
  };

  pause(): void {
    this.running = false;
  }

  resume(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = Date.now();
    requestAnimationFrame(this.tick);
  }
}
