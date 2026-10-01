// Dev-91 — the rail's read-only Strokes card + gross/net lines in the payout renderer.
import fs from 'fs'; import vm from 'vm';
import { extractFn, loadEngine } from './extract.mjs';
import { fileURLToPath } from 'url';
const src = fs.readFileSync(fileURLToPath(new URL('../portal.html', import.meta.url)), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const E = loadEngine();
const SI = [7,11,15,1,5,9,3,17,13, 12,6,2,10,4,18,8,14,16];
const PARS = [4,4,3,4,5,4,5,3,4, 3,5,4,4,4,3,4,5,3];
const ctx = { BFEngine: E, currentPlayer: 'Brian Hager', teeHeaderColor: () => '#1f8a4c', escapeHtml: v => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;'), evtGamesConfig: e => e.rc };
vm.createContext(ctx);
vm.runInContext(['atCourseHasNetStrokes', 'renderStrokeCardHtml', 'renderGatheringPayoutHtml', 'venueScorecardHtml', 'venueViewerStrokeInfo'].map(n => extractFn(src, n)).join('\n'), ctx);

const row = { games: ['skins', 'birdiepay'], dollar_per_player: 10, birdiepay_config: { dollar_per_birdie: 2, pars: PARS },
  handicap_config: { allowance: 95, skins_basis: 'net', birdiepay_basis: 'gross', players: {
    'Muna Aliya': { kind: 'given', tee: 'Gold', strokes: 20, stroke_index: SI },
    'Brian Hager': { kind: 'index', tee: 'Green', strokes: 8, index: 8, course_hcp: 8.8, stroke_index: SI } } } };
const rc = E.gatheringConfigFromLegacy(row);
ok(ctx.atCourseHasNetStrokes({ rc }) === true, 'rail button shows for a net round');
ok(ctx.atCourseHasNetStrokes({ rc: E.gatheringConfigFromLegacy({ games: ['skins'], dollar_per_player: 10 }) }) === false, 'no rail button for a gross round');
ok(ctx.atCourseHasNetStrokes({ rc: null }) === false, 'no rail button when no config');
const h = ctx.renderStrokeCardHtml(rc);
ok(/Muna Aliya/.test(h) && /20 strokes/.test(h) && /Gold tees/.test(h), 'card lists Muna: 20 strokes, Gold');
ok(/Index 8 → course hcp 8.8 × 95%/.test(h), 'card explains the indexed player');
ok(/Skins: <b>Net<\/b>/.test(h) && /Birdie Payouts: <b>Gross<\/b>/.test(h), 'card states each game\'s basis');
ok((h.match(/<br>••/g) || []).length === 2, 'Muna\'s 20 gives a double stroke on exactly two holes (SI 1, SI 2)');
ok(/Strokes given/.test(h) && /strokes/.test(h), 'given kind labelled');
ok(/scored gross/.test(ctx.renderStrokeCardHtml(E.gatheringConfigFromLegacy({ games: ['skins'], dollar_per_player: 10 }))), 'gross round says no strokes');

const card = (player, over = {}) => ({ player, holes: PARS.map((p, i) => over[i + 1] ?? p) });
const snap = E.computeGatheringGamesPayout(row, [card('Brian Hager', { 12: 5 }), card('Muna Aliya')], {}, []);
const html = ctx.renderGatheringPayoutHtml(snap);
ok(/Strokes \(95% allowance\)/.test(html) && /Muna Aliya/.test(html), 'payout shows strokes block');
ok(/Skins \(net\)/.test(html), 'skins labelled net');
ok(/Birdie Payouts \(gross\)/.test(html), 'birdie payouts labelled gross');
const grossSnap = E.computeGatheringGamesPayout({ games: ['skins'], dollar_per_player: 10 }, [card('A'), card('B', { 1: 3 })], {}, []);
ok(!/Strokes \(/.test(ctx.renderGatheringPayoutHtml(grossSnap)), 'gross snapshot has no strokes block');
ok(/\(3\)/.test(ctx.renderGatheringPayoutHtml(grossSnap)), 'gross skin line unchanged: plain score');

// Dev-91 — "me" highlight on the card, and the stroke-aware Course viewer
ok(/\(you\)/.test(ctx.renderStrokeCardHtml(rc, 'brian hager')), 'card marks the viewer\'s own row (case-insensitive)');
ok(!/\(you\)/.test(ctx.renderStrokeCardHtml(rc, 'Somebody Else')), 'no (you) for a non-player');
const evtN = { rc };
const info = ctx.venueViewerStrokeInfo(evtN, null);
ok(info && info.player === 'Brian Hager' && info.total === 8 && info.teeName === 'Green', 'viewer defaults to the person looking');
ok(info.strokes.filter(Boolean).length === 8 && info.strokes.every((k, i) => k === E.strokesOnHole(8, SI[i], 18)), 'stroke holes follow the frozen stroke index');
const muna = ctx.venueViewerStrokeInfo(evtN, 'muna aliya');
ok(muna.player === 'Muna Aliya' && muna.total === 20 && muna.teeName === 'Gold' && muna.strokes.filter(k => k === 2).length === 2, 'picker switches to Muna: 20 strokes, Gold tee, two doubles');
const other = Object.assign({}, ctx, {}); ctx.currentPlayer = 'Nobody';
ok(ctx.venueViewerStrokeInfo(evtN, null).player === 'Muna Aliya' || ctx.venueViewerStrokeInfo(evtN, null).player === 'Brian Hager', 'a viewer with no strokes falls back to the first player');
ok(ctx.venueViewerStrokeInfo({ rc: E.gatheringConfigFromLegacy({ games: ['skins'], dollar_per_player: 10 }) }, null) === null, 'gross round: no stroke info, viewer unchanged');
const tee = { tee_name: 'Green', holes: PARS.map((p, i) => ({ par: p, handicap: SI[i], yardage: 350 })) };
const gridNet = ctx.venueScorecardHtml(tee, muna.strokes);
ok(/>STK</.test(gridNet) && (gridNet.match(/>••</g) || []).length === 2 && /stroke hole/.test(gridNet), 'grid with strokes: STK row, two doubles, stroke legend');
ok(!/HCP 1–6 · hardest holes/.test(gridNet), 'stroke legend replaces the six-hardest legend');
const gridGross = ctx.venueScorecardHtml(tee);
ok(!/>STK</.test(gridGross) && /HCP 1–6 · hardest holes/.test(gridGross), 'gross grid unchanged (hardest-6 shading, no STK row)');

console.log(`test_stroke_card: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
