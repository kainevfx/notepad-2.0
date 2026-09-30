// Screenshots for the README and the quickstart PDF (browser build, Tauri layer mocked).
// Usage: start `npx vite --port 5188`, then `node e2e/readme-shots.mjs [baseUrl]`.
// Writes PNGs to ../docs/screenshots/.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../../docs/screenshots/', import.meta.url));
mkdirSync(OUT, { recursive: true });
const BASE = process.argv[2] || 'http://127.0.0.1:5188';

const browser = await chromium.launch({ channel: 'msedge' });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5 });
// Settings go in before the app loads (the app saves its own settings on the way out).
await ctx.addInitScript(() => {
  const s = sessionStorage.getItem('np2.shot');
  if (s) localStorage.setItem('np2.store:settings.json', s);
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

const DEFAULTS = { theme: 'dark', tabsMode: 'left', paper: 'none', paperNumbers: false, mdDefaultView: 'visual', fontFamily: 'Consolas', fontSize: 11, zoom: 100, wordWrap: true, statusBar: true, firstRunDone: true, uiScale: 100, pageMargin: 24 };

async function setup(patch = {}) {
  await page.evaluate((s) => sessionStorage.setItem('np2.shot', JSON.stringify(s)), { ...DEFAULTS, ...patch });
  await page.reload();
  await page.waitForSelector('.statusbar');
  await page.waitForTimeout(800);
}
async function shot(name, opts = {}) {
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}${name}.png`, ...opts });
  console.log('shot', name);
}
async function open(title) {
  await page.locator('.side-note, .tab', { hasText: title }).first().click();
  await page.waitForTimeout(700);
}
async function view(name) {
  await page.locator('.seg button', { hasText: name }).first().click();
  await page.waitForTimeout(900);
}

await page.goto(BASE + '/');
await page.evaluate(() => localStorage.clear());
await setup();

// 1. Hero: dark, sidebar with file groups, Markdown in Visual (WYSIWYG)
await open('Business strategy');
await view('Visual');
await shot('01-hero-visual-dark');

// 2. Classic Notepad look: light, tabs on top, a plain text file
await setup({ theme: 'light', tabsMode: 'top' });
await open('Meeting Note 1');
await shot('02-notepad-light-top-tabs');

// 3. Split view: Markdown source + live preview
await setup({ tabsMode: 'left' });
await open('Business strategy');
await view('Split');
await shot('03-split-view');

// 4. Code paper
await setup({ tabsMode: 'left', paper: 'numbers' });
await open('Code Snippets');
await shot('04-code-paper');

// 5. Lines paper, light, rail
await setup({ theme: 'light', tabsMode: 'rail', paper: 'lines', paperNumbers: true });
await open('Meeting Note 2').catch(() => {});
await shot('05-lines-paper-rail');

// 6. Group context menu with the colour submenu
await setup({ tabsMode: 'left' });
await page.locator('.side-group-head', { hasText: 'Development' }).first().click({ button: 'right' });
await page.waitForTimeout(250);
await page.locator('.menu-item, .menu button', { hasText: 'Colour' }).first().hover().catch(() => {});
await shot('06-group-menu');
await page.keyboard.press('Escape');

// 7. Insert menu
await setup({ tabsMode: 'left' });
await open('Business strategy');
await page.locator('.menubar button', { hasText: 'Insert' }).first().click();
await shot('07-insert-menu');
await page.keyboard.press('Escape');

// 8. Settings: theme and appearance
await setup({ tabsMode: 'top' });
await page.locator('[title=Settings], button:has-text("Settings")').first().click();
await page.waitForTimeout(400);
await shot('08-settings');
await page.keyboard.press('Escape');

// 9. Startup guide
await setup({ firstRunDone: false });
await page.waitForSelector('.guide-card', { timeout: 4000 }).catch(() => {});
for (let i = 0; i < 2; i++) await page.keyboard.press('ArrowRight');
await shot('09-startup-guide');
await page.keyboard.press('Escape');

// 11. Table editing in Visual, with the Table dropdown open
await setup({ tabsMode: 'left' });
await open('Business strategy');
await view('Visual');
const cell = page.locator('.visual-editor td').first();
await cell.scrollIntoViewIfNeeded();
await page.evaluate(() => document.querySelector('.visual-editor table')?.scrollIntoView({ block: 'center' }));
await page.locator('.visual-editor td').first().click();
await page.waitForTimeout(300);
await page.locator('button', { hasText: /^Table/ }).last().click().catch(() => console.log('no Table dropdown'));
await shot('11-table-editing');
await page.keyboard.press('Escape');

// 12–16. File viewers (the demo's "Production files" group)
async function openFile(title) {
  const note = page.locator('.side-note', { hasText: title }).first();
  if (!(await note.isVisible().catch(() => false))) {
    await page.locator('.side-group-head', { hasText: 'Production files' }).first().click();
    await page.waitForTimeout(300);
  }
  await note.click();
  await page.waitForTimeout(1500);
}
await setup({ tabsMode: 'left' });
await openFile('Cast.csv');
await page.locator('.grid thead th', { hasText: 'Fee' }).click();
await shot('12-csv-grid');
await openFile('Budget.xlsx');
await shot('13-spreadsheet');
await openFile('config.json');
await view('Split');
await shot('14-json-tree-split');
await view('View');
await openFile('Brief.html');
await shot('15-html-view');
await openFile('Production Brief.docx');
await shot('16-word-document');

// 10. Quick Note bubble
const qn = await ctx.newPage();
await qn.setViewportSize({ width: 420, height: 520 });
await qn.goto(BASE + '/quicknote.html');
await qn.waitForSelector('.cm-editor');
await qn.waitForTimeout(500);
await qn.keyboard.press('Control+End');
await qn.keyboard.type('\nBuy spare HDMI cable\nCall venue about load-in time');
await qn.waitForTimeout(500);
await qn.screenshot({ path: `${OUT}10-quick-note.png` });
console.log('shot 10-quick-note');

console.log('errors:', errors.length ? errors : 'none');
await browser.close();
