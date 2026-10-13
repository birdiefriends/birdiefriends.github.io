import fs from 'fs'; import vm from 'vm'; import { extractFn, loadEngine } from './extract.mjs'; import { fileURLToPath } from 'url';
const src = fs.readFileSync(fileURLToPath(new URL('../portal.html', import.meta.url)), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const E = loadEngine(); const f = E.suggestGameAmounts; const ALL = ['skins', 'cttp', 'birdieball', 'birdiepay'];
// Moselem foursome ($10 x 4, 4 par 3s) reproduces the round Brian guessed by hand
let r = f({ dollarPerPlayer: 10, players: 4, games: ALL, cttpHoles: 4 });
ok(r.cttp.dollar_per_hole === 3 && r.birdieball.dollar_per_player === 2 && r.birdiepay.dollar_per_birdie === 3, '$10 foursome -> $3 CTP/hole, $2 BirdieBall, $3 birdie (Brian\'s middle option)');
r = f({ dollarPerPlayer: 10, players: 8, games: ALL, cttpHoles: 4 });
ok(r.cttp.dollar_per_hole === 6 && r.birdieball.dollar_per_player === 2, '$10 x 8 -> CTP scales with the pot, BirdieBall stays per-player');
r = f({ dollarPerPlayer: 10, players: 4, games: ALL, cttpHoles: 5 });
ok(r.cttp.dollar_per_hole === 2, '$10 foursome, 5 par 3s -> $2/hole');
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
  _gamesFormSelected: new Set(ALL), _gamesFormTouched: new Set(), _gamesFormYesCount: 0, _gamesFormFourballConfig: { dollar_per_player: null, period: 'round' }, _gamesFormLowscoreConfig: { dollar_per_player: null, period: 'round' }, _gamesFormPar3Holes: [3, 8, 11, 16],
  _gamesFormCttpConfig: { dollar_per_hole: null, hole_mode: 'all_par3', holes: [3, 8, 11, 16] }, _gamesFormBirdieballConfig: { dollar_per_player: null }, _gamesFormBirdiepayConfig: { dollar_per_birdie: null },
  gatheringGamesCttpSectionHtml: () => '', gatheringGamesBirdieballSectionHtml: () => '', gatheringGamesBirdiepaySectionHtml: () => '', gatheringGamesFourballSectionHtml: () => '', _gamesFormFourballConfig: { dollar_per_player: null }, updateGamesFormPotPreview: () => {} };
vm.createContext(ctx);
vm.runInContext(['periodSegCount','fourballSegCount','lowscoreSegCount','applyGamesSuggestion'].map(n => extractFn(src, n)).join('\n') + ';this.go=applyGamesSuggestion;', ctx);
ctx.go(false);
ok(ctx._gamesFormCttpConfig.dollar_per_hole === 3 && ctx._gamesFormBirdieballConfig.dollar_per_player === 2 && ctx._gamesFormBirdiepayConfig.dollar_per_birdie === 3, 'fills every ticked game');
ok(/4 players \(fewer than 4 confirmed so far\)/.test(els['games-form-suggest-note'].innerHTML), 'states the assumed headcount');
ctx._gamesFormTouched.add('birdieball'); ctx._gamesFormBirdieballConfig.dollar_per_player = 5; els['games-form-dpp'].value = '20'; ctx.go(false);
ok(ctx._gamesFormBirdieballConfig.dollar_per_player === 5 && ctx._gamesFormBirdiepayConfig.dollar_per_birdie === 6, 'typed amount is kept, others follow the new buy-in');
ctx.go(true);
ok(ctx._gamesFormBirdieballConfig.dollar_per_player === 4, 'Re-suggest overrides typed amounts');
ok(src.includes("bf_engine.js?v=" + E.ENGINE_VERSION), "engine version bumped with the script tag");
// Fourball (Dev-93): whole pot alone, half the buy-in alongside other games
ok(f({ dollarPerPlayer: 10, players: 4, games: ['fourball'] }).fourball.dollar_per_player === 10, 'Fourball alone -> the whole buy-in goes to the winning pair');
ok(f({ dollarPerPlayer: 10, players: 4, games: ['fourball', 'skins'] }).fourball.dollar_per_player === 5, 'Fourball + Skins -> half the buy-in');
ok(f({ dollarPerPlayer: 10, players: 4, games: ['skins'] }).fourball === null, 'not ticked -> no Fourball amount');
{ const x = f({ dollarPerPlayer: 10, players: 4, games: ['fourball', 'cttp', 'birdieball'], cttpHoles: 4 }); ok(x.fourball.dollar_per_player === 5 && x.fourball.dollar_per_player * 4 + x.birdieball.dollar_per_player * 4 + x.cttp.dollar_per_hole * 4 <= 40, 'Fourball + side games still fit the pot'); }
{ els['games-form-dpp'].value = '10'; const c2 = { ...ctx, _gamesFormSelected: new Set(['fourball']), _gamesFormTouched: new Set(), _gamesFormFourballConfig: { dollar_per_player: null } }; vm.createContext(c2); vm.runInContext(extractFn(src, 'periodSegCount') + extractFn(src, 'snapToPeriods') + extractFn(src, 'fourballSegCount') + extractFn(src, 'fourballSnapToSegments') + extractFn(src, 'applyGamesSuggestion') + ';this.go=applyGamesSuggestion;', c2); c2.go(false); ok(c2._gamesFormFourballConfig.dollar_per_player === 10, 'form fills the Fourball amount from the buy-in'); { const c3 = { ...c2 }; c3._gamesFormFourballConfig = { dollar_per_player: null, segments: 'fbt' }; c3._gamesFormTouched = new Set(); vm.createContext(c3); vm.runInContext(extractFn(src, 'periodSegCount') + extractFn(src, 'snapToPeriods') + extractFn(src, 'fourballSegCount') + extractFn(src, 'fourballSnapToSegments') + extractFn(src, 'applyGamesSuggestion') + ';this.go=applyGamesSuggestion;', c3); c3.go(false); ok(c3._gamesFormFourballConfig.dollar_per_player % 3 === 0 && c3._gamesFormFourballConfig.dollar_per_player > 0, 'with segments the suggested ante is a whole dollar per segment (multiple of 3)'); } c2._gamesFormFourballConfig.dollar_per_player = 3; c2._gamesFormTouched.add('fourball'); c2.go(false); ok(c2._gamesFormFourballConfig.dollar_per_player === 3, 'a typed Fourball amount is kept'); c2.go(true); ok(c2._gamesFormFourballConfig.dollar_per_player === 10, 'Re-suggest overrides it'); }
// The buy-in is played for in full when nothing is there to take what is left (Brian's $10 Fourball + MiserBall showed only $7)
{ const x = f({ dollarPerPlayer: 10, players: 4, games: ['fourball', 'birdieball'] }); ok(x.fourball.dollar_per_player === 8 && x.birdieball.dollar_per_player === 2, 'Fourball + MiserBall, no Skins -> $8 + $2 = the whole $10'); }
{ const x = f({ dollarPerPlayer: 10, players: 4, games: ['fourball', 'lowscore'] }); ok(x.fourball.dollar_per_player + x.lowscore.dollar_per_player === 10, 'two mains share the whole buy-in'); }
{ const x = f({ dollarPerPlayer: 10, players: 4, games: ['fourball', 'birdieball'], periods: { fourball: 3 } }); ok(x.fourball.dollar_per_player % 3 === 0 && x.fourball.dollar_per_player + x.birdieball.dollar_per_player <= 10, '3 periods: Fourball total is whole dollars per period and never over the buy-in (' + x.fourball.dollar_per_player + ')'); }
{ const x = f({ dollarPerPlayer: 10, players: 4, games: ['fourball', 'lowscore'], periods: { fourball: 3, lowscore: 1 } }); ok(x.fourball.dollar_per_player % 3 === 0 && x.fourball.dollar_per_player + x.lowscore.dollar_per_player === 10, 'periods on one main: spare dollars go to the other (' + x.fourball.dollar_per_player + ' + ' + x.lowscore.dollar_per_player + ')'); }
{ const x = f({ dollarPerPlayer: 10, players: 4, games: ['fourball', 'skins'], periods: { fourball: 3 } }); ok(x.fourball.dollar_per_player === 3, 'with Skins the main takes half, snapped down to the periods (3 periods -> $3)'); }
for (const B of [3, 5, 7, 10, 15, 20]) for (const per of [1, 2, 3]) { const x = f({ dollarPerPlayer: B, players: 4, games: ['fourball', 'lowscore', 'birdieball'], periods: { fourball: per, lowscore: 1 } }); const sum = x.fourball.dollar_per_player + x.lowscore.dollar_per_player + x.birdieball.dollar_per_player; if (B >= 5 * per) ok(sum <= B, `never over the buy-in: $${B}, ${per} periods -> ${sum}`); }
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
