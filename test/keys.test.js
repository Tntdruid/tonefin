'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const window = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'keys.js'), 'utf8'), { window });
const { ignoreShortcut } = window;

const element = (tag) => ({ matches: (sel) => sel.split(',').map((s) => s.trim()).includes(tag) });
const doc = (overlayOpen) => ({ querySelector: (sel) => (sel === '.overlay' && overlayOpen ? {} : null) });

test('Space works on the page and on focused buttons', () => {
  assert.strictEqual(ignoreShortcut(element('body'), doc(false)), false);
  assert.strictEqual(ignoreShortcut(element('button'), doc(false)), false);
});

test('Space is left alone while typing or choosing in a dropdown', () => {
  assert.strictEqual(ignoreShortcut(element('input'), doc(false)), true);
  assert.strictEqual(ignoreShortcut(element('textarea'), doc(false)), true);
  assert.strictEqual(ignoreShortcut(element('select'), doc(false)), true);
});

// Regression (0.4.0): Space in the "add to playlist" dialog paused the music.
test('Space is left alone while a dialog is open', () => {
  assert.strictEqual(ignoreShortcut(element('button'), doc(true)), true);
  assert.strictEqual(ignoreShortcut(element('body'), doc(true)), true);
});
