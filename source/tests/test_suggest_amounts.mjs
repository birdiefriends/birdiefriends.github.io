import fs from 'fs'; import vm from 'vm'; import { extractFn, loadEngine } from './extract.mjs'; import { fileURLToPath } from 'url';
const src = fs.readFileSync(fileURLToPath(new URL('../portal.html', import.meta.url)), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const E = loadEngine(); const f = E.suggestGameAmounts; const ALL = ['skins', 'cttp', 'birdieball', 'birdiepay'];
// Moselem foursome ($10 x 4, 4 par 3s) reproduces the round Brian guessed by hand
let r = f({ dollarPerPlayer: 10, players: 4, games: ALL, cttpHoles: 4 });
ok(r.cttp.dollar_per_hole === 2 && r.birdieball.dollar_per_player === 2 && r.birdiepay.dollar_per_birdie === 2, '$10 foursome -> $2 CTP/hole, $2 BirdieBall, $2 birdie');
r = f({ dollarPerPlayer: 10, players: 8, games: ALL, cttpHoles: 4 });
ok(r.cttp.dollar_per_hole === 4 && r.birdieball.dollar_per_player === 2, '$10 x 8 -> CTP scales with the pot, BirdieBall stays per-player');
r = f({ dollarPerPlayer: 10, players: 4, games: ALL, cttpHoles: 5 });
ok(r.cttp.dollar_per_hole === 2, '$10 foursome, 5 par 3s -> $2/hole (was $1, undervalued)');
for (const B of [1, 2, 5, 10, 20, 50]) for (const n of [4, 5, 6, 7, 8]) for (const h of [1, 2, 3, 4, 5]) {
  const x = f({ dollarPerPlayer: B, players: n, games: ALL, cttpHoles: h });
  const all = [x.cttp.dollar_per_hole, x.birdieball.dollar_per_player, x.birdiepay.dollar_per_birdie];
  if (!all.every(v => Number.isInteger(v) && v >= 1)) ok(false, `whole dollars, >=$1 at B${B} n${n} h${h}`);
  if (B >= 5 && x.cttp.dollar_per_hole * h + x.birdieball.dollar_per_player * n > 0.5 * B * n + h) ok(false, `CTP+BB stay about half the pot at B${B} n${n} h${h}`);
}
ok(f({ dollarPerPlayer: 10, players: 4, games: ['skins'], cttpHoles: 4 }).cttp === null, 'only ticked games get amounts');
ok(f({ dollarPerPlayer: 0, players: 4, games: ALL }).cttp === null, 'no buy-in -> no suggestion');
// portal wiring: suggestions fill untouched fields only; typed values stay; Re-suggest overrides
const els = { 'games-form-dpp': { value: '10' }, 'games-form-suggest-note': { innerHTML: '' }, 'games-form-cttp-section': {}, 'games-form-birdieball-section': {}, 'games-form-birdiepay-section': {} };
const ctx = { BFEngine: E, parseFloat, Math, Array, Set, document: { getElementById: id => els[id] || null },
  _gamesFormSelected: new Set(ALL), _gamesFormTouched: new Set(), _gamesFormYesCount: 0, _gamesFormPar3Holes: [3, 8, 11, 16],
  _gamesFormCttpConfig: { dollar_per_hole: null, hole_mode: 'all_par3', holes: [3, 8, 11, 16] }, _gamesFormBirdieballConfig: { dollar_per_player: null }, _gamesFormBirdiepayConfig: { dollar_per_birdie: null },
  gatheringGamesCttpSectionHtml: () => '', gatheringGamesBirdieballSectionHtml: () => '', gatheringGamesBirdiepaySectionHtml: () => '', updateGamesFormPotPreview: () => {} };
vm.createContext(ctx);
vm.runInContext(extractFn(src, 'applyGamesSuggestion') + ';this.go=applyGamesSuggestion;', ctx);
ctx.go(false);
ok(ctx._gamesFormCttpConfig.dollar_per_hole === 2 && ctx._gamesFormBirdieballConfig.dollar_per_player === 2 && ctx._gamesFormBirdiepayConfig.dollar_per_birdie === 2, 'fills every ticked game');
ok(/4 players \(fewer than 4 confirmed so far\)/.test(els['games-form-suggest-note'].innerHTML), 'states the assumed headcount');
ctx._gamesFormTouched.add('birdieball'); ctx._gamesFormBirdieballConfig.dollar_per_player = 5; els['games-form-dpp'].value = '20'; ctx.go(false);
ok(ctx._gamesFormBirdieballConfig.dollar_per_player === 5 && ctx._gamesFormBirdiepayConfig.dollar_per_birdie === 4, 'typed amount is kept, others follow the new buy-in');
ctx.go(true);
ok(ctx._gamesFormBirdieballConfig.dollar_per_player === 4, 'Re-suggest overrides typed amounts');
ok(/bf_engine\.js\?v=1\.3\.1/.test(src) && E.ENGINE_VERSION === '1.3.1', 'engine version bumped with the script tag');
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
