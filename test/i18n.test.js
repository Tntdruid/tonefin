'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = path.join(__dirname, '..', 'src');

function load(language) {
  const store = new Map([['pref:lang', JSON.stringify(language)]]);
  const window = {};
  const context = {
    window,
    navigator: { language: 'da-DK' },
    localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) },
    document: { querySelectorAll: () => [], documentElement: {} },
  };
  vm.runInNewContext(fs.readFileSync(path.join(src, 'renderer', 'i18n.js'), 'utf8'), context);
  return window;
}

test('Danish and English have the same texts', () => {
  const w = load('da');
  assert.deepStrictEqual(w.i18n.keys('da').sort(), w.i18n.keys('en').sort());
});

test('texts are filled in and pluralised', () => {
  const da = load('da');
  const en = load('en');
  assert.strictEqual(da.t('home.hello', { name: 'Tntdruid' }), 'Hej Tntdruid');
  assert.strictEqual(en.t('home.hello', { name: 'Tntdruid' }), 'Hi Tntdruid');
  assert.strictEqual(da.t('n.tracks', { n: 1 }), '1 nummer');
  assert.strictEqual(da.t('n.tracks', { n: 12 }), '12 numre');
  assert.strictEqual(en.t('n.tracks', { n: 1 }), '1 song');
});

test('"auto" follows the Windows language', () => {
  assert.strictEqual(load('auto').i18n.lang, 'da');
});

test('every error code thrown by the main process has a text in both languages', () => {
  const codes = new Set();
  for (const f of ['main.js', 'jellyfin.js']) {
    for (const m of fs.readFileSync(path.join(src, f), 'utf8').matchAll(/\b(E_[A-Z_]+)\b/g)) codes.add(m[1]);
  }
  assert.ok(codes.size >= 8, `found ${codes.size} codes`);
  for (const language of ['da', 'en']) {
    const w = load(language);
    for (const code of codes) {
      assert.notStrictEqual(w.t('err.' + code), 'err.' + code, `${language} is missing err.${code}`);
    }
    assert.match(w.errorText('E_HTTP 404 /Items'), /404/);
    assert.strictEqual(w.errorText('plain text'), 'plain text');
  }
});
