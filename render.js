// Usage:
//   node render.js stills 2.1 9.05 20.6 ...      -> out/stills/t_<time>.png
//   node render.js video [fps=60] [workers=4]    -> out/video_noaudio.mp4
// Needs: playwright (global install is fine: NODE_PATH=$(npm root -g)), ffmpeg on PATH.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'out');
const URL = 'file://' + path.join(ROOT, 'index.html') + '?render=1';

async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('PAGE ERROR', e.message));
  page.on('console', m => { if (m.type() === 'error') console.error('CONSOLE', m.text()); });
  await page.goto(URL);
  await page.evaluate(() => window.ready);
  return page;
}

async function grab(page, t, type = 'png') {
  await page.evaluate(t => window.renderFrame(t), t);
  return page.locator('#c').screenshot({ type, ...(type === 'jpeg' ? { quality: 96 } : {}) });
}

async function stills(times) {
  fs.mkdirSync(path.join(OUT, 'stills'), { recursive: true });
  const browser = await chromium.launch();
  const page = await openPage(browser);
  for (const t of times) {
    const buf = await grab(page, parseFloat(t));
    fs.writeFileSync(path.join(OUT, 'stills', `t_${t}.png`), buf);
  }
  await browser.close();
}

function encoder(file, fps) {
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-pix_fmt', 'yuv420p', '-r', String(fps), file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg ' + c))));
  return { ff, done };
}

async function video(fps = 60, workers = 4) {
  fs.mkdirSync(path.join(OUT, 'parts'), { recursive: true });
  const browser = await chromium.launch();
  const page0 = await openPage(browser);
  const dur = await page0.evaluate(() => window.DURATION);
  await page0.close();
  const total = Math.round(dur * fps), per = Math.ceil(total / workers);
  const started = Date.now();
  let doneFrames = 0;
  const jobs = [];
  for (let w = 0; w < workers; w++) {
    const a = w * per, b = Math.min(total, a + per);
    jobs.push((async () => {
      const page = await openPage(browser);
      const file = path.join(OUT, 'parts', `part_${w}.mp4`);
      const { ff, done } = encoder(file, fps);
      for (let i = a; i < b; i++) {
        const buf = await grab(page, i / fps, 'jpeg');
        if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
        if (++doneFrames % 120 === 0) {
          const el = (Date.now() - started) / 1000;
          console.log(`${doneFrames}/${total} frames  ${el.toFixed(0)}s elapsed  ~${(el / doneFrames * (total - doneFrames)).toFixed(0)}s left`);
        }
      }
      ff.stdin.end(); await done; await page.close();
      return file;
    })());
  }
  const files = await Promise.all(jobs);
  await browser.close();
  const list = path.join(OUT, 'parts', 'list.txt');
  fs.writeFileSync(list, files.map(f => `file '${f}'`).join('\n'));
  await new Promise((res, rej) => spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', path.join(OUT, 'video_noaudio.mp4')], { stdio: 'inherit' })
    .on('close', c => c === 0 ? res() : rej(new Error('concat ' + c))));
  console.log('done in', ((Date.now() - started) / 1000).toFixed(0), 's');
}

const [mode, ...args] = process.argv.slice(2);
(mode === 'stills' ? stills(args) : video(+(args[0] || 60), +(args[1] || 4))).catch(e => { console.error(e); process.exit(1); });
