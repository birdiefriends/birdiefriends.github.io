// Dev-91 — net/gross foundation: USGA course/playing handicap, stroke
// allocation by stroke index (18+ wraps, plus handicaps, 9-hole), net cards,
// and Net basis for Skins + Birdie Payouts. Gross (no handicap_config) must
// stay byte-identical to Dev-90 output.
import { loadEngine } from './extract.mjs';
let pass = 0, fail = 0;
const eq = (a, b, m) => { const ok = JSON.stringify(a) === JSON.stringify(b); ok ? pass++ : fail++; if (!ok) console.log('FAIL', m, '\n  got', JSON.stringify(a), '\n  exp', JSON.stringify(b)); };
const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const E = loadEngine();

const PARS = [4,4,3,4,5,4,5,3,4, 3,5,4,4,4,3,4,5,3];
const SI   = [7,11,15,1,5,9,3,17,13, 12,6,2,10,4,18,8,14,16]; // synthetic stroke index, 1 = hardest
const card = (player, over = {}, extra = {}) => ({ player, holes: PARS.map((p, i) => over[i + 1] ?? p), ...extra });
const conserved = r => r.payouts.reduce((s, x) => s + x.total, 0) + r.unallocated === r.total_pot;
const who = (r, n) => r.payouts.find(x => x.player === n);

// ── A: USGA formula
{
  // 8.0 × 132/113 + (70.5 − 71) = 8.84 → 95% = 8.40 → 8; 100% = 9
  const a = E.playingHandicap({ index: 8, slope: 132, rating: 70.5, par: 71 }, 95);
  eq([a.course_hcp, a.strokes], [8.8, 8], 'A: index 8 @95%');
  eq(E.playingHandicap({ index: 8, slope: 132, rating: 70.5, par: 71 }, 100).strokes, 9, 'A: 100% allowance');
  eq(E.playingHandicap({ index: 8, slope: 132, rating: 70.5, par: 71 }).strokes, 8, 'A: default allowance is 95');
  eq(E.playingHandicap({ index: -2, slope: 113, rating: 72, par: 72 }, 100).strokes, -2, 'A: plus handicap is negative');
  eq(E.playingHandicap({ index: 18, slope: 113, rating: 72, par: 72 }, 100, 9).strokes, 9, 'A: 9 holes = half');
}

// ── B: stroke allocation by stroke index
{
  const g = (s, n = 18) => Array.from({ length: n }, (_, i) => E.strokesOnHole(s, i + 1, n));
  eq(g(0).reduce((a, b) => a + b, 0), 0, 'B: 0 strokes');
  eq(g(18).every(x => x === 1), true, 'B: 18 = one on every hole');
  eq(g(20).slice(0, 3), [2, 2, 1], 'B: 20 = second stroke on SI 1-2');
  eq(g(20).reduce((a, b) => a + b, 0), 20, 'B: 20 strokes total');
  eq(g(5).map((x, i) => x ? i + 1 : 0).filter(Boolean), [1, 2, 3, 4, 5], 'B: 5 strokes land on SI 1-5');
  eq(g(36).every(x => x === 2), true, 'B: 36 = two everywhere');
  eq(g(-2).slice(-3), [0, -1, -1], 'B: plus 2 gives back on the two easiest');
  eq(g(-2).reduce((a, b) => a + b, 0), -2, 'B: plus total');
  eq(E.strokesOnHole(5, 0, 18), 0, 'B: bad SI → 0');
  eq(E.rankWithin([7, 1, 13, 11, 5, 9, 3, 17, 15]), [4, 1, 7, 6, 3, 5, 2, 9, 8], 'B: back-nine re-rank 1-9');
}

// ── C: net card
{
  const spec = { strokes: 18, stroke_index: SI };
  const c = E.netCard(card('T', { 12: 5 }), spec);
  eq(c.received.every(x => x === 1), true, 'C: 18 strokes → one per hole');
  eq(c.holes[11], 4, 'C: gross 5 on #12 → net 4');
  const blank = E.netCard({ player: 'T', holes: [4, null, 3] }, spec);
  eq(blank.holes, [3, null, 2], 'C: blank hole stays null');
  const noSI = E.netCard(card('T'), { strokes: 4 }, null);
  ok(noSI.missing_si && noSI.received.every(x => x === 0), 'C: no stroke index → flagged, no strokes');
  const back9 = E.netCard({ player: 'T', holes: PARS.slice(9), hole_count: 9, hole_half: 'back' }, { strokes: 3, stroke_index: SI });
  eq(back9.received.reduce((a, b) => a + b, 0), 3, 'C: 9-hole back card gets its strokes');
}

// ── D: Sunday scenario — net Skins + net Birdie Payouts
const HC = (extra = {}) => ({
  allowance: 95, skins_basis: 'net', birdiepay_basis: 'net', stroke_index: SI,
  players: {
    'Brian Hager': { tee: 'Green', kind: 'index', strokes: 8 },
    'Lee Chasen': { tee: 'Combo', kind: 'given', strokes: 18 },
    'Tony Hager': { tee: 'Gold', kind: 'given', strokes: 18 },
    'Muna Aliya': { tee: 'Gold', kind: 'given', strokes: 20 }
  }, ...extra
});
const row = (hc, games = ['skins', 'birdiepay']) => ({ games, dollar_per_player: 10, birdiepay_config: { dollar_per_birdie: 2, pars: PARS }, handicap_config: hc });
{
  // Everyone shoots gross par except: Brian bogeys #12 (SI 2: he gets a stroke → net par), Tony pars #4 (SI 1 → net birdie).
  const cards = [card('Brian Hager', { 12: 5 }), card('Lee Chasen', { 1: 5 }), card('Tony Hager'), card('Muna Aliya')];
  const r = E.computeGatheringGamesPayout(row(HC()), cards, {}, []);
  ok(r.handicap && r.handicap.allowance === 95, 'D: handicap summary present');
  eq(r.handicap.players.find(p => p.player === 'Muna Aliya').strokes, 20, 'D: summary shows strokes');
  eq(r.birdiepay.basis, 'net', 'D: birdiepay basis net');
  // Net birdies: Lee, Tony, Muna get a stroke on every hole → a gross par is a net birdie on all 18 holes.
  const bd = r.birdiepay.birdies;
  ok(bd.filter(b => b.player === 'Tony Hager').length === 18, 'D: Tony gross par every hole = 18 net birdies');
  ok(bd.every(b => b.net === b.strokes - b.received && b.net <= b.par - 1), 'D: each row net = gross − received, ≤ par−1');
  ok(conserved(r), 'D: conserved');
  // Muna has 2 strokes on SI 1 (#4) and SI 2 (#12): gross par there is net eagle — still ONE birdie payout.
  eq(bd.filter(b => b.player === 'Muna Aliya' && b.hole === 4).length, 1, 'D: net eagle = one payout');
}

// ── E: net skins — lowest net outright, tie = no skin, net 0 / negative counts
{
  const hc = { allowance: 95, skins_basis: 'net', stroke_index: SI, players: { A: { kind: 'given', strokes: 0 }, B: { kind: 'given', strokes: 18 } } };
  const rw = games => ({ games, dollar_per_player: 10, handicap_config: hc });
  // Hole 1 (par 4, SI 7): A 4, B 5 → B net 4 → tie → no skin.
  // Hole 3 (par 3, SI 15): A 3, B 3 → B net 2 → B wins.
  // Hole 8 (par 3, SI 17): A 2, B 1 → B net 0 → B wins (net 0 is a real score).
  const r = E.computeGatheringGamesPayout(rw(['skins']), [
    { player: 'A', holes: PARS.map((p, i) => ({ 1: 4, 3: 3, 8: 2 })[i + 1] ?? p) },
    { player: 'B', holes: PARS.map((p, i) => ({ 1: 5, 3: 3, 8: 1 })[i + 1] ?? p + 1) }
  ], {}, []);
  eq(r.skins.basis, 'net', 'E: skins basis net');
  const byHole = Object.fromEntries(r.skins.won.map(w => [w.hole, w]));
  ok(!byHole[1], 'E: net tie on #1 = no skin');
  eq([byHole[3].player, byHole[3].net, byHole[3].gross, byHole[3].received], ['B', 2, 3, 1], 'E: #3 B net 2 (gross 3, 1 stroke)');
  eq([byHole[8].player, byHole[8].net], ['B', 0], 'E: net 0 wins a skin');
  ok(conserved(r), 'E: conserved');
}

// ── F: gross default is byte-identical to Dev-90 (no handicap_config, or basis gross)
{
  const cards = [card('Ann', { 1: 3, 5: 3 }), card('Bob', { 3: 2, 2: 5 }), card('Cy')];
  const base = { games: ['birdiepay', 'skins'], dollar_per_player: 20, birdiepay_config: { dollar_per_birdie: 5, pars: PARS } };
  const old = E.computeGatheringGamesPayout(base, cards, {}, []);
  const withCfg = E.computeGatheringGamesPayout({ ...base, handicap_config: { allowance: 95, skins_basis: 'gross', birdiepay_basis: 'gross', stroke_index: SI, players: { Ann: { kind: 'given', strokes: 18 } } } }, cards, {}, []);
  eq(withCfg, old, 'F: gross basis ignores stored strokes — identical output');
  ok(!('handicap' in old), 'F: no handicap key on gross snapshots');
  eq(old.skins.basis, 'gross', 'F: skins basis gross');
}

// ── G: mixed basis, missing player entry, fuzz
{
  const cards = [card('X', { 1: 3 }), card('Y')];
  const r = E.computeGatheringGamesPayout({ games: ['skins', 'birdiepay'], dollar_per_player: 10, birdiepay_config: { dollar_per_birdie: 2, pars: PARS },
    handicap_config: { skins_basis: 'net', birdiepay_basis: 'gross', stroke_index: SI, players: { X: { kind: 'given', strokes: 0 } } } }, cards, {}, []);
  eq(r.handicap.missing, ['Y'], 'G: player with no entry is reported');
  eq(r.birdiepay.basis, undefined, 'G: birdiepay stays gross');
  ok(conserved(r), 'G: conserved');
  let bad = 0;
  for (let t = 0; t < 1500; t++) {
    const names = ['A', 'B', 'C', 'D'].slice(0, 2 + (t % 3));
    const players = {}; names.forEach(n => { players[n] = { kind: 'given', strokes: Math.floor(Math.random() * 30) - 2 }; });
    const cs = names.map(n => ({ player: n, holes: PARS.map(p => Math.max(1, p + Math.floor(Math.random() * 4) - 1)) }));
    const rr = E.computeGatheringGamesPayout({ games: ['skins', 'birdiepay'], dollar_per_player: 5 + (t % 4) * 5,
      birdiepay_config: { dollar_per_birdie: 1 + (t % 3), pars: PARS },
      handicap_config: { skins_basis: 'net', birdiepay_basis: 'net', stroke_index: SI, players } }, cs, {}, []);
    if (!conserved(rr)) bad++;
  }
  eq(bad, 0, 'G: 1500-round net fuzz conserves the pot');
}

console.log(`test_net_handicap: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
