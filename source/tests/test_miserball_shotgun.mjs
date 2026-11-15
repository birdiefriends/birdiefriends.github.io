// MiserBall on a shotgun start: "longest survivor" counts holes PLAYED from each group's start hole, not hole numbers.
import { loadEngine } from './extract.mjs';
const E = loadEngine(); let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const P = [4,4,3,4,5,4,5,3,4, 3,5,4,4,4,3,4,5,3];
const mk = (team) => ({ games: ['scramble', 'birdieball'], dollar_per_player: 20, game_configs: { scramble: { team_size: 2, basis: 'gross', pars: P, pairs: [['A1','A2'],['B1','B2']] }, birdieball_config: null }, birdieball_config: { dollar_per_player: 5, ...(team ? { team: true } : {}) } });
const cards = ['A1','A2','B1','B2'].map(p => ({ player: p, holes: P.map(x => x) }));
const SH = { a1: 1, a2: 1, b1: 10, b2: 10 };
const run = (row, ans, sh) => E.computeGatheringGamesPayout(row, cards, {}, ans, sh ? { startHoles: sh } : undefined).birdieball;
// Team A starts on 1 and loses on hole 5 (lasted 5 holes). Team B starts on 10 and loses on hole 10 (lasted 1 hole). A survives longer.
const ans = [{ player_name: 'A1', kept: false, lost_hole: 5 }, { player_name: 'A2', kept: true }, { player_name: 'B1', kept: false, lost_hole: 10 }, { player_name: 'B2', kept: true }];
let r = run(mk(true), ans, SH);
ok(r.mode === 'longest' && r.winners.length === 1 && /A1/.test(r.winners[0]), 'team: start-1 team (5 holes) beats start-10 team out on its first hole; got ' + JSON.stringify(r.winners));
// Same answers, no start holes: hole numbers decide (old behaviour), B "lasted" to 10.
r = run(mk(true), ans, null);
ok(/B1/.test(r.winners[0]), 'no shotgun: hole number decides');
// Wrap: team B starts on 10, loses on hole 3 (played 12 holes) beats team A out on 8 (8 holes).
const ans2 = [{ player_name: 'A1', kept: false, lost_hole: 8 }, { player_name: 'A2', kept: true }, { player_name: 'B1', kept: false, lost_hole: 3 }, { player_name: 'B2', kept: true }];
r = run(mk(true), ans2, SH);
ok(/B1/.test(r.winners[0]), 'wrapped: start-10 team out on 3 played 12 holes and wins');
// Both balls kept by one team wins outright regardless of start
r = run(mk(true), [{ player_name: 'A1', kept: true }, { player_name: 'A2', kept: true }, { player_name: 'B1', kept: false, lost_hole: 12 }, { player_name: 'B2', kept: true }], SH);
ok(r.mode === 'kept' && /A1/.test(r.winners[0]), 'kept team wins');
// Individual (non-team) mode uses the same measure
const ind = mk(false); ind.game_configs.scramble.pairs = undefined;
r = run(ind, [{ player_name: 'A1', kept: false, lost_hole: 5 }, { player_name: 'B1', kept: false, lost_hole: 10 }], SH);
ok(r.winners.length === 1 && r.winners[0] === 'A1', 'individual: A1 lasted 5 holes, B1 lasted 1');
console.log(`miserball_shotgun: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
