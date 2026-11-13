// Legacy (Jotform) registrations: the same player twice on one event counts once; the latest change wins.
import fs from 'fs'; import vm from 'vm';
import { extractFn } from './extract.mjs';
import { fileURLToPath } from 'url';
const src = fs.readFileSync(fileURLToPath(new URL('../portal.html', import.meta.url)), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const ctx = { console, getAnswer: (a, keys) => { for (const k of keys) if (a[k] !== undefined) return a[k]; return ''; } };
vm.createContext(ctx); vm.runInContext(extractFn(src, 'parseRegSubmissions') + '\nthis.f=parseRegSubmissions;', ctx);
const sub = (id, player, reg, upd, ev) => ({ id, created_at: '2026-11-01 08:00:00', updated_at: upd, answers: { eventName: ev || '2026 BlackFriday-1man', playerName: player, register: reg } });
let r = ctx.f([sub('1', 'Rich Potts', 'Yes', '2026-11-02 09:00:00'), sub('2', 'Rich Potts ', 'Yes', '2026-11-03 09:00:00'), sub('3', 'Tim Wargo', 'Yes', '2026-11-02 09:00:00')]);
ok(r.length === 2 && r.filter(x => x.player === 'Rich Potts').length === 1 && r.find(x => x.player === 'Rich Potts').id === '2', 'two Rich Potts rows become one (the latest): ' + r.map(x => x.id));
r = ctx.f([sub('1', 'Rich Potts', 'Yes', '2026-11-02 09:00:00'), sub('2', 'rich  potts', 'No', '2026-11-04 09:00:00')]);
ok(r.length === 1 && r[0].status === 'No', 'the latest change decides, even a No');
r = ctx.f([sub('1', 'Rich Potts', 'Yes', '2026-11-02 09:00:00'), sub('2', 'Rich Potts', 'Yes', '2026-11-02 09:00:00', 'Other Event')]);
ok(r.length === 2, 'the same player on two different events is untouched');
console.log(`reg_dedupe: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
