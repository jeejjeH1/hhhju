# fomies — Department of FOMO (3D motion piece)

A 60-second 1920×1080 @ 60fps video (H.264 + AAC). It's a cartoon 3D trip through the Department of FOMO, made from the fomies art and characters.
Three.js renders the 3D layer: toon shading with ink outlines, real shadows, an extruded 3D logo with a spinning i-dot coin, 3D fomie characters, and 3D pickles, paper stacks, stamps and push pins.
A 2D canvas layer draws the type, transitions and post FX on top. The soundtrack is fully synthesized: 120 BPM "office ska" in D minor, with every sound effect synced to a visual hit.

**Final video:** `out/fomies.mp4`

## Storyboard
| Time | Shot |
|---|---|
| 0–6s | **After hours.** The fluorescent lights stutter on in the intake office. Two big 3D eyes open behind the desk and look around: "Please take a number." The camera dives into a pupil. |
| 6–12s | **Orientation.** The black pupil opens onto lavender. The extruded 3D **fomies** logo slams down, its i-dot coin spins, and the agent cards fly in from depth. "WELCOME TO THE DEPARTMENT OF FOMO". A case-file folder wipes across. |
| 12–20s | **Intake.** 3D paper stacks pile up on the desk. The red-eyed Intake Officer rises behind them, the bell dings, and the NOW SERVING board races to 4821 (YOUR NUMBER: 9,999,999). Wait time: **WHENEVER**. A paper tornado flies into the lens. |
| 20–28s | **Correspondence.** The official envelope in 3D. A rubber stamp slams RECEIVED → PENDING → FOMO CERTIFIED, a laser scans the barcode (STATUS: STILL WAITING), and **NEXT!** hits the screen. |
| 28–36s | **Exhibit P.** "What's Up With The Pickles?" 3D pickles rain down and bounce. The Support Pickle P-055233 rises on its pedestal under a spotlight, with rubber bands, a pencil, a barcode and a fomies sticker. The lights die and the music tape-stops. |
| 36–42s | **Compliance.** A flashlight searches the dark office… **BOO!!!** "Relax. That's just Kevin from Compliance." The scene closes with a fomie-eye iris. |
| 42–50s | **Personnel.** "MEET THE STAFF": five 3D fomies pop up (sprout + bowtie, cowboy, patchwork, witch, halo). They bounce to the beat, look around in sync and blink in a wave, with an orbiting card carousel behind them. |
| 50–55s | **Closure.** The END OF THREAD notice flies in, four 3D push pins thunk into the corners, and the text types itself out. |
| 55–60s | The 3D logo slams in: "THE DEPARTMENT WILL SEE YOU NOW." … *eventually.* |

## Rebuild
```bash
npm install                                          # three + fonts (vendor/ and assets/fonts already hold copies)
pip install numpy scipy pillow
python3 tools/prep.py                                # cut-outs from assets/img -> assets/cut
python3 audio.py                                     # -> soundtrack.wav
NODE_PATH=$(npm root -g) node render.js video 60 4   # -> out/video_noaudio.mp4 (needs playwright + ffmpeg)
ffmpeg -i out/video_noaudio.mp4 -i soundtrack.wav -c:v copy -c:a aac -b:a 256k -shortest -movflags +faststart out/fomies.mp4
```
`node render.js stills 7.2 38.1` renders single frames to `out/stills/`.
For a live preview, serve this folder (`npx serve .`) and open `index.html`. Click to play with sound, SPACE pauses, ←/→ seek, and `?t=38` jumps to 38s.
