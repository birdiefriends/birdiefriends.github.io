// Editing a saved Scramble game must bring back exactly what was saved: Top 3 shows as picked, hand-priced podium amounts and the fixed podium total survive an edit.
import fs from 'fs'; import vm from 'vm';
import { extractFn, loadEngine } from './extract.mjs'; import { fileURLToPath } from 'url';
const src = fs.readFileSync(fileURLToPath(new URL('../portal.html', import.meta.url)), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const E = loadEngine();
const ctx = { BFEngine: E, document: { getElementById: () => null }, _gamesFormYesCount: 8, _gamesFormTouched: new Set() }; vm.createContext(ctx);
const fns = ['cleanPrize', '_r2', 'gamesFormPodiumPlaces', 'gamesFormPodiumPlan', 'gamesFormPodiumPlayers', 'gamesFormPodiumInit', 'gamesFormScramblePcts', 'gamesFormSideBlank', 'gamesFormSideFrom'];
vm.runInContext('const GAMES_FORM_PODIUM_SHARES = { 1: [100], 2: [65, 35], 3: [50, 30, 20] }; let _gamesFormPodium = {}; let _gamesFormSide = { scramble: {} }; const GAMES_FORM_SIDE_IDS = ["scramble"];\n' + fns.map(n => extractFn(src, n)).join('\n') + '\nthis.from = gamesFormSideFrom; this.init = gamesFormPodiumInit; this.getP = () => _gamesFormPodium; this.plan = gamesFormPodiumPlan; this.setSide = s => { _gamesFormSide.scramble = s; };', ctx);
const pairs = [['A1', 'A2'], ['B1', 'B2'], ['C1', 'C2'], ['D1', 'D2']];
// 1. hand-priced podium: $150 / $90 / $60 on a fixed $300 podium, 8 players
const saved = { dollar_per_player: 37.5, basis: 'gross', scoring: 'strokes', hcp_method: 'none', payout: 'custom', place_shares: [150, 90, 60], podium_total: 300, pairs, team_size: 2 };
const side = ctx.from('scramble', saved); ctx.setSide(side);
ok(side.podium_total === 300, 'the fixed podium total comes back on edit');
ok(side.payout === 'custom' && side.place_shares.join() === '150,90,60', 'custom places load');
ctx.init(saved); const p = ctx.getP();
ok(p.mode === 'pl' && p.pl.join() === '150,90,60', 'the three podium amounts come back exactly, got ' + JSON.stringify(p.pl));
// 2. saved without podium_total (an older save): amounts still come back, not re-suggested
const old = { ...saved, podium_total: undefined, dollar_per_player: 37.5 }; delete old.podium_total;
ctx.setSide(ctx.from('scramble', old)); ctx.init(old);
ok(ctx.getP().pl.join() === '150,90,60', 'older save without a podium total: amounts unchanged, got ' + JSON.stringify(ctx.getP().pl));
// 3. standard Top 3 round-trips as top3
const std = { dollar_per_player: 10, basis: 'gross', scoring: 'strokes', hcp_method: 'none', payout: 'top3', pairs, team_size: 2 };
ok(ctx.from('scramble', std).payout === 'top3', 'Top 3 stays Top 3');
// 4. the save payload carries podium_total and place_shares
ok(/\.\.\.\(Number\(c\.podium_total\) > 0 \? \{ podium_total: _r2\(c\.podium_total\) \} : \{\}\)/.test(src), 'save writes podium_total');
ok(/gw-jump/.test(src) && /gwGoTo\('\$\{st\}'\)/.test(src), 'step chips jump to any screen');
console.log(`scramble_podium_roundtrip: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
