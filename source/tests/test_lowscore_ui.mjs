// Low Score portal side: results panel, summary column, event-card row, label, suggestion.
import fs from 'fs'; import vm from 'vm';
import { extractFn, loadEngine } from './extract.mjs';
import { fileURLToPath } from 'url';
const src = fs.readFileSync(fileURLToPath(new URL('../portal.html', import.meta.url)), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const E = loadEngine();
const PARS = [4,4,3,4,5,4,5,3,4, 3,5,4,4,4,3,4,5,3];
const card = (player, over = {}) => ({ player, holes: PARS.map((p, i) => over[i + 1] ?? p) });
const ctx = { console, JSON, Math, Number, String, Set, Map, Array, Object, parseFloat, BFEngine: E,
  escapeHtml: s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])),
  regData: [1,2,3].map(() => ({ gatheringId: 7, status: 'Yes' })), gameInfoBtnHtml: () => '', gameInfoPanelHtml: () => '' };
vm.createContext(ctx);
vm.runInContext(['gpTabStyle','gpBtnStyle','fbShort','fbIni','fourballResultsHeatHtml','renderGatheringPayoutHtml','gatheringAddon','gatheringGameDetailsBody','fbVariantText','droppedGameSettings'].map(n => extractFn(src, n)).join('\n') + '\nthis.f={renderGatheringPayoutHtml,gatheringGameDetailsBody,fbVariantText,droppedGameSettings};', ctx);
const cards = [card('Ann', { 1: 3, 12: 3 }), card('Bob', { 15: 2 }), card('Cy', { 4: 5, 5: 6 })];
const run = (ls) => { const row = { games: ['lowscore'], dollar_per_player: 15, game_configs: { lowscore: { dollar_per_player: 15, basis: 'gross', ...ls } } }; return E.computeGatheringGamesPayout(row, cards, {}, []); };
let h = ctx.f.renderGatheringPayoutHtml(run({}));
ok(h.includes('🎯 Low Score') && /One pot<\/b>: the lowest gross total/.test(h) && /tie for low is a push/.test(h), 'round: tab and rules text');
ok(/Ann/.test(h) && /\$45/.test(h), 'round: winner and pot shown');
h = ctx.f.renderGatheringPayoutHtml(run({ period: 'fbt' }));
ok(/Front 9\/Back 9\/Total|Front/.test(h) && /Scores by period/.test(h) && /per period/.test(h), 'fbt: periods table and ante math');
ok(h.includes('grid-template-columns') && h.includes('🎯</span>'), 'summary column');
ok(!ctx.f.renderGatheringPayoutHtml(E.computeGatheringGamesPayout({ games: ['skins'], dollar_per_player: 20 }, cards, {}, [])).includes('Low Score'), 'no panel when not played');
const cfg = E.gatheringConfigFromLegacy({ games: ['lowscore'], dollar_per_player: 15, game_configs: { lowscore: { dollar_per_player: 15, basis: 'gross', period: 'sixes' } } });
const d = ctx.f.gatheringGameDetailsBody({ source: 'gathering', gatheringId: 7, id: 'g7' }, cfg);
ok(/Low Score/.test(d) && /separate pots/.test(d) && /push/.test(d), 'event card row');
ok(ctx.f.fbVariantText({ period: 'fbt' }).includes('Front'), 'variant text without win_by has no stray strokes label');
const f = o => E.suggestGameAmounts({ dollarPerPlayer: 10, players: 4, ...o });
ok(f({ games: ['lowscore'] }).lowscore.dollar_per_player === 10, 'Low Score alone takes the buy-in');
ok(f({ games: ['lowscore', 'skins'] }).lowscore.dollar_per_player === 5, 'with side games, half');
{ const x = f({ games: ['fourball', 'lowscore'] }); ok(x.fourball.dollar_per_player === 5 && x.lowscore.dollar_per_player === 5, 'both main games share the buy-in'); }
// form section smoke
{ const c2 = { console, JSON, Math, Number, String, Set, Map, Array, Object, BFEngine: E, escapeHtml: ctx.escapeHtml, document: { getElementById: () => null } };
  vm.createContext(c2);
  vm.runInContext("let _gamesFormSelected = new Set(['lowscore']); let _gamesFormTouched = new Set(); let _gamesFormLowscoreConfig = { dollar_per_player: null, basis: 'gross', period: 'round' };\nfunction updateGamesFormPotPreview(){} function gamesFormHcpIsNet(){return false;} function refreshGamesFormHcpSection(){} function refreshGamesFormLowscoreSection(){} function applyGamesSuggestion(){}\n" + ['gamesBasisSelectHtml','gamesScoredPeriodRowHtml','gamesPeriodPickerHtml','periodExplainHtml','periodSegCount','lowscoreSegCount','snapToPeriods','lowscoreSnapToPeriods','gatheringGamesLowscoreSectionHtml','setGamesFormLowscorePeriod','setGamesFormLowscoreDollarPerPlayer','setGamesFormLowscoreBasis'].map(n => extractFn(src, n)).join('\n') + "\nthis.a={setGamesFormLowscorePeriod,setGamesFormLowscoreDollarPerPlayer,html:gatheringGamesLowscoreSectionHtml,cfg:()=>_gamesFormLowscoreConfig};", c2);
  const a = c2.a; a.setGamesFormLowscoreDollarPerPlayer('5'); a.setGamesFormLowscorePeriod('fbt');
  ok(a.cfg().period === 'fbt' && a.cfg().dollar_per_player === 6, 'form: choosing a period snaps the ante to a multiple of the periods');
  ok(/Low Score/.test(a.html()) && /Scoring period/.test(a.html()), 'form: section renders with the picker');
}
// Summary says how it was played, tab titles carry the period
{ const frow = { games: ['fourball'], dollar_per_player: 6, game_configs: { fourball: { dollar_per_player: 12, basis: 'net', net_mode: 'low', period: 'sixes', win_by: 'strokes', scope: 'group', pairs: [['Ann','Bob'],['Cy','Dee']] } } };
  const four = [card('Ann'), card('Bob'), card('Cy'), card('Dee')];
  const hh = ctx.f.renderGatheringPayoutHtml(E.computeGatheringGamesPayout(frow, four, {}, []));
  ok(/How it was played/.test(hh) && /6 \/ 6 \/ 6/.test(hh) && /3 pots/.test(hh) && /won on strokes/.test(hh), 'summary spells out the period, pots and how each is won');
  ok(/BestBall \(net, off the low · 6 \/ 6 \/ 6\)/.test(hh.replace(/<[^>]*>/g, '')) || /BestBall \(net, off the low · 6 \/ 6 \/ 6\)/.test(hh), 'BestBall tab title carries the period');
  const one = ctx.f.renderGatheringPayoutHtml(E.computeGatheringGamesPayout({ ...frow, game_configs: { fourball: { ...frow.game_configs.fourball, period: undefined, win_by: undefined, scope: undefined } } }, four, {}, []));
  ok(/one pot for the whole round/.test(one), 'one pot says so too');
  const lh = ctx.f.renderGatheringPayoutHtml(run({ period: 'fbt' }));
  ok(/How it was played/.test(lh) && /Front \/ Back \/ Total/.test(lh), 'Low Score summary names its period');
}
// the save check notices a server that drops the period
ok(ctx.f.droppedGameSettings({ fourball: { period: 'sixes' } }, { fourball: {} }).join() === 'BestBall scoring period', 'dropped period is caught');
ok(ctx.f.droppedGameSettings({ fourball: { period: 'sixes' } }, { fourball: { period: 'sixes' } }).length === 0, 'kept period passes');
ok(ctx.f.droppedGameSettings({ lowscore: { period: 'round' } }, '{"lowscore":{}}').length === 0, 'whole round needs no period; JSON string accepted');
ok(ctx.f.droppedGameSettings({ lowscore: { period: 'fbt' } }, null).join() === 'Low Score (whole game)', 'a missing game is caught');
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
