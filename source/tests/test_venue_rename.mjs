// Dev-88 — Venue Manager rename + GC-API coords bridge (Brian's two Woodloch
// Springs asks: "edit the course name" and "autofill coordinates from
// GolfCourseAPI"). Covers: the inline rename affordance in the venue row
// template, adminSaveVenueName's PATCH body and confirm-before-save guard,
// adminToggleVenueRename's pure state flip, adminJumpToGcLookup opening both
// panels WITHOUT calling the network (never spends GC-API quota on its own),
// and venueCoordsEditorHtml's new "try GolfCourseAPI" link.
import fs from 'fs'; import vm from 'vm'; import { extractFn } from './extract.mjs';
import { fileURLToPath } from 'url';
const HERE = (p) => fileURLToPath(new URL(p, import.meta.url));
const src = fs.readFileSync(HERE('../portal.html'), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };

// 1) Structural: the venue-row template (inside loadAdminVenues) renders the
// rename input when _adminVenueRenaming[v.id] is set, and the ✏️ toggle when
// it isn't — both wired to real function names.
const loadAdminVenuesSrc = extractFn(src, 'loadAdminVenues');
ok(loadAdminVenuesSrc.includes('admin-venue-rename-${v.id}'), 'rename input id present');
ok(loadAdminVenuesSrc.includes('adminSaveVenueName(${v.id})'), 'Enter/Save wired to adminSaveVenueName');
ok(loadAdminVenuesSrc.includes('adminToggleVenueRename(${v.id})'), '✏️ / Cancel wired to adminToggleVenueRename');
ok(loadAdminVenuesSrc.includes('_adminVenueRenaming[v.id]'), 'row branches on the new renaming-state map');

// 2) venueCoordsEditorHtml: the GC-API bridge link exists and points at
// adminJumpToGcLookup, not at anything that calls the network itself.
const coordsHtmlSrc = extractFn(src, 'venueCoordsEditorHtml');
ok(coordsHtmlSrc.includes('adminJumpToGcLookup(${v.id})'), 'coords panel links to adminJumpToGcLookup');
ok(!/adminGcSearch|coursedata/.test(coordsHtmlSrc), 'coords panel itself never calls the GC-API search/fetch path');

// 3) Pure logic: adminToggleVenueRename / adminJumpToGcLookup / adminSaveVenueName
// behave against a mocked DOM+fetch+loadAdminVenues, without a real network call.
const calls = { fetches: [], loadAdminVenuesCalls: 0, teesLoaded: [] };
const ctx = {
  Array, String, Object, JSON, Number,
  _adminVenueRenaming: {}, _adminVenueGcOpen: {}, _adminVenueCoordsOpen: {}, _adminVenueTees: {},
  _adminVenuesCache: [{ id: 3, name: 'Woodloch Sprngs', active: 1 }],
  _venues: 'cached-sentinel',
  document: { getElementById: (id) => (id === 'admin-venue-rename-3' ? { value: 'Woodloch Springs' } : null) },
  confirm: () => true,
  fetch: async (url, opts) => {
    calls.fetches.push({ url, body: opts && opts.body ? JSON.parse(opts.body) : null });
    return { json: async () => ({ ok: true }) };
  },
  showToast: () => {},
  loadAdminVenues: async () => { calls.loadAdminVenuesCalls++; },
  adminLoadVenueTees: async (id) => { calls.teesLoaded.push(id); },
  GATHERINGS_API: 'https://birdiefriends-push.example/api',
};
vm.createContext(ctx);
vm.runInContext(['adminToggleVenueRename', 'adminSaveVenueName', 'adminJumpToGcLookup'].map(n => extractFn(src, n)).join('\n'), ctx);

// adminToggleVenueRename: pure flip, no network
await vm.runInContext('adminToggleVenueRename(3)', ctx);
ok(ctx._adminVenueRenaming[3] === true, 'toggle rename opens the input');
ok(calls.fetches.length === 0, 'toggling rename never calls fetch');

// adminSaveVenueName: confirms, PATCHes {pin, name}, resets cache, closes the input
await vm.runInContext('adminSaveVenueName(3)', ctx);
ok(calls.fetches.length === 1 && /\/venues\/3$/.test(calls.fetches[0].url), 'PATCHes /venues/:id');
ok(calls.fetches[0].body.pin === '7797' && calls.fetches[0].body.name === 'Woodloch Springs', 'body carries pin + corrected name');
ok(ctx._venues === null, 'venue cache reset after rename so matching picks up the new spelling');
ok(ctx._adminVenueRenaming[3] === false, 'rename input closes on success');

// adminJumpToGcLookup: opens both panels, loads tees if not cached, but never hits fetch itself
calls.fetches.length = 0;
await vm.runInContext('adminJumpToGcLookup(3)', ctx);
ok(ctx._adminVenueGcOpen[3] === true && ctx._adminVenueCoordsOpen[3] === true, 'opens GC-API Lookup and keeps Weather Location open');
ok(calls.teesLoaded.includes(3), 'kicks off the (quota-free) stored-tees load, not a GC-API search');
ok(calls.fetches.length === 0, 'jumping to the GC panel spends no GolfCourseAPI quota on its own');

console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
