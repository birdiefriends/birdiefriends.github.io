// Results show where handicap strokes landed: engine stroke_marks, heat-map dots, hole sheet text, summary note.
import fs from 'fs'; import vm from 'vm';
import { extractFn, loadEngine } from './extract.mjs';
import { fileURLToPath } from 'url';
const src = fs.readFileSync(fileURLToPath(new URL('../portal.html', import.meta.url)), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const eq = (a, b, m) => { const g = JSON.stringify(a) === JSON.stringify(b); g ? pass++ : fail++; if (!g) console.log('FAIL', m, '\n  got', JSON.stringify(a), '\n  exp', JSON.stringify(b)); };
const E = loadEngine();
const PARS = [4,4,3,4,5,4,5,3,4,3,5,4,4,4,3,4,5,3];
const SI = [7,1,15,3,11,5,13,17,9,8,2,16,4,12,6,14,18,10];
const names = ['Ann','Bob','Cy','Dee'];
const cards = (over = {}) => names.map(n => ({ player: n, holes: PARS.map((p, i) => (over[n] && over[n][i + 1]) ?? p) }));
const hc = (st) => ({ allowance: 95, players: Object.fromEntries(names.map((n, i) => [n, { kind: 'given', strokes: st[i], stroke_index: SI }])) });
const pay = (mode, st, extra = {}) => E.computeGatheringGamesPayout({ games: ['fourball'], dollar_per_player: 10, handicap_config: hc(st), game_configs: { fourball: { dollar_per_player: 10, basis: 'net', net_mode: mode, pairs: [['Ann','Bob'],['Cy','Dee']], ...extra } } }, cards({ Cy: { 3: 5 } }), {}, []);
// engine
let r = pay('own', [10, 4, 0, 2]);
eq(Object.keys(r.fourball.stroke_marks.find(m => m.player === 'Bob').got).map(Number), [2, 4, 11, 13], 'own: Bob gets strokes on his four hardest holes');
eq(r.fourball.stroke_marks.find(m => m.player === 'Cy').got, {}, 'own: a zero-stroke player gets none');
r = pay('low', [10, 4, 3, 5]);
eq([r.fourball.stroke_marks.find(m => m.player === 'Bob').strokes, r.fourball.stroke_marks.find(m => m.player === 'Cy').strokes], [1, 0], 'low: strokes come off the lowest handicap in the pairs (Bob 4-3=1, Cy 3-3=0)');
ok(!('stroke_marks' in E.computeGatheringGamesPayout({ games: ['fourball'], dollar_per_player: 10, game_configs: { fourball: { dollar_per_player: 10, basis: 'gross', pairs: [['Ann','Bob'],['Cy','Dee']] } } }, cards(), {}, []).fourball), 'gross game carries no stroke marks');
{ const row = { games: ['lowscore'], dollar_per_player: 10, handicap_config: hc([10, 4, 0, 2]), game_configs: { lowscore: { dollar_per_player: 10, basis: 'net' } } };
  const x = E.computeGatheringGamesPayout(row, cards(), {}, []); ok(x.lowscore.stroke_marks && x.lowscore.stroke_marks.find(m => m.player === 'Ann').strokes === 10, 'Low Score net carries stroke marks'); }
// portal
const ctx = { console, JSON, Math, Number, String, Set, Map, Array, Object, parseFloat, BFEngine: E,
  escapeHtml: s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])), regData: [], gameInfoBtnHtml: () => '', gameInfoPanelHtml: () => '' };
vm.createContext(ctx);
vm.runInContext(['gpTabStyle','gpBtnStyle','fbShort','fbIni','fourballResultsHeatHtml','renderGatheringPayoutHtml','gatheringAddon'].map(n => extractFn(src, n)).join('\n') + '\nthis.f={renderGatheringPayoutHtml};', ctx);
const snap = E.computeGatheringGamesPayout({ games: ['fourball'], dollar_per_player: 10, handicap_config: hc([10, 4, 0, 2]), game_configs: { fourball: { dollar_per_player: 10, basis: 'net', net_mode: 'own', pairs: [['Ann','Bob'],['Cy','Dee']] } } }, cards({ Cy: { 3: 5 } }), {}, []);
let h = ctx.f.renderGatheringPayoutHtml(snap);
ok(/border-radius:50%/.test(h) && /A dot is a handicap stroke/.test(h), 'heat map shows dots and says what they mean');
const data = [...h.matchAll(/data-fbres="([^"]+)"/g)].map(m => JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&')));
const h2 = data.find(d => d.hole === 2), h3 = data.find(d => d.hole === 3);
ok(h2 && h2.sa.length === 2 && h2.sa.map(x => x.n).sort().join() === 'Ann,Bob', 'hole 2: both Ann and Bob got a stroke (pair A)');
ok(h2.sb.map(x => x.n).join() === 'Dee', 'hole 2: Dee got a stroke (pair B)');
ok(h3 && h3.sa.length === 0 && h3.sb.length === 0, 'hole 3: nobody got a stroke');
ok(/aria-label="Hole 2, [^"]*strokes: /.test(h), 'hole boxes announce strokes for screen readers');
// no marks (older closed game): no dots, same as before
const old = JSON.parse(JSON.stringify(snap)); delete old.fourball.stroke_marks;
h = ctx.f.renderGatheringPayoutHtml(old); ok(!/A dot is a handicap stroke/.test(h) && !/border-radius:50%/.test(h), 'older games without marks show no dots');
// summary note
const withHc = { ...snap, handicap: { allowance: 95, players: [{ player: 'Ann', tee: 'White', strokes: 10 }, { player: 'Bob', strokes: 1 }] }, rankings: null };
h = ctx.f.renderGatheringPayoutHtml(withHc);
ok(/10 strokes/.test(h) && /1 stroke(<| ·)/.test(h), 'summary lists each player\'s strokes, singular for one');
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
