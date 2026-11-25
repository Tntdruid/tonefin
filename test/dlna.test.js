'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { parseTime, formatTime, soapEnvelope, didl, sinkAudioTypes, pickFormat, tag, xmlEscape } = require('../src/dlna');

test('UPnP times are read and written', () => {
  assert.strictEqual(parseTime('0:03:21'), 201);
  assert.strictEqual(parseTime('1:02:03.500'), 3723.5);
  assert.strictEqual(parseTime('NOT_IMPLEMENTED'), null);
  assert.strictEqual(parseTime(''), null);
  assert.strictEqual(formatTime(201.9), '0:03:21');
  assert.strictEqual(formatTime(3723), '1:02:03');
  assert.strictEqual(formatTime(-5), '0:00:00');
});

test('SOAP requests escape their arguments', () => {
  const xml = soapEnvelope('urn:schemas-upnp-org:service:AVTransport:1', 'SetAVTransportURI', { InstanceID: 0, CurrentURI: 'http://x/a?b=1&c=2' });
  assert.match(xml, /<u:SetAVTransportURI xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">/);
  assert.match(xml, /<CurrentURI>http:\/\/x\/a\?b=1&amp;c=2<\/CurrentURI>/);
});

test('metadata with odd characters stays valid XML', () => {
  const meta = didl({ url: 'http://x/s?a=1&b=2', mime: 'audio/flac', title: 'Rock & Roll <Live>', artist: 'AC/DC "Live"', album: "Bob's", durationSec: 245 });
  assert.match(meta, /<dc:title>Rock &amp; Roll &lt;Live&gt;<\/dc:title>/);
  assert.match(meta, /protocolInfo="http-get:\*:audio\/flac:\*"/);
  assert.match(meta, /duration="0:04:05.000"/);
  assert.ok(!/&(?!amp;|lt;|gt;|quot;|apos;)/.test(meta), 'no unescaped ampersands');
  // The whole DIDL document is sent as text inside the SOAP envelope, so it gets escaped once more.
  assert.match(soapEnvelope('t', 'A', { M: meta }), /&lt;DIDL-Lite/);
});

test('tags are found with or without a namespace prefix', () => {
  assert.strictEqual(tag('<s:Body><u:X><RelTime>0:01:00</RelTime></u:X></s:Body>', 'RelTime'), '0:01:00');
  assert.strictEqual(tag('<friendlyName>AVR-1912</friendlyName>', 'friendlyName'), 'AVR-1912');
  assert.strictEqual(tag('<a>1</a>', 'b'), null);
  assert.strictEqual(xmlEscape(null), '');
});

// The Sink list a Denon AVR-1912 reported.
const DENON = 'http-get:*:audio/L16;rate=44100;channels=2:*,http-get:*:audio/mpeg:*,http-get:*:audio/x-ms-wma:*,http-get:*:audio/mp4:*,' +
  'http-get:*:audio/wav:*,http-get:*:audio/flac:*,http-get:*:audio/x-flac:*,http-get:*:audio/x-m4a:*,http-get:*:image/jpeg:*';

test('the audio formats a renderer accepts are read from its Sink list', () => {
  const types = sinkAudioTypes(DENON);
  assert.ok(types.includes('audio/flac'));
  assert.ok(types.includes('audio/mpeg'));
  assert.ok(!types.includes('image/jpeg'));
});

test('songs are sent as the original file when the renderer can play it, otherwise as MP3', () => {
  const types = sinkAudioTypes(DENON);
  assert.deepStrictEqual(pickFormat('flac', types), { direct: true, container: 'flac', mime: 'audio/flac' });
  assert.deepStrictEqual(pickFormat('mp3', types), { direct: true, container: 'mp3', mime: 'audio/mpeg' });
  assert.strictEqual(pickFormat('m4a', types).direct, true);
  assert.deepStrictEqual(pickFormat('opus', types), { direct: false, container: 'mp3', mime: 'audio/mpeg' });
  assert.strictEqual(pickFormat(undefined, types).direct, false, 'unknown container -> MP3');
  assert.strictEqual(pickFormat('flac', ['audio/mpeg']).direct, false, 'renderer without FLAC -> MP3');
});
