'use strict';
// نصب امن اکستنشن: از فروشگاه وب کروم (با شناسه/لینک)، فایل .crx، یا پوشه‌ی unpacked.
// قبل از نصب، مجوزهای درخواستی با یک پنجره‌ی بومی (غیرقابل جعل توسط صفحات وب) به کاربر نشان داده می‌شود.

const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { app, dialog, net } = require('electron');

const ID_RE = /[a-p]{32}/;
const MAX_CRX = 64 * 1024 * 1024;

const extRoot = () => path.join(app.getPath('userData'), 'extensions');

function parseExtensionId(input) {
  const m = String(input || '').match(ID_RE);
  return m ? m[0] : null;
}

async function downloadCrx(id) {
  const prod = process.versions.chrome.split('.')[0] + '.0';
  const url =
    'https://clients2.google.com/service/update2/crx?response=redirect&acceptformat=crx2,crx3' +
    `&prodversion=${prod}&x=${encodeURIComponent(`id=${id}&uc`)}`;
  const res = await net.fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`دانلود ناموفق بود (HTTP ${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_CRX) throw new Error('حجم اکستنشن بیش از حد مجاز است');
  return buf;
}

function crxToZip(buf) {
  if (buf.slice(0, 4).toString() !== 'Cr24') {
    if (buf[0] === 0x50 && buf[1] === 0x4b) return buf; // خودش zip است
    throw new Error('فایل CRX معتبر نیست');
  }
  const ver = buf.readUInt32LE(4);
  if (ver === 3) return buf.slice(12 + buf.readUInt32LE(8));
  if (ver === 2) return buf.slice(16 + buf.readUInt32LE(8) + buf.readUInt32LE(12));
  throw new Error('نسخه‌ی CRX پشتیبانی نمی‌شود');
}

function extractZip(zipBuf, dest) {
  const zip = new AdmZip(zipBuf);
  const root = path.resolve(dest);
  let total = 0;
  fs.mkdirSync(root, { recursive: true });
  for (const e of zip.getEntries()) {
    const target = path.resolve(root, e.entryName);
    if (target !== root && !target.startsWith(root + path.sep)) throw new Error('مسیر مشکوک در فایل فشرده (zip-slip)');
    if (e.isDirectory) { fs.mkdirSync(target, { recursive: true }); continue; }
    total += e.header.size;
    if (total > 512 * 1024 * 1024) throw new Error('حجم باز‌شده بیش از حد است');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, e.getData());
  }
}

function readManifest(dir) {
  const m = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8').replace(/^﻿/, ''));
  if (!m.name || !m.version) throw new Error('manifest.json ناقص است');
  return m;
}

function describePermissions(m) {
  const perms = [...(m.permissions || []), ...(m.optional_permissions ? [] : [])];
  const hosts = [...(m.host_permissions || []), ...(m.content_scripts || []).flatMap((c) => c.matches || [])];
  const all = hosts.some((h) => h === '<all_urls>' || /^(\*|https?|\*):\/\/\*\/\*$/.test(h));
  const lines = [];
  if (all) lines.push('⚠️ خواندن و تغییر داده‌های همه‌ی وب‌سایت‌ها');
  else if (hosts.length) lines.push(`دسترسی به ${new Set(hosts).size} سایت: ${[...new Set(hosts)].slice(0, 4).join('، ')}${hosts.length > 4 ? ' …' : ''}`);
  const risky = { cookies: 'خواندن کوکی‌ها', history: 'تاریخچه‌ی مرور', tabs: 'اطلاعات تب‌ها', webRequest: 'مشاهده‌ی درخواست‌های شبکه',
    webRequestBlocking: 'تغییر درخواست‌های شبکه', downloads: 'مدیریت دانلودها', clipboardRead: 'خواندن کلیپ‌بورد',
    nativeMessaging: '⚠️ ارتباط با برنامه‌های نصب‌شده روی سیستم', debugger: '⚠️ دیباگ صفحات', management: 'مدیریت سایر اکستنشن‌ها',
    proxy: '⚠️ کنترل پروکسی', storage: 'ذخیره‌ی داده', scripting: 'اجرای اسکریپت در صفحات', geolocation: 'موقعیت مکانی' };
  for (const p of perms) if (risky[p]) lines.push(risky[p]);
  return { lines, dangerous: all || perms.some((p) => ['nativeMessaging', 'debugger', 'proxy'].includes(p)) };
}

async function confirmInstall(win, m, source) {
  const { lines, dangerous } = describePermissions(m);
  const { response } = await dialog.showMessageBox(win, {
    type: dangerous ? 'warning' : 'question',
    buttons: ['نصب', 'انصراف'], defaultId: 1, cancelId: 1, noLink: true,
    title: 'نصب اکستنشن',
    message: `«${m.name}» نسخه‌ی ${m.version} نصب شود؟`,
    detail: `منبع: ${source}\n\nاین اکستنشن می‌تواند:\n${lines.length ? lines.map((l) => '• ' + l).join('\n') : '• (مجوز ویژه‌ای نمی‌خواهد)'}\n\nفقط اکستنشن‌های مورد اعتماد را نصب کنید.`,
  });
  return response === 0;
}

/** @returns {Promise<{ext, manifest}|null>} null یعنی کاربر انصراف داد */
async function install(win, ses, source) {
  fs.mkdirSync(extRoot(), { recursive: true });
  const tmp = fs.mkdtempSync(path.join(extRoot(), '.tmp-'));
  try {
    let label;
    if (source.type === 'store') {
      const id = parseExtensionId(source.value);
      if (!id) throw new Error('شناسه یا لینک فروشگاه معتبر نیست');
      extractZip(crxToZip(await downloadCrx(id)), tmp);
      label = `فروشگاه وب کروم (${id})`;
    } else if (source.type === 'crx') {
      extractZip(crxToZip(fs.readFileSync(source.value)), tmp);
      label = path.basename(source.value);
    } else {
      fs.cpSync(source.value, tmp, { recursive: true, dereference: false, filter: (s) => !fs.lstatSync(s).isSymbolicLink() });
      label = source.value;
    }
    const manifest = readManifest(tmp);
    if (!(await confirmInstall(win, manifest, label))) return null;
    const folder = path.join(extRoot(), 'x-' + Date.now().toString(36));
    fs.renameSync(tmp, folder);
    const ext = await ses.extensions.loadExtension(folder, { allowFileAccess: false });
    fs.writeFileSync(path.join(folder, '.pars-id'), ext.id);
    return { ext, manifest };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

async function loadAll(ses) {
  const root = extRoot();
  if (!fs.existsSync(root)) return;
  for (const d of fs.readdirSync(root)) {
    if (!d.startsWith('x-')) continue;
    try { await ses.extensions.loadExtension(path.join(root, d), { allowFileAccess: false }); }
    catch (e) { console.warn('extension load failed', d, e.message); }
  }
}

async function remove(ses, id) {
  const ext = ses.extensions.getExtension(id);
  if (!ext) return;
  const dir = ext.path;
  await ses.extensions.removeExtension(id);
  if (path.dirname(dir) === extRoot()) fs.rmSync(dir, { recursive: true, force: true });
}

function iconDataUrl(ext) {
  try {
    const m = ext.manifest;
    const icons = (m.action || m.browser_action || {}).default_icon || m.icons || {};
    const rel = typeof icons === 'string' ? icons : icons[48] || icons[32] || icons[128] || icons[16] || Object.values(icons)[0];
    if (!rel) return null;
    const file = path.resolve(ext.path, rel);
    if (!file.startsWith(path.resolve(ext.path) + path.sep)) return null;
    const buf = fs.readFileSync(file);
    if (buf.length > 256 * 1024) return null;
    const mime = /\.svg$/i.test(file) ? 'image/svg+xml' : /\.jpe?g$/i.test(file) ? 'image/jpeg' : 'image/png';
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch { return null; }
}

function list(ses) {
  return ses.extensions.getAllExtensions().map((e) => {
    const m = e.manifest;
    const act = m.action || m.browser_action || {};
    return {
      id: e.id, name: m.name, version: m.version, description: m.description || '',
      icon: iconDataUrl(e), popup: act.default_popup || null, options: m.options_page || (m.options_ui && m.options_ui.page) || null,
    };
  });
}

module.exports = { install, loadAll, remove, list, parseExtensionId, _test: { crxToZip, extractZip, describePermissions } };
