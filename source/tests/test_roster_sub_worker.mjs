// BFE Worker: the roster Sub flag survives a save and a load (real SQLite, the roster table WITHOUT the new column, as in production today).
import { fileURLToPath, pathToFileURL } from 'url';
import { DatabaseSync } from 'node:sqlite';
const HERE = (p) => fileURLToPath(new URL(p, import.meta.url));
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const W = (await import(pathToFileURL(HERE('../bf_experiences_worker.js')).href)).default;
const db = new DatabaseSync(':memory:');
db.exec(`CREATE TABLE bfe_events (id INTEGER PRIMARY KEY AUTOINCREMENT, event_name TEXT UNIQUE NOT NULL, event_family TEXT, event_date TEXT, event_end_date TEXT, memories_capture_open INTEGER NOT NULL DEFAULT 0, trip_info_url TEXT, hcp_mode TEXT NOT NULL DEFAULT 'fixed', status TEXT NOT NULL DEFAULT 'draft', tee_policy TEXT, payout_plan TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
CREATE TABLE bfe_event_rounds (id INTEGER PRIMARY KEY AUTOINCREMENT, event_id INTEGER NOT NULL, sort_order INTEGER NOT NULL, name TEXT NOT NULL, engine TEXT NOT NULL, engine_params TEXT, influencers TEXT, venue_id INTEGER, venue_name TEXT, rolls_into_overall INTEGER NOT NULL DEFAULT 1, chains_from_round_id INTEGER, tee_time TEXT, UNIQUE(event_id, name));
CREATE TABLE bfe_event_roster (id INTEGER PRIMARY KEY AUTOINCREMENT, event_id INTEGER NOT NULL, player_name TEXT NOT NULL, email TEXT, hcp_at_event REAL, tee_name TEXT, slope REAL, initial_quota REAL, is_no_hcp INTEGER DEFAULT 0, UNIQUE(event_id, player_name));`);
function makeD1(db) {
  const wrap = (sql) => { const st = { binds: [], bind(...b) { st.binds = b; return st; },
    async first() { return db.prepare(sql).get(...st.binds) ?? null; }, async all() { return { results: db.prepare(sql).all(...st.binds) }; },
    async run() { const r = db.prepare(sql).run(...st.binds); return { meta: { last_row_id: Number(r.lastInsertRowid), changes: Number(r.changes) } }; } }; return st; };
  const D = { prepare: wrap, withSession() { return D; } }; return D;
}
const call = async (method, path, body) => { const r = await W.fetch(new Request('https://w' + path, { method, body: body ? JSON.stringify(body) : undefined }), { DB: makeD1(db) }, {}); return { status: r.status, json: await r.json() }; };
const save = (roster) => call('POST', '/bfe/events', { event_name: 'E1', rounds: [{ name: 'R1', engine: 'quota' }], roster, pin: '7797' });
let r = await save([{ name: 'Ann', hcp: 10 }, { name: 'Rich', hcp: 20, sub: true }]);
ok(r.status === 200 && r.json.ok, 'save works on a database that has no is_sub column yet (' + JSON.stringify(r.json).slice(0, 100) + ')');
r = await call('GET', '/bfe/events?event=E1');
const ros = r.json.config.roster;
ok(ros.find(p => p.name === 'Rich').sub === true, 'Rich comes back as a Sub');
ok(ros.find(p => p.name === 'Ann').sub === undefined, 'Ann has no sub flag');
r = await save([{ name: 'Ann', hcp: 10 }, { name: 'Rich', hcp: 20 }]);
r = await call('GET', '/bfe/events?event=E1');
ok(r.json.config.roster.every(p => p.sub === undefined), 'a re-save without the tick clears it');
console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
