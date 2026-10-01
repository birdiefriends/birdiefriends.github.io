import fs from 'fs'; import vm from 'vm'; import { JSDOM } from 'jsdom'; import { extractFn } from './extract.mjs';
import { fileURLToPath } from 'url';
const HERE = (p) => fileURLToPath(new URL(p, import.meta.url));
const src = fs.readFileSync(HERE('../portal.html'), 'utf8');
const tees = JSON.parse(fs.readFileSync(HERE('./moselem_tees.json'), 'utf8')).map((t, i) => ({ ...t, source: 'gc_api', updated_at: '2026-09-24 15:06:50', locked: i === 2 }));
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const dom = new JSDOM('<div id="admin-gc-stored-3"></div><div id="venue-viewer-body"></div>');
const ctx = { document: dom.window.document, Math, Number, String, Array, JSON, Object };
vm.createContext(ctx);
const consts = src.match(/const TEE_COLORS = \{[\s\S]*?\};/)[0];
vm.runInContext(consts + '\n' + ['escapeHtml','teeSwatchCss','teeHeaderColor','venueViewerDefaultTee','venueScorecardHtml','venueTeeSummaryHtml','storedVenueTeesHtml','adminSelectVenueTee','renderVenueViewer','selectVenueViewerTee','venueViewerStrokeInfo'].map(n => extractFn(src, n)).join('\n') +
  `\nvar _adminVenueTees = {}, _adminVenueTeeSel = {}, _venueViewerVenue = { id: 3, name: 'Moselem', lat: 40.5, lng: -75.8 }, _venueViewerTees = [], _venueViewerTeeSel = {}, _venueViewerEvt = null, _venueViewerStrokePlayer = null, evtGamesConfig = () => null, currentPlayer = 'Brian Hager'; // Dev-91: net strokes hooks (gross = null)`, ctx);
const run = (code) => vm.runInContext(code, ctx);
ok(run(`storedVenueTeesHtml({id:3})`).includes('Loading stored tees'), 'loading state');
run(`_adminVenueTees[3] = []`); ok(run(`storedVenueTeesHtml({id:3})`).includes('No tees stored'), 'empty state');
run(`_adminVenueTees[3] = ${JSON.stringify(tees)}`);
let h = run(`storedVenueTeesHtml({id:3})`);
ok(h.includes('id="admin-tee-sel-3"') && h.includes('adminSelectVenueTee(3, this.value)'), 'admin select wired per venue');
ok(/<option value="6" selected/.test(h), 'defaults to median men\'s tee (Blue/White)');
ok(h.includes('adminDeleteVenueTee(3, 6)'), 'Delete targets the selected tee');
ok(h.includes('4 tees stored') && h.includes('GolfCourseAPI') && h.includes('2026-09-24'), 'footer: count/source/date');
ok(h.includes('>OUT<') && h.includes('>TOT<') && h.includes('>HCP<'), 'scorecard grid present');
ok(h.includes('Green (M) — 6,808 yds 🔒'), 'locked tee flagged in dropdown');
run(`document.getElementById('admin-gc-stored-3').innerHTML = storedVenueTeesHtml({id:3}); adminSelectVenueTee(3, '4')`);
h = dom.window.document.getElementById('admin-gc-stored-3').innerHTML;
ok(h.includes('adminDeleteVenueTee(3, 4)') && h.includes('manually edited'), 'select Green in place → Delete retargets, lock badge shows');
ok(h.includes('73.1') && h.includes('136'), 'stat strip follows selection');
// deleted-tee fallback
run(`_adminVenueTees[3] = _adminVenueTees[3].filter(t => t.id !== 4)`);
h = run(`storedVenueTeesHtml({id:3})`); ok(/<option value="6" selected/.test(h), 'selected tee deleted → falls back to default');
// player viewer still works through the shared renderer
run(`_venueViewerTees = ${JSON.stringify(tees)}; renderVenueViewer(); selectVenueViewerTee('5')`);
h = dom.window.document.getElementById('venue-viewer-body').innerHTML;
ok(h.includes('id="venue-viewer-tee"') && h.includes('Open in Maps') && h.includes('71.6') && !h.includes('Delete'), 'viewer: own select, Maps, no Delete');
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
