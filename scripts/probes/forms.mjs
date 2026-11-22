// READ-ONLY form checks (every save BLOCKED - nothing is created, no password is set on any account):
// empty save + wrong values on New quotation, Build package, Add sub-agent, Add user, Markup, Request higher limit.
//   node scripts/probes/forms.mjs
import { chromium } from '@playwright/test';
import fs from 'fs';
const B2B = (process.env.B2B_URL || 'https://b2b.nexgenpilot.com').replace(/\/$/, '');
const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: 'playwright/.auth/b2b.json', viewport: { width: 1500, height: 950 } });
let sent = [];
await ctx.route('**/*', r => { const q = r.request(); const p = new URL(q.url()).pathname; if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(q.method()) && !/search|autocomplete|suggest|lookup|auth|refresh|preview/i.test(p)) { sent.push(`${q.method()} ${p} ${(q.postData() || '').slice(0, 200)}`); return r.abort(); } return r.continue(); });
const page = await ctx.newPage();
fs.mkdirSync('screenshots/forms', { recursive: true });
const clean = s => (s || '').replace(/[\s​]+/g, ' ').trim();
const msgs = async () => [...new Set((await page.locator('.MuiFormHelperText-root, [role=alert], .MuiAlert-message, .Mui-error').allInnerTexts()).map(clean).filter(Boolean))];
const dlg = () => page.locator('[role=dialog]').last();
const field = (label) => page.getByLabel(new RegExp(`^${label}`)).filter({ visible: true }).first();
const report = async (name, step) => { const m = await msgs(); await page.screenshot({ path: `screenshots/forms/${name}-${step}.png`, fullPage: true }); console.log(`## ${name} / ${step}: messages=${JSON.stringify(m)} | sent=${JSON.stringify(sent)}`); sent = []; };
const open = async (path, button) => { await page.goto(B2B + path); await page.waitForTimeout(4000); await page.getByRole('button', { name: button }).first().click(); await page.waitForTimeout(2500); };
const press = async (re) => { const b = page.getByRole('button', { name: re }).filter({ visible: true }).last(); const en = await b.isEnabled().catch(() => false); if (en) await b.click(); else console.log(`   (submit button ${re} disabled)`); await page.waitForTimeout(2000); };

// --- Add user: empty, bad email, short password
await open('/business/users', 'Add user');
await press(/^Add user$/); await report('add-user', 'empty');
await field('Name').fill('QA Auto Probe'); await field('Sign-in ID').fill('qa.auto.probe'); await field('Email').fill('not-an-email'); await field('Password').fill('abc');
await press(/^Add user$/); await report('add-user', 'bad-email-short-password');
await field('Password').fill('abcdefgh'); await press(/^Add user$/); await report('add-user', 'letters-only-password');
await field('Password').fill('Abcd1234x'); await press(/^Add user$/); await report('add-user', 'valid-password-bad-email');

// --- Add sub-agent: empty, bad email, short password
await open('/business/subagents', 'Add sub-agent');
console.log('   sub-agent fields:', JSON.stringify(await dlg().locator('input:visible').evaluateAll(es => es.map(e => e.closest('.MuiFormControl-root')?.querySelector('label')?.innerText?.trim() || e.type))));
await press(/^(Add sub-agent|Create|Save)$/); await report('add-subagent', 'empty');
await field('Agency name').fill('QA Auto Probe Agency'); await field('Contact person').fill('QA Auto Probe'); await field('Sign-in ID').fill('qa.auto.probe.agency');
await field('Email').fill('not-an-email'); await field('Password').fill('Abcd1234x');
await press(/^(Add sub-agent|Create|Save)$/); await report('add-subagent', 'valid-except-bad-email');

// --- Request higher limit: empty, 0, negative, lower than current
for (const v of ['', '0', '-500', '1000']) {
  await open('/finance', 'Request higher limit');
  const amount = page.locator('input[type=number]').filter({ visible: true }).first();
  if (v) await amount.fill(v);
  await press(/^(Send request|Request|Submit|Send)$/); await report('credit-request', v || 'empty');
}

// --- Markup: negative and huge values (Save blocked)
await page.goto(B2B + '/business/markup'); await page.waitForTimeout(4000);
console.log('   markup page:', clean(await page.locator('body').innerText()).split('Keep open')[1]?.slice(0, 900));
const num = page.locator('main input[type=number], input[type=number]').filter({ visible: true }).first();
if (await num.count()) {
  for (const v of ['-10', '1000']) { await num.fill(v); await press(/^Save$/); await report('markup', v); }
}

// --- New quotation, Build package: empty submit
await open('/quotations', 'New quotation');
console.log('   new quotation:', clean(await page.locator('body').innerText()).split('Keep open')[1]?.slice(0, 700));
await press(/^(Create|Save|Create quotation|Save draft|Next|Continue)/); await report('new-quotation', 'empty');
await open('/packages', 'Build package');
await press(/^(Build|Search|Build package|Create)/); await report('build-package', 'empty');
await browser.close();
