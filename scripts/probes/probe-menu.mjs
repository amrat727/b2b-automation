// READ-ONLY: click every B2B portal menu item, print its address, heading and main buttons. Writes are BLOCKED.
import { chromium } from '@playwright/test';
const B2B = (process.env.B2B_URL || 'https://b2b.nexgenpilot.com').replace(/\/$/, '');
const MENU = ['Home', 'Search & book', 'Bookings', 'Trip builder', 'Quotations', 'My quotations', 'Package builder', 'Savings', 'AI assistant', 'Disruptions', 'Wallet & credit', 'Reports', 'Sub-agents', 'Markup', 'Markup earnings', 'Users'];
const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: 'playwright/.auth/b2b.json', viewport: { width: 1500, height: 950 } });
await ctx.route('**/*', r => ['POST', 'PUT', 'DELETE', 'PATCH'].includes(r.request().method()) && !/search|auth|refresh|negotiate|details/i.test(r.request().url()) ? r.abort() : r.continue());
const page = await ctx.newPage();
for (const m of MENU) {
  await page.goto(B2B + '/'); await page.waitForTimeout(2500);
  const item = page.getByRole('link', { name: m, exact: true }).or(page.getByRole('button', { name: m, exact: true })).or(page.getByText(m, { exact: true })).first();
  await item.click({ timeout: 10000 }).catch(e => console.log('  cannot click', m));
  await page.waitForTimeout(3500);
  const h = (await page.locator('h1, h2, h3').allInnerTexts().catch(() => [])).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 3).join(' / ');
  const btns = [...new Set((await page.locator('button:visible').allInnerTexts()).map(s => s.replace(/\s+/g, ' ').trim()).filter(s => s && s.length < 30))].filter(b => !MENU.includes(b) && !/^Wallet|^Q |^\d+$|Keep open|^Flights$|^Hotels$/.test(b)).slice(0, 10);
  console.log(`${m.padEnd(16)} | ${page.url().replace(B2B, '').padEnd(28)} | ${h.slice(0, 70)} | ${btns.join(', ')}`);
}
await browser.close();
