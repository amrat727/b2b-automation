import { test, expect, Page } from '@playwright/test';
import { creditAvailable, money, pageText, searchHotels, stamp } from '../helpers';

/*
 * END-TO-END hotel booking on the CREDIT LINE - REAL QA booking, cancelled at the end (free-cancellation window).
 *   search Marina Bay Hotel 60 days ahead -> Book -> checkout (QA guests) -> pay from credit line -> confirmation
 *   -> booking in the list -> credit used + transaction -> cancel (charge 0) -> credit restored + refund -> status Cancelled
 * Guests / reference "QA Auto <LETTERS>", e-mail example.com. afterAll cancels the booking if a step failed.
 */
const S = stamp();
const IN = new Date(Date.now() + 60 * 864e5);
const OUT = new Date(IN.getTime() + 3 * 864e5);
const PRICE = 2203.2;                               // Twin breakfast 3 nights incl. early bird (see search.spec)

test.describe.configure({ mode: 'serial' });
test.describe('Booking journey - hotel on credit line', () => {
  let page: Page;
  let creditBefore = 0;
  let bookingNo = '';       // "#000010"
  let confirmation = '';    // "PH2611..-XXXXXX"
  let bookingUrl = '';
  let listReloads = -1, statusReloads = -1;   // reloads needed before the list / the status was up to date (B2B-019 / B2B-020)

  test.beforeAll(async ({ browser }) => { page = await browser.newPage(); });
  test.afterAll(async () => {
    test.setTimeout(400_000);
    // cleanup: a booking of this run that is still confirmed gets cancelled - found by its QA guest name if a step failed early.
    // Retried, because the network can drop for a minute (seen 22 Nov 2026).
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        if (!bookingUrl && confirmation) {
          await page.goto('/bookings');
          const mine = page.getByText(`Mr QA Lead Auto ${S}`).first();
          for (let i = 0; i < 12 && !(await mine.isVisible({ timeout: 5_000 }).catch(() => false)); i++) await page.reload();
          if (await mine.isVisible().catch(() => false)) { await mine.click(); await page.waitForURL(/\/bookings\/\d+/); bookingUrl = page.url(); }
        }
        if (bookingUrl) {
          await page.goto(bookingUrl);
          const cancel = page.getByRole('button', { name: 'Cancel booking', exact: true });
          if (await cancel.isEnabled({ timeout: 30_000 }).catch(() => false)) {
            await cancel.click();
            const dlg = page.locator('[role=dialog]').last();
            await dlg.getByRole('checkbox', { name: /I accept cancellation charges/ }).check();
            // wait for the server to confirm the cancellation (the dialog says "Cancelled now when you confirm" BEFORE confirming)
            const [res] = await Promise.all([
              page.waitForResponse(r => /\/cancellations\/\d+\/confirm/.test(r.url()) && r.request().method() === 'POST', { timeout: 60_000 }),
              dlg.getByRole('button', { name: 'Accept charges and cancel', exact: true }).click(),
            ]);
            if (!res.ok()) throw new Error(`cancel confirm answered ${res.status()}`);
          }
          // verify: the booking really is cancelled now
          await page.goto(bookingUrl);
          await expect.poll(async () => (await pageText(page)).match(/(Cancelled|Confirmed) #\d{6}/)?.[1], { timeout: 60_000 }).toBe('Cancelled');
          console.log(`cleanup: booking of run ${S} is cancelled`);
        }
        break;
      } catch (e) { console.log(`cleanup attempt ${attempt} failed: ${String(e).split('\n')[0]}`); await page.waitForTimeout(20_000); }
    }
    await page.close();
  });

  test('TC-BOOK-01: credit available is read before booking', async () => {
    creditBefore = await creditAvailable(page);
    expect(creditBefore).toBeGreaterThan(PRICE);
  });

  test('TC-BOOK-02: search -> Book opens checkout with the hotel and the price', async () => {
    await searchHotels(page, IN, OUT);
    const card = page.locator('div').filter({ hasText: 'Marina Bay Hotel' }).filter({ has: page.getByRole('button', { name: /See \d+ rooms/ }) }).last();
    await card.getByRole('button', { name: /See \d+ rooms/ }).click({ timeout: 60_000 });
    await page.getByRole('button', { name: 'Book', exact: true }).first().click();
    await page.waitForURL(/\/checkout/, { timeout: 60_000 });
    await expect.poll(() => pageText(page)).toMatch(/Marina Bay Hotel.*Deluxe Room Marina View – Twin/);
    expect(await pageText(page)).toContain('Pay now AED 2,203.20');
  });

  test('TC-BOOK-03: checkout - fill contact, reference and QA guests, accept terms', async () => {
    const f = (l: string) => page.getByLabel(new RegExp(`^${l}`)).first();
    await f('Email').fill(`qa.auto.b2b.${S.toLowerCase()}@example.com`);
    await f('Mobile').fill('501234567');
    await f('Your reference').fill(`QA Auto ${S}`);
    const titles = page.getByRole('combobox', { name: /^Title/ });
    for (let i = 0; i < await titles.count(); i++) { await titles.nth(i).click(); await page.getByRole('option', { name: 'Mr', exact: true }).click(); }
    const firsts = page.getByLabel(/^First name/), lasts = page.getByLabel(/^Last name/);
    for (let i = 0; i < await firsts.count(); i++) { await firsts.nth(i).fill(`QA ${['Lead', 'Guest'][i] ?? 'Extra'}`); await lasts.nth(i).fill(`Auto ${S}`); }
    await page.getByRole('checkbox', { name: 'I accept the booking terms' }).filter({ visible: true }).first().check();
    await expect(page.getByRole('button', { name: /^Pay AED 2,203\.20$/ })).toBeEnabled();
  });

  test('TC-BOOK-04: pay from the credit line -> "Booking confirmed" with a confirmation number', async () => {
    await page.getByRole('button', { name: /^Pay AED/ }).click();
    const fromCredit = page.getByRole('button', { name: /from credit line/i });
    await expect(fromCredit).toBeVisible({ timeout: 60_000 });          // second step "Secure payment" (room held with the supplier)
    expect(await pageText(page)).toMatch(/Held with the supplier/);
    await fromCredit.click();
    await expect(page.getByText('Booking confirmed')).toBeVisible({ timeout: 90_000 });
    confirmation = (await pageText(page)).match(/PH\d{6}-[A-Z0-9]{6}/)?.[0] ?? '';
    expect(confirmation, 'confirmation number').not.toBe('');
  });

  test('TC-BOOK-05: the booking is listed (Confirmed, AED 2,203.20, on credit line) and opens', async () => {
    test.setTimeout(300_000);
    await page.goto('/bookings');
    const name = page.getByText(`Mr QA Lead Auto ${S}`).first();
    // B2B-019: a just-confirmed booking is not in the list on the first load (and the list does not refresh) -> reload until it shows
    const t0 = Date.now(); let reloads = 0;
    while (!(await name.isVisible({ timeout: 5_000 }).catch(() => false)) && Date.now() - t0 < 180_000) { await page.waitForTimeout(5_000); await page.reload().catch(() => page.waitForTimeout(10_000)); reloads++; }   // a network blip must not fail the step
    listReloads = reloads;
    test.info().annotations.push({ type: 'B2B-019 list delay', description: `booking listed after ${reloads} reload(s), ${Math.round((Date.now() - t0) / 1000)} s` });
    await expect(name).toBeVisible({ timeout: 10_000 });
    // list row text: "21 Jan #000010 Booked 21 Nov Mr QA Lead Auto XXXXXX 2 adults 21 – 24 Jan 2027 ... Hotel Confirmed AED 2,203.20 On credit line"
    const rowText = (await pageText(page)).match(new RegExp(`#\\d{6} Booked [^#]*?Mr QA Lead Auto ${S}.*?On credit line`))?.[0] ?? '';
    bookingNo = rowText.match(/#\d{6}/)?.[0] ?? '';
    expect(bookingNo, 'booking number in the list').not.toBe('');
    expect(rowText).toMatch(/Confirmed AED 2,203\.20 On credit line/);
    await name.click();
    await page.waitForURL(/\/bookings\/\d+/, { timeout: 60_000 });
    bookingUrl = page.url();
    await expect.poll(() => pageText(page)).toContain(confirmation);
  });

  test('TC-BOOK-05b: the new booking is in the list straight away (no reload needed)', async () => {
    // product owner (Q-12, 22 Nov 2026): a new booking must show immediately
    test.fail(true, 'B2B-019 (PB2B-35): the new booking is missing from Bookings until the page is reloaded');
    expect(listReloads, 'reloads needed before the booking was listed').toBe(0);
  });

  test('TC-BOOK-06: credit available went down by the price and a charge transaction is listed', async () => {
    const after = await creditAvailable(page);
    expect(after).toBeCloseTo(creditBefore - PRICE, 2);
    // the transaction list loads after the balances
    await expect.poll(() => pageText(page), { timeout: 60_000 }).toMatch(/Marina Bay Hotel — Deluxe Room Marina View – Twin Credit Booking \S+ −AED 2,203\.20/);
  });

  test('TC-BOOK-07: the charge transaction names the booking (number / confirmation)', async () => {
    test.fail(true, 'B2B-004 (PB2B-20): the charge row shows "Booking chk_<n>" instead of the booking number');
    await page.goto('/finance');
    const row = page.locator('div').filter({ hasText: /−AED 2,203\.20/ }).filter({ hasText: 'Booking' }).last();
    await expect(row).toContainText(new RegExp(`${bookingNo.slice(1)}|${confirmation}`), { timeout: 30_000 });
  });

  test('TC-BOOK-08: cancel inside the free window - charge 0, refund 2,203.20, status Cancelled', async () => {
    test.setTimeout(300_000);
    await page.goto(bookingUrl);
    await page.getByRole('button', { name: 'Cancel booking', exact: true }).click({ timeout: 60_000 });
    const dlg = page.locator('[role=dialog]').last();
    // the dialog uses non-breaking spaces and a middle dot between the amounts -> tolerate any separator
    await expect(dlg).toContainText(/Charge\W{0,3}AED\W{0,3}0\.00\W{0,4}refund\W{0,3}AED\W{0,3}2,203\.20/);
    await dlg.getByRole('checkbox', { name: /I accept cancellation charges of AED 0\.00/ }).check();
    await dlg.getByRole('button', { name: 'Accept charges and cancel', exact: true }).click();
    await expect(dlg).toContainText("Cancelled — there's no cancellation charge; AED 2,203.20 is back in your account.", { timeout: 60_000 });
    // B2B-019: the booking page keeps showing "Confirmed" for a while after the cancellation -> reload until it updates
    const t0 = Date.now(); let reloads = 0;
    await page.goto(bookingUrl);
    const shows = async () => { await page.getByText(bookingNo).first().waitFor({ timeout: 30_000 }).catch(() => {}); return new RegExp(`Cancelled ${bookingNo}`).test(await pageText(page)); };
    while (!(await shows()) && Date.now() - t0 < 240_000) { await page.waitForTimeout(5_000); await page.reload({ waitUntil: 'load' }).catch(() => {}); reloads++; }
    statusReloads = reloads;
    test.info().annotations.push({ type: 'B2B-020 status delay', description: `"Cancelled" shown after ${reloads} reload(s), ${Math.round((Date.now() - t0) / 1000)} s` });
    await expect.poll(() => pageText(page), { timeout: 30_000 }).toMatch(new RegExp(`Cancelled ${bookingNo}`));
    await expect(page.getByRole('button', { name: 'Cancel booking', exact: true })).toBeDisabled();
  });

  test('TC-BOOK-08b: the booking shows "Cancelled" straight after the cancellation (no reload needed)', async () => {
    // product owner (Q-12, 22 Nov 2026): a cancellation must show immediately
    test.fail(true, 'B2B-020 (PB2B-36): the booking page keeps showing "Confirmed" / "Still to pay" after the cancellation');
    expect(statusReloads, 'reloads needed before "Cancelled" was shown').toBe(0);
  });

  test('TC-BOOK-09: credit is restored and a refund transaction names the confirmation', async () => {
    const after = await creditAvailable(page);
    expect(after).toBeCloseTo(creditBefore, 2);
    await expect.poll(() => pageText(page), { timeout: 60_000 }).toContain(`cancelled (${confirmation}) Credit Refund`);
    expect(money((await pageText(page)).match(/Outstanding AED ([\d,.]+)/)![1])).toBeGreaterThanOrEqual(0);
  });

  test('TC-BOOK-10: Payments & summary of the cancelled booking lists the payment AND the refund', async () => {
    test.fail(true, 'B2B-011 (PB2B-27): only the refund is listed, "Paid AED 0.00"');
    await page.goto(bookingUrl);
    await page.getByRole('button', { name: /^Payments & summary/ }).click({ timeout: 60_000 });
    const dlg = page.locator('[role=dialog]').last();
    await expect(dlg).toContainText('Refund');
    // a payment LINE (not the dialog title "Payments & summary"): e.g. "Payment · Credit line ... AED 2,203.20" and Paid 2,203.20
    await expect(dlg).toContainText(/(Payment|Charge|Booking)\W+Credit line/, { timeout: 5_000 });
    await expect(dlg).toContainText(/Paid\W*AED\W*2,203\.20/);
  });

  test('TC-BOOK-11: a cancelled booking still offers the invoice and the voucher', async () => {
    // product owner (Q-09, 22 Nov 2026): invoice and voucher stay available for a cancelled booking (PB2B-28 withdrawn)
    await page.goto(bookingUrl);
    await page.getByRole('button', { name: 'Documents', exact: true }).click({ timeout: 60_000 });
    const dlg = page.locator('[role=dialog]').last();
    for (const d of ['Service voucher', 'Customer invoice', 'Agent invoice']) await expect(dlg.getByRole('button', { name: d, exact: true })).toBeEnabled();
  });
});
