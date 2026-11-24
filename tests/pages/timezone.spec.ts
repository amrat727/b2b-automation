import { test, expect, Browser } from '@playwright/test';
import { SESSION } from '../../env';
import { clean } from '../helpers';

/*
 * Time zone. Product owner (Q-13, 22 Nov 2026): every date / time follows the ERP COMPANY time zone - never the
 * viewer's computer. READ-ONLY: the same Wallet & credit transactions and Bookings list are opened from two
 * browsers set to very different time zones (India +5:30 and Kiritimati +14) - what they show must be identical.
 */
async function read(browser: Browser, timezoneId: string) {
  const ctx = await browser.newContext({ storageState: SESSION, timezoneId });
  const page = await ctx.newPage();
  await page.goto('/finance');
  // transaction lines carry "<day> <Mon> <year> <hh:mm>", e.g. "22 Nov 2026 03:39"
  const STAMP = /\b\d{1,2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}\b/g;
  await expect.poll(async () => (clean(await page.locator('body').innerText()).match(STAMP) ?? []).length, { timeout: 60_000 }).toBeGreaterThan(0);
  const stamps = (clean(await page.locator('body').innerText()).match(STAMP) ?? []).slice(0, 5);
  await page.goto('/bookings');
  await page.waitForTimeout(8_000);   // the list may be empty (every QA booking is cancelled) - then only the Wallet times are compared
  const booked = (clean(await page.locator('body').innerText()).match(/#\d{6} Booked \d{1,2} [A-Z][a-z]{2}/g) ?? []).slice(0, 5);
  await ctx.close();
  return { stamps, booked };
}

test('TC-TZ-01: dates and times do not change with the viewer\'s time zone (company time zone)', async ({ browser }) => {
  test.fail(true, 'B2B-005 (PB2B-21): Wallet times follow the viewer\'s computer clock (and Bookings show another day) - product owner: company time zone');
  const india = await read(browser, 'Asia/Kolkata');
  const kiritimati = await read(browser, 'Pacific/Kiritimati');
  test.info().annotations.push({ type: 'Asia/Kolkata', description: JSON.stringify(india) }, { type: 'Pacific/Kiritimati', description: JSON.stringify(kiritimati) });
  expect(kiritimati.stamps, 'Wallet & credit transaction times').toEqual(india.stamps);
  expect(kiritimati.booked, 'Bookings "Booked" dates').toEqual(india.booked);
});
