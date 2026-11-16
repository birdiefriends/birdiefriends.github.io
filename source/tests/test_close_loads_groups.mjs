// Close must load the published Groups itself: groupsLoadPublished only covers events within 8h of tee time, so a next-day Close
// counted every shotgun group from hole 1 (2Man 2026-11-16, wrong TurkeyBall winner).
import fs from 'fs'; import vm from 'vm';
import { extractFn } from './extract.mjs';
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const src = fs.readFileSync(new URL('../portal.html', import.meta.url), 'utf8');
const set = { mode: 'shotgun', groups: [{ start_hole: 1, members: ['A1', 'A2'] }, { start_hole: 10, members: ['B1', 'B2'] }] };
let calls = 0;
const ctx = { _groupSets: {}, GATHERINGS_API: 'x', console, gatheringsFetchJSON: async () => { calls++; return { published: set, version: 3 }; } };
vm.createContext(ctx);
vm.runInContext(extractFn(src, 'ensureGroupSet') + '\n' + extractFn(src, 'gatheringStartHoles') + '\nthis.e = ensureGroupSet; this.s = gatheringStartHoles;', ctx);
ok(ctx.s(104) === null, 'no Groups loaded yet: start holes unknown');
await ctx.e(104);
ok(JSON.stringify(ctx.s(104)) === JSON.stringify({ a1: 1, a2: 1, b1: 10, b2: 10 }), 'after ensureGroupSet the shotgun start holes are known');
await ctx.e(104); ok(calls === 1, 'already loaded: no second fetch');
const failing = { _groupSets: {}, GATHERINGS_API: 'x', console: { warn() {} }, gatheringsFetchJSON: async () => { throw new Error('offline'); } };
vm.createContext(failing); vm.runInContext(extractFn(src, 'ensureGroupSet') + '\nthis.e = ensureGroupSet;', failing);
let threw = false; try { await failing.e(104); } catch (e) { threw = true; } ok(!threw, 'a failed lookup never blocks the Close sheet');
const close = extractFn(src, 'openGatheringCloseSheet');
ok(close.indexOf('await ensureGroupSet(gatheringId)') > -1 && close.indexOf('await ensureGroupSet(gatheringId)') < close.indexOf('computeGatheringGamesPayout('), 'Close sheet loads the Groups before it computes the payout');
console.log(`close_loads_groups: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
