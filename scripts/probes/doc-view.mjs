// READ-ONLY check: what does Documents > View send? Logs every request after clicking View (writes logged, NOT blocked
// only for document GET/preview calls; any other write is blocked).   node scripts/probes/doc-view.mjs 9 "Booking confirmation"
import { chromium } from '@playwright/test';
const B2B = (process.env.B2B_URL || 'https://b2b.nexgenpilot.com').replace(/\/$/, '');
const [id = '9', doc = 'Booking confirmation'] = process.argv.slice(2);
const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: 'playwright/.auth/b2b.json', viewport: { width: 1500, height: 950 } });
const seen = [];
await ctx.route('**/*', r => { const q = r.request(); const p = new URL(q.url()).pathname;
  if (/nexgenpilot|runasp/.test(q.url()) && !/\.(js|css|png|svg|woff2?)$/.test(p)) seen.push(`${q.method()} ${p}`);
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(q.method()) && !/document|render|preview|pdf/i.test(p)) return r.abort();
  return r.continue(); });
const page = await ctx.newPage();
page.on('response', r => { if (/document|render|pdf|preview/i.test(r.url())) console.log('RESPONSE', r.status(), r.request().method(), new URL(r.url()).pathname, r.headers()['content-type']); });
await page.goto(`${B2B}/bookings/${id}`); await page.waitForTimeout(5000);
await page.getByRole('button', { name: 'Documents', exact: true }).click(); await page.waitForTimeout(1500);
const dlg = page.locator('[role=dialog]').last();
await dlg.getByText(doc, { exact: true }).click(); await page.waitForTimeout(800);
seen.length = 0;
const popup = page.waitForEvent('popup', { timeout: 20000 }).catch(() => null);
await dlg.getByRole('button', { name: 'View', exact: true }).click();
const p = await popup; await page.waitForTimeout(6000);
console.log('popup:', p ? p.url().slice(0, 120) : 'none');
console.log('requests after View:', [...new Set(seen)].join(' | '));
console.log('dialog now:', (await page.locator('[role=dialog]').last().innerText().catch(() => '(no dialog)')).replace(/\s+/g, ' ').slice(0, 400));
await page.screenshot({ path: 'screenshots/bookings/doc-view-click.png', fullPage: true });
await browser.close();
