// My History scorecard modal: stroke dots from the closed summary's stroke_marks.
import fs from 'fs'; import vm from 'vm'; import { fileURLToPath } from 'url';
import { extractFn } from './extract.mjs';
const src = fs.readFileSync(fileURLToPath(new URL('../portal.html', import.meta.url)), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const ctx = { console, Array, Number, String, Object, Set, Map,
  csMarkStyle: () => ({ radius: '50%', bg: '#fff', color: '#000', ring: '#000', double: false }), csMarkEmoji: () => '', csMarkBadgeText: () => '' };
vm.createContext(ctx);
vm.runInContext(extractFn(src, 'buildReadOnlyHoleGrid') + '\nthis.f=buildReadOnlyHoleGrid;', ctx);
const holes = Array.from({ length: 18 }, () => 5);
const dots = h => (h.match(/width:5px;height:5px/g) || []).length;
ok(dots(ctx.f(holes, [], 0, 9, { 2: 1, 4: 2 })) === 3, 'front 9: hole 2 one dot, hole 4 two dots');
ok(dots(ctx.f(holes, [], 9, 18, { 2: 1, 4: 2, 11: 1 })) === 1, 'back 9 only gets its own dots');
ok(dots(ctx.f(holes, [], 0, 9)) === 0, 'no marks: no dots, same as before');
const fb = src.slice(src.indexOf('function renderGatheringPayoutHtml'), src.indexOf('function renderGatheringPayoutHtml') + 16000);
ok(/gameStrokes/.test(fb) && /in \$\{lab\}/.test(fb), 'summary rows list per-game strokes when they differ from the full allowance');
ok(/Net column uses each player/.test(fb), 'how-it-was-played box explains full vs off the low');
ok(/Gross \$\{tot\} &middot; net \$\{tot - full\}/.test(src), 'scorecard shows gross and full-handicap net');
ok(/_historyStrokeMarks\[key\]\s*=/.test(src) && /_historyStrokeMarks\[sc\.event_name\]/.test(src), 'results load stashes marks; scorecard modal reads them');
console.log(`history strokes: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
