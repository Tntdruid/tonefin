'use strict';
/**
 * A fake DLNA MediaRenderer for trying "Play on…" without a real receiver.
 *   node dev/mock-renderer.js [port]
 * Start Tonefin with JMP_EXTRA_RENDERERS=http://localhost:<port>/description.xml so it is listed.
 * It fetches the start of each stream (to prove the URL works), pretends to play in real time,
 * and logs every command. GET /__log returns the commands.
 */
const http = require('http');
const { tag, parseTime, formatTime } = require('../src/dlna');

const port = Number(process.argv[2] || 8098);
const log = [];
const st = { uri: '', meta: '', state: 'NO_MEDIA_PRESENT', pos: 0, since: 0, duration: 0, volume: 30, fetched: null };

function position() {
  if (st.state !== 'PLAYING') return st.pos;
  const p = st.pos + (Date.now() - st.since) / 1000;
  if (st.duration && p >= st.duration) {
    st.state = 'STOPPED';
    st.pos = 0;
    note('(end of song)');
    return 0;
  }
  return p;
}

function note(msg) {
  const line = `${new Date().toISOString()} ${msg}`;
  log.push(line);
  console.log(line);
}

const DESC = `<?xml version="1.0"?><root xmlns="urn:schemas-upnp-org:device-1-0"><device>
<deviceType>urn:schemas-upnp-org:device:MediaRenderer:1</deviceType><friendlyName>Fake Receiver</friendlyName>
<modelName>MOCK-1</modelName><UDN>uuid:fake-renderer-1</UDN><serviceList>
<service><serviceType>urn:schemas-upnp-org:service:AVTransport:1</serviceType><controlURL>/AVTransport/ctrl</controlURL></service>
<service><serviceType>urn:schemas-upnp-org:service:RenderingControl:1</serviceType><controlURL>/RenderingControl/ctrl</controlURL></service>
<service><serviceType>urn:schemas-upnp-org:service:ConnectionManager:1</serviceType><controlURL>/ConnectionManager/ctrl</controlURL></service>
</serviceList></device></root>`;

const reply = (res, action, inner = '') => {
  res.writeHead(200, { 'Content-Type': 'text/xml; charset="utf-8"' });
  res.end(`<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><u:${action}Response xmlns:u="x">${inner}</u:${action}Response></s:Body></s:Envelope>`);
};

http.createServer((req, res) => {
  if (req.url === '/description.xml') {
    res.writeHead(200, { 'Content-Type': 'text/xml' });
    return res.end(DESC);
  }
  if (req.url === '/__log') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ log, state: { ...st, pos: position() } }));
  }
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', async () => {
    const action = ((req.headers.soapaction || '').match(/#(\w+)/) || [])[1];
    if (!action) return res.writeHead(404).end();
    if (!['GetPositionInfo', 'GetTransportInfo'].includes(action)) note(`${action} ${action === 'SetAVTransportURI' ? '' : body.match(/<(Target|DesiredVolume)>([^<]*)</)?.[2] || ''}`);
    switch (action) {
      case 'GetProtocolInfo':
        return reply(res, action, '<Source></Source><Sink>http-get:*:audio/mpeg:*,http-get:*:audio/flac:*,http-get:*:audio/wav:*</Sink>');
      case 'SetAVTransportURI': {
        const uri = tag(body, 'CurrentURI').replace(/&amp;/g, '&');
        const meta = tag(body, 'CurrentURIMetaData').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
        st.uri = uri;
        st.meta = meta;
        st.duration = parseTime((meta.match(/duration="([^"]+)"/) || [])[1]) || 0;
        st.state = 'STOPPED';
        st.pos = 0;
        try {
          const r = await fetch(uri, { headers: { Range: 'bytes=0-1023' } });
          st.fetched = `${r.status} ${r.headers.get('content-type')}`;
        } catch (e) {
          st.fetched = `failed: ${e.message}`;
        }
        note(`  uri ${uri.replace(/ApiKey=[^&]+/, 'ApiKey=…')} -> ${st.fetched}; title ${(meta.match(/<dc:title>([^<]*)/) || [])[1]}`);
        return reply(res, action);
      }
      case 'Play':
        if (st.state !== 'PLAYING') {
          st.pos = position();
          st.since = Date.now();
          st.state = 'PLAYING';
        }
        return reply(res, action);
      case 'Pause':
        st.pos = position();
        st.state = 'PAUSED_PLAYBACK';
        return reply(res, action);
      case 'Stop':
        st.pos = 0;
        st.state = st.uri ? 'STOPPED' : 'NO_MEDIA_PRESENT';
        return reply(res, action);
      case 'Seek':
        st.pos = parseTime(tag(body, 'Target')) || 0;
        st.since = Date.now();
        return reply(res, action);
      case 'GetTransportInfo':
        position();
        return reply(res, action, `<CurrentTransportState>${st.state}</CurrentTransportState><CurrentTransportStatus>OK</CurrentTransportStatus>`);
      case 'GetPositionInfo':
        return reply(res, action, `<Track>1</Track><TrackDuration>${formatTime(st.duration)}</TrackDuration><RelTime>${formatTime(position())}</RelTime><TrackURI>${st.uri.replace(/&/g, '&amp;')}</TrackURI>`);
      case 'SetVolume':
        st.volume = Number(tag(body, 'DesiredVolume'));
        return reply(res, action);
      case 'GetVolume':
        return reply(res, action, `<CurrentVolume>${st.volume}</CurrentVolume>`);
      default:
        res.writeHead(500).end();
    }
  });
}).listen(port, () => console.log(`fake renderer on http://localhost:${port}/description.xml`));
