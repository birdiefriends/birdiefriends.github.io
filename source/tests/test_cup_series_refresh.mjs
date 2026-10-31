// BF Cup — Start the draft re-reads the roster handicaps and the published series first, and flags a missing Series #N (real page in jsdom, fake Worker).
import fs from 'fs'; import { JSDOM } from 'jsdom'; import { fileURLToPath } from 'url';
const HERE = p => fileURLToPath(new URL(p, import.meta.url));
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const engine = fs.readFileSync(HERE('../bf_engine.js'), 'utf8');
const page = fs.readFileSync(HERE('../../docs/bf-cup-draft.html'), 'utf8').replace(/<script src="bf_engine.js[^>]*><\/script>/, '<script>' + engine + '</script>').replace(/<script src="bf_live_match.js[^>]*><\/script>/, '');
const ev = (n, date, scores) => ({ name: '2026 BFSeries#' + n, date, season: 2026, scores });
const mkSeries = (nums) => {
  const events = nums.map((n, i) => ev(n, '2026-10-' + (10 + i), { Ann: [0,1,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0], Bob: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] }));
  const hist = { Ann: { events: nums.map((n, i) => ({ event: '2026 BFSeries#' + n, result: 2 + i })) }, Bob: { events: nums.map((n, i) => ({ event: '2026 BFSeries#' + n, result: -1 })) } };
  return 'x<script>\nconst ALL_SERIES_DATA = ' + JSON.stringify({ events, playerHistory: hist }) + ';\n</script>';
};
let published = mkSeries([8, 9]), rosterHcp = 10, doc, confirmMsgs = [], confirmAnswer = false;
const reset = () => { doc = { sides: [{ key: 'A', name: 'A', captain: 'Ann', color: 'red', players: [] }, { key: 'B', name: 'B', captain: 'Bob', color: 'blue', players: [] }], points: { win: 1, half: 0.5, loss: 0 }, rounds: [], pool: ['Cy', 'Di'], draft: { pool: ['Cy', 'Di'], first: 'A', stats: {}, expectSeries: 10 } }; };
reset();
const J = (x, status = 200) => ({ ok: status < 400, status, json: async () => x, text: async () => '' });
const fakeFetch = async (u, o) => {
  if (/results\.html/.test(u)) return { ok: true, status: 200, text: async () => published };
  if (/\/bfe\/events\?event=/.test(u)) return J({ config: { roster: [{ name: 'Cy', hcp: rosterHcp }, { name: 'Di', hcp: 14 }, { name: 'Ann', hcp: 5 }, { name: 'Bob', hcp: 7 }] } });
  if (o && o.method === 'POST') { const b = JSON.parse(o.body); doc = b.config; return J({ ok: true }); }
  return J({ ok: true, config: JSON.parse(JSON.stringify(doc)) });
};
const open = async () => { const dom = new JSDOM(page, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://x.test/bf-cup-draft.html?host=1',
  beforeParse(w) { w.fetch = fakeFetch; w.sessionStorage.setItem('bf_cup_pin', '7797'); w.confirm = (m) => { confirmMsgs.push(m); return confirmAnswer; }; } });
  await tick(200); return dom; };
const tick = ms => new Promise(r => setTimeout(r, ms));

let dom = await open(); let d = dom.window.document; if (process.env.DBG) console.log(d.body.textContent.slice(0,900), JSON.stringify(doc.draft));
ok(/through #9/.test(d.body.textContent) && /#10/.test(d.body.textContent) && /NOT published/.test(d.body.textContent), 'banner: stats are through #9, expected #10 is flagged as not published');
// Brian updates the handicap in the event roster after the page is already open, and the draft is started
rosterHcp = 11;
d.getElementById('startDraft').click(); await tick(200);
ok(confirmMsgs.length === 1 && /#9/.test(confirmMsgs[0]) && /#10/.test(confirmMsgs[0]), 'Start asks before using stale series (#9 but #10 expected)');
ok(!doc.draft.started, 'declining keeps the draft from starting');
ok(doc.draft.stats.Cy && doc.draft.stats.Cy.hcp === 11, 'the roster handicap was re-read at Start (10 -> 11)');
// #10 gets published; Start now goes straight through with fresh stats
published = mkSeries([8, 9, 10]); confirmMsgs = [];
d = dom.window.document; d.getElementById('startDraft').click(); await tick(250);
ok(confirmMsgs.length === 0 && doc.draft.started, 'with #10 published, Start does not ask and the draft opens');
ok(doc.draft.seriesThrough && doc.draft.seriesThrough.num === 10, 'the saved stats record they are through #10');
ok(doc.draft.stats.Ann && doc.draft.stats.Ann.avg === 3, 'Ann\'s average now includes #10 (2,3,4 -> 3)');
// no expectation set: never asks
reset(); delete doc.draft.expectSeries; published = mkSeries([8, 9]); confirmMsgs = [];
dom = await open(); d = dom.window.document; d.getElementById('startDraft').click(); await tick(250);
ok(confirmMsgs.length === 0 && doc.draft.started, 'with no expected series the draft starts without a question');
// accepting the warning starts anyway
reset(); published = mkSeries([8, 9]); confirmMsgs = []; confirmAnswer = true;
dom = await open(); d = dom.window.document; d.getElementById('startDraft').click(); await tick(250);
ok(confirmMsgs.length === 1 && doc.draft.started, 'OK on the warning starts the draft with the older stats');
console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
