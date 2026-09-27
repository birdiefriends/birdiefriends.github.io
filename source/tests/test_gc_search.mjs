import fs from 'fs'; import vm from 'vm'; import { JSDOM } from 'jsdom'; import { extractFn } from './extract.mjs';
import { fileURLToPath } from 'url';
const HERE = (p) => fileURLToPath(new URL(p, import.meta.url));
const src = fs.readFileSync(HERE('../portal.html'), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
function setup(responses) {
  const dom = new JSDOM('<div id="venues"></div>');
  const queries = [];
  const ctx = { document: dom.window.document, console, JSON, String, Array, Object, encodeURIComponent, BFE_API: 'https://bfe',
    _adminVenueGcResults: {}, _adminVenueGcCourse: {}, _adminVenueGcStatus: {}, _adminVenueGcQuery: {}, _adminVenueTees: { 7: [] },
    fetch: async (url) => { const q = decodeURIComponent(url.split('q=')[1]); queries.push(q); const r = responses[q]; const quota = r instanceof Error && /429/.test(r.message); return { status: quota ? 429 : (r instanceof Error ? 500 : 200), json: async () => r instanceof Error ? { ok: false, error: r.message } : { ok: true, courses: r || [] } }; } };
  vm.createContext(ctx);
  vm.runInContext(src.match(/const GC_QUOTA_MSG = [^\n]+/)[0] + '\n' + ['gcIsQuotaError','escapeHtml','adminGcStatusHtml','adminGcSetStatus','gcSimplifiedQuery','adminGcSearch','venueGcLookupEditorHtml','storedVenueTeesHtml'].map(n => extractFn(src, n)).join('\n') +
    `\nvar V = { id: 7, name: 'Buck Hill G.C.' };
     function loadAdminVenues() { document.getElementById('venues').innerHTML = venueGcLookupEditorHtml(V); }
     loadAdminVenues();`, ctx);
  ctx.queries = queries; ctx.$ = (id) => dom.window.document.getElementById(id); return ctx;
}
const S = (s, q) => s.gcSimplifiedQuery(q);
let c = setup({});
ok(S(c, 'Buck Hill G.C.') === 'Buck Hill', 'Buck Hill G.C. → Buck Hill');
ok(S(c, "Lord's Valley Country Club") === 'Lords Valley', "Lord's Valley CC → Lords Valley"); ok(S(c, "Lord's Valley") === 'Lords Valley', 'apostrophe alone triggers retry');
ok(S(c, 'Allentown Municipal Golf Course') === 'Allentown', 'Allentown Muni');
ok(S(c, 'Skytop Lodge') === 'Skytop' && S(c, 'Paupack Hills GC') === 'Paupack Hills', 'Skytop / Paupack');
ok(S(c, 'Moselem Springs') === null, 'no club words → no retry');
// 1. No match + no match on retry → persistent warn message after the re-render, query kept
c = setup({});
c.$('admin-gc-query-7').value = 'Buck Hill G.C.';
await c.adminGcSearch(7);
let st = c.$('admin-gc-status-7').innerHTML;
ok(c.queries.join('|') === 'Buck Hill G.C.|Buck Hill', 'searched original then simplified: ' + c.queries.join('|'));
ok(st.includes('No matches') && st.includes('Buck Hill G.C.') && st.includes('“Buck Hill”'), 'no-match message survives the re-render: ' + st.slice(0, 90));
ok(c.$('admin-gc-query-7').value === 'Buck Hill G.C.', 'typed query survives the re-render');
// 2. No match, retry hits → results + explanatory status
c = setup({ 'Buck Hill': [{ id: 'x1', club_name: 'Buck Hill Falls Golf Club', city: 'Buck Hill Falls', state: 'PA' }] });
c.$('admin-gc-query-7').value = 'Buck Hill G.C.';
await c.adminGcSearch(7);
st = c.$('admin-gc-status-7').innerHTML;
ok(st.includes('1 match') && st.includes('simplified'), 'retry success explained');
ok(c.$('venues').innerHTML.includes('Buck Hill Falls Golf Club'), 'retry results listed');
// 3. Direct hit → one call only (free-tier friendly)
c = setup({ 'Moselem': [{ id: 'm', club_name: 'Moselem Springs' }] });
c.$('admin-gc-query-7').value = 'Moselem';
await c.adminGcSearch(7);
ok(c.queries.length === 1 && c.$('admin-gc-status-7').innerHTML.includes('1 match'), 'direct hit: single call');
// 4. Error path shows and persists
c = setup({ 'Oops': new Error('upstream server down') });
c.$('admin-gc-query-7').value = 'Oops';
await c.adminGcSearch(7);
ok(c.$('admin-gc-status-7').innerHTML.includes('server down'), 'error shown');
c.loadAdminVenues(); ok(c.$('admin-gc-status-7').innerHTML.includes('server down'), 'error survives a later re-render');
// 5. Empty query
c = setup({}); c.$('admin-gc-query-7').value = '  ';
await c.adminGcSearch(7); ok(c.$('admin-gc-status-7').innerHTML.includes('Enter a course name') && c.queries.length === 0, 'empty query guarded');
// 6. Enter key wired
ok(c.$('admin-gc-query-7').getAttribute('onkeydown').includes('adminGcSearch(7)'), 'Enter runs search');
// 7. Quota (429): friendly amber message, no retry burned
c = setup({ 'Buck Hill G.C.': new Error('GolfCourseAPI search failed (429)') });
c.$('admin-gc-query-7').value = 'Buck Hill G.C.';
await c.adminGcSearch(7);
st = c.$('admin-gc-status-7').innerHTML;
ok(st.includes('daily limit reached') && !st.includes('(429)'), '429 → friendly quota message');
ok(c.queries.length === 1, '429 → no retry call wasted');
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
