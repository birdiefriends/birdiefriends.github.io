import fs from 'fs'; import vm from 'vm';
import { extractFn } from './extract.mjs';
const src = fs.readFileSync(new URL('../portal.html', import.meta.url), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : (fail++, console.log('FAIL ' + m)); };
const ctx = { encodeURIComponent, Math, String };
vm.createContext(ctx);
vm.runInContext(extractFn(src, 'cupLiveCard') , ctx);
const card = (ev) => vm.runInContext('cupLiveCard(' + JSON.stringify(ev) + ')', ctx);
let c = card({ event_name: '2026 BF Cup', phase: 'draft', picks: 3, total: 14 });
ok(c.url === 'bf-cup-draft.html?event=2026%20BF%20Cup' && !c.cap && /Pick 4 of 14/.test(c.sub), 'a player watches the draft');
c = card({ event_name: '2026 BF Cup', phase: 'draft', picks: 3, total: 14, cap_code: 'AB12CD' });
ok(/&cap=AB12CD$/.test(c.url) && c.cap && /picking screen/.test(c.sub), 'a captain opens his own screen');
c = card({ event_name: 'X', phase: 'pairs', picks: 14, total: 14 }); ok(/Saturday draw is about to start/.test(c.sub) && c.title === 'Teams are set', 'teams-set phase text');
c = card({ event_name: 'X', phase: 'matchups', cap_code: 'Q' }); ok(/put up or answer/.test(c.sub), 'captain matchup text');
c = card({ event_name: 'X', phase: 'set' }); ok(c.title === 'Matchups are set', 'set phase');

// the event card's Teams button: only on Cup cards, and it routes by who is asking
ok(/formatClass\(evt\.format\) === 'format-cup' \? `\s*<button class="icon-action-btn" onclick="openCupSelection/.test(src), 'a Cup card carries the Teams button');
{
  const opened = []; const c2 = { encodeURIComponent, window: { open: u => opened.push(u) }, eventData: [{ id: 'e1', name: 'Test BFCup' }], BFE_API: 'x', currentPlayer: 'Jake', isCommissioner: () => false,
    fetch: async () => ({ json: async () => ({ events: [{ event_name: 'Test BFCup', cap_code: 'ZZ99' }] }) }) };
  vm.createContext(c2); ['cupNameForCard', 'cupRoundNamesOf', 'openCupSelection'].forEach(f => vm.runInContext(extractFn(src, f), c2));
  await vm.runInContext('openCupSelection("e1")', c2); ok(opened[0] === 'bf-cup-draft.html?event=Test%20BFCup&cap=ZZ99&player=Jake', 'a captain goes to his own screen');
  c2.isCommissioner = () => true; await vm.runInContext('openCupSelection("e1")', c2); ok(opened[1] === 'bf-cup-draft.html?event=Test%20BFCup&host=1&player=Jake', 'the commissioner goes to the host screen');
  c2.isCommissioner = () => false; c2.fetch = async () => { throw new Error('offline'); }; await vm.runInContext('openCupSelection("e1")', c2); ok(opened[2] === 'bf-cup-draft.html?event=Test%20BFCup&player=Jake', 'offline falls back to watching');
}

// who sees the card: captain, registered player, commissioner; nobody else
{
  const c3 = { isRegisteredFor: n => n === 'Mine', isCommissioner: () => false }; vm.createContext(c3); ['cupRoundNamesOf', 'cupLiveForMe'].forEach(f => vm.runInContext(extractFn(src, f), c3));
  const pick = evs => vm.runInContext('cupLiveForMe(' + JSON.stringify(evs) + ')', c3);
  ok(pick([{ event_name: 'Other' }]) === null, 'a player not in the event sees no card');
  ok(pick([{ event_name: 'Mine' }]).event_name === 'Mine', 'a registered player sees the card');
  ok(pick([{ event_name: 'Other', cap_code: 'X' }]).cap_code === 'X', 'a captain sees the card even if not registered');
  c3.isCommissioner = () => true; ok(pick([{ event_name: 'Other' }]) !== null, 'the commissioner sees it');
}

// A real Cup: the card and the registrations carry the ROUND's name; the Cup record is keyed by the event's own name (found via _bfeBackedIndex).
{
  const idx = new Map([['2026 BFCup - Day1', { umbrellaName: '2026 BirdieFriends Cup', roundName: '2026 BFCup - Day1' }], ['2026 BFCup - Day2', { umbrellaName: '2026 BirdieFriends Cup', roundName: '2026 BFCup - Day2' }]]);
  const opened = []; let refreshed = 0;
  const c4 = { encodeURIComponent, window: { open: u => opened.push(u) }, eventData: [{ id: 'd1', name: '2026 BFCup - Day1' }, { id: 'x', name: 'Some Other Game' }], BFE_API: 'x', currentPlayer: 'Jake', isCommissioner: () => false,
    _bfeBackedIndex: idx, refreshBFEBackedIndex: async () => { refreshed++; },
    fetch: async () => ({ json: async () => ({ events: [{ event_name: '2026 BirdieFriends Cup', cap_code: 'ZZ99' }] }) }) };
  vm.createContext(c4); ['cupNameForCard', 'cupRoundNamesOf', 'openCupSelection'].forEach(f => vm.runInContext(extractFn(src, f), c4));
  c4.isCommissioner = () => true; await vm.runInContext('openCupSelection("d1")', c4);
  ok(opened[0] === 'bf-cup-draft.html?event=2026%20BirdieFriends%20Cup&host=1&player=Jake', 'the Day1 card opens the Cup by its own name, not the card\'s name (host screen)');
  c4.isCommissioner = () => false; await vm.runInContext('openCupSelection("d1")', c4);
  ok(opened[1] === 'bf-cup-draft.html?event=2026%20BirdieFriends%20Cup&cap=ZZ99&player=Jake', 'a captain finds his code under the Cup\'s own name');
  await vm.runInContext('openCupSelection("x")', c4);
  ok(/event=Some%20Other%20Game&/.test(opened[2]), 'a card that is not part of a BFE event keeps its own name');
  c4._bfeBackedIndex = new Map(); await vm.runInContext('openCupSelection("d1")', c4);
  ok(refreshed === 1, 'an empty index is refreshed before the link is built');
  const c5 = { isRegisteredFor: n => n === '2026 BFCup - Day2', isCommissioner: () => false, _bfeBackedIndex: idx }; vm.createContext(c5); ['cupRoundNamesOf', 'cupLiveForMe'].forEach(f => vm.runInContext(extractFn(src, f), c5));
  const r5 = vm.runInContext('cupLiveForMe(' + JSON.stringify([{ event_name: '2026 BirdieFriends Cup' }]) + ')', c5);
  ok(r5 && r5.event_name === '2026 BirdieFriends Cup', 'a player registered for a ROUND of the Cup sees the live card');
  c5.isRegisteredFor = () => false; ok(vm.runInContext('cupLiveForMe(' + JSON.stringify([{ event_name: '2026 BirdieFriends Cup' }]) + ')', c5) === null, 'a player registered for no round does not');
}
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
