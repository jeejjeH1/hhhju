'use strict';
// قوانین امنیتی مشترک: بلاک ردیاب‌ها، ارتقا به HTTPS، پاک‌سازی هدرها.

const TRACKER_DOMAINS = [
  'doubleclick.net', 'googlesyndication.com', 'googleadservices.com', 'google-analytics.com',
  'googletagmanager.com', 'googletagservices.com', 'adservice.google.com', 'connect.facebook.net',
  'scorecardresearch.com', 'quantserve.com', 'hotjar.com', 'hotjar.io', 'mixpanel.com',
  'segment.io', 'segment.com', 'amplitude.com', 'criteo.com', 'criteo.net', 'taboola.com',
  'outbrain.com', 'adnxs.com', 'rubiconproject.com', 'pubmatic.com', 'openx.net', 'moatads.com',
  'adsrvr.org', 'clarity.ms', 'mc.yandex.ru', 'analytics.tiktok.com', 'ads-twitter.com',
  'fullstory.com', 'mouseflow.com', 'crazyegg.com', 'chartbeat.com', 'chartbeat.net',
  'bat.bing.com', 'ads.linkedin.com', 'px.ads.linkedin.com', 'amazon-adsystem.com',
  'adform.net', 'casalemedia.com', 'smartadserver.com', 'zedo.com', 'yieldmo.com',
];

function hostMatches(host, list) {
  host = host.toLowerCase();
  return list.some((d) => host === d || host.endsWith('.' + d));
}

const isTracker = (host) => hostMatches(host, TRACKER_DOMAINS);

function isLocalHost(host) {
  return (
    host === 'localhost' || host.endsWith('.localhost') || host === '[::1]' ||
    /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) || host.endsWith('.local')
  );
}

const DANGEROUS_EXT = /\.(exe|msi|bat|cmd|com|scr|pif|ps1|vbs|vbe|js|jse|wsf|jar|apk|dmg|pkg|app|sh|run|deb|rpm|lnk|reg|hta|cpl)$/i;

/** فقط http/https/mailto... از دید کاربر قابل‌باز شدن‌اند؛ بقیه (file:, javascript:, data: …) رد می‌شوند. */
function isSafeNavigationUrl(u) {
  try {
    const p = new URL(u);
    return p.protocol === 'https:' || p.protocol === 'http:';
  } catch { return false; }
}

const SEARCH_ENGINES = {
  duckduckgo: 'https://duckduckgo.com/?q=%s',
  brave: 'https://search.brave.com/search?q=%s',
  startpage: 'https://www.startpage.com/do/search?q=%s',
  google: 'https://www.google.com/search?q=%s',
};

/** ورودی نوار آدرس → URL نهایی (آدرس یا جستجو) */
function resolveInput(text, engine) {
  text = String(text || '').trim();
  if (!text) return '';
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) return isSafeNavigationUrl(text) ? text : '';
  if (/^(localhost|[\w-]+(\.[\w-]+)+)(:\d+)?(\/\S*)?$/i.test(text) && !/\s/.test(text)) {
    const host = text.split(/[/:]/)[0];
    return (isLocalHost(host) ? 'http://' : 'https://') + text;
  }
  if (/^\d{1,3}(\.\d{1,3}){3}(:\d+)?(\/\S*)?$/.test(text)) return 'http://' + text;
  const tpl = SEARCH_ENGINES[engine] || SEARCH_ENGINES.duckduckgo;
  return tpl.replace('%s', encodeURIComponent(text));
}

module.exports = { isTracker, isLocalHost, isSafeNavigationUrl, resolveInput, DANGEROUS_EXT, SEARCH_ENGINES };
