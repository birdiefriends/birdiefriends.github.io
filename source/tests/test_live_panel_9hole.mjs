// Dev-88, Phase A layer 4 — Live Panel hole_half fix (spec BF_BFE_NextGen_Spec.md
// §1a): "the Live Panel scorecard always sends hole_half: null ... A 9-hole gamed
// Gathering played on the back nine would record its holes as 1-9". Before this
// fix the Live Panel's Post-Round Scorecard also unconditionally required all 18
// holes (holeGrid(0,9)+holeGrid(9,18), allEntered = enteredCount===18) regardless
// of the event's own evt.holes, so a 9-hole gamed Gathering couldn't even
// complete the form. Covers: buildLivePanel's scoring-section source wiring
// (structural — too many unrelated closures to execute the whole function),
// and the real scSetPts/scToggleHoleHalf/submitScorecard functions run directly
// against a mocked 9-hole and 18-hole event.
import fs from 'fs'; import vm from 'vm'; import { extractFn } from './extract.mjs';
import { fileURLToPath } from 'url';
const HERE = (p) => fileURLToPath(new URL(p, import.meta.url));
const src = fs.readFileSync(HERE('../portal.html'), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };

// 1) Structural: buildLivePanel's scoring section computes scIsNine from the
// event's own hole count, gates allEntered/enteredCount on it, and only
// renders one hole grid (with the Front/Back toggle) for a 9-hole event.
const buildLivePanelSrc = extractFn(src, 'buildLivePanel');
ok(/const scIsNine = evt\.holes === 9;/.test(buildLivePanelSrc), 'scIsNine derived from evt.holes');
ok(buildLivePanelSrc.includes('window._liveScIsNine = scIsNine;'), 'scIsNine stashed for scSetPts (fired outside this closure)');
ok(/allEntered = enteredCount === \(scIsNine \? 9 : 18\)/.test(buildLivePanelSrc), 'allEntered gated on scIsNine, not hardcoded 18');
ok(buildLivePanelSrc.includes('scHoleHalfToggle') && buildLivePanelSrc.includes('scToggleHoleHalf()'), 'Front/Back toggle wired for 9-hole events');
ok(/scIsNine\s*\n?\s*\?\s*scHoleHalfToggle/.test(buildLivePanelSrc), 'scSection branches: 9-hole renders the toggle path, not the fixed front+back path');

// 2) Pure logic: scSetPts / scToggleHoleHalf / scPickHole against a mocked
// 9-hole round, run for real (not just grepped).
function freshCtx() {
  const ctx = {
    Array, String, Number, Math,
    _scHoles: new Array(18).fill(null), _scHoleHalf: 'front', _scPicking: null,
    window: { _liveScIsNine: true },
    renderLiveBanner: () => {},
  };
  vm.createContext(ctx);
  vm.runInContext(['scPickHole', 'scSetPts', 'scToggleHoleHalf'].map(n => extractFn(src, n)).join('\n'), ctx);
  return ctx;
}

// Front-9 auto-advance stops at hole 9 (index 8), doesn't walk into hole 10
let ctx = freshCtx();
vm.runInContext('scSetPts(7, 4)', ctx); // hole 8
ok(ctx._scPicking === 8, 'front-9: advances hole8 -> hole9 normally');
vm.runInContext('scSetPts(8, 3)', ctx); // hole 9, last of front
ok(ctx._scPicking === null, 'front-9: filling hole 9 (last of the active half) stops auto-advance instead of opening hole 10');
ok(ctx._scHoles[8] === 3 && ctx._scHoles[9] === null, 'hole 9 recorded, hole 10 untouched');

// Back-9 auto-advance runs the full 9-17 range and stops after hole 18
ctx = freshCtx();
ctx._scHoleHalf = 'back';
vm.runInContext('scSetPts(16, 4)', ctx); // hole 17
ok(ctx._scPicking === 17, 'back-9: advances hole17 -> hole18 normally');
vm.runInContext('scSetPts(17, 3)', ctx); // hole 18, last hole overall
ok(ctx._scPicking === null, 'back-9: filling hole 18 stops auto-advance');

// scToggleHoleHalf switches halves and clears the abandoned one
ctx = freshCtx();
ctx._scHoles[2] = 5; ctx._scHoles[3] = 4; // some front-9 data entered
vm.runInContext('scToggleHoleHalf()', ctx);
ok(ctx._scHoleHalf === 'back', 'toggle flips front -> back');
ok(ctx._scHoles[2] === null && ctx._scHoles[3] === null, 'abandoned front-half data is cleared on toggle');
ctx._scHoles[10] = 6;
vm.runInContext('scToggleHoleHalf()', ctx);
ok(ctx._scHoleHalf === 'front', 'toggle flips back -> front');
ok(ctx._scHoles[10] === null, 'abandoned back-half data is cleared on toggle back');

// An 18-hole event (window._liveScIsNine = false) still auto-advances the old way
ctx = freshCtx();
ctx.window._liveScIsNine = false;
vm.runInContext('scSetPts(8, 3)', ctx); // hole 9 of an 18-hole round
ok(ctx._scPicking === 9, '18-hole event: hole 9 still advances into hole 10 (no 9-hole boundary applies)');

// 3) submitScorecard: the real payload sent for strokes-mode 9-hole (front),
// 9-hole (back), and 18-hole rounds.
function submitCtx() {
  const calls = [];
  const ctx = {
    Array, String, Number, JSON, Object, Math,
    _scHoles: new Array(18).fill(null), _scHoleHalf: 'front', _scPicking: null,
    _scPlayer: 'Brian Hager', _scSubmitting: false,
    window: { _liveScoreMode: 'strokes', _liveIsTeamRound: false },
    currentPlayer: 'Brian Hager',
    eventData: [{ name: 'Chooch 9-Hole Gathering', holes: 9 }, { name: '18-Hole Gathering', holes: 18 }],
    SCORECARD_API: 'https://bfe.example/api',
    BFE_API: 'https://bfe.example/api',
    evtPhotoKey: (evt) => (evt && evt.name) || '',
    csNormalizedVenueName: () => 'Test Venue',
    renderLiveBanner: () => {},
    showToast: () => {},
    captureEventWeather: () => {},
    _bbAnswers: [],
    fetch: async (url, opts) => { calls.push({ url, body: JSON.parse(opts.body) }); return { json: async () => ({ ok: true }) }; },
  };
  vm.createContext(ctx);
  vm.runInContext(extractFn(src, 'submitScorecard'), ctx);
  return { ctx, calls };
}

// 9-hole, front active, with stray back-9 data that must be wiped before send
let { ctx: c1, calls: calls1 } = submitCtx();
c1._scHoles[0] = 4; c1._scHoles[1] = 5; c1._scHoles[9] = 9; // stray hole-10 data
await vm.runInContext(`submitScorecard('Chooch 9-Hole Gathering')`, c1);
ok(calls1.length === 1, 'one POST fired');
ok(calls1[0].body.hole_count === 9 && calls1[0].body.hole_half === 'front', '9-hole front: hole_count 9, hole_half "front" (was always null before this fix)');
ok(calls1[0].body.holes[9] === null, 'stray back-9 data wiped before send (belt-and-suspenders clear)');
ok(calls1[0].body.holes[0] === 4 && calls1[0].body.holes[1] === 5, 'front-9 real entries preserved');

// 9-hole, back active
let { ctx: c2, calls: calls2 } = submitCtx();
c2._scHoleHalf = 'back';
c2._scHoles[9] = 5; c2._scHoles[10] = 4;
await vm.runInContext(`submitScorecard('Chooch 9-Hole Gathering')`, c2);
ok(calls2[0].body.hole_count === 9 && calls2[0].body.hole_half === 'back', '9-hole back: hole_count 9, hole_half "back"');

// 18-hole event: hole_half stays null (unaffected by this fix)
let { ctx: c3, calls: calls3 } = submitCtx();
c3._scHoles[0] = 4; c3._scHoles[9] = 5;
await vm.runInContext(`submitScorecard('18-Hole Gathering')`, c3);
ok(calls3[0].body.hole_count === 18 && calls3[0].body.hole_half === null, '18-hole event: hole_count 18, hole_half null (unchanged behavior)');

console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
