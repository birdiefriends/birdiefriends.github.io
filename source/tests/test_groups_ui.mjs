// Dev-99: the host's Groups screen and the player's group line, on top of BFEngine.BFGroups.
import fs from 'fs'; import vm from 'vm'; import { JSDOM } from 'jsdom'; import { extractFn, loadEngine } from './extract.mjs'; import { fileURLToPath } from 'url';
const src = fs.readFileSync(fileURLToPath(new URL('../portal.html', import.meta.url)), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const E = loadEngine();
const FN = ['groupsRowsFromApi', 'groupsUnitsFor', 'groupsStripUnits', 'openGatheringGroups', 'groupsOptsForEngine', 'groupsWarnings', 'groupsWarnHtml', 'groupsSuggest', 'groupsSetOpt', 'groupsSetOptTyped', 'groupsSetField', 'groupsRefreshStatus', 'groupsItems', 'groupsItemAt', 'groupsPlace', 'groupsDropAt', 'groupsScroller', 'groupsPtrDown', 'groupsPtrMove', 'groupsPtrUp', 'groupsMenu', 'groupsAddGroupWith', 'groupsToggleSetup', 'groupsToPool', 'groupsDragStart', 'groupsDrop', 'groupsItemMove', 'groupsGroupMove', 'groupsSetOptPlace', 'groupsSetStatus', 'groupsAddGroup', 'groupsRemoveGroup', 'groupsRender', 'groupsSetOptMode', 'groupsSetOptSize', 'groupsSetOptSpread', 'groupsSave', 'groupsPublish', 'groupsLoadPublished', 'myGroupBannerHtml', 'openGatheringGroupsSheet', 'teamSizeOf', 'partnersOf', 'teamNamesText', 'teamsState'];
const dom = new JSDOM('<body><div id="host-sheet-body"></div><button id="host-sheet-back"></button></body>');
const reqs = []; let regs, groupSet = null;
const players = Array.from({ length: 24 }, (_, i) => 'P' + (i + 1)).concat(['Rich']);
regs = players.map((p, i) => ({ player_id: p, status: 'yes', partner_id: p === 'Rich' ? null : (i % 2 === 0 ? players[i + 1] : players[i - 1]) }));
const ctx = { setInterval, clearInterval, window: dom.window, document: dom.window.document, console, JSON, Math, Number, String, Set, Map, Array, Object, parseInt, Date, BFEngine: E, GATHERINGS_API: 'https://api', currentPlayer: 'Brian Hager',
  escapeHtml: s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])), isOpenSpotName: () => false, clearHostActionBar() {}, renderHostPanelList() {}, renderAll() { ctx._rendered = (ctx._rendered || 0) + 1; },
  toasts: [], showToast(m, e) { ctx.toasts.push([m, !!e]); }, confirm: () => true,
  gatheringData: [{ gatheringId: 104, name: '2026 Turkey 2Man', teamSize: 2, holes: 18, dt: new Date(Date.now() + 3 * 86400e3) }],
  gatheringRegData: players.map(p => ({ gatheringId: 104, player: p, status: 'Yes' })),
  gatheringsFetchJSON: async (u, o) => {
    reqs.push([u.replace('https://api', ''), o && o.body ? JSON.parse(o.body) : null]);
    if (/\/registrations$/.test(u)) return { registrations: regs };
    if (/group-sets\/gathering\/104(\?|$)/.test(u) && !(o && o.method)) return groupSet || { published: null, version: 0 };
    if (/\/publish$/.test(u)) return { ok: true, version: 1, notified: 25 };
    return { ok: true };
  } };
vm.createContext(ctx);
vm.runInContext('let _grp = null; let _groupSets = {}; const GRP_ESC = s => escapeHtml(String(s == null ? "" : s));\n' + FN.map(n => extractFn(src, n)).join('\n'), ctx);
const doc = dom.window.document, body = () => doc.getElementById('host-sheet-body');
await vm.runInContext('openGatheringGroups(104)', ctx);
ok(/Suggest groups/.test(body().textContent) && /25 players/.test(body().textContent) && /teams are placed as one/.test(body().textContent), 'opens with the roster and a Suggest button');
ok(/\/gatherings\/104\/registrations/.test(reqs[0][0]) && reqs.some(r => /group-sets\/gathering\/104\?host_id=Brian%20Hager/.test(r[0])), 'reads the CURRENT registrations and any saved groups');
vm.runInContext('groupsSuggest()', ctx);
let set = vm.runInContext('_grp.set', ctx);
ok(set.groups.length === 7 && set.groups.every(g => g.start_hole >= 1), 'suggests 7 groups, each with a starting hole: ' + set.groups.map(g => g.start_hole));
ok(/Group 7/.test(body().textContent) && /Hole/.test(body().textContent), 'and shows them');
ok(/Group 1 has 2 players/.test(body().textContent), 'the short group is advice on screen, not a block');
// the screen places TEAMS (a scramble places team names, not players)
const lc = s => s.toLowerCase(); const find = n => set.groups.findIndex(g => g.members.includes(n));
const itemsNow = () => vm.runInContext('groupsItems()', ctx);
const where = n => { const it = itemsNow(); for (let gi = 0; gi < it.groups.length; gi++) { const ii = it.groups[gi].findIndex(x => x.names.includes(n)); if (ii >= 0) return [gi, ii]; } const pi = it.pool.findIndex(x => x.names.includes(n)); return pi >= 0 ? [-1, pi] : null; };
const it0 = itemsNow();
ok(it0.groups.flat().filter(x => x.names.length === 2).length === 12 && it0.groups.flat().filter(x => x.names.length === 1).length === 1, 'items are 12 teams and 1 solo, not 25 players');
ok(/Group 1/.test(body().textContent) && doc.querySelectorAll('[draggable="true"]').length === 13, 'each team is ONE draggable item: ' + doc.querySelectorAll('[draggable="true"]').length);
// drag a team onto another group: both partners go together
let [fg, fi] = where('P5'); const to = fg === 0 ? 1 : 0;
vm.runInContext(`groupsDragStart({}, ${fg}, ${fi})`, ctx); vm.runInContext(`groupsDrop({}, ${to})`, ctx);
set = vm.runInContext('_grp.set', ctx);
ok(find('P5') === to && find('P6') === to, 'dragging a team to another group moves both partners');
ok(vm.runInContext('_grp.dirty', ctx) && /Unsaved/.test(body().textContent), 'marked unsaved');
// drop a team back to the pool, then place it BEFORE a given team
[fg, fi] = where('P5'); vm.runInContext(`groupsDragStart({}, ${fg}, ${fi})`, ctx); vm.runInContext('groupsDrop({}, -1)', ctx);
ok(find('P5') === -1 && /Not in a group/.test(body().textContent) && where('P5')[0] === -1, 'dropping on the pool takes a team out of its group (one pool item)');
const tgt = vm.runInContext('groupsItems()', ctx).groups[to][0];
vm.runInContext(`groupsDragStart({}, -1, ${where('P5')[1]})`, ctx); vm.runInContext(`groupsDrop({}, ${to}, 0)`, ctx);
set = vm.runInContext('_grp.set', ctx);
ok(set.groups[to].members[0] === 'P5' && set.groups[to].members[2] === tgt.names[0], 'dropping on a team inserts before it');
// phones: tap a row -> the Move-to list (no dragging needed)
let sheet0 = null; ctx.openHostSheet = (t, h) => { sheet0 = { t, h }; }; ctx.closeHostSheet = () => {};
[fg, fi] = where('P5'); const to2 = to === 0 ? 1 : 0;
vm.runInContext(`groupsMenu(${fg}, ${fi})`, ctx);
const mtxt = sheet0.h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
ok(/Group 1/.test(mtxt) && /Group 7/.test(mtxt) && /here/.test(mtxt) && /Back to the pool/.test(mtxt) && /New group/.test(mtxt) && /Earlier/.test(mtxt), 'tapping a row opens Move-to with every group, the pool, a new group and up/down: ' + mtxt.slice(0, 160));
ok(/hole \d+/.test(mtxt) && /\/4/.test(mtxt), 'each group shows its start and how full it is');
vm.runInContext(`groupsPlace(groupsItemAt(${fg},${fi}).names, ${to2})`, ctx);
set = vm.runInContext('_grp.set', ctx); ok(find('P5') === to2 && find('P6') === to2, 'choosing a group from the list moves the team');
const n0 = set.groups.length; [fg, fi] = where('P5'); vm.runInContext(`groupsAddGroupWith(${fg}, ${fi})`, ctx); set = vm.runInContext('_grp.set', ctx);
ok(set.groups.length === n0 + 1 && find('P5') === n0, '"New group" makes one and puts the team in it');
// a finger: grab the ⠿ handle, the ghost follows, release over a group
[fg, fi] = where('P5'); const dest = fg === 0 ? 1 : 0;
const targetEl = { getAttribute: k => ({ 'data-drop': String(dest) })[k] ?? null, style: {} };
doc.elementsFromPoint = () => [targetEl];
const handle = { setPointerCapture() {}, style: {} };
vm.runInContext(`groupsPtrDown({ pointerType: 'touch', preventDefault() {}, clientX: 50, clientY: 400, pointerId: 7, currentTarget: null }, ${fg}, ${fi})`, ctx);
ok(doc.body.lastChild && /P5/.test(doc.body.lastChild.textContent), 'a ghost of the team follows the finger');
vm.runInContext("groupsPtrMove({ pointerId: 7, preventDefault() {}, clientX: 60, clientY: 300 })", ctx);
ok(targetEl.style.outline, 'the group under the finger is highlighted');
vm.runInContext("groupsPtrUp({ pointerId: 7, type: 'pointerup', clientX: 60, clientY: 300 })", ctx);
set = vm.runInContext('_grp.set', ctx); ok(find('P5') === dest && find('P6') === dest, 'releasing over a group drops the team there');
ok(!doc.body.lastChild || !/P5/.test(doc.body.lastChild.textContent || ''), 'and the ghost is gone');
// a finger released over nothing cancels; a mouse is left to HTML5 drag
const before2 = JSON.stringify(vm.runInContext('_grp.set.groups', ctx)); [fg, fi] = where('P5');
doc.elementsFromPoint = () => [];
vm.runInContext(`groupsPtrDown({ pointerType: 'touch', preventDefault() {}, clientX: 5, clientY: 5, pointerId: 8, currentTarget: null }, ${fg}, ${fi})`, ctx);
vm.runInContext("groupsPtrUp({ pointerId: 8, type: 'pointerup', clientX: 5, clientY: 5 })", ctx);
ok(JSON.stringify(vm.runInContext('_grp.set.groups', ctx)) === before2, 'letting go over nothing changes nothing');
vm.runInContext(`groupsPtrDown({ pointerType: 'mouse', preventDefault() {}, clientX: 5, clientY: 5, pointerId: 9, currentTarget: null }, ${fg}, ${fi})`, ctx);
ok(!doc.body.lastChild || !/P5/.test(doc.body.lastChild.textContent || ''), 'a mouse does not start a finger drag');
// dropping a team on itself is a no-op
[fg, fi] = where('P5'); const b3 = JSON.stringify(vm.runInContext('_grp.set.groups', ctx));
vm.runInContext(`groupsDragStart({}, ${fg}, ${fi})`, ctx); vm.runInContext(`groupsDrop({}, ${fg}, ${fi})`, ctx);
ok(JSON.stringify(vm.runInContext('_grp.set.groups', ctx)) === b3, 'dropping a team on itself changes nothing');
// phone layout: big targets, sticky save bar, setup collapses once groups exist
ok(/position:sticky;bottom:0/.test(body().innerHTML) && /Publish/.test(body().innerHTML), 'Save and Publish stay pinned to the bottom of the screen');
ok(/⚙ Shotgun/.test(body().textContent) && !/Players a group/.test(body().textContent), 'once groups exist the setup folds up to one line');
vm.runInContext('groupsToggleSetup()', ctx); ok(/Players a group/.test(body().textContent), 'and opens again with a tap');
// up/down inside a group
[fg, fi] = where('P5'); const nIt = itemsNow().groups[fg].length; const before = itemsNow().groups[fg].map(x => x.names[0]);
if (fi === 0 && nIt > 1) { vm.runInContext(`groupsItemMove(${fg}, 0, 1)`, ctx); ok(itemsNow().groups[fg][1].names[0] === before[0], '↓ moves a team down within its group'); }
else { vm.runInContext(`groupsItemMove(${fg}, ${fi}, -1)`, ctx); ok(itemsNow().groups[fg][fi - 1].names[0] === before[fi], '↑ moves a team up within its group'); }
// groups up/down: a shotgun hole stays with its group; tee times follow the order
const h0 = vm.runInContext('_grp.set.groups[0].start_hole', ctx), m0 = vm.runInContext('_grp.set.groups[0].members[0]', ctx);
vm.runInContext('groupsGroupMove(0, 1)', ctx);
ok(vm.runInContext('_grp.set.groups[1].start_hole', ctx) === h0 && vm.runInContext('_grp.set.groups[1].members[0]', ctx) === m0, 'moving a group later carries its starting hole with it');
vm.runInContext("_grp.set.mode = 'tee_times'; _grp.opts.mode = 'tee_times'; _grp.opts.first_tee = '08:00'; _grp.opts.interval = 10; groupsGroupMove(1, -1)", ctx);
ok(vm.runInContext('_grp.set.groups.map(g => g.tee_time).join()', ctx).startsWith('08:00,08:10,08:20'), 'in tee-time mode the times follow the new order');
vm.runInContext("_grp.set.mode = 'shotgun'; _grp.opts.mode = 'shotgun'; groupsSuggest()", ctx); set = vm.runInContext('_grp.set', ctx);
// "Players" mode splits teams for the odd event that needs it
vm.runInContext("groupsSetOptPlace('players')", ctx);
ok(itemsNow().groups.flat().every(x => x.names.length === 1) && doc.querySelectorAll('[draggable="true"]').length === 25, 'Players mode: 25 single items');
[fg, fi] = where('P5'); const to3 = fg === 0 ? 1 : 0;
vm.runInContext(`groupsDragStart({}, ${fg}, ${fi})`, ctx); vm.runInContext(`groupsDrop({}, ${to3})`, ctx); set = vm.runInContext('_grp.set', ctx);
ok(find('P5') === to3 && find('P6') !== to3, 'in Players mode one player moves alone');
ok(/different groups/.test(vm.runInContext('groupsWarnHtml()', ctx)), 'and the split team is flagged');
vm.runInContext("groupsSetOptPlace('teams')", ctx);
// typing a hole updates the check text only
vm.runInContext("groupsSetField(0, 'start_hole', '9')", ctx); ok(vm.runInContext('_grp.set.groups[0].start_hole', ctx) === 9, 'a start hole can be typed over');
// publish: saves the draft then publishes, no unit ids stored
reqs.length = 0; await vm.runInContext('groupsPublish()', ctx);
ok(reqs.length === 2 && reqs[0][1].draft && !reqs[0][1].draft.groups.some(g => g.units) && /\/publish$/.test(reqs[1][0]) && reqs[1][1].host_id === 'Brian Hager', 'publish saves the draft (no internal ids), then publishes as the host');
ok(ctx.toasts.some(t => /Published \(Preliminary\)/.test(t[0])), 'toast says published as Preliminary: ' + JSON.stringify(ctx.toasts.slice(-1)));
// reopening: saved groups come back, and a roster change is reconciled and reported
groupSet = { draft: vm.runInContext('groupsStripUnits(_grp.set)', ctx), published: null, version: 1, published_at: '2026-11-12' };
regs = regs.filter(r => r.player_id !== 'P24'); regs.find(r => r.player_id === 'P23').partner_id = null;
await vm.runInContext('openGatheringGroups(104)', ctx);
ok(/No longer on the list: P24/.test(body().textContent) && /Unsaved/.test(body().textContent), 'a dropout since the last save is removed and reported');
ok(!vm.runInContext('_grp.set', ctx).groups.some(g => g.members.includes('P24')), 'and gone from the groups');
// the player's own card
groupSet = { published: { v: 1, mode: 'shotgun', holes: 18, group_size: 4, groups: [{ members: ['Ann', 'Bob'], start_hole: 12, wave: 'A' }, { members: ['Cy'], tee_time: '09:20' }] }, version: 2 };
ctx.currentPlayer = 'Ann'; ctx.gatheringRegData = [{ gatheringId: 104, player: 'Ann', status: 'Yes' }];
reqs.length = 0; await vm.runInContext('groupsLoadPublished()', ctx);
const banner = vm.runInContext('myGroupBannerHtml({ gatheringId: 104 })', ctx).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
ok(/Group 1 · start on hole 12 \(A\)/.test(banner) && /With Bob/.test(banner), 'a player sees their group, hole and who they play with: ' + banner);
ok(ctx._rendered === 1, 'and the cards re-render once');
ok(/Starting Holes/.test(banner) || /Starting Holes/.test(vm.runInContext('myGroupBannerHtml({ gatheringId: 104 })', ctx)), 'the card offers the full Groups & Starting Holes list');
let sheet = null; ctx.openHostSheet = (t, h) => { sheet = { t, h }; };
vm.runInContext('openGatheringGroupsSheet(104)', ctx);
const sh = sheet.h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
ok(/Group 1.*start on hole 12 \(A\)|Group 1.*hole 12/.test(sh) && /Group 2.*9:20 AM/.test(sh) && sheet.h.indexOf('Group 1') < sheet.h.indexOf('Group 2'), 'the sheet lists every group with its start and members: ' + sh);
ok(/<b>Ann<\/b>/.test(sheet.h), 'and marks the viewer');
ctx.currentPlayer = 'Zed'; ok(!/start on hole/.test(vm.runInContext('myGroupBannerHtml({ gatheringId: 104 })', ctx)) && /Starting Holes/.test(vm.runInContext('myGroupBannerHtml({ gatheringId: 104 })', ctx)), 'someone not in a group sees no personal line but still sees the list');
// Preliminary / Final: defaults to Preliminary, host can flip it, it is saved in the document, players see the tag
ok(vm.runInContext('_grp.status', ctx) === 'preliminary', 'a group set defaults to Preliminary');
vm.runInContext("groupsSetStatus('final')", ctx); reqs.length = 0; await vm.runInContext('groupsSave(true)', ctx);
ok(reqs[0][1].draft.status === 'final', 'Final is stored in the saved document');
ok(/Preliminary<\/button>/.test(ctx.document.getElementById('host-sheet-body').innerHTML) && !/tell players/i.test(ctx.document.getElementById('host-sheet-body').innerHTML), 'the screen has a Preliminary/Final switch and no "tell players" wording');
vm.runInContext("_groupSets[104] = { published: { mode: 'shotgun', status: 'preliminary', groups: [{ members: ['Ann'], start_hole: 3 }] }, version: 1 }", ctx);
ctx.currentPlayer = 'Ann'; ok(/\(Preliminary\)/.test(vm.runInContext("myGroupBannerHtml({gatheringId:104})", ctx)), 'players see (Preliminary) on their start');
vm.runInContext("_groupSets[104].published.status = 'final'", ctx); ok(!/Preliminary/.test(vm.runInContext("myGroupBannerHtml({gatheringId:104})", ctx)), 'and it disappears once Final');
// Team names on the published list; a lone unpaired player is not nagged about
ctx.currentPlayer = 'Ann';
ctx.gatheringRegData = [
  { gatheringId: 104, player: 'Ann', status: 'Yes', partner: 'Bob', teamName: 'Birdie Brigade' }, { gatheringId: 104, player: 'Bob', status: 'Yes', partner: 'Ann', teamName: 'Birdie Brigade' },
  { gatheringId: 104, player: 'Cy', status: 'Yes', partner: 'Di', teamName: null }, { gatheringId: 104, player: 'Di', status: 'Yes', partner: 'Cy', teamName: null },
  { gatheringId: 104, player: 'Rich', status: 'Yes', partner: null, teamName: null }];
vm.runInContext("_groupSets[104] = { published: { mode: 'shotgun', status: 'preliminary', groups: [{ members: ['Ann','Bob','Cy','Di'], start_hole: 1 }, { members: ['Rich'], start_hole: 2 }] }, version: 1 }", ctx);
vm.runInContext('openGatheringGroupsSheet(104)', ctx);
const tsh = sheet.h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
ok(/Birdie Brigade · Ann &amp; Bob/.test(tsh) && /Cy &amp; Di/.test(tsh) && /Rich/.test(tsh), 'the list shows each team by name with its players: ' + tsh);
ok(/<b>Ann<\/b>/.test(sheet.h), 'and still marks the viewer');
vm.runInContext("_grp = { g: gatheringData[0], units: groupsUnitsFor(gatheringData[0], gatheringRegData), sel: null, notes: [], opts: { mode: 'shotgun', group_size: 4, spread: 'order', holes: 18 } }; _grp.set = BFEngine.BFGroups.suggest(_grp.units, groupsOptsForEngine()).set; _grp.set.groups = [{ members: ['Ann','Bob','Cy','Di'], start_hole: 1 }, { members: ['Rich'], start_hole: 2 }];", ctx);
ok(!vm.runInContext('groupsWarnings()', ctx).some(w => w.code === 'short' && w.group === 1), 'a group of just the unpaired player gets no short warning: ' + JSON.stringify(vm.runInContext('groupsWarnings()', ctx)) + JSON.stringify(vm.runInContext('_grp.units', ctx)));
console.log(`${pass} passed, ${fail} failed`); if (fail) process.exit(1);
