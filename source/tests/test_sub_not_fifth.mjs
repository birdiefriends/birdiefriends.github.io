// v4.15.1: a SUB on an 8-man Weekend event must not get the "You're the 5th player" banner (that is for the 5th YES player).
import fs from 'fs'; import vm from 'vm';
import { extractFn } from './extract.mjs';
const src = fs.readFileSync(new URL('../portal.html', import.meta.url), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const mk = (regData) => { const c = { regData, isOpenSpotName: () => false, Date, parseInt };
  vm.createContext(c); vm.runInContext(extractFn(src, 'getMyCapacityDisplay') + '; this.f = getMyCapacityDisplay;', c); return c.f; };
const evt = { name: 'BF Weekend Times', capacity: 8 };
const yes = n => Array.from({ length: n }, (_, i) => ({ id: 'y' + i, eventName: evt.name, status: 'Yes', createdAt: new Date(2026, 9, 1, 8, i) }));
const scott = { id: 's1', eventName: evt.name, status: 'Sub', createdAt: new Date(2026, 9, 2) };
// Scott: 1 Yes + him as Sub on an 8-man (the reported case)
let d = mk([...yes(1), scott])(evt, scott, { cap: 8, is4man: false });
ok(d && !d.pending, 'Sub on 8-man, 1/8: NOT pending (no 5th-player banner)');
ok(d && d.subPending === true && /Tentatively/.test(d.label), 'Sub keeps its own status line');
// 5th Yes player still gets the banner
const regs5 = yes(5); const fifth = regs5[4];
d = mk(regs5)(evt, fifth, { cap: 8, is4man: false, fivePending: true });
ok(d && d.pending === true && d.fifth === true && d.label === 'Spot not yet confirmed', '5th YES player still gets the pending banner');
// an earlier Yes (not the last) does not
d = mk(regs5)(evt, regs5[0], { cap: 8, is4man: false, fivePending: true });
ok(d === null, 'earlier Yes players get nothing');
// 4-man sub unchanged
d = mk([...yes(2), scott])({ name: evt.name, capacity: 4 }, scott, { cap: 4, is4man: true });
ok(d && d.sub4man === true && !d.pending, '4-man Sub unchanged');
// 8-man Sub with 6+ Yes is confirmed, unchanged
d = mk([...yes(6), scott])(evt, scott, { cap: 8, is4man: false });
ok(d && d.confirmed === true, '8-man Sub with 6 Yes unchanged');
// the banner is gated on the 5th-player flag semantics
ok(/myCapDisp && myCapDisp\.pending \?/.test(src), 'banner still keyed on pending, which only the 5th YES player now sets');
console.log(`sub_not_fifth: ${pass} pass, ${fail} fail`); process.exit(fail ? 1 : 0);
