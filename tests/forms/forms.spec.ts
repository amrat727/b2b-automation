import { test, expect, Page } from '@playwright/test';
import { blockWrites, clean } from '../helpers';

/*
 * Form validation. READ-ONLY: every save is BLOCKED - no user, sub-agent, markup rule or credit request is created,
 * and no password is set on any real account. A blocked save = the form let the value through.
 * Known bugs are marked test.fail(...) with their Jira key, so a passing run flags "fixed - verify and close".
 */
const msgs = async (page: Page) => [...new Set((await page.locator('.MuiFormHelperText-root, [role=alert], .MuiAlert-message, .Mui-error').allInnerTexts()).map(clean).filter(Boolean))];
const field = (page: Page, label: string) => page.getByLabel(new RegExp(`^${label}`)).filter({ visible: true }).first();
const open = async (page: Page, path: string, button: string) => {
  await page.goto(path);
  await page.getByRole('button', { name: button }).first().click({ timeout: 60_000 });
  await page.waitForTimeout(1500);
};

test.describe('Forms - validation (nothing is saved)', () => {
  let blocked: string[];
  test.beforeEach(async ({ page }) => { blocked = await blockWrites(page); });

  test('TC-FORM-01: Add user - empty save marks EVERY required field (Name, Sign-in ID, Password)', async ({ page }) => {
    test.fail(true, 'B2B-001 (PB2B-17): only "Enter the person\'s name." is shown');
    await open(page, '/business/users', 'Add user');
    await page.getByRole('button', { name: /^Add user$/ }).filter({ visible: true }).last().click();
    const m = (await msgs(page)).join(' | ');
    expect(m).toMatch(/name/i);
    expect(m).toMatch(/sign-in id/i);
    expect(blocked).toEqual([]);
  });

  test('TC-FORM-02: Add user - password needs 8+ characters with letters and digits', async ({ page }) => {
    await open(page, '/business/users', 'Add user');
    await field(page, 'Name').fill('QA Auto Probe');
    await field(page, 'Sign-in ID').fill('qa.auto.probe');
    await field(page, 'Password').fill('abcdefgh');
    await page.getByRole('button', { name: /^Add user$/ }).filter({ visible: true }).last().click();
    await expect(page.getByRole('alert').getByText('At least 8 characters, with letters and digits.')).toBeVisible();
    expect(blocked, 'a weak password was sent').toEqual([]);
  });

  test('TC-FORM-03: Add user - an invalid email is rejected before anything is sent', async ({ page }) => {
    test.fail(true, 'B2B-013 (PB2B-29): "not-an-email" is sent to the server');
    await open(page, '/business/users', 'Add user');
    await field(page, 'Name').fill('QA Auto Probe');
    await field(page, 'Sign-in ID').fill('qa.auto.probe');
    await field(page, 'Email').fill('not-an-email');
    await field(page, 'Password').fill('Abcd1234x');
    await page.getByRole('button', { name: /^Add user$/ }).filter({ visible: true }).last().click();
    await page.waitForTimeout(1500);
    expect(blocked, 'the invalid email was sent').toEqual([]);
  });

  test('TC-FORM-04: Add sub-agent - empty save shows a message on every required field', async ({ page }) => {
    await open(page, '/business/subagents', 'Add sub-agent');
    await page.getByRole('button', { name: /^(Add sub-agent|Create|Save)$/ }).filter({ visible: true }).last().click();
    await expect(page.getByText('Required').first()).toBeVisible();
    expect(blocked).toEqual([]);
  });

  test('TC-FORM-05: Add sub-agent - an invalid email is rejected before anything is sent', async ({ page }) => {
    test.fail(true, 'B2B-014 (PB2B-30): "not-an-email" is sent to the server');
    await open(page, '/business/subagents', 'Add sub-agent');
    await field(page, 'Agency name').fill('QA Auto Probe Agency');
    await field(page, 'Contact person').fill('QA Auto Probe');
    await field(page, 'Sign-in ID').fill('qa.auto.probe.agency');
    await field(page, 'Email').fill('not-an-email');
    await field(page, 'Password').fill('Abcd1234x');
    await page.getByRole('button', { name: /^(Add sub-agent|Create|Save)$/ }).filter({ visible: true }).last().click();
    await page.waitForTimeout(1500);
    expect(blocked, 'the invalid email was sent').toEqual([]);
  });

  // product owner (Q-01, 22 Nov 2026): a markup must be above 0 and at most 1000 %
  const tryMarkup = async (page: Page, v: string) => {
    await page.goto('/business/markup');
    const pct = page.locator('input[type=number]').filter({ visible: true }).first();
    await pct.fill(v, { timeout: 60_000 });
    const save = page.getByRole('button', { name: /^Save$/ }).first();
    if (await save.isEnabled()) await save.click();
    await page.waitForTimeout(1500);
    return blocked.filter(b => /markup/.test(b)).length > 0;     // true = the value was sent (the form accepted it)
  };
  for (const v of ['-10', '0', '1001']) {
    test(`TC-FORM-06: Markup ${v} % is refused (must be above 0 and at most 1000 %)`, async ({ page }) => {
      test.fail(true, `B2B-015 (PB2B-31): ${v} % is sent with PUT /markup (no minimum / maximum check)`);
      expect(await tryMarkup(page, v), `markup ${v} % was sent`).toBe(false);
    });
  }
  test('TC-FORM-06: Markup 1000 % (the maximum) is accepted', async ({ page }) => {
    expect(await tryMarkup(page, '1000'), 'markup 1000 % was not sent').toBe(true);
  });

  // product owner (Q-08, 22 Nov 2026): the agent may ask for ANY limit - also lower than today - but not negative, at most 1,000,000
  const limitSend = async (page: Page, v: string) => {
    await open(page, '/finance', 'Request higher limit');
    await page.locator('input[type=number]').filter({ visible: true }).first().fill(v);
    await page.waitForTimeout(800);
    return page.getByRole('button', { name: /^(Send request|Request|Submit|Send)/ }).filter({ visible: true }).last();
  };
  for (const v of ['1000', '1000000']) {
    test(`TC-FORM-07: Credit limit request ${v} can be sent (any limit up to 1,000,000)`, async ({ page }) => {
      if (v === '1000') test.fail(true, 'B2B-016 (PB2B-32): a limit lower than the current 50,000 only greys out the send button');
      await expect(await limitSend(page, v)).toBeEnabled();
    });
  }
  for (const v of ['-500', '1000001']) {
    test(`TC-FORM-07: Credit limit request ${v} is refused`, async ({ page }) => {
      if (v === '1000001') test.fail(true, 'B2B-016 (PB2B-32): 1,000,001 can be sent - the maximum is 1,000,000');
      await expect(await limitSend(page, v)).toBeDisabled();
    });
  }

  test('TC-FORM-08: Build package - empty search asks for a destination', async ({ page }) => {
    await open(page, '/packages', 'Build package');
    await page.getByRole('button', { name: /^(Build|Search|Build package|Create)/ }).filter({ visible: true }).last().click();
    await expect(page.getByText('Choose a destination.')).toBeVisible();
  });
});
