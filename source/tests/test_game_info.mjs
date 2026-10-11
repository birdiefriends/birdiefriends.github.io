import fs from 'fs'; import vm from 'vm'; import { extractFn, loadEngine } from './extract.mjs'; import { fileURLToPath } from 'url';
const src = fs.readFileSync(fileURLToPath(new URL('../portal.html', import.meta.url)), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
// Dev-93: GAME_INFO is built from the engine's game definitions (plus the `net` concept) — run the real declaration.
const E = loadEngine();
const infoSrc = src.match(/const GAME_INFO = Object\.assign\(\{[\s\S]*?\}, BFEngine\.gamesInfo\(\)\);/)[0];
const els = {};
const ctx = { BFEngine: E, document: { getElementById: id => els[id] || null }, _gamesFormSelected: new Set(['skins']), _hostGamesPick: new Set(),
  GATHERING_GAMES_META: { skins: { label: 'Skins', icon: 'S' }, cttp: { label: 'CTP', icon: 'C' }, birdieball: { label: 'BB', icon: 'B' }, birdiepay: { label: 'BP', icon: 'P' } } };
vm.createContext(ctx);
vm.runInContext(infoSrc + '\n' + ['gameInfoBtnHtml', 'gameInfoPanelHtml', 'toggleGameInfo', 'gatheringGamesChecklistHtml', 'hostGamesListHtml'].map(n => extractFn(src, n)).join('\n') + ';this.G=GAME_INFO', ctx);
ok(['skins', 'cttp', 'birdieball', 'birdiepay'].every(k => ctx.G[k] && ctx.G[k].length > 40), 'every game has a descriptor');
const form = ctx.gatheringGamesChecklistHtml(), host = ctx.hostGamesListHtml('');
for (const k of ['skins', 'cttp', 'birdieball', 'birdiepay']) {
  ok(form.includes(`toggleGameInfo('form','${k}')`) && form.includes(`id="gi-form-${k}"`), `setup checklist has (i) for ${k}`);
  ok(host.includes(`toggleGameInfo('host','${k}')`) && host.includes(`id="gi-host-${k}"`), `Add games sheet has (i) for ${k}`);
}
ok(/event\.stopPropagation\(\);toggleGameInfo/.test(form), '(i) tap does not toggle the game');
ok(/, 'skins'\)\);/.test(src) && /, 'cttp'\)\);/.test(src) && /, 'birdieball'\)\);/.test(src) && /, 'birdiepay'\)\);/.test(src), 'event card details rows pass their game key');
els['gi-card-skins'] = { style: { display: 'none' } }; ctx.toggleGameInfo('card', 'skins'); ok(els['gi-card-skins'].style.display === 'block', 'toggle opens'); ctx.toggleGameInfo('card', 'skins'); ok(els['gi-card-skins'].style.display === 'none', 'toggle closes');
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
