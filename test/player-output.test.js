'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Loads the real player.js with a stand-in <audio> element and IPC bridge.
function load() {
  const sent = [];
  class FakeAudio extends EventTarget {
    constructor() {
      super();
      this.paused = true;
      this.currentTime = 0;
      this.volume = 1;
      this._src = null;
    }
    set src(v) { this._src = v; }
    getAttribute() { return this._src; }
    removeAttribute() { this._src = null; }
    load() {}
    play() { this.paused = false; return Promise.resolve(); }
    pause() { this.paused = true; }
  }
  const window = {};
  const context = {
    window, EventTarget, CustomEvent, Event, Date, Math, Number, setTimeout, clearTimeout, Promise, URLSearchParams,
    crypto: { randomUUID: () => '00000000-0000-0000-0000-000000000000' },
    Audio: FakeAudio,
    MediaError: { MEDIA_ERR_NETWORK: 2 },
    jf: { playerUpdate: (s) => sent.push(s), playerStop: () => {} },
    t: (k) => k,
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'player.js'), 'utf8'), context);
  const player = new window.Player();
  player.setSession({ server: 'http://jf', token: 't', deviceId: 'd', userId: 'u' });
  return { player, sent };
}

function fakeRemote() {
  const r = new EventTarget();
  Object.assign(r, {
    isRemote: true, paused: true, currentTime: 0, playMethod: 'DirectPlay', device: { id: 'x', name: 'Receiver' },
    volumeCalls: [], loads: [],
    setVolumePct(v) { this.volumeCalls.push(v); },
    loadItem(media, autoplay) { this.loads.push({ media, autoplay }); },
    pause() { this.paused = true; }, play() { this.paused = false; return Promise.resolve(); },
    getAttribute() { return 'x'; }, removeAttribute() {}, load() {}, dispose() {},
  });
  return r;
}

const song = (id, gain) => ({ Id: id, Name: id, Type: 'Audio', RunTimeTicks: 600000000, NormalizationGain: gain });

// Regression (0.5.0 development): switching to a network player sent Tonefin's own volume (80)
// to the receiver before its real volume was known, and every new song could do it again.
test('a network player never gets a volume unless the user moves the slider', () => {
  const { player } = load();
  player.setVolume(80);
  player.setNormalization('track');
  player.playList([song('a', -6), song('b', -12)], 0);
  const remote = fakeRemote();
  player.setOutput(remote);
  player.next();
  player.setNormalization('album');
  assert.deepStrictEqual(remote.volumeCalls, [], 'no automatic volume');
  player.setVolume(25);
  assert.deepStrictEqual(remote.volumeCalls, [25]);
});

test('switching output continues the same song on the network player', () => {
  const { player } = load();
  player.playList([song('a'), song('b')], 0);
  player.local.currentTime = 42;
  player.local.paused = false;
  const remote = fakeRemote();
  player.setOutput(remote);
  assert.strictEqual(remote.loads.length, 1);
  assert.strictEqual(remote.loads[0].media.itemId, 'a');
  assert.strictEqual(remote.loads[0].media.startAt, 42);
  assert.strictEqual(remote.loads[0].autoplay, true);
  assert.strictEqual(player.local.paused, true, 'this computer stops playing');
});
