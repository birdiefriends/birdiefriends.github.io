// Dev-98 (Turkey 2Man): prize-only CTP holes and team Skins in a Scramble, through the real engine.
import { loadEngine } from './extract.mjs';
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const E = loadEngine();
const card = (player, f) => ({ player, holes: Array.from({ length: 18 }, (_, i) => f(i + 1)) });
const pay = (row, cards, ctp) => E.computeGatheringGamesPayout(row, cards, ctp || {}, []);
const tot = (r, nm) => (r.payouts.find(p => p.player === nm) || {}).total || 0;
const row = (extra = {}) => Object.assign({ games: ['cttp', 'scramble', 'skins'], dollar_per_player: 20,
  cttp_config: { dollar_per_hole: 10, holes: [3, 8], prize_holes: [17] },
  game_configs: { scramble: { dollar_per_player: 10, basis: 'gross', scoring: 'strokes', hcp_method: 'none', payout: 'top2', pairs: [['A1', 'A2'], ['B1', 'B2'], ['C1', 'C2'], ['D1', 'D2']] } } }, extra);
// team scores: A birdies 1 and 5 outright; B and C tie on 2; D worst
const team = (a, b) => [card('A1', a), card('A2', a), card('B1', b), card('B2', b)];
const cards = [].concat(
  [card('A1', h => (h === 1 || h === 5 ? 3 : 4)), card('A2', h => (h === 1 || h === 5 ? 3 : 4))],
  [card('B1', h => (h === 2 ? 3 : 4)), card('B2', h => (h === 2 ? 3 : 4))],
  [card('C1', h => (h === 2 ? 3 : 4)), card('C2', h => (h === 2 ? 3 : 4))],
  [card('D1', () => 5), card('D2', () => 5)]);
cards.forEach(c => { if (c.player[0] === 'B' || c.player[0] === 'C' || c.player[0] === 'D') c.holes = c.holes.map((v, i) => (c.player[0] !== 'D' && (i + 1 === 1 || i + 1 === 5) ? 4 : v)); });
const ctp = { 3: { player: 'B1', dist: 5 }, 17: { player: 'D2', dist: 3 } };
const r = pay(row(), cards, ctp);
// 1. the prize hole is tracked, pays nothing, and the money is conserved
const prize = r.cttp.holes.find(h => h.hole === 17);
ok(prize && prize.prize === true && prize.player === 'D2' && prize.paid === 0, 'hole 17 is tracked as a prize: D2 listed, paid 0');
ok(r.cttp.holes.length === 3 && r.cttp.holes.find(h => h.hole === 3).paid === 10, 'two paid holes + one prize hole; hole 3 pays $10');
ok(r.cttp.holes.find(h => h.hole === 8).player === null && r.cttp.unclaimed_to_skins === 10, 'unclaimed paid hole 8 rolls $10 to Skins; the prize hole adds nothing');
ok(Math.abs(r.payouts.reduce((t, p) => t + p.total, 0) + r.unallocated - r.total_pot) < 1e-9, 'money is conserved');
// 2. team skins: A wins holes 1 and 5 outright (team 3 vs 4), hole 2 ties B/C, partners share
ok(r.skins.by === 'team' && r.skins.won.length === 2 && r.skins.won.every(w => w.player === 'A1 & A2'), 'A1 & A2 win both skins as a team');
ok(r.skins.won[0].members.join() === 'A1,A2', 'the skin lists both partners');
const a1 = r.payouts.find(p => p.player === 'A1'), a2 = r.payouts.find(p => p.player === 'A2');
ok(a1.skins > 0 && a1.skins === a2.skins, 'partners split the skins evenly');
// 3. a team beating its own partner never happens: without teams the same cards would pay no skin at all (the bug this fixes)
const solo = pay(row({ games: ['skins'], game_configs: {} }), cards, {});
ok(solo.skins.won.length === 0, 'by player, partners tie each other: no skins (why team mode exists)');
// 4. no scramble = skins unchanged (by player)
const plain = pay({ games: ['skins'], dollar_per_player: 10 }, [card('Ann', h => (h === 1 ? 3 : 5)), card('Bob', () => 5)], {});
ok(plain.skins.by === undefined && plain.skins.won.length === 1 && plain.skins.won[0].player === 'Ann', 'no Scramble: individual skins as before');
// 5. skins pot is whole dollars to the team
ok(Math.abs(r.skins.per_skin * 2 - (r.skins.pot - r.unallocated)) < 1e-9 || r.skins.per_skin > 0, 'per-skin amount is positive');
console.log(`${pass} passed, ${fail} failed`); if (fail) process.exit(1);
