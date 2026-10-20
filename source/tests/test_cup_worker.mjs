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
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
