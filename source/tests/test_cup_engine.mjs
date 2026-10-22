// Dev-95 — BF Cup engine: segments, early-close match play, points, side totals, snake draft order.
import { loadEngine } from './extract.mjs';
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const E = loadEngine();
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m + ' (got ' + JSON.stringify(a) + ')');

// ---------- plan: points are derived from the field, never hardcoded ----------
let pl = E.cupPlanFor(16);
ok(pl.perSide === 8 && pl.satMatches === 4 && pl.sunMatches === 8 && pl.totalPoints === 16 && pl.target === 8.5, '16 players -> 8 + 8, 8.5 wins');
pl = E.cupPlanFor(20);
ok(pl.perSide === 10 && pl.satMatches === 5 && pl.sunMatches === 10 && pl.totalPoints === 20 && pl.target === 10.5, '20 players -> 10 + 10, 10.5 wins');
ok(E.cupWinTarget(15) === 8 && E.cupWinTarget(16) === 8.5, 'win target is the first half-point step above half the total');

// ---------- snake draft & alternating order ----------
eq(E.cupSnakeOrder(8, 'A', 'B'), ['A', 'B', 'B', 'A', 'A', 'B', 'B', 'A'], 'snake 1-2-2-1');
eq(E.cupSnakeOrder(14, 'B', 'A').slice(0, 5), ['B', 'A', 'A', 'B', 'B'], 'snake starts with whoever won the toss');
eq(E.cupAlternatingOrder(5, 'B', 'A'), ['B', 'A', 'B', 'A', 'B'], 'alternating draw (toss loser first)');
ok(E.cupSnakeOrder(14, 'A', 'B').filter(k => k === 'A').length === 7, 'a 14-pick snake gives 7 each');

// ---------- match state ----------
const arr = f => Array.from({ length: 18 }, (_, i) => f(i + 1));
const a18 = arr(() => 4);
let st = E.cupMatchState(arr(h => (h <= 5 ? 3 : 4)), a18, 10, 18);   // 10-18 = back nine; hole 10..14 side 0 isn't relevant (3 only h<=5)
ok(st.status === 'push' && st.thru === 9, 'holes outside the segment do not count (back nine all square)');
// side 0 wins holes 1-5 of a 9-hole segment: 5 up with 4 left -> 5&4
st = E.cupMatchState(arr(h => (h <= 5 ? 3 : 4)), a18, 1, 9);
ok(st.status === 'won' && st.winner === 0 && st.text === '5&4' && st.closedAt === 5, 'closes 5&4 (got ' + st.text + ')');
// early close: later holes are ignored, even if the loser wins them all
st = E.cupMatchState(arr(h => (h <= 5 ? 3 : 5)), arr(h => (h <= 5 ? 4 : 3)), 1, 9);
ok(st.status === 'won' && st.winner === 0 && st.text === '5&4', 'play-on holes never change a closed match');
// goes the distance: 1 up
st = E.cupMatchState(arr(h => (h === 9 ? 3 : 4)), a18, 1, 9);
ok(st.status === 'won' && st.winner === 0 && st.text === '1 UP', '1 UP on the last hole (got ' + st.text + ')');
// all square after 9 = halved
st = E.cupMatchState(a18, a18, 1, 9);
ok(st.status === 'push' && st.text === 'Halved' && st.winner === null, 'halved');
// in progress, and a gap stops the count
st = E.cupMatchState(arr(h => (h <= 3 ? (h === 1 ? 3 : 4) : null)), arr(h => (h <= 3 ? 4 : null)), 1, 9);
ok(st.status === 'pending' && st.thru === 3 && st.text === '1 UP thru 3', 'live text (got ' + st.text + ')');
const gap = arr(h => (h === 3 ? null : 4));
st = E.cupMatchState(gap, a18, 1, 9);
ok(st.thru === 2, 'a missing hole stops the match where the scores stop');
// 18-hole singles closes 3&2
st = E.cupMatchState(arr(h => (h <= 3 ? 3 : 4)), a18, 1, 18);
ok(st.status === 'won' && st.text === '3&2' && st.closedAt === 16, '3 up from the start of 18 holes closes 3&2 (got ' + st.text + ')');
st = E.cupMatchState(arr(h => (h <= 16 ? (h % 2 ? 3 : 4) : 4)), arr(() => 4), 1, 18);
ok(st.status === 'won' && st.text.endsWith('&' + (18 - st.closedAt)), 'singles closes with N&M (got ' + st.text + ')');

// ---------- a full 16-player Cup ----------
const names = side => Array.from({ length: 8 }, (_, i) => side + (i + 1));
const A = names('A'), B = names('B');
const sat = { key: 'sat', name: 'Saturday', segments: [{ key: 'foursomes', format: 'altshot', from: 1, to: 9 }, { key: 'fourball', format: 'bestball', from: 10, to: 18 }],
  matches: [0, 1, 2, 3].map(i => ({ key: 'S' + (i + 1), sides: [{ side: 'A', players: [A[2 * i], A[2 * i + 1]] }, { side: 'B', players: [B[2 * i], B[2 * i + 1]] }] })) };
const sun = { key: 'sun', name: 'Sunday', segments: [{ key: 'singles', format: 'singles', from: 1, to: 18 }],
  matches: A.map((p, i) => ({ key: 'U' + (i + 1), sides: [{ side: 'A', players: [p] }, { side: 'B', players: [B[i]] }] })) };
const cfg = { sides: [{ key: 'A', name: 'Team Jake', players: A }, { key: 'B', name: 'Team Nate', players: B }], points: { win: 1, half: 0.5, loss: 0 }, rounds: [sat, sun] };
ok(E.cupValidate(cfg).ok, 'valid config: ' + JSON.stringify(E.cupValidate(cfg).errors));
ok(E.cupTotalPoints(cfg) === 16 && E.cupWinTarget(16) === 8.5, 'total 16');
let s0 = E.cupStandings(cfg, []);
ok(s0.total === 16 && s0.target === 8.5 && s0.points.A === 0 && s0.points.B === 0 && s0.state === 'live', 'empty board');
ok(s0.rounds[0].matches.length === 4 && s0.rounds[0].matches[0].segments.length === 2, 'rounds/matches/segments in the view');

const card = (p, f) => ({ player: p, holes: arr(f) });
// Saturday match 1: A pair wins foursomes 3&2 (ONE shared score, both partners' cards carry it) but loses fourball
const cards = [];
const both = (pl, f) => pl.forEach(p => cards.push(card(p, f)));
both([A[0], A[1]], h => (h <= 9 ? (h <= 3 ? 3 : 4) : 5));       // A pair: shared ball 3,3,3 then 4s ; back nine 5s
both([B[0], B[1]], h => (h <= 9 ? 4 : 4));                         // B pair: 4s
const satCfg = Object.assign({}, cfg, { rounds: [sat] });
let s1 = E.cupStandings(satCfg, cards);
let m1 = s1.rounds[0].matches[0];
ok(m1.segments[0].status === 'won' && m1.segments[0].winner === 'A' && m1.segments[0].text === '3&2', 'foursomes won 3&2 by A (got ' + m1.segments[0].text + ')');
ok(m1.segments[1].status === 'won' && m1.segments[1].winner === 'B', 'fourball won by B (A pair carded 5s vs 4s)');
ok(s1.points.A === 1 && s1.points.B === 1, 'a pair can win the foursomes and lose the fourball: 1-1 (got ' + s1.points.A + '-' + s1.points.B + ')');
ok(m1.points.A === 1 && m1.points.B === 1, 'match points shown');

// fourball is better ball: one partner blows up, the other carries
const fb = [card('A3', h => (h < 10 ? 4 : 9)), card('A4', h => (h < 10 ? 4 : 3)), card('B3', h => (h < 10 ? 4 : 4)), card('B4', h => (h < 10 ? 4 : 4))];
const sf = E.cupStandings(cfg, fb).rounds[0].matches[1].segments[1];
ok(sf.status === 'won' && sf.winner === 'A', 'better ball: A3 9s do not hurt, A4 3s win (got ' + sf.status + ' ' + sf.winner + ')');
// foursomes with a shared ball where only one partner has the score still counts
const half = [{ player: 'A5', holes: arr(h => (h <= 9 ? 3 : null)) }, card('B5', () => 4), card('B6', () => 4)];
const sh = E.cupStandings(cfg, half).rounds[0].matches[2].segments[0];
ok(sh.status === 'won' && sh.winner === 'A', 'shared-ball score read from whichever partner carries it');

// halved match = half a point each
const hv = [card('A7', () => 4), card('A8', () => 4), card('B7', () => 4), card('B8', () => 4)];
const sv = E.cupStandings(satCfg, hv);
ok(sv.rounds[0].matches[3].points.A === 1 && sv.rounds[0].matches[3].points.B === 1 && sv.rounds[0].matches[3].segments[0].status === 'push', 'a halved nine is 1/2 each');
ok(sv.points.A === 1 && sv.points.B === 1, 'two halved nines = 1-1');

// full run: A wins everything -> 16-0, state final, won
const all = [];
A.forEach(p => all.push(card(p, () => 3))); B.forEach(p => all.push(card(p, () => 5)));
const sw = E.cupStandings(cfg, all);
ok(sw.points.A === 16 && sw.points.B === 0 && sw.state === 'final' && sw.winner === 'A', 'A sweeps 16-0 (state ' + sw.state + ')');
// a clinch is reported the moment it is mathematically over, even with matches still out
const clinchCfg = JSON.parse(JSON.stringify(cfg));
const part = [];
[...A.slice(0, 5)].forEach(p => part.push(card(p, () => 3))); [...B.slice(0, 5)].forEach(p => part.push(card(p, () => 5)));
// Sunday singles for A1-A5 won 5; Saturday pairs A1..A4 with B1..B4 won 4x2=8 -> 13 points
const sp = E.cupStandings(clinchCfg, part);
ok(sp.points.A > 8.5 && sp.clinched === 'A' && sp.state === 'live', 'clinch noted while matches remain (A ' + sp.points.A + ', clinched ' + sp.clinched + ')');
// equal at the end is a shared Cup
const shared = JSON.parse(JSON.stringify(cfg)); shared.rounds = [sun];
const sh2 = (() => { const c = []; A.slice(0, 4).forEach(p => c.push(card(p, () => 3))); B.slice(0, 4).forEach(p => c.push(card(p, () => 5)));
  A.slice(4).forEach(p => c.push(card(p, () => 5))); B.slice(4).forEach(p => c.push(card(p, () => 3))); return c; })();
const sst = E.cupStandings(shared, sh2);
ok(sst.points.A === 4 && sst.points.B === 4 && sst.state === 'final' && sst.winner === null && sst.shared === true, 'equal at the end = shared Cup (state ' + sst.state + ', shared ' + sst.shared + ')');
ok(sst.target === 4.5, 'target follows the config: Sunday only = 4.5');

// ---------- validation ----------
const bad = JSON.parse(JSON.stringify(cfg)); bad.sides[1].players[0] = 'A1';
ok(!E.cupValidate(bad).ok, 'a player on both sides is rejected');
const bad2 = JSON.parse(JSON.stringify(cfg)); bad2.rounds[0].matches[0].sides[0].players = ['A1'];
ok(!E.cupValidate(bad2).ok, 'a pair format needs two players a side');
const bad3 = JSON.parse(JSON.stringify(cfg)); bad3.rounds[0].segments[1].from = 8;
ok(!E.cupValidate(bad3).ok, 'overlapping segments are rejected');
const bad4 = JSON.parse(JSON.stringify(cfg)); bad4.rounds[1].matches[1].sides[0].players = ['A1'];
ok(!E.cupValidate(bad4).ok, 'a player may not play two matches in one round');
const part2 = JSON.parse(JSON.stringify(cfg)); part2.rounds[1].matches = part2.rounds[1].matches.slice(0, 3);
const pv = E.cupValidate(part2);
ok(pv.ok && pv.unassigned.sun.A.length === 5 && pv.unassigned.sat.A.length === 0, 'a half-built lineup is valid but reports who is unassigned per round');

// ---------- team draft ----------
const pool = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];
const dcfg = { sides: [{ key: 'A', name: 'Jake', captain: 'CapA' }, { key: 'B', name: 'Nate', captain: 'CapB' }], draft: { first: 'B', pool: pool.concat(['CapA', 'CapB']), picks: [] } };
let dv = E.cupDraftView(dcfg);
ok(dv.total === 6 && dv.onClock === 'B' && dv.pickNo === 1 && dv.remaining.length === 6, 'captains are not in the pool; the coin-toss winner picks first');
ok(JSON.stringify(dv.order) === JSON.stringify(['B', 'A', 'A', 'B', 'B', 'A']), 'snake order 1-2-2-1 from the toss winner');
let pk = E.cupDraftPick(dcfg, 'p3');
ok(pk.ok && pk.draft.picks[0].side === 'B' && pk.draft.picks[0].player === 'P3', 'a pick goes to the side on the clock, name case-insensitive');
const c2 = Object.assign({}, dcfg, { draft: pk.draft });
dv = E.cupDraftView(c2);
ok(dv.onClock === 'A' && dv.pickNo === 2 && dv.teams.B.join() === 'CapB,P3' && !dv.remaining.includes('P3'), 'next side up, team shows captain + pick');
ok(!E.cupDraftPick(c2, 'P3').ok && !E.cupDraftPick(c2, 'Nobody').ok, 'cannot pick a taken or unknown player');
ok(E.cupDraftUndo(c2).picks.length === 0, 'undo removes the last pick');
let cur = c2; ['P1', 'P2', 'P4', 'P5', 'P6'].forEach(n => { cur = Object.assign({}, cur, { draft: E.cupDraftPick(cur, n).draft }); });
dv = E.cupDraftView(cur);
ok(dv.done && dv.onClock === null && dv.teams.A.length === 4 && dv.teams.B.length === 4, 'draft ends with equal teams');
ok(!E.cupDraftPick(cur, 'P1').ok, 'nothing to pick once done');

// ---------- pasted stats ----------
const pasted = 'Player\tAVG Achievement\tSum of Birdie Count\tHCP\tPlayer Ranking\nDave Sherwin\t33.0\t14.0\t3.3\t1\nbrian hager\t28.0\t8.0\t6.5\t4\nSomeone Else\t20\t1\t9\t12';
const ps = E.cupParseStats(pasted, ['Dave Sherwin', 'Brian Hager']);
ok(ps.matched === 2 && ps.unmatched.join() === 'Someone Else', 'matches names case-insensitively, reports the rest');
ok(ps.stats['Dave Sherwin'].avg === 33 && ps.stats['Dave Sherwin'].birdies === 14 && ps.stats['Dave Sherwin'].hcp === 3.3 && ps.stats['Brian Hager'].rank === 4, 'reads the 2025 sheet columns');
ok(E.cupParseStats('Player,HCP\nA,5\nB,"7.5"', ['A', 'B']).stats.B.hcp === 7.5, 'comma separated works too');
ok(E.cupParseStats('', []).matched === 0, 'empty paste is fine');

// ---------- balance meter (last year\'s numbers: 10 Thieves 10.97 / Birdie Boyz 11.02, birdies 42 / 47) ----------
const stt = {}; const tA = [], tB = [];
[[3.3, 33, 14], [6.5, 28, 8], [10, 23.3, 9], [9, 26.3, 4], [8.6, 26, 1], [11.1, 20.6, 3], [14.3, 21, 2], [11, 20, 0], [16, 15, 0], [19.9, 14, 1]].forEach((r, i) => { stt['a' + i] = { hcp: r[0], avg: r[1], birdies: r[2], rank: i + 1 }; tA.push('a' + i); });
[[3.3, 29.4, 14], [5.1, 30.6, 11], [11, 26, 6], [12.2, 23.6, 8], [8.2, 21.7, 2], [15, 25, 3], [10.3, 19.3, 3], [12, 20, 0], [15, 20, 0], [18.1, 10, 0]].forEach((r, i) => { stt['b' + i] = { hcp: r[0], avg: r[1], birdies: r[2], rank: i + 1 }; tB.push('b' + i); });
let bal = E.cupBalance({ A: tA, B: tB }, stt);
ok(Math.abs(bal.sides.A.hcp - 10.97) < 0.01 && bal.sides.A.birdieTotal === 42 && bal.sides.B.birdieTotal === 47, 'reproduces last year\'s sheet: 10.97 handicap, 42 vs 47 birdies');
ok(bal.verdict === 'even' || bal.verdict === 'close', 'a carefully balanced Cup reads even/close (got ' + bal.verdict + ')');
const stacked = E.cupBalance({ A: ['a0', 'a1', 'a2'], B: ['a7', 'a8', 'a9'] }, stt);
ok(stacked.verdict === 'tilted' && stacked.metrics.hcp.edge === 'A' && stacked.metrics.avg.edge === 'A', 'a stacked team is flagged tilted with the edge named');
ok(E.cupBalance({ A: ['x'], B: ['y'] }, {}).verdict === 'unknown', 'no stats yet: unknown, no crash');
ok(E.cupBalance({ A: ['a0'], B: ['a1'] }, { a0: { hcp: 5 }, a1: { hcp: 5.5 } }).metrics.avg === null, 'a metric with no data is skipped');

// 9-hole rounds: segments must sit inside the nine that is played
const nine = JSON.parse(JSON.stringify(cfg)); nine.rounds = [Object.assign({}, nine.rounds[1], { holes: { count: 9, half: 'front' }, segments: [{ key: 's', format: 'singles', from: 1, to: 9 }] })];
ok(E.cupValidate(nine).ok, 'a front-nine round with segment 1-9 is valid');
nine.rounds[0].segments[0].to = 18;
ok(!E.cupValidate(nine).ok, 'a front-nine round cannot have a segment to hole 18');
nine.rounds[0].holes = { count: 9, half: 'back' }; nine.rounds[0].segments[0] = { key: 's', format: 'singles', from: 10, to: 18 };
ok(E.cupValidate(nine).ok, 'a back-nine round uses holes 10-18');

// one session per round, with 'same pairs as' (Saturday's two nines share their pairs)
const sess = JSON.parse(JSON.stringify(cfg));
sess.rounds = [
  { key: 'fs', name: 'Foursomes', holes: { count: 9, half: 'front' }, segments: [{ key: 'altshot', format: 'altshot', from: 1, to: 9 }], matches: sat.matches },
  { key: 'fb', name: 'Fourball', holes: { count: 9, half: 'back' }, sameAs: 'fs', segments: [{ key: 'bestball', format: 'bestball', from: 10, to: 18 }], matches: sat.matches },
  { key: 'sg', name: 'Singles', segments: [{ key: 'singles', format: 'singles', from: 1, to: 18 }], matches: sun.matches }];
ok(E.cupValidate(sess).ok, 'three sessions (two nines + singles) validate: ' + JSON.stringify(E.cupValidate(sess).errors));
ok(E.cupTotalPoints(sess) === 16, 'two nines x 4 matches + 8 singles = 16 points');
const st3 = E.cupStandings(sess, []);
ok(st3.total === 16 && st3.target === 8.5 && st3.rounds.length === 3, 'standings read the same from separate session rows');
const badSame = JSON.parse(JSON.stringify(sess)); badSame.rounds[0].sameAs = 'fb';
ok(!E.cupValidate(badSame).ok, 'same-as must point to an EARLIER session');
const badSize = JSON.parse(JSON.stringify(sess)); badSize.rounds[2].sameAs = 'fs';
ok(!E.cupValidate(badSize).ok, 'singles cannot reuse a pairs session');


// ---------- Saturday pairs ----------
{
  const roster = ['Jake', 'Ann', 'Bob', 'Cy'];
  let st = E.cupPairsStatus(roster, [['jake', 'ANN']]);
  ok(st.ok && st.pairs[0][0] === 'Jake' && st.pairs[0][1] === 'Ann' && st.leftover.length === 2 && !st.lockable, 'pairs come back in roster spelling; two left over is not lockable');
  st = E.cupPairsStatus(roster, [['Jake', 'Ann'], ['Bob', 'Cy']]);
  ok(st.lockable && st.leftover.length === 0, 'everyone paired is lockable');
  ok(!E.cupPairsStatus(roster, [['Jake', 'Zed']]).ok, 'a stranger in a pair is an error');
  ok(!E.cupPairsStatus(roster, [['Jake', 'Jake']]).ok, 'a player cannot partner himself');
  ok(!E.cupPairsStatus(roster, [['Jake', 'Ann'], ['Ann', 'Bob']]).ok, 'a player cannot be in two pairs');
  ok(!E.cupPairsStatus(roster, []).lockable, 'no pairs is not lockable');
  const odd = ['Jake', 'Ann', 'Bob'];
  ok(E.cupPairsStatus(odd, [['Jake', 'Ann']]).lockable, 'an odd roster may leave one man out');
  ok(!E.cupPairsStatus(roster, [['Jake', 'Ann']]).lockable, 'an even roster may not');
  const stats = { Jake: { hcp: 10, avg: 3 }, Ann: { hcp: 4.5, avg: 2.5 }, Bob: { hcp: 20 }, Cy: { hcp: 12, avg: 1 } };
  eq(E.cupPairStats(['Jake', 'Ann'], stats), { hcp: 14.5, avg: 5.5, birdies: null }, 'combined numbers add; a missing stat stays unknown');
  eq(E.cupPairStats(['Bob', 'Cy'], stats).avg, null, 'one missing value means no combined value');
  eq(E.cupPairsSpread([['Jake', 'Ann'], ['Bob', 'Cy']], stats), 17.5, 'spread = strongest pair vs weakest pair (14.5 vs 32)');
  const sug = E.cupPairsSuggest(roster, stats);
  eq(sug.pairs, [['Ann', 'Bob'], ['Jake', 'Cy']], 'suggestion pairs strongest with weakest');
  const cfg = { sides: [{ key: 'A', players: ['a1', 'a2'] }, { key: 'B', players: ['b1', 'b2'] }], pairs: { A: { list: [['a1', 'a2']], locked: true }, B: { list: [['b1', 'b2']], locked: false } } };
  ok(!E.cupPairsRevealed(cfg), 'not revealed while one side is open');
  eq(E.cupPairsVisible(cfg, 'B', false).A, { locked: true, count: 1 }, 'the open captain only sees that the other side locked');
  ok(E.cupPairsVisible(cfg, 'B', false).B.list.length === 1, 'a captain sees his own pairs');
  ok(E.cupPairsVisible(cfg, 'A', true).B.list, 'the commissioner sees everything');
  cfg.pairs.B.locked = true;
  ok(E.cupPairsRevealed(cfg) && E.cupPairsVisible(cfg, '', false).A.list, 'once both lock, everyone sees both');
  eq(E.cupRosterOf(cfg, 'A'), ['a1', 'a2'], 'roster comes from the locked team');
}

// ---------- Saturday matchup draw ----------
{
  const mk = (n) => Array.from({ length: n }, (_, i) => ['x' + i, 'y' + i]);
  const cfg = { sides: [{ key: 'A' }, { key: 'B' }], rounds: [{ key: 'sat', segments: [{ format: 'bestball', from: 1, to: 9 }] }, { key: 'sun', segments: [{ format: 'singles', from: 1, to: 18 }] }],
    pairs: { A: { list: [['a1', 'a2'], ['a3', 'a4'], ['a5', 'a6'], ['a7', 'a8']], locked: true }, B: { list: [['b1', 'b2'], ['b3', 'b4'], ['b5', 'b6'], ['b7', 'b8']], locked: true } },
    matchup: { started: true, first: 'B', log: [] } };
  ok(E.cupPairsRound(cfg) === 0, 'the pairs round is the first fourball/foursomes round');
  let v = E.cupMatchupView(cfg);
  ok(v.onClock === 'B' && v.role === 'put' && v.n === 4 && !v.done, 'the starting captain puts up first');
  ok(!E.cupMatchupPick(cfg, 'A', ['a1', 'a2']).ok, 'the other captain cannot go first');
  ok(!E.cupMatchupPick(cfg, 'B', ['a1', 'a2']).ok, 'a captain cannot put up the other side\'s pair');
  const step = (side, pair) => { const r = E.cupMatchupPick(cfg, side, pair); if (!r.ok) throw new Error(r.reason); cfg.matchup = r.matchup; return E.cupMatchupView(cfg); };
  v = step('B', ['B2', 'b1'].map(x => x.toLowerCase()));
  ok(v.onClock === 'A' && v.role === 'respond' && v.facing.join() === 'b1,b2', 'the other captain responds, facing that pair');
  v = step('A', ['a3', 'a4']);
  ok(v.onClock === 'A' && v.role === 'put' && v.matches.length === 1, 'roles swap: the responder now puts up');
  v = step('A', ['a1', 'a2']); v = step('B', ['b7', 'b8']);
  ok(v.onClock === 'B' && v.role === 'put', 'round three: B puts up again');
  ok(!E.cupMatchupPick(cfg, 'B', ['b1', 'b2']).ok, 'a pair already used cannot be used again');
  v = step('B', ['b3', 'b4']); ok(v.onClock === 'A' && v.role === 'respond', 'A responds');
  v = step('A', ['a5', 'a6']);
  ok(v.done && v.onClock === null && v.matches.length === 4, 'after N-1 rounds the matchups are set');
  eq(v.matches[3].sides.map(x => x.players.join()), ['a7,a8', 'b5,b6'], 'the last two pairs meet automatically');
  eq(v.matches[0].sides.map(x => x.side), ['A', 'B'], 'each match lists the sides in the Cup\'s side order');
  ok(!E.cupMatchupPick(cfg, 'A', ['a7', 'a8']).ok, 'no more picks once done');
  ok(!E.cupMatchupView({ sides: cfg.sides, pairs: cfg.pairs }).started, 'no draw until the host starts it');
}

// ---------- Cup handicaps (off the low at a partial allowance) ----------
{
  eq(E.cupHandicapRule({}), { pct: 0, by: { bestball: 0, altshot: 0, singles: 0 }, slope: null, rating: null, par: null }, 'no handicap block means scratch');
  eq(E.cupHandicapRule({ handicap: { pct: 50, singles: 100 } }).by, { bestball: 50, altshot: 50, singles: 100 }, 'each format has its own allowance; an older single % fills the gaps');
  ok(E.cupHandicapRule({ handicap: { bestball: 150 } }).by.bestball === 100 && E.cupHandicapRule({ handicap: { singles: '50' } }).by.singles === 50, 'allowance is clamped to 0-100');
  ok(E.cupCourseHcp(10, { slope: 132, rating: 71.2, par: 72 }) === 11 && E.cupCourseHcp(10.4, {}) === 10 && E.cupCourseHcp('', {}) === null, 'course handicap uses slope/rating/par when given, else the Index');
  const rule = { pct: 50, by: { bestball: 50, altshot: 50, singles: 50 } }, h = { a1: 4, a2: 10, b1: 20, b2: 8 };
  const m = { sides: [{ side: 'A', players: ['a1', 'a2'] }, { side: 'B', players: ['b1', 'b2'] }] };
  const st = E.cupMatchStrokes(m, h, rule);
  eq(st.players.map(x => x.strokes), [0, 3, 8, 2], 'fourball: each player gets 50% of the gap to the low man in the match');
  eq(st.teams.map(x => x.strokes), [0, 7], 'foursomes: the higher pair gets 50% of the gap between the pairs\' combined handicaps (28 vs 14)');
  const sm = { sides: [{ side: 'A', players: ['a2'] }, { side: 'B', players: ['b1'] }] };
  eq(E.cupMatchStrokes(sm, h, rule).players.map(x => x.strokes), [0, 5], 'singles: 50% of the gap, 1:1');
  ok(E.cupMatchStrokes(m, h, E.cupHandicapRule({})).players.every(x => x.strokes === 0), 'allowance 0 gives no strokes');
  ok(E.cupMatchStrokes(m, { a1: 4, a2: 10, b1: 20 }, rule).players[3].strokes === 0 && !E.cupMatchStrokes(m, { a1: 4, a2: 10, b1: 20 }, rule).players[3].known, 'a missing handicap gets no strokes and is flagged');
  ok(E.cupMatchStrokeText(m, h, rule, ['bestball', 'altshot'], k => 'Team ' + k) === 'Fourball: a2 3, b1 8, b2 2 · Foursomes: Team B gets 7', 'the matchup card line names who gets what, only for the formats played');
  ok(E.cupMatchStrokeText(m, h, E.cupHandicapRule({}), ['bestball'], null) === 'Scratch: no strokes', 'scratch says so');
  const mixed = E.cupHandicapRule({ handicap: { bestball: 100, altshot: 50, singles: 75 } });
  eq(E.cupMatchStrokes(m, h, mixed).players.map(x => x.strokes), [0, 6, 16, 4], 'fourball at 100% gives the full gap');
  eq(E.cupMatchStrokes(sm, h, mixed).players.map(x => x.strokes), [0, 8], 'singles at 75% of a 10-stroke gap is 8 (rounded), independent of the fourball setting');
  ok(E.cupMatchStrokeText(m, h, E.cupHandicapRule({ handicap: { bestball: 0, altshot: 50 } }), ['bestball', 'altshot'], k => k) === 'Fourball: scratch · Foursomes: B gets 7', 'a format set to 0 plays scratch while another still gets strokes');
  const si = [7, 1, 13, 3, 9, 15, 5, 17, 11, 8, 2, 14, 4, 10, 16, 6, 18, 12];
  const hs = E.cupHoleStrokes(5, si);
  eq(hs.map((v, i) => v ? i + 1 : 0).filter(Boolean), [2, 4, 7, 11, 13], '5 strokes land on the five hardest holes (stroke index 1-5)');
  ok(E.cupValidate({ sides: [{ key: 'A' }, { key: 'B' }], rounds: [], handicap: { singles: 120 } }).errors.some(e => /Handicap allowance/.test(e)), 'validation rejects an allowance over 100');
}

// ---------- playground (alternating) draft and the GS raw sheet ----------
{
  const cfg = { sides: [{ key: 'A', captain: 'Jake' }, { key: 'B', captain: 'Nate' }], draft: { started: true, first: 'A', pool: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'], picks: [] } };
  eq(E.cupDraftView(cfg).order, ['A', 'B', 'B', 'A', 'A', 'B'], 'default is the snake');
  cfg.draft.mode = 'alternate';
  eq(E.cupDraftView(cfg).order, ['A', 'B', 'A', 'B', 'A', 'B'], 'playground alternates one for one');
  ok(E.cupDraftView(cfg).mode === 'alternate', 'the view reports the mode');
  const sheet = 'title row\t\t\nPlayer\tTee\tPlayed\tPerformance\tAssigned\tAchieved\t\tSeries#2\nBill Steirer\tGreen\t4\t-0.3\t99.3\t99\nJake Knappenberger\tCombo\t5\t-12.5\t79.5\t67\nChauncey Lutte\tGold\t1\t—\t—\t—\n\t\t\t\t\t\t\tHCP\n';
  const r = E.cupParseStats(sheet, ['Bill Steirer', 'Jake Knappenberger', 'Chauncey Lutte', 'Andrew Kabrick']);
  ok(r.stats['Bill Steirer'].avg === -0.07 && r.stats['Jake Knappenberger'].avg === -2.5, 'GS sheet: performance per round played');
  ok(r.stats['Chauncey Lutte'].avg === null && r.matched === 3 && !r.stats['Andrew Kabrick'], 'a player with no data is left out');
}
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
