// Applies the product owner's answers (reports/B2B-Questions, 22 Nov 2026) to the PB2B issues:
// comment + screenshots per issue; "withdraw" = label not-a-bug + Done.
//   node jira/answers-update.mjs [--dry-run]
import { B2B } from '../env.ts';   // loads .env (falls back to ../erp-automation/.env) for JIRA_*
import fs from 'fs';
import path from 'path';

void B2B;
const BASE = 'https://piloterp.atlassian.net';
const auth = 'Basic ' + Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`).toString('base64');
const DRY = process.argv.includes('--dry-run');
const api = async (method, p, body, extra = {}) => {
  const res = await fetch(BASE + p, { method, headers: { Authorization: auth, Accept: 'application/json', ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...extra },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined });
  const t = await res.text(); let d; try { d = t ? JSON.parse(t) : null; } catch { d = t; }
  return { ok: res.ok, status: res.status, data: d };
};
const doc = text => ({ type: 'doc', version: 1, content: text.split('\n').filter(l => l.trim()).map(t => ({ type: 'paragraph', content: [{ type: 'text', text: t }] })) });
const A = 'Product owner answer (B2B-Questions.xlsx, 22 Nov 2026)';
const S = 'screenshots/answers/';

const PLAN = [
  { key: 'PB2B-22', text: `${A}, Q-03: the date ranges are wrong - if a period says "no charge" until 7 Jan, the next period must start on 8 Jan (8-14 Jan), and so on.\nRetested 22 Nov 2026: still wrong - Booking -> 7 Jan 2027 no charge, then 7 Jan -> 14 Jan 25 %, 14 Jan -> 19 Jan 50 %, 19 Jan -> 21 Jan 100 %: every period starts on the day the previous one ends. Automated test TC-SRCH-07.`, shots: [S + 'PB2B-22-cancellation-periods-overlap.png'] },
  { key: 'PB2B-31', text: `${A}, Q-01: a markup cannot be negative or 0, and must not exceed 1000 %.\nRetested 22 Nov 2026: -10 %, 0 % and 1001 % are all sent with PUT /markup (Save stays enabled, no message); 1000 % is accepted (correct). Automated tests TC-FORM-06.`, shots: ['-10', '0', '1001'].map(v => `${S}PB2B-31-markup-${v}-save-enabled.png`) },
  { key: 'PB2B-32', text: `${A}, Q-08: the agent may ask for ANY limit (also lower than today) - not negative, at most 1,000,000.\nRetested 22 Nov 2026: a LOWER limit (1,000) cannot be sent - the button is greyed out with no message (wrong); 1,000,001 CAN be sent (wrong - above the maximum); -500 refused and 1,000,000 allowed (correct). Automated tests TC-FORM-07.`, shots: [S + 'PB2B-32-credit-limit-1000.png', S + 'PB2B-32-credit-limit-1000001.png'] },
  { key: 'PB2B-21', text: `${A}, Q-13: the ERP company time zone is used for the agent.\nRetested 22 Nov 2026: the times follow the VIEWER's computer - the same Wallet & credit transaction shows "22 Nov 2026 03:39" in a browser set to India and "22 Nov 2026 12:09" in a browser set to Kiritimati (+14). They must be identical (company time zone). Automated test TC-TZ-01.`, shots: [] },
  { key: 'PB2B-25', text: `${A}, Q-05: probably an issue in the API response - that is why flights cannot be booked. Kept open for the developers; still failing on 22 Nov 2026 (TC-SRCH-04).`, shots: [] },
  { key: 'PB2B-33', text: `${A}, Q-07: Reports must show the actual data - if not, it is a bug. Confirmed as a bug.`, shots: [] },
  { key: 'PB2B-35', text: `${A}, Q-12: confirmed as a bug - a new booking must show in Bookings immediately. Automated test TC-BOOK-05b.`, shots: [] },
  { key: 'PB2B-36', text: `${A}, Q-12: confirmed as a bug - a cancelled booking must show "Cancelled" immediately. Automated test TC-BOOK-08b.`, shots: [] },
  { key: 'PB2B-23', text: `${A}, Q-17: leave for now. Kept in the backlog, not retested.`, shots: [] },
  { key: 'PB2B-26', withdraw: true, text: `Withdrawn - not a bug. ${A}, Q-04: Cruise and Rail are not connected yet, but they are shown to an agent who has the access in the ERP. Checked in the ERP: the QA agent AG-00035 has Portal menus "All 16 on", including Cruise and Rail - so showing them is correct. Automated test TC-SRCH-06 now checks the tabs ARE shown for this agent.`, shots: [] },
  { key: 'PB2B-28', withdraw: true, text: `Withdrawn - not a bug. ${A}, Q-09: the invoice and the voucher stay available for a cancelled booking (for now). Automated test TC-BOOK-11 now checks that Service voucher and the invoices are available after a cancellation.`, shots: [] },
];

for (const it of PLAN) {
  if (DRY) { console.log(it.key, it.withdraw ? 'WITHDRAW' : 'comment', it.shots.map(s => (fs.existsSync(s) ? '' : 'MISSING ') + path.basename(s)).join(', ')); continue; }
  const files = [];
  for (const f of it.shots) {
    const form = new FormData(); form.append('file', new Blob([fs.readFileSync(f)], { type: 'image/png' }), path.basename(f));
    const r = await api('POST', `/rest/api/3/issue/${it.key}/attachments`, form, { 'X-Atlassian-Token': 'no-check' });
    if (r.ok) files.push(path.basename(f)); else console.log(`  ! attach ${f}: ${r.status}`);
  }
  const c = await api('POST', `/rest/api/3/issue/${it.key}/comment`, { body: doc(it.text + (files.length ? `\nScreenshots: ${files.join(', ')}` : '')) });
  let st = '';
  if (it.withdraw) {
    const cur = await api('GET', `/rest/api/3/issue/${it.key}?fields=labels`);
    await api('PUT', `/rest/api/3/issue/${it.key}`, { fields: { labels: [...new Set([...(cur.data?.fields?.labels ?? []), 'not-a-bug'])] } });
    const t = await api('GET', `/rest/api/3/issue/${it.key}/transitions`);
    const tr = (t.data?.transitions ?? []).find(x => x.to?.name === 'Done');
    st = tr ? ((await api('POST', `/rest/api/3/issue/${it.key}/transitions`, { transition: { id: tr.id } })).ok ? 'Done' : 'transition failed') : 'no Done transition';
  }
  console.log(`${it.key} | comment ${c.ok ? 'ok' : c.status} | ${files.length} shot(s) ${st}`);
}
