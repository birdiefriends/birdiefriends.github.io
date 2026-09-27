import fs from 'fs'; import vm from 'vm'; import { extractFn } from './extract.mjs';
import { fileURLToPath } from 'url';
const HERE = (p) => fileURLToPath(new URL(p, import.meta.url));
const src = fs.readFileSync(HERE('../portal.html'), 'utf8');
const ctx = { Array, _gatheringGamesIndex: new Map([[1, { games: ['skins'] }], [2, { games: ['cttp'] }], [3, { games: ['birdieball'] }], [4, { games: [] }]]) };
vm.createContext(ctx); vm.runInContext(extractFn(src, 'evtScoreMode') + ';this.f=evtScoreMode;', ctx);
const cases = [[{ source: 'gathering', gatheringId: 1 }, 'strokes'], [{ source: 'gathering', gatheringId: 2 }, 'strokes'], [{ source: 'gathering', gatheringId: 3 }, 'strokes'],
  [{ source: 'gathering', gatheringId: 4 }, 'points'], [{ source: 'gathering', gatheringId: 99 }, 'points'], [{ source: 'jotform', name: 'BSGC Series' }, 'points'], [null, 'points']];
let p = 0; cases.forEach(([e, x], i) => { const r = ctx.f(e); r === x ? p++ : console.log('FAIL case', i, r); });
console.log(`${p} passed, ${cases.length - p} failed`); process.exit(p === cases.length ? 0 : 1);
