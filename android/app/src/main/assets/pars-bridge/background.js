// پس‌زمینه‌ی پل: تنها بخشی که با اپ حرف می‌زند. صفحه‌ها از طریق runtime.connect به آن وصل می‌شوند.
"use strict";
let native = null, nextPid = 1;
const pages = new Map();

function connectNative() {
  try {
    native = browser.runtime.connectNative("pars");
    native.onMessage.addListener(onApp);
    native.onDisconnect.addListener(() => { native = null; setTimeout(connectNative, 2000); });
  } catch (e) { native = null; setTimeout(connectNative, 3000); }
}
function toApp(m) { try { if (native) native.postMessage(m); } catch (e) { /* قطع */ } }

function onApp(c) {
  if (!c) return;
  if (typeof c.pid === "number" && c.pid >= 0) { const p = pages.get(c.pid); if (p) p.port.postMessage(c); }
  else pages.forEach((p) => { try { p.port.postMessage(c); } catch (e) { /* بسته */ } });
}

browser.runtime.onConnect.addListener((port) => {
  if (port.name !== "page") return;
  const pid = nextPid++;
  pages.set(pid, { port });
  port.onMessage.addListener((m) => toApp(Object.assign({}, m, { pid })));
  port.onDisconnect.addListener(() => { pages.delete(pid); toApp({ type: "gone", pid }); });
});

connectNative();
