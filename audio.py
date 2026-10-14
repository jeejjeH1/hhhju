"""Synthesizes the 88 s soundtrack (120 BPM, A minor) in sync with the visual hits in motion.js.
Usage: python3 audio.py  -> soundtrack.wav
"""
import numpy as np
from scipy.signal import butter, sosfilt
from scipy.io import wavfile

SR = 44100
DUR = 88.0
N = int(SR * DUR)
BEAT = 0.5
rng = np.random.default_rng(7)
L = np.zeros(N)
Rch = np.zeros(N)


def t_arr(n):
    return np.arange(n) / SR


def filt(x, kind, f):
    return sosfilt(butter(2, f, btype=kind, fs=SR, output='sos'), x)


def add(sig, at, gain=1.0, pan=0.0):
    i = int(at * SR)
    if i >= N or i + len(sig) <= 0:
        return
    s = sig[: max(0, N - i)] * gain
    L[i:i + len(s)] += s * (1 - max(0, pan))
    Rch[i:i + len(s)] += s * (1 + min(0, pan))


def note(n):
    return 440.0 * 2 ** ((n - 69) / 12)


# ---------- instruments ----------
def kick():
    t = t_arr(int(0.45 * SR))
    f = 45 + 110 * np.exp(-t * 35)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.tanh(2.2 * np.sin(ph) * np.exp(-t * 7)) * 0.9


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


def saw(f, t):
    return 2 * ((f * t) % 1) - 1


def bass_note(f, dur):
    n = int(dur * SR)
    t = t_arr(n)
    x = saw(f, t) + 0.5 * np.sin(2 * np.pi * f / 2 * t)
    x = filt(x, 'low', 420)
    env = np.minimum(1, t * 200) * np.exp(-t * 3)
    return np.tanh(x * 1.6) * env * 0.42


def arp_note(f, dur):
    n = int(dur * SR)
    t = t_arr(n)
    x = np.sign(np.sin(2 * np.pi * f * t)) * 0.5 + saw(f * 1.005, t) * 0.5
    x = filt(x, 'low', 2600)
    return x * np.exp(-t * 14) * 0.09


def pad(freqs, dur):
    n = int(dur * SR)
    t = t_arr(n)
    x = sum(saw(f * d, t) for f in freqs for d in (0.996, 1.0, 1.004))
    x = filt(x, 'low', 1100) / (len(freqs) * 3)
    env = np.minimum(1, t / 0.25) * np.minimum(1, (dur - t) / 0.3)
    return x * env * 0.32


def impact(size=1.0):
    n = int(2.6 * SR)
    t = t_arr(n)
    sub = np.sin(2 * np.pi * (38 + 60 * np.exp(-t * 6)) * t) * np.exp(-t * 1.6)
    nz = filt(rng.standard_normal(n), 'low', 6000) * np.exp(-t * 4.5) * 0.5
    return np.tanh((sub * 1.1 + nz) * 1.4) * 0.75 * size


def riser(dur):
    n = int(dur * SR)
    t = t_arr(n)
    p = t / dur
    f = 180 * 2 ** (p * 3.5)
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.12
    nz = filt(rng.standard_normal(n), 'high', 1800) * 0.25
    return (tone + nz) * p ** 2.2


def whoosh(dur=0.5):
    n = int(dur * SR)
    t = t_arr(n)
    p = t / dur
    nz = filt(rng.standard_normal(n), 'band', [600, 6000])
    return nz * np.sin(np.pi * p) ** 2 * p * 0.35


def blip(f=1800):
    t = t_arr(int(0.06 * SR))
    return np.sign(np.sin(2 * np.pi * f * t)) * np.exp(-t * 60) * 0.06


# ---------- arrangement ----------
CHORDS = [  # Am, F, C, G  (one bar = 2 s)
    (45, [57, 60, 64, 69]), (41, [53, 57, 60, 65]), (48, [55, 60, 64, 67]), (43, [55, 59, 62, 67])]


def section(t):
    """which layers play at time t"""
    if t < 2: return set()
    if t < 6: return {'kick', 'bass', 'pad'}
    if 42 <= t < 43: return {'pad'}
    if 43 <= t < 46: return {'pad', 'bass', 'half'}
    if 46 <= t < 48: return {'pad', 'roll'}
    if 78 <= t < 80: return {'pad', 'roll'}
    if t >= 84: return {'pad'}
    return {'kick', 'bass', 'pad', 'hat', 'clap', 'arp'}


kick_times = []
step = 0.125
for i in range(int(DUR / step)):
    tt = i * step
    sec = section(tt)
    bar = int(tt // 2)
    root, chord = CHORDS[bar % 4]
    pos16 = i % 16  # 16ths in a 2-s bar? (2 s = 4 beats = 16 sixteenths)
    on_beat = pos16 % 4 == 0
    if 'kick' in sec and on_beat:
        add(kick(), tt); kick_times.append(tt)
    if 'half' in sec and pos16 in (0, 10):
        add(kick(), tt, 0.9); kick_times.append(tt)
    if 'clap' in sec and pos16 in (4, 12):
        add(clap(), tt, 0.8)
    if 'hat' in sec:
        if pos16 % 4 == 2: add(hat(True), tt, 0.9, pan=0.3)
        elif pos16 % 2 == 1: add(hat(), tt, 0.6, pan=-0.3)
    if 'bass' in sec and pos16 % 2 == 1:
        add(bass_note(note(root), 0.22), tt)
    if 'arp' in sec and tt >= 12:
        seq = [0, 1, 2, 3, 2, 1, 3, 2]
        f = note(chord[seq[pos16 % 8]] + 12)
        add(arp_note(f, 0.12), tt, pan=0.5 if pos16 % 2 else -0.5)
    if 'roll' in sec:
        sec_start = 46 if tt < 60 else 78
        p = (tt - sec_start) / 2
        dens = 4 if p < .5 else 2 if p < .75 else 1
        if pos16 % dens == 0:
            add(clap(), tt, 0.25 + 0.6 * p)

# pads, one per bar
for bar in range(int(DUR // 2)):
    tt = bar * 2.0
    if 'pad' in section(tt + 0.01) or tt < 2:
        _, chord = CHORDS[bar % 4]
        g = 0.6 if tt < 2 else 1.0
        if tt >= 84: g = 1.2
        add(pad([note(n) for n in chord], 2.05), tt, g)

# sidechain ducking on everything already in the bus except kicks: apply envelope
duck = np.ones(N)
for kt in kick_times:
    i = int(kt * SR)
    n = int(0.3 * SR)
    seg_ = 1 - 0.55 * np.exp(-t_arr(n) * 14)
    j = min(N, i + n)
    duck[i:j] = np.minimum(duck[i:j], seg_[:j - i])
L *= duck; Rch *= duck
# re-add kicks un-ducked (they were ducked with the bus)
for kt in kick_times:
    add(kick(), kt, 0.55)

# risers + impacts synced to visual HITS
add(riser(2.0), 0.0, 1.0)
for at, size in [(2.0, 1.0), (9.0, 0.6), (43.0, 1.0), (48.0, 0.8), (80.0, 1.0), (84.0, 0.8), (23.5, 0.4), (39.5, 0.5), (20.5, 0.35), (42.0, 0.6)]:
    add(impact(size), at)
add(riser(2.0), 46.0, 1.2)
add(riser(2.0), 78.0, 1.2)
add(riser(1.0), 42.0, 0.6)
for cut in [6, 12, 22, 26, 32, 54, 60, 66, 72]:
    add(whoosh(0.5), cut - 0.5, 1.0)
# UI blips on typed text / stamps
for bt in [6.0, 9.55, 12.3, 14.0, 16.5, 17.85, 19.6, 22.1, 26.4, 32.05, 35.0, 35.45, 46.05, 51.0, 57.75, 63.1, 63.35, 69.1, 74.4]:
    add(blip(1500 + 400 * (bt % 3)), bt, 1.0)

# master: fade, glue, normalize
mix = np.stack([L, Rch], axis=1)
fade = np.ones(N)
fo = int(2.5 * SR)
fade[-fo:] = np.linspace(1, 0, fo) ** 1.5
fi = int(0.05 * SR)
fade[:fi] = np.linspace(0, 1, fi)
mix *= fade[:, None]
mix /= np.percentile(np.abs(mix), 99.9) + 1e-9
mix = np.tanh(mix * 1.1)
mix /= np.max(np.abs(mix)) + 1e-9
mix *= 0.89
wavfile.write('soundtrack.wav', SR, (mix * 32767).astype(np.int16))
print('wrote soundtrack.wav', mix.shape[0] / SR, 's')
