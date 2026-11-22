// READ-ONLY SWEEP of every B2B portal page (saved QA agent session). Every save is BLOCKED (searches / reads allowed).
// Per page: heading, buttons, inputs, empty messages, console errors, failed API calls (>= 400), and the "Add / New"
// form with an empty Save (blocked). Writes screenshots/sweep/*.png and reports/sweep.json.
//   node scripts/probes/sweep.mjs
import { chromium } from '@playwright/test';
import fs from 'fs';
const B2B = (process.env.B2B_URL || 'https://b2b.nexgenpilot.com').replace(/\/$/, '');
const PAGES = [
  ['Home', '/'], ['Search hotels', '/search/hotel'], ['Search flights', '/search/flight'], ['Search flight + hotel', '/search/flight-hotel'],
  ['Search multicentre', '/search/multicentre'], ['Search activities', '/search/activity'], ['Search packages', '/search/package'], ['Search bundles', '/search/bundle'],
  ['Search transfers', '/search/transfer'], ['Search cruise', '/search/cruise'], ['Search rail', '/search/rail'],
  ['Bookings', '/bookings'], ['Trip builder', '/trip'], ['Quotations', '/quotes'], ['My quotations', '/quotations'], ['Package builder', '/packages'],
  ['Savings', '/savings'], ['AI assistant', '/assistant'], ['Disruptions', '/disruptions'], ['Wallet & credit', '/finance'], ['Reports', '/finance/reports'],
  ['Sub-agents', '/business/subagents'], ['Markup', '/business/markup'], ['Markup earnings', '/business/earnings'], ['Users', '/business/users'], ['Cart', '/cart'], ['Profile', '/profile'],
];
const ALLOW = /search|auth|refresh|negotiate|details|availability|autocomplete|suggest|lookup|price|quote\b|rates?\b/i;
const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: 'playwright/.auth/b2b.json', viewport: { width: 1500, height: 950 } });
let blocked = [];
await ctx.route('**/*', r => { const q = r.request(); if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(q.method()) && !ALLOW.test(q.url())) { blocked.push(`${q.method()} ${new URL(q.url()).pathname}`); return r.abort(); } return r.continue(); });
const page = await ctx.newPage();
let consoleErr = [], failed = [];
page.on('console', m => { if (m.type() === 'error') consoleErr.push(m.text().slice(0, 200)); });
page.on('pageerror', e => consoleErr.push('PAGE ERROR: ' + String(e).slice(0, 200)));
page.on('response', r => { if (r.status() >= 400 && !/\.(png|jpg|svg|woff2?|css)(\?|$)/.test(r.url()) && r.request().method() !== 'OPTIONS') failed.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`); });
const clean = s => (s || '').replace(/[\s​]+/g, ' ').trim();
const grab = async () => ({
  url: page.url().replace(B2B, '') || '/',
  headings: (await page.locator('h1, h2, h3, h4, [role=heading]').allInnerTexts()).map(clean).filter(Boolean).slice(0, 12),
  buttons: [...new Set((await page.locator('button:visible, [role=button]:visible, a:visible').allInnerTexts()).map(clean).filter(s => s && s.length < 40))],
  inputs: await page.locator('input:visible, textarea:visible, [role=combobox]:visible').evaluateAll(es => es.map(e => [e.type || e.tagName, e.placeholder, e.getAttribute('aria-label')].filter(Boolean).join('|'))),
  text: clean(await page.locator('body').innerText().catch(() => '')).slice(0, 1800),
});
fs.mkdirSync('screenshots/sweep', { recursive: true }); fs.mkdirSync('reports', { recursive: true });
const out = [];
for (const [name, path] of PAGES) {
  consoleErr = []; failed = []; blocked = [];
  try {
    await page.goto(B2B + path, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);
    const info = await grab();
    const slug = name.replace(/[^\w]+/g, '_');
    await page.screenshot({ path: `screenshots/sweep/${slug}.png` });
    // the main "Add / New / Request / Build" action: open it, try an empty save (blocked), read the messages
    let form = null;
    const add = page.getByRole('button', { name: /^(\+\s*)?(Add|New|Request|Build|Create) / }).filter({ hasNotText: /search/i }).first();
    if (await add.isVisible().catch(() => false)) {
      const label = clean(await add.innerText());
      await add.click().catch(() => {}); await page.waitForTimeout(2500);
      const before = await grab();
      const save = page.getByRole('button', { name: /^(Save|Create|Submit|Send|Add|Request|Continue|Confirm)( |$)/ }).last();
      let msgs = [];
      if (await save.isVisible().catch(() => false)) {
        await save.click().catch(() => {}); await page.waitForTimeout(2000);
        msgs = [...new Set((await page.locator('.MuiFormHelperText-root, [role=alert], .Mui-error, [class*=error]:visible').allInnerTexts()).map(clean).filter(Boolean))].slice(0, 12);
      }
      await page.screenshot({ path: `screenshots/sweep/${slug}-form.png` });
      form = { opened: label, url: before.url, headings: before.headings.slice(0, 4), inputs: before.inputs, buttons: before.buttons.filter(b => !info.buttons.includes(b)).slice(0, 20), emptySaveMessages: msgs, writesBlocked: [...blocked] };
      await page.keyboard.press('Escape').catch(() => {});
    }
    out.push({ name, path, ...info, consoleErrors: [...new Set(consoleErr)], failedCalls: [...new Set(failed)], form });
    console.log(`${name.padEnd(22)} ${info.url.padEnd(26)} h:${info.headings.length} btn:${info.buttons.length} errors:${new Set(consoleErr).size} failed:${new Set(failed).size}${form ? ` form:"${form.opened}" msgs:${form.emptySaveMessages.length}` : ''}`);
  } catch (e) { out.push({ name, path, error: String(e).slice(0, 200) }); console.log(`${name}: ERROR ${String(e).slice(0, 100)}`); }
}
fs.writeFileSync('reports/sweep.json', JSON.stringify(out, null, 1));
await browser.close();
