// A prize-only CTP hole can say what the prize is: it rides on the saved config, the hole step and the closed result.
import { loadEngine } from './extract.mjs';
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const E = loadEngine();
const card = n => ({ player: n, holes: Array(18).fill(4) });
const row = { games: ['cttp'], dollar_per_player: 10, cttp_config: { dollar_per_hole: 5, holes: [3, 8], prize_holes: [17], prize: 'Sleeve of <b>Pro V1s' } };
const r = E.computeGatheringGamesPayout(row, ['A', 'B', 'C', 'D'].map(card), { 3: { player: 'A', dist: 5 }, 17: { player: 'B', dist: 3 } }, []);
ok(r.cttp.prize === 'Sleeve of bPro V1s', 'the prize text is on the result (markup characters stripped): ' + r.cttp.prize);
ok(r.cttp.holes.find(h => h.hole === 17).prize === true && r.cttp.holes.find(h => h.hole === 17).paid === 0, 'the prize hole pays no cash');
const cfg = E.gatheringConfigFromLegacy(row), cad = cfg.addons.find(a => a.id === 'cttp');
const step = E.holeSteps(cfg, 17, { last: false }).find(s => s.kind === 'claim');
ok(cad.prize === 'Sleeve of bPro V1s' && step && step.prize === true && step.prize_text === 'Sleeve of bPro V1s', 'the hole step carries the prize text');
const none = E.computeGatheringGamesPayout({ ...row, cttp_config: { dollar_per_hole: 5, holes: [3, 8], prize: 'ignored' } }, ['A', 'B', 'C', 'D'].map(card), {}, []);
ok(none.cttp.prize === undefined, 'no prize hole, no prize text');
console.log(`cttp_prize_text: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
