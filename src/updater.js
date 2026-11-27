'use strict';
/**
 * Self-update for the portable exe: download the new exe from the GitHub release next to the running one,
 * check its SHA-256 against the digest GitHub publishes, start it and quit. The new version removes the old exe.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DOWNLOAD_PREFIX = 'https://github.com/Tntdruid/tonefin/releases/download/';
const ASSET_NAME = /^Tonefin-\d+\.\d+\.\d+-portable\.exe$/;

/** The portable exe in a GitHub release: { name, url, size, sha256 } or null. */
function pickAsset(release) {
  for (const a of (release && release.assets) || []) {
    if (!ASSET_NAME.test(a.name || '')) continue;
    const m = /^sha256:([0-9a-f]{64})$/i.exec(a.digest || '');
    return { name: a.name, url: a.browser_download_url, size: a.size, sha256: m ? m[1].toLowerCase() : null };
  }
  return null;
}

/** Only Tonefin's own GitHub releases (plus a test server when one is configured). */
function downloadAllowed(url, extraPrefix) {
  const u = String(url || '');
  return u.startsWith(DOWNLOAD_PREFIX) || (!!extraPrefix && u.startsWith(extraPrefix));
}

/**
 * Downloads the asset into dir, verifying size and SHA-256. Returns the final path.
 * Leaves nothing behind if anything is wrong.
 */
async function download(asset, dir, { onProgress = () => {}, extraPrefix, fetchImpl = globalThis.fetch } = {}) {
  if (!asset || !ASSET_NAME.test(asset.name)) throw new Error('E_UPDATE_NO_ASSET');
  if (!asset.sha256) throw new Error('E_UPDATE_NO_CHECKSUM');
  if (!downloadAllowed(asset.url, extraPrefix)) throw new Error('E_UPDATE_NO_ASSET');
  const final = path.join(dir, asset.name);
  const part = final + '.part';
  let res;
  try {
    res = await fetchImpl(asset.url, { headers: { 'User-Agent': 'Tonefin' }, signal: AbortSignal.timeout(10 * 60 * 1000) });
  } catch {
    throw new Error('E_UPDATE_DOWNLOAD');
  }
  if (!res.ok || !res.body) throw new Error(`E_UPDATE_DOWNLOAD ${res.status}`);
  const total = Number(res.headers.get('content-length')) || asset.size || 0;
  const hash = crypto.createHash('sha256');
  const out = fs.createWriteStream(part);
  let got = 0;
  let lastPct = -1;
  try {
    for await (const chunk of res.body) {
      hash.update(chunk);
      got += chunk.length;
      if (!out.write(chunk)) await new Promise((r) => out.once('drain', r));
      const pct = total ? Math.floor((got / total) * 100) : 0;
      if (pct !== lastPct) {
        lastPct = pct;
        onProgress(pct);
      }
    }
    await new Promise((resolve, reject) => out.end((err) => (err ? reject(err) : resolve())));
  } catch {
    out.destroy();
    fs.rmSync(part, { force: true });
    throw new Error('E_UPDATE_DOWNLOAD');
  }
  if ((asset.size && got !== asset.size) || hash.digest('hex') !== asset.sha256) {
    fs.rmSync(part, { force: true });
    throw new Error('E_UPDATE_CHECKSUM');
  }
  fs.rmSync(final, { force: true });
  fs.renameSync(part, final);
  return final;
}

/** Blocks until the process is gone (or the time is up). Used by the new version before taking the single-instance lock. */
function waitForExitSync(pid, timeoutMs = 20000) {
  if (!pid) return;
  const until = Date.now() + timeoutMs;
  const sleeper = new Int32Array(new SharedArrayBuffer(4));
  while (Date.now() < until) {
    try {
      process.kill(pid, 0);
    } catch {
      return; // gone
    }
    Atomics.wait(sleeper, 0, 0, 200);
  }
}

/** Removes the exe this version replaced. Retries while Windows still holds it open. */
async function removeOld(oldPath, currentPath, log = () => {}) {
  if (!oldPath || !ASSET_NAME.test(path.basename(oldPath)) || path.resolve(oldPath) === path.resolve(currentPath || '')) return false;
  for (let i = 0; i < 20; i++) {
    try {
      if (!fs.existsSync(oldPath)) return true;
      fs.unlinkSync(oldPath);
      log(`removed the old version ${path.basename(oldPath)}`);
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  log(`could not remove the old version ${oldPath}`);
  return false;
}

module.exports = { pickAsset, downloadAllowed, download, waitForExitSync, removeOld, ASSET_NAME, DOWNLOAD_PREFIX };
