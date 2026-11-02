// Money tab: once the season is marked FINAL, a Season Pot column is added and counted in each player's total; before that it is unchanged.
import fs from 'fs'; import vm from 'vm';
import { JSDOM } from 'jsdom';
import { extractFn } from './extract.mjs';
const src = fs.readFileSync(new URL('../BF_Golf_Scorer_8.html', import.meta.url), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const ctx = { GS_VERSION: 't', Date, Math, console, JSON, Object, Array, String, Number, Set }; vm.createContext(ctx);
let code = ''; for (const n of ['gsPotNormalize', 'gsSeasonPotHTML', 'computeSeasonPot', 'calcSeriesPerformance', 'buildRetroactiveE1Event', 'generateSeriesPage']) { try { code += extractFn(src, n) + '\n'; } catch (e) {} }
vm.runInContext(src.match(/const GS_POT_DEFAULTS = .*;/)[0] + '\n' + code + '; this.g = generateSeriesPage;', ctx);
const mkEv = (i, r) => ({ eventName: 'E' + i, tee: 'Green', quota: 20, actual: 20 + r, result: r, hcp: 5 });
const hist = r => ({ tee: 'Green', seriesFlight: 'Green', currentHcp: 5, currentQuota: 20, events: [1, 2, 3, 4].map(i => mkEv(i, r)) });
const sd = { events: [1, 2, 3, 4].map(i => ({ name: 'E' + i, date: '2026-0' + i + '-01', scores: { Ann: {}, Bob: {}, Cy: {} } })), playerHistory: { Ann: hist(5), Bob: hist(3), Cy: hist(1) } };
const tab = pot => new JSDOM(ctx.g('2026', { ...sd, potSettings: pot })).window.document.querySelector('#tab-money');
let t = tab({ final: false });
ok(!/Season Pot/.test(t.textContent), 'in season: no Season Pot column');
t = tab({ final: true });
ok(/Season Pot/.test(t.querySelector('thead').textContent), 'final: Season Pot column present');
const row = n => [...t.querySelectorAll('tbody tr')].find(r => r.children[1].textContent === n);
const cells = n => [...row(n).children].map(c => c.textContent);
const sum = n => { const c = cells(n); return +c[c.length - 1].replace('$', ''); };
ok(/\$\d+\.00/.test(cells('Ann')[5]), 'winner shows pot dollars');
ok(sum('Ann') >= 1, 'total includes pot');
console.log('gs_money_final: ' + pass + ' pass, ' + fail + ' fail'); process.exit(fail ? 1 : 0);
