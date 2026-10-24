// Dev-95 — BF Cup live scoring on the Worker: who may post, validation, round markers, survives a host re-save.
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
const cfg = { sides: [{ key: 'A', name: 'Team Jake', captain: 'Jake', players: ['Jake', 'Amy'] }, { key: 'B', name: 'Team Nate', captain: 'Nate', players: ['Nate', 'Bob'] }], points: { win: 1, half: 0.5, loss: 0 },
  access: { A: 'CA', B: 'CB' },
  rounds: [{ key: 'r1', name: 'Saturday', holes: 18, segments: [{ key: 's1', format: 'bestball', from: 1, to: 9 }, { key: 's2', format: 'altshot', from: 10, to: 18 }],
    matches: [{ key: 'm1', sides: [{ side: 'A', players: ['Jake', 'Amy'] }, { side: 'B', players: ['Nate', 'Bob'] }] }] }] };
await call('POST', '/bfe/cup', { event_name: 'E', config: cfg, pin: '7797' });
const act = (o) => call('POST', '/bfe/cup/act', Object.assign({ event_name: 'E', round: 'r1', match: 'm1' }, o));
let r = await act({ action: 'score', hole: 1, scores: { Jake: 4 } });
ok(r.status === 403, 'a stranger cannot score');
r = await act({ action: 'score', player: 'Zed', hole: 1, scores: { Jake: 4 } });
ok(r.status === 403, 'someone not in the match cannot score');
r = await act({ action: 'score', player: 'amy', hole: 1, scores: { jake: 4, AMY: 5, Nate: 5, Bob: 6 } });
ok(r.status === 200 && r.json.config.scores.r1.m1.h['1'].Jake === 4 && r.json.config.scores.r1.m1.h['1'].Amy === 5, 'a player in the match posts all four (names canonicalised)');
ok(r.json.config.scores.r1.m1.by['1'] === 'amy' && /T/.test(r.json.config.scores.r1.m1.t['1']), 'who and when are stamped');
ok(!!r.json.config.phases.round_r1_start, 'the first score stamps the round start');
const t0 = r.json.config.phases.round_r1_start;
r = await act({ action: 'score', player: 'Bob', hole: 2, scores: { Jake: 4, Amy: 4, Nate: 3, Bob: 0 } });
ok(r.status === 200 && r.json.config.phases.round_r1_start === t0, 'round start is stamped once; 0 = picked up is allowed');
r = await act({ action: 'score', player: 'Bob', hole: 19, scores: { Nate: 4 } }); ok(r.status === 400, 'hole out of range');
r = await act({ action: 'score', player: 'Bob', hole: 3, scores: { Nate: 99 } }); ok(r.status === 400, 'absurd score refused');
r = await act({ action: 'score', player: 'Bob', hole: 3, scores: { Ghost: 4 } }); ok(r.status === 400, 'a name outside the match refused');
r = await act({ action: 'score', code: 'CA', hole: 1, scores: { Jake: 3 } });
ok(r.status === 200 && r.json.config.scores.r1.m1.h['1'].Jake === 3 && r.json.config.scores.r1.m1.by['1'] === 'host', 'a captain can correct a score');
ok(!r.json.config.access, 'the public document stays free of captain codes');
// a host re-save with an old copy must not wipe the live scores or markers
await call('POST', '/bfe/cup', { event_name: 'E', config: Object.assign({}, cfg, { scores: undefined }), pin: '7797' });
r = await call('GET', '/bfe/cup?event=E');
ok(r.json.config.scores && r.json.config.scores.r1.m1.h['2'], 'host re-save keeps the scores');
ok(!!r.json.config.phases.round_r1_start, 'host re-save keeps the markers');
r = await act({ action: 'round_end', player: 'Jake' });
ok(r.status === 200 && !!r.json.config.phases.round_r1_end, 'finishing the round stamps its end');
r = await act({ action: 'round_end', player: 'Zed' }); ok(r.status === 403, 'strangers cannot finish a round');
r = await act({ action: 'round_reopen', player: 'Jake' }); ok(r.status === 200 && !r.json.config.phases.round_r1_end, 'reopen clears the end marker');
r = await call('POST', '/bfe/cup/act', { event_name: 'E', action: 'score', round: 'nope', player: 'Jake', hole: 1, scores: { Jake: 4 } }); ok(r.status === 404, 'unknown round');
console.log('score worker: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
