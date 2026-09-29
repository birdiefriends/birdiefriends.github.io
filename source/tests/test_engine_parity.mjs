// Dev-88 — bf_engine.js must reproduce the Dev-87 Gatherings payout EXACTLY.
// Runs the pre-extraction computeGatheringGamesPayout (frozen copy below,
// taken verbatim from portal v4.7.9) and BFEngine.computeGatheringGamesPayout
// on thousands of seeded random closes and requires identical JSON (values
// AND key order — the snapshot shape is what My History renders).
import fs from 'fs'; import vm from 'vm'; import { createRequire } from 'module';
import { fileURLToPath } from 'url';
const HERE = (p) => fileURLToPath(new URL(p, import.meta.url));
const require = createRequire(import.meta.url);
const E = require(HERE('../bf_engine.js'));
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(HERE('./fixtures/dev87_gathering_payout.js'), 'utf8') + ';this.f=computeGatheringGamesPayout;', ctx);
const OLD = ctx.f;
let pass = 0, fail = 0, capped = 0;
let seed = 88;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = a => a[Math.floor(rnd() * a.length)];
const NAMES = ['Ann', 'Bob', 'Cy', 'Dee', 'Ed', 'Flo', 'Gus', 'Hal', 'Ivy', 'Jo'];
const vary = n => pick([n, n.toLowerCase(), ' ' + n.toUpperCase() + ' ', n]);
for (let i = 0; i < 5000; i++) {
  const games = NAMES.slice(0, 0).concat(['skins', 'cttp', 'birdieball', 'bogus'].filter(() => rnd() < 0.6));
  const cfg = rnd() < 0.03 ? null : {
    games: rnd() < 0.03 ? 'skins' : games,
    dollar_per_player: pick([0, 5, 10, 20, 25, '15', null, 7.5]),
    cttp_config: rnd() < 0.85 ? { dollar_per_hole: pick([0, 5, 10, '10', null]), holes: pick([[], [3], [7, 3], [2, 7, 12, 16], undefined]) } : null,
    birdieball_config: rnd() < 0.85 ? { dollar_per_player: pick([0, 1, 2, 3, null]) } : null
  };
  const nPlayers = Math.floor(rnd() * 9);
  const holeCount = pick([18, 18, 18, 9]);
  const cards = [];
  for (let p = 0; p < nPlayers; p++) {
    const holes = Array.from({ length: holeCount }, () => rnd() < 0.08 ? pick([null, 0, undefined, NaN]) : 2 + Math.floor(rnd() * 5));
    cards.push({ player: rnd() < 0.05 ? '' : pick(NAMES), holes: rnd() < 0.02 ? null : holes });
  }
  if (rnd() < 0.05) cards.push(null);
  const leaders = {};
  [2, 3, 7, 12, 16].forEach(h => { if (rnd() < 0.5) leaders[rnd() < 0.5 ? h : String(h)] = { player: rnd() < 0.8 ? vary(pick(NAMES)) : 'Zed', dist: rnd() < 0.7 ? Math.floor(rnd() * 40) : undefined }; });
  const bb = [];
  NAMES.forEach(n => { if (rnd() < 0.4) bb.push({ player_name: vary(n), kept: rnd() < 0.3, lost_hole: rnd() < 0.8 ? 1 + Math.floor(rnd() * 18) : null, lost_stroke: 1 + Math.floor(rnd() * 5) }); });
  const args = [cfg, cards, rnd() < 0.05 ? null : leaders, rnd() < 0.05 ? undefined : bb];
  let a, b, ea, eb;
  try { a = JSON.stringify(OLD(...JSON.parse(JSON.stringify(args)))); } catch (e) { ea = String(e); }
  try { b = JSON.stringify(E.computeGatheringGamesPayout(...JSON.parse(JSON.stringify(args)))); } catch (e) { eb = String(e); }
  // JSON round-trip on inputs so neither side can mutate the other's copy
  // (NaN/undefined become null/absent identically for both).
  // Dev-89: the ONE deliberate departure from Dev-87. A CTP purse / BirdieBall that is more than the
  // pot has left used to pay out more than the pot (the sum of payouts exceeded total_pot); the engine
  // now caps it (result gets capped:true). Those configs are excluded from exact parity and instead
  // must conserve the pot; every config that fits its pot must still match Dev-87 byte for byte.
  if (!ea && !eb) {
    const nb = JSON.parse(b);
    if ((nb.cttp && nb.cttp.capped) || (nb.birdieball && nb.birdieball.capped)) {
      capped++;
      const paid = nb.payouts.reduce((t, x) => t + x.total, 0);
      if (Math.abs(paid + nb.unallocated - nb.total_pot) < 1e-9) pass++; else { fail++; if (fail < 4) console.log('FAIL capped case not conserved', i, JSON.stringify(args), b); }
      continue;
    }
  }
  const ok = (ea || eb) ? (ea === eb) : (a === b);
  if (ok) pass++; else { fail++; if (fail < 4) console.log('FAIL case', i, '\n  args', JSON.stringify(args), '\n  old ', ea || a, '\n  new ', eb || b); }
}
// Helpers moved into the engine must match too.
vm.runInContext(fs.readFileSync(HERE('./fixtures/dev87_gathering_payout.js'), 'utf8') + ';this.l=latestScorecardPerPlayer;this.m=scorecardMissingHoles;', ctx);
const rows = [{ player: 'Ann', t: 1 }, { player: ' ann ', t: 2 }, { player: '' }, { player: 'Bob' }, { player: 'bob', t: 3 }];
JSON.stringify(ctx.l(rows)) === JSON.stringify(E.latestScorecardPerPlayer(rows)) ? pass++ : (fail++, console.log('FAIL latest'));
[[{ holes: [4, null, 0, 5] }, 4], [{ holes: [4] }, 9], [{}, 3]].forEach(([c, n]) => {
  JSON.stringify(ctx.m(c, n)) === JSON.stringify(E.scorecardMissingHoles(c, n)) ? pass++ : (fail++, console.log('FAIL missing', JSON.stringify(c)));
});
// skinsWon 'high' (Phase B direction) — sanity only, not a parity check.
const hi = E.skinsWon([{ player: 'A', holes: [3, 2, 0] }, { player: 'B', holes: [2, 2, 1] }], 'high');
JSON.stringify(hi) === JSON.stringify([{ hole: 1, player: 'A', points: 3 }, { hole: 3, player: 'B', points: 1 }]) ? pass++ : (fail++, console.log('FAIL high', JSON.stringify(hi)));
if (capped < 100) { fail++; console.log('FAIL fuzz barely exercised the capped path:', capped); }
console.log(`${pass} passed, ${fail} failed (${capped} capped configs checked for conservation instead of parity)`);
if (fail) process.exit(1);
