// Checks Table > Fit columns to data width and the floating sideways scrollbar in the browser build.
// Usage: npm run build && node e2e/table-fit-check.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('./out/', import.meta.url));
mkdirSync(OUT, { recursive: true });
const PORT = 4175;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'pipe', shell: true });
await new Promise((res) => {
  server.stdout.on('data', (d) => String(d).includes(String(PORT)) && res());
  setTimeout(res, 8000);
});
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'msedge' });
const page = await (await browser.newContext({ viewport: { width: 1200, height: 800 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
try {
  await page.goto(`http://127.0.0.1:${PORT}/`);
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(() => localStorage.setItem('np2.store:settings.json', JSON.stringify({ theme: 'light', tabsMode: 'top', mdDefaultView: 'edit', firstRunDone: true })));
  await page.reload();
  await page.waitForSelector('.cm-editor');
  await page.waitForTimeout(600);
  await page.locator('.side-note, .tab', { hasText: 'Business strategy' }).first().click();
  await page.waitForTimeout(500);

  // A 14-column, 60-row "spreadsheet".
  const cols = Array.from({ length: 14 }, (_, i) => `Column heading ${i + 1}`);
  const rows = Array.from({ length: 60 }, (_, r) => `| ${cols.map((_, c) => `Value r${r + 1} c${c + 1} some data`).join(' | ')} |`);
  const table = `\n\n| ${cols.join(' | ')} |\n|${cols.map(() => ' --- ').join('|')}|\n${rows.join('\n')}\n`;
  await page.locator('.view-switch button[title="Markdown source"]').first().click();
  await page.waitForTimeout(400);
  await page.locator('.cm-content:visible').first().click();
  await page.keyboard.press('Control+Home');
  await page.keyboard.insertText(table.trimStart() + '\n');
  await page.waitForTimeout(300);
  await page.locator('.view-switch button[title="Visual editing"]').first().click();
  await page.waitForSelector('.visual-editor .tableWrapper');
  await page.waitForTimeout(500);

  const stats = () =>
    page.evaluate(() => {
      const w = document.querySelector('.visual-editor .tableWrapper');
      const t = w.querySelector('table');
      const row = t.querySelectorAll('tr')[2];
      const bar = document.querySelector('.visual-editor .float-hscroll');
      return {
        wrapperW: w.clientWidth,
        tableW: t.scrollWidth,
        rowH: row.getBoundingClientRect().height,
        bar: bar ? getComputedStyle(bar).display : 'missing',
        barInner: bar?.firstElementChild?.style.width,
      };
    });
  const before = await stats();
  await page.screenshot({ path: OUT + 'tablefit-1-before.png' });

  await page.locator('.visual-editor td').nth(3).click();
  await page.locator('.fb-table-tools').click();
  await page.locator('.fb-menu-item', { hasText: 'Fit columns to data width' }).click();
  await page.waitForTimeout(500);
  const after = await stats();
  await page.screenshot({ path: OUT + 'tablefit-2-after.png' });

  // Drag the floating bar to the far right: the table should follow.
  await page.evaluate(() => {
    const b = document.querySelector('.visual-editor .float-hscroll');
    b.scrollLeft = b.scrollWidth;
    b.dispatchEvent(new Event('scroll'));
  });
  await page.waitForTimeout(300);
  const scrolled = await page.evaluate(() => document.querySelector('.visual-editor .tableWrapper').scrollLeft);
  await page.screenshot({ path: OUT + 'tablefit-3-scrolled.png' });

  await page.locator('.visual-editor td').nth(3).click();
  await page.locator('.fb-table-tools').click();
  await page.locator('.fb-menu-item', { hasText: 'Fit table to page width' }).click();
  await page.waitForTimeout(400);
  const reset = await stats();
  console.log(JSON.stringify({ before, after, scrolled, reset, errors }, null, 1));
} finally {
  await browser.close();
  server.kill();
  spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { shell: true });
}
