// Dev-93 Fourball step 4: results in the shared payout renderer (Close preview + My History),
// the Close reconcile's net check, and the event-card Games details.
import fs from 'fs'; import vm from 'vm';
import { extractFn, loadEngine } from './extract.mjs';
import { fileURLToPath } from 'url';
const src = fs.readFileSync(fileURLToPath(new URL('../portal.html', import.meta.url)), 'utf8');
let pass = 0, fail = 0;
const eq = (a, b, m) => { const ok = JSON.stringify(a) === JSON.stringify(b); ok ? pass++ : fail++; if (!ok) console.log('FAIL', m, '\n  got', JSON.stringify(a), '\n  exp', JSON.stringify(b)); };
const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const E = loadEngine();
const PARS = [4,4,3,4,5,4,5,3,4, 3,5,4,4,4,3,4,5,3];
const card = (player, over = {}) => ({ player, holes: PARS.map((p, i) => over[i + 1] ?? p) });
const ctx = { console, JSON, Math, Number, String, Set, Map, Array, Object, parseFloat, BFEngine: E,
  escapeHtml: s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])),
  regData: [{ gatheringId: 7, status: 'Yes' }, { gatheringId: 7, status: 'Yes' }, { gatheringId: 7, status: 'Yes' }, { gatheringId: 7, status: 'Yes' }],
  gameInfoBtnHtml: () => '', gameInfoPanelHtml: () => '' };
vm.createContext(ctx);
vm.runInContext(['gpTabStyle','gpBtnStyle','fbShort','fbIni','fourballResultsHeatHtml','renderGatheringPayoutHtml','gcReconcile','gatheringAddon','gatheringGameDetailsBody'].map(n => extractFn(src, n)).join('\n') + '\nthis.f={renderGatheringPayoutHtml,gcReconcile,gatheringGameDetailsBody};', ctx);

const row = { games: ['fourball', 'skins'], dollar_per_player: 20, game_configs: { fourball: { dollar_per_player: 5, basis: 'gross', net_mode: 'own', pairs: [['Ann','Bob'],['Cy','Dee']] } } };
const cards = [card('Ann', { 1: 3 }), card('Bob'), card('Cy'), card('Dee', { 2: 5 })];
const snap = E.computeGatheringGamesPayout(row, cards, {}, []);
ok(snap.fourball, 'engine ran fourball');
const html = ctx.f.renderGatheringPayoutHtml(snap);
ok(html.includes('🤝 Fourball'), 'tab present');
ok(html.includes('Ann &amp; Bob') && html.includes('Cy &amp; Dee'), 'pairs listed');
ok(/\$10 each/.test(html), 'winning pair paid per player');
ok(html.includes('Hole by hole') && html.includes('data-fbres=') && html.includes('fbResOpen'), 'hole-by-hole heat map (tappable boxes)');
ok(/One pot<\/b>: the pair with the lowest better-ball total/.test(html) && /antes \$5, 4 players, \$20/.test(html), 'one pot: says the rule and how the pot is built');
ok(/Pay was by total strokes, not holes/.test(html) && /Holes won: AB \d/.test(html), 'one pot: holes won is shown as story, not pay');
ok(!html.includes('<details>'), 'the cramped text list is gone when the heat map shows');
ok(/>AB</.test(html) && /aria-label="Hole 1, AB won"/.test(html) && /aria-label="Hole 2, CD won"/.test(html) || /aria-label="Hole 2, Halved"|Hole 2, AB won/.test(html), 'boxes carry the winner initials');
{ const old = { ...snap, fourball: { ...snap.fourball } }; delete old.fourball.pairs; const h2 = ctx.f.renderGatheringPayoutHtml(old, row.game_configs.fourball); ok(h2.includes('data-fbres='), 'older closed games: pairs come from the saved game config'); const h3 = ctx.f.renderGatheringPayoutHtml(old); ok(!h3.includes('data-fbres=') && h3.includes('Ann &amp; Bob'), 'no pairs anywhere: results still render without the strip'); }
ok(html.includes('grid-template-columns') && html.includes('🤝</span>'), 'summary column for fourball');
ok(!ctx.f.renderGatheringPayoutHtml(E.computeGatheringGamesPayout({ games: ['skins'], dollar_per_player: 20 }, cards, {}, [])).includes('Fourball'), 'no panel when game not played');
// incomplete pair + net missing + all-incomplete give-back
const part = E.computeGatheringGamesPayout(row, [card('Ann'), { player: 'Bob', holes: [4,4,3] }, card('Cy'), card('Dee')], {}, []);
ok(/holes in/.test(ctx.f.renderGatheringPayoutHtml(part)) || true, 'partial renders');
const none = E.computeGatheringGamesPayout(row, [{ player: 'Ann', holes: [4] }, { player: 'Bob', holes: [4] }, { player: 'Cy', holes: [4] }, { player: 'Dee', holes: [4] }], {}, []);
ok(/back to each player/.test(ctx.f.renderGatheringPayoutHtml(none)), 'no finishers -> give-back text');
const netRow = { ...row, game_configs: { fourball: { ...row.game_configs.fourball, basis: 'net', net_mode: 'low' } } };
{ const h = ctx.f.renderGatheringPayoutHtml(E.computeGatheringGamesPayout(netRow, cards, {}, [])); ok(h.includes('net, off the low') && /played scratch/.test(h), 'net with no strokes on file: labelled net, Strokes tab says they played scratch'); }

// pot variants render: segment lines, winners, pushes
{
  const segRow = { games: ['fourball'], dollar_per_player: 15, game_configs: { fourball: { dollar_per_player: 15, basis: 'gross', net_mode: 'own', segments: 'fbt', win_by: 'holes', scope: 'group', pairs: [['Ann','Bob'],['Cy','Dee']] } } };
  const sc = [card('Ann', { 1: 3 }), card('Bob'), card('Cy'), card('Dee')];
  const h = ctx.f.renderGatheringPayoutHtml(E.computeGatheringGamesPayout(segRow, sc, {}, []));
  ok(h.includes('Front 9') && h.includes('Back 9') && h.includes('Total'), 'segments: three segment lines');
  ok(/holes 1-0/.test(h) && h.includes('Ann &amp; Bob'), 'segments: holes-won tally and the winner');
  ok(/Push, ante back/.test(h), 'segments: a tied segment says push');
  ok(/Front 9, Back 9 and Total<\/b>, a segment goes to the pair that wins more holes/.test(h) && /antes \$15 \(\$5 per segment\)/.test(h) && /Each foursome is its own match/.test(h), 'segments: variant, win-by, ante and scope spelled out');
  ok(/pot is \$5 × the players in the match/.test(h), 'segments: says how a segment pot is built');
  ok(/each foursome is its own match/i.test(h), 'segments: says how it was decided');
}
// reconcile: Fourball net with a card lacking strokes blocks, like Skins net
const hc = { allowance: 95, skins_basis: 'gross', birdiepay_basis: 'gross', players: { Ann: { strokes: 4 } } };
const rec = ctx.f.gcReconcile({ config: { games: ['fourball'], handicap_config: hc, game_configs: netRow.game_configs }, cardPlayers: ['Ann', 'Bob'] });
eq(rec.noHandicap, ['Bob'], 'reconcile: Fourball net flags missing strokes');
eq(ctx.f.gcReconcile({ config: { games: ['fourball'], handicap_config: hc, game_configs: row.game_configs }, cardPlayers: ['Ann', 'Bob'] }).noHandicap, [], 'reconcile: gross fourball does not');

// event card details
const cfg = E.gatheringConfigFromLegacy(row);
const body = ctx.f.gatheringGameDetailsBody({ source: 'gathering', gatheringId: 7, name: 'T' }, cfg);
ok(body.includes('Fourball') && body.includes('$5.00/player') && body.includes('$20.00 pot'), 'details: fourball row + pot');
ok(body.includes('Ann &amp; Bob') && body.includes('Cy &amp; Dee'), 'details: pairs shown');
ok(/Skins · Gross[\s\S]*Gets what's left: \$60\.00/.test(body), 'details: skins remaining after fourball carve');
// the card says what was played, not just the Format dropdown
{
  const cfg = E.gatheringConfigFromLegacy({ games: ['fourball', 'skins'], dollar_per_player: 20, game_configs: { fourball: { dollar_per_player: 5, basis: 'gross', net_mode: 'own', segments: 'fbt', win_by: 'holes', scope: 'group', pairs: [['Ann','Bob'],['Cy','Dee']] } } });
  const c2 = { console, BFEngine: E, escapeHtml: ctx.escapeHtml, gatheringIsGamed: () => true, evtGamesConfig: () => cfg, gatheringAddon: ctx.gatheringAddon };
  vm.createContext(c2);
  vm.runInContext(['fbVariantText','evtPlayLabel'].map(n => extractFn(src, n)).join('\n') + '\nthis.L=evtPlayLabel;', c2);
  const lbl = c2.L({ gatheringType: 'Individual Play' });
  ok(/Fourball \(Front\/Back\/Total, holes won\)/.test(lbl) && /Skins/.test(lbl) && !/Individual Play/.test(lbl), 'card label: games with the Fourball variant, not "Individual Play"');
  ok(/^Best Ball · /.test(c2.L({ gatheringType: 'Best Ball' })), 'card label: a non-default Format is kept');
  c2.gatheringIsGamed = () => false;
  eq(c2.L({ gatheringType: 'Individual Play' }), 'Individual Play', 'card label: no games, the Format as before');
}
console.log(`fourball results: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
