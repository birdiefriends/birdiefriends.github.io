// Prizes (v1.63.0): a pot-level podium for ANY game: Overall and/or flights, several places, ranked by the round totals or a game's standings. Ties share the places they cover; a player can win overall AND in a flight.
import { loadEngine } from './extract.mjs';
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const E = loadEngine(); const ALL = n => Array(18).fill(n);
const mk = (player, per) => ({ player, holes: ALL(per), hole_count: 18 });
const split = (player, a, b) => ({ player, holes: [...Array(9).fill(a), ...Array(9).fill(b)], hole_count: 18 });
const cards = [mk('A', 4), mk('B', 5), mk('C', 4), split('D', 4, 5), split('E', 5, 4), mk('F', 5.5)];   // A72 B90 C72 D81 E81 F99
const tee = new Map([['a', 'Green'], ['b', 'Green'], ['c', 'Combo'], ['d', 'Combo'], ['e', 'Gold'], ['f', 'Combo']]);
const flights = [{ id: 'green', name: 'Green', tees: ['Green'] }, { id: 'combo', name: 'Combo+', tees: ['Combo', 'Gold'] }];
const prizes = [{ scope: 'overall', place: 1, amount: 50 }, { scope: 'green', place: 1, amount: 20 }, { scope: 'green', place: 2, pct: 5 }, { scope: 'combo', place: 1, amount: 30 }, { scope: 'combo', place: 2, amount: 10 }];
const run = (table, c = cards, t = tee, dpp = 20, extra = [], rank = 'round') => E.computeRoundPayout({ payout: { entry_per_player: dpp }, addons: [...extra, { id: 'podium', entity: 'individual', dollar_per_player: dpp, basis: 'gross', rank_by: rank, table }] }, { scorecards: c, teeByPlayer: t });
const by = r => Object.fromEntries(r.payouts.map(p => [p.player, p.podium || 0]));

let r = run({ flights, prizes }), b = by(r);
ok(r.podium.pot === 120 && r.podium.ranked_by === 'round', '6 players x $20 = a $120 pot, in prize mode');
ok(b.A === 45 && b.C === 55, 'A and C tie for low overall and split the 1st+2nd places (only 1st is priced: $25 each); A also wins Green $20, C also wins Combo+ $30');
ok(b.B === 6, 'Green 2nd was 5% of the $120 pot = $6');
ok(b.D === 5 && b.E === 5, 'D and E tie for 2nd in Combo+ and share the $10 for the places they cover');
ok(b.F === 0, 'F wins nothing');
ok(r.podium.paid === 116 && r.unallocated === 4, '$116 paid; the $4 left over (2 x 2 odd dollars) is reported, not moved');
ok(r.podium.prizes.find(x => x.scope === 'combo' && x.place === 2).winners.length === 2, 'the result lists who took each prize');
ok(r.podium.scopes.map(x => x.id).join() === 'overall,green,combo', 'overall, then each flight');

// overall only, one prize, a tie for the only place splits it
r = run({ flights: [], prizes: [{ scope: 'overall', place: 1, pct: 100 }] }, [mk('A', 4), mk('B', 4), mk('C', 6)], new Map()); b = by(r);
ok(b.A === 30 && b.B === 30 && b.C === 0, 'a tie for the one paid place splits it');

// the table asks for more than the pot: every prize shrinks the same way, and it says so
r = run({ flights: [], prizes: [{ scope: 'overall', place: 1, amount: 100 }, { scope: 'overall', place: 2, amount: 100 }] }, [mk('A', 4), mk('B', 5)], new Map(), 20); b = by(r);
ok(r.podium.scaled === true && b.A === 20 && b.B === 20, 'prizes over the pot are scaled to fit and flagged');

// a flight nobody finished in: its money goes back to everyone, nothing is lost
const unfinished = [mk('A', 4), { player: 'B', holes: Array(18).fill(null).map((_, i) => (i < 5 ? 5 : null)), hole_count: 18 }];
r = run({ flights: [{ id: 'g', name: 'G', tees: ['Green'] }], prizes: [{ scope: 'overall', place: 1, amount: 20 }, { scope: 'g', place: 1, amount: 20 }] }, unfinished, new Map([['b', 'Green'], ['a', 'Blue']]), 20);
b = by(r);
ok(b.A === 20 && r.podium.given_back_each === 10, 'a prize nobody can take goes back to the players (here $20 / 2)');
ok(r.podium.unflighted.includes('A'), 'a player with no flight is named (they can still win Overall)');

// player lists work as a flight too
r = run({ flights: [{ id: 'x', name: 'X', players: ['B', 'F'] }], prizes: [{ scope: 'x', place: 1, amount: 40 }] }, cards, new Map()); b = by(r);
ok(b.B === 40, 'a flight can be a list of names');

// validation (the same function the Worker runs)
const V = o => E.validateGameConfig('podium', { dollar_per_player: 20, table: o });
ok(V({ flights, prizes }).ok, 'a good table is accepted');
ok(!V({ flights, prizes: [{ scope: 'nope', place: 1, amount: 5 }] }).ok, 'a prize for a flight that does not exist is refused');
ok(!V({ flights, prizes: [{ scope: 'overall', place: 1, amount: 5 }, { scope: 'overall', place: 1, amount: 5 }] }).ok, 'the same place twice in one scope is refused');
ok(!V({ flights: [{ id: 'g', name: 'G' }], prizes: [{ scope: 'g', place: 1, amount: 5 }] }).ok, 'a flight with no tee or player is refused');
ok(!V({ flights, prizes: [{ scope: 'overall', place: 1 }] }).ok, 'a prize with no amount is refused');
ok(E.cleanGameConfig('podium', { dollar_per_player: 20, table: { flights, prizes } }).table.prizes.length === 5, 'the cleaned config keeps the table');

// it ranks another game's standings: a one-man Scramble (teams of 1) paying no pot of its own; Prizes pays by the Scramble's order
{ const sc = { id: 'scramble', entity: 'pair', dollar_per_player: 0, team_size: 1, pairs: cards.map(c => [c.player]), basis: 'gross', hcp_method: 'none' };
  r = run({ flights, prizes }, cards, tee, 20, [sc], 'scramble'); b = by(r);
  ok(r.podium.ranked_by === 'scramble' && b.A === 45 && b.C === 55 && b.B === 6, 'ranked by a team-of-1 Scramble: the same result as the round totals'); }
// auto picks the first ranked game on the event, else the round totals
{ const sc = { id: 'scramble', entity: 'pair', dollar_per_player: 0, team_size: 1, pairs: cards.map(c => [c.player]), basis: 'gross', hcp_method: 'none' };
  ok(run({ flights, prizes }, cards, tee, 20, [sc], 'auto').podium.ranked_by === 'scramble' && run({ flights, prizes }, cards, tee, 20, [], 'auto').podium.ranked_by === 'round', 'automatic ranks by the Scramble when there is one, else the round totals'); }
// a team of 2 ranks as one entry; Overall pays the team; flights only take a team whose members are all in that flight
{ const sc = { id: 'scramble', entity: 'pair', dollar_per_player: 0, team_size: 2, pairs: [['A', 'B'], ['C', 'D']], basis: 'gross', hcp_method: 'none' };
  r = run({ flights: [{ id: 'green', name: 'Green', tees: ['Green'] }], prizes: [{ scope: 'overall', place: 1, amount: 40 }, { scope: 'green', place: 1, amount: 20 }] }, [mk('A', 4), mk('B', 4), mk('C', 5), mk('D', 5)], new Map([['a', 'Green'], ['b', 'Green'], ['c', 'Blue'], ['d', 'Blue']]), 20, [sc], 'scramble');
  const tm = r.payouts.find(p => p.player === 'A & B');
  ok(tm && tm.podium === 60 && r.podium.scopes.find(x => x.id === 'green').field === 1, 'a team wins Overall and its flight as one entry (A & B $60); a flight needs the whole team in it'); }
// ties in the payout: shared places, whole dollars, odd dollars reported not lost
{ const names = 'ABCDEFGHIJ'.split(''), P3 = [{ scope: 'overall', place: 1, amount: 50 }, { scope: 'overall', place: 2, amount: 30 }, { scope: 'overall', place: 3, amount: 20 }];
  const go = sc => { const cs = names.map((n, i) => mk(n, sc[i])); const r = E.computeRoundPayout({ payout: { entry_per_player: 10 }, addons: [{ id: 'podium', entity: 'individual', dollar_per_player: 10, basis: 'gross', rank_by: 'round', table: { flights: [], prizes: P3 } }] }, { scorecards: cs }); return { by: Object.fromEntries(r.payouts.map(p => [p.player, p.podium || 0])), sum: r.payouts.reduce((a, p) => a + (p.total || 0), 0), un: r.unallocated }; };
  let t = go([4, 4, 4, 5, 5, 5, 5, 5, 5, 5]); ok(t.by.A === 33 && t.by.B === 33 && t.by.C === 33 && t.by.D === 0 && t.un === 1 && t.sum === 99, 'three-way tie for 1st: $33 each, the odd $1 is reported as unallocated, nothing invented');
  t = go([4, 4, 4, 4, 6, 6, 6, 6, 6, 6]); ok(t.by.A === 25 && t.by.D === 25 && t.by.E === 0 && t.sum === 100, 'four-way tie for 1st: the $100 of places 1-3 is shared four ways');
  t = go([4, 5, 5, 6, 6, 6, 6, 6, 6, 6]); ok(t.by.A === 50 && t.by.B === 25 && t.by.C === 25, 'a tie for 2nd splits 2nd and 3rd');
  t = go(Array(10).fill(4)); ok(Object.values(t.by).every(v => v === 10), 'everyone tied: each gets back the buy-in'); }
console.log(`${pass} passed, ${fail} failed`); if (fail) process.exit(1);
