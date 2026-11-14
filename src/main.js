'use strict';
const { app, BrowserWindow, ipcMain, powerMonitor, safeStorage, Menu, session, shell } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { JellyfinClient, normalizeServer } = require('./jellyfin');
const { Reporter } = require('./reporter');
const { Store } = require('./store');
const { isNewer } = require('./version');

const RELEASES_URL = process.env.JMP_UPDATE_URL || 'https://api.github.com/repos/Tntdruid/tonefin/releases/latest';
const RELEASE_PAGE = /^https:\/\/github\.com\/Tntdruid\/tonefin\/releases\//;

const PROGRESS_INTERVAL_MS = 10 * 1000;
const CACHE_LIMIT_BYTES = 50 * 1024 * 1024;

/**
 * Chromium caches every response, which for a music player means every song (hundreds of MB).
 * Audio is never cached, covers still are, and the cache is capped and emptied if it grew too big.
 */
function limitCache() {
  app.commandLine.appendSwitch('disk-cache-size', String(CACHE_LIMIT_BYTES));
  return () => {
    const ses = session.defaultSession;
    ses.webRequest.onHeadersReceived({ urls: ['*://*/Audio/*'] }, (details, callback) => {
      const headers = {};
      for (const [k, v] of Object.entries(details.responseHeaders || {})) {
        if (!/^(cache-control|expires|etag|last-modified)$/i.test(k)) headers[k] = v;
      }
      headers['Cache-Control'] = ['no-store'];
      callback({ responseHeaders: headers });
    });
    ses.getCacheSize().then((size) => {
      if (size > CACHE_LIMIT_BYTES) {
        log(`cache is ${Math.round(size / 1048576)} MB, emptying it`);
        ses.clearCache();
      }
    });
  };
}
const setupCache = limitCache();

/** The portable exe keeps its data in "Tonefin-data" next to itself, if that folder can be written to. */
function portableDataDir() {
  const exeDir = process.env.PORTABLE_EXECUTABLE_DIR;
  if (!exeDir) return null;
  const dir = path.join(exeDir, 'Tonefin-data');
  try {
    fs.mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, '.write-test');
    fs.writeFileSync(probe, '');
    fs.unlinkSync(probe);
    return dir;
  } catch {
    return null; // e.g. under Program Files: fall back to %APPDATA%\Tonefin
  }
}

const dataDir = process.env.JMP_DATA_DIR ? path.resolve(process.env.JMP_DATA_DIR) : portableDataDir();
if (dataDir) app.setPath('userData', dataDir);

/**
 * Before 0.1.0 was released the app was called "Jellyfin Music Player": keep its login and device id.
 * "Local State" holds the key the token is encrypted with, so it has to come along, and it has to be
 * copied before Chromium starts and creates its own.
 */
function migrateOldData() {
  const newDir = app.getPath('userData');
  const oldDir = process.env.JMP_OLD_DATA_DIR || path.join(app.getPath('appData'), 'Jellyfin Music Player');
  if (fs.existsSync(path.join(newDir, 'settings.json')) || !fs.existsSync(path.join(oldDir, 'settings.json'))) return null;
  try {
    fs.mkdirSync(newDir, { recursive: true });
    for (const f of ['Local State', 'settings.json']) {
      if (fs.existsSync(path.join(oldDir, f))) fs.copyFileSync(path.join(oldDir, f), path.join(newDir, f));
    }
    return oldDir;
  } catch {
    return null;
  }
}
const migratedFrom = migrateOldData();

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

let win = null;
let store = null;
let client = null;
let reporter = null;
let logFile = null;

function log(msg) {
  const line = `${new Date().toISOString()} ${msg}\n`;
  process.stdout.write(line);
  try {
    if (fs.existsSync(logFile) && fs.statSync(logFile).size > 1024 * 1024) fs.renameSync(logFile, logFile + '.old');
    fs.appendFileSync(logFile, line);
  } catch {
    /* logging must never break playback */
  }
}

function makeClient(server, token) {
  return new JellyfinClient({
    server,
    token,
    deviceId: store.deviceId,
    deviceName: os.hostname(),
    version: app.getVersion(),
  });
}

function sessionInfo() {
  if (!client || !client.token) return null;
  return {
    server: client.server,
    token: client.token,
    userId: store.get('userId'),
    userName: store.get('userName'),
    deviceId: store.deviceId,
  };
}

function announce(reason) {
  if (!client || !client.token) return;
  client.reportCapabilities().catch(() => {});
  reporter.kick(reason);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 820,
    minHeight: 560,
    backgroundColor: '#14161c',
    title: 'Tonefin',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      // Keep timers and audio events running at full speed when minimised.
      backgroundThrottling: false,
    },
  });
  const bounds = store.get('bounds');
  if (bounds) win.setBounds(bounds);
  if (store.get('maximized')) win.maximize();
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.on('close', () => store.set({ bounds: win.getNormalBounds(), maximized: win.isMaximized() }));
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('render-process-gone', (_e, details) => {
    log(`window process gone (${details.reason}), stopping playback report`);
    reporter.stop();
  });
}

app.whenReady().then(() => {
  logFile = path.join(app.getPath('userData'), 'player.log');
  store = new Store(path.join(app.getPath('userData'), 'settings.json'), safeStorage);
  log(`Tonefin ${app.getVersion()} starting on ${os.hostname()}`);
  if (migratedFrom) log(`kept login from ${migratedFrom}`);

  const server = store.get('server');
  const token = store.token;
  if (server && token) client = makeClient(server, token);

  reporter = new Reporter({
    send: (p, body) => {
      if (!client || !client.token) return Promise.reject(new Error('E_NOT_LOGGED_IN'));
      return client.request('POST', p, { body });
    },
    log,
    onStatus: (status) => win && !win.isDestroyed() && win.webContents.send('report:status', status),
  });
  setInterval(() => reporter.tick(), PROGRESS_INTERVAL_MS);
  setupCache();

  if (client) announce('startup');

  powerMonitor.on('suspend', () => log('computer is going to sleep'));
  powerMonitor.on('resume', () => {
    log('computer woke up');
    // The network is often not ready right away. Try a few times; the regular tick covers the rest.
    for (const ms of [1000, 4000, 12000]) setTimeout(() => announce('resume from sleep'), ms);
    if (win && !win.isDestroyed()) win.webContents.send('power:resume');
  });
  powerMonitor.on('unlock-screen', () => announce('screen unlocked'));

  ipcMain.handle('session:get', () => sessionInfo());

  async function finishLogin(c, res, how) {
    if (client && client.token) await reporter.stop();
    client = c;
    store.set({ server: c.server, userId: res.userId, userName: res.userName, lastUsername: res.userName });
    store.token = res.token;
    log(`logged in to ${c.server} as ${res.userName} (${how})`);
    announce('login');
    return sessionInfo();
  }

  ipcMain.handle('session:login', async (_e, { server: input, username, password }) => {
    const c = makeClient(normalizeServer(input), null);
    return finishLogin(c, await c.login(username, password), 'password');
  });

  // Quick Connect ("Lyn-forbind"): start gives a code, the renderer polls check until it is approved.
  let quick = null;
  ipcMain.handle('quick:start', async (_e, input) => {
    const c = makeClient(normalizeServer(input), null);
    const { code, secret } = await c.quickConnectStart();
    quick = { client: c, secret };
    return code;
  });
  ipcMain.handle('quick:check', async () => {
    if (!quick) throw new Error('E_QC_NOT_STARTED');
    if (!(await quick.client.quickConnectAuthorized(quick.secret))) return null;
    const { client: c, secret } = quick;
    quick = null;
    return finishLogin(c, await c.quickConnectFinish(secret), 'quick connect');
  });
  ipcMain.handle('quick:cancel', () => {
    quick = null;
  });

  ipcMain.handle('session:logout', async () => {
    await reporter.stop();
    if (client) await client.request('POST', '/Sessions/Logout').catch(() => {});
    client = null;
    store.token = null;
    log('logged out');
  });

  ipcMain.handle('login:defaults', () => ({
    server: store.get('server') || '',
    username: store.get('lastUsername') || '',
  }));

  ipcMain.handle('api', (_e, { method, path: p, query, body }) => {
    if (!client) throw new Error('E_NOT_LOGGED_IN');
    return client.request(method || 'GET', p, { query, body });
  });

  ipcMain.on('player:update', (_e, state) => reporter.update(state));
  ipcMain.on('player:stop', (_e, positionTicks) => reporter.stop(positionTicks));
  ipcMain.on('net:online', () => announce('network online'));
  ipcMain.handle('report:status', () => reporter.status);
  ipcMain.handle('log:open', () => shell.showItemInFolder(logFile));
  ipcMain.handle('app:version', () => app.getVersion());

  // Asks GitHub for the latest release. Nothing about the user or the library is sent.
  ipcMain.handle('update:check', async () => {
    const res = await fetch(RELEASES_URL, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Tonefin' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`E_GITHUB ${res.status}`);
    const release = await res.json();
    const latest = String(release.tag_name || '').replace(/^v/i, '');
    const current = app.getVersion();
    const newer = isNewer(latest, current);
    if (newer) log(`update available: ${latest} (running ${current})`);
    return { current, latest, newer, url: release.html_url };
  });
  ipcMain.handle('update:open', (_e, url) => {
    if (RELEASE_PAGE.test(String(url))) shell.openExternal(url);
  });

  Menu.setApplicationMenu(null);
  createWindow();
});

app.on('second-instance', () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
});

let quitting = false;
app.on('before-quit', (e) => {
  if (quitting || !reporter || (!reporter.current && !reporter.pendingStops.length)) return;
  // Tell Jellyfin that playback stopped before exiting, but never hang on it.
  e.preventDefault();
  quitting = true;
  log('closing, reporting stop');
  Promise.race([reporter.stop(), new Promise((r) => setTimeout(r, 3000))]).finally(() => app.quit());
});

app.on('window-all-closed', () => app.quit());
