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
const ctx = { BFEngine: E, escapeHtml: v => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;'), evtGamesConfig: e => e.rc };
vm.createContext(ctx);
vm.runInContext(['atCourseHasNetStrokes', 'renderStrokeCardHtml', 'renderGatheringPayoutHtml'].map(n => extractFn(src, n)).join('\n'), ctx);

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

console.log(`test_stroke_card: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
