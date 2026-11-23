// Prizes: overall and/or flights, several places (Individual Low Score, v1.63.0). Ties share the places they cover; a player can win overall AND in a flight.
import { loadEngine } from './extract.mjs';
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const E = loadEngine(); const ALL = n => Array(18).fill(n);
const mk = (player, per) => ({ player, holes: ALL(per), hole_count: 18 });
const split = (player, a, b) => ({ player, holes: [...Array(9).fill(a), ...Array(9).fill(b)], hole_count: 18 });
const cards = [mk('A', 4), mk('B', 5), mk('C', 4), split('D', 4, 5), split('E', 5, 4), mk('F', 5.5)];   // A72 B90 C72 D81 E81 F99
const tee = new Map([['a', 'Green'], ['b', 'Green'], ['c', 'Combo'], ['d', 'Combo'], ['e', 'Gold'], ['f', 'Combo']]);
const flights = [{ id: 'green', name: 'Green', tees: ['Green'] }, { id: 'combo', name: 'Combo+', tees: ['Combo', 'Gold'] }];
const prizes = [{ scope: 'overall', place: 1, amount: 50 }, { scope: 'green', place: 1, amount: 20 }, { scope: 'green', place: 2, pct: 5 }, { scope: 'combo', place: 1, amount: 30 }, { scope: 'combo', place: 2, amount: 10 }];
const run = (podium, c = cards, t = tee, dpp = 20) => E.computeRoundPayout({ payout: { entry_per_player: dpp }, addons: [{ id: 'lowscore', entity: 'individual', dollar_per_player: dpp, basis: 'gross', ...(podium ? { podium } : {}) }] }, { scorecards: c, teeByPlayer: t });
const by = r => Object.fromEntries(r.payouts.map(p => [p.player, p.lowscore || 0]));

let r = run({ flights, prizes }), b = by(r);
ok(r.lowscore.pot === 120 && r.lowscore.podium === true, '6 players x $20 = a $120 pot, in prize mode');
ok(b.A === 45 && b.C === 55, 'A and C tie for low overall and split the 1st+2nd places (only 1st is priced: $25 each); A also wins Green $20, C also wins Combo+ $30');
ok(b.B === 6, 'Green 2nd was 5% of the $120 pot = $6');
ok(b.D === 5 && b.E === 5, 'D and E tie for 2nd in Combo+ and share the $10 for the places they cover');
ok(b.F === 0, 'F wins nothing');
ok(r.lowscore.paid === 116 && r.unallocated === 4, '$116 paid; the $4 left over (2 x 2 odd dollars) is reported, not moved');
ok(r.lowscore.prizes.find(x => x.scope === 'combo' && x.place === 2).winners.length === 2, 'the result lists who took each prize');
ok(r.lowscore.scopes.map(x => x.id).join() === 'overall,green,combo', 'overall, then each flight');

// no podium = unchanged winner-take-all behavior
r = run(null, [mk('A', 4), mk('B', 5), mk('C', 6)], tee); b = by(r);
ok(b.A === 60 && !r.lowscore.podium, 'without prizes the lowest total still takes the whole pot');

// overall only, one prize, a tie for the only place splits it
r = run({ flights: [], prizes: [{ scope: 'overall', place: 1, pct: 100 }] }, [mk('A', 4), mk('B', 4), mk('C', 6)], new Map()); b = by(r);
ok(b.A === 30 && b.B === 30 && b.C === 0, 'a tie for the one paid place splits it');

// the table asks for more than the pot: every prize shrinks the same way, and it says so
r = run({ flights: [], prizes: [{ scope: 'overall', place: 1, amount: 100 }, { scope: 'overall', place: 2, amount: 100 }] }, [mk('A', 4), mk('B', 5)], new Map(), 20); b = by(r);
ok(r.lowscore.scaled === true && b.A === 20 && b.B === 20, 'prizes over the pot are scaled to fit and flagged');

// a flight nobody finished in: its money goes back to everyone, nothing is lost
const unfinished = [mk('A', 4), { player: 'B', holes: Array(18).fill(null).map((_, i) => (i < 5 ? 5 : null)), hole_count: 18 }];
r = run({ flights: [{ id: 'g', name: 'G', tees: ['Green'] }], prizes: [{ scope: 'overall', place: 1, amount: 20 }, { scope: 'g', place: 1, amount: 20 }] }, unfinished, new Map([['b', 'Green'], ['a', 'Blue']]), 20);
b = by(r);
ok(b.A === 20 && r.lowscore.given_back_each === 10, 'a prize nobody can take goes back to the players (here $20 / 2)');
ok(r.lowscore.unflighted.includes('A'), 'a player with no flight is named (they can still win Overall)');

// player lists work as a flight too
r = run({ flights: [{ id: 'x', name: 'X', players: ['B', 'F'] }], prizes: [{ scope: 'x', place: 1, amount: 40 }] }, cards, new Map()); b = by(r);
ok(b.B === 40, 'a flight can be a list of names');

// validation (the same function the Worker runs)
const V = o => E.validateGameConfig('lowscore', { dollar_per_player: 20, podium: o });
ok(V({ flights, prizes }).ok, 'a good table is accepted');
ok(!V({ flights, prizes: [{ scope: 'nope', place: 1, amount: 5 }] }).ok, 'a prize for a flight that does not exist is refused');
ok(!V({ flights, prizes: [{ scope: 'overall', place: 1, amount: 5 }, { scope: 'overall', place: 1, amount: 5 }] }).ok, 'the same place twice in one scope is refused');
ok(!V({ flights: [{ id: 'g', name: 'G' }], prizes: [{ scope: 'g', place: 1, amount: 5 }] }).ok, 'a flight with no tee or player is refused');
ok(!V({ flights, prizes: [{ scope: 'overall', place: 1 }] }).ok, 'a prize with no amount is refused');
ok(E.cleanGameConfig('lowscore', { dollar_per_player: 20, podium: { flights, prizes } }).podium.prizes.length === 5, 'the cleaned config keeps the table');
console.log(`${pass} passed, ${fail} failed`); if (fail) process.exit(1);
