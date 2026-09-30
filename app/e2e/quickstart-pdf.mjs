// Renders docs/quickstart/quickstart.html to docs/Notepad-2.0-Quickstart.pdf (A4) with Edge.
// Usage: node e2e/quickstart-pdf.mjs   (run readme-shots.mjs first for fresh screenshots)
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';

const html = fileURLToPath(new URL('../../docs/quickstart/quickstart.html', import.meta.url));
const pdf = fileURLToPath(new URL('../../docs/Notepad-2.0-Quickstart.pdf', import.meta.url));

const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage();
await page.goto(pathToFileURL(html).href, { waitUntil: 'networkidle' });
await page.pdf({ path: pdf, format: 'A4', printBackground: true, preferCSSPageSize: true });
await browser.close();
console.log('wrote', pdf);
