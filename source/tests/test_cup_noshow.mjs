// One no-show (Brian, 2026-11-05): the REAL Worker + REAL engine + REAL panel (jsdom). Saturday a pair plays one player with mulligans; Sunday the other player plays a gross target.
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
async function open(query, pin) {
  const dom = new JSDOM(page, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://x.test/bf-cup-draft.html?event=E' + query, beforeParse(w) { w.fetch = workerFetch; w.confirm = () => true; w.localStorage.setItem('bf_cup_me', ''); if (pin) w.sessionStorage.setItem('bf_cup_pin', pin); } });
  await tick(300); return dom;
}
const dbCfg = async () => (await (await workerFetch(API + '/bfe/cup?event=E&pin=HOST1')).json()).config;
const act = async (b) => { const r = await workerFetch(API + '/bfe/cup/act', { method: 'POST', body: JSON.stringify(Object.assign({ event_name: 'E' }, b)) }); return { status: r.status, j: await r.json() }; };
const sc = (round, match, hole, scores) => act({ action: 'score', round, match, hole, scores, player: A1 });

const { loadEngine } = await import('./extract.mjs'); const E = loadEngine();
const HOST = { pin: 'HOST1' };
const ns = (b) => act(Object.assign({ action: 'noshow' }, HOST, b));
const mul = (m, hole, on, who = A1) => act({ action: 'mulligan', round: 'sat', match: m, hole, on, player: who });

// ---- Worker: only the host marks a no-show
let r = await act({ action: 'noshow', round: 'sat', who: B2, mulligans: 4, code: 'CA' }); ok(r.status === 403, 'a captain cannot mark a no-show (host only): ' + r.status);
r = await ns({ round: 'sat', who: 'Nobody Here', mulligans: 4 }); ok(r.status === 404, 'unknown player: ' + r.status);
r = await ns({ round: 'sat', who: B2, mulligans: 12 }); ok(r.status === 400, 'mulligans out of range: ' + r.status);
r = await ns({ round: 'sat', who: B2, mulligans: 4 }); ok(r.status === 200, 'Saturday: Andrew marked a no-show: ' + r.status);
let c = await dbCfg(); let m1 = c.rounds[0].matches[0];
ok(m1.sides[1].players.length === 1 && m1.sides[1].players[0] === B1 && m1.sides[1].away[0] === B2 && m1.noshow.mulligans === 4 && m1.noshow.player === B2, 'Andrew left side B, his name is kept in away, 4 mulligans');
r = await ns({ round: 'sat', who: B1, mulligans: 3 }); ok(r.status === 409, 'a second no-show in the same match is refused: ' + r.status);
ok(E.cupSideNames(m1.sides[1])[0] === B1 && E.cupSideNames({ side: 'B', players: [], away: [B2] })[0] === B2 + ' (no-show)', 'side names: players, or "(no-show)" when nobody is left');

// ---- mulligans: a tally on the Fourball nine only, one per hole, no more than the match allows
r = await mul('m1', 3, true); ok(r.status === 200, 'mulligan on hole 3'); r = await mul('m1', 3, true); ok(r.status === 200, 'the same hole again changes nothing');
r = await mul('m1', 10, true); ok(r.status === 400, 'no mulligan on a Greensomes hole: ' + r.status);
for (const h of [4, 5, 6]) await mul('m1', h, true);
c = await dbCfg(); m1 = c.rounds[0].matches[0]; ok(Object.keys(m1.noshow.used).length === 4, '4 used'); 
r = await mul('m1', 7, true); ok(r.status === 409 && /No mulligans left/.test(r.j.error), 'a fifth is refused: ' + r.status);
r = await mul('m1', 6, false); ok(r.status === 200, 'undo one'); r = await mul('m1', 7, true); ok(r.status === 200, 'and then hole 7 is allowed');
r = await act({ action: 'mulligan', round: 'sat', match: 'm1', hole: 8, on: true, player: 'Dave Sherwin' }); ok(r.status === 403, 'only the four in the group can use one: ' + r.status);
c = await dbCfg(); m1 = c.rounds[0].matches[0];
let mg = E.cupMulligans(m1, c.rounds[0].segments[0]); ok(mg && mg.player === B1 && mg.total === 4 && mg.left === 0 && mg.used.join() === '3,4,5,7', 'engine tally: Tom, 4 of 4 used on 3,4,5,7');
ok(E.cupMulligans(m1, c.rounds[0].segments[1]) === null, 'no tally on Greensomes holes');
ok(E.cupMulliganDefault(4.8) === 2 && E.cupMulliganDefault(6) === 3 && E.cupMulliganDefault(10) === 3 && E.cupMulliganDefault(10.7) === 4 && E.cupMulliganDefault(20) === 4 && E.cupMulliganDefault(24) === 5 && E.cupMulliganDefault(null) === 3, 'default mulligans by Index');

// ---- scoring: the lone player is the whole side, the absent player cannot score
r = await sc('sat', 'm1', 1, { [A1]: 5, [A2]: 5, [B1]: 4 }); ok(r.status === 200, 'hole 1: Tom 4 alone v the pair: ' + r.status);
r = await sc('sat', 'm1', 2, { [A1]: 5, [A2]: 5, [B1]: 4, [B2]: 3 }); ok(r.status === 400, 'Andrew has no score slot any more: ' + r.status);
c = await dbCfg(); let live = E.cupMatchLive(c, c.rounds[0], c.rounds[0].matches[0], c.scores.sat.m1);
ok(live.segments[0].nets[1][0] != null && live.segments[0].state.thru === 1, 'hole 1 counts with one player a side');
// Greensomes: one ball each, lone player's team handicap is his own doubled against the pair's sum (Brian 7 + BJ 14 = 21 v Tom 13 x 2 = 26: Tom is the high side)
const st = E.cupMatchStrokes(c.rounds[0].matches[0], E.cupHcpMap(c), E.cupHandicapRule(c)); const tm = st.teams;
ok(tm[1].known && tm[1].strokes > 0 && tm[0].strokes === 0, 'Greensomes: the lone player is compared as a pair of himself (gets ' + tm[1].strokes + ')');
r = await sc('sat', 'm1', 10, { [A1]: 5, [B1]: 5 }); ok(r.status === 200, 'Greensomes hole 10 posts one team ball each');
const ds = E.cupDriveStatus(c, c.rounds[0], c.rounds[0].matches[0], c.rounds[0].segments[1]); ok(ds.sides[1].need[B1] === 0 && !ds.sides[1].impossible && ds.sides[1].forced.length === 0, 'no drive tally is asked of the lone player');
const stand = E.cupLiveStandings(c); ok(stand.total > 0, 'standings still compute with a lone side');

// ---- undo: only before scores
r = await act({ action: 'noshow_undo', round: 'sat', match: 'm1', code: 'CA' }); ok(r.status === 403, 'undo is host only');
r = await act(Object.assign({ action: 'noshow_undo', round: 'sat', match: 'm1' }, HOST)); ok(r.status === 409, 'undo is refused once the match has scores: ' + r.status);
// a fresh match: mark and unmark (m2), order is restored
r = await ns({ round: 'sat', who: 'Harry Pry', mulligans: 3 }); ok(r.status === 200, 'Harry marked in m2');
r = await act(Object.assign({ action: 'noshow_undo', round: 'sat', match: 'm2' }, HOST)); ok(r.status === 200, 'undo works with no scores');
c = await dbCfg(); ok(c.rounds[0].matches[1].sides[1].players.join() === 'Evan Lindermuth,Harry Pry' && !c.rounds[0].matches[1].noshow && !c.rounds[0].matches[1].sides[1].away, 'Harry is back in his original place');

// ---- Sunday: singles, the player who showed plays a target
r = await act(Object.assign({ action: 'noshow', round: 'sun', who: B1 }, HOST)); ok(r.status === 400, 'a singles no-show needs a target: ' + r.status);
r = await act(Object.assign({ action: 'noshow', round: 'sun', who: B1, win: 85, half: 80 }, HOST)); ok(r.status === 400, 'half cannot be under win: ' + r.status);
r = await act(Object.assign({ action: 'noshow', round: 'sun', who: B1, win: 85, half: 89 }, HOST)); ok(r.status === 200, 'Tom marked a no-show on Sunday: ' + r.status);
c = await dbCfg(); const s1 = c.rounds[1].matches[0]; ok(s1.sides[1].players.length === 0 && s1.sides[1].away[0] === B1 && s1.noshow.win === 85 && s1.noshow.half === 89, 'the other side is empty, target 85 / 89');
let wo = E.cupWalkover(c, c.rounds[1], s1); ok(wo && wo.player === A1 && wo.side === 0 && !wo.done && wo.thru === 0 && wo.text === 'Not started', 'walkover starts for Brian');
const sunSc = (h, g) => act({ action: 'score', round: 'sun', match: 's1', hole: h, scores: { [A1]: g }, player: A1 });
for (let h = 1; h <= 17; h++) await sunSc(h, 5);
c = await dbCfg(); wo = E.cupWalkover(c, c.rounds[1], c.rounds[1].matches[0]); ok(wo.thru === 17 && wo.total === 85 && !wo.done && wo.text === '85 thru 17', '17 holes of 5 = 85 thru 17: ' + wo.text);
let stn = E.cupLiveStandings(c); let m = stn.rounds[1].matches[0]; ok(m.points.A === 0 && m.points.B === 0 && !m.done, 'nothing is awarded until the 18th hole');
// hole 18 (par 3): a 5 -> 90 misses 89 = LOSS, the point goes to the no-show's team
await sunSc(18, 5); c = await dbCfg(); wo = E.cupWalkover(c, c.rounds[1], c.rounds[1].matches[0]);
ok(wo.done && wo.total === 90 && wo.result === 'loss', 'a 90 misses the 85/89 band: ' + wo.total + ' ' + wo.result);
stn = E.cupLiveStandings(c); m = stn.rounds[1].matches[0]; ok(m.points.B === 1 && m.points.A === 0 && m.done, "a miss: the no-show's team (Team Nate) gets the point");
// Out counts as net double bogey: Brian (course hcp 7) gets a stroke on the SI-1 hole 2 (par 4): cap 7. Everything else a 4 -> win; hole 2 Out = 7
const sunAll = async (f) => { for (let h = 1; h <= 18; h++) await sunSc(h, f(h)); c = await dbCfg(); return E.cupWalkover(c, c.rounds[1], c.rounds[1].matches[0]); };
wo = await sunAll(h => 4); ok(wo.result === 'win' && wo.total === 72, '18 fours = 72 beats 85: ' + wo.total + ' ' + wo.result);
stn = E.cupLiveStandings(c); m = stn.rounds[1].matches[0]; ok(m.points.A === 1 && m.points.B === 0, 'a win: Team Jake gets the point');
wo = await sunAll(h => (h === 2 ? 0 : 4)); ok(wo.outs === 1 && wo.total === 17 * 4 + 7, 'an Out on hole 2 counts as net double bogey (7): ' + wo.total);
wo = await sunAll(h => (h === 2 ? 15 : 4)); ok(wo.total === 17 * 4 + 7, 'a 15 is capped at net double bogey too: ' + wo.total);
wo = await sunAll(h => (h <= 14 ? 5 : 4)); ok(wo.total === 14 * 5 + 4 * 4 && wo.result === 'half', 'between 86 and 89 halves: ' + wo.total + ' ' + wo.result);
stn = E.cupLiveStandings(c); m = stn.rounds[1].matches[0]; ok(m.points.A === 0.5 && m.points.B === 0.5, 'a half: half a point each');

// ---- panel (host): the Saturday no-show box, the banner and the mulligan row
const dom = await open('&host=1&player=' + encodeURIComponent(A1), 'HOST1'); const dq = () => dom.window.document;
await tick(200);
const txt = () => dq().body.textContent;
ok(/did not show/.test(txt()) && /Andrew Kabrick/.test(txt()), 'Saturday group 1 shows the no-show note');
ok(!!dq().querySelector('[data-lm-nsundo]'), 'host sees Undo no-show on the marked match');
const goto = h => { const a = dq().getElementById('lmAll'); if (a && !dq().querySelector('[data-lm-hole]')) a.click(); dq().querySelector('[data-lm-hole="' + h + '"]').click(); };
goto(8); await tick(80);
ok(/mulligans: 0 left of 4/.test(txt()) || /Tom\b.*mulligans/.test(txt()), 'fourball hole: mulligan counter shows');
goto(12); await tick(80);
ok(!dq().querySelector('[data-lm-mul]'), 'no mulligan row on a Greensomes hole'); ok(/two tee shots/.test(txt()), 'Greensomes note: two tee shots');
ok(!/Mark whose drive first \([^)]*Team Nate/.test(txt()), 'the lone team (Team Nate) is not asked to mark a drive');

// ---- panel (host): mark a no-show from the screen, prefilled from the plan; the note and the undo button appear
const dom2 = await open('&host=1&player=' + encodeURIComponent('Dave Sherwin'), 'HOST1'); const d2 = () => dom2.window.document; await tick(200);
const box = d2().querySelector('[data-lm-nsbox="m2"]'); ok(!!box, 'host sees the no-show box on a match with no scores');
if (box) {
  const sel = box.querySelector('[data-lm-nswho]'); sel.value = 'Harry Pry'; sel.dispatchEvent(new dom2.window.Event('change')); await tick(20);
  ok(box.querySelector('[data-lm-nsmul]').value === '4', "prefilled from the plan: Harry gets 4 mulligans (got " + box.querySelector('[data-lm-nsmul]').value + ')');
  box.querySelector('[data-lm-nsgo]').click(); await tick(500);
  c = await dbCfg(); ok(c.rounds[0].matches[1].noshow && c.rounds[0].matches[1].noshow.player === 'Harry Pry' && c.rounds[0].matches[1].noshow.mulligans === 4, 'the panel marked Harry with 4 mulligans');
  ok(/Harry Pry did not show/.test(d2().body.textContent) && !!d2().querySelector('[data-lm-nsundo]'), 'the note and an Undo button show for the host');
  ok(/Harry Pry \(no-show\)|Harry Pry/.test(d2().body.textContent), 'his name stays visible');
}
// a player (no pin) never sees the box
const dom3 = await open('&player=' + encodeURIComponent('Evan Lindermuth')); await tick(150); ok(!dom3.window.document.querySelector('[data-lm-nsbox]'), 'a player does not get the host box');

// ---- the host-only No-show tab: the plan table with mulligans, hidden from players
const dom4 = await open('&host=1&player=' + encodeURIComponent(A1), 'HOST1'); const d4 = () => dom4.window.document; await tick(200);
const tabBtn = d4().querySelector('[data-view="noshow"]'); ok(!!tabBtn, 'host sees a No-show tab');
if (tabBtn) { tabBtn.click(); await tick(80);
  const t4 = d4().body.textContent; ok(/If someone does not show/.test(t4) && /Mulligans/.test(t4), 'the plan page shows with a Mulligans column');
  const rowOf = n => [...d4().querySelectorAll('tr')].find(tr => tr.textContent.includes(n));
  ok(/Harry Pry/.test(rowOf('Harry Pry').textContent) && rowOf('Harry Pry').cells[3].textContent === '4' && /86 or better/.test(rowOf('Harry Pry').textContent), 'Harry: 4 mulligans, 86 or better');
  ok(rowOf('Brian Hager').cells[3].textContent === '3' && /79 or better/.test(rowOf('Brian Hager').textContent) && /83\+/.test(rowOf('Brian Hager').textContent), 'Brian: 3 mulligans, 79 / 80-82 / 83+');
}
const dom5 = await open('&player=' + encodeURIComponent(A1)); await tick(150); ok(!dom5.window.document.querySelector('[data-view="noshow"]'), 'players never see the No-show tab');
const dom6 = await open('&host=1&player=' + encodeURIComponent(A1)); await tick(150); ok(!dom6.window.document.querySelector('[data-view="noshow"]'), 'host=1 without the PIN does not show it either');
console.log('no-show: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
