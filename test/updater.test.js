'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { pickAsset, downloadAllowed, download, removeOld } = require('../src/updater');

const BODY = Buffer.from('pretend this is Tonefin.exe '.repeat(5000));
const SHA = crypto.createHash('sha256').update(BODY).digest('hex');
const URL_OK = 'https://github.com/Tntdruid/tonefin/releases/download/v9.9.9/Tonefin-9.9.9-portable.exe';

const fakeFetch = (body = BODY, status = 200) => async () => ({
  ok: status === 200,
  status,
  headers: { get: (h) => (h === 'content-length' ? String(body.length) : null) },
  body: (async function* () {
    for (let i = 0; i < body.length; i += 4096) yield body.subarray(i, i + 4096);
  })(),
});

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'tonefin-upd-'));
const asset = (over = {}) => ({ name: 'Tonefin-9.9.9-portable.exe', url: URL_OK, size: BODY.length, sha256: SHA, ...over });

test('the portable exe and its checksum are found in a GitHub release', () => {
  const a = pickAsset({
    assets: [
      { name: 'notes.txt', browser_download_url: 'x' },
      { name: 'Tonefin-0.6.0-portable.exe', browser_download_url: URL_OK, size: 10, digest: `sha256:${SHA.toUpperCase()}` },
    ],
  });
  assert.deepStrictEqual(a, { name: 'Tonefin-0.6.0-portable.exe', url: URL_OK, size: 10, sha256: SHA });
  assert.strictEqual(pickAsset({ assets: [{ name: 'evil.exe' }] }), null);
  assert.strictEqual(pickAsset(null), null);
});

test('downloads only come from Tonefin’s own GitHub releases', () => {
  assert.ok(downloadAllowed(URL_OK));
  assert.ok(!downloadAllowed('https://github.com/someone/else/releases/download/v1/Tonefin-1.0.0-portable.exe'));
  assert.ok(!downloadAllowed('https://evil.example/Tonefin-9.9.9-portable.exe'));
  assert.ok(downloadAllowed('http://localhost:8097/__asset', 'http://localhost:8097/'));
});

test('a correct download is saved next to the exe, with progress', async () => {
  const dir = tmp();
  const seen = [];
  const file = await download(asset(), dir, { fetchImpl: fakeFetch(), onProgress: (p) => seen.push(p) });
  assert.strictEqual(file, path.join(dir, 'Tonefin-9.9.9-portable.exe'));
  assert.ok(fs.readFileSync(file).equals(BODY));
  assert.strictEqual(seen[seen.length - 1], 100);
  assert.deepStrictEqual(fs.readdirSync(dir), ['Tonefin-9.9.9-portable.exe']);
});

test('a file that does not match the checksum is deleted and never started', async () => {
  const dir = tmp();
  const tampered = Buffer.from(BODY);
  tampered[100] ^= 1;
  await assert.rejects(download(asset(), dir, { fetchImpl: fakeFetch(tampered) }), /E_UPDATE_CHECKSUM/);
  assert.deepStrictEqual(fs.readdirSync(dir), []);
});

test('missing checksum, foreign URL, odd file name or HTTP error are refused', async () => {
  const dir = tmp();
  await assert.rejects(download(asset({ sha256: null }), dir, { fetchImpl: fakeFetch() }), /E_UPDATE_NO_CHECKSUM/);
  await assert.rejects(download(asset({ url: 'https://evil.example/x.exe' }), dir, { fetchImpl: fakeFetch() }), /E_UPDATE_NO_ASSET/);
  await assert.rejects(download(asset({ name: '..\\..\\Windows\\evil.exe' }), dir, { fetchImpl: fakeFetch() }), /E_UPDATE_NO_ASSET/);
  await assert.rejects(download(asset(), dir, { fetchImpl: fakeFetch(BODY, 404) }), /E_UPDATE_DOWNLOAD 404/);
  assert.deepStrictEqual(fs.readdirSync(dir), []);
});

test('only the replaced Tonefin exe is removed, never the running one or other files', async () => {
  const dir = tmp();
  const old = path.join(dir, 'Tonefin-0.5.0-portable.exe');
  const cur = path.join(dir, 'Tonefin-0.6.0-portable.exe');
  const other = path.join(dir, 'notes.txt');
  for (const f of [old, cur, other]) fs.writeFileSync(f, 'x');
  assert.strictEqual(await removeOld(cur, cur), false, 'not the running exe');
  assert.strictEqual(await removeOld(other, cur), false, 'not other files');
  assert.strictEqual(await removeOld(old, cur), true);
  assert.deepStrictEqual(fs.readdirSync(dir).sort(), ['Tonefin-0.6.0-portable.exe', 'notes.txt']);
});
