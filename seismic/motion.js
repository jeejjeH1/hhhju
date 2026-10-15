'use strict';
/* Seismic — financial privacy motion graphic (1920x1080, 30 s, 120 BPM). Every frame is a pure function of time t. */

const W = 1920, H = 1080, DUR = 30;
const C = {
  mauve: '#825A6D', purple: '#523542', white: '#FFFFFF', g50: '#FCFCFC', g200: '#E8E8E8', g300: '#D4D4D4',
  g400: '#A4A3A1', g500: '#737373', g800: '#282826', black: '#161616',
  tint: '#C7A2B4', // light mauve: mauve lifted for legibility on black
};
const F = { d: '"ID"', m: '"JBM"' };

const cv = document.getElementById('c');
const M = cv.getContext('2d');
const mk = (w = W, h = H) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const B = mk(), T1 = mk();
const BX = B.getContext('2d'), TX = T1.getContext('2d');
let X = BX;

/* ---------- math ---------- */
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const R = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const E = {
  outCubic: x => 1 - Math.pow(1 - x, 3),
  inCubic: x => x * x * x,
  inOutCubic: x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2,
  outExpo: x => x >= 1 ? 1 : 1 - Math.pow(2, -10 * x),
  inExpo: x => x <= 0 ? 0 : Math.pow(2, 10 * x - 10),
  inOutExpo: x => x <= 0 ? 0 : x >= 1 ? 1 : x < .5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2,
  outQuart: x => 1 - Math.pow(1 - x, 4),
};
// kick pulse: 4/4 at 120 BPM where the beat is playing
const beatOn = t => (t >= 3 && t < 10) || (t >= 13 && t < 27) || (t >= 28.5 && t < 29.5);
const beatPulse = t => beatOn(t) ? Math.exp(-(((t % 0.5) + 0.5) % 0.5) * 9) : 0;

/* ---------- text ---------- */
function setFont(fam, wt, size, ls = 0) { X.font = `${wt} ${size}px ${fam}`; X.letterSpacing = ls + 'px'; }
function measure(s, o) { X.save(); setFont(o.fam || F.d, o.wt || 500, o.size || 40, o.ls || 0); const w = X.measureText(s).width - (o.ls || 0); X.restore(); return w; }
function text(s, x, y, o = {}) {
  if (!s) return 0;
  X.save();
  setFont(o.fam || F.d, o.wt || 500, o.size || 40, o.ls || 0);
  X.textBaseline = 'alphabetic'; X.textAlign = 'left';
  const w = X.measureText(s).width - (o.ls || 0);
  const x0 = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
  if (o.alpha !== undefined) X.globalAlpha *= o.alpha;
  if (o.stroke) { X.strokeStyle = o.color || '#fff'; X.lineWidth = o.stroke; X.lineJoin = 'round'; X.strokeText(s, x0, y); }
  else { X.fillStyle = o.color || '#fff'; X.fillText(s, x0, y); }
  X.restore();
  return w;
}
// masked rise: the line slides up out of a clip box, like type set on a press
function rise(s, x, y, o, t, t0, d = 0.5) {
  const p = E.outExpo(seg(t, t0, t0 + d));
  if (p <= 0) return 0;
  const w = measure(s, o), sz = o.size || 40;
  const x0 = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
  X.save();
  X.beginPath(); X.rect(x0 - 40, y - sz * 1.05, w + 80, sz * 1.38); X.clip();
  text(s, x, y + (1 - p) * sz * 1.2, o);
  X.restore();
  return w;
}
// per-letter rise (wordmarks)
function letters(s, x, y, o, t, t0, st = 0.05, d = 0.5) {
  X.save(); setFont(o.fam || F.d, o.wt || 600, o.size, o.ls || 0);
  const total = X.measureText(s).width - (o.ls || 0);
  const x0 = o.align === 'center' ? x - total / 2 : x;
  for (let i = 0; i < s.length; i++) {
    const p = E.outExpo(seg(t, t0 + i * st, t0 + i * st + d));
    if (p <= 0) continue;
    const off = X.measureText(s.slice(0, i)).width;
    X.save(); X.beginPath(); X.rect(x0 + off - 20, y - o.size * 1.05, o.size * 1.4, o.size * 1.3); X.clip();
    X.fillStyle = o.color || '#fff'; X.textAlign = 'left';
    X.fillText(s[i], x0 + off, y + (1 - p) * o.size * 1.15);
    X.restore();
  }
  X.restore();
}
const GL = 'ABCDEF0123456789#$%&*<>/=+';
function scramble(s, p, t, seed = 1) {
  let out = ''; const n = s.length, f = Math.floor(t * 30);
  for (let i = 0; i < n; i++) {
    const ch = s[i];
    if (ch === ' ') { out += ' '; continue; }
    const th = i / n * 0.75;
    if (p >= th + 0.25) out += ch;
    else if (p > th) out += GL[Math.floor(R(i * 7.3 + f * 13.1 + seed) * GL.length)];
    else out += ' ';
  }
  return out;
}
const typed = (s, p) => s.slice(0, Math.round(s.length * clamp(p)));

/* ---------- small drawings ---------- */
function ring(cx, cy, r, col, lw, a = 1) {
  X.save(); X.globalAlpha *= a; X.strokeStyle = col; X.lineWidth = lw;
  X.beginPath(); X.arc(cx, cy, Math.max(0, r), 0, Math.PI * 2); X.stroke(); X.restore();
}
function dot(x, y, r, col, a = 1) {
  X.save(); X.globalAlpha *= a; X.fillStyle = col; X.beginPath(); X.arc(x, y, r, 0, Math.PI * 2); X.fill(); X.restore();
}
function lock(cx, cy, s, col) {
  X.save(); X.fillStyle = col; X.strokeStyle = col; X.lineWidth = s * 0.22;
  X.beginPath(); X.arc(cx, cy - s * 0.25, s * 0.42, Math.PI, 0); X.stroke();
  X.beginPath(); X.roundRect(cx - s * 0.65, cy - s * 0.25, s * 1.3, s * 1.05, s * 0.15); X.fill();
  X.restore();
}
function eye(cx, cy, s, col, open = 1) {
  X.save(); X.strokeStyle = col; X.fillStyle = col; X.lineWidth = Math.max(2, s * 0.12);
  const h = s * 0.55 * open;
  X.beginPath(); X.moveTo(cx - s, cy); X.quadraticCurveTo(cx, cy - h * 1.6, cx + s, cy); X.quadraticCurveTo(cx, cy + h * 1.6, cx - s, cy); X.closePath(); X.stroke();
  if (open > 0.3) { X.beginPath(); X.arc(cx, cy, s * 0.32 * open, 0, Math.PI * 2); X.fill(); }
  X.restore();
}
function pill(x, y, label, o = {}) {
  const size = o.size || 16;
  X.save(); setFont(F.m, 700, size, 3);
  const icon = o.icon ? size * 1.5 : 0;
  const w = X.measureText(label).width + icon + size * 1.6, h = size * 2;
  X.globalAlpha *= o.alpha ?? 1;
  X.fillStyle = o.fill || C.mauve;
  X.beginPath(); X.roundRect(x, y - h / 2, w, h, 3); X.fill();
  const col = o.color || '#fff';
  if (o.icon === 'eye') eye(x + size * 0.8 + size * 0.55, y, size * 0.55, col);
  if (o.icon === 'lock') lock(x + size * 0.8 + size * 0.5, y - size * 0.05, size * 0.5, col);
  X.fillStyle = col; X.textBaseline = 'middle'; X.fillText(label, x + size * 0.8 + icon, y + 1);
  X.restore();
  return w;
}
function brackets(x, y, w, h, col, len = 22, lw = 3) {
  X.save(); X.strokeStyle = col; X.lineWidth = lw; X.beginPath();
  for (const [px, py, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
    X.moveTo(px, py + sy * len); X.lineTo(px, py); X.lineTo(px + sx * len, py);
  }
  X.stroke(); X.restore();
}

/* ---------- logo (vector-traced from the brand mark: five facets) ---------- */
const FACETS = [
  [[192, 107], [95, 233], [165, 346], [263, 203]],
  [[190, 59], [115, 196], [187, 101]],
  [[198, 49], [195, 100], [265, 192], [275, 84]],
  [[280, 108], [271, 199], [300, 234]],
  [[269, 206], [171, 354], [262, 353], [300, 248]],
];
const LOGO_C = { cx: 197.5, cy: 201.5, h: 305 };
const CENT = FACETS.map(p => [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length]);
const TONE = {
  brand: ['#523542', '#5e4250', '#6d5262', '#8a7380', '#76606b'],
  light: ['#8f6579', '#a07a8c', '#b48da0', '#dcc6d1', '#bfa0af'],
};
// off(i) -> { dx, dy, rot, s, a } per facet (in logo units)
function logo(cx, cy, h, o = {}) {
  const k = h / LOGO_C.h, cols = TONE[o.tone || 'light'];
  X.save(); X.translate(cx, cy); X.scale(k, k); X.translate(-LOGO_C.cx, -LOGO_C.cy);
  if (o.alpha !== undefined) X.globalAlpha *= o.alpha;
  for (let i = 0; i < 5; i++) {
    const f = o.off ? o.off(i) : {};
    if (f.a === 0) continue;
    const [fx, fy] = CENT[i];
    X.save();
    X.translate(fx + (f.dx || 0), fy + (f.dy || 0)); X.rotate(f.rot || 0); X.scale(f.s ?? 1, f.s ?? 1); X.translate(-fx, -fy);
    if (f.a !== undefined) X.globalAlpha *= f.a;
    X.beginPath(); FACETS[i].forEach((q, j) => j ? X.lineTo(q[0], q[1]) : X.moveTo(q[0], q[1])); X.closePath();
    X.fillStyle = o.fill || cols[i]; X.fill();
    if (o.edge) { X.strokeStyle = o.edge; X.lineWidth = 2.5 / k; X.lineJoin = 'round'; X.stroke(); }
    X.restore();
  }
  X.restore();
}
// facets fly in from outside and slam into place at times lands[i]
function assemble(t, lands, dist = 900, dur = 0.28) {
  return i => {
    const t1 = lands[i], p = seg(t, t1 - dur, t1);
    if (p <= 0) return { a: 0 };
    const [fx, fy] = CENT[i];
    let ax = fx - LOGO_C.cx, ay = fy - LOGO_C.cy; const l = Math.hypot(ax, ay) || 1; ax /= l; ay /= l;
    const q = 1 - E.inCubic(p), d = t - t1;
    const pop = d > 0 ? 1 + 0.08 * Math.exp(-d * 10) * Math.cos(d * 30) : 1;
    return { dx: ax * dist * q, dy: ay * dist * q, rot: (R(i * 3.3) - 0.5) * 2.4 * q, s: pop, a: clamp(p * 4) };
  };
}

/* ---------- seismograph line (the brand motif) ---------- */
const SPIKES = [[0.5, .25], [0.75, .25], [1.0, .25], [1.25, .25], [1.5, .35], [2.0, 1], [5.0, .5], [8.75, .45], [13.0, 1],
  [17.4, .35], [19.25, .6], [21, .45], [23, .45], [25, .45], [28.5, .9]];
function energy(t) {
  let e = 0;
  for (const [st, m] of SPIKES) { const d = t - st; if (d >= 0 && d < 3) e = Math.max(e, m * Math.exp(-d * 3.2)); }
  return e + beatPulse(t) * 0.12;
}
function seismo(y, t, o = {}) {
  const amp = o.amp ?? 10, step = 5, cx = o.cx ?? W / 2, spread = o.spread ?? 700;
  X.save(); X.globalAlpha *= o.alpha ?? 1;
  X.strokeStyle = o.color || C.tint; X.lineWidth = o.lw || 2; X.lineJoin = 'round';
  X.beginPath();
  for (let x = o.x0 ?? 0; x <= (o.x1 ?? W); x += step) {
    const n = Math.floor((x + t * 900) / step);
    const env = 0.15 + 0.85 * Math.exp(-Math.pow((x - cx) / spread, 2));
    const v = (R(n * 0.73) - 0.5) * 2 * (0.3 + 0.7 * R(n * 1.31 + 5)) + Math.sin(x * 0.02 + t * 6) * 0.25;
    const yy = y + v * amp * env;
    x === (o.x0 ?? 0) ? X.moveTo(x, yy) : X.lineTo(x, yy);
  }
  X.stroke(); X.restore();
}

/* ---------- onchain transaction feed ---------- */
const NAMES = ['USDC', 'USDT', 'ETH', 'DAI', 'USDC', 'WBTC'];
const hex = (seed, n) => { let s = ''; for (let i = 0; i < n; i++) s += '0123456789abcdef'[Math.floor(R(seed + i * 1.7) * 16)]; return s; };
const addr = seed => `0x${hex(seed, 4)}…${hex(seed + 50, 4)}`;
function amount(seed) {
  const v = Math.floor(Math.pow(10, 2 + R(seed) * 5) * 100) / 100;
  return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
const COLS = [140, 430, 770, 1460, 1500, 1720]; // block, from, to, amount(right), asset, status
// o.shieldX: cells left of this x are shielded; o.alpha; o.speed
function feed(t, o = {}) {
  const rh = 58, off = t * (o.speed ?? 60), first = Math.floor(off / rh);
  X.save(); X.globalAlpha *= o.alpha ?? 1;
  const sx = o.shieldX ?? -1e4, fr = Math.floor(t * 30);
  for (let r = first - 1; r < first + H / rh + 2; r++) {
    const y = r * rh - off + 40;
    const s = r * 13.37;
    const cells = [
      [COLS[0], `#${(19284551 + r).toLocaleString('en-US')}`, 'left', C.g500, false],
      [COLS[1], addr(s), 'left', C.g300, true],
      [COLS[2], addr(s + 9), 'left', C.g300, true],
      [COLS[3], amount(s + 3), 'right', '#fff', true],
      [COLS[4], NAMES[Math.floor(R(s + 4) * NAMES.length)], 'left', C.g400, true],
    ];
    X.fillStyle = 'rgba(255,255,255,0.05)'; X.fillRect(140, y + 20, W - 280, 1);
    for (const [cx, str, al, col, secret] of cells) {
      const w = measure(str, { fam: F.m, wt: 500, size: 22 });
      const x0 = al === 'right' ? cx - w : cx;
      if (secret && x0 + w < sx - 150) {
        // shielded: solid bar + lock
        X.fillStyle = 'rgba(130,90,109,0.55)'; X.beginPath(); X.roundRect(x0, y - 18, w, 24, 3); X.fill();
        lock(x0 + 14, y - 6, 8, C.tint);
      } else if (secret && x0 < sx) {
        text(str.replace(/[^ ]/g, (_, i) => GL[Math.floor(R(i + fr * 3.1 + r) * GL.length)]), cx, y, { fam: F.m, wt: 500, size: 22, color: C.tint, align: al });
      } else text(str, cx, y, { fam: F.m, wt: 500, size: 22, color: col, align: al });
    }
    const shielded = COLS[5] < sx;
    if (shielded) { check(COLS[5] + 8, y - 7, 7, C.tint); text('VERIFIED', COLS[5] + 28, y, { fam: F.m, wt: 700, size: 18, ls: 2, color: C.tint }); }
    else { eye(COLS[5] + 8, y - 7, 9, C.g500); text('PUBLIC', COLS[5] + 28, y, { fam: F.m, wt: 700, size: 18, ls: 2, color: C.g500 }); }
  }
  X.restore();
  for (const [y0, y1] of [[-60, 240], [H + 60, H - 240]]) {
    const g = X.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, 'rgba(22,22,22,1)'); g.addColorStop(0.45, 'rgba(22,22,22,0.9)'); g.addColorStop(1, 'rgba(22,22,22,0)');
    X.fillStyle = g; X.fillRect(0, Math.min(y0, y1), W, 300);
  }
}
function check(cx, cy, s, col, lw = 3, p = 1) {
  X.save(); X.strokeStyle = col; X.lineWidth = lw; X.lineCap = 'round'; X.lineJoin = 'round';
  const l = s * 3.6; X.setLineDash([l * p, 1e4]);
  X.beginPath(); X.moveTo(cx - s, cy); X.lineTo(cx - s * 0.3, cy + s * 0.7); X.lineTo(cx + s, cy - s * 0.75); X.stroke(); X.restore();
}

/* ---------- backgrounds ---------- */
function grid(col) {
  X.save(); X.fillStyle = col;
  for (let x = 120; x < W; x += 120) X.fillRect(x, 0, 1, H);
  for (let y = 60; y < H; y += 120) X.fillRect(0, y, W, 1);
  X.restore();
}
function bgDark(t, glow = 1, col = C.black) {
  X.fillStyle = col; X.fillRect(0, 0, W, H);
  grid('rgba(255,255,255,0.028)');
  if (glow > 0) {
    const g = X.createRadialGradient(W / 2, H * 0.55, 0, W / 2, H * 0.55, 1000);
    g.addColorStop(0, `rgba(130,90,109,${0.22 * glow * (1 + beatPulse(t) * 0.5)})`); g.addColorStop(1, 'rgba(130,90,109,0)');
    X.fillStyle = g; X.fillRect(0, 0, W, H);
  }
}

/* ---------- events (flash / shake / glitch), synced with the soundtrack ---------- */
// [time, flash, shake, glitch]
const HITS = [
  [2.0, .85, 26, .6], [3.0, 0, 0, .5], [5.0, .3, 14, .35], [6.0, 0, 0, .5], [8.75, .25, 10, .35], [10.0, 0, 0, .55],
  [13.0, 1, 36, .8], [16.0, 0, 0, .5], [17.4, .2, 6, .2], [19.25, .45, 18, .45], [21, .2, 10, .55], [23, .2, 10, .55],
  [25, .2, 10, .55], [27, 0, 8, .35], [27.25, 0, 8, .35], [28.5, .8, 24, .6],
];
function fx(t) {
  let flash = 0, shake = 0, glitch = 0;
  for (const [ht, f, s, g] of HITS) {
    const d = t - ht; if (d < 0 || d > 1.2) continue;
    flash = Math.max(flash, f * Math.exp(-d * 9));
    shake = Math.max(shake, s * Math.exp(-d * 7));
    if (d < 0.25) glitch = Math.max(glitch, g * (1 - d / 0.25));
  }
  for (const [ht, , , g] of HITS) { const d = ht - t; if (d > 0 && d < 0.05) glitch = Math.max(glitch, g * .5); }
  return { flash, shake, glitch };
}

/* ---------- post ---------- */
const VIG = (() => {
  const c = mk(), x = c.getContext('2d');
  const g = x.createRadialGradient(W / 2, H / 2, H * .45, W / 2, H / 2, H * 1.1);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.5)');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  return c;
})();
const GRAIN = [0, 1, 2, 3].map(k => {
  const c = mk(256, 256), x = c.getContext('2d'), d = x.createImageData(256, 256);
  for (let i = 0; i < 256 * 256; i++) { const v = Math.floor(R(i * 1.37 + k * 999) * 255); d.data[i * 4] = d.data[i * 4 + 1] = d.data[i * 4 + 2] = v; d.data[i * 4 + 3] = 255; }
  x.putImageData(d, 0, 0); return c;
});
function channel(col, dx) {
  TX.globalCompositeOperation = 'copy'; TX.drawImage(B, 0, 0);
  TX.globalCompositeOperation = 'multiply'; TX.fillStyle = col; TX.fillRect(0, 0, W, H);
  M.drawImage(T1, dx, 0);
}
let LIGHT = false; // white scene: softer vignette, dark flash
function post(t, f) {
  M.save();
  if (f.glitch > 0.02) {
    const dx = Math.round(f.glitch * 24);
    M.fillStyle = '#000'; M.fillRect(0, 0, W, H);
    M.globalCompositeOperation = 'lighter';
    channel('#ff0000', dx); channel('#00ff00', 0); channel('#0000ff', -dx);
    M.globalCompositeOperation = 'source-over';
    const fr = Math.floor(t * 30), n = 3 + Math.floor(f.glitch * 9);
    for (let i = 0; i < n; i++) {
      const y = Math.floor(R(fr * 3.1 + i * 17) * H), h = 6 + Math.floor(R(fr + i * 5.7) * 70);
      const off = (R(fr * 1.7 + i * 2.3) - 0.5) * f.glitch * 220;
      M.drawImage(B, 0, y, W, h, off, y, W, h);
    }
  } else M.drawImage(B, 0, 0);
  if (!LIGHT) M.drawImage(VIG, 0, 0);
  M.globalAlpha = LIGHT ? 0.035 : 0.06; M.globalCompositeOperation = 'overlay';
  const fr = Math.floor(t * 30), g = GRAIN[fr % 4];
  const ox = Math.floor(R(fr) * 256), oy = Math.floor(R(fr + 7) * 256);
  for (let x = -ox; x < W; x += 256) for (let y = -oy; y < H; y += 256) M.drawImage(g, x, y);
  M.globalCompositeOperation = 'source-over'; M.globalAlpha = 1;
  if (f.flash > 0.01) {
    M.globalCompositeOperation = 'lighter';
    M.fillStyle = `rgba(240,225,232,${f.flash * 0.6})`; M.fillRect(0, 0, W, H);
    M.globalCompositeOperation = 'source-over';
  }
  const fade = 1 - seg(t, 0, 0.2);
  if (fade > 0) { M.fillStyle = `rgba(22,22,22,${fade})`; M.fillRect(0, 0, W, H); }
  M.restore();
}

/* ---------- HUD ---------- */
const CHAPTERS = [[3, 10, 'THE PROBLEM'], [10, 13, 'THE QUESTION'], [13, 21, 'THE ANSWER'], [21, 27, 'WHY IT MATTERS'], [27, 28.5, 'THE FUTURE']];
function hud(t) {
  if (t < 3 || t >= 28.5) return;
  const light = t >= 10 && t < 12.75;
  const fg = light ? C.black : '#fff', dim = light ? C.g500 : C.g400;
  logo(84, 66, 30, { tone: light ? 'brand' : 'light' });
  text('SEISMIC', 112, 74, { fam: F.m, wt: 700, size: 18, ls: 6, color: fg });
  const ch = CHAPTERS.find(c => t >= c[0] && t < c[1]);
  if (ch) {
    const p = seg(t, ch[0], ch[0] + 0.4);
    text(scramble(ch[2], p, t, ch[0]), W - 80, 74, { fam: F.m, wt: 500, size: 16, ls: 5, color: dim, align: 'right' });
  }
  const s = Math.floor(t), fr = Math.floor((t % 1) * 60);
  text(`00:${String(s).padStart(2, '0')}:${String(fr).padStart(2, '0')}`, 80, H - 56, { fam: F.m, wt: 500, size: 15, ls: 4, color: dim });
  dot(W - 88, H - 61, 5, light ? C.purple : C.tint, 0.4 + 0.6 * beatPulse(t));
  text('FINANCIAL PRIVACY · ONCHAIN', W - 106, H - 56, { fam: F.m, wt: 500, size: 15, ls: 4, color: dim, align: 'right' });
}

/* =====================================================================
   SCENES  (all times absolute, in seconds)
   ===================================================================== */
function burst(cx, cy, t, t0, n, seed, spd = 1100, life = 1.2) {
  const d = t - t0; if (d < 0 || d > life) return;
  X.save();
  for (let i = 0; i < n; i++) {
    const a = R(i + seed) * Math.PI * 2, v = spd * (0.3 + R(i + seed + 50) * 0.9);
    const k = (1 - Math.exp(-d * 3.5)) / 3.5;
    const x = cx + Math.cos(a) * v * k, y = cy + Math.sin(a) * v * k;
    const s = 4 + R(i + seed + 9) * 12;
    X.globalAlpha = 1 - d / life;
    X.fillStyle = i % 3 ? C.tint : i % 2 ? '#fff' : C.mauve;
    X.save(); X.translate(x, y); X.rotate(a + d * 6 * (R(i) - 0.5));
    X.beginPath(); X.moveTo(0, -s); X.lineTo(s * 0.7, s * 0.6); X.lineTo(-s * 0.6, s * 0.4); X.closePath(); X.fill();
    X.restore();
  }
  X.restore();
}
function shock(cx, cy, t, t0, maxR = 1200) {
  for (let j = 0; j < 3; j++) {
    const p = seg(t, t0 + j * 0.09, t0 + 0.9 + j * 0.09);
    if (p > 0 && p < 1) ring(cx, cy, E.outCubic(p) * maxR * (1 - j * 0.18), j === 1 ? '#fff' : C.tint, (1 - p) * 18, (1 - p) * 0.9);
  }
}

/* ---- 1. INTRO 0–3: the mark assembles on the beat ---- */
function sIntro(t) {
  bgDark(t, seg(t, 1.5, 2.0));
  seismo(540, t, { amp: 4 + 260 * energy(t), alpha: 0.55, spread: 520 });
  const pop = t >= 2 ? 1 + 0.1 * Math.exp(-(t - 2) * 6) * Math.cos((t - 2) * 22) : 1;
  const h = 400 * pop;
  logo(960, 470, h, { off: assemble(t, [1.5, 0.5, 0.75, 1.0, 1.25], 1100) });
  shock(960, 470, t, 2.0, 1300);
  burst(960, 470, t, 2.0, 90, 11);
  if (t < 2) {
    const blink = Math.floor(t * 4) % 2 ? 1 : 0.2;
    const lx = 960 - measure('DETECTING SIGNAL', { fam: F.m, wt: 500, size: 20, ls: 8 }) / 2;
    dot(lx - 26, 873, 6, C.tint, blink);
    text(typed('DETECTING SIGNAL', seg(t, 0.1, 0.7)), lx, 880, { fam: F.m, wt: 500, size: 20, ls: 8, color: C.g400 });
  } else {
    letters('SEISMIC', 960, 880, { size: 110, wt: 600, ls: 34, align: 'center' }, t, 2.05, 0.045);
  }
}

/* ---- 2. PUBLIC 3–6: every transaction is public ---- */
function sPublic(t) {
  bgDark(t, 0);
  const push = 1 + 0.04 * seg(t, 3, 6);
  X.save(); X.translate(W / 2, H / 2); X.scale(push, push); X.translate(-W / 2, -H / 2);
  feed(t, { alpha: 0.28 + 0.4 * Math.exp(-Math.max(0, t - 5) * 3) * (t >= 5 ? 1 : 0), speed: 90 });
  const g = X.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, 'rgba(22,22,22,0.95)'); g.addColorStop(0.6, 'rgba(22,22,22,0.7)'); g.addColorStop(1, 'rgba(22,22,22,0.2)');
  X.fillStyle = g; X.fillRect(0, 0, W, H);
  text(typed("ON TODAY'S BLOCKCHAINS", seg(t, 3.0, 3.4)), 140, 250, { fam: F.m, wt: 700, size: 22, ls: 8, color: C.tint });
  const o = { size: 210, wt: 700, ls: -6 };
  rise('EVERY', 130, 470, o, t, 3.5, 0.35);
  rise('TRANSACTION', 130, 680, o, t, 4.0, 0.35);
  const wi = rise('IS', 130, 890, o, t, 4.5, 0.35);
  if (t >= 5.0) {
    const k = 1 + 0.08 * Math.exp(-(t - 5) * 8);
    X.save(); X.translate(130 + wi + 60, 890); X.scale(k, k);
    rise('PUBLIC.', 0, 0, { ...o, color: C.tint }, t, 5.0, 0.25);
    X.restore();
  }
  X.restore();
}

/* ---- 3. EXPOSED 6–10: a wallet, fully readable ---- */
const WAL = { x: 100, y: 190, w: 760, h: 720 };
const ACT = [
  ['→', 'Northwind Supply Co.', '−184,200.00'],
  ['→', 'Payroll · 42 employees', '−612,450.00'],
  ['←', 'Client · Helix Labs', '+1,050,000.00'],
  ['→', 'Vendor · Arcadia Parts', '−73,980.00'],
];
const RET = [ // reticle targets [time, x, y, w, h, label]
  [6.75, 130, 345, 700, 130, 'BALANCE'],
  [7.25, 130, 590, 700, 62, 'SUPPLIER'],
  [7.75, 130, 660, 700, 62, 'PAYROLL'],
  [8.25, 130, 575, 700, 300, 'HISTORY'],
];
function sExposed(t) {
  bgDark(t, 0.6);
  const enter = E.outExpo(seg(t, 6.0, 6.5));
  X.save(); X.translate(-(1 - enter) * 200, 0); X.globalAlpha = enter;
  X.fillStyle = '#1c1c1b'; X.strokeStyle = C.g800; X.lineWidth = 2;
  X.beginPath(); X.roundRect(WAL.x, WAL.y, WAL.w, WAL.h, 6); X.fill(); X.stroke();
  text('WALLET', 150, 262, { fam: F.m, wt: 700, size: 18, ls: 5, color: C.g500 });
  text('0x4f2a…9e1c', 270, 262, { fam: F.m, wt: 500, size: 18, ls: 2, color: C.g300 });
  pill(WAL.x + WAL.w - 170, 256, 'MAINNET', { fill: C.g800, color: C.g400, size: 14 });
  X.fillStyle = C.g800; X.fillRect(150, 292, 660, 1);
  text('TOTAL BALANCE', 150, 375, { fam: F.m, wt: 500, size: 18, ls: 5, color: C.g500 });
  const bal = 2481903.17 * E.outExpo(seg(t, 6.05, 6.8));
  text('$' + bal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), 146, 460, { size: 96, wt: 500, ls: -2 });
  X.fillStyle = C.g800; X.fillRect(150, 515, 660, 1);
  text('RECENT ACTIVITY', 150, 565, { fam: F.m, wt: 500, size: 18, ls: 5, color: C.g500 });
  ACT.forEach(([dir, name, amt], i) => {
    const a = E.outCubic(seg(t, 6.3 + i * 0.1, 6.6 + i * 0.1)), y = 632 + i * 70;
    X.save(); X.globalAlpha *= a; X.translate(0, (1 - a) * 20);
    text(dir, 150, y, { fam: F.m, wt: 700, size: 26, color: dir === '←' ? C.tint : C.g400 });
    text(name, 192, y, { size: 29, wt: 500, color: '#fff' });
    text(amt, 810, y, { fam: F.m, wt: 500, size: 26, color: C.g300, align: 'right' });
    X.restore();
  });
  // reticle hunts across the card
  if (t >= 6.55) {
    let k = 0; while (k + 1 < RET.length && t >= RET[k + 1][0] - 0.25) k++;
    const prev = RET[Math.max(0, k - 1)], cur = RET[k];
    const p = k === 0 ? 1 : E.outExpo(seg(t, cur[0] - 0.25, cur[0]));
    const r = [1, 2, 3, 4].map(j => lerp(prev[j], cur[j], p));
    brackets(r[0], r[1], r[2], r[3], C.tint, 24, 3);
    X.save(); X.globalAlpha *= 0.12; X.fillStyle = C.mauve; X.fillRect(r[0], r[1], r[2], r[3]); X.restore();
    RET.forEach((q, j) => {
      const a = E.outExpo(seg(t, q[0], q[0] + 0.2));
      const py = j === 3 ? q[2] + q[4] - 14 : q[2] + q[4] / 2;
      if (a > 0) pill(WAL.x + WAL.w + 22 - (1 - a) * 30, py, `${q[5]} — VISIBLE`, { icon: 'eye', alpha: a, size: 14 });
    });
  }
  X.restore();
  // right column
  const lines = [['Your balance.', 6.5], ['Your payments.', 7.0], ['Your suppliers.', 7.5], ['Your entire history.', 8.0]];
  const cur = lines.reduce((c, l, i) => t >= l[1] ? i : c, -1);
  lines.forEach(([s, t0], i) => rise(s, 1170, 380 + i * 96, { size: 66, wt: 500, ls: -1.5, color: i === cur && t < 8.75 ? '#fff' : C.g500 }, t, t0, 0.4));
  rise('Visible to everyone.', 1170, 800, { size: 68, wt: 700, ls: -1.5, color: C.tint }, t, 8.75, 0.3);
  text(typed('— INCLUDING YOUR COMPETITORS.', seg(t, 9.2, 9.6)), 1172, 862, { fam: F.m, wt: 500, size: 18, ls: 4, color: C.g400 });
  // observers wake up everywhere
  if (t >= 8.75) {
    const spots = [[1240, 190], [1800, 230], [1100, 975], [1640, 975], [960, 150], [1830, 560]];
    spots.forEach(([x, y], i) => {
      const a = E.outExpo(seg(t, 8.75 + i * 0.06, 9.0 + i * 0.06));
      if (a <= 0) return;
      eye(x, y, 26, C.tint, a * (Math.floor(t * 3 + i) % 5 ? 1 : 0.15));
      text(`OBSERVER_${hex(i * 9, 4)}`, x, y + 44, { fam: F.m, wt: 500, size: 13, ls: 2, color: C.g500, align: 'center', alpha: a });
    });
  }
}

/* ---- 4. QUESTION 10–13: the page turns white ---- */
function sQuestion(t) {
  X.fillStyle = C.g50; X.fillRect(0, 0, W, H);
  grid('rgba(0,0,0,0.045)');
  // huge ghost question mark
  X.save(); X.translate(1640, 640); X.rotate(0.08 - 0.05 * seg(t, 10, 13));
  text('?', 0, 0, { size: 1100, wt: 700, color: C.g200, align: 'center', alpha: E.outCubic(seg(t, 10, 10.6)) });
  X.restore();
  text(typed('THE BIGGER QUESTION', seg(t, 10.0, 10.35)), 140, 210, { fam: F.m, wt: 700, size: 22, ls: 8, color: C.g500 });
  X.fillStyle = C.purple; X.fillRect(140, 238, 220 * E.outExpo(seg(t, 10, 10.5)), 3);
  const o = { size: 136, wt: 500, ls: -4, color: C.black };
  rise('Why should a', 132, 390, o, t, 10.0, 0.4);
  rise('public blockchain', 132, 540, o, t, 10.5, 0.4);
  rise('automatically mean', 132, 690, o, t, 11.0, 0.4);
  const pw = rise('public ', 132, 840, { ...o, color: C.purple }, t, 11.5, 0.4);
  const bo = { ...o, wt: 700, color: C.purple }, bx = 132 + pw;
  rise('balances?', bx, 840, bo, t, 11.62, 0.4);
  // marker sweep: highlight bar slides under the word and inverts it
  const mp = E.inOutExpo(seg(t, 12.0, 12.35));
  if (mp > 0) {
    const bw = measure('balances?', bo);
    X.save(); X.fillStyle = C.mauve; X.fillRect(bx - 16, 840 - 118, (bw + 32) * mp, 150);
    X.beginPath(); X.rect(bx - 16, 840 - 118, (bw + 32) * mp, 150); X.clip();
    text('balances?', bx, 840, { ...bo, color: '#fff' });
    X.restore();
  }
  // black panel wipes up into the drop
  const wp = E.inOutExpo(seg(t, 12.5, 12.9));
  if (wp > 0) { X.fillStyle = C.black; X.fillRect(0, H * (1 - wp), W, H * wp); }
}

/* ---- 5. DROP 12.75–16: enter Seismic ---- */
function sDrop(t) {
  const L = { x: 960, y: 440, h: 420 };
  const zoom = 1 + 14 * E.inExpo(seg(t, 15.55, 16.0));
  if (t >= 13) {
    bgDark(t, 1);
    seismo(L.y, t, { amp: 6 + 320 * energy(t), alpha: 0.5, spread: 600 });
  }
  X.save();
  // zoom out through the main facet into the next scene
  const fx0 = L.x + (CENT[0][0] - LOGO_C.cx) * L.h / LOGO_C.h, fy0 = L.y + (CENT[0][1] - LOGO_C.cy) * L.h / LOGO_C.h;
  X.translate(fx0, fy0); X.scale(zoom, zoom); X.translate(-fx0, -fy0);
  if (t >= 13) {
    // rotating dashed orbit
    X.save(); X.translate(L.x, L.y); X.rotate(t * 0.4); X.setLineDash([4, 14]);
    ring(0, 0, 330 + 20 * beatPulse(t), C.g500, 2, E.outCubic(seg(t, 13.1, 13.6)) * 0.7);
    X.restore();
  }
  const pop = t >= 13 ? 1 + 0.12 * Math.exp(-(t - 13) * 6) * Math.cos((t - 13) * 22) : 1;
  logo(L.x, L.y, L.h * pop, { off: assemble(t, [13, 13, 13, 13, 13].map((v, i) => v - 0.02 * i), 1500, 0.24) });
  X.restore();
  if (t < 13) return;
  shock(L.x, L.y, t, 13.0, 1500);
  burst(L.x, L.y, t, 13.0, 140, 77, 1500, 1.4);
  const ta = 1 - seg(t, 15.5, 15.75);
  X.save(); X.globalAlpha = ta;
  letters('SEISMIC', 960, 850, { size: 130, wt: 600, ls: 40, align: 'center' }, t, 13.25, 0.05);
  text(scramble('PRIVACY-FOCUSED BLOCKCHAIN INFRASTRUCTURE', seg(t, 14.0, 14.7), t, 4), 960, 925, { fam: F.m, wt: 500, size: 22, ls: 8, color: C.tint, align: 'center' });
  X.restore();
}

/* ---- 6. SHIELD 16–21: the same feed, now confidential ---- */
function sShield(t) {
  bgDark(t, 0.5);
  const sx = lerp(-200, W + 400, E.inOutCubic(seg(t, 16.25, 17.4)));
  const dim = 1 - 0.7 * E.outCubic(seg(t, 17.4, 17.9));
  feed(t, { alpha: 0.9 * dim, speed: 60, shieldX: sx });
  if (sx > -100 && sx < W + 100) {
    const g = X.createLinearGradient(sx - 420, 0, sx, 0);
    g.addColorStop(0, 'rgba(130,90,109,0)'); g.addColorStop(1, 'rgba(130,90,109,0.45)');
    X.fillStyle = g; X.fillRect(sx - 420, 0, 420, H);
    X.fillStyle = '#fff'; X.fillRect(sx - 2, 0, 4, H);
    X.fillStyle = C.tint; X.fillRect(sx - 12, 0, 8, H);
  }
  // headline 1
  const out1 = E.inExpo(seg(t, 18.5, 18.75));
  if (t >= 17.4 && out1 < 1) {
    X.save(); X.translate(0, -out1 * 120); X.globalAlpha = 1 - out1;
    text(typed('CONFIDENTIAL EXECUTION · PROTECTED DATA', seg(t, 17.4, 17.8)), 960, 360, { fam: F.m, wt: 700, size: 20, ls: 8, color: C.tint, align: 'center' });
    rise('Confidential', 960, 560, { size: 170, wt: 600, ls: -5, align: 'center' }, t, 17.5, 0.35);
    rise('smart contracts.', 960, 740, { size: 170, wt: 600, ls: -5, align: 'center', color: C.tint }, t, 17.75, 0.35);
    X.restore();
  }
  // headline 2
  if (t >= 18.75) {
    rise('Onchain.', 960, 540, { size: 230, wt: 700, ls: -8, align: 'center' }, t, 18.75, 0.3);
    const k = t >= 19.25 ? 1 + 0.07 * Math.exp(-(t - 19.25) * 8) : 1;
    X.save(); X.translate(960, 780); X.scale(k, k);
    rise('Not on display.', 0, 0, { size: 230, wt: 700, ls: -8, align: 'center', color: C.tint }, t, 19.25, 0.25);
    X.restore();
    const lp = E.outExpo(seg(t, 19.9, 20.4));
    X.fillStyle = C.g800; X.fillRect(960 - 360 * lp, 860, 720 * lp, 1);
    text(typed('YOUR DATA STAYS YOURS', seg(t, 20.0, 20.45)), 960, 915, { fam: F.m, wt: 500, size: 20, ls: 8, color: C.g400, align: 'center' });
  }
  // flash of the main facet colour carried over from the zoom
  const carry = 1 - E.outCubic(seg(t, 16.0, 16.35));
  if (carry > 0) { X.fillStyle = `rgba(143,101,121,${carry})`; X.fillRect(0, 0, W, H); }
}

/* ---- 7. PILLARS 21–27: why it matters ---- */
const PILLARS = [
  { bg: C.black, title: ['Financial', 'Privacy.'], sub: 'Use blockchain without exposing every detail of your finances.' },
  { bg: C.mauve, title: ['Private Stablecoin', 'Payments.'], sub: 'Everyday and cross-border payments, without broadcasting the amounts.' },
  { bg: C.purple, title: ['The Next Generation', 'of DeFi.'], sub: 'Protect sensitive user data. Keep the benefits of onchain infrastructure.' },
];
function shield(cx, cy, s, col, p) {
  X.save(); X.strokeStyle = col; X.lineWidth = 5; X.lineJoin = 'round';
  X.beginPath();
  X.moveTo(cx, cy - s); X.lineTo(cx + s * 0.85, cy - s * 0.6); X.lineTo(cx + s * 0.8, cy + s * 0.1);
  X.quadraticCurveTo(cx + s * 0.6, cy + s * 0.75, cx, cy + s * 1.05);
  X.quadraticCurveTo(cx - s * 0.6, cy + s * 0.75, cx - s * 0.8, cy + s * 0.1); X.lineTo(cx - s * 0.85, cy - s * 0.6); X.closePath();
  X.setLineDash([s * 7 * p, 1e4]); X.stroke(); X.restore();
}
function pillarIcon(i, t, lt, x, y) {
  const col = '#fff';
  if (i === 0) {
    shield(x + 80, y, 78, col, E.outCubic(seg(lt, 0.1, 0.6)));
    if (lt > 0.45) lock(x + 80, y + 8, 30 * E.outExpo(seg(lt, 0.45, 0.7)), col);
    X.save(); X.translate(x + 80, y + 4); X.rotate(t * 0.8); X.setLineDash([3, 12]);
    ring(0, 0, 130, col, 2, 0.5 * E.outCubic(seg(lt, 0.2, 0.6))); X.restore();
    for (let k = 0; k < 3; k++) {
      const a = E.outExpo(seg(lt, 0.5 + k * 0.12, 0.8 + k * 0.12));
      text(['BALANCES', 'PAYMENTS', 'HISTORY'][k], x + 260, y - 50 + k * 50, { fam: F.m, wt: 700, size: 18, ls: 5, color: col, alpha: a });
      if (a > 0) lock(x + 240, y - 56 + k * 50, 8, col);
    }
  } else if (i === 1) {
    const ax = x + 20, bx = x + 620, cy = y + 40;
    dot(ax, cy, 12, col); dot(bx, cy, 12, col);
    text('SENDER', ax, cy + 46, { fam: F.m, wt: 700, size: 15, ls: 4, color: col, align: 'center', alpha: 0.8 });
    text('ANYWHERE', bx, cy + 46, { fam: F.m, wt: 700, size: 15, ls: 4, color: col, align: 'center', alpha: 0.8 });
    const dp = E.outCubic(seg(lt, 0.05, 0.4));
    X.save(); X.strokeStyle = 'rgba(255,255,255,0.5)'; X.lineWidth = 2; X.setLineDash([6, 8]);
    X.beginPath(); for (let k = 0; k <= 40 * dp; k++) { const u = k / 40, px = lerp(ax, bx, u), py = cy - Math.sin(u * Math.PI) * 140; k ? X.lineTo(px, py) : X.moveTo(px, py); } X.stroke(); X.restore();
    for (let c = 0; c < 2; c++) {
      const u = ((lt - 0.3) * 1.1 + c * 0.5) % 1;
      if (lt < 0.3 + c * 0.45) continue;
      const px = lerp(ax, bx, u), py = cy - Math.sin(u * Math.PI) * 140;
      dot(px, py, 24, '#fff');
      text('$', px, py + 10, { size: 30, wt: 700, color: C.mauve, align: 'center' });
      pill(px + 32, py - 30, '•••• USDC', { fill: 'rgba(22,22,22,0.85)', size: 13, icon: 'lock' });
    }
  } else {
    const nodes = [];
    for (let r = 0; r < 2; r++) for (let c = 0; c < 6; c++) nodes.push([x + 20 + c * 115 + (r ? 57 : 0), y - 20 + r * 110]);
    X.save(); X.strokeStyle = 'rgba(255,255,255,0.35)'; X.lineWidth = 2;
    const lp = E.outCubic(seg(lt, 0.05, 0.4));
    nodes.forEach((n, k) => { const m = nodes[k + 1]; if (m && k !== 5) { X.beginPath(); X.moveTo(...n); X.lineTo(lerp(n[0], m[0], lp), lerp(n[1], m[1], lp)); X.stroke(); } const d = nodes[k + 6]; if (d) { X.beginPath(); X.moveTo(...n); X.lineTo(lerp(n[0], d[0], lp), lerp(n[1], d[1], lp)); X.stroke(); } });
    X.restore();
    nodes.forEach((n, k) => {
      const on = lt > 0.35 + R(k * 4.1) * 0.9;
      X.save(); X.fillStyle = on ? '#fff' : C.purple; X.strokeStyle = '#fff'; X.lineWidth = 3;
      X.beginPath(); X.roundRect(n[0] - 20, n[1] - 20, 40, 40, 6); X.fill(); X.stroke(); X.restore();
      if (on) lock(n[0], n[1] + 2, 9, C.purple);
    });
  }
}
function sPillars(t) {
  const i = Math.min(2, Math.floor((t - 21) / 2)), t0 = 21 + i * 2, lt = t - t0, P = PILLARS[i];
  X.fillStyle = P.bg; X.fillRect(0, 0, W, H);
  grid(i === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)');
  seismo(990, t, { amp: 4 + 120 * energy(t), alpha: 0.35, color: '#fff', spread: 900 });
  // giant outline numeral
  X.save(); X.beginPath(); X.rect(80, 150, 640, 700); X.clip();
  const np = E.outExpo(seg(lt, 0, 0.45));
  text(`0${i + 1}`, 100, 760 + (1 - np) * 560, { size: 520, wt: 700, ls: -20, stroke: 3, color: 'rgba(255,255,255,0.9)' });
  X.restore();
  text(typed('WHY IT MATTERS', seg(lt, 0, 0.3)), 800, 250, { fam: F.m, wt: 700, size: 20, ls: 8, color: 'rgba(255,255,255,0.7)' });
  text(`0${i + 1} / 03`, W - 140, 250, { fam: F.m, wt: 500, size: 20, ls: 6, color: 'rgba(255,255,255,0.7)', align: 'right' });
  X.fillStyle = 'rgba(255,255,255,0.25)'; X.fillRect(800, 280, (W - 940) * E.outExpo(seg(lt, 0, 0.6)), 1);
  pillarIcon(i, t, lt, 820, 430);
  const o = { size: 112, wt: 600, ls: -3.5 };
  rise(P.title[0], 796, 690, o, lt, 0.12, 0.4);
  rise(P.title[1], 796, 812, o, lt, 0.24, 0.4);
  const sa = E.outCubic(seg(lt, 0.5, 0.9));
  text(P.sub, 800, 885 + (1 - sa) * 14, { size: 30, wt: 400, color: 'rgba(255,255,255,0.75)', alpha: sa });
}

/* ---- 8. FINALE 27–30 ---- */
function sFinale(t) {
  if (t < 28.5) {
    bgDark(t, 0.7);
    const sq = E.inExpo(seg(t, 28.2, 28.5));
    X.save(); X.translate(960, 560); X.scale(1 - sq, 1 - sq * 0.9); X.translate(-960, -560);
    const a = E.outExpo(seg(t, 27.0, 27.4)), b = E.outExpo(seg(t, 27.25, 27.65));
    text('TRANSPARENCY', 960 - (1 - a) * 1500, 450, { size: 180, wt: 700, ls: -5, align: 'center' });
    text('+ PRIVACY', 960 + (1 - b) * 1500, 640, { size: 180, wt: 700, ls: -5, align: 'center', color: C.tint });
    rise('can coexist.', 960, 790, { size: 84, wt: 500, ls: -2, align: 'center', color: C.g300 }, t, 27.7, 0.4);
    X.restore();
    if (sq > 0.6) dot(960, 560, 30 * (sq - 0.6) / 0.4, '#fff');
    return;
  }
  // end card
  bgDark(t, 1);
  seismo(985, t, { amp: 4 + 140 * energy(t), alpha: 0.45, spread: 800 });
  const lw = measure('SEISMIC', { size: 150, wt: 600, ls: 24 });
  const lh = 250, logoW = 205 / 305 * lh, gap = 60, total = logoW + gap + lw, x0 = 960 - total / 2;
  const pop = 1 + 0.1 * Math.exp(-(t - 28.5) * 6) * Math.cos((t - 28.5) * 22);
  logo(x0 + logoW / 2, 450, lh * pop, { off: assemble(t, [28.5, 28.5, 28.5, 28.5, 28.5], 500, 0.15) });
  letters('SEISMIC', x0 + logoW + gap, 505, { size: 150, wt: 600, ls: 24 }, t, 28.6, 0.045);
  shock(x0 + logoW / 2, 450, t, 28.5, 1400);
  burst(x0 + logoW / 2, 450, t, 28.5, 80, 300, 1300);
  rise('Building privacy into onchain finance.', 960, 700, { size: 54, wt: 400, ls: -1, align: 'center', color: C.g300 }, t, 28.9, 0.5);
  const ma = E.outCubic(seg(t, 29.15, 29.5));
  text('CONFIDENTIAL SMART CONTRACTS  ·  PRIVATE PAYMENTS  ·  NEXT-GEN DEFI', 960, 790, { fam: F.m, wt: 500, size: 18, ls: 6, color: C.g500, align: 'center', alpha: ma });
}

/* ---------- master ---------- */
const SCENES = [
  [0, 3, sIntro], [3, 6, sPublic], [6, 10, sExposed], [10, 13, sQuestion], [12.75, 16, sDrop], [16, 21, sShield],
  [21, 27, sPillars], [27, 30.01, sFinale],
];
const POSTER_T = 29.6; // best frame, baked in as frame 0 so it becomes the idle thumbnail

function renderFrame(t) {
  if (window.POSTER && t < 1 / 120) t = POSTER_T;
  X = BX;
  LIGHT = t >= 10 && t < 12.8;
  const f = fx(t);
  X.save();
  X.setTransform(1, 0, 0, 1, 0, 0); X.globalAlpha = 1; X.globalCompositeOperation = 'source-over';
  const sx = f.shake ? (R(Math.floor(t * 60)) - 0.5) * 2 * f.shake : 0, sy = f.shake ? (R(Math.floor(t * 60) + 3) - 0.5) * 2 * f.shake : 0;
  X.translate(sx, sy);
  X.save(); X.translate(-W * 0.02, -H * 0.02); X.scale(1.04, 1.04);
  for (const [a, b, fn] of SCENES) if (t >= a && t < b) { X.save(); fn(t); X.restore(); }
  X.restore();
  X.restore();
  X.save(); hud(t); X.restore();
  post(t, f);
}

/* ---------- boot: render mode (headless) or live preview ---------- */
const FONT_SPECS = ['400 40px "ID"', '500 40px "ID"', '600 40px "ID"', '700 40px "ID"', '500 40px "JBM"', '700 40px "JBM"'];
window.ready = Promise.all(FONT_SPECS.map(f => document.fonts.load(f))).then(() => document.fonts.ready);
window.renderFrame = renderFrame;
window.DURATION = DUR;

if (/render/.test(location.search)) { document.getElementById('hint').remove(); window.POSTER = /poster/.test(location.search); }
else {
  const hint = document.getElementById('hint');
  let t0 = null, paused = true, cur = 0;
  const audio = new Audio('soundtrack.wav');
  const seek = s => { cur = clamp(s, 0, DUR); t0 = performance.now() - cur * 1000; if (!paused) audio.currentTime = cur; };
  const play = () => { paused = false; t0 = performance.now() - cur * 1000; audio.currentTime = cur; audio.play().catch(() => {}); hint.style.display = 'none'; };
  const pause = () => { paused = true; audio.pause(); };
  document.addEventListener('click', () => paused ? play() : pause());
  document.addEventListener('keydown', e => {
    if (e.code === 'Space') { e.preventDefault(); paused ? play() : pause(); }
    if (e.code === 'ArrowRight') seek(cur + 3);
    if (e.code === 'ArrowLeft') seek(cur - 3);
  });
  const params = new URLSearchParams(location.search);
  if (params.has('t')) cur = parseFloat(params.get('t'));
  window.ready.then(() => {
    const loop = now => {
      if (!paused) { cur = (now - t0) / 1000; if (cur >= DUR) { cur = 0; t0 = now; audio.currentTime = 0; } }
      renderFrame(cur);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
}
