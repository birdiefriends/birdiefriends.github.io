// Dev-95 — BF Cup live scoring: net scores with handicap strokes, segments, pickups, live standings.
import { loadEngine } from './extract.mjs';
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const E = loadEngine();
const SI = [1,3,5,7,9,11,13,15,17,2,4,6,8,10,12,14,16,18];
const cfg = { sides: [{ key: 'A', name: 'Team Jake', captain: 'Jake' }, { key: 'B', name: 'Team Nate', captain: 'Nate' }],
  points: { win: 1, half: 0.5, loss: 0 },
  handicap: { bestball: 100, altshot: 100, singles: 100, strokeIndex: SI },
  draft: { stats: { Jake: { hcp: 10 }, Amy: { hcp: 14 }, Nate: { hcp: 6 }, Bob: { hcp: 8 } } },
  rounds: [{ key: 'r1', name: 'Saturday', holes: 18, segments: [{ key: 's1', format: 'bestball', from: 1, to: 9 }, { key: 's2', format: 'altshot', from: 10, to: 18 }],
    matches: [{ key: 'm1', sides: [{ side: 'A', players: ['Jake', 'Amy'] }, { side: 'B', players: ['Nate', 'Bob'] }] }] }] };
const round = cfg.rounds[0], match = round.matches[0];
// low handicap is Nate (6): Jake +4, Amy +8, Bob +2 (fourball, per player)
const H = {}; const put = (h, o) => { H[String(h)] = o; };
// hole 1 (SI1: every stroker gets a stroke): all gross 5 -> Jake 4, Amy 4, Nate 5, Bob 4 => A 4, B 4 -> halved
put(1, { Jake: 5, Amy: 5, Nate: 5, Bob: 5 });
let L = E.cupMatchLive(cfg, round, match, { h: H });
ok(L.segments[0].nets[0][0] === 4 && L.segments[0].nets[1][0] === 4, 'hole 1 nets: strokes applied (got ' + L.segments[0].nets.map(a => a[0]) + ')');
ok(L.segments[0].state.text === 'All square thru 1', 'all square thru 1 (got ' + L.segments[0].state.text + ')');
// hole 9 (SI 17): Amy gets 8 strokes -> a stroke on every hole; Jake 4 strokes -> not on SI17; Bob 2 -> no.
put(9, { Jake: 4, Amy: 5, Nate: 4, Bob: 4 });
L = E.cupMatchLive(cfg, round, match, { h: H });
ok(L.segments[0].nets[0][8] === 4 && L.segments[0].nets[1][8] === 4, 'hole 9: Amy 5-1=4 ties (got ' + L.segments[0].nets.map(a => a[8]) + ')');
// next hole to enter = first gap
ok(L.next === 2 && !L.allEntered, 'next hole is the first unentered one');
// pickup counts as losing the hole when the whole side picks up
put(2, { Jake: 0, Amy: 0, Nate: 4, Bob: 6 });
L = E.cupMatchLive(cfg, round, match, { h: H });
ok(L.segments[0].nets[0][1] === 99 && L.segments[0].nets[1][1] === 4, 'side that picks up loses the hole');
ok(L.segments[0].state.lead === -1, 'Team Nate 1 up (got ' + L.segments[0].state.lead + ')');
// foursomes: one team score under the first player; combined team handicap 24 vs 14 -> A gets 10 strokes (>9 so holes SI1..SI9 +1 on 10..18 only SI2,4,..)
const F = {}; F['10'] = { Jake: 5 }; F['10'] = { Jake: 5, Nate: 5 };
L = E.cupMatchLive(cfg, round, match, { h: F });
ok(L.segments[1].nets[0][9] === 4 && L.segments[1].nets[1][9] === 5, 'foursomes: team strokes on SI2 (got ' + L.segments[1].nets.map(a => a[9]) + ')');
ok(L.format === 'bestball' || L.format === 'altshot', 'format in play reported');
// live standings turn decided segments into points
const big = {}; for (let h = 1; h <= 9; h++) big[String(h)] = { Jake: 3, Amy: 3, Nate: 7, Bob: 7 };
const cfg2 = Object.assign({}, cfg, { scores: { r1: { m1: { h: big } } } });
const S = E.cupLiveStandings(cfg2);
ok(S.points.A === 1 && S.points.B === 0, 'fourball segment won -> 1 point for Team Jake (got ' + JSON.stringify(S.points) + ')');
ok(S.rounds[0].matches[0].segments[0].text.indexOf('&') > 0, 'closed early shows N&M');
ok(S.state === 'live' && S.open === 1, 'foursomes still open');
// no scores = nothing awarded, no crash
const S0 = E.cupLiveStandings(cfg);
ok(S0.points.A === 0 && S0.points.B === 0 && S0.open === 2, 'empty scores award nothing');
// scratch event (no stroke index): grosses are the nets
const cfg3 = JSON.parse(JSON.stringify(cfg)); delete cfg3.handicap.strokeIndex;
L = E.cupMatchLive(cfg3, round, match, { h: { '1': { Jake: 4, Amy: 5, Nate: 5, Bob: 6 } } });
ok(L.segments[0].nets[0][0] === 4 && L.segments[0].nets[1][0] === 5, 'no stroke index = scratch (got ' + L.segments[0].nets.map(a => a[0]) + ')');
console.log('live engine: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
