// 埋点:批量写云数据库 events 集合(30s 一批,失败丢弃不阻塞游戏)
import type { Game } from '../Game';

interface TrackEvent {
  event: string;
  ts: number;
  duration?: number;
  extra?: Record<string, any>;
}

export class Analytics {
  private game: Game;
  private queue: TrackEvent[] = [];
  private timer: any = null;
  private sessionStart = Date.now();

  constructor(game: Game) {
    this.game = game;
  }

  /** 启动定时上报(可在 onShow 重建) */
  init(): void {
    if (this.timer) return;
    this.sessionStart = Date.now();
    this.timer = setInterval(() => this.flush(), 30000);
  }

  track(event: string, extra?: Record<string, any>, duration?: number): void {
    this.queue.push({ event, ts: Date.now(), duration, extra });
    if (this.queue.length >= 20) this.flush();
  }

  /** 关键事件:启动/敲击时长/突破/功课/广告/分享 */
  sessionEnd(): void {
    this.track('session', undefined, Math.floor((Date.now() - this.sessionStart) / 1000));
    this.flush();
  }

  private async flush(): Promise<void> {
    if (!this.queue.length) return;
    if (this.game.sync.state !== 'online') {
      this.queue.length = 0; // 游客模式丢弃,避免积压
      return;
    }
    const batch = this.queue.splice(0, this.queue.length);
    try {
      const db = wx.cloud.database();
      // 逐条写入(events 集合权限:仅创建者可读写)
      await Promise.all(
        batch.map((e) =>
          db.collection('events').add({
            data: { ...e, _openid: undefined }, // _openid 由云端注入
          })
        )
      );
    } catch (e) {
      console.warn('[Analytics] flush 失败:', e);
    }
  }

  destroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
