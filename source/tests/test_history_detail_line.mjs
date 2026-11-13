// My History detail screen: historyEventDetailLine must not throw (a missing `parts` declaration once broke every History row).
import fs from 'fs'; import vm from 'vm';
import { extractFn } from './extract.mjs';
import { fileURLToPath } from 'url';
const src = fs.readFileSync(fileURLToPath(new URL('../portal.html', import.meta.url)), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const ctx = { escapeHtml: s => String(s), evtPlayLabel: e => 'Scramble' }; vm.createContext(ctx);
vm.runInContext(extractFn(src, 'historyEventDetailLine') + '\nthis.f = historyEventDetailLine;', ctx);
const run = e => { try { return ctx.f(e); } catch (x) { return 'THROWS ' + x.message; } };
ok(run(null) === '', 'no event: empty line');
ok(/⛳ Pebble/.test(run({ location: 'Pebble', format: 'Series' })) && /Series/.test(run({ location: 'Pebble', format: 'Series' })), 'series event: location and format');
ok(/Scramble/.test(run({ source: 'gathering', location: 'X', dt: new Date(2026, 10, 12, 9, 0) })), 'gathering: play label and time');
ok(run({}) === '', 'bare event: empty line, no throw');
console.log(`history_detail_line: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
