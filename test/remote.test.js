'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Loads remote.js with a scripted network player behind jf.dlna.
function load(statuses) {
  const calls = [];
  const dlna = {
    load: async (m) => (calls.push(['load', m.itemId]), { direct: true }),
    play: async () => calls.push(['play']),
    pause: async () => calls.push(['pause']),
    stop: async () => calls.push(['stop']),
    seek: async (s) => calls.push(['seek', s]),
    volume: async (v) => calls.push(['volume', v]),
    status: async () => statuses.shift() || { state: 'PLAYING', position: 10, duration: 60 },
  };
  const window = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'remote.js'), 'utf8'), {
    window, EventTarget, Event, Date, Math, Number, setInterval: () => 0, clearInterval: () => {}, jf: { dlna },
  });
  const r = new window.RemoteAudio({ id: 'x', name: 'Receiver', sinkTypes: [] });
  const events = [];
  for (const type of ['playing', 'pause', 'ended', 'loadedmetadata', 'error']) r.addEventListener(type, () => events.push(type));
  return { r, calls, events };
}

const tick = () => new Promise((res) => setImmediate(res));

test('a song starts, and the end of the song is noticed even when the renderer resets its position', async () => {
  const { r, events } = load([
    { state: 'TRANSITIONING', position: 0, duration: 60 },
    { state: 'PLAYING', position: 1, duration: 60 },
    { state: 'PLAYING', position: 58, duration: 60 },
    { state: 'STOPPED', position: 0, duration: 60 },
  ]);
  r.loadItem({ itemId: 'a', durationSec: 60 }, true);
  for (let i = 0; i < 4; i++) await r._poll();
  assert.deepStrictEqual(events, ['loadedmetadata', 'playing', 'pause', 'ended']);
});

test('pressing stop on the device mid-song is a pause, not the end of the song', async () => {
  const { r, events } = load([
    { state: 'PLAYING', position: 10, duration: 60 },
    { state: 'STOPPED', position: 0, duration: 60 },
  ]);
  r.loadItem({ itemId: 'a', durationSec: 60 }, true);
  await r._poll();
  await r._poll();
  assert.ok(!events.includes('ended'));
  assert.strictEqual(events[events.length - 1], 'pause');
});

// Regression (0.5.0 development): resuming on the network player didn't emit "playing" until the
// renderer was polled again, so Jellyfin got the "Unpause" report up to 10 seconds late.
test('resuming emits playing as soon as the renderer accepts the command', async () => {
  const { r, events } = load([{ state: 'PLAYING', position: 5, duration: 60 }]);
  r.loadItem({ itemId: 'a', durationSec: 60 }, true);
  await r._poll();
  r.pause();
  events.length = 0;
  await r.play();
  await tick();
  assert.deepStrictEqual(events, ['playing']);
  assert.strictEqual(r.paused, false);
});

test('a state that contradicts the last command is ignored for a moment', async () => {
  const { r, events } = load([
    { state: 'PLAYING', position: 5, duration: 60 },
    { state: 'PLAYING', position: 6, duration: 60 }, // the renderer hasn't paused yet
  ]);
  r.loadItem({ itemId: 'a', durationSec: 60 }, true);
  await r._poll();
  r.pause();
  events.length = 0;
  await r._poll();
  assert.deepStrictEqual(events, [], 'no false "playing" right after pause');
  assert.strictEqual(r.paused, true);
});
