// v4.14.6: the host can fix the roster (Add a player, Open spot / Fill) at ANY time, archived games included.
import fs from 'fs';
const src = fs.readFileSync(new URL('../portal.html', import.meta.url), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const a = src.indexOf('function renderHostArchiveList'); const arch = src.slice(a, src.indexOf('\n}\n', a));
ok(arch.includes('hostAddPlayer(${g.gatheringId})'), 'archive card has Add a player');
ok(arch.includes('hostSpotsHtml(g, true)'), 'archive card allows Open spot / Fill / Release');
const h = src.indexOf('function hostAddPlayer'); const hp = src.slice(h, src.indexOf('\n}\n', h));
ok(/_hostPanelView === 'archive' \? renderHostArchiveList/.test(hp), 'after an add the archive view redraws, not the list');
console.log(`host_archive_roster: ${pass} pass, ${fail} fail`); process.exit(fail ? 1 : 0);
