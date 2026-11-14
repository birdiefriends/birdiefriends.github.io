// Turkeys end to end on the 2Man shape: two scramble teams, Skins + Turkeys, shotgun start, results carry the Turkey into the saved summary.
import { loadEngine } from './extract.mjs';
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const E = loadEngine();
const card = (player, f) => ({ player, holes: Array.from({ length: 18 }, (_, i) => f(i + 1)) });
const pars = Array(18).fill(4);
const SCR = { dollar_per_player: 5, basis: 'gross', scoring: 'strokes', hcp_method: 'none', pairs: [['A1', 'A2'], ['B1', 'B2']] };
const row = { games: ['scramble', 'skins', 'turkeys'], dollar_per_player: 20, game_configs: { scramble: Object.assign({}, SCR), turkeys: { dollar_per_player: 2, streak: 3, pars, prize: 'Turkey dinner' } } };
const rowRun = JSON.parse(JSON.stringify(row)); 
// team A (A1,A2) birdies holes 17, 18, 1 (a shotgun start on 17 wraps); team B all pars
const A = h => (h === 17 || h === 18 || h === 1 ? 3 : 4), B = () => 4;
const cards = [card('A1', A), card('A2', A), card('B1', B), card('B2', B)];
let r; try { r = E.computeGatheringGamesPayout(rowRun, cards, {}, [], { startHoles: { a1: 17, a2: 17, b1: 3, b2: 3 } }); } catch (e) { console.log('ERR', e.message); fail++; }
if (r) {
  const tk = r.turkeys; // team = one unit
  ok(tk && tk.count === 1 && tk.turkeys[0].members.length === 2, 'one Turkey found across the 17-18-1 wrap, got ' + JSON.stringify(tk && tk.count));
  ok(tk && tk.reserve === 8 && tk.paid_total === 8 && tk.prize === 'Turkey dinner', 'reserve $8 paid out, prize carried');
  ok(r.payouts.filter(p => p.turkeys > 0).length === 2, 'both team members credited');
  ok(Math.abs(r.payouts.reduce((t, p) => t + p.total, 0) + r.unallocated - r.total_pot) < 1e-9, 'money conserved');
  const r0 = E.computeGatheringGamesPayout(rowRun, cards, {}, []);
  ok(r0.turkeys.count === 0, 'without Groups the same 17-18-1 run is NOT a Turkey (holes 1, 17, 18 are not consecutive in play order)');
  console.log(JSON.stringify({ turkeys: tk, payouts: r.payouts.map(p => [p.player, p.total, p.turkeys]), noStart: r0.turkeys.count }));
  ok(JSON.parse(JSON.stringify(r)).turkeys.count === 1, 'summary survives JSON (what is stored for MyHistory)');
}
// the results card (close sheet + MyHistory both render the stored summary with renderGatheringPayoutHtml) shows the Turkey and the prize
import fs from 'fs'; import vm from 'vm'; import { extractFn } from './extract.mjs'; import { fileURLToPath } from 'url';
if (r) {
  const src = fs.readFileSync(fileURLToPath(new URL('../portal.html', import.meta.url)), 'utf8');
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const ctx = new Proxy({ BFEngine: E, escapeHtml: esc, esc, console, Math, Number, String, Array, Object, Map, Set, JSON }, { has: () => true, get: (t, k) => (k in t ? t[k] : (k === Symbol.unscopables ? undefined : (() => ''))) });
  const stubs = ['scrambleResultsHtml', 'fourballResultsHeatHtml', 'gpBtnStyle', 'gpSort', 'gpTab', 'gpTabStyle', 'isScrB', 'sideResultHeroHtml'];
  const ctx2 = { BFEngine: E, escapeHtml: esc, esc, norm: x => String(x).trim().toLowerCase() }; stubs.forEach(n => { ctx2[n] = () => ''; }); vm.createContext(ctx2);
  let html = ''; try { vm.runInContext(extractFn(src, 'renderGatheringPayoutHtml') + '\nthis.f = renderGatheringPayoutHtml;', ctx2); html = ctx2.f(JSON.parse(JSON.stringify(r))); } catch (e) { console.log('RENDER ERR', e.message); fail++; }
  ok(/Turkey/.test(html) && /Turkey dinner/.test(html) && /A1 &amp; A2/.test(html), 'results card names the Turkey, team and prize');
}
console.log(`turkeys_e2e: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
