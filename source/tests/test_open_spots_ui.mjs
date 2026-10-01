// Open spots (Dev-90) — portal side, running the REAL functions from portal.html.
// Pins: the host's Add/Fill controls, the member-only fill picker (nobody already
// in, no inactive members, no placeholders), the exact fill/add requests, the
// Close & Calculate sheet refusing to close while a spot is open, and the New
// Gathering form wiring (stepper clamps 0..8, spots count toward capacity and are
// created BEFORE the host/crew registrations).
import fs from 'fs'; import vm from 'vm'; import { JSDOM } from 'jsdom'; import { extractFn, loadEngine } from './extract.mjs';
import { fileURLToPath } from 'url';
const HERE = (p) => fileURLToPath(new URL(p, import.meta.url));
const src = fs.readFileSync(HERE('../portal.html'), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const fns = ['escapeHtml','evtPhotoKey','computeGatheringGamesPayout','latestScorecardPerPlayer','scorecardMissingHoles','renderGatheringPayoutHtml',
  'openGatheringCloseSheet','confirmGatheringClose','openModal','closeModal',
  'isOpenSpotName','loadHostSpots','hostSpotsHtml','hostAddOpenSpot','refreshAfterSpotChange','openFillSpotSheet','renderFillSpotSheet',
  'fillSpotListHtml','filterFillSpotList','pickFillSpotMember','confirmFillSpot','hostAutoOpenSpots','updateHostSpotsPreview','updateHostPlayersRow','hostSwitchHtml','hostSwitchSet','hostRowHtml','hostSetRowValue','bumpHostCapacity','hostGamesListHtml','filterHostGamesSheet','toggleHostGame','updateHostGamesRow','pickHostOption','setHostHoles','closeHostSheet','openHostSheet'];
function setup({ spots = [{ gathering_id: 69, player_id: 'Open Spot 1' }], fillOk = true } = {}) {
  const dom = new JSDOM(`<body><div id="gathering-close-modal"><div id="gathering-close-body"></div></div>
    <div id="gathering-spot-modal"><div id="gathering-spot-title"></div><div id="gathering-spot-body"></div></div>
    <div id="host-sheet-body"></div><div id="history-game-results"></div><input id="host-new-size" value="4"><button id="host-players-row"><span class="host-row-val">You</span></button><button id="host-games-row"><span class="host-row-val">None yet</span></button><button id="host-holes-row"><span class="host-row-val">18</span></button><button id="host-format-row"><span class="host-row-val">x</span></button><button id="host-playing-switch" role="switch"><span></span></button><select id="host-new-type"><option value="Individual Play">Individual Play</option><option value="Best Ball">Best Ball</option></select><input id="host-games-search"><div id="host-games-list"></div></body>`);
  const posts = []; const toasts = []; const calls = [];
  const h = o => Array(18).fill(5).map((v, i) => o[i + 1] ?? v);
  const ctx = {
    document: dom.window.document, console, Promise, JSON, Math, Number, String, Set, Map, Array, Object, Date, encodeURIComponent,
    BFEngine: loadEngine(), currentPlayer: 'Brian Hager', BFE_API: 'https://bfe', SCORECARD_API: 'https://bfe',
    gatheringData: [{ gatheringId: 69, hostId: 'Brian Hager', name: 'Moselem Springs 09/29', source: 'gathering', holes: 18 }],
    eventData: [{ source: 'gathering', gatheringId: 69, name: 'Moselem Springs 09/29' }],
    gatheringRegData: [['Brian Hager','Yes'],['Mike Scanlan','Yes'],['Scott Justus','Sub'],['Open Spot 1','Yes'],['Declined Dan','No']].map(([p, s]) => ({ gatheringId: 69, player: p, status: s })),
    memberData: [{ display: 'Brian Hager' }, { display: 'Mike Scanlan' }, { display: 'Scott Justus' }, { display: 'Jim Bingham' }, { display: 'Declined Dan' },
      { display: 'Old Timer', active: 'InActive' }, { display: 'Open Spot 9' }, { display: 'Amy Adams' }],
    _ctpData: {}, showToast: (m, e) => toasts.push([m, !!e]),
    loadCtpData: async () => {}, loadHistoryGameResults: (k) => calls.push(['history', k]),
    refreshGatherings: async () => calls.push(['refreshGatherings']),
    renderHostPanelList: () => calls.push(['renderHostPanelList']), renderHostArchiveList: () => calls.push(['renderHostArchiveList']),
    refreshGatheringGamesIndex: async () => {},
    fetch: async (url, opts) => {
      if (opts && opts.method === 'POST') {
        posts.push([url, JSON.parse(opts.body)]);
        if (url.includes('/fill')) return { json: async () => fillOk ? { ok: true } : { ok: false, error: 'Jim Bingham is already in this Gathering' } };
        return { json: async () => ({ ok: true, spots: ['Open Spot 2'] }) };
      }
      if (url.includes('/bfe/gathering-spots?host_id=')) return { json: async () => ({ ok: true, spots }) };
      if (url.includes('/bfe/gathering-spots?gathering_id=')) return { json: async () => ({ ok: true, spots: spots.filter(s => String(s.gathering_id) === url.split('=')[1]) }) };
      if (url.includes('/bfe/gathering-games?gathering_id=')) return { json: async () => ({ ok: true, config: { gathering_id: 69, host_id: 'Brian Hager', status: 'open', games: ['skins'], dollar_per_player: 10, payout_summary: null } }) };
      if (url.includes('/scorecards?event=')) return { json: async () => ({ ok: true, scorecards: [
        { player: 'Brian Hager', holes: h({}) }, { player: 'Mike Scanlan', holes: h({}) }, { player: 'Open Spot 1', holes: h({}) }] }) };
      if (url.includes('/birdieball-answers')) return { json: async () => ({ ok: true, answers: [] }) };
      throw new Error('unexpected ' + url);
    }
  };
  ctx.posts = posts; ctx.toasts = toasts; ctx.calls = calls;
  vm.createContext(ctx);
  vm.runInContext(fns.map(n => extractFn(src, n)).join('\n') +
    '\nvar _spotsByGathering = new Map(); var _hostGamesPick = new Set(); var _hostHoles = 18; var GATHERING_GAMES_META = {skins:{label:"Skins",icon:"S"},cttp:{label:"CTP",icon:"C"},birdieball:{label:"BirdieBall",icon:"B"}}; var _hostMode = "crew"; var _hostPlaying = true; var currentPlayer = "Brian Hager"; var _hostCrewPicked = new Set(); var _hostPanelView = "list"; var _fillSpot = null; var _gcClose = null;', ctx);
  return ctx;
}

// 1. name rule + loading
let c = setup();
ok(c.isOpenSpotName('Open Spot 3') && c.isOpenSpotName('open spot 12') && !c.isOpenSpotName('Open Spot') && !c.isOpenSpotName('Jim Bingham') && !c.isOpenSpotName('Open Spot 1 Jr'), 'placeholder name rule');
await c.loadHostSpots();
ok(c._spotsByGathering.get(69).join() === 'Open Spot 1', 'spots grouped by gathering');
c = setup({ spots: [] }); await c.loadHostSpots();
ok(c._spotsByGathering.size === 0, 'no spots, empty map');

// 2. host card block
c = setup(); await c.loadHostSpots();
const g = { gatheringId: 69 };
let html = c.hostSpotsHtml(g, true);
ok(html.includes('Open Spot 1') && html.includes('openFillSpotSheet(69, 0)') && html.includes('hostAddOpenSpot(69)'), 'upcoming card: Fill + ➕ Open spot');
html = c.hostSpotsHtml(g, false);
ok(html.includes('openFillSpotSheet(69, 0)') && !html.includes('hostAddOpenSpot'), 'archived card: Fill only, no add');
ok(c.hostSpotsHtml({ gatheringId: 70 }, false) === '' && c.hostSpotsHtml({ gatheringId: 70 }, true).includes('hostAddOpenSpot(70)') && !c.hostSpotsHtml({ gatheringId: 70 }, true).includes('openFillSpotSheet'), 'no spots: archive hidden, upcoming shows add only');

// 3. fill picker: members only, nobody already in, filterable
c.openFillSpotSheet(69, 0);
ok(c.document.getElementById('gathering-spot-modal').classList.contains('open') && c.document.getElementById('gathering-spot-title').textContent.includes('Open Spot 1'), 'sheet opens for the spot');
ok(c._fillSpot.candidates.join() === 'Amy Adams,Declined Dan,Jim Bingham', 'candidates: real active members not already Yes/Sub (a past No may be picked): ' + c._fillSpot.candidates);
c.document.getElementById('fill-spot-search').value = 'jim'; c.filterFillSpotList();
ok(c.document.getElementById('fill-spot-list').innerHTML.includes('Jim Bingham') && !c.document.getElementById('fill-spot-list').innerHTML.includes('Amy Adams'), 'search filters the list');
c.document.getElementById('fill-spot-search').value = 'zzz'; c.filterFillSpotList();
ok(c.document.getElementById('fill-spot-list').innerHTML.includes('No matching members'), 'empty search says so');
c.openFillSpotSheet(69, 5); ok(c.toasts.at(-1)[1] && c.toasts.at(-1)[0].includes('already filled'), 'stale index refused');

// 4. pick -> confirm -> exact request -> refresh
c.openFillSpotSheet(69, 0);
c.pickFillSpotMember(c._fillSpot.candidates.indexOf('Jim Bingham'));
let b = c.document.getElementById('gathering-spot-body').innerHTML;
ok(b.includes('Jim Bingham') && b.includes('Open Spot 1') && b.includes('Confirm') && b.includes("can't be undone"), 'confirm step names both and warns');
c.pickFillSpotMember(-1); ok(c._fillSpot.member === null && c.document.getElementById('fill-spot-search'), 'Back returns to the list');
c.pickFillSpotMember(c._fillSpot.candidates.indexOf('Jim Bingham'));
await c.confirmFillSpot();
ok(c.posts.length === 1 && c.posts[0][0] === 'https://bfe/bfe/gathering-spots/69/fill'
  && JSON.stringify(c.posts[0][1]) === JSON.stringify({ host_id: 'Brian Hager', spot: 'Open Spot 1', member: 'Jim Bingham' }), 'fill request: ' + JSON.stringify(c.posts));
ok(!c.document.getElementById('gathering-spot-modal').classList.contains('open') && c._fillSpot === null, 'sheet closes');
ok(c.calls.some(x => x[0] === 'refreshGatherings') && c.calls.some(x => x[0] === 'history' && x[1] === 'gathering:69'), 'data + history refreshed');
// failure keeps the sheet open and says why
c = setup({ fillOk: false }); await c.loadHostSpots(); c.openFillSpotSheet(69, 0); c.pickFillSpotMember(c._fillSpot.candidates.indexOf('Jim Bingham')); await c.confirmFillSpot();
ok(c.document.getElementById('gathering-spot-modal').classList.contains('open') && c.toasts.at(-1)[1] && c.toasts.at(-1)[0].includes('already in this Gathering'), 'failure: sheet stays, server reason shown');
ok(c.document.getElementById('btn-fill-spot-confirm') && !c.document.getElementById('btn-fill-spot-confirm').disabled, 'confirm re-enabled for retry');

// 5. which Host Panel view re-renders
c = setup(); await c.loadHostSpots(); c._hostPanelView = 'archive';
c.document.getElementById('host-sheet-body').innerHTML = 'x'; Object.defineProperty(c.document.getElementById('host-sheet-body'), 'offsetParent', { get: () => ({}) });
await c.refreshAfterSpotChange(69);
ok(c.calls.some(x => x[0] === 'renderHostArchiveList') && !c.calls.some(x => x[0] === 'renderHostPanelList'), 'archive view re-renders as archive');

// 6. add one spot
c = setup(); await c.hostAddOpenSpot(69);
ok(c.posts[0][0] === 'https://bfe/bfe/gathering-spots/69/add' && JSON.stringify(c.posts[0][1]) === JSON.stringify({ host_id: 'Brian Hager', count: 1 }), 'add request');

// 7. Close & Calculate: blocked while a spot is open, normal once none
c = setup(); await c.openGatheringCloseSheet(69);
b = c.document.getElementById('gathering-close-body').innerHTML;
ok(b.includes('Name every open spot') && b.includes('openFillSpotSheet(69, 0)'), 'close sheet lists the open spot with Fill');
const btn = c.document.getElementById('btn-gathering-close-confirm');
ok(btn.disabled && btn.textContent.includes('Fill open spots first'), 'Close is disabled until the spot is filled');
c = setup({ spots: [] }); await c.openGatheringCloseSheet(69);
const btn2 = c.document.getElementById('btn-gathering-close-confirm');
ok(!btn2.disabled && btn2.textContent.includes('Close with'), 'no spots: Close works as before');
ok(!c.document.getElementById('gathering-close-body').innerHTML.includes('Name every open spot'), 'no spots: no warning');
// a failed spots lookup never blocks the sheet (the server is the real guard)
c = setup(); const f0 = c.fetch; c.fetch = async (u, o) => { if (u.includes('gathering-spots')) throw new Error('net'); return f0(u, o); };
await c.openGatheringCloseSheet(69);
ok(!c.document.getElementById('btn-gathering-close-confirm').disabled, 'spots lookup failure does not block the sheet');

// 8. New Gathering form wiring
c = setup(); const sz = v => { c.document.getElementById('host-new-size').value = String(v); };
ok(c.hostAutoOpenSpots() === 3, 'size 4, host only -> 3 open spots');
c._hostCrewPicked = new Set(['Mike Scanlan', 'Jim Bingham']); ok(c.hostAutoOpenSpots() === 1, 'host + 2 invitees of 4 -> 1 spot');
c._hostCrewPicked = new Set(['Mike Scanlan', 'Jim Bingham', 'Brian Hager']); ok(c.hostAutoOpenSpots() === 1, 'host in the crew is not double counted');
c._hostPlaying = false; c._hostCrewPicked = new Set(['A', 'B']); ok(c.hostAutoOpenSpots() === 2, 'host not playing -> 2 spots');
c._hostCrewPicked = new Set(['A','B','C','D','E']); ok(c.hostAutoOpenSpots() === 0, 'over capacity floors at 0');
c._hostMode = 'open'; ok(c.hostAutoOpenSpots() === 0, 'open mode never creates spots'); c._hostMode = 'crew';
sz(''); ok(c.hostAutoOpenSpots() === 0, 'blank size -> 0');
c._hostPlaying = true; c._hostCrewPicked = new Set(); sz(4); c.updateHostSpotsPreview();
const prow = () => c.document.querySelector('#host-players-row .host-row-val').textContent;
ok(prow() === 'You · 3 open', 'Players row: host only of 4 -> "You · 3 open"');
c._hostCrewPicked = new Set(['Mike Scanlan', 'Jim Bingham']); c.updateHostSpotsPreview(); ok(prow() === 'You + 2 · 1 open', 'Players row: host + 2, 1 open');
sz(3); c.updateHostSpotsPreview(); ok(prow() === 'You + 2', 'Players row: full -> no open note');
c._hostPlaying = false; sz(4); c.updateHostSpotsPreview(); ok(prow() === '2 invited · 2 open', 'Players row: host not playing');
c._hostMode = 'open'; c.updateHostSpotsPreview(); ok(prow() === 'Open to members', 'Players row: open mode'); c._hostMode = 'crew'; c._hostPlaying = true;
c.bumpHostCapacity(1); ok(c.document.getElementById('host-new-size').value === '5', 'capacity +'); sz(1); c.bumpHostCapacity(-1); ok(c.document.getElementById('host-new-size').value === '1', 'capacity floors at 1'); sz(32); c.bumpHostCapacity(1); ok(c.document.getElementById('host-new-size').value === '32', 'capacity caps at 32');
c.hostSwitchSet('host-playing-switch', true); ok(c.document.getElementById('host-playing-switch').getAttribute('aria-checked') === 'true', 'switch on');
c.hostSwitchSet('host-playing-switch', false); ok(c.document.getElementById('host-playing-switch').getAttribute('aria-checked') === 'false', 'switch off');
ok(/role="switch"/.test(c.hostSwitchHtml('x', true, 'f()', 'L', 'S')), 'switch markup has role=switch');
c.toggleHostGame('skins'); c.toggleHostGame('cttp'); ok(c._hostGamesPick.size === 2 && c.document.querySelector('#host-games-row .host-row-val').textContent === 'Skins, CTP', 'games row summarizes picks');
c.toggleHostGame('skins'); ok(c._hostGamesPick.size === 1, 'game toggles off');
ok(/Added/.test(c.hostGamesListHtml('')) && !/BirdieBall/.test(c.hostGamesListHtml('ctp')), 'games list filters by search');
c.pickHostOption('format', 'Best Ball'); ok(c.document.getElementById('host-new-type').value === 'Best Ball' && c.document.querySelector('#host-format-row .host-row-val').textContent === 'Best Ball', 'format pick');
c.pickHostOption('holes', '9'); ok(c._hostHoles === 9 && c.document.querySelector('#host-holes-row .host-row-val').textContent === '9', 'holes pick');
ok(/const autoSpots = hostAutoOpenSpots\(\);/.test(src) && /count: autoSpots/.test(src), 'create uses the automatic count');
ok(!/_hostOpenSpots/.test(src), 'manual stepper state is gone');
ok(/if \(_wantGames && _createdG\) await showGatheringGamesForm\(gathData\.id, \[\.\.\._hostGamesPick\]\)/.test(src), 'Create opens the stakes form with the picked games');
ok(/Promise\.allSettled\(_regJobs\)/.test(src), 'registrations settle before the Games form counts players');
ok(/id="host-new-size"[^>]*oninput="updateHostSpotsPreview\(\)"/.test(src), 'size input updates the Players row');
ok(src.indexOf("hostRowHtml('host-holes-row'") < src.indexOf("hostRowHtml('host-format-row'"), 'Holes sits above Format');
ok(/_gamesFormSelected = new Set\(existing \? existing\.games : \(preselect \|\| \[\]\)\)/.test(src), 'games form accepts a preselection');
const iAdd = src.indexOf('/bfe/gathering-spots/${gathData.id}/add'), iHost = src.indexOf('// Auto-register the host themselves');
ok(iAdd > 0 && iHost > iAdd, 'spots are created BEFORE the host/crew registrations');
ok(/_hostGamesPick = new Set\(\);\s*\n\s*_pendingCrewName = null;/.test(src), 'form resets the game picks each time it opens');
ok(src.includes("Promise.all([loadHostTemplates(), loadHostGamesConfigs(), loadHostSpots()])"), 'Host Panel warms the spots cache');
ok((src.match(/hostSpotsHtml\(g, (true|false)\)/g) || []).length === 2, 'both the upcoming and archive cards render the block');
ok((src.match(/isOpenSpotName\(r\.player\) \? '🪑 ' \+ r\.player/g) || []).length === 2, 'placeholders are labelled in both response lists');

console.log(`${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
