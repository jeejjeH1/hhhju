"""Synthesizes the 30 s soundtrack (120 BPM, A minor) in sync with the visual hits in motion.js.
Usage: python3 audio.py  -> soundtrack.wav
"""
import numpy as np
from scipy.signal import butter, sosfilt
from scipy.io import wavfile

SR = 48000
DUR = 30.0
N = int(SR * DUR)
rng = np.random.default_rng(11)
L = np.zeros(N)
Rch = np.zeros(N)


def t_arr(n):
    return np.arange(n) / SR


def filt(x, kind, f):
    return sosfilt(butter(2, f, btype=kind, fs=SR, output='sos'), x)


def add(sig, at, gain=1.0, pan=0.0):
    i = int(round(at * SR))
    if i >= N or i + len(sig) <= 0:
        return
    s = sig[: max(0, N - i)] * gain
    L[i:i + len(s)] += s * (1 - max(0, pan))
    Rch[i:i + len(s)] += s * (1 + min(0, pan))


def note(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def saw(f, t):
    return 2 * ((f * t) % 1) - 1


# ---------- instruments ----------
def kick():
    t = t_arr(int(0.45 * SR))
    f = 42 + 120 * np.exp(-t * 38)
    ph = 2 * np.pi * np.cumsum(f) / SR
    click = filt(rng.standard_normal(len(t)), 'high', 3000) * np.exp(-t * 400) * 0.3
    return np.tanh(2.4 * np.sin(ph) * np.exp(-t * 7)) * 0.9 + click


def clap():
    n = int(0.3 * SR)
    t = t_arr(n)
    x = filt(rng.standard_normal(n), 'band', [900, 5000])
    env = np.exp(-t * 18) + 0.6 * np.exp(-((t - 0.012) % 0.011) * 300) * (t < 0.035)
    return x * env * 0.5 + np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30) * 0.25


def hat(open_=False):
    n = int((0.18 if open_ else 0.05) * SR)
    t = t_arr(n)
    x = filt(rng.standard_normal(n), 'high', 7500)
    return x * np.exp(-t * (16 if open_ else 70)) * 0.22


def bass_note(f, dur):
    t = t_arr(int(dur * SR))
    x = saw(f, t) + 0.6 * np.sin(2 * np.pi * f / 2 * t)
    x = filt(x, 'low', 380)
    env = np.minimum(1, t * 200) * np.exp(-t * 3)
    return np.tanh(x * 1.8) * env * 0.45


def stab(freqs, dur=0.22):
    t = t_arr(int(dur * SR))
    x = sum(saw(f * d, t) for f in freqs for d in (0.995, 1.0, 1.005)) / (len(freqs) * 3)
    x = filt(x, 'low', 2400)
    return x * np.exp(-t * 11) * 0.42


def arp_note(f, dur):
    t = t_arr(int(dur * SR))
    x = np.sign(np.sin(2 * np.pi * f * t)) * 0.5 + saw(f * 1.004, t) * 0.5
    return filt(x, 'low', 3000) * np.exp(-t * 16) * 0.075


def pad(freqs, dur, cutoff=1100):
    t = t_arr(int(dur * SR))
    x = sum(saw(f * d, t) for f in freqs for d in (0.996, 1.0, 1.004))
    x = filt(x, 'low', cutoff) / (len(freqs) * 3)
    env = np.minimum(1, t / 0.2) * np.minimum(1, (dur - t) / 0.3)
    return x * env * 0.32


def pluck(f):
    t = t_arr(int(0.9 * SR))
    x = sum(np.sin(2 * np.pi * f * k * t) * np.exp(-t * (3 + 4 * k)) / k for k in (1, 2, 3, 4))
    return x * 0.18


def impact(size=1.0):
    t = t_arr(int(2.6 * SR))
    sub = np.sin(2 * np.pi * np.cumsum(34 + 70 * np.exp(-t * 6)) / SR) * np.exp(-t * 1.5)
    nz = filt(rng.standard_normal(len(t)), 'low', 6000) * np.exp(-t * 4.5) * 0.5
    return np.tanh((sub * 1.2 + nz) * 1.5) * 0.8 * size


def thud():  # facet landing: short metallic knock
    t = t_arr(int(0.35 * SR))
    body = np.sin(2 * np.pi * np.cumsum(70 + 160 * np.exp(-t * 30)) / SR) * np.exp(-t * 12)
    ring_ = sum(np.sin(2 * np.pi * f * t) for f in (1230, 1870, 2610)) * np.exp(-t * 25) * 0.12
    return np.tanh(body * 1.8) * 0.6 + ring_


def riser(dur, f0=180):
    t = t_arr(int(dur * SR))
    p = t / dur
    f = f0 * 2 ** (p * 3.5)
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.12
    nz = filt(rng.standard_normal(len(t)), 'high', 1800) * 0.25
    return (tone + nz) * p ** 2.2


def whoosh(dur=0.5):
    t = t_arr(int(dur * SR))
    p = t / dur
    nz = filt(rng.standard_normal(len(t)), 'band', [600, 6000])
    return nz * np.sin(np.pi * p) ** 2 * p * 0.4


def scan(dur):  # shield sweep: band-passed noise gliding upward + digital chatter
    n = int(dur * SR)
    t = t_arr(n)
    out = np.zeros(n)
    nz = rng.standard_normal(n)
    blocks = 24
    for b in range(blocks):
        a, z = b * n // blocks, (b + 1) * n // blocks
        fc = 400 * 2 ** (b / blocks * 4)
        out[a:z] = filt(nz, 'band', [fc * 0.7, fc * 1.4])[a:z]
    chatter = np.sign(np.sin(2 * np.pi * (900 + 600 * np.floor(t * 40 % 5)) * t)) * 0.05 * (np.floor(t * 40) % 2)
    return (out * 0.35 + chatter) * np.sin(np.pi * t / dur) ** 0.6


def blip(f=1800):
    t = t_arr(int(0.06 * SR))
    return np.sign(np.sin(2 * np.pi * f * t)) * np.exp(-t * 60) * 0.06


# ---------- arrangement ----------
CHORDS = [  # Am, F, Dm, E  (one bar = 2 s)
    (45, [57, 60, 64, 69]), (41, [53, 57, 60, 65]), (38, [50, 57, 62, 65]), (40, [52, 56, 59, 64])]


def section(t):
    if t < 2: return set()
    if t < 3: return {'pad'}
    if t < 6: return {'kick', 'bass', 'hat', 'pad'}
    if t < 10: return {'kick', 'bass', 'hat', 'clap', 'pad'}
    if t < 12.9: return {'pad_lo', 'roll'}
    if t < 13: return set()  # pre-drop silence
    if t < 27: return {'kick', 'bass', 'hat', 'clap', 'pad', 'arp'}
    if t < 28.5: return {'pad', 'roll', 'half'}
    return {'pad'}


kick_times = []
step = 0.125
for i in range(int(DUR / step)):
    tt = i * step
    sec = section(tt)
    bar = int(tt // 2)
    root, chord = CHORDS[bar % 4]
    pos16 = i % 16
    if 'kick' in sec and pos16 % 4 == 0:
        add(kick(), tt); kick_times.append(tt)
    if 'half' in sec and pos16 in (0, 8):
        add(kick(), tt, 0.9); kick_times.append(tt)
    if 'clap' in sec and pos16 in (4, 12):
        add(clap(), tt, 0.8)
    if 'hat' in sec:
        if pos16 % 4 == 2: add(hat(True), tt, 0.9, pan=0.3)
        elif pos16 % 2 == 1: add(hat(), tt, 0.6, pan=-0.3)
    if 'bass' in sec and pos16 % 2 == 1:
        add(bass_note(note(root), 0.22), tt)
    if 'arp' in sec:
        seq = [0, 1, 2, 3, 2, 1, 3, 2]
        add(arp_note(note(chord[seq[pos16 % 8]] + 12), 0.12), tt, pan=0.5 if pos16 % 2 else -0.5)
    if 'roll' in sec:
        s0, s1 = (11.0, 12.9) if tt < 20 else (27.0, 28.5)
        if tt >= s0:
            p = (tt - s0) / (s1 - s0)
            dens = 4 if p < .4 else 2 if p < .75 else 1
            if pos16 % dens == 0:
                add(clap(), tt, 0.2 + 0.6 * p)

# pads, one per bar
for bar in range(int(DUR // 2)):
    tt = bar * 2.0
    sec = section(tt + 0.01)
    _, chord = CHORDS[bar % 4]
    if 'pad' in sec or tt < 2:
        g = 0.5 if tt < 2 else 1.0
        add(pad([note(n) for n in chord], 2.05), tt, g)
    if 'pad_lo' in sec:
        add(pad([note(n) for n in chord], 2.05, cutoff=500), tt, 1.2)
# final chord rings out
add(pad([note(n) for n in (45, 57, 60, 64, 69)], 1.5), 28.5, 1.3)

# sidechain
duck = np.ones(N)
for kt in kick_times:
    i = int(kt * SR)
    n = int(0.3 * SR)
    seg_ = 1 - 0.55 * np.exp(-t_arr(n) * 14)
    j = min(N, i + n)
    duck[i:j] = np.minimum(duck[i:j], seg_[:j - i])
L *= duck; Rch *= duck
for kt in kick_times:
    add(kick(), kt, 0.55)

# intro: drone + facet knocks + riser into the first hit
add(pad([note(33), note(45)], 2.0, cutoff=300), 0.0, 1.4)
for k, at in enumerate([0.5, 0.75, 1.0, 1.25, 1.5]):
    add(thud(), at, 0.8 + 0.1 * k, pan=(k - 2) * 0.2)
add(riser(1.5), 0.5, 0.9)

# impacts synced to visual HITS
for at, size in [(2.0, 1.0), (5.0, 0.45), (8.75, 0.4), (13.0, 1.15), (19.25, 0.55), (21, 0.4), (23, 0.4), (25, 0.4), (28.5, 1.0)]:
    add(impact(size), at)
for at in (13.0, 21.0, 23.0, 25.0, 28.5):
    _, chord = CHORDS[int(at // 2) % 4]
    add(stab([note(n) for n in chord]), at, 1.0)
add(riser(2.0), 11.0, 1.2)
add(riser(1.5), 27.0, 1.1)
for cut in [3, 6, 10, 16, 21, 23, 25, 27]:
    add(whoosh(0.5), cut - 0.5, 1.0)
add(scan(1.2), 16.25, 1.0)
# question words: piano-like plucks on the white page
for at, n in [(10.0, 69), (10.5, 72), (11.0, 76), (11.5, 74), (12.0, 81)]:
    add(pluck(note(n)), at, 1.0)
# UI blips: typed labels, reticle locks, stamps
for bt in [0.1, 3.0, 6.75, 7.25, 7.75, 8.25, 9.2, 14.0, 17.4, 20.0, 29.15]:
    add(blip(1500 + 300 * (int(bt * 4) % 3)), bt, 1.0)

# master: glue, normalize, short fades (no long fade: the loop restarts on X)
mix = np.stack([L, Rch], axis=1)
fade = np.ones(N)
fo = int(0.6 * SR)
fade[-fo:] = np.linspace(1, 0, fo) ** 1.5
fi = int(0.02 * SR)
fade[:fi] = np.linspace(0, 1, fi)
mix *= fade[:, None]
mix /= np.percentile(np.abs(mix), 99.9) + 1e-9
mix = np.tanh(mix * 1.1)
mix /= np.max(np.abs(mix)) + 1e-9
mix *= 0.89
wavfile.write('soundtrack.wav', SR, (mix * 32767).astype(np.int16))
print('wrote soundtrack.wav', mix.shape[0] / SR, 's')
