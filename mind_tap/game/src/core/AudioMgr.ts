// 音频系统:敲击音 WebAudio 合成(零音频文件)+ BGM 流式播放
// iOS 注意:AudioContext 需首次 touchstart 后 resume 才可出声(首个点击前静默属正常)
import type { SkinConfig, BgmConfig } from '../data/configs';
import { BGMS } from '../data/configs';

export class AudioMgr {
  private ctx: any = null;
  private unlocked = false;
  private soundOn = true;

  private bgm: any = null; // InnerAudioContext 单例
  private bgmId = 'none';
  private bgmTargetVolume = 0.6;
  private fadeTimer: any = null;

  init(): void {
    try {
      this.ctx = wx.createWebAudioContext();
    } catch (e) {
      console.warn('[Audio] WebAudio unavailable:', e);
      this.ctx = null;
    }
  }

  setSoundOn(on: boolean): void {
    this.soundOn = on;
    if (!on) this.stopBgm();
  }

  /** 必须在首次 touchstart 中调用(iOS 激活策略) */
  unlock(): void {
    if (this.unlocked) return;
    this.unlocked = true;
    try {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    } catch (e) {
      /* ignore */
    }
  }

  // ---------- 敲击音:正弦 + 泛音,快速衰减包络 ----------
  playTap(skin: SkinConfig): void {
    if (!this.soundOn || !this.ctx || !this.unlocked) return;
    try {
      const t: number = this.ctx.currentTime;
      // 基频 ±3% 随机,听感更自然
      const jitter = 1 + (Math.random() * 0.06 - 0.03);
      this.tone(skin.freq * jitter, skin.decay, skin.wave, 0.85, t);
      // 泛音(高频短促,模拟木质脆感)
      this.tone(skin.freq * 2.76 * jitter, skin.decay * 0.45, 'sine', 0.22, t);
    } catch (e) {
      /* 音频失败不影响游戏 */
    }
  }

  private tone(freq: number, decay: number, wave: OscillatorType, vol: number, startAt: number): void {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(vol, startAt + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + decay);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(startAt);
    osc.stop(startAt + decay + 0.05);
  }

  /** 境界突破:上行琶音 */
  playBreakthrough(): void {
    if (!this.soundOn || !this.ctx || !this.unlocked) return;
    try {
      const t: number = this.ctx.currentTime;
      const notes = [261.6, 329.6, 392.0, 523.3]; // C E G C
      notes.forEach((f, i) => this.tone(f, 0.6, 'sine', 0.4, t + i * 0.12));
    } catch (e) {
      /* ignore */
    }
  }

  /** 连击里程碑:清脆一声 */
  playComboChime(): void {
    if (!this.soundOn || !this.ctx || !this.unlocked) return;
    try {
      const t: number = this.ctx.currentTime;
      this.tone(880, 0.35, 'sine', 0.3, t);
      this.tone(1320, 0.25, 'sine', 0.15, t + 0.05);
    } catch (e) {
      /* ignore */
    }
  }

  // ---------- BGM ----------
  playBgm(id: string): void {
    if (id === this.bgmId) return;
    this.bgmId = id;
    const cfg = BGMS.find((b: BgmConfig) => b.id === id);
    this.stopBgm();
    if (!cfg || !cfg.url || !this.soundOn) return;

    try {
      this.bgm = wx.createInnerAudioContext();
      this.bgm.src = cfg.url;
      this.bgm.loop = true;
      this.bgm.volume = 0;
      this.bgm.play();
      this.fadeTo(this.bgmTargetVolume, 500);
      this.bgm.onError((e: any) => {
        console.warn('[Audio] BGM error:', e);
      });
    } catch (e) {
      console.warn('[Audio] BGM play failed:', e);
      this.bgm = null;
    }
  }

  stopBgm(): void {
    if (this.bgm) {
      try {
        this.bgm.stop();
        this.bgm.destroy();
      } catch (e) {
        /* ignore */
      }
      this.bgm = null;
    }
    this.bgmId = 'none';
  }

  pauseBgm(): void {
    if (this.bgm) {
      try {
        this.bgm.pause();
      } catch (e) {
        /* ignore */
      }
    }
  }

  resumeBgm(): void {
    if (this.bgm && this.soundOn) {
      try {
        this.bgm.play();
      } catch (e) {
        /* ignore */
      }
    }
  }

  private fadeTo(target: number, ms: number): void {
    if (!this.bgm) return;
    if (this.fadeTimer) clearInterval(this.fadeTimer);
    const steps = Math.max(1, Math.floor(ms / 50));
    let i = 0;
    this.fadeTimer = setInterval(() => {
      i++;
      if (!this.bgm) {
        clearInterval(this.fadeTimer);
        this.fadeTimer = null;
        return;
      }
      this.bgm.volume = Math.min(1, (target * i) / steps);
      if (i >= steps) {
        clearInterval(this.fadeTimer);
        this.fadeTimer = null;
      }
    }, 50);
  }

  get currentBgmId(): string {
    return this.bgmId;
  }
}
