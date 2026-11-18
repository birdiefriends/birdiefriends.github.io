// The scores, not the plan, say where a group started (Turkeys + MiserBall longest survivor). The plan is only the fallback.
import { loadEngine } from './extract.mjs';
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const E = loadEngine();
const sc = (player, map) => ({ player, holes: Array.from({ length: 18 }, (_, i) => map[i + 1] != null ? map[i + 1] : null) });
const run = (player, from, n, v) => { const m = {}; for (let k = 0; k < n; k++) m[((from - 1 + k) % 18) + 1] = v(k); return sc(player, m); };
const eff = (cards, plan) => E.effectiveStartHoles(cards, plan);

ok(eff([run('Ann', 6, 5, () => 4)], {}).ann === 6, 'scores on 6-10 only -> started on 6');
ok(eff([run('Ann', 16, 5, () => 4)], {}).ann === 16, 'a run that wraps 16,17,18,1,2 -> started on 16');
ok(eff([run('Ann', 6, 5, () => 4)], { ann: 1 }).ann === 6, 'the plan said 1, the scores say 6: scores win');
ok(eff([sc('Ann', {})], { ann: 9 }).ann === 9, 'nothing scored yet: the plan stands');
ok(eff([run('Ann', 4, 18, () => 4)], { ann: 4 }).ann === 4 && eff([run('Ann', 4, 18, () => 4)], {}).ann === undefined, 'all 18 scored: cannot tell, plan (or nothing) stands');
ok(eff([sc('Ann', { 1: 4, 2: 4, 5: 4, 6: 4 })], { ann: 5 }).ann === 5, 'two runs (a skipped hole): the plan wins when it is one of the starts');
ok(eff([sc('Ann', { 1: 4, 2: 4, 5: 4, 6: 4 })], { ann: 9 }).ann === 9, 'two runs and the plan fits neither: plan kept');
ok(eff([{ player: 'Ann', hole_count: 9, holes: Array(18).fill(4) }], { ann: 3 }).ann === 3, '9-hole cards are left to the plan');

// Turkeys: planned start hole 1, but the group really started on 10 and birdied 10-11-12
const pars = Array(18).fill(4);
const row = { games: ['skins', 'turkeys'], dollar_per_player: 10, game_configs: { turkeys: { dollar_per_player: 2, streak: 3, pars } } };
const cardsA = [run('A', 10, 6, k => (k < 3 ? 3 : 4)), run('B', 10, 6, () => 4)];
let r = E.computeGatheringGamesPayout(row, cardsA, {}, [], { startHoles: { a: 1, b: 1 } });
ok(r.turkeys.count === 1 && r.turkeys.turkeys[0].from === 10, 'a Turkey on 10-12 counts with a stale plan of hole 1');
// birdies on 18, 1, 2 for a group that started on 17 but the plan still says 1: the wrap is honoured
const cardsB = [run('A', 17, 5, k => (k >= 1 && k <= 3 ? 3 : 4)), run('B', 17, 5, () => 4)];
r = E.computeGatheringGamesPayout(row, cardsB, {}, [], { startHoles: { a: 1, b: 1 } });
ok(r.turkeys.count === 1 && r.turkeys.turkeys[0].length === 3, '18-1-2 is one run of 3 because the group started on 17, whatever the plan says');
// back-nine start with no Groups at all (tee times from 10): the old code treated everyone as starting on 1
r = E.computeGatheringGamesPayout(row, [run('A', 10, 6, k => (k < 3 ? 3 : 4)), run('B', 10, 6, () => 4)], {}, []);
ok(r.turkeys.count === 1, 'no Groups published, back-nine start: still found');
// money still adds up
ok(Math.abs(r.payouts.reduce((t, p) => t + p.total, 0) + r.unallocated - r.total_pot) < 1e-9, 'money conserved');
console.log(`effective_start: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
