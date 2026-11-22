// READ-ONLY: Bookings list (tabs, search) and the detail of a CANCELLED QA booking: Payments & summary, History,
// Documents, Modify booking, Add service, Who's on what. Every save is BLOCKED.
//   node scripts/probes/booking-pages.mjs 9
import { chromium } from '@playwright/test';
import fs from 'fs';
const B2B = (process.env.B2B_URL || 'https://b2b.nexgenpilot.com').replace(/\/$/, '');
const id = process.argv[2] ?? '9';
const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: 'playwright/.auth/b2b.json', viewport: { width: 1500, height: 950 }, acceptDownloads: true });
const blocked = [];
await ctx.route('**/*', r => { const q = r.request(); if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(q.method()) && !/search|quote$|preview|auth|refresh/i.test(new URL(q.url()).pathname)) { blocked.push(`${q.method()} ${new URL(q.url()).pathname}`); return r.abort(); } return r.continue(); });
const page = await ctx.newPage();
const failed = []; page.on('response', r => { if (r.status() >= 400 && /nexgenpilot|runasp/.test(r.url())) failed.push(`${r.status()} ${new URL(r.url()).pathname}`); });
fs.mkdirSync('screenshots/bookings', { recursive: true });
const text = async (sel = 'body') => (await page.locator(sel).last().innerText().catch(() => '')).replace(/[\s​]+/g, ' ');
const main = async () => (await text()).split('Keep open')[1] ?? '';
const log = (k, v) => console.log(`## ${k}: ${typeof v === 'string' ? v.slice(0, 1500) : JSON.stringify(v)}`);
// list: tabs + search
await page.goto(`${B2B}/bookings`); await page.waitForTimeout(4000);
for (const tab of ['Upcoming', 'Past', 'Cancelled', 'All']) { await page.getByRole('button', { name: new RegExp(`^${tab}`) }).first().click().catch(() => {}); await page.waitForTimeout(1500); log(`list tab ${tab}`, (await main()).replace(/.*All \d+/, '').slice(0, 300)); }
await page.getByPlaceholder(/Search reference/).fill('QA Lead'); await page.waitForTimeout(2500); log('search "QA Lead"', (await main()).replace(/.*All \d+/, '').slice(0, 300));
await page.getByPlaceholder(/Search reference/).fill('zzzz-none'); await page.waitForTimeout(2500); log('search no match', (await main()).replace(/.*All \d+/, '').slice(0, 200));
await page.screenshot({ path: 'screenshots/bookings/list-search-none.png' });
// detail
await page.goto(`${B2B}/bookings/${id}`); await page.waitForTimeout(5000);
await page.screenshot({ path: 'screenshots/bookings/detail.png', fullPage: true });
log('detail', await main());
log('detail buttons', [...new Set((await page.locator('button:visible').allInnerTexts()).map(s => s.replace(/\s+/g, ' ').trim()).filter(s => s && s.length < 40))].slice(19));
for (const b of ['Payments & summary', 'History', 'Documents', "Who's on what", 'Cancellation & details', 'Modify booking', 'Add service', 'Cancel booking']) {
  const btn = page.getByRole('button', { name: b, exact: true }).first();
  const en = await btn.isEnabled().catch(() => null);
  if (!en) { log(`${b}`, en === null ? 'NOT SHOWN' : 'DISABLED'); continue; }
  await btn.click(); await page.waitForTimeout(3000);
  const dlg = page.locator('[role=dialog], [role=presentation] .MuiDrawer-paper, .MuiPopover-paper, [role=menu]').last();
  const t = (await dlg.count()) ? await text('[role=dialog], .MuiDrawer-paper, .MuiPopover-paper, [role=menu]') : await main();
  await page.screenshot({ path: `screenshots/bookings/${b.replace(/\W+/g, '_')}.png`, fullPage: true });
  log(b, t);
  await page.keyboard.press('Escape'); await page.waitForTimeout(800);
  if (!page.url().endsWith(`/bookings/${id}`)) { await page.goto(`${B2B}/bookings/${id}`); await page.waitForTimeout(3500); }
}
log('failed calls', [...new Set(failed)]); log('blocked writes', [...new Set(blocked)]);
await browser.close();
