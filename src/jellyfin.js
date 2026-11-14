'use strict';

const CLIENT_NAME = 'Tonefin';

/** Turns "10.10.1.33:8096/" into "http://10.10.1.33:8096". */
function normalizeServer(input) {
  let s = String(input || '').trim();
  if (!s) throw new Error('E_NO_SERVER');
  if (!/^https?:\/\//i.test(s)) s = 'http://' + s;
  let url;
  try {
    url = new URL(s);
  } catch {
    throw new Error('E_BAD_URL');
  }
  return (url.origin + url.pathname).replace(/\/+$/, '');
}

class JellyfinError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

class JellyfinClient {
  constructor({ server, token = null, deviceId, deviceName, version, fetch = globalThis.fetch, timeoutMs = 10000 }) {
    this.server = server;
    this.token = token;
    this.deviceId = deviceId;
    this.deviceName = deviceName;
    this.version = version;
    this.fetch = fetch;
    this.timeoutMs = timeoutMs;
  }

  authHeader() {
    const q = (v) => String(v).replace(/"/g, "'");
    const parts = [
      `Client="${q(CLIENT_NAME)}"`,
      `Device="${q(this.deviceName)}"`,
      `DeviceId="${q(this.deviceId)}"`,
      `Version="${q(this.version)}"`,
    ];
    if (this.token) parts.push(`Token="${q(this.token)}"`);
    return 'MediaBrowser ' + parts.join(', ');
  }

  async request(method, path, { query, body } = {}) {
    const url = new URL(this.server + path);
    for (const [k, v] of Object.entries(query || {})) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, Array.isArray(v) ? v.join(',') : String(v));
    }
    let res;
    try {
      res = await this.fetch(url, {
        method,
        headers: {
          Authorization: this.authHeader(),
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (e) {
      // Errors are codes; the window turns them into Danish or English text.
      const code = e && e.name === 'TimeoutError' ? 'E_TIMEOUT' : 'E_UNREACHABLE';
      throw new JellyfinError(`${code} ${this.server}`, 0);
    }
    if (!res.ok) {
      const msg = res.status === 401 ? 'E_AUTH_EXPIRED' : `E_HTTP ${res.status} ${path}`;
      throw new JellyfinError(msg, res.status);
    }
    const text = await res.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  async login(username, password) {
    await this.request('GET', '/System/Info/Public');
    let result;
    try {
      result = await this.request('POST', '/Users/AuthenticateByName', { body: { Username: username, Pw: password || '' } });
    } catch (e) {
      if (e.status === 401) throw new JellyfinError('E_BAD_LOGIN', 401);
      throw e;
    }
    this.token = result.AccessToken;
    return { token: result.AccessToken, userId: result.User.Id, userName: result.User.Name };
  }

  /** Starts a Quick Connect ("Lyn-forbind") login. Returns the code to type in another Jellyfin app. */
  async quickConnectStart() {
    await this.request('GET', '/System/Info/Public');
    const enabled = await this.request('GET', '/QuickConnect/Enabled').catch(() => false);
    if (enabled !== true) throw new JellyfinError('E_QC_DISABLED', 0);
    const res = await this.request('POST', '/QuickConnect/Initiate');
    return { code: res.Code, secret: res.Secret };
  }

  async quickConnectAuthorized(secret) {
    const res = await this.request('GET', '/QuickConnect/Connect', { query: { Secret: secret } });
    return !!(res && res.Authenticated);
  }

  async quickConnectFinish(secret) {
    const result = await this.request('POST', '/Users/AuthenticateWithQuickConnect', { body: { Secret: secret } });
    this.token = result.AccessToken;
    return { token: result.AccessToken, userId: result.User.Id, userName: result.User.Name };
  }

  reportCapabilities() {
    return this.request('POST', '/Sessions/Capabilities/Full', {
      body: {
        PlayableMediaTypes: ['Audio'],
        SupportedCommands: [],
        SupportsMediaControl: false,
        SupportsPersistentIdentifier: true,
      },
    });
  }
}

module.exports = { JellyfinClient, JellyfinError, normalizeServer, CLIENT_NAME };
