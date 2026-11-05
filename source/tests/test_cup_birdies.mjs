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
const pushed = []; let pushFeed = [];
const pushFetch = async (u, o) => { if (o && o.method === 'POST') { pushed.push(JSON.parse(o.body)); return { ok: true, status: 200, json: async () => ({ ok: true, feedKey: 'k' }) }; } return { ok: true, status: 200, json: async () => ({ feed: pushFeed }) }; };
const tick = (ms = 120) => new Promise(r => setTimeout(r, ms));
async function open(query, pin) {
  const dom = new JSDOM(page, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://x.test/bf-cup-draft.html?event=E' + query, beforeParse(w) { w.fetch = (u, o) => (String(u).startsWith('https://birdiefriends-push') ? pushFetch(u, o) : workerFetch(u, o)); w.confirm = () => true; if (pin) w.sessionStorage.setItem('bf_cup_pin', pin); w.localStorage.setItem('bf_cup_me', ''); } });
  await tick(300); return dom;
}
const dbCfg = async () => (await (await workerFetch(API + '/bfe/cup?event=E&pin=HOST1')).json()).config;
const post = async (c, extra) => { const r = await workerFetch(API + '/bfe/cup', { method: 'POST', body: JSON.stringify(Object.assign({ event_name: 'E', config: c, pin: '7797' }, extra || {})) }); return { status: r.status, j: await r.json() }; };
const act = async (b) => { const r = await workerFetch(API + '/bfe/cup/act', { method: 'POST', body: JSON.stringify(Object.assign({ event_name: 'E' }, b)) }); return { status: r.status, j: await r.json() }; };
const goto = (dq, h) => { const a = dq().getElementById('lmAll'); if (a && !dq().querySelector('[data-lm-hole]')) a.click(); const b = dq().querySelector('[data-lm-hole="' + h + '"]'); b.click(); };

const [S1A, S1B, S2A, S2B] = [A1, B1, A2, B2];
// ---- through the panel: a Sunday gross birdie is announced once, with the skin status
let dom0 = await open('&player=' + encodeURIComponent(A1)); const dq = () => dom0.window.document;
{ const sel = dq().getElementById('lmMatchSel'); const o = sel && [...sel.options].filter(x => /sun/.test(x.value))[0]; ok(!!o, 'the Sunday group can be picked'); if (o) { sel.value = o.value; sel.dispatchEvent(new dom0.window.Event('change')); await tick(300); } }
const tile = (who, n) => dq().querySelector('[data-lm-s="' + who + '|' + n + '"]');
tile(S1A, 3).click(); tile(S1B, 5).click(); tile(S2A, 4).click(); tile(S2B, 5).click(); await tick(100);
dq().getElementById('lmPost').click(); await tick(800);
ok(pushed.length === 1, 'one birdie, one push: ' + pushed.length);
const p0 = pushed[0] || {};
ok(/#13/.test((p0.headings || {}).en || '') && /Brian Hager/.test((p0.headings || {}).en || ''), 'heading names the hole and player: ' + JSON.stringify(p0.headings));
ok((p0.contents || {}).en === 'Skin Frontrunner' && p0.bf_type === 'birdie' && p0.bf_meta.scoreType === 'Birdie' && p0.bf_meta.hole === 13, 'first birdie on the hole is the skin frontrunner, typed birdie with meta');
ok((p0.filters || []).filter(f => f.key === 'player_name').length === 8 && (p0.filters || []).filter(f => f.operator === 'OR').length === 7, 'audience is every Cup player (8 in this fixture), by tag, joined with OR');
// a second birdie on the same hole as one already in the feed busts the skin
pushed.length = 0; pushFeed = [{ type: 'birdie', meta: { hole: 14, player: 'Somebody', scoreType: 'Birdie' }, sentAt: Date.now() }];
tile(S1A, 5).click(); tile(S1B, 5).click(); tile(S2A, 3).click(); tile(S2B, 5).click(); await tick(100);
dq().getElementById('lmPost').click(); await tick(800);
ok(pushed.length === 1 && pushed[0].contents.en === 'Skin Busted!', 'a birdie that ties one already in the feed says the skin is busted: ' + JSON.stringify(pushed.map(x => x.contents)));
// ---- the Worker's once-only flag
const sc = (round, match, hole, scores) => act({ action: 'score', round, match, hole, scores, player: A1 });
let r = await sc('sun', 's1', 15, { [A1]: 2, [B1]: 4 });   // par 3: a 2 is a birdie
ok(r.j.birdies.length === 1 && r.j.birdies[0].scoreType === 'Birdie', 'a 2 on a par 3 is a birdie');
r = await sc('sun', 's1', 15, { [A1]: 2, [B1]: 4 }); ok(r.j.birdies.length === 0, 're-posting the same score announces nothing');
r = await sc('sun', 's1', 15, { [A1]: 3, [B1]: 4 }); r = await sc('sun', 's1', 15, { [A1]: 2, [B1]: 4 }); ok(r.j.birdies.length === 0, 'correcting away and back does not announce twice');
r = await sc('sun', 's1', 16, { [A1]: 2, [B1]: 5 }); ok(r.j.birdies[0] && r.j.birdies[0].scoreType === 'Eagle', 'a 2 on a par 4 is an eagle: ' + JSON.stringify(r.j.birdies));
r = await sc('sun', 's1', 17, { [A1]: 0, [B1]: 5 }); ok(r.j.birdies.length === 0, 'a pickup is not a birdie');
r = await sc('sun', 's1', 18, { [A1]: 3, [B1]: 3 }); ok(r.j.birdies.length === 0, 'par is not a birdie on a par 3 (hole 18)');
r = await sc('sat', 'm1', 3, { [A1]: 2, [A2]: 5, [B1]: 5, [B2]: 5 }); ok(r.j.birdies.length === 0, 'a Saturday round with no skins announces nothing');
// kill switch
let cur = await dbCfg(); ok(cur.announced && cur.announced['sun'] && Object.keys(cur.announced['sun']).length >= 3, 'the flags are kept on the Cup record');
cur.birdie_alerts = false; await post(cur);
r = await sc('sun', 's2', 17, { [A2]: 3, [B2]: 5 }); ok(r.j.birdies.length === 0, 'with birdie alerts off nothing is announced');
cur = await dbCfg(); ok(cur.birdie_alerts === false && cur.announced.sun, 'a host re-save keeps the switch and the flags');
// host toggle on the Money tab
const dh = await open('&host=1', 'HOST1'); await tick(300);
const hd = dh.window.document; const tabs = [...hd.querySelectorAll('[data-view]')]; const mt = tabs.filter(b => /money/i.test(b.getAttribute('data-view')))[0]; if (mt) { mt.click(); await tick(300); }
ok(/Birdie alerts are\s*OFF/.test(hd.body.textContent.replace(/\s+/g, ' ')), 'host Money tab shows the switch as OFF');
const tg = hd.getElementById('birdieToggle'); if (tg) { tg.click(); await tick(600); }
cur = await dbCfg(); ok(cur.birdie_alerts === true, 'the toggle turns it back on');
console.log(`test_cup_birdies: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
