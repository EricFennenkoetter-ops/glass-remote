// Renders the app icons (glass disc with play symbol) to PNG without any dependencies.
// Usage: npm run icons
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const OUT_DIR = new URL('../public/icons/', import.meta.url);
const SUPERSAMPLING = 4;

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(size, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const mix = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.min(1, Math.max(0, v));

/** Source-over blend of a colour with alpha onto an opaque pixel. */
function over(pixel, [r, g, b], alpha) {
  pixel[0] = mix(pixel[0], r, alpha);
  pixel[1] = mix(pixel[1], g, alpha);
  pixel[2] = mix(pixel[2], b, alpha);
}

function insideTriangle(px, py, [ax, ay], [bx, by], [cx, cy]) {
  const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
  const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
  const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}

/** Shades one point in unit space (0..1). `safe` shrinks the motif for maskable icons. */
function shade(u, v, safe) {
  // Background: deep violet → magenta → teal blobs.
  const pixel = [12, 10, 24];
  const blobs = [
    { x: 0.2, y: 0.18, r: 0.75, c: [124, 58, 237] },
    { x: 0.95, y: 0.35, r: 0.6, c: [219, 39, 119] },
    { x: 0.45, y: 1.0, r: 0.7, c: [13, 148, 136] },
  ];
  for (const blob of blobs) {
    const d = Math.hypot(u - blob.x, v - blob.y) / blob.r;
    over(pixel, blob.c, clamp01(1 - d) ** 1.6 * 0.85);
  }

  // Glass disc.
  const scale = safe ? 0.78 : 1;
  const cx = 0.5;
  const cy = 0.5;
  const radius = 0.34 * scale;
  const du = (u - cx) / radius;
  const dv = (v - cy) / radius;
  const dist = Math.hypot(du, dv);
  if (dist <= 1) {
    over(pixel, [255, 255, 255], 0.14 + 0.1 * clamp01(-dv)); // frosted fill, lighter on top
    const rim = clamp01((dist - 0.93) / 0.07);
    over(pixel, [255, 255, 255], rim * mix(0.55, 0.12, clamp01((dv + du + 1.4) / 2.8))); // rim light top-left
    const specular = Math.exp(-((du + 0.35) ** 2 + (dv + 0.55) ** 2) / 0.05);
    over(pixel, [255, 255, 255], specular * 0.35);

    // Play triangle, optically centred.
    const s = radius * 0.42;
    const tri = [
      [cx - s * 0.75, cy - s],
      [cx - s * 0.75, cy + s],
      [cx + s * 1.05, cy],
    ];
    if (insideTriangle(u, v, ...tri)) over(pixel, [255, 255, 255], 0.96);
  } else if (dist <= 1.12) {
    over(pixel, [0, 0, 0], (1 - (dist - 1) / 0.12) * 0.18); // soft drop shadow
  }
  return pixel;
}

function render(size, safe) {
  const rgba = Buffer.alloc(size * size * 4);
  const n = SUPERSAMPLING;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const acc = [0, 0, 0];
      for (let sy = 0; sy < n; sy++) {
        for (let sx = 0; sx < n; sx++) {
          const p = shade((x + (sx + 0.5) / n) / size, (y + (sy + 0.5) / n) / size, safe);
          acc[0] += p[0];
          acc[1] += p[1];
          acc[2] += p[2];
        }
      }
      const i = (y * size + x) * 4;
      rgba[i] = Math.round(acc[0] / (n * n));
      rgba[i + 1] = Math.round(acc[1] / (n * n));
      rgba[i + 2] = Math.round(acc[2] / (n * n));
      rgba[i + 3] = 255;
    }
  }
  return encodePng(size, rgba);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const [name, size, safe] of [
  ['icon-180.png', 180, false],
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-maskable-512.png', 512, true],
]) {
  writeFileSync(new URL(name, OUT_DIR), render(size, safe));
  console.log(`✓ ${name}`);
}
