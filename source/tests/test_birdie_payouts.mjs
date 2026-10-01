// Dev-89 — Birdie Payouts: a flat $ per birdie-or-better, carved out of the
// buy-in pot before Skins. Covers the engine add-on (counting, cap, 9-hole
// back nine, no-par-data, conservation fuzz, old snapshots unchanged), the
// legacy-row adapter, and the portal pieces (Host Panel form + save payload,
// payout renderer, event-card Games details).
import fs from 'fs'; import vm from 'vm'; import { JSDOM } from 'jsdom';
import { extractFn, loadEngine } from './extract.mjs';
import { fileURLToPath } from 'url';
const HERE = (p) => fileURLToPath(new URL(p, import.meta.url));
const src = fs.readFileSync(HERE('../portal.html'), 'utf8');
let pass = 0, fail = 0;
const eq = (a, b, m) => { const ok = JSON.stringify(a) === JSON.stringify(b); ok ? pass++ : fail++; if (!ok) console.log('FAIL', m, '\n  got', JSON.stringify(a), '\n  exp', JSON.stringify(b)); };
const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const E = loadEngine();

const PARS = [4,4,3,4,5,4,5,3,4, 3,5,4,4,4,3,4,5,3]; // BSGC
const card = (player, over = {}, extra = {}) => ({ player, holes: PARS.map((p, i) => over[i + 1] ?? p), ...extra });
const row = (games, extra = {}) => ({ games, dollar_per_player: 20, birdiepay_config: { dollar_per_birdie: 5, pars: PARS }, ...extra });
const who = (r, n) => r.payouts.find(x => x.player === n);
const conserved = r => r.payouts.reduce((s, x) => s + x.total, 0) + r.unallocated === r.total_pot;

// ── A: basic count — birdie pays flat, eagle is still ONE payout, par/bogey don't
{
  const cards = [card('Ann', { 1: 3, 5: 3 }),        // birdie on #1 (par 4), eagle-ish 3 on par-5 #5
                 card('Bob', { 3: 2, 2: 5 }),        // birdie on #3 (par 3); bogey on #2
                 card('Cy')];
  const r = E.computeGatheringGamesPayout(row(['birdiepay', 'skins']), cards, {}, []);
  eq([r.birdiepay.count, r.birdiepay.per_birdie, r.birdiepay.paid_each, r.birdiepay.total_paid], [3, 5, 5, 15], 'A: 3 birdies × $5');
  eq(r.birdiepay.birdies.map(b => [b.hole, b.player, b.strokes, b.par]), [[1, 'Ann', 3, 4], [5, 'Ann', 3, 5], [3, 'Bob', 2, 3]], 'A: birdie rows in card/hole order');
  eq(r.total_pot, 60, 'A: pot 20×3');
  // Skins pot = 60 − 15 = 45. Hole 1: Ann 3 alone. #5: Ann 3 alone. #3: Bob 2 alone. #2: Bob 5 is worst → no skin.
  eq(r.skins.pot, 45, 'A: skins gets pot minus birdie payouts');
  eq(r.skins.won.length, 3, 'A: skins still computed independently');
  eq(who(r, 'Ann').birdiepay, 10, 'A: Ann 2 birdies = $10');
  eq(who(r, 'Bob').birdiepay, 5, 'A: Bob 1 birdie = $5');
  eq(who(r, 'Cy').birdiepay, undefined, 'A: no birdies → no birdiepay field');
  ok(conserved(r), 'A: paid + unallocated = pot');
}

// ── B: cap — birdies cost more than the pot has left → equal reduced payout, order-independent
{
  const cards = [card('Ann', { 1: 3, 2: 3 }), card('Bob', { 3: 2 })]; // 3 birdies
  const r = E.computeGatheringGamesPayout({ games: ['birdiepay'], dollar_per_player: 10, birdiepay_config: { dollar_per_birdie: 8, pars: PARS } }, cards, {}, []);
  eq([r.total_pot, r.birdiepay.capped, r.birdiepay.paid_each, r.birdiepay.total_paid, r.birdiepay.shortfall], [20, true, 6, 18, 6], 'B: 3×$8 > $20 pot → each paid floor(20/3)=$6');
  eq([who(r, 'Ann').birdiepay, who(r, 'Bob').birdiepay], [12, 6], 'B: same amount per birdie regardless of who made it first');
  // no skins selected: the $2 the cap left over is given back evenly ($1 each)
  eq([who(r, 'Ann').given_back, who(r, 'Bob').given_back], [1, 1], 'B: leftover after cap given back when Skins is off');
  ok(conserved(r), 'B: conserved');
}

// ── C: pipeline order — CTP and BirdieBall carve first, birdie payouts use what is left, Skins gets the rest
{
  const cards = [card('Ann', { 1: 3 }), card('Bob'), card('Cy'), card('Dee', { 4: 3 })];
  const r = E.computeGatheringGamesPayout({
    games: ['skins', 'cttp', 'birdieball', 'birdiepay'], dollar_per_player: 20,
    cttp_config: { dollar_per_hole: 10, holes: [3] }, birdieball_config: { dollar_per_player: 2 },
    birdiepay_config: { dollar_per_birdie: 4, pars: PARS }
  }, cards, { 3: { player: 'Bob', dist: 5 } }, [{ player_name: 'Cy', kept: true }]);
  // pot 80 − CTP 10 − BB 8 = 62 left; 2 birdies × 4 = 8 → skins pot 54
  eq([r.total_pot, r.birdiepay.total_paid, r.skins.pot], [80, 8, 54], 'C: skins = 80 − 10 − 8 − 8');
  ok(conserved(r), 'C: conserved with all four games');
}

// ── D: no par table → pays nothing, says so, pot stays with Skins
{
  const cards = [card('Ann', { 1: 3 }), card('Bob', { 1: 5 })];
  const noPars = E.computeGatheringGamesPayout({ games: ['birdiepay', 'skins'], dollar_per_player: 10, birdiepay_config: { dollar_per_birdie: 5, pars: [] } }, cards, {}, []);
  eq([noPars.birdiepay.no_par_data, noPars.birdiepay.count, noPars.birdiepay.total_paid, noPars.skins.pot], [true, 0, 0, 20], 'D: empty pars → nothing paid, flagged');
  const shortPars = E.computeGatheringGamesPayout({ games: ['birdiepay'], dollar_per_player: 10, birdiepay_config: { dollar_per_birdie: 5, pars: [4, 4, 4] } }, cards, {}, []);
  eq(shortPars.birdiepay.no_par_data, true, 'D: a partial par table is treated as no data, never guessed');
}

// ── E: 9-hole cards — back nine reads pars 10-18 and reports real hole numbers
{
  const back = { player: 'Ann', hole_count: 9, hole_half: 'back', holes: [2, 5, 4, 4, 4, 3, 4, 5, 3] }; // #10 par 3 → 2 = birdie; #17 par 5 → 5 no
  const front = { player: 'Bob', hole_count: 9, hole_half: 'front', holes: [3, 4, 3, 4, 5, 4, 5, 3, 4] }; // #1 par 4 → 3 = birdie
  const r = E.computeGatheringGamesPayout(row(['birdiepay']), [back, front], {}, []);
  eq(r.birdiepay.birdies.map(b => [b.hole, b.player, b.par]), [[10, 'Ann', 3], [1, 'Bob', 4]], 'E: back nine uses hole numbers/pars 10-18');
  const noHalf = E.computeGatheringGamesPayout(row(['birdiepay']), [{ player: 'Ann', hole_count: 9, hole_half: null, holes: [3, 4, 3, 4, 5, 4, 5, 3, 4] }], {}, []);
  eq(noHalf.birdiepay.count, 1, 'E: a 9-hole card with no half is read as the front nine');
}

// ── F: only Birdie Payouts on → leftover given back, nothing lost
{
  const r = E.computeGatheringGamesPayout(row(['birdiepay']), [card('Ann', { 1: 3 }), card('Bob'), card('Cy')], {}, []);
  eq([r.total_pot, r.birdiepay.total_paid, who(r, 'Ann').given_back, who(r, 'Bob').given_back], [60, 5, 18, 18], 'F: $55 back evenly = $18 each');
  eq(r.unallocated, 1, 'F: $1 rounding reported');
  ok(conserved(r), 'F: conserved');
}

// ── G: edge scores — blank, 0, null and non-numbers never count; name matching is canonical
{
  const c = { player: 'Ann', holes: [null, 0, 2, undefined, NaN, '3', 5, 3, 4, 3, 5, 4, 4, 4, 3, 4, 5, 3] }; // #3 par 3 → 2 is the only birdie
  const r = E.computeGatheringGamesPayout(row(['birdiepay']), [c, null, { player: '' }, { player: 'Bob', holes: null }], {}, []);
  eq([r.players_count, r.birdiepay.count], [2, 1], 'G: only numeric scores > 0 count; null/blank cards skipped');
  eq(r.birdiepay.birdies[0].hole, 3, 'G: the real birdie is #3');
}

// ── H: legacy-row adapter — the add-on needs BOTH the game and its config, like cttp/birdieball
{
  eq(E.gatheringConfigFromLegacy({ games: ['birdiepay'] }).addons, [], 'H: game on but no config → no add-on');
  eq(E.gatheringConfigFromLegacy({ games: ['skins'], birdiepay_config: { dollar_per_birdie: 5, pars: PARS } }).addons.map(a => a.id), ['skins'], 'H: config present but game off → no add-on');
  const a = E.gatheringConfigFromLegacy(row(['birdiepay', 'skins'])).addons;
  eq(a.map(x => x.id), ['birdiepay', 'skins'], 'H: birdiepay adapted');
  eq([a[0].dollar_per_birdie, a[0].pars.length], [5, 18], 'H: adapted config carries $/birdie and pars');
}

// ── I: existing snapshots keep their exact shape (no birdiepay key, no birdiepay row field)
{
  const r = E.computeGatheringGamesPayout({ games: ['skins'], dollar_per_player: 10 }, [card('A', { 1: 3 }), card('B')], {}, []);
  ok(!('birdiepay' in r), 'I: no birdiepay key when the game is off');
  ok(r.payouts.every(x => !('birdiepay' in x)), 'I: no birdiepay row field when the game is off');
  eq(Object.keys(r), ['calc_version', 'players_count', 'players', 'dollar_per_player', 'total_pot', 'games', 'cttp', 'birdieball', 'skins', 'payouts', 'unallocated'], 'I: key order unchanged');
}

// ── J: conservation fuzz — every dollar is paid or reported, never invented
{
  let seed = 89; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const pick = a => a[Math.floor(rnd() * a.length)];
  let bad = 0; const skipped = 0; const N = 3000;
  for (let i = 0; i < N; i++) {
    const games = ['birdiepay'].concat(['skins', 'cttp', 'birdieball'].filter(() => rnd() < 0.5));
    const cfg = {
      games, dollar_per_player: pick([5, 10, 20, 25]),
      cttp_config: { dollar_per_hole: pick([2, 5, 10]), holes: [3, 8] }, birdieball_config: { dollar_per_player: pick([1, 2, 3]) },
      birdiepay_config: { dollar_per_birdie: pick([1, 2, 3, 5, 10]), pars: PARS }
    };
    const n = 1 + Math.floor(rnd() * 8);
    const cards = Array.from({ length: n }, (_, k) => ({ player: 'P' + k, holes: PARS.map(p => rnd() < 0.05 ? null : p + pick([-2, -1, -1, 0, 0, 1, 2])) }));
    const r = E.computeGatheringGamesPayout(cfg, cards, {}, []);
    const paid = r.payouts.reduce((s, x) => s + x.total, 0);
    if (Math.abs(paid + r.unallocated - r.total_pot) > 1e-9) bad++;
    if (r.birdiepay.total_paid > r.total_pot) bad++;
    if (r.birdiepay.paid_each > r.birdiepay.per_birdie) bad++;
  }
  eq(bad, 0, `J: ${N} random closes (including over-committed CTP/BirdieBall), all conserved, never pays above the flat $ or the pot`);
}

// ── K: portal — Host Panel form, save payload, renderer, event-card details
function formSandbox({ pars = PARS, existing = null } = {}) {
  const dom = new JSDOM(`<body><div id="games-form-checklist"></div><input id="games-form-dpp" value="20"><div id="games-form-pot-preview"></div>
    <div id="games-form-cttp-section"></div><div id="games-form-birdieball-section"></div><div id="games-form-birdiepay-section"></div><button id="btn-save-games"></button></body>`);
  const posts = []; const toasts = [];
  const ctx = {
    document: dom.window.document, console, JSON, Math, Number, String, Set, Array, Object, parseFloat,
    showToast: (m, e) => toasts.push([m, !!e]),
    gatheringData: [{ gatheringId: 7, name: 'Test Gathering', location: 'Blue Shamrock Golf Club' }],
    currentPlayer: 'Brian Hager', BFE_API: 'https://bfe',
    gatheringsFetchJSON: async (url, opts) => { posts.push(JSON.parse(opts.body)); return { ok: true }; },
    loadHostGamesConfigs: async () => {}, renderHostPanelList: () => {}
  };
  vm.createContext(ctx); ctx.BFEngine = E; ctx.GAME_INFO = { skins: 'x', cttp: 'x', birdieball: 'x', birdiepay: 'x' }; 
  const fns = ['applyGamesSuggestion','gameInfoBtnHtml','gameInfoPanelHtml','gatheringGamesChecklistHtml', 'toggleGamesFormGame', 'gatheringGamesCttpSectionHtml', 'gatheringGamesBirdieballSectionHtml',
    'gatheringGamesBirdiepaySectionHtml', 'setGamesFormBirdiepayDollarPerBirdie', 'gamesFormOverCommit', 'updateGamesFormPotPreview', 'submitGatheringGames'];
  vm.runInContext(`
    const GATHERING_GAMES_META = ${JSON.stringify({ skins: { label: 'Skins', icon: 'x' }, cttp: { label: 'CTP', icon: 'x' }, birdieball: { label: 'BirdieBall', icon: 'x' }, birdiepay: { label: 'Birdie Payouts', icon: 'x' } })};
    let _gamesFormTouched = new Set(); let _gamesFormSelected = new Set(); let _gamesFormShadow = false; let _gamesFormCard = false; let _gamesFormG = null; let _gamesFormGathering = 7; let _gamesFormYesCount = 4;
    let _gamesFormCttpConfig = { dollar_per_hole: null, hole_mode: 'all_par3', holes: [] };
    let _gamesFormBirdieballConfig = { dollar_per_player: null };
    let _gamesFormBirdiepayConfig = { dollar_per_birdie: null };
    let _gamesFormBirdiepayPars = ${JSON.stringify(pars)};
    let _gamesFormPar3Holes = []; let _gamesFormVenueParDataAvailable = false;
    ${fns.map(n => extractFn(src, n)).join('\n')}
    this.updateGamesFormPotPreview = updateGamesFormPotPreview;
    this.api = { toggleGamesFormGame, setGamesFormBirdiepayDollarPerBirdie, submitGatheringGames, gatheringGamesBirdiepaySectionHtml, sel: () => [..._gamesFormSelected] };
  `, ctx);
  return { ctx, posts, toasts, dom };
}
{
  const t = formSandbox();
  const api = t.ctx.api;
  ok(!api.gatheringGamesBirdiepaySectionHtml(), 'K: no section until the game is ticked');
  api.toggleGamesFormGame('birdiepay');
  eq(api.sel(), ['birdiepay'], 'K: ticking adds it');
  ok(t.dom.window.document.getElementById('games-form-birdiepay-section').innerHTML.includes('per birdie'), 'K: $ per birdie field appears');
  ok(!t.dom.window.document.getElementById('games-form-birdiepay-section').innerHTML.includes('No par data'), 'K: no par warning when pars are on file');
  api.toggleGamesFormGame('skins');
  api.setGamesFormBirdiepayDollarPerBirdie('2.5');
  const prev = t.dom.window.document.getElementById('games-form-pot-preview').innerHTML;
  ok(/Pot preview: \$80\.00/.test(prev) && prev.includes('$2.50 per birdie') && prev.includes('Skins gets: $80.00 before birdie payouts'), 'K: preview shows the per-birdie rate and Skins "before birdie payouts"');
  await api.submitGatheringGames(7);
  eq(t.posts.length, 1, 'K: saved');
  eq(t.posts[0].games.slice().sort(), ['birdiepay', 'skins'], 'K: payload games');
  eq([t.posts[0].birdiepay_config.dollar_per_birdie, t.posts[0].birdiepay_config.pars], [2.5, PARS], 'K: payload carries $/birdie and the frozen par table');
  // turning it off clears its state so a stale rate can't leak into a later save
  api.toggleGamesFormGame('birdiepay'); api.toggleGamesFormGame('birdiepay');
  ok(!t.dom.window.document.getElementById('games-form-birdiepay-section').innerHTML.includes('value="2.5"'), 'K: untick/retick resets the rate');
}
{
  // no par data → warned in the form AND blocked at save (never saves a game that cannot count)
  const t = formSandbox({ pars: null });
  t.ctx.api.toggleGamesFormGame('birdiepay');
  ok(t.dom.window.document.getElementById('games-form-birdiepay-section').innerHTML.includes('No par data'), 'K: no-par warning shown');
  t.ctx.api.setGamesFormBirdiepayDollarPerBirdie('3');
  await t.ctx.api.submitGatheringGames(7);
  eq(t.posts.length, 0, 'K: save blocked without par data');
  ok(t.toasts.some(([m, e]) => e && /par data/i.test(m)), 'K: toast explains why');
  const z = formSandbox();
  z.ctx.api.toggleGamesFormGame('birdiepay');
  z.ctx.api.setGamesFormBirdiepayDollarPerBirdie(''); // v4.9.14: toggling now suggests an amount; the host clears it
  await z.ctx.api.submitGatheringGames(7);
  eq(z.posts.length, 0, 'K: save blocked without a $ per birdie');
}
{
  // renderer + details modal against a real engine snapshot
  const r = E.computeGatheringGamesPayout(row(['birdiepay', 'skins']), [card('Ann', { 1: 3 }), card('Bob')], {}, []);
  const rctx = { escapeHtml: s => String(s), BFEngine: E }; vm.createContext(rctx);
  vm.runInContext(extractFn(src, 'renderGatheringPayoutHtml') + ';this.f=renderGatheringPayoutHtml;', rctx);
  const html = rctx.f(r);
  ok(html.includes('Birdie Payouts') && html.includes('#1 Ann') && html.includes('par 4') && html.includes('🐤$5'), 'K: results show the birdie, its par, and the 🐤 chip in Ann\'s payout row');
  const none = rctx.f(E.computeGatheringGamesPayout(row(['birdiepay']), [card('Ann'), card('Bob')], {}, []));
  ok(none.includes('No birdies made'), 'K: zero birdies says so');
  const nop = rctx.f(E.computeGatheringGamesPayout({ games: ['birdiepay'], dollar_per_player: 5, birdiepay_config: { dollar_per_birdie: 5, pars: [] } }, [card('Ann')], {}, []));
  ok(nop.includes('No par data was saved'), 'K: missing par data is stated plainly, not shown as "no birdies"');
  const capped = rctx.f(E.computeGatheringGamesPayout({ games: ['birdiepay'], dollar_per_player: 5, birdiepay_config: { dollar_per_birdie: 8, pars: PARS } }, [card('Ann', { 1: 3, 2: 3 })], {}, []));
  ok(capped.includes('more than the pot had left'), 'K: a capped payout explains itself');
  // an old snapshot (no birdiepay key) renders with no birdie section
  const old = rctx.f(E.computeGatheringGamesPayout({ games: ['skins'], dollar_per_player: 10 }, [card('A'), card('B')], {}, []));
  ok(!old.includes('Birdie Payouts'), 'K: old snapshots show no Birdie Payouts block');

  const dctx = { regData: [], gatheringAddon: (c, id) => (c && c.addons.find(a => a.id === id)) || null }; vm.createContext(dctx); dctx.GAME_INFO = { skins: 'x', cttp: 'x', birdieball: 'x', birdiepay: 'x' };
  vm.runInContext('const regDataStub=1;' + `let regData = [{gatheringId: 7, status: 'Yes'},{gatheringId: 7, status: 'Yes'}];` + extractFn(src, 'gameInfoBtnHtml') + extractFn(src, 'gameInfoPanelHtml') + extractFn(src, 'gatheringGameDetailsBody') + ';this.f=gatheringGameDetailsBody;', dctx);
  const body = dctx.f({ source: 'gathering', gatheringId: 7 }, E.gatheringConfigFromLegacy(row(['birdiepay', 'skins'])));
  ok(body.includes('Birdie Payouts') && body.includes('$5.00 for every birdie') && body.includes('minus any birdie payouts'), 'K: event-card Games details list Birdie Payouts and tell Skins it shares the pot');
}

// ── M: over-committed carve-outs (Dev-89) — CTP purse / BirdieBall can never take more than the pot has
{
  const cards3 = [card('Ann', { 1: 3 }), card('Bob'), card('Cy')]; // 3 players
  // CTP: $10 × 2 holes = $20 fixed, but 3 players × $5 = $15 pot → each hole pays floor(15/2) = $7
  const r = E.computeGatheringGamesPayout({ games: ['cttp', 'skins'], dollar_per_player: 5, cttp_config: { dollar_per_hole: 10, holes: [3, 8] } }, cards3,
    { 3: { player: 'Bob', dist: 4 }, 8: { player: 'Cy', dist: 9 } }, []);
  eq([r.cttp.capped, r.cttp.per_hole, r.cttp.paid_per_hole], [true, 10, 7], 'M: CTP capped, reports the set rate and the paid rate');
  eq(r.cttp.holes.map(h => h.paid), [7, 7], 'M: every hole pays the same reduced amount');
  eq([who(r, 'Bob').cttp, who(r, 'Cy').cttp], [7, 7], 'M: leaders credited the reduced amount');
  eq(r.skins.pot, 1, 'M: $15 − $14 = $1 left for Skins');
  ok(conserved(r), 'M: CTP cap conserves the pot');
  // unclaimed hole under a cap rolls only what was actually carved
  const u = E.computeGatheringGamesPayout({ games: ['cttp', 'skins'], dollar_per_player: 5, cttp_config: { dollar_per_hole: 10, holes: [3, 8] } }, cards3, { 3: { player: 'Bob' } }, []);
  eq([u.cttp.unclaimed_to_skins, u.skins.pot], [7, 8], 'M: unclaimed capped hole ($7) rolls into Skins, not the configured $10');
  ok(conserved(u), 'M: conserved with an unclaimed capped hole');
  // a CTP that fits is untouched and carries no cap keys
  const fits = E.computeGatheringGamesPayout({ games: ['cttp'], dollar_per_player: 20, cttp_config: { dollar_per_hole: 10, holes: [3] } }, cards3, { 3: { player: 'Bob' } }, []);
  ok(!('capped' in fits.cttp) && !('paid_per_hole' in fits.cttp), 'M: uncapped CTP result has no cap keys');
  // BirdieBall: set at $4/player × 3 = $12, but CTP takes $10 of a $15 pot → only $5 left
  const b = E.computeGatheringGamesPayout({ games: ['cttp', 'birdieball'], dollar_per_player: 5, cttp_config: { dollar_per_hole: 10, holes: [3] }, birdieball_config: { dollar_per_player: 4 } },
    cards3, { 3: { player: 'Bob' } }, [{ player_name: 'Ann', kept: true }]);
  eq([b.birdieball.capped, b.birdieball.configured_pot, b.birdieball.pot, who(b, 'Ann').birdieball], [true, 12, 5, 5], 'M: BirdieBall pot capped to what CTP left');
  ok(conserved(b), 'M: BirdieBall cap conserves the pot');
  // everything over-committed at once, including Birdie Payouts: nobody is paid from money that isn't there
  const all = E.computeGatheringGamesPayout({ games: ['skins', 'cttp', 'birdieball', 'birdiepay'], dollar_per_player: 4,
    cttp_config: { dollar_per_hole: 9, holes: [3, 8] }, birdieball_config: { dollar_per_player: 3 }, birdiepay_config: { dollar_per_birdie: 5, pars: PARS } },
    cards3, { 3: { player: 'Bob' }, 8: { player: 'Cy' } }, [{ player_name: 'Bob', kept: true }]);
  ok(conserved(all) && all.payouts.every(x => x.total >= 0), 'M: fully over-committed round still conserves the pot');
  eq(all.payouts.reduce((t, x) => t + x.total, 0) <= all.total_pot, true, 'M: total paid never exceeds the pot');
  // results explain a cap in plain words
  const rctx = { escapeHtml: x => String(x), BFEngine: E }; vm.createContext(rctx);
  vm.runInContext(extractFn(src, 'renderGatheringPayoutHtml') + ';this.f=renderGatheringPayoutHtml;', rctx);
  const html = rctx.f(r);
  ok(html.includes('Set at $10/hole') && html.includes('each hole paid $7') && html.includes('CTP — $7/hole'), 'M: CTP cap explained in the results');
  ok(rctx.f(b).includes('the pot only had $5 left after CTP'), 'M: BirdieBall cap explained in the results');
}
// ── N: Host Panel guard (Dev-89) — can't save CTP/BirdieBall that don't fit the pot
{
  const g = formSandbox(); const api = g.ctx.api; const doc = g.dom.window.document;
  // 4 confirmed Yes × $20 = $80 pot. CTP $10 × 2 holes = $20 + BirdieBall $5 × 4 = $20 → $40 fits.
  const setup = (dpp, ctp, bb) => {
    doc.getElementById('games-form-dpp').value = String(dpp);
    vm.runInContext(`_gamesFormSelected = new Set(['cttp','birdieball','skins']); _gamesFormCttpConfig = { dollar_per_hole: ${ctp}, hole_mode: 'custom', holes: [3, 8] }; _gamesFormBirdieballConfig = { dollar_per_player: ${bb} };`, g.ctx);
  };
  setup(20, 10, 5);
  await api.submitGatheringGames(7);
  eq(g.posts.length, 1, 'N: a config that fits saves');
  setup(8, 10, 2); // pot 4 × 8 = $32; CTP 20 + BB 8 = $28 fits… bump CTP to overflow
  vm.runInContext(`_gamesFormCttpConfig.dollar_per_hole = 15;`, g.ctx); // 30 + 8 = 38 > 32
  await api.submitGatheringGames(7);
  eq(g.posts.length, 1, 'N: over-committed config is NOT saved');
  ok(g.toasts.some(([m, e]) => e && /more than the \$32\.00 pot/.test(m)), 'N: toast names the pot and the cost');
  g.ctx.updateGamesFormPotPreview();
  ok(doc.getElementById('games-form-pot-preview').innerHTML.includes('⚠️'), 'N: live preview shows the warning while editing');
  setup(3, 1, 4); // BirdieBall $4/player when each player only puts in $3 — impossible at any headcount
  await api.submitGatheringGames(7);
  eq(g.posts.length, 1, 'N: BirdieBall rate above $/player is never saved');
  ok(g.toasts.some(([m, e]) => e && /more than the whole \$3\.00/.test(m)), 'N: toast explains BirdieBall > $/player');
  setup(20, 10, 5);
  vm.runInContext(`_gamesFormYesCount = 0;`, g.ctx); // nobody confirmed yet: only headcount-independent checks apply
  await api.submitGatheringGames(7);
  eq(g.posts.length, 2, 'N: with no confirmed players yet, a plausible config still saves');
}
// ── L: wiring — checklist meta, seal label, engine version tag, worker accepts the game
{
  ok(/birdiepay:\s+\{ label: 'Birdie Payouts'/.test(src), 'L: game is in GATHERING_GAMES_META');
  ok(/birdiepay: 'BIRDIE PAY'/.test(src), 'L: event-card seal has a label for it');
  const w = fs.readFileSync(HERE('../bf_experiences_worker.js'), 'utf8');
  ok(w.includes("const VALID_GAMES = ['skins', 'cttp', 'birdieball', 'birdiepay'];"), 'L: Worker VALID_GAMES includes birdiepay');
  ok(w.includes('ALTER TABLE bfe_gathering_games') && w.includes('ADD COLUMN birdiepay_config TEXT'), 'L: the migration is documented in the Worker schema comment');
  ok(/UPDATE bfe_gathering_games SET birdiepay_config = \?/.test(w), 'L: Worker writes birdiepay_config in its own statement (other saves survive a missing column)');
  ok(!/INSERT INTO bfe_gathering_games[^`]*birdiepay/.test(w), 'L: the main upsert does not reference the new column');
}

console.log(`${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
