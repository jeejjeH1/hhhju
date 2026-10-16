// پل داخلی پارس. فقط با خود اپ (روی همین دستگاه) حرف می‌زند؛ به هیچ شبکه‌ای وصل نمی‌شود.
(() => {
  "use strict";
  if (window.top !== window) return;
  let port = null, watched = [], picking = null, lastSent = "";
  const send = (m) => { try { if (port) port.postMessage(m); } catch (e) { /* قطع */ } };

  function connect() {
    try { port = browser.runtime.connectNative("pars"); } catch (e) { return; }
    port.onMessage.addListener(onCmd);
    port.onDisconnect.addListener(() => { port = null; });
    send({ type: "hello", url: location.href, title: document.title });
  }

  function onCmd(c) {
    if (!c) return;
    if (c.cmd === "watch") startWatch(c.pins || []);
    else if (c.cmd === "pick") startPick();
    else if (c.cmd === "cancelPick") stopPick(false);
  }

  // ── پایش پین‌ها ──
  function read() {
    return watched.map((p) => {
      let el = null;
      try { el = document.querySelector(p.sel); } catch (e) { /* انتخابگر خراب */ }
      return { id: p.id, ok: !!el, text: el ? String(el.innerText || el.textContent || "").trim().slice(0, 200) : "" };
    });
  }
  function report(force) {
    const v = read(), sig = JSON.stringify(v);
    if (force || sig !== lastSent) { lastSent = sig; send({ type: "values", values: v }); }
  }
  function startWatch(pins) {
    watched = pins.slice(0, 20);
    if (!watched.length) return;
    let n = 0;
    const iv = setInterval(() => {            // تا ۱۵ ثانیه منتظر ظاهر شدن عنصر (صفحه‌های پویا)
      n++;
      if (read().every((x) => x.ok) || n >= 30) { clearInterval(iv); report(true); observe(); }
    }, 500);
  }
  function observe() {
    let t = null;
    new MutationObserver(() => { if (t) return; t = setTimeout(() => { t = null; report(false); }, 1500); })
      .observe(document.documentElement, { subtree: true, childList: true, characterData: true });
  }

  // ── انتخابگر ──
  const unique = (s) => { try { return document.querySelectorAll(s).length === 1; } catch (e) { return false; } };
  function cssPath(el) {
    if (el.id) { const s = "#" + CSS.escape(el.id); if (unique(s)) return s; }
    const parts = [];
    while (el && el.nodeType === 1 && el !== document.documentElement) {
      let p = el.tagName.toLowerCase();
      if (el.id && unique("#" + CSS.escape(el.id))) { parts.unshift("#" + CSS.escape(el.id)); break; }
      const cls = [...el.classList].filter((c) => !/\d{3,}|^css-|^_|^[a-z]{1,2}-[a-z0-9]{5,}$/i.test(c)).slice(0, 2);
      if (cls.length) p += "." + cls.map((c) => CSS.escape(c)).join(".");
      const sib = [...el.parentNode.children].filter((s) => s.tagName === el.tagName);
      if (sib.length > 1) p += ":nth-of-type(" + (sib.indexOf(el) + 1) + ")";
      parts.unshift(p);
      el = el.parentElement;
    }
    return parts.join(" > ");
  }

  function startPick() {
    if (picking) return;
    const veil = document.createElement("div");
    veil.style.cssText = "position:fixed;inset:0;z-index:2147483646;touch-action:none;background:transparent;cursor:crosshair";
    const box = document.createElement("div");
    box.style.cssText = "position:fixed;z-index:2147483647;pointer-events:none;border:2px solid #ff87ff;border-radius:6px;background:rgba(255,135,255,.16);box-shadow:0 0 0 9999px rgba(0,0,0,.45);display:none;transition:all .08s";
    const tip = document.createElement("div");
    tip.textContent = "روی بخشی که می‌خواهی پین شود بزن";
    tip.style.cssText = "position:fixed;z-index:2147483647;left:50%;top:14px;transform:translateX(-50%);padding:10px 16px;border-radius:20px;background:#110f1c;color:#f4efff;border:1px solid #ff87ff;font:14px sans-serif;direction:rtl;pointer-events:none";
    const x = document.createElement("div");
    x.textContent = "✕";
    x.style.cssText = "position:fixed;z-index:2147483647;right:14px;top:10px;width:40px;height:40px;border-radius:20px;background:#110f1c;color:#fff;border:1px solid #ff87ff;font:20px/38px sans-serif;text-align:center";
    document.documentElement.append(veil, box, tip, x);
    picking = { veil, box, tip, x, cur: null };

    const elAt = (px, py) => {
      veil.style.pointerEvents = "none";
      let el = document.elementFromPoint(px, py);
      veil.style.pointerEvents = "auto";
      while (el && el !== document.body && el !== document.documentElement && !String(el.innerText || "").trim()) el = el.parentElement;
      return el && el !== document.body && el !== document.documentElement ? el : null;
    };
    const show = (e) => {
      const el = elAt(e.clientX, e.clientY); picking.cur = el;
      if (!el) { box.style.display = "none"; return; }
      const r = el.getBoundingClientRect();
      Object.assign(box.style, { display: "block", left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
    };
    veil.addEventListener("pointerdown", (e) => { e.preventDefault(); show(e); });
    veil.addEventListener("pointermove", (e) => { e.preventDefault(); show(e); });
    veil.addEventListener("pointerup", (e) => {
      e.preventDefault();
      const el = picking && picking.cur;
      if (!el) return;
      const sel = cssPath(el), text = String(el.innerText || el.textContent || "").trim().slice(0, 200);
      send({ type: "picked", url: location.href, title: document.title, sel, text });
      stopPick(false);
    });
    x.addEventListener("pointerup", (e) => { e.preventDefault(); e.stopPropagation(); stopPick(true); });
  }
  function stopPick(notify) {
    if (!picking) return;
    [picking.veil, picking.box, picking.tip, picking.x].forEach((n) => n.remove());
    picking = null;
    if (notify) send({ type: "pickCancelled" });
  }

  connect();
})();
