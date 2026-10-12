// Commissioner "Delete this round": POST /bfe/gathering-destroy, run against REAL SQLite with the real table shapes.
import { fileURLToPath, pathToFileURL } from 'url';
import { DatabaseSync } from 'node:sqlite';
const HERE = (p) => fileURLToPath(new URL(p, import.meta.url));
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const W = (await import(pathToFileURL(HERE('../bf_experiences_worker.js')).href)).default;
function makeD1(db) {
  const wrap = (sql) => { const st = { binds: [], bind(...b) { st.binds = b; return st; },
    async first() { return db.prepare(sql).get(...st.binds) ?? null; },
    async all() { return { results: db.prepare(sql).all(...st.binds) }; },
    async run() { const r = db.prepare(sql).run(...st.binds); return { meta: { changes: Number(r.changes) } }; },
    _exec() { const r = db.prepare(sql).run(...st.binds); return { meta: { changes: Number(r.changes) } }; } }; return st; };
  const D = { prepare: wrap, withSession() { return D; },
    async batch(stmts) { db.exec('BEGIN'); try { const out = stmts.map(s => s._exec()); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; } } };
  return D;
}
const mk = (opts = {}) => { const db = new DatabaseSync(':memory:'); db.exec('PRAGMA foreign_keys = ON');
  db.exec(`
  CREATE TABLE crews (id INTEGER PRIMARY KEY, name TEXT);
  CREATE TABLE gatherings (id INTEGER PRIMARY KEY, host_id TEXT, title TEXT, status TEXT, event_ref TEXT, crew_id INTEGER REFERENCES crews(id));
  CREATE TABLE registrations (gathering_id INTEGER NOT NULL REFERENCES gatherings(id), player_id TEXT, status TEXT);
  CREATE TABLE bfe_scorecards (id INTEGER PRIMARY KEY AUTOINCREMENT, event_name TEXT, player TEXT, holes TEXT);
  CREATE TABLE bfe_cttp_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, event_name TEXT, hole INTEGER, player TEXT);
  CREATE TABLE bfe_birdieball_answers (id INTEGER PRIMARY KEY AUTOINCREMENT, gathering_id INTEGER, player_name TEXT);
  CREATE TABLE bfe_gathering_games (id INTEGER PRIMARY KEY AUTOINCREMENT, gathering_id INTEGER UNIQUE, payout_summary TEXT);
  ${opts.noOptional ? '' : `CREATE TABLE event_notes (id INTEGER PRIMARY KEY AUTOINCREMENT, event_name TEXT, player TEXT, note TEXT);
  CREATE TABLE event_weather (event_name TEXT PRIMARY KEY, venue TEXT);
  CREATE TABLE event_groupings (event_name TEXT, player_name TEXT);
  CREATE TABLE registration_intent (event_name TEXT, player_name TEXT);
  CREATE TABLE event_photos (id INTEGER PRIMARY KEY AUTOINCREMENT, event_name TEXT, r2_key TEXT);`}
  INSERT INTO crews VALUES (1, 'Test crew');
  INSERT INTO gatherings VALUES (7, 'Brian Hager', 'Testgames1', 'open', NULL, 1), (8, 'Brian Hager', 'Real Round', 'open', NULL, 1), (9, 'Brian Hager', 'Series shadow', 'event_shadow', 'BF Event', NULL);
  INSERT INTO registrations VALUES (7, 'Brian Hager', 'yes'), (7, 'Test 1', 'yes'), (8, 'Walli', 'yes');
  INSERT INTO bfe_scorecards (event_name, player, holes) VALUES ('gathering:7', 'Brian Hager', '[]'), ('gathering:7', 'Test 1', '[]'), ('gathering:8', 'Walli', '[]');
  INSERT INTO bfe_cttp_entries (event_name, hole, player) VALUES ('gathering:7', 3, 'Test 1'), ('gathering:8', 3, 'Walli');
  INSERT INTO bfe_birdieball_answers (gathering_id, player_name) VALUES (7, 'Test 1'), (8, 'Walli');
  INSERT INTO bfe_gathering_games (gathering_id, payout_summary) VALUES (7, '{}'), (8, '{}');`);
  if (!opts.noOptional) db.exec(`INSERT INTO event_notes (event_name, player, note) VALUES ('gathering:7','Brian Hager','x'), ('gathering:8','Walli','y'); INSERT INTO event_weather VALUES ('gathering:7','BSGC'), ('gathering:8','BSGC'); INSERT INTO event_groupings VALUES ('gathering:7','Brian Hager'); INSERT INTO registration_intent VALUES ('gathering:7','Test 1');`);
  return db; };
const call = async (db, body) => { const r = await W.fetch(new Request('https://w/bfe/gathering-destroy', { method: 'POST', body: JSON.stringify(body) }), { DB: makeD1(db) }, {}); return [r.status, await r.json()]; };
const n = (db, sql) => db.prepare(sql).get().n;

let db = mk(), st, j;
[st, j] = await call(db, { pin: '0000', gathering_id: 7, confirm_title: 'Testgames1' });
ok(st === 403 && n(db, 'SELECT COUNT(*) n FROM gatherings') === 3, 'wrong PIN: refused, nothing deleted');
[st, j] = await call(db, { pin: '7797', gathering_id: 7, confirm_title: 'testgames' });
ok(st === 400 && /does not match/.test(j.error) && n(db, 'SELECT COUNT(*) n FROM gatherings') === 3, 'wrong title typed: refused, nothing deleted');
[st, j] = await call(db, { pin: '7797', gathering_id: 7 });
ok(st === 400, 'no title typed: refused');
[st, j] = await call(db, { pin: '7797', gathering_id: 9, confirm_title: 'Series shadow' });
ok(st === 409 && /BF Series/.test(j.error), 'a BF Series event shadow cannot be deleted');
[st, j] = await call(db, { pin: '7797', gathering_id: 404, confirm_title: 'x' });
ok(st === 404, 'unknown round: 404');

[st, j] = await call(db, { pin: '7797', gathering_id: 7, confirm_title: '  TESTGAMES1 ' });
ok(st === 200 && j.ok && j.title === 'Testgames1', 'right title (case and spaces aside): deleted: ' + JSON.stringify(j));
ok(j.deleted.scorecards === 2 && j.deleted.ctp === 1 && j.deleted.miserball === 1 && j.deleted.games === 1 && j.deleted.registrations === 2 && j.deleted.gathering === 1, 'counts reported per store: ' + JSON.stringify(j.deleted));
ok(j.deleted.notes === 1 && j.deleted.weather === 1 && j.deleted.groupings === 1 && j.deleted.intents === 1, 'optional stores cleared and counted');
ok(n(db, "SELECT COUNT(*) n FROM bfe_scorecards WHERE event_name='gathering:7'") === 0 && n(db, 'SELECT COUNT(*) n FROM registrations WHERE gathering_id=7') === 0 && n(db, 'SELECT COUNT(*) n FROM gatherings WHERE id=7') === 0, 'round 7 is gone everywhere');
ok(n(db, 'SELECT COUNT(*) n FROM gatherings WHERE id IN (8,9)') === 2 && n(db, "SELECT COUNT(*) n FROM bfe_scorecards WHERE event_name='gathering:8'") === 1 && n(db, 'SELECT COUNT(*) n FROM registrations WHERE gathering_id=8') === 1
  && n(db, "SELECT COUNT(*) n FROM bfe_cttp_entries WHERE event_name='gathering:8'") === 1 && n(db, 'SELECT COUNT(*) n FROM bfe_gathering_games WHERE gathering_id=8') === 1 && n(db, "SELECT COUNT(*) n FROM event_notes WHERE event_name='gathering:8'") === 1, 'other rounds are untouched');
ok(n(db, 'SELECT COUNT(*) n FROM crews') === 1, 'the crew is left alone (another round uses it)');
[st, j] = await call(db, { pin: '7797', gathering_id: 7, confirm_title: 'Testgames1' });
ok(st === 404, 'deleting twice: 404, no harm');

// photos block the delete (their image files would be orphaned)
db = mk(); db.exec("INSERT INTO event_photos (event_name, r2_key) VALUES ('gathering:7', 'k1')");
[st, j] = await call(db, { pin: '7797', gathering_id: 7, confirm_title: 'Testgames1' });
ok(st === 409 && /1 photo/.test(j.error) && n(db, 'SELECT COUNT(*) n FROM gatherings WHERE id=7') === 1, 'a round with photos is refused, nothing deleted');

// a deployment without the optional tables still deletes the core data
db = mk({ noOptional: true });
[st, j] = await call(db, { pin: '7797', gathering_id: 7, confirm_title: 'Testgames1' });
ok(st === 200 && j.deleted.gathering === 1 && j.deleted.notes === 0, 'optional tables missing: core delete still works: ' + JSON.stringify(j));

console.log(`gathering destroy: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
