// Screenshots of the sidebar (browser build, Tauri mocked). Usage: npm run build && node e2e/sidebar-shots.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('./out/', import.meta.url));
mkdirSync(OUT, { recursive: true });
const PORT = 4176;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'pipe', shell: process.platform === 'win32' });
await new Promise((res) => {
  server.stdout.on('data', (d) => String(d).includes(String(PORT)) && res());
  setTimeout(res, 8000);
});
const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : process.env.PW_EXE ? { executablePath: process.env.PW_EXE } : {});
const page = await (await browser.newContext({ viewport: { width: 1100, height: 760 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const base = { tabsMode: 'left', mdDefaultView: 'edit', firstRunDone: true, sidebarWidth: 120 };
try {
  for (const theme of ['dark', 'light']) {
    await page.goto(`http://127.0.0.1:${PORT}/`);
    await page.evaluate(() => localStorage.clear());
    await page.evaluate((s) => localStorage.setItem('np2.store:settings.json', JSON.stringify(s)), { ...base, theme });
    await page.reload();
    await page.waitForSelector('.sidebar');
    await page.waitForTimeout(800);
    // Multi-select two files with Ctrl, then a range with Shift.
    const rows = page.locator('.side-scroll .side-note');
    await rows.nth(0).click();
    await rows.nth(2).click({ modifiers: ['Control'] });
    await rows.nth(3).click({ modifiers: ['Control'] });
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${OUT}sidebar-${theme}.png` });
    if (theme === 'dark') {
      await rows.nth(2).click({ button: 'right' });
      await page.waitForTimeout(200);
      await page.screenshot({ path: `${OUT}sidebar-menu-multi.png` });
      await page.keyboard.press('Escape');
      await page.mouse.click(700, 400);
      await rows.nth(1).click({ button: 'right' });
      await page.waitForTimeout(200);
      await page.screenshot({ path: `${OUT}sidebar-menu-single.png` });
    }
    const m = await page.evaluate(() => {
      const cn = document.querySelector('.create-new');
      return { sidebar: document.querySelector('.sidebar').getBoundingClientRect().width, create: cn.getBoundingClientRect().width, createScroll: cn.scrollWidth, createClient: cn.clientWidth, selected: document.querySelectorAll('.side-note.selected').length };
    });
    console.log(theme, JSON.stringify(m));
  }
  console.log('errors', JSON.stringify(errors));
} finally {
  await browser.close();
  server.kill();
}
