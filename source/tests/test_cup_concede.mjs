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
cfg.scores = { sat: {}, sun: {} };
let r0 = await workerFetch(API + '/bfe/cup', { method: 'POST', body: JSON.stringify({ event_name: 'E', config: cfg, pin: '7797' }) }); ok(r0.ok, 'the Cup is saved on the Worker');
const tick = (ms = 120) => new Promise(r => setTimeout(r, ms));
async function open(query) {
  const dom = new JSDOM(page, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://x.test/bf-cup-draft.html?event=E' + query, beforeParse(w) { w.fetch = workerFetch; w.confirm = () => true; w.localStorage.setItem('bf_cup_me', ''); } });
  await tick(300); return dom;
}
const dbCfg = async () => (await (await workerFetch(API + '/bfe/cup?event=E&pin=HOST1')).json()).config;
const act = async (b) => { const r = await workerFetch(API + '/bfe/cup/act', { method: 'POST', body: JSON.stringify(Object.assign({ event_name: 'E' }, b)) }); return { status: r.status, j: await r.json() }; };
const sc = (round, match, hole, scores) => act({ action: 'score', round, match, hole, scores, player: A1 });
const { loadEngine } = await import('./extract.mjs'); const E = loadEngine();

// ---- Worker: -1 only when the other side is entirely Out
let r = await sc('sat', 'm1', 1, { [A1]: 0, [A2]: 4, [B1]: -1, [B2]: -1 }); ok(r.status === 400, 'rejected: a partner is still in, so no concession');
r = await sc('sat', 'm1', 1, { [A1]: 5, [A2]: 5, [B1]: -1, [B2]: 4 }); ok(r.status === 400, 'rejected: the other side has real scores');
r = await sc('sat', 'm1', 1, { [A1]: 0, [A2]: 0, [B1]: -1, [B2]: -1 }); ok(r.status === 200, 'fourball: both pair Out, both winners blank (-1) is accepted: ' + r.status);
let c = await dbCfg(); ok(c.scores.sat.m1.h['1'][B1] === -1, 'saved as -1');
let live = E.cupMatchLive(c, c.rounds[0], c.rounds[0].matches[0], c.scores.sat.m1); ok(live.segments[0].state.lead === -1 && live.segments[0].state.thru === 1, 'Team Nate wins hole 1 by concession: lead ' + live.segments[0].state.lead);
// one winner finishes out, the other stays blank
r = await sc('sat', 'm1', 2, { [A1]: 0, [A2]: 0, [B1]: 4, [B2]: -1 }); ok(r.status === 200, 'one winner finishes out, partner blank');
c = await dbCfg(); live = E.cupMatchLive(c, c.rounds[0], c.rounds[0].matches[0], c.scores.sat.m1); ok(live.segments[0].state.lead === -2, 'hole 2 also to Team Nate');
// skins / cards ignore -1 (only real grosses count)
ok(!JSON.stringify(E.cupScorecards(c, c.rounds[0])).includes('-1'), 'scorecards carry no -1');
// Greensomes: one row per side
r = await sc('sat', 'm1', 10, { [A1]: 0, [B1]: -1 }); ok(r.status === 200, 'Greensomes team Out, other team blank: ' + r.status);
r = await sc('sat', 'm1', 11, { [A1]: 5, [B1]: -1 }); ok(r.status === 400, 'Greensomes: no concession without the other team Out');
c = await dbCfg(); live = E.cupMatchLive(c, c.rounds[0], c.rounds[0].matches[0], c.scores.sat.m1); ok(live.segments[1].state.lead === -1, 'Greensomes hole 10 to Team Nate');
// singles
r = await sc('sun', 's1', 1, { [A1]: 0, [B1]: -1 }); ok(r.status === 200, 'singles: Out and blank');
r = await sc('sun', 's1', 2, { [A1]: 0, [B1]: 4 }); ok(r.status === 200, 'singles: Out and finishing out');
c = await dbCfg(); live = E.cupMatchLive(c, c.rounds[1], c.rounds[1].matches[0], c.scores.sun.s1); ok(live.segments[0].state.lead === -2, 'singles: both holes to Team Nate');

// ---- panel (fourball hole 3): both partners tap Out, the winners stay blank, Save works
let dom = await open('&player=' + encodeURIComponent(A1)); const dq = () => dom.window.document;
const goto = h => { const a = dq().getElementById('lmAll'); if (a && !dq().querySelector('[data-lm-hole]')) a.click(); dq().querySelector('[data-lm-hole="' + h + '"]').click(); };
goto(3); await tick(80);
dq().querySelector('[data-lm-s="' + A1 + '|0"]').click(); await tick(40);
ok(dq().getElementById('lmPost').disabled, 'one Out is not enough: the partner and the winners still need scores');
dq().querySelector('[data-lm-s="' + A2 + '|0"]').click(); await tick(60);
ok(!dq().getElementById('lmPost').disabled, 'both Out: Save is on with the winners blank');
ok(/wins hole 3 · by concession/.test(dq().body.textContent), 'banner says the winners take it by concession'); ok(/optional/.test(dq().body.textContent), 'winner chips say optional');
dq().getElementById('lmPost').click(); await tick(500);
c = await dbCfg(); ok(c.scores.sat.m1.h['3'][B1] === -1 && c.scores.sat.m1.h['3'][B2] === -1 && c.scores.sat.m1.h['3'][A1] === 0, 'panel saved Out, Out, -1, -1');
// a winner enters a real score instead: it counts
goto(4); await tick(80);
dq().querySelector('[data-lm-s="' + A1 + '|0"]').click(); dq().querySelector('[data-lm-s="' + A2 + '|0"]').click(); await tick(40);
dq().querySelector('[data-lm-who="' + B1 + '"]').click(); await tick(40); dq().querySelector('[data-lm-s="' + B1 + '|3"]').click(); await tick(60);
dq().getElementById('lmPost').click(); await tick(500);
c = await dbCfg(); ok(c.scores.sat.m1.h['4'][B1] === 3 && c.scores.sat.m1.h['4'][B2] === -1, 'a finish-out stays a real score, partner -1');
// changing an Out back makes the -1 invalid again: re-open hole 3, flip A2 to a 5
goto(3); await tick(80);
dq().querySelector('[data-lm-who="' + A2 + '"]').click(); await tick(40); dq().querySelector('[data-lm-s="' + A2 + '|5"]').click(); await tick(60);
ok(dq().getElementById('lmPost').disabled, 'a posted -1 needs a real score once the other side is back in');
goto(12); await tick(80); ok(/Hole 12/.test(dq().querySelector('#lmAll').textContent), 'the hole grid still jumps to any hole (for testing and catch-up)'); ok(dq().querySelector('[data-lm-go="1"]').disabled, 'but the › arrow stays locked until this hole is posted');
console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
