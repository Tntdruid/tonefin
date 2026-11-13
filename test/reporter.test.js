'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { Reporter, STALE_AFTER_MS } = require('../src/reporter');
const { JellyfinClient, normalizeServer } = require('../src/jellyfin');

function setup() {
  const calls = [];
  let clock = 1_000_000;
  let down = false;
  const r = new Reporter({
    send: async (path, body) => {
      if (down) throw new Error('offline');
      calls.push({ path: path.replace('/Sessions/Playing', '') || 'Playing', body });
    },
    now: () => clock,
  });
  return {
    r,
    calls,
    paths: () => calls.map((c) => c.path || 'Playing'),
    advance: (ms) => (clock += ms),
    setDown: (v) => (down = v),
  };
}

const track = (id, extra = {}) => ({ itemId: id, playSessionId: 'ps-' + id, positionTicks: 0, isPaused: false, volume: 80, ...extra });

test('new track sends Playing, then Progress on ticks', async () => {
  const t = setup();
  await t.r.update(track('a'));
  await t.r.tick();
  await t.r.tick();
  assert.deepStrictEqual(t.paths(), ['Playing', '/Progress', '/Progress']);
  assert.strictEqual(t.calls[0].body.ItemId, 'a');
  assert.strictEqual(t.calls[1].body.EventName, 'TimeUpdate');
});

test('position updates without an event are only sent on the next tick', async () => {
  const t = setup();
  await t.r.update(track('a'));
  await t.r.update(track('a', { positionTicks: 50e7 }));
  assert.strictEqual(t.calls.length, 1);
  await t.r.tick();
  assert.strictEqual(t.calls[1].body.PositionTicks, 50e7);
});

test('pause is reported right away', async () => {
  const t = setup();
  await t.r.update(track('a'));
  await t.r.update(track('a', { isPaused: true, event: 'Pause' }));
  assert.strictEqual(t.calls[1].body.EventName, 'Pause');
  assert.strictEqual(t.calls[1].body.IsPaused, true);
});

test('switching track stops the old one before starting the new one', async () => {
  const t = setup();
  await t.r.update(track('a', { positionTicks: 30e7 }));
  await t.r.update(track('b'));
  assert.deepStrictEqual(t.paths(), ['Playing', '/Stopped', 'Playing']);
  assert.strictEqual(t.calls[1].body.ItemId, 'a');
  assert.strictEqual(t.calls[1].body.PositionTicks, 30e7);
  assert.strictEqual(t.calls[2].body.ItemId, 'b');
});

test('stop uses the given position (end of track)', async () => {
  const t = setup();
  await t.r.update(track('a'));
  await t.r.stop(2400e7);
  assert.deepStrictEqual(t.paths(), ['Playing', '/Stopped']);
  assert.strictEqual(t.calls[1].body.PositionTicks, 2400e7);
  await t.r.tick();
  assert.strictEqual(t.calls.length, 2, 'nothing is reported after stop');
});

test('a Playing that failed is retried on the next tick', async () => {
  const t = setup();
  t.setDown(true);
  await t.r.update(track('a'));
  assert.strictEqual(t.r.status.ok, false);
  t.setDown(false);
  await t.r.tick();
  assert.deepStrictEqual(t.paths(), ['Playing']);
  await t.r.tick();
  assert.deepStrictEqual(t.paths(), ['Playing', '/Progress']);
  assert.strictEqual(t.r.status.ok, true);
});

test('stops that failed are delivered in order once the network is back', async () => {
  const t = setup();
  await t.r.update(track('a'));
  t.setDown(true);
  await t.r.update(track('b'));
  await t.r.stop(10e7);
  assert.strictEqual(t.r.pendingStops.length, 1, 'b never started, so only a needs a stop');
  t.setDown(false);
  await t.r.kick('online');
  assert.deepStrictEqual(t.paths(), ['Playing', '/Stopped']);
  assert.strictEqual(t.calls[1].body.ItemId, 'a');
});

test('after a long outage (sleep) playback is announced again with Playing', async () => {
  const t = setup();
  await t.r.update(track('a'));
  await t.r.tick();
  t.setDown(true);
  t.advance(STALE_AFTER_MS + 60_000);
  await t.r.tick();
  t.setDown(false);
  await t.r.kick('resume');
  assert.deepStrictEqual(t.paths(), ['Playing', '/Progress', 'Playing']);
  await t.r.tick();
  assert.deepStrictEqual(t.paths(), ['Playing', '/Progress', 'Playing', '/Progress']);
});

test('a short outage just continues with Progress', async () => {
  const t = setup();
  await t.r.update(track('a'));
  t.setDown(true);
  t.advance(30_000);
  await t.r.tick();
  t.setDown(false);
  await t.r.tick();
  assert.deepStrictEqual(t.paths(), ['Playing', '/Progress']);
});

test('calls are serialised: concurrent flushes never overlap', async () => {
  let inFlight = 0;
  let maxInFlight = 0;
  const r = new Reporter({
    send: async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((res) => setTimeout(res, 5));
      inFlight--;
    },
  });
  await Promise.all([r.update(track('a')), r.tick(), r.tick(), r.update(track('a', { event: 'Pause', isPaused: true }))]);
  assert.strictEqual(maxInFlight, 1);
});

test('normalizeServer adds http and strips slashes', () => {
  assert.strictEqual(normalizeServer('10.10.1.33:8096/'), 'http://10.10.1.33:8096');
  assert.strictEqual(normalizeServer('https://jf.example.com/jellyfin/'), 'https://jf.example.com/jellyfin');
  assert.throws(() => normalizeServer('  '));
});

test('authorization header identifies the device and token', () => {
  const c = new JellyfinClient({ server: 'http://x', token: 'tok', deviceId: 'dev1', deviceName: 'Christian-PC', version: '0.1.0' });
  const h = c.authHeader();
  assert.match(h, /^MediaBrowser /);
  assert.match(h, /Client="Jellyfin Music Player"/);
  assert.match(h, /DeviceId="dev1"/);
  assert.match(h, /Token="tok"/);
});
