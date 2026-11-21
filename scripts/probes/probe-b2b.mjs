// READ-ONLY probe of the B2B agent portal with the saved QA agent session (playwright/.auth/b2b.json, made by tests/auth.setup.ts).
// Every POST/PUT/DELETE is BLOCKED except searches. Prints the visible texts / inputs of a page and saves a screenshot.
//   node scripts/probes/probe-b2b.mjs <path> [click "Button text" ...]
import { chromium } from '@playwright/test';
import fs from 'fs';
const B2B = (process.env.B2B_URL || 'https://b2b.nexgenpilot.com').replace(/\/$/, '');
const [path = '', ...clicks] = process.argv.slice(2);
const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: 'playwright/.auth/b2b.json', viewport: { width: 1500, height: 950 } });
const blocked = [];
await ctx.route('**/*', r => {
  const q = r.request();
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(q.method()) && !/search|negotiate|auth|login|refresh|availability|price|quote/i.test(q.url())) { blocked.push(`${q.method()} ${q.url()}`); return r.abort(); }
  return r.continue();
});
const page = await ctx.newPage();
await page.goto(`${B2B}/${path.replace(/^\/+/, '')}`);
await page.waitForTimeout(5000);
for (const c of clicks) { await page.getByRole('button', { name: c }).or(page.getByRole('link', { name: c })).or(page.getByText(c, { exact: true })).first().click({ timeout: 15000 }).catch(e => console.log('click failed:', c, String(e).split('\n')[0])); await page.waitForTimeout(3000); }
console.log('url:', page.url());
console.log('inputs:', JSON.stringify(await page.locator('input:visible, [role=combobox]:visible').evaluateAll(es => es.map(e => [e.type, e.placeholder, e.getAttribute('aria-label'), e.value].filter(Boolean).join('|')))));
console.log('buttons:', JSON.stringify([...new Set((await page.locator('button:visible, a:visible').allInnerTexts()).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean))].slice(0, 60)));
console.log('text:', (await page.locator('main').first().innerText().catch(() => page.locator('body').innerText())).replace(/\s+/g, ' ').slice(0, 1500));
const shot = `screenshots/b2b/probe-${(path || 'home').replace(/[^\w]+/g, '_')}${clicks.length ? '-' + clicks.join('-').replace(/[^\w]+/g, '_') : ''}.png`;
fs.mkdirSync('screenshots/b2b', { recursive: true }); await page.screenshot({ path: shot });
console.log('shot:', shot, '| blocked writes:', blocked.length, blocked.slice(0, 3).join(' ; '));
await browser.close();
