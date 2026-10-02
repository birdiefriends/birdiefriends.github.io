// Add-a-player on the course (v4.11.2): real bfCleanCell / bfFindMemberMatch / bfAddPlayerPlan
// from portal.html, and the REAL main Worker POST/GET /registrations against real SQLite.
import fs from 'fs'; import { fileURLToPath, pathToFileURL } from 'url';
import { DatabaseSync } from 'node:sqlite';
import { extractFn } from './extract.mjs';
const src = fs.readFileSync(new URL('../portal.html', import.meta.url), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const { bfCleanCell, bfFindMemberMatch, bfAddPlayerPlan } = new Function(
  ['bfCleanCell', 'bfFindMemberMatch', 'bfTidyName', 'bfAddPlayerPlan'].map(n => extractFn(src, n)).join('\n') +
  '; return { bfCleanCell, bfFindMemberMatch, bfAddPlayerPlan };')();

// ── cell validation ──
ok(bfCleanCell('(617) 555-1234').display === '617-555-1234', 'formats');
ok(bfCleanCell('+1 617 555 1234').ok, 'leading 1 stripped');
for (const bad of ['', '555', '1111111111', '1234567890', '0987654321', '6175551', '0175551234', '6170551234', '5555555555', '1212121212'])
  ok(!bfCleanCell(bad).ok, 'rejects ' + bad);
ok(/required/i.test(bfCleanCell('').problem), 'blank says required');

// ── matching ──
const members = [{ display: 'Mike Nagle', firstName: 'Mike', lastName: 'Nagle', cell: '(617) 555-2468' }, { display: 'Ann Lee', firstName: 'Ann', lastName: 'Lee', cell: '' }];
ok(bfFindMemberMatch(members, 'M', 'N', '6175552468').kind === 'cell', 'cell match');
ok(bfFindMemberMatch(members, 'ann', 'LEE', '6175559999').kind === 'name', 'name match case-insens');
ok(bfFindMemberMatch(members, 'Bob', 'Roy', '6175559999').kind === null, 'no match');
ok(bfFindMemberMatch(members, 'Mike', 'Nagle', '6175552468').kind === 'cell', 'cell wins');

// ── plan ──
ok(bfAddPlayerPlan(members, '', 'X', '6175559999').action === 'error', 'needs first');
ok(bfAddPlayerPlan(members, 'Bob', 'Roy', '').action === 'error', 'needs cell');
const cr = bfAddPlayerPlan(members, 'bob', 'ROY', '617 555 9999');
ok(cr.action === 'create' && cr.display === 'Bob Roy' && cr.cell === '617-555-9999', 'create tidy');
ok(bfAddPlayerPlan(members, 'Mikey', 'N', '6175552468').action === 'confirm', 'confirm on cell');
ok(bfAddPlayerPlan(members, 'Mikey', 'N', '6175552468', members[0]).action === 'use', 'confirmed -> use');

// ── Worker against real SQLite ──
function makeD1(db) {
  const wrap = (sql) => { const st = { binds: [], bind(...b) { st.binds = b; return st; },
    async first() { return db.prepare(sql).get(...st.binds) ?? null; },
    async all() { return { results: db.prepare(sql).all(...st.binds) }; },
    async run() { const r = db.prepare(sql).run(...st.binds); return { meta: { changes: Number(r.changes) } }; } }; return st; };
  return { prepare: wrap };
}
const W = (await import(pathToFileURL(fileURLToPath(new URL('../worker.js', import.meta.url))).href)).default;
const mk = (migrated) => { const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE gatherings (id INTEGER PRIMARY KEY, host_id TEXT, size INTEGER, title TEXT);
   CREATE TABLE registrations (gathering_id INTEGER, player_id TEXT, status TEXT, registered_at TEXT, confirmed_for TEXT, host_note TEXT, is_placeholder INTEGER NOT NULL DEFAULT 0${migrated ? ', added_by TEXT, added_at TEXT' : ''}, UNIQUE(gathering_id, player_id));
   INSERT INTO gatherings VALUES (1,'Host',2,'G');
   INSERT INTO registrations (gathering_id, player_id, status) VALUES (1,'A','yes'),(1,'B','yes');`); return db; };
const env = (db) => ({ DB: makeD1(db), BF_FLAGS: { put: async () => {} }, OS_REST_KEY: 'x', OS_APP_ID: 'x' });
const ctx = { waitUntil() {} };
const post = async (db, body) => { const r = await W.fetch(new Request('https://w/registrations', { method: 'POST', body: JSON.stringify(body) }), env(db), ctx); return [r.status, await r.json()]; };
const get = async (db) => { const r = await W.fetch(new Request('https://w/gatherings/1/registrations'), env(db), ctx); return r.json(); };

let db = mk(true);
let [, d] = await post(db, { gathering_id: 1, player_id: 'C', status: 'yes' });
ok(d.status === 'sub' && d.downgraded, 'normal over-capacity Yes still downgrades');
[, d] = await post(db, { gathering_id: 1, player_id: 'Bob Roy', status: 'yes', added_by: 'Host' });
ok(d.ok && d.status === 'yes' && !d.downgraded, 'added player stays Yes past size');
let g = await get(db); const bob = g.registrations.find(r => r.player_id === 'Bob Roy');
ok(bob && bob.added_by === 'Host' && bob.added_at, 'marked added_by/added_at');
ok(!g.registrations.find(r => r.player_id === 'A').added_by, 'others unmarked');

// placeholder released when an add pushes past size
db = mk(true); db.exec(`UPDATE gatherings SET size=3; INSERT INTO registrations (gathering_id, player_id, status, is_placeholder) VALUES (1,'Open Spot 1','yes',1)`);
await post(db, { gathering_id: 1, player_id: 'Bob Roy', status: 'yes', added_by: 'Host' });
ok(db.prepare(`SELECT COUNT(*) c FROM registrations WHERE is_placeholder=1`).get().c === 0, 'add releases an Open Spot');

// Worker deployed before the ALTER: still saves, GET falls back
db = mk(false);
[, d] = await post(db, { gathering_id: 1, player_id: 'Bob Roy', status: 'yes', added_by: 'Host' });
ok(d.ok && d.status === 'yes', 'saves before ALTER');
g = await get(db);
ok(g.ok && g.registrations.some(r => r.player_id === 'Bob Roy'), 'GET falls back before ALTER');

// ── Open Spot take-over: the chooser only lists this game's held seats ──
import vm from 'vm';
const vctx = { gatheringRegData: [
  { gatheringId: 1, player: 'Open Spot 2', status: 'Yes' }, { gatheringId: 1, player: 'Open Spot 1', status: 'Yes' },
  { gatheringId: 1, player: 'Ann Lee', status: 'Yes' }, { gatheringId: 2, player: 'Open Spot 1', status: 'Yes' }, { gatheringId: 1, player: 'Open Spot 3', status: 'No' }],
  _addP: { opt: { gatheringId: 1 } }, isOpenSpotName: n => /^Open Spot \d+$/i.test(n) };
vm.createContext(vctx);
vm.runInContext(extractFn(src, 'apOpenSpots') + '; this.out = apOpenSpots();', vctx);
ok(JSON.stringify(vctx.out) === '["Open Spot 1","Open Spot 2"]', 'chooser lists only this game\'s non-No held seats, sorted');

console.log(`add_player: ${pass} pass, ${fail} fail`); process.exit(fail ? 1 : 0);
