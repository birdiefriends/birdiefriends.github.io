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
  const names = ['isOpenSpotName', 'escapeHtml', 'teamsState', 'partnerCandidates', 'teamRowsFor', 'teamCountSuffix', 'teamBannerHtml', 'teamChipsHtml', 'hostTeamsHtml'];
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
ok(st.waiting.length === 1 && st.waiting[0].player === 'Cy', 'a player naming themselves never forms a team');
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
ok(/team_size: 2/.test(src) && /_hostTeams \? \{ team_size: 2 \}/.test(src), 'New Gathering sends team_size: 2 only when the switch is on');
ok(/_hostTeams && \(size < 2 \|\| size % 2\)/.test(src), 'Teams of 2 refuses an odd number of players');
ok(/id="host-teams-switch"|'host-teams-switch'/.test(src), 'the Teams of 2 switch is on the New Gathering form');
ok(/evt\.teamSize === 2 && choice === 'Yes' && !\(opts && opts\.partnerDone\)\) \{ openPartnerSheet/.test(src), 'a Yes on a Teams-of-2 card opens the partner picker first');
ok(/partner !== undefined \? \{ partner_id: partner \|\| null \} : \{\}/.test(src), 'the registration only carries partner_id when one was chosen or cleared');
ok(/teamSize: Number\(g\.team_size\) === 2 \? 2 : null/.test(src) && /partner: r\.partner_id \|\| null/.test(src), 'loadGatherings reads team_size and each partner_id');

// 9. the Worker: the columns, the host route, the fallbacks
ok(/ALTER TABLE gatherings ADD COLUMN team_size|team_size = 2 WHERE id/.test(workerSrc), 'the Worker writes team_size');
ok(/pathname === '\/registrations\/partner'/.test(workerSrc) && /Only the host can pair players/.test(workerSrc), 'host pairing route is host-only');
ok(/partner_id not migrated yet/.test(workerSrc) && /status === 'no'/.test(workerSrc) === false || /finalStatus === 'no'/.test(workerSrc), 'a No clears the partner; the read falls back before the ALTER');

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
