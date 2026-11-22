import { test, expect } from '@playwright/test';
import { blockWrites, pageText } from '../helpers';

/*
 * Every portal module opens for the QA agent: right address, its title, no browser error, no failed server call,
 * and its empty state / main action. READ-ONLY (every save is blocked).
 */
const PAGES: [string, string, RegExp, RegExp][] = [
  // [module, path, title text, something that must be on the page]
  ['Home', '/', /Good (morning|afternoon|evening), QA/, /Start a booking/],
  ['Bookings', '/bookings', /Bookings/, /Upcoming \d+.*Past \d+.*Cancelled \d+.*All \d+/],
  ['Trip builder', '/trip', /Trip builder/, /products in this trip/],
  ['Quotations from our team', '/quotes', /Quotations from our team/, /From our team \(\d+\)/],
  ['My quotations', '/quotations', /My quotations/, /New quotation/],
  ['Package builder', '/packages', /Package builder|Build package/, /Build package/],
  ['Savings', '/savings', /Savings/, /Bookings monitored/],
  ['AI assistant', '/assistant', /AI assistant/, /assistant/i],
  ['Disruptions', '/disruptions', /Disruptions/, /Open.*Chosen.*Closed.*All/],
  ['Wallet & credit', '/finance', /Wallet & credit/, /Credit line.*Available AED/],
  ['Reports', '/finance/reports', /Wallet & credit/, /Product-line performance/],
  ['Sub-agents', '/business/subagents', /Sub-agents/, /Add sub-agent/],
  ['Markup', '/business/markup', /Markup/, /All products/],
  ['Markup earnings', '/business/earnings', /Markup earnings/, /This month.*Last 30 days/],
  ['Users', '/business/users', /Users/, /QA Auto B2B Agent \(you\)/],
  ['Profile', '/profile', /QA Auto B2B Agent/, /Agent ID/],
];

test.describe('Portal pages', () => {
  for (const [name, path, title, must] of PAGES) {
    test(`TC-PAGE-${name.replace(/\W+/g, '')}: ${name} opens (${path}) with its content, no errors`, async ({ page }) => {
      await blockWrites(page);
      const errors: string[] = []; const failed: string[] = [];
      page.on('pageerror', e => errors.push(String(e)));
      page.on('response', r => { if (r.status() >= 400 && /nexgenpilot|runasp/.test(r.url())) failed.push(`${r.status()} ${new URL(r.url()).pathname}`); });
      await page.goto(path);
      await expect.poll(() => pageText(page), { timeout: 60_000 }).toMatch(title);
      await expect.poll(() => pageText(page)).toMatch(must);
      expect(errors, 'browser errors').toEqual([]);
      expect(failed, 'failed server calls').toEqual([]);
    });
  }

  test('TC-PAGE-HEADING: the module page title is a heading', async ({ page }) => {
    // (B2B-008 / PB2B-24 was withdrawn: titles are <h5> headings - the first sweep only looked for h1-h4)
    await page.goto('/bookings');
    await expect(page.getByRole('heading', { name: 'Bookings' })).toBeVisible({ timeout: 30_000 });
  });

  test('TC-PAGE-SEARCH: global search finds bookings and says when nothing matches', async ({ page }) => {
    await page.goto('/');
    const box = page.getByPlaceholder(/Search bookings, PNR/);
    await box.fill('zzqqxx');
    await expect(page.getByText(/No bookings, quotes or destinations match/)).toBeVisible({ timeout: 30_000 });
  });
});
