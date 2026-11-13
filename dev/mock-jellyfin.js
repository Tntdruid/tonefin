'use strict';
/**
 * A tiny fake Jellyfin server for trying the player without a real library.
 *   node dev/mock-jellyfin.js [port]
 * Log in with any username/password. GET /__down?on=1 makes the /Sessions endpoints drop the connection,
 * /__down?on=0 brings them back, and GET /__log shows every playback report received.
 */
const http = require('http');

const port = Number(process.argv[2] || 8097);
const TICKS = 10_000_000;
const reports = [];
let down = false;
let quickApproved = false; // GET /__approve approves the Quick Connect code
const nowPlaying = {};

const album = { Id: 'alb1', Name: 'Testalbum', Type: 'MusicAlbum', AlbumArtist: 'Testkunstner', AlbumArtists: [{ Id: 'art1', Name: 'Testkunstner' }], ProductionYear: 2024, ImageTags: {} };
const tracks = [1, 2, 3].map((n) => ({
  Id: `trk${n}`,
  Name: `Sang ${n}`,
  Type: 'Audio',
  Album: album.Name,
  AlbumId: album.Id,
  AlbumArtist: 'Testkunstner',
  Artists: ['Testkunstner'],
  IndexNumber: n,
  ParentIndexNumber: 1,
  RunTimeTicks: 12 * TICKS,
}));
const artist = { Id: 'art1', Name: 'Testkunstner', Type: 'MusicArtist', ImageTags: {} };
const playlists = [
  { Id: 'pl1', Name: 'Min playliste', Type: 'Playlist', MediaType: 'Unknown', ImageTags: {} },
  { Id: 'pl2', Name: 'Film', Type: 'Playlist', MediaType: 'Video', ImageTags: {} },
];
const favorites = new Set(['trk2']);

function wav(seconds, freq) {
  const rate = 8000;
  const n = rate * seconds;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin((2 * Math.PI * freq * i) / rate) * 1500), 44 + i * 2);
  return buf;
}
const audio = { trk1: wav(12, 330), trk2: wav(12, 440), trk3: wav(12, 550) };

function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function body(req) {
  return new Promise((resolve) => {
    let s = '';
    req.on('data', (c) => (s += c));
    req.on('end', () => resolve(s ? JSON.parse(s) : null));
  });
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const p = url.pathname;
    const q = Object.fromEntries(url.searchParams);
    if (p === '/__down') {
      down = q.on === '1';
      return json(res, { down });
    }
    if (p === '/__log') return json(res, reports);
    if (p.startsWith('/Sessions') && down) return req.socket.destroy();

    if (p === '/System/Info/Public') return json(res, { ServerName: 'Mock', Version: '10.11.0' });
    // Act like a server plugin: heart a song, or create a playlist, behind the client's back.
    if (p === '/__fav') return json(res, favorites.add(q.id).has(q.id));
    if (p === '/__addplaylist') return json(res, playlists.push({ Id: 'pl3', Name: q.name || 'Testkunstner', Type: 'Playlist', MediaType: 'Audio', ImageTags: {} }));
    if (p === '/__approve') return json(res, (quickApproved = true));
    if (p === '/QuickConnect/Enabled') return json(res, true);
    if (p === '/QuickConnect/Initiate') return json(res, (quickApproved = false) || { Code: '123456', Secret: 'qcsecret' });
    if (p === '/QuickConnect/Connect') return json(res, { Code: '123456', Secret: q.Secret, Authenticated: quickApproved });
    if (p === '/Users/AuthenticateWithQuickConnect')
      return quickApproved ? json(res, { AccessToken: 'mocktoken', User: { Id: 'u1', Name: 'Tester' } }) : res.writeHead(401).end();
    if (p === '/Users/AuthenticateByName') return json(res, { AccessToken: 'mocktoken', User: { Id: 'u1', Name: 'Tester' } });
    if (p === '/Sessions/Capabilities/Full' || p === '/Sessions/Logout') return res.writeHead(204).end();
    if (p.startsWith('/Sessions/Playing')) {
      const b = await body(req);
      const kind = p.slice('/Sessions/Playing'.length) || '/Start';
      const auth = req.headers.authorization || '';
      reports.push({ t: new Date().toISOString(), kind, item: b.ItemId, pos: b.PositionTicks / TICKS, paused: b.IsPaused, event: b.EventName });
      console.log(new Date().toISOString(), kind, b.ItemId, (b.PositionTicks / TICKS).toFixed(1), b.EventName || '', b.IsPaused ? 'paused' : '');
      const dev = (auth.match(/DeviceId="([^"]+)"/) || [])[1];
      if (kind === '/Stopped') delete nowPlaying[dev];
      else nowPlaying[dev] = b.ItemId;
      return res.writeHead(204).end();
    }
    if (p === '/Sessions') return json(res, Object.entries(nowPlaying).map(([DeviceId, Id]) => ({ DeviceId, NowPlayingItem: { Id } })));

    const withUserData = (i) => ({ ...i, UserData: { IsFavorite: favorites.has(i.Id) } });
    const list = (items) => {
      const out = (q.Filters === 'IsFavorite' || q.IsFavorite === 'true' ? items.filter((i) => favorites.has(i.Id)) : items).map(withUserData);
      return json(res, { Items: out, TotalRecordCount: out.length });
    };
    if (p === '/Users/u1/Items') {
      if (q.IncludeItemTypes === 'MusicAlbum') return list([album]);
      if (q.IncludeItemTypes === 'Audio') return list(tracks);
      if (q.IncludeItemTypes === 'Playlist') return list(playlists);
      return list([]);
    }
    const one = [album, artist, ...tracks, ...playlists].find((i) => p === `/Users/u1/Items/${i.Id}`);
    if (one) return json(res, withUserData(one));
    if (p === '/Artists/AlbumArtists' || p === '/Artists') return list([artist]);
    if (p === '/Playlists/pl1/Items') return list([tracks[2], tracks[0]]);
    const fav = p.match(/^\/UserFavoriteItems\/(\w+)$/);
    if (fav) {
      if (req.method === 'POST') favorites.add(fav[1]);
      else favorites.delete(fav[1]);
      return json(res, { IsFavorite: favorites.has(fav[1]) });
    }

    const m = p.match(/^\/Audio\/(\w+)\/(stream|universal)/);
    if (m && audio[m[1]]) {
      const data = audio[m[1]];
      const range = /bytes=(\d+)-(\d*)/.exec(req.headers.range || '');
      if (range) {
        const start = Number(range[1]);
        const end = range[2] ? Number(range[2]) : data.length - 1;
        res.writeHead(206, { 'Content-Type': 'audio/wav', 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${data.length}`, 'Content-Length': end - start + 1 });
        return res.end(data.subarray(start, end + 1));
      }
      res.writeHead(200, { 'Content-Type': 'audio/wav', 'Accept-Ranges': 'bytes', 'Content-Length': data.length });
      return res.end(data);
    }
    res.writeHead(404).end();
  })
  .listen(port, () => console.log(`mock Jellyfin on http://localhost:${port}`));
