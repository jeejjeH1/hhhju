'use strict';
const { app, BrowserWindow, WebContentsView, session, ipcMain, Menu, dialog, net, shell, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const sec = require('./lib/security');
const extensions = require('./lib/extensions');

if (!process.argv.includes('--no-sandbox')) app.enableSandbox();   // پیش‌فرض: سندباکس کامل
if (!app.requestSingleInstanceLock()) { app.quit(); }

const TOP = 92;                       // ارتفاع نوار تب + نوار ابزار
const UI_PAGE = path.join(__dirname, 'ui', 'index.html');
const ERR_PAGE = path.join(__dirname, 'ui', 'error.html');

// ───────────── تنظیمات (ذخیره روی دیسک) ─────────────
const DEFAULTS = {
  theme: 'dark', searchEngine: 'duckduckgo', httpsOnly: true, blockTrackers: true,
  clearOnExit: false, homepage: '', permissions: {}, bookmarks: [], history: [],
};
const SETTING_TYPES = { theme: ['dark', 'light'], searchEngine: Object.keys(sec.SEARCH_ENGINES) };
let settings = { ...DEFAULTS };
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');
function loadSettings() {
  try { settings = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(settingsFile(), 'utf8')) }; } catch { /* اولین اجرا */ }
}
let saveTimer;
function saveSettings() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { fs.mkdirSync(app.getPath('userData'), { recursive: true }); fs.writeFileSync(settingsFile(), JSON.stringify(settings)); } catch (e) { console.warn(e.message); }
  }, 300);
}

// ───────────── وضعیت ─────────────
let win, ui, uiOverlay = true, fullscreenTab = false, barH = 0;
const tabs = new Map();               // id → tab
let order = [];                       // ترتیب تب‌ها
let activeId = null, nextId = 1;
const downloads = [];
const allowHttpHosts = new Set();
const upgraded = new Map();           // webContentsId → آخرین URL ارتقایافته
const blockedCount = new Map();       // tabId → تعداد ردیاب بلاک‌شده
const pendingPerms = new Map();       // id → resolve
const favCache = new Map();
let permSeq = 0;
let findOpen = false;

const mainSes = () => session.fromPartition('persist:pars');
const privSes = () => session.fromPartition('pars-private');
const uiWC = () => ui && ui.webContents;
const isUI = (wc) => wc === uiWC();
const tabByWC = (wc) => [...tabs.values()].find((t) => t.view.webContents === wc);

function send(ch, payload) { if (ui && !uiWC().isDestroyed()) uiWC().send(ch, payload); }

// ───────────── سشن‌ها ─────────────
function hardenSession(ses, isPrivate) {
  ses.setUserAgent(ses.getUserAgent().replace(/\s*Electron\/\S+/, '').replace(/\s*pars-browser\/\S+/, ''));

  ses.webRequest.onBeforeRequest((d, cb) => {
    let u; try { u = new URL(d.url); } catch { return cb({}); }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return cb({});
    if (settings.blockTrackers && d.resourceType !== 'mainFrame' && sec.isTracker(u.hostname)) {
      const t = d.webContentsId && tabByWC(require('electron').webContents.fromId(d.webContentsId));
      if (t) { blockedCount.set(t.id, (blockedCount.get(t.id) || 0) + 1); schedulePush(); }
      return cb({ cancel: true });
    }
    if (settings.httpsOnly && u.protocol === 'http:' && d.resourceType === 'mainFrame' &&
        !sec.isLocalHost(u.hostname) && !allowHttpHosts.has(u.hostname)) {
      u.protocol = 'https:';
      if (d.webContentsId) upgraded.set(d.webContentsId, u.href);
      return cb({ redirectURL: u.href });
    }
    cb({});
  });

  ses.webRequest.onBeforeSendHeaders((d, cb) => {
    const h = d.requestHeaders;
    if (/^https?:/.test(d.url)) {
      h['Sec-GPC'] = '1'; h['DNT'] = '1';
      if (h.Referer) {
        try {
          const r = new URL(h.Referer), u = new URL(d.url);
          if (r.origin !== u.origin) h.Referer = r.origin + '/';   // ارسال فقط origin به سایت‌های دیگر
        } catch { delete h.Referer; }
      }
    }
    cb({ requestHeaders: h });
  });

  // مجوزها: پیش‌فرض رد؛ فقط موارد زیر با پرسش از کاربر
  const ASKABLE = new Set(['media', 'geolocation', 'notifications', 'clipboard-read', 'midi', 'display-capture']);
  const ALWAYS_OK = new Set(['fullscreen', 'clipboard-sanitized-write', 'pointerLock', 'window-management']);
  ses.setPermissionCheckHandler((wc, perm, origin) => {
    if (ALWAYS_OK.has(perm)) return true;
    return settings.permissions[origin] && settings.permissions[origin][perm] === 'allow';
  });
  ses.setPermissionRequestHandler(async (wc, perm, cb, details) => {
    if (isUI(wc)) return cb(false);
    if (ALWAYS_OK.has(perm)) return cb(true);
    if (!ASKABLE.has(perm)) return cb(false);
    let origin; try { origin = new URL(details.requestingUrl).origin; } catch { return cb(false); }
    const saved = settings.permissions[origin] && settings.permissions[origin][perm];
    if (saved) return cb(saved === 'allow');
    const answer = await askPermission(origin, perm);
    if (answer.remember && !isPrivate) {
      (settings.permissions[origin] ||= {})[perm] = answer.allow ? 'allow' : 'deny';
      saveSettings();
    }
    cb(answer.allow);
  });

  ses.on('will-download', (e, item) => onDownload(item, isPrivate));
}

function askPermission(origin, perm) {
  return new Promise((resolve) => {
    const id = ++permSeq;
    const timer = setTimeout(() => { pendingPerms.delete(id); send('perm:close', id); resolve({ allow: false }); }, 45000);
    pendingPerms.set(id, (a) => { clearTimeout(timer); resolve(a); });
    send('perm:ask', { id, origin, perm });
  });
}

function onDownload(item, isPrivate) {
  const dir = app.getPath('downloads');
  let name = path.basename(item.getFilename()).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_') || 'download';
  let target = path.join(dir, name), n = 1;
  const ext = path.extname(name), base = path.basename(name, ext);
  while (fs.existsSync(target)) target = path.join(dir, `${base} (${n++})${ext}`);
  item.setSavePath(target);
  const rec = { id: Date.now() + Math.random(), name: path.basename(target), path: target, received: 0, total: item.getTotalBytes(), state: 'progressing', risky: sec.DANGEROUS_EXT.test(name) };
  downloads.unshift(rec);
  if (rec.risky) {
    item.pause();
    dialog.showMessageBox(win, { type: 'warning', buttons: ['دانلود', 'لغو'], defaultId: 1, cancelId: 1, noLink: true,
      title: 'فایل اجرایی', message: `«${rec.name}» یک فایل اجرایی است.`, detail: 'فقط اگر به منبع آن اعتماد دارید ادامه دهید.' })
      .then((r) => (r.response === 0 ? item.resume() : item.cancel()));
  }
  item.on('updated', () => { rec.received = item.getReceivedBytes(); rec.total = item.getTotalBytes(); schedulePush(); });
  item.once('done', (_e, state) => { rec.state = state; schedulePush(); });
  schedulePush();
}

// ───────────── تب‌ها ─────────────
function createTab(url, { priv = false, activate = true } = {}) {
  const id = nextId++;
  const view = new WebContentsView({
    webPreferences: {
      session: priv ? privSes() : mainSes(),
      sandbox: true, contextIsolation: true, nodeIntegration: false, nodeIntegrationInSubFrames: false,
      webSecurity: true, allowRunningInsecureContent: false, webviewTag: false, spellcheck: false,
      enableWebSQL: false, navigateOnDragDrop: false,
    },
  });
  const tab = { id, view, priv, title: '', url: '', favicon: '', loading: false, notice: null, zoom: 0 };
  tabs.set(id, tab); order.push(id);
  wireTab(tab);
  view.setBackgroundColor('#ffffff');
  win.contentView.addChildView(view);
  view.setVisible(false);
  if (activate) activateTab(id);
  if (url) navigate(tab, url);
  schedulePush();
  return tab;
}

function wireTab(tab) {
  const wc = tab.view.webContents;
  wc.setWebRTCIPHandlingPolicy('default_public_interface_only');   // جلوگیری از نشت IP واقعی
  wc.setWindowOpenHandler(({ url, disposition }) => {
    if (sec.isSafeNavigationUrl(url)) createTab(url, { priv: tab.priv, activate: disposition !== 'background-tab' });
    return { action: 'deny' };
  });
  wc.on('will-navigate', (e, url) => {
    if (!sec.isSafeNavigationUrl(url) && !url.startsWith('file://' + ERR_PAGE.replace(/\\/g, '/'))) e.preventDefault();
  });
  wc.on('will-attach-webview', (e) => e.preventDefault());
  const sync = () => {
    const cur = wc.getURL();
    if (!cur.startsWith('file:')) { tab.url = cur; tab.notice = tab.notice && tab.notice.url === cur ? tab.notice : null; }
    tab.title = wc.getTitle() || tab.title;
    schedulePush();
  };
  wc.on('did-start-loading', () => { tab.loading = true; schedulePush(); });
  wc.on('did-stop-loading', () => { tab.loading = false; schedulePush(); });
  wc.on('did-navigate', (_e, url) => {
    tab.notice = null; sync();
    if (!tab.priv && sec.isSafeNavigationUrl(url)) addHistory(url, wc.getTitle());
  });
  wc.on('did-navigate-in-page', sync);
  wc.on('page-title-updated', (_e, title) => {
    tab.title = title; schedulePush();
    const h = settings.history[0]; if (h && h.url === tab.url && !tab.priv) { h.title = title; saveSettings(); }
  });
  wc.on('page-favicon-updated', (_e, favs) => loadFavicon(tab, favs[0]));
  wc.on('did-fail-load', (_e, code, desc, failedUrl, isMain) => {
    if (!isMain || code === -3 || code === -2 && !failedUrl) return;     // لغو شده توسط کاربر
    if (failedUrl.startsWith('file:')) return;
    const wasUpgraded = upgraded.get(wc.id) && failedUrl.startsWith('https:');
    const kind = /CERT|SSL|SECURITY/.test(desc) ? 'cert' : wasUpgraded ? 'https' : 'net';
    tab.url = failedUrl;
    if (kind === 'https') {
      try { const u = new URL(failedUrl); u.protocol = 'http:'; tab.notice = { type: 'httpFallback', url: failedUrl, http: u.href }; } catch { /* */ }
    }
    wc.loadFile(ERR_PAGE, { query: { kind, desc, url: failedUrl } });
  });
  wc.on('render-process-gone', () => { tab.title = 'تب از کار افتاد'; schedulePush(); });
  wc.on('enter-html-full-screen', () => { fullscreenTab = true; win.setFullScreen(true); layout(); });
  wc.on('leave-html-full-screen', () => { fullscreenTab = false; win.setFullScreen(false); layout(); });
  wc.on('context-menu', (_e, p) => showContextMenu(tab, p));
  wc.on('before-input-event', (e, input) => handleShortcut(e, input));
  wc.on('found-in-page', (_e, r) => send('find:result', { active: r.activeMatchOrdinal, total: r.matches }));
}

async function loadFavicon(tab, url) {
  if (!url) return;
  if (url.startsWith('data:')) { tab.favicon = url.length < 65536 ? url : ''; return schedulePush(); }
  if (!/^https?:/.test(url)) return;
  if (favCache.has(url)) { tab.favicon = favCache.get(url); return schedulePush(); }
  try {
    const res = await net.fetch(url, { session: tab.priv ? privSes() : mainSes(), bypassCustomProtocolHandlers: true });
    const buf = Buffer.from(await res.arrayBuffer());
    const type = (res.headers.get('content-type') || 'image/png').split(';')[0];
    if (!res.ok || buf.length > 100 * 1024 || !/^image\/(png|x-icon|vnd\.microsoft\.icon|jpeg|gif|webp)$/.test(type)) return;
    const data = `data:${type};base64,${buf.toString('base64')}`;
    if (favCache.size > 200) favCache.clear();
    favCache.set(url, data); tab.favicon = data; schedulePush();
  } catch { /* بدون آیکون */ }
}

function navigate(tab, input) {
  const url = sec.resolveInput(input, settings.searchEngine);
  if (!url) return;
  tab.notice = null; tab.url = url;
  tab.view.webContents.loadURL(url).catch(() => { /* did-fail-load مدیریتش می‌کند */ });
  schedulePush();
}

function activateTab(id) {
  if (!tabs.has(id)) return;
  for (const t of tabs.values()) t.view.setVisible(t.id === id);
  activeId = id;
  win.contentView.addChildView(ui);        // UI همیشه روی صفحه
  layout(); schedulePush();
}

function closeTab(id) {
  const tab = tabs.get(id); if (!tab) return;
  const idx = order.indexOf(id);
  order.splice(idx, 1); tabs.delete(id); blockedCount.delete(id);
  win.contentView.removeChildView(tab.view);
  tab.view.webContents.close();
  if (!order.length) return createTab('', { activate: true });
  if (activeId === id) activateTab(order[Math.min(idx, order.length - 1)]);
  const anyPriv = [...tabs.values()].some((t) => t.priv);
  if (!anyPriv) privSes().clearStorageData().then(() => privSes().clearCache()).catch(() => {});
  schedulePush();
}

function layout() {
  if (!win) return;
  const [w, h] = win.getContentSize();
  const tab = tabs.get(activeId);
  if (tab) tab.view.setBounds(fullscreenTab ? { x: 0, y: 0, width: w, height: h } : { x: 0, y: TOP + barH, width: w, height: Math.max(0, h - TOP - barH) });
  ui.setVisible(!fullscreenTab);
  ui.setBounds(uiOverlay ? { x: 0, y: 0, width: w, height: h } : { x: 0, y: 0, width: w, height: TOP + barH });
}

function addHistory(url, title) {
  const h = settings.history;
  if (h[0] && h[0].url === url) return;
  h.unshift({ url, title: title || url, time: Date.now() });
  if (h.length > 1000) h.length = 1000;
  saveSettings();
}

// ───────────── کانتکست‌منو و میانبرها ─────────────
function showContextMenu(tab, p) {
  const wc = tab.view.webContents, items = [];
  if (p.linkURL && sec.isSafeNavigationUrl(p.linkURL)) {
    items.push({ label: 'باز کردن پیوند در تب جدید', click: () => createTab(p.linkURL, { priv: tab.priv, activate: false }) });
    items.push({ label: 'کپی نشانی پیوند', click: () => clipboard.writeText(p.linkURL) });
  }
  if (p.selectionText) {
    items.push({ role: 'copy', label: 'کپی' });
    items.push({ label: `جستجو: «${p.selectionText.slice(0, 24)}»`, click: () => createTab(sec.resolveInput(p.selectionText.slice(0, 200), settings.searchEngine) || '', { priv: tab.priv }) });
  }
  if (p.isEditable) items.push({ role: 'cut', label: 'برش' }, { role: 'paste', label: 'چسباندن' }, { role: 'selectAll', label: 'انتخاب همه' });
  if (p.srcURL && p.mediaType === 'image' && /^https?:/.test(p.srcURL)) items.push({ label: 'باز کردن تصویر در تب جدید', click: () => createTab(p.srcURL, { priv: tab.priv }) });
  if (!items.length) items.push({ label: 'عقب', enabled: wc.navigationHistory.canGoBack(), click: () => wc.navigationHistory.goBack() },
    { label: 'جلو', enabled: wc.navigationHistory.canGoForward(), click: () => wc.navigationHistory.goForward() }, { label: 'بارگذاری مجدد', click: () => wc.reload() });
  if (!app.isPackaged) items.push({ type: 'separator' }, { label: 'بازرسی عنصر', click: () => wc.inspectElement(p.x, p.y) });
  Menu.buildFromTemplate(items).popup({ window: win });
}

function handleShortcut(e, input) {
  if (input.type !== 'keyDown') return;
  const mod = input.control || input.meta, k = input.key.toLowerCase(), tab = tabs.get(activeId);
  const act = (fn) => { e.preventDefault(); fn(); };
  if (mod && !input.shift && !input.alt) {
    if (k === 't') return act(() => createTab(''));
    if (k === 'w') return act(() => closeTab(activeId));
    if (k === 'l') return act(() => send('focus:omnibox'));
    if (k === 'r') return act(() => tab && tab.view.webContents.reload());
    if (k === 'd') return act(() => toggleBookmark());
    if (k === 'f') return act(() => send('find:open'));
    if (k === 'tab') return act(() => cycle(1));
    if (k === '=' || k === '+') return act(() => zoom(0.5));
    if (k === '-') return act(() => zoom(-0.5));
    if (k === '0') return act(() => zoom(null));
    if (/^[1-9]$/.test(k)) return act(() => activateTab(k === '9' ? order[order.length - 1] : order[+k - 1] ?? activeId));
  }
  if (mod && input.shift && k === 'n') return act(() => createTab('', { priv: true }));
  if (mod && input.shift && k === 'tab') return act(() => cycle(-1));
  if (k === 'f5') return act(() => tab && tab.view.webContents.reload());
  if (input.alt && k === 'arrowleft') return act(() => tab && tab.view.webContents.navigationHistory.goBack());
  if (input.alt && k === 'arrowright') return act(() => tab && tab.view.webContents.navigationHistory.goForward());
  if (k === 'escape') send('esc');
}
const cycle = (d) => { const i = order.indexOf(activeId); activateTab(order[(i + d + order.length) % order.length]); };
function zoom(delta) {
  const t = tabs.get(activeId); if (!t) return;
  t.zoom = delta === null ? 0 : Math.max(-3, Math.min(5, t.zoom + delta));
  t.view.webContents.setZoomLevel(t.zoom); schedulePush();
}
function toggleBookmark() {
  const t = tabs.get(activeId); if (!t || !sec.isSafeNavigationUrl(t.url)) return;
  const i = settings.bookmarks.findIndex((b) => b.url === t.url);
  if (i >= 0) settings.bookmarks.splice(i, 1); else settings.bookmarks.push({ url: t.url, title: t.title || t.url, favicon: t.favicon });
  saveSettings(); schedulePush();
}

// ───────────── ارسال وضعیت به UI ─────────────
let pushTimer;
function schedulePush() { if (pushTimer) return; pushTimer = setTimeout(() => { pushTimer = null; pushState(); }, 40); }
function pushState() {
  const list = order.map((id) => {
    const t = tabs.get(id), wc = t.view.webContents;
    const nav = wc.navigationHistory;
    return { id, title: t.title, url: t.url, favicon: t.favicon, loading: t.loading, priv: t.priv, notice: t.notice,
      canBack: nav.canGoBack(), canForward: nav.canGoForward(), blocked: blockedCount.get(id) || 0, zoom: t.zoom,
      bookmarked: settings.bookmarks.some((b) => b.url === t.url) };
  });
  send('state', {
    tabs: list, active: activeId, theme: settings.theme,
    settings: { theme: settings.theme, searchEngine: settings.searchEngine, httpsOnly: settings.httpsOnly, blockTrackers: settings.blockTrackers, clearOnExit: settings.clearOnExit, homepage: settings.homepage },
    bookmarks: settings.bookmarks, downloads: downloads.slice(0, 30).map(({ path: _p, ...d }) => d),
    fullscreen: win.isFullScreen(),
  });
}

// ───────────── IPC (فقط از رندر UI پذیرفته می‌شود) ─────────────
function handle(ch, fn) {
  ipcMain.handle(ch, (e, ...args) => {
    if (!isUI(e.sender) || e.senderFrame !== e.sender.mainFrame) throw new Error('forbidden');
    return fn(...args);
  });
}
const str = (v, max = 2048) => (typeof v === 'string' ? v.slice(0, max) : '');
const active = () => tabs.get(activeId);

handle('ui:ready', () => { pushState(); });
handle('ui:overlay', (on) => { uiOverlay = !!on; layout(); });
handle('ui:bar', (h) => { barH = Math.max(0, Math.min(80, +h || 0)); layout(); });
handle('tab:new', (priv) => { createTab('', { priv: !!priv }); });
handle('tab:close', (id) => closeTab(+id));
handle('tab:activate', (id) => activateTab(+id));
handle('tab:go', (input) => { const t = active(); if (t) navigate(t, str(input)); });
handle('tab:back', () => { const t = active(); t && t.view.webContents.navigationHistory.goBack(); });
handle('tab:forward', () => { const t = active(); t && t.view.webContents.navigationHistory.goForward(); });
handle('tab:reload', () => { const t = active(); if (!t) return; t.loading ? t.view.webContents.stop() : t.view.webContents.reload(); });
handle('tab:move', (from, to) => { const i = order.indexOf(+from); if (i < 0) return; order.splice(i, 1); order.splice(Math.max(0, Math.min(order.length, +to)), 0, +from); schedulePush(); });
handle('tab:allowHttp', () => {
  const t = active(); if (!t || !t.notice) return;
  const u = new URL(t.notice.http); allowHttpHosts.add(u.hostname); navigate(t, u.href);
});
handle('tab:zoom', (d) => zoom(d === 0 ? null : +d));
handle('bookmark:toggle', () => toggleBookmark());
handle('bookmark:remove', (url) => { settings.bookmarks = settings.bookmarks.filter((b) => b.url !== url); saveSettings(); schedulePush(); });
handle('find:run', (text, forward) => { const t = active(); if (!t) return; text ? t.view.webContents.findInPage(String(text).slice(0, 200), { forward: forward !== false, findNext: true }) : t.view.webContents.stopFindInPage('clearSelection'); });
handle('find:stop', () => { const t = active(); t && t.view.webContents.stopFindInPage('clearSelection'); });
handle('history:get', () => settings.history.slice(0, 200));
handle('history:clear', () => { settings.history = []; saveSettings(); });
handle('suggest', (q) => {
  q = str(q, 100).toLowerCase(); if (!q) return [];
  const pool = [...settings.bookmarks.map((b) => ({ ...b, kind: 'bookmark' })), ...settings.history.slice(0, 300).map((h) => ({ ...h, kind: 'history' }))];
  const seen = new Set();
  return pool.filter((x) => (x.url + ' ' + (x.title || '')).toLowerCase().includes(q) && !seen.has(x.url) && seen.add(x.url)).slice(0, 6).map(({ url, title, kind }) => ({ url, title, kind }));
});
handle('settings:set', (key, value) => {
  if (!(key in DEFAULTS) || ['permissions', 'bookmarks', 'history'].includes(key)) return;
  if (typeof DEFAULTS[key] !== typeof value) return;
  if (SETTING_TYPES[key] && !SETTING_TYPES[key].includes(value)) return;
  if (key === 'homepage' && value && !sec.isSafeNavigationUrl(value)) return;
  settings[key] = value; saveSettings(); schedulePush();
});
handle('perm:answer', (id, allow, remember) => { const r = pendingPerms.get(+id); if (r) { pendingPerms.delete(+id); r({ allow: !!allow, remember: !!remember }); } });
handle('perms:list', () => settings.permissions);
handle('perms:reset', () => { settings.permissions = {}; saveSettings(); });
handle('data:clear', async () => {
  const s = mainSes(); await s.clearStorageData(); await s.clearCache(); await s.clearHostResolverCache();
  settings.history = []; saveSettings();
});
handle('dl:open', (id) => { const d = downloads.find((x) => x.id === +id); if (d && d.state === 'completed') shell.showItemInFolder(d.path); });

// اکستنشن‌ها
handle('ext:list', () => extensions.list(mainSes()));
handle('ext:install', async (type, value) => {
  try {
    let src;
    if (type === 'store') src = { type, value: str(value, 500) };
    else {
      const r = await dialog.showOpenDialog(win, type === 'crx'
        ? { properties: ['openFile'], filters: [{ name: 'CRX', extensions: ['crx', 'zip'] }] }
        : { properties: ['openDirectory'] });
      if (r.canceled || !r.filePaths[0]) return { ok: false, cancelled: true };
      src = { type, value: r.filePaths[0] };
    }
    const res = await extensions.install(win, mainSes(), src);
    schedulePush();
    return res ? { ok: true, name: res.manifest.name } : { ok: false, cancelled: true };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
});
handle('ext:remove', async (id) => { await extensions.remove(mainSes(), str(id, 64)); });
handle('ext:open', (id, which) => {
  const ext = mainSes().extensions.getExtension(str(id, 64)); if (!ext) return;
  const info = extensions.list(mainSes()).find((x) => x.id === ext.id);
  const page = which === 'options' ? info.options : info.popup;
  if (!page) return;
  const w = new BrowserWindow({ width: which === 'options' ? 900 : 380, height: which === 'options' ? 700 : 560, parent: win, autoHideMenuBar: true, title: ext.name,
    webPreferences: { session: mainSes(), sandbox: true, contextIsolation: true, nodeIntegration: false } });
  w.loadURL(`chrome-extension://${ext.id}/${page.replace(/^\//, '')}`);
  w.webContents.setWindowOpenHandler(({ url }) => { if (sec.isSafeNavigationUrl(url)) createTab(url); return { action: 'deny' }; });
});

// ───────────── راه‌اندازی ─────────────
function setupUI() {
  const uiSes = session.fromPartition('pars-ui');
  uiSes.webRequest.onBeforeRequest((d, cb) => cb({ cancel: !/^(file|devtools|chrome-extension):/.test(d.url) }));   // رابط هرگز به شبکه وصل نمی‌شود
  uiSes.setPermissionRequestHandler((_wc, _p, cb) => cb(false));
  ui = new WebContentsView({
    webPreferences: { session: uiSes, preload: path.join(__dirname, 'preload.js'), sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, spellcheck: false },
  });
  ui.setBackgroundColor('#00000000');
  uiWC().on('will-navigate', (e) => e.preventDefault());
  uiWC().setWindowOpenHandler(() => ({ action: 'deny' }));
  uiWC().on('before-input-event', (e, input) => handleShortcut(e, input));
  win.contentView.addChildView(ui);
  uiWC().loadFile(UI_PAGE);
}

app.on('certificate-error', (e, _wc, _url, _err, _cert, cb) => { e.preventDefault(); cb(false); });   // هرگز گواهی نامعتبر را نپذیر
app.on('web-contents-created', (_e, wc) => {
  wc.on('will-attach-webview', (ev) => ev.preventDefault());
});
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

app.whenReady().then(async () => {
  loadSettings();
  Menu.setApplicationMenu(null);
  hardenSession(mainSes(), false);
  hardenSession(privSes(), true);
  await extensions.loadAll(mainSes());

  win = new BrowserWindow({ width: 1280, height: 820, minWidth: 640, minHeight: 420, show: false, title: 'پارس', backgroundColor: '#12141a',
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
  setupUI();
  win.on('resize', layout);
  win.on('enter-full-screen', () => { layout(); schedulePush(); });
  win.on('leave-full-screen', () => { fullscreenTab = false; layout(); schedulePush(); });
  win.once('ready-to-show', () => win.show());
  createTab(settings.homepage || '');
  layout();
});

app.on('before-quit', async () => {
  if (settings.clearOnExit) { try { await mainSes().clearStorageData(); await mainSes().clearCache(); } catch { /* */ } settings.history = []; }
  try { fs.mkdirSync(app.getPath('userData'), { recursive: true }); fs.writeFileSync(settingsFile(), JSON.stringify(settings)); } catch { /* */ }
});
app.on('window-all-closed', () => app.quit());
