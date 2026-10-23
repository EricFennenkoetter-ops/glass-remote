// Renders the app icon variants to PNG without any dependencies.
// Usage: npm run icons
//
// Variants (all selectable in the app under "Darstellung → App-Icon"):
//   signal  – green glossy disc with a black "remote signal" on near-black
//   mint    – frosted glass disc with play + sound waves on a green gradient
//   orb     – liquid green orb with a white play symbol on black
//   violet  – the original violet glass disc
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const OUT_DIR = new URL('../public/icons/', import.meta.url);
const SUPERSAMPLING = 4;
// The default/manifest icons (icon-*.png) come from your own image: npm run icons:custom

// ---------- PNG encoding ----------

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

function encodePng(width, height, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- shading helpers ----------

const mix = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const mixColour = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

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

/** Play triangle, optically centred on (cx, cy). */
function insidePlay(u, v, cx, cy, size) {
  return insideTriangle(u, v, [cx - size * 0.75, cy - size], [cx - size * 0.75, cy + size], [cx + size * 1.05, cy]);
}

/** Point on an arc ring around (cx, cy) with radius r, opening to the right within ±maxAngle. */
function onArc(u, v, cx, cy, r, thickness, maxAngle) {
  const dx = u - cx;
  const dy = v - cy;
  const angle = Math.abs(Math.atan2(dy, dx));
  if (angle > maxAngle) {
    // rounded caps
    const capAngle = maxAngle * Math.sign(dy || 1);
    const capX = cx + Math.cos(capAngle) * r;
    const capY = cy + Math.sin(capAngle) * r;
    return Math.hypot(u - capX, v - capY) < thickness / 2;
  }
  return Math.abs(Math.hypot(dx, dy) - r) < thickness / 2;
}

/** Glass rim + specular highlight on a disc; d = normalised distance, du/dv = normalised offsets. */
function glassDisc(pixel, du, dv, dist, { fill = 0.14, rim = 0.55, specular = 0.35 } = {}) {
  over(pixel, [255, 255, 255], fill + 0.1 * clamp01(-dv));
  const rimT = clamp01((dist - 0.93) / 0.07);
  over(pixel, [255, 255, 255], rimT * mix(rim, 0.12, clamp01((dv + du + 1.4) / 2.8)));
  over(pixel, [255, 255, 255], Math.exp(-((du + 0.35) ** 2 + (dv + 0.55) ** 2) / 0.05) * specular);
}

function blobs(pixel, u, v, list) {
  for (const blob of list) {
    const d = Math.hypot(u - blob.x, v - blob.y) / blob.r;
    over(pixel, blob.c, clamp01(1 - d) ** 1.6 * blob.a);
  }
}

const GREEN = [30, 215, 96];
const GREEN_DARK = [12, 122, 59];
const INK = [14, 16, 15];

// ---------- variants: shade(u, v, safe) → [r, g, b] in unit space ----------

const VARIANTS = {
  signal(u, v, safe) {
    const pixel = [...INK];
    blobs(pixel, u, v, [
      { x: 0.85, y: 0.9, r: 0.7, c: GREEN_DARK, a: 0.55 },
      { x: 0.1, y: 0.05, r: 0.5, c: [40, 70, 55], a: 0.5 },
    ]);
    const radius = 0.36 * (safe ? 0.78 : 1);
    const du = (u - 0.5) / radius;
    const dv = (v - 0.5) / radius;
    const dist = Math.hypot(du, dv);
    if (dist <= 1) {
      Object.assign(pixel, mixColour([62, 232, 122], GREEN_DARK, clamp01((dv + 1) / 2) ** 1.4));
      glassDisc(pixel, du, dv, dist, { fill: 0.02, rim: 0.6, specular: 0.4 });
      // "Remote signal": a dot with three arcs radiating to the right.
      const cx = 0.5 - radius * 0.38;
      const scale = radius / 0.36;
      if (Math.hypot(u - cx, v - 0.5) < 0.045 * scale) over(pixel, INK, 1);
      for (const [r, t] of [
        [0.1, 0.034],
        [0.17, 0.034],
        [0.24, 0.034],
      ]) {
        if (onArc(u, v, cx, 0.5, r * scale, t * scale, 0.85)) over(pixel, INK, 1);
      }
    } else if (dist <= 1.14) {
      over(pixel, [0, 0, 0], (1 - (dist - 1) / 0.14) * 0.35);
    }
    return pixel;
  },

  mint(u, v, safe) {
    const pixel = mixColour([50, 230, 120], [8, 92, 48], clamp01((u + v) / 2));
    blobs(pixel, u, v, [
      { x: 0.15, y: 0.1, r: 0.6, c: [160, 255, 200], a: 0.45 },
      { x: 0.9, y: 0.95, r: 0.6, c: [4, 50, 28], a: 0.6 },
    ]);
    const radius = 0.34 * (safe ? 0.78 : 1);
    const du = (u - 0.5) / radius;
    const dv = (v - 0.5) / radius;
    const dist = Math.hypot(du, dv);
    if (dist <= 1) {
      over(pixel, [0, 40, 20], 0.12);
      glassDisc(pixel, du, dv, dist, { fill: 0.18, rim: 0.7, specular: 0.4 });
      const s = radius * 0.34;
      const cx = 0.5 - radius * 0.16;
      if (insidePlay(u, v, cx, 0.5, s)) over(pixel, [255, 255, 255], 0.97);
      for (const r of [0.55, 0.78]) {
        if (onArc(u, v, cx, 0.5, radius * r, radius * 0.07, 0.75)) over(pixel, [255, 255, 255], 0.9);
      }
    } else if (dist <= 1.12) {
      over(pixel, [0, 0, 0], (1 - (dist - 1) / 0.12) * 0.2);
    }
    return pixel;
  },

  orb(u, v, safe) {
    const pixel = [6, 8, 7];
    blobs(pixel, u, v, [{ x: 0.5, y: 0.55, r: 0.55, c: GREEN_DARK, a: 0.5 }]);
    const radius = 0.37 * (safe ? 0.78 : 1);
    const du = (u - 0.5) / radius;
    const dv = (v - 0.5) / radius;
    const dist = Math.hypot(du, dv);
    if (dist <= 1) {
      // Liquid orb: bright core shifted up-left, darker towards the edge.
      const core = clamp01(1 - Math.hypot(du + 0.25, dv + 0.3) / 1.3);
      Object.assign(pixel, mixColour([6, 70, 34], [70, 245, 140], core ** 1.2));
      glassDisc(pixel, du, dv, dist, { fill: 0.0, rim: 0.75, specular: 0.55 });
      // Caustic: light pooling at the bottom edge.
      over(pixel, [170, 255, 205], clamp01(1 - Math.hypot(du, dv - 0.8) / 0.35) * 0.35);
      if (insidePlay(u, v, 0.5, 0.5, radius * 0.38)) over(pixel, [255, 255, 255], 0.97);
    } else if (dist <= 1.3) {
      over(pixel, GREEN, (1 - (dist - 1) / 0.3) ** 2 * 0.22); // glow
    }
    return pixel;
  },

  violet(u, v, safe) {
    const pixel = [12, 10, 24];
    blobs(pixel, u, v, [
      { x: 0.2, y: 0.18, r: 0.75, c: [124, 58, 237], a: 0.85 },
      { x: 0.95, y: 0.35, r: 0.6, c: [219, 39, 119], a: 0.85 },
      { x: 0.45, y: 1.0, r: 0.7, c: [13, 148, 136], a: 0.85 },
    ]);
    const radius = 0.34 * (safe ? 0.78 : 1);
    const du = (u - 0.5) / radius;
    const dv = (v - 0.5) / radius;
    const dist = Math.hypot(du, dv);
    if (dist <= 1) {
      glassDisc(pixel, du, dv, dist);
      if (insidePlay(u, v, 0.5, 0.5, radius * 0.42)) over(pixel, [255, 255, 255], 0.96);
    } else if (dist <= 1.12) {
      over(pixel, [0, 0, 0], (1 - (dist - 1) / 0.12) * 0.18);
    }
    return pixel;
  },
};

function render(shade, size, safe) {
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
  return rgba;
}

mkdirSync(OUT_DIR, { recursive: true });
const write = (name, size, rgba) => {
  writeFileSync(new URL(name, OUT_DIR), encodePng(size, size, rgba));
  console.log(`✓ ${name}`);
};

// Per-variant touch icons (the app swaps <link rel="apple-touch-icon"> to the chosen one).
for (const [name, shade] of Object.entries(VARIANTS)) {
  write(`${name}-180.png`, 180, render(shade, 180, false));
}

// Preview sheet (not shipped): all variants side by side with rounded iOS-style corners.
if (process.argv.includes('--preview')) {
  const tile = 240;
  const gap = 40;
  const names = Object.keys(VARIANTS);
  const width = names.length * tile + (names.length + 1) * gap;
  const height = tile + gap * 2;
  const sheet = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) sheet.set([28, 28, 30, 255], i * 4);
  names.forEach((name, index) => {
    const icon = render(VARIANTS[name], tile, false);
    const ox = gap + index * (tile + gap);
    const corner = tile * 0.225;
    for (let y = 0; y < tile; y++) {
      for (let x = 0; x < tile; x++) {
        const cx = Math.min(Math.max(x, corner), tile - corner);
        const cy = Math.min(Math.max(y, corner), tile - corner);
        const alpha = clamp01(corner - Math.hypot(x + 0.5 - cx, y + 0.5 - cy) + 0.5);
        if (alpha <= 0) continue;
        const si = (y * tile + x) * 4;
        const di = ((gap + y) * width + ox + x) * 4;
        for (let c = 0; c < 3; c++) sheet[di + c] = Math.round(mix(sheet[di + c], icon[si + c], alpha));
      }
    }
  });
  const out = new URL(process.argv[process.argv.indexOf('--preview') + 1] ?? 'icon-preview.png', `file://${process.cwd()}/`);
  writeFileSync(out, encodePng(width, height, sheet));
  console.log(`✓ preview → ${out.pathname}`);
}
