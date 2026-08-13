# 生成木鱼敲击音对比试听:旧合成 vs 新合成(纯标准库)
import wave, math, struct, random

SR = 44100

def write_wav(path, samples):
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(b''.join(struct.pack('<h', max(-32767, min(32767, int(s * 32767)))) for s in samples))

def silence(sec):
    return [0.0] * int(SR * sec)

def tone(freq, decay, vol, dur=None):
    dur = dur or decay + 0.05
    n = int(SR * dur)
    out = []
    for i in range(n):
        t = i / SR
        env = min(1.0, t / 0.006) * math.exp(-t / decay)  # attack + 指数衰减
        out.append(vol * env * math.sin(2 * math.pi * freq * t))
    return out

def old_tap(freq=180, decay=0.28):
    # 旧:基频正弦 + 单泛音(2.76x)
    a = tone(freq, decay, 0.85)
    b = tone(freq * 2.76, decay * 0.45, 0.22)
    n = max(len(a), len(b))
    a += [0.0] * (n - len(a)); b += [0.0] * (n - len(b))
    return [x + y for x, y in zip(a, b)]

def noise_burst(dur=0.018, vol=0.22, hp=1000):
    n = int(SR * dur)
    out = []
    # 简单一阶高通(近似)
    prev = 0.0
    rc = 1.0 / (2 * math.pi * hp)
    dt = 1.0 / SR
    alpha = rc / (rc + dt)
    for i in range(n):
        t = i / SR
        w = (random.random() * 2 - 1) * (1 - t / dur)
        prev = alpha * (prev + w - (w if i == 0 else 0))
        out.append(prev * vol)
    return out

def new_tap(freq=480, decay=0.32):
    # 腔体共振音色:槌击噪声瞬态 + 基频 + 非整数比泛音(木质腔体)
    th = noise_burst()
    parts = [th]
    for mult, v, dmult in [(1, 0.9, 1), (2.01, 0.32, 0.7), (2.93, 0.16, 0.5), (4.12, 0.07, 0.35), (5.8, 0.04, 0.22)]:
        parts.append(tone(freq * mult, decay * dmult, v))
    n = max(len(p) for p in parts)
    return [sum(p[i] if i < len(p) else 0.0 for p in parts) for i in range(n)]

def wooden_tap(freq=480, decay=0.32):
    # 木质敲击音色:强瞬态 + 三角波低基频 + 少量泛音(更干更脆)
    th = noise_burst(dur=0.014, vol=0.32, hp=1400)
    f = freq * 0.72
    d = decay * 0.9
    parts = [th, tone(f, d, 0.95), tone(f * 2.02, d * 0.6, 0.24), tone(f * 3.05, d * 0.38, 0.1)]
    n = max(len(p) for p in parts)
    return [sum(p[i] if i < len(p) else 0.0 for p in parts) for i in range(n)]

# 旧版:经典木色 180Hz 连敲 4 次
old = []
for i in range(4):
    old += old_tap(180, 0.28)
    old += silence(0.35)
write_wav(r'D:\工作代码\Project\mini_game\minigame\mind_tap\audio_preview_old.wav', old)

# 新版:经典木色 480Hz 连敲 4 次
new = []
for i in range(4):
    new += new_tap(480, 0.32)
    new += silence(0.35)
write_wav(r'D:\工作代码\Project\mini_game\minigame\mind_tap\audio_preview_new.wav', new)

# 木质敲击音色:经典木色连敲 4 次
wooden = []
for i in range(4):
    wooden += wooden_tap(480, 0.32)
    wooden += silence(0.35)
write_wav(r'D:\工作代码\Project\mini_game\minigame\mind_tap\audio_preview_wooden.wav', wooden)

print('done')
