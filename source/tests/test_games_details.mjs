// Dev-88 — the event card's new 🏆 Games icon (read-only pot breakdown, any
// registered player, live or not — Brian: "players will want to know the
// game before heading to the course") and the rail's Games button removal
// (it only ever opened the Live Panel, which the card's header already
// does — dropped "to conserve space"). Covers: real execution of
// gatheringGameDetailsBody/openGameDetailsModal against a config shaped
// like Brian's actual live round ("$2/cttp, $2BF-ball, balance in skins"),
// and structural checks that the card's Games icon is NOT a Gaming-Mode-only
// icon (unlike Photo/Score/Notes — it has to work pre-round too) and that
// the rail no longer has a Games button or an atCourseOpenGames function at
// all.
import fs from 'fs'; import vm from 'vm'; import { JSDOM } from 'jsdom';
import { extractFn, loadEngine } from './extract.mjs';
import { fileURLToPath } from 'url';
const HERE = (p) => fileURLToPath(new URL(p, import.meta.url));
const src = fs.readFileSync(HERE('../portal.html'), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const E = loadEngine();

// 1) Structural — atCourseOpenGames is gone entirely (not just unwired), and
// the rail's own markup never mentions a Games button any more.
ok(!/function atCourseOpenGames/.test(src), 'atCourseOpenGames function removed entirely, not just unwired');
const railSrc = extractFn(src, 'renderAtCourseRail');
ok(!railSrc.includes('Games') && !railSrc.includes('atCourseOpenGames'), 'rail markup has no Games button left');

// 2) Structural — the card's Games icon gates on gatheringIsGamed(...) alone,
// not on getLiveEvent()/_livePanelOpen the way Photo/Score/Notes do: it has
// to be visible in BOTH Gaming Mode and Non-gaming Mode.
const cardRowMatch = src.match(/<div class="icon-action-row" style="justify-content:flex-start;gap:26px;margin:10px 4px 2px">[\s\S]*?<div id="\$\{whoId\}"/);
ok(!!cardRowMatch, 'found the live event card icon-action-row block');
const cardRow = cardRowMatch ? cardRowMatch[0] : '';
const gamesIconMatch = cardRow.match(/\$\{gatheringIsGamed\(evtGamesConfig\(evt\)\) \? `[\s\S]*?openGameDetailsModal\('\$\{evt\.id\}'\)[\s\S]*?`\s*:\s*eventAddGamesBtnHtml\(evt, isCanceled\)\}/);
ok(!!gamesIconMatch, 'Games icon present, gated on gatheringIsGamed(evtGamesConfig(evt)) alone');
ok(gamesIconMatch && !gamesIconMatch[0].includes('getLiveEvent') && !gamesIconMatch[0].includes('_livePanelOpen'), 'Games icon gate does NOT reference getLiveEvent/_livePanelOpen — stays up whether or not this is the live round');

// 3) Real execution — gatheringGameDetailsBody / openGameDetailsModal against
// a config shaped exactly like Brian's real round: $2/player, cttp $2/hole
// over 4 holes, birdieball $2/player, skins gets the remainder.
function setup() {
  const dom = new JSDOM('<body><div id="game-details-title"></div><div id="game-details-body"></div></body>');
  const opened = [];
  const row = {
    games: ['skins', 'cttp', 'birdieball'],
    dollar_per_player: 2,
    cttp_config: { dollar_per_hole: 2, holes: [3, 7, 12, 16] },
    birdieball_config: { dollar_per_player: 2 },
  };
  const gatheringId = 77;
  const evt = { id: 'gathering-77', name: 'Golf More, Work Less', source: 'gathering', gatheringId };
  const ctx = {
    document: dom.window.document, console, Math, Number, String, Array, Object, JSON,
    BFEngine: E,
    regData: [
      { gatheringId, player: 'Brian Hager', status: 'Yes' },
      { gatheringId, player: 'Scott Justus', status: 'Yes' },
      { gatheringId, player: 'Tony Choy', status: 'Yes' },
      { gatheringId, player: 'Chooch Wernett', status: 'Yes' },
      { gatheringId, player: 'Rich Potts', status: 'No' }, // shouldn't count
    ],
    eventData: [evt],
    _gatheringGamesIndex: new Map([[gatheringId, row]]),
    openModal: (id) => opened.push(id),
  };
  vm.createContext(ctx); ctx.GAME_INFO = { skins: 'x', cttp: 'x', birdieball: 'x', birdiepay: 'x' }; 
  const fns = ['gameInfoBtnHtml','gameInfoPanelHtml','gatheringRoundConfig', 'evtGamesConfig', 'gamesGidFor', 'eventShadowFor', 'eventLocalDay', 'eventGamesRef', 'gatheringIsGamed', 'gatheringAddon', 'gatheringGameDetailsBody', 'openGameDetailsModal'];
  vm.runInContext(fns.map(n => extractFn(src, n)).join('\n') + '\nvar _eventShadows = new Map();', ctx);
  return Object.assign(ctx, { opened, evt });
}

let c = setup();
c.openGameDetailsModal('gathering-77');
ok(c.opened.includes('game-details-modal'), 'openModal called with the right id');
const title = c.document.getElementById('game-details-title').textContent;
ok(title.includes('Golf More, Work Less'), 'modal title carries the event name');
const body = c.document.getElementById('game-details-body').innerHTML;
// 4 confirmed Yes (Rich Potts is a No, excluded) × $2/player = $8 total pot
ok(body.includes('4 confirmed Yes') && body.includes('$8.00 total pot'), `pot totals correct (yesCount excludes No): ${body.slice(0, 200)}`);
// CTP: 4 holes × $2/hole = $8 pot
ok(body.includes('4 holes') && body.includes('$2.00/hole') && body.includes('$8.00 pot'), 'CTP breakdown correct');
// BirdieBall: $2/player × 4 confirmed = $8 pot
ok(body.includes('$2.00/player') && (body.match(/\$8\.00 pot/g) || []).length >= 2, 'BirdieBall breakdown correct (also $8 pot, same math as CTP here)');
// Skins gets what's left: $8 total - $8 CTP - $8 BB = -$8 → clamped to $0
ok(body.includes('Gets what’s left: $0.00 pot') || body.includes("Gets what's left: $0.00 pot"), 'Skins remainder clamped at $0 when carve-outs exceed the pot (informational, matches the Host Panel preview’s own math)');

// 4) openGameDetailsModal is a no-op (guard) for a non-gamed event — the
// calling icon is already gated on gatheringIsGamed, but the function
// itself shouldn't blow up or open the modal if ever called for one anyway.
c = setup();
c.eventData.push({ id: 'evt-ungamed', name: 'Casual Nine', source: 'gathering', gatheringId: 999 });
c.openGameDetailsModal('evt-ungamed');
ok(c.opened.length === 0, 'no-op for an ungamed event — modal never opens');

// 4) Dev-91 — Gross/Net shown on the card's Games details
{
  const n = setup(); n.escapeHtml = v => String(v);
  const SI = [7,11,15,1,5,9,3,17,13, 12,6,2,10,4,18,8,14,16];
  const base = { games: ['skins', 'birdiepay'], dollar_per_player: 10, birdiepay_config: { dollar_per_birdie: 2, pars: [4,4,3,4,5,4,5,3,4,3,5,4,4,4,3,4,5,3] } };
  const modal = row => { n._gatheringGamesIndex.set(77, row); n.openGameDetailsModal(n.evt); return n.document.getElementById('game-details-body').innerHTML; };
  const gross = modal(base);
  ok(/Skins · Gross/.test(gross) && /Birdie Payouts · Gross/.test(gross), 'gross games are labelled Gross');
  ok(!/Handicap strokes/.test(gross), 'no strokes row on a gross round');
  const net = modal({ ...base, handicap_config: { allowance: 95, skins_basis: 'net', birdiepay_basis: 'gross', stroke_index: SI,
    players: { 'Brian Hager': { kind: 'index', strokes: 8, stroke_index: SI }, 'Muna Aliya': { kind: 'given', strokes: 20, stroke_index: SI } } } });
  ok(/Skins · Net/.test(net) && /Lowest net score wins/.test(net), 'Skins labelled Net');
  ok(/Birdie Payouts · Gross/.test(net), 'Birdie Payouts can stay Gross while Skins is Net');
  ok(/openStrokeCard\('gathering-77'\)/.test(net) && /Course with strokes/.test(net) && /openVenueViewerModal\('gathering-77'\)/.test(net), 'strokes row offers Strokes by hole + Course with strokes');
  ok(/Handicap strokes/.test(net) && /95% allowance/.test(net) && /Brian Hager <b>8<\/b>/.test(net) && /Muna Aliya <b>20<\/b>/.test(net), 'strokes row lists every player and the allowance');
  const both = modal({ ...base, handicap_config: { allowance: 95, skins_basis: 'net', birdiepay_basis: 'net', stroke_index: SI, players: { A: { kind: 'given', strokes: 18, stroke_index: SI } } } });
  ok(/Birdie Payouts · Net/.test(both) && /every net birdie/.test(both), 'Birdie Payouts labelled Net with net wording');
}

console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
