'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('jf', {
  getSession: () => ipcRenderer.invoke('session:get'),
  loginDefaults: () => ipcRenderer.invoke('login:defaults'),
  login: (server, username, password) => ipcRenderer.invoke('session:login', { server, username, password }),
  quickStart: (server) => ipcRenderer.invoke('quick:start', server),
  quickCheck: () => ipcRenderer.invoke('quick:check'),
  quickCancel: () => ipcRenderer.invoke('quick:cancel'),
  logout:() => ipcRenderer.invoke('session:logout'),
  api: (path, query, method = 'GET', body) => ipcRenderer.invoke('api', { method, path, query, body }),
  playerUpdate: (state) => ipcRenderer.send('player:update', state),
  playerStop: (positionTicks) => ipcRenderer.send('player:stop', positionTicks),
  online: () => ipcRenderer.send('net:online'),
  reportStatus: () => ipcRenderer.invoke('report:status'),
  openLog: () => ipcRenderer.invoke('log:open'),
  appVersion: () => ipcRenderer.invoke('app:version'),
  checkUpdate: () => ipcRenderer.invoke('update:check'),
  openRelease: (url) => ipcRenderer.invoke('update:open', url),
  onReportStatus: (fn) => ipcRenderer.on('report:status', (_e, s) => fn(s)),
  onResume: (fn) => ipcRenderer.on('power:resume', () => fn()),
  thumbar: (state) => ipcRenderer.send('thumbar:state', state),
  onMediaCommand: (fn) => ipcRenderer.on('media:command', (_e, cmd) => fn(cmd)),
});
