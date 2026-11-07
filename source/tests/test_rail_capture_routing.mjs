// Capture follows the event type (Brian, 2026-11-04): a BFE card (BF Cup round) uploads to the BFE's memories with its round;
// an ordinary event card keeps the Gatherings photo pipeline. Extracts the real functions from portal.html and runs them with stubs.
import fs from 'fs';
const src = fs.readFileSync(new URL('../portal.html', import.meta.url), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL ' + m); } };
const grab = name => { const i = src.indexOf('function ' + name + '(') >= 0 ? src.indexOf('function ' + name + '(') : src.indexOf('async function ' + name + '('); const j = src.indexOf('\n}\n', i); return src.slice(i, j + 3); };
const body = ['evtPhotoKey', 'bfeCaptureTarget', 'cardPhotoCameraPicked', 'loadCardPhotos'].map(n => { const i = src.indexOf((n === 'cardPhotoCameraPicked' || n === 'loadCardPhotos' ? 'async function ' : 'function ') + n + '('); const j = src.indexOf('\n}\n', i); return src.slice(i, j + 3); }).join('\n');
const calls = [];
const make = (backed) => {
  calls.length = 0;
  const env = {
    GATHERINGS_API: 'https://g.test', BFE_API: 'https://b.test', currentPlayer: 'Brian Hager', PHOTO_MAX_BYTES: 1e9, VIDEO_MAX_SECONDS: 60,
    _bfeBackedIndex: new Map(backed ? [['2026 BFCup - Day1', { bfeEventId: 7, umbrellaName: '2026 BirdieFriends Cup', roundName: '2026 BFCup - Day1' }]] : []),
    _cardPhotoEvt: { name: backed ? '2026 BFCup - Day1' : 'Tuesday League', source: 'jotform' },
    compressImageFile: async f => f, setCardPhotoBusy() {}, showToast() {}, captureEventWeather() {}, readVideoDuration: async () => 0,
    loadCardPhotos: async () => {}, renderWCRPPhotoThumb: m => 'm' + m.id, renderCardPhotoThumb: p => 'p' + p.id, _photoViewerPhotos: [],
    document: { getElementById: id => id === 'card-photo-list' ? { innerHTML: '' } : { style: { display: 'none' }, classList: { contains: () => false } } },
    FormData: class { constructor() { this.d = {}; } append(k, v) { this.d[k] = v; } },
    fetch: async (u, o) => { calls.push({ u, form: o && o.body && o.body.d }); return { json: async () => ({ ok: true, media_type: 'image', photos: [], memories: [{ id: 1 }, { id: 2 }] }) }; },
    refreshHistoryAfterEdit() {}
  };
  const keys = Object.keys(env);
  const fn = new Function(...keys, body + '\nreturn { cardPhotoCameraPicked, loadCardPhotos, bfeCaptureTarget };');
  return { env, api: fn(...keys.map(k => env[k])) };
};
const file = { size: 10, type: 'image/jpeg', name: 'a.jpg' };
let t = make(true);
await t.api.cardPhotoCameraPicked({ files: [file], value: '' });
ok(calls[0].u === 'https://b.test/bfe/memories/upload' && calls[0].form.event_id === 7 && calls[0].form.round_name === '2026 BFCup - Day1' && !('event_name' in calls[0].form), 'a BF Cup card uploads to the BFE memories with its event id and round: ' + JSON.stringify(calls[0]));
t = make(false);
await t.api.cardPhotoCameraPicked({ files: [file], value: '' });
ok(calls[0].u === 'https://g.test/photos/upload' && calls[0].form.event_name === 'Tuesday League' && !('event_id' in calls[0].form), 'an ordinary event card keeps the Gatherings photo pipeline: ' + JSON.stringify(calls[0]));
t = make(true); await t.api.loadCardPhotos();
ok(calls.length === 1 && calls[0].u === 'https://b.test/bfe/memories?event_id=7', 'the photo sheet of a BFE card lists the whole event\'s memories: ' + (calls[0] && calls[0].u));
t = make(false); await t.api.loadCardPhotos();
ok(calls.length === 1 && /^https:\/\/g\.test\/photos\?event=/.test(calls[0].u), 'an ordinary card lists its own photos');
ok(make(true).api.bfeCaptureTarget({ name: '2026 BFCup - Day2' }) === null && make(true).api.bfeCaptureTarget({ name: '2026 BFCup - Day1' }).bfeEventId === 7, 'only a card that belongs to a BFE is routed to it');

// The at-the-course rail: Photo / Video / Upload show for an ordinary card, and for a BFE card (BF Cup) only while the host has memories capture open.
{
  const i = src.indexOf('function renderAtCourseRail('), j = src.indexOf('\n}\n', i); const fnSrc = src.slice(i, j + 2);
  const railFor = (backed, captureOpen) => {
    const el = { id: 'at-course-rail', innerHTML: '', className: '', classList: { contains: () => false } };
    const evt = { id: 'e1', name: backed ? '2026 BFCup - Day1' : 'Tuesday League' };
    const env = { document: { getElementById: () => el, createElement: () => el, body: { appendChild() {} } }, _atCourse: { evt, distM: null }, _atCourseTucked: false,
      isBFEBackedCard: e => backed, _bfeBackedIndex: new Map(backed ? [[evt.name, { captureOpen }]] : []), atCourseApplyPos() {}, renderAtCourseLocDetail() {}, atCourseHasNetStrokes: () => false,
      escapeHtml: x => String(x) };
    const keys = Object.keys(env); new Function(...keys, fnSrc + '\nrenderAtCourseRail();')(...keys.map(k => env[k])); return el.innerHTML;
  };
  const has = h => /Photo/.test(h) && /Video/.test(h) && /Upload/.test(h);
  ok(has(railFor(false, false)), 'an ordinary event shows Photo, Video and Upload on the rail');
  ok(has(railFor(true, true)), 'a BF Cup round shows Photo, Video and Upload on the rail while memories capture is open');
  ok(!/Photo|Video|Upload/.test(railFor(true, false)) && /Yardage/.test(railFor(true, false)), 'a BF Cup round hides them while capture is closed, keeping Yardage, Rules, Course');
}
console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
