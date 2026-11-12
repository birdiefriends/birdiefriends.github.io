// A scramble's podium is a fixed total the host sets; the pot at Close is that total, not a per-player rate x the headcount.
import { loadEngine } from './extract.mjs';
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const E = loadEngine();
const mk = (p, v) => ({ player: p, input_type: 'strokes', holes: Array.from({ length: 18 }, () => v) });
const teams = n => Array.from({ length: n }, (_, i) => ['P' + i + 'a', 'P' + i + 'b']);
const row = (n, extra) => ({ games: ['scramble', 'skins'], dollar_per_player: 20, game_configs: { skins: {}, scramble: Object.assign({ dollar_per_player: 5.8333, team_size: 2, basis: 'gross', hcp_method: 'none', payout: 'custom', place_shares: [80, 40, 20], pairs: teams(n) }, extra || {}) } });
const cards = n => [].concat(...teams(n).map((t, i) => t.map(p => mk(p, 3 + i))));
const pay = (n, extra) => E.computeGatheringGamesPayout(row(n, extra), cards(n), {}, []).scramble;
// the old way: the pot follows the headcount
const old11 = pay(11), old12 = pay(12);
ok(old11 && old12 && old11.pot !== old12.pot, 'without a fixed total the pot moves with the number of teams (' + old11.pot + ' vs ' + old12.pot + ')');
// the fixed podium
for (const n of [10, 11, 12]) {
  const r = pay(n, { podium_total: 140 });
  ok(r.pot === 140, n + ' teams: the pot is the fixed $140: ' + r.pot);
  const pl = (r.places || []).map(x => x.per_pair);
  ok(JSON.stringify(pl) === '[80,40,20]', n + ' teams: $80 / $40 / $20 to the first three teams: ' + JSON.stringify(pl));
}
ok(E.getGame('scramble').fixedCost(row(11, { podium_total: 140 }).game_configs.scramble) === 140, 'the set-aside before skins is the fixed total');
ok(E.getGame('scramble').fixedCost(row(11).game_configs.scramble) === Math.round(5.8333 * 22 * 10000) / 10000 || Math.abs(E.getGame('scramble').fixedCost(row(11).game_configs.scramble) - 128.33) < 0.01, 'a game saved before this change still uses the per-player rate');
const cfg = E.gatheringConfigFromLegacy(row(11, { podium_total: 140 }));
ok((cfg.addons.find(a => a.id === 'scramble') || {}).podium_total === 140, 'the fixed total survives conversion to the engine config');
ok(!('podium_total' in (E.gatheringConfigFromLegacy(row(11)).addons.find(a => a.id === 'scramble'))), 'no fixed total, no key');
ok(E.scramblePodiumTotal({ podium_total: '140' }) === 140 && E.scramblePodiumTotal({ podium_total: -5 }) === 0 && E.scramblePodiumTotal({}) === 0, 'scramblePodiumTotal reads only a positive number');
// skins gets the balance, so a dropout changes skins, not the podium
const sk = n => E.computeGatheringGamesPayout(Object.assign(row(n, { podium_total: 140 }), { dollar_per_player: 20 }), cards(n), {}, []);
ok(sk(11).scramble.pot === 140 && sk(10).scramble.pot === 140, 'a dropout leaves the podium alone');
console.log(`scramble_podium_total: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
