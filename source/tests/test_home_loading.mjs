// Home before the first load finishes shows the loading state (never "No upcoming events"); Request an Event opens Gatherings.
import fs from 'fs'; import vm from 'vm';
import { extractFn } from './extract.mjs';
import { fileURLToPath } from 'url';
const src = fs.readFileSync(fileURLToPath(new URL('../portal.html', import.meta.url)), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const calls = [];
const ctx = { console, window: { open: (u, t) => calls.push(['open', u]) }, REQUEST_FORM_ID: '233113019726045', GATHERING_PANEL_LIVE: true, currentPlayer: 'Brian Hager',
  isGuest: () => false, openHostPanel: () => calls.push(['panel']) };
vm.createContext(ctx);
vm.runInContext(extractFn(src, 'requestEventClick') + '\nthis.f=requestEventClick;', ctx);
ctx.f(); ok(calls.length === 1 && calls[0][0] === 'panel', 'a signed-in player lands in Gatherings');
calls.length = 0; ctx.isGuest = () => true; ctx.f(); ok(calls.length === 1 && calls[0][0] === 'open' && /233113019726045/.test(calls[0][1]), 'a guest still gets the old request form');
calls.length = 0; ctx.isGuest = () => false; ctx.GATHERING_PANEL_LIVE = false; ctx.f(); ok(calls[0][0] === 'open', 'with Gatherings switched off it falls back to the form');
ok(!/href="https:\/\/form\.jotform\.com\/233113019726045" target="_blank">📋 Request an Event/.test(src), 'no Request an Event link to the Jotform form is left on Home, All Events or the fallback');
const rh = src.slice(src.indexOf('function renderHome()'), src.indexOf('function renderHome()') + 400);
ok(/!dataLoaded && !_homeLoadFailed\) \{ showHomeLoading\(\); return; \}/.test(rh), 'renderHome shows the loading state until the first load finishes');
ok(/_homeLoadFailed = true;\s*renderFallback/.test(src), 'a failed first load still shows the fallback');
const ra = src.slice(src.indexOf('function renderAllEvents()'), src.indexOf('function renderAllEvents()') + 500);
ok(/!dataLoaded && !_homeLoadFailed/.test(ra), 'All Events shows loading too, not an empty list');
const lg = src.slice(src.indexOf('async function loadGatherings()'), src.indexOf('async function loadGatherings()') + 6000);
ok(/const _prefsP = gatheringsFetchJSON/.test(lg) && lg.indexOf('_prefsP') < lg.indexOf('/gatherings?player_id') && lg.indexOf('await _prefsP') > lg.indexOf('/gatherings?player_id') && lg.indexOf('await _prefsP') < lg.indexOf('gatheringFilters'), 'member prefs load in parallel with the Gatherings fetch, and are read before the filter uses them');
console.log(`home_loading: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
