# GenLayer Staking — Motion Graphic

88-second, 1920×1080 @ 60fps (H.264 + AAC, ~48 MB) motion graphic for an X/Twitter post about staking and delegating on GenLayer.
It uses the project logo and the `#ff87ff` / `#dc00ff` palette, with cyan, violet, mint and red accents.

**Final video:** `out/genlayer-staking.mp4`

## Storyboard (synced to a 120 BPM soundtrack)
| Time | Scene |
|---|---|
| 0–6s | Logo builds from particles, then a shockwave hit. "STAKING ISN'T WHAT YOU THINK" |
| 6–12s | "Lock tokens, wait for yield." gets struck out → "Then I read how @GenLayer does it" |
| 12–22s | Validators are a jury: the Intelligent Contract calls AI and the web, then validators re-run, compare and vote → consensus |
| 22–26s | A validator needs at least 42,000 GEN of its own |
| 26–32s | No node needed: you delegate 42 GEN, the validator gets picked more often, and you share its rewards |
| 32–42s | weight ≈ √(0.6×own + 0.4×delegated): 4× the stake ≈ 2× the weight, so whales can't buy the network |
| 42–46s | The catch: if your validator is slashed, your stake gets cut too |
| 46–78s | My mainnet plan, in 5 steps: self-stake ratio · track record · square-root edge · 50/30/20 split · watch first, then commit |
| 78–88s | "Delegating is a VOTE for who gets to judge this network. So I'm voting carefully." |

## Rebuild
```bash
pip install numpy scipy
python3 audio.py                                  # -> soundtrack.wav
NODE_PATH=$(npm root -g) node render.js video 60 4 # -> out/video_noaudio.mp4 (needs playwright + ffmpeg)
ffmpeg -i out/video_noaudio.mp4 -i soundtrack.wav -c:v copy -c:a aac -b:a 256k -shortest -movflags +faststart out/genlayer-staking.mp4
```
To preview live in a browser, serve the folder (`npx serve .`) and open `index.html`. Click to play with sound; `?t=40` jumps to 40s.
