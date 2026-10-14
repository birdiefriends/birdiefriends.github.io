// Dev-94 — Roll the dice: a random but valid, complete setup for the crew.
import { loadEngine } from './extract.mjs';
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const E = loadEngine();
const seeded = seed => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
// which formats fit
ok(E.rollFormatsFor({ players: 3 }).join() === 'lowscore', '3 players: only Low Score');
ok(E.rollFormatsFor({ players: 2 }).join() === 'matchplay,lowscore', '2 players: Match Play or Low Score');
ok(E.rollFormatsFor({ players: 6 }).join() === 'fourball,altshot,matchplay,lowscore', '6 players: no Hi-Lo (needs foursomes)');
ok(E.rollFormatsFor({ players: 8 }).join() === 'fourball,altshot,hilo,matchplay,lowscore', '8 players: everything');
ok(E.rollGameSetup({ players: 1 }) === null, 'one player: nothing to roll');
// many rolls: valid shape, equal-ish odds, side counts 0..3, variants respect the crew
const seen = {}, sideCount = [0, 0, 0, 0], basis = { net: 0, gross: 0 }, rng = seeded(7);
for (let i = 0; i < 4000; i++) {
  const crew = { players: 8, hasHcp: true, par3: true };
  const r = E.rollGameSetup(crew, rng);
  seen[r.main] = (seen[r.main] || 0) + 1; sideCount[r.sides.length]++;
  if (r.sides.length > 3 || new Set(r.sides).size !== r.sides.length || r.sides.includes(r.main)) ok(false, 'bad sides ' + JSON.stringify(r));
  const v = r.rolled[r.main]; basis[v.basis]++;
  if (r.main !== 'lowscore' && !['own', 'low'].includes(v.net_mode)) ok(false, 'net_mode ' + r.main);
  if (v.basis === 'gross' && v.net_mode === 'low') ok(false, 'gross with off-the-low');
  if (!E.PERIODS[v.period]) ok(false, 'period ' + v.period);
  if (v.win_by && !['fourball', 'altshot'].includes(r.main)) ok(false, 'win_by on ' + r.main);
  if (r.main === 'hilo' && v.win_by) ok(false, 'hilo win_by');
}
ok(Object.keys(seen).length === 5 && Object.values(seen).every(c => c > 650 && c < 950), 'equal odds across the 5 formats ' + JSON.stringify(seen));
ok(sideCount.every(c => c > 800 && c < 1200), '0..3 side games at equal odds ' + sideCount);
ok(basis.net > 1600 && basis.gross > 1600, 'Net and Gross both come up');
// no handicaps: always gross; no par-3 data: never CTP
const r2 = Array.from({ length: 300 }, () => E.rollGameSetup({ players: 4, hasHcp: false, par3: false }, rng));
ok(r2.every(r => Object.values(r.rolled).every(v => v.basis !== 'net') && !r.sides.includes('cttp') && !r.sides.includes('birdiepay')), 'no handicaps: gross only; no par data: no CTP, no Birdie Payouts');
// the amounts suggester can balance whatever was rolled
let balanced = true;
for (let i = 0; i < 500; i++) {
  const r = E.rollGameSetup({ players: 8, hasHcp: true, par3: true }, rng), games = [r.main, ...r.sides];
  const periods = Object.fromEntries(games.map(g => [g, Math.max(1, (E.PERIODS[(r.rolled[g] || {}).period] || { segs: [] }).segs.length)]));
  const sug = E.suggestGameAmounts({ dollarPerPlayer: 20, players: 8, games, cttpHoles: 3, periods });
  const mainTot = ['fourball', 'altshot', 'hilo', 'matchplay', 'lowscore'].reduce((a, g) => a + (sug[g] ? sug[g].dollar_per_player : 0), 0);
  const fixed = mainTot + (sug.birdieball ? sug.birdieball.dollar_per_player : 0) + (sug.cttp ? sug.cttp.dollar_per_hole * sug.cttp.holes / 8 : 0);
  if (fixed > 20 + 1e-9 || mainTot < 1) { balanced = false; console.log('unbalanced', JSON.stringify(r), JSON.stringify(sug)); break; }
}
ok(balanced, 'rolled setups always fit inside the buy-in');
// every rolled variant makes a config the Worker's validator accepts (same shapes the Games form saves)
{
  const names = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const pairs = E.recommendPairs(names.map((n, i) => ({ name: n, hcp: i * 3 }))).pairs;
  const matches = names.reduce((a, n, i) => { if (i % 2 === 0) a.push([n, names[i + 1]]); return a; }, []);
  let bad = 0;
  for (let i = 0; i < 600; i++) {
    const r = E.rollGameSetup({ players: 8, hasHcp: true, par3: true }, rng), v = r.rolled[r.main], id = r.main;
    const cfg = { dollar_per_player: 12, basis: v.basis, ...(id !== 'lowscore' ? { net_mode: v.net_mode } : {}), ...(v.period !== 'round' ? { period: v.period } : {}),
      ...(id === 'matchplay' ? { matches } : id === 'lowscore' ? {} : { pairs }), ...(id === 'altshot' ? { allowance: 50 } : {}),
      ...(v.win_by ? { win_by: v.win_by, scope: v.win_by === 'holes' ? 'group' : 'field' } : {}) };
    const res = E.validateGameConfig(id, cfg);
    if (!res.ok) { bad++; if (bad < 3) console.log('invalid', id, JSON.stringify(cfg), res.errors); }
  }
  ok(bad === 0, 'every rolled format validates (' + bad + ' invalid)');
}
// random draw: pairs / matches, every player once, wipeout guard
{
  const crew = ['A','B','C','D','E','F','G','H'].map((n, i) => ({ name: n, hcp: i * 4 }));
  let allOnce = true, flagged = 0, calm = 0;
  for (let i = 0; i < 300; i++) {
    for (const kind of ['pairs', 'matches']) {
      const d = E.rollDraw(crew, kind, rng), flat = d.items.flat();
      if (flat.length !== 8 || new Set(flat).size !== 8) allOnce = false;
      if (d.lopsided !== (d.maxGap >= d.threshold)) allOnce = false;
      if (kind === 'pairs') { if (d.lopsided) flagged++; else calm++; }
    }
  }
  ok(allOnce, 'draw seats every player exactly once and flags by threshold');
  ok(flagged > 0 && calm > 0, 'random draws sometimes lopsided, sometimes fair (' + flagged + '/' + calm + ')');
  const best = E.rollDraw([{ name: 'a', hcp: 0 }, { name: 'b', hcp: 2 }, { name: 'c', hcp: 20 }, { name: 'd', hcp: 22 }], 'pairs', () => 0);
  ok(best.items.length === 2, 'four players make two pairs');
  ok(!E.rollDraw([{ name: 'a' }, { name: 'b' }, { name: 'c' }, { name: 'd' }], 'pairs').lopsided, 'no handicaps: never flagged (cannot judge)');
  ok(E.rollDraw([{ name: 'a', hcp: 0 }, { name: 'b', hcp: 12 }], 'matches').lopsided, '12-stroke 1 v 1 is flagged');
}
console.log(`test_roll: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
