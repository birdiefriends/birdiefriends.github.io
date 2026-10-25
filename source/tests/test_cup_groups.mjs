// Dev-95 — foursomes in scoring: two singles matches share a group (matches 5 and 6 are Group 1) and one scorer keeps all four players.
import fs from 'fs'; import { JSDOM } from 'jsdom'; import { fileURLToPath, pathToFileURL } from 'url'; import { DatabaseSync } from 'node:sqlite'; import { loadEngine } from './extract.mjs';
const HERE = p => fileURLToPath(new URL(p, import.meta.url));
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const E = loadEngine();
const SI = [1,3,5,7,9,11,13,15,17,2,4,6,8,10,12,14,16,18];
const mk = () => ({ sides: [{ key: 'A', name: 'Team Jake', captain: 'a1', players: ['a1', 'a2', 'a3', 'a4'] }, { key: 'B', name: 'Team Nate', captain: 'b1', players: ['b1', 'b2', 'b3', 'b4'] }], points: { win: 1, half: 0.5, loss: 0 },
  access: { A: 'AAA111', B: 'BBB222' }, handicap: { bestball: 75, altshot: 50, singles: 75, strokeIndex: SI },
  draft: { started: true, first: 'A', pool: [], stats: { a1: { hcp: 4 }, a2: { hcp: 8 }, a3: { hcp: 12 }, a4: { hcp: 16 }, b1: { hcp: 6 }, b2: { hcp: 10 }, b3: { hcp: 14 }, b4: { hcp: 18 } }, picks: [], locked: true }, matchup: { started: true, done: true, first: 'B', log: [] },
  rounds: [{ key: 'sat', name: 'Saturday', segments: [{ key: 's1', format: 'bestball', from: 1, to: 9 }, { key: 's2', format: 'altshot', from: 10, to: 18 }], matches: [{ key: 'm1', sides: [{ side: 'A', players: ['a1', 'a2'] }, { side: 'B', players: ['b1', 'b2'] }] }, { key: 'm2', sides: [{ side: 'A', players: ['a3', 'a4'] }, { side: 'B', players: ['b3', 'b4'] }] }] },
    { key: 'sun', name: 'Sunday', segments: [{ key: 's1', format: 'singles', from: 1, to: 18 }], matches: [
      { key: 'm1', sides: [{ side: 'A', players: ['a1'] }, { side: 'B', players: ['b4'] }] }, { key: 'm2', sides: [{ side: 'A', players: ['a2'] }, { side: 'B', players: ['b3'] }] },
      { key: 'm3', sides: [{ side: 'A', players: ['a3'] }, { side: 'B', players: ['b2'] }] }, { key: 'm4', sides: [{ side: 'A', players: ['a4'] }, { side: 'B', players: ['b1'] }] }] }] });
const c = mk();
const g = E.cupGroupsOf(c.rounds[1]); ok(g.length === 2 && g[0].matches.map(m => m.key).join() === 'm1,m2' && g[1].matches.map(m => m.key).join() === 'm3,m4', 'singles: two matches per group, in draw order');
ok(E.cupGroupsOf(c.rounds[0]).length === 2 && E.cupGroupsOf(c.rounds[0])[0].matches.length === 1, 'pairs: the match is the group');
const n = E.cupMatchNumbers(c); ok(n['sat|m1'] === 1 && n['sun|m1'] === 3 && n['sun|m4'] === 6, 'match numbers run across the Cup (singles start at 3 here, 5 with four pairs matches)');
// ---- worker: anyone in the foursome scores either match ----
const W = (await import(pathToFileURL(HERE('../bf_experiences_worker.js')).href)).default;
function makeD1(db) { const wrap = (sql) => { const st = { binds: [], bind(...b) { st.binds = b; return st; }, async first() { return db.prepare(sql).get(...st.binds) ?? null; }, async all() { return { results: db.prepare(sql).all(...st.binds) }; }, async run() { const r = db.prepare(sql).run(...st.binds); return { meta: { last_row_id: Number(r.lastInsertRowid), changes: Number(r.changes) } }; } }; return st; }; const D = { prepare: wrap, withSession() { return D; } }; return D; }
const db = new DatabaseSync(':memory:');
const call = async (method, path, body) => { const rr = await W.fetch(new Request('https://w' + path, { method, body: body ? JSON.stringify(body) : undefined }), { DB: makeD1(db) }, {}); return { status: rr.status, json: await rr.json() }; };
await call('POST', '/bfe/cup', { event_name: 'G', config: mk(), pin: '7797' });
const act = o => call('POST', '/bfe/cup/act', Object.assign({ event_name: 'G', action: 'score', round: 'sun', hole: 1 }, o));
let w = await act({ match: 'm2', player: 'a1', scores: { a2: 4, b3: 5 } }); ok(w.status === 200, 'a1 (playing match 1) scores match 2: same foursome');
w = await act({ match: 'm3', player: 'a1', scores: { a3: 4, b2: 5 } }); ok(w.status === 403, 'a1 cannot score the other foursome');
w = await act({ match: 'm3', player: 'b2', scores: { a3: 4, b2: 5 } }); ok(w.status === 200, 'a player in that match can');
// ---- page ----
const engine = fs.readFileSync(HERE('../bf_engine.js'), 'utf8'), lm = fs.readFileSync(HERE('../../docs/bf_live_match.js'), 'utf8');
const page = fs.readFileSync(HERE('../../docs/bf-cup-draft.html'), 'utf8').replace(/<script src="bf_engine.js[^>]*><\/script>/, '<script>' + engine + '</script>').replace(/<script src="bf_live_match.js[^>]*><\/script>/, '<script>' + lm + '</script>');
let doc = mk(); doc.closed = { sat: { m1: { how: 'halve' }, m2: { how: 'halve' } } };
const posts = []; const pub = () => { const x = JSON.parse(JSON.stringify(doc)); delete x.access; return x; };
const ff = async (u, o) => { const J = (x, st = 200) => ({ ok: st < 400, status: st, json: async () => x });
  if (/\/bfe\/cup\/act/.test(u)) { const b = JSON.parse(o.body); posts.push(b); if (b.action === 'score') { doc.scores = doc.scores || {}; const r = doc.scores[b.round] = doc.scores[b.round] || {}; const m = r[b.match] = r[b.match] || { h: {}, t: {}, by: {} }; m.h[String(b.hole)] = b.scores; } return J({ ok: true, config: pub() }); }
  return J({ ok: true, config: pub() }); };
const tick = (ms = 100) => new Promise(rr => setTimeout(rr, ms));
const dom = new JSDOM(page, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://x.test/bf-cup-draft.html?player=a2', beforeParse(win) { win.fetch = ff; win.confirm = () => true; } }); await tick(250);
let d = dom.window.document; const click = async sel => { const el = dom.window.document.querySelector(sel); if (!el) throw new Error('missing ' + sel); el.click(); await tick(150); };
ok(d.getElementById('lmMatchSel').value === 'sun|g1', 'opens on a2\'s foursome: Sunday Group 1 (Saturday is closed)');
ok(/Group/.test(d.querySelector('label').textContent) && d.querySelectorAll('optgroup').length === 2, 'the picker is by group, under the round');
ok(d.querySelectorAll('.lmhead').length === 2 && /Match 3 · Group 1/.test(d.querySelector('.lm').textContent) && /Match 4 · Group 1/.test(d.querySelector('.lm').textContent), 'one header per match in the group, numbered across the Cup');
ok(d.querySelectorAll('.lmchip').length === 4, 'one scorer, four players on screen');
for (const [p, v] of [['a1', 4], ['b4', 5], ['a2', 3], ['b3', 4]]) await click('[data-lm-s="' + p + '|' + v + '"]');
d = dom.window.document; ok(!d.getElementById('lmPost').disabled, 'Post unlocks when all four are tapped');
await click('#lmPost');
const sp = posts.filter(p => p.action === 'score'); ok(sp.length === 2 && sp.map(p => p.match).sort().join() === 'm1,m2' && JSON.stringify(sp.find(p => p.match === 'm1').scores) === '{"a1":4,"b4":5}', 'one tap posts each match with its own two players');
d = dom.window.document; ok(/Match 3 · hole 1: /.test(d.querySelector('.lm').textContent) && /Match 4 · hole 1: /.test(d.querySelector('.lm').textContent), 'a result line per match after posting');
console.log('groups: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
