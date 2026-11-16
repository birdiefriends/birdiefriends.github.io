// Live Edit (Dev-101): Close, live boards and payouts read the AS-PLAYED roster that rides in the published Groups document.
import fs from 'fs'; import vm from 'vm';
import { extractFn, loadEngine } from './extract.mjs';
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const src = fs.readFileSync(new URL('../portal.html', import.meta.url), 'utf8');
const E = loadEngine();
const mk = (published, regs = [], gathering = { gatheringId: 104, teamSize: 2 }) => {
  const ctx = { _groupSets: published ? { 104: { published, version: 2 } } : {}, gatheringRegData: regs, gatheringData: [gathering], console, BFEngine: E,
    teamSizeOf: x => (Number(x && x.teamSize) >= 2 ? Number(x.teamSize) : 0), teamsState: () => ({ pairs: [['A','B'],['C','D']], names: ['',''] }) };
  vm.createContext(ctx);
  vm.runInContext(['gatheringAsPlayed','gcActiveCards','gatheringRowWithLiveTeams'].map(n => extractFn(src, n)).join('\n') + '\nthis.f = { gatheringAsPlayed, gcActiveCards, gatheringRowWithLiveTeams };', ctx);
  return ctx.f;
};
const row = { games: ['scramble'], game_configs: { scramble: { team_size: 2, pairs: [['A','B'],['C','D']] } } };
// never used Live Edit: unchanged behaviour (teams from the registrations)
let f = mk({ mode: 'shotgun', groups: [{ members: ['A','B','C','D'] }] }, [{ gatheringId: 104, player: 'A', status: 'Yes' }]);
ok(f.gatheringAsPlayed(104) === null, 'no as-played data: null');
ok(JSON.stringify(f.gatheringRowWithLiveTeams(row, 104).game_configs.scramble.pairs) === '[["A","B"],["C","D"]]', 'registration teams stand');
ok(f.gcActiveCards(104, [{ player: 'A' }, { player: 'Z' }]).length === 2, 'no one excluded');
// as-played: a 3-some, a solo and a no-show
const ap = { mode: 'shotgun', groups: [{ members: ['A','B','C'] }], teams: [{ members: ['A','B','C'], name: 'Trio' }, { members: ['D'] }], out: { k: { player: 'K', reason: 'noshow' }, w: { player: 'W', reason: 'withdrew' } }, planned: { players: 6, groups: 2 } };
f = mk(ap);
const r2 = f.gatheringRowWithLiveTeams(row, 104).game_configs.scramble;
ok(JSON.stringify(r2.pairs) === '[["A","B","C"],["D"]]' && r2.names[0] === 'Trio', 'scramble teams come from the as-played copy (3-some and solo kept)');
ok(r2.team_size === 2, 'the rest of the scramble config is untouched');
const cards = ['A','K','W','D'].map(player => ({ player }));
ok(f.gcActiveCards(104, cards).map(c => c.player).join() === 'A,W,D', 'a no-show card is excluded even if the registration was not changed; a withdrawn player counts');
// end to end: payout with as-played teams scores the 3-some and the solo
const PARS = [4,4,3,4,5,4,5,3,4, 3,5,4,4,4,3,4,5,3];
const full = { games: ['scramble'], dollar_per_player: 10, game_configs: { scramble: { dollar_per_player: 10, team_size: 2, basis: 'gross', payout: 'winner', pars: PARS, pairs: [['A','B'],['C','D']] } } };
const live = f.gatheringRowWithLiveTeams(full, 104);
const pay = E.computeGatheringGamesPayout(live, ['A','B','C','D'].map(p => ({ player: p, holes: PARS.map(x => x - (p === 'D' ? 1 : 0)) })), {}, []);
ok(pay.scramble.pairs.length === 2 && pay.scramble.winners[0].join() === 'D' && pay.scramble.pot === 40, 'solo D wins; pot = 4 players x $10');
console.log(`asplayed_readers: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
