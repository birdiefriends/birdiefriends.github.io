// Handicap strokes in the live panels: engine strokeMarksFor, Live Score pad, player card, Live Actions boxes.
import fs from 'fs'; import vm from 'vm'; import { fileURLToPath } from 'url';
import { extractFn, loadEngine } from './extract.mjs';
const src = fs.readFileSync(fileURLToPath(new URL('../portal.html', import.meta.url)), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const eq = (a, b, m) => { const g = JSON.stringify(a) === JSON.stringify(b); g ? pass++ : fail++; if (!g) console.log('FAIL', m, '\n  got', JSON.stringify(a), '\n  exp', JSON.stringify(b)); };
const E = loadEngine();
const SI = [7,1,15,3,11,5,13,17,9,8,2,16,4,12,6,14,18,10];
const PARS = [4,4,3,4,5,4,5,3,4,3,5,4,4,4,3,4,5,3];
const names = ['Ann','Bob','Cy','Dee'];
const hc = st => ({ allowance: 95, players: Object.fromEntries(names.map((n, i) => [n, { kind: 'given', strokes: st[i], stroke_index: SI }])) });
const row = (mode, st) => ({ games: ['fourball'], dollar_per_player: 10, handicap_config: hc(st), game_configs: { fourball: { dollar_per_player: 10, basis: 'net', net_mode: mode, pairs: [['Ann','Bob'],['Cy','Dee']] } } });
// engine
let m = E.strokeMarksFor(row('own', [10, 4, 0, 2]), names);
eq(Object.keys(m[1].got).map(Number), [2, 4, 11, 13], 'own: Bob gets his four');
eq(m.map(x => x.strokes), [10, 4, 0, 2], 'own: strokes as set');
m = E.strokeMarksFor(row('low', [10, 4, 3, 5]), names);
eq(m.map(x => x.strokes), [7, 1, 0, 2], 'low: Off the low (lowest in the pairs is 3)');
ok(E.strokeMarksFor(E.gatheringConfigFromLegacy(row('own', [10, 4, 0, 2])), ['Ann'])[0].strokes === 10, 'accepts the engine config as well as the row');
ok(E.strokeMarksFor({ games: ['fourball'], dollar_per_player: 10, game_configs: { fourball: { dollar_per_player: 10, basis: 'gross', pairs: [['Ann','Bob'],['Cy','Dee']] } } }, ['Ann'])[0].known === false, 'a gross game has no marks');
ok(E.strokeMarksFor(row('own', [10, 4, 0, 2]), ['Zed'])[0].known === false, 'unknown player: known=false, no dots');
// portal pad
const store = {};
const ctx = { console, JSON, Math, Number, String, Set, Map, Array, Object, Date, Promise, BFEngine: E, SCORECARD_API: 'https://sc', currentPlayer: 'Ann',
  escapeHtml: s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])),
  localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; } },
  panelGamesGid: e => e.gatheringId, gamesScoreKeyForGid: g => 'gathering:' + g, csResolvePars: () => PARS,
  renderLiveBanner() {}, window: { addEventListener() {} }, gatheringAddon: (c, id) => (c && c.addons.find(a => a.id === id)) || null };
vm.createContext(ctx);
const fns = ['skStoreKey','skEnsure','skGroups','skGroup','skMaxHole','skPars','skMode','skMarks','skGot','skAnyStrokes','skDotsHtml','skCardOf','liveScoreModeHtml','fourballPlayerCardHtml'];
vm.runInContext('let _sk = null; let _fbUi = { view: "group", hole: null, drill: null };\n' + fns.map(n => extractFn(src, n)).join('\n') + '\nthis.api={' + fns.join(',') + ',get:()=>_sk};', ctx);
const A = ctx.api;
const cfgNet = E.gatheringConfigFromLegacy(row('own', [10, 4, 0, 2]));
A.skEnsure({ gatheringId: 7, name: 'R', holes: 18 }, cfgNet);
A.get().hole = 2; A.get().sel = -1;
let h = A.liveScoreModeHtml();
ok((h.match(/gets a stroke/g) || []).length === 3, 'hole 2: Ann, Bob and Dee each get a stroke on the pad (Cy none)');
A.get().cards['Ann'] = new Array(18).fill(null); A.get().cards['Ann'][1] = 5;
h = A.liveScoreModeHtml();
ok(/net 4/.test(h), 'a typed 5 with a stroke shows net 4');
A.get().hole = 1; A.get().cards['Ann'][0] = 5; h = A.liveScoreModeHtml();
ok(/Hole 2: [^<]*get/.test(h) && /Ann/.test(h.match(/Hole 2:[^<]*/)[0]), 'hole 1 pad says who gets a stroke on hole 2');
// player card
A.get().hole = 1; const card = A.fourballPlayerCardHtml(0);
ok(/gold dots are handicap strokes/.test(card) && /border-radius:50%/.test(card), 'player card marks the holes with dots and says what they are');
// gross game: nothing
const cfgG = E.gatheringConfigFromLegacy({ games: ['fourball'], dollar_per_player: 10, game_configs: { fourball: { dollar_per_player: 10, basis: 'gross', pairs: [['Ann','Bob'],['Cy','Dee']] } } });
A.get().config = cfgG; A.get()._marksKey = null; A.get().hole = 2;
h = A.liveScoreModeHtml();
ok(!/gets a stroke|net \d/.test(h) && !/Hole 3:/.test(h), 'gross round: no dots, no net preview, no next-hole line');
// Live Actions source carries the dots
ok(/liveDots\(h\.hole, done\)/.test(src) && /Scores in the boxes are net/.test(src), 'Live Actions boxes and sheet carry the strokes');
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
