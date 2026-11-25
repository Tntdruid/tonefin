'use strict';
/**
 * Playing on network players (UPnP/DLNA MediaRenderer): receivers like Denon/Marantz/Yamaha, TVs, speakers.
 * The renderer fetches the stream from Jellyfin itself; Tonefin only sends commands and polls the position.
 */
const dgram = require('dgram');

const AVT = 'urn:schemas-upnp-org:service:AVTransport:1';
const RC = 'urn:schemas-upnp-org:service:RenderingControl:1';
const CM = 'urn:schemas-upnp-org:service:ConnectionManager:1';

// ---- small pure helpers (tested) ----

function xmlEscape(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
}

function xmlUnescape(s) {
  return String(s ?? '').replace(/&(lt|gt|quot|apos|amp);/g, (m, e) => ({ lt: '<', gt: '>', quot: '"', apos: "'", amp: '&' })[e]);
}

/** First <tag>...</tag> in an XML string (ignores namespaces prefixes). */
function tag(xml, name) {
  const m = new RegExp(`<(?:\\w+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${name}>`).exec(xml || '');
  return m ? m[1].trim() : null;
}

/** "1:02:03" or "0:03:21.500" -> seconds. "NOT_IMPLEMENTED" or junk -> null. */
function parseTime(t) {
  const m = /^(\d+):(\d{1,2}):(\d{1,2}(?:\.\d+)?)/.exec(String(t || '').trim());
  if (!m) return null;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

/** seconds -> "H:MM:SS" as UPnP wants it. */
function formatTime(sec) {
  const s = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function soapEnvelope(serviceType, action, args = {}) {
  const inner = Object.entries(args).map(([k, v]) => `<${k}>${xmlEscape(v)}</${k}>`).join('');
  return '<?xml version="1.0" encoding="utf-8"?>' +
    '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">' +
    `<s:Body><u:${action} xmlns:u="${serviceType}">${inner}</u:${action}></s:Body></s:Envelope>`;
}

/** DIDL-Lite metadata so the renderer can show title, artist, album and cover. */
function didl({ url, mime, title, artist, album, cover, durationSec }) {
  const res = `<res protocolInfo="http-get:*:${xmlEscape(mime)}:*"${durationSec ? ` duration="${formatTime(durationSec)}.000"` : ''}>${xmlEscape(url)}</res>`;
  return '<DIDL-Lite xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/" xmlns:dc="http://purl.org/dc/elements/1.1/" ' +
    'xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/">' +
    '<item id="tonefin" parentID="0" restricted="1">' +
    `<dc:title>${xmlEscape(title)}</dc:title>` +
    (artist ? `<upnp:artist>${xmlEscape(artist)}</upnp:artist><dc:creator>${xmlEscape(artist)}</dc:creator>` : '') +
    (album ? `<upnp:album>${xmlEscape(album)}</upnp:album>` : '') +
    (cover ? `<upnp:albumArtURI>${xmlEscape(cover)}</upnp:albumArtURI>` : '') +
    '<upnp:class>object.item.audioItem.musicTrack</upnp:class>' +
    res + '</item></DIDL-Lite>';
}

/** Audio MIME types a renderer says it can play, from ConnectionManager.GetProtocolInfo's Sink list. */
function sinkAudioTypes(sink) {
  return [...new Set(String(sink || '').split(',').map((p) => (p.split(':')[2] || '').trim().toLowerCase()).filter((t) => t.startsWith('audio/')))];
}

const CONTAINER_MIME = {
  mp3: ['audio/mpeg', 'audio/mp3'],
  flac: ['audio/flac', 'audio/x-flac'],
  m4a: ['audio/mp4', 'audio/x-m4a', 'audio/aac'],
  mp4: ['audio/mp4', 'audio/x-m4a'],
  aac: ['audio/aac', 'audio/mp4', 'audio/x-aac'],
  wav: ['audio/wav', 'audio/x-wav', 'audio/l16'],
  wma: ['audio/x-ms-wma'],
  ogg: ['audio/ogg', 'application/ogg'],
  opus: ['audio/opus', 'audio/ogg'],
};

/**
 * Which way to send a song: the original file if the renderer lists its format, otherwise MP3 made by Jellyfin.
 * Returns { direct, container, mime }.
 */
function pickFormat(container, sinkTypes) {
  const c = String(container || '').toLowerCase().split(',')[0].trim();
  const types = sinkTypes || [];
  const mime = (CONTAINER_MIME[c] || []).find((m) => types.includes(m));
  if (mime) return { direct: true, container: c, mime };
  return { direct: false, container: 'mp3', mime: types.includes('audio/mp3') && !types.includes('audio/mpeg') ? 'audio/mp3' : 'audio/mpeg' };
}

// ---- network ----

function ssdpSearch(timeoutMs = 3000) {
  return new Promise((resolve) => {
    const found = new Map();
    const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    sock.on('error', () => {});
    sock.on('message', (msg) => {
      const text = msg.toString();
      const loc = (/^LOCATION:\s*(.+)$/im.exec(text) || [])[1];
      if (loc) found.set(loc.trim(), true);
    });
    sock.bind(() => {
      const m = Buffer.from('M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: "ssdp:discover"\r\nMX: 2\r\n' +
        'ST: urn:schemas-upnp-org:device:MediaRenderer:1\r\n\r\n');
      sock.send(m, 1900, '239.255.255.250');
      setTimeout(() => sock.send(m, 1900, '239.255.255.250'), 500);
    });
    setTimeout(() => {
      try {
        sock.close();
      } catch {
        /* closed */
      }
      resolve([...found.keys()]);
    }, timeoutMs);
  });
}

async function soap(controlUrl, serviceType, action, args, timeoutMs = 6000) {
  const res = await fetch(controlUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset="utf-8"', SOAPAction: `"${serviceType}#${action}"` },
    body: soapEnvelope(serviceType, action, args),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  if (!res.ok) {
    const code = tag(text, 'errorCode');
    const desc = tag(text, 'errorDescription');
    throw new Error(`E_DLNA ${action} ${code || res.status}${desc ? ' ' + desc : ''}`);
  }
  return text;
}

/** Reads a renderer's description: name, model, control URLs and the audio formats it accepts. */
async function describe(location) {
  const xml = await (await fetch(location, { signal: AbortSignal.timeout(4000) })).text();
  const services = [...xml.matchAll(/<service>([\s\S]*?)<\/service>/g)].map((m) => ({ type: tag(m[1], 'serviceType'), control: tag(m[1], 'controlURL') }));
  const url = (type) => {
    const s = services.find((x) => x.type && x.type.startsWith(type.slice(0, -1)));
    return s && s.control ? new URL(s.control, location).toString() : null;
  };
  const device = {
    id: tag(xml, 'UDN') || location,
    name: xmlUnescape(tag(xml, 'friendlyName') || new URL(location).hostname),
    model: xmlUnescape(tag(xml, 'modelName') || ''),
    location,
    avTransport: url(AVT),
    renderingControl: url(RC),
    connectionManager: url(CM),
    sinkTypes: [],
  };
  if (!device.avTransport) return null;
  if (device.connectionManager) {
    try {
      device.sinkTypes = sinkAudioTypes(xmlUnescape(tag(await soap(device.connectionManager, CM, 'GetProtocolInfo', {}), 'Sink')));
    } catch {
      /* assume the common formats below */
    }
  }
  if (!device.sinkTypes.length) device.sinkTypes = ['audio/mpeg'];
  return device;
}

/** extraLocations: description URLs to include even if they don't answer the network search (for testing). */
async function discover(timeoutMs, extraLocations = []) {
  const locations = [...new Set([...(await ssdpSearch(timeoutMs)), ...extraLocations])];
  const devices = await Promise.all(locations.map((l) => describe(l).catch(() => null)));
  const byId = new Map();
  for (const d of devices) if (d && !byId.has(d.id)) byId.set(d.id, d);
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Commands for one renderer. */
class Renderer {
  constructor(device) {
    this.d = device;
  }

  async load({ url, mime, title, artist, album, cover, durationSec }) {
    await soap(this.d.avTransport, AVT, 'Stop', { InstanceID: 0 }).catch(() => {}); // some renderers need this first
    await soap(this.d.avTransport, AVT, 'SetAVTransportURI', {
      InstanceID: 0,
      CurrentURI: url,
      CurrentURIMetaData: didl({ url, mime, title, artist, album, cover, durationSec }),
    });
  }

  play() {
    return soap(this.d.avTransport, AVT, 'Play', { InstanceID: 0, Speed: 1 });
  }

  pause() {
    return soap(this.d.avTransport, AVT, 'Pause', { InstanceID: 0 });
  }

  stop() {
    return soap(this.d.avTransport, AVT, 'Stop', { InstanceID: 0 });
  }

  seek(sec) {
    return soap(this.d.avTransport, AVT, 'Seek', { InstanceID: 0, Unit: 'REL_TIME', Target: formatTime(sec) });
  }

  async setVolume(pct) {
    if (!this.d.renderingControl) return;
    await soap(this.d.renderingControl, RC, 'SetVolume', { InstanceID: 0, Channel: 'Master', DesiredVolume: Math.round(Math.min(100, Math.max(0, pct))) });
  }

  async getVolume() {
    if (!this.d.renderingControl) return null;
    const v = Number(tag(await soap(this.d.renderingControl, RC, 'GetVolume', { InstanceID: 0, Channel: 'Master' }), 'CurrentVolume'));
    return Number.isFinite(v) ? v : null;
  }

  /** { state: PLAYING | PAUSED_PLAYBACK | STOPPED | TRANSITIONING | NO_MEDIA_PRESENT, position, duration } */
  async status() {
    const [t, p] = await Promise.all([
      soap(this.d.avTransport, AVT, 'GetTransportInfo', { InstanceID: 0 }),
      soap(this.d.avTransport, AVT, 'GetPositionInfo', { InstanceID: 0 }),
    ]);
    return {
      state: tag(t, 'CurrentTransportState') || 'STOPPED',
      position: parseTime(tag(p, 'RelTime')),
      duration: parseTime(tag(p, 'TrackDuration')),
      uri: xmlUnescape(tag(p, 'TrackURI') || ''),
    };
  }
}

module.exports = { discover, describe, Renderer, xmlEscape, parseTime, formatTime, soapEnvelope, didl, sinkAudioTypes, pickFormat, tag };
