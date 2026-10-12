// Dev-93 — Low Score: an individual game over a scoring period (whole round, Front / Back, Front / Back / Total, 6 / 6 / 6).
import { loadEngine } from './extract.mjs';
let pass = 0, fail = 0;
const eq = (a, b, m) => { const ok = JSON.stringify(a) === JSON.stringify(b); ok ? pass++ : fail++; if (!ok) console.log('FAIL', m, '\n  got', JSON.stringify(a), '\n  exp', JSON.stringify(b)); };
const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const E = loadEngine();
const A = f => Array.from({ length: 18 }, (_, i) => f(i));
const card = (player, holes, extra = {}) => ({ player, holes, ...extra });
const cfg = (ls, dpp = 15, games = ['lowscore']) => ({ games, dollar_per_player: dpp, game_configs: { lowscore: { dollar_per_player: dpp, basis: 'gross', ...ls } } });
const pay = (row, cards) => E.computeGatheringGamesPayout(row, cards, {}, []);
const tot = r => r.payouts.reduce((a, p) => a + p.total, 0) + r.unallocated;
const by = r => Object.fromEntries(r.payouts.map(p => [p.player, p.total]).sort((a, b) => a[0].localeCompare(b[0])));
const three = [card('Ann', A(() => 4)), card('Bob', A(() => 5)), card('Cy', A(() => 6))];

// whole round
let r = pay(cfg({}), three);
eq(by(r), { Ann: 45, Bob: 0, Cy: 0 }, 'round: the lowest total takes the whole pot');
ok(r.lowscore.period === 'round' && r.lowscore.standings[0].player === 'Ann' && r.lowscore.standings[0].place === 1, 'round: standings ranked, Ann first');
eq(tot(r), 45, 'round: every dollar accounted for');
r = pay(cfg({}), [card('Ann', A(() => 4)), card('Bob', A(() => 4)), card('Cy', A(() => 6))]);
eq(by(r), { Ann: 15, Bob: 15, Cy: 15 }, 'round: no blood, a tie for low is a push and every ante comes back'); ok(r.lowscore.push === true && r.lowscore.winners.length === 0, 'round: the result says push');
eq(tot(r), 45, 'round tie: accounted for');
r = pay(cfg({}), [card('Ann', A(() => 4)), card('Bob', A(i => i < 17 ? 3 : null)), card('Cy', A(() => 6))]);
eq(by(r).Bob, 0, 'round: a player missing a hole cannot win'); ok(by(r).Ann === 45, 'round: the finisher takes it');
r = pay(cfg({}), [card('Ann', A(i => i < 5 ? 4 : null)), card('Bob', A(i => i < 5 ? 4 : null))]);
ok(r.payouts.every(p => p.total === 15), 'round: nobody finished, everyone gets the ante back');

// periods
r = pay(cfg({ period: 'fbt' }), [card('Ann', A(i => i < 9 ? 4 : 6)), card('Bob', A(i => i < 9 ? 6 : 4)), card('Cy', A(() => 5))]);
eq(r.lowscore.segments.segments.map(x => [x.key, x.status, x.winner && x.winner[0]]), [['front', 'won', 'Ann'], ['back', 'won', 'Bob'], ['total', 'push', null]], 'fbt: front Ann, back Bob, total tied so a push');
eq(by(r), { Ann: 20, Bob: 20, Cy: 5 }, 'fbt: $15 ante is $5 a period; pots $15; the push returns $5 each');
eq(tot(r), 45, 'fbt: every dollar accounted for');
r = pay(cfg({ period: 'front_back' }, 20), [card('Ann', A(i => i < 9 ? 3 : 6)), card('Bob', A(i => i < 9 ? 5 : 4)), card('Cy', A(() => 5))]);
eq(r.lowscore.segments.segments.map(x => x.key), ['front', 'back'], 'front/back: two periods');
eq(by(r), { Ann: 30, Bob: 30, Cy: 0 }, 'front/back: $10 a period, $30 pots, each winner takes one');
r = pay(cfg({ period: 'sixes' }, 30), [card('Ann', A(i => i < 6 ? 3 : 5)), card('Bob', A(i => i >= 6 && i < 12 ? 3 : 5)), card('Cy', A(i => i >= 12 ? 3 : 5))]);
eq(r.lowscore.segments.segments.map(x => x.winner && x.winner[0]), ['Ann', 'Bob', 'Cy'], '6/6/6: a different winner in each six');
eq(by(r), { Ann: 30, Bob: 30, Cy: 30 }, '6/6/6: $10 a period, $30 pots'); eq(tot(r), 90, '6/6/6: accounted for');
r = pay(cfg({ period: 'fbt' }), [card('Ann', A(i => i < 9 ? 4 : null)), card('Bob', A(i => i < 9 ? 5 : null)), card('Cy', A(i => i < 9 ? 6 : null))]);
eq(r.lowscore.segments.segments.map(x => x.status), ['won', 'pending', 'pending'], 'fbt: only the finished front is decided');
eq(by(r).Ann, 15 + 5 + 5, 'fbt: Ann wins the front pot and gets the unfinished periods back'); eq(tot(r), 45, 'fbt: still accounted for');

// 9 holes plays as one contest whatever the period says
r = pay(cfg({ period: 'fbt' }), [card('Ann', A(i => i < 9 ? 4 : null), { hole_count: 9 }), card('Bob', A(i => i < 9 ? 5 : null), { hole_count: 9 })]);
ok(r.lowscore.period === 'round' && by(r).Ann === 30, '9-hole round: one contest');
// the older field name does not apply here, and unknown periods play as the whole round
r = pay(cfg({ period: 'bogus' }), three); eq(r.lowscore.period, 'round', 'unknown period: whole round');

// config reaches the engine through game_configs
const addon = E.gatheringConfigFromLegacy(cfg({ period: 'sixes' })).addons.find(a => a.id === 'lowscore');
ok(addon && addon.period === 'sixes' && addon.entity === 'individual', 'config: period carried into the add-on');
ok(!E.gatheringConfigFromLegacy(cfg({})).addons.find(a => a.id === 'lowscore').period, 'config: whole round carries no period');

// net on own strokes
const netRow = { games: ['lowscore'], dollar_per_player: 10, game_configs: { lowscore: { dollar_per_player: 10, basis: 'net' } },
  handicap_config: { allowance: 100, skins_basis: 'gross', birdiepay_basis: 'gross', stroke_index: A(i => i + 1), players: { Ann: { kind: 'given', strokes: 0 }, Bob: { kind: 'given', strokes: 18 } } } };
r = pay(netRow, [card('Ann', A(() => 5)), card('Bob', A(() => 6))]);
eq(by(r), { Ann: 10, Bob: 10 }, 'net: Bob\'s 18 strokes turn his 6s into net 5s, level with Ann, so it is a push'); ok(r.lowscore.basis === 'net', 'net: labelled net');
r = pay(netRow, [card('Ann', A(() => 5)), card('Bob', A(() => 5))]);
eq(by(r), { Ann: 0, Bob: 20 }, 'net: with equal gross, Bob\'s strokes win it')

// can never take more than the pot has left
r = pay({ games: ['lowscore', 'fourball'], dollar_per_player: 10, game_configs: { lowscore: { dollar_per_player: 8, basis: 'gross' }, fourball: { dollar_per_player: 8, basis: 'gross', pairs: [['Ann', 'Bob'], ['Cy', 'Di']] } } },
  [card('Ann', A(() => 4)), card('Bob', A(() => 5)), card('Cy', A(() => 6)), card('Di', A(() => 6))]);
ok(r.lowscore.capped === true && tot(r) === 40, 'capped when the pot cannot cover both: total still 40');
console.log(`lowscore: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
