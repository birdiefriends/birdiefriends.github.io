// Hole-by-hole flow UI: step 1 score always, step 2 CTP only on CTP holes (#17 prize), claim saves through submitCttp.
import fs from 'fs'; import vm from 'vm';
import { extractFn, loadEngine } from './extract.mjs';
import { fileURLToPath } from 'url';
const src = fs.readFileSync(fileURLToPath(new URL('../portal.html', import.meta.url)), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const E = loadEngine();
const row = { games: ['scramble', 'cttp'], dollar_per_player: 20, cttp_config: { dollar_per_hole: 3, holes: [3, 7], prize_holes: [17] }, game_configs: { scramble: { dollar_per_player: 20, team_size: 2, basis: 'gross' } } };
const config = E.gatheringConfigFromLegacy(row);
const ctx = { console, JSON, Math, Number, String, Set, Map, Array, Object, Date, Promise, BFEngine: E,
  escapeHtml: s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])),
  getLiveEvent: () => ({ name: 'Turkey 2Man', gatheringId: 104 }), renderLiveBanner: () => {}, rendered: 0 };
vm.createContext(ctx);
vm.runInContext('let _ctpData={}; let _ctpHistory={}; let _ctpHole=null; let _ctpPlayer=null; let _ctpSubmitting=false;\n' +
  ['holeFlowStepHead', 'holeFlowStepHtml', 'holeFlowClaimHtml', 'holeFlowClaimPick'].map(n => extractFn(src, n)).join('\n') +
  '\nthis.api={holeFlowStepHtml,holeFlowClaimPick,s:(k,v)=>{ if(k==="d")_ctpData=v; if(k==="h")_ctpHistory=v; },g:()=>[_ctpHole,_ctpPlayer]};', ctx);
const A = ctx.api, g = { players: ['Brian Hager', 'Tom Marsh', 'Mike Kay', 'Dave Vance'] };
const step = h => E.holeSteps(config, h).find(s => s.id === 'cttp');
ok(!step(1), 'hole 1 has no CTP step');
const h3 = A.holeFlowStepHtml(step(3), 2, g, true);
ok(/Closest to the pin/.test(h3) && /Brian/.test(h3) && /Nobody yet/.test(h3), 'hole 3 shows a numbered CTP step with the group and no leader');
ok(!/cttp-dist-input/.test(h3), 'no distance box until someone is picked');
A.holeFlowClaimPick(3, 'Tom Marsh');
ok(JSON.stringify(A.g()) === JSON.stringify([3, 'Tom Marsh']), 'tapping a name selects them for this hole');
const h3b = A.holeFlowStepHtml(step(3), 2, g, true);
ok(/cttp-dist-input/.test(h3b) && /Tom is closest/.test(h3b) && /submitCttp\(&quot;Turkey 2Man&quot;\)/.test(h3b), 'the picked name gets a distance box and a save button wired to submitCttp');
A.holeFlowClaimPick(3, 'Tom Marsh');
ok(A.g()[0] === null, 'tapping the same name again deselects');
const h17 = A.holeFlowStepHtml(step(17), 2, g, true);
ok(/prize/i.test(h17), '#17 is shown as the prize hole');
A.s('d', { 3: { player: 'Mike Kay', dist: 6 } }); A.s('h', { 3: [{ player: 'Mike Kay', dist: 6 }] });
const h3c = A.holeFlowStepHtml(step(3), 2, g, true);
ok(/Now: Mike 6 ft/.test(h3c) && /disabled[^>]*>Mike/.test(h3c), 'the current leader shows, and a player who already claimed cannot claim twice');
ok(A.holeFlowStepHtml({ kind: 'unknown' }, 2, g) === '', 'an unknown step kind renders nothing');

// ── MiserBall steps
const mrow = { games: ['birdieball', 'skins'], dollar_per_player: 20, birdieball_config: { dollar_per_player: 2 } };
const mcfg = { addons: [{ id: 'birdieball' }, { id: 'cttp', holes: [3] }] };
ok(E.holeSteps(mcfg, 1, { last: false }).map(x => x.kind).join() === 'score,lostball', 'MiserBall adds a lost-ball step on every hole');
ok(E.holeSteps(mcfg, 3, { last: false }).map(x => x.kind).join() === 'score,claim,lostball' || E.holeSteps(mcfg, 3).map(x => x.kind).join() === 'score,lostball,claim', 'it stacks with CTP as a 3rd step');
ok(E.holeSteps(mcfg, 18, { last: true }).map(x => x.kind).join() === 'score,lostball,keptcheck', 'the last hole adds the Kept / Lost check');
ok(!E.holeSteps(mcfg, 17, { last: false }).some(x => x.kind === 'keptcheck'), 'no check before the last hole');
ok(!E.holeSteps({ addons: [{ id: 'cttp', holes: [3] }] }, 1, { last: true }).some(x => x.game === 'birdieball'), 'no MiserBall add-on means no MiserBall steps');
// wiring
ok(/BFEngine\.holeSteps\(_sk\.config, hole, \{ last: hole === max \}\)\.slice\(1\)/.test(src) && /holeFlowStepHead\(1, 'Hole score'\)/.test(src), 'the score view builds its steps from the engine');
ok(/'Hole by Hole'/.test(src) && /'Leaderboard'/.test(src) && !/Live Actions'\)/.test(src), 'the two tabs are Hole by Hole and Leaderboard');
ok(/const ctpSection = _skOn \? `/.test(src), 'with live scoring the Leaderboard CTP section is leaders only (no picker, pills or claim button)');
console.log(`hole_flow_ui: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
