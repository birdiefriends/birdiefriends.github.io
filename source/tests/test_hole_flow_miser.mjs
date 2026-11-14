// MiserBall in the hole flow: lost-ball step (tap, strokes, send via submitBirdieBall) and the end-of-round Kept / Lost check.
import fs from 'fs'; import vm from 'vm';
import { extractFn, loadEngine } from './extract.mjs';
import { fileURLToPath } from 'url';
const src = fs.readFileSync(fileURLToPath(new URL('../portal.html', import.meta.url)), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const E = loadEngine();
const posts = [];
const ctx = { console, JSON, Math, Number, String, Set, Map, Array, Object, Date, Promise, BFEngine: E,
  escapeHtml: s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])),
  getLiveEvent: () => ({ name: 'Turkey', gatheringId: 104 }), panelGamesGid: e => e.gatheringId, BFE_API: 'https://bfe', showToast: () => {},
  bbStrokeGridHtml: (v, fn) => `<grid ${fn} ${v}>`, bbHoleGridHtml: (v, fn) => `<holes ${fn} ${v}>`, bbAnswerFor: null, gatheringRoundConfig: () => null, gatheringAddon: () => null,
  renderLiveBanner: () => {}, fetch: async (u, o) => { posts.push(JSON.parse(o.body)); return { json: async () => ({ ok: true }) }; } };
vm.createContext(ctx);
const names = ['holeFlowStepHead', 'holeFlowBbShort', 'holeFlowLostHtml', 'holeFlowKeptHtml', 'holeFlowLostPick', 'holeFlowBbKept', 'bbRawAnswer', 'bbTeamsFor', 'bbTeamOf', 'bbLostScore', 'bbAnswerFor', 'bbPostAnswers'];
vm.runInContext('let _bbAnswers=[]; let _bbAnswersForGathering=null; let _bbPlayer=null; let _bbTouchedPlayer=null; let _bbLostHole=null; let _bbLostStroke=null; let _bbKept=null; let _bbSubmitting=false; let _bbAskHole=null;\n' +
  names.map(n => extractFn(src, n)).join('\n') + '\nthis.api={holeFlowLostHtml,holeFlowKeptHtml,holeFlowLostPick,holeFlowBbKept,set:(k,v)=>{ if(k==="a")_bbAnswers=v; if(k==="s"){_bbLostStroke=v;} },g:()=>[_bbPlayer,_bbLostHole,_bbAskHole,_bbAnswers]};', ctx);
const A = ctx.api, g = { players: ['Brian Hager', 'Tom Marsh', 'Mike Kay', 'Dave Vance'] };
const st = { kind: 'lostball', hole: 5 };
let h = A.holeFlowLostHtml(st, 3, g);
ok(/MiserBall/.test(h) && /Anyone lose it/.test(h) && /Brian/.test(h) && /Dave/.test(h), 'step 3 lists the group as pills');
ok(!/grid /.test(h), 'no strokes grid until someone is picked');
A.holeFlowLostPick(5, 'Tom Marsh');
h = A.holeFlowLostHtml(st, 3, g);
ok(/Tom lost it on #5/.test(h) && /bbSetStroke/.test(h) && /disabled/.test(h), 'picking a player asks for strokes and the send button waits for them');
A.set('s', 2);
h = A.holeFlowLostHtml(st, 3, g);
ok(!/disabled/.test(h) && /submitBirdieBall\(\)/.test(h), 'with strokes the send button is live and wired to the existing alert save');
A.holeFlowLostPick(5, 'Tom Marsh');
ok(A.g()[0] === null, 'tapping the same player again cancels');
A.set('a', [{ player_name: 'Tom Marsh', kept: false, lost_hole: 5, lost_stroke: 2 }]);
h = A.holeFlowLostHtml(st, 3, g);
ok(/Tom #5/.test(h) && !/holeFlowLostPick\(5,&quot;Tom/.test(h), 'a player who lost it shows as lost and cannot be picked again');
// end-of-round check
let k = A.holeFlowKeptHtml({ kind: 'keptcheck', hole: 18 }, 4, g);
ok(/MiserBall check/.test(k) && /Lost on #5 \(2\)/.test(k), 'the check shows a recorded loss');
ok((k.match(/Kept it/g) || []).length === 3, 'the three players with no answer each get Kept it / Lost it');
await A.holeFlowBbKept('Mike Kay');
ok(posts.length === 1 && posts[0].kept === true && posts[0].player_name === 'Mike Kay' && posts[0].gathering_id === 104 && posts[0].lost_hole === null, 'Kept it saves a kept answer for that player');
k = A.holeFlowKeptHtml({ kind: 'keptcheck', hole: 18 }, 4, g);
ok(/✅ Kept it/.test(k) && (k.match(/holeFlowBbKept\(/g) || []).length === 2, 'Mike now shows kept and the other two still need an answer');
A.holeFlowLostPick(18, 'Dave Vance', true);
k = A.holeFlowKeptHtml({ kind: 'keptcheck', hole: 18 }, 4, g);
ok(/Which hole\?/.test(k) && /bbSetHole/.test(k) && /bbSetStroke/.test(k), '"Lost it" in the check asks for the hole and the strokes');
ok(/const ctx = 0|bbSection = _skOn \?/.test(src), 'on the Leaderboard tab MiserBall is read-only when live scoring is on');
console.log(`hole_flow_miser: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
