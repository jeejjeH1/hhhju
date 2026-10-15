# Seismic: Financial Privacy Motion Graphic

A 30-second, 1920×1080 @ 60fps (H.264 + AAC) motion graphic for an X/Twitter post about Seismic and onchain financial privacy.
It uses the Seismic mark, traced into five vector facets, and the brand palette: Mauve `#825A6D`, Purple `#523542`, and greys from `#FCFCFC` to `#161616`.
Type is Inter Display, with JetBrains Mono for data and labels.

**Final video:** `out/seismic-privacy.mp4` (frame 0 is the end-card poster, so it becomes the idle thumbnail)

## Storyboard (synced to a 120 BPM soundtrack, every cut lands on a beat)
| Time | Scene |
|---|---|
| 0–3s | Seismograph line, "DETECTING SIGNAL". The five logo facets slam in on the beat → shockwave → **SEISMIC** |
| 3–6s | A live onchain feed scrolls behind: "EVERY / TRANSACTION / IS PUBLIC." |
| 6–10s | A business wallet gets scanned: balance, suppliers, payroll and history are tagged VISIBLE. "Visible to everyone." |
| 10–13s | The page turns white: "Why should a public blockchain automatically mean **public balances?**" A silent beat before the drop |
| 13–16s | **Drop:** the logo assembles, then "SEISMIC · Privacy-focused blockchain infrastructure" |
| 16–21s | The same feed gets a shield sweep: addresses and amounts lock while the rows stay VERIFIED. "Confidential smart contracts." → "Onchain. Not on display." |
| 21–27s | Why it matters: 01 Financial Privacy · 02 Private Stablecoin Payments · 03 The Next Generation of DeFi |
| 27–30s | "TRANSPARENCY + PRIVACY can coexist." → end card |

## Rebuild
```bash
pip install numpy scipy
python3 audio.py                                   # -> soundtrack.wav
NODE_PATH=$(npm root -g) node render.js video 60 4 # -> out/video_noaudio.mp4 (needs playwright + ffmpeg)
ffmpeg -i out/video_noaudio.mp4 -i soundtrack.wav -c:v copy -c:a aac -b:a 256k -shortest -movflags +faststart out/seismic-privacy.mp4
```
To preview live, serve the folder (`npx serve .`) and open `index.html`. Click to play with sound; `?t=13` jumps to 13s.
