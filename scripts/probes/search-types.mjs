// READ-ONLY: runs one search per product tab of the B2B portal (writes BLOCKED except searches) and records what comes back:
// result count / empty message / errors / failed API calls. Screenshots in screenshots/search/.
//   node scripts/probes/search-types.mjs
import { chromium } from '@playwright/test';
import fs from 'fs';
const B2B = (process.env.B2B_URL || 'https://b2b.nexgenpilot.com').replace(/\/$/, '');
const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: 'playwright/.auth/b2b.json', viewport: { width: 1500, height: 950 } });
const blocked = [];
await ctx.route('**/*', r => { const q = r.request(); if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(q.method()) && !/search|details|availability|autocomplete|suggest|lookup|airport|cit(y|ies)|destination|places|price|terms|discount-preview|auth|refresh/i.test(new URL(q.url()).pathname)) { blocked.push(new URL(q.url()).pathname); return r.abort(); } return r.continue(); });
const page = await ctx.newPage();
const failed = []; const errors = [];
page.on('response', r => { if (r.status() >= 400 && /nexgenpilot|runasp/.test(r.url())) failed.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`); });
page.on('pageerror', e => errors.push(String(e).slice(0, 160)));
fs.mkdirSync('screenshots/search', { recursive: true });
const body = async () => (await page.locator('body').innerText()).replace(/[\s​]+/g, ' ');
const after = s => s.split('Rail')[1]?.slice(0, 900) ?? s.slice(-900);
const pickOption = async (placeholder, text) => {
  const box = page.getByPlaceholder(placeholder).first();
  await box.click(); await box.pressSequentially(text, { delay: 70 }); await page.waitForTimeout(2500);
  const opts = await page.getByRole('option').allInnerTexts();
  await page.getByRole('option').first().click().catch(() => page.keyboard.press('Enter'));
  return opts.slice(0, 4).map(s => s.replace(/\s+/g, ' '));
};
async function run(tab, route, fill, searchBtn) {
  failed.length = 0; errors.length = 0;
  if (route === 'tab') { await page.goto(`${B2B}/search/hotel`); await page.waitForTimeout(2500); await page.getByText(tab, { exact: true }).first().click(); }
  else { for (let i = 0; i < 3; i++) { try { await page.goto(B2B + route, { timeout: 60000 }); break; } catch (e) { console.log("goto retry", route, String(e).split("\n")[0].slice(0, 80)); await page.waitForTimeout(5000); } } }
  await page.waitForTimeout(3000);
  const info = { tab, url: page.url().replace(B2B, '') };
  try { info.options = await fill(); } catch (e) { info.fillError = String(e).split('\n')[0].slice(0, 160); }
  await page.screenshot({ path: `screenshots/search/${tab.replace(/\W+/g, '_')}-form.png` });
  const btn = page.getByRole('button', { name: searchBtn }).first();
  info.searchEnabled = await btn.isEnabled().catch(() => false);
  if (info.searchEnabled) { await btn.click(); for (let w = 0; w < 14 && /Comparing fares|Contacting|Checking|Searching|Live search/i.test(await body()); w++) await page.waitForTimeout(5000); await page.waitForTimeout(4000); }
  await page.screenshot({ path: `screenshots/search/${tab.replace(/\W+/g, '_')}-results.png`, fullPage: true });
  info.result = after(await body());
  info.failed = [...new Set(failed)]; info.errors = [...new Set(errors)];
  console.log(JSON.stringify(info));
}
await run('Flights', '/search/flight', async () => [...await pickOption('Enter origin', 'Dubai'), '|', ...await pickOption('Enter destination', 'Delhi')], /^Search flights$/);
await run('Activities', '/search/activity', async () => pickOption('Enter destination', 'Dubai'), /^Search activities$/);
await run('Transfers', '/search/transfers', async () => pickOption('Search city', 'Dubai'), /^Search transfers$/);
await run('Cruise', '/search/cruise', async () => pickOption('e.g. Caribbean, Mediterranean, Arabian Gulf', 'Arabian'), /^Search cruises$/);
await run('Rail', '/search/rail', async () => [...await pickOption('Station or city, e.g. London', 'London'), '|', ...await pickOption('Station or city, e.g. Paris', 'Paris')], /^Search rail$/);
await run('Flight + Hotel', 'tab', async () => [...await pickOption('Enter origin', 'Delhi'), '|', ...await pickOption('Enter destination', 'Dubai')], /^Search/);
await run('Packages', 'tab', async () => [...await pickOption('Enter origin', 'Delhi'), '|', ...await pickOption('Enter destination', 'Dubai')], /^Search/);
console.log('blocked writes:', [...new Set(blocked)].join(', ') || 'none');
await browser.close();
