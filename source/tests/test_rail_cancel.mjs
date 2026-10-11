// Dev-93 — At-the-course rail + Live Panel vs. cancelled events, and the rail's off switch sticking.
import fs from 'fs'; import vm from 'vm';
import { extractFn } from './extract.mjs';
import { fileURLToPath } from 'url';
const src = fs.readFileSync(fileURLToPath(new URL('../portal.html', import.meta.url)), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const consts = ['AT_COURSE_RADIUS_M', 'AT_COURSE_TEE_WINDOW_MIN'].map(n => src.match(new RegExp(`const ${n} = [^;]+;`))[0]).join('\n');
function setup({ teeMinFromNow = -30, canceled = {}, name = '2026 BFSeries#8' } = {}) {
  const store = new Map(); const toasts = [];
  const evt = { id: 'e1', name, dt: new Date(Date.now() + teeMinFromNow * 60000), source: 'bf' };
  const ctx = { Date, Math, Number, String, Object, Set, Array, Promise, console, navigator: {}, URLSearchParams,
    localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    currentPlayer: 'Brian Hager', eventData: [evt], CANCELED_EVENTS: canceled,
    findMyReg: () => ({ status: 'Yes' }), loadVenues: async () => {}, findVenueByName: () => null, csNormalizedVenueName: e => e.name,
    renderAtCourseRail: () => {}, renderAtCourseToggle: () => {}, showToast: m => toasts.push(m),
    hasLivePanelSupport: () => true, LIVE_OVERRIDE: false, LIVE_EVENT_TEST_MODE: false, LIVE_TEST_EVENT_OVERRIDE: null, LIVE_STOPPED_ROUND: null,
    LIVE_EVENT_HOURS: 6, LIVE_PRESTART_MINUTES: 15, isRoundScorecardComplete: () => false };
  vm.createContext(ctx);
  const fns = ['isEventCanceled','atCourseEnabled','atCourseMyRoundOk','atCourseCandidates','atCourseLatchKey','atCourseIsLatched','atCourseLatch','atCourseDismissKey','atCourseIsDismissed','atCourseDismiss','atCourseToggleManual','refreshAtCourse','getLiveEvent','_candidateLiveRoundByWindow'];
  vm.runInContext(consts + '\nvar _atCourse = null, _atCoursePick = null, _atCourseUrlForce = null;\n' + fns.map(n => extractFn(src, n)).join('\n')
    + '\nthis.api = { refreshAtCourse, atCourseToggleManual, getLiveEvent, _candidateLiveRoundByWindow, state: () => ({ on: !!_atCourse, pick: _atCoursePick, reason: _atCourse && _atCourse.reason }) };', ctx);
  return { ...ctx.api, ctx, store, toasts };
}
// 1. baseline: after the tee window the rail comes on
{ const t = setup(); await t.refreshAtCourse(); ok(t.state().on && t.state().reason === 'tee_window', 'baseline: tee window turns the rail on'); }
// 2. the off switch sticks, even past tee time (the bug: tee-window trigger re-latched it instantly)
{ const t = setup(); await t.refreshAtCourse();
  t.atCourseToggleManual(); await t.refreshAtCourse(); // toggle calls refresh itself in the app; call again as a revisit
  ok(!t.state().on, 'off switch: rail stays off after toggle + refresh'); ok(t.toasts.includes('Rail off'), 'off switch: says Rail off');
  await t.refreshAtCourse(); ok(!t.state().on, 'off switch: still off on the next visibility refresh');
  ok(t.state().pick, 'off switch: toggle stays available to turn it back on');
  t.atCourseToggleManual(); await t.refreshAtCourse(); ok(t.state().on, 'off switch: tapping again turns it back on'); }
// 3. cancelled today -> no rail, no toggle, even in the tee window or when latched
{ const t = setup({ canceled: { '2026 BFSeries#8': 'Weather' } }); await t.refreshAtCourse();
  ok(!t.state().on && !t.state().pick, 'cancelled event: no rail and no toggle');
  t.store.set('bf_atcourse_on_e1', '1'); await t.refreshAtCourse(); ok(!t.state().on, 'cancelled event: a stale latch from before the cancel is ignored'); }
// 4. cancelling a different event changes nothing
{ const t = setup({ canceled: { 'Other Round': '' } }); await t.refreshAtCourse(); ok(t.state().on, 'other cancellations do not affect this event'); }
// 5. Live Panel: cancelled round never goes live (normal window, override, and the completion poller's window)
{ const t = setup({ canceled: { '2026 BFSeries#8': '' } });
  ok(t.getLiveEvent() === null, 'live panel: cancelled round is not live');
  ok(t._candidateLiveRoundByWindow() === null, 'live panel: completion poller ignores a cancelled round');
  t.ctx.LIVE_OVERRIDE = true; ok(t.getLiveEvent() === null, 'live panel: override does not resurrect a cancelled round');
  t.ctx.LIVE_TEST_EVENT_OVERRIDE = '2026 BFSeries#8'; ok(t.getLiveEvent() !== null, 'live panel: an explicitly picked TEST round still opens (dry runs)'); }
{ const t = setup(); ok(t.getLiveEvent() && t.getLiveEvent().name === '2026 BFSeries#8', 'live panel: a normal round still goes live'); }
console.log(`rail/cancel: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
