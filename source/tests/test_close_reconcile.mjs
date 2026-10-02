// v4.12.0 — Close & Calculate reconcile (portal gcReconcile), Open Spot take-over (BFE Worker fill by a
// non-host + handicap_config rename), and a partial net handicap list saving (BFE games POST).
import fs from 'fs'; import { fileURLToPath, pathToFileURL } from 'url';
import { DatabaseSync } from 'node:sqlite';
import { extractFn } from './extract.mjs';
const src = fs.readFileSync(new URL('../portal.html', import.meta.url), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const gcReconcile = new Function(extractFn(src, 'gcReconcile') + '; return gcReconcile;')();

const net = { skins_basis: 'net', birdiepay_basis: 'gross', players: { 'Ann Lee': { kind: 'index' }, 'Bob Roy': { kind: 'gross' } } };
let r = gcReconcile({ config: { handicap_config: net }, cardPlayers: ['Ann Lee', 'Bob Roy', 'Cy Young'], registeredRows: [{ player: 'Ann Lee' }, { player: 'Bob Roy' }, { player: 'Cy Young', addedBy: 'Host' }], openSpots: [] });
ok(r.noHandicap.join() === 'Cy Young' && r.blocking, 'net player with a card and no handicap blocks');
ok(r.added.length === 1 && r.added[0].player === 'Cy Young' && r.added[0].hasCard, 'added-on-course listed, with card');
r = gcReconcile({ config: { handicap_config: net }, cardPlayers: ['Ann Lee', 'Cy Young'], registeredRows: [{ player: 'Ann Lee' }, { player: 'Cy Young' }], openSpots: [], acked: new Set(['cy young']) });
ok(!r.blocking && r.scratch.join() === 'Cy Young' && !r.noHandicap.length, 'playing scratch acknowledges it');
r = gcReconcile({ config: { handicap_config: null }, cardPlayers: ['Ann Lee'], registeredRows: [{ player: 'Ann Lee' }], openSpots: [] });
ok(!r.blocking && !r.noHandicap.length, 'gross game: nothing to settle');
r = gcReconcile({ config: {}, cardPlayers: ['Ann Lee'], registeredRows: [{ player: 'Ann Lee' }], openSpots: ['Open Spot 1'] });
ok(r.blocking, 'open spot blocks');
r = gcReconcile({ config: {}, cardPlayers: ['Ann Lee', 'Zed Nobody'], registeredRows: [{ player: 'Ann Lee' }], openSpots: [] });
ok(r.unregisteredCards.join() === 'Zed Nobody', 'card under an unregistered name is flagged');
r = gcReconcile({ config: { handicap_config: net }, cardPlayers: ['ann lee'], registeredRows: [{ player: 'Ann Lee' }], openSpots: [] });
ok(!r.noHandicap.length, 'name match is case-insensitive');
r = gcReconcile({ config: { handicap_config: net }, cardPlayers: ['Ann Lee'], registeredRows: [{ player: 'Ann Lee', addedBy: 'Host' }, { player: 'Dee', addedBy: 'Host' }], openSpots: [] });
ok(r.added.find(a => a.player === 'Dee' && !a.hasCard), 'added player with no card can be removed');

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
const mk = (migrated = true) => { const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE gatherings (id INTEGER PRIMARY KEY, host_id TEXT, size INTEGER, crew_id INTEGER);
   CREATE TABLE registrations (gathering_id INTEGER, player_id TEXT, status TEXT, registered_at TEXT, confirmed_for TEXT, host_note TEXT, is_placeholder INTEGER NOT NULL DEFAULT 0${migrated ? ', added_by TEXT, added_at TEXT' : ''}, UNIQUE(gathering_id, player_id));
   CREATE TABLE bfe_scorecards (id INTEGER PRIMARY KEY AUTOINCREMENT, event_name TEXT NOT NULL, player TEXT NOT NULL, holes TEXT, total REAL, UNIQUE(event_name, player));
   CREATE TABLE bfe_cttp_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, event_name TEXT NOT NULL, hole INTEGER, player TEXT NOT NULL, dist REAL);
   CREATE TABLE bfe_birdieball_answers (id INTEGER PRIMARY KEY AUTOINCREMENT, gathering_id INTEGER, player_name TEXT, kept INTEGER, UNIQUE(gathering_id, player_name));
   CREATE TABLE bfe_gathering_games (id INTEGER PRIMARY KEY, gathering_id INTEGER UNIQUE, host_id TEXT, status TEXT, payout_summary TEXT, closed_at TEXT, updated_at TEXT, handicap_config TEXT, gathering_name TEXT, games TEXT, dollar_per_player REAL, allocations TEXT, cttp_config TEXT, birdieball_config TEXT, birdiepay_config TEXT);
   INSERT INTO gatherings VALUES (7,'Host',4,1);
   INSERT INTO registrations (gathering_id, player_id, status, is_placeholder) VALUES (7,'Host','yes',0),(7,'Open Spot 1','yes',1);
   INSERT INTO bfe_scorecards (event_name, player, holes, total) VALUES ('gathering:7','Open Spot 1','[]',80);
   INSERT INTO bfe_gathering_games (gathering_id, host_id, status, handicap_config) VALUES (7,'Host','open','{"allowance":95,"players":{"Open Spot 1":{"kind":"gross","strokes":0},"Host":{"kind":"gross","strokes":0}}}');`); return db; };
const call = async (db, method, path, body) => { const r = await W.fetch(new Request('https://w' + path, { method, body: body ? JSON.stringify(body) : undefined }), { DB: makeD1(db) }, {}); return [r.status, await r.json()]; };

let db = mk();
let [st, d] = await call(db, 'POST', '/bfe/gathering-spots/7/fill', { spot: 'Open Spot 1', member: 'Cy Young' });
ok(st === 400, 'fill with neither host_id nor by is refused');
[st, d] = await call(db, 'POST', '/bfe/gathering-spots/7/add', { by: 'Cy', count: 1 });
ok(st === 400, 'add stays host-only (by is not enough)');
[st, d] = await call(db, 'POST', '/bfe/gathering-spots/7/fill', { host_id: 'Someone Else', spot: 'Open Spot 1', member: 'Cy Young' });
ok(st === 403, 'a non-host host_id still refused');
[st, d] = await call(db, 'POST', '/bfe/gathering-spots/7/fill', { by: 'Host Buddy', spot: 'Open Spot 1', member: 'Cy Young' });
ok(st === 200 && d.ok, 'any group member can take over a held seat');
const reg = db.prepare(`SELECT * FROM registrations WHERE gathering_id=7 AND player_id='Cy Young'`).get();
ok(reg && reg.is_placeholder === 0 && reg.added_by === 'Host Buddy', 'seat renamed and marked added_by');
ok(db.prepare(`SELECT player FROM bfe_scorecards`).get().player === 'Cy Young', 'scorecard moved to the real player');
const hc = JSON.parse(db.prepare(`SELECT handicap_config FROM bfe_gathering_games`).get().handicap_config);
ok(hc.players['Cy Young'] && !hc.players['Open Spot 1'] && hc.players.Host, 'handicap_config key renamed with the player');
db = mk(false);
[st, d] = await call(db, 'POST', '/bfe/gathering-spots/7/fill', { by: 'Host Buddy', spot: 'Open Spot 1', member: 'Cy Young' });
ok(st === 200 && d.ok, 'take-over works before the added_by ALTER');

// partial net handicap list saves
db = mk();
db.exec(`DELETE FROM bfe_gathering_games`);
[st, d] = await call(db, 'POST', '/bfe/gathering-games', { gathering_id: 7, gathering_name: 'G', host_id: 'Host', games: ['skins'], dollar_per_player: 5,
  handicap_config: { allowance: 95, skins_basis: 'net', birdiepay_basis: 'gross', players: {} } });
ok(st === 200 && d.ok, 'net with no settled players saves (empty players)');
console.log(`close_reconcile: ${pass} pass, ${fail} fail`); process.exit(fail ? 1 : 0);
