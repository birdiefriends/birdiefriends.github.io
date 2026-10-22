// Dev-94 — Hi-Lo: 2 points a hole (low ball + high ball), ties give nobody the point, head to head pairs.
import fs from 'fs'; import vm from 'vm';
import { extractFn, loadEngine } from './extract.mjs';
import { fileURLToPath } from 'url';
const src = fs.readFileSync(fileURLToPath(new URL('../portal.html', import.meta.url)), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const E = loadEngine();
const arr = f => Array.from({ length: 18 }, (_, i) => f(i + 1));
const card = (player, f) => ({ player, holes: arr(f) });
const row = (extra = {}) => ({ games: ['hilo'], dollar_per_player: 10, game_configs: { hilo: Object.assign({ dollar_per_player: 10, basis: 'gross', pairs: [['Ann', 'Bob'], ['Cy', 'Di']] }, extra) } });
const run = (r, cards) => E.computeGatheringGamesPayout(r, cards, {}, []);

// registry
ok(E.gameTraits('hilo').headToHead && E.gameTraits('hilo').unit === 'pair' && E.gameTraits('hilo').allowance === 'round', 'traits');
ok(E.gamesInUiOrder().includes('hilo'), 'in UI order');
ok(!E.validateGameConfig('hilo', { dollar_per_player: 5, pairs: [['A', 'B']] }).ok, 'one pair is not enough');
ok(!E.validateGameConfig('hilo', { dollar_per_player: 5, pairs: [['A', 'B'], ['C', 'D'], ['E', 'F']] }).ok, 'three pairs is not a whole foursome');
ok(E.validateGameConfig('hilo', { dollar_per_player: 0, pairs: [['A', 'B'], ['C', 'D']] }).ok, '$0 allowed');

// hole math: Ann 3 / Bob 7 vs Cy 4 / Di 5 -> low to Ann&Bob, high to Cy&Di each hole = 18-18, a push
let s = run(row(), [card('Ann', () => 3), card('Bob', () => 7), card('Cy', () => 4), card('Di', () => 5)]);
let seg = s.hilo.segments.groups[0].segments[0];
ok(seg.points[0] === 18 && seg.points[1] === 18 && seg.status === 'push', 'split points push (got ' + seg.points + ' ' + seg.status + ')');
ok(s.payouts.every(p => p.total === 10), 'antes back on a push');

// ties give nobody the point: lows tie 4-4, highs 5 vs 6 -> only the high point, 18-0
s = run(row(), [card('Ann', () => 4), card('Bob', () => 5), card('Cy', () => 4), card('Di', () => 6)]);
seg = s.hilo.segments.groups[0].segments[0];
ok(seg.points[0] === 18 && seg.points[1] === 0 && seg.nobody === 18, 'tied low gives nobody the point (got ' + seg.points + ', nobody ' + seg.nobody + ')');
ok(s.hilo.winners.length === 1 && s.hilo.winners[0].join() === 'Ann,Bob', 'winner pair');
ok(s.hilo.format === 'hilo' && s.hilo.unit === 'pair', 'snapshot format/unit');
const hole1 = s.hilo.standings.find(r => r.pair.join() === 'Ann,Bob').holes[0];
ok(hole1.score === 4 && hole1.high === 5, 'hole carries low and high');

// a hole needs both partners: one missing score and the hole is not counted
const half = [card('Ann', () => 4), { player: 'Bob', holes: arr(h => (h <= 9 ? 5 : null)) }, card('Cy', () => 6), card('Di', () => 6)];
s = run(row(), half);
seg = s.hilo.segments.groups[0].segments[0];
ok(seg.status === 'pending' && seg.points[0] === 18 && seg.points[1] === 0, 'only complete holes count, match still open (got ' + seg.status + ' ' + seg.points + ')');
ok(s.payouts.every(p => p.total === 10), 'unfinished match returns the antes');

// periods: Front / Back, each half its own pot
s = run(row({ period: 'front_back' }), [card('Ann', h => (h <= 9 ? 4 : 5)), card('Bob', h => (h <= 9 ? 5 : 6)), card('Cy', h => (h <= 9 ? 5 : 4)), card('Di', h => (h <= 9 ? 6 : 5))]);
const segs = s.hilo.segments.groups[0].segments;
ok(segs.length === 2 && segs[0].winner.join() === 'Ann,Bob' && segs[1].winner.join() === 'Cy,Di', 'each half has its own winner');
ok(s.payouts.every(p => p.total === 10), 'one pot each: even money');

// net off the low: Bob gets a stroke every hole
const net = { mode: 'net', allowance: 100, stroke_index: arr(h => h),
  players: { Ann: { kind: 'given', strokes: 0 }, Bob: { kind: 'given', strokes: 18 }, Cy: { kind: 'given', strokes: 0 }, Di: { kind: 'given', strokes: 0 } } };
s = run(Object.assign(row({ basis: 'net', net_mode: 'low' }), { handicap_config: net }), [card('Ann', () => 5), card('Bob', () => 5), card('Cy', () => 5), card('Di', () => 5)]);
seg = s.hilo.segments.groups[0].segments[0];
ok(s.hilo.basis === 'net' && seg.points[0] === 18 && seg.points[1] === 0 && seg.nobody === 18, 'net off the low: Bob\'s stroke wins the low point, highs tie (got ' + s.hilo.basis + ' ' + seg.points + ')');

// match view and results text
const cards = [card('Ann', () => 4), card('Bob', () => 5), card('Cy', () => 5), card('Di', () => 6)];
s = run(row(), cards);
const mv = E.sideMatchView(s.hilo);
const g = mv.groups[0];
ok(mv.win_by === 'points' && g.holes[0].pa === 2 && g.holes[0].pb === 0 && g.holes[0].res === 'A', 'view: hole is worth 2 points to the pair that wins both');
ok(g.segs[0].points[0] === 36 && g.segs[0].final, 'view: 36 points to the winner (got ' + g.segs[0].points + ')');
const res = E.sideGroupResults(s.hilo);
ok(res.length === 1 && res[0].status === 'won' && res[0].winner === 0 && res[0].big === '36 – 0', 'headline is the winner\'s points (got ' + res[0].big + ')');
ok(res[0].perPlayer === 20, 'pays $20 each');

// split holes in the story: a 1-1 hole is a tie
s = run(row(), [card('Ann', () => 3), card('Bob', () => 7), card('Cy', () => 4), card('Di', () => 5)]);
const g2 = E.sideMatchView(s.hilo).groups[0];
ok(g2.holes[0].pa === 1 && g2.holes[0].pb === 1 && g2.holes[0].res === 'T', 'view: 1-1 hole is square');
ok(E.sideGroupResults(s.hilo)[0].status === 'halved', 'level match is halved');

// live view in progress
s = run(row(), [card('Ann', h => (h <= 3 ? 4 : null)), card('Bob', h => (h <= 3 ? 5 : null)), card('Cy', h => (h <= 3 ? 5 : null)), card('Di', h => (h <= 3 ? 5 : null))]);
const live = E.fourballMatchView(s.hilo, row().game_configs.hilo).groups[0];
ok(live.segs[0].played === 3 && !live.segs[0].final && live.segs[0].lead === 3 * 1 + 3 * 0 + 0 || live.segs[0].lead > 0, 'live: leading in points, not final (lead ' + live.segs[0].lead + ')');

// off the low is per foursome, and the live strokes (sideStrokeSets) match what the engine scores
{
  const mk = (n, k) => [n, { kind: 'given', strokes: k }];
  const hc = { mode: 'net', allowance: 100, stroke_index: arr(h => h), players: Object.fromEntries([mk('Ann', 4), mk('Bob', 10), mk('Cy', 6), mk('Di', 8), mk('Ed', 20), mk('Flo', 22), mk('Gus', 25), mk('Hal', 30)]) };
  const r = { games: ['hilo'], dollar_per_player: 10, handicap_config: hc, game_configs: { hilo: { dollar_per_player: 10, basis: 'net', net_mode: 'low', pairs: [['Ann', 'Bob'], ['Cy', 'Di'], ['Ed', 'Flo'], ['Gus', 'Hal']] } } };
  const sets = E.sideStrokeSets(E.gatheringConfigFromLegacy(r), { all: true }).find(x => x.id === 'hilo');
  const k = n => sets.rows.find(x => x.names[0] === n).strokes;
  ok(k('Ann') === 0 && k('Cy') === 2 && k('Di') === 4 && k('Bob') === 6, 'foursome 1: low is Ann (4): Ann 0, Cy 2, Di 4, Bob 6');
  ok(k('Ed') === 0 && k('Hal') === 10 && k('Gus') === 5, 'foursome 2 has its own low (Ed 20)');
  const snap = run(r, ['Ann', 'Bob', 'Cy', 'Di', 'Ed', 'Flo', 'Gus', 'Hal'].map(n => card(n, () => 5)));
  const m = n => snap.hilo.stroke_marks.find(x => x.player === n).strokes;
  ok(m('Bob') === 6 && m('Hal') === 10 && m('Ed') === 0, 'engine scoring uses the same strokes (got ' + m('Bob') + '/' + m('Hal') + '/' + m('Ed') + ')');
  ok(Object.keys(sets.rows.find(x => x.names[0] === 'Bob').got).length === 6, 'six holes marked for Bob');
}

// legacy config + suggested amounts
const cfg = E.gatheringConfigFromLegacy(row());
ok(cfg.addons.some(a => a.id === 'hilo' && a.pairs.length === 2), 'legacy config carries hilo');
const sug = E.suggestGameAmounts({ dollarPerPlayer: 20, players: 4, games: ['hilo'] });
ok(sug.hilo && sug.hilo.dollar_per_player > 0, 'suggested amount for hilo');

// portal form pieces
const ctx = { BFEngine: E, GW_SIDE_STEP: { altshot: 'aspairs', hilo: 'hlpairs', matchplay: 'mpmatches' }, GAMES_FORM_REC_ALLOWANCE: { altshot: 50, matchplay: 100 } }; vm.createContext(ctx);
vm.runInContext(['gamesFormSideBlank', 'gamesFormSideFrom'].map(n => extractFn(src, n)).join('\n') + '\nthis.api={gamesFormSideBlank,gamesFormSideFrom};', ctx);
const blank = ctx.api.gamesFormSideBlank('hilo');
ok(Array.isArray(blank.pairs) && blank.net_mode === 'low' && blank.allowance === undefined, 'form blank: pairs, off-the-low (recommended) strokes, no own allowance');
const frm = ctx.api.gamesFormSideFrom('hilo', { dollar_per_player: 5, basis: 'net', net_mode: 'low', pairs: [['A', 'B'], ['C', 'D']] });
ok(frm.pairs.length === 2 && frm.net_mode === 'low' && frm.basis === 'net', 'form loads an existing config');
ok(/GW_SIDE_STEP = \{[^}]*hilo: 'hlpairs'/.test(src) && /hlpairs: 'Hi-Lo pairs'/.test(src), 'wizard knows the Hi-Lo steps');

console.log(`test_hilo: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
