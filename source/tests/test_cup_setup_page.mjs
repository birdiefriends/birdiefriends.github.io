// Dev-95 — draft page setup: every button commits the player box first, the roster loads from the event (BFE-Admin), and the page shows what it has.
import fs from 'fs'; import { JSDOM } from 'jsdom'; import { fileURLToPath } from 'url';
const HERE = p => fileURLToPath(new URL(p, import.meta.url));
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const engine = fs.readFileSync(HERE('../bf_engine.js'), 'utf8');
const page = fs.readFileSync(HERE('../../docs/bf-cup-draft.html'), 'utf8').replace(/<script src="bf_engine.js[^>]*><\/script>/, '<script>' + engine + '</script>').replace(/<script src="bf_live_match.js[^>]*><\/script>/, '<script>' + fs.readFileSync(HERE('../../docs/bf_live_match.js'), 'utf8') + '</script>');
let doc = { sides: [{ key: 'A', name: 'Team Jake', captain: 'Jake K', color: 'red', players: [] }, { key: 'B', name: 'Team Nate', captain: 'Nate S', color: 'blue', players: [] }], points: { win: 1, half: 0.5, loss: 0 }, rounds: [], draft: { started: false, pool: [], stats: {}, picks: [] } };
const calls = [];
const fakeFetch = async (u, o) => {
  const J = (x, status = 200) => ({ ok: status < 400, status, json: async () => x }); calls.push(u);
  if (/\/bfe\/players/.test(u)) return J({ ok: true, players: [{ name: 'Ann Lee', current_hcp: 9.1 }, { name: 'Bob Roe', current_hcp: 14 }] });
  if (/\/bfe\/events\?event=/.test(u)) return /Empty/.test(u) ? J({ ok: true, config: { roster: [] } }) : J({ ok: true, config: { roster: [{ name: 'Ann Lee', hcp: 9.1 }, { name: 'Bob Roe', hcp: 14 }, { name: 'Cy Doe', hcp: null }, { name: 'Jake K', hcp: 6 }] } });
  if (o && o.method === 'POST') { const b = JSON.parse(o.body); if (b.pin !== '7797') return J({ error: 'Unauthorized' }, 403); doc = b.config; return J({ ok: true }); }
  return J({ ok: true, config: JSON.parse(JSON.stringify(doc)) });
};
const tick = (ms = 100) => new Promise(r => setTimeout(r, ms));
async function open(query) {
  const dom = new JSDOM(page, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://x.test/bf-cup-draft.html' + query, beforeParse(w) { w.fetch = fakeFetch; w.sessionStorage.setItem('bf_cup_pin', '7797'); w.confirm = () => true; } });
  await tick(150); return dom;
}
let dom = await open('?host=1&event=2026%20BirdieFriends%20Cup%20(practice)'); let d = dom.window.document;
// the unsaved-box trap: type names, press Fill handicaps without pressing Save first
d.getElementById('poolTxt').value = 'Ann Lee\nBob Roe\nCy Doe'; d.getElementById('fillHcp').click(); await tick(200); d = dom.window.document;
ok(doc.draft.pool.join() === 'Ann Lee,Bob Roe,Cy Doe' && doc.draft.stats['Ann Lee'].hcp === 9.1, 'Fill handicaps saves the typed list first, then fills (no separate Save needed)');
ok(/Handicaps filled for 2 of 3/.test(d.body.textContent), 'and says how many it filled');
ok(/Ann Lee/.test(d.body.textContent) && /9.1/.test(d.body.textContent) && d.body.textContent.includes('Players and stats so far'), 'a table shows each player with the handicap it has');
// load from the event roster (practice copy reads the REAL event's roster)
d.getElementById('poolTxt').value = 'Someone Else'; d.getElementById('loadRoster').click(); await tick(200); d = dom.window.document;
ok(calls.some(u => /bfe\/events\?event=2026%20BirdieFriends%20Cup$/.test(u)), 'a practice copy reads the roster of the real event (name without "(practice)")');
ok(doc.draft.pool.join() === 'Ann Lee,Bob Roe,Cy Doe,Jake K' && doc.draft.stats['Jake K'].hcp === 6 && doc.draft.stats['Cy Doe'] === undefined, 'the pool becomes the event roster, handicaps come with it, a missing handicap stays missing');
ok([...d.querySelectorAll('.banner')].some(b => /Loaded 4 players .* \(3 with a handicap\)/.test(b.textContent)), 'the result is shown in a banner at the top');
ok(/Cy Doe/.test(d.body.textContent) && d.querySelector('td[style*="--bad"]'), 'a player without a handicap shows in red');
// stats with an empty box explains itself
d.getElementById('statsApply').click(); await tick(); d = dom.window.document;
ok(/Paste the stats table/.test(d.body.textContent), 'Apply stats with nothing pasted says what to do');
// an event with no roster says so
dom = await open('?host=1&event=Empty'); d = dom.window.document; d.getElementById('loadRoster').click(); await tick(200); d = dom.window.document;
ok(/has no roster saved yet/.test(d.body.textContent), 'an event without a roster explains how to save one');

// opening the host screen for a real (non-practice) event fills the roster, handicaps and series stats by itself
doc.draft.pool = []; doc.draft.stats = {}; doc.draft.started = false; calls.length = 0;
dom = await open('?host=1&event=Real%20Cup'); d = dom.window.document; await tick(300); d = dom.window.document;
ok(calls.some(u => /bfe\/events\?event=Real%20Cup$/.test(u)) && calls.some(u => /results\.html/.test(u)), 'host screen reads the roster and the series data on open, no button');
ok(doc.draft.pool.length >= 2 && doc.draft.stats['Ann Lee'] && doc.draft.stats['Ann Lee'].hcp === 9.1, 'the pool and handicaps are filled and saved');
ok(/automatically/.test(d.body.textContent), 'and it says so');
doc.draft.pool = ['Keep Me']; calls.length = 0; dom = await open('?host=1&event=Real%20Cup'); await tick(300);
ok(doc.draft.pool.join() === 'Keep Me', 'an existing player list is never replaced by the automatic load');
console.log(`test_cup_setup_page: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
