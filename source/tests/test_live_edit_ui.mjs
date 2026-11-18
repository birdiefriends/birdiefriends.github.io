// Live Edit (Dev-101): the "Fix groups" sheet. Three actions (Not here / Move / Start hole), a plain preview line, one Apply.
import fs from 'fs'; import vm from 'vm'; import { JSDOM } from 'jsdom'; import { extractFn, loadEngine } from './extract.mjs'; import { fileURLToPath } from 'url';
const src = fs.readFileSync(fileURLToPath(new URL('../portal.html', import.meta.url)), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const E = loadEngine();
const dom = new JSDOM('<body></body>'), doc = dom.window.document;
const set = { v: 1, mode: 'shotgun', holes: 18, group_size: 4, status: 'final', groups: [{ members: ['A','B','C','D'], start_hole: 1 }, { members: ['E','F','G','H'], start_hole: 4 }, { members: ['I','J','K','L'], start_hole: 7 }] };
const reqs = [];
const ctx = { window: dom.window, document: doc, console, JSON, Math, Number, String, Set, Map, Array, Object, BFEngine: E, GATHERINGS_API: 'https://api', currentPlayer: 'Brian Hager',
  escapeHtml: s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])),
  toasts: [], showToast(m, e) { ctx.toasts.push(m); }, isCommissioner: () => false, renderAll() {}, renderLiveBanner() {},
  gatheringData: [{ gatheringId: 104, name: 'Turkey 2Man', teamSize: 2, hostId: 'Brian Hager' }],
  gatheringRegData: 'ABCDEFGHIJKL'.split('').map(p => ({ gatheringId: 104, player: p, status: 'Yes' })),
  teamSizeOf: x => Number(x && x.teamSize) || 0,
  teamsState: () => ({ pairs: [['A','B'],['C','D'],['E','F'],['G','H'],['I','J'],['K','L']], names: ['','','','','',''] }),
  ensureGroupSet: async () => {}, addDialogs: [], openAddPlayerDialog(prefill, opt, cb) { ctx.addDialogs.push(opt); ctx.addCb = cb; },
  gatheringsFetchJSON: async (u, o) => { reqs.push([u, o && o.body ? JSON.parse(o.body) : null]); return /publish$/.test(u) ? { ok: true, version: 3, notified: 1 } : { ok: true }; } };
vm.createContext(ctx);
const FN = ['openHostSheet','closeHostSheet','liveEditState','liveEditSave','liveEditEntryHtml','openLiveEdit','leRender','leTap','leDo','leAct','leMoveTo','leHole','leSetHole','leUndo','leApply','refreshGroupSetNow','leAddStart','leAddAt','leAddCancel'];
vm.runInContext('let _groupSets = { 104: { published: ' + JSON.stringify(set) + ', version: 2 } }; let _le = null;\n' + FN.map(n => extractFn(src, n)).join('\n') + '\nthis.api = { ' + FN.join(',') + ', get le() { return _le; } };', ctx);
const A = ctx.api, txt = () => (doc.getElementById('host-sheet-content') || { textContent: '' }).textContent;
const click = label => { const b = [...doc.querySelectorAll('#host-sheet-content button')].find(x => x.textContent.trim().startsWith(label)); if (!b) throw new Error('no button ' + label); vm.runInContext(b.getAttribute('onclick'), ctx); };
const tapName = n => vm.runInContext(`leTap(${A.le.names.indexOf(n)})`, ctx);

ok(A.liveEditEntryHtml(104).includes('Fix groups') && !A.liveEditEntryHtml(999), 'host sees the Fix groups button (Gathering found); unknown Gathering: none');
ctx.currentPlayer = 'Someone'; ok(A.liveEditEntryHtml(104) === '', 'a player does not'); ctx.currentPlayer = 'Brian Hager';
await A.openLiveEdit(104);
ok(/Planned: 12 players, 3 groups\. Playing: 12 players, 3 groups\./.test(txt()), 'opens with the plain line');
ok(/Group 1/.test(txt()) && /Hole 7/.test(txt()), 'groups with their start holes');
ok(doc.querySelector('#host-sheet-content button[disabled]') !== null, 'Apply is disabled until something changes');

// Not here
tapName('L'); click('Not here');
ok(/Out: L \(no-show\)/.test(txt()) && /Out: L \(no-show\)/.test(doc.querySelector('#host-sheet-content div').textContent), 'line says L is out');
ok(/K is short of a team/.test(txt()), 'K is listed as left alone');
const joins = [...doc.querySelectorAll('#host-sheet-content button')].filter(b => /^Join /.test(b.textContent));
ok(joins.length === 5 && /Group \d → \d/.test(joins[0].textContent), 'one-tap Join choices show the group size that results');
ok(![...doc.querySelectorAll('#host-sheet-content button')].some(b => /Apply/.test(b.textContent) && b.disabled), 'Apply is enabled (doing nothing about K is allowed)');
// pick: K joins E & F
click('Join E & F');
ok(/E & F & K is a 3-some/.test(txt()) && !/short of a team/.test(txt()), 'K joined E & F, no orphan');
ok(/Group 2 · 5 players/.test(txt()) && /5 players/.test(txt()), 'group 2 now shows 5 players (a warning, not a block)');
// move a team + start hole + undo
tapName('A'); click('Move…'); click('Group 3'); 
ok(/Group 3 · 3 players|Group 3 · 4 players|Group 3 · 5 players/.test(txt()), 'A & B moved together');
click('Undo');
ok(A.le.ops.length === 2, 'undo removes the last change');
vm.runInContext('leHole(0)', ctx); ok(doc.querySelectorAll('#host-sheet-content button').length > 18, 'tapping the hole shows 1-18');
click('9'); ok(/Hole 9/.test(txt()), 'start hole changed');
// Apply
const before = reqs.length;
await A.leApply();
const pub = reqs.find(r => /publish$/.test(r[0]));
ok(pub && pub[1].if_version === 2 && pub[1].draft.groups[0].start_hole === 9 && pub[1].draft.out.l.reason === 'noshow', 'Apply = one publish carrying the version and the as-played copy');
ok(reqs.some(r => /registrations$/.test(r[0]) && r[1].status === 'no' && r[1].player_id === 'L'), 'L registration set to No');
ok(!doc.getElementById('host-option-sheet') && A.le === null && ctx.toasts.some(t => /Groups updated/.test(t)), 'sheet closes with a plain confirmation');
// stale
ctx.gatheringsFetchJSON = async (u, o) => /publish$/.test(u) ? { error: 'stale', code: 'stale', version: 9 } : (/group-sets/.test(u) ? { published: set, version: 9 } : { ok: true });
await A.openLiveEdit(104); tapName('A'); click('Not here'); await A.leApply();
ok(ctx.toasts.some(t => /Someone else changed the groups/.test(t)), 'a stale editor is told to redo');

// ── swap and add ──
await A.openLiveEdit(104);
tapName('L'); click('Replace…');
ok(ctx.addDialogs.length === 1 && ctx.addDialogs[0].gatheringId === 104, 'Replace… opens the existing Add a player dialog for this Gathering');
ctx.addCb('Zed');
ok(/Out: L \(no-show\)\. Added: Zed\./.test(txt()) && /Playing: 12 players/.test(txt()), 'the recruit takes the no-show\'s place in one step: ' + txt().slice(0, 120));
ok([...doc.querySelectorAll('#host-sheet-content button')].some(b => b.textContent.trim() === 'Zed'), 'Zed is listed in L\'s group');
click('Undo');
// + Add player: host chooses where
click('+ Add player');
ok(ctx.addDialogs.length === 2, '+ Add player opens the same dialog');
ctx.addCb('Yan');
ok(/Where does Yan play\?/.test(txt()) && /Join E & F/.test(txt()) && /Own team/.test(txt()) && /\+ New group/.test(txt()), 'asks where, with Join / Own team / New group choices (no default)');
click('Join E & F');
ok(!/Where does Yan play/.test(txt()) && /Planned: 12 players, 3 groups\. Playing: 13 players/.test(txt()) && /Added: Yan\./.test(txt()), 'Yan joins E & F: Planned 12, Playing 13');
ok(/E & F & Yan is a 3-some/.test(txt()), 'shown as a 3-some');
// cancel leaves the roster alone
click('+ Add player'); ctx.addCb('Xi'); click('Cancel');
ok(!/Where does Xi play/.test(txt()) && !/Added: .*Xi/.test(txt()), 'Cancel closes the question and adds nobody');
reqs.length = 0; ctx.gatheringsFetchJSON = async (u, o) => { reqs.push([u, o && o.body ? JSON.parse(o.body) : null]); return /publish$/.test(u) ? { ok: true, version: 4, notified: 2 } : { ok: true }; };
ctx._groupSets = ctx._groupSets;
await A.leApply();
const pub2 = reqs.find(r => /publish$/.test(r[0]));
ok(pub2 && pub2[1].draft.added.yan === 'Yan' && pub2[1].draft.teams.some(t => t.members.includes('Yan') && t.members.length === 3), 'Apply saves the added player and the 3-some in the same document');

// ── no groups were ever published: Fix groups builds the plan from who is registered Yes ──
ctx._groupSets = {}; vm.runInContext('_groupSets = {}', ctx);
ctx.gatheringRegData = 'ABCDEF'.split('').map(p => ({ gatheringId: 104, player: p, status: 'Yes' }));
ctx.teamsState = () => ({ pairs: [['A','B'],['C','D'],['E','F']], names: ['','',''] });
await A.openLiveEdit(104);
ok(/Planned: 6 players, 2 groups\. Playing: 6 players, 2 groups\./.test(txt()) && /Group 1 · 4 players/.test(txt()) && /Group 2 · 2 players/.test(txt()), 'no published groups: plan built from the registrations, teams kept together');
tapName('F'); click('Not here');
ok(/Out: F \(no-show\)/.test(txt()) && /E is short of a team/.test(txt()), 'Not here works on a Gathering that never had groups');
reqs.length = 0; ctx.gatheringsFetchJSON = async (u, o) => { reqs.push([u, o && o.body ? JSON.parse(o.body) : null]); return /publish$/.test(u) ? { ok: true, version: 1, notified: 0 } : { ok: true }; };
await A.leApply();
const pub3 = reqs.find(r => /publish$/.test(r[0]));
ok(pub3 && pub3[1].if_version === 0 && pub3[1].draft.mode === 'tee_times' && pub3[1].draft.out.f.reason === 'noshow', 'first Apply publishes the plan and the change together');
console.log(`live_edit_ui: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
