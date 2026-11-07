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
// --- a player sets closest to the pin from the live panel (Saturday's fourball is scored, so the panel opens on hole 10, a par 3)
let dom = await open('&player=' + encodeURIComponent('Brian Hager')), d = dom.window.document;
ok(d.getElementById('lmMount') && /Hole 10/.test(d.querySelector('#lmAll').textContent) && d.getElementById('lmCtp'), 'hole 10 (a par 3) shows the closest-to-the-pin section');
ok(/nobody yet/.test(d.getElementById('lmCtp').textContent) && !d.getElementById('lmCtpAsk') && !d.getElementById('lmCtpSel'), 'compact line, no claim yet, no prompt and no old card');
// post hole 10 from the panel: tee shots, scores, Post -> the prompt appears
{ const q = () => dom.window.document; const dr = n => [...q().querySelectorAll('[data-lm-drv]')].filter(b => b.textContent.startsWith(n))[0];
  q().querySelector('[data-lm-s="Brian Hager|5"]').click(); q().querySelector('[data-lm-s="Tom Stitt|5"]').click(); await tick(100); dr('Brian').click(); dr('Tom').click(); await tick(100);
  q().getElementById('lmPost').click(); await tick(500); d = q();
  ok(d.getElementById('lmCtpAsk') && /Closest to pin on hole 10/.test(d.getElementById('lmCtpAsk').textContent), 'after Post hole on a par-3 CTP hole, the prompt asks');
  const names = [...d.querySelectorAll('[data-lm-ctpask]')].map(b => b.getAttribute('data-lm-ctpask'));
  ok(names.includes('Tom Stitt') && names.includes('') && !names.includes('Harry Pry'), 'one tap per group player plus Nobody: ' + names.join('|'));
  d.querySelector('[data-lm-ctpask=""]').click(); await tick(200); d = q();
  let c0 = await dbCfg(); ok(!d.getElementById('lmCtpAsk') && !(c0.ctp && c0.ctp.sat && c0.ctp.sat['10']), 'Nobody closes the prompt and saves nothing');
  q().querySelector('[data-lm-go="-1"]').click(); await tick(100); d = q(); ok(d.getElementById('lmCtp') && /nobody yet/.test(d.getElementById('lmCtp').textContent), 'back on hole 10 the line still says nobody');
  d.querySelector('[data-lm-ctpopen]').click(); await tick(100); d = q(); ok(d.getElementById('lmCtpAsk'), 'Set on the line reopens the prompt');
  ok(d.getElementById('lmCtpAsk').classList.contains('lmmodal'), 'the prompt is a dialog over the page');
  d.getElementById('lmCtpAsk').click(); await tick(100); d = q(); ok(!d.getElementById('lmCtpAsk'), 'tapping outside the dialog closes it, saving nothing');
  d.querySelector('[data-lm-ctpopen]').click(); await tick(100); d = q();
  d.querySelector('[data-lm-ctpask="Tom Stitt"]').click(); await tick(300); d = q(); }
let c = await dbCfg();
ok(c.ctp && c.ctp.sat['10'].player === 'Tom Stitt' && c.ctp.sat['10'].by === 'Brian Hager', 'the tap saves the claim on the Worker with who set it');
ok(/Tom Stitt/.test(dom.window.document.getElementById('lmCtp').textContent), 'the line shows the winner');
await workerFetch(API + '/bfe/cup/act', { method: 'POST', body: JSON.stringify({ event_name: 'E', action: 'score', round: 'sat', match: 'm1', hole: 10, scores: { 'Brian Hager': 5, 'Tom Stitt': 5 }, drives: { A: 'Brian Hager', B: 'Tom Stitt' }, player: 'Brian Hager' }) });   // the hole lock: post hole 10 before moving on
dom = await open('&player=' + encodeURIComponent('Brian Hager')); d = dom.window.document; d.getElementById('lmAll').click(); d.querySelector('[data-lm-hole="11"]').click(); await tick(); d = dom.window.document;
ok(/Hole 11/.test(d.querySelector('#lmAll').textContent) && !d.getElementById('lmCtp'), 'hole 11 (par 5) has none');
// --- the leaderboard splits Saturday into a Fourball block and a Greensomes block, one line per match
{ const dm = await open('&view=board'); const bd = dm.window.document; const txt = bd.getElementById('app').textContent;
  const segs = [...bd.querySelectorAll('.lmseg')].map(x => x.textContent);
  ok(segs.length >= 2 && /Fourball · holes 1–9/.test(segs[0]) && /Greensomes · holes 10–18/.test(segs[1]) && /1 point each/.test(segs[0]), 'Saturday shows a Fourball block then a Greensomes block: ' + segs.join(' | '));
  const nums = [...bd.querySelectorAll('.lmseg')].slice(0, 2).map(sg => { const out = []; let e = sg.nextElementSibling; while (e && e.classList.contains('lmbm')) { out.push(Number((e.querySelector('.lmmno').textContent.match(/\d+/) || ['0'])[0])); e = e.nextElementSibling; } return out; });
  ok(nums[0].length >= 2 && nums[1].length === nums[0].length && nums[1][0] === nums[0][0] + nums[0].length && nums[1][nums[1].length - 1] === nums[0][nums[0].length - 1] + nums[0].length, 'the Greensomes matches carry on the numbering after the Fourball ones: ' + nums.map(x => x.join(',')).join(' / '));
  const rows = [...bd.querySelectorAll('.lmbm')], sat = rows.filter(r => /Fourball|Greensomes/.test(r.textContent));
  ok(sat.length >= 4, 'each match is its own line in each block: ' + sat.length + ' lines');
  const fb = [...bd.querySelectorAll('.lmseg')][0].nextElementSibling; ok(fb && /Fourball/.test(fb.textContent) && !/Greensomes/.test(fb.textContent), 'a Fourball line shows only the Fourball nine');
  fb.querySelector('.lmbmt').click(); await tick(150); ok(bd.querySelector('.lmbm .lmcar') && /Hide scorecard/.test(bd.getElementById('app').textContent), 'a line still opens its scorecard'); }
// --- the host's Money tab (host code in the session, like the host page)
for (const [h, who] of [[3, 'Dave Sherwin'], [8, 'BJ Kolonia'], [15, 'Tom Stitt']]) { await workerFetch(API + '/bfe/cup/act', { method: 'POST', body: JSON.stringify({ event_name: 'E', action: 'ctp', round: 'sat', hole: h, claim: who, dist: h === 3 ? '4 ft' : '', pin: 'HOST1' }) }); }
for (const [h, who] of [[3, 'Brian Hager'], [8, 'Tom Stitt'], [10, 'BJ Kolonia'], [15, 'Andrew Kabrick'], [18, 'Brian Hager']]) { await workerFetch(API + '/bfe/cup/act', { method: 'POST', body: JSON.stringify({ event_name: 'E', action: 'ctp', round: 'sun', hole: h, claim: who, pin: 'HOST1' }) }); }
dom = await open('&host=1&view=money', 'HOST1'); d = dom.window.document;
ok([...d.querySelectorAll('.toolbar button')].some(b => b.textContent === 'Money' && !b.classList.contains('sec')), 'a Money tab is offered when a round has games, and is the active one');
ok(/Weekend buy-in \$20 a player/.test(d.getElementById('app').textContent) && /2026 BFCup - Day1 \$5 \+ 2026 BFCup - Day2 \$15/.test(d.getElementById('app').textContent), 'the intro adds the rounds up: $5 + $15 = $20');
let txt = d.getElementById('app').textContent;
ok(/Live · not closed/.test(txt) && /pot \$40/.test(txt) && /pot \$60/.test(txt), 'live; Saturday pot $40 (8 players), Sunday pot $60 (4 players)');
ok(/Skins · pot \$/.test(txt) && /No skins|\$/.test(txt), 'Sunday shows skins');
// Sunday: pot $60, CTP 5 x $16 = $80 > $60: the same pot-fit guard the Gatherings use must say so, and Close is blocked
ok(/more than the \$60\.00 pot/.test(txt), 'the host sees the pot-fit problem (CTP $80 on a $60 pot)');
ok(d.querySelector('[data-money-close="sun"]').disabled, 'Close is disabled while the games do not fit the pot');
// Saturday: $40 pot, five CTP holes x $16 = $80 > $40 as well; fix the games the way BFE-A would (a smaller $/hole) and re-save through the Worker
let fix = await dbCfg(); fix.rounds[0].games.addons[0].dollar_per_hole = 8; fix.rounds[1].games.addons[0].dollar_per_hole = 8; fix.rounds[1].games.entry_per_player = 30;
await workerFetch(API + '/bfe/cup', { method: 'POST', body: JSON.stringify({ event_name: 'E', config: fix, pin: 'HOST1' }) });
c = await dbCfg(); ok(c.ctp.sat['10'].player === 'Tom Stitt' && Object.keys(c.scores.sat).length === 2, 'a BFE-A style re-save kept the claims and the scores');
dom = await open('&host=1&view=money', 'HOST1'); d = dom.window.document; txt = d.getElementById('app').textContent;
ok(!/more than the/.test(txt) && !d.querySelector('[data-money-close="sat"]').disabled, 'with $8 a hole the games fit and Close is enabled');
ok(/Closest to the pin/.test(txt) && /Tom Stitt/.test(txt) && /4 ft/.test(txt) && /not claimed/.test(txt), 'CTP rows: winners, the distance, and the unclaimed hole');
ok(/Skins · pot \$/.test(txt) && /Brian Hager/.test(txt), 'Sunday skins: Brian\'s three 3s are the skins');
const sunRows = [...d.querySelectorAll('.hcpmatch')][1];
ok(/\$/.test(sunRows.textContent), 'Sunday card renders amounts');
// Saturday's unclaimed hole 18 ($8) is carried into Sunday's skins pot, so Sunday can only close second
ok(/unclaimed carries into the skins pot of a later round/.test(txt) && /incl\. \$8 carried in/.test(txt), 'Saturday says its unclaimed CTP is carried; Sunday\'s skins pot says it includes $8 carried in');
ok(d.querySelector('[data-money-close="sun"]').disabled && /Close 2026 BFCup - Day1 first/.test(txt), 'Sunday\'s Close is disabled until Saturday is closed, and says why');
// close Saturday
d.querySelector('[data-money-close="sat"]').click(); await tick(400); d = dom.window.document; txt = d.getElementById('app').textContent;
c = await dbCfg(); ok(c.rounds[0].payout && c.rounds[0].payout.total_pot === 40 && c.rounds[0].payout.closed_by === 'host', 'Close stores the frozen payout on the Worker ($5 x 8 players = $40)');
ok(/Final · closed by the host/.test(txt) && d.querySelector('[data-money-reopen="sat"]'), 'the page shows Saturday as final with a Reopen button');
// now Sunday can close: its frozen payout includes the $8 carried in (skins pot $80 + $8 = $88, Brian's three skins)
ok(!d.querySelector('[data-money-close="sun"]').disabled, 'with Saturday closed, Sunday\'s Close is enabled');
d.querySelector('[data-money-close="sun"]').click(); await tick(400); d = dom.window.document;
c = await dbCfg(); ok(c.rounds[1].payout && c.rounds[1].payout.carried_in === 8 && c.rounds[1].payout.skins.pot === 88 && c.rounds[1].payout.skins.per_skin === 29, 'Sunday\'s frozen payout: $8 carried in, skins pot $88, $29 a skin');
// players can no longer change a closed round's CTP from the panel
dom = await open('&player=' + encodeURIComponent('Brian Hager')); d = dom.window.document; if (d.getElementById('lmAll')) { d.getElementById('lmAll').click(); d.querySelector('[data-lm-hole="10"]').click(); await tick(); d = dom.window.document; }
ok(d.getElementById('lmCtp') && !d.querySelector('[data-lm-ctpopen]') && /closed/.test(d.getElementById('lmCtp').textContent), 'a closed round shows its CTP read-only');
// a spectator (no host code) sees the numbers but has no buttons
dom = await open('&view=money'); d = dom.window.document;
ok(/Final · closed by the host/.test(d.getElementById('app').textContent) && !d.querySelector('[data-money-close],[data-money-reopen]'), 'everyone can read the money; only the host has the buttons');
// reopen
dom = await open('&host=1&view=money', 'HOST1'); d = dom.window.document;
d.querySelector('[data-money-reopen="sat"]').click(); await tick(400); c = await dbCfg(); d = dom.window.document;
ok(c.rounds[0].payout && /Reopen 2026 BFCup - Day2 first/.test(d.getElementById('app').textContent), 'Saturday cannot be reopened while Sunday holds money carried from it');
d.querySelector('[data-money-reopen="sun"]').click(); await tick(400); d = dom.window.document;
d.querySelector('[data-money-reopen="sat"]').click(); await tick(400); c = await dbCfg();
ok(!c.rounds[0].payout && /Live · not closed/.test(dom.window.document.getElementById('app').textContent), 'Reopen clears the frozen payout');
// the weekend table adds the two days
ok(![...d.querySelectorAll('.hcpmatch')].some(x => /No skins won yet/.test(x.textContent) && [...x.querySelectorAll('th')].some(h => h.textContent === 'Back')), 'a pot given back is not listed as winnings (no Back rows)');
ok(/Who has won money/.test(d.getElementById('app').textContent) && /Paid in/.test(d.getElementById('app').textContent), 'the weekend table is there');
{ const rowsOf = t => [...t.querySelectorAll('tbody tr')].map(r => r.textContent);
  const wk = [...d.querySelectorAll('.hcpmatch')].filter(x => /Who has won money/.test(x.textContent))[0];
  ok(wk && rowsOf(wk).every(t => /\$[1-9]/.test(t) || /Nobody has won money yet/.test(t)), 'the weekend table lists only players who won money');
  const pr = [...d.querySelectorAll('.hcpmatch')].filter(x => /Closest to the pin|Skins/.test(x.textContent) || /pot/.test(x.textContent));
  ok(pr.length && pr.every(x => ![...x.querySelectorAll('table.mny')].pop() || [...[...x.querySelectorAll('table.mny')].pop().querySelectorAll('tbody tr')].every(r => /\$[1-9]/.test(r.textContent) || /Nobody has won/.test(r.textContent))), 'each round table lists only winners'); }
console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
