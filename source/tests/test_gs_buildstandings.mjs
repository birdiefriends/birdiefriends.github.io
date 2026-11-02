// GS buildStandings (the in-app 7-Series tab, Sheets export, ranking): a NoHCP player's baseline event (no quota) must not count as quota 0.
import fs from 'fs'; import vm from 'vm';
import { extractFn } from './extract.mjs';
const src = fs.readFileSync(new URL('../BF_Golf_Scorer_8.html', import.meta.url), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const ev = (n, q, a) => ({ eventName: 'E' + n, quota: q, actual: a, result: q === null ? null : a - q });
const data = { seasons: { 2026: { playerHistory: {
  Potts: { tee: 'Combo', events: [ev(1, null, 24), ev(2, 30, 36), ev(3, 28, 30), ev(4, 32, 30), ev(5, 26, 31)] },     // NoHCP: baseline + 4 scored
  Reg: { tee: 'Green', events: [ev(1, 30, 33), ev(2, 30, 29), ev(3, 30, 36), ev(4, 30, 30)] },
  Few: { tee: 'Green', events: [ev(1, 30, 33)] },
} } } };
const ctx = { getSeriesData: () => data };
vm.createContext(ctx);
vm.runInContext(['calcSeriesPerformance', 'buildRetroactiveE1Event', 'buildStandings'].map(n => extractFn(src, n)).join('\n') + '; this.f = buildStandings;', ctx);
const r = Object.fromEntries(ctx.f('2026').map(p => [p.name, p]));
ok(r.Potts.qualifies && r.Potts.played === 5, 'Potts qualifies on 4 scored + the retroactive E1 (played shows all 5 rows)');
ok(r.Potts.performance === 4.6 && r.Potts.assigned === 146.4 && r.Potts.achieved === 151, 'Potts: assigned 146.4, achieved 151, performance +4.6 (got ' + r.Potts.assigned + '/' + r.Potts.achieved + '/' + r.Potts.performance + ')');
ok(r.Reg.performance === 8 && r.Reg.assigned === 120 && r.Reg.achieved === 128, 'a regular player is unchanged: best 4 of 4 (got ' + r.Reg.performance + ')');
ok(!r.Few.qualifies, 'under 4 events does not qualify');
console.log(`gs_buildstandings: ${pass} pass, ${fail} fail`); process.exit(fail ? 1 : 0);
