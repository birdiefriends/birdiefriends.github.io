// Dev-93 — the Live Panel configures itself from the round's games, and a non-gamed round (BF Series) is untouched.
import fs from 'fs'; import vm from 'vm';
import { extractFn, loadEngine } from './extract.mjs';
import { fileURLToPath } from 'url';
const src = fs.readFileSync(fileURLToPath(new URL('../portal.html', import.meta.url)), 'utf8');
let pass = 0, fail = 0;
const eq = (a, b, m) => { const ok = JSON.stringify(a) === JSON.stringify(b); ok ? pass++ : fail++; if (!ok) console.log('FAIL', m, '\n  got', JSON.stringify(a), '\n  exp', JSON.stringify(b)); };
const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const E = loadEngine();
const ctx = { gatheringAddon: (c, id) => (c && c.addons.find(a => a.id === id)) || null };
vm.createContext(ctx);
vm.runInContext(extractFn(src, 'livePanelSections') + '\nthis.f = livePanelSections;', ctx);
const cfg = games => E.gatheringConfigFromLegacy({ games, dollar_per_player: 10,
  cttp_config: { dollar_per_hole: 2, holes: [3, 8] }, birdieball_config: { dollar_per_player: 2 }, birdiepay_config: { dollar_per_birdie: 3, pars: Array(18).fill(4) },
  game_configs: { fourball: { dollar_per_player: 5, basis: 'gross', net_mode: 'own', pairs: [['A', 'B'], ['C', 'D']] } } });
const sec = (games, gid = 7) => ctx.f(cfg(games), gid);
// BF Series / any round with no games config: exactly the classic panel
eq(ctx.f(null, null), { birdieAlert: true, cttp: true, birdieball: false, fourball: false }, 'no games config (BF Series): Birdie Alert + CTP as always');
eq(ctx.f(cfg(['fourball']), null), { birdieAlert: true, cttp: true, birdieball: false, fourball: false }, 'no panel gid: classic panel even if a config object is passed');
// gamed rounds
eq(sec(['fourball']), { birdieAlert: false, cttp: false, birdieball: false, fourball: true }, 'Fourball only: no Birdie Alert, no CTP');
eq(sec(['skins']), { birdieAlert: true, cttp: false, birdieball: false, fourball: false }, 'Skins: Birdie Alert on');
eq(sec(['birdiepay']), { birdieAlert: true, cttp: false, birdieball: false, fourball: false }, 'Birdie Payouts: Birdie Alert on');
eq(sec(['cttp']), { birdieAlert: false, cttp: true, birdieball: false, fourball: false }, 'CTP only: CTP section, no Birdie Alert');
eq(sec(['birdieball']), { birdieAlert: false, cttp: false, birdieball: true, fourball: false }, 'MiserBall only');
eq(sec(['skins', 'cttp', 'birdieball', 'birdiepay', 'fourball']), { birdieAlert: true, cttp: true, birdieball: true, fourball: true }, 'everything on: everything shows');
// the render uses the helper and still gates by it
ok(/const _lps = livePanelSections\(_liveConfig, _panelGid\);/.test(src), 'buildLivePanel resolves sections through the helper');
ok(/showBirdieAlertSection \? `/.test(src), 'Birdie Alert section is gated');
ok(!/const showCttpSection = _panelGid == null/.test(src), 'old inline CTP rule is gone (helper owns it)');
console.log(`live panel sections: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
