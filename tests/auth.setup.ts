import { test as setup, expect } from '@playwright/test';
import fs from 'fs';
import { B2B, SESSION } from '../env';

// Signs the QA agent in once; the other projects reuse the saved session. Login values come only from .env.
setup('sign in the QA agent and save the session', async ({ page }) => {
  setup.skip(!B2B.company || !B2B.username || !B2B.password, 'B2B_COMPANY / B2B_USERNAME / B2B_PASSWORD are not in .env');
  await page.goto('/login');
  await page.getByPlaceholder('Your company code').fill(B2B.company);
  await page.getByPlaceholder('Your sign-in ID').fill(B2B.username);
  await page.getByPlaceholder('Enter your password').fill(B2B.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page, 'still on the login page - check the B2B login in .env').not.toHaveURL(/\/login(\?|$)/, { timeout: 60_000 });
  fs.mkdirSync('playwright/.auth', { recursive: true });
  await page.context().storageState({ path: SESSION });
});
