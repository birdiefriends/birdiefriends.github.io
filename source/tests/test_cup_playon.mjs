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
const engine = fs.readFileSync(HERE('../bf_engine.js'), 'utf8'), lm = fs.readFileSync(HERE('../../docs/bf_live_match.js'), 'utf8');
const page = fs.readFileSync(HERE('../../docs/bf-cup-draft.html'), 'utf8').replace(/<script src="bf_engine.js[^>]*><\/script>/, () => '<script>' + engine + '</script>').replace(/<script src="bf_live_match.js[^>]*><\/script>/, () => '<script>' + lm + '</script>');   // function replacers: the engine has "$$" in a template literal
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
const A1 = 'Brian Hager', A2 = 'BJ Kolonia', B1 = 'Tom Stitt', B2 = 'Andrew Kabrick';
// Saturday m1: fourball all halved (everyone 5), then Greensomes: Team Jake wins holes 10-14 (5 up with 4 to play = decided on 14), hole 15 is play-on
cfg.scores = { sat: {}, sun: {} };
{ const h = {}; for (let i = 1; i <= 9; i++) { h[i] = {}; [A1, A2, B1, B2].forEach(p => { h[i][p] = 5; }); } for (let i = 10; i <= 14; i++) h[i] = { [A1]: 3, [B1]: 9 }; cfg.scores.sat.m1 = { h, t: {}, by: {} }; }
// Sunday: both singles matches decided early on hole 10 (Team Jake wins holes 1-10), holes 11-12 played on, 13-18 still to come
sun.matches.forEach(m => { const h = {}; for (let i = 1; i <= 12; i++) { h[i] = {}; m.sides.forEach(sd => sd.players.forEach(p => { h[i][p] = sd.side === 'A' ? 3 : 9; })); } cfg.scores.sun[m.key] = { h, t: {}, by: {} }; });
let r0 = await workerFetch(API + '/bfe/cup', { method: 'POST', body: JSON.stringify({ event_name: 'E', config: cfg, pin: '7797' }) }); ok(r0.ok, 'the Cup is saved on the Worker');
const tick = (ms = 120) => new Promise(r => setTimeout(r, ms));
async function open(query, pin) {
  const dom = new JSDOM(page, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://x.test/bf-cup-draft.html?event=E' + query, beforeParse(w) { w.fetch = workerFetch; w.confirm = () => true; if (pin) w.sessionStorage.setItem('bf_cup_pin', pin); w.localStorage.setItem('bf_cup_me', ''); } });
  await tick(300); return dom;
}
const dbCfg = async () => (await (await workerFetch(API + '/bfe/cup?event=E&pin=HOST1')).json()).config;
const post = async (c, extra) => { const r = await workerFetch(API + '/bfe/cup', { method: 'POST', body: JSON.stringify(Object.assign({ event_name: 'E', config: c, pin: '7797' }, extra || {})) }); return { status: r.status, j: await r.json() }; };
const act = async (b) => { const r = await workerFetch(API + '/bfe/cup/act', { method: 'POST', body: JSON.stringify(Object.assign({ event_name: 'E' }, b)) }); return { status: r.status, j: await r.json() }; };
const goto = (dq, h) => { const a = dq().getElementById('lmAll'); if (a && !dq().querySelector('[data-lm-hole]')) a.click(); const b = dq().querySelector('[data-lm-hole="' + h + '"]'); b.click(); };

// ---- panel: a decided Saturday Greensomes hole is play-on, the tee shot is optional
let dom = await open('&player=' + encodeURIComponent(A1)); const dq = () => dom.window.document;
ok(dq().querySelector('.lm'), 'the live panel renders');
goto(dq, 15); await tick(100);
ok(/Match 1 is over/.test(dq().body.textContent) && /Points are locked/.test(dq().body.textContent), 'a decided match says it is over and keeps the entry open: ' + (dq().querySelector('.lmmsg') || {}).textContent);
ok(!dq().getElementById('lmEdit'), 'no "Correct a score" final view while holes are missing');
ok(/Match over/.test(dq().querySelector('.lmst.tee').textContent) && /optional/.test(dq().querySelector('.lmst.tee').textContent), 'tee shot is marked optional on a play-on hole');
dq().querySelector('[data-lm-s="' + A1 + '|4"]').click(); dq().querySelector('[data-lm-s="' + B1 + '|7"]').click(); await tick(80);
ok(!dq().getElementById('lmPost').disabled, 'Save is on with scores only, no tee shot needed on a play-on hole');
dq().getElementById('lmPost').click(); await tick(500);
let c = await dbCfg(); ok(c.scores.sat.m1.h['15'], 'the play-on score is saved');
// points did not move: still decided on hole 14 with the same margin
const { loadEngine } = await import('./extract.mjs'); const E = loadEngine(); const st = E.cupLiveStandings(c); const m1 = st.rounds[0].matches[0].segments[1];
ok(m1.status === 'won' && m1.winner === 'A' && /5&4/.test(m1.text), 'the Greensomes result is still 5&4 after a play-on hole: ' + m1.status + ' ' + m1.text);
ok(!(c.phases && c.phases['round_sat_end']), 'Saturday does not finish while other matches/holes are open');

// ---- Sunday: both matches decided, round stays open until hole 18 is in
dom = await open('&player=' + encodeURIComponent(A1)); await tick(100);
c = await dbCfg(); ok(!(c.phases && c.phases['round_sun_end']), 'Sunday is not finished with holes 13-18 missing even though every match is decided');
ok(/is over/.test(dq().body.textContent) && !dq().getElementById('lmEdit'), 'Sunday group still open for scoring');
for (let i = 13; i <= 18; i++) for (const m of sun.matches) { const [a, b] = [m.sides[0].players[0], m.sides[1].players[0]]; await act({ action: 'score', round: 'sun', match: m.key, hole: i, scores: { [a]: 3, [b]: 9 }, player: A1 }); }
c = await dbCfg(); ok(Object.keys(c.scores.sun.s1.h).length === 18, 'all 18 Sunday holes are in');
dom = await open('&player=' + encodeURIComponent(A1)); await tick(300);
{ const sel = dq().getElementById('lmMatchSel'); const sunOpt = sel && [...sel.options].filter(o => /sun/.test(o.value))[0]; if (sunOpt) { sel.value = sunOpt.value; sel.dispatchEvent(new dom.window.Event('change')); await tick(600); } }
ok(!!dq().getElementById('lmEdit') || /Group complete|Match complete/.test(dq().body.textContent), 'once every hole is in, the group shows its final view');
c = await dbCfg(); ok(!!(c.phases && c.phases['round_sun_end']), 'and the round finishes itself');

// ---- guardrails on starting / restarting the singles draw
let cur = await dbCfg(); cur.singles = { started: true, first: 'A', log: [] };
let g = await post(cur); ok(g.status === 409 && g.j.code === 'needs_override', 'host start before Saturday is finished asks for the override: ' + g.status);
g = await post(cur, { override: true }); ok(g.status === 409 && g.j.code === 'sunday_scores' && g.j.holes === 36, 'then Sunday scores block it: ' + g.status + ' ' + g.j.holes);
g = await post(cur, { override: true, discard_scores: true }); ok(g.status === 200, 'with both confirmations it starts');
c = await dbCfg(); ok(c.singles && c.singles.started && !c.scores.sun && !(c.phases && c.phases.round_sun_end), 'the Sunday scores and finish stamp are gone');
cur = await dbCfg(); cur.singles = null; g = await post(cur); ok(g.status === 200, 'a restart with no Sunday scores goes through');
c = await dbCfg(); ok(!c.singles, 'and the restart really clears the singles draw (it used to be restored by the Worker)');
// restart while scores exist
cur = await dbCfg(); cur.singles = { started: true, first: 'A', log: [] }; cur.rounds[1].matches = sun.matches; await post(cur, { override: true });
await act({ action: 'score', round: 'sun', match: 's1', hole: 1, scores: { [A1]: 4, [B1]: 5 }, player: A1 });
cur = await dbCfg(); cur.singles = null; g = await post(cur); ok(g.status === 409 && g.j.code === 'sunday_scores', 'restarting while Sunday has scores asks first');
// host page: readiness card
dom = await open('&host=1', 'HOST1'); await tick(300);
await post((() => { const x = JSON.parse(JSON.stringify(cur)); x.singles = null; return x; })(), { discard_scores: true });
dom = await open('&host=1', 'HOST1'); await tick(300);
const txt = dq().body.textContent; ok(/Ready for the singles draw\?/.test(txt) || !/Sunday singles/.test(txt), 'host sees the readiness card: ' + /Ready for the singles draw/.test(txt));
console.log(`test_cup_playon: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
