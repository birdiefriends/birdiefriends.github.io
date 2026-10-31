// BFE-Admin roster: the Sub tick round-trips (read, assemble, reload).
import fs from 'fs'; import { JSDOM } from 'jsdom'; import { fileURLToPath } from 'url';
const HERE = p => fileURLToPath(new URL(p, import.meta.url));
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const engine = fs.readFileSync(HERE('../bf_engine.js'), 'utf8');
let html = fs.readFileSync(HERE('../../docs/BFE-Admin.html'), 'utf8').replace(/<script src="bf_engine.js[^>]*><\/script>/, '<script>' + engine.replace(/<\/script>/g, '<\\/script>') + '</script>');
const J = o => ({ ok: true, status: 200, json: async () => o });
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://x.test/BFE-Admin.html', beforeParse(w) { w.fetch = async () => J({ ok: true, players: [], tees: [] }); w.alert = () => {}; w.confirm = () => true; } });
const w = dom.window, d = w.document; await new Promise(r => setTimeout(r, 200));
w.addPlayerRow('Ann', '', 10, false, '', false); w.addPlayerRow('Rich', '', 20, false, '', true);
const r = w.readRosterInput();
ok(r.find(p => p.name === 'Rich').sub === true && r.find(p => p.name === 'Ann').sub === undefined, 'readRosterInput carries sub only when ticked');
const rows = [...d.querySelectorAll('#rosterBody tr')]; const rich = rows.find(tr => tr.querySelector('.p-name').value === 'Rich');
ok(rich.querySelector('.p-sub').checked, 'the Sub tick shows on the row');
console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
