// Dev-99: the host's Groups screen and the player's group line, on top of BFEngine.BFGroups.
import fs from 'fs'; import vm from 'vm'; import { JSDOM } from 'jsdom'; import { extractFn, loadEngine } from './extract.mjs'; import { fileURLToPath } from 'url';
const src = fs.readFileSync(fileURLToPath(new URL('../portal.html', import.meta.url)), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const E = loadEngine();
const FN = ['groupsRowsFromApi', 'groupsUnitsFor', 'groupsStripUnits', 'openGatheringGroups', 'groupsOptsForEngine', 'groupsWarnings', 'groupsWarnHtml', 'groupsSuggest', 'groupsSetOpt', 'groupsSetOptTyped', 'groupsSetField', 'groupsRefreshStatus', 'groupsPick', 'groupsMoveTo', 'groupsAddGroup', 'groupsRemoveGroup', 'groupsRender', 'groupsSetOptMode', 'groupsSetOptSize', 'groupsSetOptSpread', 'groupsSave', 'groupsPublish', 'groupsLoadPublished', 'myGroupBannerHtml', 'openGatheringGroupsSheet', 'teamSizeOf', 'partnersOf', 'teamNamesText', 'teamsState'];
const dom = new JSDOM('<body><div id="host-sheet-body"></div><button id="host-sheet-back"></button></body>');
const reqs = []; let regs, groupSet = null;
const players = Array.from({ length: 24 }, (_, i) => 'P' + (i + 1)).concat(['Rich']);
regs = players.map((p, i) => ({ player_id: p, status: 'yes', partner_id: p === 'Rich' ? null : (i % 2 === 0 ? players[i + 1] : players[i - 1]) }));
const ctx = { document: dom.window.document, console, JSON, Math, Number, String, Set, Map, Array, Object, parseInt, Date, BFEngine: E, GATHERINGS_API: 'https://api', currentPlayer: 'Brian Hager',
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
ok(/Suggest groups/.test(body().textContent) && /25 players/.test(body().textContent) && /partners always stay together/.test(body().textContent), 'opens with the roster and a Suggest button');
ok(/\/gatherings\/104\/registrations/.test(reqs[0][0]) && reqs.some(r => /group-sets\/gathering\/104\?host_id=Brian%20Hager/.test(r[0])), 'reads the CURRENT registrations and any saved groups');
vm.runInContext('groupsSuggest()', ctx);
let set = vm.runInContext('_grp.set', ctx);
ok(set.groups.length === 7 && set.groups.every(g => g.start_hole >= 1), 'suggests 7 groups, each with a starting hole: ' + set.groups.map(g => g.start_hole));
ok(/Group 7/.test(body().textContent) && /Hole/.test(body().textContent), 'and shows them');
ok(/Group 1 has 2 players/.test(body().textContent), 'the short group is advice on screen, not a block');
// move a player: the partner travels with them
const lc = s => s.toLowerCase(); const find = n => set.groups.findIndex(g => g.members.includes(n));
const from = find('P5'), to = from === 0 ? 1 : 0;
vm.runInContext("groupsPick('P5')", ctx); vm.runInContext(`groupsMoveTo(${to})`, ctx);
set = vm.runInContext('_grp.set', ctx);
ok(find('P5') === to && find('P6') === to, 'moving P5 also moves their partner P6 (teams stay together)');
ok(vm.runInContext('_grp.dirty', ctx) && /Unsaved/.test(body().textContent), 'marked unsaved');
vm.runInContext('_grp.opts.keep = false', ctx); vm.runInContext("groupsPick('P5')", ctx); vm.runInContext(`groupsMoveTo(${from})`, ctx);
set = vm.runInContext('_grp.set', ctx);
ok(find('P5') === from && find('P6') === to, 'with "keep together" off, one player moves alone');
ok(/is in Group|different groups/.test(vm.runInContext('groupsWarnHtml()', ctx)) || /different groups/.test(vm.runInContext('groupsWarnHtml()', ctx)), 'and the split team is flagged');
// typing a hole updates the check text only
vm.runInContext("groupsSetField(0, 'start_hole', '9')", ctx); ok(vm.runInContext('_grp.set.groups[0].start_hole', ctx) === 9, 'a start hole can be typed over');
// publish: saves the draft then publishes, no unit ids stored
reqs.length = 0; await vm.runInContext('groupsPublish()', ctx);
ok(reqs.length === 2 && reqs[0][1].draft && !reqs[0][1].draft.groups.some(g => g.units) && /\/publish$/.test(reqs[1][0]) && reqs[1][1].host_id === 'Brian Hager', 'publish saves the draft (no internal ids), then publishes as the host');
ok(ctx.toasts.some(t => /25 players told/.test(t[0])), 'says how many players were told: ' + JSON.stringify(ctx.toasts.slice(-1)));
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
console.log(`${pass} passed, ${fail} failed`); if (fail) process.exit(1);
