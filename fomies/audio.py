"""Synthesizes the 60 s soundtrack (120 BPM "office ska" in D minor) in sync with the hits in src/main.js.
Usage: python3 audio.py  -> soundtrack.wav
"""
import numpy as np
from scipy.signal import butter, sosfilt
from scipy.io import wavfile

SR = 44100
DUR = 60.0
N = int(SR * DUR)
B0, BEAT = 6.5, 0.5          # beat grid used by the visuals
rng = np.random.default_rng(4821)
FX = np.zeros((2, N))        # sound effects bus
MU = np.zeros((2, N))        # music bus (gets the tape-stop)


def R(i):  # same hash as the JS side, so pickle landings line up
    s = np.sin(i * 127.1 + 311.7) * 43758.5453
    return s - np.floor(s)


def ta(n):
    return np.arange(n) / SR


def filt(x, kind, f, order=2):
    return sosfilt(butter(order, f, btype=kind, fs=SR, output='sos'), x)


def add(bus, sig, at, gain=1.0, pan=0.0):
    i = int(round(at * SR))
    if i >= N:
        return
    if i < 0:
        sig = sig[-i:]
        i = 0
    s = sig[: N - i] * gain
    bus[0, i:i + len(s)] += s * np.sqrt(0.5 * (1 - pan))
    bus[1, i:i + len(s)] += s * np.sqrt(0.5 * (1 + pan))


def hz(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def env_ad(n, a, d):
    t = ta(n)
    return np.minimum(1, t / max(a, 1e-4)) * np.exp(-t * d)


# ---------------- instruments ----------------
def kick(g=1.0):
    t = ta(int(.4 * SR))
    f = 48 + 120 * np.exp(-t * 32)
    return np.tanh(2.4 * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 8)) * .85 * g


def snare():
    n = int(.25 * SR); t = ta(n)
    nz = filt(rng.standard_normal(n), 'band', [1200, 7000]) * np.exp(-t * 20)
    body = np.sin(2 * np.pi * 185 * t) * np.exp(-t * 28)
    return nz * .55 + body * .35


def hat(open_=False):
    n = int((.16 if open_ else .045) * SR); t = ta(n)
    return filt(rng.standard_normal(n), 'high', 8000) * np.exp(-t * (18 if open_ else 80)) * .2


def bass(f, dur):
    n = int(dur * SR); t = ta(n)
    x = np.sin(2 * np.pi * f * t) + .45 * np.sin(4 * np.pi * f * t) + .15 * np.sign(np.sin(2 * np.pi * f * t))
    return np.tanh(1.4 * x) * env_ad(n, .004, 7) * .5


def marimba(f, dur=.6, g=1.0):
    n = int(dur * SR); t = ta(n)
    x = np.sin(2 * np.pi * f * t) * np.exp(-t * 7) + .35 * np.sin(2 * np.pi * f * 3.93 * t) * np.exp(-t * 26) + .2 * np.sin(2 * np.pi * f * 9.2 * t) * np.exp(-t * 60)
    return x * np.minimum(1, t * 800) * .32 * g


def organ(freqs, dur=.18, g=1.0):
    n = int(dur * SR); t = ta(n)
    x = sum(np.sin(2 * np.pi * f * t) + .5 * np.sin(4 * np.pi * f * t) + .25 * np.sin(6 * np.pi * f * t) for f in freqs)
    e = np.minimum(1, t / .005) * np.minimum(1, (dur - t) / .03)
    return filt(x, 'low', 3500) / len(freqs) * e * .16 * g


def pad(freqs, dur, g=1.0, bright=1200):
    n = int(dur * SR); t = ta(n)
    x = sum(2 * ((f * d * t) % 1) - 1 for f in freqs for d in (.995, 1, 1.006))
    x = filt(x, 'low', bright) / (len(freqs) * 3)
    e = np.minimum(1, t / .6) * np.minimum(1, (dur - t) / .8)
    return x * e * .3 * g


def choir(freqs, dur, g=1.0):
    n = int(dur * SR); t = ta(n)
    vib = 1 + .004 * np.sin(2 * np.pi * 5.2 * t)
    x = sum(np.sin(2 * np.pi * f * np.cumsum(vib) / SR) + .4 * np.sin(4 * np.pi * f * np.cumsum(vib) / SR) for f in freqs)
    x = filt(x, 'band', [300, 2600]) / len(freqs)
    e = np.minimum(1, t / .5) * np.minimum(1, (dur - t) / .6)
    return x * e * .35 * g


def impact(size=1.0):
    n = int(2.4 * SR); t = ta(n)
    sub = np.sin(2 * np.pi * (36 + 70 * np.exp(-t * 7)) * t) * np.exp(-t * 1.8)
    nz = filt(rng.standard_normal(n), 'low', 5000) * np.exp(-t * 5) * .55
    return np.tanh((sub * 1.2 + nz) * 1.5) * .8 * size


def whoosh(dur=.6, up=True, g=1.0):
    n = int(dur * SR); t = ta(n); p = t / dur
    nz = rng.standard_normal(n)
    lo = filt(nz, 'band', [400, 2000]); hi = filt(nz, 'band', [2000, 8000])
    mix = p if up else 1 - p
    return (lo * (1 - mix) + hi * mix) * np.sin(np.pi * p) ** 2 * .5 * g


def riser(dur, g=1.0):
    n = int(dur * SR); t = ta(n); p = t / dur
    f = 150 * 2 ** (p * 3.2)
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * .15
    nz = filt(rng.standard_normal(n), 'high', 1500) * .3
    return (tone + nz) * p ** 2.4 * g


def click(f=2400, g=1.0):
    t = ta(int(.03 * SR))
    return (np.sin(2 * np.pi * f * t) * .4 + filt(rng.standard_normal(len(t)), 'high', 3000) * .6) * np.exp(-t * 180) * .35 * g


def typekey(g=1.0):
    n = int(.06 * SR); t = ta(n)
    x = filt(rng.standard_normal(n), 'band', [1500, 6000]) * np.exp(-t * 120) + np.sin(2 * np.pi * 320 * t) * np.exp(-t * 90) * .5
    return x * .32 * g


def bloop(f0=300, f1=900, dur=.22, g=1.0):
    n = int(dur * SR); t = ta(n); p = t / dur
    f = f0 * (f1 / f0) ** np.minimum(1, p * 1.6)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * p) ** .5 * np.exp(-p * 2) * .4 * g


def boing(f=220, g=1.0):
    n = int(.45 * SR); t = ta(n)
    fm = f * (1 + .35 * np.exp(-t * 8) * np.sin(2 * np.pi * 14 * t)) * (1 + .6 * np.exp(-t * 25))
    return np.sin(2 * np.pi * np.cumsum(fm) / SR) * np.exp(-t * 6) * .35 * g


def pop(g=1.0):
    n = int(.08 * SR); t = ta(n)
    return np.sin(2 * np.pi * np.cumsum(900 - 6000 * t) / SR) * np.exp(-t * 60) * .4 * g


def ding(g=1.0):
    n = int(2.2 * SR); t = ta(n)
    parts = [(2100, 1, 2.2), (2100 * 2.76, .5, 4), (2100 * 5.4, .25, 7), (2100 * .5, .2, 3)]
    x = sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t * d) for f, a, d in parts)
    return x * np.minimum(1, t * 3000) * .28 * g


def stamp(g=1.0):
    n = int(.5 * SR); t = ta(n)
    thud = np.sin(2 * np.pi * (70 + 120 * np.exp(-t * 40)) * t) * np.exp(-t * 14)
    clack = filt(rng.standard_normal(n), 'band', [800, 4000]) * np.exp(-t * 55)
    return np.tanh((thud * 1.3 + clack * .8) * 1.6) * .6 * g


def plop(f=180, g=1.0):
    n = int(.22 * SR); t = ta(n)
    tone = np.sin(2 * np.pi * np.cumsum(f * (1 + 1.5 * np.exp(-t * 35))) / SR) * np.exp(-t * 22)
    sq = filt(rng.standard_normal(n), 'band', [300, 1800]) * np.exp(-t * 40) * .4
    return (tone + sq) * .4 * g


def paper(dur=.7, g=1.0):
    n = int(dur * SR); t = ta(n)
    nz = filt(rng.standard_normal(n), 'band', [1500, 9000])
    am = (rng.random(n) > .997).astype(float)
    am = filt(am, 'low', 60) * 40
    return nz * np.clip(am, 0, 1) * np.sin(np.pi * t / dur) * .35 * g


def heartbeat(g=1.0):
    t = ta(int(.5 * SR))
    b = lambda d: np.sin(2 * np.pi * 50 * (t - d)) * np.exp(-np.clip(t - d, 0, None) * 18) * (t >= d)
    return np.tanh(2 * (b(0) + .7 * b(.16))) * .7 * g


def buzz(dur, g=1.0):
    n = int(dur * SR); t = ta(n)
    x = sum(np.sin(2 * np.pi * 120 * k * t) / k for k in range(1, 12))
    return filt(x, 'band', [100, 3000]) * .08 * g


# ---------------- music ----------------
# chord roots per 2 s bar: Dm, Bb, Gm, A
PROG = [(50, [62, 65, 69]), (46, [62, 65, 70]), (43, [62, 67, 70]), (45, [61, 64, 69])]
MOTIF = [  # (beat offset within 2 bars, midi, length in beats)  quirky sneaky line
    (0, 74, .5), (.75, 77, .25), (1, 76, .5), (1.5, 74, .5), (2.5, 69, .5), (3, 70, .5), (3.5, 69, .5),
    (4, 74, .5), (4.75, 77, .25), (5, 79, .5), (5.5, 81, .5), (6.5, 79, .25), (6.75, 77, .25), (7, 76, .5), (7.5, 73, .5),
]


def groove(a, b, lvl):
    """lvl: dict of part -> gain (kick, snare, hat, bass, stab, mel, pad)"""
    k = int(np.ceil((a - B0) / BEAT - 1e-6))
    while True:
        t = B0 + k * BEAT
        if t >= b - 1e-6:
            break
        bar = int((t - B0) // 2) % 4
        bt = k % 4
        root, ch = PROG[bar]
        if lvl.get('kick'):
            if bt in (0, 2):
                add(MU, kick(lvl['kick']), t)
            if bt == 3:
                add(MU, kick(lvl['kick'] * .6), t + .25)
        if lvl.get('snare') and bt in (1, 3):
            add(MU, snare(), t, lvl['snare'], .1)
        if lvl.get('hat'):
            add(MU, hat(), t, lvl['hat'], -.3)
            add(MU, hat(bt == 3), t + .27, lvl['hat'] * .8, -.3)
        if lvl.get('bass'):
            pat = [root, root + 12, root + 7, root + 10] if bar % 2 == 0 else [root, root + 7, root + 12, root + 7]
            add(MU, bass(hz(pat[bt] - 12), .24), t, lvl['bass'])
            add(MU, bass(hz(pat[(bt + 1) % 4] - 12), .2), t + .25, lvl['bass'] * .7)
        if lvl.get('stab'):
            add(MU, organ([hz(n) for n in ch], .16), t + .25, lvl['stab'], .25)
        k += 1
    if lvl.get('mel'):
        start = B0 + np.ceil((a - B0) / 4 - 1e-6) * 4
        s = start
        while s < b - 1e-6:
            for off, n, ln in MOTIF:
                tt = s + off * BEAT
                if a <= tt < b:
                    add(MU, marimba(hz(n), max(.3, ln * BEAT * 1.6)), tt, lvl['mel'], -.15)
            s += 4
    if lvl.get('pad'):
        s = B0 + np.floor((a - B0) / 2) * 2
        while s < b - 1e-6:
            bar = int((s - B0) // 2) % 4
            st, en = max(s, a), min(s + 2, b)
            add(MU, pad([hz(n - 12) for n in PROG[bar][1]], en - st + .4), st, lvl['pad'])
            s += 2


FULL = dict(kick=1, snare=.9, hat=1, bass=1, stab=.9, mel=1)
groove(6.5, 12.0, dict(kick=1, snare=.8, hat=.9, bass=1, stab=.8, pad=.6))
groove(12.0, 20.0, dict(FULL))
groove(20.0, 28.0, dict(kick=1, snare=.9, hat=1, bass=1, stab=1, mel=.7))
groove(28.0, 31.0, dict(kick=.8, hat=.8, bass=1, mel=1))
groove(31.0, 35.0, dict(kick=.7, hat=.6, bass=.9, stab=.5))
add(MU, choir([hz(62), hz(65), hz(69), hz(74)], 4.2), 31.0, 1.0)
groove(40.5, 42.0, dict(bass=.9, hat=.5))
groove(42.0, 50.0, dict(FULL, pad=.4))
groove(50.0, 55.0, dict(bass=.8, hat=.6, stab=.6, pad=.5))
# finale
add(MU, pad([hz(50), hz(57), hz(62), hz(65), hz(69), hz(76)], 4.4, 1.3, 1800), 55.5)
for i, n in enumerate([62, 65, 69, 74, 76, 81]):
    add(MU, marimba(hz(n), 1.6, .9), 56.0 + i * .125, pan=-.4 + i * .16)
add(MU, bass(hz(38), 3), 55.5, 1.2)

# tape stop on the music bus at the lights-out moment
ts0, ts1 = int(35.0 * SR), int(35.7 * SR)
seglen = ts1 - ts0
rate = np.linspace(1, 0.05, seglen)
pos = ts0 + np.cumsum(rate)
for ch in range(2):
    src = MU[ch].copy()
    MU[ch, ts0:ts1] = np.interp(pos, np.arange(N), src) * np.linspace(1, 0, seglen)
    MU[ch, ts1:int(40.5 * SR)] = 0

# ---------------- effects (times mirror src/main.js) ----------------
add(FX, buzz(6.0, 1.0), 0)
add(FX, pad([hz(38), hz(45), hz(50)], 6, .9, 500), 0)
for a_, b_ in [(.55, .62), (.74, .8), (1.05, 1.22), (1.4, 1.46)]:
    add(FX, click(1800, 1.4), a_); add(FX, buzz(b_ - a_, 4), a_)
add(FX, click(1500, 1.8), 1.75); add(FX, buzz(4.2, 1.2), 1.75)
for i, (s, n) in enumerate([(1.9, 18), (2.45, 19), (3.0, 19)]):
    for c in range(n):
        add(FX, typekey(.9), s + c * .45 / n + R(c + i * 40) * .01, pan=-.3)
add(FX, bloop(220, 520, .3, 1.2), 2.4)
for t in (3.05, 3.65, 4.3):
    add(FX, bloop(900, 1300, .08, .7), t)
add(FX, bloop(700, 400, .12, .8), 4.95)
add(FX, riser(.75, 1.3), 5.25); add(FX, whoosh(.5, True, 1.2), 5.6)
add(FX, whoosh(.45, False, 1.0), 6.0)
add(FX, impact(1.25), 6.5)
for t in (7.0, 9.0, 10.5):
    add(FX, ding(.35), t)
for i in range(6):
    add(FX, pop(.8), 7.6 + i * .08, pan=-.5 + i * .2)
add(FX, whoosh(.7, True, 1.4), 11.05); add(FX, paper(.6, 1.6), 11.4)
add(FX, paper(.45, 1.4), 12.0)
for s in range(5):
    add(FX, paper(.8, 1.4), 12.25 + s * .32, pan=-.6 + s * .3)
    add(FX, stamp(.35), 12.25 + s * .32 + .55, pan=-.6 + s * .3)
add(FX, ding(1.0), 13.0, pan=-.5); add(FX, ding(1.0), 16.0, pan=-.5)
for i in range(70):
    tt = 13.1 + 1.9 * (i / 70) ** (1 / .6)
    add(FX, click(3200, .5), tt, pan=.6)
add(FX, bloop(160, 420, .35, 1.1), 13.9)
add(FX, paper(4.4, 1.8), 15.4); add(FX, whoosh(4.4, True, .7), 15.4)
add(FX, stamp(1.3), 17.0)
add(FX, whoosh(.5, True, 1.5), 19.5); add(FX, paper(.6, 2), 19.4)
for c in range(30):
    add(FX, typekey(.8), 20.6 + c * .8 / 30, pan=.2)
for t in (21.95, 22.95, 23.95):
    add(FX, whoosh(.3, False, .6), t - .3); add(FX, stamp(1.5), t)
add(FX, whoosh(.5, True, .8), 24.35)
n = int(1.3 * SR); tt = ta(n)
add(FX, np.sin(2 * np.pi * 1850 * tt) * np.sin(np.pi * tt / 1.3) * .05, 25.0)
add(FX, bloop(1400, 1400, .12, .7), 26.1); add(FX, bloop(900, 900, .2, .7), 26.25)
add(FX, impact(.9), 27.5); add(FX, stamp(1.8), 27.5)
add(FX, pop(1.2), 28.05)
G = 34
for i in range(38):
    t0 = 28.15 + i * .065 + R(i * 9) * .1
    h = 15 + R(i * 2.2) * 6
    T1 = np.sqrt(2 * h / G)
    pan = float(np.clip(((R(i * 3.7) - .5) * 22) / 11, -1, 1))
    add(FX, plop(150 + R(i) * 120, .9), t0 + T1, pan=pan)
    add(FX, plop(260 + R(i) * 120, .35), t0 + T1 + 2 * .32 * G * T1 / G, pan=pan)
n = int(.7 * SR); tt = ta(n)
add(FX, filt(rng.standard_normal(n), 'low', 300) * np.sin(np.pi * tt / .7) * .5, 30.5)
add(FX, impact(.6), 31.0); add(FX, click(900, 2.5), 31.0)
for i in range(4):
    for c in range(14):
        add(FX, typekey(.6), 31.7 + i * .3 + c * .4 / 14, pan=-.4)
for t in (35.0, 35.25, 35.5):
    add(FX, click(1600, 1.5), t); add(FX, buzz(.08, 4), t)
add(FX, click(1100, 1.8), 36.15)
for t in (36.3, 36.8, 37.25, 37.62, 37.88):
    add(FX, heartbeat(1.0), t)
n = int(2 * SR); tt = ta(n)
add(FX, sum(np.sin(2 * np.pi * f * (1 + tt * .04) * tt) for f in (1180, 1250, 1320)) * (tt / 2) ** 2 * .05, 36.0)
add(FX, impact(1.5), 38.0)
n = int(1.6 * SR); tt = ta(n)
stab = sum(2 * ((f * tt) % 1) - 1 for f in (hz(50), hz(56), hz(61), hz(63), hz(68)))
add(FX, filt(stab, 'low', 2500) * np.exp(-tt * 2.5) * .12, 38.0)
add(FX, whoosh(.9, False, 1.4), 38.0)
add(FX, bloop(500, 260, .5, .7), 39.6)
add(FX, whoosh(.55, True, 1.0), 41.45)
add(FX, whoosh(.5, False, .9), 42.0)
for i in range(5):
    add(FX, boing(196 * 2 ** (i * 2 / 12), 1.0), 42.5 + i * .25, pan=-.6 + i * .3)
for i in range(3):
    add(FX, pop(.8), 43.5 + i * .1)
for t in (44.0, 44.5, 45.0):
    add(FX, bloop(900, 1300, .08, .6), t)
for i in range(5):
    add(FX, bloop(800, 500, .08, .45), 46.2 + i * .09, pan=-.6 + i * .3)
    add(FX, bloop(800, 500, .08, .45), 48.4 + (4 - i) * .09, pan=-.6 + i * .3)
for i in range(3):
    add(FX, pop(.6), 46.9 + i * .08); add(FX, pop(.5), 47.9 + i * .08)
add(FX, boing(260, 1.2), 49.35); add(FX, whoosh(.6, True, 1.4), 49.4)
add(FX, whoosh(.5, False, 1.0), 50.0); add(FX, paper(.4, 2.2), 50.5); add(FX, stamp(.6), 50.6)
for i, t in enumerate((51.0, 51.5, 52.0, 52.5)):
    add(FX, stamp(.9), t, pan=[-.6, .6, -.6, .6][i]); add(FX, click(1200 + i * 200, .9), t)
for s, d, n in [(51.0, .9, 13), (52.6, 1.0, 42), (53.6, .9, 50)]:
    for c in range(n):
        add(FX, typekey(.75), s + c * d / n + R(c * 3.3 + s) * .006)
    add(FX, ding(.25), s + d + .05)
add(FX, riser(.7, 1.2), 54.6); add(FX, whoosh(.55, True, 1.5), 54.75)
add(FX, impact(1.3), 55.5)
for i in range(6):
    add(FX, pop(.7), 56.0 + i * .07, pan=-.5 + i * .2)
add(FX, ding(.4), 56.5)
add(FX, boing(330, .9), 57.0, pan=.6); add(FX, boing(294, .9), 57.3, pan=-.6)
add(FX, bloop(800, 500, .08, .5), 58.5, pan=.6); add(FX, bloop(800, 500, .08, .5), 58.75, pan=-.6)

# ---------------- mix ----------------
mix = MU * .8 + FX * 1.0
# small stereo room
for ch in range(2):
    d = int((.031 if ch else .043) * SR)
    rv = np.zeros(N); rv[d:] = mix[ch, :-d] * .18
    mix[ch] += filt(rv, 'low', 4000)
fade = np.ones(N); fe = int(59.2 * SR); fade[fe:] = np.linspace(1, 0, N - fe)
mix *= fade
mix = np.tanh(mix * 1.1) / np.tanh(1.1)
mix /= np.max(np.abs(mix)) / .95
wavfile.write('soundtrack.wav', SR, (mix.T * 32767).astype(np.int16))
print('soundtrack.wav', DUR, 's')
