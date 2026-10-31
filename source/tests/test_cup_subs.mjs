// BF Cup — a Substitute is never drafted: kept out of the pool, still gets stats, odd pool is flagged (real page in jsdom, fake Worker).
import fs from 'fs'; import { JSDOM } from 'jsdom'; import { fileURLToPath } from 'url';
const HERE = p => fileURLToPath(new URL(p, import.meta.url));
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const engine = fs.readFileSync(HERE('../bf_engine.js'), 'utf8');
const page = fs.readFileSync(HERE('../../docs/bf-cup-draft.html'), 'utf8').replace(/<script src="bf_engine.js[^>]*><\/script>/, '<script>' + engine + '</script>').replace(/<script src="bf_live_match.js[^>]*><\/script>/, '');
const roster = ['Jake', 'Nate', 'P1', 'P2', 'P3', 'P4', 'Sub Guy'].map((n, i) => ({ name: n, hcp: 5 + i }));
let doc = { sides: [{ key: 'A', name: 'A', captain: 'Jake', color: 'red', players: [] }, { key: 'B', name: 'B', captain: 'Nate', color: 'blue', players: [] }], points: { win: 1, half: 0.5, loss: 0 }, rounds: [], draft: { stats: {} } };
const J = (x, st = 200) => ({ ok: st < 400, status: st, json: async () => x, text: async () => '' });
const fakeFetch = async (u, o) => {
  if (/results\.html/.test(u)) return { ok: true, text: async () => '' };
  if (/\/bfe\/events\?event=/.test(u)) return J({ config: { roster } });
  if (o && o.method === 'POST') { doc = JSON.parse(o.body).config; return J({ ok: true }); }
  return J({ ok: true, config: JSON.parse(JSON.stringify(doc)) });
};
const tick = ms => new Promise(r => setTimeout(r, ms));
const bannerText = d => [...d.querySelectorAll('.banner')].map(b => b.textContent).join(' | ');
const dom = new JSDOM(page, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://x.test/bf-cup-draft.html?host=1',
  beforeParse(w) { w.fetch = fakeFetch; w.sessionStorage.setItem('bf_cup_pin', '7797'); w.confirm = () => true; } });
await tick(250); let d = dom.window.document;
ok(doc.draft.pool.length === 7 && /odd number/.test(bannerText(d)), 'all 7 roster names load into the pool, and the odd count is flagged');
d.getElementById('subsTxt').value = 'sub guy'; d.getElementById('poolSave').click(); await tick(150); d = dom.window.document;
ok(doc.draft.subs.join() === 'sub guy' && doc.draft.pool.indexOf('Sub Guy') < 0 && doc.draft.pool.length === 6, 'saving the Sub (any case) takes him out of the pool');
ok(!/odd number/.test(bannerText(d)), 'no odd-count warning once the Sub is out');
ok(/\(Sub\)/.test(d.querySelector('table').textContent), 'the stats table marks him (Sub)');
d.getElementById('loadRoster').click(); await tick(200);
ok(doc.draft.pool.indexOf('Sub Guy') < 0 && doc.draft.pool.length === 6, 'reloading the roster does not put the Sub back');
ok(doc.draft.stats['Sub Guy'] && doc.draft.stats['Sub Guy'].hcp === 11, 'the Sub still gets his handicap');
console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
