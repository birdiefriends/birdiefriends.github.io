// Automatic birdie/eagle/albatross alerts: detected on the Worker from saved scores, once per team per hole, retried on failure,
// current team names, nothing for rounds that are not a gamed Gathering, and a log you can read back.
import { fileURLToPath, pathToFileURL } from 'url';
import { DatabaseSync } from 'node:sqlite';
const HERE = (p) => fileURLToPath(new URL(p, import.meta.url));
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const W = (await import(pathToFileURL(HERE('../bf_experiences_worker.js')).href)).default;
function makeD1(db) { const wrap = (sql) => { const st = { binds: [], bind(...b) { st.binds = b; return st; },
  async first() { return db.prepare(sql).get(...st.binds) ?? null; }, async all() { return { results: db.prepare(sql).all(...st.binds) }; },
  async run() { const r = db.prepare(sql).run(...st.binds); return { meta: { last_row_id: Number(r.lastInsertRowid), changes: Number(r.changes) } }; } }; return st; };
  const D = { prepare: wrap, withSession() { return D; } }; return D; }
const db = new DatabaseSync(':memory:');
db.exec(`CREATE TABLE bfe_scorecards (id INTEGER PRIMARY KEY AUTOINCREMENT, event_name TEXT, player TEXT, holes TEXT, marks TEXT, tee_box TEXT, front9 INT, back9 INT, total INT, hole_count INT, hole_half TEXT, venue TEXT, wb_status TEXT, wb_hole INT, wb_stroke INT, input_type TEXT, round_key TEXT, captured_at TEXT, UNIQUE(event_name, player));
 CREATE TABLE bfe_gathering_games (gathering_id INTEGER PRIMARY KEY, gathering_name TEXT, games TEXT, game_configs TEXT, status TEXT, host_id TEXT);`);
const putGames = (gid, games, gc, status = 'open') => db.prepare(`INSERT OR REPLACE INTO bfe_gathering_games VALUES (?, ?, ?, ?, ?, 'Brian Hager')`).run(gid, '2026 Turkey 2Man', JSON.stringify(games), JSON.stringify(gc), status);
putGames(104, ['scramble', 'cttp'], { scramble: { team_size: 2, pairs: [['Ann', 'Bob']], names: ['Old Snapshot Name'] } });
putGames(105, ['cttp'], {});
// the main Worker, faked: registrations and the push
const regs = [['Ann', 'Bob', 'Birdie Brigade'], ['Bob', 'Ann', 'Birdie Brigade'], ['Cy', 'Di', null], ['Di', 'Cy', null], ['Rich', null, null]].map(([p, pa, tn]) => ({ player_id: p, status: 'yes', partner_id: pa, team_name: tn }));
let pushes = [], mode = 'ok';
const asResp = o => Object.assign(o, { text: async () => JSON.stringify(await o.json()) });   // like a real Response: json() and text()
globalThis.fetch = async (url, opt) => asResp(await rawFetch(url, opt));
const rawFetch = async (url, opt) => {
  if (/\/registrations$/.test(url)) return { ok: true, json: async () => ({ registrations: regs }) };
  const body = JSON.parse(opt.body); pushes.push(body);
  if (mode === 'down') throw new Error('network');
  if (mode === 'nopush' && !body.feed_only) return { ok: true, status: 200, json: async () => ({ errors: ['All included players are not subscribed'] }) };
  return { ok: true, status: 200, json: async () => (body.feed_only ? { ok: true } : { id: 'n1', recipients: 5 }) };
};
const call = async (method, path, body, ctx) => { const r = await W.fetch(new Request('https://w' + path, { method, body: body ? JSON.stringify(body) : undefined }), { DB: makeD1(db) }, ctx || {}); return { status: r.status, json: await r.json() }; };
const marksWith = (m) => { const a = new Array(18).fill(null); Object.entries(m).forEach(([h, k]) => { a[h - 1] = k; }); return a; };
const save = (player, m, key = 'gathering:104') => call('POST', '/scorecards', { event_name: key, player, holes: new Array(18).fill(4), marks: m ? marksWith(m) : null, input_type: 'strokes' });
const heads = () => pushes.filter(p => !p.feed_only || true).map(p => p.headings.en);

let r = await save('Ann', { 3: 'birdie' });
ok(r.status === 200 && pushes.length === 1 && /#3 — Birdie Brigade/.test(pushes[0].headings.en), 'a team birdie is announced, with the CURRENT team name: ' + heads());
ok(pushes[0].bf_type === 'birdie' && pushes[0].bf_meta.hole === 3 && pushes[0].bf_meta.scoreType === 'Birdie', 'it is a birdie-type feed entry with hole and score type');
const tags = pushes[0].filters.filter(f => f.field).map(f => f.value);
ok(tags.includes('Rich') && tags.includes('Cy') && tags.length === 5, 'it goes to every player on the roster, including the unpaired player: ' + tags);
r = await save('Bob', { 3: 'birdie' });
ok(pushes.length === 1, 'the partner saving the same team score does not announce it again');
r = await save('Ann', { 3: 'birdie' }); ok(pushes.length === 1, 'a re-save does not announce it again');
r = await save('Ann', { 3: 'eagle' });
ok(pushes.length === 2 && /Eagle/.test(pushes[1].contents.en) && /corrected up/.test(pushes[1].contents.en), 'a correction up to an Eagle is announced once, as a correction');
r = await save('Ann', { 3: 'birdie' }); ok(pushes.length === 2, 'a correction back down says nothing');
r = await save('Rich', { 5: 'birdie' });
ok(pushes.length === 3 && /#5 — Rich/.test(pushes[2].headings.en), 'the unpaired player is a unit of one');
r = await save('Ann', null); ok(pushes.length === 3, 'no marks (no par data on the phone) = nothing to announce');
r = await save('Ann', { 3: 'eagle', 7: 'albatross' }); ok(pushes.length === 4 && /🦄 #7/.test(pushes[3].headings.en), 'an albatross has its own announcement');
// a send that fails is retried by the next save from anyone
pushes = []; mode = 'down';
r = await save('Cy', { 9: 'birdie' });
let log = await call('GET', '/bfe/score-alerts?event=gathering:104');
let row = log.json.alerts.find(a => a.hole === 9);
ok(r.status === 200 && row && row.status === 'failed' && /network|error/.test(row.error || ''), 'if nothing can be sent the save still succeeds and the failure is on record: ' + JSON.stringify(row));
mode = 'ok'; pushes = [];
r = await save('Di', { 2: 'birdie' });   // someone else saves later
log = await call('GET', '/bfe/score-alerts?event=gathering:104');
ok(log.json.alerts.find(a => a.hole === 9).status === 'sent' && pushes.some(p => /#9/.test(p.headings.en)), 'the next save retries the failed alert and it goes out');
// nobody subscribed to push: the announcement still reaches the feed
pushes = []; mode = 'nopush';
r = await save('Rich', { 11: 'eagle' });
ok(pushes.some(p => p.feed_only && /#11 — Rich/.test(p.headings.en)), 'no push went out, so it is written to the feed anyway');
log = await call('GET', '/bfe/score-alerts?event=gathering:104'); row = log.json.alerts.find(a => a.hole === 11);
ok(row.status === 'sent' && /push 200/.test(row.error || ''), 'and the log says why the push did not go: ' + JSON.stringify(row));
mode = 'ok'; pushes = [];
// rounds that are not a gamed Gathering
r = await save('Ann', { 3: 'birdie' }, 'gathering:105'); ok(pushes.length === 0, 'a Gathering with no scramble, skins or birdie payouts: no alerts');
r = await save('Ann', { 3: 'birdie' }, 'Some Series Event'); ok(pushes.length === 0, 'BF Series and other events: untouched');
r = await save('Ann', { 3: 'birdie' }, 'gathering:999'); ok(r.status === 200 && pushes.length === 0, 'no games config: saves fine, no alerts');
// with a ctx that supports waitUntil it runs in the background and the save does not wait
let waited = null; pushes = [];
r = await call('POST', '/scorecards', { event_name: 'gathering:104', player: 'Ann', holes: new Array(18).fill(4), marks: marksWith({ 14: 'birdie' }), input_type: 'strokes' }, { waitUntil: p => { waited = p; } });
ok(waited && typeof waited.then === 'function', 'with waitUntil the scan runs after the response'); await waited; ok(pushes.some(p => /#14/.test(p.headings.en)), 'and still sends');
// ── All scores in: the host is told once, privately; nothing for a round that is not complete
putGames(106, ['scramble'], { scramble: { team_size: 2, pairs: [] } });
const full = (player, key) => call('POST', '/scorecards', { event_name: key, player, holes: new Array(18).fill(4), marks: null, input_type: 'strokes', hole_count: 18 });
pushes = [];
for (const p of ['Ann', 'Bob', 'Cy', 'Di']) await full(p, 'gathering:106');
ok(!pushes.some(x => x.bf_type === 'gathering_host'), 'two teams are done but the unpaired player has no card: not all in');
await full('Rich', 'gathering:106');
let hp = pushes.filter(x => x.bf_type === 'gathering_host');
ok(hp.length === 1 && hp[0].filters.length === 1 && hp[0].filters[0].value === 'Brian Hager' && /All scores are in/.test(hp[0].headings.en) && !hp[0].feed_only, 'when the last card completes the host (only) is told: ' + JSON.stringify(hp.map(x => x.filters)));
ok(hp[0].bf_meta.gathering_id === 106, 'the notice carries the Gathering id so the app can show it to the host only');
await full('Rich', 'gathering:106'); await full('Ann', 'gathering:106');
ok(pushes.filter(x => x.bf_type === 'gathering_host').length === 1, 'later saves do not tell the host again');
// a partial card for one team keeps it from counting
putGames(107, ['scramble'], { scramble: { team_size: 2, pairs: [] } }); pushes = [];
for (const p of ['Cy', 'Di', 'Rich']) await full(p, 'gathering:107');
await call('POST', '/scorecards', { event_name: 'gathering:107', player: 'Ann', holes: [4, 4, 4, ...new Array(15).fill(null)], marks: null, input_type: 'strokes', hole_count: 18 });
ok(!pushes.some(x => x.bf_type === 'gathering_host'), 'a team with blank holes means not all in');
// a closed round is not announced again
putGames(108, ['scramble'], { scramble: { team_size: 2, pairs: [] } }, 'closed'); pushes = [];
for (const p of ['Ann', 'Bob', 'Cy', 'Di', 'Rich']) await full(p, 'gathering:108');
ok(!pushes.some(x => x.bf_type === 'gathering_host'), 'a round the host already closed does not notify');
log = await call('GET', '/bfe/score-alerts?event=gathering:106');
ok(log.json.alerts.some(a => a.kind === 'AllIn' && a.status === 'sent'), 'the all-in notice is in the log');
// Worker-to-Worker: a service binding (env.PUSH_WORKER) is used when present; a workers.dev 404 (error code 1042) is reported with its text.
{
  let viaBinding = 0; const before = pushes.length;
  const env = { DB: makeD1(db), PUSH_WORKER: { fetch: async (url, opt) => { viaBinding++; return asResp(await rawFetch(url, opt)); } } };
  const c = (m, pth, b) => W.fetch(new Request('https://w' + pth, { method: m, body: b ? JSON.stringify(b) : undefined }), env, {});
  putGames(120, ['skins'], {});
  await c('POST', '/scorecards', { event_name: 'gathering:120', player: 'Ann', holes: new Array(18).fill(4), marks: marksWith({ 5: 'birdie' }), input_type: 'strokes' });
  ok(viaBinding >= 1 && pushes.length > before, 'with a PUSH_WORKER service binding the alert goes through the binding');
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 404, json: async () => { throw new Error('not json'); }, text: async () => 'error code: 1042' });
  putGames(121, ['skins'], {});
  await W.fetch(new Request('https://w/scorecards', { method: 'POST', body: JSON.stringify({ event_name: 'gathering:121', player: 'Ann', holes: new Array(18).fill(4), marks: marksWith({ 5: 'birdie' }), input_type: 'strokes' }) }), { DB: makeD1(db) }, {});
  globalThis.fetch = realFetch;
  const lg = await call('GET', '/bfe/score-alerts?event=gathering:121');
  ok(lg.json.alerts.length === 1 && lg.json.alerts[0].status === 'failed' && /push 404 error code: 1042/.test(lg.json.alerts[0].error), 'a 404 from another Worker is logged with its text (error code: 1042): ' + (lg.json.alerts[0] && lg.json.alerts[0].error));
}
console.log(`score alerts worker: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
