import fs from 'fs'; import vm from 'vm'; import { JSDOM } from 'jsdom'; import { extractFn, loadEngine } from './extract.mjs';
import { fileURLToPath } from 'url';
const HERE = (p) => fileURLToPath(new URL(p, import.meta.url));
const src = fs.readFileSync(HERE('../portal.html'), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const fns = ['escapeHtml','evtPhotoKey','computeGatheringGamesPayout','latestScorecardPerPlayer','scorecardMissingHoles','renderGatheringPayoutHtml','openGatheringCloseSheet','confirmGatheringClose','loadHistoryGameResults','reopenGatheringGames','openModal','closeModal'];
function setup({ player = 'Brian Hager', status = 'open', hostId = 'Brian Hager', agedOut = false } = {}) {
  const dom = new JSDOM(`<body><div id="gathering-close-modal"><div id="gathering-close-body"></div></div><div id="history-game-results"></div></body>`);
  const posts = []; const toasts = [];
  const cfg = { gathering_id: 42, gathering_name: 'Jefferson Event', host_id: hostId, status, games: ['skins','cttp','birdieball'], dollar_per_player: 20,
    cttp_config: { dollar_per_hole: 10, holes: [3, 7] }, birdieball_config: { dollar_per_player: 2 }, payout_summary: null };
  const h = o => Array(18).fill(5).map((v, i) => o[i + 1] ?? v);
  const ctx = {
    document: dom.window.document, console, Promise, JSON, Math, Number, String, Set, Map, Array, Object, Date, encodeURIComponent,
    BFEngine: loadEngine(), currentPlayer: player, BFE_API: 'https://bfe', GATHERINGS_API: 'https://push',
    gatheringData: agedOut ? [] : [{ gatheringId: 42, hostId, name: 'Jefferson Event', source: 'gathering', holes: 18 }],
    eventData: agedOut ? [] : [{ source: 'gathering', gatheringId: 42, name: 'Jefferson Event' }],
    gatheringRegData: agedOut ? [] : ['Brian Hager','Scott Justus','Tony Choy','No Show'].map(p => ({ gatheringId: 42, player: p, status: 'Yes' })).concat([{ gatheringId: 42, player: 'Nope', status: 'No' }]),
    _ctpData: {}, showToast: (m, e) => toasts.push([m, !!e]),
    loadCtpData: async (evt) => { ctx._ctpLoadedFor = evt.name; ctx._ctpData = { 3: { player: 'Scott Justus', dist: 8 } }; },
    refreshGatheringGamesIndex: async () => { ctx._refreshed = (ctx._refreshed || 0) + 1; },
    fetch: async (url, opts) => {
      if (opts && opts.method === 'POST') { posts.push([url, JSON.parse(opts.body)]); return { json: async () => ({ ok: true }) }; }
      if (url.includes('/bfe/gathering-games?gathering_id=')) return { json: async () => ({ ok: true, config: ctx._cfg }) };
      if (url.includes('/scorecards?event=')) { ctx._scUrl = url; return { json: async () => ({ ok: true, scorecards: [
        { player: 'Brian Hager', holes: h({ 1: 4 }) }, { player: 'Brian Hager', holes: h({ 1: 3 }) }, // newer (4) first — older 3 must be ignored
        { player: 'Scott Justus', holes: h({ 2: 3 }) }, { player: 'Tony Choy', holes: Object.assign(h({}), { 4: null }) } ] }) }; }
      if (url.includes('/birdieball-answers')) return { json: async () => ({ ok: true, answers: [{ player_name: 'Tony Choy', kept: true }] }) };
      throw new Error('unexpected ' + url);
    }
  };
  ctx._cfg = cfg; ctx.posts = posts; ctx.toasts = toasts;
  vm.createContext(ctx);
  vm.runInContext(fns.map(n => extractFn(src, n)).join('\n') + '\nvar _gcClose = null;', ctx);
  return ctx;
}
// 1. Host opens sheet: scorecard check, missing/incomplete warnings, preview
let c = setup();
await c.openGatheringCloseSheet(42);
const body = c.document.getElementById('gathering-close-body').innerHTML;
ok(c.document.getElementById('gathering-close-modal').classList.contains('open'), 'modal opened');
ok(c._scUrl.endsWith('event=gathering%3A42'), 'scorecards fetched by gathering key: ' + c._scUrl);
ok(c._ctpLoadedFor === 'Jefferson Event', 'CTP leaders loaded via loadCtpData');
ok(body.includes('Scorecards in: 3 of 4 confirmed'), 'count uses Yes only, deduped cards');
ok(body.includes('No scorecard yet: <b>No Show</b>'), 'missing player flagged');
ok(body.includes('Blank holes') && body.includes('Tony Choy') && body.includes('#5'), 'incomplete card flagged');
ok(body.includes('Close with 3 players'), 'close button reflects N');
const s = c._gcClose.summary;
ok(s.players_count === 3 && s.total_pot === 60, 'pot 3x20');
ok(JSON.stringify(s.skins.won.map(w => [w.hole, w.player, w.strokes])) === JSON.stringify([[1,'Brian Hager',4],[2,'Scott Justus',3]]), 'latest Brian card (4 on #1, not older 3) used: ' + JSON.stringify(s.skins.won));
ok(s.birdieball.winners.join() === 'Tony Choy' && s.birdieball.per_winner === 6, 'BB kept');
// 2. Confirm close posts snapshot + meta, refreshes index
await c.confirmGatheringClose();
ok(c.posts.length === 1 && c.posts[0][0] === 'https://bfe/bfe/gathering-games/42/close', 'close route');
const pl = c.posts[0][1];
ok(pl.host_id === 'Brian Hager' && pl.payout_summary.players_count === 3 && pl.payout_summary.missing_scorecards.join() === 'No Show' && pl.payout_summary.closed_by === 'Brian Hager', 'payload');
ok(c._refreshed === 1 && !c.document.getElementById('gathering-close-modal').classList.contains('open'), 'index refreshed, modal closed');
// 3. Non-host blocked
c = setup({ player: 'Scott Justus' });
await c.openGatheringCloseSheet(42);
ok(c.toasts[0] && c.toasts[0][1] && c.fetch && !c._scUrl, 'non-host refused before any fetch');
// 4. My History: closed → rendered; host sees Reopen, non-host doesn't; open → empty
c = setup({ status: 'closed' }); c._cfg.payout_summary = pl.payout_summary;
await c.loadHistoryGameResults('gathering:42');
let hr = c.document.getElementById('history-game-results').innerHTML;
ok(hr.includes('Game Results') && hr.includes('$60 pot') && hr.includes('Scott Justus'), 'history shows results');
ok(hr.includes('Reopen'), 'host sees reopen');
c = setup({ status: 'closed', player: 'Tony Choy' }); c._cfg.payout_summary = pl.payout_summary;
await c.loadHistoryGameResults('gathering:42');
hr = c.document.getElementById('history-game-results').innerHTML;
ok(hr.includes('Game Results') && !hr.includes('Reopen'), 'player sees results, no reopen');
c = setup({ status: 'open' });
await c.loadHistoryGameResults('gathering:42');
ok(c.document.getElementById('history-game-results').innerHTML.includes('Games still open'), 'open gathering, host → Close entry (v4.6.2; was: nothing shown)');
await c.loadHistoryGameResults('Some Series Event');
ok(true, 'non-gathering key no-op');
// 5. Reopen
c = setup({ status: 'closed' });
await c.reopenGatheringGames(42);
ok(c.posts[0][0] === 'https://bfe/bfe/gathering-games/42/reopen' && c.posts[0][1].host_id === 'Brian Hager' && c._refreshed === 1, 'reopen posts + refreshes');
// 6. XSS: player names escaped in rendered output
const x = setup(); const html = x.renderGatheringPayoutHtml(x.computeGatheringGamesPayout({ games: ['skins'], dollar_per_player: 5 },
  [{ player: '<img src=x>', holes: [3,4] }, { player: 'B', holes: [4,4] }], {}, []));
ok(!html.includes('<img') && html.includes('&lt;img'), 'names escaped');
// ── v4.6.2 fix #2: My History is the host's Close entry point once the Live Panel is gone
c = setup({ status: 'open' });
await c.loadHistoryGameResults('gathering:42');
hr = c.document.getElementById('history-game-results').innerHTML;
ok(hr.includes('Games still open') && hr.includes('openGatheringCloseSheet(42)'), 'open + host → Close & Calculate in My History');
c = setup({ status: 'open', player: 'Tony Choy' });
await c.loadHistoryGameResults('gathering:42');
ok(c.document.getElementById('history-game-results').innerHTML === '', 'open + non-host → nothing');
// Aged-out Gathering (not in gatheringData/eventData/RSVPs): host still closes via config
c = setup({ agedOut: true });
await c.openGatheringCloseSheet(42);
let b2 = c.document.getElementById('gathering-close-body').innerHTML;
ok(b2.includes('Scorecards in: 3</div>') && b2.includes('Close with 3 players'), 'aged-out: count-only status line, closable: ' + b2.slice(0, 120));
ok(c._ctpLoadedFor === 'Jefferson Event', 'aged-out: CTP loaded via config-built evt');
await c.confirmGatheringClose();
ok(c.posts[0] && c.posts[0][1].payout_summary.gathering_name === 'Jefferson Event', 'aged-out: gathering_name from config');
c = setup({ agedOut: true, player: 'Tony Choy' });
await c.openGatheringCloseSheet(42);
ok(c.document.getElementById('gathering-close-body').innerHTML.includes('Only the host') && !c._gcClose, 'aged-out non-host refused via config host_id');
// Closing from My History refreshes the slot in place
c = setup({ status: 'open' });
await c.openGatheringCloseSheet(42);
c._cfg.status = 'closed';
const _origFetch = c.fetch;
await c.confirmGatheringClose();
c._cfg.payout_summary = c.posts[0][1].payout_summary;
await new Promise(r => setTimeout(r, 0)); await c.loadHistoryGameResults('gathering:42');
ok(c.document.getElementById('history-game-results').innerHTML.includes('Game Results'), 'after close, slot shows results');
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
