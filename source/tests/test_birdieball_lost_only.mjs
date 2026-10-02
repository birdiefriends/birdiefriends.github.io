import fs from 'fs'; import vm from 'vm'; import { extractFn } from './extract.mjs'; import { fileURLToPath } from 'url';
const src = fs.readFileSync(fileURLToPath(new URL('../portal.html', import.meta.url)), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
ok(!/bbSetKept\(/.test(src.replace(/function bbSetKept[\s\S]*?\n}\n/, '')), 'live card has no Kept it / Lost it toggle');
ok(/💔 I lost it/.test(src), 'live card is a lost-ball alert');
ok(/_bbKept = false; \/\/ v4\.9\.10/.test(src), 'live submit always sends kept:false');
ok(/const bbConfirmNeedsAsk = showBirdieBallSection;/.test(src), 'scorecard always asks, even after an alert');
ok(/lost the MiserBall`;/.test(src) && /'birdieball'\)/.test(src), 'lost alert sends a push of type birdieball');
ok(/filter\(n => n !== player\)/.test(src), 'push goes to the round\'s other players, not a league blast');
ok(/case 'birdieball':/.test(src), 'feed knows the birdieball type');
// materialize: first touch copies the saved lost alert, then edits build on it
const ctx = { _scBbKept: null, _scBbLostHole: null, _scBbLostStroke: null, scPlayerSel: 'Dave', bbAnswerFor: () => ({ kept: false, lost_hole: 7, lost_stroke: 5 }), renderLiveBanner() {} };
vm.createContext(ctx);
vm.runInContext(['scBbMaterialize', 'scBbSetStroke'].map(n => extractFn(src, n)).join('\n') + ';this.set=scBbSetStroke', ctx);
ctx.set(6);
ok(ctx._scBbKept === false && ctx._scBbLostHole === 7 && ctx._scBbLostStroke === 6, 'editing starts from the saved alert');
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
