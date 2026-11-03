// Dev-98 — BF Cup games and money on the Worker: closest-to-the-pin claims, the host's close/reopen of a round's money, and a BFE-A re-save keeps both.
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
const call = async (method, path, body) => { const r = await W.fetch(new Request('https://w' + path, { method, body: body ? JSON.stringify(body) : undefined }), { DB: makeD1(db) }, {}); return { status: r.status, json: await r.json() }; };
const pars = [4, 4, 3, 4, 5, 4, 5, 3, 4, 3, 5, 4, 4, 4, 3, 4, 5, 3];
const cfg = () => ({ sides: [{ key: 'A', name: 'Team Jake', captain: 'Jake', players: ['Jake', 'Amy'] }, { key: 'B', name: 'Team Nate', captain: 'Nate', players: ['Nate', 'Bob'] }], points: { win: 1, half: 0.5, loss: 0 },
  access: { A: 'CA', B: 'CB' }, host_code: 'HOST1', handicap: { pars },
  rounds: [
    { key: 'r1', name: 'Saturday', holes: 18, segments: [{ key: 's1', format: 'bestball', from: 1, to: 9 }, { key: 's2', format: 'altshot', from: 10, to: 18 }],
      games: { entry_per_player: 5, addons: [{ id: 'cttp', dollar_per_hole: 16 }] },
      matches: [{ key: 'm1', sides: [{ side: 'A', players: ['Jake', 'Amy'] }, { side: 'B', players: ['Nate', 'Bob'] }] }] },
    { key: 'r2', name: 'Sunday', holes: 18, segments: [{ key: 's3', format: 'singles', from: 1, to: 18 }],
      matches: [{ key: 'm2', sides: [{ side: 'A', players: ['Jake'] }, { side: 'B', players: ['Nate'] }] }] }] });
await call('POST', '/bfe/cup', { event_name: 'E', config: cfg(), pin: '7797' });
const act = (o) => call('POST', '/bfe/cup/act', Object.assign({ event_name: 'E', round: 'r1' }, o));
// --- closest to the pin
let r = await act({ action: 'ctp', hole: 3, claim: 'Amy' });
ok(r.status === 403, 'a stranger cannot set closest to the pin');
r = await act({ action: 'ctp', player: 'Zed', hole: 3, claim: 'Amy' });
ok(r.status === 403, 'someone not in the round cannot either');
r = await act({ action: 'ctp', player: 'bob', hole: 3, claim: 'amy', dist: '  6 ft  ' });
ok(r.status === 200 && r.json.config.ctp.r1['3'].player === 'Amy' && r.json.config.ctp.r1['3'].dist === '6 ft' && r.json.config.ctp.r1['3'].by === 'bob', 'a player in the round sets it: name canonicalised, distance trimmed, who is stamped');
ok(!r.json.config.access && !r.json.config.host_code, 'the public document stays free of the codes');
r = await act({ action: 'ctp', player: 'Bob', hole: 4, claim: 'Amy' });
ok(r.status === 400 && /not a closest-to-the-pin hole/.test(r.json.error), 'a hole that is not a CTP hole (the par 3s by default) is refused');
r = await act({ action: 'ctp', player: 'Bob', hole: 3, claim: 'Ghost' });
ok(r.status === 400, 'a claimant outside the round is refused');
r = await act({ action: 'ctp', player: 'Bob', hole: 8, claim: 'Nate', dist: 'x'.repeat(50) });
ok(r.status === 200 && r.json.config.ctp.r1['8'].dist.length === 20, 'a distance is capped at 20 characters');
r = await act({ action: 'ctp', player: 'Bob', hole: 3, claim: 'Bob' });
ok(r.status === 200 && r.json.config.ctp.r1['3'].player === 'Bob' && r.json.config.ctp.r1['3'].dist === undefined, 'the latest claim wins and replaces the old distance');
r = await act({ action: 'ctp', code: 'CA', hole: 8, claim: '' });
ok(r.status === 200 && !r.json.config.ctp.r1['8'] && r.json.config.ctp.r1['3'], 'a captain clears a claim (blank = nobody)');
r = await call('POST', '/bfe/cup/act', { event_name: 'E', round: 'r2', action: 'ctp', player: 'Jake', hole: 3, claim: 'Jake' });
ok(r.status === 409 && /no closest-to-the-pin game/.test(r.json.error), 'a round without a CTP game refuses claims');
// --- the host closes and reopens a round's money
const payout = { calc_version: 1, total_pot: 20, dollar_per_player: 5, players_count: 4, payouts: [{ player: 'Bob', total: 16 }], unallocated: 0 };
r = await act({ action: 'money_close', code: 'CA', payout });
ok(r.status === 403, 'a captain cannot close the money');
r = await act({ action: 'money_close', pin: 'HOST1', payout: { nope: 1 } });
ok(r.status === 400, 'a close without a payout result is refused');
r = await call('POST', '/bfe/cup/act', { event_name: 'E', round: 'r2', action: 'money_close', pin: 'HOST1', payout });
ok(r.status === 409, 'a round without games cannot be closed');
r = await act({ action: 'money_close', pin: 'HOST1', payout });
ok(r.status === 200 && r.json.config.rounds[0].payout.total_pot === 20 && r.json.config.rounds[0].payout.closed_by === 'host' && /T/.test(r.json.config.rounds[0].payout.closed_at), 'the host (host code) closes it: the result is frozen and stamped');
r = await act({ action: 'ctp', player: 'Bob', hole: 3, claim: 'Amy' });
ok(r.status === 409 && /closed/.test(r.json.error), 'no CTP changes while the money is closed');
// --- a BFE-A re-save (no ctp, no payout in the document it sends) keeps both, and takes the new games
const resave = cfg(); resave.rounds[0].games = { entry_per_player: 6, addons: [{ id: 'cttp', dollar_per_hole: 18 }] };
r = await call('POST', '/bfe/cup', { event_name: 'E', config: resave, pin: 'HOST1' });
r = await call('GET', '/bfe/cup?event=E');
ok(r.json.config.ctp && r.json.config.ctp.r1['3'].player === 'Bob', 're-save keeps the CTP claims');
ok(r.json.config.rounds[0].payout && r.json.config.rounds[0].payout.total_pot === 20, 're-save keeps a closed round\'s frozen payout');
ok(r.json.config.rounds[0].games.entry_per_player === 6, 're-save takes the games the host just set');
r = await act({ action: 'money_reopen', player: 'Jake' });
ok(r.status === 403, 'a player cannot reopen the money');
r = await act({ action: 'money_reopen', pin: '7797' });
ok(r.status === 200 && !r.json.config.rounds[0].payout, 'the commissioner PIN reopens it');
r = await act({ action: 'ctp', player: 'Bob', hole: 15, claim: 'Nate' });
ok(r.status === 200, 'claims work again once reopened');
console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
