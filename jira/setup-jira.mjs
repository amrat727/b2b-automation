// Creates the module EPICS and sub-module COMPONENTS of jira/structure.json in Jira project PB2B (Pilot-B2B).
// Safe to re-run (existing epics / components are kept). Writes the epic keys back into jira/structure.json.
// Credentials: JIRA_EMAIL / JIRA_API_TOKEN from .env (falls back to ../erp-automation/.env).   node jira/setup-jira.mjs
import '../env.ts';
import fs from 'fs';

const cfg = JSON.parse(fs.readFileSync('jira/structure.json', 'utf8'));
const BASE = cfg.site, KEY = cfg.project.key;
const auth = 'Basic ' + Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`).toString('base64');
const api = async (method, p, body) => {
  const r = await fetch(BASE + p, { method, headers: { Authorization: auth, Accept: 'application/json', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let d; try { d = t ? JSON.parse(t) : null; } catch { d = t; } return { ok: r.ok, status: r.status, data: d };
};
if (!process.env.JIRA_API_TOKEN) { console.error('JIRA_EMAIL / JIRA_API_TOKEN missing'); process.exit(1); }

// existing epics + components
const ep = await api('POST', '/rest/api/3/search/jql', { jql: `project = ${KEY} AND issuetype = Epic`, fields: ['summary'], maxResults: 100 });
const epics = Object.fromEntries((ep.data?.issues ?? []).map(i => [i.fields.summary, i.key]));
const comps = new Set(((await api('GET', `/rest/api/3/project/${KEY}/components`)).data ?? []).map(c => c.name));

for (const [name, e] of Object.entries(cfg.epics)) {
  if (!epics[name]) {
    const desc = { type: 'doc', version: 1, content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Module epic - every B2B portal bug of this module is a child of this epic.', marks: [{ type: 'strong' }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: `Portal page: ${e.route ? 'https://b2b.nexgenpilot.com' + e.route : 'several screens'}` }] },
      { type: 'paragraph', content: [{ type: 'text', text: `Components: ${e.components.join(' · ')}` }] }] };
    const r = await api('POST', '/rest/api/3/issue', { fields: { project: { key: KEY }, issuetype: { name: 'Epic' }, summary: name, description: desc, labels: ['module'] } });
    if (!r.ok) { console.log(`! epic ${name}: ${r.status} ${JSON.stringify(r.data).slice(0, 200)}`); continue; }
    epics[name] = r.data.key; console.log(`+ epic ${name} -> ${r.data.key}`);
  } else console.log(`= epic ${name} (${epics[name]})`);
  e.key = epics[name];
  for (const c of e.components) {
    if (comps.has(c)) continue;
    const r = await api('POST', '/rest/api/3/component', { project: KEY, name: c });
    console.log(r.ok ? `  + ${c}` : `  ! ${c}: ${r.status} ${JSON.stringify(r.data).slice(0, 150)}`);
  }
}
fs.writeFileSync('jira/structure.json', JSON.stringify(cfg, null, 1));
console.log(`epics: ${Object.keys(epics).length}, components wanted: ${Object.values(cfg.epics).flatMap(e => e.components).length}`);
