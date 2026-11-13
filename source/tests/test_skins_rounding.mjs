// Skins money: whole dollars are taken once per player on their total skins, so little is left unallocated.
import { loadEngine } from './extract.mjs';
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const E = loadEngine();
const card = (player, f) => ({ player, holes: Array.from({ length: 18 }, (_, i) => f(i + 1)) });
// the Test 2man Event Flow shape: $35 skins pot, 12 skins, two teams of two, 6 skins each
const row = { games: ['scramble', 'skins'], dollar_per_player: 20, game_configs: { scramble: { dollar_per_player: 5, basis: 'gross', scoring: 'strokes', hcp_method: 'none', payout: 'top2', pairs: [['A1', 'A2'], ['B1', 'B2']] } } };
const A = h => (h <= 6 ? 3 : 4), B = h => (h > 6 && h <= 12 ? 3 : 4);
const cards = [card('A1', A), card('A2', A), card('B1', B), card('B2', B)];
const r = E.computeGatheringGamesPayout(row, cards, {}, []);
const sk = r.skins, per = n => (r.payouts.find(p => p.player === n) || {}).total;
ok(sk.won.length === 12, '12 skins won');
const skinsPaid = r.payouts.reduce((t, p) => t + (p.skins || 0), 0);
ok(sk.pot - skinsPaid <= 4, `at most a dollar per player is lost to rounding, got ${sk.pot - skinsPaid} of ${sk.pot}`);
ok(Math.abs(r.payouts.reduce((t, p) => t + p.total, 0) + r.unallocated - r.total_pot) < 1e-9, 'money conserved');
// individual: one player wins 3 of 7 skins from a $10 pot: gets floor(10*3/7)=4, not 3*floor(10/7)=3
const row2 = { games: ['skins'], dollar_per_player: 5 };
const c2 = [card('P', h => (h <= 3 ? 3 : 4)), card('Q', h => (h > 3 && h <= 7 ? 3 : 4))];
const r2 = E.computeGatheringGamesPayout(row2, c2, {}, []);
ok(r2.skins.won.length === 7 && (r2.payouts.find(p => p.player === 'P') || {}).total === 4 && (r2.payouts.find(p => p.player === 'Q') || {}).total === 5, 'individual skins rounded once per player: ' + JSON.stringify(r2.payouts.map(p => [p.player, p.total])));
console.log(`skins_rounding: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
