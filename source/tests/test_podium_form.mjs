// The Games Prizes editor (its own game, any game type): state changes, the pot check, ranking choices, and that it draws.
import fs from 'fs'; import vm from 'vm'; import { extractFn, loadEngine } from './extract.mjs'; import { fileURLToPath } from 'url';
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const src = fs.readFileSync(fileURLToPath(new URL('../portal.html', import.meta.url)), 'utf8');
const FN = ['pzResultsHtml', 'pzBlank', 'pzTable', 'pzPot', 'pzPlan', 'pzRefresh', 'pzSetRankBy', 'pzPreset', 'pzFlightName', 'pzFlightTee', 'pzAddFlight', 'pzRemoveFlight', 'pzAddPlace', 'pzRemovePlace', 'pzPrize', 'pzCheckHtml', 'pzSources', 'setGamesFormPrizesDollarPerPlayer', 'gatheringGamesPodiumSectionHtml'];
const els = {}; let refreshes = 0;
const ctx = { Math, Number, String, Array, Object, JSON, parseFloat, escapeHtml: s => String(s), document: { getElementById: id => els[id] || null }, updateGamesFormPotPreview() { refreshes++; }, gamesFormAutoRanking() {}, refreshGamesFormHcpSection() {} };
vm.createContext(ctx);
vm.runInContext(`let _gamesFormPrizes = { dollar_per_player: 20, rank_by: 'auto', basis: 'gross', table: { flights: [], prizes: [{ scope: 'overall', place: 1, pct: 100 }] } }; let _gamesFormYesCount = 20; const _gamesFormTouched = new Set(); const _gamesFormSelected = new Set(['podium', 'scramble']); const CS_TEE_OPTIONS = ['Black','Blue','Green','White','Yellow','Gold','Red','Silver'];\n` + FN.map(n => extractFn(src, n)).join('\n'), ctx);
const R = c => vm.runInContext(c, ctx);
ok(R('pzPlan().asked') === 20 * 20, 'the default table (Overall 1st = 100%) uses the whole $400 prize pot');
R("pzPreset('both')"); ok(R('pzTable().flights.length') === 2 && R('pzTable().prizes.length') === 5, 'Overall + 2 flights preset');
ok(Math.abs(R('pzPlan().left')) < 0.01, 'the preset pays 100% of the pot');
R("pzFlightName(0, 'Green')"); R("pzFlightTee(0, 'Green')"); R("pzFlightName(1, 'Combo+')"); R("pzFlightTee(1, 'Gold')"); R("pzFlightTee(1, 'White')");
ok(R('pzTable().flights[0].tees.join()') === 'Green' && R('pzTable().flights[1].tees.join()') === 'Gold,White', 'tee boxes pick a flight');
R("pzFlightTee(1, 'White')"); ok(R('pzTable().flights[1].tees.join()') === 'Gold', 'tapping a tee again removes it');
R("pzAddPlace('overall')"); ok(R("pzTable().prizes.filter(x => x.scope === 'overall').map(x => x.place).sort().join()") === '1,2', 'Add a place gives the next place');
R("pzPrize(0, 'v', '25')"); ok(R('pzTable().prizes[0].pct') === 25, 'typing in a percent row sets the percent');
R("pzPrize(0, 'unit', 'amount')"); R("pzPrize(0, 'v', '150')"); ok(R('pzTable().prizes[0].amount') === 150 && R('pzTable().prizes[0].pct') === undefined, 'switching a prize to dollars keeps one unit');
els['pz-check'] = { innerHTML: '' }; R("pzPrize(0, 'v', '999')"); ok(/reduced to fit/.test(els['pz-check'].innerHTML), 'a table bigger than the pot warns as you type');
R("pzRemoveFlight(0)"); ok(R("pzTable().flights.length") === 1 && !R("pzTable().prizes.some(x => x.scope === 'f1')"), 'removing a flight removes its prizes');
ok(R("pzSources().map(x => x[0]).join()") === 'auto,round,scramble', 'it can rank the round totals or any game picked on the event');
R("_gamesFormSelected.add('fourball')"); ok(/fourball/.test(R("pzSources().map(x => x[0]).join()")), 'picking BestBall adds it as something to rank');
const h = R('gatheringGamesPodiumSectionHtml()'); ok(/Overall/.test(h) && /Add a flight/.test(h) && /Ranked by/.test(h) && /Players on these tee boxes/.test(h), 'the editor draws the prize pot, ranked-by, overall, flights, and the tee picker');
R("_gamesFormSelected.delete('podium')"); ok(R('gatheringGamesPodiumSectionHtml()') === '', 'not shown unless Prizes is picked');
// the published result draws: every prize with who took it
{ const E = loadEngine(), ALL = n => Array(18).fill(n), mk = (player, per) => ({ player, holes: ALL(per), hole_count: 18 });
  const r = E.computeRoundPayout({ payout: { entry_per_player: 20 }, addons: [{ id: 'podium', entity: 'individual', dollar_per_player: 20, basis: 'gross', rank_by: 'round', table: { flights: [{ id: 'g', name: 'Green', tees: ['Green'] }], prizes: [{ scope: 'overall', place: 1, amount: 30 }, { scope: 'g', place: 1, amount: 10 }] } }] }, { scorecards: [mk('Ann', 4), mk('Bob', 5)], teeByPlayer: new Map([['bob', 'Green']]) });
  const lbl = t => `<h>${t}</h>`, line = (a, b) => `<l>${a}|${b}</l>`, m = v => '$' + v;
  const html = ctx.pzResultsHtml(r.podium, lbl, line, m, x => String(x));
  ok(/Overall/.test(html) && /Green/.test(html) && /<b>Ann<\/b> \$30/.test(html) && /<b>Bob<\/b> \$10/.test(html), 'the results show each prize and its winner'); }
// Scramble → "Flights & places": the Scramble keeps ranking with no pot of its own, and Prizes (ranked by the Scramble) pays the tiers
{ const c2 = { Math, Number, String, Array, Object, JSON, parseFloat, escapeHtml: x => String(x), BFEngine: loadEngine(), showToast() {}, gwGoTo(s) { c2._went = s; }, refreshGamesFormSideSection() {}, refreshGamesFormSplit() {}, document: { getElementById: () => null }, updateGamesFormPotPreview() {} };
  vm.createContext(c2);
  vm.runInContext(`let _gamesFormSelected = new Set(['scramble']); const _gamesFormTouched = new Set(); let _gamesFormPrizes = { dollar_per_player: null, rank_by: 'auto', basis: 'gross', table: { flights: [], prizes: [] } }; const _gamesFormSide = { scramble: { dollar_per_player: 12, payout: 'top3', place_shares: [40, 20, 10], podium_total: 70 } };
    function toggleGamesFormGame(k) { if (_gamesFormSelected.has(k)) { _gamesFormSelected.delete(k); _gamesFormPrizes = { dollar_per_player: null, rank_by: 'auto', basis: 'gross', table: { flights: [], prizes: [] } }; } else _gamesFormSelected.add(k); }
    function pzRefresh() {}\n` + ['gamesFormScrambleInPrizes', 'gamesFormScrambleToPrizes'].map(n => extractFn(src, n)).join('\n'), c2);
  const R2 = c => vm.runInContext(c, c2);
  ok(R2('gamesFormScrambleInPrizes()') === false, 'a normal Scramble is not in Flights & places');
  R2('gamesFormScrambleToPrizes()');
  ok(R2('gamesFormScrambleInPrizes()') === true && R2('_gamesFormSide.scramble.dollar_per_player') === 0 && R2('_gamesFormSide.scramble.podium_total') === undefined && R2("_gamesFormSelected.has('podium')") && R2('_gamesFormPrizes.rank_by') === 'scramble' && c2._went === 'podium', 'choosing Flights & places clears the Scramble pot, turns Prizes on ranked by the Scramble, and goes to the Prizes screen'); }
console.log(`${pass} passed, ${fail} failed`); if (fail) process.exit(1);
