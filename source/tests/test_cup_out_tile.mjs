// "Out" (stored 0, shown as Out, was P): who wins the hole when a side gives it up, in each team format. Brian 2026-11-05.
import fs from 'fs'; import { fileURLToPath } from 'url'; import { loadEngine } from './extract.mjs';
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const E = loadEngine();
const HERE = p => fileURLToPath(new URL(p, import.meta.url));
const lm = fs.readFileSync(HERE('../../docs/bf_live_match.js'), 'utf8');
ok(!/>P<\/button>/.test(lm) && /\|0" title="Out of the hole/.test(lm), 'the P tile is relabelled Out');
ok(/Putt conceded\? Enter the score as if you holed it/.test(lm), 'the hint about conceded putts is under the tiles');
const mk = fmt => ({ sides: [{ key: 'A' }, { key: 'B' }], points: { win: 1, half: 0.5, loss: 0 }, handicap: { bestball: 0, altshot: 0, singles: 0, pars: new Array(18).fill(4), strokeIndex: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18] }, draft: { stats: {} },
  rounds: [{ key: 'r', segments: [{ key: 's', format: fmt, from: 1, to: 18 }], matches: [{ key: 'm', sides: [{ side: 'A', players: fmt === 'singles' ? ['A1'] : ['A1', 'A2'] }, { side: 'B', players: fmt === 'singles' ? ['B1'] : ['B1', 'B2'] }] }] }], scores: {} });
const hole1 = (fmt, scores) => { const c = mk(fmt); c.scores.r = { m: { h: { 1: scores }, t: {}, by: {} } }; const lv = E.cupMatchLive(c, c.rounds[0], c.rounds[0].matches[0], c.scores.r.m); return lv.segments[0].state; };
// fourball: one partner out, the other scores: the team still has its best ball
let st = hole1('bestball', { A1: 0, A2: 5, B1: 4, B2: 6 }); ok(st.lead === -1, 'fourball: one partner Out, the other makes 5 against a 4: the 5 counts and B wins the hole');
st = hole1('bestball', { A1: 0, A2: 4, B1: 4, B2: 6 }); ok(st.lead === 0, 'fourball: one partner Out, partner ties the best ball: halved');
st = hole1('bestball', { A1: 0, A2: 0, B1: 6, B2: 7 }); ok(st.lead === -1, 'fourball: BOTH partners Out is the team conceding: the other side wins even with a 7');
st = hole1('bestball', { A1: 0, A2: 0, B1: 0, B2: 0 }); ok(st.lead === 0, 'fourball: both teams fully Out: halved (a double concession needs no extra marker)');
// greensomes: one row per side
st = hole1('altshot', { A1: 0, B1: 9 }); ok(st.lead === -1, 'greensomes: the side that is Out loses the hole');
st = hole1('altshot', { A1: 0, B1: 0 }); ok(st.lead === 0, 'greensomes: both Out: halved');
st = hole1('singles', { A1: 0, B1: 8 }); ok(st.lead === -1, 'singles: Out loses the hole whatever the other makes');
console.log(`test_cup_out_tile: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
