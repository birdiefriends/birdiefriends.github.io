// Roll the dice end to end on the real Games form: roll, tick / untick a side game, use it, save a config the validator accepts.
import fs from 'fs'; import vm from 'vm'; import { JSDOM } from 'jsdom'; import { extractFn, loadEngine } from './extract.mjs'; import { fileURLToPath } from 'url';
const src = fs.readFileSync(fileURLToPath(new URL('../portal.html', import.meta.url)), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const eq = (a, b, m) => { const g = JSON.stringify(a) === JSON.stringify(b); g ? pass++ : fail++; if (!g) console.log('FAIL', m, '\n  got', JSON.stringify(a), '\n  exp', JSON.stringify(b)); };
const E = loadEngine(); E.getGame('fourball').released = true;
const GW_NAMES_SRC = src.match(/^const GW_NAMES = .*$/m)[0];
const ROLL_PAIRING_SRC = src.match(/^const GAMES_ROLL_PAIRING = .*$/m)[0];
const names = [...src.matchAll(/^(?:async )?function (gatheringGames\w+|setGamesForm\w+|toggleGamesForm\w+|gamesForm\w+|refreshGamesForm\w+|gw\w+|gamesBasisSelectHtml|gamesScoredPeriodRowHtml|gamesPeriodPickerHtml|periodExplainHtml|periodSegCount|fourballSegCount|lowscoreSegCount|snapToPeriods|fourballSnapToSegments|lowscoreSnapToPeriods|renderGatheringGamesForm|applyGamesSuggestion|onGamesFormDppInput|updateGamesFormPotPreview|suggestGamesFormFourballPairs|gamesRoll\w+|openGamesRoll|suggestGamesFormSideItems|gamesFormSideItems|gamesFormSideNames|addGamesFormFourballPair|removeGamesFormFourballPair|clearGamesFormFourballPairs|submitGatheringGames)\b/gm)].map(m => m[1]);
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
  vm.runInContext(`let _gw = { step: 'games' }; ${GW_NAMES_SRC} ${ROLL_PAIRING_SRC}
    let _gamesFormTouched = new Set(); let _gamesFormSelected = new Set(); let _gamesFormShadow = false; let _gamesFormCard = false; let _gamesFormG = { gatheringId: 7, name: 'T' }; let _gamesFormGathering = 7; let _gamesFormYesCount = 4;
    let _gamesFormCttpConfig = { dollar_per_hole: null, hole_mode: 'all_par3', holes: [] }; let _gamesFormBirdieballConfig = { dollar_per_player: null }; let _gamesFormBirdiepayConfig = { dollar_per_birdie: null }; let _gamesFormBirdiepayPars = null;
    let _gamesFormFourballConfig = { dollar_per_player: null, basis: 'gross', net_mode: 'own', pairs: [], period: 'round', win_by: 'strokes', scope: 'field' }; let _gamesFormFourballNote = ''; let _gamesFormLowscoreConfig = { dollar_per_player: null, basis: 'gross', period: 'round' };
    let _gamesFormHcp = { skins_basis: 'gross', birdiepay_basis: 'gross', allowance: 95, ranking: false, players: {} }; let _gamesFormTees = [{ id: 1, tee_name: 'White' }]; let _roll = null; let _gamesFormSideNote = { altshot: '', hilo: '', matchplay: '' }; let _gamesFormMembers = new Map(); let _gamesFormPar3Holes = []; let _gamesFormVenueParDataAvailable = false;
    ${uniq.map(n => extractFn(src, n)).join('\n')}
    this.api = { openGamesRoll, gamesRollDo, gamesRollGo, gamesRollAskKind, gamesRollAskVal, gamesRollUse, gamesRollToggleSide, gamesRollSetDpp, roll: () => _roll, side: () => _gamesFormSide, fb: () => _gamesFormFourballConfig, ls: () => _gamesFormLowscoreConfig, renderGatheringGamesForm, toggleGamesFormGame, gwNext, gwPrev, gwGoTo, gwSteps, submitGatheringGames, setGamesFormFourballBasis, setGamesFormRanking, setGamesFormFourballPeriod, setGamesFormBasis, setGamesFormLowscoreBasis, hcp: () => _gamesFormHcp, state: () => _gw, selected: () => _gamesFormSelected };`, ctx);
  return { ctx, api: ctx.api, dom, toasts, posts };
}

const eight = ['Ann', 'Bob', 'Cy', 'Dee', 'Eve', 'Fay', 'Gil', 'Hal'];
let saved = 0, bad = 0, sawNet = 0;
const NET = !process.argv.includes('--gross');
for (let i = 0; i < 40; i++) {
  const t = world(), a = t.api, doc = t.dom;
  t.ctx.gatheringRegData.length = 0; eight.forEach(p => t.ctx.gatheringRegData.push({ gatheringId: 7, player: p, status: 'Yes' }));
  a.renderGatheringGamesForm(7, { gatheringId: 7, name: 'T' }, null);
  if (NET) vm.runInContext(`['Ann','Bob','Cy','Dee','Eve','Fay','Gil','Hal'].forEach((n, i) => _gamesFormMembers.set(n.toLowerCase(), { hcp: 5 + i * 3, source: 'ghin' }))`, t.ctx);
  a.openGamesRoll();
  if (a.roll().ask) a.gamesRollGo();
  const r = a.roll();
  if (!r || !r.setup) { bad++; continue; }
  const sheet = doc.window.document.getElementById('games-roll-sheet');
  if (!sheet || !/Your setup/.test(sheet.innerHTML)) { bad++; continue; }
  if (Object.values(r.variants).some(v => v.basis === 'net')) sawNet++;
  if (i % 2) a.gamesRollToggleSide(r.setup.sideOptions[0]);          // tick / untick after the roll
  a.gamesRollSetDpp(20);
  a.gamesRollUse();
  if (doc.window.document.getElementById('games-roll-sheet')) { bad++; console.log('sheet left open'); continue; }
  const want = [r.setup.main, ...r.on].sort().join();
  if ([...a.selected()].sort().join() !== want) { bad++; console.log('selection mismatch', [...a.selected()], want); continue; }
  if (a.state().step !== 'review') { bad++; console.log('not on review', a.state().step); continue; }
  t.toasts.length = 0; t.posts.length = 0;
  await a.submitGatheringGames(7);
  if (t.posts.length === 1) saved++; else { bad++; console.log('save refused', JSON.stringify(r.setup), t.toasts, a.state().step); }
}
if (NET) { console.log('net rolls:', sawNet); ok(sawNet > 5, 'the net run really rolled Net setups'); }
ok(bad === 0 && saved === 40, 'forty rolls: every one fills the form and saves (' + saved + ' saved, ' + bad + ' bad)');
// pre-roll ask: players with no handicap get asked; typed numbers count as on file
{
  const t = world(), a = t.api;
  t.ctx.gatheringRegData.length = 0; eight.forEach(p => t.ctx.gatheringRegData.push({ gatheringId: 7, player: p, status: 'Yes' }));
  a.renderGatheringGamesForm(7, { gatheringId: 7, name: 'T' }, null);
  a.openGamesRoll();
  const r = a.roll(), sheet = t.dom.window.document.getElementById('games-roll-sheet');
  ok(r.ask && r.missing.length === 8 && /Before we roll/.test(sheet.innerHTML), 'nobody on file: asks about all 8 first');
  r.missing.forEach((n, i) => { a.gamesRollAskKind(i, i % 2 ? 'index' : 'given'); a.gamesRollAskVal(i, String(8 + i)); });
  a.gamesRollGo();
  ok(!a.roll().ask && a.roll().crew.hasHcp && a.roll().setup, 'typed handicaps count: crew has handicaps and the roll runs');
}
console.log(`test_roll_form: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
