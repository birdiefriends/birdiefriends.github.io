// Dev-95 — the Score tab: pick your name, enter gross strokes, strokes by hole, match status, offline queue, round finish.
import fs from 'fs'; import { JSDOM } from 'jsdom'; import { fileURLToPath } from 'url';
const HERE = p => fileURLToPath(new URL(p, import.meta.url));
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const engine = fs.readFileSync(HERE('../bf_engine.js'), 'utf8');
const lm = fs.readFileSync(HERE('../../docs/bf_live_match.js'), 'utf8');
const page = fs.readFileSync(HERE('../../docs/bf-cup-draft.html'), 'utf8').replace(/<script src="bf_engine.js[^>]*><\/script>/, '<script>' + engine + '</script>').replace(/<script src="bf_live_match.js[^>]*><\/script>/, '<script>' + lm + '</script>');
const SI = [1,3,5,7,9,11,13,15,17,2,4,6,8,10,12,14,16,18];
let doc = { sides: [{ key: 'A', name: 'Team Jake', captain: 'Jake', players: ['Jake', 'Amy'] }, { key: 'B', name: 'Team Nate', captain: 'Nate', players: ['Nate', 'Bob'] }], points: { win: 1, half: 0.5, loss: 0 },
  handicap: { bestball: 100, altshot: 100, singles: 100, strokeIndex: SI },
  rounds: [{ key: 'r1', name: 'Saturday', holes: 18, segments: [{ key: 's1', format: 'bestball', from: 1, to: 9 }, { key: 's2', format: 'altshot', from: 10, to: 18 }],
    matches: [{ key: 'm1', sides: [{ side: 'A', players: ['Jake', 'Amy'] }, { side: 'B', players: ['Nate', 'Bob'] }] }] }],
  draft: { started: true, first: 'A', pool: [], stats: { Jake: { hcp: 10 }, Amy: { hcp: 14 }, Nate: { hcp: 6 }, Bob: { hcp: 8 } }, picks: [], locked: true }, matchup: { started: true, done: true, first: 'A', log: [] }, access: { A: 'AAA111', B: 'BBB222' } };
const posts = []; let offline = false;
const pub = () => { const c = JSON.parse(JSON.stringify(doc)); delete c.access; return c; };
const fakeFetch = async (u, o) => {
  const J = (x, status = 200) => ({ ok: status < 400, status, json: async () => x });
  if (offline) throw new Error('offline');
  if (/\/bfe\/cup\/act/.test(u)) {
    const b = JSON.parse(o.body); posts.push(b);
    if (b.action === 'score') { doc.scores = doc.scores || {}; const r = doc.scores[b.round] = doc.scores[b.round] || {}; const m = r[b.match] = r[b.match] || { h: {}, t: {}, by: {} }; m.h[String(b.hole)] = b.scores; m.t[String(b.hole)] = 'T'; doc.phases = doc.phases || {}; doc.phases['round_' + b.round + '_start'] = doc.phases['round_' + b.round + '_start'] || 'T'; }
    if (b.action === 'match_close') { doc.closed = doc.closed || {}; doc.closed[b.round] = doc.closed[b.round] || {}; doc.closed[b.round][b.match] = { how: b.how, side: b.side, by: 'host' }; }
    if (b.action === 'match_reopen') { delete doc.closed[b.round][b.match]; }
    if (b.action === 'round_end') { doc.phases = doc.phases || {}; doc.phases['round_' + b.round + '_end'] = 'T'; }
    return J({ ok: true, config: pub() });
  }
  return J({ ok: true, config: pub() });
};
const tick = (ms = 80) => new Promise(r => setTimeout(r, ms));
async function open(query) {
  const dom = new JSDOM(page, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://x.test/bf-cup-draft.html' + query, beforeParse(w) { w.fetch = fakeFetch; w.confirm = () => true; } });
  await tick(150); return dom;
}
const click = async (dom, sel, n = 0) => { const el = dom.window.document.querySelectorAll(sel)[n]; if (!el) throw new Error('missing ' + sel); el.click(); await tick(120); };
let dom = await open('?player=Amy'); let d = dom.window.document;
ok(d.getElementById('lmMount') && /Hole 1/.test(d.body.textContent), 'locked teams with matches open on the Score tab');
ok(/Fourball/.test(d.body.textContent) && /stroke index 1/.test(d.body.textContent), 'segment and stroke index shown');
ok(!/★/.test(d.querySelector('#lmMatchSel').textContent) && d.querySelector('#lmMeSel').value === 'Amy' && d.querySelectorAll('#lmMeSel option').length === 5 && !d.querySelector('.lmtab'), 'a match dropdown (no star) and an I-am list narrowed to the four in the match');
ok(d.querySelectorAll('.lmchip').length === 4 && d.querySelectorAll('.lmt').length === 9, 'fourball: four player chips, ONE set of number tiles (for the player picked)');
ok(d.querySelectorAll('.lmdots').length >= 3 && !d.querySelector('.lmholes'), 'handicap strokes shown as dots on hole 1 (SI 1)');
// Jake birdie (3), others par: tap − on Jake
ok(d.getElementById('lmPost').disabled && /Tap 4 more/.test(d.getElementById('lmPost').textContent), 'no default score: Post is locked until every player is tapped');
await click(dom, '[data-lm-s="Jake|3"]'); await click(dom, '[data-lm-s="Amy|4"]'); await click(dom, '[data-lm-s="Nate|4"]'); d = dom.window.document;
ok(d.getElementById('lmPost').disabled && /Tap 1 more/.test(d.getElementById('lmPost').textContent), 'still locked with one missing');
await click(dom, '[data-lm-s="Bob|4"]'); d = dom.window.document;
ok(/>3</.test(d.querySelectorAll('.lmcv')[0].outerHTML) && !d.getElementById('lmPost').disabled, 'one tap sets a score and unlocks Post');
await click(dom, '#lmPost'); d = dom.window.document;
ok(/Match 1 · hole 1: Team Jake wins the hole/.test(d.querySelector('.lm').textContent) && /Team Jake 1 UP \(Fourball/.test(d.querySelector('.lm').textContent), 'after posting, a banner says who won the hole and the match score');
ok(posts.length === 1 && posts[0].action === 'score' && posts[0].hole === 1 && posts[0].scores.Jake === 3 && posts[0].scores.Bob === 4 && posts[0].player === 'Amy', 'post sends all four grosses and who posted');
ok(/Hole 2/.test(d.body.textContent), 'moves on to the next hole');
ok(/Team Jake 1 UP.*thru 1/.test(d.querySelector('.lmstat').textContent), 'status line (got ' + d.querySelector('.lmstat').textContent + ')');
await click(dom, '#lmAll'); ok(dom.window.document.querySelector('.lmh.a'), 'hole 1 colored for the winning side'); await click(dom, '#lmAll');
// pickup + an offline hole is queued
offline = true;
await click(dom, '[data-lm-s="Jake|4"]'); await click(dom, '[data-lm-s="Amy|4"]'); await click(dom, '[data-lm-s="Nate|0"]'); await click(dom, '[data-lm-s="Bob|0"]'); await click(dom, '#lmPost'); d = dom.window.document;
ok(/waiting to send/.test(d.querySelector('.lm').textContent), 'offline: the hole is queued, not lost');
ok(/Team Jake 2 UP.*thru 2/.test(d.querySelector('.lmstat').textContent), 'queued hole already counts on screen (got ' + d.querySelector('.lmstat').textContent + ')');
offline = false; const before = posts.length; await tick(6500);
ok(posts.length === before + 1 && !/waiting to send/.test(dom.window.document.querySelector('.lm').textContent), 'back online: the queue drains');
// edit an old hole
await click(dom, '#lmAll'); ok(dom.window.document.querySelectorAll('.lmh').length === 18, 'tap the hole title to see all 18'); await click(dom, '[data-lm-hole="1"]'); d = dom.window.document; ok(/Hole 1/.test(d.body.textContent) && /posted/.test(d.body.textContent) && />3</.test(d.querySelectorAll('.lmcv')[0].outerHTML), 'tap a hole to review/edit it');
// stranger sees the panel but is not asked as a player; identity picker
dom = await open(''); d = dom.window.document; ok(d.getElementById('lmMeSel') && d.getElementById('lmMount'), 'a name picker is offered');
ok(d.getElementById('lmPost').disabled && /Pick who you are/.test(d.getElementById('lmPost').textContent), 'no name picked: Post says so instead of failing silently');
dom = await open('?player=Amy'); d = dom.window.document;
ok(/Match 1 · hole 1: Team Jake wins the hole/.test(d.querySelector('.lm').textContent) === false, 'banner only after posting in this visit');
await click(dom, '#lmAll'); await click(dom, '[data-lm-hole="10"]'); d = dom.window.document;
ok(d.querySelectorAll('.lmchip').length === 2 && /Foursomes/.test(d.querySelector('.lm').textContent) && /team gross/.test(d.querySelector('.lm').textContent), 'hole 10: two team chips and a team-gross note');
ok(/Holes 1–9: Fourball · Holes 10–18: Foursomes/.test(d.querySelector('.lm').textContent), 'the round plan is shown');
dom = await open('?player=Amy'); d = dom.window.document;
ok(!!d.querySelector('.lmt[data-lm-s$="|1"]') && !/9\+/.test(d.querySelector('.lm').textContent), 'a 1 tile for the hole-in-one, no 9+');
await click(dom, '[data-view="board"]'); d = dom.window.document;
ok(/POINTS/.test(d.querySelector('.lm').textContent) && !d.querySelector('.lmchip'), 'Leaderboard tab: points race, no score entry');
ok(/Fourball · 1–9/.test(d.querySelector('.lm').textContent) && /Foursomes · 10–18/.test(d.querySelector('.lm').textContent), 'each match shows both parts');
ok(/2 UP/.test(d.querySelector('.lm').textContent) && /thru 2/.test(d.querySelector('.lm').textContent), 'live part shows who is up (got ' + d.querySelector('.lm').textContent.slice(0, 300) + ')');
await click(dom, '[data-lm-open]'); d = dom.window.document;
ok(!!d.querySelector('table.lmsc') && !d.querySelector('.lmchip') && /Scorecard|scorecard/.test(d.querySelector('.lm').textContent), 'tap a match on the leaderboard opens its scorecard in place (stays on the leaderboard)');
ok(!!d.querySelector('.lmsc tr.mr') && !!d.querySelector('[data-lm-score]'), 'scorecard has the running match row and a way to go score');
await click(dom, '[data-lm-score]'); d = dom.window.document;
ok(!!d.querySelector('.lmchip'), 'Enter or correct scores jumps to the Score tab');
// match / round closing: host and captains only
dom = await open('?player=Jake'); d = dom.window.document;
ok(!d.querySelector('[data-lm-close]') && !d.getElementById('lmFinish') && /finishes by itself/.test(d.querySelector('.lm').textContent), 'a player sees no close buttons, and the round finishes by itself');
dom = await open('?cap=AAA111&player=Jake'); d = dom.window.document;
ok(d.querySelectorAll('[data-lm-close]').length === 4 && d.getElementById('lmFinish'), 'a captain can close a match (as it stands / either side concedes / halved) and finish early');
await click(dom, '[data-lm-close^="concede|B"]'); d = dom.window.document;
const mc = posts.filter(p => p.action === 'match_close').pop();
ok(mc && mc.how === 'concede' && mc.side === 'B' && mc.match === 'm1' && mc.code === 'AAA111', 'the concession is posted with the captain code');
ok(/Closed by host: Team Nate conceded/.test(d.querySelector('.lm').textContent) && d.querySelector('[data-lm-mreopen]'), 'the panel shows who closed it and offers Reopen');
ok(posts.some(p => p.action === 'round_end' && p.round === 'r1') , 'with every match closed the round ends by itself');
await click(dom, '[data-lm-mreopen]'); ok(posts.some(p => p.action === 'match_reopen'), 'a captain can reopen the match');
// finished matches show a result, not an entry form; the panel opens on the next unfinished match
doc.closed = { r1: { m1: { how: 'concede', side: 'B', by: 'host' } } };
doc.rounds[0].matches.push({ key: 'm2', sides: [{ side: 'A', players: ['Tom', 'Lou'] }, { side: 'B', players: ['Bill', 'BJ'] }] });
doc.draft.stats.Tom = { hcp: 9 }; doc.draft.stats.Lou = { hcp: 12 }; doc.draft.stats.Bill = { hcp: 7 }; doc.draft.stats.BJ = { hcp: 15 };
dom = await open('?player=Amy'); d = dom.window.document;
ok(d.getElementById('lmMatchSel').value === 'r1|g2', 'Amy\'s match is finished, so the panel opens on the next one still to play (got ' + d.getElementById('lmMatchSel').value + ')');
ok(d.querySelectorAll('optgroup').length === 1 && /Fourball \+ Foursomes/.test(d.querySelector('optgroup').label) && /final/.test(d.querySelector('#lmMatchSel').textContent), 'matches are grouped by round with their format and status');
d.getElementById('lmMatchSel').value = 'r1|g1'; d.getElementById('lmMatchSel').dispatchEvent(new dom.window.Event('change')); await tick(100); d = dom.window.document;
ok(/Match complete/.test(d.querySelector('.lm').textContent) && !d.querySelector('.lmchip') && d.getElementById('lmEdit') && /Conceded/.test(d.querySelector('.lm').textContent), 'a finished match shows its result, no entry form');
await click(dom, '#lmEdit'); ok(!!dom.window.document.querySelector('.lmchip'), 'Correct a score brings the entry back');
console.log('score page: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
