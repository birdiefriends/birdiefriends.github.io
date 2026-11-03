// Dev-98 — the BF Cup "Handicaps" tab (real page in jsdom, fake Worker). Real Saturday record: Combo plays Green's hole handicaps, Gold keeps its own.
import fs from 'fs'; import { JSDOM } from 'jsdom'; import { fileURLToPath } from 'url';
const HERE = p => fileURLToPath(new URL(p, import.meta.url));
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const engine = fs.readFileSync(HERE('../bf_engine.js'), 'utf8');
const raw = fs.readFileSync(HERE('../../docs/bf-cup-draft.html'), 'utf8');
const page = raw.replace(/<script src="bf_engine.js[^>]*><\/script>/, '<script>' + engine + '</script>').replace(/<script src="bf_live_match.js[^>]*><\/script>/, '<script>' + fs.readFileSync(HERE('../../docs/bf_live_match.js'), 'utf8') + '</script>');
const DOC = {"sides":[{"key":"A","name":"Team Jake","captain":"Jake Knappenberger","color":"red","players":["Jake Knappenberger","Dave Sherwin","Mohamed Walli","Chooch Wernett","BJ Kolonia","Brian Hager","Adam Costa","Lou Strohl"]},{"key":"B","name":"Team Nate","captain":"Nate Stettler","color":"blue","players":["Nate Stettler","Jordan Knappenberger","Bill Steirer","Tom Stitt","Evan Lindermuth","Jeff Rapp","Andrew Kabrick","Harry Pry"]}],"points":{"win":1,"half":0.5,"loss":0},"handicap":{"bestball":80,"altshot":50,"singles":80,"slope":132,"rating":71.2,"par":71,"strokeIndex":[11,1,13,5,9,3,7,17,15,12,10,2,4,6,16,14,8,18],"pars":[4,4,3,4,5,4,5,3,4,3,5,4,4,4,3,4,5,3],"tiers":[{"tee":"Green","label":"Green","maxHcp":10,"slope":132,"rating":71.2,"par":71,"strokeIndex":[11,1,13,5,9,3,7,17,15,12,10,2,4,6,16,14,8,18],"pars":[4,4,3,4,5,4,5,3,4,3,5,4,4,4,3,4,5,3]},{"tee":"Green/Gold","label":"Combo","maxHcp":18,"slope":128,"rating":69,"par":71,"strokeIndex":[11,1,13,5,9,3,7,17,15,12,10,2,4,6,16,14,8,18],"pars":[4,4,3,4,5,4,5,3,4,3,5,4,4,4,3,4,5,3]},{"tee":"Gold","label":"Gold","maxHcp":null,"slope":115,"rating":66.8,"par":71,"strokeIndex":[9,1,13,3,7,5,11,15,17,8,16,2,6,4,14,12,10,18],"pars":[4,4,3,4,5,4,5,3,4,3,5,4,4,4,3,4,5,3]}]},"rounds":[{"key":"2026-bfcup-day1","segments":[{"key":"bestball-1-9","format":"bestball","from":1,"to":9},{"key":"altshot-10-18","format":"altshot","from":10,"to":18}],"matches":[{"key":"m1","sides":[{"side":"A","players":["Brian Hager","BJ Kolonia"]},{"side":"B","players":["Tom Stitt","Andrew Kabrick"]}]},{"key":"m2","sides":[{"side":"A","players":["Mohamed Walli","Jake Knappenberger"]},{"side":"B","players":["Bill Steirer","Jeff Rapp"]}]},{"key":"m3","sides":[{"side":"A","players":["Dave Sherwin","Chooch Wernett"]},{"side":"B","players":["Evan Lindermuth","Harry Pry"]}]},{"key":"m4","sides":[{"side":"A","players":["Adam Costa","Lou Strohl"]},{"side":"B","players":["Nate Stettler","Jordan Knappenberger"]}]}],"name":"2026 BFCup - Day1"}],"draft":{"started":true,"locked":true,"stats":{"Andrew Kabrick":{"hcp":13},"Bill Steirer":{"hcp":5.3},"Tom Stitt":{"hcp":12.8},"Nate Stettler":{"hcp":10.7},"Lou Strohl":{"hcp":14},"Jordan Knappenberger":{"hcp":3.8},"Evan Lindermuth":{"hcp":8.2},"Mohamed Walli":{"hcp":9.2},"Dave Sherwin":{"hcp":4.8},"Jake Knappenberger":{"hcp":12.7},"Chooch Wernett":{"hcp":9.5},"Adam Costa":{"hcp":16.2},"Brian Hager":{"hcp":6.8},"Jeff Rapp":{"hcp":10.9},"BJ Kolonia":{"hcp":14.1},"Rich Penberg":{"hcp":22.6},"Harry Pry":{"hcp":18.2}},"pool":[],"picks":[],"subs":["Rich Penberg"]}};
async function open(query, doc) {
  const fakeFetch = async () => ({ ok: true, status: 200, json: async () => ({ ok: true, config: JSON.parse(JSON.stringify(doc)) }) });
  const dom = new JSDOM(page, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://x.test/bf-cup-draft.html' + query, beforeParse(w) { w.fetch = fakeFetch; w.print = () => { w.__printed = true; }; } });
  await new Promise(r => setTimeout(r, 200)); return dom;
}
// the row of a person/pair in a match card: the holes that carry a stroke
const dotsOf = (d, matchNo, segTitle, who) => {
  const card = d.querySelectorAll('.hcpmatch')[matchNo - 1]; if (!card) return null;
  const tbl = [...card.querySelectorAll('table.hcpt')].find(t => t.querySelector('th.who').textContent.indexOf(segTitle) === 0); if (!tbl) return null;
  const heads = [...tbl.querySelectorAll('thead th')].map(x => x.textContent);
  const row = [...tbl.querySelectorAll('tbody tr')].find(r => r.querySelector('td.who b') && r.querySelector('td.who b').textContent === who); if (!row) return null;
  const cells = [...row.querySelectorAll('td.dt')];
  return { holes: cells.map((c, i) => c.classList.contains('on') ? Number(heads[i + 1]) : null).filter(Boolean), tot: row.querySelector('td.tot').textContent.replace(/\s+/g, ' ').trim() };
};
let dom = await open('?view=hcp', DOC), d = dom.window.document;
ok(/Handicaps/.test(d.querySelector('.hero').textContent), 'the stage reads Handicaps');
ok([...d.querySelectorAll('.toolbar button')].some(b => b.textContent === 'Handicaps' && !b.classList.contains('sec')), 'a Handicaps tab sits with Score, Leaderboard and Teams & draw and is the active one');
ok(d.querySelectorAll('.hcpmatch').length === 4, 'four Saturday matches are shown');
ok(d.querySelectorAll('.hcpmatch')[0].querySelectorAll('table.hcpt').length === 2, 'each match has a fourball and a foursomes table');
for (const n of ['Mohamed Walli', 'Jake Knappenberger', 'Jeff Rapp']) ok(dotsOf(d, 2, 'Fourball', n).holes.includes(6), n + ' has a stroke on hole 6');
ok(JSON.stringify(dotsOf(d, 2, 'Fourball', 'Bill Steirer').holes) === '[]', 'the low player gets no strokes');
ok(JSON.stringify(dotsOf(d, 1, 'Fourball', 'BJ Kolonia').holes) === '[2,4,6]' && dotsOf(d, 1, 'Fourball', 'BJ Kolonia').tot === '3', 'BJ: strokes on 2, 4, 6 (3 land on the front nine)');
ok(JSON.stringify(dotsOf(d, 4, 'Fourball', 'Adam Costa').holes) === '[2,4,5,6,7]', 'Adam (9 strokes) holes 2, 4, 5, 6, 7');
ok(JSON.stringify(dotsOf(d, 2, 'Foursomes', 'Mohamed & Jake').holes) === '[12,13]', 'Walli & Jake foursomes: holes 12 and 13');
ok(JSON.stringify(dotsOf(d, 3, 'Foursomes', 'Evan & Harry').holes) === '[12,14]', "Evan & Harry use Gold's own hole handicaps: holes 12 and 14");
ok(JSON.stringify(dotsOf(d, 4, 'Foursomes', 'Adam & Lou').holes) === '[12,13,14,17]' && dotsOf(d, 4, 'Foursomes', 'Adam & Lou').tot === '4', 'Adam & Lou: 4 strokes land on the back nine');
ok(/Fourball 80%/.test(d.querySelector('.hcpintro').textContent) && /Gold has its own hole handicaps/.test(d.querySelector('.hcpintro').textContent), 'the intro states the allowances and that Gold has its own holes');
ok(d.querySelectorAll('.hcpmatch .nm.cred').length === 4 && d.querySelectorAll('.hcpmatch .nm.cblue').length === 4, 'Team Jake pairs red, Team Nate pairs blue');
const d0 = d;
// labels: Index and course handicap on every player row; foursomes show the team average, not the sum
const subOf = (d, matchNo, segTitle, who) => { const card = d.querySelectorAll('.hcpmatch')[matchNo - 1]; const tbl = [...card.querySelectorAll('table.hcpt')].find(t => t.querySelector('th.who').textContent.indexOf(segTitle) === 0); const row = [...tbl.querySelectorAll('tbody tr')].find(r => r.querySelector('td.who b') && r.querySelector('td.who b').textContent === who); return row.querySelector('td.who .sub').textContent.replace(/\s+/g, ' ').trim(); };
ok(subOf(d0, 3, 'Fourball', 'Harry Pry') === 'Gold · Index 18.2 → course hcp 14', 'Harry: tee, Index and course handicap are all shown (got ' + subOf(d0, 3, 'Fourball', 'Harry Pry') + ')');
ok(subOf(d0, 3, 'Foursomes', 'Evan & Harry') === 'team hcp 12.0 (avg of 10 and 14)', 'foursomes show the team handicap as the average (got ' + subOf(d0, 3, 'Foursomes', 'Evan & Harry') + ')');
ok(subOf(d0, 3, 'Foursomes', 'Dave & Chooch') === 'team hcp 8.5 (avg of 6 and 11)', 'a half-point average is shown (got ' + subOf(d0, 3, 'Foursomes', 'Dave & Chooch') + ')');
ok(![...d0.querySelectorAll('.hcpt')].some(t => /combined/.test(t.textContent)), 'no "combined" sums left in the tables');
ok(!/ of \d/.test([...d0.querySelectorAll('td.tot')].map(c => c.textContent).join('|')), 'the strokes column shows only what lands on these holes, no "of N"');
ok(/Strokes this nine/.test(d0.querySelector('.hcpt th.tot').textContent), 'the column reads "Strokes this nine"');
d.getElementById('hcpPrint').click(); ok(dom.window.__printed === true, 'Print opens the print dialog');
ok(/@media print/.test(raw), 'print styles exist');
const doc2 = JSON.parse(JSON.stringify(DOC)); delete doc2.draft.stats['Harry Pry'];
dom = await open('?view=hcp', doc2); d = dom.window.document;
ok(/no handicap yet/.test(d.querySelectorAll('.hcpmatch')[2].textContent), 'a player with no handicap is flagged, not shown as zero strokes');
const doc3 = JSON.parse(JSON.stringify(DOC)); doc3.draft.locked = false;
dom = await open('?view=hcp', doc3); d = dom.window.document;
ok(![...d.querySelectorAll('.toolbar button')].some(b => b.textContent === 'Handicaps'), 'no Handicaps tab before the teams lock');
console.log(pass + ' passed' + (fail ? ', ' + fail + ' FAILED' : '')); process.exit(fail ? 1 : 0);
