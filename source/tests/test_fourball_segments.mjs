// Dev-93 — Fourball pot variants: segments (Front/Back/Total, 6/6/6), strokes vs holes won, foursome vs field, pushes, match view.
import { loadEngine } from './extract.mjs';
let pass = 0, fail = 0;
const eq = (a, b, m) => { const ok = JSON.stringify(a) === JSON.stringify(b); ok ? pass++ : fail++; if (!ok) console.log('FAIL', m, '\n  got', JSON.stringify(a), '\n  exp', JSON.stringify(b)); };
const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const E = loadEngine();
const A = f => Array.from({ length: 18 }, (_, i) => f(i));
const card = (player, holes, extra = {}) => ({ player, holes, ...extra });
const cfg = (fb, dpp = 15, pairs = [['Ann', 'Bob'], ['Cy', 'Di']]) => ({ games: ['fourball'], dollar_per_player: dpp,
  game_configs: { fourball: { dollar_per_player: dpp, basis: 'gross', net_mode: 'own', pairs, ...fb } } });
const pay = (row, cards) => E.computeGatheringGamesPayout(row, cards, {}, []);
const tot = r => r.payouts.reduce((a, p) => a + p.total, 0) + r.unallocated;

// plan resolution
eq(E.fourballSegmentPlan({}), { period: 'round', mode: 'total', win_by: 'strokes', scope: 'field', segs: [] }, 'plan: default is the original single contest');
eq(E.fourballSegmentPlan({ segments: 'fbt', win_by: 'holes', scope: 'field' }).scope, 'group', 'plan: holes won forces foursome scope');
eq(E.fourballSegmentPlan({ segments: 'sixes' }).segs.map(s => s.label), ['Holes 1-6', 'Holes 7-12', 'Holes 13-18'], 'plan: sixes labels');
eq(E.fourballSegmentPlan({ segments: 'fbt' }).segs.map(s => [s.a, s.b]), [[0, 9], [9, 18], [0, 18]], 'plan: Front/Back/Total ranges');
eq(E.fourballSegmentPlan({ segments: 'bogus' }).mode, 'total', 'plan: unknown mode falls back to total');

// scoring periods: the new `period` field, the older `segments` name, and Front / Back
eq(E.periodKey({ period: 'front_back' }), 'front_back', 'period: new field read');
eq(E.periodKey({ segments: 'fbt' }), 'fbt', 'period: older segments field still read');
eq(E.periodKey({ segments: 'total' }), 'round', 'period: older "total" means the whole round');
eq(E.periodKey({ period: 'round', segments: 'fbt' }), 'round', 'period: the new field wins');
eq(E.periodKey({ period: 'nope' }), 'round', 'period: unknown plays as the whole round');
eq(E.periodList().map(x => x.key), ['round', 'front_back', 'fbt', 'sixes'], 'period: the picker list');
eq(E.fourballSegmentPlan({ period: 'front_back' }).segs.map(x => x.label), ['Front 9', 'Back 9'], 'plan: Front / Back is two periods');
{
  // Front / Back: two pots, the ante is split in two. Ann&Bob win the front on strokes, Cy&Di win the back.
  const r = pay(cfg({ period: 'front_back', win_by: 'strokes', scope: 'group' }, 20), [
    card('Ann', A(i => i < 9 ? 4 : 5)), card('Bob', A(() => 6)), card('Cy', A(i => i < 9 ? 5 : 4)), card('Di', A(() => 6))]);
  eq(r.fourball.segments.groups[0].segments.map(x => x.key), ['front', 'back'], 'front/back: two segments, no Total');
  eq(r.fourball.segments.per_segment, 10, 'front/back: $20 ante is $10 per segment');
  eq(r.fourball.segments.groups[0].segments.map(x => x.pot), [40, 40], 'front/back: each pot is $10 x 4 players');
  eq(r.payouts.map(p => [p.player, p.total]), [['Ann', 20], ['Bob', 20], ['Cy', 20], ['Di', 20]], 'front/back: each pair wins one pot, $20 a player');
  const t = r.payouts.reduce((a, p) => a + p.total, 0) + r.unallocated; eq(t, 80, 'front/back: every dollar accounted for');
  const mv = E.fourballMatchView(r.fourball, { pairs: [['Ann', 'Bob'], ['Cy', 'Di']], period: 'front_back', win_by: 'strokes', scope: 'group' });
  eq(mv.groups[0].segs.map(x => x.key), ['front', 'back'], 'front/back: the match view carries the same two periods');
}
// the same game saved under the older field name plays exactly the same
{
  const cards = [card('Ann', A(i => i < 9 ? 4 : 5)), card('Bob', A(() => 6)), card('Cy', A(i => i < 9 ? 5 : 4)), card('Di', A(() => 6))];
  const a = pay(cfg({ segments: 'fbt', win_by: 'holes', scope: 'group' }), cards), b = pay(cfg({ period: 'fbt', win_by: 'holes', scope: 'group' }), cards);
  eq(a.payouts, b.payouts, 'older `segments` and new `period` pay identically');
}

// the original game is untouched
const base = pay(cfg({}), [card('Ann', A(() => 4)), card('Bob', A(() => 5)), card('Cy', A(() => 5)), card('Di', A(() => 5))]);
ok(!base.fourball.segments && base.fourball.per_pair === 60, 'total mode: no segments block, winners split the whole pot as before');

// strokes: one blow-up hole swings a segment; pots add up to the ante
const row1 = cfg({ segments: 'fbt', win_by: 'strokes', scope: 'group' });
const c1 = [card('Ann', A(() => 4)), card('Bob', A(() => 6)), card('Cy', A(() => 4)), card('Di', A(() => 6))];
// both pairs' better ball is 4 on every hole: every segment ties
let r = pay(row1, c1);
eq(r.fourball.segments.groups[0].segments.map(s => s.status), ['push', 'push', 'push'], 'strokes: identical better balls -> every segment is a push');
eq(r.payouts.map(p => p.fourball || 0), [0, 0, 0, 0], 'push: nobody wins anything');
eq(r.payouts.map(p => p.given_back), [15, 15, 15, 15], 'push: every ante comes back');
ok(tot(r) === 60, 'money conserved when everything pushes');
const c2 = [card('Ann', A(() => 4)), card('Bob', A(i => (i === 3 ? 12 : 4))), card('Cy', A(() => 5)), card('Di', A(() => 5))];
// a single partner's blow-up never hurts the pair when the other partner scores
const cBlow = [card('Ann', A(() => 4)), card('Bob', A(() => 6)), card('Cy', A(i => (i === 3 ? 9 : 4))), card('Di', A(() => 6))];
eq(pay(row1, cBlow).fourball.segments.groups[0].segments.map(s => s.status), ['won', 'push', 'won'], 'strokes: Di\'s 6 counts on hole 4, so Cy&Di lose the front by 2 and tie the back');
r = pay(row1, c2);
eq(r.fourball.segments.groups[0].segments.map(s => s.winner && s.winner.join('&')), ['Ann&Bob', 'Ann&Bob', 'Ann&Bob'], 'strokes: better pair wins all three');
eq(r.payouts.map(p => p.fourball || 0), [30, 30, 0, 0], 'winning pair splits each segment pot: $20 x 3 = $60 -> $30 each');
ok(tot(r) === 60, 'money conserved');
// per segment ante and pot size
eq(r.fourball.segments.per_segment, 5, 'ante is split across the three segments: $15 -> $5 each');
eq(r.fourball.segments.groups[0].segments.map(s => s.pot), [20, 20, 20], 'each segment pot = $5 x 4 players');

// holes won vs strokes can disagree: one heavy hole
const c3 = [card('Ann', A(i => (i === 0 ? 9 : 5))), card('Bob', A(i => (i === 0 ? 9 : 6))), card('Cy', A(() => 6)), card('Di', A(() => 6))];
// Ann&Bob: hole 1 = 9, then 5s -> front 9+40=49; Cy&Di 6s -> 54. Strokes: Ann&Bob win front. Holes: Ann&Bob win 8 holes, lose 1 -> still win. Make it lose by strokes, win on holes:
const c4 = [card('Ann', A(i => (i === 0 ? 14 : 5))), card('Bob', A(i => (i === 0 ? 14 : 6))), card('Cy', A(() => 6)), card('Di', A(() => 6))];
// Front: A&B 14+8*5=54; C&D 54 -> strokes tie (push). Holes: A&B win 8 of 9 -> A&B win by holes.
const byStrokes = pay(cfg({ segments: 'fbt', win_by: 'strokes' }), c4).fourball.segments.groups[0].segments[0];
const byHoles = pay(cfg({ segments: 'fbt', win_by: 'holes' }), c4).fourball.segments.groups[0].segments[0];
eq([byStrokes.status, byHoles.status, byHoles.winner && byHoles.winner.join('&')], ['push', 'won', 'Ann&Bob'], 'config matters: a heavy hole pushes on strokes but the pair that won 8 holes wins on holes');
eq(byHoles.holes_won, [8, 1], 'holes won tally reported');

// 6/6/6 with a lone pair and an incomplete card
const rowSix = cfg({ segments: 'sixes', win_by: 'strokes', scope: 'group' }, 12, [['Ann', 'Bob'], ['Cy', 'Di'], ['Ed', 'Flo']]);
const partial = [card('Ann', A(() => 4)), card('Bob', A(() => 4)), card('Cy', A(i => (i < 12 ? 5 : null))), card('Di', A(i => (i < 12 ? 5 : null))),
  card('Ed', A(() => 4)), card('Flo', A(() => 4))];
r = pay(rowSix, partial);
eq(r.fourball.segments.groups[0].segments.map(s => s.status), ['won', 'won', 'pending'], 'unfinished holes: the segment is not decided yet');
eq(r.fourball.segments.groups[1].segments.map(s => s.status), ['pending', 'pending', 'pending'], 'a lone pair has no opponent: nothing to decide');
ok(tot(r) === 72, 'money conserved with a lone pair and an incomplete segment');

// 9-hole round falls back to the original game
const nine = pay(cfg({ segments: 'fbt' }), [card('Ann', A(i => (i < 9 ? 4 : null)), { hole_count: 9 }), card('Bob', A(i => (i < 9 ? 5 : null)), { hole_count: 9 }),
  card('Cy', A(i => (i < 9 ? 5 : null)), { hole_count: 9 }), card('Di', A(i => (i < 9 ? 5 : null)), { hole_count: 9 })]);
ok(!nine.fourball.segments, '9-hole round: segments do not apply, the original game runs');

// net with segments
const hc = { allowance: 100, skins_basis: 'gross', birdiepay_basis: 'gross', stroke_index: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18],
  players: { Ann: { kind: 'given', strokes: 0 }, Bob: { kind: 'given', strokes: 0 }, Cy: { kind: 'given', strokes: 18 }, Di: { kind: 'given', strokes: 18 } } };
const netRow = Object.assign(cfg({ segments: 'fbt', basis: 'net', win_by: 'strokes' }), { handicap_config: hc });
r = pay(netRow, [card('Ann', A(() => 5)), card('Bob', A(() => 5)), card('Cy', A(() => 5)), card('Di', A(() => 5))]);
eq(r.fourball.segments.groups[0].segments.map(s => s.winner && s.winner.join('&')), ['Cy&Di', 'Cy&Di', 'Cy&Di'], 'net: a stroke a hole turns equal gross 5s into net 4s, Cy&Di win every segment');
r = pay(netRow, [card('Ann', A(() => 4)), card('Bob', A(() => 4)), card('Cy', A(() => 5)), card('Di', A(() => 5))]);
eq(r.fourball.segments.groups[0].segments.map(s => s.status), ['push', 'push', 'push'], 'net: Cy/Di net 4 ties Ann/Bob gross 4 -> push');

// match view
const addon = cfg({ segments: 'fbt', win_by: 'holes' }).game_configs.fourball;
const p2 = pay(cfg({ segments: 'fbt', win_by: 'holes' }), [card('Ann', [4, 3, 3, 4, 4, 4, 5, ...Array(11).fill(null)]), card('Bob', [5, 5, 5, 5, 5, 5, 6, ...Array(11).fill(null)]),
  card('Cy', [4, 4, 3, 4, 5, 5, 5, ...Array(11).fill(null)]), card('Di', [6, 6, 6, 6, 6, 6, 6, ...Array(11).fill(null)])]);
const v = E.fourballMatchView(p2.fourball, addon);
eq(v.groups.length, 1, 'view: one foursome');
eq(v.groups[0].holes.slice(0, 7).map(h => h.res), ['T', 'A', 'T', 'T', 'A', 'A', 'T'], 'view: hole results (A = Ann&Bob wins)');
eq(v.groups[0].holes[7].res, null, 'view: unplayed hole has no result');
const front = v.groups[0].segs[0];
eq([front.holes_won, front.halved, front.lead, front.leader, front.status, front.played], [[3, 0], 4, 3, 0, 'in_progress', 7], 'view: front tally 3-0, 4 halved, A leads by 3 holes');
eq(v.groups[0].segs[1].status, 'not_started', 'view: back not started');
eq(v.groups[0].strokes_lead, 3, 'view: total strokes lead');
eq(E.fourballMatchView(null, addon), null, 'view: null without a Fourball result');
const solo = E.fourballMatchView(pay(cfg({}, 15, [['Ann', 'Bob'], ['Cy', 'Di'], ['Ed', 'Flo']]), []).fourball, { pairs: [['Ann', 'Bob'], ['Cy', 'Di'], ['Ed', 'Flo']] });
ok(solo.groups[1].solo === true, 'view: a lone pair is marked solo');
console.log(`fourball segments: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
