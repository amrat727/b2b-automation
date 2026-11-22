import { Page, expect } from '@playwright/test';

/** Blocks every save (POST/PUT/PATCH/DELETE) except reads that use POST (searches, previews). Returns the list of blocked calls. */
export async function blockWrites(page: Page, allow: RegExp = /search|details|availability|autocomplete|suggest|lookup|preview|terms|render|auth|refresh/i): Promise<string[]> {
  const blocked: string[] = [];
  await page.route('**/*', r => {
    const q = r.request();
    const p = new URL(q.url()).pathname;
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(q.method()) && !allow.test(p)) { blocked.push(`${q.method()} ${p} ${(q.postData() ?? '').slice(0, 300)}`); return r.abort(); }
    return r.continue();
  });
  return blocked;
}

export const clean = (s: string | null | undefined) => (s ?? '').replace(/[\s​]+/g, ' ').trim();
/** visible text of the page body */
export const pageText = async (page: Page) => clean(await page.locator('body').innerText());
/** "AED 2,203.20" -> 2203.2 */
export const money = (s: string) => Number(s.replace(/[^\d.-]/g, ''));

/** Credit line "Available AED ..." on Wallet & credit */
export async function creditAvailable(page: Page): Promise<number> {
  await page.goto('/finance');
  const t = await expect.poll(async () => (await pageText(page)).match(/Available AED ([\d,.]+)/)?.[1] ?? '', { timeout: 60_000 }).not.toBe('').then(async () => pageText(page));
  return money(t.match(/Available AED ([\d,.]+)/)![1]);
}

/** Opens the hotel search, picks Dubai and the given dates in the date picker and searches. */
export async function searchHotels(page: Page, checkIn: Date, checkOut: Date, city = 'Dubai') {
  const month = (d: Date) => d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  await page.goto('/search/hotel');
  const box = page.getByPlaceholder('Search city');
  await box.waitFor({ timeout: 60_000 });
  await box.pressSequentially(city, { delay: 60 });
  await page.getByRole('option', { name: city, exact: true }).click();
  await page.getByPlaceholder('Check-in – Check-out').click();
  for (const d of [checkIn, checkOut]) {
    for (let i = 0; i < 8 && !(await page.getByText(month(d), { exact: true }).isVisible().catch(() => false)); i++) await page.getByRole('button', { name: /next month/i }).click();
    await page.getByRole('gridcell', { name: String(d.getDate()), exact: true }).first().click();
    await page.waitForTimeout(300);
  }
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Search hotels' }).click();
}

/** random letters only (names lose digits on some screens) */
export const stamp = (n = 6) => Array.from({ length: n }, () => 'KLMNPQRSTVWX'[Math.floor(Math.random() * 12)]).join('');
