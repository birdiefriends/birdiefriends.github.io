// Dev-94 — Match Play and Alternate Shot on the shared hole-by-hole match engine.
import fs from 'fs'; import vm from 'vm';
import { extractFn, loadEngine } from './extract.mjs';
import { fileURLToPath } from 'url';
const src = fs.readFileSync(fileURLToPath(new URL('../portal.html', import.meta.url)), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const E = loadEngine();
const card = (player, f) => ({ player, holes: Array.from({ length: 18 }, (_, i) => f(i + 1)) });
const pay = (row, cards) => E.computeGatheringGamesPayout(row, cards, {}, []);
const mp = (extra = {}, dpp = 10) => ({ games: ['matchplay'], dollar_per_player: dpp, game_configs: { matchplay: Object.assign({ dollar_per_player: dpp, basis: 'gross', matches: [['Ann', 'Bob']] }, extra) } });

// matchSegmentResult: early decision and play-on
const arr = f => Array.from({ length: 18 }, (_, i) => f(i + 1));
const upto = (n, f) => arr(h => (h <= n ? f(h) : null));
let r = E.matchSegmentResult([upto(10, () => 4), upto(10, () => 5)], { a: 0, b: 18 });
ok(r.status === 'won' && r.winner === 0 && r.decided && r.text === '10&8', 'ten holes won ahead of the rest is decided early (got ' + r.text + ')');
r = E.matchSegmentResult([upto(3, () => 4), upto(3, () => 5)], { a: 0, b: 18 });
ok(r.status === 'pending' && r.decided === false && r.text === '3 UP thru 3', 'three up after three is still live (got ' + r.text + ')');
r = E.matchSegmentResult([arr(h => (h <= 3 ? 4 : 5)).map((v, i) => (i < 16 ? v : null)), arr(() => 5).map((v, i) => (i < 16 ? v : null))], { a: 0, b: 18 });
ok(r.winner === 0 && r.text === '3&2' && r.decided, '3 up with 2 to play reads 3&2 (got ' + r.text + ')');
r = E.matchSegmentResult([arr(() => 4), arr(() => 4)], { a: 0, b: 18 });
ok(r.status === 'push' && r.text === 'Halved', 'level after 18 is Halved');
r = E.matchSegmentResult([upto(4, h => (h <= 2 ? 4 : 5)), upto(4, () => 5)], { a: 0, b: 18 });
ok(r.decided === false && r.text === '2 UP thru 4', '2 up with 14 left is far from decided (got ' + r.text + ')');

// Match Play money: winner takes both antes; play-on does not change a decided match
const ten = pay(mp(), [card('Ann', h => (h <= 10 ? 4 : 6)), card('Bob', h => (h <= 10 ? 5 : 4))]);
ok(ten.matchplay.pot === 20 && ten.payouts.find(x => x.player === 'Ann').matchplay === 20, 'Ann wins 20');
const early = pay(mp(), [card('Ann', h => (h <= 10 ? 4 : 9)), card('Bob', h => (h <= 10 ? 5 : 3))]);
ok(early.payouts.find(x => x.player === 'Ann').matchplay === 20, 'a match decided early stays decided when they play on and lose the rest');
// $0 pot: result still reported
const zero = pay(mp({ dollar_per_player: 0 }, 0), [card('Ann', () => 4), card('Bob', () => 5)]);
ok(zero.matchplay.pot === 0 && zero.matchplay.segments.groups[0].segments[0].status === 'won', '$0 match still decides a winner');
ok(zero.payouts.every(p => !p.total), '$0 moves no money');
// Net: full strokes vs off the low
const hc = nm => ({ mode: 'net', allowance: 100, stroke_index: arr(h => h), players: { Ann: { kind: 'given', strokes: 4, tee: 'W' }, Bob: { kind: 'given', strokes: 14, tee: 'W' } } });
const netRow = (mode) => Object.assign(mp({ basis: 'net', net_mode: mode, allowance: 100 }), { handicap_config: hc() });
const full = pay(netRow('own'), [card('Ann', () => 5), card('Bob', () => 5)]);
const low = pay(netRow('low'), [card('Ann', () => 5), card('Bob', () => 5)]);
ok(full.matchplay.basis === 'net' && low.matchplay.net_mode === 'low', 'net modes carried');
ok(full.matchplay.stroke_marks && low.matchplay.stroke_marks.find(m => m.player === 'Ann').strokes === 0 && low.matchplay.stroke_marks.find(m => m.player === 'Bob').strokes === 10, 'off the low: Ann 0, Bob 10');
ok(full.matchplay.stroke_marks.find(m => m.player === 'Bob').strokes === 14, 'full: Bob keeps his 14');

// Alternate Shot: one score per pair, allowance share of the two course handicaps
const asRow = (extra = {}) => ({ games: ['altshot'], dollar_per_player: 10, game_configs: { altshot: Object.assign({ dollar_per_player: 10, basis: 'gross', pairs: [['Ann', 'Bob'], ['Cy', 'Di']] }, extra) } });
const as = pay(asRow(), [card('Ann', () => 4), card('Bob', () => 4), card('Cy', () => 5), card('Di', () => 5)]);
ok(as.altshot.pot === 40 && as.payouts.find(x => x.player === 'Ann').altshot === 20, 'A-S pot 4x10, winning pair 20 each');
const asOne = pay(asRow(), [card('Ann', () => 4), card('Cy', () => 5)]); // only one partner's card carries the score
ok(asOne.altshot.standings.find(x => x.pair.includes('Ann')).complete, 'a pair needs the score on only one partner card');

// Tie in A-S = antes returned
const tie = pay(asRow(), [card('Ann', () => 4), card('Bob', () => 4), card('Cy', () => 4), card('Di', () => 4)]);
ok(tie.altshot.winners.length === 2 && tie.payouts.find(x => x.player === 'Ann').altshot === 10, 'tied A-S splits across both pairs (each 10)');

// Live helpers
const store = {};
const ctx = { console, JSON, Math, Number, String, Set, Map, Array, Object, Date, Promise, BFEngine: E, SCORECARD_API: 'x', currentPlayer: 'Ann',
  escapeHtml: s => String(s), localStorage: { getItem: () => null, setItem() {} }, window: { addEventListener() {} },
  gatheringAddon: (c, id) => (c && c.addons.find(a => a.id === id)) || null, panelGamesGid: e => e.gatheringId, gamesScoreKeyForGid: g => 'g:' + g,
  csResolvePars: () => null, ensureVenueTeeInfoByName: async () => null, csNormalizedVenueName: () => 'V', renderLiveBanner() {}, fetch: async () => ({ json: async () => ({ ok: true }) }) };
vm.createContext(ctx);
const names = ['liveScoringOn', 'skPartnerOf', 'skSetScore', 'skSetScoreOne', 'skPersist', 'skStoreKey', 'skEnsure', 'skGroups', 'skGroup', 'skCardOf', 'skQueueSave', 'skPost', 'skMaxHole', 'skPars', 'skMarks'];
vm.runInContext('let _sk = null; const _skChain = {};\n' + names.map(n => extractFn(src, n)).join('\n') + '\nthis.api={' + names.join(',') + ',get:()=>_sk};', ctx);
const A = ctx.api;
const cfgOf = ad => ({ addons: [ad], handicap: null });
ok(A.liveScoringOn(cfgOf({ id: 'matchplay', matches: [['Ann', 'Bob']] }), 1) && A.liveScoringOn(cfgOf({ id: 'altshot', pairs: [['A', 'B']] }), 1) && A.liveScoringOn(cfgOf({ id: 'fourball', pairs: [['A', 'B']] }), 1), 'all three side games have live scoring');
ok(!A.liveScoringOn({ addons: [{ id: 'skins' }] }, 1), 'Skins alone has no live scoring');
A.skEnsure({ gatheringId: 1, holes: 18 }, cfgOf({ id: 'altshot', pairs: [['Ann', 'Bob'], ['Cy', 'Di']] }));
ok(A.skGroups().length === 1 && A.skGroups()[0].players.join() === 'Ann,Bob,Cy,Di', 'A-S pairs make one foursome');
A.skSetScore('Ann', 3, 5);
ok(A.get().cards.Ann[2] === 5 && A.get().cards.Bob[2] === 5 && !(A.get().cards.Cy && A.get().cards.Cy[2]), 'A-S score is mirrored to the partner only');
A.skSetScore('Bob', 3, 0);
ok(A.get().cards.Ann[2] == null && A.get().cards.Bob[2] == null, 'clearing mirrors too');
A.skEnsure({ gatheringId: 2, holes: 18 }, cfgOf({ id: 'matchplay', matches: [['Ann', 'Bob'], ['Cy', 'Di']] }));
ok(A.skGroups().length === 2 && A.skGroups()[0].players.join() === 'Ann,Bob', 'each match is its own group of two');
A.skSetScore('Ann', 1, 4);
ok(A.get().cards.Bob == null || A.get().cards.Bob[0] == null, 'Match Play does not mirror');

// Results panel renders both games
const rctx = { escapeHtml: s => String(s).replace(/&/g, '&amp;'), BFEngine: E }; vm.createContext(rctx);
vm.runInContext(['renderGatheringPayoutHtml', 'gpTabStyle', 'gpBtnStyle'].map(n => extractFn(src, n)).join('\n') + ';this.f=renderGatheringPayoutHtml;', rctx);
const h1 = rctx.f(ten), h2 = rctx.f(as), h0 = rctx.f(zero);
ok(/Match Play/.test(h1) && /Ann/.test(h1) && /10&amp;|UP|&amp;/.test(h1), 'Match Play tab shows the result text');
ok(/Alternate Shot/.test(h2) && /A-S/.test(h2), 'Alternate Shot tab');
ok(/bragging rights/.test(h0), '$0 match says no money');

// A-S live: rows are teams, strokes belong to the pair
{
  const asCfg = { addons: [{ id: 'altshot', pairs: [['Ann', 'Bob'], ['Cy', 'Di']], basis: 'net', net_mode: 'own', allowance: 50 }],
    handicap: { mode: 'net', allowance: 95, stroke_index: arr(h => h), players: { Ann: { kind: 'index', course_hcp: 10, strokes: 9 }, Bob: { kind: 'index', course_hcp: 20, strokes: 19 }, Cy: { kind: 'index', course_hcp: 10, strokes: 9 }, Di: { kind: 'index', course_hcp: 10, strokes: 9 } } } };
  A.skEnsure({ gatheringId: 3, holes: 18 }, asCfg);
  const mk = A.skMarks();
  ok(mk.get('ann').strokes === 15 && mk.get('bob').strokes === 15 && mk.get('cy').strokes === 10, 'A-S pair strokes = 50% of the two course handicaps added (15, 10)');
  ok(mk.get('ann').got[1] === 1 && mk.get('ann').got[15] === 1 && !mk.get('ann').got[16], 'pair gets a stroke on the 15 hardest holes');
}
const lsrc = extractFn(src, 'liveScoreModeHtml');
ok(/asMode/.test(lsrc) && /units/.test(lsrc), 'Live Score shows teams in Alternate Shot');

console.log(`test_side_games: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
