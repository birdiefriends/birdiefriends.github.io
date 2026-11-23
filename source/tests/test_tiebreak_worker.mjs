// Tiebreak route (Worker): the host records the order a putt-off / playoff produced; it lands in game_configs.podium.tie_order.
import fs from 'fs'; import { fileURLToPath, pathToFileURL } from 'url'; import { DatabaseSync } from 'node:sqlite';
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
// ── BFE Worker ──
function makeD1(db) {
  const wrap = (sql) => { const st = { binds: [], bind(...b) { st.binds = b; return st; },
    async first() { return db.prepare(sql).get(...st.binds) ?? null; },
    async all() { return { results: db.prepare(sql).all(...st.binds) }; },
    async run() { const r = db.prepare(sql).run(...st.binds); return { meta: { last_row_id: Number(r.lastInsertRowid), changes: Number(r.changes) } }; },
    _exec() { const r = db.prepare(sql).run(...st.binds); return { meta: { changes: Number(r.changes) } }; } }; return st; };
  const D = { prepare: wrap, withSession() { return D; },
    async batch(stmts) { db.exec('BEGIN'); try { const out = stmts.map(s => s._exec()); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; } } };
  return D;
}
const W = (await import(pathToFileURL(fileURLToPath(new URL('../bf_experiences_worker.js', import.meta.url))).href)).default;
const db = new DatabaseSync(':memory:');
db.exec(`CREATE TABLE bfe_gathering_games (id INTEGER PRIMARY KEY, gathering_id INTEGER UNIQUE, host_id TEXT, status TEXT, game_configs TEXT)`);
const podium = { dollar_per_player: 6, rank_by: 'round', basis: 'gross', table: { flights: [], prizes: [{ scope: 'overall', place: 1, amount: 100 }] }, tiebreak: ['Putt-off'] };
db.prepare(`INSERT INTO bfe_gathering_games (gathering_id, host_id, status, game_configs) VALUES (7, 'Brian Hager', 'open', ?)`).run(JSON.stringify({ podium }));
const env = { DB: makeD1(db) };
const post = async (b) => { const r = await W.fetch(new Request('https://x.test/bfe/gathering-games/7/tiebreak', { method: 'POST', body: JSON.stringify(b) }), env, { waitUntil() {} }); return { st: r.status, j: await r.json() }; };
const cfg = () => JSON.parse(db.prepare(`SELECT game_configs FROM bfe_gathering_games WHERE gathering_id = 7`).get().game_configs).podium;
let r = await post({ host_id: 'Someone Else', scope: 'overall', order: ['Ann', 'Bo'] }); ok(r.st === 403, 'only the host can record it');
r = await post({ host_id: 'brian hager', scope: 'overall', order: ['Ann', 'Bo'] }); ok(r.st === 200 && cfg().tie_order.overall.join() === 'Ann,Bo' && cfg().tiebreak[0] === 'Putt-off' && cfg().dollar_per_player === 6, 'the host records the order and the rest of the Prizes config is untouched');
r = await post({ host_id: 'Brian Hager', scope: 'overall', order: ['Cy', 'Ann'] }); ok(cfg().tie_order.overall.join() === 'Bo,Cy,Ann', 'a later result is added after the earlier one, never duplicating a name');
r = await post({ host_id: 'Brian Hager', scope: 'overall', order: [] }); ok(r.st === 200 && !cfg().tie_order, 'an empty order clears it');
r = await post({ host_id: 'Brian Hager', scope: 'overall' }); ok(r.st === 400, 'a missing order is refused');
db.prepare(`UPDATE bfe_gathering_games SET status = 'closed'`).run(); r = await post({ host_id: 'Brian Hager', scope: 'overall', order: ['Ann'] }); ok(r.st === 409, 'a closed round cannot be changed');
db.prepare(`UPDATE bfe_gathering_games SET status = 'open', game_configs = '{}'`).run(); r = await post({ host_id: 'Brian Hager', scope: 'overall', order: ['Ann'] }); ok(r.st === 400, 'no Prizes game, no tiebreak');
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
