// My Series page: the "Final results" card appears only when the season is marked over, shows the player's own rank and Season Pot winnings, and carries no Cup data.
import fs from 'fs'; import vm from 'vm';
import { JSDOM } from 'jsdom';
import { extractFn } from './extract.mjs';
const src = fs.readFileSync(new URL('../BF_Golf_Scorer_8.html', import.meta.url), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const ctx = { GS_VERSION: 't', Date, Math, console, JSON, Object, Array, String, Number, Set }; vm.createContext(ctx);
vm.runInContext(src.match(/const GS_POT_DEFAULTS = .*;/)[0] + '\n' + ['gsPotNormalize', 'computeSeasonPot', 'buildRetroactiveE1Event', 'generateMyGamePage'].map(n => extractFn(src, n)).join('\n') + '; this.g = generateMyGamePage;', ctx);
// 5 players, 4 events each, one short of qualifying
const mkEv = (i, r) => ({ eventName: 'E' + i, tee: 'Green', quota: 20, actual: 20 + r, result: r, hcp: 5 });
const hist = (r, n = 4) => ({ tee: 'Green', seriesFlight: 'Green', currentHcp: 5, currentQuota: 20, events: Array.from({ length: n }, (_, i) => mkEv(i + 1, r)) });
const sd = { events: [1, 2, 3, 4].map(i => ({ name: 'E' + i, date: '2026-0' + i + '-01' })), playerHistory: { Ann: hist(5), Bob: hist(3), Cy: hist(1), Di: hist(-1), Ed: hist(2, 2) } };
const render = (pot) => { const html = ctx.g('2026', { ...sd, potSettings: pot }); const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://birdiefriends.com/mygame.html' }); return { html, w: dom.window }; };
const text = (w, n) => { w.showPlayer(n); return w.document.getElementById('player-content').textContent.replace(/\s+/g, ' '); };
let r = render({ final: false });
ok(!/Final results/.test(text(r.w, 'Ann')), 'no final card while the season is in progress');
r = render({ final: true });
const a = text(r.w, 'Ann');
ok(/Final results/.test(a) && /1st overall/.test(a), 'winner sees final card and rank');
ok(/Season Pot winnings\s*\$\d+/.test(a), 'winner sees dollars');
ok(/did not qualify/.test(text(r.w, 'Ed')), 'non-qualifier told so');
ok(!/Cup/i.test(r.html), 'no Cup data on the page');
console.log('gs_mygame_final: ' + pass + ' pass, ' + fail + ' fail'); process.exit(fail ? 1 : 0);
