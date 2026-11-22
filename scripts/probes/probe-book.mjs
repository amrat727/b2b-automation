// READ-ONLY walk of the hotel booking flow (saved QA agent session): search 60 days ahead -> hotel -> rooms -> select a
// room -> guest / payment screens. The final BOOK call is BLOCKED (only searches / reads / price checks go through).
//   node scripts/probes/probe-book.mjs [step-limit]
import { chromium } from '@playwright/test';
import fs from 'fs';
const B2B = (process.env.B2B_URL || 'https://b2b.nexgenpilot.com').replace(/\/$/, '');
const HOTEL = 'Marina Bay Hotel';
const IN = new Date(Date.now() + 60 * 864e5), OUT = new Date(IN.getTime() + 3 * 864e5);
const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: 'playwright/.auth/b2b.json', viewport: { width: 1500, height: 950 } });
const calls = [], blocked = [];
await ctx.route('**/*', r => {
  const q = r.request(); if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(q.method())) return r.continue();
  const p = new URL(q.url()).pathname; calls.push(`${q.method()} ${p} ${(q.postData() || '').slice(0, 160)}`);
  if (/search|details|availability|rooms?|price|reprice|check|quote|negotiate|auth|refresh|cart/i.test(p) && !/book|confirm|reserve|order|pay|checkout\/(complete|confirm)/i.test(p)) return r.continue();
  blocked.push(`${q.method()} ${p}`); return r.abort();
});
const page = await ctx.newPage();
fs.mkdirSync('screenshots/book', { recursive: true });
let n = 0; const shot = async name => page.screenshot({ path: `screenshots/book/${String(++n).padStart(2, '0')}-${name}.png` });
const text = async () => (await page.locator('body').innerText()).replace(/[\s​]+/g, ' ');
const btns = async () => [...new Set((await page.locator('button:visible').allInnerTexts()).map(s => s.replace(/\s+/g, ' ').trim()).filter(s => s && s.length < 40))];
const months = d => d.toLocaleString('en-US', { month: 'long', year: 'numeric' });

await page.goto(`${B2B}/search/hotel`);
await page.getByPlaceholder('Search city').waitFor({ timeout: 60000 });
await page.getByPlaceholder('Search city').pressSequentially('Dubai', { delay: 80 });
await page.getByRole('option', { name: 'Dubai', exact: true }).click();
await page.getByPlaceholder('Check-in – Check-out').click();
const pick = async d => {
  for (let i = 0; i < 6 && !(await page.getByText(months(d), { exact: true }).isVisible().catch(() => false)); i++) await page.getByRole('button', { name: /next month/i }).click().catch(() => page.locator('[aria-label*="next" i]').first().click());
  await page.getByRole('gridcell', { name: String(d.getDate()), exact: true }).first().click();
};
await pick(IN); await page.waitForTimeout(500); await pick(OUT);
await page.keyboard.press('Escape');
console.log('dates field:', await page.getByPlaceholder('Check-in – Check-out').inputValue());
await page.getByRole('button', { name: 'Search hotels' }).click();
await page.getByText(HOTEL).first().waitFor({ timeout: 60000 }); await page.waitForTimeout(2000);
await shot('results');
const card = page.locator('div').filter({ hasText: HOTEL }).filter({ has: page.getByRole('button', { name: /See \d+ rooms/ }) }).last();
console.log('card:', (await card.innerText()).replace(/\s+/g, ' ').slice(0, 250));
await card.getByRole('button', { name: /See \d+ rooms/ }).click();
await page.waitForTimeout(6000); await shot('rooms');
console.log('rooms url:', page.url()); console.log('rooms text:', (await text()).split('Rooms (')[1]?.slice(0, 2500) ?? (await text()).slice(-2500));
console.log('rooms buttons:', JSON.stringify(await btns()));
const select = page.getByRole('button', { name: 'Book', exact: true }).first();   // the room's own Book button (Select = add to cart)
if (await select.isVisible().catch(() => false)) {
  console.log('clicking:', await select.innerText());
  await select.click(); await page.waitForTimeout(6000); await shot('after-select');
  console.log('after select url:', page.url()); console.log('after select text:', (await text()).slice(0, 3000));
  console.log('inputs:', JSON.stringify(await page.locator('input:visible, select:visible, textarea:visible').evaluateAll(es => es.map(e => [e.type, e.name, e.placeholder, e.getAttribute('aria-label')].filter(Boolean).join('|')))));
  console.log('buttons:', JSON.stringify(await btns()));
}
if (page.url().includes('/checkout')) {
  // empty form: press Pay (the pay / book call is BLOCKED) and read what the page says
  await page.getByRole('button', { name: /^Pay / }).click().catch(e => console.log('pay click:', String(e).split('\n')[0]));
  await page.waitForTimeout(2500); await shot('checkout-empty-pay');
  const msgs = [...new Set((await page.locator('.MuiFormHelperText-root, [role=alert], .Mui-error, [class*=error]:visible').allInnerTexts()).map(x => x.replace(/\s+/g, ' ').trim()).filter(Boolean))];
  console.log('empty pay messages:', JSON.stringify(msgs));
  console.log('pay button enabled:', await page.getByRole('button', { name: /^Pay / }).isEnabled());
  await page.getByRole('button', { name: 'Cancellation & details' }).click().catch(() => {}); await page.waitForTimeout(1500); await shot('checkout-cancellation');
  console.log('cancellation panel:', (await page.locator('[role=dialog], [class*=drawer], [class*=Popover]').last().innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 800));
}
console.log('calls:', calls.join('\n  '));
console.log('blocked:', blocked.join(' ; '));
await browser.close();
