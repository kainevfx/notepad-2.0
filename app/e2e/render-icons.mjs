// Builds every app and file-type icon from the tray icon (assets/icon/tray-icon.svg), the master
// icon for the whole app since 2026-10-01:
//   src-tauri/icons/32x32.png, 128x128.png, 128x128@2x.png, icon.png, icon.ico  (window, taskbar, exe, installer)
//   src-tauri/icons/tray.png                                                  (tray, 32 px)
//   src-tauri/filetypes/{txt,md,csv,sheet}.ico                                (Explorer, files opened with the app)
//   assets/icon/app-icon.svg / app-icon.png and assets/icon/filetype-*.svg   (sources and previews)
// Usage: node e2e/render-icons.mjs   (PW_CHANNEL=msedge on Windows, PW_EXE=<chromium> elsewhere)
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const tray = readFileSync(here('../../assets/icon/tray-icon.svg'), 'utf-8');
const inner = tray.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');

/** The sheet at any size. */
const sheet = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">${inner}</svg>`;

const TYPES = {
  txt: { label: 'TXT', fill: '#4b5563' },
  md: { label: 'MD', fill: '#1f6feb' },
  csv: { label: 'CSV', fill: '#0e7c86' },
  sheet: { label: 'SHEET', fill: '#107c41' },
};
/** The sheet with a badge across its lower part. */
const typed = (size, t) => {
  const { label, fill } = TYPES[t];
  const fs = label.length > 3 ? 6.4 : 8.6;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">${inner}
  <rect x="2.5" y="18" width="27" height="11.5" rx="2.6" fill="${fill}" stroke="#ffffff" stroke-width="1"/>
  <text x="16" y="${label.length > 3 ? 25.9 : 26.9}" text-anchor="middle" font-family="Segoe UI, Arial, DejaVu Sans, sans-serif" font-weight="700" font-size="${fs}" letter-spacing="${label.length > 3 ? 0.2 : 0.4}" fill="#ffffff">${label}</text>
</svg>`;
};

const b = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : process.env.PW_EXE ? { executablePath: process.env.PW_EXE } : {});
const page = await b.newPage({ viewport: { width: 1100, height: 1100 }, deviceScaleFactor: 1 });
async function png(svg) {
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
  return await page.locator('svg').screenshot({ omitBackground: true });
}

/** An .ico holding PNG images (Windows Vista and later read these). */
function ico(images) {
  const head = Buffer.alloc(6);
  head.writeUInt16LE(0, 0);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(images.length, 4);
  const dir = Buffer.alloc(16 * images.length);
  let offset = 6 + dir.length;
  images.forEach(({ size, data }, i) => {
    const o = i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, o);
    dir.writeUInt8(size >= 256 ? 0 : size, o + 1);
    dir.writeUInt8(0, o + 2);
    dir.writeUInt8(0, o + 3);
    dir.writeUInt16LE(1, o + 4);
    dir.writeUInt16LE(32, o + 6);
    dir.writeUInt32LE(data.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += data.length;
  });
  return Buffer.concat([head, dir, ...images.map((x) => x.data)]);
}

const ICO_SIZES = [16, 20, 24, 32, 40, 48, 64, 96, 128, 256];
const icons = here('../src-tauri/icons/');
const types = here('../src-tauri/filetypes/');
mkdirSync(types, { recursive: true });

// App icon set.
const app = [];
for (const s of ICO_SIZES) app.push({ size: s, data: await png(sheet(s)) });
writeFileSync(icons + 'icon.ico', ico(app));
writeFileSync(icons + '32x32.png', await png(sheet(32)));
writeFileSync(icons + 'tray.png', await png(sheet(32)));
writeFileSync(icons + '128x128.png', await png(sheet(128)));
writeFileSync(icons + '128x128@2x.png', await png(sheet(256)));
writeFileSync(icons + 'icon.png', await png(sheet(512)));
writeFileSync(here('../../assets/icon/app-icon.svg'), sheet(1024) + '\n');
writeFileSync(here('../../assets/icon/app-icon.png'), await png(sheet(1024)));

// File-type icons.
for (const t of Object.keys(TYPES)) {
  const imgs = [];
  for (const s of ICO_SIZES) imgs.push({ size: s, data: await png(typed(s, t)) });
  writeFileSync(types + `${t}.ico`, ico(imgs));
  writeFileSync(here(`../../assets/icon/filetype-${t}.svg`), typed(256, t) + '\n');
  writeFileSync(here(`../e2e/out/filetype-${t}.png`), await png(typed(256, t)));
}
await b.close();
console.log('icons written');
