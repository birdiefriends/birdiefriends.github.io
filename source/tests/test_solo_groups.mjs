// With no published Groups, a field of solos (team of 1) is grouped three to a group, not two; two-man teams stay two to a group.
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const E = require('../bf_engine.js');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const solos = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map(n => [n]);
let g = E.fourballGroups(solos, 3);
ok(g.length === 3 && g[0].players.join() === 'A,B,C' && g[2].players.join() === 'G', 'solos: 3,3,1 in roster order');
ok(E.fourballGroups(solos).length === 4 && E.fourballGroups(solos)[0].players.length === 2, 'default stays two sides a group');
g = E.fourballGroups([['A', 'B'], ['C', 'D'], ['E', 'F']], 2);
ok(g.length === 2 && g[0].players.length === 4, 'two-man teams: two teams a group');
console.log(`solo_groups: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
