// Dev-98 — BF Cup games and money (spec §13.15): the Cup's scores become the engine's cards, a round's games are a Round Config, the money is the same pure engine.
// Real Saturday record (pars, matches); Saturday scores and a Sunday singles round are made up.
import fs from 'fs'; import { createRequire } from 'module'; import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const E = require('../bf_engine.js');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m + ' (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')');
const pars = [4, 4, 3, 4, 5, 4, 5, 3, 4, 3, 5, 4, 4, 4, 3, 4, 5, 3];
const A = ['Jake Knappenberger', 'Dave Sherwin', 'Mohamed Walli', 'Chooch Wernett', 'BJ Kolonia', 'Brian Hager', 'Adam Costa', 'Lou Strohl'];
const B = ['Nate Stettler', 'Jordan Knappenberger', 'Bill Steirer', 'Tom Stitt', 'Evan Lindermuth', 'Jeff Rapp', 'Andrew Kabrick', 'Harry Pry'];
const sat = { key: '2026-bfcup-day1', name: '2026 BFCup - Day1', segments: [{ key: 'bb', format: 'bestball', from: 1, to: 9 }, { key: 'as', format: 'altshot', from: 10, to: 18 }], matches: [
  { key: 'm1', sides: [{ side: 'A', players: ['Brian Hager', 'BJ Kolonia'] }, { side: 'B', players: ['Tom Stitt', 'Andrew Kabrick'] }] },
  { key: 'm2', sides: [{ side: 'A', players: ['Mohamed Walli', 'Jake Knappenberger'] }, { side: 'B', players: ['Bill Steirer', 'Jeff Rapp'] }] },
  { key: 'm3', sides: [{ side: 'A', players: ['Dave Sherwin', 'Chooch Wernett'] }, { side: 'B', players: ['Evan Lindermuth', 'Harry Pry'] }] },
  { key: 'm4', sides: [{ side: 'A', players: ['Adam Costa', 'Lou Strohl'] }, { side: 'B', players: ['Nate Stettler', 'Jordan Knappenberger'] }] }] };
const sun = { key: '2026-bfcup-day2', name: '2026 BFCup - Day2', segments: [{ key: 's', format: 'singles', from: 1, to: 18 }], matches: A.map((a, i) => ({ key: 's' + (i + 1), sides: [{ side: 'A', players: [a] }, { side: 'B', players: [B[i]] }] })) };
const base = () => ({ sides: [{ key: 'A', name: 'Team Jake', players: A }, { key: 'B', name: 'Team Nate', players: B }], handicap: { pars }, rounds: [JSON.parse(JSON.stringify(sat)), JSON.parse(JSON.stringify(sun))], scores: {}, ctp: {} });
// Saturday scores: everyone a 5 on holes 1-9 (fourball); the pair's one score on 10-18 sits under the first player.
function satScores(cfg) {
  const s = {};
  sat.matches.forEach(m => { const h = {}; for (let i = 1; i <= 9; i++) { h[i] = {}; m.sides.forEach(sd => sd.players.forEach(p => { h[i][p] = 5; })); }
    for (let i = 10; i <= 18; i++) { h[i] = {}; m.sides.forEach(sd => { h[i][sd.players[0]] = 4; }); } s[m.key] = { h }; });
  cfg.scores[sat.key] = s;
}
// Sunday: gross 5 everywhere, then four lone lows (a skin each), a tie, and a pick-up.
function sunScores(cfg) {
  const s = {};
  sun.matches.forEach(m => { const h = {}; for (let i = 1; i <= 18; i++) { h[i] = {}; m.sides.forEach(sd => sd.players.forEach(p => { h[i][p] = 5; })); } s[m.key] = { h }; });
  const set = (hole, name, v) => { const m = sun.matches.find(x => x.sides.some(sd => sd.players[0] === name)); s[m.key].h[hole][name] = v; };
  set(1, 'Brian Hager', 3); set(2, 'Harry Pry', 3); set(3, 'Lou Strohl', 3); set(4, 'Jordan Knappenberger', 3);   // four skins
  set(5, 'Dave Sherwin', 3); set(5, 'Bill Steirer', 3);                                                              // a tie: no skin
  set(6, 'Mohamed Walli', 0);                                                                                       // a pick-up is no score, so nobody wins hole 6 outright
  cfg.scores[sun.key] = s;
}
eq(E.cupParThrees(base()), [3, 8, 10, 15, 18], 'the par 3s come from the Cup\'s pars');
// --- cards
let cfg = base(); satScores(cfg); cfg.scores[sat.key].m1.h[2]['BJ Kolonia'] = 0;
let cards = E.cupScorecards(cfg, sat.key);
ok(cards.length === 16, 'one card for each of the 16 players of Saturday');
const brian = cards.find(c => c.player === 'Brian Hager');
eq(brian.holes.slice(0, 9), [5, 5, 5, 5, 5, 5, 5, 5, 5], 'fourball holes are each player\'s own gross');
ok(brian.holes.slice(9).every(v => v === null), 'foursomes holes (one score per pair) are no individual score');
ok(cards.find(c => c.player === 'BJ Kolonia').holes[1] === null, 'a pick-up (0) is no score');
// --- Saturday: CTP only, $5 each = $80 pot, $16 a hole on the five par 3s
cfg = base(); satScores(cfg);
cfg.rounds[0].games = { entry_per_player: 5, addons: [{ id: 'cttp', dollar_per_hole: 16 }] };
cfg.ctp[sat.key] = { 3: { player: 'Brian Hager' }, 8: { player: 'Tom Stitt', dist: '4ft' }, 10: { player: 'Adam Costa' }, 15: { player: 'Jordan Knappenberger' } };
eq(E.cupGamesProblems(cfg, sat.key), [], 'CTP only on Saturday is a valid set-up');
let sm = E.cupRoundMoney(cfg, sat.key), r = sm.result;
ok(r.total_pot === 80 && r.players_count === 16, 'the pot is $5 x 16 players = $80');
ok(r.cttp.holes.length === 5 && r.cttp.per_hole === 16, 'five CTP holes at $16 (the default holes are the par 3s)');
ok(r.cttp.unclaimed_to_skins === 16, 'hole 18 unclaimed: $16');
const tot = n => r.payouts.find(p => p.player === n).total;
ok(tot('Brian Hager') === 17 && tot('Tom Stitt') === 17 && tot('Adam Costa') === 17 && tot('Jordan Knappenberger') === 17, 'four CTP winners: $16 + $1 given back');
ok(tot('Nate Stettler') === 1, 'everyone else gets the unclaimed $16 back, $1 each (no Skins on Saturday to take it)');
ok(r.payouts.reduce((a, p) => a + p.total, 0) + r.unallocated === 80, 'every dollar of the pot is accounted for');
// --- what a host cannot configure
const prob = (mut) => { const c = base(); satScores(c); c.rounds[0].games = { entry_per_player: 5, addons: [{ id: 'cttp', dollar_per_hole: 16 }] }; mut(c.rounds[0].games); return E.cupGamesProblems(c, sat.key); };
ok(prob(g => g.addons.push({ id: 'skins', basis: 'gross' })).some(p => /Foursomes records one score per pair/.test(p)), 'Skins is refused on a round with Foursomes, with the reason');
ok(prob(g => g.addons.push({ id: 'birdiepay', dollar_per_birdie: 2 })).some(p => /Birdie Payouts needs every player/.test(p)), 'Birdie Payouts is refused the same way');
ok(prob(g => g.addons.push({ id: 'hilo' })).some(p => /not offered on a Cup round/.test(p)), 'a game outside the Cup list is refused');
ok(prob(g => g.addons.push({ id: 'cttp', dollar_per_hole: 1 })).some(p => /twice/.test(p)), 'the same game twice is refused');
ok(prob(g => { g.entry_per_player = 4; }).some(p => /more than the \$64\.00 pot/.test(p)), 'CTP $80 against a $64 pot is caught by the same pot-fit guard the Gatherings use');
ok(prob(g => { g.entry_per_player = -1; }).some(p => /Entry per player/.test(p)), 'a negative entry is refused');
ok(E.cupGamesProblems({ rounds: [{ key: 'x' }] }, 'x').length === 0 && E.cupRoundMoney({ rounds: [{ key: 'x' }] }, 'x') === null, 'a round with no games has no money and no problems');
// --- Sunday: CTP + gross skins on singles; $15 each = $240 pot
sunScores(cfg);
cfg.rounds[1].games = { entry_per_player: 15, addons: [{ id: 'cttp', dollar_per_hole: 16 }, { id: 'skins', basis: 'gross' }] };
cfg.ctp[sun.key] = { 3: { player: 'Dave Sherwin' }, 8: { player: 'Bill Steirer' }, 10: { player: 'Lou Strohl' }, 15: { player: 'Evan Lindermuth' }, 18: { player: 'Jake Knappenberger' } };
eq(E.cupGamesProblems(cfg, sun.key), [], 'CTP + skins on singles is valid');
const su = E.cupRoundMoney(cfg, sun.key).result; const st = n => su.payouts.find(p => p.player === n).total;
ok(su.total_pot === 240 && su.cttp.holes.every(h => h.paid === 16), 'Sunday pot $240, five CTPs at $16');
eq(su.skins.won.map(w => w.hole + ':' + w.player), ['1:Brian Hager', '2:Harry Pry', '3:Lou Strohl', '4:Jordan Knappenberger'], 'four skins: holes 1-4; the hole 5 tie and the hole 6 pick-up win nothing');
ok(su.skins.pot === 160 && su.skins.per_skin === 40, 'skins pot is the $160 left after CTP: $40 a skin');
ok(st('Brian Hager') === 40 && st('Lou Strohl') === 56 && st('Dave Sherwin') === 16 && st('Nate Stettler') === 0, 'payouts: skin $40, skin + CTP $56, CTP $16, nothing');
ok(su.payouts.reduce((a, p) => a + p.total, 0) + su.unallocated === 240, 'Sunday: every dollar accounted for');
// --- the weekend
const mv = E.cupMoneyView(cfg);
ok(mv.rounds.length === 2 && mv.buyIn === 20, 'two rounds with games; the weekend buy-in is $5 + $15 = $20');
const wk = n => mv.players.find(p => p.player === n);
ok(wk('Brian Hager').won === 57 && wk('Brian Hager').paid === 20 && wk('Brian Hager').net === 37, 'Brian: $17 Saturday + $40 Sunday = $57, paid $20, up $37');
ok(wk('Nate Stettler').won === 1 && wk('Nate Stettler').net === -19, 'Nate: $1 back, paid $20, down $19');
ok(mv.players.reduce((a, p) => a + p.won, 0) === 320, 'the weekend pays out all $320');
// --- a closed round is frozen: later score edits do not change it
cfg.rounds[1].payout = JSON.parse(JSON.stringify(su));
cfg.scores[sun.key].s6.h[1]['Brian Hager'] = 5;
ok(E.cupMoneyView(cfg).rounds[1].frozen === true && E.cupMoneyView(cfg).players.find(p => p.player === 'Brian Hager').won === 57, 'a closed round keeps its frozen payout');
ok(E.cupRoundMoney(cfg, sun.key).result.skins.won.every(w => w.player !== 'Brian Hager'), 'while the live figure moves with the scores (reopening recalculates)');
console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
