// GS field check (Dev-97): roster vs scorecards before the payout is fixed; no-shows can be removed, kept, or the action cancelled.
import fs from 'fs'; import { JSDOM } from 'jsdom';
import { extractFn } from './extract.mjs';
const src = fs.readFileSync(new URL('../BF_Golf_Scorer_8.html', import.meta.url), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const dom = new JSDOM(`<body><div id="player-list">
  <div id="player-row-1"><div class="player-grid"><input type="text" value="Ann"></div></div>
  <div id="player-row-2"><div class="player-grid"><input type="text" value="Bob"></div></div>
  <div id="player-row-3"><div class="player-grid"><input type="text" value="Cy"></div></div>
  <div id="player-row-4"><div class="player-grid"><input type="text" value="Di"></div></div></div>
  <table><tbody id="scorecard-body">${['Ann', 'Bob', 'Cy', 'Di'].map(n => `<tr><td><input type="number" data-player="${n}" data-hole="1" value="${n === 'Ann' || n === 'Bob' ? 2 : ''}"></td><td><input type="number" data-player="${n}" data-hole="2" value="${n === 'Ann' ? 1 : ''}"></td></tr>`).join('')}</tbody></table></body>`, { runScripts: 'outside-only' });
const w = dom.window;
w.eval(['gsFieldInfo', 'gsRemoveNoShows', 'gsFieldModal', 'gsFieldCheck', 'getScores'].map(n => extractFn(src, n)).join('\n') + `
var gsFieldAck = ''; var cachedPlayers = [{name:'Ann'},{name:'Bob'},{name:'Cy'},{name:'Di'}]; function updateTeePreview(){}
function getPlayers(){ return [...document.querySelectorAll('#player-list .player-grid input')].map(i => ({ name: i.value })); }`);
const tick = ms => new Promise(r => setTimeout(r, ms));
// pure check
let info = w.gsFieldInfo([{ name: 'Ann' }, { name: 'Bob' }, { name: 'Cy' }], { Ann: [0, 3], Bob: [], Cy: [null, null] });
ok(info.noShows.join() === 'Bob,Cy' && info.played === 1 && info.potAll === 60 && info.potPlayed === 20 && info.show, 'no-shows found, pot $60 with all vs $20 with those who played');
ok(!w.gsFieldInfo([{ name: 'Ann' }], { Ann: [] }).show, 'nobody has scores yet: not a field problem, no prompt');
ok(!w.gsFieldInfo([{ name: 'Ann' }, { name: 'Bob' }], { Ann: [1], Bob: [2] }).show, 'everyone has a scorecard: no prompt');
// Cancel
let p = w.gsFieldCheck('calculate results'); await tick(20);
const box = w.document.body.textContent;
ok(/Cy, Di/.test(box) && /\$80/.test(box) && /\$40/.test(box), 'the prompt names the no-shows and shows both pots ($80 roster, $40 played)');
w.document.getElementById('gsf-cancel').click(); ok((await p) === false, 'Cancel stops the action');
ok(w.document.querySelectorAll('#player-list .player-grid').length === 4, 'Cancel changes nothing');
// Keep: answered once per list
p = w.gsFieldCheck('save'); await tick(20); w.document.getElementById('gsf-keep').click(); ok((await p) === true, 'Keep continues');
p = w.gsFieldCheck('save'); const again = await Promise.race([p, tick(50).then(() => 'asked')]);
ok(again === true && !w.document.getElementById('gsf-keep'), 'the same list is not asked again');
// Remove
w.eval("gsFieldAck = ''");
p = w.gsFieldCheck('end'); await tick(20); w.document.getElementById('gsf-remove').click(); ok((await p) === true, 'Remove continues');
ok([...w.document.querySelectorAll('#player-list .player-grid input')].map(i => i.value).join() === 'Ann,Bob', 'no-shows removed from the roster');
ok([...w.document.querySelectorAll('#scorecard-body tr input[data-player]')].every(i => ['Ann', 'Bob'].includes(i.dataset.player)), 'and from the scorecard');
ok(w.eval('cachedPlayers.map(p=>p.name).join()') === 'Ann,Bob', 'and from the cached players');
ok((await w.gsFieldCheck('calculate')) === true && !w.document.getElementById('gsf-keep'), 'after removing them there is nothing to ask');
console.log(`gs_field_check: ${pass} pass, ${fail} fail`); process.exit(fail ? 1 : 0);
