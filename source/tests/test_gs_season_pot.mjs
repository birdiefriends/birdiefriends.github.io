// GS Season Pot (Dev-97): $20 ante per qualifier, Overall 40% + flights equal thirds, 50/30/20, a missing place spread over all prizes, floored, ties averaged.
import fs from 'fs'; import vm from 'vm';
import { extractFn } from './extract.mjs';
const src = fs.readFileSync(new URL('../BF_Golf_Scorer_8.html', import.meta.url), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const ctx = {}; vm.createContext(ctx); const defLine = src.match(/const GS_POT_DEFAULTS = .*;/)[0];
vm.runInContext(defLine + '\n' + ['gsPotNormalize', 'gsPotFromForm', 'computeSeasonPot'].map(n => extractFn(src, n)).join('\n') + '; this.f = computeSeasonPot; this.norm = gsPotNormalize; this.form = gsPotFromForm;', ctx);
const f = ctx.f;
const mk = (flight, n, base) => Array.from({ length: n }, (_, i) => ({ name: flight[0] + (i + 1), seriesFlight: flight, qualifies: true, performance: base - i }));
const amounts = (r, k) => r.groups.find(g => g.key === k).rows.map(x => x.amount);

// this year: 19 qualified = 8 Green + 9 Combo + 2 Gold; Gold has no 3rd place
let ps = [...mk('Green', 8, 8), ...mk('Combo', 9, 7.5), ...mk('Gold', 2, 6.5)];
let r = f(ps);
ok(r.pot === 380 && r.qualifiers === 19, 'pot is 19 x $20 = $380');
ok(JSON.stringify(amounts(r, 'overall')) === '[79,47,31]', 'Overall 40%: $79 / $47 / $31 (got ' + amounts(r, 'overall') + ')');
ok(JSON.stringify(amounts(r, 'Green')) === '[39,23,15]' && JSON.stringify(amounts(r, 'Combo')) === '[39,23,15]', 'Green and Combo: $39 / $23 / $15');
ok(JSON.stringify(amounts(r, 'Gold')) === '[39,23]', 'Gold pays two places: $39 / $23');
ok(r.paid === 373 && r.house === 7, 'paid $373, $7 left for the house (got ' + r.paid + ' / ' + r.house + ')');
ok(Math.abs(r.unpaidShare - 15.2) < 1e-6, 'the unpaid Gold 3rd was $15.20');

// every place filled: no reallocation, factor 1
ps = [...mk('Green', 4, 8), ...mk('Combo', 4, 7.5), ...mk('Gold', 4, 6.5)];
r = f(ps);
ok(r.factor === 1 && r.unpaidShare === 0 && r.pot === 240, 'full flights: nothing reallocated');
ok(JSON.stringify(amounts(r, 'overall')) === '[48,28,19]' && JSON.stringify(amounts(r, 'Green')) === '[24,14,9]', 'full flights pay straight 50/30/20 (floored)');

// last year's sheet: 20 players, Overall 50%, two flights at 25%: $100/$60/$40 and $50/$30/$20
ps = [...mk('Green', 10, 8), ...mk('Gold', 10, 5.5)];
r = f(ps, { overallPct: 0.5, flights: ['Green', 'Gold'] });
ok(r.pot === 400, 'last year: $400 pot');
ok(amounts(r, 'overall')[0] === 100 && amounts(r, 'overall')[1] === 60 && amounts(r, 'overall')[2] === 40, 'last year Overall: $100 / $60 / $40 (got ' + amounts(r, 'overall') + ')');
ok(JSON.stringify(amounts(r, 'Green')) === '[50,30,20]' && JSON.stringify(amounts(r, 'Gold')) === '[50,30,20]', 'last year flights: $50 / $30 / $20');
ok(r.house === 0, 'last year: all $400 paid');

// ties: a tie for Overall 2nd averages 2nd and 3rd; a tie for 1st averages 1st and 2nd
ps = [...mk('Green', 8, 8), ...mk('Combo', 9, 7.5), ...mk('Gold', 2, 6.5)];
ps[0].performance = 20; ps[1].performance = 15; ps[2].performance = 15;   // G1 first, G2 and G3 tied second
r = f(ps);
let og = r.groups[0].rows;
ok(og.length === 2 && og[1].tied && og[1].names.length === 2 && og[1].amount === Math.floor((47 + 31) / 2), 'tie for 2nd: (2nd + 3rd) / 2 each = $39');
ps[0].performance = 20; ps[1].performance = 20;
r = f(ps); og = r.groups[0].rows;
ok(og[0].tied && og[0].amount === Math.floor((79 + 47) / 2) && og[1].place === 3 && og[1].amount === 31, 'tie for 1st: (1st + 2nd) / 2 each = $63, then 3rd is $31');
ps[0].performance = 20; ps[1].performance = 20; ps[2].performance = 20;
r = f(ps); og = r.groups[0].rows;
ok(og.length === 1 && og[0].names.length === 3 && og[0].amount === Math.floor((79 + 47 + 31) / 3), 'three-way tie for 1st shares all three prizes');

// non-qualifiers neither pay in nor win; an empty flight pays nothing and its pool is spread over the rest
ps = [...mk('Green', 6, 8), ...mk('Combo', 6, 7)]; ps.push({ name: 'X', seriesFlight: 'Gold', qualifies: false, performance: 99 });
r = f(ps);
ok(r.qualifiers === 12 && r.pot === 240, 'a non-qualifier is not in the pot');
ok(r.groups.find(g => g.key === 'Gold').rows.length === 0 && r.paid <= r.pot && r.paid >= r.pot - 10, 'no Gold qualifiers: the Gold pool goes to everyone else (paid $' + r.paid + ')');
ok(JSON.stringify(f([])) .includes('"pot":0') && f([]).paid === 0, 'no qualifiers: nothing to pay');

// ---- settings: defaults, normalising, form validation, custom settings flow through ----
const dflt = ctx.norm();
ok(dflt.ante === 20 && dflt.overallPct === 0.4 && dflt.placePct.join() === '0.5,0.3,0.2' && dflt.flights.join() === 'Green,Combo,Gold', 'no settings = the 2026 defaults');
ok(ctx.norm({ ante: -5, overallPct: 7, placePct: [0.5, 0.2], flights: ['Nope'] }).ante === 20 && ctx.norm({ placePct: [0.5, 0.2] }).placePct.join() === '0.5,0.3,0.2', 'bad stored values fall back to the defaults, per field');
let fm = ctx.form({ ante: '25', overall: '30', places: ['60', '40', '', '', ''], flights: ['Green', 'Gold'] });
ok(!fm.problems.length && fm.settings.ante === 25 && Math.abs(fm.settings.overallPct - 0.3) < 1e-9 && fm.settings.placePct.join() === '0.6,0.4' && fm.settings.flights.join() === 'Green,Gold', 'a valid form becomes settings (two paid places, two flights)');
ok(ctx.form({ ante: '20', overall: '40', places: ['50', '30', '10', '', ''], flights: ['Green'] }).problems.some(x => /add up to 100/.test(x)), 'places that do not add to 100 are refused');
ok(ctx.form({ ante: '0', overall: '40', places: ['100', '', '', '', ''], flights: ['Green'] }).problems.some(x => /ante/.test(x)), 'a $0 ante is refused');
ok(ctx.form({ ante: '20', overall: '120', places: ['100', '', '', '', ''], flights: ['Green'] }).problems.some(x => /Overall/.test(x)), 'Overall over 100% is refused');
ok(ctx.form({ ante: '20', overall: '40', places: ['50', '', '50', '', ''], flights: ['Green'] }).problems.some(x => /gaps/.test(x)), 'a gap between places is refused');
ok(ctx.form({ ante: '20', overall: '40', places: ['100', '', '', '', ''], flights: [] }).problems.some(x => /flight/.test(x)), 'no flights is refused');
// custom settings drive the numbers: $25 ante, Overall 30%, two places 60/40, Green and Gold only
ps = [...mk('Green', 5, 8), ...mk('Combo', 5, 7.5), ...mk('Gold', 5, 6.5)];
r = f(ps, fm.settings);
ok(r.pot === 375 && r.groups.length === 3 && r.groups[0].rows.length === 2, 'custom: $25 x 15 = $375, Overall and two flights, two places each');
ok(amounts(r, 'overall').join() === [Math.floor(375 * 0.3 * 0.6), Math.floor(375 * 0.3 * 0.4)].join(), 'custom: Overall 30% split 60/40 (got ' + amounts(r, 'overall') + ')');
ok(r.opts.flights.join() === 'Green,Gold', 'the settings used come back with the result');
console.log(`gs_season_pot: ${pass} pass, ${fail} fail`); process.exit(fail ? 1 : 0);
