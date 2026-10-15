'use strict';
const q = new URLSearchParams(location.search);
const kind = q.get('kind'), url = q.get('url') || '', desc = q.get('desc') || '';
const m = document.getElementById('m');
const T = {
  cert: ['اتصال امن نیست', 'گواهی امنیتی این سایت معتبر نیست. ممکن است کسی در حال شنود یا جعل سایت باشد؛ به همین دلیل مرورگر ادامه نمی‌دهد.'],
  https: ['این سایت HTTPS ندارد', 'پارس به‌طور خودکار اتصال را به HTTPS ارتقا داد اما سایت پاسخ نداد. برای ادامه با اتصال ناامن، از نوار بالای صفحه استفاده کنید.'],
  net: ['صفحه باز نشد', 'اتصال برقرار نشد. اینترنت یا نشانی را بررسی کنید.'],
}[kind] || ['صفحه باز نشد', 'اتصال برقرار نشد.'];
if (kind === 'cert') m.className = 'red';
const el = (t, txt, attrs) => { const e = document.createElement(t); e.textContent = txt; Object.assign(e, attrs); return e; };
m.replaceChildren(el('h1', T[0]), el('p', T[1]), el('code', url), el('p', desc.replace(/^net::/, '')));
if (kind !== 'cert' && /^https?:\/\//.test(url)) m.append(el('a', 'تلاش دوباره', { href: url }));
