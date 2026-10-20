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
d.getElementById('cupPreset').value='pairsFS'; d.getElementById('cupAddPreset').click(); d.getElementById('cupPreset').value='singles'; d.getElementById('cupAddPreset').click(); await new Promise(r => setTimeout(r, 20));
ok(d.querySelectorAll('#roundsBody tr').length === rowsBefore + 3, 'Saturday = two session rows (foursomes + fourball), Sunday = one singles row');
const cupRows = [...d.querySelectorAll('#roundsBody tr')].filter(tr => tr.querySelector('.r-engine').value === 'cup_match');
ok(cupRows.length === 3 && cupRows.every(tr => tr.querySelector('.r-wbpoints').disabled && !tr.querySelector('.r-overall').checked && tr.querySelector('.r-overall').disabled), 'Cup rows: Wally Ball and Overall are off and locked');
ok(cupRows.every(tr => tr.querySelector('.r-cup').style.display === 'block'), 'Cup rows show the format and same-pairs pickers');
ok(cupRows.map(tr => tr.querySelector('.r-cupfmt').value).join() === 'altshot,bestball,singles', 'formats: foursomes, fourball, singles');
ok(cupRows.map(tr => tr.querySelector('.r-holes').value).join() === 'f9,b9,18', 'holes: front 9, back 9, 18');
ok(d.querySelectorAll('.cup-round').length === 3, 'three Cup sessions shown in 4b, taken from section 4');
ok(/Foursomes · holes 1-9/.test(d.querySelectorAll('.cup-round')[0].textContent) && /Fourball · holes 10-18/.test(d.querySelectorAll('.cup-round')[1].textContent) && /Singles · holes 1-18/.test(d.querySelectorAll('.cup-round')[2].textContent), 'each session shows its format and hole range');
ok(/same pairs as Cup Foursomes/.test(d.querySelectorAll('.cup-round')[1].textContent), 'the second nine reuses the first nine\'s pairs');
ok(/add the roster in section 3|players \(/.test(d.getElementById('cupSummary').textContent), 'summary describes the field (or asks for the roster)');
ok(/Name side A/.test(d.getElementById('cupSummary').textContent), 'asks for side names');
// the host changes a session's holes: the 4b range follows
cupRows[2].querySelector('.r-holes').value = 'f9'; cupRows[2].querySelector('.r-holes').dispatchEvent(new w.Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 20));
ok(/holes 1-9/.test(d.querySelectorAll('.cup-round')[2].textContent), 'changing Holes in section 4 changes the session\'s holes');
cupRows[2].querySelector('.r-holes').value = '18'; cupRows[2].querySelector('.r-holes').dispatchEvent(new w.Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 20));
// renaming a session keeps the same-pairs link
cupRows[0].querySelector('.r-name').value = 'BF Cup Saturday A'; cupRows[0].querySelector('.r-name').dispatchEvent(new w.Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 20));
ok(/same pairs as BF Cup Saturday A/.test(d.querySelectorAll('.cup-round')[1].textContent), 'renaming a session keeps the same-pairs link');
const saved = w.readRoundsInput().filter(r => r.engine === 'cup_match');
ok(saved.length === 3 && saved[0].engineParams.cupFormat === 'altshot' && saved[0].engineParams.holes.half === 'front' && saved[1].engineParams.cupSameAs === 'BF Cup Saturday A' && saved[2].engineParams.holes === undefined, 'section 4 config keeps format, holes and same-pairs in engineParams (18 holes stays unstored)');
// reloading a saved event config puts the Cup sessions back, with their same-pairs link
await w.rehydrateFormFromConfig({ eventName: '2026 BF Cup', roster: [], rounds: [
  { name: 'Sat Foursomes', engine: 'cup_match', engineParams: { cupFormat: 'altshot', holes: { count: 9, half: 'front' } } },
  { name: 'Sat Fourball', engine: 'cup_match', engineParams: { cupFormat: 'bestball', cupSameAs: 'Sat Foursomes', holes: { count: 9, half: 'back' } } },
  { name: 'Sun Singles', engine: 'cup_match', engineParams: { cupFormat: 'singles' } }] });
await new Promise(r => setTimeout(r, 30));
ok(d.querySelectorAll('.cup-round').length === 3 && /same pairs as Sat Foursomes/.test(d.querySelectorAll('.cup-round')[1].textContent) && /Fourball · holes 10-18/.test(d.querySelectorAll('.cup-round')[1].textContent), 'a saved config reloads into section 4 and 4b with formats, holes and the same-pairs link');
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
ok(cfg.sides[0].name === 'Team Jake' && cfg.rounds.length === 3 && cfg.rounds[0].segments[0].format === 'altshot' && cfg.rounds[1].sameAs === cfg.rounds[0].key && cfg.points.half === 0.5, 'document has sides, sessions (one segment each), same-pairs link, points');
// a second save from this page must not wipe what the draft page stored (draft + teams)
stored.draft = { started: true, picks: [{ n: 1, side: 'A', player: 'X' }] }; stored.sides[0].players = ['Cap', 'X'];
d.getElementById('cupSaveBtn').click(); await new Promise(r => setTimeout(r, 80));
const last = posts[posts.length - 1].body.config;
ok(last.draft && last.draft.picks.length === 1 && last.sides[0].players.join() === 'Cap,X', 'saving from BFE-Admin keeps the draft and the picked teams');
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
