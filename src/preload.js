'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('jf', {
  getSession: () => ipcRenderer.invoke('session:get'),
  loginDefaults: () => ipcRenderer.invoke('login:defaults'),
  login: (server, username, password) => ipcRenderer.invoke('session:login', { server, username, password }),
  logout: () => ipcRenderer.invoke('session:logout'),
  api: (path, query, method = 'GET', body) => ipcRenderer.invoke('api', { method, path, query, body }),
  playerUpdate: (state) => ipcRenderer.send('player:update', state),
  playerStop: (positionTicks) => ipcRenderer.send('player:stop', positionTicks),
  online: () => ipcRenderer.send('net:online'),
  reportStatus: () => ipcRenderer.invoke('report:status'),
  openLog: () => ipcRenderer.invoke('log:open'),
  onReportStatus: (fn) => ipcRenderer.on('report:status', (_e, s) => fn(s)),
  onResume: (fn) => ipcRenderer.on('power:resume', () => fn()),
});
