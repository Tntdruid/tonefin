'use strict';

/**
 * Whether a keyboard shortcut (such as Space for play/pause) should be left alone:
 * while typing in a field, using a dropdown, or while a dialog is open.
 */
function ignoreShortcut(target, doc) {
  if (target && typeof target.matches === 'function' && target.matches('input, textarea, select')) return true;
  return !!(doc && doc.querySelector('.overlay'));
}

window.ignoreShortcut = ignoreShortcut;
