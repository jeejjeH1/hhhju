'use strict';
// پل ارتباطی محدود: فقط همین توابع به رابط کاربری داده می‌شود.
const { contextBridge, ipcRenderer } = require('electron');

const invoke = (ch) => (...a) => ipcRenderer.invoke(ch, ...a);
const on = (ch, cb) => { const h = (_e, p) => cb(p); ipcRenderer.on(ch, h); return () => ipcRenderer.removeListener(ch, h); };

contextBridge.exposeInMainWorld('pars', {
  ready: invoke('ui:ready'), overlay: invoke('ui:overlay'), bar: invoke('ui:bar'),
  tab: { new: invoke('tab:new'), close: invoke('tab:close'), activate: invoke('tab:activate'), go: invoke('tab:go'),
    back: invoke('tab:back'), forward: invoke('tab:forward'), reload: invoke('tab:reload'), move: invoke('tab:move'),
    allowHttp: invoke('tab:allowHttp'), zoom: invoke('tab:zoom') },
  bookmark: { toggle: invoke('bookmark:toggle'), remove: invoke('bookmark:remove') },
  find: { run: invoke('find:run'), stop: invoke('find:stop') },
  history: { get: invoke('history:get'), clear: invoke('history:clear') },
  suggest: invoke('suggest'),
  settings: { set: invoke('settings:set') },
  perm: { answer: invoke('perm:answer'), list: invoke('perms:list'), reset: invoke('perms:reset') },
  clearData: invoke('data:clear'),
  download: { show: invoke('dl:open') },
  ext: { list: invoke('ext:list'), install: invoke('ext:install'), remove: invoke('ext:remove'), open: invoke('ext:open') },
  on,
});
