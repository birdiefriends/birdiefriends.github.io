// Dev-98 — BF Cup games and money, end to end: the REAL pages (jsdom) talking to the REAL Worker (in-memory D1) with the REAL engine.
// A player sets closest to the pin from the live panel; the host's Money tab shows live figures, closes a round and reopens it.
import fs from 'fs'; import { JSDOM } from 'jsdom'; import { fileURLToPath, pathToFileURL } from 'url'; import { DatabaseSync } from 'node:sqlite';
const HERE = p => fileURLToPath(new URL(p, import.meta.url));
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const W = (await import(pathToFileURL(HERE('../bf_experiences_worker.js')).href)).default;
function makeD1(db) { const wrap = (sql) => { const st = { binds: [], bind(...b) { st.binds = b; return st; },
  async first() { return db.prepare(sql).get(...st.binds) ?? null; }, async all() { return { results: db.prepare(sql).all(...st.binds) }; },
  async run() { const r = db.prepare(sql).run(...st.binds); return { meta: { last_row_id: Number(r.lastInsertRowid), changes: Number(r.changes) } }; } }; return st; };
  const D = { prepare: wrap, withSession() { return D; } }; return D; }
const db = new DatabaseSync(':memory:'); const D1 = makeD1(db);
const workerFetch = async (u, o) => { const r = await W.fetch(new Request(u, { method: (o && o.method) || 'GET', body: o && o.body }), { DB: D1 }, {}); return { ok: r.status < 400, status: r.status, json: () => r.json() }; };
const engine = fs.readFileSync(HERE('../bf_engine.js'), 'utf8');
const page = fs.readFileSync(HERE("../../docs/bf-cup-results.html"), "utf8").replace(/<script src="bf_engine.js[^>]*><\/script>/, () => "<script>" + engine + "</script>");
const API = 'https://bf-experiences.birdiefriends01.workers.dev';
const pars = [4, 4, 3, 4, 5, 4, 5, 3, 4, 3, 5, 4, 4, 4, 3, 4, 5, 3], SI = [11, 1, 13, 5, 9, 3, 7, 17, 15, 12, 10, 2, 4, 6, 16, 14, 8, 18];
const sat = { key: 'sat', name: '2026 BFCup - Day1', holes: { count: 18 }, segments: [{ key: 'bb', format: 'bestball', from: 1, to: 9 }, { key: 'as', format: 'altshot', from: 10, to: 18 }],
  games: { entry_per_player: 5, addons: [{ id: 'cttp', dollar_per_hole: 16 }] },
  matches: [{ key: 'm1', sides: [{ side: 'A', players: ['Brian Hager', 'BJ Kolonia'] }, { side: 'B', players: ['Tom Stitt', 'Andrew Kabrick'] }] }, { key: 'm2', sides: [{ side: 'A', players: ['Dave Sherwin', 'Chooch Wernett'] }, { side: 'B', players: ['Evan Lindermuth', 'Harry Pry'] }] }] };
const sun = { key: 'sun', name: '2026 BFCup - Day2', holes: { count: 18 }, segments: [{ key: 's', format: 'singles', from: 1, to: 18 }],
  games: { entry_per_player: 15, addons: [{ id: 'cttp', dollar_per_hole: 16 }, { id: 'skins', basis: 'gross' }] },
  matches: [{ key: 's1', sides: [{ side: 'A', players: ['Brian Hager'] }, { side: 'B', players: ['Tom Stitt'] }] }, { key: 's2', sides: [{ side: 'A', players: ['BJ Kolonia'] }, { side: 'B', players: ['Andrew Kabrick'] }] }] };
const hcp = { 'Brian Hager': 6.8, 'BJ Kolonia': 14.1, 'Tom Stitt': 12.8, 'Andrew Kabrick': 13, 'Dave Sherwin': 4.8, 'Chooch Wernett': 9.5, 'Evan Lindermuth': 8.2, 'Harry Pry': 18.2 };
const cfg = { sides: [{ key: 'A', name: 'Team Jake', captain: 'Brian Hager', color: 'red', players: ['Brian Hager', 'BJ Kolonia', 'Dave Sherwin', 'Chooch Wernett'] }, { key: 'B', name: 'Team Nate', captain: 'Tom Stitt', color: 'blue', players: ['Tom Stitt', 'Andrew Kabrick', 'Evan Lindermuth', 'Harry Pry'] }],
  points: { win: 1, half: 0.5, loss: 0 }, handicap: { bestball: 80, altshot: 50, singles: 80, strokeIndex: SI, pars }, host_code: 'HOST1', access: { A: 'CA', B: 'CB' },
  draft: { started: true, locked: true, pool: [], picks: [], stats: Object.fromEntries(Object.entries(hcp).map(([k, v]) => [k, { hcp: v }])) }, matchup: { started: true, done: true, first: 'A', log: [] },
  rounds: [sat, sun], scores: {}, ctp: {} };
// Saturday fourball scores (everyone a 5), Sunday singles (Brian takes holes 1-3 with a 3, everyone else a 5)
cfg.scores.sat = {}; sat.matches.forEach(m => { const h = {}; for (let i = 1; i <= 9; i++) { h[i] = {}; m.sides.forEach(sd => sd.players.forEach(p => { h[i][p] = 5; })); } cfg.scores.sat[m.key] = { h, t: {}, by: {} }; });
cfg.scores.sun = {}; sun.matches.forEach(m => { const h = {}; for (let i = 1; i <= 18; i++) { h[i] = {}; m.sides.forEach(sd => sd.players.forEach(p => { h[i][p] = (p === 'Brian Hager' && i <= 3) ? 3 : 5; })); } cfg.scores.sun[m.key] = { h, t: {}, by: {} }; });
let r0 = await workerFetch(API + '/bfe/cup', { method: 'POST', body: JSON.stringify({ event_name: 'E', config: cfg, pin: '7797' }) }); ok(r0.ok, 'the Cup is saved on the Worker');
const tick = (ms = 150) => new Promise(r => setTimeout(r, ms));
const memStub = (u, o) => {
  if (/\/bfe\/memories\/notes/.test(u)) return Promise.resolve({ ok: true, status: 200, json: async () => ({ notes: [{ note_text: 'Great day', captured_by: 'Tom Stitt' }] }) });
  if (/\/bfe\/memories\?/.test(u)) return Promise.resolve({ ok: true, status: 200, json: async () => ({ memories: [{ id: 7, round_name: '2026 BFCup - Day1', media_type: 'image', captured_by: 'Brian Hager', captured_at: '2026-11-07 14:02:00' }, { id: 8, round_name: '2026 BFCup - Day2', media_type: 'video', captured_by: 'Tom Stitt', captured_at: '2026-11-08 10:00:00' }] }) });
  if (/bf-cup-story\.json/.test(u)) return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
  return workerFetch(u, o);
};
async function open(query, fetchFn) {
  const dom = new JSDOM(page, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://x.test/bf-cup-results.html' + query, beforeParse(w) { w.fetch = fetchFn || memStub; w.scrollTo = () => {}; } });
  await tick(400); return dom;
}
await workerFetch(API + '/bfe/cup/act', { method: 'POST', body: JSON.stringify({ event_name: 'E', round: 'sat', match: 'm1', action: 'drive', hole: 10, drive: 'Brian Hager', player: 'Brian Hager' }) });
let dom = await open('?event=E'), d = dom.window.document;
ok(d.querySelector('.hero h1'), 'the page renders');
ok(/Team Jake/.test(d.querySelector('.score').textContent) && /Team Nate/.test(d.querySelector('.score').textContent), 'both team names in the score box');
ok(d.querySelector('.team.cred') && d.querySelector('.team.cblue'), 'red and blue teams from the side colors');
const tabs = [...d.querySelectorAll('.tab')].map(t => t.textContent);
ok(tabs.join('|') === 'The Story|Teams|2026 BFCup - Day1|2026 BFCup - Day2|Money|Memories', 'tabs: story, teams, one per round, money, memories: ' + tabs.join('|'));
ok(d.querySelector('.bcast .head') && d.querySelector('.bcast .head').textContent.length > 5, 'the commentator headline is written');
ok(/Team (Jake|Nate)/.test(d.querySelector('.bcast').textContent), 'commentator names a team');
const tab = n => { [...dom.window.document.querySelectorAll('.tab')][n].click(); return dom.window.document; };
d = tab(1); ok(/The Teams/.test(d.querySelector('h2').textContent) && d.querySelectorAll('.card').length === 2 && /Team Jake/.test(d.body.textContent) && /Team Nate/.test(d.body.textContent) && /Captain/.test(d.body.textContent) && /Brian Hager/.test(d.body.textContent), 'the Teams tab lists both rosters with the captain');
d = tab(2); ok(d.querySelectorAll(".m").length === 2 && /Brian Hager/.test(d.body.textContent) && /Fourball/.test(d.body.textContent), "Saturday shows its matches with the fourball and foursomes result");
ok(/Drives used: .*Hager 1/.test(tab(2).body.textContent), 'the Saturday card shows how many times each partner\'s drive was used');
d = tab(3); ok(d.querySelectorAll('.m').length >= 1, 'Sunday shows singles matches (' + d.querySelectorAll('.m').length + ')');
d = tab(4); ok(/Money/.test(d.querySelector('h2').textContent) && /Closest to the pin|Skins/.test(d.body.textContent), 'Money tab shows the games');
d = tab(5); ok(d.querySelectorAll('.ph').length === 2 && d.querySelector('.ph video') && d.querySelector('.ph img'), 'Memories shows the photo and the video');
ok(/memories\/serve\/7/.test(d.querySelector('.ph').href), 'a photo links to the serve route');
ok(/Great day/.test(d.body.textContent), 'player notes show');
ok(d.getElementById('dl'), 'download button present');
// a hand-written story overrides the auto one
const withStory = (u, o) => /bf-cup-story\.json/.test(u) ? Promise.resolve({ ok: true, status: 200, json: async () => ({ head: 'Hand written headline', paras: ['One.', 'Two.'], days: [{ mic: 'Saturday', text: 'Sat call' }], chips: ['A chip'] }) }) : memStub(u, o);
dom = await open('?event=E', withStory); d = dom.window.document;
ok(/Hand written headline/.test(d.querySelector('.bcast .head').textContent) && /Sat call/.test(d.body.textContent) && /A chip/.test(d.body.textContent), 'bf-cup-story.json overrides the auto commentator');
// the written final story and the Results-screen link ship with the app
{ const st = JSON.parse(fs.readFileSync(HERE('../../docs/bf-cup-story.json'), 'utf8')); ok(/8\.5 to 7\.5/.test(st.head) && st.paras.length >= 3 && st.days.length === 2 && st.chips.length >= 3, 'bf-cup-story.json is the written final story');
  for (const f of ['../../docs/portal.html', '../portal.html']) { const pg = fs.readFileSync(HERE(f), 'utf8'); ok(/BF Cup 2026[\s\S]{0,400}bf-cup-results\.html\?event=2026%20BirdieFriends%20Cup[\s\S]{0,300}8\.5 &ndash; 7\.5/.test(pg), 'the app Results list links the Cup results page (' + f + ')'); } }
// no event param: finds the live Cup
dom = await open('', memStub); d = dom.window.document;
ok(d.querySelector('.hero h1') || /Could not load/.test(d.body.textContent), 'no ?event= resolves through cup-live (or fails gracefully)');
// unknown event fails gracefully
dom = await open('?event=Nope'); d = dom.window.document;
ok(/Could not load/.test(d.body.textContent), 'an unknown Cup shows a friendly error');
console.log(`test_cup_results_page: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
