'use strict';

/** True if version a (e.g. "0.3.1" or "v0.3.1") is newer than b. */
function isNewer(a, b) {
  const parse = (v) => String(v || '').replace(/^v/i, '').split(/[.-]/).slice(0, 3).map((n) => parseInt(n, 10) || 0);
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  }
  return false;
}

module.exports = { isNewer };
