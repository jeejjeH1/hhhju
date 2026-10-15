'use strict';
// اجرا: npm test   (بدون نیاز به GUI)
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const AdmZip = require('adm-zip');
const sec = require('../lib/security');

// ورودی نوار آدرس
assert.strictEqual(sec.resolveInput('example.com', 'duckduckgo'), 'https://example.com');
assert.strictEqual(sec.resolveInput('localhost:3000/x', 'duckduckgo'), 'http://localhost:3000/x');
assert.strictEqual(sec.resolveInput('192.168.1.1', 'duckduckgo'), 'http://192.168.1.1');
assert.strictEqual(sec.resolveInput('سلام دنیا', 'brave'), 'https://search.brave.com/search?q=' + encodeURIComponent('سلام دنیا'));
assert.strictEqual(sec.resolveInput('javascript:alert(1)', 'google').startsWith('https://www.google.com'), true); // جستجو می‌شود، اجرا نمی‌شود
assert.strictEqual(sec.resolveInput('file:///etc/passwd', 'google'), '');
assert.ok(sec.resolveInput('data:text/html,<script>', 'google').startsWith('https://www.google.com/search?q='));
assert.strictEqual(sec.resolveInput('   ', 'google'), '');
// ردیاب‌ها
assert.ok(sec.isTracker('www.google-analytics.com'));
assert.ok(sec.isTracker('doubleclick.net'));
assert.ok(!sec.isTracker('notdoubleclick.net'));
assert.ok(!sec.isTracker('example.com'));
// شبکه‌ی محلی از ارتقای HTTPS مستثنا است
assert.ok(sec.isLocalHost('localhost') && sec.isLocalHost('192.168.0.5') && !sec.isLocalHost('8.8.8.8'));
assert.ok(sec.DANGEROUS_EXT.test('setup.exe') && !sec.DANGEROUS_EXT.test('photo.jpg'));
assert.ok(!sec.isSafeNavigationUrl('file:///x') && !sec.isSafeNavigationUrl('javascript:1') && sec.isSafeNavigationUrl('https://a.b'));

// اکستنشن: zip-slip و CRX
const ext = require('../lib/extensions');
const { crxToZip, extractZip, describePermissions } = ext._test;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pars-'));
const z2 = new AdmZip(); z2.addFile('x.txt', Buffer.from('x')); z2.getEntries().forEach((e) => { e.entryName = '../escape.txt'; });
assert.throws(() => extractZip(z2.toBuffer(), path.join(tmp, 'out')), /zip-slip/);
assert.ok(!fs.existsSync(path.join(tmp, 'escape.txt')));
const good = new AdmZip(); good.addFile('manifest.json', Buffer.from('{"name":"t","version":"1"}')); good.addFile('a/b.js', Buffer.from('1'));
extractZip(good.toBuffer(), path.join(tmp, 'ok')); assert.ok(fs.existsSync(path.join(tmp, 'ok/a/b.js')));
const hdr = Buffer.alloc(12); hdr.write('Cr24'); hdr.writeUInt32LE(3, 4); hdr.writeUInt32LE(5, 8);
assert.deepStrictEqual(crxToZip(Buffer.concat([hdr, Buffer.alloc(5), good.toBuffer()])), good.toBuffer());
assert.throws(() => crxToZip(Buffer.from('not a crx at all')), /CRX/);
assert.strictEqual(ext.parseExtensionId('https://chromewebstore.google.com/detail/ublock/cjpalhdlnbpafiamejdnhcphjbkeiagm'), 'cjpalhdlnbpafiamejdnhcphjbkeiagm');
assert.strictEqual(ext.parseExtensionId('hello'), null);
assert.ok(describePermissions({ permissions: ['cookies'], host_permissions: ['<all_urls>'] }).dangerous);
assert.ok(!describePermissions({ permissions: ['storage'] }).dangerous);
fs.rmSync(tmp, { recursive: true, force: true });
console.log('همه‌ی تست‌ها گذشت ✓');
