import fs from 'fs'; import vm from 'vm'; import { extractFn, loadEngine } from './extract.mjs';
import { fileURLToPath } from 'url';
const HERE = (p) => fileURLToPath(new URL(p, import.meta.url));
const src = fs.readFileSync(HERE('../portal.html'), 'utf8');
const ctx = { BFEngine: loadEngine() }; vm.createContext(ctx); // Dev-88: portal delegates to bf_engine.js
vm.runInContext(extractFn(src, 'computeGatheringGamesPayout') + ';this.f=computeGatheringGamesPayout;', ctx);
const f = ctx.f; let pass = 0, fail = 0;
const eq = (a, b, msg) => { const ok = JSON.stringify(a) === JSON.stringify(b); ok ? pass++ : fail++; if (!ok) console.log('FAIL', msg, '\n  got', JSON.stringify(a), '\n  exp', JSON.stringify(b)); };
const h = (arr) => arr; // 18 holes
const base = (over) => Array(18).fill(5).map((v, i) => over[i + 1] ?? v);
const P = n => payoutsOf => payoutsOf.payouts.find(r => r.player === n);

// Scenario A: 8 registered, 7 played. $20/player, CTP $10 x 2 holes, BB $2/player.
const cfg = { games: ['skins','cttp','birdieball'], dollar_per_player: 20, cttp_config: { dollar_per_hole: 10, holes: [7, 3] }, birdieball_config: { dollar_per_player: 2 } };
const cards = [
  { player: 'Ann',  holes: base({ 1: 3 }) },          // wins hole 1 outright
  { player: 'Bob',  holes: base({ 2: 3, 4: 4 }) },    // wins 2; ties on 4
  { player: 'Cy',   holes: base({ 4: 4 }) },
  { player: 'Dee',  holes: base({ 5: 2 }) },          // wins 5
  { player: 'Ed',   holes: base({}) },
  { player: 'Flo',  holes: base({}) },
  { player: 'Gus',  holes: base({}) },
];
const r = f(cfg, cards, { 3: { player: 'ed', dist: 12 } }, [
  { player_name: 'Ann', kept: true }, { player_name: 'Bob', kept: true },
  { player_name: 'Cy', kept: false, lost_hole: 16, lost_stroke: 2 },
  { player_name: 'Hal', kept: true }  // registered but no scorecard — must not count
]);
eq(r.players_count, 7, 'N = scorecards in');
eq(r.total_pot, 140, 'pot 20x7');
eq(r.cttp.holes.map(x => [x.hole, x.player, x.paid]), [[3,'Ed',10],[7,null,0]], 'CTP sorted, canonical name, unclaimed');
eq(r.cttp.unclaimed_to_skins, 10, 'unclaimed CTP to skins');
eq([r.birdieball.pot, r.birdieball.mode, r.birdieball.winners, r.birdieball.per_winner], [14, 'kept', ['Ann','Bob'], 7], 'BB kept split, Hal excluded');
// skins pot = 140 - 20 (ctp config) - 14 (bb) + 10 unclaimed = 116; 3 skins -> 38 each, 2 unalloc
eq([r.skins.pot, r.skins.won.map(w => [w.hole, w.player]), r.skins.per_skin], [116, [[1,'Ann'],[2,'Bob'],[5,'Dee']], 38], 'skins gross outright, tie on 4 dies');
eq(r.unallocated, 2, 'skins rounding remainder reported');
eq(P('Ann')(r).total, 45, 'Ann 38+7'); eq(P('Ed')(r).total, 10, 'Ed ctp');
const paid = r.payouts.reduce((s, x) => s + x.total, 0);
eq(paid + r.unallocated, r.total_pot, 'conservation: paid + unallocated = pot');

// Scenario B: nobody kept BB -> longest held wins; tie at longest splits.
const rb = f({ games: ['birdieball'], dollar_per_player: 5, birdieball_config: { dollar_per_player: 5 } },
  [{player:'A',holes:base({})},{player:'B',holes:base({})},{player:'C',holes:base({})}], {},
  [{player_name:'A',kept:false,lost_hole:12,lost_stroke:3},{player_name:'B',kept:false,lost_hole:14,lost_stroke:1},{player_name:'C',kept:false,lost_hole:14,lost_stroke:1}]);
eq([rb.birdieball.mode, rb.birdieball.winners, rb.birdieball.per_winner, rb.unallocated], ['longest',['B','C'],7,1], 'longest-held tie splits, floor 15/2');
const rb2 = f({ games: ['birdieball'], dollar_per_player: 5, birdieball_config: { dollar_per_player: 5 } },
  [{player:'A',holes:base({})},{player:'B',holes:base({})}], {},
  [{player_name:'A',kept:false,lost_hole:14,lost_stroke:2},{player_name:'B',kept:false,lost_hole:14,lost_stroke:1}]);
eq(rb2.birdieball.winners, ['A'], 'later stroke on same hole wins');

// Scenario C: no skins won at all -> give back evenly, floored.
const rc = f({ games: ['skins'], dollar_per_player: 10 }, [{player:'A',holes:base({})},{player:'B',holes:base({})},{player:'C',holes:base({})}], {}, []);
eq([rc.skins.won.length, rc.skins.given_back_each, rc.unallocated], [0, 10, 0], 'no skins -> give back');
const rc2 = f({ games: ['skins','cttp'], dollar_per_player: 10, cttp_config:{dollar_per_hole:5,holes:[3]} }, [{player:'A',holes:base({})},{player:'B',holes:base({})},{player:'C',holes:base({})}], {3:{player:'A'}}, []);
eq([rc2.skins.pot, rc2.skins.given_back_each, rc2.unallocated], [25, 8, 1], 'no skins give-back after CTP carve-out, floored');

// Scenario D: 9-hole cards, null holes skipped, zeros ignored.
const rd = f({ games: ['skins'], dollar_per_player: 10 }, [
  {player:'A', holes:[3,4,null,4,4,4,4,4,4]}, {player:'B', holes:[4,4,2,4,4,4,4,4,0]}, {player:'C', holes:[4,4,3,4,4,4,4,4,null]}], {}, []);
eq(rd.skins.won.map(w => [w.hole, w.player]), [[1,'A'],[3,'B']], '9-hole, null/0 skipped; hole 9 has 1 score -> no skin');

// Scenario E: no BB answers -> give back
const re = f({ games: ['birdieball','skins'], dollar_per_player: 10, birdieball_config:{dollar_per_player:3} }, [{player:'A',holes:base({1:3})},{player:'B',holes:base({})}], {}, []);
eq([re.birdieball.mode, re.birdieball.given_back_each, re.skins.pot, re.skins.per_skin], ['none', 3, 14, 14], 'no BB answers -> give back; skins gets rest');
eq(re.payouts.reduce((s,x)=>s+x.total,0) + re.unallocated, re.total_pot, 'conservation E');

// Scenario F: no players
const rf = f(cfg, [], {}, []);
eq([rf.players_count, rf.total_pot, rf.payouts.length], [0, 0, 0], 'empty close');
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
