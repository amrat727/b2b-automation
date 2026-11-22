// Cancels ONE QA booking in the B2B portal (only if its lead traveller starts with "QA" or its reference matches) and
// records the cancel dialog, the status and the money afterwards.
//   node scripts/probes/cancel-booking.mjs "#000009"
import { chromium } from '@playwright/test';
import fs from 'fs';
const B2B = (process.env.B2B_URL || 'https://b2b.nexgenpilot.com').replace(/\/$/, '');
const ref = process.argv[2];
if (!ref) throw new Error('booking reference needed, e.g. "#000009"');
const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: 'playwright/.auth/b2b.json', viewport: { width: 1500, height: 950 } });
const page = await ctx.newPage();
const calls = [];
page.on('response', async r => { const q = r.request(); if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(q.method()) && /nexgenpilot|runasp/.test(r.url())) calls.push(`${r.status()} ${q.method()} ${new URL(r.url()).pathname} ${(await r.text().catch(() => '')).slice(0, 300)}`); });
fs.mkdirSync('screenshots/journey', { recursive: true });
let n = 20; const shot = async name => page.screenshot({ path: `screenshots/journey/${++n}-${name}.png`, fullPage: true });
const text = async () => (await page.locator('body').innerText()).replace(/[\s​]+/g, ' ');
const log = (k, v) => console.log(`${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`);

await page.goto(`${B2B}/bookings`); await page.waitForTimeout(5000);
// the list is not a table: take the smallest block that holds the booking number AND a lead traveller
const row = page.locator('div, li, tr, a').filter({ hasText: ref }).filter({ hasText: /Mr |Mrs |Ms / }).last();
const rowText = (await row.innerText().catch(() => '')).replace(/\s+/g, ' ');
log('row', rowText);
if (!/QA /.test(rowText)) throw new Error('not a QA booking - not touched');
await row.click(); await page.waitForTimeout(5000); await shot('booking-detail');
log('detail url', page.url()); log('detail text', (await text()).split('Keep open')[1]?.slice(0, 3000));
const btns = [...new Set((await page.locator('button:visible, a:visible').allInnerTexts()).map(s => s.replace(/\s+/g, ' ').trim()).filter(s => s && s.length < 40))];
log('detail buttons', btns.slice(18));
const cancel = page.getByRole('button', { name: /^Cancel/ }).filter({ hasNotText: /^Cancelled/ }).first();
if (!(await cancel.isVisible().catch(() => false))) { await page.getByRole('button', { name: /More|Actions|Manage/ }).first().click().catch(() => {}); await page.waitForTimeout(1000); }
const c2 = page.getByRole('button', { name: /^Cancel/ }).or(page.getByRole('menuitem', { name: /^Cancel/ })).filter({ hasNotText: /^Cancelled/ }).first();
log('cancel control', await c2.innerText().catch(() => 'NONE'));
await c2.click(); await page.waitForTimeout(3000); await shot('cancel-dialog');
const dlg = page.locator('[role=dialog]').last();
log('cancel dialog', (await dlg.innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 1500));
log('dialog buttons', await dlg.getByRole('button').allInnerTexts().catch(() => []));
await dlg.getByRole('checkbox', { name: /I accept cancellation charges/ }).check();
await dlg.getByRole('button', { name: 'Accept charges and cancel', exact: true }).click(); await page.waitForTimeout(10000); await shot('after-cancel');
log('after cancel', (await text()).split('Keep open')[1]?.slice(0, 2000));
await page.goto(`${B2B}/finance`); await page.waitForTimeout(5000); await shot('finance-after-cancel');
log('finance after cancel', (await text()).split('Keep open')[1]?.slice(0, 1200));
await page.goto(`${B2B}/bookings`); await page.waitForTimeout(4000);
log('bookings after cancel', (await text()).split('Keep open')[1]?.slice(0, 800));
console.log('calls:\n  ' + calls.join('\n  '));
await browser.close();
