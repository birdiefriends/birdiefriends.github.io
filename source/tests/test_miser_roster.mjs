// v4.23.3 — MiserBall result lists every player; Close waits for a MiserBall answer from everyone.
import fs from 'fs'; import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const E = require('../bf_engine.js');
const src = fs.readFileSync(new URL('../portal.html', import.meta.url), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const card = p => ({ player: p, scores: {}, holes: {} });
const cfg = { games: ['birdieball'], payout: { entry_per_player: 10 }, addons: [{ id: 'birdieball', entity: 'individual', dollar_per_player: 4 }] };
const run = answers => E.computeGatheringGamesPayout ? null : null;
// use the same entry the portal uses
const calc = (answers) => E.computeGatheringGamesPayout(
  { games: ['birdieball'], payout: { entry_per_player: 10 }, birdieball_config: { dollar_per_player: 4 }, game_configs: {} },
  ['Brian', 'Test1', 'Test2', 'Test3'].map(card), {}, answers);
let r;
try { r = calc([{ player_name: 'Test1', kept: false, lost_hole: 14, lost_stroke: 1 }, { player_name: 'Test2', kept: false, lost_hole: 9, lost_stroke: 2 }]); } catch (e) { console.log('calc err', e.message); }
const b = r && r.birdieball;
ok(b && Array.isArray(b.players) && b.players.length === 4, 'roster lists all four players');
ok(b && b.players.find(p => p.player === 'Brian').status === 'none', 'unanswered player is "none"');
ok(b && b.players.find(p => p.player === 'Test1').hole === 14 && b.players.find(p => p.player === 'Test1').won, 'longest holder marked as winner with hole/stroke');
r = calc([{ player_name: 'Brian', kept: true }, { player_name: 'Test1', kept: false, lost_hole: 14, lost_stroke: 1 }]);
ok(r.birdieball.mode === 'kept' && r.birdieball.players.find(p => p.player === 'Brian').won, 'kept player wins and is flagged');
ok(/recon\.bbMissing\.length > 0/.test(src) && /Confirm MiserBall for/.test(src), 'close is held while anyone lacks a MiserBall answer');
ok(/Lost it\$\{p\.hole/.test(src) && /'No answer'/.test(src), 'result card shows kept / lost where / no answer per player');
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
