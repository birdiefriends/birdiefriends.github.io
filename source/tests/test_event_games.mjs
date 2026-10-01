// Event games (v4.9.4) — a Yes player starts games on a NON-Gathering event (BF Weekend
// Times) and the host adds games to a hosted event from its card. Worker: hidden shadow
// Gathering get-or-create, first-writer-wins games ownership. Portal: eligibility, key
// routing, closed-result protection, the games checklist for shadows.
import fs from 'fs'; import vm from 'node:vm'; import { fileURLToPath, pathToFileURL } from 'url';
import { DatabaseSync } from 'node:sqlite';
import { extractFn } from './extract.mjs';
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
const GAT = `CREATE TABLE gatherings (id INTEGER PRIMARY KEY AUTOINCREMENT, host_id TEXT NOT NULL, title TEXT NOT NULL, venue TEXT, event_time TEXT NOT NULL, size INTEGER, crew_id INTEGER, fill_list_enabled INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL DEFAULT (datetime('now')), holes INTEGER DEFAULT 18`;
const GAMES = `CREATE TABLE bfe_gathering_games (id INTEGER PRIMARY KEY AUTOINCREMENT, gathering_id INTEGER UNIQUE, gathering_name TEXT, host_id TEXT, games TEXT, dollar_per_player REAL, allocations TEXT, cttp_config TEXT, birdieball_config TEXT, birdiepay_config TEXT, status TEXT, payout_summary TEXT, closed_at TEXT, updated_at TEXT);`;
const mk = (migrated) => { const db = new DatabaseSync(':memory:'); db.exec(GAT + (migrated ? ', event_ref TEXT' : '') + ');' + (migrated ? 'CREATE UNIQUE INDEX idx_gatherings_event_ref ON gatherings(event_ref);' : '') + GAMES); return db; };
const call = async (db, method, path, body) => {
  const r = await W.fetch(new Request('https://w' + path, { method, body: body ? JSON.stringify(body) : undefined }), { DB: makeD1(db) }, {});
  return [r.status, await r.json()];
};
const REF = 'BF Weekend Times Sat|2026-10-03';
const shadowBody = (host) => ({ event_ref: REF, host_id: host, title: 'BF Weekend Times Sat', event_time: '2026-10-03T12:00:00.000Z', venue: 'BSGC' });

// ── Worker: shadow get-or-create ──
let db = mk(true);
let [st, j] = await call(db, 'GET', '/bfe/event-games/shadows'); ok(st === 200 && j.shadows.length === 0, 'no shadows at first');
[st, j] = await call(db, 'POST', '/bfe/event-games/shadow', shadowBody('Mike Scanlan'));
ok(st === 200 && j.ok && j.created === true && j.host_id === 'Mike Scanlan' && j.gathering_id > 0, 'first Yes player creates the shadow and is its host');
const gid = j.gathering_id;
const row = db.prepare('SELECT * FROM gatherings WHERE id = ?').get(gid);
ok(row.status === 'event_shadow' && row.size === null && row.fill_list_enabled === 0 && row.event_ref === REF, 'shadow row is hidden (status event_shadow), uncapped, not an open invite');
[st, j] = await call(db, 'POST', '/bfe/event-games/shadow', shadowBody('Scott Justus'));
ok(j.ok && j.created === false && j.gathering_id === gid && j.host_id === 'Mike Scanlan', 'a second player gets the SAME shadow, first come stays host');
ok(db.prepare('SELECT COUNT(*) AS n FROM gatherings').get().n === 1, 'never a second row');
[st, j] = await call(db, 'GET', '/bfe/event-games/shadows'); ok(j.shadows.length === 1 && j.shadows[0].event_ref === REF && j.shadows[0].gathering_id === gid, 'GET lists the shadow');
[st, j] = await call(db, 'POST', '/bfe/event-games/shadow', { event_ref: REF }); ok(st === 400, 'missing fields -> 400');
ok(db.prepare("SELECT COUNT(*) AS n FROM gatherings WHERE status = 'active'").get().n === 0, 'a shadow never matches the main Worker\'s active filter');
// before the migration
db = mk(false);
[st, j] = await call(db, 'GET', '/bfe/event-games/shadows'); ok(st === 200 && j.shadows.length === 0, 'GET is graceful before the migration');
[st, j] = await call(db, 'POST', '/bfe/event-games/shadow', shadowBody('Mike Scanlan')); ok(st === 409 && /ALTER TABLE gatherings ADD COLUMN event_ref/.test(j.error), 'POST names the migration step');

// ── Worker: first writer owns the games ──
db = mk(true);
const cfg = (host) => ({ gathering_id: 7, gathering_name: 'X', host_id: host, games: ['skins'], dollar_per_player: 5 });
[st, j] = await call(db, 'POST', '/bfe/gathering-games', cfg('Mike Scanlan')); ok(st === 200 && j.ok, 'first save works');
[st, j] = await call(db, 'POST', '/bfe/gathering-games', cfg('Scott Justus')); ok(st === 403 && /Only Mike Scanlan/.test(j.error), 'another player cannot take over the games');
[st, j] = await call(db, 'POST', '/bfe/gathering-games', cfg('Mike Scanlan')); ok(st === 200, 'the owner can still edit');
[st, j] = await call(db, 'DELETE', '/bfe/gathering-games/7?host_id=Scott%20Justus'); ok(st === 403, 'another player cannot turn the games off');
ok(db.prepare('SELECT COUNT(*) AS n FROM bfe_gathering_games').get().n === 1, 'config survived');
db.prepare("UPDATE bfe_gathering_games SET status='closed' WHERE gathering_id=7").run();
[st, j] = await call(db, 'GET', '/bfe/gathering-games?status=closed&slim=1'); ok(j.ok && j.configs.length === 1 && Object.keys(j.configs[0]).sort().join() === 'gathering_id,host_id,status', 'slim list has ids only');
[st, j] = await call(db, 'DELETE', '/bfe/gathering-games/7?host_id=Mike%20Scanlan'); ok(st === 200, 'the owner can turn them off');

// ── Portal helpers ──
const src = fs.readFileSync(HERE('../portal.html'), 'utf8');
const fns = ['eventLocalDay','eventGamesRef','eventNameFromRef','eventShadowFor','gamesGidFor','evtGamesConfig','eventShadowGamed','panelGamesGid','gamesScoreKeyForGid','eventGamesAllowed','eventAddGamesBtnHtml','gatheringGamesChecklistHtml','historyShadowGid'];
const mkCtx = (over = {}) => {
  const ctx = { Number, String, Map, Set, Date, isNaN, Object, currentPlayer: 'Brian Hager', isGuest: () => false, formatBadge: f => f || '', isBFEBackedCard: () => false,
    findMyReg: () => ({ status: 'Yes' }), gatheringRoundConfig: gid => (ctx._cfgs || {})[gid] || null, gatheringIsGamed: c => !!c,
    GATHERING_GAMES_META: { skins: { label: 'Skins', icon: 'S' }, cttp: { label: 'CTP', icon: 'C' }, birdieball: { label: 'BB', icon: 'B' }, birdiepay: { label: 'BP', icon: 'P' } }, ...over };
  vm.createContext(ctx);
  vm.runInContext(fns.map(n => extractFn(src, n)).join('\n') + '\nvar _eventShadows = new Map(), _eventShadowByGid = new Map(), _closedGamesGids = new Set(), _gamesFormShadow = false, _gamesFormSelected = new Set();', ctx);
  return ctx;
};
const today = new Date(); const tomorrow = new Date(Date.now() + 86400000); const yesterday = new Date(Date.now() - 86400000);
const evt = (o) => ({ id: 'e1', name: 'BF Weekend Times Sat', dt: today, format: 'BF Weekend Times', source: 'jotform', location: 'BSGC', ...o });
let c = mkCtx();
ok(c.eventNameFromRef(c.eventGamesRef(evt({ name: 'A|B' }))) === 'A|B', 'ref round-trips names containing |');
ok(c.eventGamesAllowed(evt()), 'Weekend: a Yes player, event day -> allowed');
ok(!mkCtx({ findMyReg: () => ({ status: 'Sub' }) }).eventGamesAllowed(evt()) && !mkCtx({ findMyReg: () => null }).eventGamesAllowed(evt()), 'Weekend: Sub / unregistered -> not allowed');
ok(c.eventGamesAllowed(evt({ dt: tomorrow })) && !c.eventGamesAllowed(evt({ dt: yesterday })), 'Weekend: today or any future day, never a past event');
ok(!c.eventGamesAllowed(evt({ format: 'BF Series' })), 'BF Series is excluded (own format)');
ok(!mkCtx({ isBFEBackedCard: () => true }).eventGamesAllowed(evt()), 'BFE-backed rounds excluded');
ok(!mkCtx({ isGuest: () => true }).eventGamesAllowed(evt()), 'guests excluded');
const g = (o) => ({ id: 'g-5', source: 'gathering', gatheringId: 5, name: 'Skins Day', hostId: 'Brian Hager', dt: tomorrow, format: 'Gathering', ...o });
ok(c.eventGamesAllowed(g()), 'hosted: host, upcoming -> allowed');
ok(c.eventGamesAllowed(g({ dt: today })), 'hosted: host, today -> allowed');
ok(!c.eventGamesAllowed(g({ hostId: 'Mike Scanlan' })), 'hosted: only the host');
ok(!c.eventGamesAllowed(g({ dt: yesterday })), 'hosted: past day -> no');
// shadow routing
c._eventShadows.set(c.eventGamesRef(evt()), { gathering_id: 21, host_id: 'Mike Scanlan' }); c._eventShadowByGid.set(21, c.eventGamesRef(evt()));
ok(c.gamesGidFor(evt()) === 21 && c.gamesGidFor(g()) === 5 && c.gamesGidFor(evt({ dt: tomorrow })) === null, 'gid: shadow for the event, own id for a Gathering, none for another date');
ok(c.gamesScoreKeyForGid(21) === 'BF Weekend Times Sat' && c.gamesScoreKeyForGid(5) === 'gathering:5', 'scorecard key: event name for a shadow, gathering:<id> otherwise');
ok(c.historyShadowGid(evt()) === 21 && c.historyShadowGid(evt({ dt: tomorrow })) === null, 'History finds the shadow for the event group');
// button visibility
c = mkCtx(); ok(/\+ Games/.test(c.eventAddGamesBtnHtml(evt(), false)), 'button shows when no games');
ok(c.eventAddGamesBtnHtml(evt(), true) === '', 'hidden on a canceled event');
c._cfgs = { 5: { x: 1 } }; ok(c.eventAddGamesBtnHtml(g(), false) === '', 'hidden once games exist');
c = mkCtx(); c._closedGamesGids.add(5); ok(c.eventAddGamesBtnHtml(g(), false) === '', 'hidden when the games are closed (never overwrite a result)');
// checklist
c = mkCtx(); c._gamesFormShadow = true; const html = c.gatheringGamesChecklistHtml();
ok(/Skins/.test(html) && /BP/.test(html) && /CTP/.test(html) && /BB/.test(html), 'event games offer all four games (v4.9.9)');
c._gamesFormShadow = false; ok(/CTP/.test(c.gatheringGamesChecklistHtml()), 'Gathering games still offer everything');
// v4.9.9 Live Panel carve-out
c = mkCtx(); c._eventShadows.set(c.eventGamesRef(evt()), { gathering_id: 21, host_id: 'Mike Scanlan' }); c._cfgs = { 21: { games: ['skins'] } };
ok(c.eventShadowGamed(evt()) && c.panelGamesGid(evt()) === 21, 'Weekend with an open shadow config -> panel gid is the shadow');
ok(!c.eventShadowGamed(evt({ dt: tomorrow })), 'another date has no shadow');
ok(!c.eventShadowGamed(evt({ format: 'BF Series' })) && c.panelGamesGid(evt({ format: 'BF Series' })) === null, 'BF Series never takes the shadow path');
c._cfgs = {}; ok(!c.eventShadowGamed(evt()) && c.panelGamesGid(evt()) === null, 'no config -> plain Weekend stays without a Live Panel');
ok(c.panelGamesGid(g()) === 5, 'a Gathering keeps its own id');
ok(/if \(eventShadowGamed\(evt\)\) return true;\n  \/\/ Dev-92/.test(src), 'hasLivePanelSupport checks the shadow carve-out before the format ladder');
ok(/if \(eventShadowGamed\(evt\)\) return 'strokes'/.test(src), 'event games capture strokes');
ok(/openGatheringCloseSheet\(\$\{_panelGid\}\)/.test(src), 'Close button uses the panel gid');
ok(/gathering_id: _bbGid, player_name: player/.test(src), 'BirdieBall submit uses the panel gid');
{ // hasLivePanelSupport end to end: Weekend gains the panel only with a shadow config; Series/plain Weekend unchanged
  const hc = mkCtx({ _bfeBackedIndex: new Map(), _gatheringGamesIndex: new Map(),
    formatClass: f => /series/i.test(f) ? 'format-series' : /weekend/i.test(f) ? 'format-weekend' : '' });
  vm.runInContext(extractFn(src, 'hasLivePanelSupport') + ';this.h=hasLivePanelSupport;', hc);
  const wk = evt(), sr = evt({ name: 'BSGC Series #9', format: 'BF Series' });
  ok(hc.h(sr) === true, 'BF Series Live Panel unchanged');
  ok(hc.h(wk) === false, 'plain Weekend still has no Live Panel');
  hc._eventShadows.set(hc.eventGamesRef(wk), { gathering_id: 21, host_id: 'X' }); hc._cfgs = { 21: { games: ['cttp'] } };
  ok(hc.h(wk) === true, 'Weekend with games gets the Live Panel');
  hc._eventShadows.set(hc.eventGamesRef(sr), { gathering_id: 22, host_id: 'X' }); hc._cfgs[22] = { games: ['cttp'] };
  ok(hc.h(sr) === true && !hc.eventShadowGamed(sr), 'Series result is the same with a stray shadow');
}
// wiring
ok(/const key = gamesScoreKeyForGid\(gatheringId\)/.test(src), 'close sheet reads the shadow-aware score key');
ok(/loadHistoryGameResults\(key, groupEvt\)/.test(src), 'My History passes the event group');
ok(/gathering-games\/\$\{gatheringId\}\?host_id=/.test(src), 'Turn Off Games names the caller');
ok(/\$\{gatheringIsGamed\(evtGamesConfig\(evt\)\)/.test(src), 'card Games icon uses the shadow-aware config');
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
