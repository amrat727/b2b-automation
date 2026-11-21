import { test, expect } from '@playwright/test';
import fs from 'fs';
import { B2B } from '../../env';

/*
 * B2B portal - login (company "sb", standing QA agent AG-00035 "QA Auto B2B Agent").
 * Login values come ONLY from .env (B2B_COMPANY, B2B_USERNAME, B2B_PASSWORD) - never from the code.
 */
test.describe('B2B portal - login', () => {
  test('TC-B2B-01: Login page shows company code, sign-in ID, password and "Sign in"', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByPlaceholder('Your company code')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByPlaceholder('Your sign-in ID')).toBeVisible();
    await expect(page.getByPlaceholder('Enter your password')).toHaveAttribute('type', 'password');
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  });

  test('TC-B2B-02: The QA agent signs in and lands on the portal home with wallet and credit @smoke', async ({ page }) => {
    test.skip(!B2B.company || !B2B.username || !B2B.password, 'B2B_* login is not in .env');
    await page.goto('/login');
    await page.getByPlaceholder('Your company code').fill(B2B.company);
    await page.getByPlaceholder('Your sign-in ID').fill(B2B.username);
    await page.getByPlaceholder('Enter your password').fill(B2B.password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).not.toHaveURL(/\/login(\?|$)/, { timeout: 60_000 });
    await expect(page.getByPlaceholder('Enter your password')).toHaveCount(0);
    await expect(page.getByText('QA Auto B2B Agent').first()).toBeVisible();
    await expect(page.getByText(/^Wallet/).first()).toBeVisible();
    await expect(page.getByText(/^Credit/).first()).toBeVisible();
    fs.mkdirSync('screenshots', { recursive: true });
    await page.screenshot({ path: 'screenshots/TC-B2B-02-logged-in.png' });
  });
});
