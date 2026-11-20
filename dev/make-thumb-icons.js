'use strict';
/**
 * Draws the white previous / play / pause / next icons for the taskbar thumbnail buttons.
 *   node dev/make-thumb-icons.js
 * Writes assets/thumb-<name>.png (16 px) and thumb-<name>@2x.png (32 px); Electron picks the right one.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Shapes in a 16x16 coordinate space: polygons (lists of [x, y]).
const SHAPES = {
  play: [[[4.5, 2.5], [13, 8], [4.5, 13.5]]],
  pause: [[[3.5, 2.5], [6.5, 2.5], [6.5, 13.5], [3.5, 13.5]], [[9.5, 2.5], [12.5, 2.5], [12.5, 13.5], [9.5, 13.5]]],
  prev: [[[2.5, 3], [4.5, 3], [4.5, 13], [2.5, 13]], [[13.5, 3], [13.5, 13], [5, 8]]],
  next: [[[11.5, 3], [13.5, 3], [13.5, 13], [11.5, 13]], [[2.5, 3], [11, 8], [2.5, 13]]],
};

function inside(poly, x, y) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

function render(polys, size) {
  const scale = size / 16;
  const ss = 4; // 4x4 supersampling for smooth edges
  const rgba = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let covered = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const x = (px + (sx + 0.5) / ss) / scale;
          const y = (py + (sy + 0.5) / ss) / scale;
          if (polys.some((p) => inside(p, x, y))) covered++;
        }
      }
      const o = (py * size + px) * 4;
      rgba[o] = rgba[o + 1] = rgba[o + 2] = 255;
      rgba[o + 3] = Math.round((covered / (ss * ss)) * 255);
    }
  }
  return rgba;
}

function crc32(buf) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(rgba, size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const rows = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) rgba.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const out = path.join(__dirname, '..', 'assets');
for (const [name, polys] of Object.entries(SHAPES)) {
  fs.writeFileSync(path.join(out, `thumb-${name}.png`), png(render(polys, 16), 16));
  fs.writeFileSync(path.join(out, `thumb-${name}@2x.png`), png(render(polys, 32), 32));
  console.log('wrote', `thumb-${name}.png`, `thumb-${name}@2x.png`);
}
