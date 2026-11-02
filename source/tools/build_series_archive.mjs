import fs from 'fs'; import vm from 'vm';
import { extractFn } from '../tests/extract.mjs';
const R = new URL('../../', import.meta.url).pathname;
const src = fs.readFileSync(R + 'source/BF_Golf_Scorer_8.html', 'utf8');
const resHtml = fs.readFileSync(R + 'docs/results.html', 'utf8');
const sd = JSON.parse(resHtml.match(/const ALL_SERIES_DATA = (\{[\s\S]*?\});\s*\n/)[1]);
const ver = (src.match(/GS_VERSION = '([^']*)'/) || [])[1];
const ctx = { GS_VERSION: ver, Date, Math, console, JSON, Object, Array, String, Number, Set }; vm.createContext(ctx);
let code = ''; for (const n of ['gsPotNormalize','gsSeasonPotHTML','computeSeasonPot','calcSeriesPerformance','buildRetroactiveE1Event','generateSeriesPage','generateMyGamePage']) { try { code += extractFn(src, n) + '\n'; } catch (e) { console.log('missing', n); } }
vm.runInContext(src.match(/const GS_POT_DEFAULTS = .*;/)[0] + '\n' + code + '; this.S = generateSeriesPage; this.M = generateMyGamePage;', ctx);
const fin = JSON.parse(JSON.stringify(sd)); fin.potSettings = { ante: 20, overallPct: 0.39, placePct: [0.5,0.3,0.2], flights: ['Green','Combo','Gold'], final: true };
const pages = {
  wrap: fs.readFileSync(R + 'docs/series-2026-wrap.html', 'utf8'),
  standings: ctx.S('2026', fin),
  results: resHtml,
  mygame: ctx.M('2026', fin),
};
const hook = `<style>a[href*="ARCHIVE"],a[href="/portal.html"]{display:none!important}</style><script>document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a');if(!a)return;var h=a.getAttribute('href')||'';var m={'/standings.html':'standings','/results.html':'results','/mygame.html':'mygame','/series-2026-wrap.html':'wrap'}[h];if(m){e.preventDefault();parent.showTab(m);}else if(h.charAt(0)==='/'){e.preventDefault();}});<\/script>`;
const pack = h => (h.includes('</body>') ? h.replace('</body>', hook + '</body>') : h + hook).replace(/<\/script/gi, '<\\/script');
const tabs = [['wrap', "That's a Wrap"], ['standings', 'Standings'], ['results', 'Series #10 Results'], ['mygame', 'My Series']];
const dataJson = JSON.stringify(fin).replace(/<\/script/gi, '<\\/script');
const out = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>BirdieFriends 2026 Championship Series · Archive</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}html,body{height:100%}
body{display:flex;flex-direction:column;background:#063d31;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#fff}
.bar{padding:10px 14px 0;text-align:center}
.bar h1{font-family:Georgia,serif;font-style:italic;font-weight:400;font-size:1.15rem;color:#e2c97e}
.bar p{font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;opacity:.65;margin-top:2px}
.tabs{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;padding:10px 10px 10px}
.tabs button{border:1.5px solid rgba(226,201,126,.4);background:transparent;color:#e2c97e;padding:6px 14px;border-radius:20px;font-weight:600;font-size:.8rem;cursor:pointer}
.tabs button.on{background:#e2c97e;color:#063d31}
.tabs a,.tabs .dl{color:#e2c97e;font-size:.75rem;text-decoration:underline;align-self:center;cursor:pointer;margin-left:6px}
iframe{flex:1;border:0;width:100%;background:#f7f6f2;display:none}
iframe.on{display:block}
.foot{font-size:.62rem;text-align:center;opacity:.5;padding:4px}
</style></head><body>
<div class="bar"><h1>BirdieFriends 2026 Championship Series</h1><p>Final archive &middot; ${sd.events.length} events &middot; kept for posterity</p></div>
<div class="tabs">${tabs.map(([k, l], i) => `<button data-t="${k}" class="${i ? '' : 'on'}" onclick="showTab('${k}')">${l}</button>`).join('')}<span class="dl" onclick="dlData()">Download season data (JSON)</span></div>
${tabs.map(([k], i) => `<iframe id="f-${k}" class="${i ? '' : 'on'}"></iframe>`).join('\n')}
<div class="foot">Generated ${new Date().toISOString().slice(0, 10)} from GS ${ver} &middot; self-contained: all pages and data are inside this one file</div>
${tabs.map(([k]) => `<script type="text/plain" id="p-${k}">${pack(pages[k])}</script>`).join('\n')}
<script type="text/plain" id="season-data">${dataJson}</script>
<script>
var loaded={};
function unesc(t){return t.replace(/<\\\\\\/script/gi,'</script');}
function showTab(k){
  document.querySelectorAll('.tabs button').forEach(function(b){b.classList.toggle('on',b.dataset.t===k);});
  document.querySelectorAll('iframe').forEach(function(f){f.classList.toggle('on',f.id==='f-'+k);});
  if(!loaded[k]){loaded[k]=1;document.getElementById('f-'+k).srcdoc=unesc(document.getElementById('p-'+k).textContent);}
}
function dlData(){var t=unesc(document.getElementById('season-data').textContent);var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([t],{type:'application/json'}));a.download='birdiefriends-2026-series-data.json';document.body.appendChild(a);a.click();a.remove();}
showTab('wrap');
</script></body></html>`;
fs.writeFileSync(R + 'docs/bf-series-2026-ARCHIVE.html', out);
console.log('archive bytes', out.length);
