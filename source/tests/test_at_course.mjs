import fs from 'fs'; import vm from 'vm'; import { JSDOM } from 'jsdom'; import { extractFn } from './extract.mjs';
import { fileURLToPath } from 'url';
const HERE = (p) => fileURLToPath(new URL(p, import.meta.url));
const src = fs.readFileSync(HERE('../portal.html'), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const MOSELEM = { id: 3, name: 'Moselem Springs Golf Club', lat: 40.500372, lng: -75.848075 };
const today = new Date(); today.setHours(12, 50, 0, 0);
const tomorrow = new Date(today.getTime() + 86400000);
function setup({ player = 'Brian Hager', pos = null, geoErr = false, forced = false, regStatus = 'Yes', evtDay = today, bfe = false, liveId = null, search = '' } = {}) {
  const dom = new JSDOM('<body><input id="card-video-camera-input"><input id="card-photo-upload-input"></body>', { url: 'https://birdiefriends.com/portal.html' + search });
  const clickLog = [];
  ['card-video-camera-input', 'card-photo-upload-input'].forEach(id => {
    dom.window.document.getElementById(id).click = () => clickLog.push(id);
  });
  const store = new Map(forced ? [['bf_atcourse_force', forced === 'legacy' ? '1' : String(forced === 'old' ? Date.now() - 5 * 3600000 : Date.now())]] : []);
  const calls = [];
  const evt = { id: 'gathering-42', name: 'Jefferson Classic', source: 'gathering', gatheringId: 42, location: 'Moselem Springs Golf Club', dt: evtDay };
  const ctx = {
    document: dom.window.document, location: dom.window.location, URLSearchParams, console, Math, Number, String, Date, Array, Object, isNaN, JSON,
    window: { scrollTo: () => calls.push('scrollTo'), addEventListener: () => {}, innerHeight: 780, innerWidth: 390 },
    localStorage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: k => store.delete(k) },
    navigator: { geolocation: { getCurrentPosition: (ok, err) => { calls.push('geo'); geoErr ? err({ message: 'denied' }) : ok({ coords: pos }); } } },
    currentPlayer: player, eventData: [evt],
    regData: [{ gatheringId: 42, eventName: 'Jefferson Classic', player: 'Brian Hager', status: regStatus, createdAt: '2026-09-20' }],
    loadVenues: async () => [MOSELEM], findVenueByName: n => (n === MOSELEM.name ? MOSELEM : null), csNormalizedVenueName: e => e.location,
    isBFEBackedCard: () => bfe, getLiveEvent: () => (liveId ? { id: liveId } : null),
    showToast: () => {}, _livePanelOpen: false, toggleLivePanel: () => { calls.push('toggleLive'); ctx._livePanelOpen = true; },
  };
  vm.createContext(ctx);
  const consts = ['AT_COURSE_RADIUS_M', 'AT_COURSE_TEST_HOURS'].map(n => src.match(new RegExp(`const ${n} = [^;]+;`))[0]).join('\n');
  const fns = ['atCourseExitTest','atCourseLoadPos','atCourseSavePos','atCourseApplyPos','escapeHtml','findMyReg','atCourseEnabled','atCourseForced','haversineM','atCourseMyRoundOk','atCourseCandidates','refreshAtCourse','toggleAtCourseRail','renderAtCourseRail','atCourseInitOnce','renderAtCourseLocDetail','atCourseToggleLocDetail','atCourseQuickCapture'];
  vm.runInContext(consts + '\nvar _atCourse = null, _atCourseTucked = false, _atCourseInit = false, _atCourseScrollTimer = null, _atCoursePanelPeek = false, _atCourseJustDragged = false, _atCourseLocDetailOpen = false, _cardPhotoEvt = null;\n' + fns.map(n => extractFn(src, n)).join('\n'), ctx);
  // document.addEventListener exists on jsdom document
  return Object.assign(ctx, { calls, store, clickLog, rail: () => dom.window.document.getElementById('at-course-rail'), locDetail: () => dom.window.document.getElementById('at-course-loc-detail') });
}
const flush = () => new Promise(r => setTimeout(r, 0));
const onCourse = { latitude: 40.5031, longitude: -75.8452 };   // ~0.4 km from the venue point
const home = { latitude: 40.6084, longitude: -75.4902 };        // Allentown area, ~32 km away
// distance sanity
let c = setup(); ok(Math.abs(c.haversineM(40.5, -75.85, 40.5, -75.85)) < 1, 'haversine zero');
ok(c.haversineM(onCourse.latitude, onCourse.longitude, MOSELEM.lat, MOSELEM.lng) < 600, 'on-course point within 600 m');
// 1. At the course → rail with all items, distance label
c = setup({ pos: onCourse }); await c.refreshAtCourse(); await flush();
let r = c.rail(); ok(!!r, 'rail shown at the course');
ok(r && /0\.\d mi/.test(r.innerHTML), 'shows distance in miles');
ok(r && ['Photo','Video','Upload','Note','Yardage','Rules','Course'].every(l => r.innerHTML.includes(`>${l}<`)), 'core tools present, incl. new Video/Upload');
ok(r && r.innerHTML.includes("atCourseQuickCapture('gathering-42','video')"), 'Video button wired to quick capture');
ok(r && r.innerHTML.includes("atCourseQuickCapture('gathering-42','upload')"), 'Upload button wired to quick capture');
ok(r && !r.innerHTML.includes('>Games<'), 'Dev-88: no Games button on the rail at all anymore (dropped — see §9)');
ok(r && r.innerHTML.includes("openVenueViewerModal('gathering-42')"), 'Course opens venue viewer for this round');
ok(r && r.innerHTML.includes('atCourseToggleLocDetail()'), 'distance pill wired to location detail popover when not forced');
// 2. Away from the course → no rail
c = setup({ pos: home }); await c.refreshAtCourse(); await flush(); ok(!c.rail(), 'no rail 20 mi away');
// 3. Location denied → no rail, no crash
c = setup({ geoErr: true }); await c.refreshAtCourse(); await flush(); ok(!c.rail(), 'denied → no rail');
// 4. Dev-88: opened from beta to every signed-in, registered player — a
// non-Brian player who's registered for today's round sees the rail too;
// only a signed-out session (no currentPlayer) skips it entirely.
c = setup({ player: 'Scott Justus', pos: onCourse });
c.regData.push({ gatheringId: 42, eventName: 'Jefferson Classic', player: 'Scott Justus', status: 'Yes', createdAt: '2026-09-20' });
await c.refreshAtCourse(); await flush();
ok(!!c.rail() && c.calls.includes('geo'), 'opened to all players: non-Brian player sees the rail too');
c = setup({ player: '', pos: onCourse }); await c.refreshAtCourse(); await flush();
ok(!c.rail() && !c.calls.includes('geo'), 'signed-out (no currentPlayer): no rail, no location request');
// 5. Not registered (No) → no rail, no location request
c = setup({ pos: onCourse, regStatus: 'No' }); await c.refreshAtCourse(); await flush();
ok(!c.rail() && !c.calls.includes('geo'), 'not registered → no location request');
// 6. Round is tomorrow, not today → no rail
c = setup({ pos: onCourse, evtDay: tomorrow }); await c.refreshAtCourse(); await flush(); ok(!c.rail(), 'no round today → no rail');
// 7. Forced test mode: shows for next registered round (even tomorrow), labeled TEST, no GPS
c = setup({ forced: true, evtDay: tomorrow }); await c.refreshAtCourse(); await flush();
r = c.rail(); ok(!!r && r.innerHTML.includes('TEST') && !c.calls.includes('geo'), 'forced mode: TEST rail, no GPS');
// 8. URL switch sets and clears the force flag
c = setup({ search: '?atcourse=1', pos: home }); c.atCourseInitOnce(); ok(Number(c.store.get('bf_atcourse_force')) > 1e12, '?atcourse=1 stores a timestamp');
c = setup({ forced: true, search: '?atcourse=0', pos: home }); c.atCourseInitOnce(); ok(!c.store.has('bf_atcourse_force'), '?atcourse=0 clears force');
// 9. Dev-88 (second pass, live during a real round): the rail's own Games
// button is gone — it only ever opened the Live Panel, which the card's own
// header already does, and Brian wanted the space back ("I don't think it's
// necessary... drop it to conserve space"). Live/gamed round or not, the
// rail never shows a Games button any more.
c = setup({ pos: onCourse, liveId: 'gathering-42' }); await c.refreshAtCourse(); await flush();
r = c.rail(); ok(r && !r.innerHTML.includes('>Games<'), 'Games button dropped from the rail even for a live gamed round');
// 9b. The Live Panel's own Photos section was also dropped for non-BFE
// rounds (it posted to the same event_photos pipeline the rail already
// covers — a straight duplicate, not an alternative), so the rail is now
// this round's one capture point whether or not the Live Panel is open.
// Photo/Video/Upload/Note stay put either way; Yardage/Rules/Course too.
c._livePanelOpen = true; c.renderAtCourseRail(); r = c.rail();
ok(r && ['Photo','Video','Upload','Note','Yardage','Rules','Course'].every(l => r.innerHTML.includes(`>${l}<`)), 'capture buttons stay on the rail even with the Live Panel open (its own copy was dropped, not this one)');
c._livePanelOpen = false; c.renderAtCourseRail(); r = c.rail();
ok(r && ['Photo','Video','Upload','Note'].every(l => r.innerHTML.includes(`>${l}<`)), 'still there once the Live Panel closes too');
// 10. BFE-backed round hides Photo/Note (capture lives in WCRP/Live Panel there)
c = setup({ pos: onCourse, bfe: true }); await c.refreshAtCourse(); await flush();
r = c.rail(); ok(r && !r.innerHTML.includes('>Photo<') && !r.innerHTML.includes('>Note<') && r.innerHTML.includes('>Yardage<'), 'BFE round: no Photo/Note');
// 11. Tuck toggles class; leaving the course removes the rail
c = setup({ pos: onCourse }); await c.refreshAtCourse(); await flush();
c.toggleAtCourseRail(); ok(c.rail().className === 'tucked', 'tuck');
c.toggleAtCourseRail(); ok(c.rail().className === '', 'untuck');
c.navigator.geolocation.getCurrentPosition = (okFn) => okFn({ coords: home });
await c.refreshAtCourse(); await flush(); ok(!c.rail(), 'left the course → rail removed on next check');
// 12. Live Panel open → rail auto-tucks; grip peeks; closing the panel brings it back
c = setup({ pos: onCourse, liveId: 'gathering-42' }); await c.refreshAtCourse(); await flush();
ok(c.rail().className === '', 'panel closed → rail showing');
c._livePanelOpen = true; c.renderAtCourseRail(); ok(c.rail().className === 'tucked', 'panel open → rail tucked automatically');
c.toggleAtCourseRail(); ok(c.rail().className === '', 'grip while panel open → peeks open');
ok(c._atCourseTucked === false, 'peek does not change the manual tuck state');
c.toggleAtCourseRail(); ok(c.rail().className === 'tucked', 'grip again → tucked');
c._livePanelOpen = false; c._atCoursePanelPeek = false; c.renderAtCourseRail(); ok(c.rail().className === '', 'panel closed → rail back');
c.toggleLivePanel(); c.renderAtCourseRail(); ok(c._livePanelOpen === true && c.rail().className === 'tucked', 'opening the Live Panel (from the card, not the rail) still auto-tucks the rail');
// 13. Test mode can't get stuck: legacy '1' flag and >4h-old flags are ignored + cleared
c = setup({ forced: 'legacy', pos: home }); await c.refreshAtCourse(); await flush();
ok(!c.rail() && !c.store.has('bf_atcourse_force'), "legacy '1' flag cleared, real location used");
c = setup({ forced: 'old', pos: home }); await c.refreshAtCourse(); await flush();
ok(!c.rail() && !c.store.has('bf_atcourse_force'), '5h-old flag expired');
// 14. Tapping TEST ✕ turns it off
c = setup({ forced: true, evtDay: tomorrow, pos: home }); await c.refreshAtCourse(); await flush();
ok(c.rail().innerHTML.includes('TEST ✕') && c.rail().innerHTML.includes('atCourseExitTest()'), 'TEST chip is tappable');
c.atCourseExitTest(); await flush();
ok(!c.store.has('bf_atcourse_force') && !c.rail(), 'tap TEST → flag cleared, real check (away) → rail gone');
// 15. TEST mode: the pill falls back to atCourseExitTest(), not the location popover
c = setup({ forced: true, evtDay: tomorrow, pos: home }); await c.refreshAtCourse(); await flush();
ok(c.rail().innerHTML.includes('atCourseExitTest()') && !c.rail().innerHTML.includes('atCourseToggleLocDetail()'), 'forced/TEST pill still exits test mode, not the popover');
// 16. atCourseQuickCapture: sets _cardPhotoEvt and fires the right hidden input
c = setup({ pos: onCourse }); await c.refreshAtCourse(); await flush();
c.atCourseQuickCapture('gathering-42', 'video');
ok(c._cardPhotoEvt && c._cardPhotoEvt.id === 'gathering-42', 'quick capture (video) sets _cardPhotoEvt');
ok(c.clickLog.includes('card-video-camera-input') && !c.clickLog.includes('card-photo-upload-input'), 'quick capture (video) clicks the video input');
c.clickLog.length = 0; c._cardPhotoEvt = null;
c.atCourseQuickCapture('gathering-42', 'upload');
ok(c._cardPhotoEvt && c._cardPhotoEvt.id === 'gathering-42', 'quick capture (upload) sets _cardPhotoEvt');
ok(c.clickLog.includes('card-photo-upload-input') && !c.clickLog.includes('card-video-camera-input'), 'quick capture (upload) clicks the upload input');
// 17. Location detail popover: toggling opens/closes #at-course-loc-detail
// with venue name, distance, and a Maps link (MOSELEM has lat/lng).
c = setup({ pos: onCourse }); await c.refreshAtCourse(); await flush();
ok(!c.locDetail(), 'popover closed by default');
c.atCourseToggleLocDetail();
let ld = c.locDetail();
ok(!!ld, 'popover opens on toggle');
ok(ld.innerHTML.includes('Moselem Springs Golf Club'), 'popover shows venue name');
ok(/0\.\d+ mi|<?\d+ ft/.test(ld.innerHTML), 'popover shows a distance label');
ok(ld.innerHTML.includes('maps.google.com') && ld.innerHTML.includes(String(MOSELEM.lat)), 'popover includes a Maps link with the venue coords');
c.atCourseToggleLocDetail();
ok(!c.locDetail(), 'toggling again closes the popover');
// 18. Tucking/peeking the rail closes any open popover
c = setup({ pos: onCourse }); await c.refreshAtCourse(); await flush();
c.atCourseToggleLocDetail(); ok(!!c.locDetail(), 'popover open before tuck');
c.toggleAtCourseRail(); ok(!c.locDetail(), 'tucking the rail closes the popover');
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
