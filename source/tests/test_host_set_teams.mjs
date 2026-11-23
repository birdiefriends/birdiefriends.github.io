// Registrations are the only source of a Scramble's teams: an old saved host-built list (teams_by 'host') is ignored everywhere teams are read.
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

const four = [reg('Ann'), reg('Bob'), reg('Cy'), reg('Di')], index = r => vm.runInContext('_gatheringGamesIndex = new Map([[7, ' + JSON.stringify(r) + ']]);', ctx);
set(four); index(row('host', [['Ann', 'Bob'], ['Cy', 'Di']]));
let st = A.teamsState(four, 2);
ok(!st.hostSet && st.teams === 0 && st.unpaired === 4, 'an old host-built list is ignored: nobody has picked a partner, so everyone still needs one (got ' + JSON.stringify([st.teams, st.unpaired]) + ')');
ok(A.hostSetTeamsFor(7) === null, 'hostSetTeamsFor never returns a saved list');
// the players' own mutual picks are the teams, whatever was saved
set([reg('Ann', 'Cy'), reg('Cy', 'Ann'), reg('Bob', 'Di'), reg('Di', 'Bob')]);
st = A.teamsState(vm.runInContext('gatheringRegData', ctx), 2);
ok(st.pairs.length === 2 && st.pairs[0].join() === 'Ann,Cy' && st.pairs[1].join() === 'Bob,Di', 'the partner picks are the teams, not the saved list');
const live = A.gatheringRowWithLiveTeams(row('host', [['Ann', 'Bob'], ['Cy', 'Di']]), 7);
ok(live.game_configs.scramble.pairs[0].join() === 'Ann,Cy', 'the live panel and Close read the registrations too');
set([reg('Ann', 'Bob'), reg('Bob', 'Ann'), reg('Cy'), reg('Di')]);
st = A.teamsState(vm.runInContext('gatheringRegData', ctx), 2);
ok(st.pairs.length === 1 && st.pairs[0].join() === 'Ann,Bob' && st.unpaired === 2, 'only Ann & Bob are locked; Cy and Di still need a partner');
// the saved config keeps teams_by through the Worker's cleaner (older rows may still carry it)
ok(E.cleanGameConfig('scramble', { pairs: [], teams_by: 'junk' }).teams_by === 'players', 'an unknown value falls back to players');
console.log(`host_set_teams: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
