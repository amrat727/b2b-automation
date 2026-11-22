// READ-ONLY: global search, notifications, profile, Savings, Disruptions, Trip builder, AI assistant (page only, no message
// sent), Reports export, Markup earnings filters, dark mode. Every save BLOCKED.   node scripts/probes/other.mjs
import { chromium } from '@playwright/test';
import fs from 'fs';
const B2B = (process.env.B2B_URL || 'https://b2b.nexgenpilot.com').replace(/\/$/, '');
const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: 'playwright/.auth/b2b.json', viewport: { width: 1500, height: 950 }, acceptDownloads: true });
const sent = [];
await ctx.route('**/*', r => { const q = r.request(); const p = new URL(q.url()).pathname; if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(q.method()) && !/search|auth|refresh|export/i.test(p)) { sent.push(`${q.method()} ${p}`); return r.abort(); } return r.continue(); });
const page = await ctx.newPage();
const failed = []; page.on('response', r => { if (r.status() >= 400 && /nexgenpilot|runasp/.test(r.url())) failed.push(`${r.status()} ${new URL(r.url()).pathname}`); });
fs.mkdirSync('screenshots/other', { recursive: true });
const clean = s => (s || '').replace(/[\s​]+/g, ' ').trim();
const main = async () => clean(await page.locator('body').innerText()).split('Keep open')[1] ?? '';
const log = (k, v) => console.log(`## ${k}: ${typeof v === 'string' ? v.slice(0, 900) : JSON.stringify(v)}`);
const shot = n => page.screenshot({ path: `screenshots/other/${n}.png`, fullPage: true });

// global search: booking number, guest, hotel, nonsense
await page.goto(B2B + '/'); await page.waitForTimeout(4000);
for (const q of ['000009', 'KRQNRL', 'Marina', 'zzqqxx']) {
  const box = page.getByPlaceholder(/Search bookings, PNR/); await box.click(); await box.fill(q); await page.waitForTimeout(3000);
  const pop = clean(await page.locator('[role=listbox], [role=dialog], .MuiPopover-paper, .MuiAutocomplete-popper').last().innerText().catch(() => ''));
  log(`global search "${q}"`, pop || '(nothing shown)'); await shot(`global-search-${q}`);
  await page.keyboard.press('Escape');
}
// notifications
await page.locator('button:has([data-testid*="Notification"]), button[aria-label*="otification" i]').first().click().catch(() => page.locator('header button').nth(5).click());
await page.waitForTimeout(2000); log('notifications', clean(await page.locator('.MuiPopover-paper, [role=dialog], [role=menu]').last().innerText().catch(() => ''))); await shot('notifications');
await page.keyboard.press('Escape');
// pages
for (const [n, p] of [['profile', '/profile'], ['savings', '/savings'], ['disruptions', '/disruptions'], ['trip', '/trip'], ['assistant', '/assistant'], ['reports', '/finance/reports'], ['earnings', '/business/earnings'], ['subagents', '/business/subagents'], ['users', '/business/users'], ['quotes', '/quotes']]) {
  failed.length = 0;
  await page.goto(B2B + p); await page.waitForTimeout(4000); await shot(n);
  log(n, await main()); if (failed.length) log(`${n} failed calls`, [...new Set(failed)]);
}
// reports export (download)
await page.goto(B2B + '/finance/reports'); await page.waitForTimeout(4000);
const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }).catch(() => null), page.getByRole('button', { name: /^Export/ }).first().click().catch(() => {})]);
log('reports export', dl ? `download ${dl.suggestedFilename()}` : 'no download'); await page.waitForTimeout(1500);
log('after export', clean(await page.locator('.MuiPopover-paper, [role=menu], [role=dialog]').last().innerText().catch(() => '(no menu)')));
await shot('reports-export');
log('writes blocked', [...new Set(sent)]);
await browser.close();
