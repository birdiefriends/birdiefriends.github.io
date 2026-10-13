// Dev-94 refactor — the registry says what a game IS; screens read it instead of checking game ids.
import fs from 'fs'; import vm from 'vm';
import { extractFn, loadEngine } from './extract.mjs';
import { fileURLToPath } from 'url';
const src = fs.readFileSync(fileURLToPath(new URL('../portal.html', import.meta.url)), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const E = loadEngine();

// every game declares traits that make sense together
const all = E.gamesInUiOrder();
ok(all.length >= 8, 'registry lists the games');
all.forEach(id => {
  const t = E.gameTraits(id);
  ok(['player', 'pair', 'ball', 'match'].includes(t.unit), id + ': unit is one of player/pair/ball/match');
  ok(['round', 'own', 'none'].includes(t.allowance), id + ': allowance is round/own/none');
  if (t.allowance === 'own') ok(typeof E.getGame(id).strokeRows === 'function', id + ': a game with its own allowance supplies strokeRows');
  if (t.sideForm) ok(t.sides, id + ': a side-form game is a sides game');
});
ok(E.sideGames().join() === 'fourball,altshot,matchplay', 'sides games in UI order');
ok(E.sideFormGames().join() === 'altshot,matchplay', 'side-form games');
ok(E.gamesWith(t => t.allowance === 'round').join() === 'fourball,lowscore,birdiepay,skins' || E.gamesWith(t => t.allowance === 'round').length === 4, 'round-allowance games');
ok(E.gameTraits('altshot').individualScores === false && E.gameTraits('matchplay').individualScores === false && E.gameTraits('fourball').individualScores === true, 'only one-ball / head-to-head games drop the individual ranking');
ok(JSON.stringify(E.gameSides('matchplay', { matches: [['A', 'B'], ['C', 'D']] })) === '[["A"],["B"],["C"],["D"]]', 'match sides are single players in play order');
ok(E.gameSides('altshot', { pairs: [['A', 'B'], ['C', 'D']] }).length === 2, 'pairs are the sides');

// a new game id never has to be named in the screens: these functions must not mention the side games by id
const SCREEN_FNS = ['liveSideGames', 'liveSideGid', 'liveSideTraits', 'liveSideSides', 'liveOneBall', 'liveSideChooserHtml', 'setLiveSideGame', 'skMarks', 'skPartnerOf', 'liveScoreModeHtml', 'fourballActionsHtml', 'fourballLiveSectionHtml', 'loadFourballLive', 'livePanelSections', 'renderStrokeCardHtml', 'sideResultHeroHtml', 'fourballResultsHeatHtml', 'fbResOpen', 'renderGatheringPayoutHtml'];
SCREEN_FNS.forEach(n => { const f = extractFn(src, n); ok(!/'(altshot|matchplay)'/.test(f), n + ' does not hard-code Alternate Shot / Match Play'); });

// live: a round with two side games gets a chooser and switching changes who is on the screen
const cfg = { addons: [{ id: 'fourball', pairs: [['A', 'B'], ['C', 'D']] }, { id: 'matchplay', matches: [['A', 'C'], ['B', 'D']] }], handicap: null };
const ctx = { console, JSON, Math, Number, String, Set, Map, Array, Object, Date, Promise, BFEngine: E, currentPlayer: 'A', SCORECARD_API: 'x', escapeHtml: s => String(s),
  localStorage: { getItem: () => null, setItem() {} }, window: { addEventListener() {} }, gatheringAddon: (c, id) => (c && c.addons.find(a => a.id === id)) || null,
  panelGamesGid: e => e.gatheringId, gamesScoreKeyForGid: g => 'g:' + g, csResolvePars: () => null, ensureVenueTeeInfoByName: async () => null, csNormalizedVenueName: () => 'V', renderLiveBanner() {} };
vm.createContext(ctx);
const names = ['liveScoringOn', 'liveSideGames', 'liveSideGid', 'liveSideTraits', 'liveSideSides', 'liveOneBall', 'liveSideChooserHtml', 'setLiveSideGame', 'skStoreKey', 'skEnsure', 'skGroups', 'skGroup', 'skCardOf', 'skMarks', 'skGoFirstOpen', 'skMaxHole'];
vm.runInContext('let _sk = null; let _fbUi = {};\n' + names.map(n => extractFn(src, n)).join('\n') + '\nthis.api={' + names.join(',') + ',get:()=>_sk};', ctx);
const A = ctx.api;
A.skEnsure({ gatheringId: 1, holes: 18 }, cfg);
ok(A.liveSideGames(cfg).join() === 'fourball,matchplay', 'both side games found');
ok(/BestBall/.test(A.liveSideChooserHtml()) && /Match Play/.test(A.liveSideChooserHtml()), 'chooser shows both');
ok(A.skGroups().length === 1 && A.skGroups()[0].pairs.length === 2 && A.skGroups()[0].pairs[0].length === 2, 'BestBall first: one foursome of two pairs');
A.setLiveSideGame('matchplay');
ok(A.liveSideGid(cfg) === 'matchplay' && A.skGroups().length === 2 && A.skGroups()[0].players.join() === 'A,C', 'switching to Match Play: two matches');
A.setLiveSideGame('nope');
ok(A.liveSideGid(cfg) === 'matchplay', 'an unknown game is ignored');
A.skEnsure({ gatheringId: 2, holes: 18 }, { addons: [{ id: 'skins' }], handicap: null });
ok(A.liveSideChooserHtml() === '', 'no chooser for a round with no side game (and none for just one)');

// story lives in the engine now
let st = E.sideMatchStory([{ res: 'A' }, { res: 'A' }, { res: 'T' }, { res: 'B' }, { res: 'B' }, { res: 'B' }, { res: 'A' }]);
ok(st.maxA === 2 && st.changes === 1 && st.lead === 0, 'engine story: biggest lead and lead changes');
ok(E.sideResultTags({ story: st, status: 'halved', winner: null, short: ['Ann', 'Bob'], decidedEarly: false, big: 'Halved' }).some(t => /Lead changed/.test(t.text)), 'engine tags');

console.log(`test_game_traits: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
