// Raises the bugs of jira/bugs.json in Jira project PB2B (type Bug): parent = module epic, component, priority,
// labels, assignee Sahil, screenshots attached. Safe to re-run (skips B2B-nnn already in Jira; map in jira/jira-map.json).
//   node --experimental-strip-types jira/raise-bugs.mjs [--only=B2B-001,B2B-002] [--dry-run]
import '../env.ts';
import fs from 'fs';
import path from 'path';

const cfg = JSON.parse(fs.readFileSync('jira/structure.json', 'utf8'));
const BASE = cfg.site, KEY = cfg.project.key;
const DRY = process.argv.includes('--dry-run');
const ONLY = process.argv.find(a => a.startsWith('--only='))?.split('=')[1].split(',');
const MAP = 'jira/jira-map.json';
const map = fs.existsSync(MAP) ? JSON.parse(fs.readFileSync(MAP, 'utf8')) : {};
const auth = 'Basic ' + Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`).toString('base64');
const api = async (method, p, body, extra = {}) => {
  const r = await fetch(BASE + p, { method, headers: { Authorization: auth, Accept: 'application/json', ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...extra },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let d; try { d = t ? JSON.parse(t) : null; } catch { d = t; } return { ok: r.ok, status: r.status, data: d };
};
const P = (...nodes) => ({ type: 'paragraph', content: nodes });
const T = (text, strong) => ({ type: 'text', text, ...(strong ? { marks: [{ type: 'strong' }] } : {}) });
const H = text => ({ type: 'heading', attrs: { level: 3 }, content: [T(text)] });
const list = text => ({ type: 'orderedList', content: text.split('\n').map(l => ({ type: 'listItem', content: [P(T(l.replace(/^\d+\.\s*/, '')))] })) });
const doc = b => ({ type: 'doc', version: 1, content: [
  P(T('Module: ', true), T(`${b.epic}  |  `), T('Screen: ', true), T(`${b.screen}  |  `), T('Type: ', true), T(`${b.type}  |  `), T('Severity: ', true), T(b.priority)),
  H('Steps to reproduce'), list(b.steps), H('Actual result'), P(T(b.actual)), H('Expected result'), P(T(b.expected)),
  P(T('Environment: ', true), T('B2B portal https://b2b.nexgenpilot.com (company "sb", QA agent AG-00035 "QA Auto B2B Agent", Chrome)  |  '), T('Found by: ', true), T(`${b.tc}  |  `), T('Bug ID: ', true), T(b.id)),
] });

// already raised?
const ex = await api('POST', '/rest/api/3/search/jql', { jql: `project = ${KEY} AND issuetype = Bug`, fields: ['summary'], maxResults: 100 });
for (const i of ex.data?.issues ?? []) { const id = i.fields.summary.match(/^(B2B-\d+):/)?.[1]; if (id) map[id] ??= { key: i.key }; }

const bugs = JSON.parse(fs.readFileSync('jira/bugs.json', 'utf8')).filter(b => !ONLY || ONLY.includes(b.id));
for (const b of bugs) {
  if (map[b.id]?.key) { console.log(`= ${b.id} already ${map[b.id].key}`); continue; }
  const epic = cfg.epics[b.epic]?.key;
  const labels = ['automation', b.type.toLowerCase().replace(/[^a-z0-9]+/g, '-'), b.component.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')];
  if (DRY) { console.log(`would raise ${b.id} -> ${epic} [${b.component}] ${b.priority} shots:${b.shots.length}`); continue; }
  const r = await api('POST', '/rest/api/3/issue', { fields: { project: { key: KEY }, issuetype: { name: 'Bug' }, summary: `${b.id}: ${b.title}`.slice(0, 250),
    description: doc(b), parent: { key: epic }, components: [{ name: b.component }], priority: { name: b.priority }, labels, assignee: { accountId: cfg.assignee } } });
  if (!r.ok) { console.log(`! ${b.id}: ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`); continue; }
  const key = r.data.key; let shots = 0;
  for (const f of b.shots) {
    if (!fs.existsSync(f)) { console.log(`  ! missing ${f}`); continue; }
    const form = new FormData(); form.append('file', new Blob([fs.readFileSync(f)], { type: 'image/png' }), `${b.id}-${path.basename(f)}`);
    const a = await api('POST', `/rest/api/3/issue/${key}/attachments`, form, { 'X-Atlassian-Token': 'no-check' }); if (a.ok) shots++;
  }
  map[b.id] = { key, url: `${BASE}/browse/${key}`, epic, component: b.component, shots };
  fs.writeFileSync(MAP, JSON.stringify(map, null, 1));
  console.log(`+ ${b.id} -> ${key} (${b.epic} / ${b.component}, ${b.priority}, ${shots} shots)`);
}
fs.writeFileSync(MAP, JSON.stringify(map, null, 1));
