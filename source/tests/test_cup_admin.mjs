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
ok([...d.querySelectorAll('.r-engine')][0].innerHTML.includes('cup_match'), 'section 4 offers the Team match play (Cup) engine');
ok(d.querySelector('.r-holes') && [...d.querySelector('.r-holes').options].map(o => o.value).join() === '18,f9,b9', 'section 4 has a Holes column (18 / Front 9 / Back 9)');
const rowsBefore = d.querySelectorAll('#roundsBody tr').length;
const setEngine = (tr, v) => { tr.querySelector('.r-engine').value = v; tr.querySelector('.r-engine').dispatchEvent(new w.Event('change', { bubbles: true })); };
const layout = (tr, v) => { tr.querySelector('.r-layout').value = v; tr.querySelector('.r-layout').dispatchEvent(new w.Event('change', { bubbles: true })); };
w.addRoundRow('BF Cup Sat'); w.addRoundRow('BF Cup Sun');
const all = [...d.querySelectorAll('#roundsBody tr')]; const sat = all[all.length - 2], sun = all[all.length - 1];
setEngine(sat, 'cup_match'); setEngine(sun, 'cup_match'); layout(sat, 'fb_fs'); layout(sun, 'si18'); await new Promise(r => setTimeout(r, 30));
ok(d.querySelectorAll('#roundsBody tr').length === rowsBefore + 2, 'Saturday and Sunday are each ONE round row');
const cupRows = [sat, sun];
ok(cupRows.every(tr => tr.querySelector('.r-wbpoints').disabled && !tr.querySelector('.r-overall').checked && tr.querySelector('.r-overall').disabled), 'Cup rows: Wally Ball and Overall are off and locked');
ok(cupRows.every(tr => tr.querySelector('.r-cup').style.display === 'block'), 'Cup rows show the segment editor');
ok(sat.querySelectorAll('.seg').length === 2 && sun.querySelectorAll('.seg').length === 1, 'Saturday has two segments, Sunday one');
ok([...sat.querySelectorAll('.sg-fmt')].map(e => e.value).join() === 'bestball,altshot' && [...sat.querySelectorAll('.sg-from')].map(e => e.value).join() === '1,10' && [...sat.querySelectorAll('.sg-to')].map(e => e.value).join() === '9,18', 'Saturday = Fourball 1-9 then Foursomes 10-18');
ok(d.querySelectorAll('.cup-round').length === 2, 'two Cup rounds listed in 4b, taken from section 4');
ok(/Fourball holes 1-9 \+ Foursomes holes 10-18/.test(d.querySelectorAll('.cup-round')[0].textContent) && /Singles holes 1-18/.test(d.querySelectorAll('.cup-round')[1].textContent), '4b shows each round\'s segments');
ok(!d.getElementById('cupAddPreset') && !d.querySelector('.r-cupsame'), '4b no longer asks for rounds a second time');
ok(/add the roster in section 3|players \(/.test(d.getElementById('cupSummary').textContent), 'summary describes the field (or asks for the roster)');
ok(/Name side A/.test(d.getElementById('cupSummary').textContent), 'asks for side names');
// the host edits a segment by hand: add one, change a hole, remove it
sat.querySelector('.r-addseg').click(); await new Promise(r => setTimeout(r, 20));
ok(sat.querySelectorAll('.seg').length === 3, '+ segment adds a segment');
sat.querySelectorAll('.seg')[2].querySelector('.sg-x').click(); await new Promise(r => setTimeout(r, 20));
ok(sat.querySelectorAll('.seg').length === 2, 'x removes a segment');
sat.querySelectorAll('.seg')[0].querySelector('.sg-to').value = '8'; sat.querySelectorAll('.seg')[0].querySelector('.sg-to').dispatchEvent(new w.Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 20));
ok(/holes 1-8/.test(d.querySelectorAll('.cup-round')[0].textContent), 'editing a segment\'s holes updates 4b');
sat.querySelectorAll('.seg')[0].querySelector('.sg-to').value = '9'; sat.querySelectorAll('.seg')[0].querySelector('.sg-to').dispatchEvent(new w.Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 20));
// renaming a round keeps it
sat.querySelector('.r-name').value = 'BF Cup Saturday'; sat.querySelector('.r-name').dispatchEvent(new w.Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 20));
const saved = w.readRoundsInput().filter(r => r.engine === 'cup_match');
ok(saved.length === 2 && saved[0].engineParams.cupSegments.length === 2 && saved[0].engineParams.cupSegments[1].format === 'altshot' && saved[1].engineParams.cupSegments[0].format === 'singles' && saved[0].engineParams.holes === undefined, 'section 4 config keeps the segments in engineParams (18 holes stays unstored)');
// reloading a saved event config puts the rounds and segments back
await w.rehydrateFormFromConfig({ eventName: '2026 BF Cup', roster: [], rounds: [
  { name: 'Saturday', engine: 'cup_match', engineParams: { cupSegments: [{ format: 'bestball', from: 1, to: 9 }, { format: 'altshot', from: 10, to: 18 }] } },
  { name: 'Sunday', engine: 'cup_match', engineParams: { cupSegments: [{ format: 'singles', from: 1, to: 18 }] } },
  { name: 'Old style', engine: 'cup_match', engineParams: { cupFormat: 'altshot', holes: { count: 9, half: 'back' } } }] });
await new Promise(r => setTimeout(r, 30));
ok(d.querySelectorAll('.cup-round').length === 3 && /Fourball holes 1-9 \+ Foursomes holes 10-18/.test(d.querySelectorAll('.cup-round')[0].textContent), 'a saved config reloads into section 4 and 4b with its segments');
ok(/Foursomes holes 10-18/.test(d.querySelectorAll('.cup-round')[2].textContent), 'an older single-format row still loads (its holes become the segment)');
w.removeLastForTest && 0;
[...d.querySelectorAll('#roundsBody tr')][2].querySelector('.removeRoundBtn').click(); await new Promise(r => setTimeout(r, 30));
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
ok(cfg.sides[0].name === 'Team Jake' && cfg.rounds.length === 2 && cfg.rounds[0].segments.length === 2 && cfg.rounds[0].segments[1].format === 'altshot' && cfg.rounds[1].segments[0].format === 'singles' && cfg.points.half === 0.5, 'document has sides, rounds with their segments, points');
// a second save from this page must not wipe what the draft page stored (draft + teams)
stored.draft = { started: true, picks: [{ n: 1, side: 'A', player: 'X' }] }; stored.sides[0].players = ['Cap', 'X'];
d.getElementById('cupSaveBtn').click(); await new Promise(r => setTimeout(r, 80));
const last = posts[posts.length - 1].body.config;
ok(last.draft && last.draft.picks.length === 1 && last.sides[0].players.join() === 'Cap,X', 'saving from BFE-Admin keeps the draft and the picked teams');
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
