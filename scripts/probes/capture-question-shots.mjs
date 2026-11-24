// READ-ONLY: captures screenshots for B2B questions that had none from testing (every save is blocked).
//   node scripts/probes/capture-question-shots.mjs      ->  reports/B2B-Questions/screenshots/Q-NN-*.png
import { chromium } from '@playwright/test';
import fs from 'fs';
const B2B = (process.env.B2B_URL || 'https://b2b.nexgenpilot.com').replace(/\/$/, '');
const OUT = 'reports/B2B-Questions/screenshots';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: 'playwright/.auth/b2b.json', viewport: { width: 1500, height: 950 } });
await ctx.route('**/*', r => { const q = r.request(); if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(q.method()) && !/search|auth|refresh|autocomplete|suggest|lookup/i.test(q.url())) return r.abort(); return r.continue(); });
const page = await ctx.newPage();

// Q-16: typing "Dubai" as flight origin - which airport comes first
await page.goto(B2B + '/search/flight', { waitUntil: 'domcontentloaded' });
const box = page.getByPlaceholder('Enter origin');
await box.click(); await box.pressSequentially('Dubai', { delay: 80 });
await page.getByRole('option').first().waitFor({ timeout: 20000 });
await page.waitForTimeout(1500);
console.log('Q-16 options:', (await page.getByRole('option').allInnerTexts()).map(s => s.replace(/\s+/g, ' ').trim()).join(' | '));
await page.screenshot({ path: `${OUT}/Q-16-flight-origin-dubai.png` });

await browser.close();
