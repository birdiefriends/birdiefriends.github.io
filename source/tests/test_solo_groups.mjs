// With no published Groups, a field of solos (team of 1) is grouped three to a group, not two; two-man teams stay two to a group.
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const E = require('../bf_engine.js');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const solos = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map(n => [n]);
let g = E.fourballGroups(solos, 3);
ok(g.length === 3 && g[0].players.join() === 'A,B,C' && g[2].players.join() === 'G', 'solos: 3,3,1 in roster order');
ok(E.fourballGroups(solos).length === 4 && E.fourballGroups(solos)[0].players.length === 2, 'default stays two sides a group');
g = E.fourballGroups([['A', 'B'], ['C', 'D'], ['E', 'F']], 2);
ok(g.length === 2 && g[0].players.length === 4, 'two-man teams: two teams a group');
import fs from 'fs'; import { fileURLToPath } from 'url';
const src = fs.readFileSync(fileURLToPath(new URL('../portal.html', import.meta.url)), 'utf8');
ok(src.includes("const set = pub || (typeof LIVE_EVENT_TEST_MODE !== 'undefined' && LIVE_EVENT_TEST_MODE"), 'skGroups falls back to the host draft only in test mode');
ok(/if \(!LIVE_EVENT_TEST_MODE \|\| gid == null/.test(src) && /host_id=\$\{encodeURIComponent\(currentPlayer\)\}`, \{\}, 8000\);\n    if \(r && !r\.published && r\.draft/.test(src), 'the draft is fetched only in test mode, with the host id, and kept out of _groupSets');
const iso = src.slice(src.indexOf('function skIsOut'), src.indexOf('function skIsOut') + 300);
ok(!/_groupDraftPreview/.test(iso), 'start holes / out marks never read the draft');
ok(/Date\.now\(\) - Number\(o\.t\) < 12 \* 3600e3/.test(src) && /JSON\.stringify\(\{ t: Date\.now\(\), k: \[\.\.\.skCoinAcked\(g\)\] \}\)/.test(src), 'a coin "Got it" is remembered for 12 hours only, so a look in test mode days early does not silence game day');
ok(src.includes("const first = n => String(n).trim().replace(/\\s+/g, ' '), firstOnly"), 'the Live panel shows a solo player\'s full name (pairs stay first names)');
ok(src.includes("(r.members.length === 1 ? r.members[0] : r.label)") && !/font-size:0\.88rem;font-weight:700;margin-top:2px;[^"]*white-space:nowrap/.test(src), 'leaderboard leader chips show the full name and wrap instead of cutting it off');
console.log(`solo_groups: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
