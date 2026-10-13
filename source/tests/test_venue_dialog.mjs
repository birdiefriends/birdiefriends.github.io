// v4.24.0 — Venue Manager redesign: a course list (search + All/Active/Needs setup)
// that opens ONE management dialog per course, plus a manual tee / hole-handicap
// editor. Runs the real functions from portal.html in a jsdom page; the five
// pre-existing editors are stubbed (they are covered by their own tests).
import fs from 'fs'; import vm from 'vm'; import { JSDOM } from 'jsdom'; import { extractFn } from './extract.mjs';
import { fileURLToPath } from 'url';
const HERE = (p) => fileURLToPath(new URL(p, import.meta.url));
const src = fs.readFileSync(HERE('../portal.html'), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };

const dom = new JSDOM('<body><div id="admin-venues-list"></div></body>');
const posts = [];
const ctx = {
  document: dom.window.document, console, JSON, String, Array, Object, Number, Math, Promise, isFinite, parseInt, parseFloat,
  BFE_API: 'https://bfe', GATHERINGS_API: 'https://gath', COMMISSIONER_PIN: '7797',
  isCommissioner: () => true, confirm: () => true, toasts: [], showToast: (m, bad) => ctx.toasts.push([m, !!bad]),
  _adminVenueRenaming: {}, _adminVenueTees: {}, _adminVenueCttpCache: {}, _adminVenueTeeSel: {}, _adminVenuesCache: [], _venues: 1,
  adminFetchVenueCttp: async (id) => { ctx._adminVenueCttpCache[id] = { cttpHoles: [], raw: {} }; },
  venueParsEditorHtml: () => '[PARS]', venueCoordsEditorHtml: () => '[COORDS]', venueLogoEditorHtml: () => '[LOGO]',
  venueCttpHolesEditorHtml: () => '[CTP]', venueGcLookupEditorHtml: () => '[TEES]',
  fetch: async (url, opts) => {
    if (opts && opts.method === 'POST') { posts.push({ url, body: JSON.parse(opts.body) }); return { json: async () => ({ ok: true, id: 99 }) }; }
    if (/venue-tees\?venue_id=/.test(url)) return { json: async () => ({ ok: true, tees: ctx.__tees || [] }) };
    if (/\/venues\?pin=/.test(url)) return { json: async () => ({ ok: true, venues: ctx.__venues }) };
    return { json: async () => ({ ok: true }) };
  },
};
vm.createContext(ctx);
const names = ['escapeHtml', 'escapeHtmlAttr', 'teeHolesPars', 'venueDefaultTeeFor', 'venueViewerDefaultTee', 'venueDefaultTeeName', 'venueParsInfo', 'ensureVenueTeeInfo', 'venueSyncParsFromTees', 'par3HoleNumbers', 'venueDefaultCttpHoles', 'venueCttpStatus', 'venueSetupState', 'venueSetupLine', 'venueChipsHtml', 'setVenueFilter', 'setVenueSearch', 'renderVenueRows',
  'adminFetchVenueTeesQuiet', 'venueLoadSetupData', 'loadAdminVenues', 'openVenueDialog', 'closeVenueDialog', 'venueDialogView', 'venueDialogBack',
  'venueParSum', 'venueDialogRowsHtml', 'venueDialogHomeHtml', 'venueMotifEditorHtml', 'venueDialogBodyHtml', 'renderVenueDialog',
  'vmBlankHoles', 'vmNormalizeHoles', 'adminEditVenueTee', 'adminNewVenueTee', 'vmNum', 'vmTeeCapture', 'venueTeeCheck', 'venueTeeEditorRefresh',
  'venueTeeEditorCopyFrom', 'venueTeeEditorHtml', 'adminSaveVenueTee', 'adminJumpToGcLookup'];
vm.runInContext(`var _vmParsManual={}, _venueTeeInfo={}, _venueTeeInfoReq={}; var _vmFilter='all', _vmSearch='', _vmDlg=null, _vmSetupRequested={}, _vmTeeEdit=null;
${src.match(/const VM_VIEW_TITLES = \{[^\n]+\};/)[0]}
${names.map(n => extractFn(src, n)).join('\n')}`, ctx);
const run = (c) => vm.runInContext(c, ctx);
const $ = (id) => dom.window.document.getElementById(id);
const tick = () => new Promise(r => setTimeout(r, 5));

const tee = (id, name, hcps) => ({ id, tee_name: name, gender: 'male', course_rating: 71.6, slope_rating: 132, total_yards: 6475, par_total: 72, source: 'gc_api', locked: false, gc_api_course_id: 'gc1',
  holes: Array.from({ length: 18 }, (_, i) => ({ par: i % 3 === 0 ? 5 : i % 3 === 1 ? 4 : 3, yardage: 300 + i, handicap: hcps ? hcps[i] : i + 1 })) });
ctx.__venues = [
  { id: 1, name: 'Blue Shamrock Golf Club', active: 1, pars: JSON.stringify(new Array(18).fill(4)), lat: 41, lng: -75, logo_key: 'k', theme_motif: '☘️' },
  { id: 2, name: 'Moselem Springs Golf Club', active: 1, pars: JSON.stringify(new Array(18).fill(4)), lat: 40, lng: -75, logo_key: null, theme_motif: '' },
  { id: 3, name: 'Old Course', active: 0, pars: null, lat: null, lng: null, logo_key: null, theme_motif: '' },
];
ctx.__tees = [tee(10, 'Blue')];

// ── the list ────────────────────────────────────────────────────────────────
ctx._adminVenueCttpCache[1] = { cttpHoles: [3, 8, 10], raw: {} }; // Blue Shamrock is fully set up
await run('loadAdminVenues()'); await tick(); await tick();
ok($('vm-search') && $('vm-chips') && $('vm-rows'), 'list has search, filter chips and rows');
let rows = $('vm-rows').innerHTML;
ok(rows.includes('Blue Shamrock Golf Club') && rows.includes('Moselem Springs Golf Club') && rows.includes('Old Course'), 'every course is one row');
ok(!rows.includes('admin-par-') && !rows.includes('Vs Par') && !rows.includes('Deactivate'), 'rows no longer repeat the management functions');
ok(rows.includes('openVenueDialog(1)') && rows.includes('openVenueDialog(2)'), 'each row opens the dialog for its course');
ok(rows.includes('Inactive'), 'inactive course is marked');
ok(rows.includes('Moselem Springs Golf Club') && /Moselem[\s\S]*?Logo[\s\S]*?missing/.test(rows), 'status line names what a course is missing');
// needs-setup filter + search
run(`setVenueFilter('needs')`);
rows = $('vm-rows').innerHTML;
ok(rows.includes('Moselem Springs') && !rows.includes('Old Course') && !rows.includes('Blue Shamrock Golf Club'), 'Needs setup keeps only active courses with something missing');
run(`setVenueFilter('active')`);
rows = $('vm-rows').innerHTML; ok(rows.includes('Blue Shamrock') && !rows.includes('Old Course'), 'Active filter hides inactive');
run(`setVenueFilter('all'); setVenueSearch('mosel')`);
rows = $('vm-rows').innerHTML; ok(rows.includes('Moselem') && !rows.includes('Blue Shamrock'), 'search narrows by name');
run(`setVenueSearch('zzz')`); ok($('vm-rows').innerHTML.includes('No courses match'), 'empty search says so');
run(`setVenueSearch('')`);

// ── the dialog ──────────────────────────────────────────────────────────────
run('openVenueDialog(2)'); await tick(); await tick();
let dlg = $('vm-dialog');
ok(dlg && dlg.innerHTML.includes('Moselem Springs Golf Club'), 'tapping a row opens one dialog for that course');
ok(dom.window.document.querySelectorAll('#vm-dialog').length === 1, 'only one dialog exists');
for (const label of ['Par (18 holes)', 'Weather location', 'Logo', 'CTP holes', 'Tees and hole handicaps', 'Theme motif'])
  ok(dlg.innerHTML.includes(label), 'home lists ' + label);
ok(/Logo<\/span>\s*<span[^>]*>Not set/.test(dlg.innerHTML), 'Logo shows Not set for Moselem');
ok(/Par \(18 holes\)<\/span>\s*<span[^>]*>From Blue tee · 72/.test(dlg.innerHTML), 'Par shows the default tee and its total');
ok(/Tees and hole handicaps<\/span>\s*<span[^>]*>1 tee/.test(dlg.innerHTML), 'Tees row shows the stored tee count');
ok(dlg.innerHTML.includes('Deactivate venue') && dlg.innerHTML.includes('closeVenueDialog()'), 'Deactivate and Done present');
ok(dlg.innerHTML.includes('adminToggleVenueRename(2)'), 'Rename lives in the dialog header');
run(`venueDialogView('pars')`); ok($('vm-dialog').innerHTML.includes('[PARS]') && $('vm-dialog').innerHTML.includes('venueDialogBack()'), 'a row opens its editor with a Back arrow');
run(`venueDialogBack()`); ok($('vm-dialog').innerHTML.includes('Weather location'), 'Back returns to the course home');
for (const [v, mark] of [['coords', '[COORDS]'], ['logo', '[LOGO]'], ['ctp', '[CTP]'], ['tees', '[TEES]']]) { run(`venueDialogView('${v}')`); ok($('vm-dialog').innerHTML.includes(mark), v + ' editor renders in the dialog'); }
run(`venueDialogView('motif')`); ok($('vm-dialog').innerHTML.includes('admin-motif-2'), 'motif editor renders');
// a background refresh (a save ends in loadAdminVenues) re-renders the dialog on the same view
run(`venueDialogView('coords')`); await run('loadAdminVenues()'); await tick();
ok($('vm-dialog') && $('vm-dialog').innerHTML.includes('[COORDS]'), 'a save-triggered reload keeps the dialog on its editor');
run('closeVenueDialog()'); ok(!$('vm-dialog') && run('_vmDlg') === null, 'Done closes the dialog');

// ── tee check (pure) ────────────────────────────────────────────────────────
const holes = (f) => Array.from({ length: 18 }, (_, i) => f(i));
const good = { tee_name: 'Blue', holes: holes(i => ({ par: 4, yardage: 350, handicap: i + 1 })), slope_rating: 130, course_rating: 71 };
let c = run(`venueTeeCheck(${JSON.stringify(good)})`);
ok(c.errors.length === 0 && c.parTotal === 72 && c.yards === 6300 && c.hcpOk, 'a valid tee: no errors, totals computed');
const dup = JSON.parse(JSON.stringify(good)); dup.holes[3].handicap = 1; dup.holes[4].handicap = 1;
c = run(`venueTeeCheck(${JSON.stringify(dup)})`);
ok(c.errors.length === 1 && /1 is used more than once/.test(c.errors[0]) && c.dup.join() === '1' && c.missing.join() === '4,5', 'a repeated hole handicap is caught, with what is missing: ' + c.errors[0]);
const blank = JSON.parse(JSON.stringify(good)); blank.holes[0].handicap = null;
ok(/handicap from 1 to 18/.test(run(`venueTeeCheck(${JSON.stringify(blank)})`).errors[0]), 'a blank handicap is caught');
const bigHcp = JSON.parse(JSON.stringify(good)); bigHcp.holes[0].handicap = 19;
ok(run(`venueTeeCheck(${JSON.stringify(bigHcp)})`).errors.length === 1, 'handicap 19 is rejected');
const badPar = JSON.parse(JSON.stringify(good)); badPar.holes[0].par = 7;
ok(/par from 3 to 6/.test(run(`venueTeeCheck(${JSON.stringify(badPar)})`).errors[0]), 'par 7 is rejected');
ok(run(`venueTeeCheck(${JSON.stringify({ ...good, tee_name: ' ' })})`).errors.some(e => /name/.test(e)), 'tee needs a name');
ok(run(`venueTeeCheck(${JSON.stringify({ ...good, slope_rating: 200 })})`).errors.some(e => /Slope/.test(e)), 'slope out of range is caught');
const noYds = JSON.parse(JSON.stringify(good)); noYds.holes[0].yardage = null;
ok(run(`venueTeeCheck(${JSON.stringify(noYds)})`).yards === null, 'yardage total stays blank unless every hole has one');

// ── edit an existing tee: the user fixes one wrong hole handicap ─────────────
ctx.__tees = [tee(10, 'Blue', [13, 7, 1, 9, 15, 3, 11, 5, 17, 14, 8, 2, 10, 16, 4, 12, 6, 6])]; // GC-API has 6 twice, 18 missing
await run('adminFetchVenueTeesQuiet(2)');
run('openVenueDialog(2)'); await tick(); run(`adminEditVenueTee(2, 10)`);
dlg = $('vm-dialog').innerHTML;
ok(dlg.includes('vm-h-hcp-17') && dlg.includes('vm-tee-name') && /disabled/.test(dlg), 'editor shows 18 rows; name is fixed when editing');
ok($('vm-tee-check').innerHTML.includes('used more than once') && $('vm-tee-check').innerHTML.includes('6'), 'the live check flags the repeated handicap on open');
await run('adminSaveVenueTee()');
ok(posts.length === 0 && ctx.toasts.some(t => t[1] && /used more than once/.test(t[0])), 'a bad tee is refused before any save: ' + JSON.stringify(ctx.toasts.at(-1)));
$('vm-h-hcp-17').value = '18'; run('venueTeeEditorRefresh()');
ok($('vm-tee-check').innerHTML.includes('each used once'), 'fixing it clears the warning');
await run('adminSaveVenueTee()'); await tick();
const p = posts.at(-1);
ok(p && /\/bfe\/venue-tees$/.test(p.url), 'saves through POST /bfe/venue-tees');
ok(p.body.source === 'manual' && p.body.force === true && p.body.pin === '7797', 'saved as manual (locks the tee), force for a deliberate edit');
ok(p.body.tee_name === 'Blue' && p.body.venue_id === 2 && p.body.gender === 'male' && p.body.gc_api_course_id === 'gc1', 'tee identity and GC-API link kept');
ok(p.body.holes.length === 18 && p.body.holes[17].handicap === 18 && p.body.holes.every(h => 'par' in h && 'yardage' in h && 'handicap' in h), '18 holes with par, yardage, handicap');
ok(new Set(p.body.holes.map(h => h.handicap)).size === 18, 'saved handicaps are 1-18 each once');
ok(p.body.par_total === run(`venueTeeCheck({tee_name:'x',holes:${JSON.stringify(p.body.holes)}}).parTotal`), 'par_total is the sum of the holes');
ok(run('_vmDlg.view') === 'tees' && run('_vmTeeEdit') === null, 'after saving, the dialog returns to the tee list');

// ── add a tee by hand ───────────────────────────────────────────────────────
ctx.__tees = [tee(10, 'Blue')];
await run('adminFetchVenueTeesQuiet(2)');
run('adminNewVenueTee(2)');
dlg = $('vm-dialog').innerHTML;
ok(!/vm-tee-name"[^>]*disabled/.test(dlg) && dlg.includes('START FROM') && dlg.includes('Copy of Blue'), 'new tee: name is editable, and it can start from a copy of an existing tee');
posts.length = 0; await run('adminSaveVenueTee()');
ok(posts.length === 0, 'an empty new tee is refused');
run('venueTeeEditorCopyFrom(10)');
$('vm-tee-name').value = 'Gold'; run('venueTeeEditorRefresh()');
ok($('vm-h-hcp-4').value === '5', 'copying fills the grid from the chosen tee, keeping what was typed');
await run('adminSaveVenueTee()'); await tick();
ok(posts.length === 1 && posts[0].body.tee_name === 'Gold' && posts[0].body.source === 'manual', 'a hand-added tee saves as manual');

// ── the tee list gets Edit + Add buttons; the GC panel's coords button ──────
const w = new JSDOM('<div></div>').window;
const ctx2 = { document: w.document, JSON, String, Array, Object, Number, Math, _adminVenueTees: { 4: [] }, _adminVenueTeeSel: {}, _adminVenueCttpCache: {} };
vm.createContext(ctx2);
const teeHelpers = ['escapeHtml', 'teeSwatchCss', 'teeHeaderColor', 'teeHolesPars', 'venueDefaultTeeFor', 'venueDefaultTeeName', 'venueDefaultTee_', 'venueViewerDefaultTee', 'venueScorecardHtml', 'venueTeeSummaryHtml', 'storedVenueTeesHtml'];
vm.runInContext(src.match(/const TEE_COLORS = \{[\s\S]*?\};/)[0] + '\n' + teeHelpers.map(n => extractFn(src, n)).join('\n'), ctx2);
ok(vm.runInContext(`storedVenueTeesHtml({id:4})`, ctx2).includes('adminNewVenueTee(4)'), 'a course with no tees offers "Add a tee manually"');
vm.runInContext(`_adminVenueTees[4] = ${JSON.stringify([tee(7, 'White')])}`, ctx2);
const h2 = vm.runInContext(`storedVenueTeesHtml({id:4})`, ctx2);
ok(h2.includes('adminEditVenueTee(4, 7)') && h2.includes('adminDeleteVenueTee(4, 7)') && h2.includes('adminNewVenueTee(4)'), 'stored tees: Edit, Delete and Add a tee manually');
ok(extractFn(src, 'adminGcApplyCoords').includes('/coords') && extractFn(src, 'venueGcLookupEditorHtml').includes('adminGcApplyCoords(${v.id})'), 'GC-API course offers one tap to set Weather location');
ok(!/_adminVenue(Pars|Coords|Logo|Cttp|Gc)Open/.test(src), 'old per-panel open flags are gone');


// ── CTP holes default to all par 3s (v4.24.2) ───────────────────────────────
// par pattern with par 3s on holes 3, 8, 12, 17
const PARS = [4,4,3,5,4,4,5,3,4,4,5,3,4,4,5,4,3,4];
const teeP = { id: 1, tee_name: 'Blue', holes: PARS.map(p => ({ par: p, yardage: 300, handicap: 1 })) };
ok(run(`par3HoleNumbers(${JSON.stringify(PARS)})`).join() === '3,8,12,17', 'par3HoleNumbers');
ok(run(`venueDefaultCttpHoles(null, ${JSON.stringify([teeP])})`).join() === '3,8,12,17', 'default = all par 3s from tee data');
ok(run(`venueDefaultCttpHoles(${JSON.stringify(JSON.stringify(PARS))}, [])`).join() === '3,8,12,17', 'falls back to the legacy Vs Par table');
ok(run(`venueDefaultCttpHoles(null, [])`) === null && run(`venueDefaultCttpHoles('garbage', [{holes:[1]}])`) === null, 'no par data → null, never a guess');
// status: saved holes win; else the default; else not set; null while loading
run(`_adminVenueCttpCache = {}; _adminVenueTees = {}`);
ok(run(`venueCttpStatus({id:9,pars:null}).state`) === null, 'status is "loading" before anything is fetched');
ctx._adminVenueCttpCache[9] = { cttpHoles: [], raw: {} }; ctx._adminVenueTees[9] = [teeP];
let st = run(`venueCttpStatus({id:9,pars:null})`);
ok(st.state === true && st.isDefault && st.holes.join() === '3,8,12,17', 'nothing saved → defaults to all par 3s and counts as set');
ctx._adminVenueCttpCache[9] = { cttpHoles: [5, 14], raw: {} };
st = run(`venueCttpStatus({id:9,pars:null})`);
ok(st.state === true && !st.isDefault && st.holes.join() === '5,14', 'saved holes win over the default (hand-picked stays hand-picked)');
ctx._adminVenueCttpCache[8] = { cttpHoles: [], raw: {} }; ctx._adminVenueTees[8] = [];
ok(run(`venueCttpStatus({id:8,pars:null})`).state === false, 'no saved holes and no par data → not set');

// Live Panel resolution: saved → par 3s → null (BSGC fallback). It must never WRITE.
function ctpCtx(catalog, tees, pars) {
  const writes = [];
  const c = { console, JSON, String, Array, Object, Number, Math, Promise, Object, BFE_API: 'https://bfe', _venueCttpHolesCache: {}, _resolvedCttpHoles: undefined, writes,
    csNormalizedVenueName: () => 'Test GC', loadVenues: async () => {}, findVenueByName: () => ({ id: 5, name: 'Test GC', pars }),
    fetch: async (url, opts) => {
      if (opts && opts.method && opts.method !== 'GET') writes.push(url);
      if (/venue-tee-catalog/.test(url)) return catalog === 404 ? { ok: false, json: async () => ({}) } : { ok: true, json: async () => ({ tee_catalog: catalog }) };
      return { ok: true, json: async () => ({ ok: true, tees }) };
    } };
  vm.createContext(c);
  vm.runInContext('var _venueTeeInfo = {}, _venueTeeInfoReq = {};\n' + ['par3HoleNumbers', 'teeHolesPars', 'venueDefaultTeeFor', 'venueViewerDefaultTee', 'ensureVenueTeeInfo', 'venueDefaultCttpHoles', 'venueDerivedCttpHoles', 'loadVenueCttpHoles'].map(n => extractFn(src, n)).join('\n'), c);
  return c;
}
let k = ctpCtx({ cttpHoles: [6, 15] }, [teeP], null);
await vm.runInContext('loadVenueCttpHoles({})', k);
ok(k._resolvedCttpHoles.join() === '6,15', 'Live Panel: a venue with saved holes uses them, not the par 3s');
k = ctpCtx({ mode: 'same', tee: { name: 'Blue' } }, [teeP], null); // catalog row exists (tee policy) but no cttpHoles
await vm.runInContext('loadVenueCttpHoles({})', k);
ok(k._resolvedCttpHoles.join() === '3,8,12,17', 'Live Panel: a catalog row without CTP holes defaults to all par 3s');
k = ctpCtx(404, [teeP], null);
await vm.runInContext('loadVenueCttpHoles({})', k);
ok(k._resolvedCttpHoles.join() === '3,8,12,17', 'Live Panel: no catalog row at all defaults to all par 3s (was the BSGC holes)');
k = ctpCtx(404, [], JSON.stringify(PARS));
await vm.runInContext('loadVenueCttpHoles({})', k);
ok(k._resolvedCttpHoles.join() === '3,8,12,17', 'Live Panel: legacy Vs Par table is enough');
k = ctpCtx(404, [], null);
await vm.runInContext('loadVenueCttpHoles({})', k);
ok(k._resolvedCttpHoles === null, 'Live Panel: no par data anywhere → null, so the existing BSGC fallback still applies');
ok(k.writes.length === 0, 'resolving CTP holes never writes anything');
ok(!/venue-tee-catalog[^;]*POST/.test(extractFn(src, 'loadVenueCttpHoles')), 'loadVenueCttpHoles has no write path');
// editor copy tells the truth about the default
const cc = { _adminVenueCttpCache: { 9: { cttpHoles: [], raw: {} } }, _adminVenueTees: { 9: [teeP] } };
vm.createContext(cc);
vm.runInContext(['teeHolesPars', 'venueDefaultTeeFor', 'venueViewerDefaultTee', 'venueDefaultTeeName', 'par3HoleNumbers', 'venueDefaultCttpHoles', 'venueCttpHolesEditorHtml'].map(n => extractFn(src, n)).join('\n'), cc);
let eh = vm.runInContext(`venueCttpHolesEditorHtml({id:9,name:'X',pars:null})`, cc);
ok(eh.includes('all par 3s (3, 8, 12, 17)') && eh.includes('placeholder="All par 3s: 3, 8, 12, 17"') && !eh.includes('Back to all par 3s'), 'editor shows the default and no clear button when nothing is saved');
cc._adminVenueCttpCache[9] = { cttpHoles: [5], raw: {} };
eh = vm.runInContext(`venueCttpHolesEditorHtml({id:9,name:'X',pars:null})`, cc);
ok(eh.includes('Back to all par 3s') && eh.includes('value="5"'), 'with saved holes the clear button reads "Back to all par 3s"');
ok(eh.includes('keeps its own holes'), 'editor says events keep their own holes');

console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
