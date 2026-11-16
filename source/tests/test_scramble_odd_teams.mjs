// Live Edit (Dev-101): scramble teams that are not the event's size (a solo or a 3-some after a no-show) are scored and paid.
// Rules (Brian 2026-11-16): the configured pot is the pot; a team's prize splits equally among the players ON that team;
// handicap = the event's method at the team's own size; ante follows who played (pot = $/player x players actually in).
import { loadEngine } from './extract.mjs';
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const E = loadEngine();
const PARS = [4,4,3,4,5,4,5,3,4, 3,5,4,4,4,3,4,5,3];
const card = (p, d) => ({ player: p, holes: PARS.map(x => x + d) });
// 2-man event; teams: pair A&B, solo C, 3-some D,E,F. Everyone shoots even par except team D/E/F one under (each hole -1 on the team's ball).
const row = { games: ['scramble'], dollar_per_player: 10, game_configs: { scramble: { dollar_per_player: 10, team_size: 2, basis: 'gross', payout: 'winner', pars: PARS, pairs: [['A','B'], ['C'], ['D','E','F']] } } };
const cards = [card('A',0), card('B',0), card('C',0), card('D',-1), card('E',-1), card('F',-1)];
const r = E.computeGatheringGamesPayout(row, cards, {}, []);
const sc = r.scramble;
ok(sc && sc.pairs.length === 3, 'all three teams are scored (was: only the size-2 team)');
ok(sc.pot === 60, 'pot = $10 x 6 players actually playing, got ' + (sc && sc.pot));
ok(sc.winners.length === 1 && sc.winners[0].join() === 'D,E,F', 'the 3-some wins');
const got = nm => ((r.payouts || []).find(x => (x.player || x.name) === nm) || {});
ok((r.unallocated || 0) === 0, 'nothing left unallocated: ' + r.unallocated);
['D','E','F'].forEach(n => ok(got(n).scramble === 20, n + ' gets $60 / 3 = $20, got ' + JSON.stringify(got(n))));
ok(!got('A').scramble, 'the beaten pair gets nothing from the scramble');
// per-player credit for the winning 3-some: 60 / 3 = 20 each
// A winning PAIR's players get more each than a winning 3-some's (the team prize splits among the players on it)
const rp = E.computeGatheringGamesPayout(row, [card('A',-1), card('B',-1), card('C',0), card('D',0), card('E',0), card('F',0)], {}, []);
const gp = nm => (rp.payouts.find(x => x.player === nm) || {}).scramble;
ok(gp('A') === 30 && gp('B') === 30, 'winning pair: $60 / 2 = $30 each, got ' + gp('A'));
// Solo team scored alone
const row2 = { games: ['scramble'], dollar_per_player: 10, game_configs: { scramble: { dollar_per_player: 10, team_size: 2, basis: 'gross', payout: 'winner', pars: PARS, pairs: [['A','B'], ['C']] } } };
const r2 = E.computeGatheringGamesPayout(row2, [card('A',0), card('B',0), card('C',-2)], {}, []);
ok(r2.scramble.winners[0].join() === 'C', 'a solo team can win');
ok(r2.scramble.pot === 30, 'pot counts 3 players, got ' + r2.scramble.pot);
// Event-size teams unchanged
const row3 = { games: ['scramble'], dollar_per_player: 10, game_configs: { scramble: { dollar_per_player: 10, team_size: 2, basis: 'gross', payout: 'winner', pars: PARS, pairs: [['A','B'], ['C','D']] } } };
const r3 = E.computeGatheringGamesPayout(row3, [card('A',0), card('B',0), card('C',-1), card('D',-1)], {}, []);
ok(r3.scramble.pot === 40 && r3.scramble.per_player === 20, 'pairs: pot 40, winners $20 each, got ' + r3.scramble.pot + '/' + r3.scramble.per_player);
// Handicap at the team's own size: strokes for a team of 1, 2, 3 use the built-in % for that size
ok(E.scrambleTeamStrokes({ hcp_method: 'ranked', team_size: 1 }, [10]) === 10, 'solo ranked = 100%');
ok(E.scrambleTeamStrokes({ hcp_method: 'ranked', team_size: 3 }, [10, 20, 30]) === Math.round(10 * .2 + 20 * .15 + 30 * .10), '3-man ranked 20/15/10');
console.log(`scramble_odd_teams: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
