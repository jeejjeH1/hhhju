// Usage:
//   node render.js stills 2.1 9.05 20.6 ...      -> out/stills/t_<time>.png
//   node render.js video [fps=60] [workers=4]    -> out/video_noaudio.mp4
// Needs: playwright (global install is fine: NODE_PATH=$(npm root -g)), ffmpeg on PATH.
// ES modules and WebGL textures need http, so the folder is served from a throwaway local server.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'out');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.wav': 'audio/wav' };
const LAUNCH = { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] };

function serve() {
  const srv = http.createServer((req, res) => {
    const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv)));
}

async function openPage(browser, url) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('PAGE ERROR', e.message));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.error('CONSOLE', m.text()); });
  await page.goto(url);
  await page.waitForFunction(() => window.ready);
  await page.evaluate(() => window.ready);
  return page;
}

async function grab(page, t, type = 'png') {
  await page.evaluate(t => window.renderFrame(t), t);
  return page.locator('#c').screenshot({ type, ...(type === 'jpeg' ? { quality: 95 } : {}) });
}

function encoder(file, fps) {
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(fps), file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg ' + c))));
  return { ff, done };
}

async function main() {
  const [mode, ...args] = process.argv.slice(2);
  const srv = await serve();
  const url = `http://127.0.0.1:${srv.address().port}/index.html?render=1`;
  const browser = await chromium.launch(LAUNCH);
  try {
    if (mode === 'stills') {
      fs.mkdirSync(path.join(OUT, 'stills'), { recursive: true });
      const page = await openPage(browser, url);
      for (const t of args) fs.writeFileSync(path.join(OUT, 'stills', `t_${t}.png`), await grab(page, parseFloat(t)));
      return;
    }
    const fps = +(args[0] || 60), workers = +(args[1] || 4);
    fs.mkdirSync(path.join(OUT, 'parts'), { recursive: true });
    const page0 = await openPage(browser, url);
    const dur = await page0.evaluate(() => window.DURATION);
    await page0.close();
    const total = Math.round(dur * fps), per = Math.ceil(total / workers);
    const started = Date.now();
    let doneFrames = 0;
    const files = await Promise.all([...Array(workers)].map(async (_, w) => {
      const a = w * per, b = Math.min(total, a + per);
      const page = await openPage(browser, url);
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
    }));
    const list = path.join(OUT, 'parts', 'list.txt');
    fs.writeFileSync(list, files.map(f => `file '${f}'`).join('\n'));
    await new Promise((res, rej) => spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', path.join(OUT, 'video_noaudio.mp4')], { stdio: 'inherit' })
      .on('close', c => c === 0 ? res() : rej(new Error('concat ' + c))));
    console.log('done in', ((Date.now() - started) / 1000).toFixed(0), 's');
  } finally {
    await browser.close(); srv.close();
  }
}
main().catch(e => { console.error(e); process.exit(1); });
