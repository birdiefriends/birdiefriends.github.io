// Dev-91 — Games form Net/Gross section: per-player handicap resolution
// (USGA via BFEngine), the frozen handicap_config payload, and the end-to-end
// path form → engine for Brian's Sunday foursome.
import fs from 'fs'; import vm from 'vm';
import { extractFn, loadEngine } from './extract.mjs';
import { fileURLToPath } from 'url';
const src = fs.readFileSync(fileURLToPath(new URL('../portal.html', import.meta.url)), 'utf8');
let pass = 0, fail = 0;
const eq = (a, b, m) => { const ok = JSON.stringify(a) === JSON.stringify(b); ok ? pass++ : fail++; if (!ok) console.log('FAIL', m, '\n  got', JSON.stringify(a), '\n  exp', JSON.stringify(b)); };
const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const E = loadEngine();

const SI = [7,11,15,1,5,9,3,17,13, 12,6,2,10,4,18,8,14,16];
const PARS = [4,4,3,4,5,4,5,3,4, 3,5,4,4,4,3,4,5,3];
const hole = i => ({ par: PARS[i], handicap: SI[i] });
const tees = [
  { id: 1, tee_name: 'Green', slope_rating: 132, course_rating: 70.5, par_total: 71, holes: PARS.map((_, i) => hole(i)) },
  { id: 2, tee_name: 'Gold', slope_rating: 115, course_rating: 66.0, par_total: 71, holes: PARS.map((_, i) => hole(i)) },
  { id: 3, tee_name: 'Broken', slope_rating: 120, course_rating: 68, par_total: 71, holes: PARS.map((_, i) => ({ par: PARS[i], handicap: 1 })) }
];
const ctx = { BFEngine: E, _gamesFormG: { eventShadow: false }, _gamesFormGathering: 7, _gamesFormTees: tees,
  gatheringRegData: ['Brian Hager', 'Lee Chasen', 'Tony Hager', 'Muna Aliya'].map(p => ({ gatheringId: 7, player: p, status: 'Yes' })).concat([{ gatheringId: 7, player: 'Bailed', status: 'No' }]),
  regData: [], _gamesFormHcp: null, _gamesFormMembers: new Map(), _gamesFormSelected: new Set(['skins', 'birdiepay']), escapeHtml: v => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;') };
vm.createContext(ctx);
vm.runInContext(['gamesFormHcpOutHtml', 'gatheringGamesHcpSectionHtml', 'gamesFormEntry', 'gamesFormPlayerNames', 'gamesFormHcpIsNet', 'gamesFormResolvePlayerHcp', 'gamesFormBuildHandicapConfig'].map(n => extractFn(src, n)).join('\n'), ctx);
const set = hcp => { ctx._gamesFormHcp = hcp; };

// A: gross → no config at all
set({ skins_basis: 'gross', birdiepay_basis: 'gross', allowance: 95, players: {} });
eq(ctx.gamesFormBuildHandicapConfig(), { config: null, problem: null }, 'A: all gross sends no handicap_config');

// B: Sunday setup
set({ skins_basis: 'net', birdiepay_basis: 'net', allowance: 95, players: {
  'Brian Hager': { kind: 'index', index: 8, teeId: '1' },
  'Lee Chasen': { kind: 'given', strokes: '18', teeId: '1' },
  'Tony Hager': { kind: 'given', strokes: '18', teeId: '2' },
  'Muna Aliya': { kind: 'given', strokes: '20', teeId: '2' } } });
const b = ctx.gamesFormBuildHandicapConfig();
eq(b.problem, null, 'B: complete setup has no problem');
eq(b.config.players['Brian Hager'].strokes, 8, 'B: Brian index 8 on Green @95% = 8 strokes');
eq(b.config.players['Brian Hager'].course_hcp, 8.8, 'B: course hcp shown');
eq(b.config.players['Muna Aliya'].strokes, 20, 'B: strokes given used as typed (no allowance)');
eq(b.config.players['Tony Hager'].tee, 'Gold', 'B: tee name frozen');
ok(b.config.players['Lee Chasen'].stroke_index.length === 18, 'B: tee stroke index frozen');
ok(!('Bailed' in b.config.players), 'B: a No registration is not a player');

// C: the host owes a field → save refused with a sentence
set({ skins_basis: 'net', birdiepay_basis: 'gross', allowance: 95, players: { 'Brian Hager': { kind: 'index', teeId: '1' } } });
ok(/Brian Hager — enter a handicap index/.test(ctx.gamesFormBuildHandicapConfig().problem), 'C: missing index named');
set({ skins_basis: 'net', birdiepay_basis: 'gross', allowance: 95, players: { 'Brian Hager': { kind: 'index', index: 8 } } });
ok(/pick a tee/.test(ctx.gamesFormBuildHandicapConfig().problem), 'C: missing tee named');
set({ skins_basis: 'net', birdiepay_basis: 'gross', allowance: 95, players: { 'Brian Hager': { kind: 'given', strokes: 4, teeId: '3' } } });
ok(/no valid hole handicap/.test(ctx.gamesFormBuildHandicapConfig().problem), 'C: bad stroke-index data refused');
set({ skins_basis: 'net', birdiepay_basis: 'gross', allowance: 95, players: { 'Brian Hager': { kind: 'gross' }, 'Lee Chasen': { kind: 'gross' }, 'Tony Hager': { kind: 'gross' }, 'Muna Aliya': { kind: 'gross' } } });
ok(ctx.gamesFormBuildHandicapConfig().config.players['Lee Chasen'].strokes === 0, 'C: no-strokes player resolves to 0 without a tee');

// D: allowance changes the result (the thing Brian wanted to learn)
const at = a => { set({ skins_basis: 'net', birdiepay_basis: 'gross', allowance: a, players: { 'Brian Hager': { kind: 'index', index: 25, teeId: '1' } } }); return ctx.gamesFormResolvePlayerHcp('Brian Hager').strokes; };
eq([at(100), at(95), at(90)], [29, 27, 26], 'D: index 25 → 29 / 27 / 26 strokes at 100 / 95 / 90%');

// E: form → engine, end to end (the saved config closes exactly like a hand-built one)
set({ skins_basis: 'net', birdiepay_basis: 'net', allowance: 95, players: {
  'Brian Hager': { kind: 'index', index: 8, teeId: '1' }, 'Lee Chasen': { kind: 'given', strokes: 18, teeId: '1' },
  'Tony Hager': { kind: 'given', strokes: 18, teeId: '2' }, 'Muna Aliya': { kind: 'given', strokes: 20, teeId: '2' } } });
const cfg = ctx.gamesFormBuildHandicapConfig().config;
const card = (player, over = {}) => ({ player, holes: PARS.map((p, i) => over[i + 1] ?? p) });
const r = E.computeGatheringGamesPayout({ games: ['skins', 'birdiepay'], dollar_per_player: 10, birdiepay_config: { dollar_per_birdie: 2, pars: PARS }, handicap_config: cfg },
  [card('Brian Hager', { 12: 5 }), card('Lee Chasen'), card('Tony Hager'), card('Muna Aliya')], {}, []);
ok(r.skins.basis === 'net' && r.birdiepay.basis === 'net', 'E: both games net');
ok(r.payouts.reduce((s, x) => s + x.total, 0) + r.unallocated === r.total_pot, 'E: pot conserved');
// Brian's SI-2 hole (#12): he has 8 strokes so he gets one there; a gross bogey 5 is a net par 4.
eq(E.netCard(card('Brian Hager', { 12: 5 }), cfg.players['Brian Hager']).holes[11], 4, 'E: Brian\'s bogey on #12 becomes a net par');

// F: Membership prefill — real HCP -> Index (editable); NoHCP -> ask for strokes; unknown -> blank index
ctx._gamesFormMembers = new Map([
  ['brian hager', { hcp: 8, source: 'ghin_import' }],
  ['tony hager', { hcp: null, source: 'no_hcp' }],
  ['lee chasen', { hcp: 22, source: 'no_hcp' }],      // a number on file but flagged NoHCP: still ask for strokes
  ['muna aliya', { hcp: null, source: null }]]);
set({ skins_basis: 'net', birdiepay_basis: 'net', allowance: 95, players: {} });
const eb = ctx.gamesFormEntry('Brian Hager');
eq([eb.kind, eb.index], ['index', 8], 'F: member with an HCP prefills Index');
eq(ctx.gamesFormEntry('Tony Hager').kind, 'given', 'F: NoHCP asks for strokes');
eq(ctx.gamesFormEntry('Lee Chasen').kind, 'given', 'F: no_hcp source wins over a stale number');
eq(ctx.gamesFormEntry('Muna Aliya').kind, 'given', 'F: no number on file asks for strokes');
eq(ctx.gamesFormEntry('Stranger').kind, 'index', 'F: not in Membership starts as blank Index');
ok(/Not found in Membership/.test(ctx.gamesFormEntry('Stranger').note), 'F: says so');
ctx._gamesFormHcp.players['Brian Hager'].teeId = '1';
eq(ctx.gamesFormResolvePlayerHcp('Brian Hager').strokes, 8, 'F: prefilled Index resolves through the tee: 8 strokes');
ok(/enter strokes given/.test(ctx.gamesFormResolvePlayerHcp('Tony Hager').problem) || /pick a tee/.test(ctx.gamesFormResolvePlayerHcp('Tony Hager').problem), 'F: NoHCP player is not silently scratch');
ctx._gamesFormHcp.players['Brian Hager'].index = 12; // host override sticks
eq(ctx.gamesFormEntry('Brian Hager').index, 12, 'F: host edit is kept');

// G: compact layout — one grid row per player, result on the name line, tee-for-everyone
set({ skins_basis: 'net', birdiepay_basis: 'net', allowance: 95, players: {} });
ctx._gamesFormMembers = new Map([['brian hager', { hcp: 6.8, source: 'ghin_import' }]]);
const html = ctx.gatheringGamesHcpSectionHtml();
ok((html.match(/grid-template-columns:1\.2fr 1fr 0\.85fr/g) || []).length === 4, 'G: each of the 4 players is ONE three-column row (tee, mode, value)');
ok(/Same tee for everyone/.test(html), 'G: bulk tee control present');
ok((html.match(/gf-hcp-out-/g) || []).length === 4, 'G: result line on each name line');
ok(/>None</.test(html) && /Given</.test(html) && !/Strokes given<\/option>/.test(html), 'G: short mode labels');
ctx._gamesFormHcp.players['Lee Chasen'].kind = 'gross';
ok(/grid-template-columns:1fr;/.test(ctx.gatheringGamesHcpSectionHtml()), 'G: a no-strokes player collapses to one control');
ok(/pick a tee/.test(ctx.gamesFormHcpOutHtml(ctx.gamesFormResolvePlayerHcp('Brian Hager'))), 'G: missing tee shown on the result line');

console.log(`test_net_form: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
