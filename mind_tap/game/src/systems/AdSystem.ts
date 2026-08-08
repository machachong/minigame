// 激励视频广告:封装 + 频控 + 降级
// 所有广告入口均为主动领取按钮,绝不打断敲击
import { AD_UNIT_ID, AD_LIMITS, AD_DAILY_TOTAL, DEV_MOCK_ADS } from '../data/configs';
import { STRINGS } from '../data/strings';
import type { Game } from '../Game';

export type AdTag = 'merit_double' | 'offline_double' | 'skin_trial';

export class AdSystem {
  private game: Game;
  private ad: any = null;
  private loading = false;

  constructor(game: Game) {
    this.game = game;
    this.initAd();
  }

  private initAd(): void {
    if (DEV_MOCK_ADS || !AD_UNIT_ID) return; // 开发期 mock
    try {
      this.ad = wx.createRewardedVideoAd({ adUnitId: AD_UNIT_ID });
      this.ad.onError((e: any) => console.warn('[Ad] 错误:', e));
    } catch (e) {
      console.warn('[Ad] 初始化失败:', e);
    }
  }

  /** 当日剩余次数(含总频控) */
  remain(tag: AdTag): number {
    if (this.game.daily.adTotalToday() >= AD_DAILY_TOTAL) return 0;
    return this.game.daily.adRemain(tag, AD_LIMITS[tag] || 1);
  }

  /**
   * 展示激励视频
   * onReward 在完整看完后回调;取消/失败不扣次数
   */
  show(tag: AdTag, onReward: () => void): void {
    if (this.remain(tag) <= 0) {
      this.game.toast.show(STRINGS.adLimitReached);
      return;
    }

    // 开发期 mock:直接发奖励(提审前必须接真实广告)
    if (DEV_MOCK_ADS || !this.ad) {
      this.game.daily.adWatched(tag);
      onReward();
      return;
    }

    if (this.loading) {
      this.game.toast.show(STRINGS.adNotReady);
      return;
    }

    this.loading = true;
    const onClose = (res: any) => {
      this.ad.offClose(onClose);
      this.loading = false;
      if (res && res.isEnded) {
        this.game.daily.adWatched(tag);
        onReward();
      } else {
        this.game.toast.show('未看完,未获得奖励');
      }
    };
    this.ad.onClose(onClose);
    this.ad.show().catch(() => {
      this.ad.offClose(onClose);
      this.loading = false;
      // 加载失败重试一次
      this.ad
        .load()
        .then(() => this.ad.show())
        .catch((e: any) => {
          console.warn('[Ad] 展示失败:', e);
          this.game.toast.show(STRINGS.adNotReady);
        });
    });
  }
}
