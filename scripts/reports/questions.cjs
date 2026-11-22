/*
 * B2B portal - open questions for the product owner (understanding gaps found while testing).
 *   node scripts/reports/questions.cjs   ->  reports/B2B-Questions.xlsx
 * Answers typed into the "Answer" column of an existing file are kept when the file is rebuilt.
 */
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, '..', '..', 'reports', 'B2B-Questions.xlsx');

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

(async () => {
  // keep answers already typed in an existing file
  const old = {};
  if (fs.existsSync(OUT)) {
    const wb0 = new ExcelJS.Workbook(); await wb0.xlsx.readFile(OUT);
    wb0.getWorksheet('Questions')?.eachRow((r, i) => { if (i > 1) old[r.getCell(1).text] = { a: r.getCell(7).text, by: r.getCell(8).text, d: r.getCell(9).text }; });
  }
  const wb = new ExcelJS.Workbook(); wb.creator = 'QA Automation (Playwright)';
  const ws = wb.addWorksheet('Questions', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    { header: 'Q-ID', width: 7 }, { header: 'Module', width: 22 }, { header: 'Question', width: 60 }, { header: 'What we saw', width: 55 },
    { header: 'Our assumption until answered', width: 38 }, { header: 'Related Jira', width: 16 }, { header: 'Answer', width: 50 }, { header: 'Answered by', width: 16 }, { header: 'Date', width: 12 },
  ];
  ws.getRow(1).eachCell(c => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } }; c.alignment = { vertical: 'middle', wrapText: true }; });
  for (const q of Q) {
    const o = old[q[0]] ?? {};
    const row = ws.addRow([...q, o.a ?? '', o.by ?? '', o.d ?? '']);
    row.alignment = { vertical: 'top', wrapText: true };
    row.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
  }
  ws.autoFilter = { from: 'A1', to: `I${Q.length + 1}` };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  await wb.xlsx.writeFile(OUT);
  console.log(`Written ${OUT}: ${Q.length} questions`);
})();
