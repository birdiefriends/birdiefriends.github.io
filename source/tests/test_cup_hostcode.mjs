// BF Cup — per-event host code on the BFE Worker, against real SQLite: the global PIN creates and overrides, a Cup's own code runs only that Cup,
// the code never appears in the public document, and a host cannot change it.
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
const db = new DatabaseSync(':memory:');
const call = async (method, path, body) => {
  const r = await W.fetch(new Request('https://w' + path, { method, body: body ? JSON.stringify(body) : undefined }), { DB: makeD1(db) }, {});
  return { status: r.status, json: await r.json() };
};
const EV = 'Host Cup', Q = encodeURIComponent(EV);
const mkCfg = () => ({ sides: [{ key: 'A', name: 'Team A', players: ['a1'] }, { key: 'B', name: 'Team B', players: ['b1'] }], points: { win: 1, half: 0.5, loss: 0 },
  rounds: [{ key: 'r1', name: 'Day 1', segments: [{ key: 's', format: 'singles', from: 1, to: 18 }], matches: [{ key: 'm1', sides: [{ side: 'A', players: ['a1'] }, { side: 'B', players: ['b1'] }] }] }] });

// ---- only the global PIN creates a Cup, and only it may set the code ----
let r = await call('POST', '/bfe/cup', { event_name: EV, config: Object.assign(mkCfg(), { host_code: 'HOST42' }), pin: 'HOST42' });
ok(r.status === 403, 'a host code cannot create a Cup that does not exist yet');
r = await call('POST', '/bfe/cup', { event_name: EV, config: Object.assign(mkCfg(), { host_code: 'ab' }), pin: '7797' });
ok(r.status === 400, 'a code under 4 characters is refused');
r = await call('POST', '/bfe/cup', { event_name: EV, config: Object.assign(mkCfg(), { host_code: 'has space' }), pin: '7797' });
ok(r.status === 400, 'a code with odd characters is refused');
r = await call('POST', '/bfe/cup', { event_name: EV, config: Object.assign(mkCfg(), { host_code: 'HOST42', access: { A: 'capA', B: 'capB' } }), pin: '7797' });
ok(r.status === 200 && r.json.ok, 'the global PIN creates the Cup with its host code');

// ---- the code is private ----
r = await call('GET', '/bfe/cup?event=' + Q);
ok(r.status === 200 && r.json.config.host_code === undefined && r.json.config.access === undefined, 'the public document carries neither the host code nor the captain codes');
r = await call('GET', '/bfe/cup?event=' + Q + '&pin=nope');
ok(r.json.config.host_code === undefined, 'a wrong pin gets the public document');
r = await call('GET', '/bfe/cup?event=' + Q + '&pin=HOST42');
ok(r.json.config.host_code === 'HOST42' && r.json.config.access && r.json.config.access.A === 'capA', 'the host code opens the full document for this Cup');
r = await call('GET', '/bfe/cup?event=' + Q + '&pin=7797');
ok(r.json.config.host_code === 'HOST42', 'the global PIN still opens everything');

// ---- a host re-saves, but cannot change the code ----
const edit = Object.assign(mkCfg(), { points: { win: 2, half: 1, loss: 0 }, host_code: 'HACKED' });
r = await call('POST', '/bfe/cup', { event_name: EV, config: edit, pin: 'HOST42' });
ok(r.status === 200, 'the host can re-save his own Cup');
r = await call('GET', '/bfe/cup?event=' + Q + '&pin=7797');
ok(r.json.config.points.win === 2, 'the host\'s change was saved');
ok(r.json.config.host_code === 'HOST42', 'a host cannot change the host code');
ok(r.json.config.access && r.json.config.access.A === 'capA', 'the captain codes survive a host re-save');
r = await call('POST', '/bfe/cup', { event_name: EV, config: mkCfg(), pin: '7797' });
r = await call('GET', '/bfe/cup?event=' + Q + '&pin=7797');
ok(r.json.config.host_code === 'HOST42', 'a global-PIN save that leaves the code blank keeps the existing code');
r = await call('POST', '/bfe/cup', { event_name: EV, config: Object.assign(mkCfg(), { host_code: 'NEWCODE9' }), pin: '7797' });
r = await call('GET', '/bfe/cup?event=' + Q + '&pin=7797');
ok(r.json.config.host_code === 'NEWCODE9', 'the global PIN can change the code');
r = await call('POST', '/bfe/cup', { event_name: EV, config: mkCfg(), pin: 'HOST42' });
ok(r.status === 403, 'the old code stops working once it is changed');
// the code of one Cup means nothing for another
await call('POST', '/bfe/cup', { event_name: 'Other Cup', config: Object.assign(mkCfg(), { host_code: 'OTHER77' }), pin: '7797' });
r = await call('POST', '/bfe/cup', { event_name: 'Other Cup', config: mkCfg(), pin: 'NEWCODE9' });
ok(r.status === 403, 'one Cup\'s host code does not run another Cup');

// ---- match close: host or captain, now including the host code ----
const act = (body) => call('POST', '/bfe/cup/act', Object.assign({ event_name: EV, action: 'match_close', round: 'r1', match: 'm1', how: 'halve' }, body));
r = await act({ pin: 'wrong' });
ok(r.status === 403, 'a wrong code cannot close a match');
r = await act({ pin: 'NEWCODE9' });
ok(r.status === 200 && r.json.config.closed.r1.m1.by === 'host', 'the host code closes a match, recorded as the host');
ok(r.json.config.host_code === undefined, 'the act response is public: no host code');
r = await act({ code: 'capA' });
ok(r.status === 200, 'a captain code still closes a match');

// ---- delete ----
r = await call('DELETE', '/bfe/cup?event=' + Q + '&pin=wrong');
ok(r.status === 403, 'delete needs the PIN or the host code');
r = await call('DELETE', '/bfe/cup?event=' + Q + '&pin=NEWCODE9');
ok(r.status === 200, 'the host code can delete its own Cup');
r = await call('DELETE', '/bfe/cup?event=Other%20Cup&pin=7797');
ok(r.status === 200, 'the global PIN deletes any Cup');
console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
