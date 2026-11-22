import { test, expect } from '@playwright/test';
import { blockWrites, pageText, searchHotels } from '../helpers';

/*
 * Search & Book - one search per product. READ-ONLY (only searches go through, every save is blocked).
 * Hotel prices are checked against the QA contract of Marina Bay Hotel (rate 720 Twin, sell = rate x 1.2,
 * early bird 15 % for 21+ days ahead, half board +140 / full board +260 per adult per night).
 */
const IN = new Date(Date.now() + 60 * 864e5);
const OUT = new Date(IN.getTime() + 3 * 864e5);

test.describe('Search & Book', () => {
  test.beforeEach(async ({ page }) => { await blockWrites(page); });

  test('TC-SRCH-01: Hotels - Marina Bay Hotel 3 nights, 60 days ahead: prices follow the contract incl. early bird', async ({ page }) => {
    await searchHotels(page, IN, OUT);
    await expect(page.getByText('Marina Bay Hotel').first()).toBeVisible({ timeout: 60_000 });
    const card = page.locator('div').filter({ hasText: 'Marina Bay Hotel' }).filter({ has: page.getByRole('button', { name: /See \d+ rooms/ }) }).last();
    await card.getByRole('button', { name: /See \d+ rooms/ }).click();
    const t = await expect.poll(() => pageText(page), { timeout: 30_000 }).toMatch(/Deluxe Room Marina View – Twin Breakfast/).then(() => pageText(page));
    // breakfast: 720 x 1.2 x 3 = 2,592.00, early bird 15 % = 388.80 -> 2,203.20
    expect(t).toMatch(/Twin Breakfast.*?AED 2,592\.00 Save AED 388\.80 AED 2,203\.20/);
    // half board: (720 + 2 x 140) x 1.2 x 3 = 3,600.00, early bird on the room only -> 3,211.20
    expect(t).toMatch(/Twin Half board.*?AED 3,600\.00 Save AED 388\.80 AED 3,211\.20/);
    // full board: (720 + 2 x 260) x 1.2 x 3 = 4,464.00 -> 4,075.20
    expect(t).toMatch(/Twin Full board.*?AED 4,464\.00 Save AED 388\.80 AED 4,075\.20/);
    // free cancellation until 15 days before check-in
    const freeUntil = new Date(IN.getTime() - 15 * 864e5).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    expect(t).toContain(`Free cancellation until ${freeUntil}`);
  });

  test('TC-SRCH-02: Activities - Dubai returns contracted activities with prices', async ({ page }) => {
    await page.goto('/search/activity');
    const box = page.getByPlaceholder('Enter destination');
    await box.click(); await box.pressSequentially('Dubai', { delay: 60 });
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: 'Search activities' }).click();
    await expect.poll(() => pageText(page), { timeout: 60_000 }).toMatch(/\d+ activities available/);
    expect(await pageText(page)).toMatch(/Dubai City Tour.*From AED [\d,.]+/);
  });

  test('TC-SRCH-03: Transfers - Dubai returns transfers with prices', async ({ page }) => {
    await page.goto('/search/transfers');
    const box = page.getByPlaceholder('Search city');
    await box.click(); await box.pressSequentially('Dubai', { delay: 60 });
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: 'Search transfers' }).click();
    await expect.poll(() => pageText(page), { timeout: 60_000 }).toMatch(/\d+ transfers available/);
  });

  test('TC-SRCH-04: Flights - Dubai -> Delhi returns fares', async ({ page }) => {
    test.fail(true, 'B2B-009 (PB2B-25): flight search always fails - "The supplier couldn\'t complete this request" (502)');
    test.setTimeout(150_000);
    await page.goto('/search/flight');
    for (const [ph, v] of [['Enter origin', 'Dubai'], ['Enter destination', 'Delhi']]) {
      const box = page.getByPlaceholder(ph); await box.click(); await box.pressSequentially(v, { delay: 60 }); await page.getByRole('option').first().click();
    }
    await page.getByRole('button', { name: 'Search flights' }).click();
    await expect.poll(() => pageText(page), { timeout: 100_000 }).toMatch(/\d+ (flights|fares|results) |couldn't complete/);
    expect(await pageText(page)).not.toContain("couldn't complete this request");
  });

  test('TC-SRCH-05: Search forms tell which required field is missing', async ({ page }) => {
    await page.goto('/search/flight');
    await page.getByRole('button', { name: 'Search flights' }).click();
    await expect(page.getByText('Origin is required')).toBeVisible();
    await expect(page.getByText('Destination is required')).toBeVisible();
  });

  test('TC-SRCH-06: Rail / Cruise tabs are only offered when they can be booked', async ({ page }) => {
    test.fail(true, 'B2B-010 (PB2B-26): Rail and Cruise are offered (tabs, tiles, sponsored deals) but "booking isn\'t connected yet"');
    await page.goto('/search/rail');
    for (const [ph, v] of [['Station or city, e.g. London', 'London'], ['Station or city, e.g. Paris', 'Paris']]) {
      const box = page.getByPlaceholder(ph); await box.click(); await box.pressSequentially(v, { delay: 60 });
      await page.getByRole('option').first().click({ timeout: 5_000 }).catch(() => {});
    }
    await page.getByRole('button', { name: 'Search rail' }).click();
    // wait until the live search has finished (results or the "not connected" notice), then judge
    await expect.poll(() => pageText(page), { timeout: 90_000 }).toMatch(/isn't connected yet|\d+ (journeys|trains|results|options)/);
    expect(await pageText(page)).not.toContain("Rail booking isn't connected yet");
  });
});
