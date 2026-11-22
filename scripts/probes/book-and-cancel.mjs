// ONE REAL QA BOOKING, then CANCELLED (free cancellation window): captures every screen of the journey so the booking
// spec can be written. Guests / reference "QA Auto <LETTERS>", e-mail example.com. Records money before / after / after cancel.
//   node scripts/probes/book-and-cancel.mjs
import { chromium } from '@playwright/test';
import fs from 'fs';
const B2B = (process.env.B2B_URL || 'https://b2b.nexgenpilot.com').replace(/\/$/, '');
const HOTEL = 'Marina Bay Hotel';
const IN = new Date(Date.now() + 60 * 864e5), OUT = new Date(IN.getTime() + 3 * 864e5);
const STAMP = Array.from({ length: 6 }, () => 'KLMNPQRSTVWX'[Math.floor(Math.random() * 12)]).join('');
const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: 'playwright/.auth/b2b.json', viewport: { width: 1500, height: 950 } });
const page = await ctx.newPage();
const calls = [];
page.on('response', async r => { const q = r.request(); if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(q.method()) && /nexgenpilot|runasp/.test(r.url()))
  calls.push(`${r.status()} ${q.method()} ${new URL(r.url()).pathname}  ${(await r.text().catch(() => '')).slice(0, 220)}`); });
fs.mkdirSync('screenshots/journey', { recursive: true });
let n = 0; const shot = async name => page.screenshot({ path: `screenshots/journey/${String(++n).padStart(2, '0')}-${name}.png`, fullPage: true });
const text = async () => (await page.locator('body').innerText()).replace(/[\s​]+/g, ' ');
const money = async () => (await page.locator('button').filter({ hasText: /^Wallet/ }).first().innerText()).replace(/\s+/g, ' ');
const months = d => d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
const log = (k, v) => console.log(`${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`);

await page.goto(`${B2B}/finance`); await page.waitForTimeout(5000);
log('money before', await money()); log('finance before', (await text()).split('Keep open')[1]?.slice(0, 700));
await shot('finance-before');

// ---- search + book
await page.goto(`${B2B}/search/hotel`);
await page.getByPlaceholder('Search city').waitFor({ timeout: 60000 });
await page.getByPlaceholder('Search city').pressSequentially('Dubai', { delay: 80 });
await page.getByRole('option', { name: 'Dubai', exact: true }).click();
await page.getByPlaceholder('Check-in – Check-out').click();
const pick = async d => {
  for (let i = 0; i < 6 && !(await page.getByText(months(d), { exact: true }).isVisible().catch(() => false)); i++) await page.getByRole('button', { name: /next month/i }).click();
  await page.getByRole('gridcell', { name: String(d.getDate()), exact: true }).first().click();
};
await pick(IN); await page.waitForTimeout(400); await pick(OUT); await page.keyboard.press('Escape');
await page.getByRole('button', { name: 'Search hotels' }).click();
await page.getByText(HOTEL).first().waitFor({ timeout: 60000 }); await page.waitForTimeout(1500);
const card = page.locator('div').filter({ hasText: HOTEL }).filter({ has: page.getByRole('button', { name: /See \d+ rooms/ }) }).last();
await card.getByRole('button', { name: /See \d+ rooms/ }).click(); await page.waitForTimeout(4000);
await page.getByRole('button', { name: 'Book', exact: true }).first().click();
await page.waitForURL(/\/checkout/, { timeout: 60000 }); await page.waitForTimeout(3000);

const field = label => page.getByLabel(new RegExp(`^${label}`)).first();
await field('Email').fill(`qa.auto.b2b.${STAMP.toLowerCase()}@example.com`);
await field('Mobile').fill('501234567');
await field('Your reference').fill(`QA Auto ${STAMP}`);
const titles = page.getByRole('combobox', { name: /^Title/ });
for (let i = 0; i < await titles.count(); i++) { await titles.nth(i).click(); await page.getByRole('option', { name: 'Mr', exact: true }).click(); }
const firsts = page.getByLabel(/^First name/), lasts = page.getByLabel(/^Last name/);
for (let i = 0; i < await firsts.count(); i++) { await firsts.nth(i).fill(`QA ${['Lead', 'Guest', 'Third', 'Fourth'][i]}`); await lasts.nth(i).fill(`Auto ${STAMP}`); }
await page.getByRole('checkbox', { name: 'I accept the booking terms' }).filter({ visible: true }).first().check();
await page.waitForTimeout(800);
await shot('checkout-filled');
log('pay enabled', await page.getByRole('button', { name: /^Pay / }).isEnabled());
await page.getByRole('button', { name: /^Pay / }).click();
await page.waitForTimeout(12000);
await shot('after-pay');
log('after pay url', page.url()); log('after pay text', (await text()).split('Keep open')[1]?.slice(0, 1500));
// second step "Secure payment": the room is held with the supplier -> pay from the CREDIT LINE
const fromCredit = page.getByRole('button', { name: /from credit line/i });
if (await fromCredit.isVisible().catch(() => false)) {
  await page.getByText('Credit line', { exact: true }).first().click().catch(() => {});
  await page.waitForTimeout(800);
  await fromCredit.click();
  await page.waitForTimeout(15000);
  await shot('after-credit-pay');
  log('after credit pay url', page.url()); log('after credit pay text', (await text()).split('Keep open')[1]?.slice(0, 2000));
}
log('money after booking', await money());

// ---- booking in the list + detail
await page.goto(`${B2B}/bookings`); await page.waitForTimeout(5000); await shot('bookings-list');
log('bookings list', (await text()).split('Keep open')[1]?.slice(0, 900));
const row = page.getByText(new RegExp(`Auto ${STAMP}|QA Auto ${STAMP}|${HOTEL}`)).first();
await row.click().catch(() => {}); await page.waitForTimeout(5000); await shot('booking-detail');
log('detail url', page.url()); log('detail text', (await text()).split('Keep open')[1]?.slice(0, 2500));
log('detail buttons', [...new Set((await page.locator('main button:visible, button:visible').allInnerTexts()).map(s => s.replace(/\s+/g, ' ').trim()).filter(s => s && s.length < 40))].slice(-25));
await page.goto(`${B2B}/finance`); await page.waitForTimeout(5000); await shot('finance-after-booking');
log('finance after booking', (await text()).split('Keep open')[1]?.slice(0, 900));

// ---- cancel (free window) - always attempted
await page.goBack().catch(() => {}); await page.goto(page.url()).catch(() => {});
const detailUrl = await (async () => { await page.goto(`${B2B}/bookings`); await page.waitForTimeout(4000); await page.getByRole('button', { name: /^All/ }).first().click().catch(() => {}); await page.waitForTimeout(2000); await page.getByText(new RegExp(`Auto ${STAMP}|${HOTEL}`)).first().click({ timeout: 15000 }).catch(() => log('no booking row', 'not found in Bookings')); await page.waitForTimeout(4000); return page.url(); })();
const cancelBtn = page.getByRole('button', { name: /^Cancel( booking| stay)?$/ }).first();
log('cancel button', await cancelBtn.isVisible().catch(() => false));
if (await cancelBtn.isVisible().catch(() => false)) {
  await cancelBtn.click(); await page.waitForTimeout(2500); await shot('cancel-dialog');
  log('cancel dialog', (await page.locator('[role=dialog]').last().innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 900));
  const confirm = page.locator('[role=dialog]').last().getByRole('button', { name: /cancel|confirm|yes/i }).last();
  log('confirm button', await confirm.innerText().catch(() => '-'));
  await confirm.click().catch(e => log('confirm failed', String(e).split('\n')[0]));
  await page.waitForTimeout(8000); await shot('after-cancel');
  log('after cancel text', (await text()).split('Keep open')[1]?.slice(0, 1500));
}
await page.goto(detailUrl); await page.waitForTimeout(4000); log('status after cancel', (await text()).match(/Cancel\w*|Confirmed|On request|Pending/g)?.slice(0, 6));
await page.goto(`${B2B}/finance`); await page.waitForTimeout(5000); await shot('finance-after-cancel');
log('money after cancel', await money()); log('finance after cancel', (await text()).split('Keep open')[1]?.slice(0, 900));
log('STAMP', STAMP);
console.log('calls:\n  ' + calls.join('\n  '));
await browser.close();
