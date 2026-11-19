// The host is the master of the teams: teams the host built in Games (teams_by 'host') win over the players' own picks, everywhere teams are read.
import fs from 'fs'; import vm from 'vm'; import { createRequire } from 'module'; import { extractFn } from './extract.mjs';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const E = require('../bf_engine.js');
const src = fs.readFileSync(fileURLToPath(new URL('../portal.html', import.meta.url)), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const ctx = vm.createContext({ console, JSON, Math, Number, String, Set, Map, Array, Object, BFEngine: E, showToast: () => {}, document: { createElement: () => ({}) } });
vm.runInContext(`let gatheringData = [{ gatheringId: 7, teamSize: 2 }]; let gatheringRegData = []; let _gatheringGamesIndex = new Map(); let _hostGamesByGathering = null; let _gamesFormG = { gatheringId: 7, teamSize: 2 };`, ctx);
vm.runInContext(['isOpenSpotName', 'escapeHtml', 'teamSizeOf', 'partnersOf', 'hostSetTeamsFor', 'teamsState', 'teamsStateFromPicks', 'gatheringAsPlayed', 'gatheringRowWithLiveTeams', 'gamesFormTeamsBy', 'openPartnerSheet'].map(n => extractFn(src, n)).join('\n') + '\nthis.api={hostSetTeamsFor,teamsState,teamsStateFromPicks,gatheringRowWithLiveTeams,gamesFormTeamsBy,openPartnerSheet};', ctx);
const A = ctx.api;
const reg = (player, partner, status) => ({ gatheringId: 7, player, status: status || 'Yes', partner: partner || null });
const set = rows => vm.runInContext('gatheringRegData = ' + JSON.stringify(rows) + ';', ctx);
const row = (by, pairs) => ({ games: ['scramble'], dollar_per_player: 10, game_configs: { scramble: { dollar_per_player: 10, basis: 'gross', scoring: 'strokes', hcp_method: 'none', payout: 'winner', pairs, names: ['Aces', ''], ...(by ? { teams_by: by } : {}) } } });
const index = r => vm.runInContext('_gatheringGamesIndex = new Map([[7, ' + JSON.stringify(r) + ']]);', ctx);
const four = [reg('Ann'), reg('Bob'), reg('Cy'), reg('Di')];

// Brian's case: the host built two teams in Games; nobody has picked a partner
set(four); index(row('host', [['Ann', 'Bob'], ['Cy', 'Di']]));
let st = A.teamsState(four, 2);
ok(st.hostSet && st.teams === 2 && st.unpaired === 0 && st.open.length === 0, 'host-set: 2 teams, nobody "needs a partner" (got ' + JSON.stringify([st.teams, st.unpaired, st.open]) + ')');
ok(st.pairs[0].join() === 'Ann,Bob' && st.names[0] === 'Aces', 'host-set: pairs and team names come from the host');
// the live panel / Close read the same teams
const live = A.gatheringRowWithLiveTeams(row('host', [['Ann', 'Bob'], ['Cy', 'Di']]), 7);
ok(JSON.stringify(live.game_configs.scramble.pairs) === JSON.stringify([['Ann', 'Bob'], ['Cy', 'Di']]), 'the panel and Close get the host teams');
// players picked others, but the host's teams still win
set([reg('Ann', 'Cy'), reg('Cy', 'Ann'), reg('Bob', 'Di'), reg('Di', 'Bob')]);
ok(A.teamsState(vm.runInContext('gatheringRegData', ctx), 2).pairs[0].join() === 'Ann,Bob', 'host-set beats the players\' own mutual picks');
ok(A.teamsStateFromPicks(vm.runInContext('gatheringRegData', ctx), 2).pairs[0].join() === 'Ann,Cy', 'the picks-only view still shows what the players picked');
// a host-set partner who is not registered Yes: that team is not complete, the other still stands
set([reg('Ann'), reg('Bob', null, 'No'), reg('Cy'), reg('Di')]);
st = A.teamsState(vm.runInContext('gatheringRegData', ctx), 2);
ok(st.teams === 1 && st.open.join() === 'Ann' && st.unpaired === 1, 'Bob said No: Ann needs a partner, Cy & Di stay a team');
// NOT host-set: the old behaviour, players' picks
set([reg('Ann', 'Bob'), reg('Bob', 'Ann'), reg('Cy'), reg('Di')]); index(row('players', [['Ann', 'Cy'], ['Bob', 'Di']]));
st = A.teamsState(vm.runInContext('gatheringRegData', ctx), 2);
ok(!st.hostSet && st.pairs.length === 1 && st.pairs[0].join() === 'Ann,Bob' && st.unpaired === 2, 'players\' teams: only Ann & Bob locked, 2 still need a partner');
index(row(null, [['Ann', 'Cy'], ['Bob', 'Di']]));
ok(!A.teamsState(vm.runInContext('gatheringRegData', ctx), 2).hostSet, 'a snapshot saved before this change (no teams_by) is not host-set');
// registration + partner sheet: no partner question when the host set the teams
index(row('host', [['Ann', 'Bob'], ['Cy', 'Di']]));
ok(A.hostSetTeamsFor(7) && !A.hostSetTeamsFor(8), 'hostSetTeamsFor finds this Gathering only');
// the Games form: hand-made teams are the host's, accepting the players' teams is not
set(four); vm.runInContext('gatheringRegData = ' + JSON.stringify([reg('Ann', 'Bob'), reg('Bob', 'Ann'), reg('Cy', 'Di'), reg('Di', 'Cy')]), ctx);
ok(A.gamesFormTeamsBy([['Ann', 'Bob'], ['Cy', 'Di']], { teams_by: 'players' }, 7) === 'players', 'same as the players\' teams: still the players\'');
ok(A.gamesFormTeamsBy([['Ann', 'Cy'], ['Bob', 'Di']], { teams_by: 'players' }, 7) === 'host', 'changed by the host: host-set');
ok(A.gamesFormTeamsBy([['Ann', 'Bob']], { teams_by: 'host' }, 7) === 'host' && A.gamesFormTeamsBy([], { teams_by: 'host' }, 7) === 'players', 'once host-set it stays; clearing all teams hands it back to the players');
vm.runInContext('gatheringRegData = []', ctx);
ok(A.gamesFormTeamsBy([['Ann', 'Bob']], { teams_by: 'players' }, 7) === 'host', 'teams built before anyone registers are the host\'s');
// the saved config keeps teams_by through the Worker's cleaner
const cleaned = E.cleanGameConfig('scramble', { dollar_per_player: 10, basis: 'gross', pairs: [['Ann', 'Bob']], names: [''], teams_by: 'host' });
ok(cleaned.teams_by === 'host', 'teams_by survives cleanGameConfig (the Worker keeps it)');
ok(E.cleanGameConfig('scramble', { pairs: [], teams_by: 'junk' }).teams_by === 'players', 'an unknown value falls back to players');
console.log(`host_set_teams: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
