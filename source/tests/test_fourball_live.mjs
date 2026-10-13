// Dev-93 — BestBall live standings: engine board (partial cards, to-par ranking, net) + Live Panel section.
import fs from 'fs'; import vm from 'vm';
import { extractFn, loadEngine } from './extract.mjs';
import { fileURLToPath } from 'url';
const src = fs.readFileSync(fileURLToPath(new URL('../portal.html', import.meta.url)), 'utf8');
let pass = 0, fail = 0;
const eq = (a, b, m) => { const ok = JSON.stringify(a) === JSON.stringify(b); ok ? pass++ : fail++; if (!ok) console.log('FAIL', m, '\n  got', JSON.stringify(a), '\n  exp', JSON.stringify(b)); };
const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const E = loadEngine();
const PARS = [4,4,3,4,5,4,5,3,4, 3,5,4,4,4,3,4,5,3];
const card = (player, n, over = {}) => ({ player, holes: PARS.map((p, i) => (i < n ? (over[i + 1] ?? p) : null)) });
const row = (fb = {}, extra = {}) => ({ games: ['fourball'], dollar_per_player: 20, game_configs: { fourball: { dollar_per_player: 20, basis: 'gross', net_mode: 'own', pairs: [['Ann','Bob'],['Cy','Dee']], ...fb } }, ...extra });

// ── engine board
{
  const b = E.fourballBoard(row(), [card('Ann', 5, { 2: 3 }), card('Bob', 5), card('Cy', 7, { 1: 3 }), card('Dee', 3)], PARS);
  eq(b.rows.map(r => [r.pair.join('&'), r.played, r.thru, r.total, r.to_par, r.place]), [['Cy&Dee', 7, 7, 28, -1, 1], ['Ann&Bob', 5, 5, 19, -1, 1]], 'board: partial cards, pairs on different holes ranked by score to par (tie at -1)');
  ok(b.rows.every(r => r.tied), 'board: tie flagged'); eq(b.ranked_by, 'to_par', 'board: ranked by to-par when pars known');
  const noPar = E.fourballBoard(row(), [card('Ann', 5), card('Bob', 5), card('Cy', 5, { 1: 3 }), card('Dee', 5)], null);
  eq(noPar.ranked_by, 'total', 'board: no pars -> by total'); eq(noPar.rows[0].pair, ['Cy', 'Dee'], 'board: lower total leads without pars');
  const early = E.fourballBoard(row(), [card('Ann', 2), card('Bob', 2)], PARS);
  eq(early.rows.map(r => [r.pair.join('&'), r.played]), [['Ann&Bob', 2], ['Cy&Dee', 0]], 'board: a pair with no scores yet sits last, unranked'); eq(early.rows[1].place, null, 'board: unranked pair has no place');
  eq(E.fourballBoard(row(), [], PARS).rows.every(r => r.played === 0), true, 'board: nothing saved yet');
  ok(E.fourballBoard({ games: ['skins'], dollar_per_player: 10 }, [card('Ann', 18)], PARS) === null, 'board: null when the game has no BestBall');
  const full = E.fourballBoard(row(), [card('Ann', 18), card('Bob', 18), card('Cy', 18, { 3: 4 }), card('Dee', 18, { 3: 4 })], PARS);
  ok(full.rows.every(r => r.complete) && full.rows[0].pair.join('&') === 'Ann&Bob', 'board: finished cards are marked F and agree with the payout winner');
  const snap = E.computeGatheringGamesPayout(row(), [card('Ann', 18), card('Bob', 18), card('Cy', 18, { 3: 4 }), card('Dee', 18, { 3: 4 })], {}, []);
  eq(snap.fourball.winners, [full.rows[0].pair], 'board never disagrees with the Close result');
  // net: strokes change who leads, same as the payout would
  const hc = { allowance: 100, skins_basis: 'gross', birdiepay_basis: 'gross', stroke_index: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18], players: { Ann: { strokes: 0, stroke_index: null }, Bob: { strokes: 0 }, Cy: { strokes: 18, kind: 'given' }, Dee: { strokes: 18, kind: 'given' } } };
  const net = E.fourballBoard(row({ basis: 'net' }, { handicap_config: hc }), [card('Ann', 18), card('Bob', 18), card('Cy', 18), card('Dee', 18)], PARS);
  eq(net.basis, 'net', 'board: net basis carried'); eq(net.rows[0].pair, ['Cy', 'Dee'], 'board: net strokes lift the stroked pair');
}

// ── portal section + loader
const ctx = { console, JSON, Math, Number, String, Set, Map, Array, Object, Date, BFEngine: E, SCORECARD_API: 'https://sc', currentPlayer: 'Cy',
  escapeHtml: s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])),
  _gatheringGamesIndex: new Map([[7, row()]]), panelGamesGid: e => e.gatheringId, gamesScoreKeyForGid: g => 'gathering:' + g,
  csResolvePars: () => PARS, ensureVenueTeeInfoByName: async () => null, csNormalizedVenueName: () => 'BSGC', latestScorecardPerPlayer: rows => rows, renderLiveBanner: () => { ctx.rendered++; }, rendered: 0, fetched: [],
  gatheringAddon: (c, id) => (c && c.addons.find(a => a.id === id)) || null,
  fetch: async url => { ctx.fetched.push(url); return { json: async () => ({ scorecards: [card('Ann', 5), card('Bob', 5), card('Cy', 7, { 1: 3 }), card('Dee', 3)] }) }; } };
vm.createContext(ctx);
vm.runInContext('let _fbLive = null;\n' + ['loadFourballLive','fourballLiveSectionHtml'].map(n => extractFn(src, n)).join('\n') + '\nthis.api={loadFourballLive,fourballLiveSectionHtml,get:()=>_fbLive};', ctx);
const cfg = E.gatheringConfigFromLegacy(row());
ok(/Loading standings/.test(ctx.api.fourballLiveSectionHtml(cfg)), 'section: loading state before the first fetch');
await ctx.api.loadFourballLive({ gatheringId: 7 });
ok(ctx.fetched[0].includes('event=gathering%3A7') && ctx.fetched[0].includes('input=strokes'), 'loader: reads this game\'s strokes scorecards');
ok(ctx.rendered === 1, 'loader: re-renders the panel when scores arrive');
const html = ctx.api.fourballLiveSectionHtml(cfg);
ok(html.includes('Cy &amp; Dee') && html.includes('Ann &amp; Bob') && html.includes('thru 7') && html.includes('thru 5'), 'section: both pairs with holes played');
ok(html.includes('-1') || html.includes('−1'), 'section: score to par shown'); ok(html.includes('⭐'), 'section: your own pair is marked');
ok(/gross/.test(html), 'section: says gross');
await (async () => { ctx._gatheringGamesIndex = new Map([[7, { games: ['skins'] }]]); await ctx.api.loadFourballLive({ gatheringId: 7 }); ok(ctx.api.get() === null, 'loader: no BestBall -> nothing kept'); })();
// wiring guards
ok(/loadFourballLive\(getLiveEvent\(\)\)/.test(src) && /loadFourballLive\(evt\);/.test(src), 'panel open and the 60s refresh both reload standings');
ok(/showFourballSection \? `/.test(src), 'the BestBall section only appears for a BestBall game');
console.log(`fourball live: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
