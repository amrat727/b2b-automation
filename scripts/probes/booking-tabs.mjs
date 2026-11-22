// READ-ONLY: Payments & summary, History and two documents (View only) of one QA booking. Saves / e-mails BLOCKED.
//   node scripts/probes/booking-tabs.mjs 9
import { chromium } from '@playwright/test';
import fs from 'fs';
const B2B = (process.env.B2B_URL || 'https://b2b.nexgenpilot.com').replace(/\/$/, '');
const id = process.argv[2] ?? '9';
const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: 'playwright/.auth/b2b.json', viewport: { width: 1500, height: 950 } });
await ctx.route('**/*', r => { const q = r.request(); return ['POST', 'PUT', 'DELETE', 'PATCH'].includes(q.method()) && !/search|preview|render|auth|refresh/i.test(new URL(q.url()).pathname) ? r.abort() : r.continue(); });
const page = await ctx.newPage();
fs.mkdirSync('screenshots/bookings', { recursive: true });
const t = async sel => (await page.locator(sel).last().innerText().catch(() => '')).replace(/[\s​]+/g, ' ');
await page.goto(`${B2B}/bookings/${id}`); await page.waitForTimeout(5000);
for (const name of [/^Payments & summary/, /^History/]) {
  await page.getByRole('button', { name }).first().click(); await page.waitForTimeout(2500);
  await page.screenshot({ path: `screenshots/bookings/${String(name).replace(/\W+/g, '_')}.png`, fullPage: true });
  console.log('##', String(name), await t('[role=dialog]'));
  await page.locator('[role=dialog]').last().getByRole('button', { name: 'Close', exact: true }).click().catch(() => page.keyboard.press('Escape')); await page.waitForTimeout(800);
}
for (const doc of ['Booking confirmation', 'Credit note', 'Agent invoice']) {
  await page.goto(`${B2B}/bookings/${id}`); await page.waitForTimeout(3500);
  await page.getByRole('button', { name: 'Documents', exact: true }).click(); await page.waitForTimeout(1500);
  const dlg = page.locator('[role=dialog]').last();
  await dlg.getByText(doc, { exact: true }).click(); await page.waitForTimeout(800);
  const [popup] = await Promise.all([page.waitForEvent('popup', { timeout: 15000 }).catch(() => null), dlg.getByRole('button', { name: 'View', exact: true }).click()]);
  await page.waitForTimeout(5000);
  const target = popup ?? page;
  await target.waitForLoadState().catch(() => {});
  await target.screenshot({ path: `screenshots/bookings/doc-${doc.replace(/\W+/g, '_')}.png`, fullPage: true });
  console.log('## DOC', doc, '|', popup ? 'popup ' + popup.url().slice(0, 80) : 'same page', '|', (await target.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 900));
  if (popup) await popup.close();
}
await browser.close();
