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
cfg.scores.sat = {}; sat.matches.forEach(m => { const h = {}; for (let i = 1; i <= 9; i++) { h[i] = {}; m.sides.forEach(sd => sd.players.forEach(p => { h[i][p] = 5; })); } cfg.scores.sat[m.key] = { h, t: {}, by: {} }; });
cfg.scores.sun = {}; sun.matches.forEach(m => { const h = {}; for (let i = 1; i <= 18; i++) { h[i] = {}; m.sides.forEach(sd => sd.players.forEach(p => { h[i][p] = (p === 'Brian Hager' && i <= 3) ? 3 : 5; })); } cfg.scores.sun[m.key] = { h, t: {}, by: {} }; });
let r0 = await workerFetch(API + '/bfe/cup', { method: 'POST', body: JSON.stringify({ event_name: 'E', config: cfg, pin: '7797' }) }); ok(r0.ok, 'the Cup is saved on the Worker');
const tick = (ms = 120) => new Promise(r => setTimeout(r, ms));
async function open(query, pin) {
  const dom = new JSDOM(page, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://x.test/bf-cup-draft.html?event=E' + query, beforeParse(w) { w.fetch = workerFetch; w.confirm = () => true; if (pin) w.sessionStorage.setItem('bf_cup_pin', pin); w.localStorage.setItem('bf_cup_me', ''); } });
  await tick(250); return dom;
}
const dbCfg = async () => (await (await workerFetch(API + '/bfe/cup?event=E&pin=HOST1')).json()).config;
// --- Greensomes drive tally (Brian, 2026-11-05): tap whose drive on holes 10-18, running count, nothing blocked
const act = async (b) => { const r = await workerFetch(API + '/bfe/cup/act', { method: 'POST', body: JSON.stringify(Object.assign({ event_name: 'E', round: 'sat', match: 'm1' }, b)) }); return { status: r.status, j: await r.json() }; };
// worker
let r1 = await act({ action: 'drive', hole: 10, drive: 'Brian Hager', player: 'Brian Hager' });
ok(r1.status === 200 && r1.j.config.drives.sat.m1['10'].player === 'Brian Hager', 'a player in the match records whose drive');
ok((await act({ action: 'drive', hole: 10, drive: 'Brian Hager', player: 'Dave Sherwin' })).status === 403, 'someone from another group cannot');
ok((await act({ action: 'drive', hole: 5, drive: 'Brian Hager', player: 'Brian Hager' })).status === 400, 'a fourball hole has no drive tally');
ok((await act({ action: 'drive', hole: 10, drive: 'Dave Sherwin', player: 'Brian Hager' })).status === 400, 'only a player in the match can be named');
ok((await act({ action: 'drive', hole: 10, drive: '', player: 'Brian Hager' })).j.config.drives.sat.m1['10'] === undefined, 'an empty choice clears the hole');
// engine tally
const eng = (await import(pathToFileURL(HERE('../bf_engine.js')).href)).default || globalThis.BFEngine;
const cfgNow = await dbCfg();
const E2 = (typeof eng === 'object' && eng.cupDriveStatus) ? eng : null;
ok(!!E2, 'the engine exports cupDriveStatus');
if (E2) {
  const rd = cfgNow.rounds[0], m = rd.matches[0], seg = rd.segments[1];
  const mk = (map) => ({ drives: { sat: { m1: Object.fromEntries(Object.entries(map).map(([h, p]) => [h, { player: p }])) } } });
  const st = (map) => E2.cupDriveStatus(Object.assign({}, cfgNow, mk(map)), rd, m, seg).sides[0];
  let s0 = st({});
  ok(s0.min === 4 && s0.left === 9 && s0.counts['Brian Hager'] === 0, 'nine holes: each partner needs 4, nothing logged yet');
  s0 = st({ 10: 'Brian Hager', 11: 'Brian Hager', 12: 'Brian Hager', 13: 'Brian Hager', 14: 'Brian Hager' });
  ok(s0.counts['Brian Hager'] === 5 && s0.need['BJ Kolonia'] === 4 && s0.left === 4 && s0.forced.join() === 'BJ Kolonia', 'after five by Brian, BJ must have the last four');
  s0 = st({ 10: 'Brian Hager', 11: 'Brian Hager', 12: 'Brian Hager', 13: 'Brian Hager', 14: 'Brian Hager', 15: 'Brian Hager' });
  ok(s0.impossible, 'six by one partner leaves too few holes for the other to reach 4');
  s0 = st({ 10: 'Brian Hager', 11: 'BJ Kolonia', 12: 'Brian Hager', 13: 'BJ Kolonia' });
  ok(s0.forced.length === 0 && !s0.impossible && s0.left === 5, 'an even split is fine');
}
// the live panel on hole 10 (Greensomes)
let dom = await open('&player=' + encodeURIComponent('Brian Hager')), d = dom.window.document;
ok(/Greensomes/.test(d.querySelector('#lmAll').parentNode.textContent + d.body.textContent), 'the panel calls the format Greensomes');
ok(d.querySelectorAll('[data-lm-drv]').length >= 4, 'both partners of both teams get a drive button: ' + d.querySelectorAll('[data-lm-drv]').length);
const btn = n => [...dom.window.document.querySelectorAll('[data-lm-drv]')].filter(b => b.textContent.startsWith(n))[0];
btn('Brian').click(); await tick(300); d = dom.window.document;
ok(btn('Brian').classList.contains('on'), 'the tapped partner is highlighted');
ok(/Drives used: Brian H\. <b>1<\/b>|Brian H\. 1/.test(d.querySelector('.lmdrv').innerHTML) || /Brian H\.\s*1/.test(d.querySelector('.lmdrv').textContent), 'the count reads 1 for Brian');
let c = await dbCfg(); ok(c.drives && c.drives.sat.m1['10'].player === 'Brian Hager', 'it is saved on the Worker');
btn('Brian').click(); await tick(300);
c = await dbCfg(); ok(!c.drives || !c.drives.sat || !c.drives.sat.m1 || !c.drives.sat.m1['10'], 'tapping again takes it back');
// host re-save keeps the drives
await act({ action: 'drive', hole: 11, drive: 'BJ Kolonia', player: 'Brian Hager' });
const cur = await dbCfg(); const resave = JSON.parse(JSON.stringify(cur)); delete resave.drives;
await workerFetch(API + '/bfe/cup', { method: 'POST', body: JSON.stringify({ event_name: 'E', config: resave, pin: '7797' }) });
c = await dbCfg(); ok(c.drives && c.drives.sat.m1['11'].player === 'BJ Kolonia', 'a host re-save does not wipe the drive record');
console.log(`test_cup_drives: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
