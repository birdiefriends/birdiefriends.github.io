// v4.48.0 — Teams of 2 (portal side), running the REAL functions from portal.html.
// Pins: when a team is "locked", who still needs a partner, who sees which prompt, the partner picker order, the card
// count line (players stay the headline, teams follow), the host pairing block, the New Gathering wiring and the
// registration request shape. The Worker side is pinned at the bottom against worker.js's source text.
import fs from 'fs'; import vm from 'vm'; import { extractFn } from './extract.mjs';
import { fileURLToPath } from 'url';
const HERE = (p) => fileURLToPath(new URL(p, import.meta.url));
const src = fs.readFileSync(HERE('../portal.html'), 'utf8');
const workerSrc = fs.readFileSync(HERE('../worker.js'), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const fns = ['isOpenSpotName', 'escapeHtml', 'teamsState', 'partnerCandidates', 'teamRowsFor', 'teamCountSuffix', 'teamBannerHtml', 'teamChipsHtml', 'hostTeamsHtml',
  'hostTeamsCount', 'hostTeamsCount'].filter((n, i, a) => a.indexOf(n) === i);
function load(extra = {}) {
  const ctx = Object.assign({ console, JSON, Math, Number, String, Set, Map, Array, Object, Date,
    currentPlayer: 'Ann', isGuest: () => false, regData: [], gatheringRegData: [], memberData: [] }, extra);
  vm.createContext(ctx);
  const names = ['isOpenSpotName', 'escapeHtml', 'teamSizeOf', 'partnersOf', 'teamNamesText', 'teamMateWord', 'teamsState', 'partnerCandidates', 'teamRowsFor', 'teamCountSuffix', 'teamBannerHtml', 'teamChipsHtml', 'hostTeamsHtml'];
  vm.runInContext(names.map(n => extractFn(src, n)).join('\n'), ctx);
  return ctx;
}
const row = (player, status, partner) => ({ gatheringId: 7, player, status, partner: partner || null });
const C = load();

// 1. locking: both Yes and naming each other
let st = C.teamsState([row('Ann', 'Yes', 'Bob'), row('Bob', 'Yes', 'Ann'), row('Cy', 'Yes'), row('Di', 'Yes', 'Ed')]);
ok(st.teams === 1 && st.pairs[0].join() === 'Ann,Bob', 'Ann & Bob named each other: one locked team');
ok(st.players === 4 && st.unpaired === 2, 'four Yes players, two not on a team');
ok(st.open.join() === 'Cy', 'Cy has not picked anyone: needs a partner');
ok(st.waiting.length === 1 && st.waiting[0].player === 'Di' && st.waiting[0].wants === 'Ed' && st.waiting[0].wantsStatus === 'none', 'Di picked Ed who has not answered: waiting, "none"');
// one-sided picks never lock
st = C.teamsState([row('Ann', 'Yes', 'Bob'), row('Bob', 'Yes')]);
ok(st.teams === 0 && st.waiting[0].wantsStatus === 'pending' && st.open.join() === 'Bob', 'Bob is Yes but has not picked back: still pending, Bob needs a partner');
st = C.teamsState([row('Ann', 'Yes', 'Bob'), row('Bob', 'Yes', 'Cy'), row('Cy', 'Yes', 'Bob')]);
ok(st.pairs.length === 1 && st.pairs[0].join() === 'Bob,Cy' && st.waiting[0].player === 'Ann' && st.waiting[0].wantsStatus === 'other', 'Bob & Cy lock; Ann picked Bob who is teamed with someone else');
// a No or a Sub never locks
st = C.teamsState([row('Ann', 'Yes', 'Bob'), row('Bob', 'No', 'Ann')]);
ok(st.teams === 0 && st.waiting[0].wantsStatus === 'no' && st.players === 1, 'Bob said No: no team, Ann is waiting on someone who cannot make it');
st = C.teamsState([row('Ann', 'Yes', 'Bob'), row('Bob', 'Sub', 'Ann')]);
ok(st.teams === 0 && st.waiting[0].wantsStatus === 'sub' && st.players === 1, 'a Sub does not complete a team');
// names compare case-insensitively; open spots and nobody-names-themselves
st = C.teamsState([row('Ann', 'Yes', 'bob'), row('Bob', 'Yes', 'ANN'), row('Open Spot 1', 'Yes'), row('Cy', 'Yes', 'Cy')]);
ok(st.teams === 1 && st.players === 3, 'case-insensitive names; Open Spots are not players');
ok(st.waiting.length === 0 && st.open.join() === 'Cy', 'a player naming themselves is treated as not having picked anyone');
ok(C.teamsState([]).teams === 0 && C.teamsState(null).players === 0, 'no rows is fine');

// 2. who named whom
st = C.teamsState([row('Ann', 'Yes', 'Bob'), row('Cy', 'Yes', 'Bob'), row('Bob', 'No')]);
ok((st.askedBy['bob'] || []).join() === 'Ann,Cy', 'askedBy lists everyone who picked Bob');

// 3. partner picker order: picked-me first, then still looking, then everyone else, never me / locked / open spots / inactive
const members = ['Ann', 'Bob', 'Cy', 'Di', 'Ed', 'Flo', 'Gus', 'Open Spot 3'].map(display => ({ display })).concat([{ display: 'Old Timer', active: 'InActive' }]);
const rows = [row('Ann', 'Yes'), row('Cy', 'Yes', 'Ann'), row('Di', 'Yes'), row('Ed', 'Yes', 'Flo'), row('Flo', 'Yes', 'Ed'), row('Bob', 'No')];
const cand = C.partnerCandidates(rows, 'Ann', members);
ok(cand[0].name === 'Cy' && cand[0].tag === 'picked you', 'the player who picked me is offered first');
ok(cand[1].name === 'Di' && cand[1].tag === 'needs a partner', 'then players who are Yes and still looking');
ok(!cand.some(c => ['Ann', 'Ed', 'Flo', 'Open Spot 3', 'Old Timer'].includes(c.name)), 'never me, a locked team, an Open Spot or an inactive member');
ok(cand.some(c => c.name === 'Bob') && cand.some(c => c.name === 'Gus'), 'any other active member can still be picked (even someone who has not answered)');
ok(new Set(cand.map(c => c.name)).size === cand.length, 'nobody is listed twice');

// 4. the card count line: players stay the headline, teams follow
const evt = { id: 'gathering-7', gatheringId: 7, teamSize: 2, name: 'Turkey 2Man', rawEventTime: '2026-11-15T09:00:00-05:00' };
ok(C.teamCountSuffix(evt, [row('Ann', 'Yes', 'Bob'), row('Bob', 'Yes', 'Ann'), row('Cy', 'Yes')]) === ' · 1 team · 1 needs a partner', 'one team, one player left');
ok(C.teamCountSuffix(evt, [row('Ann', 'Yes', 'Bob'), row('Bob', 'Yes', 'Ann'), row('Cy', 'Yes', 'Di'), row('Di', 'Yes', 'Cy')]) === ' · 2 teams', 'two teams, nobody left over');
ok(C.teamCountSuffix(evt, [row('Ann', 'Yes'), row('Bob', 'Yes')]) === ' · 0 teams · 2 need a partner', 'nobody paired yet');
ok(C.teamCountSuffix({ teamSize: null }, [row('Ann', 'Yes')]) === '' && C.teamCountSuffix(null, []) === '', 'an ordinary Gathering shows no team text');

// 5. the viewer's prompt
const mk = (me, regs, e = evt) => { const c = load({ currentPlayer: me, regData: regs }); return c.teamBannerHtml(e); };
ok(/Pick your partner/.test(mk('Ann', [row('Ann', 'Yes')])), 'Yes with no partner: asked to pick one');
ok(/picked you as their partner/.test(mk('Ann', [row('Ann', 'Yes'), row('Bob', 'Yes', 'Ann')])) && /Team up with Bob/.test(mk('Ann', [row('Ann', 'Yes'), row('Bob', 'Yes', 'Ann')])), 'Yes and someone picked me: one tap to team up');
ok(/Waiting on Bob/.test(mk('Ann', [row('Ann', 'Yes', 'Bob')])), 'I picked Bob and he has not answered: waiting');
ok(/teamed with Bob/.test(mk('Ann', [row('Ann', 'Yes', 'Bob'), row('Bob', 'Yes', 'Ann')])), 'locked: confirmation with a Change link');
ok(/Bob picked you as their partner/.test(mk('Ann', [row('Bob', 'Yes', 'Ann')])) && /Tap <b>Yes<\/b>/.test(mk('Ann', [row('Bob', 'Yes', 'Ann')])), 'not registered yet but someone picked me: told to tap Yes');
ok(mk('Ann', [row('Ann', 'No')]) === '' && mk('Ann', []) === '', 'a No / nothing to say: no banner');
ok(mk('Ann', [row('Ann', 'Yes')], { gatheringId: 7, teamSize: null, id: 'g' }) === '', 'an ordinary Gathering never shows a team banner');
ok(load({ currentPlayer: 'Ann', isGuest: () => true }).teamBannerHtml(evt) === '', 'guests see no banner');

// 6. the player list shows teams, waiting players and who needs a partner
const chips = C.teamChipsHtml(evt, [row('Ann', 'Yes', 'Bob'), row('Bob', 'Yes', 'Ann'), row('Cy', 'Yes', 'Di'), row('Ed', 'Yes'), row('Gus', 'Sub'), row('Open Spot 1', 'Yes')]);
ok(/🤝 Ann &amp; Bob/.test(chips), 'a locked team reads "Ann & Bob"');
ok(/Cy <span[^>]*>→ Di \(not in yet\)/.test(chips), 'a pending request says who it is waiting on');
ok(/Ed <span[^>]*>· needs a partner/.test(chips) && /Gus \(Sub\)/.test(chips) && /Open Spot 1/.test(chips), 'needs-a-partner, Sub and Open Spot chips');

// 7. host block
const hostC = load({ gatheringRegData: [row('Ann', 'Yes', 'Bob'), row('Bob', 'Yes', 'Ann'), row('Cy', 'Yes'), row('Di', 'Yes')] });
const hb = hostC.hostTeamsHtml({ gatheringId: 7, teamSize: 2 });
ok(/4 players · 1 team · .*2 still need a partner/.test(hb), 'host sees players, teams and how many still need a partner (got ' + hb.replace(/<[^>]+>/g, '').slice(0, 120) + ')');
ok(/openHostPairSheet\(7\)/.test(hb) && /hostUnpair\(7, 0\)/.test(hb), 'host can pair the leftovers and unpair a team');
ok(hostC.hostTeamsHtml({ gatheringId: 7, teamSize: null }) === '' && hostC.hostTeamsHtml(null) === '', 'ordinary Gatherings get no host team block');
const one = load({ gatheringRegData: [row('Ann', 'Yes', 'Bob'), row('Bob', 'Yes', 'Ann'), row('Cy', 'Yes')] }).hostTeamsHtml({ gatheringId: 7, teamSize: 2 });
ok(/One player is left without a partner/.test(one) && !/openHostPairSheet/.test(one), 'a single leftover player cannot be paired with anyone');

// 8. New Gathering wiring and the registration request
ok(/_hostTeams \? \{ team_size: _hostTeams \}/.test(src), 'New Gathering sends team_size only when teams are on');
ok(/_hostTeams && \(size < _hostTeams \|\| size % _hostTeams\)/.test(src), 'Teams refuse a player count that is not whole teams');
ok(/id="host-teams-switch"|'host-teams-switch'/.test(src), 'the Teams of 2 switch is on the New Gathering form');
ok(/teamSizeOf\(evt\) && choice === 'Yes' && !\(opts && opts\.partnerDone\)\) \{ openPartnerSheet/.test(src), 'a Yes on a Teams-of-2 card opens the partner picker first');
ok(/partner !== undefined \? \{ partner_id: partner \|\| null \} : \{\}/.test(src), 'the registration only carries partner_id when one was chosen or cleared');
ok(/teamSize: Number\(g\.team_size\) >= 2 && Number\(g\.team_size\) <= 4/.test(src) && /partner: r\.partner_id \|\| null/.test(src), 'loadGatherings reads team_size and each partner_id');

// 9. the Worker: the columns, the host route, the fallbacks
ok(/UPDATE gatherings SET team_size = \? WHERE id/.test(workerSrc), 'the Worker writes team_size');
ok(/pathname === '\/registrations\/partner'/.test(workerSrc) && /Only the host can pair players/.test(workerSrc), 'host pairing route is host-only');
ok(/partner_id not migrated yet/.test(workerSrc) && /status === 'no'/.test(workerSrc) === false || /finalStatus === 'no'/.test(workerSrc), 'a No clears the partner; the read falls back before the ALTER');

// 10. xMan: teams of 3 and 4 lock only when everyone names everyone
const r3 = (p, st, partner) => ({ gatheringId: 7, player: p, status: st, partner: partner || null });
st = C.teamsState([r3('A', 'Yes', 'B|C'), r3('B', 'Yes', 'A|C'), r3('C', 'Yes', 'B|A'), r3('D', 'Yes')], 3);
ok(st.teams === 1 && st.pairs[0].slice().sort().join() === 'A,B,C' && st.open.join() === 'D' && st.unpaired === 1, 'three Yes players naming each other lock as a 3-man team');
st = C.teamsState([r3('A', 'Yes', 'B|C'), r3('B', 'Yes', 'A|C'), r3('C', 'Yes', 'A')], 3);
ok(st.teams === 0 && st.waiting.length === 3, 'C only named A, so nothing locks and all three are still waiting');
st = C.teamsState([r3('A', 'Yes', 'B|C'), r3('B', 'Yes', 'A|C'), r3('C', 'No', 'A|B')], 3);
ok(st.teams === 0 && st.waiting.find(w => w.player === 'A').wantsStatus === 'no', 'a No on the team means no lock and says so');
st = C.teamsState([r3('A', 'Yes', 'B|C'), r3('B', 'Yes', 'A|D'), r3('C', 'Yes', 'A|B'), r3('D', 'Yes', 'B|A')], 3);
ok(st.teams === 0, 'teams that disagree about who is on them never lock');
st = C.teamsState([r3('A', 'Yes', 'B'), r3('B', 'Yes', 'A')], 3);
ok(st.teams === 0 && st.waiting[0].need === 1, 'a 3-man team with one teammate named needs one more');
st = C.teamsState([r3('A', 'Yes', 'B|C|D'), r3('B', 'Yes', 'A|C|D'), r3('C', 'Yes', 'A|B|D'), r3('D', 'Yes', 'A|B|C'), r3('E', 'Yes', 'F|G|H'), r3('F', 'Yes', 'E|G|H')], 4);
ok(st.teams === 1 && st.pairs[0].length === 4 && st.unpaired === 2, '4-man team locks; the other two are still looking');
ok(C.partnersOf('A|B ').join() === 'A,B' && C.partnersOf(null).length === 0 && C.partnersOf('Solo').join() === 'Solo', 'picks are stored joined with |');
ok(C.teamSizeOf({ teamSize: 3 }) === 3 && C.teamSizeOf({ teamSize: 5 }) === 0 && C.teamSizeOf({}) === 0, 'team size is 2 to 4, else not a team game');
ok(C.teamNamesText(['A', 'B', 'C']) === 'A, B &amp; C', 'names read "A, B & C"');
const cand3 = C.partnerCandidates([r3('Ann', 'Yes'), r3('B', 'Yes', 'Ann|C')], 'Ann', [], 3);
ok(cand3[0].name === 'B' && cand3[0].tag === 'picked you', 'in a 3-man game, whoever picked me is offered first');
// 11. team names: the team's name is whatever its members' rows carry
st = C.teamsState([{ gatheringId: 7, player: 'A', status: 'Yes', partner: 'B', teamName: null }, { gatheringId: 7, player: 'B', status: 'Yes', partner: 'A', teamName: 'Fairway Fugitives' }], 2);
ok(st.teams === 1 && st.names[0] === 'Fairway Fugitives', 'a team takes the name from whichever member has one');
ok(/Fairway Fugitives/.test(C.teamChipsHtml({ teamSize: 2 }, [{ player: 'A', status: 'Yes', partner: 'B', teamName: 'Fairway Fugitives' }, { player: 'B', status: 'Yes', partner: 'A', teamName: 'Fairway Fugitives' }])), 'chips show the team name');
ok(/registrations\/team-name/.test(src) && /ALTER TABLE registrations ADD COLUMN team_name|team_name = \?/.test(workerSrc) && /Only the host or a member of the team can name it/.test(workerSrc), 'portal and Worker have the naming route, host or member only');
// worker
ok(/members/.test(workerSrc) && /A team has at most 4 players/.test(workerSrc), 'the host route takes a whole team (up to 4)');
ok(/picked\.length < 3/.test(workerSrc), 'a player can name up to 3 teammates');

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
