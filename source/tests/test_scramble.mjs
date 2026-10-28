// v4.48.0 — Scramble (Teams of 2): one ball per team, strokes or Stableford, team handicap, places.
import { loadEngine } from './extract.mjs';
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const E = loadEngine();
const card = (player, f) => ({ player, holes: Array.from({ length: 18 }, (_, i) => f(i + 1)) });
const pay = (row, cards) => E.computeGatheringGamesPayout(row, cards, {}, []);
const PAR4 = Array.from({ length: 18 }, () => 4);
const sc = (extra = {}, dpp = 10) => ({ games: ['scramble'], dollar_per_player: dpp,
  game_configs: { scramble: Object.assign({ dollar_per_player: dpp, basis: 'gross', pairs: [['Ann', 'Bob'], ['Cy', 'Di']] }, extra) } });
const teamCards = (a, b) => [card('Ann', a), card('Bob', a), card('Cy', b), card('Di', b)];   // both partners' cards carry the team score
const got = (r, nm) => (r.payouts.find(p => p.player === nm) || {}).scramble || 0;

// 1. team handicap helper
ok(E.scrambleTeamStrokes({}, [10, 20]) === 7, 'low/high default: 35% of 10 + 15% of 20 = 6.5 -> 7 (got ' + E.scrambleTeamStrokes({}, [10, 20]) + ')');
ok(E.scrambleTeamStrokes({}, [20, 10]) === 7, 'order of the two handicaps does not matter');
ok(E.scrambleTeamStrokes({ low_pct: 25, high_pct: 10 }, [8, 16]) === 4, 'editable percentages: 25% of 8 + 10% of 16 = 3.6 -> 4');
ok(E.scrambleTeamStrokes({ hcp_method: 'combined' }, [10, 20]) === 8, 'combined default 25%: 25% of 30 = 7.5 -> 8');
ok(E.scrambleTeamStrokes({ hcp_method: 'combined', allowance: 10 }, [10, 20]) === 3, 'combined 10% of 30 = 3');
ok(E.scrambleTeamStrokes({ hcp_method: 'none' }, [10, 20]) === 0, 'none = scratch');
ok(E.scrambleTeamStrokes({}, [12]) === 4, 'a single known handicap still works (35% of 12 = 4.2 -> 4)');
ok(E.scrambleTeamStrokes({}, []) === 0, 'no handicaps = 0');

// 2. Stableford points tables
const bf = [3, 2, 1, 0, -1, -2, -3].map(d => E.stablefordHolePoints(d, 'bf'));
ok(bf.join() === '0,0,1,2,4,6,8'.split(',').reverse().reverse().join() || bf.join() === '0,0,1,2,4,6,8', 'BF table: double+ 0, bogey 1, par 2, birdie 4, eagle 6, albatross 8 (got ' + bf.join() + ')');
const std = [2, 1, 0, -1, -2, -3].map(d => E.stablefordHolePoints(d, 'standard'));
ok(std.join() === '0,1,2,3,4,5', 'standard table: 0,1,2,3,4,5 (got ' + std.join() + ')');

// 3. strokes, gross: lowest total wins and both partners are paid
let r = pay(sc(), teamCards(() => 4, () => 5));
ok(got(r, 'Ann') === 20 && got(r, 'Bob') === 20 && got(r, 'Cy') === 0, 'lower one-ball total takes the $40 pot');
ok(r.scramble.format === 'scramble' && r.scramble.scoring === 'strokes' && r.scramble.pot === 40, 'result is labelled scramble / strokes');
ok(Math.abs(r.payouts.reduce((t, p) => t + p.total, 0) + r.unallocated - r.total_pot) < 1e-9, 'money is conserved');

// 4. Stableford gross: most points wins, birdie premium beats a steady par team
const stab = (extra = {}) => sc(Object.assign({ scoring: 'stableford', pars: PAR4 }, extra));
r = pay(stab(), teamCards(() => 4, h => (h === 1 ? 3 : h === 2 ? 5 : 4)));
ok(r.scramble.scoring === 'stableford' && r.scramble.standings[0].pair.join() === 'Cy,Di' && r.scramble.standings[0].total === 37, 'BF table: 4 + 1 + 16 x 2 = 37 beats 36 (got ' + r.scramble.standings[0].total + ')');
ok(got(r, 'Cy') === 20 && got(r, 'Ann') === 0, 'the Stableford winner is paid');
r = pay(stab({ scale: 'standard' }), teamCards(() => 4, h => (h === 1 ? 3 : h === 2 ? 5 : 4)));
ok(r.scramble.standings[0].total === 36 && r.scramble.standings[1].total === 36 && r.scramble.places[0].tied, 'standard table: 3 + 1 + 32 = 36 ties the 36 team, so the places tie');
ok(got(r, 'Ann') === 10 && got(r, 'Cy') === 10, 'tied winners split the pot (got ' + got(r, 'Ann') + '/' + got(r, 'Cy') + ')');
ok(r.scramble.holes === undefined && r.scramble.standings[0].holes[0].shot != null && r.scramble.standings[0].holes[0].par === 4, 'each Stableford hole keeps the shot score and the par');

// 5. Stableford without pars: nobody can finish, everyone gets their ante back and the result says why
r = pay(sc({ scoring: 'stableford' }), teamCards(() => 4, () => 5));
ok(r.scramble.par_missing === true && r.payouts.every(p => p.scramble === undefined || p.scramble === 0), 'no par data: nothing is awarded');
ok(r.payouts.every(p => p.total === 10), 'no par data: every ante is given back');

// 6. net: low/high team handicap, own strokes vs off the low
const players = { Ann: { kind: 'index', index: 10, course_hcp: 10, strokes: 10 }, Bob: { kind: 'index', index: 20, course_hcp: 20, strokes: 20 },
  Cy: { kind: 'index', index: 10, course_hcp: 10, strokes: 10 }, Di: { kind: 'index', index: 10, course_hcp: 10, strokes: 10 } };
const SI = Array.from({ length: 18 }, (_, i) => i + 1);
const net = (extra) => Object.assign(sc(Object.assign({ basis: 'net' }, extra)), { handicap_config: { mode: 'net', allowance: 100, stroke_index: SI, players } });
r = pay(net({ net_mode: 'own' }), teamCards(() => 5, () => 5));
ok(r.scramble.basis === 'net' && r.scramble.hcp_method === 'low_high', 'net result says low/high');
const strokesOf = nm => (r.scramble.stroke_marks.find(m => m.player.split(' & ').includes(nm)) || {}).strokes;
ok(strokesOf('Ann') === 7 && strokesOf('Cy') === 5, 'Ann & Bob get 7 strokes, Cy & Di 5 (got ' + strokesOf('Ann') + '/' + strokesOf('Cy') + ')');
ok(got(r, 'Ann') === 20, 'Ann & Bob (83 net) beat Cy & Di (85 net)');
r = pay(net({ net_mode: 'low' }), teamCards(() => 5, () => 5));
ok(strokesOf('Ann') === 2 && strokesOf('Cy') === 0, 'off the low: 7 - 5 = 2 and 0 (got ' + strokesOf('Ann') + '/' + strokesOf('Cy') + ')');
r = pay(net({ hcp_method: 'combined', allowance: 20 }), teamCards(() => 5, () => 5));
ok(strokesOf('Ann') === 6 && strokesOf('Cy') === 4, 'combined 20%: 20% of 30 = 6, 20% of 20 = 4');
r = pay(net({ hcp_method: 'none' }), teamCards(() => 5, () => 5));
ok(strokesOf('Ann') === 0 && r.scramble.standings[0].total === 90, 'no handicap = scratch, a level tie');

// 7. Stableford net: strokes fall on the hardest holes
r = pay(net({ scoring: 'stableford', pars: PAR4, hcp_method: 'combined', allowance: 20, net_mode: 'own' }), teamCards(() => 5, () => 5));
// Ann & Bob: 6 strokes on SI 1-6 -> net 4 (par, 2 pts) there and 5 (bogey, 1 pt) on 12 holes = 12 + 12 = 24; Cy & Di: 4 strokes -> 8 + 14 = 22
ok(r.scramble.standings[0].pair.join() === 'Ann,Bob' && r.scramble.standings[0].total === 24 && r.scramble.standings[1].total === 22, 'net Stableford totals 24 vs 22 (got ' + r.scramble.standings.map(s => s.total) + ')');

// 8. places: top 3 with four teams and a tie for second
const four = ['Ann', 'Bob', 'Cy', 'Di', 'Ed', 'Flo', 'Gus', 'Hal'];
const eight = (extra) => ({ games: ['scramble'], dollar_per_player: 10, game_configs: { scramble: Object.assign({ dollar_per_player: 10, basis: 'gross',
  pairs: [['Ann', 'Bob'], ['Cy', 'Di'], ['Ed', 'Flo'], ['Gus', 'Hal']] }, extra) } });
const sc8 = [4, 5, 5, 6];
const cards8 = four.map((nm, i) => card(nm, () => sc8[Math.floor(i / 2)]));
r = pay(eight({ payout: 'top3' }), cards8);
// pot $80: 1st 50% = 40 -> 20 each; 2nd and 3rd tie (5s): share 30+20 = 50% = 40 split over two teams = 20 per team -> 10 a player
ok(got(r, 'Ann') === 20 && got(r, 'Cy') === 10 && got(r, 'Ed') === 10 && got(r, 'Gus') === 0, 'top 3 with a tie for second: 20 / 10 / 10 / 0 (got ' + ['Ann', 'Cy', 'Ed', 'Gus'].map(n => got(r, n)) + ')');
ok(r.scramble.places.length === 2 && r.scramble.places[1].tied, 'two place groups, the second one tied');
r = pay(eight({ payout: 'top2' }), cards8);
ok(got(r, 'Ann') === 26 && got(r, 'Cy') === 7 && got(r, 'Ed') === 7, 'top 2 (65/35): 1st gets $52 a team, the two tied for 2nd share the $28 (got ' + ['Ann', 'Cy', 'Ed'].map(n => got(r, n)) + ')');
r = pay(eight({}), cards8);
ok(got(r, 'Ann') === 40 && got(r, 'Cy') === 0, 'winner takes all by default');

// 9. an incomplete card cannot win; nobody finished -> ante back
const part = card => Object.assign({}, card, { holes: card.holes.map((v, i) => (i < 9 ? v : null)) });
r = pay(sc(), [part(card('Ann', () => 3)), part(card('Bob', () => 3)), card('Cy', () => 5), card('Di', () => 5)]);
ok(got(r, 'Cy') === 20 && got(r, 'Ann') === 0, 'a team that has not finished cannot win');
r = pay(sc(), [part(card('Ann', () => 3)), part(card('Bob', () => 3)), part(card('Cy', () => 5)), part(card('Di', () => 5))]);
ok(r.payouts.every(p => p.total === 10 && !p.scramble), 'nobody finished: every ante comes back');

// 10. $0 pot still ranks
r = pay(sc({ dollar_per_player: 0 }, 0), teamCards(() => 4, () => 5));
ok(r.scramble.pot === 0 && r.scramble.standings[0].pair.join() === 'Ann,Bob' && r.payouts.every(p => !p.total), '$0 pot: result without money');

// 11. config schema, validation and the registry traits the screens read
const traits = E.gameTraits('scramble');
ok(traits.unit === 'ball' && traits.individualScores === false && traits.sides && traits.sideForm && traits.allowance === 'own', 'traits: one ball, no individual scores, pairs form, own allowance');
ok(E.validateGameConfig('scramble', { dollar_per_player: 5, pairs: [['A', 'B'], ['C', 'D']] }).ok, 'a minimal config validates');
ok(!E.validateGameConfig('scramble', { dollar_per_player: 5, pairs: [['A', 'B']] }).ok, 'needs at least two teams');
ok(!E.validateGameConfig('scramble', { pairs: [['A', 'B'], ['C', 'D']], scoring: 'skins' }).ok, 'scoring must be strokes or stableford');
ok(E.validateGameConfig('scramble', { pairs: [['A', 'B'], ['C', 'D']], scoring: 'stableford', pars: PAR4 }).ok, 'Stableford with 18 pars validates');
const clean = E.cleanGameConfig('scramble', { pairs: [['A', 'B'], ['C', 'D']], bogus: 1 });
ok(clean && clean.bogus === undefined && clean.pairs.length === 2, 'cleaning drops unknown keys and keeps the teams');
const dflt = E.defaultConfig('scramble');
ok(dflt.hcp_method === 'low_high' && dflt.basis === 'net' && dflt.payout === 'winner' && dflt.scoring === 'strokes' && dflt.low_pct === 35 && dflt.high_pct === 15 && dflt.allowance === 25, 'defaults: net, low/high 35/15, strokes, winner takes all');
ok(E.gameSchemas().scramble && E.gameSchemas().scramble.moneyOptional, 'the Worker schema table carries scramble');

// 12. strokes rows for the screens
const cfg = E.gatheringConfigFromLegacy(Object.assign(net({}), { game_configs: { scramble: { dollar_per_player: 10, basis: 'net', pairs: [['Ann', 'Bob'], ['Cy', 'Di']] } } }));
const sets = E.sideStrokeSets(cfg);
ok(sets.length === 1 && sets[0].id === 'scramble' && sets[0].rows[0].strokes === 7 && /35% of 10 \+ 15% of 20/.test(sets[0].rows[0].detail), 'strokeRows explains the team handicap (got ' + (sets[0] && sets[0].rows[0].detail) + ')');

// 13. conservation fuzz
let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
for (let t = 0; t < 300; t++) {
  const teams = 2 + Math.floor(rnd() * 5), names = Array.from({ length: teams * 2 }, (_, i) => 'P' + i);
  const pairs = Array.from({ length: teams }, (_, i) => [names[i * 2], names[i * 2 + 1]]);
  const scores = pairs.map(() => Array.from({ length: 18 }, () => 3 + Math.floor(rnd() * 4)));
  const cards = names.map((nm, i) => card(nm, h => scores[Math.floor(i / 2)][h - 1]));
  const row = { games: ['scramble'], dollar_per_player: 1 + Math.floor(rnd() * 20), game_configs: { scramble: {
    dollar_per_player: 1 + Math.floor(rnd() * 20), basis: 'gross', scoring: rnd() < 0.5 ? 'stableford' : 'strokes', pars: PAR4,
    payout: ['winner', 'top2', 'top3'][Math.floor(rnd() * 3)], pairs } } };
  row.dollar_per_player = row.game_configs.scramble.dollar_per_player;
  const res = pay(row, cards);
  const paid = res.payouts.reduce((s, p) => s + p.total, 0);
  ok(Math.abs(paid + res.unallocated - res.total_pot) < 1e-9, 'fuzz ' + t + ': conservation (' + paid + ' + ' + res.unallocated + ' vs ' + res.total_pot + ')');
}

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
