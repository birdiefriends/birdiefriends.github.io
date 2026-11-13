// Birdie coin marker reminders (shotgun): first group to a CttP hole places the coin, the last group through it picks it up.
import fs from 'fs'; import vm from 'vm';
import { extractFn } from './extract.mjs';
import { fileURLToPath } from 'url';
const src = fs.readFileSync(fileURLToPath(new URL('../portal.html', import.meta.url)), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const ctx = { _sk: { config: { addons: [{ id: 'cttp', holes: [3, 8, 18], prize_holes: [17] }] } }, gatheringAddon: (c, id) => c.addons.find(a => a.id === id) || null, skMaxHole: () => 18 };
vm.createContext(ctx);
vm.runInContext(['skCoinDuty', 'skCoinHoles', 'skCoinNoteHtml'].map(n => extractFn(src, n)).join('\n') + '\nthis.D = skCoinDuty; this.H = skCoinHoles; this.N = skCoinNoteHtml;', ctx);
const G = (n, st, extra) => Object.assign({ n, start_hole: st, mode: 'shotgun' }, extra || {});
// groups start on 1, 5, 9, 13
const gs = [G(1, 1), G(2, 5), G(3, 9), G(4, 13)];
let d = ctx.D(gs, [3, 8, 18], 18);
ok(d[3].first === 1 && d[3].last === 2, 'hole 3: group 1 (starts on 1) is first; group 2 (starts on 5, reaches 3 after 16 holes) is last');
ok(d[8].first === 2 && d[8].last === 3, 'hole 8: group 2 (5,6,7,8) first; group 3 (9..18,1..8) last');
ok(d[18].first === 4 && d[18].last === 1, 'hole 18: group 4 (13..18) first; group 1 (1..18) last');
// a group that starts ON the hole is first there
d = ctx.D([G(1, 3), G(2, 10)], [3], 18); ok(d[3].first === 1 && d[3].last === 2, 'starting on the hole means first there');
// same start hole: wave A before B
d = ctx.D([G(1, 7, { wave: 'B' }), G(2, 7, { wave: 'A' })], [7], 18); ok(d[7].first === 2 && d[7].last === 1, 'wave A is ahead of wave B on the same start hole');
// tee times follow order / time
d = ctx.D([{ n: 1, mode: 'tee_times', tee_time: '09:10' }, { n: 2, mode: 'tee_times', tee_time: '08:30' }], [4], 18); ok(d[4].first === 2 && d[4].last === 1, 'tee times: earliest first');
ok(Object.keys(ctx.D([G(1, 1)], [3], 18)).length === 0, 'one group: no reminders');
ok(JSON.stringify(ctx.H().sort((a, b) => a - b)) === '[3,8,17,18]', 'CttP holes include the prize hole');
// banner text
const first = ctx.N(3, 4, gs[0], gs), last = ctx.N(3, 4, gs[1], gs), mid = ctx.N(3, 4, gs[2], gs);
ok(/first group to Hole 3/.test(first) && /Place the Birdie coin marker/.test(first), 'first group is told to place the coin');
ok(/last group through Hole 3/.test(last) && /Pick up the Birdie coin marker/.test(last), 'last group is told to pick it up');
ok(mid === '', 'a group that is neither first nor last gets nothing');
ok(/Heads up: you are the first group to Hole 8/.test(ctx.N(7, 8, gs[1], gs)), 'heads-up a hole ahead for the first group');
ok(/Heads up: you are the last group through Hole 8/.test(ctx.N(7, 8, gs[2], gs)), 'heads-up a hole ahead for the last group');
console.log(`coin_marker: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
