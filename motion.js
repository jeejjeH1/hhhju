'use strict';
/* GenLayer staking — motion graphic (1920x1080). Every frame is a pure function of time t. */

const W = 1920, H = 1080, DUR = 88;
const C = {
  bg: '#06000c', pink: '#ff87ff', mag: '#dc00ff', violet: '#7a00ff', deep: '#24003f',
  cyan: '#00e5ff', blue: '#4d6bff', white: '#ffffff', red: '#ff2e63', amber: '#ffb300', mint: '#4dffb8',
};
const F = { ub: '"Unbounded"', mono: '"JBM"', sg: '"SG"' };
const GS = ['#ffc4ff', C.pink, C.mag];

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
  outBack: x => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
  outQuart: x => 1 - Math.pow(1 - x, 4),
};
const beatPulse = t => t < 2 ? 0 : Math.exp(-(((t - 2) % 0.5 + 0.5) % 0.5) * 9);

/* ---------- drawing helpers ---------- */
function setFont(fam, wt, size, ls = 0) { X.font = `${wt} ${size}px ${fam}`; X.letterSpacing = ls + 'px'; }
function gradH(x0, x1, stops = GS) {
  const g = X.createLinearGradient(x0, 0, x1, 0);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
}
function measure(s, o) { X.save(); setFont(o.fam || F.ub, o.wt || 700, o.size || 40, o.ls || 0); const w = X.measureText(s).width - (o.ls || 0); X.restore(); return w; }
function fit(s, o, maxW) { const w = measure(s, o); return w > maxW ? o.size * maxW / w : o.size; }

function text(s, x, y, o = {}) {
  if (!s) return;
  X.save();
  setFont(o.fam || F.ub, o.wt || 700, o.size || 40, o.ls || 0);
  X.textBaseline = o.base || 'alphabetic';
  const w = X.measureText(s).width - (o.ls || 0);
  let x0 = x;
  if ((o.align || 'center') === 'center') x0 = x - w / 2; else if (o.align === 'right') x0 = x - w;
  X.textAlign = 'left';
  if (o.alpha !== undefined) X.globalAlpha *= o.alpha;
  let fill = o.color || '#fff';
  if (fill === 'G') fill = gradH(x0, x0 + w, o.stops);
  if (o.glow) { X.shadowColor = o.glowColor || C.mag; X.shadowBlur = o.glow; }
  if (o.stroke) { X.strokeStyle = fill; X.lineWidth = o.stroke; X.lineJoin = 'round'; X.strokeText(s, x0, y); }
  else { X.fillStyle = fill; X.fillText(s, x0, y); if (o.glow) { X.shadowBlur = 0; X.fillText(s, x0, y); } }
  X.restore();
  return w;
}

// word-by-word masked rise
function words(s, x, y, o, t, t0, st = 0.075, d = 0.65) {
  const ws = s.split(' ');
  X.save();
  setFont(o.fam || F.ub, o.wt || 700, o.size, o.ls || 0);
  const sp = X.measureText(' ').width;
  const wd = ws.map(w => X.measureText(w).width);
  const total = wd.reduce((a, b) => a + b, 0) + sp * (ws.length - 1);
  let cx = (o.align || 'center') === 'center' ? x - total / 2 : x;
  const lineG = gradH(cx, cx + total, o.stops);
  for (let i = 0; i < ws.length; i++) {
    const p = E.outExpo(seg(t, t0 + i * st, t0 + i * st + d));
    if (p > 0) {
      X.save();
      X.beginPath(); X.rect(cx - 60, y - o.size * 1.25, wd[i] + 120, o.size * 1.6); X.clip();
      const col = (o.colors && o.colors[i]) || o.color || '#fff';
      X.fillStyle = col === 'G' ? lineG : col;
      X.globalAlpha *= p;
      if (o.glow) { X.shadowColor = o.glowColor || C.mag; X.shadowBlur = o.glow; }
      X.textAlign = 'left'; X.textBaseline = 'alphabetic';
      X.fillText(ws[i], cx, y + (1 - p) * o.size * 1.25);
      X.restore();
    }
    cx += wd[i] + sp;
  }
  X.restore();
}

const GL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&*<>/=+';
function scramble(s, p, t, seed = 1) {
  let out = ''; const n = s.length, f = Math.floor(t * 30);
  for (let i = 0; i < n; i++) {
    const ch = s[i];
    if (ch === ' ') { out += ' '; continue; }
    const th = i / n * 0.75;
    if (p >= 1 || p >= th + 0.25) out += ch;
    else if (p > th) out += GL[Math.floor(R(i * 7.3 + f * 13.1 + seed) * GL.length)];
    else out += ' ';
  }
  return out;
}
const typed = (s, p) => s.slice(0, Math.round(s.length * clamp(p)));

function wrap(s, o, maxW) {
  X.save(); setFont(o.fam, o.wt, o.size, o.ls || 0);
  const ws = s.split(' '); const lines = []; let cur = '';
  for (const w of ws) {
    const tst = cur ? cur + ' ' + w : w;
    if (X.measureText(tst).width > maxW && cur) { lines.push(cur); cur = w; } else cur = tst;
  }
  if (cur) lines.push(cur);
  X.restore(); return lines;
}

function glowLine(x0, y0, x1, y1, col, lw, glow = 18, a = 1) {
  X.save(); X.globalAlpha *= a; X.strokeStyle = col; X.lineWidth = lw; X.lineCap = 'round';
  X.shadowColor = col; X.shadowBlur = glow;
  X.beginPath(); X.moveTo(x0, y0); X.lineTo(x1, y1); X.stroke(); X.restore();
}
function hexPath(cx, cy, r, rot = Math.PI / 6) {
  X.beginPath();
  for (let i = 0; i < 6; i++) { const a = rot + i * Math.PI / 3; const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r; i ? X.lineTo(px, py) : X.moveTo(px, py); }
  X.closePath();
}
function pill(x, y, label, o = {}) {
  const size = o.size || 20;
  X.save(); setFont(F.mono, 700, size, o.ls ?? 3);
  const w = X.measureText(label).width + (o.icon ? size * 1.4 : 0) + size * 1.6, h = size * 2.1;
  const x0 = (o.align || 'center') === 'center' ? x - w / 2 : x;
  X.globalAlpha *= o.alpha ?? 1;
  const col = o.color || C.pink;
  X.fillStyle = o.fill || 'rgba(20,0,35,0.85)';
  X.beginPath(); X.roundRect(x0, y - h / 2, w, h, h / 2); X.fill();
  X.strokeStyle = col; X.lineWidth = 2; X.shadowColor = col; X.shadowBlur = o.glow ?? 16; X.stroke();
  X.shadowBlur = 0;
  let tx = x0 + size * 0.8;
  if (o.icon === 'check') { check(tx + size * 0.45, y, size * 0.5, col, 3); tx += size * 1.4; }
  if (o.icon === 'cross') { cross(tx + size * 0.45, y, size * 0.42, col, 3); tx += size * 1.4; }
  X.fillStyle = col; X.textBaseline = 'middle'; X.textAlign = 'left'; X.fillText(label, tx, y + 1);
  X.restore();
  return w;
}
function check(cx, cy, s, col, lw = 4, p = 1) {
  X.save(); X.strokeStyle = col; X.lineWidth = lw; X.lineCap = 'round'; X.lineJoin = 'round';
  X.shadowColor = col; X.shadowBlur = 10;
  const pts = [[cx - s, cy], [cx - s * 0.3, cy + s * 0.7], [cx + s, cy - s * 0.75]];
  const l1 = Math.hypot(s * 0.7, s * 0.7), l2 = Math.hypot(s * 1.3, s * 1.45);
  X.setLineDash([(l1 + l2) * p, 1e4]);
  X.beginPath(); X.moveTo(...pts[0]); X.lineTo(...pts[1]); X.lineTo(...pts[2]); X.stroke(); X.restore();
}
function cross(cx, cy, s, col, lw = 4) {
  X.save(); X.strokeStyle = col; X.lineWidth = lw; X.lineCap = 'round'; X.shadowColor = col; X.shadowBlur = 10;
  X.beginPath(); X.moveTo(cx - s, cy - s); X.lineTo(cx + s, cy + s); X.moveTo(cx + s, cy - s); X.lineTo(cx - s, cy + s); X.stroke(); X.restore();
}
function ring(cx, cy, r, col, lw, a = 1, glow = 20) {
  X.save(); X.globalAlpha *= a; X.strokeStyle = col; X.lineWidth = lw; X.shadowColor = col; X.shadowBlur = glow;
  X.beginPath(); X.arc(cx, cy, Math.max(0, r), 0, Math.PI * 2); X.stroke(); X.restore();
}
function dot(x, y, r, col, glow = 14, a = 1) {
  X.save(); X.globalAlpha *= a; X.fillStyle = col; X.shadowColor = col; X.shadowBlur = glow;
  X.beginPath(); X.arc(x, y, r, 0, Math.PI * 2); X.fill(); X.restore();
}
function qpt(p0, c, p1, t) {
  const u = 1 - t;
  return [u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]];
}
function stepper(cx, y, labels, active, done, a = 1, gap = 330) {
  X.save(); X.globalAlpha *= a;
  const n = labels.length, x0 = cx - gap * (n - 1) / 2;
  X.strokeStyle = 'rgba(255,135,255,0.25)'; X.lineWidth = 2;
  X.beginPath(); X.moveTo(x0, y); X.lineTo(x0 + gap * (n - 1), y); X.stroke();
  for (let i = 0; i < n; i++) {
    const x = x0 + gap * i, on = i === active, dn = done[i];
    const col = on ? C.pink : dn ? C.mint : 'rgba(255,255,255,0.35)';
    X.fillStyle = C.bg; X.beginPath(); X.arc(x, y, 22, 0, Math.PI * 2); X.fill();
    ring(x, y, 22, col, on ? 3 : 2, 1, on ? 22 : 0);
    if (on) ring(x, y, 22 + 10 * beatPulse(TT), col, 2, 0.5 * beatPulse(TT), 10);
    if (dn && !on) check(x, y, 9, C.mint, 3);
    else text(String(i + 1), x, y + 7, { fam: F.mono, wt: 800, size: 20, color: col });
    text(labels[i], x, y + 58, { fam: F.mono, wt: 700, size: 20, ls: 4, color: col, glow: on ? 14 : 0, glowColor: C.pink });
  }
  X.restore();
}

/* ---------- logo ---------- */
const LOGO = {
  L: [[182, 34], [20, 372], [177, 310], [122, 281], [182, 152]],
  R: [[218, 34], [218, 152], [278, 281], [223, 310], [380, 372]],
  D: [[200, 196], [166, 264], [200, 283], [234, 264]],
};
const perim = p => p.reduce((s, q, i) => s + Math.hypot(p[(i + 1) % p.length][0] - q[0], p[(i + 1) % p.length][1] - q[1]), 0);
function polyPath(p) { X.beginPath(); X.moveTo(p[0][0], p[0][1]); for (let i = 1; i < p.length; i++) X.lineTo(p[i][0], p[i][1]); X.closePath(); }
function logo(cx, cy, h, o = {}) {
  const k = h / 338;
  X.save(); X.translate(cx, cy); if (o.rot) X.rotate(o.rot); X.scale(k, k); X.translate(-200, -203);
  if (o.alpha !== undefined) X.globalAlpha *= o.alpha;
  const g = X.createLinearGradient(0, 34, 0, 372); g.addColorStop(0, o.c0 || '#ffb0ff'); g.addColorStop(.45, o.cm || C.pink); g.addColorStop(1, o.c1 || C.mag);
  for (const key of ['L', 'R', 'D']) {
    const off = (o.parts && o.parts[key]) || {};
    X.save(); X.translate(off.dx || 0, off.dy || 0); if (off.a !== undefined) X.globalAlpha *= off.a;
    polyPath(LOGO[key]);
    if (o.fill !== false) {
      if (o.glow) { X.shadowColor = o.glowColor || C.mag; X.shadowBlur = o.glow; }
      X.fillStyle = o.fill || g; X.fill(); X.shadowBlur = 0;
    }
    if (o.stroke) {
      X.shadowBlur = o.sglow || 0; X.shadowColor = o.stroke;
      X.strokeStyle = o.stroke; X.lineWidth = (o.lw || 3) / k; X.lineJoin = 'round';
      const per = perim(LOGO[key]); X.setLineDash([per * (o.sp ?? 1), per * 2]); X.stroke(); X.setLineDash([]);
    }
    X.restore();
  }
  X.restore();
}
const LOGO_PTS = (() => {
  const pts = [];
  for (const key of ['L', 'R', 'D']) {
    const p = LOGO[key];
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length], n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 9);
      for (let j = 0; j < n; j++) pts.push([lerp(a[0], b[0], j / n) - 200, lerp(a[1], b[1], j / n) - 203]);
    }
  }
  return pts;
})();

/* ---------- background ---------- */
function blob(x, y, r, col) {
  const g = X.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
  X.fillStyle = g; X.fillRect(x - r, y - r, r * 2, r * 2);
}
let BGMOOD = 0; // 0 = magenta, 1 = red alert
function background(t) {
  X.fillStyle = C.bg; X.fillRect(0, 0, W, H);
  const bp = beatPulse(t);
  X.save(); X.globalCompositeOperation = 'lighter';
  const red = BGMOOD;
  blob(W * .22 + Math.sin(t * .31) * 220, H * .28 + Math.cos(t * .23) * 120, 760, red ? `rgba(255,30,70,${.20 + .06 * bp})` : `rgba(220,0,255,${.17 + .05 * bp})`);
  blob(W * .8 + Math.cos(t * .27) * 200, H * .7 + Math.sin(t * .19) * 120, 860, red ? 'rgba(160,0,40,0.18)' : 'rgba(122,0,255,0.17)');
  blob(W * .55 + Math.sin(t * .17) * 300, H * .05, 560, red ? 'rgba(255,120,0,0.06)' : 'rgba(0,229,255,0.07)');
  X.restore();

  // perspective grid floor
  const hz = H * 0.63;
  X.save();
  X.beginPath(); X.rect(0, hz, W, H - hz); X.clip();
  const gcol = red ? '255,46,99' : '220,0,255';
  const sh = (t * 1.6) % 1;
  for (let i = 0; i < 26; i++) {
    const z = i + 1 - sh; if (z <= 0.15) continue;
    const y = hz + 380 / z; if (y > H + 5) continue;
    X.strokeStyle = `rgba(${gcol},${clamp(0.42 / Math.sqrt(z)) * (0.55 + 0.45 * bp)})`;
    X.lineWidth = 1.5; X.beginPath(); X.moveTo(0, y); X.lineTo(W, y); X.stroke();
  }
  for (let i = -22; i <= 22; i++) {
    X.strokeStyle = `rgba(${gcol},0.30)`; X.lineWidth = 1.5;
    X.beginPath(); X.moveTo(W / 2 + i * 170 / 0.3, hz + 380 / 0.3); X.lineTo(W / 2 + i * 170 / 30, hz + 380 / 30); X.stroke();
  }
  const fade = X.createLinearGradient(0, hz, 0, hz + 260);
  fade.addColorStop(0, C.bg); fade.addColorStop(1, 'rgba(6,0,12,0)');
  X.fillStyle = fade; X.fillRect(0, hz, W, 260);
  X.restore();
  // horizon glow
  X.save(); X.globalCompositeOperation = 'lighter';
  const hg = X.createLinearGradient(0, hz - 30, 0, hz + 30);
  hg.addColorStop(0, 'rgba(0,0,0,0)'); hg.addColorStop(.5, red ? 'rgba(255,46,99,0.22)' : `rgba(255,135,255,${.14 + .1 * bp})`); hg.addColorStop(1, 'rgba(0,0,0,0)');
  X.fillStyle = hg; X.fillRect(0, hz - 30, W, 60);

  // drifting particles
  for (let i = 0; i < 110; i++) {
    const sp = 12 + R(i + 3) * 40;
    const x = (R(i) * W + Math.sin(t * .4 + i) * 30 + W) % W;
    const y = ((R(i + 1) * H - t * sp) % H + H) % H;
    const s = 0.8 + R(i + 2) * 2.4;
    const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * (0.6 + R(i + 5)) + i));
    X.fillStyle = i % 3 === 0 ? `rgba(0,229,255,${.5 * tw})` : i % 3 === 1 ? `rgba(255,135,255,${.6 * tw})` : `rgba(255,255,255,${.4 * tw})`;
    X.fillRect(x, y, s, s);
  }
  X.restore();
}

/* ---------- HUD ---------- */
function hud(t) {
  const a = E.outCubic(seg(t, 5.0, 5.6)) * (1 - seg(t, 86.6, 87.6));
  if (a <= 0) return;
  X.save(); X.globalAlpha = a;
  if (t >= 5.3) logo(80, 70, 38, { glow: 14 + 14 * beatPulse(t) });
  const gw = text('GENLAYER', 112, 81, { fam: F.ub, wt: 700, size: 22, ls: 5, align: 'left' });
  text('//  STAKING, DECODED', 112 + gw + 22, 80, { fam: F.mono, wt: 500, size: 16, ls: 3, align: 'left', color: 'rgba(255,135,255,0.75)' });
  // right status
  const ep = String(Math.floor(t / 4) + 1).padStart(4, '0');
  text('@GenLayer', W - 64, 80, { fam: F.mono, wt: 700, size: 20, ls: 2, align: 'right', color: C.pink });
  text(`EPOCH ${ep}`, W - 230, 80, { fam: F.mono, wt: 500, size: 16, ls: 3, align: 'right', color: 'rgba(255,255,255,0.6)' });
  dot(W - 395, 74, 5, C.mint, 12, Math.floor(t * 2) % 2 ? 1 : 0.25);
  X.restore();
}

/* ---------- events (flash / shake / glitch), synced with the soundtrack ---------- */
// [time, flash, shake, glitch]
const HITS = [
  [2.0, .95, 30, .6], [6.0, .2, 0, .45], [9.0, .5, 16, .7], [10.0, .3, 6, .2], [12, .2, 0, .45], [20.5, .3, 8, .15],
  [22, .2, 0, .45], [23.5, .35, 14, .2], [26, .2, 0, .45], [27.5, .2, 6, 0], [32, .2, 0, .45], [39.5, .4, 16, .35],
  [42, .5, 10, .8], [43, .9, 34, .9], [46, .3, 0, .55], [48, .7, 20, .6], [54, .25, 6, .4], [60, .25, 6, .4],
  [66, .25, 6, .4], [72, .25, 6, .4], [78, .3, 0, .55], [80, .95, 34, .7], [84, .8, 18, .5],
];
function fx(t) {
  let flash = 0, shake = 0, glitch = 0;
  for (const [ht, f, s, g] of HITS) {
    const d = t - ht; if (d < 0 || d > 1.2) continue;
    flash = Math.max(flash, f * Math.exp(-d * 9));
    shake = Math.max(shake, s * Math.exp(-d * 7));
    if (d < 0.28) glitch = Math.max(glitch, g * (1 - d / 0.28));
  }
  // pre-cut glitch blip
  for (const [ht, , , g] of HITS) { const d = ht - t; if (d > 0 && d < 0.06) glitch = Math.max(glitch, g * .5); }
  return { flash, shake, glitch };
}

/* ---------- post ---------- */
const VIG = (() => {
  const c = mk(), x = c.getContext('2d');
  const g = x.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, H * 1.05);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.72)');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.fillStyle = 'rgba(0,0,0,0.08)'; for (let y = 0; y < H; y += 3) x.fillRect(0, y, W, 1);
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
function post(t, f) {
  M.save();
  if (f.glitch > 0.02) {
    const dx = Math.round(f.glitch * 26);
    M.fillStyle = '#000'; M.fillRect(0, 0, W, H);
    M.globalCompositeOperation = 'lighter';
    channel('#ff0000', dx); channel('#00ff00', 0); channel('#0000ff', -dx);
    M.globalCompositeOperation = 'source-over';
    const fr = Math.floor(t * 30);
    const n = 3 + Math.floor(f.glitch * 9);
    for (let i = 0; i < n; i++) {
      const y = Math.floor(R(fr * 3.1 + i * 17) * H), h = 6 + Math.floor(R(fr + i * 5.7) * 70);
      const off = (R(fr * 1.7 + i * 2.3) - 0.5) * f.glitch * 220;
      M.drawImage(B, 0, y, W, h, off, y, W, h);
    }
  } else M.drawImage(B, 0, 0);
  M.drawImage(VIG, 0, 0);
  // grain
  M.globalAlpha = 0.07; M.globalCompositeOperation = 'overlay';
  const g = GRAIN[Math.floor(t * 30) % 4];
  const ox = Math.floor(R(Math.floor(t * 30)) * 256), oy = Math.floor(R(Math.floor(t * 30) + 7) * 256);
  for (let x = -ox; x < W; x += 256) for (let y = -oy; y < H; y += 256) M.drawImage(g, x, y);
  M.globalCompositeOperation = 'source-over'; M.globalAlpha = 1;
  if (f.flash > 0.01) {
    M.globalCompositeOperation = 'lighter';
    M.fillStyle = `rgba(255,190,255,${f.flash * 0.55})`; M.fillRect(0, 0, W, H);
    M.globalCompositeOperation = 'source-over';
  }
  // global fade in/out
  const fade = Math.max(1 - seg(t, 0, 0.25), seg(t, 87.2, 88));
  if (fade > 0) { M.fillStyle = `rgba(0,0,0,${fade})`; M.fillRect(0, 0, W, H); }
  M.restore();
}

/* =====================================================================
   SCENES  (all times absolute, in seconds)
   ===================================================================== */
let TT = 0;
const outA = (t, e, d = 0.4) => 1 - E.inCubic(seg(t, e - d, e));

function sparks(cx, cy, t, t0, n, seed, col1, col2, spd = 900, life = 1.1) {
  const d = t - t0; if (d < 0 || d > life) return;
  X.save(); X.globalCompositeOperation = 'lighter'; X.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const a = R(i + seed) * Math.PI * 2, v = spd * (0.3 + R(i + seed + 50) * 0.9);
    const k = (1 - Math.exp(-d * 3)) / 3;
    const x = cx + Math.cos(a) * v * k, y = cy + Math.sin(a) * v * k + 120 * d * d;
    const tail = Math.exp(-d * 3) * 0.05 * v;
    X.strokeStyle = i % 2 ? col1 : col2; X.globalAlpha = (1 - d / life);
    X.lineWidth = 1.5 + R(i + seed + 9) * 2.5;
    X.beginPath(); X.moveTo(x, y); X.lineTo(x - Math.cos(a) * tail, y - Math.sin(a) * tail); X.stroke();
  }
  X.restore();
}
function shock(cx, cy, t, t0, maxR = 1200, col = C.pink, n = 3) {
  for (let j = 0; j < n; j++) {
    const p = seg(t, t0 + j * 0.1, t0 + 0.9 + j * 0.1);
    if (p > 0 && p < 1) ring(cx, cy, E.outCubic(p) * maxR * (1 - j * 0.15), j === 1 ? C.cyan : col, (1 - p) * 26, 1 - p, 30);
  }
}
function rays(cx, cy, len, t, a) {
  if (a <= 0) return;
  X.save(); X.globalCompositeOperation = 'lighter'; X.translate(cx, cy); X.rotate(t * 0.12);
  const g = X.createRadialGradient(0, 0, 0, 0, 0, len);
  g.addColorStop(0, `rgba(255,135,255,${0.35 * a})`); g.addColorStop(1, 'rgba(220,0,255,0)');
  X.fillStyle = g;
  for (let i = 0; i < 14; i++) {
    X.rotate(Math.PI * 2 / 14);
    X.beginPath(); X.moveTo(0, 0); X.lineTo(len, -len * 0.06); X.lineTo(len, len * 0.06); X.closePath(); X.fill();
  }
  X.restore();
}

/* ---- 1. INTRO: logo build ---- */
function sIntro(t) {
  const hp = E.inOutExpo(seg(t, 4.3, 5.3));
  const cx = lerp(960, 80, hp), cy = lerp(440, 70, hp), h = lerp(400, 38, hp), k = h / 338;
  rays(cx, cy, 1500 * (1 - hp), t, (t > 2 ? 1 : 0) * (1 - seg(t, 3.6, 4.6)));
  // converging particles
  if (t < 2.05) {
    X.save(); X.globalCompositeOperation = 'lighter';
    for (let i = 0; i < LOGO_PTS.length; i++) {
      const p = E.inOutCubic(seg(t, 0.1 + R(i) * 0.5, 1.45 + R(i + 1) * 0.5));
      if (p <= 0) continue;
      const a = R(i + 2) * Math.PI * 2, rr = 700 + R(i + 3) * 700;
      const sx = cx + Math.cos(a) * rr, sy = cy + Math.sin(a) * rr;
      const tx = cx + LOGO_PTS[i][0] * k, ty = cy + LOGO_PTS[i][1] * k;
      const x = lerp(sx, tx, p), y = lerp(sy, ty, p);
      X.fillStyle = i % 4 ? C.pink : C.cyan; X.globalAlpha = 0.9 * (1 - seg(t, 1.9, 2.05));
      X.beginPath(); X.arc(x, y, 2.4, 0, Math.PI * 2); X.fill();
    }
    X.restore();
  }
  if (t < 2.1) logo(cx, cy, h, { fill: false, stroke: C.pink, sp: E.inOutCubic(seg(t, 0.3, 1.6)), lw: 3, sglow: 22, alpha: 1 - seg(t, 2.0, 2.1) });
  if (t >= 1.5 && t < 5.32) {
    const f = E.inExpo(seg(t, 1.5, 2.0));
    const settle = t < 2 ? 1 : 1 + 0.16 * Math.exp(-(t - 2) * 5) * Math.cos((t - 2) * 18);
    logo(cx, cy, h * settle, {
      parts: { L: { dx: (1 - f) * -1300, a: f }, R: { dx: (1 - f) * 1300, a: f }, D: { dy: (1 - f) * -900, a: f } },
      glow: (30 + 40 * beatPulse(t)) * (1 - hp * 0.6),
    });
  }
  shock(cx, cy, t, 2.0, 1300);
  sparks(960, 440, t, 2.0, 140, 11, C.pink, C.cyan, 1300, 1.4);
  // wordmark
  const ta = 1 - E.inCubic(seg(t, 4.0, 4.45));
  if (t > 2.25 && ta > 0) {
    X.save(); X.globalAlpha = ta;
    const s = 'GENLAYER', o = { fam: F.ub, wt: 900, size: 116, ls: 22 };
    const w = measure(s, o);
    text(scramble(s, seg(t, 2.25, 3.0), t, 3), 960 - w / 2, 800, { ...o, align: 'left', color: '#fff', glow: 30 });
    const sub = typed("STAKING ISN'T WHAT YOU THINK", seg(t, 2.9, 3.5));
    text(sub, 960, 872, { fam: F.mono, wt: 700, size: 28, ls: 10, color: C.pink, glow: 16, glowColor: C.pink });
    X.restore();
  }
}

/* ---- 2. HOOK ---- */
function padlock(cx, cy, s, close, col = C.pink) {
  X.save(); X.translate(cx, cy); X.scale(s, s);
  X.strokeStyle = col; X.lineWidth = 9; X.shadowColor = col; X.shadowBlur = 20; X.lineCap = 'round';
  const lift = (1 - close) * 26;
  X.beginPath(); X.moveTo(-26, -6 - lift); X.lineTo(-26, -34 - lift); X.arc(0, -34 - lift, 26, Math.PI, 0); X.lineTo(26, -6 - lift * 0.2); X.stroke();
  const g = X.createLinearGradient(0, -10, 0, 54); g.addColorStop(0, C.pink); g.addColorStop(1, C.mag);
  X.fillStyle = g; X.beginPath(); X.roundRect(-44, -10, 88, 66, 12); X.fill();
  X.shadowBlur = 0; X.fillStyle = C.bg; X.beginPath(); X.arc(0, 16, 8, 0, Math.PI * 2); X.fill(); X.fillRect(-3, 18, 6, 18);
  X.restore();
}
function sHook(t) {
  X.globalAlpha = outA(t, 12);
  const fall = E.inCubic(seg(t, 9.12, 9.6));
  if (t < 9.6) {
    X.save(); X.globalAlpha *= 1 - fall; X.translate(0, fall * 140);
    const inA = E.outCubic(seg(t, 5.85, 6.2));
    X.globalAlpha *= inA;
    const dim = 1 - 0.45 * seg(t, 8.5, 8.95);
    X.save(); X.globalAlpha *= dim;
    padlock(960, 210, 1, E.outBack(seg(t, 6.55, 6.85)));
    if (t > 6.85 && t < 7.4) ring(960, 225, 60 + (t - 6.85) * 300, C.pink, 3, 1 - seg(t, 6.85, 7.4));
    text(typed('I USED TO THINK STAKING WAS JUST', seg(t, 6.0, 6.6)), 960, 365, { fam: F.mono, wt: 700, size: 30, ls: 6, color: C.pink });
    const o1 = { fam: F.ub, wt: 900, size: 118 };
    o1.size = fit('WAIT FOR YIELD.', o1, 1500);
    words('LOCK TOKENS,', 960, 530, o1, t, 6.5);
    words('WAIT FOR YIELD.', 960, 680, { ...o1, color: 'G', glow: 30 }, t, 7.25);
    // boring yield bar
    const bp = seg(t, 7.7, 9.0);
    if (bp > 0) {
      X.save(); X.globalAlpha *= seg(t, 7.7, 7.9);
      X.fillStyle = 'rgba(255,255,255,0.1)'; X.fillRect(660, 745, 600, 10);
      X.fillStyle = C.pink; X.fillRect(660, 745, 600 * bp * 0.07, 10);
      text(`yield… ${(bp * 0.07).toFixed(3)}%   z z z`, 960, 800, { fam: F.mono, wt: 500, size: 22, ls: 3, color: 'rgba(255,255,255,0.5)' });
      X.restore();
    }
    X.restore();
    // strike-through
    for (const [st, y] of [[9.0, 490], [9.07, 640]]) {
      const sp = E.outExpo(seg(t, st, st + 0.16));
      if (sp > 0) glowLine(240, y + 14, 240 + sp * 1440, y - 14, C.red, 16, 30);
    }
    X.restore();
  }
  // part 2
  if (t > 9.5) {
    text(typed('THEN I READ HOW', seg(t, 9.55, 9.95)), 960, 375, { fam: F.mono, wt: 700, size: 34, ls: 10, color: 'rgba(255,255,255,0.85)' });
    const s = E.outBack(seg(t, 9.95, 10.3));
    if (s > 0) {
      X.save(); X.translate(960, 545); X.scale(s, s);
      text('@GenLayer', 0, 0, { fam: F.ub, wt: 900, size: 168, color: 'G', glow: 50 + 30 * beatPulse(t) });
      X.restore();
    }
    words('DOES IT.', 960, 680, { fam: F.ub, wt: 700, size: 66 }, t, 10.3);
    const p = seg(t, 10.9, 11.4);
    text(typed("and it's a lot more interesting.", p), 960, 790, { fam: F.sg, wt: 500, size: 42, color: C.pink, glow: 14, glowColor: C.pink });
    const u = E.outExpo(seg(t, 11.35, 11.7));
    if (u > 0) glowLine(960 - 330 * u, 818, 960 + 330 * u, 818, C.cyan, 3, 14);
  }
}

/* ---- 3. JURY ---- */
const JV = [520, 740, 960, 1180, 1400].map(x => ({ x, y: 760 }));
const CT = { x: 960, y: 450 }, AIN = { x: 470, y: 335 }, WEBN = { x: 1450, y: 335 };
function globe(cx, cy, r, col) {
  X.save(); X.strokeStyle = col; X.lineWidth = 3; X.shadowColor = col; X.shadowBlur = 12;
  X.beginPath(); X.arc(cx, cy, r, 0, Math.PI * 2); X.stroke();
  X.beginPath(); X.ellipse(cx, cy, r * 0.45, r, 0, 0, Math.PI * 2); X.stroke();
  X.beginPath(); X.moveTo(cx - r, cy); X.lineTo(cx + r, cy); X.moveTo(cx - r * .85, cy - r * .5); X.lineTo(cx + r * .85, cy - r * .5); X.moveTo(cx - r * .85, cy + r * .5); X.lineTo(cx + r * .85, cy + r * .5); X.stroke();
  X.restore();
}
function chip(cx, cy, r, col, label) {
  X.save(); X.strokeStyle = col; X.lineWidth = 3; X.shadowColor = col; X.shadowBlur = 12;
  X.beginPath(); X.roundRect(cx - r, cy - r, r * 2, r * 2, 8); X.stroke();
  for (let i = -1; i <= 1; i++) for (const s of [-1, 1]) {
    X.beginPath(); X.moveTo(cx + i * r * .5, cy + s * r); X.lineTo(cx + i * r * .5, cy + s * (r + 10)); X.stroke();
    X.beginPath(); X.moveTo(cx + s * r, cy + i * r * .5); X.lineTo(cx + s * (r + 10), cy + i * r * .5); X.stroke();
  }
  X.restore();
  text(label, cx, cy + 10, { fam: F.ub, wt: 900, size: 28, color: col });
}
function dashedPath(p0, p1, prog, col, a = 1, flow = 0) {
  X.save(); X.globalAlpha *= a; X.strokeStyle = col; X.lineWidth = 2; X.setLineDash([8, 10]); X.lineDashOffset = -flow * 60;
  X.beginPath(); X.moveTo(p0[0], p0[1]); X.lineTo(lerp(p0[0], p1[0], prog), lerp(p0[1], p1[1], prog)); X.stroke(); X.restore();
}
function sJury(t) {
  X.globalAlpha = outA(t, 22);
  // title
  const ti = E.outExpo(seg(t, 12.05, 12.6));
  X.save(); X.globalAlpha *= ti; X.translate(0, (1 - ti) * 40);
  text('ON GENLAYER,', 960, 130, { fam: F.mono, wt: 700, size: 22, ls: 8, color: C.pink });
  const o = { fam: F.ub, wt: 900, size: 64 };
  const w1 = measure('VALIDATORS ARE A ', o), w2 = measure('JURY', o);
  const x0 = 960 - (w1 + w2) / 2;
  text('VALIDATORS ARE A ', x0, 205, { ...o, align: 'left' });
  text('JURY', x0 + w1, 205, { ...o, align: 'left', color: 'G', glow: 30 + 30 * beatPulse(t) });
  X.restore();

  const reP = t >= 15.0 && t < 17.2, cmP = t >= 17.2 && t < 18.9, voP = t >= 18.9;
  // links AI/WEB -> contract
  const lp = E.outCubic(seg(t, 12.9, 13.4));
  for (const n of [AIN, WEBN]) {
    const ex = n.x < 960 ? CT.x - 220 : CT.x + 220;
    dashedPath([n.x + (n.x < 960 ? 70 : -70), n.y], [ex, CT.y], lp, C.cyan, 0.7, t);
    if (t > 13.3 && t < 15.0) for (let k = 0; k < 3; k++) {
      const q = ((t - 13.3) * 0.9 + k / 3) % 1;
      dot(lerp(ex, n.x + (n.x < 960 ? 70 : -70), q), lerp(CT.y, n.y, q), 5, C.cyan, 14, 1 - seg(t, 14.7, 15));
    }
  }
  // contract -> validators links
  JV.forEach((v, i) => {
    const p = E.outCubic(seg(t, 14.25 + i * 0.05, 14.75 + i * 0.05));
    dashedPath([CT.x, CT.y + 70], [v.x, v.y - 62], p, i === 3 && t > 17.9 ? C.red : C.pink, 0.55, t);
    // code copy packets
    const q = seg(t, 14.55 + i * 0.05, 15.05 + i * 0.05);
    if (q > 0 && q < 1) dot(lerp(CT.x, v.x, E.inOutCubic(q)), lerp(CT.y + 70, v.y - 62, E.inOutCubic(q)), 7, C.pink, 18);
    // re-run: each validator also hits AI & web
    if (reP) {
      const ra = Math.min(seg(t, 15.0, 15.3), 1 - seg(t, 16.8, 17.2));
      for (const n of [AIN, WEBN]) {
        X.save(); X.globalAlpha *= 0.18 * ra; X.strokeStyle = C.cyan; X.lineWidth = 1.5;
        X.beginPath(); X.moveTo(v.x, v.y - 60); X.lineTo(n.x, n.y + 60); X.stroke(); X.restore();
        const qq = ((t - 15) * 1.3 + i * 0.17 + (n === AIN ? 0 : .5)) % 1;
        dot(lerp(n.x, v.x, qq), lerp(n.y + 60, v.y - 60, qq), 3.5, C.cyan, 10, ra);
      }
    }
    // votes travel up
    const vq = seg(t, 18.95 + i * 0.12, 19.6 + i * 0.12);
    if (vq > 0 && vq < 1) {
      const e = E.inOutCubic(vq), x = lerp(v.x, CT.x + (i - 2) * 26, e), y = lerp(v.y - 60, CT.y + 66, e);
      dot(x, y, 13, i === 3 ? C.red : C.mint, 22);
    }
  });
  // AI + WEB nodes
  for (const [n, kind, t0] of [[AIN, 'AI', 12.7], [WEBN, 'WEB', 12.85]]) {
    const s = E.outBack(seg(t, t0, t0 + 0.45));
    if (s <= 0) continue;
    X.save(); X.translate(n.x, n.y); X.scale(s, s);
    X.fillStyle = 'rgba(0,30,40,0.6)'; X.beginPath(); X.arc(0, 0, 64, 0, Math.PI * 2); X.fill();
    ring(0, 0, 64, C.cyan, 2.5, 1, 18);
    if (kind === 'AI') chip(0, 0, 24, C.cyan, 'AI'); else globe(0, 0, 30, C.cyan);
    text(kind === 'AI' ? 'AI MODELS' : 'THE WEB', 0, 104, { fam: F.mono, wt: 700, size: 20, ls: 4, color: C.cyan });
    X.restore();
  }
  // contract card
  const cs = E.outBack(seg(t, 12.3, 12.8));
  if (cs > 0) {
    X.save(); X.translate(CT.x, CT.y); X.scale(cs, cs);
    X.fillStyle = 'rgba(30,0,50,0.88)'; X.beginPath(); X.roundRect(-220, -70, 440, 140, 18); X.fill();
    X.strokeStyle = gradH(-220, 220, [C.pink, C.mag, C.cyan]); X.lineWidth = 3; X.shadowColor = C.mag; X.shadowBlur = 26 + 20 * beatPulse(t); X.stroke();
    X.shadowBlur = 0;
    text('INTELLIGENT CONTRACT', 0, -8, { fam: F.ub, wt: 700, size: 26 });
    if (t < 18.9) text('calls AI · reads the web', 0, 34, { fam: F.mono, wt: 500, size: 20, color: 'rgba(255,255,255,0.65)' });
    else {
      const votes = [0, 1, 2, 3, 4].filter(i => t > 19.6 + i * 0.12 && i !== 3).length;
      const nay = t > 19.96 ? 1 : 0;
      text(`VOTES  ${votes} ✓   ${nay} ✗`, 0, 36, { fam: F.mono, wt: 800, size: 22, ls: 2, color: C.mint });
    }
    X.restore();
  }
  // validator nodes
  JV.forEach((v, i) => {
    const s = E.outBack(seg(t, 13.9 + i * 0.08, 14.35 + i * 0.08));
    if (s <= 0) return;
    const bad = i === 3 && t > 17.85;
    const col = bad ? C.red : (t > 17.85 && t < 21 ? C.mint : C.pink);
    const shx = bad && t < 18.3 ? Math.sin(t * 90) * 6 * (1 - seg(t, 17.85, 18.3)) : 0;
    X.save(); X.translate(v.x + shx, v.y); X.scale(s, s);
    hexPath(0, 0, 60); X.fillStyle = 'rgba(25,0,40,0.92)'; X.fill();
    X.strokeStyle = col; X.lineWidth = 3; X.shadowColor = col; X.shadowBlur = 20; X.stroke(); X.shadowBlur = 0;
    logo(0, -2, 46, bad ? { c0: '#ff8aa5', cm: C.red, c1: '#a0002a' } : {});
    text(`V${i + 1}`, 0, 100, { fam: F.mono, wt: 800, size: 20, ls: 3, color: col });
    if (reP) {
      const a0 = t * (5 + i * 0.6) + i;
      X.save(); X.strokeStyle = C.cyan; X.lineWidth = 4; X.shadowColor = C.cyan; X.shadowBlur = 14; X.lineCap = 'round';
      X.globalAlpha *= Math.min(seg(t, 15, 15.2), 1 - seg(t, 16.9, 17.2));
      X.beginPath(); X.arc(0, 0, 76, a0, a0 + 2.1); X.stroke(); X.restore();
    }
    X.restore();
    // answer chip
    const ap = E.outBack(seg(t, 16.5 + i * 0.07, 16.85 + i * 0.07));
    if (ap > 0) {
      X.save(); X.translate(v.x + shx, v.y - 128); X.scale(ap, ap);
      const ac = t < 17.85 ? 'rgba(255,255,255,0.8)' : bad ? C.red : C.mint;
      X.fillStyle = 'rgba(15,0,25,0.92)'; X.beginPath(); X.roundRect(-74, -22, 148, 44, 10); X.fill();
      X.strokeStyle = ac; X.lineWidth = 2; X.shadowColor = ac; X.shadowBlur = t > 17.85 ? 16 : 0; X.stroke(); X.shadowBlur = 0;
      text(i === 3 ? 'ANSWER B' : 'ANSWER A', 0, 7, { fam: F.mono, wt: 800, size: 18, ls: 2, color: ac });
      X.restore();
    }
  });
  // compare sweep
  if (cmP || (t >= 18.9 && t < 19.3)) {
    const sp = E.inOutCubic(seg(t, 17.25, 17.85));
    const sx = lerp(JV[0].x - 110, JV[4].x + 110, sp);
    X.save(); X.globalAlpha *= 1 - seg(t, 18.9, 19.3);
    glowLine(JV[0].x - 110, 632 - 26, sx, 632 - 26, C.cyan, 2, 12);
    X.fillStyle = 'rgba(0,229,255,0.12)'; X.fillRect(sx - 40, 600, 40, 64);
    X.restore();
  }
  // consensus stamp
  const st = seg(t, 20.35, 20.55);
  if (st > 0) {
    const s = lerp(1.8, 1, E.outCubic(st));
    X.save(); X.translate(1620, 500); X.rotate(-0.12); X.scale(s, s); X.globalAlpha *= st;
    X.strokeStyle = C.mint; X.lineWidth = 5; X.shadowColor = C.mint; X.shadowBlur = 26;
    X.beginPath(); X.roundRect(-170, -48, 340, 96, 12); X.stroke();
    text('CONSENSUS', 0, 14, { fam: F.ub, wt: 900, size: 40, color: C.mint, glow: 20, glowColor: C.mint });
    X.restore();
  }
  stepper(960, 900, ['RE-RUN', 'COMPARE', 'VOTE'], reP ? 0 : cmP ? 1 : voP ? 2 : -1, [t >= 17.2, t >= 18.9, t >= 20.5], seg(t, 14.6, 15.0), 300);
}

/* ---- 4. JOIN: 42,000 GEN ---- */
function coin(x, y, rx, ry, col = C.pink, a = 1) {
  X.save(); X.globalAlpha *= a;
  const g = X.createLinearGradient(x - rx, 0, x + rx, 0); g.addColorStop(0, C.mag); g.addColorStop(.5, '#ffc6ff'); g.addColorStop(1, C.violet);
  X.fillStyle = g; X.fillRect(x - rx, y, rx * 2, 12);
  X.beginPath(); X.ellipse(x, y + 12, rx, ry, 0, 0, Math.PI); X.fill();
  X.beginPath(); X.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  X.fillStyle = '#2a0040'; X.fill(); X.strokeStyle = col; X.lineWidth = 3; X.shadowColor = col; X.shadowBlur = 14; X.stroke();
  X.restore();
}
function sJoin(t) {
  X.globalAlpha = outA(t, 26);
  text(typed('TO JOIN, A VALIDATOR PUTS UP AT LEAST', seg(t, 22.1, 22.65)), 960, 300, { fam: F.mono, wt: 700, size: 28, ls: 6, color: C.pink });
  for (const cx of [190, 1730]) {
    for (let i = 0; i < 14; i++) {
      const p = seg(t, 22.3 + i * 0.085, 22.6 + i * 0.085);
      if (p <= 0) continue;
      const y = 880 - i * 19 - (1 - E.outBack(p)) * 420;
      coin(cx, y, 92, 24, C.pink, p);
    }
  }
  const n = Math.round(42000 * E.outExpo(seg(t, 22.3, 23.5)));
  const pop = 1 + 0.18 * Math.exp(-Math.max(0, t - 23.5) * 8) * (t > 23.5 ? 1 : 0);
  const on = { fam: F.ub, wt: 900, size: 196 }, og = { fam: F.ub, wt: 700, size: 88 };
  const w1 = measure('42,000', on), w2 = measure('GEN', og), gap = 34;
  const x0 = 960 - (w1 + gap + w2) / 2;
  if (t > 22.3) {
    X.save(); X.translate(960, 520); X.scale(pop, pop); X.translate(-960, -520);
    text(n.toLocaleString('en-US'), x0 + w1, 590, { ...on, align: 'right', color: 'G', glow: 40 + 30 * beatPulse(t) });
    text('GEN', x0 + w1 + gap, 590, { ...og, align: 'left', color: '#fff', glow: 20 });
    X.restore();
  }
  words('OF THEIR OWN.', 960, 720, { fam: F.ub, wt: 700, size: 64 }, t, 23.6);
  const pa = E.outBack(seg(t, 24.2, 24.55));
  if (pa > 0) { X.save(); X.translate(960, 820); X.scale(pa, pa); pill(0, 0, 'MINIMUM SELF-STAKE · SKIN IN THE GAME', { size: 22, color: C.cyan }); X.restore(); }
}

/* ---- 5. DELEGATE: 42 GEN ---- */
function person(cx, cy, s, col) {
  X.save(); X.fillStyle = col; X.shadowColor = col; X.shadowBlur = 16;
  X.beginPath(); X.arc(cx, cy - s * 0.35, s * 0.32, 0, Math.PI * 2); X.fill();
  X.beginPath(); X.ellipse(cx, cy + s * 0.55, s * 0.6, s * 0.42, 0, Math.PI, 0); X.fill();
  X.restore();
}
function sDelegate(t) {
  X.globalAlpha = outA(t, 32);
  words('NO NODE? NO PROBLEM.', 960, 215, { fam: F.ub, wt: 900, size: 80, colors: ['#fff', '#fff', 'G', 'G'], glow: 0 }, t, 26.05);
  text(typed('Delegate with as little as 42 GEN.', seg(t, 26.4, 26.9)), 960, 290, { fam: F.sg, wt: 500, size: 34, color: C.pink });
  const YOU = [440, 560], VAL = [1480, 560];
  const ys = E.outBack(seg(t, 26.35, 26.8)), vs = E.outBack(seg(t, 26.5, 26.95));
  // path
  const P0 = [YOU[0] + 110, YOU[1] - 20], PC = [960, 330], P1 = [VAL[0] - 140, VAL[1] - 20];
  const pp = E.outCubic(seg(t, 26.7, 27.2));
  if (pp > 0) {
    X.save(); X.strokeStyle = 'rgba(255,135,255,0.5)'; X.lineWidth = 2.5; X.setLineDash([10, 12]); X.lineDashOffset = -t * 50;
    X.beginPath(); for (let i = 0; i <= 40 * pp; i++) { const q = qpt(P0, PC, P1, i / 40); i ? X.lineTo(...q) : X.moveTo(...q); } X.stroke(); X.restore();
  }
  // reward path (back)
  const R0 = [VAL[0] - 140, VAL[1] + 30], RC = [960, 800], R1 = [YOU[0] + 110, YOU[1] + 30];
  const rp = E.outCubic(seg(t, 29.0, 29.4));
  if (rp > 0) {
    X.save(); X.strokeStyle = 'rgba(77,255,184,0.4)'; X.lineWidth = 2.5; X.setLineDash([10, 12]); X.lineDashOffset = t * 50;
    X.beginPath(); for (let i = 0; i <= 40 * rp; i++) { const q = qpt(R0, RC, R1, i / 40); i ? X.lineTo(...q) : X.moveTo(...q); } X.stroke(); X.restore();
  }
  // YOU
  if (ys > 0) {
    X.save(); X.translate(...YOU); X.scale(ys, ys);
    X.fillStyle = 'rgba(25,0,40,0.9)'; X.beginPath(); X.arc(0, 0, 96, 0, Math.PI * 2); X.fill();
    ring(0, 0, 96, C.pink, 3, 1, 22);
    person(0, 0, 70, C.pink);
    text('YOU', 0, 150, { fam: F.ub, wt: 900, size: 34 });
    const rew = t > 29.4 ? (seg(t, 29.5, 31.0) * 3.6).toFixed(2) : null;
    text(rew ? `42 GEN  + ${rew}` : '42 GEN', 0, 190, { fam: F.mono, wt: 800, size: 24, ls: 2, color: rew ? C.mint : C.pink });
    X.restore();
  }
  // validator
  if (vs > 0) {
    const boost = t > 27.8 ? 1 + 0.08 * E.outBack(seg(t, 27.8, 28.2)) : 1;
    X.save(); X.translate(...VAL); X.scale(vs * boost, vs * boost);
    if (t > 27.9 && t < 29.0) {
      const sp = t * 8;
      for (let i = 0; i < 24; i++) {
        const a = i / 24 * Math.PI * 2 + sp * 0.2, on = Math.floor(sp) % 24 === i || t > 28.75;
        X.save(); X.rotate(a); X.fillStyle = on ? C.mint : 'rgba(255,135,255,0.4)';
        X.fillRect(150, -3, on ? 22 : 14, 6); X.restore();
      }
    }
    hexPath(0, 0, 124); X.fillStyle = 'rgba(25,0,40,0.92)'; X.fill();
    X.strokeStyle = t > 28.75 ? C.mint : C.pink; X.lineWidth = 4; X.shadowColor = X.strokeStyle; X.shadowBlur = 26 + 20 * beatPulse(t); X.stroke(); X.shadowBlur = 0;
    logo(0, -4, 120, { glow: 20 });
    X.restore();
    text('VALIDATOR', VAL[0], VAL[1] + 180, { fam: F.ub, wt: 900, size: 34, alpha: vs });
  }
  shock(VAL[0], VAL[1], t, 27.8, 420, C.pink, 2);
  // coin travel
  const cq = seg(t, 27.0, 27.8);
  if (cq > 0 && cq < 1) {
    for (let k = 6; k >= 0; k--) {
      const q = qpt(P0, PC, P1, E.inOutCubic(clamp(cq - k * 0.02)));
      if (k) dot(q[0], q[1], 30 - k * 3, C.pink, 10, 0.12);
      else {
        X.save(); X.translate(...q);
        X.fillStyle = gradH(-36, 36, ['#ffc6ff', C.pink, C.mag]); X.shadowColor = C.pink; X.shadowBlur = 30;
        X.beginPath(); X.arc(0, 0, 38, 0, Math.PI * 2); X.fill(); X.shadowBlur = 0;
        text('42', 0, 9, { fam: F.ub, wt: 900, size: 26, color: C.bg });
        X.restore();
      }
    }
  }
  // rewards stream
  if (t > 29.2 && t < 31.6) for (let i = 0; i < 18; i++) {
    const q = seg(t, 29.25 + i * 0.09, 29.95 + i * 0.09);
    if (q <= 0 || q >= 1) continue;
    const p = qpt(R0, RC, R1, E.inOutCubic(q));
    dot(p[0], p[1], 9, i % 2 ? C.mint : C.cyan, 16);
  }
  stepper(960, 900, ['DELEGATE', 'GET PICKED MORE', 'SHARE REWARDS'], t >= 29.2 ? 2 : t >= 27.8 ? 1 : t >= 26.9 ? 0 : -1, [t >= 27.8, t >= 29.2, t >= 31.0], seg(t, 26.6, 27.0), 420);
}

/* ---- 6. MATH ---- */
function formula(cx, y, p, size = 52) {
  const runs = [['weight ≈ ', '#fff'], ['√', null], ['0.6 × ', '#fff'], ['own stake', C.pink], [' + 0.4 × ', '#fff'], ['delegated stake', C.cyan]];
  X.save(); setFont(F.mono, 800, size, 0);
  const ws = runs.map(r => r[1] ? X.measureText(r[0]).width : size * 0.9);
  const innerPad = size * 0.25, total = ws.reduce((a, b) => a + b, 0) + innerPad;
  let x = cx - total / 2;
  const nChars = runs.reduce((s, r) => s + r[0].length, 0);
  let shown = Math.round(nChars * p);
  let innerStart = 0;
  for (let i = 0; i < runs.length; i++) {
    const [s, col] = runs[i];
    if (col === null) {
      innerStart = x + ws[i];
      if (shown > 0) {
        const rs = clamp(shown / 1);
        X.save(); X.strokeStyle = C.pink; X.lineWidth = size * 0.08; X.lineJoin = 'round'; X.lineCap = 'round';
        X.shadowColor = C.mag; X.shadowBlur = 20;
        const innerW = ws.slice(i + 1).reduce((a, b) => a + b, 0) + innerPad;
        const top = y - size * 0.95;
        X.setLineDash([(size * 2 + innerW) * rs * clamp(p * 1.4), 1e4]);
        X.beginPath(); X.moveTo(x + size * 0.05, y - size * 0.35); X.lineTo(x + size * 0.25, y - size * 0.45); X.lineTo(x + size * 0.48, y + size * 0.12);
        X.lineTo(x + size * 0.82, top); X.lineTo(x + size * 0.82 + innerW + size * 0.1, top); X.stroke(); X.restore();
      }
      shown -= 1; x += ws[i] + innerPad * 0.6; continue;
    }
    const k = clamp(shown, 0, s.length);
    if (k > 0) { X.fillStyle = col; X.textAlign = 'left'; X.textBaseline = 'alphabetic'; if (col !== '#fff') { X.shadowColor = col; X.shadowBlur = 18; } else X.shadowBlur = 0; X.fillText(s.slice(0, k), x, y); }
    shown -= s.length; x += ws[i];
  }
  X.restore();
}
function whale(cx, cy, s, t) {
  X.save(); X.translate(cx, cy); X.scale(s, s); X.rotate(Math.sin(t * 2.4) * 0.05);
  const g = X.createLinearGradient(-170, -80, 160, 60); g.addColorStop(0, C.blue); g.addColorStop(1, C.violet);
  X.beginPath();
  X.moveTo(-170, 0);
  X.bezierCurveTo(-170, -62, -95, -88, -10, -78);
  X.bezierCurveTo(60, -68, 112, -42, 150, -14);
  X.lineTo(196, -62);
  X.quadraticCurveTo(206, -26, 236, -18);
  X.quadraticCurveTo(196, 2, 160, 12);
  X.bezierCurveTo(100, 52, -60, 64, -130, 42);
  X.quadraticCurveTo(-170, 30, -170, 0);
  X.closePath();
  X.fillStyle = g; X.shadowColor = C.blue; X.shadowBlur = 30; X.fill();
  X.shadowBlur = 0; X.strokeStyle = 'rgba(255,255,255,0.35)'; X.lineWidth = 2;
  for (let i = 0; i < 4; i++) { X.beginPath(); X.moveTo(-140 + i * 10, 18 + i * 7); X.quadraticCurveTo(-60, 40 + i * 6, 20, 30 + i * 4); X.stroke(); }
  X.fillStyle = '#fff'; X.beginPath(); X.arc(-112, -14, 7, 0, Math.PI * 2); X.fill();
  // spout
  X.strokeStyle = C.cyan; X.lineWidth = 4; X.lineCap = 'round'; X.shadowColor = C.cyan; X.shadowBlur = 12;
  const sp = 0.6 + 0.4 * Math.sin(t * 6);
  for (const a of [-0.5, 0, 0.5]) { X.beginPath(); X.moveTo(-40, -82); X.quadraticCurveTo(-40 + a * 40, -130 * sp, -40 + a * 70, -120 * sp); X.stroke(); }
  X.restore();
}
function sMath(t) {
  X.globalAlpha = outA(t, 42);
  text(typed('THE SELECTION MATH', seg(t, 32.05, 32.4)), 960, 140, { fam: F.mono, wt: 700, size: 24, ls: 10, color: C.pink });
  formula(960, 255, seg(t, 32.35, 33.6), 52);
  // graph block
  const ga = 1 - E.inCubic(seg(t, 38.3, 38.8));
  if (ga > 0 && t > 33.8) {
    X.save(); X.globalAlpha *= ga; X.translate(-(1 - ga) * 200, 0);
    const ox = 230, oy = 900, sx = 150, sy = 190;
    const axA = seg(t, 33.8, 34.1);
    X.strokeStyle = `rgba(255,255,255,${0.5 * axA})`; X.lineWidth = 2;
    X.beginPath(); X.moveTo(ox, oy - 470); X.lineTo(ox, oy); X.lineTo(ox + 820, oy); X.stroke();
    text('STAKE →', ox + 820, oy + 40, { fam: F.mono, wt: 700, size: 18, ls: 3, align: 'right', color: 'rgba(255,255,255,0.6)', alpha: axA });
    text('WEIGHT', ox, oy - 490, { fam: F.mono, wt: 700, size: 18, ls: 3, align: 'left', color: 'rgba(255,255,255,0.6)', alpha: axA });
    const cp = E.inOutCubic(seg(t, 34.0, 35.0));
    X.save(); X.strokeStyle = gradH(ox, ox + 800, [C.pink, C.mag, C.violet]); X.lineWidth = 6; X.shadowColor = C.mag; X.shadowBlur = 24; X.lineCap = 'round';
    X.beginPath(); for (let i = 0; i <= 100 * cp; i++) { const s = i / 100 * 5.3; const px = ox + s * sx, py = oy - Math.sqrt(s) * sy; i ? X.lineTo(px, py) : X.moveTo(px, py); } X.stroke(); X.restore();
    for (const [s, t0, lx, ly] of [[1, 35.0, '1×', '1×'], [4, 35.45, '4×', '2×']]) {
      const p = E.outBack(seg(t, t0, t0 + 0.4)); if (p <= 0) continue;
      const px = ox + s * sx, py = oy - Math.sqrt(s) * sy;
      X.save(); X.setLineDash([6, 8]); X.strokeStyle = 'rgba(255,255,255,0.45)'; X.lineWidth = 2; X.globalAlpha *= p;
      X.beginPath(); X.moveTo(px, oy); X.lineTo(px, py); X.lineTo(ox, py); X.stroke(); X.restore();
      dot(px, py, 11 * p, '#fff', 24);
      ring(px, py, 11 + 40 * seg(t, t0, t0 + 0.6), C.pink, 2, 1 - seg(t, t0, t0 + 0.6));
      text(lx, px, oy + 40, { fam: F.ub, wt: 900, size: 26, color: C.pink, alpha: p });
      text(ly, ox - 18, py + 10, { fam: F.ub, wt: 900, size: 26, color: C.cyan, align: 'right', alpha: p });
    }
    // bars
    const bx = 1180, unit = 140;
    for (const [label, val, y, col, t0] of [['STAKE', 4, 470, C.pink, 35.6], ['WEIGHT', 2, 620, C.cyan, 35.9]]) {
      const p = E.outExpo(seg(t, t0, t0 + 0.7)); if (seg(t, t0 - 0.1, t0) <= 0) continue;
      text(label, bx, y - 18, { fam: F.mono, wt: 700, size: 20, ls: 5, align: 'left', color: col });
      X.fillStyle = 'rgba(255,255,255,0.07)'; X.fillRect(bx, y, unit * 4, 56);
      for (let k = 1; k < 4; k++) { X.fillStyle = 'rgba(255,255,255,0.15)'; X.fillRect(bx + unit * k, y, 2, 56); }
      X.save(); X.fillStyle = gradH(bx, bx + unit * val, [col, col === C.pink ? C.mag : C.blue]); X.shadowColor = col; X.shadowBlur = 24;
      X.fillRect(bx, y, unit * val * p, 56); X.restore();
      text(`${val}×`, bx + unit * val * p + 22, y + 44, { fam: F.ub, wt: 900, size: 44, align: 'left', alpha: p });
    }
    words('4× THE STAKE ≈ 2× THE WEIGHT', 1180, 790, { fam: F.ub, wt: 700, size: 30, align: 'left', colors: ['#fff', '#fff', '#fff', C.pink, C.cyan, C.cyan, C.cyan] }, t, 36.5);
    X.restore();
  }
  // whale
  if (t > 38.5) {
    const wp = E.outCubic(seg(t, 38.5, 39.3));
    whale(lerp(1700, 960, wp), 590 + Math.sin(t * 2) * 10, 1.25, t);
    const bp = E.outExpo(seg(t, 39.3, 39.6));
    if (bp > 0) {
      X.save(); X.strokeStyle = C.red; X.lineWidth = 18; X.shadowColor = C.red; X.shadowBlur = 30; X.lineCap = 'round';
      X.beginPath(); X.arc(960, 580, 250, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * bp); X.stroke();
      if (bp > 0.5) { const q = (bp - 0.5) * 2; X.beginPath(); X.moveTo(960 - 177, 580 - 177); X.lineTo(960 - 177 + 354 * q, 580 - 177 + 354 * q); X.stroke(); }
      X.restore();
    }
    words("WHALES CAN'T BUY THE NETWORK.", 960, 935, { fam: F.ub, wt: 900, size: 54, colors: ['#fff', C.red, '#fff', 'G', 'G'] }, t, 39.55);
  }
}

/* ---- 7. THE CATCH ---- */
function warnTri(cx, cy, s, col) {
  X.save(); X.strokeStyle = col; X.lineWidth = 7; X.lineJoin = 'round'; X.shadowColor = col; X.shadowBlur = 22;
  X.beginPath(); X.moveTo(cx, cy - s); X.lineTo(cx + s * 1.1, cy + s * 0.8); X.lineTo(cx - s * 1.1, cy + s * 0.8); X.closePath(); X.stroke();
  X.fillStyle = col; X.fillRect(cx - 4, cy - s * 0.4, 8, s * 0.7); X.beginPath(); X.arc(cx, cy + s * 0.5, 5, 0, Math.PI * 2); X.fill();
  X.restore();
}
function sCatch(t) {
  X.globalAlpha = outA(t, 46);
  const fl = 0.06 + 0.05 * Math.abs(Math.sin(t * 9));
  X.fillStyle = `rgba(255,30,70,${fl})`; X.fillRect(0, 0, W, H);
  warnTri(960, 150, 52, C.amber);
  const o = { fam: F.ub, wt: 900, size: 104 }, w = measure('THE CATCH', o);
  text(scramble('THE CATCH', seg(t, 42.05, 42.5), t, 9), 960 - w / 2, 320, { ...o, align: 'left', color: C.red, glow: 40, glowColor: C.red });
  const cutX = y => 1300 - (y - 360) * (150 / 360);
  const bars = [['VALIDATOR STAKE', 430, C.pink, C.mag], ['YOUR DELEGATION', 590, C.cyan, C.blue]];
  const fp = E.outExpo(seg(t, 42.3, 42.85));
  const fallT = Math.max(0, t - 43.05);
  bars.forEach(([label, y, c0, c1], bi) => {
    text(label, 460, y - 16, { fam: F.mono, wt: 700, size: 20, ls: 5, align: 'left', color: c0 });
    X.fillStyle = 'rgba(255,255,255,0.07)'; X.fillRect(460, y, 1000, 74);
    const g = gradH(460, 1460, [c0, c1]);
    const xa = cutX(y), xb = cutX(y + 74);
    // left (kept) piece
    X.save(); X.beginPath(); X.moveTo(460, y); X.lineTo(t < 43 ? 1460 : xa, y); X.lineTo(t < 43 ? 1460 : xb, y + 74); X.lineTo(460, y + 74); X.closePath(); X.clip();
    X.fillStyle = g; X.shadowColor = c0; X.shadowBlur = 20; X.fillRect(460, y, 1000 * fp, 74); X.restore();
    if (t >= 43) {
      // falling piece
      X.save();
      const dy = 900 * fallT * fallT + 60 * fallT, rot = (bi ? -1 : 1) * 0.5 * fallT;
      X.globalAlpha *= 1 - seg(t, 43.6, 44.4);
      X.translate(1380, y + 37 + dy); X.rotate(rot); X.translate(-1380, -(y + 37));
      X.beginPath(); X.moveTo(xa + 6, y); X.lineTo(1460, y); X.lineTo(1460, y + 74); X.lineTo(xb + 6, y + 74); X.closePath(); X.clip();
      X.fillStyle = g; X.fillRect(460, y, 1000, 74);
      X.fillStyle = 'rgba(255,46,99,0.45)'; X.fillRect(460, y, 1000, 74);
      X.restore();
      glowLine(xa, y, xb, y + 74, C.red, 4, 20, 1 - seg(t, 43.5, 45));
      const la = E.outBack(seg(t, 43.25 + bi * 0.1, 43.6 + bi * 0.1));
      if (la > 0) text('−SLASHED', xa + 40, y + 50, { fam: F.mono, wt: 800, size: 30, ls: 2, align: 'left', color: C.red, alpha: la, glow: 16, glowColor: C.red });
      sparks((xa + xb) / 2, y + 37, t, 43.0, 50, 70 + bi * 40, C.red, C.amber, 700, 1.0);
    }
  });
  // blade
  const bp = seg(t, 43.0, 43.1);
  if (bp > 0 && t < 43.6) {
    const a = 1 - seg(t, 43.1, 43.6);
    const y0 = 340, y1 = lerp(340, 720, E.outCubic(bp));
    glowLine(cutX(y0), y0, cutX(y1), y1, '#fff', 10, 40, a);
    glowLine(cutX(y0), y0, cutX(y1), y1, C.red, 26, 60, a * 0.6);
  }
  words('IF YOUR VALIDATOR GETS SLASHED,', 960, 810, { fam: F.ub, wt: 700, size: 44 }, t, 43.55);
  words('YOUR STAKE GETS CUT TOO.', 960, 880, { fam: F.ub, wt: 900, size: 52, color: C.red, glow: 26, glowColor: C.red }, t, 43.95);
}

/* ---- 8. PLAN TITLE ---- */
function sPlanTitle(t) {
  const z = E.inExpo(seg(t, 47.45, 48));
  X.globalAlpha = 1 - z;
  X.translate(960, 540); X.scale(1 + z * 2.6, 1 + z * 2.6); X.translate(-960, -540);
  text(typed('MY', seg(t, 46.05, 46.2)), 960, 405, { fam: F.mono, wt: 800, size: 40, ls: 24, color: C.pink, glow: 16, glowColor: C.pink });
  const o = { fam: F.ub, wt: 900, size: 150 }; o.size = fit('MAINNET PLAN', o, 1600);
  const w = measure('MAINNET PLAN', o);
  text(scramble('MAINNET PLAN', seg(t, 46.1, 46.85), t, 21), 960 - w / 2, 590, { ...o, align: 'left', color: 'G', glow: 50 + 30 * beatPulse(t) });
  for (let i = 0; i < 5; i++) {
    const p = E.outBack(seg(t, 46.75 + i * 0.1, 47.05 + i * 0.1)); if (p <= 0) continue;
    X.save(); X.translate(960 + (i - 2) * 130, 700); X.scale(p, p);
    X.fillStyle = 'rgba(25,0,40,0.9)'; X.beginPath(); X.roundRect(-44, -32, 88, 64, 12); X.fill();
    X.strokeStyle = C.pink; X.lineWidth = 2; X.shadowColor = C.pink; X.shadowBlur = 14; X.stroke();
    text(`0${i + 1}`, 0, 10, { fam: F.mono, wt: 800, size: 28, color: '#fff' });
    X.restore();
  }
}

/* ---- 9. PLAN STEPS ---- */
function stepScene(t, a, n, title, caption, vis) {
  const e = a + 6, lt = t - a;
  const out = E.inCubic(seg(t, e - 0.4, e));
  X.globalAlpha = 1 - out;
  X.save(); X.translate(-out * 120, 0);
  const np = E.outExpo(seg(lt, 0, 0.6));
  text(`STEP 0${n} / 05`, 140, 178, { fam: F.mono, wt: 700, size: 20, ls: 6, align: 'left', color: C.pink, alpha: np });
  X.save(); X.beginPath(); X.rect(100, 190, 700, 230); X.clip();
  text(`0${n}`, 132, 400 + (1 - np) * 230, { fam: F.ub, wt: 900, size: 220, align: 'left', color: 'G', stroke: 3, glow: 30 });
  X.restore();
  const to = { fam: F.ub, wt: 900, size: 50 };
  const tl = wrap(title, to, 760);
  let y = 485;
  tl.forEach((ln, i) => { words(ln, 140, y, { ...to, align: 'left' }, lt, 0.25 + i * 0.12); y += 64; });
  const co = { fam: F.sg, wt: 500, size: 31 };
  const cl = wrap(caption, co, 740);
  y += 26;
  const total = cl.reduce((s, l) => s + l.length, 0);
  let shown = Math.round(total * seg(lt, 0.9, 2.4));
  const lineTop = y - 34;
  cl.forEach(ln => {
    const k = clamp(shown, 0, ln.length); shown -= ln.length;
    text(ln.slice(0, k), 140, y, { ...co, align: 'left', color: 'rgba(255,255,255,0.82)' });
    y += 45;
  });
  const vp = E.outExpo(seg(lt, 0.8, 1.6));
  glowLine(112, lineTop, 112, lineTop + (y - lineTop - 30) * vp, C.pink, 3, 12, vp);
  X.restore();
  X.save(); X.translate(out * 80, 0);
  vis(lt, t);
  X.restore();
}
function vis1(lt, t) {
  // legend
  const la = seg(lt, 0.4, 0.8);
  X.save(); X.globalAlpha *= la;
  X.fillStyle = C.pink; X.fillRect(1100, 215, 18, 18); text('OWN STAKE', 1130, 232, { fam: F.mono, wt: 700, size: 18, ls: 3, align: 'left', color: C.pink });
  X.fillStyle = C.cyan; X.fillRect(1360, 215, 18, 18); text('DELEGATED', 1390, 232, { fam: F.mono, wt: 700, size: 18, ls: 3, align: 'left', color: C.cyan });
  X.restore();
  const base = 880;
  const cols = [{ x: 1200, h: 520, own: 0.07, name: 'VALIDATOR A', t0: 0.5 }, { x: 1580, h: 300, own: 0.55, name: 'VALIDATOR B', t0: 0.7 }];
  const pick = seg(lt, 2.7, 3.0);
  cols.forEach((c, i) => {
    const p = E.outExpo(seg(lt, c.t0, c.t0 + 1.2));
    const h = c.h * p, ho = c.h * c.own * p;
    X.save(); X.globalAlpha *= i === 0 ? 1 - 0.6 * pick : 1;
    X.fillStyle = 'rgba(0,229,255,0.35)'; X.fillRect(c.x - 80, base - h, 160, h - ho);
    X.strokeStyle = C.cyan; X.lineWidth = 2; X.strokeRect(c.x - 80, base - h, 160, h - ho);
    X.save(); X.fillStyle = gradH(c.x - 80, c.x + 80, [C.pink, C.mag]); X.shadowColor = C.pink; X.shadowBlur = 26; X.fillRect(c.x - 80, base - ho, 160, ho); X.restore();
    text(c.name, c.x, base - h - 24, { fam: F.mono, wt: 800, size: 20, ls: 3, alpha: p });
    const pct = Math.round(c.own * 100 * seg(lt, 1.2, 2.2));
    text(`${pct}%`, c.x, base + 64, { fam: F.ub, wt: 900, size: 46, color: C.pink, alpha: p });
    text('SELF-STAKE', c.x, base + 96, { fam: F.mono, wt: 700, size: 16, ls: 4, color: 'rgba(255,255,255,0.6)', alpha: p });
    X.restore();
  });
  if (pick > 0) {
    const c = cols[1], s = E.outBack(pick);
    ring(c.x, base - c.h / 2, 210 + 18 * beatPulse(t), C.mint, 3, pick * 0.8, 24);
    X.save(); X.translate(c.x, base - c.h - 100); X.scale(s, s);
    pill(0, 0, 'MOST SKIN IN THE GAME', { size: 18, color: C.mint, icon: 'check' }); X.restore();
    text('mostly delegated', cols[0].x, base - cols[0].h / 2, { fam: F.mono, wt: 700, size: 20, ls: 2, color: C.cyan, alpha: pick });
  }
}
const ROWS = [
  ['0x7a3f…c21', 'ACTIVE', '0 incidents', 0], ['0x91be…4d0', 'ACTIVE', '0 incidents', 0],
  ['0x3c07…aa9', 'QUARANTINED', '1 quarantine', 1], ['0xe55d…07f', 'ACTIVE', '0 incidents', 0],
  ['0x0b42…9e3', 'BANNED', 'removed', 2], ['0x6fd1…b18', 'ACTIVE', '0 incidents', 0],
  ['0xa2c9…5e6', 'ACTIVE', '0 incidents', 0], ['0x48e0…d7a', 'ACTIVE', '0 incidents', 0],
];
function vis2(lt, t) {
  const pa = E.outExpo(seg(lt, 0.3, 0.9));
  const x0 = 990, y0 = 210, w = 810, h = 670;
  X.save(); X.globalAlpha *= pa; X.translate(0, (1 - pa) * 60);
  X.fillStyle = 'rgba(12,0,22,0.92)'; X.beginPath(); X.roundRect(x0, y0, w, h, 16); X.fill();
  X.strokeStyle = 'rgba(255,135,255,0.55)'; X.lineWidth = 2; X.shadowColor = C.mag; X.shadowBlur = 24; X.stroke(); X.shadowBlur = 0;
  X.fillStyle = 'rgba(255,135,255,0.1)'; X.fillRect(x0, y0, w, 48);
  [C.red, C.amber, C.mint].forEach((c, i) => dot(x0 + 28 + i * 24, y0 + 24, 7, c, 0));
  text('public validator registry', x0 + w / 2, y0 + 31, { fam: F.mono, wt: 500, size: 18, color: 'rgba(255,255,255,0.6)' });
  const hy = y0 + 92;
  text('VALIDATOR', x0 + 34, hy, { fam: F.mono, wt: 800, size: 16, ls: 4, align: 'left', color: C.pink });
  text('STATUS', x0 + 330, hy, { fam: F.mono, wt: 800, size: 16, ls: 4, align: 'left', color: C.pink });
  text('HISTORY', x0 + 580, hy, { fam: F.mono, wt: 800, size: 16, ls: 4, align: 'left', color: C.pink });
  const scanY = lerp(hy + 10, y0 + h - 10, E.inOutCubic(seg(lt, 2.4, 3.6)));
  const scanning = lt > 2.4 && lt < 3.7;
  ROWS.forEach((r, i) => {
    const ry = hy + 62 + i * 62;
    const tp = seg(lt, 0.6 + i * 0.18, 1.0 + i * 0.18);
    if (tp <= 0) return;
    const scanned = lt > 2.4 && scanY > ry - 20;
    const col = !scanned ? 'rgba(255,255,255,0.75)' : r[3] === 0 ? C.mint : r[3] === 1 ? C.amber : C.red;
    if (scanned && r[3]) {
      X.save(); X.fillStyle = r[3] === 1 ? 'rgba(255,179,0,0.14)' : 'rgba(255,46,99,0.14)';
      if (r[3] === 1 && lt > 3.7) X.fillStyle = `rgba(255,46,99,${0.15 + 0.15 * beatPulse(t)})`;
      X.fillRect(x0 + 10, ry - 36, w - 20, 54); X.restore();
    }
    text(typed(r[0], tp * 1.5), x0 + 34, ry, { fam: F.mono, wt: 700, size: 22, align: 'left', color: 'rgba(255,255,255,0.9)' });
    text(typed(r[1], tp * 1.3 - 0.2), x0 + 330, ry, { fam: F.mono, wt: 800, size: 22, ls: 1, align: 'left', color: col, glow: scanned && r[3] ? 14 : 0, glowColor: col });
    text(typed(r[2], tp * 1.3 - 0.3), x0 + 580, ry, { fam: F.mono, wt: 500, size: 20, align: 'left', color: scanned && r[3] ? col : 'rgba(255,255,255,0.5)' });
  });
  if (scanning) {
    const g = X.createLinearGradient(0, scanY - 60, 0, scanY);
    g.addColorStop(0, 'rgba(0,229,255,0)'); g.addColorStop(1, 'rgba(0,229,255,0.25)');
    X.fillStyle = g; X.fillRect(x0 + 4, scanY - 60, w - 8, 60);
    glowLine(x0 + 4, scanY, x0 + w - 4, scanY, C.cyan, 2, 16);
  }
  X.restore();
  const st = seg(lt, 3.75, 3.95);
  if (st > 0) {
    const s = lerp(2, 1, E.outCubic(st));
    X.save(); X.translate(1640, hy + 62 + 2 * 62 - 60); X.rotate(-0.1); X.scale(s, s); X.globalAlpha *= st;
    X.strokeStyle = C.red; X.lineWidth = 4; X.shadowColor = C.red; X.shadowBlur = 22;
    X.beginPath(); X.roundRect(-110, -32, 220, 64, 10); X.stroke();
    text('RED FLAG', 0, 11, { fam: F.ub, wt: 900, size: 30, color: C.red, glow: 16, glowColor: C.red });
    X.restore();
  }
}
function vis3(lt, t) {
  const ox = 1040, oy = 860, sx = 60, sy = 158;
  const a = seg(lt, 0.3, 0.6);
  X.save(); X.globalAlpha *= a;
  X.strokeStyle = 'rgba(255,255,255,0.5)'; X.lineWidth = 2;
  X.beginPath(); X.moveTo(ox, oy - 560); X.lineTo(ox, oy); X.lineTo(ox + 760, oy); X.stroke();
  text('EFFECTIVE STAKE →', ox + 760, oy + 40, { fam: F.mono, wt: 700, size: 17, ls: 3, align: 'right', color: 'rgba(255,255,255,0.6)' });
  text('WEIGHT', ox, oy - 580, { fam: F.mono, wt: 700, size: 17, ls: 3, align: 'left', color: 'rgba(255,255,255,0.6)' });
  text('same delegation added to both', ox + 760, 236, { fam: F.mono, wt: 500, size: 18, align: 'right', color: 'rgba(255,255,255,0.55)' });
  X.restore();
  const cp = E.inOutCubic(seg(lt, 0.4, 1.4));
  X.save(); X.strokeStyle = gradH(ox, ox + 740, [C.pink, C.mag, C.violet]); X.lineWidth = 5; X.shadowColor = C.mag; X.shadowBlur = 20;
  X.beginPath(); for (let i = 0; i <= 120 * cp; i++) { const s = i / 120 * 11.5; const px = ox + s * sx, py = oy - Math.sqrt(s) * sy; i ? X.lineTo(px, py) : X.moveTo(px, py); } X.stroke(); X.restore();
  const D = 2;
  [[2, 'MID-SIZE', 1.4, C.mint], [8, 'GIANT', 1.6, 'rgba(255,255,255,0.7)']].forEach(([s, name, t0, col], i) => {
    const p = E.outBack(seg(lt, t0, t0 + 0.4)); if (p <= 0) return;
    const px = ox + s * sx, py = oy - Math.sqrt(s) * sy;
    dot(px, py, 10 * p, '#fff', 20);
    text(name, px - 16, py - 26, { fam: F.mono, wt: 800, size: 20, ls: 3, align: 'right', color: col, alpha: p });
    const dp = E.inOutCubic(seg(lt, 2.0 + i * 0.25, 2.7 + i * 0.25));
    if (dp > 0) {
      const nx = px + D * sx * dp;
      glowLine(px, py, nx, py, C.pink, 4, 14);
      const ny = oy - Math.sqrt(s + D * dp) * sy;
      if (dp >= 1) {
        const rp = E.outCubic(seg(lt, 2.7 + i * 0.25, 3.1 + i * 0.25));
        glowLine(nx, py, nx, lerp(py, ny, rp), C.cyan, 5, 16);
        dot(nx, lerp(py, ny, rp), 7, C.cyan, 16);
        const gain = Math.round((Math.sqrt(s + D) / Math.sqrt(s) - 1) * 100);
        const gp = E.outBack(seg(lt, 3.1 + i * 0.25, 3.5 + i * 0.25));
        if (gp > 0) {
          X.save(); X.translate(nx + 22, (py + ny) / 2 + 14); X.scale(gp, gp);
          text(`+${gain}%`, 0, 0, { fam: F.ub, wt: 900, size: i ? 30 : 52, align: 'left', color: i ? 'rgba(255,255,255,0.6)' : C.mint, glow: i ? 0 : 24, glowColor: C.mint });
          text('WEIGHT', 0, i ? 26 : 34, { fam: F.mono, wt: 700, size: i ? 14 : 18, ls: 3, align: 'left', color: i ? 'rgba(255,255,255,0.5)' : C.mint });
          X.restore();
        }
      }
    }
  });
}
function vis4(lt, t) {
  const cx = 1190, cy = 560, r = 200, th = 70;
  const segs = [[0.5, C.pink, '50%', 'MOST RELIABLE', 'proven track record'], [0.3, C.mag, '30%', 'MID-SIZE', 'good performance'], [0.2, C.cyan, '20%', 'NEWER OPERATOR', 'high self-stake']];
  const sp = E.inOutCubic(seg(lt, 0.4, 1.9));
  let acc = 0;
  segs.forEach(([v, col, pct, name, sub], i) => {
    const a0 = -Math.PI / 2 + acc * Math.PI * 2 + 0.025, a1 = -Math.PI / 2 + (acc + v) * Math.PI * 2 - 0.025;
    const end = -Math.PI / 2 + sp * Math.PI * 2;
    if (end > a0) {
      const pop = i === Math.floor(((t * 2) % 3)) ? 1 : 0;
      X.save(); X.strokeStyle = col; X.lineWidth = th + 6 * beatPulse(t) * pop; X.shadowColor = col; X.shadowBlur = 30;
      X.beginPath(); X.arc(cx, cy, r, a0, Math.min(a1, end)); X.stroke(); X.restore();
      const mid = (a0 + a1) / 2;
      if (end > a1) text(pct, cx + Math.cos(mid) * r, cy + Math.sin(mid) * r + 9, { fam: F.mono, wt: 800, size: 24, color: C.bg });
    }
    // legend
    const lp = E.outExpo(seg(lt, 1.9 + i * 0.22, 2.5 + i * 0.22));
    if (lp > 0) {
      const ly = 410 + i * 150;
      X.save(); X.globalAlpha *= lp; X.translate((1 - lp) * 60, 0);
      X.fillStyle = col; X.shadowColor = col; X.shadowBlur = 16; X.fillRect(1460, ly - 46, 8, 104); X.shadowBlur = 0;
      text(pct, 1490, ly, { fam: F.ub, wt: 900, size: 52, align: 'left', color: col, glow: 18, glowColor: col });
      text(name, 1490, ly + 32, { fam: F.mono, wt: 800, size: 19, ls: 3, align: 'left' });
      text(sub, 1490, ly + 56, { fam: F.mono, wt: 500, size: 17, align: 'left', color: 'rgba(255,255,255,0.6)' });
      X.restore();
    }
    acc += v;
  });
  const ca = seg(lt, 0.8, 1.3);
  text('MY', cx, cy - 8, { fam: F.mono, wt: 700, size: 20, ls: 8, color: 'rgba(255,255,255,0.6)', alpha: ca });
  text('GEN', cx, cy + 40, { fam: F.ub, wt: 900, size: 46, color: 'G', alpha: ca });
  const ep = E.outBack(seg(lt, 3.1, 3.5));
  if (ep > 0) { X.save(); X.translate(cx, 880); X.scale(ep, ep); pill(0, 0, 'NOT AN EVEN SPLIT', { size: 18, color: C.pink, icon: 'cross' }); X.restore(); }
}
function arrowsLoop(cx, cy, r, rot, col) {
  X.save(); X.translate(cx, cy); X.rotate(rot); X.strokeStyle = col; X.fillStyle = col; X.lineWidth = 6; X.lineCap = 'round'; X.shadowColor = col; X.shadowBlur = 14;
  for (let k = 0; k < 2; k++) {
    X.rotate(Math.PI);
    X.beginPath(); X.arc(0, 0, r, 0.25, Math.PI - 0.35); X.stroke();
    const ax = Math.cos(Math.PI - 0.35) * r, ay = Math.sin(Math.PI - 0.35) * r;
    X.beginPath(); X.moveTo(ax - 14, ay - 2); X.lineTo(ax + 6, ay + 12); X.lineTo(ax + 4, ay - 14); X.closePath(); X.fill();
  }
  X.restore();
}
function calendar(cx, cy, col, t) {
  X.save(); X.strokeStyle = col; X.lineWidth = 3; X.shadowColor = col; X.shadowBlur = 12;
  X.beginPath(); X.roundRect(cx - 44, cy - 40, 88, 84, 8); X.stroke();
  X.fillStyle = col; X.fillRect(cx - 44, cy - 40, 88, 18);
  X.fillRect(cx - 26, cy - 52, 6, 18); X.fillRect(cx + 20, cy - 52, 6, 18);
  X.shadowBlur = 0;
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
    const on = i === 2 && j === 1;
    X.fillStyle = on ? (Math.floor(t * 2) % 2 ? C.mint : C.pink) : 'rgba(255,255,255,0.3)';
    X.fillRect(cx - 34 + i * 18, cy - 12 + j * 17, 12, 11);
  }
  X.restore();
}
function vis5(lt, t) {
  const xs = [1050, 1400, 1750], y = 390;
  const lp = seg(lt, 0.5, 0.8);
  text('activates 2 epochs after you delegate', 1400, 260, { fam: F.mono, wt: 500, size: 19, color: 'rgba(255,255,255,0.6)', alpha: lp });
  X.save(); X.globalAlpha *= lp; X.fillStyle = 'rgba(255,255,255,0.12)'; X.fillRect(xs[0], y - 3, xs[2] - xs[0], 6); X.restore();
  const prog = E.inOutCubic(seg(lt, 0.8, 2.4));
  X.save(); X.fillStyle = gradH(xs[0], xs[2], [C.pink, C.mag, C.mint]); X.shadowColor = C.pink; X.shadowBlur = 18;
  X.fillRect(xs[0], y - 3, (xs[2] - xs[0]) * prog, 6); X.restore();
  const labels = [['EPOCH N', 'DELEGATE'], ['N + 1', 'pending…'], ['N + 2', 'ACTIVE']];
  xs.forEach((x, i) => {
    const reached = prog >= i / 2 - 0.001;
    const s = E.outBack(seg(lt, 0.5 + i * 0.1, 0.9 + i * 0.1)); if (s <= 0) return;
    const col = i === 2 && reached ? C.mint : reached ? C.pink : 'rgba(255,255,255,0.4)';
    X.save(); X.translate(x, y); X.scale(s, s);
    X.fillStyle = C.bg; X.beginPath(); X.arc(0, 0, 24, 0, Math.PI * 2); X.fill();
    ring(0, 0, 24, col, 4, 1, reached ? 20 : 0);
    if (i === 2 && reached) check(0, 0, 11, C.mint, 4, seg(lt, 2.4, 2.7));
    else if (reached) dot(0, 0, 8, col, 10);
    text(labels[i][0], 0, -50, { fam: F.mono, wt: 700, size: 18, ls: 3, color: 'rgba(255,255,255,0.7)' });
    text(labels[i][1], 0, 64, { fam: F.mono, wt: 800, size: 20, ls: 2, color: col });
    X.restore();
  });
  shock(xs[2], y, lt, 2.4, 160, C.mint, 1);
  const cards = [[1000, 'AUTO-COMPOUND', 'rewards stay in the pool', 2.6], [1420, 'MONTHLY CHECK-IN', "that's all it takes", 3.0]];
  cards.forEach(([x, name, sub, t0], i) => {
    const p = E.outExpo(seg(lt, t0, t0 + 0.6)); if (p <= 0) return;
    X.save(); X.globalAlpha *= p; X.translate(0, (1 - p) * 70);
    X.fillStyle = 'rgba(25,0,40,0.9)'; X.beginPath(); X.roundRect(x, 560, 380, 220, 18); X.fill();
    X.strokeStyle = i ? C.cyan : C.pink; X.lineWidth = 2; X.shadowColor = X.strokeStyle; X.shadowBlur = 18; X.stroke(); X.shadowBlur = 0;
    if (i === 0) arrowsLoop(x + 190, 640, 40, t * 2.2, C.pink); else calendar(x + 190, 645, C.cyan, t);
    text(name, x + 190, 728, { fam: F.ub, wt: 900, size: 25 });
    text(sub, x + 190, 760, { fam: F.mono, wt: 500, size: 17, color: 'rgba(255,255,255,0.6)' });
    X.restore();
  });
}

/* ---- 10. OUTRO ---- */
function sOutro(t) {
  const a1 = 1 - E.inCubic(seg(t, 82.3, 82.8));
  if (a1 > 0) {
    X.save(); X.globalAlpha = a1; X.translate(960, 540); X.scale(1 + 0.15 * (1 - a1), 1 + 0.15 * (1 - a1)); X.translate(-960, -540);
    words('TO ME, DELEGATING IS A', 960, 330, { fam: F.ub, wt: 700, size: 56 }, t, 78.2);
    if (t > 79.7) {
      const p = seg(t, 79.7, 80.0);
      const s = t < 80 ? lerp(3.2, 1, E.inExpo(p)) : 1 + 0.1 * Math.exp(-(t - 80) * 6) * Math.cos((t - 80) * 22);
      X.save(); X.globalAlpha *= clamp(p * 3); X.translate(960, 560); X.scale(s, s);
      text('VOTE', 0, 105, { fam: F.ub, wt: 900, size: 300, color: 'G', glow: 70 + 40 * beatPulse(t) });
      X.restore();
      check(1545, 470, 46, C.mint, 12, E.outCubic(seg(t, 80.25, 80.6)));
    }
    words('FOR WHO GETS TO JUDGE THIS NETWORK.', 960, 790, { fam: F.ub, wt: 700, size: 44, colors: ['#fff', '#fff', '#fff', '#fff', 'G', 'G', 'G'] }, t, 80.6);
    X.restore();
  }
  shock(960, 560, t, 80.0, 1300);
  sparks(960, 560, t, 80.0, 160, 300, C.pink, C.mint, 1500, 1.5);
  // final
  if (t > 82.8) {
    const lp = seg(t, 83.6, 84.0);
    const final = t >= 84;
    rays(960, 420, 1400, t, final ? 1 - seg(t, 85.5, 87) * 0.5 : 0);
    if (t < 84.1) logo(960, 420, 300, { fill: false, stroke: C.pink, sp: E.inOutCubic(lp), lw: 3, sglow: 20, alpha: 1 - seg(t, 84.0, 84.1) });
    if (final) {
      const s = 1 + 0.14 * Math.exp(-(t - 84) * 5) * Math.cos((t - 84) * 18);
      logo(960, 420, 300 * s, { glow: 50 + 30 * beatPulse(t) });
    }
    shock(960, 420, t, 84.0, 1100);
    sparks(960, 420, t, 84.0, 120, 500, C.pink, C.cyan, 1200, 1.3);
    const ty = final ? lerp(560, 720, E.outExpo(seg(t, 84.0, 84.5))) : 560;
    const sz = final ? lerp(68, 54, E.outExpo(seg(t, 84.0, 84.5))) : 68;
    text(typed("SO I'M VOTING CAREFULLY.", seg(t, 82.85, 83.5)), 960, ty, { fam: F.ub, wt: 900, size: sz, glow: 30 });
    const ha = E.outExpo(seg(t, 84.5, 85.1));
    text('@GenLayer', 960, 800 + (1 - ha) * 30, { fam: F.mono, wt: 800, size: 34, ls: 6, color: C.pink, alpha: ha, glow: 18, glowColor: C.pink });
    text('DELEGATE  ·  VALIDATE  ·  JUDGE', 960, 850 + (1 - ha) * 30, { fam: F.mono, wt: 500, size: 18, ls: 8, color: 'rgba(255,255,255,0.55)', alpha: seg(t, 84.8, 85.4) });
  }
}

/* ---------- master ---------- */
const SCENES = [
  [0, 5.4, sIntro], [5.8, 12, sHook], [12, 22, sJury], [22, 26, sJoin], [26, 32, sDelegate], [32, 42, sMath],
  [42, 46, sCatch], [46, 48, sPlanTitle],
  [48, 54, t => stepScene(t, 48, 1, 'SELF-STAKE RATIO, NOT TOTAL STAKE', 'A validator mostly funded by delegators has little of their own to lose. I want the one taking the biggest personal risk.', vis1)],
  [54, 60, t => stepScene(t, 54, 2, 'CHECK THE TRACK RECORD', "Banned and quarantined validator lists are public. Even one quarantine tells me something isn't right.", vis2)],
  [60, 66, t => stepScene(t, 60, 3, 'THE SQUARE-ROOT EDGE', 'Each GEN adds more weight to a smaller validator than to a giant one. On a solid mid-size validator, my delegation actually moves the needle.', vis3)],
  [66, 72, t => stepScene(t, 66, 4, "DON'T SPLIT EVENLY", '50% on the most reliable option, 30% on a mid-size validator with good performance, 20% on a newer validator with high self-stake, to help new operators get in.', vis4)],
  [72, 78, t => stepScene(t, 72, 5, 'WATCH FIRST, THEN COMMIT', "New delegations activate two epochs later, so I won't rush on day one. Rewards compound inside the pool, so a monthly check-in is enough.", vis5)],
  [78, 88, sOutro],
];

function renderFrame(t) {
  TT = t;
  X = BX;
  const f = fx(t);
  BGMOOD = t >= 42 && t < 46 ? 1 : 0;
  X.save();
  X.setTransform(1, 0, 0, 1, 0, 0); X.globalAlpha = 1; X.globalCompositeOperation = 'source-over'; X.shadowBlur = 0;
  const sx = f.shake ? (R(Math.floor(t * 60)) - 0.5) * 2 * f.shake : 0, sy = f.shake ? (R(Math.floor(t * 60) + 3) - 0.5) * 2 * f.shake : 0;
  X.translate(sx, sy);
  X.save(); X.translate(-W * 0.01, -H * 0.01); X.scale(1.02, 1.02); background(t); X.restore();
  for (const [a, b, fn] of SCENES) if (t >= a && t < b) { X.save(); fn(t); X.restore(); }
  X.restore();
  X.save(); hud(t); X.restore();
  post(t, f);
}

/* ---------- boot: render mode (headless) or live preview ---------- */
const FONT_SPECS = ['900 40px "Unbounded"', '700 40px "Unbounded"', '500 40px "Unbounded"', '800 40px "JBM"', '700 40px "JBM"', '500 40px "JBM"', '500 40px "SG"', '700 40px "SG"'];
window.ready = Promise.all(FONT_SPECS.map(f => document.fonts.load(f))).then(() => document.fonts.ready);
window.renderFrame = renderFrame;
window.DURATION = DUR;

if (/render/.test(location.search)) document.getElementById('hint').remove();
else {
  const hint = document.getElementById('hint');
  let t0 = null, paused = true, cur = 0;
  const audio = new Audio('soundtrack.wav');
  const seek = s => { cur = clamp(s, 0, DUR); t0 = performance.now() - cur * 1000; if (!paused) { audio.currentTime = cur; } };
  const play = () => { paused = false; t0 = performance.now() - cur * 1000; audio.currentTime = cur; audio.play().catch(() => {}); hint.style.display = 'none'; };
  const pause = () => { paused = true; audio.pause(); };
  document.addEventListener('click', () => paused ? play() : pause());
  document.addEventListener('keydown', e => {
    if (e.code === 'Space') { e.preventDefault(); paused ? play() : pause(); }
    if (e.code === 'ArrowRight') seek(cur + 5);
    if (e.code === 'ArrowLeft') seek(cur - 5);
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
