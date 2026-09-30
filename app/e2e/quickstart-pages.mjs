// Preview helper: saves each page of the quickstart as a PNG (for checking layout before the PDF).
// Usage: node e2e/quickstart-pages.mjs <outDir>
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';

const html = fileURLToPath(new URL('../../docs/quickstart/quickstart.html', import.meta.url));
const out = process.argv[2] || '.';
const b = await chromium.launch({ channel: 'msedge' });
const p = await b.newPage({ viewport: { width: 794, height: 1123 } });
await p.goto(pathToFileURL(html).href, { waitUntil: 'networkidle' });
const pages = await p.locator('.page').all();
for (let i = 0; i < pages.length; i++) await pages[i].screenshot({ path: `${out}/pg${i + 1}.png` });
await b.close();
console.log(pages.length, 'pages');
