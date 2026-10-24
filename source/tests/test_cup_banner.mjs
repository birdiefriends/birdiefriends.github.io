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
  vm.createContext(c2); vm.runInContext(extractFn(src, 'openCupSelection'), c2);
  await vm.runInContext('openCupSelection("e1")', c2); ok(opened[0] === 'bf-cup-draft.html?event=Test%20BFCup&cap=ZZ99&player=Jake', 'a captain goes to his own screen');
  c2.isCommissioner = () => true; await vm.runInContext('openCupSelection("e1")', c2); ok(opened[1] === 'bf-cup-draft.html?event=Test%20BFCup&host=1&player=Jake', 'the commissioner goes to the host screen');
  c2.isCommissioner = () => false; c2.fetch = async () => { throw new Error('offline'); }; await vm.runInContext('openCupSelection("e1")', c2); ok(opened[2] === 'bf-cup-draft.html?event=Test%20BFCup&player=Jake', 'offline falls back to watching');
}

// who sees the card: captain, registered player, commissioner; nobody else
{
  const c3 = { isRegisteredFor: n => n === 'Mine', isCommissioner: () => false }; vm.createContext(c3); vm.runInContext(extractFn(src, 'cupLiveForMe'), c3);
  const pick = evs => vm.runInContext('cupLiveForMe(' + JSON.stringify(evs) + ')', c3);
  ok(pick([{ event_name: 'Other' }]) === null, 'a player not in the event sees no card');
  ok(pick([{ event_name: 'Mine' }]).event_name === 'Mine', 'a registered player sees the card');
  ok(pick([{ event_name: 'Other', cap_code: 'X' }]).cap_code === 'X', 'a captain sees the card even if not registered');
  c3.isCommissioner = () => true; ok(pick([{ event_name: 'Other' }]) !== null, 'the commissioner sees it');
}
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
