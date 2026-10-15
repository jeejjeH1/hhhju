'use strict';
const $ = (s) => document.querySelector(s);
const P = window.pars;

// ── آیکون‌ها ──
const IC = {
  back: '<path d="M5 12h14M13 6l6 6-6 6"/>', fwd: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  reload: '<path d="M20 12a8 8 0 1 1-2.4-5.7M20 4v5h-5"/>', stop: '<path d="M6 6l12 12M18 6L6 18"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  warn: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.01"/>', search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4-4"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>', puzzle: '<path d="M10 4h4v3a2 2 0 1 0 0 4h3v4h-3a2 2 0 1 0-4 0H7v-4a2 2 0 1 1 0-4h3z"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>', plus: '<path d="M12 5v14M5 12h14"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>', mask: '<path d="M3 8c3-2 6-2 9 0 3-2 6-2 9 0v4c0 4-3 7-6 7-1.5 0-2.2-1-3-1s-1.5 1-3 1c-3 0-6-3-6-7z"/><path d="M8 12h.01M16 12h.01"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', dl: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
  trash: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>', find: '<circle cx="10" cy="10" r="6"/><path d="M20 20l-5.5-5.5"/>',
  book: '<path d="M6 4h12v17l-6-4-6 4z"/>', folder: '<path d="M3 7h6l2 2h10v10H3z"/>', zoom: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4-4M8 11h6M11 8v6"/>',
};
const icon = (n) => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.innerHTML = IC[n]; return s; };
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'style') e.style.cssText = v; else if (k === 'class') e.className = v; else if (v === true) e.setAttribute(k, ''); else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const k of kids.flat(Infinity)) if (k != null && k !== false) e.append(k instanceof Node ? k : document.createTextNode(k));
  return e;
}
const fa = (n) => Number(n).toLocaleString('fa-IR');
const host = (u) => { try { return new URL(u).hostname; } catch { return ''; } };
const PERM = { media: 'دوربین / میکروفون', geolocation: 'موقعیت مکانی', notifications: 'ارسال اعلان', 'clipboard-read': 'خواندن کلیپ‌بورد', midi: 'دستگاه‌های MIDI', 'display-capture': 'ضبط صفحه‌ی نمایش' };

let S = null, drawer = null, perms = [], findOn = false, editing = false, sugg = [], sel = -1;

// ── ثابت‌ها ──
$('#back').append(icon('back'));   // در RTL «عقب» به راست اشاره می‌کند
$('#fwd').append(icon('fwd'));
$('#star').append(icon('star')); $('#extBtn').append(icon('puzzle')); $('#menuBtn').append(icon('menu'));
$('#back').onclick = () => P.tab.back(); $('#fwd').onclick = () => P.tab.forward(); $('#reload').onclick = () => P.tab.reload();
$('#star').onclick = () => P.bookmark.toggle();
$('#menuBtn').onclick = () => openDrawer('menu'); $('#extBtn').onclick = () => openDrawer('ext');
$('#scrim').onclick = () => closeDrawer();

// ── نوار آدرس ──
const url = $('#url');
url.addEventListener('focus', () => { editing = true; url.select(); });
url.addEventListener('blur', () => { editing = false; setTimeout(() => ($('#suggest').hidden = true), 120); render(); });
url.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { P.tab.go(sel >= 0 && sugg[sel] ? sugg[sel].url : url.value); url.blur(); }
  else if (e.key === 'Escape') { url.blur(); }
  else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sel += e.key === 'ArrowDown' ? 1 : -1; if (sel >= sugg.length) sel = -1; if (sel < -1) sel = sugg.length - 1; drawSuggest(); }
});
url.addEventListener('input', async () => {
  const q = url.value.trim(); sel = -1;
  sugg = q ? await P.suggest(q) : []; drawSuggest();
});
function drawSuggest() {
  const box = $('#suggest'); box.hidden = !sugg.length; box.replaceChildren(...sugg.map((s, i) =>
    h('div', { class: i === sel ? 'sel' : '', onmousedown: (e) => { e.preventDefault(); P.tab.go(s.url); url.blur(); } }, icon(s.kind === 'bookmark' ? 'star' : 'clock'), h('span', {}, s.title || s.url), h('small', {}, s.url))));
}

// ── رندر اصلی ──
function render() {
  if (!S) return;
  document.documentElement.dataset.theme = S.settings.theme;
  const t = S.tabs.find((x) => x.id === S.active); if (!t) return;
  // تب‌ها
  const tabs = $('#tabs');
  tabs.replaceChildren(...S.tabs.map((x) => {
    const el = h('div', { class: 'tab' + (x.id === S.active ? ' active' : '') + (x.priv ? ' priv' : ''), role: 'tab', 'aria-selected': x.id === S.active, draggable: true, title: x.title || x.url,
      onmousedown: (e) => { if (e.button === 1) { e.preventDefault(); P.tab.close(x.id); } else if (e.button === 0) P.tab.activate(x.id); },
      ondragstart: (e) => e.dataTransfer.setData('text/plain', String(x.id)),
      ondragover: (e) => { e.preventDefault(); el.classList.add('drop'); }, ondragleave: () => el.classList.remove('drop'),
      ondrop: (e) => { e.preventDefault(); P.tab.move(+e.dataTransfer.getData('text/plain'), S.tabs.findIndex((y) => y.id === x.id)); } },
      x.loading ? h('i', { class: 'spin' }) : x.favicon ? h('img', { class: 'fav', src: x.favicon, alt: '' }) : x.priv ? icon('mask') : h('i', { class: 'fav' }),
      h('span', { class: 'ttl' }, x.title || (x.url ? host(x.url) : x.priv ? 'تب خصوصی' : 'تب جدید')),
      h('button', { class: 'x', 'aria-label': 'بستن تب', onmousedown: (e) => e.stopPropagation(), onclick: (e) => { e.stopPropagation(); P.tab.close(x.id); } }, icon('x')));
    return el;
  }), h('button', { id: 'newTabBtn', title: 'تب جدید (Ctrl+T)', onclick: () => P.tab.new(false) }, icon('plus')));
  // دکمه‌ها
  $('#back').disabled = !t.canBack; $('#fwd').disabled = !t.canForward;
  $('#reload').replaceChildren(icon(t.loading ? 'stop' : 'reload'));
  $('#star').classList.toggle('on', t.bookmarked);
  if (!editing) url.value = t.url || '';
  // امنیت
  const sec = $('#sec'); sec.className = 'sec';
  if (t.url.startsWith('https:')) { sec.classList.add('ok'); sec.replaceChildren(icon('lock')); sec.title = 'اتصال امن (HTTPS)'; }
  else if (t.url.startsWith('http:')) { sec.classList.add('bad'); sec.replaceChildren(icon('warn'), 'ناامن'); sec.title = 'اتصال رمزنگاری نشده'; }
  else if (t.priv) { sec.classList.add('priv'); sec.replaceChildren(icon('mask'), 'خصوصی'); }
  else { sec.replaceChildren(icon('search')); sec.title = ''; }
  const sh = $('#shield'); sh.hidden = !S.settings.blockTrackers || !t.blocked; sh.replaceChildren(icon('shield'), fa(t.blocked));
  // صفحه‌ی تب جدید
  const blank = !t.url;
  $('#newtab').hidden = !blank; if (blank) drawNewTab(t);
  syncLayout(t);
  if (drawer) drawDrawer(); else $('#drawer').hidden = true;
}

let lastBar = -1, lastOverlay = null;
function syncLayout(t) {
  const bar = $('#bar'), t0 = t || S.tabs.find((x) => x.id === S.active);
  let content = null;
  if (perms.length) {
    const p = perms[0];
    let remember = true; const cb = h('input', { type: 'checkbox', checked: true, onchange: (e) => (remember = e.target.checked) });
    content = [icon('shield'), h('span', { class: 'grow' }, h('b', { dir: 'ltr' }, host(p.origin)), ` می‌خواهد به «${PERM[p.perm] || p.perm}» دسترسی داشته باشد.`),
      h('label', {}, cb, 'به خاطر بسپار'), h('button', { class: 'btn dng', onclick: () => answerPerm(p, false, remember) }, 'مسدود'), h('button', { class: 'btn pri', onclick: () => answerPerm(p, true, remember) }, 'اجازه')];
  } else if (findOn) {
    const inp = h('input', { placeholder: 'یافتن در صفحه…', onkeydown: (e) => { if (e.key === 'Enter') P.find.run(inp.value, !e.shiftKey); if (e.key === 'Escape') closeFind(); }, oninput: () => P.find.run(inp.value, true) });
    content = [icon('find'), inp, h('span', { id: 'findCount', class: 'grow' }), h('button', { class: 'btn', onclick: () => P.find.run(inp.value, false) }, 'قبلی'), h('button', { class: 'btn', onclick: () => P.find.run(inp.value, true) }, 'بعدی'), h('button', { class: 'ib sm', onclick: closeFind, 'aria-label': 'بستن' }, icon('x'))];
    if (!bar.querySelector('input')) setTimeout(() => bar.querySelector('input') && bar.querySelector('input').focus(), 30);
  } else if (t0 && t0.notice) {
    content = [icon('warn'), h('span', { class: 'grow' }, `«${host(t0.notice.url)}» از HTTPS پشتیبانی نمی‌کند. ادامه با اتصال رمزنگاری‌نشده، اطلاعات شما را در معرض دید دیگران قرار می‌دهد.`), h('button', { class: 'btn dng', onclick: () => P.tab.allowHttp() }, 'ادامه با HTTP')];
  }
  if (content) { if (!bar.dataset.key || bar.dataset.key !== keyOf()) { bar.replaceChildren(...content); bar.dataset.key = keyOf(); } bar.hidden = false; }
  else { bar.hidden = true; delete bar.dataset.key; }
  const bh = content ? 44 : 0; if (bh !== lastBar) { lastBar = bh; P.bar(bh); }
  const overlay = !!drawer || !$('#newtab').hidden; if (overlay !== lastOverlay) { lastOverlay = overlay; P.overlay(overlay); }
  $('#scrim').hidden = !drawer;
}
const keyOf = () => (perms.length ? 'p' + perms[0].id : findOn ? 'f' : 'n' + (S.tabs.find((x) => x.id === S.active) || {}).id);
function answerPerm(p, allow, remember) { P.perm.answer(p.id, allow, remember); perms = perms.filter((x) => x !== p); render(); }
function closeFind() { findOn = false; P.find.stop(); render(); }

function drawNewTab(t) {
  const nt = $('#newtab'); nt.classList.toggle('priv', t.priv);
  const box = h('input', { class: 'hero', placeholder: 'جستجو یا وارد کردن نشانی…', 'aria-label': 'جستجو', onkeydown: (e) => { if (e.key === 'Enter' && box.value.trim()) P.tab.go(box.value); } });
  nt.replaceChildren(h('h1', {}, 'پارس'), box,
    t.priv ? h('p', { class: 'note' }, 'تب خصوصی: تاریخچه، کوکی و حافظه‌ی نهان با بستن آخرین تب خصوصی پاک می‌شود. اکستنشن‌ها در این حالت فعال نیستند.')
      : S.bookmarks.length ? h('div', { class: 'grid' }, S.bookmarks.slice(0, 12).map((b) => h('button', { class: 'tile', onclick: () => P.tab.go(b.url) }, h('div', { class: 'ic' }, b.favicon ? h('img', { src: b.favicon, alt: '' }) : (host(b.url)[0] || '•').toUpperCase()), h('span', {}, b.title || host(b.url)))))
      : h('p', { class: 'note' }, 'با Ctrl+D صفحه‌های مورد علاقه‌ات را نشان‌دار کن تا اینجا ببینی.'));
  if (!nt.dataset.focused || nt.dataset.focused !== String(t.id)) { nt.dataset.focused = t.id; setTimeout(() => box.focus(), 30); }
}

// ── کشو (منو و پنل‌ها) ──
function openDrawer(name) { drawer = drawer === name ? null : name; if (!drawer) return render(); loadDrawerData().then(render); }
function closeDrawer() { drawer = null; render(); }
let D = {};
async function loadDrawerData() {
  if (drawer === 'history') D.history = await P.history.get();
  if (drawer === 'ext') D.ext = await P.ext.list();
  if (drawer === 'settings') D.perms = await P.perm.list();
}
function drawDrawer() {
  const d = $('#drawer'); d.hidden = false;
  const titles = { menu: 'منو', bookmarks: 'نشان‌ها', history: 'تاریخچه', downloads: 'دانلودها', ext: 'اکستنشن‌ها', settings: 'تنظیمات و حریم خصوصی' };
  const back = drawer !== 'menu' && drawer !== 'ext' ? h('button', { class: 'ib sm', onclick: () => openDrawer('menu'), 'aria-label': 'بازگشت' }, icon('back')) : null;
  const body = { menu: dMenu, bookmarks: dBookmarks, history: dHistory, downloads: dDownloads, ext: dExt, settings: dSettings }[drawer]();
  d.replaceChildren(h('header', {}, back, h('span', { class: 'grow' }, titles[drawer]), h('button', { class: 'ib sm', onclick: closeDrawer, 'aria-label': 'بستن' }, icon('x'))), h('div', { class: 'body' }, body));
  if (!drawer) d.hidden = true;
}
const go = (name) => () => { drawer = name; loadDrawerData().then(render); };
const mi = (ic, label, fn, kbd) => h('button', { class: 'item', onclick: fn }, icon(ic), h('span', { class: 'col' }, label), kbd && h('kbd', {}, kbd));
function dMenu() {
  const t = S.tabs.find((x) => x.id === S.active);
  return [mi('plus', 'تب جدید', () => { closeDrawer(); P.tab.new(false); }, 'Ctrl+T'), mi('mask', 'تب خصوصی', () => { closeDrawer(); P.tab.new(true); }, 'Ctrl+Shift+N'),
    h('div', { class: 'sep' }),
    mi('star', 'نشان‌ها', go('bookmarks')), mi('clock', 'تاریخچه', go('history')), mi('dl', 'دانلودها', go('downloads')), mi('puzzle', 'اکستنشن‌ها', go('ext')),
    h('div', { class: 'sep' }),
    mi('find', 'یافتن در صفحه', () => { closeDrawer(); findOn = true; render(); }, 'Ctrl+F'),
    h('div', { class: 'row' }, h('span', {}, 'بزرگ‌نمایی'), h('span', {}, h('button', { class: 'btn', onclick: () => P.tab.zoom(-0.5) }, '−'), ' ', h('button', { class: 'btn', onclick: () => P.tab.zoom(0) }, t && t.zoom ? fa(Math.round(Math.pow(1.2, t.zoom) * 100)) + '٪' : '۱۰۰٪'), ' ', h('button', { class: 'btn', onclick: () => P.tab.zoom(0.5) }, '+'))),
    h('div', { class: 'sep' }), mi('gear', 'تنظیمات و حریم خصوصی', go('settings'))];
}
function dBookmarks() {
  if (!S.bookmarks.length) return h('div', { class: 'empty' }, 'هنوز نشانی ذخیره نکرده‌ای. Ctrl+D را بزن.');
  return S.bookmarks.map((b) => h('div', { class: 'item' }, b.favicon ? h('img', { src: b.favicon, alt: '' }) : icon('star'),
    h('button', { class: 'col', style: 'text-align:start', onclick: () => { closeDrawer(); P.tab.go(b.url); } }, h('span', {}, b.title), h('span', { class: 'sub', dir: 'ltr' }, b.url)),
    h('button', { class: 'ib sm', onclick: () => P.bookmark.remove(b.url), 'aria-label': 'حذف' }, icon('trash'))));
}
function dHistory() {
  const rows = (D.history || []).map((x) => h('button', { class: 'item', onclick: () => { closeDrawer(); P.tab.go(x.url); } }, icon('clock'),
    h('span', { class: 'col' }, h('span', {}, x.title || x.url), h('span', { class: 'sub', dir: 'ltr' }, x.url))));
  return [h('button', { class: 'btn dng', onclick: async () => { await P.history.clear(); D.history = []; render(); } }, 'پاک کردن تاریخچه'), rows.length ? rows : h('div', { class: 'empty' }, 'تاریخچه خالی است.')];
}
function dDownloads() {
  if (!S.downloads.length) return h('div', { class: 'empty' }, 'دانلودی وجود ندارد.');
  return S.downloads.map((x) => h('button', { class: 'item', onclick: () => P.download.show(x.id) }, icon('dl'), h('span', { class: 'col' }, h('span', {}, x.name),
    h('span', { class: 'sub' }, x.state === 'completed' ? 'کامل شد' : x.state === 'progressing' ? `${fa(Math.round((x.received / (x.total || 1)) * 100))}٪` : 'لغو یا ناموفق', x.risky ? ' · فایل اجرایی ⚠️' : ''),
    x.state === 'progressing' && h('div', { class: 'prog' }, h('i', { style: `width:${Math.min(100, (x.received / (x.total || 1)) * 100)}%` })))));
}
function dExt() {
  const msg = h('div', { class: 'sub', id: 'extMsg', style: 'padding:4px 12px' });
  const inp = h('input', { class: 'field', dir: 'ltr', style: 'flex:1', placeholder: 'لینک یا شناسه‌ی فروشگاه وب کروم', onkeydown: (e) => e.key === 'Enter' && install('store', inp.value) });
  async function install(type, v) {
    msg.textContent = 'در حال نصب…'; const r = await P.ext.install(type, v);
    msg.textContent = r.ok ? `«${r.name}» نصب شد.` : r.cancelled ? '' : 'خطا: ' + r.error;
    D.ext = await P.ext.list(); render();
  }
  const list = (D.ext || []).map((e) => h('div', { class: 'item' }, e.icon ? h('img', { src: e.icon, alt: '' }) : icon('puzzle'),
    h('button', { class: 'col', style: 'text-align:start', onclick: () => e.popup ? (closeDrawer(), P.ext.open(e.id, 'popup')) : e.options && (closeDrawer(), P.ext.open(e.id, 'options')) }, h('span', {}, e.name), h('span', { class: 'sub' }, `v${e.version} · ${e.description}`)),
    e.options && h('button', { class: 'ib sm', title: 'گزینه‌ها', onclick: () => P.ext.open(e.id, 'options') }, icon('gear')),
    h('button', { class: 'ib sm', title: 'حذف', onclick: async () => { await P.ext.remove(e.id); D.ext = await P.ext.list(); render(); } }, icon('trash'))));
  return [h('div', { class: 'row' }, inp, h('button', { class: 'btn pri', onclick: () => install('store', inp.value) }, 'نصب')),
    h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => install('dir') }, 'پوشه‌ی unpacked…'), h('button', { class: 'btn', onclick: () => install('crx') }, 'فایل CRX…')), msg,
    h('div', { class: 'sep' }), list.length ? list : h('div', { class: 'empty' }, 'اکستنشنی نصب نیست.'),
    h('p', { class: 'sub', style: 'padding:10px 12px;line-height:1.9' }, 'قبل از هر نصب، مجوزهای اکستنشن در یک پنجره‌ی جدا نشان داده می‌شود. اکستنشن‌ها در تب‌های خصوصی اجرا نمی‌شوند.')];
}
function toggle(label, desc, key) {
  const on = S.settings[key];
  return h('div', { class: 'row' }, h('div', {}, h('div', {}, label), h('div', { class: 'd' }, desc)), h('button', { class: 'sw', role: 'switch', 'aria-checked': String(on), 'aria-label': label, onclick: () => P.settings.set(key, !on) }));
}
function dSettings() {
  const s = S.settings;
  const sel = (key, opts) => h('select', { onchange: (e) => P.settings.set(key, e.target.value) }, Object.entries(opts).map(([v, l]) => h('option', { value: v, selected: s[key] === v }, l)));
  const hp = h('input', { class: 'field', dir: 'ltr', value: s.homepage, placeholder: 'خالی = صفحه‌ی تب جدید', style: 'width:180px', onchange: (e) => P.settings.set('homepage', e.target.value.trim()) });
  const pl = Object.entries(D.perms || {}).flatMap(([o, m]) => Object.entries(m).map(([p, v]) => h('div', { class: 'row' }, h('span', { dir: 'ltr' }, host(o)), h('span', { class: 'd' }, `${PERM[p] || p}: ${v === 'allow' ? 'مجاز' : 'مسدود'}`))));
  return [h('div', { class: 'sect' }, 'ظاهر'), h('div', { class: 'row' }, 'پوسته', sel('theme', { dark: 'تیره', light: 'روشن' })),
    h('div', { class: 'row' }, 'موتور جستجو', sel('searchEngine', { duckduckgo: 'DuckDuckGo', brave: 'Brave Search', startpage: 'Startpage', google: 'Google' })),
    h('div', { class: 'row' }, 'صفحه‌ی آغازین', hp),
    h('div', { class: 'sect' }, 'امنیت و حریم خصوصی'),
    toggle('فقط HTTPS', 'ارتقای خودکار http به https و هشدار قبل از اتصال ناامن', 'httpsOnly'),
    toggle('مسدودسازی ردیاب‌ها', 'درخواست‌های تبلیغاتی و تحلیلی شناخته‌شده قطع می‌شود', 'blockTrackers'),
    toggle('پاک‌سازی هنگام خروج', 'کوکی‌ها، حافظه‌ی نهان و تاریخچه با بستن برنامه پاک شود', 'clearOnExit'),
    h('div', { class: 'row' }, h('div', {}, h('div', {}, 'پاک کردن اطلاعات مرور'), h('div', { class: 'd' }, 'کوکی، حافظه‌ی نهان، تاریخچه')), h('button', { class: 'btn dng', onclick: async () => { await P.clearData(); toast('پاک شد'); } }, 'پاک کن')),
    h('div', { class: 'sect' }, 'مجوزهای ذخیره‌شده'), pl.length ? pl : h('div', { class: 'd', style: 'padding:6px 12px' }, 'مجوزی ذخیره نشده است.'),
    pl.length && h('button', { class: 'btn', style: 'margin:6px 12px', onclick: async () => { await P.perm.reset(); D.perms = {}; render(); } }, 'بازنشانی مجوزها'),
    h('div', { class: 'sect' }, 'همیشه فعال'), h('p', { class: 'd', style: 'padding:0 12px 12px;line-height:1.9' }, 'سندباکس صفحات، جداسازی زمینه، رد گواهی نامعتبر، ارسال Sec-GPC/DNT، کوتاه‌سازی Referer، محافظت از نشت IP در WebRTC و رد پیش‌فرض همه‌ی مجوزها.')];
}
let toastT; function toast(m) { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 1800); }

// ── رویدادها از پردازش اصلی ──
P.on('state', (s) => { S = s; render(); });
P.on('perm:ask', (p) => { perms.push(p); render(); });
P.on('perm:close', (id) => { perms = perms.filter((p) => p.id !== id); render(); });
P.on('focus:omnibox', () => { drawer = null; render(); url.focus(); });
P.on('find:open', () => { findOn = true; render(); });
P.on('find:result', (r) => { const c = $('#findCount'); if (c) c.textContent = r.total ? `${fa(r.active)} از ${fa(r.total)}` : 'یافت نشد'; });
P.on('esc', () => { if (drawer) closeDrawer(); else if (findOn) closeFind(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (drawer) closeDrawer(); else if (findOn) closeFind(); } });
P.ready();
