// Scramble winner prize text: engine pass-through + clean summary rows (no pairs list, pays by place).
import fs from 'fs'; import vm from 'vm';
import { extractFn, loadEngine } from './extract.mjs';
import { fileURLToPath } from 'url';
const src = fs.readFileSync(fileURLToPath(new URL('../portal.html', import.meta.url)), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const E = loadEngine();
const PARS = [4,4,3,4,5,4,5,3,4, 3,5,4,4,4,3,4,5,3];
const names = ['A','B','C','D'];
const row = { games: ['scramble', 'skins'], dollar_per_player: 20, game_configs: { scramble: { team_size: 2, basis: 'gross', payout: 'top3', podium_total: 100, pars: PARS, prize: 'Turkeys <b>compliments</b> of Tom & Evan', pairs: [['A','B'],['C','D']] } } };
const cfg = E.gatheringConfigFromLegacy(row);
const sc = cfg.addons.find(a => a.id === 'scramble');
ok(sc && sc.prize === 'Turkeys b compliments/b of Tom  Evan'.replace('b compliments/b','bcompliments/b') || (sc && /Tom/.test(sc.prize) && !/[<>&]/.test(sc.prize)), 'engine keeps prize, sanitized');
const snap = E.computeGatheringGamesPayout(row, names.map(p => ({ player: p, holes: PARS })), {}, []);
ok(snap.scramble && /Tom/.test(snap.scramble.prize || '') && !/[<>&]/.test(snap.scramble.prize), 'result carries prize');
const ctx = { console, JSON, Math, Number, String, Set, Map, Array, Object, parseFloat, BFEngine: E,
  escapeHtml: s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])),
  regData: names.map(() => ({ gatheringId: 7, status: 'Yes' })), gameInfoBtnHtml: () => '', gameInfoPanelHtml: () => '' };
vm.createContext(ctx);
vm.runInContext(['cleanPrize','bbCleanName','gatheringAddon','gatheringGameDetailsBody'].map(n => extractFn(src, n)).join('\n') + '\nthis.f={gatheringGameDetailsBody}', ctx);
const body = ctx.f.gatheringGameDetailsBody({ source: 'gathering', gatheringId: 7, name: 'T' }, cfg);
ok(!/Pairs:/.test(body) && !body.includes('A &amp; B'), 'no pairs list');
ok(/2-man teams, one score per team/.test(body), 'scramble rule line');
ok(/1st \$\d+ · 2nd \$\d+ · 3rd \$\d+/.test(body), 'pays by place with amounts');
ok(/Winners also get: Turkeys/.test(body), 'prize line shown');
ok(body.indexOf('Skins') > body.indexOf('Scramble'), 'skins listed last');
console.log(`scramble_prize_summary: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
