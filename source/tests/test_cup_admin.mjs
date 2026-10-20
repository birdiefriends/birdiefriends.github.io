// Dev-95 — BFE-Admin "Team Cup" card (real page in jsdom): toggle, day presets, summary math, validation, save payload.
import fs from 'fs'; import { JSDOM } from 'jsdom'; import { fileURLToPath } from 'url';
const HERE = p => fileURLToPath(new URL(p, import.meta.url));
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const engine = fs.readFileSync(HERE('../bf_engine.js'), 'utf8');
let html = fs.readFileSync(HERE('../../docs/BFE-Admin.html'), 'utf8');
ok(html.includes('<script src="bf_engine.js?v='), 'page loads the shared engine');
html = html.replace(/<script src="bf_engine.js[^>]*><\/script>/, '<script>' + engine.replace(/<\/script>/g, '<\\/script>') + '</script>');
const posts = [];
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://x.test/BFE-Admin.html',
  beforeParse(w) {
    w.fetch = async (u, o) => { if (o && o.method === 'POST') posts.push({ u, body: JSON.parse(o.body) }); return { ok: true, status: 200, json: async () => ({ ok: true }) }; };
    w.alert = () => {}; w.confirm = () => true;
  } });
const w = dom.window, d = w.document;
await new Promise(r => setTimeout(r, 200));
ok(d.getElementById('cupSection') && d.getElementById('cupBody').style.display === 'none', 'card present, hidden until enabled');
const en = d.getElementById('cupEnabled'); en.checked = true; en.dispatchEvent(new w.Event('change'));
ok(d.getElementById('cupBody').style.display === 'block', 'enabling shows the card');
d.getElementById('cupAddPairsDay').click(); d.getElementById('cupAddSinglesDay').click();
ok(d.querySelectorAll('.cup-round').length === 2, 'two days added');
const segs = d.querySelectorAll('.cup-sg[data-f="format"]');
ok(segs.length === 3 && segs[0].value === 'altshot' && segs[1].value === 'bestball' && segs[2].value === 'singles', 'pairs day = foursomes + fourball, singles day = singles');
ok(/0 players|16 players|players \(/.test(d.getElementById('cupSummary').textContent), 'summary describes the field');
ok(/Name side A/.test(d.getElementById('cupSummary').textContent), 'asks for side names');
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
ok(cfg.sides[0].name === 'Team Jake' && cfg.rounds.length === 2 && cfg.rounds[0].segments.length === 2 && cfg.points.half === 0.5, 'document has sides, rounds, segments, points');
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
