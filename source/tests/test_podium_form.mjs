// The Games prize editor (Individual Low Score → Places & flights): state changes, the pot check, and that it draws.
import fs from 'fs'; import vm from 'vm'; import { extractFn, loadEngine } from './extract.mjs'; import { fileURLToPath } from 'url';
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const src = fs.readFileSync(fileURLToPath(new URL('../portal.html', import.meta.url)), 'utf8');
const FN = ['lsPodiumResultsHtml', 'lsPodiumPot', 'lsPodiumPlan', 'lsPodiumToggle', 'lsPodiumPreset', 'lsPodiumFlightName', 'lsPodiumFlightTee', 'lsPodiumAddFlight', 'lsPodiumRemoveFlight', 'lsPodiumAddPlace', 'lsPodiumRemovePlace', 'lsPodiumPrize', 'lsPodiumCheckHtml', 'lsPodiumHtml'];
const els = {}; let refreshes = 0;
const ctx = { Math, Number, String, Array, Object, JSON, parseFloat, escapeHtml: s => String(s), document: { getElementById: id => els[id] || null }, refreshGamesFormLowscoreSection() { refreshes++; } };
vm.createContext(ctx);
vm.runInContext(`let _gamesFormLowscoreConfig = { dollar_per_player: 20, basis: 'gross', period: 'round' }; let _gamesFormYesCount = 20; const _gamesFormTouched = new Set(); const CS_TEE_OPTIONS = ['Black','Blue','Green','White','Yellow','Gold','Red','Silver'];\n` + FN.map(n => extractFn(src, n)).join('\n'), ctx);
const R = c => vm.runInContext(c, ctx);
ok(R('lsPodiumPlan()') === null, 'no prize table until the host asks for one');
R('lsPodiumToggle(true)'); ok(R('_gamesFormLowscoreConfig.podium.prizes.length') === 1 && R('_gamesFormLowscoreConfig.period') === 'round', 'turning it on starts with Overall 1st = the whole pot');
R("lsPodiumPreset('both')"); ok(R('_gamesFormLowscoreConfig.podium.flights.length') === 2 && R('_gamesFormLowscoreConfig.podium.prizes.length') === 3, 'Overall + 2 flights preset');
ok(R('lsPodiumPlan().pot') === 400 && Math.abs(R('lsPodiumPlan().left')) < 0.01, '20 players x $20 = $400; the preset pays 100% of it');
R("lsPodiumFlightName(0, 'Green')"); R("lsPodiumFlightTee(0, 'Green')"); R("lsPodiumFlightName(1, 'Combo+')"); R("lsPodiumFlightTee(1, 'Gold')"); R("lsPodiumFlightTee(1, 'White')");
ok(R('_gamesFormLowscoreConfig.podium.flights[0].tees.join()') === 'Green' && R('_gamesFormLowscoreConfig.podium.flights[1].tees.join()') === 'Gold,White', 'tee boxes pick a flight');
R("lsPodiumFlightTee(1, 'White')"); ok(R('_gamesFormLowscoreConfig.podium.flights[1].tees.join()') === 'Gold', 'tapping a tee again removes it');
R("lsPodiumAddPlace('overall')"); ok(R("_gamesFormLowscoreConfig.podium.prizes.filter(x => x.scope === 'overall').map(x => x.place).join()") === '1,2', 'Add a place gives the next place');
R("lsPodiumPrize(R_IDX = 0, 'v', '25')".replace('R_IDX = ', '')); ok(R('_gamesFormLowscoreConfig.podium.prizes[0].pct') === 25, 'typing in a percent row sets the percent');
R("lsPodiumPrize(0, 'unit', 'amount')"); R("lsPodiumPrize(0, 'v', '150')"); ok(R('_gamesFormLowscoreConfig.podium.prizes[0].amount') === 150 && R('_gamesFormLowscoreConfig.podium.prizes[0].pct') === undefined, 'switching a prize to dollars keeps one unit');
els['ls-pod-check'] = { innerHTML: '' }; R("lsPodiumPrize(0, 'v', '999')"); ok(/reduced to fit/.test(els['ls-pod-check'].innerHTML), 'a table bigger than the pot warns as you type');
R("lsPodiumRemoveFlight(0)"); ok(R("_gamesFormLowscoreConfig.podium.flights.length") === 1 && !R("_gamesFormLowscoreConfig.podium.prizes.some(x => x.scope === 'f1')"), 'removing a flight removes its prizes');
const h = R("lsPodiumHtml(_gamesFormLowscoreConfig, 'round')"); ok(/Overall/.test(h) && /Add a flight/.test(h) && /Players on these tee boxes/.test(h), 'the editor draws overall, flights, and the tee picker');
R('lsPodiumToggle(false)'); ok(R('_gamesFormLowscoreConfig.podium') === undefined && !/Overall/.test(R("lsPodiumHtml(_gamesFormLowscoreConfig, 'round')")), 'Winner takes all removes the table');
// the published result draws: every prize with who took it
{ const E = loadEngine(), ALL = n => Array(18).fill(n), mk = (player, per) => ({ player, holes: ALL(per), hole_count: 18 });
  const r = E.computeRoundPayout({ payout: { entry_per_player: 20 }, addons: [{ id: 'lowscore', entity: 'individual', dollar_per_player: 20, basis: 'gross', podium: { flights: [{ id: 'g', name: 'Green', tees: ['Green'] }], prizes: [{ scope: 'overall', place: 1, amount: 30 }, { scope: 'g', place: 1, amount: 10 }] } }] }, { scorecards: [mk('Ann', 4), mk('Bob', 5)], teeByPlayer: new Map([['bob', 'Green']]) });
  const lbl = t => `<h>${t}</h>`, line = (a, b) => `<l>${a}|${b}</l>`, m = v => '$' + v;
  const html = ctx.lsPodiumResultsHtml(r.lowscore, lbl, line, m, x => String(x), x => String(x).toLowerCase());
  ok(/Overall/.test(html) && /Green/.test(html) && /<b>Ann<\/b> \$30/.test(html) && /<b>Bob<\/b> \$10/.test(html), 'the results show each prize and its winner'); }
console.log(`${pass} passed, ${fail} failed`); if (fail) process.exit(1);
