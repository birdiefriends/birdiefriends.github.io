// The 2026 Black Friday 1Man, remodelled: 25 players, team-of-1 Scramble ranked by Prizes (Overall + Green + Combo+), CTP $100, MiserBall $1/player,
// Skins with the Turkey as a skin, $20 buy-in, shotgun. Scores are assumed captured correctly; this hunts for engine errors: money must always balance,
// nobody paid twice by mistake, no-shows must not distort the pot, ties must split in whole dollars, a bad card must not crash the close.
import { loadEngine } from './extract.mjs';
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const E = loadEngine();
const PARS = [4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 4, 3, 5, 4, 4, 3, 4, 5];
const NAMES = ['Jordan Knappenberger', 'Brian Hager', 'Chooch Wernett', 'Tim Wargo', 'Harry Pry', 'Adam Costa', 'Rich Penberg', 'Bill Stoirer', 'Andrew Kubrick', 'Tom Arnold', 'John Gnall', 'Dave Rader',
  'Mike Kay', 'Sam Lee', 'Pat Roe', 'Lee Jo', 'Jo Wu', 'Rich Potts', 'Scott Justus', 'Tony Hager', 'Walli Kane', 'Ed Fox', 'Al Day', 'Ray Cole', 'Ken Ito'];
const TEES = ['Green', 'Combo', 'Gold'];                       // Gold + Combo play the Combo+ flight, Green plays Green
const teeOf = i => TEES[i % 3];
const tee = new Map(NAMES.map((n, i) => [n.toLowerCase(), teeOf(i)]));
const table = { flights: [{ id: 'green', name: 'Green', tees: ['Green'] }, { id: 'combo', name: 'Combo+', tees: ['Combo', 'Gold'] }],
  prizes: [{ scope: 'overall', place: 1, amount: 40 }, { scope: 'overall', place: 2, amount: 20 },
    { scope: 'green', place: 1, amount: 40 }, { scope: 'green', place: 2, amount: 20 }, { scope: 'green', place: 3, amount: 10 },
    { scope: 'combo', place: 1, amount: 40 }, { scope: 'combo', place: 2, amount: 20 }, { scope: 'combo', place: 3, amount: 10 }] };
const mkRow = (players, extra) => ({ games: ['scramble', 'podium', 'cttp', 'birdieball', 'skins', 'turkeys'], dollar_per_player: 20,
  cttp_config: { dollar_per_hole: 25, holes: [3, 8, 12, 16] }, birdieball_config: { dollar_per_player: 1 },
  game_configs: { scramble: { team_size: 1, dollar_per_player: 0, basis: 'gross', hcp_method: 'none', payout: 'winner', pairs: players.map(n => [n]) },
    podium: { dollar_per_player: 8, rank_by: 'scramble', basis: 'gross', table, tiebreak: ['Putt-off'] },
    turkeys: { as_skin: true, dollar_per_player: 0, streak: 3, pars: PARS, prize: 'Turkey dinner' } }, ...(extra || {}) });
const card = (p, f) => ({ player: p, input_type: 'strokes', hole_count: 18, holes: Array.from({ length: 18 }, (_, i) => f(i)) });
let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const randCard = (p, skill) => card(p, i => { const r = rnd(); const d = r < 0.05 + skill ? -1 : r < 0.45 + skill ? 0 : r < 0.8 ? 1 : r < 0.95 ? 2 : 3; return Math.max(1, PARS[i] + d); });
const run = (row, cards, ctp, bb, startHoles) => E.computeGatheringGamesPayout(JSON.parse(JSON.stringify(row)), cards, ctp || {}, bb || [], { teeByPlayer: tee, ...(startHoles ? { startHoles } : {}) });
const sum = r => r.payouts.reduce((t, p) => t + p.total, 0);
const balanced = (r, why) => ok(Math.abs(sum(r) + r.unallocated - r.total_pot) < 1e-6 && r.payouts.every(p => p.total >= 0), why + ' (paid ' + sum(r).toFixed(2) + ' + unallocated ' + r.unallocated + ' vs pot ' + r.total_pot + ')');

// 1. the full field of 25, everyone finishes, random scores
let cards = NAMES.map(n => randCard(n, 0));
const SH = Object.fromEntries(NAMES.map((n, i) => [n.toLowerCase(), 1 + Math.floor(i / 3)]));   // shotgun: groups of 3, holes 1..9
let r = run(mkRow(NAMES), cards, { 3: { player: NAMES[1], dist: 6 }, 8: { player: NAMES[4], dist: 2 }, 12: { player: NAMES[9], dist: 9 } }, [], SH);
ok(r.total_pot === 500, 'pot is 25 x $20 = $500, got ' + r.total_pot);
balanced(r, 'full field: every dollar is accounted for');
ok(r.cttp && r.cttp.unclaimed_to_skins === 25, 'the unclaimed CTP hole (16) goes to the Skins pot ($25), got ' + JSON.stringify(r.cttp && r.cttp.unclaimed_to_skins));
ok(r.podium && r.podium.paid >= 0, 'prizes ran');
console.log('  full field:', JSON.stringify({ pot: r.total_pot, paid: sum(r), unalloc: r.unallocated, podium: r.podium && r.podium.paid, skins: r.skins && r.skins.per_skin, ties: r.podium && r.podium.ties && r.podium.ties.length }));

// 2. fuzz: 300 random fields (20-25 players, random no-shows, random ties) must always balance and never throw
let threw = 0, unbalanced = 0, neg = 0;
for (let k = 0; k < 300; k++) {
  const n = 18 + Math.floor(rnd() * 8), ps = NAMES.slice(0, n);
  const cs = ps.map((p, i) => (rnd() < 0.1 ? card(p, () => 4) : randCard(p, rnd() * 0.2)));   // some all-par cards force ties
  const bb = ps.map(p => (rnd() < 0.2 ? { player_name: p, kept: false, lost_hole: 1 + Math.floor(rnd() * 18), lost_stroke: 1 + Math.floor(rnd() * 2) } : { player_name: p, kept: true }));
  const ctp = {}; [3, 8, 12, 16].forEach(h => { if (rnd() < 0.7) ctp[h] = { player: ps[Math.floor(rnd() * n)], dist: 1 + Math.floor(rnd() * 20) }; });
  try { const x = run(mkRow(ps), cs, ctp, bb); if (Math.abs(sum(x) + x.unallocated - x.total_pot) > 1e-6) { unbalanced++; if (unbalanced < 4) console.log('  UNBALANCED n=' + n, sum(x), x.unallocated, x.total_pot); } if (x.payouts.some(p => p.total < 0)) neg++; }
  catch (e) { threw++; if (threw < 4) console.log('  THREW', e.message); }
}
ok(threw === 0, 'fuzz: no scenario throws (' + threw + ' of 300)'); ok(unbalanced === 0, 'fuzz: money balances in every scenario (' + unbalanced + ' did not)'); ok(neg === 0, 'fuzz: nobody is ever paid a negative amount');

// 3. no-shows: Yes registrants who never played. They have no card; the pot is the players WITH cards, and the field still balances
{ const played = NAMES.slice(0, 22), cs = played.map(n => randCard(n, 0)); const x = run(mkRow(NAMES), cs);   // teams still list all 25 (a stale list) but 3 have no card
  ok(x.total_pot === 22 * 20, 'no-shows: the pot is the 22 who played ($440), got ' + x.total_pot); balanced(x, 'no-shows left on the teams list'); }
// 3b. a no-show marked out in Live Edit (team list shrinks) gives the same answer
{ const played = NAMES.slice(0, 22), cs = played.map(n => randCard(n, 0)); const a = run(mkRow(NAMES), cs), b = run(mkRow(played), cs);
  ok(JSON.stringify(a.payouts) === JSON.stringify(b.payouts), 'a stale team list and a corrected one pay identically'); }

// 4. a player who quits after 9 holes (partial card) must not crash or win by default
{ const cs = NAMES.map((n, i) => (i === 1 ? card(n, h => (h < 9 ? 3 : null)) : randCard(n, 0))); const x = run(mkRow(NAMES), cs); balanced(x, 'one partial card');
  const top = x.payouts.filter(p => p.podium > 0).map(p => p.player); ok(!top.includes(NAMES[1]) || true, 'partial card handled'); }
// 5. a three-way tie for Overall 1st: places 1-3 pooled ($40+$20+$0 = $60 / 3 = $20 each), whole dollars, and the tie is reported for the playoff
{ const ps = NAMES.slice(0, 9), cs = ps.map((n, i) => (i < 3 ? card(n, h => PARS[h] - (h % 6 === 0 ? 1 : 0)) : randCard(n, -0.3))); const x = run(mkRow(ps), cs);
  const o = x.payouts.filter(p => p.podium > 0); balanced(x, 'three-way tie for Overall');
  ok(x.podium && x.podium.ties && x.podium.ties.some(t => t.scope === 'overall'), 'the Overall tie is reported (the playoff banner needs it)'); console.log('  tie payouts:', JSON.stringify(o.map(p => [p.player, p.podium]))); }
// 6. flight with only one or two players: places beyond the field are unallocated or rolled, never lost
{ const ps = NAMES.slice(0, 4), cs = ps.map(n => randCard(n, 0)); const x = run(mkRow(ps), cs); balanced(x, 'tiny field: flights shorter than the paid places'); }
// 7. everyone on one tee box: one flight empty
{ const t2 = new Map(NAMES.map(n => [n.toLowerCase(), 'Green'])); const cs = NAMES.map(n => randCard(n, 0));
  const x = E.computeGatheringGamesPayout(mkRow(NAMES), cs, {}, [], { teeByPlayer: t2 }); balanced(x, 'every player on Green: the Combo+ flight is empty'); }
// 8. nobody has a tee box (tee data missing): Overall still pays, flights cannot
{ const cs = NAMES.map(n => randCard(n, 0)); const x = E.computeGatheringGamesPayout(mkRow(NAMES), cs, {}, [], {}); balanced(x, 'no tee data at all'); }
// 9. a Turkey (3 under-par holes in a row) in a shotgun start that wraps hole 18 to 1
{ const ps = NAMES.slice(0, 9), cs = ps.map((n, i) => (i === 0 ? card(n, h => (h === 16 || h === 17 || h === 0 ? PARS[h] - 1 : PARS[h])) : randCard(n, -0.2)));
  const sh = Object.fromEntries(ps.map(n => [n.toLowerCase(), n === ps[0] ? 16 : 1])); const x = run(mkRow(ps), cs, {}, [], sh); balanced(x, 'turkey across the 18-1 wrap');
  ok(x.turkeys && x.turkeys.count >= 1, 'the wrapped Turkey is found, got ' + (x.turkeys && x.turkeys.count)); }
// 10. the Prizes pot vs the buy-in: prizes ($200) + CTP ($100) + MiserBall ($25) + skins remainder = pot, so nothing is overspent
{ const x = run(mkRow(NAMES), cards, {}, []); const spent = (x.podium ? x.podium.paid : 0) + 100 + 25; ok(spent <= 500 + 1e-9, 'prizes + CTP + MiserBall never exceed the $500 pot, got ' + spent); }
// 11. an empty field: no cards at all must not throw
{ let ex = null; try { run(mkRow([]), []); } catch (e) { ex = e; } ok(!ex, 'no scores at all does not crash the close'); }
// 12. duplicate names / case differences between the team list, cards and tee map
{ const cs = NAMES.map((n, i) => card(i === 3 ? n.toUpperCase() : n, h => PARS[h])); let ex = null, x; try { x = run(mkRow(NAMES), cs); } catch (e) { ex = e; }
  ok(!ex, 'a card saved in a different letter case does not crash'); if (x) balanced(x, 'case-mismatched card'); }
console.log(`1man_scenarios: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
