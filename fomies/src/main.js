/* fomies — "Department of FOMO" 3D motion piece (1920x1080, 60s).
   Three.js renders the 3D layer, a 2D canvas draws backgrounds, type and post FX on top.
   Every frame is a pure function of time t, so the renderer can grab any frame in any order. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from '../vendor/addons/RoundedBoxGeometry.js';
import { mergeVertices } from '../vendor/addons/BufferGeometryUtils.js';

const W = 1920, H = 1080, DUR = 60;
const PI = Math.PI, TAU = PI * 2;
const C = {
  lav: '#ab9df0', lavL: '#c7bdf8', lavD: '#7f6fd6', navy: '#1f2d3d', navyD: '#141e29', ink: '#111216',
  paper: '#f3efe4', red: '#d8313b', pickle: '#5c8a37', teal: '#b4dcde', gold: '#f2c14e', cream: '#efe7d6',
};

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
  outBack: x => { const c1 = 2.2, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
  inBack: x => 2.7 * x * x * x - 1.7 * x * x,
  outElastic: x => x <= 0 ? 0 : x >= 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - .75) * TAU / 3) + 1,
};
// damped spring kick that starts at t0: returns 0 before, oscillates and dies out after
const spring = (t, t0, f = 9, d = 6) => t < t0 ? 0 : Math.exp(-(t - t0) * d) * Math.cos((t - t0) * f * TAU / 2 * .5 * 2);
const BEAT0 = 6.5, BEAT = 0.5;
const beatPh = t => (((t - BEAT0) % BEAT) + BEAT) % BEAT / BEAT;
const bounce = t => t < BEAT0 ? 0 : Math.exp(-beatPh(t) * 6);

/* ---------- output + GL ---------- */
const out = document.getElementById('c');
const O = out.getContext('2d');
const glc = document.createElement('canvas'); glc.width = W; glc.height = H;
const renderer = new THREE.WebGLRenderer({ canvas: glc, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const cnv = (w, h, fn) => { const c = document.createElement('canvas'); c.width = w; c.height = h; if (fn) fn(c.getContext('2d'), w, h); return c; };
const texOf = (src, o = {}) => {
  const t = new THREE.CanvasTexture(src); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (o.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...o.repeat); }
  return t;
};
const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error(src)); i.src = src; });

const GRAD = (() => { const d = new Uint8Array([70, 165, 255]); const t = new THREE.DataTexture(d, 3, 1, THREE.RedFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
const toonM = (color, o = {}) => new THREE.MeshToonMaterial({ color, gradientMap: GRAD, ...o });
const basicM = (color, o = {}) => new THREE.MeshBasicMaterial({ color, ...o });
function outlineM(w = 0.035, color = 0x101014) {
  return new THREE.ShaderMaterial({
    uniforms: { w: { value: w }, col: { value: new THREE.Color(color) } }, side: THREE.BackSide,
    vertexShader: `uniform float w; void main(){ vec4 p = vec4(position + normal * w, 1.0);
      #ifdef USE_INSTANCING
      p = instanceMatrix * p;
      #endif
      gl_Position = projectionMatrix * modelViewMatrix * p; }`,
    fragmentShader: `uniform vec3 col; void main(){ gl_FragColor = vec4(col, 1.0); }`,
  });
}
// cartoon mesh = toon-shaded body + inverted-hull ink outline
function toon(geo, color, ow = 0.035, mo = {}) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(geo, mo.isMaterial ? mo : toonM(color, mo));
  m.castShadow = true; m.receiveShadow = true;
  g.add(m);
  if (ow > 0) g.add(new THREE.Mesh(geo, outlineM(ow)));
  g.mesh = m;
  return g;
}
const shadowsOn = o => o.traverse(c => { if (c.isMesh && !c.material.isShaderMaterial) { c.castShadow = true; c.receiveShadow = true; } });
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const tmpV = new THREE.Vector3();
function toScreen(v, cam) { tmpV.copy(v).project(cam); return [(tmpV.x + 1) / 2 * W, (1 - tmpV.y) / 2 * H, tmpV.z]; }
function camLook(cam, p, look) { cam.position.copy(p); cam.lookAt(look); }
const lerpV = (a, b, t) => V(lerp(a.x, b.x, t), lerp(a.y, b.y, t), lerp(a.z, b.z, t));

/* ---------- assets ---------- */
const IMG = {}, TEX = {}, CV = {};
async function loadAssets() {
  const list = {
    logo: 'assets/cut/logo.png', yellow: 'assets/cut/card_yellow.jpg', peach: 'assets/cut/card_peach.jpg',
    blue: 'assets/cut/card_blue.jpg', witch: 'assets/cut/card_witch.jpg', cowboy: 'assets/cut/card_cowboy.jpg',
    envelope: 'assets/cut/envelope_crop.jpg', ghost: 'assets/cut/ghost_wide.jpg',
  };
  await Promise.all(Object.entries(list).map(async ([k, v]) => { IMG[k] = await loadImg(v); }));
  await Promise.all(['80px LO', '80px BO', '40px SE', '40px CP', 'bold 40px CP'].map(f => document.fonts.load(f)));
  buildTextures();
}

function roughen(c, w, h, n, seed, rmax = 3) {
  c.save(); c.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < n; i++) { c.globalAlpha = .4 + R(seed + i) * .6; c.beginPath(); c.arc(R(seed + i * 3.1) * w, R(seed + i * 7.7) * h, .5 + R(seed + i * 5.3) * rmax, 0, TAU); c.fill(); }
  c.restore();
}

function buildTextures() {
  // logo: face (white + thick ink outline) and silhouette (ink only), i-dot removed so it can be a real 3D coin
  const L = IMG.logo, P = 30;
  const noDot = cnv(L.width, L.height, c => { c.drawImage(L, 0, 0); c.clearRect(478, 0, 104, 95); });
  const lw = L.width + P * 2, lh = L.height + P * 2;
  const sil = cnv(lw, lh, c => {
    for (let a = 0; a < 40; a++) { const an = a / 40 * TAU; for (const r of [7, 14, 21]) c.drawImage(noDot, P + Math.cos(an) * r, P + Math.sin(an) * r); }
    c.globalCompositeOperation = 'source-in'; c.fillStyle = '#121018'; c.fillRect(0, 0, lw, lh);
  });
  const face = cnv(lw, lh, c => { c.drawImage(sil, 0, 0); c.drawImage(noDot, P, P); });
  CV.logo = { face, sil, P, w: lw, h: lh, coin: [P + 529, P + 43, 37], hole: [P + 213, P + 215] };
  TEX.logoFace = texOf(face); TEX.logoSil = texOf(sil);
  CV.logoFlat = cnv(lw, lh, c => { c.drawImage(sil, 0, 0); c.drawImage(L, P, P); });

  // character cards
  for (const k of ['yellow', 'peach', 'blue', 'witch', 'cowboy']) {
    const cv = cnv(420, 520, (c, w, h) => {
      c.fillStyle = '#111'; c.beginPath(); c.roundRect(0, 0, w, h, 46); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.roundRect(10, 10, w - 20, h - 20, 38); c.fill();
      c.save(); c.beginPath(); c.roundRect(24, 24, w - 48, h - 120, 28); c.clip();
      const im = IMG[k], s = Math.max((w - 48) / im.width, (h - 120) / im.height);
      c.drawImage(im, 24 + ((w - 48) - im.width * s) / 2, 24 + ((h - 120) - im.height * s) / 2, im.width * s, im.height * s);
      c.restore();
      c.fillStyle = '#111'; c.font = '700 30px CP'; c.textAlign = 'center';
      c.fillText('AGENT #' + (1000 + Math.floor(R(k.length * 9.1) * 8999)), w / 2, h - 52);
    });
    TEX['card_' + k] = texOf(cv);
  }
  TEX.cardBack = texOf(cnv(420, 520, (c, w, h) => {
    c.fillStyle = '#111'; c.beginPath(); c.roundRect(0, 0, w, h, 46); c.fill();
    c.fillStyle = C.lav; c.beginPath(); c.roundRect(10, 10, w - 20, h - 20, 38); c.fill();
    c.fillStyle = 'rgba(255,255,255,.18)';
    for (let y = 30; y < h; y += 26) for (let x = 30; x < w; x += 26) { c.beginPath(); c.arc(x, y, 4, 0, TAU); c.fill(); }
    const s = (w - 80) / CV.logoFlat.width; c.drawImage(CV.logoFlat, 40, h / 2 - CV.logoFlat.height * s / 2, w - 80, CV.logoFlat.height * s);
  }));

  // office wall
  TEX.wall = texOf(cnv(2048, 1024, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#2b3d50'); g.addColorStop(.6, '#22313f'); g.addColorStop(1, '#1b2733');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = '#16202b'; c.fillRect(0, h * .66, w, h * .34);
    c.fillStyle = '#2f4256'; c.fillRect(0, h * .655, w, 10); c.fillStyle = '#0f171f'; c.fillRect(0, h * .665, w, 6);
    c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 3;
    for (let x = 64; x < w; x += 256) { c.strokeRect(x, h * .7, 200, h * .25); }
    c.globalAlpha = .05; for (let i = 0; i < 3000; i++) { c.fillStyle = R(i) > .5 ? '#fff' : '#000'; c.fillRect(R(i * 3.3) * w, R(i * 5.1) * h, 2, 2); }
  }));
  const wood = (base, dark) => cnv(512, 512, (c, w, h) => {
    c.fillStyle = base; c.fillRect(0, 0, w, h);
    c.strokeStyle = dark; c.lineWidth = 2;
    for (let i = 0; i < 26; i++) { c.globalAlpha = .25 + R(i) * .35; c.beginPath(); const y = R(i * 3.7) * h; c.moveTo(0, y); for (let x = 0; x <= w; x += 32) c.lineTo(x, y + Math.sin(x * .02 + i) * 6); c.stroke(); }
  });
  TEX.wood = texOf(wood('#7a5236', '#3d2414'));
  TEX.woodDark = texOf(wood('#5a3a26', '#2a170c'));
  TEX.cork = texOf(cnv(512, 512, (c, w, h) => {
    c.fillStyle = '#9a6b42'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 4000; i++) { c.fillStyle = R(i) > .5 ? 'rgba(60,30,10,.35)' : 'rgba(220,170,110,.3)'; c.fillRect(R(i * 1.7) * w, R(i * 2.3) * h, 2, 2); }
  }));
  // paper sheets with scribbles
  TEX.papers = [0, 1, 2, 3].map(k => texOf(cnv(256, 332, (c, w, h) => {
    c.fillStyle = ['#f6f3ea', '#eef1e6', '#f4efe2', '#e9eef0'][k]; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(40,40,50,.55)';
    for (let y = 34; y < h - 30; y += 15) { const len = 60 + R(k * 50 + y) * 140; c.fillRect(22, y, len, 4); }
    if (k % 2 === 0) { c.strokeStyle = 'rgba(210,40,50,.7)'; c.lineWidth = 4; c.strokeRect(w - 110, h - 80, 86, 44); c.font = '700 20px CP'; c.fillStyle = 'rgba(210,40,50,.7)'; c.fillText('VOID', w - 96, h - 50); }
    c.strokeStyle = '#222'; c.lineWidth = 3; c.strokeRect(1.5, 1.5, w - 3, h - 3);
  })));
  // eye sclera with red veins (tired intake officer)
  TEX.veins = texOf(cnv(1024, 512, (c, w, h) => {
    const g = c.createRadialGradient(256, 256, 40, 256, 256, 290);
    g.addColorStop(0, '#ffffff'); g.addColorStop(.45, '#fff2f2'); g.addColorStop(1, '#f19aa5');
    c.fillStyle = '#f19aa5'; c.fillRect(0, 0, w, h); c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#d0303f'; c.lineCap = 'round';
    for (let i = 0; i < 70; i++) {
      let a = R(i * 4.1) * TAU, r = 300 + R(i) * 40, x = 256 + Math.cos(a) * r, y = 256 + Math.sin(a) * r;
      c.globalAlpha = .45 + R(i * 2.2) * .4; c.lineWidth = 1.2 + R(i * 9.3) * 2.2;
      c.beginPath(); c.moveTo(x, y);
      const end = 110 + R(i * 6.6) * 90;
      while (r > end) { r -= 14; a += (R(i * 31 + r) - .5) * .25; x = 256 + Math.cos(a) * r; y = 256 + Math.sin(a) * r; c.lineTo(x, y); }
      c.stroke();
    }
  }));
  // body patterns for the 3D fomies
  TEX.cow = texOf(cnv(512, 256, (c, w, h) => {
    c.fillStyle = '#f4f4f4'; c.fillRect(0, 0, w, h); c.fillStyle = '#151515';
    for (let i = 0; i < 16; i++) { c.beginPath(); const x = R(i * 3.3) * w, y = R(i * 7.1) * h; for (let k = 0; k < 9; k++) { const a = k / 9 * TAU, r = 16 + R(i * 9 + k) * 22; c.lineTo(x + Math.cos(a) * r * 1.4, y + Math.sin(a) * r); } c.fill(); }
  }));
  TEX.patch = texOf(cnv(512, 256, (c, w, h) => {
    const cols = ['#e8433b', '#2fae5a', '#2f6fe0', '#f4c531', '#29b5c9', '#f07a2a', '#8a4fd6'];
    for (let y = 0; y < h; y += 32) for (let x = 0; x < w; x += 32) { c.fillStyle = cols[Math.floor(R(x * 1.3 + y * 7.7) * cols.length)]; c.fillRect(x, y, 32, 32); }
    c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 2; for (let x = 0; x < w; x += 32) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); } for (let y = 0; y < h; y += 32) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
  }));
  TEX.qr = texOf(cnv(512, 256, (c, w, h) => {
    c.fillStyle = '#f2f2f2'; c.fillRect(0, 0, w, h); c.fillStyle = '#141414';
    for (let y = 0; y < h; y += 16) for (let x = 0; x < w; x += 16) if (R(x * .37 + y * 1.91) > .55) c.fillRect(x, y, 16, 16);
  }));
  TEX.caution = texOf(cnv(512, 256, (c, w, h) => {
    c.fillStyle = '#5b2d8e'; c.fillRect(0, 0, w, h);
    for (let i = -3; i < 8; i++) { c.save(); c.translate(i * 90, 0); c.rotate(.5); c.fillStyle = '#f2c230'; c.fillRect(0, -40, 28, 400); c.fillStyle = '#222'; c.fillRect(6, -40, 3, 400); c.restore(); }
  }));
  TEX.barcode = texOf(cnv(512, 160, (c, w, h) => {
    c.fillStyle = '#fafafa'; c.fillRect(0, 0, w, h); c.fillStyle = '#111';
    let x = 30; for (let i = 0; x < w - 30; i++) { const bw = 2 + Math.floor(R(i * 3.9) * 4) * 2; if (i % 2 === 0) c.fillRect(x, 18, bw, h - 36); x += bw; }
  }));
  TEX.plaque = texOf(cnv(640, 220, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#e9c46a'); g.addColorStop(.5, '#f7dc8c'); g.addColorStop(1, '#b8892f');
    c.fillStyle = '#5b3f12'; c.beginPath(); c.roundRect(0, 0, w, h, 20); c.fill();
    c.fillStyle = g; c.beginPath(); c.roundRect(8, 8, w - 16, h - 16, 16); c.fill();
    c.fillStyle = '#3a2a0b'; c.textAlign = 'center'; c.font = '700 44px CP'; c.fillText('SUPPORT PICKLE', w / 2, 92); c.font = '700 70px CP'; c.fillText('P-055233', w / 2, 170);
    for (const [x, y] of [[26, 26], [w - 26, 26], [26, h - 26], [w - 26, h - 26]]) { c.fillStyle = '#7a5a1c'; c.beginPath(); c.arc(x, y, 8, 0, TAU); c.fill(); }
  }));
  TEX.nameplate = texOf(cnv(640, 160, (c, w, h) => {
    c.fillStyle = '#3a2810'; c.fillRect(0, 0, w, h);
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#d9b45a'); g.addColorStop(1, '#a37b2c');
    c.fillStyle = g; c.fillRect(10, 10, w - 20, h - 20);
    c.fillStyle = '#3a2a0b'; c.textAlign = 'center'; c.font = '700 58px CP'; c.fillText('INTAKE OFFICER', w / 2, 90); c.font = '700 26px CP'; c.fillText('DEPT. OF FOMO', w / 2, 132);
  }));
  TEX.envelope = texOf(IMG.envelope);
  TEX.wallTeal = texOf(cnv(1024, 512, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#c1e3e5'); g.addColorStop(1, '#a6d3d6');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(70,120,125,.35)'; c.lineCap = 'round';
    for (let i = 0; i < 90; i++) { c.lineWidth = 1 + R(i) * 2; const x = R(i * 3.1) * w, y = R(i * 5.7) * h, l = 10 + R(i * 7.3) * 50, a = -.3 + R(i * 2.9) * .4; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); }
  }));
  // stamp imprints
  const stampTex = (lines, col, round, seed) => texOf(cnv(640, 360, (c, w, h) => {
    c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 12; c.textAlign = 'center'; c.textBaseline = 'middle';
    if (round) { c.beginPath(); c.ellipse(w / 2, h / 2, w / 2 - 14, h / 2 - 14, 0, 0, TAU); c.stroke(); c.lineWidth = 4; c.beginPath(); c.ellipse(w / 2, h / 2, w / 2 - 34, h / 2 - 34, 0, 0, TAU); c.stroke(); }
    else { c.beginPath(); c.roundRect(14, 50, w - 28, h - 100, 16); c.stroke(); }
    lines.forEach(([s, sz], i) => { c.font = `${sz}px BO`; c.fillText(s, w / 2, h / 2 + (i - (lines.length - 1) / 2) * sz * 1.05); });
    roughen(c, w, h, 900, seed, 4);
  }));
  TEX.stamps = [
    stampTex([['RECEIVED', 92]], '#c8202c', false, 11),
    stampTex([['PENDING', 98]], '#2b4fb8', false, 23),
    stampTex([['FOMO', 96], ['CERTIFIED', 52]], '#c8202c', true, 37),
  ];
}

/* ---------- 3D builders ---------- */
const patchGeo = (r, a, b, seg = 10) => new THREE.SphereGeometry(r, seg, seg, PI / 2 - a, a * 2, PI / 2 - b, b * 2);

// the fomie eyes: two fused toon spheres with square pupils that slide over the surface
function makeEyes(o = {}) {
  const g = new THREE.Group(), eyes = [];
  const sep = o.sep ?? .9;
  for (const side of [-1, 1]) {
    const e = new THREE.Group(); e.position.x = side * sep;
    const ball = toon(new THREE.SphereGeometry(1, 48, 32), 0xffffff, o.ow ?? .05, o.veins ? { map: TEX.veins } : {});
    e.add(ball);
    const pivot = new THREE.Group(); e.add(pivot);
    const pupR = new THREE.Group(); pupR.rotation.z = (o.roll ?? .12) * side; pivot.add(pupR);
    pupR.add(new THREE.Mesh(patchGeo(1.004, o.pw ?? .38, o.ph ?? .40), basicM(0x0c0c10)));
    if (o.dash) {
      pupR.add(new THREE.Mesh(patchGeo(1.008, .2, .02, 6), basicM(0xd8d8de)));
    } else {
      const gl = new THREE.Group(); gl.rotation.set(-.2, -.2, 0); gl.add(new THREE.Mesh(patchGeo(1.008, .075, .075, 4), basicM(0xffffff))); pupR.add(gl);
      const gl2 = new THREE.Group(); gl2.rotation.set(-.07, -.08, 0); gl2.add(new THREE.Mesh(patchGeo(1.008, .035, .035, 4), basicM(0xffffff))); pupR.add(gl2);
      if (o.glint2) { const gl3 = new THREE.Group(); gl3.rotation.set(.14, .16, 0); gl3.add(new THREE.Mesh(patchGeo(1.008, .045, .045, 4), basicM(0xffffff))); pupR.add(gl3); }
    }
    g.add(e); eyes.push({ e, pivot });
  }
  g.userData.eyes = eyes;
  g.look = (x, y) => eyes.forEach(({ pivot }) => { pivot.rotation.y = x; pivot.rotation.x = -y; });
  g.blink = k => eyes.forEach(({ e }) => { e.scale.y = Math.max(.04, 1 - k); });
  return g;
}

function pickleGeo(seed, len = 1.5) {
  let g = new THREE.CapsuleGeometry(.42, len, 10, 30);
  g.deleteAttribute('uv'); g.deleteAttribute('normal');
  g = mergeVertices(g);
  const p = g.attributes.position;
  const bumps = [];
  for (let i = 0; i < 22; i++) {
    const a = R(seed + i * 3.3) * TAU, y = (R(seed + i * 5.1) - .5) * (len + .5);
    bumps.push([Math.cos(a) * .42, y, Math.sin(a) * .42, .035 + R(seed + i) * .03]);
  }
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const rr = Math.hypot(x, z) || 1;
    let d = 0; for (const [bx, by, bz, h] of bumps) { const q = (x - bx) ** 2 + (y - by) ** 2 + (z - bz) ** 2; d += h * Math.exp(-q / .006); }
    const wob = 1 + .05 * Math.sin(y * 4 + seed) + d / .42;
    x *= wob; z *= wob;
    x += .16 * Math.pow(y / (len / 2 + .42), 2);
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}
const PICKLE_GEOS = [];
function makePickle(i, hero = false) {
  if (!PICKLE_GEOS.length) for (let k = 0; k < 4; k++) PICKLE_GEOS.push(pickleGeo(10 + k * 17, 1.3 + k * .12));
  const g = toon(hero ? pickleGeo(99, 1.6) : PICKLE_GEOS[i % 4], hero ? 0x5f8f36 : [0x5c8a37, 0x4f7d2e, 0x6a9a3e, 0x557f33][i % 4], hero ? .03 : .045);
  if (hero) {
    for (const [y, tx, tz] of [[.62, .1, 0], [-.05, -.15, .22], [-.2, .2, -.18]]) {
      const band = toon(new THREE.TorusGeometry(.5, .03, 8, 48), 0xd13c3c, .012);
      band.position.set(.16 * Math.pow(y / 1.22, 2), y, 0); band.rotation.set(PI / 2 + tx, 0, tz); g.add(band);
    }
    const pencil = new THREE.Group();
    const body = toon(new THREE.CylinderGeometry(.06, .06, 1.1, 6), 0xf2b631, .015); pencil.add(body);
    const fer = toon(new THREE.CylinderGeometry(.065, .065, .14, 12), 0xb8b8c0, .015); fer.position.y = .62; pencil.add(fer);
    const er = toon(new THREE.CylinderGeometry(.062, .062, .14, 12), 0xf08a9a, .015); er.position.y = .76; pencil.add(er);
    const tip = toon(new THREE.ConeGeometry(.06, .2, 6), 0xf3d6a8, .015); tip.position.y = -.65; tip.rotation.x = PI; pencil.add(tip);
    pencil.position.set(-.55, .35, .12); pencil.rotation.set(0, 0, .9); g.add(pencil);
    const bc = new THREE.Mesh(new THREE.CylinderGeometry(.475, .475, .4, 24, 1, true, -.15, 1.25), basicM(0xffffff, { map: TEX.barcode, side: THREE.DoubleSide }));
    bc.position.set(.12, .6, 0); g.add(bc);
    const st = new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, .5, 32, 1, true, -.95, 1.6), basicM(0xffffff, { map: TEX.logoFace, transparent: true, alphaTest: .4, side: THREE.DoubleSide }));
    st.position.set(.02, -.45, 0); st.rotation.z = .12; g.add(st);
  }
  return g;
}

function makeLogo3D(width = 10, depth = .6, layers = 18) {
  const g = new THREE.Group();
  const L = CV.logo, s = width / L.w, h = L.h * s;
  const geo = new THREE.PlaneGeometry(width, h);
  for (let i = 0; i < layers; i++) {
    const m = new THREE.Mesh(geo, basicM(i === layers - 1 ? 0xffffff : 0xffffff, { map: i === layers - 1 ? TEX.logoFace : TEX.logoSil, alphaTest: .5, side: THREE.DoubleSide }));
    m.position.z = -depth * (1 - i / (layers - 1));
    g.add(m);
  }
  // the i-dot as a spinning coin
  const [cx, cy, cr] = L.coin;
  const coin = new THREE.Group();
  coin.position.set((cx - L.w / 2) * s, (L.h / 2 - cy) * s, -depth / 2);
  const disc = toon(new THREE.CylinderGeometry(cr * s, cr * s, depth * .9, 48), 0xffffff, .05);
  disc.rotation.x = PI / 2; coin.add(disc);
  for (const z of [1, -1]) {
    const sq = new THREE.Mesh(new THREE.PlaneGeometry(cr * s * .9, cr * s * .78), basicM(0x121018));
    sq.position.z = z * depth * .46; sq.rotation.set(0, z < 0 ? PI : 0, -.35); coin.add(sq);
  }
  g.add(coin);
  g.coin = coin;
  g.holePos = V((L.hole[0] - L.w / 2) * s, (L.h / 2 - L.hole[1]) * s, 0);
  g.h = h;
  return g;
}

function makeCard(k, w = 2.4) {
  const g = new THREE.Group(), h = w * 520 / 420;
  const geo = new THREE.PlaneGeometry(w, h);
  const f = new THREE.Mesh(geo, basicM(0xffffff, { map: TEX['card_' + k], transparent: true, alphaTest: .3 }));
  const b = new THREE.Mesh(geo, basicM(0xffffff, { map: TEX.cardBack, transparent: true, alphaTest: .3 })); b.rotation.y = PI;
  g.add(f, b); return g;
}

// a full 3D fomie: big fused eyes on top of a little hoodie body, plus accessories
function makeFomie(spec) {
  const g = new THREE.Group();
  const prof = [[.001, 0], [.86, 0], [.98, .1], [1, .35], [.92, .8], [.74, 1.18], [.52, 1.46], [.3, 1.62], [.001, 1.68]].map(([x, y]) => new THREE.Vector2(x, y));
  const body = toon(new THREE.LatheGeometry(prof, 48), spec.color ?? 0xffffff, .045, spec.map ? { map: spec.map } : {});
  g.add(body);
  const eyes = makeEyes({ sep: .86, glint2: true, roll: spec.roll ?? .14 });
  eyes.scale.setScalar(.82); eyes.position.y = 2.42; g.add(eyes); g.eyes = eyes;
  const top = 2.42 + .82;
  for (const a of spec.acc || []) {
    if (a === 'sprout') {
      const s = new THREE.Group();
      const stem = toon(new THREE.CylinderGeometry(.035, .045, .5, 8), 0x4c8c2f, .02); stem.position.y = .25; s.add(stem);
      for (const d of [-1, 1]) { const lf = toon(new THREE.SphereGeometry(.3, 20, 12), 0x6cbf3a, .025); lf.scale.set(1, .32, .55); lf.position.set(d * .26, .52, 0); lf.rotation.z = d * .5; s.add(lf); }
      s.position.y = top - .06; g.add(s); g.sprout = s;
    }
    if (a === 'halo') { const h = toon(new THREE.TorusGeometry(.72, .075, 12, 48), 0xf7c843, .02, { emissive: 0x6a4a00 }); h.rotation.x = PI / 2 - .2; h.position.y = top + .55; g.add(h); g.halo = h; }
    if (a === 'cowboy') {
      const hat = new THREE.Group();
      const brim = toon(new THREE.CylinderGeometry(1.45, 1.45, .08, 40), 0x8a5a2b, .03); brim.scale.z = .8; hat.add(brim);
      const crown = toon(new THREE.CylinderGeometry(.66, .82, .72, 32), 0x8a5a2b, .03); crown.position.y = .38; hat.add(crown);
      const band = toon(new THREE.CylinderGeometry(.83, .83, .14, 32), 0x3b2312, 0); band.position.y = .1; hat.add(band);
      hat.position.y = top - .12; hat.rotation.z = -.12; g.add(hat);
    }
    if (a === 'witch') {
      const hat = new THREE.Group();
      const brim = toon(new THREE.CylinderGeometry(1.4, 1.4, .07, 40), 0x5a2e93, .03); hat.add(brim);
      const cone = toon(new THREE.ConeGeometry(.78, 1.9, 32), 0x5a2e93, .03); cone.position.set(.12, .95, 0); cone.rotation.z = -.16; hat.add(cone);
      const band = toon(new THREE.CylinderGeometry(.74, .76, .16, 32), 0xf28a1e, 0); band.position.y = .12; hat.add(band);
      hat.position.y = top - .2; hat.rotation.z = .1; g.add(hat);
    }
    if (a === 'scarf') { const s = toon(new THREE.TorusGeometry(.52, .13, 12, 40), 0xf2c230, .025); s.rotation.x = PI / 2 + .15; s.position.y = 1.5; g.add(s); const hd = toon(new THREE.SphereGeometry(.17, 16, 12), 0xf2c230, .025); hd.position.set(.45, 1.62, .45); hd.scale.set(1.2, .8, 1); g.add(hd); }
    if (a === 'bowtie') { for (const d of [-1, 1]) { const c = toon(new THREE.ConeGeometry(.2, .36, 4), 0xd2232e, .02); c.rotation.z = d * PI / 2; c.position.set(d * .19, 1.5, .55); g.add(c); } const k = toon(new THREE.SphereGeometry(.09, 12, 8), 0xa81822, .02); k.position.set(0, 1.5, .58); g.add(k); }
    if (a === 'earring') { const r = toon(new THREE.TorusGeometry(.12, .025, 8, 24), 0xf2c230, .012); r.position.set(-1.45, 1.9, .3); g.add(r); }
    if (a === 'pencil') {
      const p = new THREE.Group();
      const b = toon(new THREE.CylinderGeometry(.06, .06, 3.4, 6), 0x9a6a3a, .015); p.add(b);
      const tip = toon(new THREE.ConeGeometry(.06, .25, 6), 0x2a2a2a, .015); tip.position.y = 1.82; p.add(tip);
      p.rotation.z = PI / 2; p.position.set(0, 2.4, .55); g.add(p);
    }
  }
  return g;
}

function makePin(color) {
  const g = new THREE.Group();
  const prof = [[.001, .75], [.32, .72], [.42, .6], [.42, .5], [.2, .42], [.17, .2], [.32, .12], [.34, .04], [.2, 0], [.001, 0]].reverse().map(([x, y]) => new THREE.Vector2(x, y));
  const head = toon(new THREE.LatheGeometry(prof, 32), color, .025, { emissive: new THREE.Color(color).multiplyScalar(.12) }); g.add(head);
  const needle = toon(new THREE.CylinderGeometry(.03, .01, .5, 8), 0xb0b0b8, .01); needle.position.y = -.25; g.add(needle);
  return g;
}

function makeStamp() {
  const g = new THREE.Group();
  const prof = [[.001, 2.15], [.32, 2.1], [.42, 1.9], [.36, 1.65], [.17, 1.45], [.15, 1.0], [.3, .8], [.42, .62], [.001, .62]].reverse().map(([x, y]) => new THREE.Vector2(x, y));
  const handle = toon(new THREE.LatheGeometry(prof, 32), 0xd8383f, .04); g.add(handle);
  const base = toon(new RoundedBoxGeometry(2.4, .5, 1.3, 3, .08), 0xffffff, .04, { map: TEX.wood }); base.position.y = .38; g.add(base);
  const pad = toon(new THREE.BoxGeometry(2.3, .1, 1.2), 0x55575e, .02); pad.position.y = .08; g.add(pad);
  // the stamp axis is +y; lay it so it points down the -z axis toward the envelope
  const wrap = new THREE.Group(); g.rotation.x = PI / 2; wrap.add(g);
  return wrap;
}

function makeBell() {
  const g = new THREE.Group();
  const base = toon(new THREE.CylinderGeometry(.75, .8, .16, 32), 0x2e2a26, .03); base.position.y = .08; g.add(base);
  const dome = toon(new THREE.SphereGeometry(.62, 32, 16, 0, TAU, 0, PI / 2), 0xe5b53c, .03, { emissive: 0x302000 }); dome.position.y = .16; g.add(dome);
  const btn = toon(new THREE.CylinderGeometry(.08, .1, .22, 12), 0xc99a2a, .02); btn.position.y = .86; g.add(btn);
  g.btn = btn; return g;
}

function makeOffice(sc) {
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(64, 32), toonM(0xffffff, { map: TEX.wall }));
  wall.position.set(0, 3, -5.5); wall.receiveShadow = true; sc.add(wall);
  const desk = toon(new RoundedBoxGeometry(16, 1.4, 5, 4, .14), 0xffffff, .045, { map: TEX.wood });
  desk.position.set(0, -2.7, .8); sc.add(desk);
  const chair = toon(new RoundedBoxGeometry(4.2, 5.2, .9, 4, .4), 0x2f5534, .05); chair.position.set(0, -.1, -3.6); sc.add(chair);
  for (let i = 0; i < 9; i++) { const st = toon(new THREE.SphereGeometry(.07, 8, 6), 0xb8913e, 0); st.position.set(-1.9 + i * .475, 2.35, -3.12); sc.add(st); }
  const frames = [['witch', -8.2, 2.6], ['cowboy', -6.9, -.4]];
  for (const [k, x, y] of frames) {
    const fr = toon(new RoundedBoxGeometry(2.3, 2.8, .2, 2, .06), 0x77808c, .04); fr.position.set(x, y, -5.3); sc.add(fr);
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(1.95, 2.42), basicM(0xffffff, { map: TEX['card_' + k] })); pic.position.set(x, y, -5.18); sc.add(pic);
  }
  const board = toon(new RoundedBoxGeometry(4.2, 5, .25, 2, .08), 0x6b4423, .04); board.position.set(8.6, 1.4, -5.3); sc.add(board);
  const cork = new THREE.Mesh(new THREE.PlaneGeometry(3.7, 4.5), toonM(0xffffff, { map: TEX.cork })); cork.position.set(8.6, 1.4, -5.16); sc.add(cork);
  [[8, 2.5, .2, 0xb9e4c9], [9.2, .6, -.15, 0xf6e7a8], [8.1, -.2, .1, 0xf3f0e6]].forEach(([x, y, r, col], i) => {
    const n = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.1), toonM(0xffffff, { map: TEX.papers[i] , color: col })); n.position.set(x, y, -5.14 + i * .005); n.rotation.z = r; sc.add(n);
  });
  return { wall, desk, chair };
}

/* ---------- 2D helpers ---------- */
function txt(s, x, y, o = {}) {
  if (!s) return 0;
  O.save();
  O.font = `${o.wt || 400} ${o.size || 48}px ${o.fam || 'LO'}`; O.letterSpacing = (o.ls || 0) + 'px';
  O.textAlign = o.align || 'center'; O.textBaseline = o.base || 'alphabetic';
  O.globalAlpha *= o.alpha ?? 1;
  O.translate(x, y); if (o.rot) O.rotate(o.rot); if (o.scale !== undefined) O.scale(o.scale, o.scale);
  if (o.shadow) { O.fillStyle = o.shadow; O.fillText(s, o.sdx ?? 0, o.sdy ?? 8); if (o.stroke) { O.lineJoin = 'round'; O.lineWidth = o.lw || 10; O.strokeStyle = o.shadow; O.strokeText(s, o.sdx ?? 0, o.sdy ?? 8); } }
  if (o.stroke) { O.lineJoin = 'round'; O.lineWidth = o.lw || 10; O.strokeStyle = o.stroke; O.strokeText(s, 0, 0); }
  O.fillStyle = o.color || '#fff'; O.fillText(s, 0, 0);
  const w = O.measureText(s).width;
  O.restore(); return w;
}
function measure(s, o) { O.save(); O.font = `${o.wt || 400} ${o.size || 48}px ${o.fam || 'LO'}`; O.letterSpacing = (o.ls || 0) + 'px'; const w = O.measureText(s).width; O.restore(); return w; }
// cartoon words that pop in one after another
function popWords(s, x, y, o, t, t0, st = .09, d = .45) {
  const ws = s.split(' '), sp = (o.size || 48) * .3;
  const wd = ws.map(w => measure(w, o));
  let cx = x - (wd.reduce((a, b) => a + b, 0) + sp * (ws.length - 1)) / 2;
  ws.forEach((w, i) => {
    const p = seg(t, t0 + i * st, t0 + i * st + d);
    if (p > 0) txt(w, cx + wd[i] / 2, y, { ...o, scale: E.outBack(p), alpha: clamp(p * 3) * (o.alpha ?? 1), rot: (1 - E.outCubic(p)) * (R(i + s.length) - .5) * .6 + (o.rot || 0) });
    cx += wd[i] + sp;
  });
}
const typed = (s, p) => s.slice(0, Math.round(s.length * clamp(p)));
const GL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&*?';
function scramble(s, p, t, seed = 1) {
  let o = ''; const n = s.length, f = Math.floor(t * 24);
  for (let i = 0; i < n; i++) { const ch = s[i]; if (ch === ' ') { o += ' '; continue; } const th = i / n * .7; o += p >= th + .3 ? ch : p > th ? GL[Math.floor(R(i * 7.3 + f * 13.1 + seed) * GL.length)] : ' '; }
  return o;
}
function bubble(cx, cy, s, size, p, o = {}) {
  if (p <= 0) return;
  O.save(); O.font = `400 ${size}px LO`; const tw = O.measureText(s).width;
  const w = tw + size * 1.4, h = size * 1.75;
  O.translate(cx, cy); O.scale(E.outBack(clamp(p)), E.outBack(clamp(p))); O.rotate(o.rot || 0);
  O.fillStyle = o.fill || '#151a22'; O.strokeStyle = o.border || '#5a606b'; O.lineWidth = size * .07;
  O.beginPath(); O.roundRect(-w / 2, -h / 2, w, h, size * .45);
  const td = o.tail ?? 1;
  O.moveTo(-size * .35, td * h / 2); O.lineTo(0, td * (h / 2 + size * .5)); O.lineTo(size * .35, td * h / 2);
  O.fill(); O.stroke();
  O.fillStyle = o.fill || '#151a22'; O.fillRect(-size * .33, td > 0 ? h / 2 - size * .1 : -h / 2 - size * .02, size * .66, size * .14);
  O.fillStyle = '#fff'; O.textAlign = 'center'; O.textBaseline = 'middle'; O.fillText(s, 0, size * .05);
  O.restore();
}
function subtitle(s, y, a, o = {}) {
  if (a <= 0 || !s) return;
  const size = o.size || 42;
  O.save(); O.globalAlpha *= a; O.font = `400 ${size}px SE`;
  const w = O.measureText(s).width + size * 1.4, h = size * 1.6;
  O.fillStyle = o.fill || 'rgba(10,12,16,.72)'; O.beginPath(); O.roundRect(W / 2 - w / 2, y - h * .68, w, h, 12); O.fill();
  O.restore();
  txt(s, W / 2, y, { fam: 'SE', size, color: o.color || '#f2e6c9', alpha: a });
}
function pillTag(x, y, s, a, o = {}) {
  if (a <= 0) return;
  O.save(); O.globalAlpha *= a; O.font = `700 ${o.size || 22}px CP`; O.letterSpacing = '3px';
  const w = O.measureText(s).width + 40, h = (o.size || 22) * 1.9;
  O.fillStyle = o.fill || 'rgba(17,18,22,.88)'; O.beginPath(); O.roundRect(x - w / 2, y - h / 2, w, h, h / 2); O.fill();
  O.strokeStyle = o.border || '#fff'; O.lineWidth = 2.5; O.stroke();
  O.fillStyle = o.color || '#fff'; O.textAlign = 'center'; O.textBaseline = 'middle'; O.fillText(s, x + 1.5, y + 1);
  O.restore();
}
function halftoneBG(t, c1 = C.lavL, c2 = C.lav, dots = 'rgba(255,255,255,.13)') {
  const g = O.createRadialGradient(W / 2, H * .45, 100, W / 2, H / 2, W * .75);
  g.addColorStop(0, c1); g.addColorStop(1, c2);
  O.fillStyle = g; O.fillRect(-60, -60, W + 120, H + 120);
  O.fillStyle = dots;
  const off = (t * 18) % 36;
  for (let y = -36; y < H + 36; y += 36) for (let x = -36; x < W + 36; x += 36) {
    const d = Math.hypot(x - W / 2, y - H / 2) / (W * .6), r = 1.5 + 5 * clamp(1 - d);
    O.beginPath(); O.arc(x + off, y + off * .5, r, 0, TAU); O.fill();
  }
}
let coinPat;
function coinBG(t, base = '#0e0e0f') {
  O.fillStyle = base; O.fillRect(-60, -60, W + 120, H + 120);
  if (!coinPat) coinPat = cnv(240, 240, (c) => {
    c.strokeStyle = 'rgba(255,255,255,.035)'; c.fillStyle = 'rgba(255,255,255,.03)'; c.lineWidth = 5;
    for (const [x, y] of [[60, 60], [180, 180]]) { c.beginPath(); c.arc(x, y, 44, 0, TAU); c.stroke(); c.save(); c.translate(x, y); c.rotate(-.35); c.fillRect(-18, -15, 36, 30); c.restore(); }
  });
  O.save(); O.fillStyle = O.createPattern(coinPat, 'repeat'); O.translate(-(t * 12) % 240, -(t * 6) % 240); O.fillRect(-240, -240, W + 480, H + 480); O.restore();
}
// fomie-eye iris: black screen with two round holes (r=0 => black)
function eyeIris(cx, cy, r, sep = 1.8) {
  O.save(); O.fillStyle = '#000'; O.beginPath(); O.rect(-60, -60, W + 120, H + 120);
  if (r > 0) { O.moveTo(cx - r * sep / 2 + r, cy); O.arc(cx - r * sep / 2, cy, r, 0, TAU, true); O.moveTo(cx + r * sep / 2 + r, cy); O.arc(cx + r * sep / 2, cy, r, 0, TAU, true); }
  O.fill('evenodd'); O.restore();
}
function folderWipe(p, label) {
  if (p <= 0 || p >= 1) return;
  const y = H * (1 - p) - (p > .5 ? 0 : 0);
  O.save(); O.translate(0, y);
  O.fillStyle = '#c9a66b'; O.beginPath(); O.roundRect(80, -70, 520, 110, 22); O.fill();
  O.fillStyle = '#dcbb7f'; O.fillRect(-20, 0, W + 40, H + 40);
  O.fillStyle = 'rgba(0,0,0,.12)'; O.fillRect(-20, 0, W + 40, 10);
  O.fillStyle = '#f3ecd8'; O.fillRect(130, -40, 420, 64);
  O.fillStyle = '#2a2a2a'; O.font = '700 34px CP'; O.letterSpacing = '4px'; O.textBaseline = 'middle'; O.fillText(label, 160, -6);
  O.translate(W / 2, H * .45); O.rotate(-.12); O.globalAlpha = .75; O.strokeStyle = '#c8202c'; O.lineWidth = 10;
  O.beginPath(); O.roundRect(-330, -80, 660, 160, 18); O.stroke(); O.fillStyle = '#c8202c'; O.font = '96px BO'; O.letterSpacing = '6px'; O.textAlign = 'center'; O.fillText('CONFIDENTIAL', 0, 8);
  O.restore();
}

/* ---------- shots ---------- */
class Shot {
  constructor(a, b, label) {
    this.a = a; this.b = b; this.label = label;
    this.scene = new THREE.Scene(); this.cam = new THREE.PerspectiveCamera(35, W / H, .1, 300);
  }
}
const SHOTS = [], BUILDERS = [];

/* A · 0–6 · cold open: the lights stutter on in the intake office, two eyes open */
function lightA(t) {
  if (t < .55) return 0;
  const fl = [[.55, .62], [.74, .8], [1.05, 1.22], [1.4, 1.46]];
  if (t < 1.75) return fl.some(([a, b]) => t >= a && t < b) ? .55 + R(Math.floor(t * 60)) * .3 : 0;
  return 1;
}
BUILDERS.push(() => {
  const S = new Shot(0, 6, 'FILE 01 · AFTER HOURS');
  const sc = S.scene;
  makeOffice(sc);
  const hemi = new THREE.HemisphereLight(0xa9b8ff, 0x1a1420, 1.2); sc.add(hemi);
  const key = new THREE.DirectionalLight(0xfff3d8, 2.2); key.position.set(2, 9, 6); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -12, right: 12, top: 10, bottom: -6 }); sc.add(key);
  const eyes = makeEyes({ dash: true, roll: 0 }); eyes.scale.setScalar(1.25); eyes.position.set(0, -.55, -2.2); sc.add(eyes);
  S.update = t => {
    const L = lightA(t); hemi.intensity = 1.2 * L; key.intensity = 2.2 * L;
    const open = E.outBack(seg(t, 2.4, 2.75));
    let bl = 1 - open;
    const bt = t - 4.95; if (bt > 0 && bt < .22) bl = Math.sin(bt / .22 * PI);
    eyes.blink(bl);
    const lx = lerp(0, -.42, E.inOutCubic(seg(t, 3.05, 3.25))) + lerp(0, .84, E.inOutCubic(seg(t, 3.65, 3.85))) - lerp(0, .42, E.inOutCubic(seg(t, 4.3, 4.5)));
    eyes.look(lx, .06 * Math.sin(t * 2));
    eyes.position.y = -.55 + .04 * Math.sin(t * 1.7);
    const p0 = V(0, .4, 12), p1 = V(0, -.2, 7.6);
    let cp = lerpV(p0, p1, E.outCubic(seg(t, 0, 5.3)));
    const look = V(0, -.6, -2.2);
    // dive into the left pupil
    const dv = E.inCubic(seg(t, 5.25, 6));
    if (dv > 0) { const pu = new THREE.Vector3(); eyes.userData.eyes[0].pivot.children[0].localToWorld(pu.set(0, 0, 1.3)); cp = lerpV(cp, pu, dv); look.lerp(pu.clone().add(V(0, 0, -3)), dv); }
    camLook(S.cam, cp, look);
  };
  S.bg = () => { O.fillStyle = '#000'; O.fillRect(-60, -60, W + 120, H + 120); };
  S.over = t => {
    const L = lightA(t);
    if (L > 0) {
      O.save(); O.globalCompositeOperation = 'screen';
      const g = O.createRadialGradient(W / 2, -100, 50, W / 2, -100, 900); g.addColorStop(0, `rgba(255,240,200,${.25 * L})`); g.addColorStop(1, 'rgba(255,240,200,0)');
      O.fillStyle = g; O.fillRect(0, 0, W, H); O.restore();
    }
    const lines = ['DEPARTMENT OF FOMO', 'INTAKE · FLOOR B-13', 'LOCAL TIME 03:00 AM'];
    lines.forEach((s, i) => {
      const p = seg(t, 1.9 + i * .55, 2.35 + i * .55);
      const str = typed(s, p) + (p > 0 && p < 1 || (i === 2 && Math.floor(t * 3) % 2 && p >= 1) ? '▌' : '');
      txt(str, 110, 140 + i * 46, { fam: 'CP', wt: 700, size: 30, ls: 4, align: 'left', color: i === 0 ? '#f2e6c9' : '#9fb0c8', alpha: 1 - seg(t, 5.2, 5.5) });
    });
    const sp = seg(t, 4.1, 4.5);
    subtitle('Please take a number.', H - 120, sp * (1 - seg(t, 5.2, 5.4)), { size: 46 });
  };
  SHOTS.push(S);
});

/* B · 6–12 · logo drop: 3D extruded fomies logo with orbiting agent cards */
const CARD_KEYS = ['yellow', 'peach', 'blue', 'witch', 'cowboy'];
BUILDERS.push(() => {
  const S = new Shot(6, 12, 'FILE 02 · ORIENTATION');
  const sc = S.scene; sc.fog = new THREE.Fog(0xb3a6f3, 18, 52);
  const logo = makeLogo3D(10.5); sc.add(logo);
  sc.add(new THREE.HemisphereLight(0xffffff, 0x8070c0, 2.2));
  const dl = new THREE.DirectionalLight(0xffffff, 1.5); dl.position.set(-3, 5, 8); sc.add(dl);
  const cards = [[-10.5, 4.2, -5, .3], [-10.8, -4.2, -3, -.2], [9.6, 4.4, -6, -.25], [11, -3.6, -9, .2], [-15, 1.2, -18, .1], [15, .8, -19, -.15], [-2, 6.8, -16, .05], [-3, 7.6, -22, -.1]]
    .map(([x, y, z, r], i) => { const c = makeCard(CARD_KEYS[i % 5], 3); c.userData = { x, y, z, r, i }; sc.add(c); return c; });
  S.update = t => {
    const lt = t - 6;
    const fall = E.inCubic(seg(t, 6.02, 6.5));
    const sq = t < 6.5 ? 0 : spring(t, 6.5, 3.2, 5.5);
    logo.position.set(0, lerp(13, .5, fall) + .18 * Math.sin(lt * 1.7) * seg(t, 6.9, 7.5), 0);
    logo.scale.set(1 + .16 * sq, 1 - .2 * sq, 1);
    logo.rotation.set(lerp(-.8, 0, fall) + .05 * Math.sin(lt * .9), .2 * Math.sin(lt * 1.05 + .4) * seg(t, 6.8, 7.6), .03 * Math.sin(lt * 1.3));
    const spin = n => E.outCubic(seg(t, n, n + .7)) * TAU;
    logo.coin.rotation.y = spin(7) + spin(9) + spin(10.5);
    logo.coin.position.z = -.3 + .25 * Math.max(0, spring(t, 7, 3, 4));
    cards.forEach(c => {
      const { x, y, z, r, i } = c.userData;
      const p = E.outExpo(seg(t, 6.45 + i * .06, 7.4 + i * .06));
      c.position.set(x + Math.sin(lt * .6 + i) * .4, y + Math.sin(lt * .8 + i * 2) * .35, lerp(-70, z, p));
      c.rotation.set(.12 * Math.sin(lt + i), lerp(PI * 3, 0, p) + .35 * Math.sin(lt * .7 + i) , r);
    });
    // exit: cards whip toward camera, logo flips up
    const ex = E.inExpo(seg(t, 11.1, 11.75));
    if (ex > 0) { logo.position.y += ex * 10; logo.rotation.x -= ex * 1.4; cards.forEach(c => { c.position.z += ex * 40; }); }
    camLook(S.cam, V(Math.sin(lt * .4) * .8, .3, 17 - 1.5 * E.inOutCubic(seg(t, 6.5, 11))), V(0, -.2, 0));
  };
  S.bg = t => halftoneBG(t);
  S.over = t => {
    const pq = E.outExpo(seg(t, 6, 6.4));
    if (pq < 1) { O.save(); O.translate(W / 2, H / 2); O.rotate(pq * .6); const k = lerp(2600, 0, pq); O.fillStyle = '#0c0c10'; O.beginPath(); O.roundRect(-k / 2, -k * .55, k, k * 1.1, k * .06); O.fill(); O.restore(); }
    popWords('WELCOME TO THE DEPARTMENT OF FOMO', W / 2, 870, { size: 72, stroke: '#121018', lw: 14, shadow: 'rgba(40,20,90,.35)', sdy: 9 }, t, 7.6, .08);
    const a = seg(t, 8.9, 9.3) * (1 - seg(t, 11.1, 11.3));
    txt('PLEASE TAKE A NUMBER  ·  PLEASE REMAIN CALM  ·  PLEASE REMAIN WAITING', W / 2, 950, { fam: 'CP', wt: 700, size: 24, ls: 4, color: '#2a1f5c', alpha: a });
    folderWipe(E.outCubic(seg(t, 11.4, 12)), 'CASE FILE #4821');
  };
  SHOTS.push(S);
});

/* C · 12–20 · the intake officer drowning in paperwork */
BUILDERS.push(() => {
  const S = new Shot(12, 20, 'FILE 03 · INTAKE');
  const sc = S.scene;
  makeOffice(sc);
  const hemi = new THREE.HemisphereLight(0xb9c6ff, 0x221a26, 1.25); sc.add(hemi);
  const key = new THREE.DirectionalLight(0xfff1d6, 2.3); key.position.set(-4, 10, 7); key.castShadow = true;
  key.shadow.mapSize.set(1536, 1536); Object.assign(key.shadow.camera, { left: -12, right: 12, top: 12, bottom: -6 }); sc.add(key);
  const stacks = [[-4.8, .2, 44, .05], [-2.4, -.3, 54, -.04], [0, .5, 16, .02], [2.4, -.2, 50, .06], [4.9, .3, 40, -.03]];
  const sheets = []; stacks.forEach(([x, z, n, r], s) => { for (let i = 0; i < n; i++) sheets.push({ x, z, i, s, r }); });
  const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), toonM(0xffffff), sheets.length);
  inst.castShadow = inst.receiveShadow = true;
  const col = new THREE.Color();
  sheets.forEach((sh, k) => inst.setColorAt(k, col.set(['#f6f3ea', '#dcd8cc', '#eef1e6', '#e6e1d3'][(sh.i + sh.s) % 4])));
  sc.add(inst);
  const instO = new THREE.InstancedMesh(inst.geometry, outlineM(.04), sheets.length); sc.add(instO);
  const eyes = makeEyes({ veins: true, dash: true, roll: 0 }); eyes.scale.setScalar(1.1); sc.add(eyes);
  const bell = makeBell(); bell.position.set(-5.6, -2, 2.1); bell.scale.setScalar(1.15); shadowsOn(bell); sc.add(bell);
  const plate = new THREE.Group();
  const pb = toon(new RoundedBoxGeometry(3.3, .85, .5, 2, .05), 0x3a2810, .03); plate.add(pb);
  const pf = new THREE.Mesh(new THREE.PlaneGeometry(3.2, .8), basicM(0xffffff, { map: TEX.nameplate })); pf.position.z = .26; plate.add(pf);
  plate.position.set(5.2, -1.55, 2.4); plate.rotation.set(-.35, -.25, 0); shadowsOn(plate); sc.add(plate);
  const pick = makePickle(1); pick.scale.setScalar(.55); pick.rotation.set(0, .4, PI / 2); sc.add(pick);
  const flyers = []; for (let i = 0; i < 34; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.43), toonM(0xffffff, { map: TEX.papers[i % 4], side: THREE.DoubleSide })); m.castShadow = true; sc.add(m); flyers.push(m); }
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), EU = new THREE.Euler(), PS = V(0, 0, 0), SC = V(1, 1, 1);
  S.update = t => {
    const lt = t - 12;
    const tops = stacks.map(() => -2);
    sheets.forEach((sh, k) => {
      const t0 = 12.25 + sh.s * .32 + sh.i * .017;
      const p = E.outCubic(seg(t, t0, t0 + .28));
      const y = -2 + .03 + sh.i * .062;
      const shake = sh.s === 2 ? 0 : .015 * Math.sin(lt * 3 + sh.i) * seg(t, 15.5, 19);
      PS.set(sh.x + (R(k * 1.7) - .5) * .14 + shake * sh.i * .1, lerp(y + 7, y, p), sh.z + (R(k * 2.9) - .5) * .12);
      EU.set(0, sh.r + (R(k * 3.3) - .5) * .16 + (1 - p) * 1.5, 0); Q.setFromEuler(EU);
      SC.set(p > 0 ? 1.7 : .0001, .05, 2.2);
      M4.compose(PS, Q, SC); inst.setMatrixAt(k, M4); instO.setMatrixAt(k, M4);
      if (p > 0) tops[sh.s] = Math.max(tops[sh.s], lerp(y + 7, y, p) + .03);
    });
    inst.instanceMatrix.needsUpdate = true; instO.instanceMatrix.needsUpdate = true;
    const rise = E.outBack(seg(t, 13.9, 14.5));
    eyes.position.set(0, lerp(-3.4, .05, rise) + .05 * Math.sin(lt * 2.2), -2.3);
    let bl = 0; for (const b of [15.2, 17.6]) { const d = t - b; if (d > 0 && d < .2) bl = Math.sin(d / .2 * PI); }
    eyes.blink(bl);
    const lx = .35 * Math.sin(lt * .9) * seg(t, 14.6, 15) - .5 * E.inOutCubic(seg(t, 16.0, 16.15)) * (1 - seg(t, 16.6, 16.8));
    eyes.look(lx, -.05 + .1 * seg(t, 17, 17.3));
    pick.position.set(2.5, tops[3] + .22, -.1);
    const ding = d => Math.max(0, spring(t, d, 4, 9));
    bell.btn.position.y = .86 - .1 * Math.max(0, Math.sin(seg(t, 13, 13.12) * PI)) - .1 * Math.max(0, Math.sin(seg(t, 16, 16.12) * PI));
    bell.rotation.z = .05 * (ding(13) + ding(16));
    // paper tornado then a flurry straight into the lens
    flyers.forEach((m, i) => {
      const t0 = 15.4 + i * .04, a = seg(t, t0, t0 + .5);
      const k = Math.max(0, t - t0);
      const ang = R(i * 3.1) * TAU + k * (1.8 + R(i) * 1.2) + k * k * .35;
      const rad = 3 + R(i * 5.5) * 3.5 - k * .25;
      const pos = V(Math.cos(ang) * rad, -1.5 + a * (1.5 + R(i * 7.7) * 4) + Math.sin(k * 2 + i) * .4, Math.sin(ang) * rad * .7);
      const rot = new THREE.Euler(k * 2.2 + i, k * 3.1 + i * 2, k * 1.7);
      const f = E.inCubic(seg(t, 18.75 + R(i * 9.1) * .55, 19.85));
      const cam = S.cam.position;
      const tgt = V(cam.x + (R(i * 4.4) - .5) * 3, cam.y + (R(i * 6.6) - .5) * 2, cam.z - 1.4 - R(i) * 1);
      m.position.copy(lerpV(pos, tgt, f));
      m.rotation.set(lerp(rot.x, 0, f), lerp(rot.y, (R(i) - .5) * .4, f), lerp(rot.z, (R(i * 2) - .5) * .8, f));
      m.visible = a > 0;
      m.scale.setScalar(a > 0 ? lerp(.85, 1.3, f) : .001);
    });
    const cp = lerpV(V(0, 1.6, 15.5), V(0, .9, 11.5), E.inOutCubic(seg(t, 12, 15.5)));
    cp.x += Math.sin(lt * .5) * .6;
    const sw = E.inOutCubic(seg(t, 15.4, 18.6));
    camLook(S.cam, lerpV(cp, V(-1.2, .2, 9.5), sw), V(0, -.4 + .4 * sw, 0));
  };
  S.bg = () => { O.fillStyle = '#000'; O.fillRect(-60, -60, W + 120, H + 120); };
  S.over = t => {
    folderWipe(1 - E.inCubic(seg(t, 12, 12.45)), 'CASE FILE #4821');
    // NOW SERVING board
    const a = seg(t, 13.0, 13.3) * (1 - seg(t, 19, 19.4));
    if (a > 0) {
      O.save(); O.globalAlpha = a;
      O.fillStyle = '#0b0d10'; O.strokeStyle = '#3b4250'; O.lineWidth = 4;
      O.beginPath(); O.roundRect(W - 470, 70, 380, 236, 18); O.fill(); O.stroke();
      txt('NOW SERVING', W - 280, 115, { fam: 'CP', wt: 700, size: 24, ls: 6, color: '#8a93a6' });
      const n = Math.min(4821, Math.floor(Math.pow(seg(t, 13.1, 15.0), .6) * 4821));
      const s = String(n).padStart(4, '0');
      txt(s, W - 280, 210, { fam: 'CP', wt: 700, size: 96, ls: 10, color: '#ff3b3b', shadow: 'rgba(255,40,40,.35)', sdy: 0 });
      O.restore();
      txt('YOUR NUMBER: 9,999,999', W - 280, 274, { fam: 'CP', wt: 700, size: 22, ls: 3, color: '#c9d2e3', alpha: a * seg(t, 15, 15.3) });
    }
    const s1 = seg(t, 16.15, 16.5);
    if (s1 > 0) {
      subtitle('Estimated wait time:', H - 230, s1 * (1 - seg(t, 19.2, 19.5)));
      const st = seg(t, 17, 17.12);
      if (st > 0) {
        O.save(); O.translate(W / 2, H - 120); O.rotate(-.06); const sc = lerp(2.4, 1, E.outCubic(st)); O.scale(sc, sc); O.globalAlpha = st * (1 - seg(t, 19.2, 19.5));
        O.strokeStyle = '#e0313b'; O.lineWidth = 8; O.beginPath(); O.roundRect(-270, -62, 540, 112, 14); O.stroke();
        txt('WHENEVER', 0, 32, { fam: 'BO', size: 82, color: '#e0313b', ls: 6 });
        O.restore();
      }
    }
    const wf = seg(t, 19.55, 20);
    if (wf > 0) { O.fillStyle = `rgba(246,243,234,${wf})`; O.fillRect(-60, -60, W + 120, H + 120); }
  };
  SHOTS.push(S);
});

/* D · 20–28 · official correspondence gets stamped and scanned */
BUILDERS.push(() => {
  const S = new Shot(20, 28, 'FILE 04 · CORRESPONDENCE');
  const sc = S.scene;
  const ew = 11, eh = ew * 805 / 1525;
  const env = new THREE.Mesh(new THREE.PlaneGeometry(ew, eh), toonM(0xffffff, { map: TEX.envelope })); env.receiveShadow = true; sc.add(env);
  const u2w = (u, v) => V((u / 1525 - .5) * ew, (.5 - v / 805) * eh, 0);
  sc.add(new THREE.HemisphereLight(0xfff6e8, 0x302030, 2.0));
  const key = new THREE.DirectionalLight(0xffffff, 2); key.position.set(-6, 6, 12); key.castShadow = true;
  key.shadow.mapSize.set(1536, 1536); Object.assign(key.shadow.camera, { left: -9, right: 9, top: 6, bottom: -6 }); sc.add(key);
  const stamp = makeStamp(); shadowsOn(stamp); sc.add(stamp);
  const spots = [[u2w(560, 300), -.12, 21.95], [u2w(1000, 400), .1, 22.95], [u2w(470, 620), -.2, 23.95]];
  const prints = spots.map(([p, r], i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.46), basicM(0xffffff, { map: TEX.stamps[i], transparent: true, depthWrite: false, opacity: .92 }));
    m.position.copy(p).add(V(0, 0, .01)); m.rotation.z = r; sc.add(m); return m;
  });
  const bcA = u2w(785, 568), bcB = u2w(1150, 568);
  const laser = new THREE.Mesh(new THREE.PlaneGeometry(.06, .9), basicM(0xff2a2a, { transparent: true, blending: THREE.AdditiveBlending }));
  const laserGlow = new THREE.Mesh(new THREE.PlaneGeometry(.5, 1.1), basicM(0xff2a2a, { transparent: true, opacity: .25, blending: THREE.AdditiveBlending }));
  sc.add(laser, laserGlow);
  S.update = t => {
    // stamp choreography: hover, slam, lift, move
    let pos = V(-7, 5, 6), roll = 0;
    const hov = (p, r) => p.clone().add(V(0, 0, 3.2));
    for (let i = 0; i < 3; i++) {
      const [p, r, ts] = spots[i];
      const prev = i ? hov(spots[i - 1][0]) : V(-7, 5, 6);
      const mv = E.inOutCubic(seg(t, ts - .75, ts - .3));
      if (t >= ts - .75) { pos = lerpV(prev, hov(p), mv); roll = r; }
      const dn = E.inCubic(seg(t, ts - .3, ts)), up = E.outCubic(seg(t, ts + .05, ts + .4));
      if (t >= ts - .3) pos.z = lerp(3.2, .02, dn) + (t > ts + .05 ? lerp(0, 3.2, up) : 0);
    }
    const ex = E.inBack(seg(t, 24.35, 24.9)); pos.add(V(ex * 9, ex * 6, ex * 4));
    stamp.position.copy(pos); stamp.rotation.z = roll;
    const sq = spots.reduce((a, s) => a + Math.max(0, spring(t, s[2], 5, 10)), 0);
    stamp.scale.set(1 + .08 * sq, 1 + .08 * sq, 1 - .2 * sq);
    prints.forEach((m, i) => { const p = seg(t, spots[i][2], spots[i][2] + .02); m.visible = p > 0; m.scale.setScalar(1 + .12 * Math.max(0, spring(t, spots[i][2], 6, 12))); });
    const lp = seg(t, 25.1, 26.1), la = Math.sin(seg(t, 25.0, 26.3) * PI);
    laser.visible = laserGlow.visible = la > 0.01;
    const lpos = lerpV(bcA, bcB, E.inOutCubic(lp)).add(V(0, 0, .03));
    laser.position.copy(lpos); laserGlow.position.copy(lpos); laser.material.opacity = la; laserGlow.material.opacity = .3 * la;
    // camera: low dramatic angle, then push onto the barcode
    const lt = t - 20;
    const c0 = V(-5.5, -6.5, 9.5), c1 = V(-2, -3.6, 10.5), c2 = V(1.2, -1.6, 4.6);
    let cp = lerpV(c0, c1, E.outCubic(seg(t, 20, 24.4)));
    let look = V(-.3, .1, 0);
    const pu = E.inOutCubic(seg(t, 24.4, 25.2)); cp = lerpV(cp, c2, pu); look.lerp(u2w(960, 568), pu);
    const pb = E.inOutCubic(seg(t, 26.6, 27.6)); cp = lerpV(cp, V(0, -2.2, 12), pb); look.lerp(V(0, 0, 0), pb);
    cp.x += Math.sin(lt * .7) * .2;
    camLook(S.cam, cp, look);
  };
  S.bg = t => coinBG(t);
  S.over = t => {
    const w = 1 - seg(t, 20, 20.35); if (w > 0) { O.fillStyle = `rgba(246,243,234,${w})`; O.fillRect(-60, -60, W + 120, H + 120); }
    const a = seg(t, 25.05, 25.25) * (1 - seg(t, 26.9, 27.1));
    if (a > 0) {
      const [x, y] = toScreen(u2w(967, 520), S.cam);
      O.save(); O.globalAlpha = a;
      pillTag(x, Math.max(90, y - 90), t < 26.1 ? 'SCANNING…' : scramble('KOL4821K7 · STATUS: STILL WAITING', seg(t, 26.1, 26.6), t, 3), 1, { size: 30, color: '#ff4b4b', border: '#ff4b4b' });
      O.restore();
    }
    subtitle(typed('Your request has been received.', seg(t, 20.6, 21.4)), H - 70, seg(t, 20.5, 20.7) * (1 - seg(t, 24.2, 24.5)));
    // NEXT! slams on the lens
    const st = seg(t, 27.5, 27.6);
    if (st > 0) {
      O.save(); O.translate(W / 2, H / 2); O.rotate(-.1); const s = lerp(3, 1, E.outCubic(st)); O.scale(s, s);
      O.globalAlpha = st;
      O.strokeStyle = '#d8313b'; O.lineWidth = 22; O.beginPath(); O.roundRect(-560, -190, 1120, 380, 40); O.stroke();
      txt('NEXT!', 0, 105, { fam: 'BO', size: 280, color: '#d8313b', ls: 10 });
      O.restore();
    }
  };
  SHOTS.push(S);
});

/* E · 28–36 · it rains pickles; the Support Pickle is unveiled */
BUILDERS.push(() => {
  const S = new Shot(28, 36, 'FILE 05 · EXHIBIT P');
  const sc = S.scene;
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(90, 40), toonM(0xffffff, { map: TEX.wallTeal })); wall.position.set(0, 14, -14); wall.receiveShadow = true; sc.add(wall);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(90, 40), toonM(0x92c3c7)); floor.rotation.x = -PI / 2; floor.position.z = 6; floor.receiveShadow = true; sc.add(floor);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x6d9a9e, 1.6); sc.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(5, 14, 9); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -16, right: 16, top: 14, bottom: -10, far: 50 }); sc.add(key);
  const spot = new THREE.SpotLight(0xfff2c4, 0, 0, .38, .5, 0); spot.position.set(0, 16, 3); spot.target.position.set(0, 2, 0); spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024); sc.add(spot, spot.target);
  const coneM = basicM(0xfff3c2, { transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(4.2, 15, 40, 1, true), coneM); cone.position.set(0, 8.7, 2.2); cone.rotation.x = -.15; sc.add(cone);
  const rain = [];
  for (let i = 0; i < 38; i++) {
    let x = (R(i * 3.7) - .5) * 22, z = -7 + R(i * 5.3) * 10;
    if (Math.abs(x) < 2.6 && z > -3) x += x < 0 ? -2.8 : 2.8;
    const p = makePickle(i); sc.add(p);
    rain.push({ p, x, z, t0: 28.15 + i * .065 + R(i * 9) * .1, h: 15 + R(i * 2.2) * 6, yaw: R(i * 4.4) * TAU, sp: [(R(i) - .5) * 9, (R(i * 2) - .5) * 9, (R(i * 3) - .5) * 9] });
  }
  const ped = new THREE.Group();
  const pbox = toon(new RoundedBoxGeometry(3.4, 1.5, 2.6, 3, .1), 0xffffff, .05, { map: TEX.wood }); pbox.position.y = .75; ped.add(pbox);
  const top = toon(new RoundedBoxGeometry(3.7, .25, 2.9, 2, .06), 0xffffff, .05, { map: TEX.woodDark }); top.position.y = 1.55; ped.add(top);
  const plq = new THREE.Mesh(new THREE.PlaneGeometry(2.3, .8), basicM(0xffffff, { map: TEX.plaque })); plq.position.set(0, .75, 1.31); ped.add(plq);
  for (const [x, z] of [[-.5, .2], [.45, .25], [0, -.35]]) { const pr = toon(new THREE.CylinderGeometry(.05, .05, 1.5, 8), 0x4a4f57, .02); pr.position.set(x, 2.3, z); pr.rotation.z = x * -.3; ped.add(pr); }
  shadowsOn(ped); sc.add(ped);
  const hero = makePickle(0, true); hero.scale.setScalar(1.6); shadowsOn(hero); sc.add(hero);
  const g = 34;
  function dropY(dt, h) {
    const T1 = Math.sqrt(2 * h / g), v = g * T1;
    if (dt < T1) return [h - .5 * g * dt * dt, 0];
    let tt = dt - T1, vv = v * .32, n = 0;
    while (n < 3) { const d = 2 * vv / g; if (tt < d) return [vv * tt - .5 * g * tt * tt, 1]; tt -= d; vv *= .3; n++; }
    return [0, 1];
  }
  S.update = t => {
    const lt = t - 28;
    rain.forEach(({ p, x, z, t0, h, yaw, sp }, i) => {
      const dt = t - t0;
      p.visible = dt > 0;
      if (dt <= 0) return;
      const [y, landed] = dropY(dt, h);
      const T1 = Math.sqrt(2 * h / g);
      const s = clamp((dt - T1) / .35);
      p.position.set(x, .42 + y, z);
      p.rotation.order = 'YXZ';
      p.rotation.set(lerp(sp[0] * dt, 0, E.outCubic(s)), lerp(sp[1] * dt, yaw, E.outCubic(s)), lerp(sp[2] * dt, PI / 2, E.outCubic(s)));
      const sq = landed ? Math.max(0, spring(t, t0 + T1, 6, 10)) : 0;
      p.scale.set(1 + .15 * sq, 1 - .2 * sq, 1 + .15 * sq);
    });
    const pr = E.outBack(seg(t, 30.5, 31.2));
    ped.position.y = lerp(-3.2, 0, pr);
    const hp = E.outCubic(seg(t, 31, 31.6));
    hero.position.set(0, ped.position.y + 1.68 + 2.1 + lerp(-4, 0, hp) * (hp < 1 ? 1 : 0), .05);
    hero.visible = t > 30.9;
    hero.rotation.set(0, lt * .55 - 1.2, -.18);
    const L = t < 35 ? 1 : (t < 35.9 ? ([[35, 35.1], [35.25, 35.32], [35.5, 35.56]].some(([a, b]) => t >= a && t < b) ? .7 : 0) : 0);
    const sOn = seg(t, 31, 31.15);
    hemi.intensity = 1.6 * L * lerp(1, .55, sOn); key.intensity = 2.2 * L * lerp(1, .5, sOn);
    spot.intensity = 2.2 * sOn * L; coneM.opacity = .09 * sOn * L;
    const c0 = V(0, 6.5, 22), c1 = V(4.2, 5, 10.5), c2 = V(-3.6, 4.6, 10);
    let cp = c0.clone(); cp.x += Math.sin(lt * .6) * .6;
    const look = V(0, 2.4, 0);
    const sw = E.inOutCubic(seg(t, 30.6, 31.6)); cp = lerpV(cp, c1, sw); look.lerp(V(0, 3.5, 0), sw);
    cp = lerpV(cp, c2, E.inOutCubic(seg(t, 31.6, 35.6)) * 1);
    camLook(S.cam, cp, look);
  };
  S.bg = () => { O.fillStyle = '#000'; O.fillRect(-60, -60, W + 120, H + 120); };
  S.over = t => {
    const bp = seg(t, 28.05, 28.4) * (1 - E.inBack(seg(t, 30.3, 30.6)));
    bubble(W / 2, 200, 'What’s Up With The Pickles?', 66, bp);
    const a = seg(t, 31.6, 31.9) * (1 - seg(t, 34.9, 35.1));
    if (a > 0) {
      const L = [['EXHIBIT', 'P-055233'], ['CLASS', 'SUPPORT PICKLE'], ['ORIGIN', scramble('[REDACTED]', seg(t, 32.6, 33.2), t, 5)], ['CLEARANCE', 'ABOVE YOURS']];
      L.forEach(([k, v], i) => {
        const p = seg(t, 31.7 + i * .3, 32.1 + i * .3);
        txt(k, 110, 150 + i * 56, { fam: 'CP', wt: 700, size: 24, ls: 4, color: '#2e5a5e', align: 'left', alpha: a * p });
        txt(typed(v, p), 330, 150 + i * 56, { fam: 'CP', wt: 700, size: 30, ls: 3, color: '#10262a', align: 'left', alpha: a });
      });
    }
    const sp = seg(t, 33.4, 33.8) * (1 - seg(t, 34.9, 35.1));
    subtitle('Some answers are above your clearance level.', H - 100, sp);
  };
  SHOTS.push(S);
});

/* F · 36–42 · lights out… BOO */
BUILDERS.push(() => {
  const S = new Shot(36, 42, 'FILE 06 · COMPLIANCE');
  S.flat = true;
  let lit;
  const fl = t => {
    const k = E.inOutCubic(seg(t, 36.2, 36.9)), k2 = E.inOutCubic(seg(t, 36.9, 37.5)), k3 = E.inOutCubic(seg(t, 37.5, 37.85));
    let x = lerp(250, 300, k), y = lerp(820, 420, k);
    x = lerp(x, 1600, k2); y = lerp(y, 520, k2);
    x = lerp(x, 945, k3); y = lerp(y, 660, k3);
    return [x + Math.sin(t * 9) * 6, y + Math.cos(t * 7) * 6];
  };
  S.bg = t => {
    const img = IMG.ghost;
    O.fillStyle = '#000'; O.fillRect(-60, -60, W + 120, H + 120);
    const boo = seg(t, 38, 38.5);
    const z = t >= 38 ? lerp(1.4, 1.0, E.outExpo(boo)) * (1 + .02 * Math.sin((t - 38) * 30) * Math.exp(-(t - 38) * 3)) + (t - 38) * .012 : 1.08 + (t - 36) * .02;
    const cx = 945, cy = 640;
    const draw = (ctx, ox = 0) => { ctx.save(); ctx.translate(cx + ox, cy); ctx.scale(z, z); ctx.translate(-cx, -cy); ctx.drawImage(img, 0, 0, W, H); ctx.restore(); };
    if (t < 38) {
      draw(O); O.fillStyle = 'rgba(0,0,0,.93)'; O.fillRect(-60, -60, W + 120, H + 120);
      if (t > 36.15) {
        if (!lit) lit = cnv(W, H);
        const c = lit.getContext('2d'); c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, W, H);
        const sv = O; c.save(); c.translate(cx, cy); c.scale(z, z); c.translate(-cx, -cy); c.drawImage(img, 0, 0, W, H); c.restore();
        const [fx, fy] = fl(t), r = 260 + 20 * Math.sin(t * 5);
        const g = c.createRadialGradient(fx, fy, r * .2, fx, fy, r);
        g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(.7, 'rgba(0,0,0,.85)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        c.globalCompositeOperation = 'destination-in'; c.fillStyle = g; c.fillRect(0, 0, W, H);
        sv.globalAlpha = seg(t, 36.15, 36.3); sv.drawImage(lit, 0, 0); sv.globalAlpha = 1;
        O.save(); O.globalCompositeOperation = 'screen'; const g2 = O.createRadialGradient(fx, fy, 0, fx, fy, r); g2.addColorStop(0, 'rgba(255,240,200,.18)'); g2.addColorStop(1, 'rgba(255,240,200,0)'); O.fillStyle = g2; O.fillRect(0, 0, W, H); O.restore();
      }
    } else {
      // chromatic split on the scare
      const ca = 18 * Math.exp(-(t - 38) * 5);
      draw(O);
      if (ca > .5) {
        O.save(); O.globalCompositeOperation = 'screen'; O.globalAlpha = .28;
        O.filter = 'none';
        const tint = (col, dx) => { const tc = cnv(W, H, c => { c.save(); c.translate(cx + dx, cy); c.scale(z, z); c.translate(-cx, -cy); c.drawImage(img, 0, 0, W, H); c.restore(); c.globalCompositeOperation = 'multiply'; c.fillStyle = col; c.fillRect(0, 0, W, H); }); O.drawImage(tc, 0, 0); };
        tint('#ff0000', ca); tint('#0000ff', -ca);
        O.restore();
      }
    }
  };
  S.over = t => {
    if (t >= 38) {
      // speed lines
      const a = Math.exp(-(t - 38) * 2.2);
      O.save(); O.globalAlpha = a * .8; O.strokeStyle = '#fff'; O.lineCap = 'round';
      for (let i = 0; i < 40; i++) { const an = i / 40 * TAU + R(i) * .1, r0 = 520 + R(i * 3) * 120 + (t - 38) * 300; O.lineWidth = 3 + R(i * 5) * 6; O.beginPath(); O.moveTo(945 + Math.cos(an) * r0, 600 + Math.sin(an) * r0); O.lineTo(945 + Math.cos(an) * (r0 + 300), 600 + Math.sin(an) * (r0 + 300)); O.stroke(); }
      O.restore();
      const bp = seg(t, 38, 38.25);
      const sh = Math.exp(-(t - 38) * 4) * 14;
      bubble(945 + Math.sin(t * 80) * sh, 150 + Math.cos(t * 70) * sh, 'BOO!!!', 160, bp, { rot: -.04 });
    }
    const s1 = seg(t, 39.6, 39.95), s2 = seg(t, 40.5, 40.85), fo = 1 - seg(t, 41.4, 41.6);
    subtitle('Relax. That’s just Kevin from Compliance.', H - 150, s1 * fo);
    subtitle('He’s been in the waiting room since 2021.', H - 78, s2 * fo, { size: 34, color: '#b8c4d6' });
    const ir = seg(t, 41.45, 42);
    if (ir > 0) eyeIris(945, 660, lerp(1300, 0, E.inExpo(ir)), 2.0);
  };
  SHOTS.push(S);
});

/* G · 42–50 · meet the staff: a line-up of 3D fomies */
const STAFF = [
  { name: 'INTAKE', color: 0x6b4226, acc: ['sprout', 'bowtie'] },
  { name: 'COLLABS', map: () => TEX.cow, acc: ['cowboy', 'pencil'] },
  { name: 'PICKLE SUPPORT', map: () => TEX.patch, acc: ['scarf', 'earring'] },
  { name: 'COMPLIANCE', map: () => TEX.caution, acc: ['witch'] },
  { name: 'WAITING ROOM', map: () => TEX.qr, acc: ['halo', 'scarf'] },
];
BUILDERS.push(() => {
  const S = new Shot(42, 50, 'FILE 07 · PERSONNEL');
  const sc = S.scene; sc.fog = new THREE.Fog(0xb3a6f3, 22, 60);
  sc.add(new THREE.HemisphereLight(0xffffff, 0x8c7bd8, 1.9));
  const key = new THREE.DirectionalLight(0xffffff, 2.1); key.position.set(4, 12, 10); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -12, right: 12, top: 10, bottom: -4 }); sc.add(key);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: .22, color: 0x2a1a6a })); floor.rotation.x = -PI / 2; floor.receiveShadow = true; sc.add(floor);
  const crew = STAFF.map((s, i) => { const f = makeFomie({ color: s.color, map: s.map && s.map(), acc: s.acc }); shadowsOn(f); f.position.x = (i - 2) * 3.75; sc.add(f); return f; });
  const ring = []; for (let i = 0; i < 10; i++) { const c = makeCard(CARD_KEYS[i % 5], 2.6); sc.add(c); ring.push(c); }
  S.update = t => {
    const lt = t - 42;
    crew.forEach((f, i) => {
      const t0 = 42.5 + i * .25;
      const p = E.outBack(seg(t, t0, t0 + .45));
      const hop = t > 43.5 ? Math.abs(Math.sin(PI * (t - BEAT0 + i * .1) / BEAT)) * .22 : 0;
      const jump = Math.sin(seg(t, 49.35 + i * .04, 49.85 + i * .04) * PI) * 2.4;
      f.position.y = lerp(-7, 0, p) + hop + jump;
      f.position.x = (i - 2) * 3.75;
      const sq = 1 + .06 * bounce(t) * seg(t, 43.5, 44);
      f.scale.set(sq, 2 - sq, sq);
      f.rotation.y = .25 * Math.sin(lt * .8 + i) * seg(t, 43, 44) + (1 - p) * 2;
      let lx = .25 * Math.sin(lt * 1.3 + i * .7);
      lx = lerp(lx, -.5, seg(t, 44, 44.12) * (1 - seg(t, 44.5, 44.62)));
      lx = lerp(lx, .5, seg(t, 44.5, 44.62) * (1 - seg(t, 45, 45.12)));
      lx = lerp(lx, 0, seg(t, 45, 45.12) * (1 - seg(t, 46.5, 46.8)));
      f.eyes.look(lx, .08 + .1 * Math.sin(lt + i));
      let bl = 0; const bt = t - (46.2 + i * .09); if (bt > 0 && bt < .2) bl = Math.sin(bt / .2 * PI);
      const bt2 = t - (48.4 + (4 - i) * .09); if (bt2 > 0 && bt2 < .2) bl = Math.sin(bt2 / .2 * PI);
      f.eyes.blink(bl);
      if (f.halo) f.halo.position.y = 3.24 + .55 + .08 * Math.sin(lt * 3);
      if (f.sprout) f.sprout.rotation.z = .2 * Math.sin(lt * 4);
    });
    ring.forEach((c, i) => {
      const a = i / ring.length * TAU + lt * .25;
      const p = E.outExpo(seg(t, 42.6 + i * .05, 43.6 + i * .05));
      c.position.set(Math.sin(a) * 15, 3.6 + Math.sin(lt + i) * .5 + lerp(-14, 0, p), -9 + Math.cos(a) * 6);
      c.rotation.set(0, a + PI, 0);
    });
    const orb = E.inOutCubic(seg(t, 44, 49.3));
    const ang = lerp(-.12, .32, orb);
    let cp = V(Math.sin(ang) * 19.5, 2.9, Math.cos(ang) * 19.5);
    const look = V(0, 2.2, 0);
    const wh = E.inExpo(seg(t, 49.45, 50));
    cp.y += wh * 7; look.y += wh * 16;
    camLook(S.cam, cp, look);
  };
  S.bg = t => halftoneBG(t);
  S.over = t => {
    popWords('MEET THE STAFF', W / 2, 160, { size: 110, stroke: '#121018', lw: 18, shadow: 'rgba(40,20,90,.35)', sdy: 12 }, t, 43.5, .1);
    crew.forEach((f, i) => {
      const [x, y] = toScreen(V(f.position.x, -.45, 0).applyMatrix4(new THREE.Matrix4()), S.cam);
      const a = seg(t, 44.2 + i * .12, 44.5 + i * .12) * (1 - seg(t, 49.3, 49.5));
      pillTag(x, y + 10, STAFF[i].name, a);
    });
    const s1 = seg(t, 46.9, 47.2), s2 = seg(t, 47.9, 48.2), fo = 1 - seg(t, 49.3, 49.5);
    if (s1 > 0) popWords('Everyone’s waiting.', W / 2, H - 120, { size: 56, color: '#fff', stroke: '#121018', lw: 10, alpha: fo }, t, 46.9, .08);
    if (s2 > 0) popWords('Nobody knows for what.', W / 2, H - 50, { size: 44, color: '#2a1f5c', alpha: fo }, t, 47.9, .08);
    const ir = seg(t, 42, 42.6);
    if (ir < 1) eyeIris(W / 2, H / 2, lerp(0, 1400, E.inCubic(ir)), 1.9);
    const fl = seg(t, 49.8, 50); if (fl > 0) { O.fillStyle = `rgba(255,255,255,${fl})`; O.fillRect(-60, -60, W + 120, H + 120); }
  };
  SHOTS.push(S);
});

/* H · 50–55.3 · END OF THREAD notice pinned to the board */
BUILDERS.push(() => {
  const S = new Shot(50, 55.3, 'FILE 08 · CLOSURE');
  const sc = S.scene;
  const PW = 1800, PH = 1010;
  const noteC = cnv(PW, PH); const noteT = texOf(noteC);
  let lastKey = '';
  const drawNote = (title, l1, l2) => {
    const k = title + '|' + l1 + '|' + l2; if (k === lastKey) return; lastKey = k;
    const c = noteC.getContext('2d');
    c.clearRect(0, 0, PW, PH);
    c.fillStyle = '#111'; c.beginPath(); c.roundRect(0, 0, PW, PH, 18); c.fill();
    const g = c.createLinearGradient(0, 0, PW, PH); g.addColorStop(0, '#b9b0f5'); g.addColorStop(1, '#a395ee');
    c.fillStyle = g; c.beginPath(); c.roundRect(10, 10, PW - 20, PH - 20, 14); c.fill();
    c.fillStyle = 'rgba(255,255,255,.12)'; c.beginPath(); c.moveTo(PW * .55, 10); c.lineTo(PW - 10, 10); c.lineTo(PW - 10, PH * .5); c.fill();
    c.fillStyle = '#121212'; for (let i = 0; i < 12; i++) { c.beginPath(); c.arc(110 + i * 143, 105, 30, 0, TAU); c.fill(); }
    c.strokeStyle = '#7b6cd4'; c.lineWidth = 5; c.setLineDash([36, 22]); c.beginPath(); c.moveTo(10, 210); c.lineTo(PW - 10, 210); c.stroke(); c.setLineDash([]);
    c.textAlign = 'center'; c.fillStyle = '#7d6fd8'; c.font = '150px BO'; c.fillText(title, PW / 2 + 6, 486);
    c.fillStyle = '#111'; c.fillText(title, PW / 2, 480);
    c.font = '54px BO'; c.fillStyle = '#7d6fd8'; c.fillText(l1, PW / 2 + 3, 643); c.fillText(l2, PW / 2 + 3, 723);
    c.fillStyle = '#111'; c.fillText(l1, PW / 2, 640); c.fillText(l2, PW / 2, 720);
    const s = 380 / CV.logoFlat.width; c.drawImage(CV.logoFlat, PW / 2 - 190, 790, 380, CV.logoFlat.height * s);
    c.fillStyle = 'rgba(70,50,140,.35)'; for (let i = 0; i < 300; i++) c.fillRect(R(i * 2.3) * PW, R(i * 4.1) * PH, 3, 3);
    noteT.needsUpdate = true;
  };
  const nw = 11.2, nh = nw * PH / PW;
  const ngeo = new THREE.PlaneGeometry(nw, nh, 32, 18), base = ngeo.attributes.position.array.slice();
  const note = new THREE.Mesh(ngeo, toonM(0xffffff, { map: noteT, transparent: true, alphaTest: .3, side: THREE.DoubleSide })); note.castShadow = true; note.receiveShadow = true;
  const holder = new THREE.Group(); holder.add(note); sc.add(holder);
  sc.add(new THREE.HemisphereLight(0xffffff, 0x50487a, 2.3));
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(-4, 6, 10); key.castShadow = true;
  key.shadow.mapSize.set(1536, 1536); Object.assign(key.shadow.camera, { left: -9, right: 9, top: 6, bottom: -6 }); sc.add(key);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), new THREE.ShadowMaterial({ opacity: .5 })); back.position.z = -.25; back.receiveShadow = true; sc.add(back);
  const pins = [[0xf2c230, -nw / 2 + .7, nh / 2 - .55, 51], [0x2f7fe0, nw / 2 - .7, nh / 2 - .55, 51.5], [0xe0353b, -nw / 2 + .7, -nh / 2 + .6, 52], [0x3fc94a, nw / 2 - .7, -nh / 2 + .6, 52.5]]
    .map(([c, x, y, ts]) => { const p = makePin(c); p.userData = { x, y, ts }; shadowsOn(p); holder.add(p); return p; });
  S.update = t => {
    const lt = t - 50;
    const inn = E.outCubic(seg(t, 50, 50.6));
    const land = Math.max(0, spring(t, 50.6, 3, 4));
    holder.position.set(0, lerp(-12, 0, inn), lerp(4, 0, inn));
    holder.rotation.set(lerp(-1.3, 0, inn) + .05 * land, lerp(.6, 0, inn), lerp(.4, -.02, inn));
    const pos = ngeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3], y = base[i * 3 + 1];
      const curl = (1 - inn) * 1.4 * Math.sin(x * .3 + lt * 6) + .35 * land * Math.sin(x * .7 + y * .4 - (t - 50.6) * 9);
      const pinned = pins.reduce((a, p) => a * (t > p.userData.ts ? clamp(Math.hypot(x - p.userData.x, y - p.userData.y) / 3) : 1), 1);
      pos.setZ(i, curl * pinned + .1 * Math.sin(x * .5 + lt * 2) * pinned);
    }
    pos.needsUpdate = true; ngeo.computeVertexNormals();
    pins.forEach(p => {
      const { x, y, ts } = p.userData;
      const d = E.inCubic(seg(t, ts - .22, ts));
      const sq = Math.max(0, spring(t, ts, 6, 10));
      p.position.set(x, y, lerp(5, .5, d));
      p.rotation.set(PI / 2 - .25, 0, lerp(1.5, .2, d));
      p.scale.set(1.3 + .25 * sq, 1.3 - .3 * sq, 1.3 + .25 * sq);
      p.visible = t > ts - .22;
    });
    const titleP = seg(t, 51.0, 51.9), l1 = seg(t, 52.6, 53.6), l2 = seg(t, 53.6, 54.5);
    drawNote(typed('END OF THREAD', titleP), typed('THE DEPARTMENT HAS NOTHING FURTHER TO ADD.', l1), typed('ANY REPLY BELOW THIS CLAIMING OTHERWISE IS A SCAM.', l2));
    // exit: paper rushes the lens
    const ex = E.inExpo(seg(t, 54.75, 55.3));
    holder.position.z += ex * 15.5; holder.rotation.z += ex * .4;
    camLook(S.cam, V(Math.sin(lt * .5) * .4, -.3 + Math.cos(lt * .4) * .2, 15.6 - lt * .25), V(0, 0, 0));
  };
  S.bg = t => coinBG(t);
  S.over = t => { const fl = 1 - seg(t, 50, 50.25); if (fl > 0) { O.fillStyle = `rgba(255,255,255,${fl})`; O.fillRect(-60, -60, W + 120, H + 120); } };
  SHOTS.push(S);
});

/* I · 55.3–60 · final logo */
BUILDERS.push(() => {
  const S = new Shot(55.3, 60, '');
  const sc = S.scene; sc.fog = new THREE.Fog(0xb3a6f3, 20, 50);
  sc.add(new THREE.HemisphereLight(0xffffff, 0x8c7bd8, 2));
  const key = new THREE.DirectionalLight(0xffffff, 2); key.position.set(-4, 10, 10); sc.add(key);
  const logo = makeLogo3D(11); sc.add(logo);
  const fom = makeFomie({ map: TEX.patch, acc: ['scarf', 'earring'] }); fom.scale.setScalar(1.25); sc.add(fom);
  const fom2 = makeFomie({ color: 0x6b4226, acc: ['sprout', 'bowtie'] }); fom2.scale.setScalar(1.1); sc.add(fom2);
  S.update = t => {
    const lt = t - 55.3;
    const f = E.inCubic(seg(t, 55.3, 55.5)), sq = t < 55.5 ? 0 : spring(t, 55.5, 3.2, 5.5);
    logo.position.set(0, lerp(12, 1.1, f) + .12 * Math.sin(lt * 1.6) * seg(t, 56, 56.6), 0);
    logo.scale.set(1 + .16 * sq, 1 - .2 * sq, 1);
    logo.rotation.set(.04 * Math.sin(lt * .9), .16 * Math.sin(lt * 1.1) * seg(t, 55.8, 56.6), 0);
    logo.coin.rotation.y = E.outCubic(seg(t, 56.5, 57.2)) * TAU * 2;
    const pk = E.outCubic(seg(t, 57.0, 57.4)), pk2 = E.outCubic(seg(t, 57.3, 57.7));
    fom.position.set(7.3, lerp(-12, -6.1, pk) + .25 * Math.max(0, spring(t, 57.4, 4, 6)), 1); fom.rotation.set(0, -.45, .12);
    fom2.position.set(-7.4, lerp(-12, -5.9, pk2) + .25 * Math.max(0, spring(t, 57.7, 4, 6)), 1); fom2.rotation.set(0, .45, -.12);
    fom.eyes.look(-.35 + .2 * seg(t, 58, 58.2), .25); fom2.eyes.look(.35, .25);
    let bl = 0; const bt = t - 58.5; if (bt > 0 && bt < .2) bl = Math.sin(bt / .2 * PI); fom.eyes.blink(bl);
    let bl2 = 0; const bt2 = t - 58.75; if (bt2 > 0 && bt2 < .2) bl2 = Math.sin(bt2 / .2 * PI); fom2.eyes.blink(bl2);
    camLook(S.cam, V(0, 0, 17.5 - lt * .3), V(0, .2, 0));
  };
  S.bg = t => halftoneBG(t);
  S.over = t => {
    popWords('THE DEPARTMENT WILL SEE YOU NOW.', W / 2, 800, { size: 74, stroke: '#121018', lw: 14, shadow: 'rgba(40,20,90,.35)', sdy: 9 }, t, 56.0, .07);
    txt('…eventually.', W / 2, 880, { fam: 'SE', size: 44, color: '#2a1f5c', alpha: seg(t, 57.4, 57.8), rot: -.02 });
    const fo = seg(t, 59.25, 60); if (fo > 0) { O.fillStyle = `rgba(0,0,0,${fo})`; O.fillRect(-60, -60, W + 120, H + 120); }
  };
  SHOTS.push(S);
});

/* ---------- global camera shake + post ---------- */
const HITS = [[6.5, 26], [13, 5], [16, 5], [17, 12], [21.95, 16], [22.95, 14], [23.95, 18], [27.5, 30], [31, 10], [38, 46], [42.5, 4], [50.6, 10], [51, 6], [51.5, 6], [52, 6], [52.5, 6], [55.5, 24]];
function shake(t) {
  let a = 0; for (const [h, s] of HITS) if (t >= h) a += s * Math.exp(-(t - h) * 7);
  return [a * Math.sin(t * 91.7) * Math.cos(t * 13.3), a * Math.cos(t * 83.1) * Math.sin(t * 17.9)];
}
const FLASH = [[6.5, .5], [27.5, .45], [38, .8], [55.5, .4]];
let grainC, vig;
function post(t, shot) {
  if (!grainC) {
    grainC = [0, 1, 2, 3].map(k => cnv(480, 270, (c, w, h) => { const d = c.createImageData(w, h); for (let i = 0; i < d.data.length; i += 4) { const v = R(i * .37 + k * 1000) * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } c.putImageData(d, 0, 0); }));
    vig = cnv(W, H, c => { const g = c.createRadialGradient(W / 2, H / 2, H * .45, W / 2, H / 2, H * 1.05); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.55)'); c.fillStyle = g; c.fillRect(0, 0, W, H); });
  }
  O.save();
  O.globalAlpha = .07; O.globalCompositeOperation = 'overlay'; O.imageSmoothingEnabled = false;
  O.drawImage(grainC[Math.floor(t * 24) % 4], 0, 0, W, H);
  O.restore();
  O.drawImage(vig, 0, 0);
  let fl = 0; for (const [h, s] of FLASH) if (t >= h) fl += s * Math.exp(-(t - h) * 9);
  if (fl > .01) { O.fillStyle = `rgba(255,255,255,${Math.min(1, fl)})`; O.fillRect(0, 0, W, H); }
  // case-file slug
  if (shot.label) {
    const a = seg(t, shot.a + .35, shot.a + .7) * (1 - seg(t, shot.b - .5, shot.b - .2));
    if (a > 0) {
      O.save(); O.globalAlpha = a * .9; O.font = '700 18px CP'; O.letterSpacing = '4px'; O.textBaseline = 'middle';
      const dark = /ORIENTATION|PERSONNEL|EXHIBIT/.test(shot.label);
      const tw = O.measureText(shot.label).width;
      O.fillStyle = dark ? 'rgba(17,18,22,.85)' : 'rgba(255,255,255,.1)'; O.beginPath(); O.roundRect(56, H - 84, tw + 60, 40, 8); O.fill();
      O.fillStyle = '#ff4b4b'; O.beginPath(); O.arc(78, H - 64, 6 * (Math.floor(t * 2) % 2 ? 1 : .6), 0, TAU); O.fill();
      O.fillStyle = '#f2ecdf'; O.fillText(shot.label, 96, H - 63);
      O.restore();
    }
  }
}

function renderFrame(t) {
  t = clamp(t, 0, DUR - 1e-4);
  const shot = SHOTS.find(s => t >= s.a && t < s.b) || SHOTS[SHOTS.length - 1];
  O.setTransform(1, 0, 0, 1, 0, 0); O.globalAlpha = 1; O.globalCompositeOperation = 'source-over'; O.filter = 'none';
  O.fillStyle = '#000'; O.fillRect(0, 0, W, H);
  const [sx, sy] = shake(t);
  O.save(); O.translate(sx, sy);
  shot.bg && shot.bg(t);
  if (!shot.flat) {
    shot.update(t);
    renderer.render(shot.scene, shot.cam);
    O.drawImage(glc, 0, 0);
  }
  shot.over && shot.over(t);
  O.restore();
  post(t, shot);
}

/* ---------- boot ---------- */
window.DURATION = DUR;
window.renderFrame = renderFrame;
const RENDER = /render=1/.test(location.search);
window.ready = loadAssets().then(() => { SHOTS.length = 0; buildShots(); renderFrame(0); return true; });

// shots need textures, so they are (re)built after loading; the blocks above register a builder each
function buildShots() { BUILDERS.forEach(b => b()); }

if (!RENDER) {
  const audio = new Audio('soundtrack.wav');
  let t0 = performance.now() / 1000 - (+(new URLSearchParams(location.search).get('t')) || 0), paused = false, pausedAt = 0, withSound = false;
  const now = () => withSound ? audio.currentTime : (paused ? pausedAt : performance.now() / 1000 - t0);
  const seek = t => { t = clamp(t, 0, DUR); if (withSound) audio.currentTime = t; else { t0 = performance.now() / 1000 - t; pausedAt = t; } };
  window.ready.then(() => {
    const loop = () => { let t = now(); if (t >= DUR) { seek(0); t = 0; } renderFrame(t); requestAnimationFrame(loop); };
    loop();
  });
  addEventListener('click', () => { const t = now(); withSound = true; audio.currentTime = t; audio.play(); document.getElementById('hint').style.display = 'none'; });
  addEventListener('keydown', e => {
    if (e.code === 'Space') { if (withSound) { audio.paused ? audio.play() : audio.pause(); } else { if (paused) { t0 = performance.now() / 1000 - pausedAt; } else pausedAt = now(); paused = !paused; } e.preventDefault(); }
    if (e.code === 'ArrowRight') seek(now() + 5);
    if (e.code === 'ArrowLeft') seek(now() - 5);
  });
}
