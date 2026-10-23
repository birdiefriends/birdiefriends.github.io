// Dev-95 — BF Cup config routes on the BFE Worker, against real SQLite (node:sqlite): self-creating table, PIN gate, upsert, read, delete.
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
const db = new DatabaseSync(':memory:');           // NO bfe_cup table: the route must create it
const call = async (method, path, body) => {
  const r = await W.fetch(new Request('https://w' + path, { method, body: body ? JSON.stringify(body) : undefined }), { DB: makeD1(db) }, {});
  return { status: r.status, json: await r.json() };
};
const cfg = { sides: [{ key: 'A', name: 'Team Jake', players: ['A1'] }, { key: 'B', name: 'Team Nate', players: ['B1'] }], points: { win: 1, half: 0.5, loss: 0 }, rounds: [] };
let r = await call('GET', '/bfe/cup?event=BF%20Cup');
ok(r.status === 404, 'unknown event is a 404 and the table is created on the fly (got ' + r.status + ')');
r = await call('POST', '/bfe/cup', { event_name: 'BF Cup', config: cfg });
ok(r.status === 403, 'no PIN, no write');
r = await call('POST', '/bfe/cup', { event_name: 'BF Cup', config: { sides: [], rounds: [] }, pin: '7797' });
ok(r.status === 400, 'needs two sides');
r = await call('POST', '/bfe/cup', { event_name: 'BF Cup', config: cfg, pin: '7797' });
ok(r.status === 200 && r.json.ok, 'saved');
r = await call('GET', '/bfe/cup?event=BF%20Cup');
ok(r.status === 200 && r.json.config.sides[0].name === 'Team Jake', 'read back, no PIN needed');
cfg.sides[0].players.push('A2');
await call('POST', '/bfe/cup', { event_name: 'BF Cup', config: cfg, pin: '7797' });
r = await call('GET', '/bfe/cup?event=BF%20Cup');
ok(r.json.config.sides[0].players.length === 2, 'a second save replaces the document');
ok(db.prepare('SELECT COUNT(*) n FROM bfe_cup').get().n === 1, 'one row per event');
r = await call('DELETE', '/bfe/cup?event=BF%20Cup&pin=1');
ok(r.status === 403, 'delete needs the PIN');
r = await call('DELETE', '/bfe/cup?event=BF%20Cup&pin=7797');
ok(r.status === 200, 'deleted');
r = await call('GET', '/bfe/cup?event=BF%20Cup');
ok(r.status === 404, 'gone');
// ── captain access: codes are private, picks follow the snake order, only the side on the clock can pick ──
const dcfg = { sides: [{ key: 'A', name: 'Team Jake', captain: 'Jake', players: [] }, { key: 'B', name: 'Team Nate', captain: 'Nate', players: [] }], points: { win: 1, half: 0.5, loss: 0 }, rounds: [],
  draft: { started: true, first: 'A', pool: ['P1', 'P2', 'P3', 'P4', 'Jake', 'Nate'], picks: [], locked: false }, access: { A: 'AAA111', B: 'BBB222' } };
r = await call('POST', '/bfe/cup', { event_name: 'Draft Cup', config: dcfg, pin: '7797' });
r = await call('GET', '/bfe/cup?event=Draft%20Cup');
ok(r.status === 200 && r.json.config.access === undefined && !JSON.stringify(r.json).includes('AAA111'), 'the public read never carries the captain codes');
r = await call('GET', '/bfe/cup?event=Draft%20Cup&pin=7797');
ok(r.json.config.access && r.json.config.access.A === 'AAA111', 'the host (PIN) can read the codes');
r = await call('GET', '/bfe/cup?event=Draft%20Cup&cap=BBB222');
ok(r.status === 200 && r.json.you === 'B' && !r.json.config.access, 'a captain code identifies his side and still hides the codes');
r = await call('GET', '/bfe/cup?event=Draft%20Cup&cap=nope');
ok(r.status === 403, 'a wrong captain code is refused');
// a host/BFE-Admin re-save without codes must not wipe them
await call('POST', '/bfe/cup', { event_name: 'Draft Cup', config: Object.assign({}, dcfg, { access: undefined }), pin: '7797' });
r = await call('GET', '/bfe/cup?event=Draft%20Cup&pin=7797');
ok(r.json.config.access && r.json.config.access.B === 'BBB222', 'a re-save without codes keeps them');
const act = (code, player) => call('POST', '/bfe/cup/act', { event_name: 'Draft Cup', code, action: 'pick', player });
r = await act('BBB222', 'P1'); ok(r.status === 409 && /not your turn/.test(r.json.error), 'B cannot pick while A is on the clock');
r = await act('wrong', 'P1'); ok(r.status === 403, 'a bad code cannot pick');
r = await act('AAA111', 'Jake'); ok(r.status === 409, 'captains are not in the pool to pick');
r = await act('AAA111', 'p1'); ok(r.status === 200 && r.json.config.draft.picks[0].player === 'P1' && r.json.config.draft.picks[0].side === 'A', 'A picks P1 (case-insensitive, canonical name stored)');
r = await act('AAA111', 'P2'); ok(r.status === 409, 'snake: B has picks 2 and 3, so A is not on the clock');
r = await act('BBB222', 'P1'); ok(r.status === 409 && /not available/.test(r.json.error), 'a picked player is not available');
r = await act('BBB222', 'P2'); ok(r.status === 200, 'B picks 2');
r = await act('BBB222', 'P3'); ok(r.status === 200, 'B picks 3 (snake)');
ok(r.json.config.draft.picks.length === 4 && r.json.config.draft.picks[3].auto === true && r.json.config.draft.picks[3].side === 'A', 'B\'s second pick leaves one player: A gets him automatically');
r = await act('AAA111', 'P4'); ok(r.status === 409, 'nothing left to pick');
r = await call('GET', '/bfe/cup-live');
ok(r.status === 200 && r.json.events.some(e => e.event_name === 'Draft Cup' && e.picks === 4 && e.total === 6), 'the live list shows the open draft');
await call('POST', '/bfe/cup', { event_name: 'Draft Cup (practice)', config: dcfg, pin: '7797' });
r = await call('GET', '/bfe/cup-live');
ok(!r.json.events.some(e => /practice/.test(e.event_name)), 'practice copies are not announced in the app');

// ── Saturday pairs: server-enforced, private until both captains lock, never wiped by a re-save ──
const pcfg = { sides: [{ key: 'A', name: 'Team Jake', captain: 'Jake', players: ['Jake', 'A1', 'A2', 'A3'] }, { key: 'B', name: 'Team Nate', captain: 'Nate', players: ['Nate', 'B1', 'B2', 'B3'] }], points: { win: 1, half: 0.5, loss: 0 }, rounds: [],
  draft: { started: true, first: 'A', pool: ['A1', 'A2', 'A3', 'B1', 'B2', 'B3'], picks: [], locked: false }, access: { A: 'AAA111', B: 'BBB222' } };
await call('POST', '/bfe/cup', { event_name: 'Pair Cup', config: pcfg, pin: '7797' });
const pact = (code, action, pairs) => call('POST', '/bfe/cup/act', { event_name: 'Pair Cup', code, action, pairs });
r = await pact('AAA111', 'pair_set', [['Jake', 'A1']]); ok(r.status === 409 && /not locked/.test(r.json.error), 'no pairs before the teams are locked');
pcfg.draft.locked = true; await call('POST', '/bfe/cup', { event_name: 'Pair Cup', config: pcfg, pin: '7797' });
r = await pact('wrong', 'pair_set', []); ok(r.status === 403, 'a bad code cannot touch pairs');
r = await pact('AAA111', 'pair_set', [['Jake', 'B1']]); ok(r.status === 400, 'a captain cannot pair someone from the other team');
r = await pact('AAA111', 'pair_set', [['Jake', 'A1'], ['A1', 'A2']]); ok(r.status === 400, 'a player cannot be in two pairs');
r = await pact('AAA111', 'pair_set', [['jake', 'a1']]); ok(r.status === 200 && r.json.config.pairs.A.list[0][0] === 'Jake' && r.json.config.pairs.A.list[0][1] === 'A1', 'a partial list saves, in roster spelling');
r = await pact('AAA111', 'pair_lock'); ok(r.status === 409 && /still need a partner/.test(r.json.error), 'cannot lock with players unpaired');
r = await pact('AAA111', 'pair_set', [['Jake', 'A1'], ['A2', 'A3']]); r = await pact('AAA111', 'pair_lock');
ok(r.status === 200 && r.json.config.pairs.A.locked === true, 'locks once everyone is paired');
r = await pact('AAA111', 'pair_set', []); ok(r.status === 409, 'locked pairs cannot be edited');
r = await call('GET', '/bfe/cup?event=Pair%20Cup&cap=BBB222');
ok(r.json.config.pairs.A.locked === true && r.json.config.pairs.A.count === 2 && !r.json.config.pairs.A.list, 'the other captain sees THAT side locked, not who is paired');
r = await call('GET', '/bfe/cup?event=Pair%20Cup');
ok(!r.json.config.pairs.A.list && !JSON.stringify(r.json.config.pairs).includes('A2'), 'the public read hides unrevealed pairs');
r = await call('GET', '/bfe/cup?event=Pair%20Cup&pin=7797'); ok(r.json.config.pairs.A.list.length === 2, 'the commissioner sees every pair');
await call('POST', '/bfe/cup', { event_name: 'Pair Cup', config: Object.assign({}, pcfg, { pairs: undefined }), pin: '7797' });
r = await call('GET', '/bfe/cup?event=Pair%20Cup&pin=7797'); ok(r.json.config.pairs && r.json.config.pairs.A.locked, 'a re-save from a page that never loaded pairs keeps them');
await pact('BBB222', 'pair_set', [['Nate', 'B1'], ['B2', 'B3']]); r = await pact('BBB222', 'pair_lock');
ok(r.status === 200 && r.json.config.pairs.A.list.length === 2, 'when B locks, B sees both sides');
r = await call('GET', '/bfe/cup?event=Pair%20Cup'); ok(r.json.config.pairs.A.list && r.json.config.pairs.B.list, 'and so does the public');
r = await pact('AAA111', 'pair_unlock'); ok(r.status === 409, 'after both lock only the commissioner can reopen');

// ── Saturday matchup draw: put up and respond, server-enforced, writes the matches into the pairs round ──
const mcfg = { sides: [{ key: 'A', name: 'A', players: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'] }, { key: 'B', name: 'B', players: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6'] }], points: { win: 1, half: 0.5, loss: 0 },
  rounds: [{ key: 'sat', segments: [{ format: 'bestball', from: 1, to: 18 }], matches: [] }, { key: 'sun', segments: [{ format: 'singles', from: 1, to: 18 }], matches: [] }],
  draft: { started: true, first: 'A', pool: [], picks: [], locked: true }, access: { A: 'AAA111', B: 'BBB222' },
  pairs: { A: { list: [['a1', 'a2'], ['a3', 'a4'], ['a5', 'a6']], locked: true }, B: { list: [['b1', 'b2'], ['b3', 'b4'], ['b5', 'b6']], locked: true } } };
await call('POST', '/bfe/cup', { event_name: 'Match Cup', config: mcfg, pin: '7797' });
const mact = (code, pair) => call('POST', '/bfe/cup/act', { event_name: 'Match Cup', code, action: 'match_pick', pair });
r = await mact('AAA111', ['a1', 'a2']); ok(r.status === 409 && /not started/.test(r.json.error), 'no picks until the host starts the draw');
mcfg.matchup = { started: true, first: 'B', log: [] }; await call('POST', '/bfe/cup', { event_name: 'Match Cup', config: mcfg, pin: '7797' });
r = await mact('AAA111', ['a1', 'a2']); ok(r.status === 409 && /not your turn/.test(r.json.error), 'the starting captain goes first');
r = await mact('BBB222', ['a1', 'a2']); ok(r.status === 409 && /unpaired/.test(r.json.error), 'cannot use the other side\'s players');
r = await mact('BBB222', ['b2', 'b1']); ok(r.status === 200 && r.json.config.matchup.log[0].pair.join() === 'b2,b1', 'B puts up a pair (names in roster spelling, order as chosen)');
r = await mact('BBB222', ['b3', 'b4']); ok(r.status === 409, 'B cannot go twice');
r = await mact('AAA111', ['a5', 'a6']); ok(r.status === 200 && !r.json.config.matchup.done, 'A responds');
r = await mact('AAA111', ['a1', 'a2']); ok(r.status === 200 && !r.json.config.matchup.done, 'A, the responder, now puts up');
r = await mact('BBB222', ['b3', 'b4']);
ok(r.status === 200 && r.json.config.matchup.done === true, 'after N-1 rounds the draw is done');
const sat = r.json.config.rounds[0].matches;
ok(sat.length === 3 && sat[0].sides[0].side === 'A' && sat[0].sides[0].players.join() === 'a5,a6' && sat[0].sides[1].players.join() === 'b2,b1' && sat[2].sides[0].players.join() === 'a3,a4' && sat[2].sides[1].players.join() === 'b5,b6', 'the matches are written into the pairs round, the last two pairs meeting automatically');
ok(r.json.config.rounds[1].matches.length === 0, 'Sunday is untouched');
r = await mact('AAA111', ['a3', 'a4']); ok(r.status === 409 && /already set/.test(r.json.error), 'no more picks after completion');

// ── app card: phases, and a captain's own code for one-tap access (no copied links) ──
r = await call('GET', '/bfe/cup-live');
ok(r.json.events.find(e => e.event_name === 'Pair Cup').phase === 'matchups' || r.json.events.find(e => e.event_name === 'Pair Cup').phase === 'pairs', 'the live list reports a phase');
ok(r.json.events.every(e => e.cap_code === undefined), 'with no player named, nobody gets a captain code');
r = await call('GET', '/bfe/cup-live?player=Jake');
ok(r.json.events.find(e => e.event_name === 'Pair Cup').cap_code === 'AAA111' && r.json.events.find(e => e.event_name === 'Pair Cup').cap_side === 'Team Jake', 'a captain named by the app gets his own side\'s code');
r = await call('GET', '/bfe/cup-live?player=nate'); ok(r.json.events.find(e => e.event_name === 'Pair Cup').cap_code === 'BBB222', 'name match ignores case');
r = await call('GET', '/bfe/cup-live?player=A1'); ok(r.json.events.find(e => e.event_name === 'Pair Cup').cap_code === undefined, 'a player who is not a captain gets no code');
r = await call('GET', '/bfe/cup-live'); ok(!JSON.stringify(r.json).includes('BBB222') && !JSON.stringify(r.json).includes('AAA111'), 'the public list never shows a code');
ok(r.json.events.find(e => e.event_name === 'Draft Cup').phase === 'draft', 'an open draft is in the draft phase');
await call('POST', '/bfe/cup', { event_name: 'Phase Cup', config: Object.assign({}, pcfg, { matchup: { started: true, first: 'B', log: [] } }), pin: '7797' });
r = await call('GET', '/bfe/cup-live'); ok(r.json.events.find(e => e.event_name === 'Phase Cup').phase === 'matchups', 'a started matchup draw is the matchups phase');

// ── playground draft order on the server ──
await call('POST', '/bfe/cup', { event_name: 'Alt Cup', config: Object.assign({}, dcfg, { draft: Object.assign({}, dcfg.draft, { mode: 'alternate' }) }), pin: '7797' });
const aact = (code, player) => call('POST', '/bfe/cup/act', { event_name: 'Alt Cup', code, action: 'pick', player });
r = await aact('AAA111', 'P1'); ok(r.status === 200, 'alt: A picks first');
r = await aact('AAA111', 'P2'); ok(r.status === 409, 'alt: A cannot pick twice in a row');
r = await aact('BBB222', 'P2'); ok(r.status === 200, 'alt: B picks second');
r = await aact('AAA111', 'P3'); ok(r.status === 200, 'alt: back to A');

// ── captains sign off; both signed = the teams lock themselves ──
const sact = (code, action) => call('POST', '/bfe/cup/act', { event_name: 'Draft Cup', code, action });
r = await sact('AAA111', 'signoff'); ok(r.status === 200 && r.json.config.draft.signoff.A === true && !r.json.config.draft.locked, 'A signs off; the teams stay open until B does');
r = await sact('AAA111', 'unsign'); ok(r.status === 200 && !r.json.config.draft.signoff.A, 'a captain can take his sign-off back');
r = await sact('wrong', 'signoff'); ok(r.status === 403, 'a bad code cannot sign off');
await sact('AAA111', 'signoff'); r = await sact('BBB222', 'signoff');
ok(r.status === 200 && r.json.config.draft.locked === true && r.json.config.sides[0].players[0] === 'Jake' && r.json.config.sides[0].players.length === 3 && r.json.config.sides[1].players.length === 3, 'both signed: locked, rosters written (captain first)');
r = await sact('AAA111', 'signoff'); ok(r.status === 409, 'nothing to sign once the teams are locked');
await call('POST', '/bfe/cup', { event_name: 'Early Cup', config: Object.assign({}, dcfg, { draft: Object.assign({}, dcfg.draft, { picks: [] }) }), pin: '7797' });
r = await call('POST', '/bfe/cup/act', { event_name: 'Early Cup', code: 'AAA111', action: 'signoff' }); ok(r.status === 409 && /picked/.test(r.json.error), 'no sign-off until every player is picked');

// ── captain in control: Start / Defer / Coin toss ──
const octl = { sides: dcfg.sides, points: dcfg.points, rounds: [], access: dcfg.access, draft: { started: true, control: 'A', pool: ['P1', 'P2', 'P3', 'P4', 'Jake', 'Nate'], picks: [], locked: false } };
await call('POST', '/bfe/cup', { event_name: 'Ctl Cup', config: octl, pin: '7797' });
const oact = (code, extra) => call('POST', '/bfe/cup/act', Object.assign({ event_name: 'Ctl Cup', code, action: 'order', stage: 'draft' }, extra));
r = await call('POST', '/bfe/cup/act', { event_name: 'Ctl Cup', code: 'AAA111', action: 'pick', player: 'P1' }); ok(r.status === 409 && /order/.test(r.json.error), 'no picks until the order is chosen');
r = await oact('BBB222', { choice: 'start' }); ok(r.status === 403, 'only the captain in control can choose');
r = await oact('AAA111', { choice: 'maybe' }); ok(r.status === 400, 'an unknown choice is refused');
r = await oact('AAA111', { choice: 'defer' }); ok(r.status === 200 && r.json.config.draft.first === 'B' && /deferred/.test(r.json.config.draft.orderChoice.text), 'deferring gives the other side the first pick');
r = await oact('AAA111', { choice: 'start' }); ok(r.status === 409, 'the order can only be chosen once');
r = await call('POST', '/bfe/cup/act', { event_name: 'Ctl Cup', code: 'BBB222', action: 'pick', player: 'P1' }); ok(r.status === 200, 'then the first-pick side can pick');
await call('POST', '/bfe/cup', { event_name: 'Ctl Cup', config: octl, pin: '7797' });
const seen = new Set(); for (let i = 0; i < 12 && seen.size < 2; i++) { await call('POST', '/bfe/cup', { event_name: 'Ctl Cup', config: octl, pin: '7797' }); r = await oact('AAA111', { choice: 'toss' }); seen.add(r.json.config.draft.first); ok(['A', 'B'].includes(r.json.config.draft.first) && /Coin toss/.test(r.json.config.draft.orderChoice.text), 'a coin toss picks a side'); }
ok(seen.size === 2, 'the coin toss really is random (both sides came up)');
// Saturday matchup draw: the side that picked second is in control
const ocfg2 = Object.assign({}, pcfg, { draft: Object.assign({}, pcfg.draft, { locked: true, first: 'A' }), pairs: { A: { list: [['Jake', 'A1'], ['A2', 'A3']], locked: true }, B: { list: [['Nate', 'B1'], ['B2', 'B3']], locked: true } }, matchup: undefined });
await call('POST', '/bfe/cup', { event_name: 'Mu Cup', config: ocfg2, pin: '7797' });
const oMu = (code, extra) => call('POST', '/bfe/cup/act', Object.assign({ event_name: 'Mu Cup', code, action: 'order', stage: 'matchup' }, extra));
r = await oMu('AAA111', { choice: 'start' }); ok(r.status === 403, 'the side that picked first is not in control of the matchup draw');
r = await oMu('BBB222', { choice: 'start' }); ok(r.status === 200 && r.json.config.matchup.started && r.json.config.matchup.first === 'B', 'the second-picking captain starts the matchup draw');
r = await oMu('BBB222', { choice: 'start' }); ok(r.status === 409, 'it cannot be started twice');

// ── phase markers: the server stamps WHEN each phase really began ──
{
  const base = { sides: dcfg.sides, points: dcfg.points, rounds: [], access: dcfg.access, draft: { started: false, first: 'A', pool: ['P1', 'P2', 'Jake', 'Nate'], picks: [], locked: false } };
  await call('POST', '/bfe/cup', { event_name: 'Phase2 Cup', config: base, pin: '7797' });
  let g = await call('GET', '/bfe/cup?event=Phase2%20Cup'); ok(!g.json.config.phases || !g.json.config.phases.selection_open, 'no markers before anything starts');
  await call('POST', '/bfe/cup', { event_name: 'Phase2 Cup', config: Object.assign({}, base, { draft: Object.assign({}, base.draft, { started: true }) }), pin: '7797' });
  g = await call('GET', '/bfe/cup?event=Phase2%20Cup'); const t0 = g.json.config.phases.selection_open;
  ok(/^\d{4}-\d\d-\d\dT/.test(t0) && !g.json.config.phases.selection_locked, 'starting the draft stamps selection_open');
  // a stale client save (no phases) must not lose or move the marker
  await call('POST', '/bfe/cup', { event_name: 'Phase2 Cup', config: Object.assign({}, base, { draft: Object.assign({}, base.draft, { started: true }), phases: undefined }), pin: '7797' });
  g = await call('GET', '/bfe/cup?event=Phase2%20Cup'); ok(g.json.config.phases.selection_open === t0, 'a re-save keeps the original time');
  // both captains sign off through the Worker: selection_locked is stamped
  await call('POST', '/bfe/cup/act', { event_name: 'Phase2 Cup', code: 'AAA111', action: 'pick', player: 'P1' });
  await call('POST', '/bfe/cup/act', { event_name: 'Phase2 Cup', code: 'AAA111', action: 'signoff' }); r = await call('POST', '/bfe/cup/act', { event_name: 'Phase2 Cup', code: 'BBB222', action: 'signoff' });
  g = await call('GET', '/bfe/cup?event=Phase2%20Cup'); ok(g.json.config.draft.locked && /^\d{4}/.test(g.json.config.phases.selection_locked || ''), 'signing off stamps selection_locked');
  // Start over clears markers
  await call('POST', '/bfe/cup', { event_name: 'Phase2 Cup', config: base, pin: '7797' });
  g = await call('GET', '/bfe/cup?event=Phase2%20Cup'); ok(!g.json.config.phases.selection_open && !g.json.config.phases.selection_locked, 'starting over clears the markers');
}
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
