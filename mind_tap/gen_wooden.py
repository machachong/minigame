# 木鱼敲击音 5 个候选版本试听(纯标准库,模拟 WebAudio 合成逻辑)
# 物理模型:木质敲击瞬态(双层噪声) + 低频体共振 + 腔体基频 + 木质泛音
import wave, math, struct, random

SR = 44100
random.seed(42)  # 可复现

def write_wav(path, samples):
    peak = max(1e-6, max(abs(s) for s in samples))
    norm = 0.92 / peak  # 统一响度归一
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(b''.join(struct.pack('<h', max(-32767, min(32767, int(s * norm * 32767)))) for s in samples))

def silence(sec): return [0.0] * int(SR * sec)

def tone(freq, decay, vol, wave_type='sine'):
    dur = decay + 0.05
    n = int(SR * dur)
    out = []
    for i in range(n):
        t = i / SR
        env = min(1.0, t / 0.0015) * math.exp(-t / decay)
        ph = 2 * math.pi * freq * t
        s = math.sin(ph) if wave_type == 'sine' else (2/math.pi * math.asin(math.sin(ph)) if wave_type=='triangle' else (1 if math.sin(ph)>=0 else -1))
        out.append(vol * env * s)
    return out

def noise_hp(dur, vol, hp_freq):
    n = int(SR * dur)
    rc = 1.0 / (2 * math.pi * hp_freq); dt = 1.0 / SR; alpha = rc / (rc + dt)
    out = []; prev_x = 0.0; prev_y = 0.0
    for i in range(n):
        t = i / SR
        x = (random.random()*2-1) * (1 - t/dur)
        y = alpha * (prev_y + x - prev_x)  # 一阶高通
        prev_x = x; prev_y = y
        out.append(y * vol)
    return out

def noise_bp(dur, vol, center, q=1.2):
    n = int(SR * dur)
    w0 = 2*math.pi*center/SR; alpha = math.sin(w0)/(2*q)
    b0 = q*alpha; b1 = 0.0; b2 = -q*alpha
    a0 = 1+alpha; a1 = -2*math.cos(w0); a2 = 1-alpha
    b0/=a0; b2/=a0; a1/=a0; a2/=a0
    x1=x2=y1=y2=0.0; out=[]
    for i in range(n):
        t = i/SR
        x = (random.random()*2-1) * (1 - t/dur)
        y = b0*x + b2*x2 - a1*y1 - a2*y2
        x2=x1; x1=x; y2=y1; y1=y
        out.append(y*vol)
    return out

def mix(*parts):
    n = max(len(p) for p in parts)
    return [sum(p[i] if i < len(p) else 0.0 for p in parts) for i in range(n)]

def mulet_tap(freq, decay, cfg):
    # 通用木鱼合成:双层瞬态 + 低频体 + 基频 + 泛音
    parts = []
    # 瞬态:高频"哒"(接触) + 中频"咔"(木质冲击)
    parts.append(noise_hp(cfg['th_dur'], cfg['th_vol'], cfg['th_hp']))
    parts.append(noise_bp(cfg['bp_dur'], cfg['bp_vol'], cfg['bp_freq'], cfg['bp_q']))
    # 低频体共振(木鱼腔体的"咚")
    parts.append(tone(freq*cfg['body_mult'], decay*cfg['body_dmult'], cfg['body_vol'], 'sine'))
    # 主基频(腔体)
    parts.append(tone(freq * cfg.get('main_mult', 1), decay, cfg['main_vol'], cfg['main_wave']))
    # 木质泛音(非整数比)
    for mult, v, dmult in cfg['partials']:
        parts.append(tone(freq*mult, decay*dmult, v, 'sine'))
    return mix(*parts)

# 5 个候选版本参数(经典木色 base freq=480)
VERSIONS = {
    'A_轻快小木鱼': dict(th_dur=0.008, th_vol=0.30, th_hp=2200, bp_dur=0.016, bp_vol=0.20, bp_freq=900, bp_q=1.0,
                       body_mult=0.5, body_dmult=0.35, body_vol=0.18, main_vol=0.85, main_wave='sine',
                       partials=[(2.13,0.30,0.6),(3.36,0.14,0.45),(5.2,0.06,0.3)]),
    'B_标准木鱼':   dict(th_dur=0.010, th_vol=0.28, th_hp=1600, bp_dur=0.020, bp_vol=0.26, bp_freq=650, bp_q=1.1,
                       body_mult=0.45, body_dmult=0.5, body_vol=0.28, main_vol=0.90, main_wave='sine',
                       partials=[(2.01,0.28,0.55),(2.93,0.13,0.4),(4.12,0.05,0.28)]),
    'C_浑厚大木鱼': dict(th_dur=0.012, th_vol=0.30, th_hp=1100, bp_dur=0.024, bp_vol=0.32, bp_freq=420, bp_q=1.3,
                       body_mult=0.38, body_dmult=0.7, body_vol=0.42, main_vol=0.95, main_wave='triangle',
                       partials=[(1.99,0.30,0.65),(3.02,0.14,0.45),(4.5,0.06,0.3)]),
    'D_清脆实木':   dict(th_dur=0.006, th_vol=0.34, th_hp=2800, bp_dur=0.014, bp_vol=0.18, bp_freq=1100, bp_q=0.9,
                       decay_mult=0.9,
                       body_mult=0.55, body_dmult=0.4, body_vol=0.16, main_vol=0.82, main_wave='sine',
                       partials=[(2.42,0.34,0.5),(3.85,0.18,0.38),(6.1,0.09,0.26),(8.4,0.04,0.18)]),
    '咚咚木鱼':     dict(th_dur=0.007, th_vol=0.28, th_hp=2000, bp_dur=0.016, bp_vol=0.22, bp_freq=900, bp_q=1.1,
                       decay_mult=1.15,
                       body_mult=0.45, body_dmult=0.7, body_vol=0.40, main_mult=0.92, main_vol=0.85, main_wave='sine',
                       partials=[(1.83,0.28,0.6),(2.7,0.12,0.45),(4.2,0.05,0.3)]),
    'E_咚咚鼓感':   dict(th_dur=0.014, th_vol=0.26, th_hp=900, bp_dur=0.026, bp_vol=0.38, bp_freq=320, bp_q=1.5,
                       body_mult=0.32, body_dmult=0.9, body_vol=0.55, main_vol=0.9, main_wave='triangle',
                       partials=[(1.5,0.26,0.7),(2.5,0.12,0.5),(3.7,0.05,0.32)]),
}

BASE = 480
BASE_DECAY = 0.30

# 应用各版本衰减系数
def gen_track(cfg):
    track = []
    for i in range(4):
        jit = 1 + random.uniform(-0.02, 0.02)
        track += mulet_tap(BASE * jit, BASE_DECAY * cfg.get('decay_mult', 1), cfg)
        track += silence(0.4)
    return track
OUT = r'D:\工作代码\Project\mini_game\minigame\mind_tap\audio_wooden_'

for key, cfg in VERSIONS.items():
    write_wav(OUT + key + '.wav', gen_track(cfg))
    print('gen:', key)
print('done')
