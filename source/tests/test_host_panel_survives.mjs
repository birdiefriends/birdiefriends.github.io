// The header Gatherings icon must keep working after an option sheet opens/closes or a round is deleted.
import fs from 'fs'; import vm from 'vm'; import { JSDOM } from 'jsdom'; import { fileURLToPath } from 'url';
import { extractFn } from './extract.mjs';
const src = fs.readFileSync(fileURLToPath(new URL('../portal.html', import.meta.url)), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const dom = new JSDOM(`<body><div class="host-sheet-overlay" id="host-sheet-overlay"><div class="host-sheet-title"></div></div></body>`);
const ctx = { console, document: dom.window.document, currentPlayer: 'Brian Hager', loadVenues() {}, loadHostTemplates: async () => {}, loadHostGamesConfigs: async () => {}, loadHostSpots: async () => {}, renderHostPanelList() {} };
vm.createContext(ctx);
vm.runInContext(['openHostSheet', 'closeHostSheet', 'openHostPanel', 'closeHostPanel'].map(n => extractFn(src, n)).join('\n') + '\nthis.f={openHostSheet,closeHostSheet,openHostPanel,closeHostPanel};', ctx);
const d = dom.window.document, f = ctx.f;
f.openHostPanel(); ok(d.getElementById('host-sheet-overlay').classList.contains('open'), 'panel opens');
f.openHostSheet('Holes', '<b>x</b>');
ok(d.getElementById('host-sheet-overlay') && d.getElementById('host-option-sheet'), 'option sheet opens without touching the panel');
f.closeHostSheet();
ok(d.getElementById('host-sheet-overlay') && !d.getElementById('host-option-sheet'), 'closing the option sheet leaves the panel in the page');
f.closeHostPanel(); ok(!d.getElementById('host-sheet-overlay').classList.contains('open'), 'panel closes by class');
let threw = false; try { f.openHostPanel(); } catch (e) { threw = true; }
ok(!threw && d.getElementById('host-sheet-overlay').classList.contains('open'), 'the icon can open the panel again');
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
