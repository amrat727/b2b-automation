// READ-ONLY: hotel search in the B2B portal with the saved QA agent session. Writes are BLOCKED except searches.
// Fills city + dates, searches, prints the result cards, then (optional) opens a hotel and prints its rooms.
//   node scripts/probes/probe-search.mjs "Dubai" "Marina Bay Hotel"
import { chromium } from '@playwright/test';
import fs from 'fs';
const B2B = (process.env.B2B_URL || 'https://b2b.nexgenpilot.com').replace(/\/$/, '');
const [city = 'Dubai', hotel = ''] = process.argv.slice(2);
const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: 'playwright/.auth/b2b.json', viewport: { width: 1500, height: 950 } });
const blocked = [], calls = [];
await ctx.route('**/*', r => {
  const q = r.request();
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(q.method())) {
    calls.push(`${q.method()} ${q.url().replace(/^https:\/\/[^/]+/, '')}`);
    if (!/search|negotiate|auth|login|refresh|availability|autocomplete|suggest|lookup|rates?\b|price/i.test(q.url())) { blocked.push(calls.at(-1)); return r.abort(); }
  }
  return r.continue();
});
const page = await ctx.newPage();
const shot = async n => { fs.mkdirSync('screenshots', { recursive: true }); await page.screenshot({ path: `screenshots/probe-${n}.png` }); };
const visible = async () => (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
await page.goto(`${B2B}/search/hotel`);
await page.getByPlaceholder('Search city').waitFor({ timeout: 60000 });
await page.getByPlaceholder('Search city').click();
await page.getByPlaceholder('Search city').pressSequentially(city, { delay: 80 });
await page.waitForTimeout(2500);
const opts = await page.getByRole('option').allInnerTexts();
console.log('city options:', JSON.stringify(opts.slice(0, 8)));
await page.getByRole('option').first().click().catch(() => page.keyboard.press('Enter'));
// dates: open the picker and read it (60 days ahead, 3 nights is what the test will pick)
await page.getByPlaceholder('Check-in – Check-out').click();
await page.waitForTimeout(1500);
await shot('datepicker');
console.log('date picker texts:', (await page.locator('[role=dialog], .MuiPickersPopper-root, [class*=picker], [class*=calendar]').first().innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 400));
await page.keyboard.press('Escape');
await page.getByRole('button', { name: 'Search hotels' }).click();
await page.waitForTimeout(12000);
await shot('results');
console.log('results url:', page.url());
console.log('results text:', (await visible()).slice(0, 2500));
if (hotel) {
  const card = page.getByText(hotel, { exact: false }).first();
  console.log('hotel found:', await card.count());
  if (await card.count()) { await card.click(); await page.waitForTimeout(8000); await shot('hotel'); console.log('hotel url:', page.url()); console.log('hotel text:', (await visible()).slice(0, 3000)); }
}
console.log('writes seen:', calls.slice(0, 10).join(' ; '));
console.log('blocked:', blocked.length, blocked.slice(0, 5).join(' ; '));
await browser.close();
