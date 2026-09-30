// Renders assets/icon/tray-icon.svg to src-tauri/icons/tray.png (32×32, transparent) with Edge.
// Usage: node e2e/render-tray-icon.mjs
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const svg = readFileSync(fileURLToPath(new URL('../../assets/icon/tray-icon.svg', import.meta.url)), 'utf-8');
const out = fileURLToPath(new URL('../src-tauri/icons/tray.png', import.meta.url));
const b = await chromium.launch({ channel: 'msedge' });
const p = await b.newPage({ viewport: { width: 64, height: 64 }, deviceScaleFactor: 1 });
await p.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
await p.locator('svg').screenshot({ path: out, omitBackground: true });
await b.close();
console.log('wrote', out);
