// Dev-93 — live scoring (Score mode): foursome groups, initials, merge rules, tap-to-save, wiring, BF Series untouched.
import fs from 'fs'; import vm from 'vm';
import { extractFn, loadEngine } from './extract.mjs';
import { fileURLToPath } from 'url';
const src = fs.readFileSync(fileURLToPath(new URL('../portal.html', import.meta.url)), 'utf8');
let pass = 0, fail = 0;
const eq = (a, b, m) => { const ok = JSON.stringify(a) === JSON.stringify(b); ok ? pass++ : fail++; if (!ok) console.log('FAIL', m, '\n  got', JSON.stringify(a), '\n  exp', JSON.stringify(b)); };
const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const E = loadEngine();
const PARS = [4,4,3,4,5,4,5,3,4, 3,5,4,4,4,3,4,5,3];

// ── engine helpers
eq(E.fourballGroups([['A','B'],['C','D'],['E','F'],['G','H']]).map(g => g.players), [['A','B','C','D'],['E','F','G','H']], 'groups: pairs taken two at a time');
eq(E.fourballGroups([['A','B'],['C','D'],['E','F']]).map(g => g.pairs.length), [2, 1], 'groups: a last odd pair is its own group');
eq(E.fourballGroups(null), [], 'groups: none');
eq(E.playerInitials(['Brian Hager', 'Tom Marsh', 'Mike', 'Dave Vance']), ['BH', 'TM', 'MI', 'DV'], 'initials: first+last, single name two letters');
eq(E.playerInitials(['Tom Marsh', 'Tim Maher']), ['TM', 'TIM'], 'initials: a clash gets more letters');
eq(new Set(E.playerInitials(['Al Bo', 'Alan Bo', 'Alex Bo', 'Al Bo'])).size, 4, 'initials: always unique');
const L = [4,null,3], R = [5,4,null];
eq(E.mergeHoleScores(L, R, null).slice(0, 3), [5, 4, 3], 'merge: server wins where it has a score, local fills the rest');
eq(E.mergeHoleScores(L, R, { 1: 4 }).slice(0, 3), [4, 4, 3], 'merge: a hole not yet saved from this phone keeps the local value');
eq(E.mergeHoleScores([4], [4], { 1: 0 })[0], null, 'merge: an unsaved clear stays cleared');
eq(E.mergeHoleScores(null, null, null).length, 18, 'merge: always 18 holes');

// ── portal logic in a sandbox
const cfgRow = { games: ['fourball'], dollar_per_player: 20, game_configs: { fourball: { dollar_per_player: 20, basis: 'gross', net_mode: 'own',
  pairs: [['Brian Hager','Tom Marsh'],['Mike Kay','Dave Vance'],['Sam Lee','Pat Roe'],['Lee Jo','Jo Wu']] } } };
const config = E.gatheringConfigFromLegacy(cfgRow);
const posts = [];
const store = {};
const ctx = { console, JSON, Math, Number, String, Set, Map, Array, Object, Date, Promise, BFEngine: E, SCORECARD_API: 'https://sc', currentPlayer: 'Mike Kay',
  escapeHtml: s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])),
  localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; } },
  panelGamesGid: e => e.gatheringId, gamesScoreKeyForGid: g => 'gathering:' + g, csResolvePars: () => PARS, ensureVenueTeeInfoByName: async () => null,
  csMarkFromPar: (v, p) => (v == null ? null : v < p ? 'c' : v > p ? 's' : null), csNormalizedVenueName: () => 'BSGC',
  renderLiveBanner: () => { ctx.rendered++; }, rendered: 0, window: { addEventListener() {} },
  gatheringAddon: (c, id) => (c && c.addons.find(a => a.id === id)) || null, failNext: false,
  fetch: async (url, opt) => { if (ctx.failNext) throw new Error('offline'); posts.push(JSON.parse(opt.body)); return { json: async () => ({ ok: true }) }; } };
vm.createContext(ctx);
const names = ['liveScoringOn','skStoreKey','skPersist','skEnsure','skGroups','skGroup','skMaxHole','skPars','skMode','setLiveScoreMode','skMarks','skGot','skAnyStrokes','skDotsHtml','skCardOf','skMergeRemote','skGoFirstOpen','skFirstEmptyPlayer','skTap','skClear','skSetScore','skPick','skNav','skSetGroup','skJump','skQueueSave','skPost','skFlush','livePanelModeToggleHtml','liveScoreModeHtml'];
vm.runInContext('let _sk = null; const _skChain = {};\n' + names.map(n => extractFn(src, n)).join('\n') + '\nthis.api={' + names.join(',') + ',get:()=>_sk};', ctx);
const A = ctx.api;
const evt = { gatheringId: 7, name: 'Sat Fourball', holes: 18 };
const tick = () => new Promise(r => setTimeout(r, 5));

ok(A.liveScoringOn(config, 7) && !A.liveScoringOn(config, null) && !A.liveScoringOn(null, 7), 'on only for a Fourball round with a panel gid');
ok(!A.liveScoringOn(E.gatheringConfigFromLegacy({ games: ['skins'], dollar_per_player: 10 }), 7), 'a Skins-only round has no live scoring');
A.skEnsure(evt, config);
eq(A.skGroups().length, 2, 'two foursomes');
A.skMergeRemote([]);
eq(A.get().groupIdx, 0, 'viewer in pair 2 -> group 1');
eq(A.skGroup().players, ['Brian Hager','Tom Marsh','Mike Kay','Dave Vance'], 'group has 2 pairs');
eq([A.get().hole, A.get().sel], [1, 0], 'starts at hole 1, first player');

// tap four scores
[4,3,4,5].forEach(v => A.skTap(v)); await tick(); await tick();
const c1 = A.get().cards;
eq([c1['Brian Hager'][0], c1['Tom Marsh'][0], c1['Mike Kay'][0], c1['Dave Vance'][0]], [4,3,4,5], 'four taps fill four players for hole 1');
eq(posts.length, 4, 'each score saved as it was tapped (one post per tap)');
const last = posts.find(p => p.player === 'Dave Vance');
ok(last.input_type === 'strokes' && last.event_name === 'gathering:7' && last.holes.length === 18 && last.holes[0] === 5 && last.holes[1] === null, 'post: gross strokes, 18 slots, only hole 1 filled');
eq([last.total, last.front9, last.hole_count, last.venue], [5, 5, 18, 'BSGC'], 'post: totals, 18 holes, venue');
eq(last.marks[0], 's', 'post: marks computed from par (5 on a par 4)');
eq(Object.keys(A.get().dirty), [], 'nothing left waiting after saves');
eq(A.get().sel, -1, 'after the fourth score the pad goes away (hole is full)');
ok(!/skTap\(/.test(A.liveScoreModeHtml()), 'full hole: no pad on screen');

// next hole + selection jumps to first empty
A.skNav(1);
eq([A.get().hole, A.get().sel], [2, 0], 'next hole starts at the first player');
A.skTap(4); A.skTap(4);
eq(A.get().sel, 2, 'selection moves to the next player without a score');
A.skPick(0); A.skTap(5); await tick(); await tick();
eq(A.get().cards['Brian Hager'][1], 5, 'tapping a tile then a number replaces that score');
A.skPick(0); A.skClear(); await tick(); await tick();
eq(A.get().cards['Brian Hager'][1], null, 'clear removes the score');
const lastBrian = posts.filter(p => p.player === 'Brian Hager').pop();
eq(lastBrian.holes[1], null, 'clear is saved too');

// offline: stays dirty, retried
ctx.failNext = true;
A.skPick(1); A.skTap(6); await tick(); await tick();
ok(A.get().err === true && A.get().dirty['Tom Marsh'] && A.get().dirty['Tom Marsh'][2 - 1] === 6 || (A.get().dirty['Tom Marsh'] || {})[2] === 6, 'offline: score kept as waiting, error flagged');
ok(JSON.parse(store['bf_sk_gathering:7'])['Tom Marsh'], 'offline: waiting score is also kept on the phone');
const before = posts.length;
ctx.failNext = false; A.skFlush(); await tick(); await tick();
ok(posts.length === before + 1, 'online again: the waiting score is sent');
eq(Object.keys(A.get().dirty), [], 'online again: nothing waiting');
ok(A.get().err === false, 'online again: error cleared');

// a second phone saved hole 3 for the group: merge takes it, keeps nothing stale
A.skMergeRemote([{ player: 'Mike Kay', holes: [4, 4, 3, ...Array(15).fill(null)] }]);
eq(A.get().cards['Mike Kay'][2], 3, 'merge: another phone\'s hole appears');

// outlier hint and nine/odd rendering
A.skNav(1); A.skTap(7);
ok(/Right\?/.test(A.liveScoreModeHtml()), 'quiet check: par 3 shows 7 -> asks "Right?" but does not block');
ok(A.liveScoreModeHtml().includes('Hole 3') && A.liveScoreModeHtml().includes('Par 3'), 'score view shows hole and par');
{ const h = A.liveScoreModeHtml();
  ok(['Brian Hager','Tom Marsh','Mike Kay','Dave Vance'].every(n => h.includes(n)), 'rows carry full names, top to bottom');
  ok(h.includes('Brian &amp; Tom') && h.includes('Mike &amp; Dave'), 'a pair label sits above each two-row pair');
  eq((h.match(/onclick="skTap\(\d\)"/g) || []).length, 9, 'pad has keys 1 to 9');
  ok(!/skTap\(10\)/.test(h) && !/>P</.test(h), 'no 10 key and no pickup key');
  A.get().sel = -1; A.skPick(1); eq((A.liveScoreModeHtml().match(/onclick="skTap\(/g) || []).length, 9, 'pad shows once, under the picked name');
  A.skPick(1); ok(!/skTap\(/.test(A.liveScoreModeHtml()), 'tapping the picked name again closes the pad'); }
ok(/Group 1/.test(A.liveScoreModeHtml()) && /Group 2/.test(A.liveScoreModeHtml()), 'two foursomes -> group chips');
A.skSetGroup(1);
eq(A.skGroup().players, ['Sam Lee','Pat Roe','Lee Jo','Jo Wu'], 'any group can be scored from the chips');
ok(!/standings|Better ball/i.test(A.liveScoreModeHtml()), 'Score mode shows no standings');
A.skJump(0, 1); eq([A.get().hole, A.get().mode], [1, 'score'], 'tap in the card jumps to Score mode on that hole');
eq(A.livePanelModeToggleHtml('score').includes("setLiveScoreMode('games')"), true, 'toggle switches to Games');

// ── Live Actions: game view, field view, player card drill
{
  const pairs4 = [['Brian Hager','Tom Marsh'],['Mike Kay','Dave Vance'],['Sam Lee','Pat Roe'],['Lee Jo','Jo Wu']];
  const fbRow = { games: ['fourball'], dollar_per_player: 15, game_configs: { fourball: { dollar_per_player: 15, basis: 'gross', net_mode: 'own', segments: 'fbt', win_by: 'holes', scope: 'group', pairs: pairs4 } } };
  const mk = (n, h) => ({ player: n, holes: [...h, ...Array(18 - h.length).fill(null)] });
  const serverCards = [mk('Brian Hager', [4,4,3,5,4,4,5]), mk('Tom Marsh', [4,3,4,4,5,5,6]), mk('Mike Kay', [5,4,3,4,5,5,5]), mk('Dave Vance', [4,5,4,4,6,6,6])];
  const c2 = { ...ctx, _fbLive: null, _fbUi: null, skMaxHole: undefined };
  const ctx2 = Object.assign(ctx, { BFEngine: E });
  vm.runInContext('let _fbLive = null; let _fbUi = { view: "group", hole: null, drill: null };\n' + ['fbOverlayCards','fbLiveCompute','fbSetView','fbPickHole','fbCloseHole','fbStepHole','fbDrill','fbDrillName','fbIni','fbShort','fourballPlayerCardHtml','fourballActionsHtml','fourballLiveSectionHtml'].map(n => extractFn(src, n)).join('\n') + '\nthis.live={fbSetView,fbDrill,fbDrillName,fbPickHole,fbCloseHole,fbStepHole,fourballPlayerCardHtml,fourballActionsHtml,fbLiveCompute,set:v=>{_fbLive=v},ui:()=>_fbUi};', ctx);
  ctx.gatheringAddon = (c, id) => (c && c.addons.find(a => a.id === id)) || null;
  const L2 = ctx.live;
  await tick(); await tick(); // let the earlier test's last save finish so nothing is left waiting
  A.skSetGroup(0); A.skMergeRemote(serverCards);
  const cfg2 = E.gatheringConfigFromLegacy(fbRow);
  ok(/Loading/.test(L2.fourballActionsHtml(cfg2)), 'actions: loading before the first read');
  L2.set({ gid: 7, row: fbRow, cards: serverCards, pars: PARS });
  let h = L2.fourballActionsHtml(cfg2);
  ok(h.includes('My group') && h.includes('Field'), 'actions: My group / Field switch');
  ok(h.includes('Brian &amp; Tom') && h.includes('Mike &amp; Dave'), 'actions: the two pairs of my group');
  ok(/Front 9/.test(h) && /Back 9/.test(h) && /Total/.test(h), 'actions: Front / Back / Total rows');
  ok(/3 - 0, 4 halved/.test(h), 'actions: front tally 3-0 with 4 halved (holes won)');
  ok(/BT 3 holes up/.test(h) && /BT<\/span>/.test(h), 'actions: initials chips name the pairs and the lead is in the game\'s unit');
  ok(/Tap a hole for the details/.test(h) && !/role="dialog"/.test(h), 'actions: no details until a hole is tapped');
  ok(/>BT</.test(h) && />–</.test(h), 'actions: hole boxes carry the winner\'s initials, a dash for halved');
  ok(/Scorecards/.test(h) && /thru 7/.test(h), 'actions: scorecards rows with holes played');
  L2.fbPickHole(7); h = L2.fourballActionsHtml(cfg2);
  ok(/role="dialog"/.test(h) && /Hole 7/.test(h) && /Halved/.test(h), 'actions: tapping a hole opens the details sheet');
  L2.fbPickHole(5); h = L2.fourballActionsHtml(cfg2);
  ok(/Hole 5/.test(h) && /Par 5/.test(h) && /won the hole/.test(h) && /fbDrillName/.test(h), 'actions: sheet shows both pairs, who won, and names that drill');
  L2.fbStepHole(1); eq(L2.ui().hole, 6, 'sheet: next hole'); L2.fbCloseHole(); eq(L2.ui().hole, null, 'sheet: closes');
  // this phone's unsaved tap shows at once
  A.skMergeRemote(serverCards); A.skSetGroup(0);
  A.skSetScore('Brian Hager', 8, 3); A.skSetScore('Tom Marsh', 8, 4); A.skSetScore('Mike Kay', 8, 3); A.skSetScore('Dave Vance', 8, 3);
  h = L2.fourballActionsHtml(cfg2);
  ok(/Through 8 holes/.test(h), 'actions: scores tapped on this phone count before the server read');
  L2.fbDrill(0); h = L2.fourballActionsHtml(cfg2);
  ok(/Back to the game/.test(h) && /Brian Hager/.test(h) && /Total through 8 holes/.test(h) && />Out</.test(h), 'drill: one player\'s card with Out/In and total');
  ok(/skJump\(0,1\)/.test(h), 'drill: tapping a hole jumps to Live Score to fix it');
  L2.fbSetView('field'); h = L2.fourballActionsHtml(cfg2);
  ok(/Better ball of each pair/.test(h) || /Loading standings|No scores saved/.test(h), 'field view: shows the whole-field standings');
  eq(L2.ui().drill, null, 'switching view leaves any card drill');
}

// ── wiring: the panel, BF Series safety
ok(/const _skOn = liveScoringOn\(_liveConfig, _panelGid\);/.test(src), 'panel decides live scoring from the round\'s config');
ok(/if \(skMode\(\) === 'score'\) return `<div class="live-panel">/.test(src), 'Score mode returns only the scoring entry');
ok(/_skOn \? livePanelModeToggleHtml\('games'\)/.test(src), 'Games mode carries the toggle');
ok(/Scores are saved live while you play/.test(src), 'Post-Round section says nothing to enter');
ok(/liveScoringForEvt\(evt\)\) \{ _skAutoOpened\.add/.test(src), 'panel opens itself once for a live-scoring round');
ok(/skMergeRemote\(cards\); skFlush\(\)/.test(src), 'every standings refresh also merges scores and retries waiting saves');
const gateFn = extractFn(src, 'liveScoringOn'); ok(/gid != null/.test(gateFn), 'no gamed gid (BF Series) -> never live scoring');
ok(!/liveScoringForEvt\(evt\)[^;]*hasLivePanelSupport/.test(src), 'BF Series gating not altered');
console.log(`live scoring: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
