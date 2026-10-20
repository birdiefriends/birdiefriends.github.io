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

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
