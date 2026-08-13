// 音频系统:敲击音 WebAudio 合成(零音频文件)+ BGM 流式播放
// iOS 注意:AudioContext 需首次 touchstart 后 resume 才可出声(首个点击前静默属正常)
import type { SkinConfig, BgmConfig } from '../data/configs';
import { BGMS } from '../data/configs';

export type TapSoundStyle = 'resonant' | 'wooden' | 'crisp' | 'thump';

export class AudioMgr {
  private ctx: any = null;
  private unlocked = false;
  private soundOn = true;
  private tapSound: TapSoundStyle = 'resonant';

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

  /** 切换木鱼音色:'resonant'(腔体共振)| 'wooden'(木质敲击)| 'crisp'(清脆实木)| 'thump'(咚咚木鱼) */
  setTapSound(style: TapSoundStyle): void {
    this.tapSound = style;
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

  // ---------- 敲击音:真实木鱼合成 ----------
  // 四种音色:
  //   resonant = 腔体共振(基频+非整数比泛音,圆润有共鸣)
  //   wooden   = 木质敲击(低基频三角波+强瞬态,短促干脆的木质感)
  //   crisp    = 清脆实木(极高频瞬态+多层高频泛音,明亮干脆带"啪"感)
  //   thump    = 咚咚木鱼(低频腔体+中低频泛音,去金属感,浑厚木鱼"咚")
  playTap(skin: SkinConfig): void {
    if (this.tapSound === 'wooden') this.playTapWooden(skin);
    else if (this.tapSound === 'crisp') this.playTapCrisp(skin);
    else if (this.tapSound === 'thump') this.playTapThump(skin);
    else this.playTapResonant(skin);
  }

  /** 腔体共振音色(默认):槌击噪声瞬态 + 多泛音腔体共振 */
  private playTapResonant(skin: SkinConfig): void {
    if (!this.soundOn || !this.ctx || !this.unlocked) return;
    try {
      const t: number = this.ctx.currentTime;
      // 基频 ±2.5% 随机,听感更自然
      const jitter = 1 + (Math.random() * 0.05 - 0.025);
      const f = skin.freq * jitter;
      const d = skin.decay;

      // 1) 槌击瞬态:短噪声(木质"哒"的接触声)
      this.tapThump(t, 0.22, 0.018, 1000);

      // 2) 腔体共振:基频 + 非整数比泛音(木质腔体特征,泛音越高衰减越快)
      this.tapTone(f, d, 0.9, t, 'sine');        // 基频
      this.tapTone(f * 2.01, d * 0.7, 0.32, t, 'sine'); // ~2 倍(木质非严格整数比)
      this.tapTone(f * 2.93, d * 0.5, 0.16, t, 'sine'); // ~3 倍
      this.tapTone(f * 4.12, d * 0.35, 0.07, t, 'sine');// ~4 倍
      this.tapTone(f * 5.8, d * 0.22, 0.04, t, 'sine'); // 高频木质泛音(脆)
    } catch (e) {
      /* 音频失败不影响游戏 */
    }
  }

  /** 木质敲击音色:低基频三角波 + 强瞬态,更干更脆的木鱼敲击感 */
  private playTapWooden(skin: SkinConfig): void {
    if (!this.soundOn || !this.ctx || !this.unlocked) return;
    try {
      const t: number = this.ctx.currentTime;
      const jitter = 1 + (Math.random() * 0.06 - 0.03);
      // 木质音色基频更低(≈0.72×),声音更"实"
      const f = skin.freq * 0.72 * jitter;
      const d = skin.decay * 0.9;

      // 1) 强槌击瞬态(木质敲击的接触冲击更明显)
      this.tapThump(t, 0.32, 0.014, 1400);

      // 2) 木质腔体:三角波基频(更丰富的低次谐波,木质味)+ 少量泛音
      this.tapTone(f, d, 0.95, t, 'triangle');
      this.tapTone(f * 2.02, d * 0.6, 0.24, t, 'sine');
      this.tapTone(f * 3.05, d * 0.38, 0.1, t, 'sine');
    } catch (e) {
      /* 音频失败不影响游戏 */
    }
  }

  /** 清脆实木音色:极高频瞬态 + 多层高频泛音,明亮干脆带"啪"感(原始 D 版) */
  private playTapCrisp(skin: SkinConfig): void {
    if (!this.soundOn || !this.ctx || !this.unlocked) return;
    try {
      const t: number = this.ctx.currentTime;
      const jitter = 1 + (Math.random() * 0.05 - 0.025);
      const f = skin.freq * jitter;
      const d = skin.decay * 0.9;

      // 1) 极高频瞬态(硬木接触"啪")+ 中频冲击(带通"咔")
      this.tapThump(t, 0.34, 0.006, 2800);
      this.tapThumpBand(t, 0.18, 0.014, 1100);

      // 2) 低频体共振 + 基频 + 多层高频泛音(更亮)
      this.tapTone(f * 0.55, d * 0.4, 0.16, t, 'sine');
      this.tapTone(f, d, 0.82, t, 'sine');
      this.tapTone(f * 2.42, d * 0.5, 0.34, t, 'sine');
      this.tapTone(f * 3.85, d * 0.38, 0.18, t, 'sine');
      this.tapTone(f * 6.1, d * 0.26, 0.09, t, 'sine');
      this.tapTone(f * 8.4, d * 0.18, 0.04, t, 'sine');
    } catch (e) {
      /* 音频失败不影响游戏 */
    }
  }

  /** 咚咚木鱼音色:低频腔体 + 中低频泛音,去金属感的浑厚木鱼"咚" */
  private playTapThump(skin: SkinConfig): void {
    if (!this.soundOn || !this.ctx || !this.unlocked) return;
    try {
      const t: number = this.ctx.currentTime;
      const jitter = 1 + (Math.random() * 0.05 - 0.025);
      const f = skin.freq * jitter;
      const d = skin.decay * 1.15; // 余韵更长

      // 1) 瞬态:中频为主(木质"哒",避免过高频的金属"叮")
      this.tapThump(t, 0.28, 0.007, 2000);
      this.tapThumpBand(t, 0.22, 0.016, 900);

      // 2) 低频腔体"咚" + 基频(稍低) + 中低频泛音(去高频金属泛音)
      this.tapTone(f * 0.45, d * 0.7, 0.4, t, 'sine');   // 低频体共振(更厚更"咚")
      this.tapTone(f * 0.92, d, 0.85, t, 'sine');        // 基频稍低,更闷更木
      this.tapTone(f * 1.83, d * 0.6, 0.28, t, 'sine');  // 中频腔体共鸣
      this.tapTone(f * 2.7, d * 0.45, 0.12, t, 'sine');
      this.tapTone(f * 4.2, d * 0.3, 0.05, t, 'sine');   // 只留少量高频泛音
    } catch (e) {
      /* 音频失败不影响游戏 */
    }
  }

  /** 带通瞬态噪声(中频木质冲击"咔") */
  private tapThumpBand(startAt: number, vol: number, dur: number, center: number): void {
    try {
      const sr = this.ctx.sampleRate || 44100;
      const len = Math.floor(sr * dur);
      const buffer = this.ctx.createBuffer(1, len, sr);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = center;
      bp.Q.value = 1.2;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(vol, startAt);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + dur);
      noise.connect(bp);
      bp.connect(gain);
      gain.connect(this.ctx.destination);
      noise.start(startAt);
      noise.stop(startAt + dur + 0.005);
    } catch (e) {
      /* 瞬态噪声失败不影响主音 */
    }
  }

  /** 腔体共振单音(指数衰减包络,attack 极短) */
  private tapTone(freq: number, decay: number, vol: number, startAt: number, wave: OscillatorType = 'sine'): void {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(vol, startAt + 0.002); // 2ms 起音(木质硬击)
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + decay);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(startAt);
    osc.stop(startAt + decay + 0.05);
  }

  /** 槌击瞬态噪声(高通滤波保留高频接触声) */
  private tapThump(startAt: number, vol: number, dur: number, hpFreq: number): void {
    try {
      const sr = this.ctx.sampleRate || 44100;
      const len = Math.floor(sr * dur);
      const buffer = this.ctx.createBuffer(1, len, sr);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / len); // 白噪声,线性衰减
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = hpFreq;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(vol, startAt);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + dur);
      noise.connect(hp);
      hp.connect(gain);
      gain.connect(this.ctx.destination);
      noise.start(startAt);
      noise.stop(startAt + dur + 0.005);
    } catch (e) {
      /* 瞬态噪声失败不影响主音 */
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
