// Dev-95 — BF Cup config routes on the BFE Worker, against real SQLite (node:sqlite): self-creating table, PIN gate, upsert, read, delete.
import { fileURLToPath, pathToFileURL } from 'url';
import { DatabaseSync } from 'node:sqlite';
const HERE = (p) => fileURLToPath(new URL(p, import.meta.url));
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const W = (await import(pathToFileURL(HERE('../bf_experiences_worker.js')).href)).default;
function makeD1(db) {
  const wrap = (sql) => { const st = { binds: [], bind(...b) { st.binds = b; return st; },
    async first() { return db.prepare(sql).get(...st.binds) ?? null; }, async all() { return { results: db.prepare(sql).all(...st.binds) }; },
    async run() { const r = db.prepare(sql).run(...st.binds); return { meta: { last_row_id: Number(r.lastInsertRowid), changes: Number(r.changes) } }; } }; return st; };
  const D = { prepare: wrap, withSession() { return D; } }; return D;
}
const db = new DatabaseSync(':memory:');           // NO bfe_cup table: the route must create it
const call = async (method, path, body) => {
  const r = await W.fetch(new Request('https://w' + path, { method, body: body ? JSON.stringify(body) : undefined }), { DB: makeD1(db) }, {});
  return { status: r.status, json: await r.json() };
};
const cfg = { sides: [{ key: 'A', name: 'Team Jake', players: ['A1'] }, { key: 'B', name: 'Team Nate', players: ['B1'] }], points: { win: 1, half: 0.5, loss: 0 }, rounds: [] };
let r = await call('GET', '/bfe/cup?event=BF%20Cup');
ok(r.status === 404, 'unknown event is a 404 and the table is created on the fly (got ' + r.status + ')');
r = await call('POST', '/bfe/cup', { event_name: 'BF Cup', config: cfg });
ok(r.status === 403, 'no PIN, no write');
r = await call('POST', '/bfe/cup', { event_name: 'BF Cup', config: { sides: [], rounds: [] }, pin: '7797' });
ok(r.status === 400, 'needs two sides');
r = await call('POST', '/bfe/cup', { event_name: 'BF Cup', config: cfg, pin: '7797' });
ok(r.status === 200 && r.json.ok, 'saved');
r = await call('GET', '/bfe/cup?event=BF%20Cup');
ok(r.status === 200 && r.json.config.sides[0].name === 'Team Jake', 'read back, no PIN needed');
cfg.sides[0].players.push('A2');
await call('POST', '/bfe/cup', { event_name: 'BF Cup', config: cfg, pin: '7797' });
r = await call('GET', '/bfe/cup?event=BF%20Cup');
ok(r.json.config.sides[0].players.length === 2, 'a second save replaces the document');
ok(db.prepare('SELECT COUNT(*) n FROM bfe_cup').get().n === 1, 'one row per event');
r = await call('DELETE', '/bfe/cup?event=BF%20Cup&pin=1');
ok(r.status === 403, 'delete needs the PIN');
r = await call('DELETE', '/bfe/cup?event=BF%20Cup&pin=7797');
ok(r.status === 200, 'deleted');
r = await call('GET', '/bfe/cup?event=BF%20Cup');
ok(r.status === 404, 'gone');
// ── captain access: codes are private, picks follow the snake order, only the side on the clock can pick ──
const dcfg = { sides: [{ key: 'A', name: 'Team Jake', captain: 'Jake', players: [] }, { key: 'B', name: 'Team Nate', captain: 'Nate', players: [] }], points: { win: 1, half: 0.5, loss: 0 }, rounds: [],
  draft: { started: true, first: 'A', pool: ['P1', 'P2', 'P3', 'P4', 'Jake', 'Nate'], picks: [], locked: false }, access: { A: 'AAA111', B: 'BBB222' } };
r = await call('POST', '/bfe/cup', { event_name: 'Draft Cup', config: dcfg, pin: '7797' });
r = await call('GET', '/bfe/cup?event=Draft%20Cup');
ok(r.status === 200 && r.json.config.access === undefined && !JSON.stringify(r.json).includes('AAA111'), 'the public read never carries the captain codes');
r = await call('GET', '/bfe/cup?event=Draft%20Cup&pin=7797');
ok(r.json.config.access && r.json.config.access.A === 'AAA111', 'the host (PIN) can read the codes');
r = await call('GET', '/bfe/cup?event=Draft%20Cup&cap=BBB222');
ok(r.status === 200 && r.json.you === 'B' && !r.json.config.access, 'a captain code identifies his side and still hides the codes');
r = await call('GET', '/bfe/cup?event=Draft%20Cup&cap=nope');
ok(r.status === 403, 'a wrong captain code is refused');
// a host/BFE-Admin re-save without codes must not wipe them
await call('POST', '/bfe/cup', { event_name: 'Draft Cup', config: Object.assign({}, dcfg, { access: undefined }), pin: '7797' });
r = await call('GET', '/bfe/cup?event=Draft%20Cup&pin=7797');
ok(r.json.config.access && r.json.config.access.B === 'BBB222', 'a re-save without codes keeps them');
const act = (code, player) => call('POST', '/bfe/cup/act', { event_name: 'Draft Cup', code, action: 'pick', player });
r = await act('BBB222', 'P1'); ok(r.status === 409 && /not your turn/.test(r.json.error), 'B cannot pick while A is on the clock');
r = await act('wrong', 'P1'); ok(r.status === 403, 'a bad code cannot pick');
r = await act('AAA111', 'Jake'); ok(r.status === 409, 'captains are not in the pool to pick');
r = await act('AAA111', 'p1'); ok(r.status === 200 && r.json.config.draft.picks[0].player === 'P1' && r.json.config.draft.picks[0].side === 'A', 'A picks P1 (case-insensitive, canonical name stored)');
r = await act('AAA111', 'P2'); ok(r.status === 409, 'snake: B has picks 2 and 3, so A is not on the clock');
r = await act('BBB222', 'P1'); ok(r.status === 409 && /not available/.test(r.json.error), 'a picked player is not available');
r = await act('BBB222', 'P2'); ok(r.status === 200, 'B picks 2');
r = await act('BBB222', 'P3'); ok(r.status === 200, 'B picks 3 (snake)');
r = await act('AAA111', 'P4'); ok(r.status === 200 && r.json.config.draft.picks.length === 4, 'A picks 4');
r = await act('AAA111', 'P4'); ok(r.status === 409, 'nothing left to pick');
r = await call('GET', '/bfe/cup-live');
ok(r.status === 200 && r.json.events.some(e => e.event_name === 'Draft Cup' && e.picks === 4 && e.total === 6), 'the live list shows the open draft');
await call('POST', '/bfe/cup', { event_name: 'Draft Cup (practice)', config: dcfg, pin: '7797' });
r = await call('GET', '/bfe/cup-live');
ok(!r.json.events.some(e => /practice/.test(e.event_name)), 'practice copies are not announced in the app');
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
