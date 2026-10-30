// BF Cup — tee by handicap (BFSeries tiers): each player's course handicap comes from HIS tee, and his strokes land on HIS tee's hole stroke indexes.
// Fixture = Blue Shamrock from the Venue Manager (Green 132/71.2, Green/Gold "Combo" 128/69, Gold 115/66.8; par 71) and the real Cup pool Indexes.
import { loadEngine } from './extract.mjs';
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m + ' (got ' + JSON.stringify(a) + ')');
const E = loadEngine();

const GREEN_SI = [11, 1, 13, 5, 9, 3, 7, 17, 15, 12, 10, 2, 4, 6, 16, 14, 8, 18];
const COMBO_SI = [13, 3, 11, 7, 1, 9, 17, 5, 15, 10, 18, 4, 2, 8, 14, 12, 6, 16];
const GOLD_SI = [9, 1, 13, 3, 7, 5, 11, 15, 17, 8, 16, 2, 6, 4, 14, 12, 10, 18];
const PARS = [4, 4, 3, 4, 5, 4, 5, 3, 4, 3, 5, 4, 4, 4, 3, 4, 5, 3];
const tiers = [
  { tee: 'Green', label: 'Green', maxHcp: 10, slope: 132, rating: 71.2, par: 71, strokeIndex: GREEN_SI, pars: PARS },
  { tee: 'Green/Gold', label: 'Combo', maxHcp: 18, slope: 128, rating: 69, par: 71, strokeIndex: COMBO_SI, pars: PARS },
  { tee: 'Gold', label: 'Gold', maxHcp: null, slope: 115, rating: 66.8, par: 71, strokeIndex: GOLD_SI, pars: PARS },
];
const stats = { Jordan: 3.8, Dave: 4.8, Brian: 6.8, Evan: 8.2, Nate: 10.7, Jake: 12.7, Adam: 16.2, Senior: 21 };
const mk = (extra) => Object.assign({
  sides: [{ key: 'A', players: [] }, { key: 'B', players: [] }],
  handicap: { bestball: 100, altshot: 50, singles: 100, slope: 132, rating: 71.2, par: 71, strokeIndex: GREEN_SI, pars: PARS, tiers },
  draft: { stats: Object.fromEntries(Object.entries(stats).map(([n, h]) => [n, { hcp: h }])) },
  rounds: [],
}, extra || {});

// ---------- the rule only carries tiers when the Cup has them (a one-tee Cup is byte-identical to before) ----------
ok(E.cupHandicapRule({ handicap: { slope: 132, rating: 71.2, par: 71 } }).tiers === undefined, 'no tiers configured: the rule has no tiers key');
const rule = E.cupHandicapRule(mk());
ok(Array.isArray(rule.tiers) && rule.tiers.length === 3, 'three tiers read');
ok(E.cupHandicapRule(mk({ handicap: { tiers: [{ tee: 'X', maxHcp: 10 }, { slope: 120, rating: 70, par: 72, maxHcp: null }] } })).tiers.length === 1, 'a tier without slope, rating and par is ignored');
eq(E.cupHandicapRule({ handicap: { tiers: [tiers[2], tiers[0], tiers[1]] } }).tiers.map(t => t.label), ['Green', 'Combo', 'Gold'], 'tiers sort by their upper limit, the open-ended one last');

// ---------- which tee a player plays: BFSeries rules, < 10 Green, 18 and over Gold, Combo between ----------
const tee = x => (E.cupTierFor(x, rule) || {}).label;
eq([3.8, 9.9, 10, 17.9, 18, 25].map(tee), ['Green', 'Green', 'Combo', 'Combo', 'Gold', 'Gold'], 'tee by Index');
ok(E.cupTierFor(null, rule) === null && E.cupTierFor('', rule) === null && E.cupTierFor(12, E.cupHandicapRule({})) === null, 'no Index or no tiers: no tier');

// ---------- course handicap from the player's own tee ----------
eq([3.8, 6.8, 8.2, 10.7, 12.7, 16.2, 21].map(i => E.cupCourseHcp(i, rule)), [5, 8, 10, 10, 12, 16, 17], 'course handicap per tee (Green 132/71.2, Combo 128/69, Gold 115/66.8)');
ok(E.cupCourseHcp(12.7, E.cupHandicapRule({ handicap: { slope: 132, rating: 71.2, par: 71 } })) === 15, 'the same Index on the one Green tee was 15: tiering takes 3 strokes off a Combo player');
const hc = E.cupHcpMap(mk());
ok(hc.Jake === 12 && hc.Brian === 8 && hc.Adam === 16 && hc.Senior === 17, 'the Cup handicap map uses the tiers');

// ---------- hole stroke indexes: his own tee; a pair uses the higher Index partner's tee ----------
const cfg = mk();
eq(E.cupStrokeIndexFor(cfg, ['Brian']), GREEN_SI, 'Green player places strokes on the Green indexes');
eq(E.cupStrokeIndexFor(cfg, ['Jake']), COMBO_SI, 'Combo player: the Combo indexes');
eq(E.cupStrokeIndexFor(cfg, ['Senior']), GOLD_SI, 'Gold player: the Gold indexes');
eq(E.cupStrokeIndexFor(cfg, ['Brian', 'Jake']), COMBO_SI, 'a pair takes the higher Index partner\'s tee');
eq(E.cupStrokeIndexFor(cfg, ['Brian', 'Nobody']), GREEN_SI, 'an unknown partner is ignored');
eq(E.cupStrokeIndexFor(cfg, ['Nobody']), GREEN_SI, 'no known Index falls back to the Cup\'s single tee');
eq(E.cupStrokeIndexFor(mk({ handicap: { strokeIndex: GREEN_SI } }), ['Jake']), GREEN_SI, 'a one-tee Cup always uses its tee');
ok(E.cupStrokeIndexFor({ handicap: {} }, ['Jake']) === null, 'no indexes anywhere: null, strokes cannot be placed');

// ---------- strokes in a match, then nets by hole on each player's own tee ----------
const sm = { key: 'm1', sides: [{ side: 'A', players: ['Brian'] }, { side: 'B', players: ['Jake'] }] };
const stk = E.cupMatchStrokes(sm, hc, rule);
eq(stk.players.map(x => x.strokes), [0, 4], 'singles at 100%: Jake (12) gets 4 on Brian (8)');
const round = { key: 'r1', segments: [{ key: 's', format: 'singles', from: 1, to: 18 }], matches: [sm] };
const entry = { h: {} }; for (let h = 1; h <= 18; h++) entry.h[h] = { Brian: 4, Jake: 5 };
const nets = E.cupMatchNets(cfg, round, sm, entry, round.segments[0]);
const jakeStroke = nets[1].map((v, i) => v === 4 ? i + 1 : 0).filter(Boolean);
eq(jakeStroke, [2, 5, 12, 13], 'Jake\'s 4 strokes sit on holes with Combo index 1-4 (holes 5, 13, 2, 12), not the Green ones (holes 2, 12, 6, 13)');
ok(nets[0].every(v => v === 4), 'Brian plays scratch in that match: all gross');
// the same match on a one-tee Cup puts the strokes on the Green indexes
const flat = mk({ handicap: { bestball: 100, altshot: 50, singles: 100, slope: 132, rating: 71.2, par: 71, strokeIndex: GREEN_SI } });
const nets2 = E.cupMatchNets(flat, round, sm, entry, round.segments[0]);
eq(nets2[1].map((v, i) => v === 4 ? i + 1 : 0).filter(Boolean), [2, 4, 6, 7, 12, 13, 14], 'one-tee Cup: Green indexes, and Jake (15) gets 7 on Brian (8): different strokes altogether');
ok(E.cupMatchStrokes(sm, E.cupHcpMap(flat), E.cupHandicapRule(flat)).players[1].strokes === 7, 'one-tee Cup gives Jake 7');

// ---------- foursomes: pair totals, one ball, the strokes on the receiving pair's higher-Index partner's tee ----------
const fm = { key: 'm2', sides: [{ side: 'A', players: ['Jordan', 'Dave'] }, { side: 'B', players: ['Jake', 'Adam'] }] };   // 5+6=11 vs 12+16=28
const fs = E.cupMatchStrokes(fm, hc, rule);
eq(fs.teams.map(t => t.strokes), [0, 9], 'foursomes at 50%: 17 stroke gap -> 9 (8.5 rounds up)');
const fround = { key: 'r2', segments: [{ key: 'f', format: 'altshot', from: 1, to: 18 }], matches: [fm] };
const fe = { h: {} }; for (let h = 1; h <= 18; h++) fe.h[h] = { Jordan: 5, Jake: 5 };
const fn = E.cupMatchNets(cfg, fround, fm, fe, fround.segments[0]);
const bStroke = fn[1].map((v, i) => v === 4 ? i + 1 : 0).filter(Boolean);
eq(bStroke, [2, 4, 5, 6, 8, 12, 13, 14, 17], 'the pair\'s 9 strokes land on Combo indexes 1-9 (Adam is the higher Index)');
ok(bStroke.length === 9, 'nine holes get a stroke');

// ---------- validation and defaults still hold ----------
ok(!E.cupValidate({ sides: [{ key: 'A' }, { key: 'B' }], rounds: [], handicap: { tiers, singles: 100 } }).errors.some(e => /andicap/.test(e)), 'validation raises no handicap error for a Cup with tiers');
console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
