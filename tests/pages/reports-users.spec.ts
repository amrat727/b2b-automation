import { test, expect } from '@playwright/test';
import { blockWrites, pageText, searchHotels } from '../helpers';

/*
 * Reports, Users and the checkout Pay button - READ-ONLY (every save / booking call is blocked).
 * Known bugs are marked test.fail(...) with their Jira key, so a passing run flags "fixed - verify and close".
 */
test.describe('Reports, Users, checkout', () => {
  test.beforeEach(async ({ page }) => { await blockWrites(page); });

  test('TC-RPT-01: Reports show real figures (no "Sample figures")', async ({ page }) => {
    // product owner (Q-07, 22 Nov 2026): Reports must show the actual data
    test.fail(true, 'B2B-017 (PB2B-33): "Sample figures — live reporting isn\'t connected yet" with made-up margins (incl. Visa)');
    await page.goto('/finance/reports');
    await expect.poll(() => pageText(page), { timeout: 60_000 }).toContain('Product-line performance');
    expect(await pageText(page)).not.toMatch(/Sample figures/);
  });

  test('TC-RPT-02: Reports Export downloads a file', async ({ page }) => {
    test.fail(true, 'B2B-017 (PB2B-33): Export downloads nothing');
    await page.goto('/finance/reports');
    const [dl] = await Promise.all([
      page.waitForEvent('download', { timeout: 15_000 }).catch(() => null),
      page.getByRole('button', { name: /^Export/ }).first().click({ timeout: 60_000 }),
    ]);
    expect(dl, 'no file was downloaded').not.toBeNull();
  });

  test('TC-USR-01: Users shows the last sign-in of the signed-in agent', async ({ page }) => {
    test.fail(true, 'B2B-018 (PB2B-34): "Last sign-in —" for the agent that is signed in right now');
    await page.goto('/business/users');
    await expect.poll(() => pageText(page), { timeout: 60_000 }).toContain('QA Auto B2B Agent');
    expect(await pageText(page)).not.toMatch(/Last sign-in —/);
  });

  test('TC-CHK-01: checkout - Pay on an empty form says which fields are missing', async ({ page }) => {
    test.fail(true, 'B2B-003 (PB2B-19): Pay is just disabled - nothing says which fields are missing');
    const IN = new Date(Date.now() + 60 * 864e5), OUT = new Date(IN.getTime() + 3 * 864e5);
    await searchHotels(page, IN, OUT);
    const card = page.locator('div').filter({ hasText: 'Marina Bay Hotel' }).filter({ has: page.getByRole('button', { name: /See \d+ rooms/ }) }).last();
    await card.getByRole('button', { name: /See \d+ rooms/ }).click();
    await page.getByRole('button', { name: 'Book', exact: true }).first().click();
    const pay = page.getByRole('button', { name: /^Pay / }).first();
    await expect(pay).toBeVisible({ timeout: 60_000 });
    await pay.click({ force: true }).catch(() => {});      // a disabled button ignores the click
    await page.waitForTimeout(1500);
    // either the button is usable and pressing it lists the missing fields, or a hint next to it says what is missing
    await expect(page.getByText(/required|missing|fill in|complete the|enter /i).first()).toBeVisible({ timeout: 5_000 });
  });
});
