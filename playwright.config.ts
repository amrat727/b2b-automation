import { defineConfig, devices } from '@playwright/test';
import { B2B_URL, SESSION } from './env';

/*
 * Pilot B2B agent portal - one project per area:
 *   setup    -> signs the QA agent in once and saves the session (playwright/.auth/b2b.json)
 *   login    -> login page and sign-in checks (no saved session)
 *   booking  -> search -> book on credit -> booking + money -> cancel (REAL QA bookings, cancelled at the end)
 */
const wide = { ...devices['Desktop Chrome'], viewport: { width: 1500, height: 950 } };

export default defineConfig({
  testDir: './tests',
  timeout: 120_000,
  expect: { timeout: 20_000 },
  retries: 0,
  workers: 1,
  reporter: [['line'], ['html', { open: 'never' }]],
  use: { baseURL: B2B_URL, screenshot: 'only-on-failure', trace: 'retain-on-failure', video: 'retain-on-failure' },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/, use: wide },
    { name: 'login', testDir: './tests/login', use: wide },
    { name: 'booking', testDir: './tests/booking', dependencies: ['setup'], use: { ...wide, storageState: SESSION } },
  ],
});
