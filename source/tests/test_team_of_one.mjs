// A 1-man scramble's teams are the current Yes players (the saved list is a snapshot): dropouts come off, new players are added, a stale or empty list still works.
import fs from 'fs'; import vm from 'vm'; import { fileURLToPath } from 'url'; import { extractFn } from './extract.mjs';
const src = fs.readFileSync(fileURLToPath(new URL('../portal.html', import.meta.url)), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const ctx = { gatheringAsPlayed: () => null, gatheringData: [{ gatheringId: 9, teamSize: 0 }], gatheringRegData: [], isOpenSpotName: n => /^Open Spot/i.test(n), teamSizeOf: x => { const n = Number(x && x.teamSize); return n >= 2 && n <= 4 ? n : 0; }, teamsState: () => ({ pairs: [], names: [] }), Object, Array, Set, String, Number };
vm.createContext(ctx); vm.runInContext(extractFn(src, 'gatheringRowWithLiveTeams') + '\nthis.f = gatheringRowWithLiveTeams;', ctx);
const reg = (p, st = 'Yes') => ({ gatheringId: 9, player: p, status: st });
const row = pairs => ({ games: ['scramble', 'podium'], game_configs: { scramble: { team_size: 1, pairs, names: pairs.map(() => '') } } });
const pairsOf = r => r.game_configs.scramble.pairs.map(p => p[0]);
ctx.gatheringRegData = [reg('Ann'), reg('Bo'), reg('Cy'), reg('Open Spot 1'), reg('Di', 'No'), reg('Ed', 'Maybe')];
ok(pairsOf(ctx.f(row([]), 9)).join() === 'Ann,Bo,Cy', 'an empty saved list: every Yes player is a team (open spots and non-Yes are not)');
ok(pairsOf(ctx.f(row([['Ann'], ['Di'], ['Bo']]), 9)).join() === 'Ann,Bo,Cy', 'a player who dropped comes off, a player who registered since is added, the saved order is kept');
ok(ctx.f(row([['Ann']]), 9).game_configs.scramble.pairs.every(p => p.length === 1), 'every team has one player');
ctx.gatheringRegData = [];
ok(pairsOf(ctx.f(row([['Ann'], ['Bo']]), 9)).join() === 'Ann,Bo', 'no registrations loaded: the saved list is left alone');
ctx.gatheringRegData = [reg('Ann')]; const two = { games: ['scramble'], game_configs: { scramble: { team_size: 2, pairs: [['A', 'B']] } } };
ok(ctx.f(two, 9).game_configs.scramble.pairs[0].join() === 'A,B', 'teams of 2 are not touched by this');
ctx.gatheringAsPlayed = () => ({ teams: [{ members: ['Zed'], name: 'Z' }] });
ok(pairsOf(ctx.f(row([['Ann']]), 9)).join() === 'Zed', 'the host\'s as-played teams still win');
// The Games form: no Teams screen for the Scramble; its list is filled from registration, whatever the host did before
{ const c2 = { BFEngine: (await import('./extract.mjs')).loadEngine(), gatheringRegData: [], isOpenSpotName: n => /^Open Spot/i.test(n), teamSizeOf: ctx.teamSizeOf, _gamesFormG: { gatheringId: 9, teamSize: 0 }, _gamesFormSide: { scramble: { team_size: 1, pairs: [['Stale']] } }, Object, Array, Set, String, Number,
    teamsStateFromPicks: (rows, size) => ({ pairs: [['Ann', 'Bo']], names: [null] }) };
  vm.createContext(c2); vm.runInContext(extractFn(src, 'gamesFormScrambleFillFromRegs') + '\nthis.f = gamesFormScrambleFillFromRegs;', c2);
  c2.gatheringRegData = [reg('Ann'), reg('Bo'), reg('Cy', 'No'), reg('Open Spot 2')];
  ok(c2.f() === true && c2._gamesFormSide.scramble.pairs.map(p => p[0]).join() === 'Ann,Bo', 'team of 1: the form list is the Yes players, replacing whatever was saved');
  c2._gamesFormSide.scramble.team_size = 2; c2._gamesFormG = { gatheringId: 9, teamSize: 2 };
  ok(c2.f() === true && c2._gamesFormSide.scramble.pairs[0].join() === 'Ann,Bo', 'team of 2 on a 2-man Gathering: the partner picks');
  c2._gamesFormG = { gatheringId: 9, teamSize: 0 };
  ok(c2.f() === false, 'team of 2 on a Gathering with no partner picking: nothing to read (the form says so)'); }
ok(!/if \(GW_SIDE_STEP\[k\]\) steps\.push/.test(src) && /GW_SIDE_STEP\[k\] !== k/.test(src) && /scramble: 'scramble'/.test(src), 'the Scramble has no Teams step in the wizard');
ok(/cfg\.teams_by = 'players'/.test(src) && /return null;   \/\/ Registrations are always the source/.test(src), 'host-built teams are no longer saved or read');
// the saved config for a team of 1 is [[name], ...] and passes validation; a malformed team says exactly what is wrong
{ const E = (await import('./extract.mjs')).loadEngine();
  const v = E.validateGameConfig('scramble', { dollar_per_player: 0, basis: 'gross', team_size: 1, pairs: [['Ann'], ['Bo'], ['Cy']] });
  ok(v.ok, 'team of 1 config with [[name], ...] validates: ' + JSON.stringify(v.errors));
  const bad = E.validateGameConfig('scramble', { dollar_per_player: 0, basis: 'gross', team_size: 1, pairs: [['Ann', undefined]] });
  ok(!bad.ok && /each team needs exactly one player/.test(bad.errors[0]), 'the error names the real problem: ' + bad.errors[0]);
  ok(/pairs: rows\.map\(pr => pr\.slice\(0, BFEngine\.scrambleSize\(c\)\)\)/.test(fs.readFileSync(new URL('../portal.html', import.meta.url), 'utf8')), 'the form saves a team of 1 as [name]'); }
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
