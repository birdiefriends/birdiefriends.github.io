// Dev-93 (spec §13, R3) — the BFE Worker validates and stores game configs through the schemas
// generated from bf_engine.js, and keeps one generic game_configs column.
import fs from 'fs'; import { execFileSync } from 'child_process'; import { fileURLToPath, pathToFileURL } from 'url';
import { DatabaseSync } from 'node:sqlite';
const HERE = (p) => fileURLToPath(new URL(p, import.meta.url));
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const W = (await import(pathToFileURL(HERE('../bf_experiences_worker.js')).href)).default;
function makeD1(db) {
  const wrap = (sql) => { const st = { binds: [], bind(...b) { st.binds = b; return st; },
    async first() { return db.prepare(sql).get(...st.binds) ?? null; },
    async all() { return { results: db.prepare(sql).all(...st.binds) }; },
    async run() { const r = db.prepare(sql).run(...st.binds); return { meta: { last_row_id: Number(r.lastInsertRowid), changes: Number(r.changes) } }; } }; return st; };
  return { prepare: wrap, withSession() { return this; } };
}
const mk = (withGameConfigs) => { const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE bfe_gathering_games (id INTEGER PRIMARY KEY AUTOINCREMENT, gathering_id INTEGER UNIQUE, gathering_name TEXT, host_id TEXT, games TEXT, dollar_per_player REAL, allocations TEXT, cttp_config TEXT, birdieball_config TEXT, birdiepay_config TEXT, handicap_config TEXT, ${withGameConfigs ? 'game_configs TEXT,' : ''} status TEXT, payout_summary TEXT, closed_at TEXT, updated_at TEXT);`); return db; };
const call = async (db, method, path, body) => { const r = await W.fetch(new Request('https://w' + path, { method, body: body ? JSON.stringify(body) : undefined }), { DB: makeD1(db) }, {}); return [r.status, await r.json()]; };
const PARS = [4, 4, 3, 5, 4, 4, 3, 5, 4, 4, 4, 3, 5, 4, 4, 3, 5, 4];
const base = (extra) => Object.assign({ gathering_id: 7, gathering_name: 'G', host_id: 'Host', dollar_per_player: 10 }, extra);

// 0. the generated block is current, and VALID_GAMES comes from it
ok((() => { try { execFileSync(process.execPath, [HERE('./sync_worker_schemas.mjs'), '--check']); return true; } catch (e) { return false; } })(), 'Worker GAME_SCHEMAS block is up to date with bf_engine.js (run node sync_worker_schemas.mjs)');
const wsrc = fs.readFileSync(HERE('../bf_experiences_worker.js'), 'utf8');
ok(wsrc.includes('const VALID_GAMES = Object.keys(GAME_SCHEMAS);'), 'VALID_GAMES derives from the schema table');

// 1. legacy payloads still save, and the legacy columns keep their exact stored shape
let db = mk(true), st, j;
[st, j] = await call(db, 'POST', '/bfe/gathering-games', base({ games: ['cttp', 'birdieball', 'birdiepay', 'skins'],
  cttp_config: { dollar_per_hole: 3, hole_mode: 'custom', holes: [12, 3, 7] }, birdieball_config: { dollar_per_player: 2 },
  birdiepay_config: { dollar_per_birdie: 4, pars: PARS } }));
ok(st === 200 && j.ok, 'all four legacy games save: ' + JSON.stringify(j));
let row = db.prepare('SELECT * FROM bfe_gathering_games WHERE gathering_id = 7').get();
ok(row.cttp_config === '{"dollar_per_hole":3,"hole_mode":"custom","holes":[3,7,12]}', 'cttp_config stored byte-identical to Dev-91 shape (sorted holes): ' + row.cttp_config);
ok(row.birdieball_config === '{"dollar_per_player":2}', 'birdieball_config stored shape unchanged');
ok(row.birdiepay_config === JSON.stringify({ dollar_per_birdie: 4, pars: PARS }), 'birdiepay_config stored shape unchanged');
const gc = JSON.parse(row.game_configs);
ok(Object.keys(gc).sort().join() === 'birdieball,birdiepay,cttp,skins' && gc.skins.basis === 'gross' && gc.cttp.holes.join() === '3,7,12', 'game_configs holds every selected game, cleaned');
[st, j] = await call(db, 'GET', '/bfe/gathering-games?gathering_id=7');
ok(j.config.game_configs.cttp.dollar_per_hole === 3 && j.config.cttp_config.holes.length === 3, 'GET returns game_configs next to the legacy fields');

// 2. normalising: an unknown hole_mode falls back, skins basis follows handicap_config
[st] = await call(db, 'POST', '/bfe/gathering-games', base({ games: ['cttp', 'skins'], cttp_config: { dollar_per_hole: 2, hole_mode: 'weird', holes: [3] },
  handicap_config: { skins_basis: 'net', allowance: 95, players: {} } }));
row = db.prepare('SELECT * FROM bfe_gathering_games WHERE gathering_id = 7').get();
ok(st === 200 && JSON.parse(row.cttp_config).hole_mode === 'all_par3' && JSON.parse(row.game_configs).skins.basis === 'net', 'hole_mode normalised; skins basis read from handicap_config');

// 3. invalid configs are rejected (400) — same rules the Worker had before
const bad = async (m, body) => { const [s, r] = await call(mk(true), 'POST', '/bfe/gathering-games', base(body)); ok(s === 400 && r.error, m + ' -> 400 (' + (r.error || s) + ')'); };
await bad('cttp with no holes', { games: ['cttp'], cttp_config: { dollar_per_hole: 3, holes: [] } });
await bad('cttp with $0', { games: ['cttp'], cttp_config: { dollar_per_hole: 0, holes: [3] } });
await bad('cttp hole 19', { games: ['cttp'], cttp_config: { dollar_per_hole: 3, holes: [19] } });
await bad('cttp missing entirely', { games: ['cttp'] });
await bad('birdieball $0', { games: ['birdieball'], birdieball_config: { dollar_per_player: 0 } });
await bad('birdiepay 17 pars', { games: ['birdiepay'], birdiepay_config: { dollar_per_birdie: 2, pars: PARS.slice(1) } });
await bad('birdiepay par 7', { games: ['birdiepay'], birdiepay_config: { dollar_per_birdie: 2, pars: PARS.map((p, i) => i === 0 ? 7 : p) } });
await bad('unknown game', { games: ['nope'] });
await bad('no games', { games: [] });
await bad('$0 buy-in', { games: ['skins'], dollar_per_player: 0 });
await bad('config not an object', { games: ['cttp'], cttp_config: 'x' });

await bad('birdieball with no config at all', { games: ['birdieball'] });
await bad('birdiepay with no $ amount', { games: ['birdiepay'], birdiepay_config: { pars: PARS } });
await bad('cttp with no $ amount', { games: ['cttp'], cttp_config: { holes: [3] } });

// 3b. Fourball (Dev-93): arrives only through game_configs, validated by the same schema
const FB = { dollar_per_player: 5, basis: 'gross', net_mode: 'own', pairs: [['Ann', 'Bob'], ['Cy', 'Di']] };
db = mk(true);
[st, j] = await call(db, 'POST', '/bfe/gathering-games', base({ games: ['fourball', 'skins'], game_configs: { fourball: FB } }));
ok(st === 200 && j.ok, 'fourball saves via game_configs: ' + JSON.stringify(j));
[st, j] = await call(db, 'GET', '/bfe/gathering-games?gathering_id=7');
ok(j.config.game_configs.fourball.pairs.length === 2 && j.config.game_configs.fourball.dollar_per_player === 5 && j.config.handicap_config === null, 'GET returns the fourball config; a gross game stores no handicap_config');
await bad('fourball with one pair', { games: ['fourball'], game_configs: { fourball: { ...FB, pairs: [['Ann', 'Bob']] } } });
await bad('fourball player in two pairs', { games: ['fourball'], game_configs: { fourball: { ...FB, pairs: [['Ann', 'Bob'], ['Ann', 'Di']] } } });
await bad('fourball with no config', { games: ['fourball'] });
await bad('fourball bad net mode', { games: ['fourball'], game_configs: { fourball: { ...FB, net_mode: 'weird' } } });
// Fourball Net must store the per-player handicap setup even when Skins/Birdie Pay are gross
const SI = Array.from({ length: 18 }, (_, i) => i + 1);
db = mk(true);
[st, j] = await call(db, 'POST', '/bfe/gathering-games', base({ games: ['fourball'], game_configs: { fourball: { ...FB, basis: 'net' } },
  handicap_config: { allowance: 95, players: { Bob: { kind: 'given', strokes: 9, stroke_index: SI } } } }));
row = db.prepare('SELECT * FROM bfe_gathering_games WHERE gathering_id = 7').get();
ok(st === 200 && row.handicap_config && JSON.parse(row.handicap_config).players.Bob.strokes === 9, 'fourball Net stores handicap_config: ' + row.handicap_config);

// 4. generic path: game_configs wins over the legacy field, and validates the same
[st, j] = await call(mk(true), 'POST', '/bfe/gathering-games', base({ games: ['cttp'], game_configs: { cttp: { dollar_per_hole: 5, holes: [3, 7] } } }));
ok(st === 200, 'game_configs alone is enough for a game');
[st, j] = await call(mk(true), 'POST', '/bfe/gathering-games', base({ games: ['cttp'], game_configs: { cttp: { dollar_per_hole: 0, holes: [3] } } }));
ok(st === 400, 'game_configs is validated by the same schema');

// 5. before the migration: legacy games still save, nothing breaks
db = mk(false);
[st, j] = await call(db, 'POST', '/bfe/gathering-games', base({ games: ['cttp', 'skins'], cttp_config: { dollar_per_hole: 3, holes: [3, 7] } }));
ok(st === 200 && j.ok, 'a legacy-only save works with no game_configs column yet');
[st, j] = await call(db, 'GET', '/bfe/gathering-games?gathering_id=7');
ok(j.config && j.config.cttp_config.holes.length === 2 && j.config.game_configs === null || j.config.game_configs === undefined, 'GET still works without the column');

// 6. first writer still owns the games (unchanged)
db = mk(true);
await call(db, 'POST', '/bfe/gathering-games', base({ games: ['skins'] }));
[st, j] = await call(db, 'POST', '/bfe/gathering-games', base({ games: ['skins'], host_id: 'Other' }));
ok(st === 403, 'another player still cannot take over the games');
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
