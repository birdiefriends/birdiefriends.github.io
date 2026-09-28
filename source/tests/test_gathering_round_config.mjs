// Dev-88 — engine unification layer 2: every Gatherings UI consumer reads a
// Round Config v1 object (BFEngine.gatheringConfigFromLegacy) through the
// portal's gatheringRoundConfig()/gatheringIsGamed()/gatheringAddon() helpers
// instead of hand-checking games.includes(...)/cttp_config/birdieball_config
// on the raw bfe_gathering_games row, as five call sites used to (spec §2a.2
// principle 1). This test fuzzes rows two ways:
//  (a) FORM-VALID rows, shaped the way Host Panel's submitGatheringGames()
//      actually saves them (a game only appears in `games` together with its
//      own config) — the resolver-based read must match the OLD direct-read
//      logic (frozen one-liners below, taken verbatim from what was replaced)
//      exactly, on every case.
//  (b) MALFORMED rows (a game selected with no config, or config with no
//      dollar/holes) that the real form can never produce, but the DB could
//      still hold from old/hand-edited data. Here the resolver is STRICTER
//      than the old per-site checks (an add-on only exists when its config
//      is actually present) — a deliberate tightening, not a bug. This half
//      asserts the new behavior is well-defined (never throws, degrades to
//      "game off") and counts how often it actually diverges from the old
//      per-site logic, so the tightening is visible, not silently assumed.
import { loadEngine } from './extract.mjs';
const E = loadEngine();
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };

// OLD logic, verbatim from the five call sites before Dev-88 (see the diff):
const oldIsGamed = row => !!(row && Array.isArray(row.games) && row.games.length);
const oldShowCttp = row => !!(row && Array.isArray(row.games) && row.games.includes('cttp'));
const oldShowBB = row => !!(row && Array.isArray(row.games) && row.games.includes('birdieball'));
const oldCttpHoles = (row, fallback, def) => {
  const cfg = row ? (row.cttp_config || null) : null;
  return (cfg && Array.isArray(cfg.holes) && cfg.holes.length) ? cfg.holes : (fallback && fallback.length) ? fallback : def;
};

// NEW logic, exactly as wired into portal.html:
const config = row => row ? E.gatheringConfigFromLegacy(row) : null;
const newAddon = (row, id) => { const c = config(row); return (c && c.addons.find(a => a.id === id)) || null; };
const newShowCttp = row => !!newAddon(row, 'cttp');
const newShowBB = row => !!newAddon(row, 'birdieball');
const newCttpHoles = (row, fallback, def) => {
  const a = newAddon(row, 'cttp');
  return (a && Array.isArray(a.holes) && a.holes.length) ? a.holes : (fallback && fallback.length) ? fallback : def;
};

let seed = 88;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = a => a[Math.floor(rnd() * a.length)];
const DEFAULT_HOLES = [3, 7, 12, 16];

// (a) form-valid rows: a game in `games` always carries a complete config.
let formValid = 0;
for (let i = 0; i < 2000; i++) {
  const games = ['skins', 'cttp', 'birdieball'].filter(() => rnd() < 0.55);
  const row = {
    games,
    dollar_per_player: pick([10, 20, 25]),
    cttp_config: games.includes('cttp') ? { dollar_per_hole: pick([5, 10]), holes: pick([[3], [7, 3], [2, 7, 12, 16]]) } : undefined,
    birdieball_config: games.includes('birdieball') ? { dollar_per_player: pick([1, 2, 3]) } : undefined
  };
  formValid++;
  const fb = pick([[], [4], [4, 14]]);
  ok(oldIsGamed(row) === (c => !!(c && c.legacy.games.length))(config(row)), 'isGamed matches: ' + JSON.stringify(row));
  ok(oldShowCttp(row) === newShowCttp(row), 'showCttp matches: ' + JSON.stringify(row));
  ok(oldShowBB(row) === newShowBB(row), 'showBB matches: ' + JSON.stringify(row));
  ok(JSON.stringify(oldCttpHoles(row, fb, DEFAULT_HOLES)) === JSON.stringify(newCttpHoles(row, fb, DEFAULT_HOLES)), 'ctpHoles matches: ' + JSON.stringify(row) + ' fb=' + JSON.stringify(fb));
}
ok(formValid === 2000, 'ran 2000 form-valid rows');

// (b) malformed rows the live form can never save — resolver must stay safe
// and well-defined; divergence from the old per-site logic is expected and
// counted, not asserted away.
let divergedCttp = 0, divergedBB = 0, divergedHoles = 0, malformed = 0;
for (let i = 0; i < 2000; i++) {
  const row = {
    games: pick([['cttp'], ['birdieball'], ['cttp', 'birdieball'], ['skins'], [], null, 'cttp']),
    dollar_per_player: pick([10, null, undefined]),
    cttp_config: pick([null, undefined, {}, { dollar_per_hole: 5 }, { dollar_per_hole: 5, holes: [] }, { holes: [3] }]),
    birdieball_config: pick([null, undefined, {}, { dollar_per_player: 0 }])
  };
  malformed++;
  const fb = pick([[], [4]]);
  // Never throws, always returns a boolean/array of the right shape.
  let threw = false, sc, sb, ch;
  try { sc = newShowCttp(row); sb = newShowBB(row); ch = newCttpHoles(row, fb, DEFAULT_HOLES); } catch (e) { threw = true; }
  ok(!threw, 'never throws on malformed row: ' + JSON.stringify(row));
  if (!threw) {
    ok(typeof sc === 'boolean' && typeof sb === 'boolean' && Array.isArray(ch) && ch.length > 0, 'well-typed result: ' + JSON.stringify({ sc, sb, ch }));
    if (sc !== oldShowCttp(row)) divergedCttp++;
    if (sb !== oldShowBB(row)) divergedBB++;
    if (JSON.stringify(ch) !== JSON.stringify(oldCttpHoles(row, fb, DEFAULT_HOLES))) divergedHoles++;
  }
}
ok(malformed === 2000, 'ran 2000 malformed rows');
// The tightening is real (some malformed rows do diverge) but never runaway —
// every divergence is the resolver correctly refusing to show/pay a game
// whose own config is missing or empty, exactly what gatheringConfigFromLegacy
// is documented to do (spec §2a.5).
ok(divergedCttp > 0 && divergedCttp < 2000, 'cttp divergence is real but bounded: ' + divergedCttp);
console.log(`coverage: ${divergedCttp} cttp / ${divergedBB} bb / ${divergedHoles} holes diverged out of ${malformed} malformed rows (new is stricter, by design)`);

console.log(`${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
