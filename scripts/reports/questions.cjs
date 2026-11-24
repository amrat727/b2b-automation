/*
 * B2B portal - open questions for the product owner (understanding gaps found while testing).
 *   node scripts/reports/questions.cjs   ->  reports/B2B-Questions/B2B-Questions.xlsx (+ screenshots/, one per question)
 * Answers typed into the "Answer" column of an existing file are kept when the file is rebuilt.
 */
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, '..', '..', 'reports', 'B2B-Questions', 'B2B-Questions.xlsx');
const OLD = path.join(__dirname, '..', '..', 'reports', 'B2B-Questions.xlsx'); // earlier single file (answers are carried over)

const Q = [
  ['Q-01', 'Markup', 'What range may a markup have? Can it be negative or 0, and is there a maximum (%) or a cap in AED?',
    'Markup > My customers accepts -10 % and 1000 % and sends them to Save.', 'Assumed: never below 0; a business maximum should exist.', 'PB2B-31'],
  ['Q-02', 'Search & Book / Hotels', 'Does the early-bird discount apply to the room rate only, or also to the meal supplement (half / full board)?',
    'Marina Bay 3 nights: the saving is AED 388.80 on breakfast, half board AND full board - so meals get no discount.', 'Assumed: room only (matches the offer text "15% off the room rate").', '-'],
  ['Q-03', 'Bookings / Cancellation', 'Which charge applies ON a boundary day of the cancellation table (e.g. 7 Jan: "no charge" or 25 %)? Is the last free day 6 Jan or 7 Jan?',
    'Header says "Free cancellation until 6 Jan"; the table has rows Booking -> 7 Jan no charge and 7 Jan -> 14 Jan 25 %.', 'Assumed: until 6 Jan free, from 7 Jan 25 % (contract: 8-14 days before = 25 %).', 'PB2B-22'],
  ['Q-04', 'Search & Book', 'Should Cruise and Rail be visible to agents while booking is not connected (tabs, home tiles, sponsored deals, module access)?',
    'Both say "booking isn\'t connected yet"; a sponsored "Europe by rail" deal is still shown.', 'Assumed: hide them or mark them "on request".', 'PB2B-26'],
  ['Q-05', 'Search & Book / Flights', 'Is the flight supplier supposed to work on this environment (sandbox)? If yes, which route / dates should a test use?',
    'Every flight search ends with "The supplier couldn\'t complete this request" (502).', 'Raised as a bug; tests mark it as known.', 'PB2B-25'],
  ['Q-06', 'Search & Book / Checkout', 'How long is a room held at "Secure payment" before it is released, and should an agent be able to come back to an unpaid hold (e.g. from Bookings or the cart)?',
    'Hold said "Complete payment by ... 02:02" (about 30 min); leaving the page made the hold disappear (a notification said it expired and nothing was charged).', 'Assumed: 30 min, no resume - please confirm.', '-'],
  ['Q-07', 'Reports', 'Are the "Sample figures" in Reports > Product-line performance an intended placeholder for now? When will real reporting be connected?',
    'Fixed margins incl. a Visa line are shown for an agent without completed bookings; Export does nothing.', 'Raised as a bug.', 'PB2B-33'],
  ['Q-08', 'Wallet & Credit', 'Credit-limit request: is there a maximum an agent can ask for, and may an agent request a LOWER limit?',
    'New limit 0 / negative / below 50,000 only disables the button; the form is pre-filled with 75,000.', 'Assumed: must be higher than the current limit.', 'PB2B-32'],
  ['Q-09', 'Bookings / Documents', 'Which documents should stay available for a CANCELLED booking (credit note, invoice, voucher, confirmation)?',
    'Voucher and booking confirmation can still be produced for a cancelled booking; Receipt is disabled.', 'Assumed: credit note yes, voucher / confirmation no.', 'PB2B-28'],
  ['Q-10', 'Users', 'What can each agent role do (Super Admin, Admin, Agent)? E.g. may the Agent role cancel / modify bookings, see Wallet & credit, add users?',
    'Users page: "Super Admins and Admins cancel and change bookings directly; the Agent role does when our team allows it."', 'Not tested yet - needs a second login with the Agent role.', '-'],
  ['Q-11', 'Sub-agents / Users', 'May the tests create a QA sub-agent and a QA user (names "QA Auto ...", deactivated afterwards)? Both need a password: please set one yourself or tell us how to handle it.',
    'Add sub-agent / Add user were only checked with the save blocked; no account was created.', 'Until answered: forms are checked read-only.', '-'],
  ['Q-12', 'Bookings', 'Is a delay expected before a new or cancelled booking shows correctly in Bookings (list / detail)?',
    'New booking missing until reload; after cancelling, the page still showed Confirmed / Still to pay AED 2,203.20 for over a minute.', 'Raised as bugs.', 'PB2B-35, PB2B-36'],
  ['Q-13', 'Cross-module', 'Which time zone should all dates use (company UAE, the agent\'s own, or UTC)?',
    'Bookings say "Booked 21 Nov", Wallet and History say "22 Nov 01:32" for the same booking (booked after midnight India time).', 'Assumed: the company / agent time zone everywhere.', 'PB2B-21'],
  ['Q-14', 'Wallet & Credit / Checkout', 'Should the QA agent also get a wallet balance (and are Razorpay / Stripe in TEST mode) so the wallet and card payment paths can be tested?',
    'Wallet AED 0.00 ("online top-ups aren\'t enabled"); only the credit-line payment was tested.', 'Until answered: credit line only.', '-'],
  ['Q-15', 'Search & Book / Hotels', 'The hotel search opens with dates 7 days ahead (29 Nov - 1 Dec). Is that the intended default? (That stay is inside the 50 % cancellation window.)',
    'Default dates = today + 7 days, 2 nights.', 'No change assumed - please confirm.', '-'],
  ['Q-16', 'Search & Book / Flights', 'Typing "Dubai" as origin picks DWC (Al Maktoum) first instead of DXB. Is that the intended order?',
    'First option for "Dubai" was DWC.', 'Assumed: DXB should come first - please confirm.', '-'],
  ['Q-17', 'UI text', 'Do the ERP UI-text rules also apply to the portal: buttons and menu items in Title Case, dialog title and button worded the same?',
    'Portal uses sentence case ("Add user", "New booking", "Search & book"); dialog "Add a user" vs button "Add user".', 'Assumed yes (raised as a low bug).', 'PB2B-23'],
];

// screenshot per question (from the test runs in screenshots/; Q-16 from scripts/probes/capture-question-shots.mjs)
const SHOTS = {
  "Q-01": "forms/markup--10.png",
  "Q-02": "book/02-rooms.png",
  "Q-03": "book/05-checkout-cancellation.png",
  "Q-04": "search/Rail-results.png",
  "Q-05": "search/Flights-results.png",
  "Q-06": "journey/03-after-pay.png",
  "Q-07": "other/reports.png",
  "Q-08": "forms/credit-request-0.png",
  "Q-09": "bookings/Documents.png",
  "Q-10": "other/users.png",
  "Q-11": "sweep/Sub_agents-form.png",
  "Q-12": "evidence/B2B-019-cancelled-booking-still-confirmed.png",
  "Q-13": "journey/24-finance-after-cancel.png",
  "Q-14": "sweep/Wallet_credit.png",
  "Q-15": "sweep/Search_hotels.png",
  "Q-16": null,
  "Q-17": "sweep/Users-form.png"
};
const DIR = path.dirname(OUT), SHOT_DIR = path.join(DIR, 'screenshots');

(async () => {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  // keep answers already typed (new file, or the old single file reports/B2B-Questions.xlsx)
  const old = {};
  for (const f of [OLD, OUT].filter(fs.existsSync)) {
    const wb0 = new ExcelJS.Workbook(); await wb0.xlsx.readFile(f);
    const ws0 = wb0.getWorksheet('Questions');
    const ansCol = f === OLD ? 7 : 7, first = f === OLD ? 2 : 5;
    ws0?.eachRow((r, i) => { if (i >= first && /^Q-d+/.test(r.getCell(1).text) && r.getCell(ansCol).text) old[r.getCell(1).text] = { a: r.getCell(ansCol).text, by: r.getCell(ansCol + 3).text }; });
  }
  const font = { name: 'Arial', size: 10 };
  const border = { top: { style: 'thin', color: { argb: 'FFBFBFBF' } }, left: { style: 'thin', color: { argb: 'FFBFBFBF' } }, bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } }, right: { style: 'thin', color: { argb: 'FFBFBFBF' } } };
  const wb = new ExcelJS.Workbook(); wb.creator = 'QA Automation (Playwright)';
  const ws = wb.addWorksheet('Questions', { views: [{ state: 'frozen', xSplit: 2, ySplit: 4 }] });
  ws.columns = [{ width: 8 }, { width: 20 }, { width: 46 }, { width: 38 }, { width: 30 }, { width: 14 }, { width: 40 }, { width: 60 }, { width: 30 }, { width: 14 }];
  ws.mergeCells('A1:J1'); ws.getCell('A1').value = 'Pilot B2B Agent Portal - questions for the product owner'; ws.getCell('A1').font = { name: 'Arial', size: 14, bold: true };
  ws.mergeCells('A2:J2'); ws.getCell('A2').value = 'Date: 22-Nov-2026   |   Please write your answer in the yellow "Your answer" column. Each answer becomes new automated test scenarios.';
  ws.getCell('A2').font = { ...font, italic: true, color: { argb: 'FF595959' } };
  const hr = ws.getRow(4);
  ['ID', 'Module', 'Question', 'What we saw', 'Our assumption until answered', 'Related Jira', 'Your answer', 'Screenshot', 'Screenshot file', 'Answered by'].forEach((h, i) => { const c = hr.getCell(i + 1); c.value = h; c.font = { ...font, bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } }; c.border = border; c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }; });
  Q.forEach((q, i) => {
    const r = ws.getRow(5 + i);
    // screenshot: copy next to the workbook as Q-NN-<name>.png so the link works
    let name = fs.readdirSync(SHOT_DIR).find(f => f.startsWith(q[0] + '-'));
    if (SHOTS[q[0]]) { name = `${q[0]}-${path.basename(SHOTS[q[0]]).replace(/^[-_]+/, '')}`; fs.copyFileSync(path.join(__dirname, '..', '..', 'screenshots', SHOTS[q[0]]), path.join(SHOT_DIR, name)); }
    const o = old[q[0]] ?? {};
    r.values = [...q, o.a ?? '', name ? '' : 'no screenshot', name ?? '-', o.by ?? ''];
    r.eachCell({ includeEmpty: true }, (c, col) => { c.font = font; c.border = border; c.alignment = { vertical: 'top', wrapText: true, horizontal: col === 1 ? 'center' : 'left' }; });
    r.getCell(1).font = { ...font, bold: true };
    r.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
    if (name) {
      r.height = 200;
      ws.addImage(wb.addImage({ filename: path.join(SHOT_DIR, name), extension: 'png' }), { tl: { col: 7.05, row: 4 + i + 0.05 }, ext: { width: 410, height: 260 }, editAs: 'oneCell' });
      r.getCell(9).value = { text: name, hyperlink: `screenshots/${name}` };
      r.getCell(9).font = { ...font, color: { argb: 'FF0563C1' }, underline: true };
    } else r.height = 90;
  });
  await wb.xlsx.writeFile(OUT);
  console.log(`Written ${OUT}: ${Q.length} questions, ${fs.readdirSync(SHOT_DIR).length} screenshots`);
})();
