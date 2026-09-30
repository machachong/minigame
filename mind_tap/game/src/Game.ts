// 游戏组合根:装配所有系统与场景,接管生命周期
import { Renderer } from './core/Renderer';
import { GameLoop } from './core/GameLoop';
import { SceneManager } from './core/Scene';
import { Ticker } from './core/Ticker';
import { AudioMgr } from './core/AudioMgr';
import { SaveManager, Storage } from './core/Storage';
import { Toast } from './ui/Toast';
import { bus, Events } from './core/EventBus';

import { SaveData } from './data/types';
import { FEEL } from './data/configs';
import { MeritSystem } from './systems/MeritSystem';
import { ComboSystem } from './systems/ComboSystem';
import { LevelSystem } from './systems/LevelSystem';
import { DailySystem } from './systems/DailySystem';
import { SkinSystem } from './systems/SkinSystem';
import { SyncService } from './systems/SyncService';
import { ShareSystem } from './systems/ShareSystem';
import { AdSystem } from './systems/AdSystem';
import { Analytics } from './systems/Analytics';
import { GongfaSystem } from './systems/GongfaSystem';
import { EventSystem } from './systems/EventSystem';
import { RebirthSystem } from './systems/RebirthSystem';
import { VERSES } from './data/strings';
import { ringPitch } from './utils/practiceRules';

import { BootScene } from './scenes/BootScene';
import { HomeScene } from './scenes/HomeScene';
import { CultivateScene } from './scenes/CultivateScene';
import { DailyScene } from './scenes/DailyScene';
import { RankScene } from './scenes/RankScene';
import { SettingScene } from './scenes/SettingScene';

export class Game {
  renderer = new Renderer();
  loop = new GameLoop();
  scenes = new SceneManager();
  ticker = new Ticker();
  audio = new AudioMgr();
  toast = new Toast();
  saveManager!: SaveManager;

  // 系统
  merit!: MeritSystem;
  combo!: ComboSystem;
  levelSystem!: LevelSystem;
  daily!: DailySystem;
  skin!: SkinSystem;
  sync!: SyncService;
  share!: ShareSystem;
  ad!: AdSystem;
  analytics!: Analytics;
  gongfa!: GongfaSystem;
  events!: EventSystem;
  rebirth!: RebirthSystem;

  /** 当日偈语(启动时抽取,跨场景一致) */
  dailyVerse = '';

  readonly bootAt = Date.now();

  private firstFrameRendered = false;

  get save(): SaveData {
    return this.saveManager.save;
  }

  async start(): Promise<void> {
    // 1. 渲染器
    this.renderer.init();
    this.loop.lowFpsMode = this.renderer.lowEnd;

    // 2. 存档
    this.saveManager = new SaveManager(Storage.load());

    // 3. 音频(需等待首次触摸激活)
    this.audio.init();
    this.audio.setSoundOn(this.save.soundOn);
    this.audio.setTapSound(
      this.save.tapSound === 'wooden' ? 'wooden'
        : this.save.tapSound === 'crisp' ? 'crisp'
        : this.save.tapSound === 'thump' ? 'thump'
        : 'resonant'
    );
    this.audio.setAmbience(!!this.save.extra.rainOn, !!this.save.extra.birdOn);

    // 4. 系统装配
    this.combo = new ComboSystem();
    this.levelSystem = new LevelSystem(this);
    this.merit = new MeritSystem(this);
    this.daily = new DailySystem(this);
    this.skin = new SkinSystem(this);
    this.sync = new SyncService(this);
    this.share = new ShareSystem(this);
    this.ad = new AdSystem(this);
    this.analytics = new Analytics(this);
    this.gongfa = new GongfaSystem(this);
    this.events = new EventSystem(this);
    this.rebirth = new RebirthSystem(this);
    this.analytics.init();
    this.levelSystem.checkLevelUp();
    this.gongfa.refresh();

    // 5. 每日重置 + 偈语
    this.daily.rolloverIfNeeded();
    this.dailyVerse = VERSES[new Date().getDate() % VERSES.length];

    // 6. 输入
    this.bindInput();

    // 7. 生命周期
    this.bindLifecycle();

    // 8. 云登录(异步,不阻塞启动)
    this.sync.init();

    // 9. 进入启动场景
    this.scenes.replace(new BootScene(this));

    // 10. 主循环
    this.loop.start((dt) => this.frame(dt));

    this.analytics.track('launch', {
      level: this.levelSystem.current.name,
      merit: Math.floor(this.save.merit),
    });
  }

  private frame(dt: number): void {
    this.audio.setRingScale(ringPitch(this.save.totalTaps));
    this.ticker.update(dt);
    this.combo.update(dt);
    this.events.update(dt);
    this.saveManager.tick();
    this.scenes.update(dt);

    this.renderer.clear();
    this.scenes.render(this.renderer.ctx);
    this.toast.render(this.renderer.ctx, this.renderer.width, this.renderer.height);

    if (!this.firstFrameRendered) {
      this.firstFrameRendered = true;
      console.log('[Game] first frame rendered');
    }
  }

  // ---------- 输入:单指敲击 + 触摸合并(80ms 防抖) ----------
  private lastTapAt = 0;
  private activeTouchId: number | null = null;

  private bindInput(): void {
    wx.onTouchStart((e: any) => {
      const t = e.touches[0];
      if (!t) return;
      // 多点触控:只跟踪第一根手指
      if (this.activeTouchId !== null) return;
      this.activeTouchId = t.identifier ?? 0;

      this.audio.unlock(); // iOS 激活音频

      const now = Date.now();
      const x = t.clientX;
      const y = t.clientY;

      // 主界面防抖动。听经要精确连点,不走这道合并。
      if (!this.scenes.top?.preciseTouch && now - this.lastTapAt < FEEL.tapMergeMs) return;
      this.lastTapAt = now;

      this.scenes.top?.onTouchStart(x, y);
    });

    wx.onTouchMove((e: any) => {
      const t = e.touches[0];
      if (!t) return;
      this.scenes.top?.onTouchMove(t.clientX, t.clientY);
    });

    const onEnd = (e: any) => {
      const t = (e.changedTouches && e.changedTouches[0]) || null;
      this.activeTouchId = null;
      if (t) this.scenes.top?.onTouchEnd(t.clientX, t.clientY);
    };
    wx.onTouchEnd(onEnd);
    wx.onTouchCancel(onEnd);
  }

  // ---------- 生命周期 ----------
  private bindLifecycle(): void {
    wx.onHide(() => {
      this.loop.pause();
      this.audio.pauseBgm();
      this.audio.pauseAmbience();
      this.saveManager.flush();          // 强写本地
      this.analytics.sessionEnd();       // 结束会话埋点
      this.analytics.destroy();          // 清理定时器
      this.sync.flush(true);             // 尽力同步,并刷新离开时间
    });

    wx.onShow(() => {
      this.loop.resume();
      this.audio.resumeBgm();
      this.audio.resumeAmbience();
      this.analytics.init();             // 重建埋点定时器
      this.daily.rolloverIfNeeded();
      // 回到前台检查离线收益(罗汉解锁后)
      bus.emit(Events.OFFLINE_REWARD, { check: true });
    });

    // 屏幕常亮(修行时)
    try {
      wx.setKeepScreenOn({ keepScreenOn: true });
    } catch (e) {
      /* ignore */
    }
  }
}
