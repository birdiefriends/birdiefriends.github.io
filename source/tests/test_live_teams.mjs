// Dev-98: Teams of N Gatherings pay and score the CURRENT teams from the registrations, not the snapshot saved with the games config.
import fs from 'fs'; import vm from 'vm'; import { createRequire } from 'module'; import { extractFn } from './extract.mjs';
import { fileURLToPath } from 'url';
const HERE = (p) => fileURLToPath(new URL(p, import.meta.url));
const require = createRequire(import.meta.url);
const BFEngine = require('../bf_engine.js');
const src = fs.readFileSync(HERE('../portal.html'), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const ctx = vm.createContext({ console, JSON, Math, Number, String, Set, Map, Array, Object, BFEngine });
vm.runInContext(`let gatheringData = [{ gatheringId: 7, teamSize: 2 }, { gatheringId: 8 }]; let gatheringRegData = []; let _gatheringGamesIndex = new Map();`, ctx);
vm.runInContext(['isOpenSpotName', 'escapeHtml', 'teamSizeOf', 'partnersOf', 'teamsState', 'gatheringRowWithLiveTeams', 'gatheringRoundConfig'].map(n => extractFn(src, n)).join('\n'), ctx);
const reg = (player, partner, teamName) => ({ gatheringId: 7, player, status: 'Yes', partner: partner || null, teamName: teamName || null });
const saved = { games: ['scramble'], dollar_per_player: 10, game_configs: { scramble: { dollar_per_player: 10, basis: 'gross', scoring: 'strokes', hcp_method: 'none', payout: 'winner', pairs: [['Ann', 'Bob'], ['Cy', 'Di']], names: ['Old A', 'Old B'] } } };
const card = (player, v) => ({ player, holes: Array.from({ length: 18 }, () => v) });
const set = (rows) => { vm.runInContext('gatheringRegData = ' + JSON.stringify(rows) + ';', ctx); };
// registrations: Ann+Cy and Bob+Di are the teams NOW
set([reg('Ann', 'Cy', 'Aces'), reg('Cy', 'Ann', 'Aces'), reg('Bob', 'Di'), reg('Di', 'Bob')]);
const live = ctx.gatheringRowWithLiveTeams(saved, 7);
ok(JSON.stringify(live.game_configs.scramble.pairs) === JSON.stringify([['Ann', 'Cy'], ['Bob', 'Di']]), 'teams come from the registrations, not the saved snapshot (got ' + JSON.stringify(live.game_configs.scramble.pairs) + ')');
ok(live.game_configs.scramble.names[0] === 'Aces' && live.game_configs.scramble.names[1] === '', 'team names follow the registrations');
ok(saved.game_configs.scramble.pairs[0].join() === 'Ann,Bob', 'the saved row is not mutated');
ok(live.game_configs.scramble.payout === 'winner' && live.game_configs.scramble.dollar_per_player === 10, 'the host\'s game settings are kept');
// payout follows the live teams: Ann & Cy shoot 4s, Bob & Di shoot 5s
const cards = [card('Ann', 4), card('Cy', 4), card('Bob', 5), card('Di', 5)];
const r = BFEngine.computeGatheringGamesPayout(live, cards, {}, []);
const got = n => (r.payouts.find(p => p.player === n) || {}).scramble || 0;
ok(got('Ann') === 20 && got('Cy') === 20 && got('Bob') === 0, 'the podium pays the CURRENT winning team (Ann & Cy $20 each)');
const stale = BFEngine.computeGatheringGamesPayout(saved, cards, {}, []);
ok((stale.payouts.find(p => p.player === 'Ann') || {}).scramble === 0 || (stale.scramble.winners || [])[0].join() !== 'Ann,Cy', 'the stale snapshot would have paid the wrong pairs (why this matters)');
// a partner leaves after saving: that team dissolves
set([reg('Ann', 'Cy'), reg('Cy', 'Ann'), reg('Bob', 'Di'), { gatheringId: 7, player: 'Di', status: 'No', partner: null }]);
ok(JSON.stringify(ctx.gatheringRowWithLiveTeams(saved, 7).game_configs.scramble.pairs) === JSON.stringify([['Ann', 'Cy']]), 'Di drops out: only Ann & Cy remain a team');
// not a team Gathering, or no registrations loaded: the saved teams stand
set([]);
ok(ctx.gatheringRowWithLiveTeams(saved, 7) === saved, 'no registrations loaded (aged out): saved teams stand');
set([reg('Ann', 'Cy'), reg('Cy', 'Ann')]);
ok(ctx.gatheringRowWithLiveTeams(saved, 8) === saved, 'a Gathering without teams: saved teams stand');
ok(ctx.gatheringRowWithLiveTeams({ games: ['skins'] }, 7).games[0] === 'skins', 'no Scramble: row untouched');
// the Live Panel config is built from the live teams too
vm.runInContext("_gatheringGamesIndex.set(7, " + JSON.stringify(saved) + ");", ctx);
set([reg('Ann', 'Cy'), reg('Cy', 'Ann'), reg('Bob', 'Di'), reg('Di', 'Bob')]);
const cfg = ctx.gatheringRoundConfig(7);
ok(cfg && JSON.stringify(cfg.addons.find(a => a.id === 'scramble').pairs) === JSON.stringify([['Ann', 'Cy'], ['Bob', 'Di']]), 'gatheringRoundConfig (Live Panel) uses the live teams');
console.log(`${pass} passed, ${fail} failed`); if (fail) process.exit(1);
