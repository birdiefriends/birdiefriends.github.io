// Games setup wizard: one question per screen, same form state underneath.
import fs from 'fs'; import vm from 'vm'; import { JSDOM } from 'jsdom'; import { extractFn, loadEngine } from './extract.mjs'; import { fileURLToPath } from 'url';
const src = fs.readFileSync(fileURLToPath(new URL('../portal.html', import.meta.url)), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const eq = (a, b, m) => { const g = JSON.stringify(a) === JSON.stringify(b); g ? pass++ : fail++; if (!g) console.log('FAIL', m, '\n  got', JSON.stringify(a), '\n  exp', JSON.stringify(b)); };
const E = loadEngine(); E.getGame('fourball').released = true;
const GW_NAMES_SRC = src.match(/^const GW_NAMES = .*$/m)[0];
const names = [...src.matchAll(/^(?:async )?function (gatheringGames\w+|setGamesForm\w+|toggleGamesForm\w+|gamesForm\w+|refreshGamesForm\w+|gw\w+|gamesBasisSelectHtml|gamesScoredPeriodRowHtml|gamesPeriodPickerHtml|periodExplainHtml|periodSegCount|fourballSegCount|lowscoreSegCount|snapToPeriods|fourballSnapToSegments|lowscoreSnapToPeriods|renderGatheringGamesForm|applyGamesSuggestion|onGamesFormDppInput|updateGamesFormPotPreview|suggestGamesFormFourballPairs|addGamesFormFourballPair|removeGamesFormFourballPair|clearGamesFormFourballPairs|submitGatheringGames)\b/gm)].map(m => m[1]);
const uniq = [...new Set(names)].filter(n => !['gamesFormHcpOutHtml'].includes(n)).concat(['gamesFormHcpOutHtml']);
function world(existing) {
  const dom = new JSDOM('<body><div id="host-sheet-body"></div></body>'); const toasts = [], posts = [];
  const meta = { fourball: { label: 'BestBall', icon: 'F', group: 'format' }, lowscore: { label: 'Low Score', icon: 'L', group: 'format' }, skins: { label: 'Skins', icon: 'S' }, cttp: { label: 'CTP', icon: 'C' }, birdieball: { label: 'MiserBall', icon: 'M' }, birdiepay: { label: 'Birdie Payouts', icon: 'B' } };
  const ctx = { document: dom.window.document, console, JSON, Math, Number, String, Set, Map, Array, Object, parseFloat, BFEngine: E, GATHERING_GAMES_META: meta,
    showToast: (m, e) => toasts.push([m, !!e]), gatheringData: [{ gatheringId: 7, name: 'T', location: 'X' }], currentPlayer: 'Ann', BFE_API: 'x',
    gatheringsFetchJSON: async (u, o) => { posts.push(JSON.parse(o.body)); return { ok: true }; }, loadHostGamesConfigs: async () => {}, renderHostPanelList: () => {}, _hostGamesByGathering: new Map(),
    escapeHtml: s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])), escapeHtmlAttr: s => String(s).replace(/"/g, '&quot;'),
    gameInfoBtnHtml: () => '', gameInfoPanelHtml: () => '', isOpenSpotName: () => false, regData: [], gatheringRegData: ['Ann', 'Bob', 'Cy', 'Dee'].map(p => ({ gatheringId: 7, player: p, status: 'Yes' })), clearHostActionBar() {} };
  vm.createContext(ctx);
  vm.runInContext(`let _gw = { step: 'games' }; ${GW_NAMES_SRC}
    let _gamesFormTouched = new Set(); let _gamesFormSelected = new Set(); let _gamesFormShadow = false; let _gamesFormCard = false; let _gamesFormG = { gatheringId: 7, name: 'T' }; let _gamesFormGathering = 7; let _gamesFormYesCount = 4;
    let _gamesFormCttpConfig = { dollar_per_hole: null, hole_mode: 'all_par3', holes: [] }; let _gamesFormBirdieballConfig = { dollar_per_player: null }; let _gamesFormBirdiepayConfig = { dollar_per_birdie: null }; let _gamesFormBirdiepayPars = null;
    let _gamesFormFourballConfig = { dollar_per_player: null, basis: 'gross', net_mode: 'own', pairs: [], period: 'round', win_by: 'strokes', scope: 'field' }; let _gamesFormFourballNote = ''; let _gamesFormLowscoreConfig = { dollar_per_player: null, basis: 'gross', period: 'round' };
    let _gamesFormHcp = { skins_basis: 'gross', birdiepay_basis: 'gross', allowance: 95, ranking: false, players: {} }; let _gamesFormTees = [{ id: 1, tee_name: 'White' }]; let _gamesFormMembers = new Map(); let _gamesFormPar3Holes = []; let _gamesFormVenueParDataAvailable = false;
    ${uniq.map(n => extractFn(src, n)).join('\n')}
    this.api = { renderGatheringGamesForm, toggleGamesFormGame, gwNext, gwPrev, gwGoTo, gwSteps, submitGatheringGames, setGamesFormFourballBasis, setGamesFormRanking, setGamesFormFourballPeriod, setGamesFormBasis, setGamesFormLowscoreBasis, hcp: () => _gamesFormHcp, state: () => _gw, selected: () => _gamesFormSelected };`, ctx);
  return { ctx, api: ctx.api, dom, toasts, posts };
}
const vis = d => [...d.window.document.querySelectorAll('.gw-pane')].filter(e => e.style.display === 'block').map(e => e.id.replace('gw-pane-', ''));
const label = d => d.window.document.getElementById('gw-step-label').textContent;
{
  const t = world(), a = t.api, doc = t.dom;
  a.renderGatheringGamesForm(7, { gatheringId: 7, name: 'T' }, null);
  eq(a.gwSteps(), ['games'], 'nothing picked: just the first step');
  eq(vis(doc), ['games'], 'only the games pane shows');
  a.gwNext(); ok(t.toasts.length === 1 && vis(doc)[0] === 'games', 'Next with nothing picked stays and says so');
  ok(doc.window.document.getElementById('gw-next').textContent === 'Pick at least one game', 'button says to pick');
  a.toggleGamesFormGame('fourball'); a.toggleGamesFormGame('skins');
  eq(a.gwSteps(), ['games', 'fourball', 'fbpairs', 'skins', 'money', 'review'], 'rules per game first, every dollar amount on the last screen before the review');
  a.gwNext(); eq(vis(doc), ['fourball'], 'step 2 is the BestBall rules alone'); eq(doc.window.document.getElementById('games-wizard').dataset.sub, 'setup', 'setup half');
  ok(/Step 2 of 6 · BestBall/.test(label(doc)), 'step label: ' + label(doc));
  a.gwNext(); eq(doc.window.document.getElementById('games-wizard').dataset.sub, 'pairs', 'pairs half on the next step'); ok(/BestBall pairs/.test(label(doc)), 'pairs label');
  a.gwNext(); eq(vis(doc), ['skins'], 'skins alone');
  a.setGamesFormFourballBasis('net');
  ok(a.gwSteps().includes('hcp') && /of 7/.test(label(doc)), 'Net on adds the strokes step and the count');
  a.gwNext(); eq(vis(doc), ['hcp'], 'strokes step'); a.gwNext(); eq(vis(doc), ['money'], 'the money comes after the rules and strokes');
  t.toasts.length = 0; a.gwNext(); ok(t.toasts.length === 1 && vis(doc)[0] === 'money', 'no buy-in: cannot leave the money screen');
  doc.window.document.getElementById('games-form-dpp').value = '20'; a.gwNext(); eq(vis(doc), ['review'], 'review is last');
  ok(doc.window.document.getElementById('btn-save-games').style.display === 'block' && doc.window.document.getElementById('gw-next').style.display === 'none', 'review shows Save, not Next');
  const rv = doc.window.document.getElementById('gw-review').innerHTML;
  ok(/BestBall/.test(rv) && /Skins/.test(rv) && /Buy-in/.test(rv) && /gwGoTo\('fourball'\)|gwGoTo\('fbpairs'\)/.test(rv), 'review lists each game with a Change link');
  a.gwPrev(); eq(vis(doc), ['money'], 'Previous goes back one');
  // a problem found on save jumps to the screen that fixes it
  a.gwGoTo('review'); t.toasts.length = 0;
  doc.window.document.getElementById('games-form-dpp').value = '';
  a.submitGatheringGames(7); eq(vis(doc), ['money'], 'save with no buy-in jumps to the money step'); ok(t.toasts.length === 1, 'and says why');
}
{
  const t = world(), a = t.api, doc = t.dom;
  a.selected().add('skins'); // showGatheringGamesForm loads the saved picks before it renders
  a.renderGatheringGamesForm(7, { gatheringId: 7, name: 'T' }, { games: ['skins'], dollar_per_player: 10 });
  eq(vis(doc), ['review'], 'a saved config opens on the review step');
  ok(/Turn Off Games/.test(doc.window.document.getElementById('gw-pane-review').innerHTML), 'turn off lives on the review step');
  a.gwGoTo('skins'); a.gwNext(); eq(vis(doc), ['money'], 'Next from the last game goes to the money screen');
}
{
  const t = world(), a = t.api, doc = t.dom, d = doc.window.document;
  a.renderGatheringGamesForm(7, { gatheringId: 7, name: 'T' }, null);
  a.toggleGamesFormGame('birdieball'); a.toggleGamesFormGame('fourball');
  eq(a.gwSteps(), ['games', 'fourball', 'fbpairs', 'money', 'review'], 'MiserBall has no screen of its own, only an amount on the money screen');
  a.gwNext(); a.gwNext(); a.gwNext(); eq(vis(doc), ['money'], 'on the money screen');
  const dpp = d.getElementById('games-form-dpp'); dpp.value = '10'; t.ctx.onGamesFormDppInput();
  const bb = d.getElementById('gw-split-bb');
  ok(!!bb && !!d.getElementById('gw-split-fb'), 'the money screen has a box for every game amount');
  eq([d.getElementById('gw-split-fb').value, bb.value], ['8', '2'], 'the suggestion uses the whole $10: BestBall $8, MiserBall $2');
  bb.value = '3'; t.ctx.setGamesFormBirdieballDollarPerPlayer('3');
  t.ctx.onGamesFormDppInput();
  eq(d.getElementById('gw-split-bb').value, '3', 'a typed MiserBall $3 survives the buy-in changing');
  ok(d.getElementById('games-wizard').innerHTML.includes('gw-money'), 'dollar inputs on the rules screens carry the hide marker');
}
{ // "Also show a Net ranking" follows the games: on when any game is Net, off when none is, until the host decides
  const t = world(), a = t.api;
  a.renderGatheringGamesForm(7, { gatheringId: 7, name: 'T' }, null);
  a.toggleGamesFormGame('fourball'); a.toggleGamesFormGame('skins');
  ok(a.hcp().ranking === false, 'all Gross: no Net ranking');
  a.setGamesFormFourballBasis('net'); ok(a.hcp().ranking === true, 'a Net game turns the Net ranking on');
  a.setGamesFormFourballBasis('gross'); ok(a.hcp().ranking === false, 'back to all Gross turns it off again');
  a.setGamesFormBasis('skins_basis', 'net'); ok(a.hcp().ranking === true, 'Net Skins counts too');
  a.setGamesFormRanking(false); a.setGamesFormFourballBasis('net');
  ok(a.hcp().ranking === false, 'once the host unticks it, it stays unticked');
  a.setGamesFormRanking(true); a.setGamesFormBasis('skins_basis', 'gross'); a.setGamesFormFourballBasis('gross');
  ok(a.hcp().ranking === true, 'and a host-ticked ranking stays on');
}
{ // the money screen spells out the periods and the total, so the host does no mental math
  const t = world(), a = t.api, doc = t.dom, d = doc.window.document;
  a.renderGatheringGamesForm(7, { gatheringId: 7, name: 'T' }, null);
  a.toggleGamesFormGame('birdieball'); a.toggleGamesFormGame('fourball'); a.setGamesFormFourballPeriod('sixes');
  a.gwGoTo('money'); d.getElementById('games-form-dpp').value = '10'; t.ctx.onGamesFormDppInput();
  const row = d.getElementById('games-form-split').textContent;
  ok(/6 \/ 6 \/ 6 · 3 pots/.test(row), 'the BestBall row names the periods: ' + row.slice(0, 120));
  eq([d.getElementById('gw-split-fb').value, d.getElementById('gw-split-bb').value], ['3', '1'], '$10 lands as $3 a period ($9) plus MiserBall $1');
  ok(/3 × \$3 = \$9 each/.test(row), 'and shows 3 × $3 = $9 each');
  ok(/All \$10\.00 is in a game/.test(row), 'and confirms the whole buy-in is in a game');
}
console.log(`games wizard: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
