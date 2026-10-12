// Dev-93 — Fourball step 3: the Games form section (pair editor, Gross/Net + net mode,
// recommender button, pot preview, over-commit, save payload) plus recommendPairs unit tests.
import fs from 'fs'; import vm from 'vm'; import { JSDOM } from 'jsdom';
import { extractFn, loadEngine } from './extract.mjs';
import { fileURLToPath } from 'url';
const src = fs.readFileSync(fileURLToPath(new URL('../portal.html', import.meta.url)), 'utf8');
let pass = 0, fail = 0;
const eq = (a, b, m) => { const ok = JSON.stringify(a) === JSON.stringify(b); ok ? pass++ : fail++; if (!ok) console.log('FAIL', m, '\n  got', JSON.stringify(a), '\n  exp', JSON.stringify(b)); };
const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const E = loadEngine();

// ── recommendPairs
{
  const r = E.recommendPairs([{name:'A',hcp:2},{name:'B',hcp:8},{name:'C',hcp:14},{name:'D',hcp:20}]);
  eq(r.pairs, [['A','D'],['B','C']], 'rec: strongest with weakest');
  eq(r.combined, [22,22], 'rec: combined handicaps balanced'); ok(r.usedHandicaps, 'rec: used handicaps'); eq(r.unpaired, [], 'rec: none unpaired');
  const odd = E.recommendPairs([{name:'A',hcp:2},{name:'B',hcp:8},{name:'C',hcp:14},{name:'D',hcp:20},{name:'E',hcp:30}]);
  eq(odd.pairs.length, 2, 'rec: odd -> 2 pairs'); eq(odd.unpaired.length, 1, 'rec: odd -> one left over');
  const none = E.recommendPairs([{name:'Zed'},{name:'Amy'},{name:'Bo'},{name:'Cy'}]);
  ok(!none.usedHandicaps, 'rec: no data flagged'); eq(none.pairs.length, 2, 'rec: no data still pairs'); eq(none.guessed.length, 4, 'rec: all guessed');
  const mix = E.recommendPairs([{name:'A',hcp:0},{name:'B',hcp:10},{name:'C'},{name:'D',hcp:20}]);
  eq(mix.guessed, ['C'], 'rec: missing hcp named'); 
  eq(E.recommendPairs([]).pairs, [], 'rec: empty');
  eq(E.recommendPairs([{name:'A',hcp:1},{name:'B',hcp:2}]).pairs, [['A','B']], 'rec: two players one pair');
}

function sandbox({ names = ['Ann','Bob','Cy','Dee'], members = [] } = {}) {
  const dom = new JSDOM(`<body><div id="games-form-fourball-section"></div><input id="games-form-dpp" value="20"><div id="games-form-pot-preview"></div><button id="btn-save-games"></button></body>`);
  const posts = [], toasts = [];
  const ctx = { document: dom.window.document, console, JSON, Math, Number, String, Set, Map, Array, Object, parseFloat,
    showToast: (m, e) => toasts.push([m, !!e]),
    gatheringData: [{ gatheringId: 7, name: 'T', location: 'X' }], currentPlayer: 'Ann', BFE_API: 'x',
    gatheringsFetchJSON: async (u, o) => { posts.push(JSON.parse(o.body)); return { ok: true }; },
    loadHostGamesConfigs: async () => {}, renderHostPanelList: () => {},
    escapeHtml: s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])), escapeHtmlAttr: s => String(s).replace(/"/g, '&quot;'),
    isOpenSpotName: () => false, regData: [], gatheringRegData: names.map(p => ({ gatheringId: 7, player: p, status: 'Yes' })) };
  vm.createContext(ctx); ctx.BFEngine = E;
  E.getGame('fourball').released = true;
  const fns = ['gamesBasisSelectHtml','gamesScoredPeriodRowHtml','gamesPeriodPickerHtml','periodExplainHtml','periodSegCount','lowscoreSegCount','snapToPeriods','fourballSegCount','fourballSnapToSegments','setGamesFormFourballPeriod','setGamesFormFourballWinBy','setGamesFormFourballScope','gamesFormFourballNames','gatheringGamesFourballSectionHtml','refreshGamesFormFourballSection','setGamesFormFourballDollarPerPlayer','setGamesFormFourballBasis','setGamesFormFourballNetMode','setGamesFormFourballMember','addGamesFormFourballPair','removeGamesFormFourballPair','clearGamesFormFourballPairs','suggestGamesFormFourballPairs','gamesFormPlayerNames','gamesFormOverCommit','updateGamesFormPotPreview','submitGatheringGames','gamesFormHcpIsNet','gamesFormEntry','gamesFormResolvePlayerHcp','gamesFormBuildHandicapConfig','refreshGamesFormHcpSection'];
  vm.runInContext(`
    let _gamesFormTouched = new Set(); let _gamesFormSelected = new Set(['fourball']); let _gamesFormShadow = false; let _gamesFormCard = false; let _gamesFormG = null; let _gamesFormGathering = 7; let _gamesFormYesCount = ${names.length};
    let _gamesFormCttpConfig = { dollar_per_hole: null, hole_mode: 'all_par3', holes: [] }; let _gamesFormBirdieballConfig = { dollar_per_player: null }; let _gamesFormBirdiepayConfig = { dollar_per_birdie: null }; let _gamesFormBirdiepayPars = null;
    let _gamesFormFourballConfig = { dollar_per_player: null, basis: 'gross', net_mode: 'own', pairs: [] }; let _gamesFormFourballNote = ''; let _gamesFormLowscoreConfig = { dollar_per_player: null, basis: 'gross', period: 'round' };
    let _gamesFormHcp = { skins_basis: 'gross', birdiepay_basis: 'gross', allowance: 95, players: {} }; let _gamesFormTees = []; let _gamesFormMembers = new Map(${JSON.stringify(members)}); let _gamesFormPar3Holes = []; let _gamesFormVenueParDataAvailable = false;
    function refreshGamesFormHcpSection() {}
    ${fns.filter(n => n !== 'refreshGamesFormHcpSection').map(n => extractFn(src, n)).join('\n')}
    this.api = { ...{ setGamesFormFourballPeriod, setGamesFormFourballWinBy, setGamesFormFourballScope, fourballSnapToSegments, gatheringGamesFourballSectionHtml, setGamesFormFourballDollarPerPlayer, setGamesFormFourballBasis, setGamesFormFourballNetMode, setGamesFormFourballMember, addGamesFormFourballPair, removeGamesFormFourballPair, clearGamesFormFourballPairs, suggestGamesFormFourballPairs, submitGatheringGames, gamesFormOverCommit, updateGamesFormPotPreview }, cfg: () => _gamesFormFourballConfig, setSel: s => { _gamesFormSelected = new Set(s); }, setHcp: (n, e) => { _gamesFormHcp.players[n] = e; } };
  `, ctx);
  return { ctx, api: ctx.api, posts, toasts, dom };
}
const sec = t => t.dom.window.document.getElementById('games-form-fourball-section').innerHTML;

{
  const t = sandbox(); const a = t.api;
  a.addGamesFormFourballPair(); a.addGamesFormFourballPair();
  eq(a.cfg().pairs, [['',''],['','']], 'F: two empty pair rows');
  a.setGamesFormFourballMember(0, 0, 'Ann'); a.setGamesFormFourballMember(0, 1, 'Dee');
  a.setGamesFormFourballMember(1, 0, 'Bob'); a.setGamesFormFourballMember(1, 1, 'Cy');
  eq(a.cfg().pairs, [['Ann','Dee'],['Bob','Cy']], 'F: pairs picked');
  const html = a.gatheringGamesFourballSectionHtml();
  ok(/everyone paired/.test(html), 'F: status says everyone paired');
  ok(!/Net strokes/.test(html), 'F: net-mode toggle hidden on gross');
  a.setGamesFormFourballBasis('net'); a.setGamesFormFourballNetMode('low');
  eq([a.cfg().basis, a.cfg().net_mode], ['net', 'low'], 'F: net + low set');
  ok(/<option value="net" selected>/.test(a.gatheringGamesFourballSectionHtml()) && !/Off the low/.test(a.gatheringGamesFourballSectionHtml()), 'F: Scored on shows Net; the strokes mode lives in the Handicap strokes card');
  a.setGamesFormFourballBasis('gross');
  // taken players are not offered in other pickers
  a.removeGamesFormFourballPair(1); a.addGamesFormFourballPair();
  const h2 = a.gatheringGamesFourballSectionHtml();
  const lastSel = h2.split('<select').pop();
  ok(!/value="Ann"/.test(lastSel) && !/value="Dee"/.test(lastSel) && /value="Bob"/.test(lastSel), 'F: paired players excluded from the new row');
}
{ // unpaired status + save blocked on incomplete pair / missing $ / duplicates
  const t = sandbox(); const a = t.api;
  a.addGamesFormFourballPair(); a.setGamesFormFourballMember(0, 0, 'Ann');
  ok(/Not in a pair yet/.test(a.gatheringGamesFourballSectionHtml()), 'G: unpaired listed');
  a.setGamesFormFourballDollarPerPlayer('5');
  await a.submitGatheringGames(7);
  eq(t.posts.length, 0, 'G: incomplete pair blocks save'); ok(t.toasts.some(([m, e]) => e && /incomplete pair/.test(m)), 'G: toast');
  a.clearGamesFormFourballPairs(); a.setGamesFormFourballDollarPerPlayer('0');
  await a.submitGatheringGames(7);
  eq(t.posts.length, 0, 'G: no $ blocks save');
}
{ // recommender uses host-entered handicaps, then Membership
  const t = sandbox({ members: [['ann', { source: 'ghin', hcp: 2 }], ['bob', { source: 'ghin', hcp: 8 }]] }); const a = t.api;
  a.setHcp('Cy', { kind: 'index', index: 14 }); a.setHcp('Dee', { kind: 'given', strokes: 20 });
  a.suggestGamesFormFourballPairs();
  eq(a.cfg().pairs, [['Ann','Dee'],['Bob','Cy']], 'R: balanced by mixed handicap sources');
  ok(/Balanced by handicap/.test(sec(t)), 'R: note explains');
  const t2 = sandbox({ names: ['Ann','Bob'] }); t2.api.suggestGamesFormFourballPairs();
  eq(t2.api.cfg().pairs, [], 'R: <4 players makes no pairs'); ok(t2.toasts.some(([, e]) => e), 'R: toast explains');
  const t3 = sandbox({ names: ['A','B','C','D','E'] }); t3.api.suggestGamesFormFourballPairs();
  eq(t3.api.cfg().pairs.length, 2, 'R: odd field -> 2 pairs'); ok(/without a partner/.test(sec(t3)), 'R: leftover named');
}
{ // save payload + preview + over-commit
  const t = sandbox(); const a = t.api;
  a.setGamesFormFourballDollarPerPlayer('5');
  a.suggestGamesFormFourballPairs();
  const prev = t.dom.window.document.getElementById('games-form-pot-preview').innerHTML;
  ok(/Fourball: \$20\.00 \(4 × \$5\.00\)/.test(prev), 'P: preview line shows carve');
  eq(a.gamesFormOverCommit(20, 4).fixedCost, 20, 'P: fixed cost = rate × players');
  ok(a.gamesFormOverCommit(4, 4).problem, 'P: rate above $/player flagged');
  await a.submitGatheringGames(7);
  eq(t.posts.length, 1, 'P: saved');
  eq(t.posts[0].game_configs.fourball, { dollar_per_player: 5, basis: 'gross', net_mode: 'own', pairs: [['Ann','Dee'],['Bob','Cy']] }, 'P: payload game_configs.fourball');
  ok(!('handicap_config' in t.posts[0]), 'P: gross -> no handicap_config');
  const n = sandbox(); n.api.setGamesFormFourballDollarPerPlayer('5'); n.api.suggestGamesFormFourballPairs(); n.api.setGamesFormFourballBasis('net');
  await n.api.submitGatheringGames(7);
  eq(n.posts.length, 1, 'N: net saves'); ok(n.posts[0].handicap_config && n.posts[0].handicap_config.players, 'N: net sends handicap_config');
  // not selected -> nothing sent
  const u = sandbox(); u.api.setSel([]); u.api.setGamesFormFourballDollarPerPlayer('5');
  ok(u.api.gatheringGamesFourballSectionHtml() === '', 'U: no section until ticked');
}
{ // pot variants: segments, win by, scope, per-segment ante
  const t = sandbox(); const a = t.api;
  a.suggestGamesFormFourballPairs();
  a.setGamesFormFourballDollarPerPlayer('5');
  a.setGamesFormFourballPeriod('fbt');
  eq(a.cfg().dollar_per_player, 6, 'S: total snaps to a multiple of 3 ($5 -> $6, $2 a segment)');
  a.setGamesFormFourballDollarPerPlayer('5');
  eq(a.cfg().dollar_per_player, 15, 'S: with segments the box is per segment: $5 x 3 = $15 in all');
  let html = a.gatheringGamesFourballSectionHtml();
  ok(/Period won by/.test(html) && /Who competes/.test(html), 'S: win-by and scope appear once a split is chosen');
  ok(/\$15\.00 in all/.test(html) && /\$5\.00 for each of the 3 periods/.test(html), 'S: says $15 in all, $5 each');
  a.setGamesFormFourballWinBy('holes');
  eq([a.cfg().win_by, a.cfg().scope], ['holes', 'group'], 'S: holes won forces each foursome');
  ok(!/Who competes/.test(a.gatheringGamesFourballSectionHtml()), 'S: scope choice hidden when holes won');
  a.setGamesFormFourballWinBy('strokes'); a.setGamesFormFourballScope('field');
  eq(a.cfg().scope, 'field', 'S: strokes can run across the field');
  a.setGamesFormFourballPeriod('round');
  eq([a.cfg().period, a.cfg().win_by, a.cfg().scope], ['round', 'strokes', 'field'], 'S: back to one pot resets the variant');
  a.setGamesFormFourballPeriod('sixes'); a.setGamesFormFourballWinBy('holes'); a.setGamesFormFourballDollarPerPlayer('4');
  const prev = t.dom.window.document.getElementById('games-form-pot-preview').innerHTML;
  ok(/3 segment pots/.test(prev), 'S: pot preview says it is cut into 3 segment pots');
  await a.submitGatheringGames(7);
  eq(t.posts[0].game_configs.fourball, { dollar_per_player: 12, basis: 'gross', net_mode: 'own', pairs: [['Ann','Dee'],['Bob','Cy']], period: 'sixes', win_by: 'holes', scope: 'group' }, 'S: payload carries the variant, total ante = $4 x 3');
  const o = sandbox(); o.api.suggestGamesFormFourballPairs(); o.api.setGamesFormFourballDollarPerPlayer('5'); await o.api.submitGatheringGames(7);
  ok(!('period' in o.posts[0].game_configs.fourball), 'S: one pot saves exactly the old shape');
}
// the Net ranking checkbox must not inherit the full-width text-input rule (it rendered huge and squeezed its label)
ok(/\.host-form-field input\[type="checkbox"\][^{]*\{[^}]*width:\s*auto/.test(src), 'checkbox/radio inside a form field keep their natural width');
console.log(`fourball form: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
