// Open spots (placeholder players) — BFE Worker routes, run against REAL SQLite
// (node:sqlite) with the real table shapes, so the rename SQL itself is tested,
// not just its shape. Origin: Gathering 69 (Moselem 09/29) was set up with a
// placeholder player; resolving it later meant renaming one name across seven
// stores by hand. Pins: add spots, list spots, fill = atomic rename everywhere
// (incl. the closed payout snapshot), host-only, member must be real and not
// already in, Close refused while any spot is open, graceful before the
// one-time is_placeholder migration.
import fs from 'fs'; import { fileURLToPath, pathToFileURL } from 'url';
import { DatabaseSync } from 'node:sqlite';
const HERE = (p) => fileURLToPath(new URL(p, import.meta.url));
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const W = (await import(pathToFileURL(HERE('../bf_experiences_worker.js')).href)).default;

// ── D1 shim over node:sqlite (prepare/bind/first/all/run + atomic batch) ──
function makeD1(db) {
  const wrap = (sql) => { const st = { binds: [],
    bind(...b) { st.binds = b; return st; },
    async first() { return db.prepare(sql).get(...st.binds) ?? null; },
    async all() { return { results: db.prepare(sql).all(...st.binds) }; },
    async run() { const r = db.prepare(sql).run(...st.binds); return { meta: { last_row_id: Number(r.lastInsertRowid), changes: Number(r.changes) } }; },
    _exec() { const r = db.prepare(sql).run(...st.binds); return { meta: { changes: Number(r.changes) } }; } }; return st; };
  const D = { prepare: wrap, withSession() { return D; },
    async batch(stmts) { db.exec('BEGIN'); try { const out = stmts.map(s => s._exec()); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; } } };
  return D;
}
const SCHEMA = (withFlag, withCttp = true) => `
  CREATE TABLE gatherings (id INTEGER PRIMARY KEY, host_id TEXT, size INTEGER, crew_id INTEGER);
  CREATE TABLE registrations (gathering_id INTEGER, player_id TEXT, status TEXT, registered_at TEXT, confirmed_for TEXT, host_note TEXT${withFlag ? ', is_placeholder INTEGER NOT NULL DEFAULT 0' : ''}, UNIQUE(gathering_id, player_id));
  CREATE TABLE bfe_scorecards (id INTEGER PRIMARY KEY AUTOINCREMENT, event_name TEXT NOT NULL, player TEXT NOT NULL, holes TEXT, total REAL, UNIQUE(event_name, player));
  ${withCttp ? 'CREATE TABLE bfe_cttp_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, event_name TEXT NOT NULL, hole INTEGER, player TEXT NOT NULL, dist REAL);' : ''}
  CREATE TABLE bfe_birdieball_answers (id INTEGER PRIMARY KEY AUTOINCREMENT, gathering_id INTEGER, player_name TEXT, kept INTEGER, UNIQUE(gathering_id, player_name));
  CREATE TABLE bfe_gathering_games (id INTEGER PRIMARY KEY, gathering_id INTEGER UNIQUE, host_id TEXT, status TEXT, payout_summary TEXT, closed_at TEXT, updated_at TEXT);`;
// The real Gathering 69 closed snapshot (names trimmed to what matters), with the placeholder name.
const SNAP = (spot) => JSON.stringify({ players: [spot, 'Mike Scanlan', 'Scott Justus', 'Brian Hager'],
  skins: { won: [{ hole: 16, player: spot, strokes: 3 }, { hole: 1, player: 'Brian Hager', strokes: 4 }] },
  birdieball: { winners: ['Brian Hager', spot] }, birdiepay: { birdies: [{ hole: 16, player: spot, strokes: 3, par: 4, paid: 2 }] },
  payouts: [{ player: 'Brian Hager', total: 14 }, { player: spot, total: 6 }] });
function seed(withFlag = true, withCttp = true) {
  const db = new DatabaseSync(':memory:'); db.exec(SCHEMA(withFlag, withCttp));
  db.prepare(`INSERT INTO gatherings VALUES (69, 'Brian Hager', 4, 44)`).run();
  const reg = db.prepare(`INSERT INTO registrations (gathering_id, player_id, status, registered_at${withFlag ? ', is_placeholder' : ''}) VALUES (69, ?, 'yes', '2026-09-29'${withFlag ? ', ?' : ''})`);
  ['Brian Hager', 'Mike Scanlan', 'Scott Justus'].forEach(n => withFlag ? reg.run(n, 0) : reg.run(n));
  withFlag ? reg.run('Open Spot 1', 1) : reg.run('Open Spot 1');
  const sc = db.prepare(`INSERT INTO bfe_scorecards (event_name, player, holes, total) VALUES ('gathering:69', ?, '[]', 80)`);
  ['Brian Hager', 'Mike Scanlan', 'Scott Justus', 'Open Spot 1'].forEach(n => sc.run(n));
  if (withCttp) db.prepare(`INSERT INTO bfe_cttp_entries (event_name, hole, player, dist) VALUES ('gathering:69', 3, 'Open Spot 1', 10), ('gathering:69', 5, 'Scott Justus', 8)`).run();
  const bb = db.prepare(`INSERT INTO bfe_birdieball_answers (gathering_id, player_name, kept) VALUES (69, ?, 1)`);
  ['Brian Hager', 'Mike Scanlan', 'Scott Justus', 'Open Spot 1'].forEach(n => bb.run(n));
  db.prepare(`INSERT INTO bfe_gathering_games (gathering_id, host_id, status, payout_summary) VALUES (69, 'Brian Hager', 'closed', ?)`).run(SNAP('Open Spot 1'));
  return db;
}
const call = async (db, method, path, body) => {
  const r = await W.fetch(new Request('https://w' + path, { method, body: body ? JSON.stringify(body) : undefined }), { DB: makeD1(db) }, {});
  return [r.status, await r.json()];
};
const names = (db, sql) => db.prepare(sql).all().map(r => Object.values(r)[0]);

// ── list ──
let db = seed();
let [st, j] = await call(db, 'GET', '/bfe/gathering-spots?gathering_id=69');
ok(st === 200 && j.spots.length === 1 && j.spots[0].player_id === 'Open Spot 1', 'GET by gathering lists the spot');
[st, j] = await call(db, 'GET', '/bfe/gathering-spots?host_id=brian%20hager');
ok(st === 200 && j.spots.length === 1 && j.spots[0].gathering_id === 69, 'GET by host is case-insensitive');
[st, j] = await call(db, 'GET', '/bfe/gathering-spots?host_id=Someone%20Else');
ok(j.spots.length === 0, 'other host sees none');
[st, j] = await call(db, 'GET', '/bfe/gathering-spots');
ok(st === 400, 'GET needs a filter');

// ── fill: the Gathering 69 case ──
[st, j] = await call(db, 'POST', '/bfe/gathering-spots/69/fill', { host_id: 'Mike Scanlan', spot: 'Open Spot 1', member: 'Jim Bingham' });
ok(st === 403, 'only the host can fill: ' + st);
[st, j] = await call(db, 'POST', '/bfe/gathering-spots/69/fill', { host_id: 'Brian Hager', spot: 'Mike Scanlan', member: 'Jim Bingham' });
ok(st === 404, 'a real player is not an open spot: ' + st);
[st, j] = await call(db, 'POST', '/bfe/gathering-spots/69/fill', { host_id: 'Brian Hager', spot: 'Open Spot 1', member: 'Open Spot 2' });
ok(st === 400, 'cannot fill with another placeholder: ' + st);
[st, j] = await call(db, 'POST', '/bfe/gathering-spots/69/fill', { host_id: 'Brian Hager', spot: 'Open Spot 1', member: 'scott justus' });
ok(st === 409, 'cannot fill with someone already playing (case-insensitive): ' + st);
[st, j] = await call(db, 'POST', '/bfe/gathering-spots/69/fill', { host_id: 'Brian Hager', spot: 'Open Spot 1', member: 'Jim Bingham' });
ok(st === 200 && j.ok, 'fill succeeds: ' + JSON.stringify(j));
ok(names(db, `SELECT player_id FROM registrations WHERE gathering_id=69 ORDER BY player_id`).join('|') === 'Brian Hager|Jim Bingham|Mike Scanlan|Scott Justus', 'registrations renamed');
ok(db.prepare(`SELECT is_placeholder FROM registrations WHERE player_id='Jim Bingham'`).get().is_placeholder === 0, 'flag cleared');
ok(names(db, `SELECT player FROM bfe_scorecards ORDER BY player`).join('|') === 'Brian Hager|Jim Bingham|Mike Scanlan|Scott Justus', 'scorecard renamed');
ok(names(db, `SELECT player FROM bfe_cttp_entries ORDER BY hole`).join('|') === 'Jim Bingham|Scott Justus', 'CTP claim renamed, others untouched');
ok(names(db, `SELECT player_name FROM bfe_birdieball_answers ORDER BY player_name`).join('|') === 'Brian Hager|Jim Bingham|Mike Scanlan|Scott Justus', 'BirdieBall answer renamed');
const raw = db.prepare(`SELECT payout_summary FROM bfe_gathering_games`).get().payout_summary;
const snap = JSON.parse(raw);
ok(!raw.includes('Open Spot'), 'no placeholder name left anywhere in the closed result');
ok(snap.players[0] === 'Jim Bingham' && snap.skins.won[0].player === 'Jim Bingham' && snap.birdieball.winners[1] === 'Jim Bingham'
  && snap.birdiepay.birdies[0].player === 'Jim Bingham' && snap.payouts[1].player === 'Jim Bingham' && snap.payouts[1].total === 6, 'snapshot renamed in every section, amounts unchanged');
ok(snap.players.length === 4 && snap.payouts.length === 2 && snap.skins.won[1].player === 'Brian Hager', 'other players and structure untouched');
[st, j] = await call(db, 'POST', '/bfe/gathering-spots/69/fill', { host_id: 'Brian Hager', spot: 'Open Spot 1', member: 'Jim Bingham' });
ok(st === 404, 'filling twice is refused (spot no longer exists): ' + st);

// ── a name that has exact-match edge cases in the snapshot (quote/escape) ──
db = seed(); await call(db, 'POST', '/bfe/gathering-spots/69/fill', { host_id: 'Brian Hager', spot: 'Open Spot 1', member: `Pat "Pistol" O'Neil` });
ok(JSON.parse(db.prepare(`SELECT payout_summary FROM bfe_gathering_games`).get().payout_summary).players[0] === `Pat "Pistol" O'Neil`, 'a name with quotes keeps the snapshot valid JSON');

// ── a stale "No" row for the member is replaced, not a conflict ──
db = seed(); db.prepare(`INSERT INTO registrations (gathering_id, player_id, status, registered_at, is_placeholder) VALUES (69, 'Jim Bingham', 'no', '2026-09-29', 0)`).run();
[st, j] = await call(db, 'POST', '/bfe/gathering-spots/69/fill', { host_id: 'Brian Hager', spot: 'Open Spot 1', member: 'Jim Bingham' });
ok(st === 200 && names(db, `SELECT status FROM registrations WHERE player_id='Jim Bingham'`).join() === 'yes', 'stale No row replaced');

// ── member already has a scorecard -> refuse, nothing changes ──
db = seed(); db.prepare(`INSERT INTO bfe_scorecards (event_name, player, holes, total) VALUES ('gathering:69', 'Jim Bingham', '[]', 90)`).run();
[st, j] = await call(db, 'POST', '/bfe/gathering-spots/69/fill', { host_id: 'Brian Hager', spot: 'Open Spot 1', member: 'Jim Bingham' });
ok(st === 409 && names(db, `SELECT player_id FROM registrations WHERE is_placeholder=1`).length === 1, 'scorecard clash refused, spot unchanged');

// ── atomicity: a failure partway through leaves NOTHING renamed ──
db = seed(true, false);   // bfe_cttp_entries table missing -> the batch fails midway
[st, j] = await call(db, 'POST', '/bfe/gathering-spots/69/fill', { host_id: 'Brian Hager', spot: 'Open Spot 1', member: 'Jim Bingham' });
ok(st === 500, 'mid-batch failure reported: ' + st);
ok(db.prepare(`SELECT COUNT(*) n FROM registrations WHERE player_id='Open Spot 1' AND is_placeholder=1`).get().n === 1
  && db.prepare(`SELECT COUNT(*) n FROM bfe_scorecards WHERE player='Open Spot 1'`).get().n === 1
  && db.prepare(`SELECT payout_summary FROM bfe_gathering_games`).get().payout_summary.includes('Open Spot 1'), 'rolled back: nothing half-renamed');

// ── add ──
db = seed(); db.prepare(`DELETE FROM registrations WHERE player_id='Open Spot 1'`).run();   // 3 of 4 seats taken
[st, j] = await call(db, 'POST', '/bfe/gathering-spots/69/add', { host_id: 'Brian Hager', count: 2 });
ok(st === 409, 'adding past capacity refused: ' + st);
[st, j] = await call(db, 'POST', '/bfe/gathering-spots/69/add', { host_id: 'Brian Hager', count: 1 });
ok(st === 200 && j.spots.join() === 'Open Spot 1', 'add one: ' + JSON.stringify(j));
db.prepare(`UPDATE gatherings SET size = 6 WHERE id = 69`).run();
[st, j] = await call(db, 'POST', '/bfe/gathering-spots/69/add', { host_id: 'Brian Hager', count: 2 });
ok(j.spots.join() === 'Open Spot 2,Open Spot 3', 'numbering continues: ' + JSON.stringify(j));
ok(names(db, `SELECT status FROM registrations WHERE is_placeholder=1`).every(s => s === 'yes'), 'spots hold a Yes seat');
[st, j] = await call(db, 'POST', '/bfe/gathering-spots/69/add', { host_id: 'Mike Scanlan', count: 1 });
ok(st === 403, 'only the host can add');
[st, j] = await call(db, 'POST', '/bfe/gathering-spots/69/add', { host_id: 'Brian Hager', count: 0 });
ok(st === 400, 'count must be at least 1');
[st, j] = await call(db, 'POST', '/bfe/gathering-spots/999/add', { host_id: 'Brian Hager', count: 1 });
ok(st === 404, 'unknown gathering');

// ── Close guard ──
db = seed();
[st, j] = await call(db, 'POST', '/bfe/gathering-games/69/close', { host_id: 'Brian Hager', payout_summary: { x: 1 } });
ok(st === 409 && j.open_spots === 1, 'Close refused while a spot is open: ' + st);
await call(db, 'POST', '/bfe/gathering-spots/69/fill', { host_id: 'Brian Hager', spot: 'Open Spot 1', member: 'Jim Bingham' });
[st, j] = await call(db, 'POST', '/bfe/gathering-games/69/close', { host_id: 'Brian Hager', payout_summary: { x: 1 } });
ok(st === 200 && j.status === 'closed', 'Close allowed once every spot is a real player: ' + st);

// close anyway: ignore_open_spots closes; unused seats are dropped, a seat with a card keeps its name
db = seed();
await call(db, 'POST', '/bfe/gathering-spots/69/add', { host_id: 'Brian Hager', count: 1 }); // Open Spot 2: unused
[st, j] = await call(db, 'POST', '/bfe/gathering-games/69/close', { host_id: 'Brian Hager', payout_summary: { x: 1 } });
ok(st === 409, 'still refused without the flag');
[st, j] = await call(db, 'POST', '/bfe/gathering-games/69/close', { host_id: 'Brian Hager', payout_summary: { x: 1 }, ignore_open_spots: true });
ok(st === 200 && j.status === 'closed', 'close anyway ignores open spots: ' + st);
ok(names(db, `SELECT player_id FROM registrations WHERE is_placeholder = 1`).join() === 'Open Spot 1', 'unused spot dropped, the one with a card kept');

// ── before the one-time migration ──
db = seed(false);
[st, j] = await call(db, 'GET', '/bfe/gathering-spots?gathering_id=69');
ok(st === 200 && j.spots.length === 0 && j.migrated === false, 'GET degrades gracefully before the migration');
[st, j] = await call(db, 'POST', '/bfe/gathering-games/69/close', { host_id: 'Brian Hager', payout_summary: { x: 1 } });
ok(st === 200, 'Close is not blocked before the migration: ' + st);
[st, j] = await call(db, 'POST', '/bfe/gathering-spots/69/add', { host_id: 'Brian Hager', count: 1 });
ok(st === 500 && /ALTER TABLE registrations ADD COLUMN is_placeholder/.test(j.error), 'add names the missing migration');

// ── release (v4.10.10): give back a held seat nobody used ──
db = seed();
[st, j] = await call(db, 'POST', '/bfe/gathering-spots/69/release', { host_id: 'Brian Hager', spot: 'Open Spot 1' });
ok(st === 409 && /already has scores/.test(j.error), 'release refused while the seat has scores/entries: ' + st);
ok(names(db, `SELECT player_id FROM registrations WHERE is_placeholder = 1`).length === 1, 'refused release leaves the seat in place');
db = seed();
['bfe_scorecards', 'bfe_cttp_entries', 'bfe_birdieball_answers'].forEach(tb => db.prepare(`DELETE FROM ${tb} WHERE ${tb === 'bfe_birdieball_answers' ? 'player_name' : 'player'} = 'Open Spot 1'`).run());
db.prepare(`DELETE FROM bfe_gathering_games`).run();
[st, j] = await call(db, 'POST', '/bfe/gathering-spots/69/release', { host_id: 'Mike Scanlan', spot: 'Open Spot 1' });
ok(st === 403, 'only the host can release: ' + st);
[st, j] = await call(db, 'POST', '/bfe/gathering-spots/69/release', { host_id: 'Brian Hager', spot: 'Mike Scanlan' });
ok(st === 404, 'a real player is not releasable: ' + st);
[st, j] = await call(db, 'POST', '/bfe/gathering-spots/69/release', { host_id: 'Brian Hager', spot: 'Open Spot 1' });
ok(st === 200 && j.released === 'Open Spot 1', 'unused seat releases: ' + st);
ok(names(db, `SELECT player_id FROM registrations ORDER BY player_id`).join('|') === 'Brian Hager|Mike Scanlan|Scott Justus', 'only the placeholder row was removed');
[st, j] = await call(db, 'GET', '/bfe/gathering-spots?gathering_id=69');
ok(j.spots.length === 0, 'no spots left, so the close guard clears');

console.log(`${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
