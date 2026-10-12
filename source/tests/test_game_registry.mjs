// Dev-93 (spec §13.5) — conformance loop over EVERY registered game. No per-game test code:
// a new game is done when it has a definition, fixtures, and this passes.
import { createRequire } from 'module'; import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const E = require(fileURLToPath(new URL('../bf_engine.js', import.meta.url)));
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const TYPES = ['money', 'int', 'holes', 'pars', 'enum', 'pairs'];
const addons = E.listGames('addon'), bases = E.listGames('base');
ok(addons.length >= 4 && bases.length >= 1, 'registry lists add-ons and base games');

for (const id of [...addons, ...bases]) {
  const g = E.getGame(id);
  // 1. required members
  ok(g.id === id, id + ': id matches key');
  ok(g.kind === (addons.includes(id) ? 'addon' : 'base'), id + ': kind');
  ok(g.meta && g.meta.label && g.meta.icon && typeof g.meta.info === 'string' && 'seal' in g.meta, id + ': meta label/icon/seal/info');
  ok(['strokes', 'hole_result', 'none'].includes(g.input), id + ': input declared');
  ok(typeof g.net === 'boolean', id + ': net flag declared');
  ok(Array.isArray(g.config) && Array.isArray(g.fixtures), id + ': config + fixtures arrays');
  if (g.kind === 'addon') ok(typeof g.carve === 'function' && Number.isFinite(g.order), id + ': carve + order');
  // 2. config schema well-formed; defaults match their type
  const keys = new Set();
  g.config.forEach(f => {
    ok(f.key && !keys.has(f.key) && f.label && TYPES.includes(f.type), id + '.' + f.key + ': field well-formed');
    keys.add(f.key);
    const d = f.default;
    if (f.type === 'holes' || f.type === 'pars') ok(Array.isArray(d), id + '.' + f.key + ': default is an array');
    if (f.type === 'money' || f.type === 'int') ok(Number.isFinite(Number(d)), id + '.' + f.key + ': default is numeric');
    if (f.type === 'enum') ok((f.values || []).includes(d), id + '.' + f.key + ': default is a listed value');
  });
  ok(JSON.stringify(E.defaultConfig(id)) === JSON.stringify(E.defaultConfig(id)), id + ': defaultConfig is stable');
  // 3. fixtures: config validates, payout reproduces expect exactly
  if (g.kind === 'addon') ok(g.fixtures.length >= 1, id + ': has at least one fixture');
  g.fixtures.forEach(fx => {
    const a = fx.round.addons.find(x => x.id === id);
    const v = E.validateGameConfig(id, a);
    ok(v.ok, id + ' / ' + fx.name + ': fixture config validates ' + v.errors.join(';'));
    const r = E.computeRoundPayout({ v: 1, payout: { entry_per_player: fx.round.dollar_per_player }, addons: fx.round.addons, handicap: fx.round.handicap }, fx.inputs);
    if (fx.expect.payouts) ok(r.payouts.every(p => p.total === (fx.expect.payouts[p.player] ?? 0)) && r.payouts.length === Object.keys(fx.expect.payouts).length, id + ' / ' + fx.name + ': payouts ' + JSON.stringify(r.payouts.map(p => [p.player, p.total])));
    ok(r.unallocated === fx.expect.unallocated, id + ' / ' + fx.name + ': unallocated ' + r.unallocated);
    Object.entries(fx.expect.results || {}).forEach(([gid, want]) => Object.entries(want).forEach(([k, val]) => ok(r[gid] && r[gid][k] === val, id + ' / ' + fx.name + ': ' + gid + '.' + k + ' = ' + (r[gid] && r[gid][k]))));
    // conservation on every fixture: everything paid + unallocated = pot
    const paid = r.payouts.reduce((a, p) => a + p.total, 0);
    ok(Math.abs(paid + r.unallocated - r.total_pot) < 1e-9, id + ' / ' + fx.name + ': conservation');
  });
}

// 4. validator rejects bad configs (per type), accepts the defaults' shape where complete
ok(!E.validateGameConfig('cttp', { dollar_per_hole: 3, holes: [] }).ok, 'cttp: empty holes rejected');
ok(!E.validateGameConfig('cttp', { dollar_per_hole: 3, holes: [3, 3] }).ok, 'cttp: duplicate holes rejected');
ok(!E.validateGameConfig('cttp', { dollar_per_hole: 0, holes: [3] }).ok, 'cttp: $0 rejected');
ok(!E.validateGameConfig('birdieball', { dollar_per_player: -1 }).ok, 'birdieball: negative rejected');
ok(!E.validateGameConfig('birdiepay', { dollar_per_birdie: 2, pars: [4, 4] }).ok, 'birdiepay: short par table rejected');
ok(!E.validateGameConfig('skins', { basis: 'weird' }).ok, 'skins: bad basis rejected');
ok(E.validateGameConfig('skins', {}).ok, 'skins: empty config valid (basis optional)');
ok(!E.validateGameConfig('nope', {}).ok, 'unknown game rejected');

// 5. generic pot-fit guard reproduces the Dev-89 portal wording and numbers
let pf = E.potFit({ cttp: { dollar_per_hole: 5, holes: [3, 7, 12, 16] }, birdieball: { dollar_per_player: 2 } }, 10, 4);
ok(pf.fixedCost === 20 + 8 && pf.pot === 40 && pf.problem === null, 'potFit: fits');
pf = E.potFit({ cttp: { dollar_per_hole: 10, holes: [3, 7, 12, 16] }, birdieball: { dollar_per_player: 2 } }, 10, 4);
ok(pf.problem === 'CTP + MiserBall come to $48.00, more than the $40.00 pot (4 confirmed × $10.00) — lower a rate or raise $ per Player', 'potFit: over-commit text matches portal: ' + pf.problem);
pf = E.potFit({ birdieball: { dollar_per_player: 12 } }, 10, 4);
ok(pf.problem === 'MiserBall ($12.00/player) is more than the whole $10.00 each player puts in', 'potFit: rate above buy-in text matches portal');
ok(E.potFit({ cttp: { dollar_per_hole: 10, holes: [3] } }, 10, 0).problem === null, 'potFit: no headcount, no CTP complaint');

// 6. conservation fuzz across random add-on mixes (the registry must never pay out more than the pot)
let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const pars = [4, 4, 3, 5, 4, 4, 3, 5, 4, 4, 4, 3, 5, 4, 4, 3, 5, 4];
for (let t = 0; t < 400; t++) {
  const n = 2 + Math.floor(rnd() * 7);
  const cards = Array.from({ length: n }, (_, i) => ({ player: 'P' + i, holes: pars.map(p => Math.max(1, p + Math.floor(rnd() * 4) - 1)) }));
  const chosen = addons.filter(() => rnd() < 0.6);
  const cfgs = chosen.map(id => id === 'cttp' ? { id, dollar_per_hole: 1 + Math.floor(rnd() * 8), holes: [3, 7, 12, 16].slice(0, 1 + Math.floor(rnd() * 4)) }
    : id === 'birdieball' ? { id, dollar_per_player: 1 + Math.floor(rnd() * 5) }
    : id === 'birdiepay' ? { id, dollar_per_birdie: 1 + Math.floor(rnd() * 6), pars }
    : id === 'fourball' ? { id, entity: 'pair', dollar_per_player: 1 + Math.floor(rnd() * 6), basis: 'gross', pairs: Array.from({ length: Math.floor(n / 2) }, (_, k) => ['P' + 2 * k, 'P' + (2 * k + 1)]) }
    : { id, basis: 'gross', compare: 'low' });
  const dpp = 5 + Math.floor(rnd() * 20);
  const r = E.computeRoundPayout({ v: 1, payout: { entry_per_player: dpp }, addons: cfgs }, { scorecards: cards, ctpLeaders: { 3: { player: 'P0', dist: 5 } }, bbAnswers: cards.map((c, i) => ({ player_name: c.player, kept: i % 2 === 0, lost_hole: 5, lost_stroke: 1 })) });
  const paid = r.payouts.reduce((a, p) => a + p.total, 0);
  ok(Math.abs(paid + r.unallocated - r.total_pot) < 1e-9, 'fuzz ' + t + ': conservation (' + chosen.join(',') + ')');
}
// 7. UI helpers: stable host-facing order, unique uiOrder, text lives only in the definition
ok(E.gamesInUiOrder().join() === 'fourball,lowscore,skins,cttp,birdieball,birdiepay', 'UI order: Format group first (Fourball, Low Score), then the side games in their old order');
ok(new Set(addons.map(id => E.getGame(id).meta.uiOrder)).size === addons.length, 'uiOrder is unique per game');
ok(E.gamesInUiOrder().includes('fourball') && E.gamesUiMeta().fourball && E.gamesInfo().fourball, 'released Fourball shows in the portal tables');
ok((() => { const g = E.getGame('fourball'); g.released = false; const hidden = !E.gamesInUiOrder().includes('fourball') && !E.gamesUiMeta().fourball; g.released = true; return hidden; })(), 'the released flag still hides a game when off');
ok(E.gamesInfo().skins === E.getGame('skins').meta.info && E.gamesSealLabels().birdiepay === 'BIRDIE PAY' && E.gamesUiMeta().birdieball.label === 'MiserBall', 'helpers read the definitions');

// 8. THE POINT OF THE REGISTRY: a brand-new game appears in the UI tables, validation and the pot-fit guard
//    with no other code. (Registered at runtime here, then removed.)
E.ADDONS.demo = { id: 'demo', kind: 'addon', order: 50, entity: 'individual', input: 'none', net: false,
  meta: { label: 'Demo Game', icon: '🧪', seal: 'DEMO', info: 'A test game.', uiOrder: 9 },
  config: [{ key: 'dollar_per_player', type: 'money', label: '$ per player', default: 0, positive: true }],
  fixedCost: (cfg, ctx) => cfg.dollar_per_player * ctx.players, fixtures: [], carve() { return {}; } };
ok(E.gamesUiMeta().demo.label === 'Demo Game' && E.gamesSealLabels().demo === 'DEMO' && E.gamesInfo().demo === 'A test game.', 'new game shows up in the portal tables');
ok(E.gameSchemas().demo.config.length === 1 && E.validateGameConfig('demo', { dollar_per_player: 0 }).ok === false, 'new game is validated and exported to the Worker schema table');
ok(E.potFit({ demo: { dollar_per_player: 4 } }, 10, 4).fixedCost === 16, 'new game counts in the pot-fit guard');
delete E.ADDONS.demo;
ok(!E.gamesUiMeta().demo, 'demo game removed again');

// 9. the portal must not hand-list games again
import fs from 'fs';
const psrc = fs.readFileSync(fileURLToPath(new URL('../portal.html', import.meta.url)), 'utf8');
ok(!/GAMES_SEAL_LABELS = \{/.test(psrc), 'portal: no hand-written seal table');
ok(!/const GATHERING_GAMES_META = \{/.test(psrc), 'portal: no hand-written game meta table');
ok(!/(?:^|\n)\s+(skins|cttp|birdieball|birdiepay):\s+'(?:Every hole|Closest|Everyone|A flat)/.test(psrc), 'portal: no hand-written (i) text for a game');
ok(/function gamesFormOverCommit[\s\S]{0,900}BFEngine\.potFit\(/.test(psrc), 'portal: over-commit guard uses BFEngine.potFit');
// 10. Fourball specifics
{
  const full = v => Array.from({ length: 18 }, () => v);
  const card = (player, holes, extra) => Object.assign({ player, holes }, extra || {});
  const run = (addon, cards, opts) => E.computeRoundPayout(Object.assign({ v: 1, payout: { entry_per_player: 10 }, addons: [Object.assign({ id: 'fourball', entity: 'pair', basis: 'gross' }, addon)] }, opts || {}), { scorecards: cards });
  const PAIRS = [['Ann', 'Bob'], ['Cy', 'Di']];
  // better-ball helper
  const bb = E.betterBallHoles([[4, 6, null], [5, 3, null]], 3);
  ok(bb[0].score === 4 && bb[0].by.join() === '0' && bb[1].score === 3 && bb[1].by.join() === '1' && bb[2] === null, 'betterBallHoles: lower of the two, null when neither scored');
  // a pickup: Bob has no scores at all; Ann's alone count (pair still complete)
  let r = run({ dollar_per_player: 10, pairs: PAIRS }, [card('Ann', full(4)), card('Bob', full(null)), card('Cy', full(5)), card('Di', full(5))]);
  ok(r.fourball.standings[0].total === 72 && r.fourball.winners.length === 1 && r.fourball.winners[0].join() === 'Ann,Bob', 'a partner with no scores: the other\'s stand alone');
  // an incomplete pair (a hole nobody scored) is listed, cannot win
  const gap = full(4); gap[5] = null;
  r = run({ dollar_per_player: 10, pairs: PAIRS }, [card('Ann', gap), card('Bob', gap), card('Cy', full(5)), card('Di', full(6))]);
  ok(r.fourball.winners[0].join() === 'Cy,Di' && r.fourball.standings.find(s => s.pair[0] === 'Ann').complete === false, 'an incomplete pair cannot win even with a lower score');
  // nobody complete: the carve is given back
  r = run({ dollar_per_player: 10, pairs: PAIRS }, [card('Ann', gap), card('Bob', gap), card('Cy', gap), card('Di', gap)]);
  ok(r.fourball.winners.length === 0 && r.fourball.given_back_each === 10 && r.payouts.every(p => p.total === 10), 'no complete pair: whole carve given back');
  // a $2/player carve is $8 for the pair ($4 each); with no Skins the rest of the $40 pot is given back evenly ($8 each)
  r = run({ dollar_per_player: 2, pairs: PAIRS }, [card('Ann', full(4)), card('Bob', full(5)), card('Cy', full(5)), card('Di', full(5))]);
  const tot2 = n => r.payouts.find(p => p.player === n).total;
  ok(r.fourball.per_pair === 8 && r.fourball.per_player === 4 && tot2('Ann') === 12 && tot2('Bob') === 12 && tot2('Cy') === 8 && tot2('Di') === 8 && r.unallocated === 0, 'carve $8 -> $4 each; leftover $32 given back $8 each (no Skins to absorb it)');
  // an odd split: a $1/player carve = $4 pot, pair share $4, $2 each
  r = run({ dollar_per_player: 1, pairs: PAIRS }, [card('Ann', full(4)), card('Bob', full(5)), card('Cy', full(5)), card('Di', full(5))]);
  ok(r.fourball.per_pair === 4 && r.fourball.per_player === 2, 'small carve splits cleanly between partners');
  // cap: carve rate above the pot is capped to what the pot has left
  r = run({ dollar_per_player: 50, pairs: PAIRS }, [card('Ann', full(4)), card('Bob', full(5)), card('Cy', full(5)), card('Di', full(5))]);
  ok(r.fourball.capped === true && r.fourball.pot === 40 && r.fourball.configured_pot === 200, 'a carve bigger than the pot is capped');
  // Net: own vs low
  const hc = (strokes) => ({ handicap: { mode: 'net', allowance: 95, stroke_index: Array.from({ length: 18 }, (_, i) => i + 1), players: Object.fromEntries(Object.entries(strokes).map(([k, v]) => [k, { kind: 'given', strokes: v }])) } });
  const fives = [card('Ann', full(5)), card('Bob', full(5)), card('Cy', full(5)), card('Di', full(5))];
  const strokes = { Ann: 9, Bob: 9, Cy: 18, Di: 18 };
  const own = run({ dollar_per_player: 10, basis: 'net', net_mode: 'own', pairs: PAIRS }, fives, hc(strokes));
  const low = run({ dollar_per_player: 10, basis: 'net', net_mode: 'low', pairs: PAIRS }, fives, hc(strokes));
  const tot = (res, n) => res.fourball.standings.find(s => s.pair[0] === n).total;
  ok(tot(own, 'Ann') === 81 && tot(own, 'Cy') === 72, 'net own: Ann pair 81, Cy pair 72 (each plays off their own strokes)');
  ok(tot(low, 'Ann') === 90 && tot(low, 'Cy') === 81, 'net low: strokes come off the low handicap (9): Ann pair 90, Cy pair 81');
  ok(own.fourball.net_mode === 'own' && low.fourball.net_mode === 'low' && low.fourball.basis === 'net', 'result reports basis and net mode');
  // net asked for but no handicap setup: plays gross and says so
  r = run({ dollar_per_player: 10, basis: 'net', pairs: PAIRS }, fives);
  ok(r.fourball.net_missing === true && r.fourball.basis === 'gross', 'net with no handicap setup falls back to gross and flags it');
  // pair validation
  const V = p => E.validateGameConfig('fourball', Object.assign({ dollar_per_player: 5, pairs: PAIRS }, p));
  ok(V({}).ok, 'valid fourball config');
  ok(!V({ pairs: [['Ann', 'Bob']] }).ok, 'one pair is not enough');
  ok(!V({ pairs: [['Ann', 'Ann'], ['Cy', 'Di']] }).ok, 'a pair of the same player is rejected');
  ok(!V({ pairs: [['Ann', 'Bob'], ['bob', 'Di']] }).ok, 'a player in two pairs is rejected (case-insensitive)');
  ok(!V({ pairs: [['Ann', 'Bob'], ['Cy']] }).ok, 'a pair needs two players');
  ok(!V({ net_mode: 'weird' }).ok && !V({ dollar_per_player: 0 }).ok, 'bad net_mode / $0 rejected');
  // old snapshots keep their shape: no fourball key unless the game ran
  const plain = E.computeRoundPayout({ v: 1, payout: { entry_per_player: 10 }, addons: [{ id: 'skins', entity: 'individual', basis: 'gross', compare: 'low' }] }, { scorecards: fives });
  ok(!('fourball' in plain) && !plain.payouts.some(p => 'fourball' in p), 'snapshots without Fourball keep their exact shape');
  // generic pot-fit sees it
  ok(E.potFit({ fourball: { dollar_per_player: 5, pairs: PAIRS } }, 10, 4).fixedCost === 20, 'potFit counts the Fourball carve');
}
// 11. Fourball through the Gathering adapter: the row shape the Worker returns -> payout
{
  const full = v => Array.from({ length: 18 }, () => v);
  const SI = Array.from({ length: 18 }, (_, i) => i + 1);
  const FB = { dollar_per_player: 10, basis: 'net', net_mode: 'own', pairs: [['Ann', 'Bob'], ['Cy', 'Di']] };
  const cards = [{ player: 'Ann', holes: full(6) }, { player: 'Bob', holes: full(5) }, { player: 'Cy', holes: full(5) }, { player: 'Di', holes: full(6) }];
  const row = { games: ['fourball'], dollar_per_player: 10, cttp_config: null, birdieball_config: null, birdiepay_config: null,
    game_configs: { fourball: FB }, handicap_config: { allowance: 95, skins_basis: 'gross', stroke_index: SI, players: { Ann: { kind: 'given', strokes: 0 }, Bob: { kind: 'given', strokes: 9 }, Cy: { kind: 'given', strokes: 0 }, Di: { kind: 'given', strokes: 0 } } } };
  const cfg = E.gatheringConfigFromLegacy(row);
  ok(cfg.addons.length === 1 && cfg.addons[0].id === 'fourball' && cfg.addons[0].basis === 'net' && cfg.handicap.mode === 'net', 'adapter builds a net fourball round config');
  let r = E.computeGatheringGamesPayout(row, cards, null, []);
  ok(r.payouts.find(p => p.player === 'Ann').total === 20 && r.payouts.find(p => p.player === 'Bob').total === 20 && r.payouts.find(p => p.player === 'Cy').total === 0 && r.fourball.net_mode === 'own', 'Worker-shaped row pays the net winners (Ann/Bob $20 each)');
  // basis net but no handicap_config at all must not throw; plays gross and says so
  r = E.computeGatheringGamesPayout(Object.assign({}, row, { handicap_config: null }), cards, null, []);
  ok(r.payouts.every(p => p.total === 10) && r.handicap && r.handicap.missing.length === 4, 'net with no handicap_config: no crash, plays everyone at 0 strokes (a gross tie split) and lists all four as missing, same rule as Skins');
  // a games list without fourball ignores a stray game_configs.fourball
  ok(E.gatheringConfigFromLegacy(Object.assign({}, row, { games: ['skins'] })).addons.every(a => a.id !== 'fourball'), 'fourball config is ignored unless the game is ticked');
}
// Dev-93: picker groups — Format above Side games, driven by the registry
{
  const m = E.gamesUiMeta();
  ok(m.fourball.group === 'format' && ['skins','cttp','birdieball','birdiepay'].every(k => m[k].group === 'side'), 'groups: Fourball is a format, the rest are side games');
  ok(E.GAME_GROUPS.map(g => g[1]).join() === 'Format,Side games', 'groups: headings Format / Side games');
  const order = E.gamesInUiOrder(); const lastFormat = Math.max(...order.map((k, i) => m[k].group === 'format' ? i : -1)); const firstSide = order.findIndex(k => m[k].group === 'side');
  ok(lastFormat < firstSide, 'groups: every format sorts before every side game');
}
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
