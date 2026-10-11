// Dev-93 (spec §13.5) — conformance loop over EVERY registered game. No per-game test code:
// a new game is done when it has a definition, fixtures, and this passes.
import { createRequire } from 'module'; import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const E = require(fileURLToPath(new URL('../bf_engine.js', import.meta.url)));
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const TYPES = ['money', 'int', 'holes', 'pars', 'enum'];
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
    : { id, basis: 'gross', compare: 'low' });
  const dpp = 5 + Math.floor(rnd() * 20);
  const r = E.computeRoundPayout({ v: 1, payout: { entry_per_player: dpp }, addons: cfgs }, { scorecards: cards, ctpLeaders: { 3: { player: 'P0', dist: 5 } }, bbAnswers: cards.map((c, i) => ({ player_name: c.player, kept: i % 2 === 0, lost_hole: 5, lost_stroke: 1 })) });
  const paid = r.payouts.reduce((a, p) => a + p.total, 0);
  ok(Math.abs(paid + r.unallocated - r.total_pot) < 1e-9, 'fuzz ' + t + ': conservation (' + chosen.join(',') + ')');
}
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
