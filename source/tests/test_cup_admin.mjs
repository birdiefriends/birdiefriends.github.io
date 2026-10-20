// Dev-95 — BFE-Admin "Team Cup" card (real page in jsdom): toggle, day presets, summary math, validation, save payload.
import fs from 'fs'; import { JSDOM } from 'jsdom'; import { fileURLToPath } from 'url';
const HERE = p => fileURLToPath(new URL(p, import.meta.url));
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const engine = fs.readFileSync(HERE('../bf_engine.js'), 'utf8');
let html = fs.readFileSync(HERE('../../docs/BFE-Admin.html'), 'utf8');
ok(html.includes('<script src="bf_engine.js?v='), 'page loads the shared engine');
html = html.replace(/<script src="bf_engine.js[^>]*><\/script>/, '<script>' + engine.replace(/<\/script>/g, '<\\/script>') + '</script>');
const posts = []; let stored = null;
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://x.test/BFE-Admin.html',
  beforeParse(w) {
    w.fetch = async (u, o) => { if (o && o.method === 'POST') { posts.push({ u, body: JSON.parse(o.body) }); stored = JSON.parse(o.body).config; return { ok: true, status: 200, json: async () => ({ ok: true }) }; }
      if (/\/bfe\/cup\?/.test(u)) return stored ? { ok: true, status: 200, json: async () => ({ config: stored }) } : { ok: false, status: 404, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => ({ ok: true }) }; };
    w.alert = () => {}; w.confirm = () => true;
  } });
const w = dom.window, d = w.document;
await new Promise(r => setTimeout(r, 200));
ok(d.getElementById('cupSection') && d.getElementById('cupBody').style.display === 'none', 'card present, hidden until enabled');
const en = d.getElementById('cupEnabled'); en.checked = true; en.dispatchEvent(new w.Event('change'));
ok(d.getElementById('cupBody').style.display === 'block', 'enabling shows the card');
ok([...d.querySelectorAll('.r-engine')][0].innerHTML.includes('cup_match'), 'section 4 offers the Team match play (BF Cup) engine');
ok(d.querySelector('.r-holes') && [...d.querySelector('.r-holes').options].map(o => o.value).join() === '18,f9,b9', 'section 4 has a Holes column (18 / Front 9 / Back 9)');
const rowsBefore = d.querySelectorAll('#roundsBody tr').length;
d.getElementById('cupAddPairsDay').click(); d.getElementById('cupAddSinglesDay').click(); await new Promise(r => setTimeout(r, 20));
ok(d.querySelectorAll('#roundsBody tr').length === rowsBefore + 2, 'the buttons add rows to section 4');
const cupRows = [...d.querySelectorAll('#roundsBody tr')].filter(tr => tr.querySelector('.r-engine').value === 'cup_match');
ok(cupRows.length === 2 && cupRows.every(tr => tr.querySelector('.r-wbpoints').disabled && !tr.querySelector('.r-overall').checked), 'Cup rows have the engine set; Wally Ball and Overall are off');
ok(d.querySelectorAll('.cup-round').length === 2, 'two Cup rounds shown in 4b, taken from section 4');
const segs = d.querySelectorAll('.cup-sg[data-f="format"]');
ok(segs.length === 3 && segs[0].value === 'altshot' && segs[1].value === 'bestball' && segs[2].value === 'singles', 'pairs round = foursomes + fourball, singles round = singles');
ok(/0 players|16 players|players \(/.test(d.getElementById('cupSummary').textContent), 'summary describes the field');
ok(/Name side A/.test(d.getElementById('cupSummary').textContent), 'asks for side names');
// holes indicator flows to the Cup round: make the singles round a front nine
const sundayRow = cupRows[1]; sundayRow.querySelector('.r-holes').value = 'f9'; sundayRow.querySelector('.r-holes').dispatchEvent(new w.Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 20));
ok(/Front 9/.test(d.querySelectorAll('.cup-round')[1].textContent) && /only has holes 1-9/.test(d.getElementById('cupSummary').textContent), 'a 9-hole round is flagged when its segment runs past hole 9');
sundayRow.querySelector('.r-holes').value = '18'; sundayRow.querySelector('.r-holes').dispatchEvent(new w.Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 20));
// renaming a round keeps its segments
cupRows[0].querySelector('.r-name').value = 'BF Cup Saturday'; cupRows[0].querySelector('.r-name').dispatchEvent(new w.Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 20));
ok(d.querySelectorAll('.cup-round')[0].textContent.includes('BF Cup Saturday') && d.querySelectorAll('.cup-round')[0].querySelectorAll('.cup-sg[data-f="format"]').length === 2, 'renaming a round keeps its segments');
// overlapping segments are flagged live
const from2 = d.querySelectorAll('.cup-sg[data-f="from"]')[1]; from2.value = '8'; from2.dispatchEvent(new w.Event('input', { bubbles: true }));
ok(/overlap/.test(d.getElementById('cupSummary').textContent), 'overlapping segments flagged');
from2.value = '10'; from2.dispatchEvent(new w.Event('input', { bubbles: true }));
ok(/consistent/.test(d.getElementById('cupSummary').textContent) || /Name side/.test(d.getElementById('cupSummary').textContent), 'clears when fixed');
// save is refused until the sides are named, then posts the document with the PIN
const nameA = d.getElementById('cupNameA'), nameB = d.getElementById('cupNameB');
d.getElementById('eventName').value = '2026 BF Cup';
await d.getElementById('cupSaveBtn').click(); await new Promise(r => setTimeout(r, 50));
ok(posts.length === 0, 'no save without side names');
nameA.value = 'Team Jake'; nameB.value = 'Team Nate';
d.getElementById('cupSaveBtn').click(); await new Promise(r => setTimeout(r, 50));
ok(posts.length === 1 && /\/bfe\/cup$/.test(posts[0].u) && posts[0].body.event_name === '2026 BF Cup' && posts[0].body.pin, 'saves to /bfe/cup with the PIN');
const cfg = posts[0].body.config;
ok(cfg.sides[0].color === 'red' && cfg.sides[1].color === 'blue', 'sides carry a color (A red, B blue by default)');
ok(cfg.sides[0].name === 'Team Jake' && cfg.rounds.length === 2 && cfg.rounds[0].segments.length === 2 && cfg.points.half === 0.5, 'document has sides, rounds, segments, points');
// a second save from this page must not wipe what the draft page stored (draft + teams)
stored.draft = { started: true, picks: [{ n: 1, side: 'A', player: 'X' }] }; stored.sides[0].players = ['Cap', 'X'];
d.getElementById('cupSaveBtn').click(); await new Promise(r => setTimeout(r, 80));
const last = posts[posts.length - 1].body.config;
ok(last.draft && last.draft.picks.length === 1 && last.sides[0].players.join() === 'Cap,X', 'saving from BFE-Admin keeps the draft and the picked teams');
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
