// Dev-95 — Sunday singles draw: engine (control, put-up-and-respond, auto last), Worker actions, and the page.
import fs from 'fs'; import { JSDOM } from 'jsdom'; import { fileURLToPath, pathToFileURL } from 'url'; import { DatabaseSync } from 'node:sqlite'; import { loadEngine } from './extract.mjs';
const HERE = p => fileURLToPath(new URL(p, import.meta.url));
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const E = loadEngine();
const mk = () => ({ sides: [{ key: 'A', name: 'Team Jake', captain: 'a1', players: ['a1', 'a2', 'a3', 'a4'] }, { key: 'B', name: 'Team Nate', captain: 'b1', players: ['b1', 'b2', 'b3', 'b4'] }], points: { win: 1, half: 0.5, loss: 0 },
  access: { A: 'AAA111', B: 'BBB222' },
  draft: { started: true, first: 'A', pool: [], stats: {}, picks: [], locked: true }, matchup: { started: true, done: true, first: 'B', log: [] },
  rounds: [{ key: 'sat', name: 'Saturday', segments: [{ key: 's1', format: 'bestball', from: 1, to: 9 }, { key: 's2', format: 'altshot', from: 10, to: 18 }], matches: [{ key: 'm1', sides: [{ side: 'A', players: ['a1', 'a2'] }, { side: 'B', players: ['b1', 'b2'] }] }, { key: 'm2', sides: [{ side: 'A', players: ['a3', 'a4'] }, { side: 'B', players: ['b3', 'b4'] }] }] },
    { key: 'sun', name: 'Sunday', segments: [{ key: 's1', format: 'singles', from: 1, to: 18 }], matches: [] }] });
// ---- engine ----
let c = mk();
ok(E.cupSinglesRound(c) === 1, 'singles round found');
ok(!E.cupSinglesControl(c).ready, 'no result yet: not ready');
c.results = { sat: { points: { A: 3, B: 1 } } };
let k = E.cupSinglesControl(c); ok(k.ready && k.control === 'B' && !k.tie, 'the side that lost is in control');
c.results.sat.points = { A: 2, B: 2 }; k = E.cupSinglesControl(c); ok(k.tie && k.control === 'B', 'a tie goes to the captain who picked second in the team draft (draft.first = A -> B)');
c.singles = { started: true, first: 'A', log: [] };
let v = E.cupSinglesView(c); ok(v.onClock === 'A' && v.role === 'put' && v.avail.A.length === 4, 'first side puts up a player');
let r = E.cupSinglesPick(c, 'B', 'b1'); ok(!r.ok && /not your turn/.test(r.reason), 'not your turn');
const step = (side, p) => { const x = E.cupSinglesPick(c, side, p); if (!x.ok) throw new Error(x.reason); c.singles = x.singles; };
step('A', 'a1'); v = E.cupSinglesView(c); ok(v.onClock === 'B' && v.role === 'respond' && v.facing === 'a1', 'the other side answers');
step('B', 'b3'); v = E.cupSinglesView(c); ok(v.onClock === 'B' && v.role === 'put', 'then the roles swap');
step('B', 'b1'); step('A', 'a4'); step('A', 'a2'); step('B', 'b2');
v = E.cupSinglesView(c);
ok(v.done && v.matches.length === 4, 'six picks make four matches: the last two meet automatically (got ' + v.matches.length + ')');
ok(v.matches[3].sides.map(s => s.players[0]).join() === 'a3,b4', 'the last pair is the two left');
ok(!E.cupSinglesPick(c, 'A', 'a3').ok, 'no picks once set');
// ---- worker ----
const W = (await import(pathToFileURL(HERE('../bf_experiences_worker.js')).href)).default;
function makeD1(db) { const wrap = (sql) => { const st = { binds: [], bind(...b) { st.binds = b; return st; }, async first() { return db.prepare(sql).get(...st.binds) ?? null; }, async all() { return { results: db.prepare(sql).all(...st.binds) }; }, async run() { const r = db.prepare(sql).run(...st.binds); return { meta: { last_row_id: Number(r.lastInsertRowid), changes: Number(r.changes) } }; } }; return st; }; const D = { prepare: wrap, withSession() { return D; } }; return D; }
const db = new DatabaseSync(':memory:');
const call = async (method, path, body) => { const rr = await W.fetch(new Request('https://w' + path, { method, body: body ? JSON.stringify(body) : undefined }), { DB: makeD1(db) }, {}); return { status: rr.status, json: await rr.json() }; };
const base = mk(); base.rounds[0].matches[0].sides[0].players = ['a1', 'a2'];
await call('POST', '/bfe/cup', { event_name: 'S', config: base, pin: '7797' });
const act = o => call('POST', '/bfe/cup/act', Object.assign({ event_name: 'S' }, o));
let w = await act({ code: 'AAA111', action: 'order', stage: 'singles', choice: 'start' }); ok(w.status === 409 && /Finish the pairs round/.test(w.json.error), 'singles draw waits for the Saturday result');
w = await act({ action: 'round_end', round: 'sat', player: 'a1', points: { A: 3, B: 1 } }); ok(w.status === 200, 'round end with points');
let g = await call('GET', '/bfe/cup?event=S'); ok(g.json.config.results.sat.points.A === 3 && g.json.config.results.sat.points.B === 1, 'the result is stored on the Cup record');
w = await act({ code: 'AAA111', action: 'order', stage: 'singles', choice: 'start' }); ok(w.status === 403, 'the winner is not in control');
w = await act({ code: 'BBB222', action: 'order', stage: 'singles', choice: 'defer' }); ok(w.status === 200 && w.json.config.singles.first === 'A', 'the loser defers: the other side goes first');
const live = await call('GET', '/bfe/cup-live'); ok(live.json.events.find(e => e.event_name === 'S').phase === 'singles', 'the app card shows the singles phase');
w = await act({ code: 'BBB222', action: 'singles_pick', player: 'b1' }); ok(w.status === 409 && /not your turn/.test(w.json.error), 'server enforces the turn');
for (const [code, p] of [['AAA111', 'a1'], ['BBB222', 'b3'], ['BBB222', 'b1'], ['AAA111', 'a4'], ['AAA111', 'a2'], ['BBB222', 'b2']]) { w = await act({ code, action: 'singles_pick', player: p }); if (w.status !== 200) console.log('step', p, w.json); }
g = await call('GET', '/bfe/cup?event=S'); const ms = g.json.config.rounds[1].matches;
ok(g.json.config.singles.done && ms.length === 4 && ms[3].sides[0].players[0] === 'a3' && ms[3].sides[1].players[0] === 'b4', 'server writes the four singles matches, last one automatic');
ok(!!g.json.config.phases.singles_open && !!g.json.config.phases.singles_done, 'singles phase markers stamped');
await call('POST', '/bfe/cup', { event_name: 'S', config: Object.assign({}, g.json.config, { singles: undefined, results: undefined }), pin: '7797' });
g = await call('GET', '/bfe/cup?event=S'); ok(g.json.config.singles && g.json.config.results, 'a host re-save keeps the singles draw and the result');
// ---- page ----
const engine = fs.readFileSync(HERE('../bf_engine.js'), 'utf8'), lm = fs.readFileSync(HERE('../../docs/bf_live_match.js'), 'utf8');
const page = fs.readFileSync(HERE('../../docs/bf-cup-draft.html'), 'utf8').replace(/<script src="bf_engine.js[^>]*><\/script>/, '<script>' + engine + '</script>').replace(/<script src="bf_live_match.js[^>]*><\/script>/, '<script>' + lm + '</script>');
let doc = mk(); doc.results = { sat: { points: { A: 3, B: 1 } } };
const pub = () => { const x = JSON.parse(JSON.stringify(doc)); delete x.access; return x; };
const ff = async (u, o) => { const J = (x, st = 200) => ({ ok: st < 400, status: st, json: async () => x });
  if (/\/bfe\/cup\/act/.test(u)) { const b = JSON.parse(o.body), side = b.code === 'AAA111' ? 'A' : 'B';
    if (b.action === 'order') { const f = E.cupOrderFirst(b.choice, side, ['A', 'B'], 0.1, {}); doc.singles = { started: true, first: f.first, log: [], choice: { text: f.text } }; return J({ ok: true, config: pub() }); }
    if (b.action === 'singles_pick') { const x = E.cupSinglesPick(doc, side, b.player); if (!x.ok) return J({ error: x.reason }, 409); doc.singles = x.singles; const vv = E.cupSinglesView(doc); if (vv.done) { doc.rounds[1].matches = vv.matches; doc.singles.done = true; } return J({ ok: true, config: pub() }); } }
  if (o && o.method === 'POST') { doc = JSON.parse(o.body).config; return J({ ok: true }); }
  const cap = (u.match(/[?&]cap=([^&]+)/) || [])[1]; if (cap) return J({ ok: true, config: pub(), you: cap === 'AAA111' ? 'A' : 'B' });
  if (/[?&]pin=7797/.test(u)) return J({ ok: true, config: JSON.parse(JSON.stringify(doc)) });
  return J({ ok: true, config: pub() }); };
const tick = (ms = 100) => new Promise(rr => setTimeout(rr, ms));
async function open(q, pin) { const dom = new JSDOM(page, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://x.test/bf-cup-draft.html' + q, beforeParse(win) { win.fetch = ff; if (pin) win.sessionStorage.setItem('bf_cup_pin', pin); win.confirm = () => true; } }); await tick(200); return dom; }
const click = async (dom, sel) => { const el = dom.window.document.querySelector(sel); if (!el) throw new Error('missing ' + sel); el.click(); await tick(150); };
let dom = await open('?cap=AAA111'); let d = dom.window.document;
ok(/Sunday singles draw is open/.test(d.body.textContent), 'the Score tab announces the singles draw');
await click(dom, '[data-view="teams"]'); d = dom.window.document;
ok(/Saturday ended/.test(d.body.textContent) && /Team Nate lost/.test(d.body.textContent) && !d.querySelector('[data-ochoice]'), 'the winner just waits; the page says who lost');
dom = await open('?cap=BBB222&view=teams'); d = dom.window.document;
ok(d.querySelector('[data-ochoice="start"]') && /You are in control/.test(d.body.textContent), 'the loser sees Start / Defer / Coin toss');
await click(dom, '[data-ochoice="start"]'); d = dom.window.document;
ok(doc.singles.first === 'B' && /puts up a player/.test(d.body.textContent) && d.querySelectorAll('[data-splayer]').length === 4, 'he puts up first and can tap his four players');
await click(dom, '[data-splayer="b2"]'); d = dom.window.document; ok(d.getElementById('sgConfirm') && /b2/.test(d.querySelector('.sheet').textContent), 'a tap asks to confirm');
await click(dom, '#sgConfirm'); d = dom.window.document; ok(doc.singles.log.length === 1 && /waiting for an answer/.test(d.body.textContent), 'the put-up player is shown, waiting for an answer');
dom = await open('?host=1&view=teams', '7797'); d = dom.window.document; ok(d.getElementById('sgUndo'), 'host can undo');
console.log('singles: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
