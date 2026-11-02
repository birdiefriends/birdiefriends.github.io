// GS Season Pot settings screen (real GS page in jsdom): load/save per season, validation, preview, and the published page uses the saved settings.
import fs from 'fs'; import { JSDOM } from 'jsdom';
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const html = fs.readFileSync(new URL('../BF_Golf_Scorer_8.html', import.meta.url), 'utf8');
const ev = (n, q, a) => ({ eventName: 'E' + n, hcp: 10, quota: q, actual: a, result: a - q });
const mkP = (n, flight, base) => [n, { tee: flight, seriesFlight: flight, events: [1, 2, 3, 4].map(i => ev(i, 30, 30 + base)) }];
const names = []; const ph = {};
[['Green', 6, 8], ['Combo', 6, 5], ['Gold', 3, 2]].forEach(([fl, n, b]) => { for (let i = 0; i < n; i++) { const [k, v] = mkP(fl.slice(0, 2) + i, fl, b - i * 0.3); ph[k] = v; } });
const series = { seasons: { 2026: { events: [1, 2, 3, 4].map(i => ({ name: 'E' + i, date: '2026-0' + i + '-01', scores: {}, ctp: {}, skins: [] })), playerHistory: ph } } };
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost:8743/BF_Golf_Scorer_8.html',
  beforeParse(w) { w.fetch = async () => ({ ok: false, status: 404, json: async () => ({}), text: async () => '' }); w.alert = () => {}; w.confirm = () => true;
    try { w.localStorage.setItem(w.eval ? 'x' : 'x', ''); } catch (e) {} w.__series = series; } });
const w = dom.window; const d = w.document; const tick = ms => new Promise(r => setTimeout(r, ms));
await tick(300);
const key = w.eval('SERIES_STORAGE_KEY'); w.localStorage.setItem(key, JSON.stringify(series));
w.loadSeriesStandings(); await tick(50);
ok(d.getElementById('pot-ante').value === '20' && d.getElementById('pot-overall').value === '40', 'the screen opens with the defaults ($20, Overall 40%)');
ok([...d.querySelectorAll('.pot-place')].map(i => i.value).join() === '50,30,20,,', 'places 50 / 30 / 20, 4th and 5th blank');
ok([...d.querySelectorAll('.pot-flight')].every(c => c.checked), 'all three flights are on');
ok(/\$/.test(d.getElementById('pot-preview').textContent) && /Overall/.test(d.getElementById('pot-preview').textContent), 'a preview with the current standings is shown');
// invalid save is refused and nothing is stored
d.getElementById('pot-overall').value = '150'; w.gsPotSave();
ok(/Overall % must be/.test(d.getElementById('pot-settings-status').textContent) && !JSON.parse(w.localStorage.getItem(key)).seasons[2026].potSettings, 'an invalid form is refused and not saved');
// valid change: $25, Overall 30, places 60/40, Green + Gold
d.getElementById('pot-ante').value = '25'; d.getElementById('pot-overall').value = '30';
const pl = [...d.querySelectorAll('.pot-place')]; ['60', '40', '', '', ''].forEach((v, i) => { pl[i].value = v; });
[...d.querySelectorAll('.pot-flight')].forEach(c => { c.checked = c.value !== 'Combo'; });
w.gsPotSave();
const saved = JSON.parse(w.localStorage.getItem(key)).seasons[2026].potSettings;
ok(saved && saved.ante === 25 && Math.abs(saved.overallPct - 0.3) < 1e-9 && saved.placePct.join() === '0.6,0.4' && saved.flights.join() === 'Green,Gold', 'saved with the season data');
ok(/Saved for 2026/.test(d.getElementById('pot-settings-status').textContent), 'confirms the save and says to publish');
// reload the screen: the saved settings come back
d.getElementById('pot-ante').value = '99'; w.loadSeriesStandings();
ok(d.getElementById('pot-ante').value === '25' && d.getElementById('pot-overall').value === '30', 'reopening the screen shows the saved settings');
// the published page uses them
const page = w.generateSeriesPage('2026', JSON.parse(w.localStorage.getItem(key)).seasons[2026]);
const potTab = page.slice(page.indexOf('id="tab-pot"'));
ok(/15 qualified players &times; \$25 = <strong>\$375/.test(potTab) && /Overall gets 30%/.test(potTab) && /Green, Gold share the other 70%/.test(potTab) && !/>Combo</.test(potTab.slice(0, potTab.indexOf('How it works'))), 'the published Season Pot tab uses $25, 30% Overall, Green + Gold only');
// FINAL label
ok(/projected/.test(potTab.slice(0, 400)) && !/FINAL/.test(potTab.slice(0, 400)), 'not marked final: the published pot says projected');
d.getElementById('pot-final').checked = true; w.gsPotSave();
const pageF = w.generateSeriesPage('2026', JSON.parse(w.localStorage.getItem(key)).seasons[2026]);
ok(/FINAL<\/strong>/.test(pageF.slice(pageF.indexOf('id="tab-pot"'), pageF.indexOf('id="tab-pot"') + 400)), 'ticking Season is over labels the published pot FINAL');
// reset
w.gsPotReset();
ok(d.getElementById('pot-ante').value === '20' && !JSON.parse(w.localStorage.getItem(key)).seasons[2026].potSettings, 'Reset goes back to the defaults and clears the saved settings');
const page2 = w.generateSeriesPage('2026', JSON.parse(w.localStorage.getItem(key)).seasons[2026]);
ok(/Overall gets 40%/.test(page2), 'and the published page is back to the defaults');
console.log(`gs_pot_settings_ui: ${pass} pass, ${fail} fail`); process.exit(fail ? 1 : 0);
