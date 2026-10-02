// Guided New Gathering (v4.11.0, spec §11) — runs the REAL functions from portal.html.
// Pins: the answers -> plan decision table, polling (no size, tee time suggested),
// confirmed players registered Yes, a saved crew never changed to fit one game,
// the exact create calls and notifications (incl. Walli's "Mike and Adam in, then
// open to everyone"), validation, the summary, and the wiring into the Host Panel
// and the shared player picker.
import fs from 'fs';
import { extractFn } from './extract.mjs';
const src = fs.readFileSync(new URL('../portal.html', import.meta.url), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m}: got ${JSON.stringify(a)} want ${JSON.stringify(b)}`);

const NAMES = ['gfFresh', 'gfBuildPlan', 'gfSummaryLines', 'gfCtx', 'gfBasicsError', 'gfReadBasics', 'gfPostCrew', 'gfPickCrew', 'gfCreate'];
function world(over = {}) {
  const calls = [], pushes = [], toasts = [], games = [];
  const members = over.members || [
    { display: 'Walli', gatheringAlerts: 'Yes', active: 'Active' }, { display: 'Mike', gatheringAlerts: 'Yes', active: 'Active' },
    { display: 'Adam', gatheringAlerts: 'Yes', active: 'Active' }, { display: 'Tom', gatheringAlerts: 'Yes', active: 'Active' },
    { display: 'Lou', gatheringAlerts: 'No', active: 'Active' }, { display: 'Old', gatheringAlerts: 'Yes', active: 'InActive' },
    { display: 'Jeff', gatheringAlerts: 'Yes', active: 'Active' } ];
  const deps = {
    currentPlayer: 'Walli', memberData: members, GATHERINGS_API: 'https://g', HOST_QID: '', JF_API: '', JOTFORM_API_KEY: '',
    _hostSavedCrews: over.crews || [{ id: 3, name: 'Sham' }],
    GATHERING_GAMES_META: { skins: { label: 'Skins', icon: 'x' }, cttp: { label: 'CTP', icon: 'y' } },
    gatheringsFetchJSON: async (url, opt) => {
      const body = opt && opt.body ? JSON.parse(opt.body) : null;
      calls.push({ url: url.replace('https://g', ''), body });
      if (url.endsWith('/crews') && opt) return { ok: true, id: 50 + calls.filter(c => c.url === '/crews').length };
      if (url.includes('/crews/') && url.endsWith('/members')) return { ok: true, player_ids: over.crewMembers || ['Mike', 'Adam', 'Tom', 'Walli'] };
      if (url.endsWith('/gatherings')) return { ok: true, id: 99 };
      return { ok: true };
    },
    osSendToPlayers: (names, title, text, link, type, meta) => { pushes.push({ names, title, text, type, meta }); return Promise.resolve(); },
    showToast: (m, bad) => toasts.push({ m, bad }), toTitleCase: s => s, toLocalISOString: d => 'ISO:' + d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(),
    formatDate: () => 'Sat, Oct 10', formatTime: () => '8:00 AM', escapeHtml: s => String(s),
    refreshGatherings: async () => {}, loadHostSpots: async () => {}, renderHostPanelList: () => { calls.push({ url: 'HOSTPANEL' }); },
    gatheringData: [{ gatheringId: 99 }], showGatheringGamesForm: async (id, picks) => { games.push({ id, picks }); },
    gfRender: () => {}, document: { getElementById: () => null }, fetch: async () => ({}), console,
  };
  const code = NAMES.map(n => extractFn(src, n)).join('\n');
  const api = new Function('deps', `const {${Object.keys(deps).join(',')}} = deps; let _gf = null; ${code};
    return { set: v => { _gf = v; }, get: () => _gf, ${NAMES.join(',')} };`)(deps);
  return { api, calls, pushes, toasts, games };
}
const future = () => { const d = new Date(Date.now() + 5 * 864e5); return d.toISOString().slice(0, 10); };
function state(api, o = {}) {
  const st = Object.assign(api.gfFresh(), { title: 'Sham Saturday', venue: 'Blue Shamrock Golf Club', date: future(), time: '08:00' }, o);
  for (const k of ['confirmed', 'pickSet', 'games']) if (Array.isArray(st[k])) st[k] = new Set(st[k]);
  return st;
}
const ctx = (over = {}) => Object.assign({ host: 'Walli', crewMembers: [], members: [] }, over);
const W = world().api;

// ── decision table (spec §11) ──
let p = W.gfBuildPlan(state(W, { ask: 'crew', crewId: 3, confirmed: ['Mike'] }), ctx({ crewMembers: ['Mike', 'Adam', 'Tom', 'Walli'] }));
eq(p.crew, { kind: 'saved', id: 3 }, 'crew ask, confirmed inside the crew -> the saved crew itself');
eq(p.invitees, ['Adam', 'Tom'], 'crew ask: invitees are the crew minus confirmed minus host');
eq(p.confirmed, ['Mike'], 'confirmed list'); eq(p.registerYes, ['Walli', 'Mike'], 'host + confirmed registered Yes');
eq(p.fillListEnabled, false, 'crew ask is invite-only');
p = W.gfBuildPlan(state(W, { ask: 'crew', crewId: 3, confirmed: ['Jeff'] }), ctx({ crewMembers: ['Mike', 'Adam'] }));
eq(p.crew, { kind: 'new', name: null, players: ['Mike', 'Adam', 'Jeff'] }, 'confirmed outside a saved crew -> one-off crew; the saved crew is not changed');
p = W.gfBuildPlan(state(W, { ask: 'pick', pickSet: ['Tom', 'Jeff'], confirmed: ['Mike'] }), ctx());
eq(p.crew, { kind: 'new', name: null, players: ['Tom', 'Jeff', 'Mike'] }, 'pick ask: crew = picks + confirmed (confirmed must be able to see the game)');
eq(p.invitees, ['Tom', 'Jeff'], 'pick ask: invitees exclude confirmed'); eq(p.saveCrew, null, 'unnamed pick is not saved');
p = W.gfBuildPlan(state(W, { ask: 'pick', pickSet: ['Tom', 'Jeff'], pickName: 'Tuesday Four' }), ctx());
eq(p.crew, { kind: 'new', name: 'Tuesday Four', players: ['Tom', 'Jeff'] }, 'named pick, nobody extra confirmed -> the named crew is the game crew');
p = W.gfBuildPlan(state(W, { ask: 'pick', pickSet: ['Tom', 'Jeff'], pickName: 'Tuesday Four', confirmed: ['Mike'] }), ctx());
eq(p.crew.name, null, 'named pick + outside confirmed -> game uses a one-off crew');
eq(p.saveCrew, { name: 'Tuesday Four', players: ['Tom', 'Jeff'] }, '... and the named crew saves only the picks');
p = W.gfBuildPlan(state(W, { ask: 'all', confirmed: ['Mike', 'Adam'] }), ctx({ members: world().api && [
  { display: 'Walli', gatheringAlerts: 'Yes' }, { display: 'Mike', gatheringAlerts: 'Yes' }, { display: 'Adam', gatheringAlerts: 'Yes' },
  { display: 'Tom', gatheringAlerts: 'Yes' }, { display: 'Lou', gatheringAlerts: 'No' }, { display: 'Old', gatheringAlerts: 'Yes', active: 'InActive' }] }));
eq(p.fillListEnabled, true, 'all -> open to members'); eq(p.crew, { kind: 'none' }, 'all -> no crew');
eq(p.openAnnounce, ['Tom'], 'announce: alerts on, active, not the host, not already confirmed');
p = W.gfBuildPlan(state(W, { ask: 'none' }), ctx());
eq(p.crew, { kind: 'none' }, 'nobody yet, nobody confirmed -> no crew (host-only until opened)'); eq(p.fillListEnabled, false, 'invite-only');
p = W.gfBuildPlan(state(W, { ask: 'none', confirmed: ['Mike', 'Adam'] }), ctx());
eq(p.crew, { kind: 'new', name: null, players: ['Mike', 'Adam'] }, 'nobody yet + confirmed -> they get a one-off crew so they can see it');
eq(p.invitees, [], 'nobody else is asked');

// ── polling and capacity ──
p = W.gfBuildPlan(state(W, { ask: 'none', polling: true }), ctx());
eq([p.size, p.teeTimeStatus], [null, 'suggested'], 'polling: no size, tee time suggested');
p = W.gfBuildPlan(state(W, { ask: 'none', target: 6 }), ctx());
eq([p.size, p.teeTimeStatus], [6, 'confirmed'], 'a target: size set, tee time confirmed');
p = W.gfBuildPlan(state(W, { ask: 'none', playing: false }), ctx());
eq(p.registerYes, [], 'not playing -> host not registered');
p = W.gfBuildPlan(state(W, { ask: 'none', confirmed: ['Walli', 'Mike'] }), ctx());
eq(p.confirmed, ['Mike'], 'host listed as confirmed is dropped (never a self-invite)');

// ── validation ──
ok(W.gfBuildPlan(state(W, { ask: null }), ctx()).errors.length === 1, 'no ask chosen -> error');
ok(W.gfBuildPlan(state(W, { ask: 'crew', crewId: null }), ctx()).errors.length === 1, 'crew without a crew -> error');
ok(W.gfBuildPlan(state(W, { ask: 'pick' }), ctx()).errors.length === 1, 'pick with nobody -> error');
p = W.gfBuildPlan(state(W, { ask: 'none', target: 2, confirmed: ['Mike', 'Adam'] }), ctx());
ok(p.errors.length === 1 && /hoping for 2/.test(p.errors[0]), 'more confirmed than the target -> error');
ok(W.gfBuildPlan(state(W, { ask: 'none', target: 2, confirmed: ['Mike', 'Adam'], polling: true }), ctx()).errors.length === 0, 'polling: no capacity error');
eq(W.gfBasicsError(state(W, { title: '' })), 'Give it a name', 'title required');
eq(W.gfBasicsError(state(W, { venue: '' })), 'Pick a venue', 'venue required');
eq(W.gfBasicsError(state(W, { date: '' })), 'Pick a date and time', 'date required');
eq(W.gfBasicsError(state(W, { date: '2020-01-01' })), 'The date and time must be in the future', 'past date refused');
eq(W.gfBasicsError(state(W)), null, 'a good basics step passes');

// ── the summary ──
let lines = W.gfSummaryLines(state(W, { ask: 'all', confirmed: ['Mike', 'Adam'], games: ['skins'] }), ctx());
ok(lines.length === 5 && lines.every(l => typeof l.step === 'number'), 'five summary lines, each with a step to jump to');
ok(/In: you, Mike, Adam/.test(lines[2].text), 'summary: who is in'); ok(/Open to all BirdieFriends/.test(lines[3].text), 'summary: open to all');
ok(/Games: Skins/.test(lines[4].text), 'summary: games');
lines = W.gfSummaryLines(state(W, { ask: 'none', polling: true }), ctx());
ok(/Polling/.test(lines[1].text) && /Invite-only/.test(lines[3].text) && lines[4].text === 'No games', 'summary: polling, invite-only, no games');

// ── gfCreate: Walli's case — Mike and Adam in, then open to everyone ──
{
  const w = world(); const st = state(w.api, { ask: 'all', confirmed: ['Mike', 'Adam'], target: 4 }); w.api.set(st);
  await w.api.gfCreate();
  const post = w.calls.find(c => c.url === '/gatherings');
  ok(post && post.body.title === 'Sham Saturday' && post.body.size === 4 && post.body.fill_list_enabled === true && post.body.crew_id === null, 'create: open, size 4, no crew');
  ok(post.body.tee_time_status === 'confirmed' && post.body.holes === 18 && post.body.gathering_type === 'Individual Play' && post.body.auto_repeat === false, 'create: defaults');
  ok(post.body.host_id === 'Walli' && /^ISO:/.test(post.body.event_time), 'create: host and local ISO time');
  eq(w.calls.filter(c => c.url === '/registrations').map(c => c.body.player_id).sort(), ['Adam', 'Mike', 'Walli'], 'Yes for the host and both confirmed players');
  ok(w.calls.filter(c => c.url === '/registrations').every(c => c.body.status === 'yes' && c.body.gathering_id === 99), 'registrations are Yes for the new game');
  ok(!w.calls.some(c => c.url === '/crews'), 'no crew is created for an open game');
  const conf = w.pushes.find(x => /added you/.test(x.text)), open = w.pushes.find(x => x.type === 'gathering_open_invite');
  eq(conf.names, ['Mike', 'Adam'], 'confirmed players get the "you are signed up" notice');
  eq(open.names, ['Tom', 'Jeff'], 'everyone else with alerts on gets the open announcement (not Lou, Old, the host, or the confirmed)');
  ok(w.pushes.length === 2, 'exactly two notices'); ok(w.calls.at(-1).url === 'HOSTPANEL', 'back to the Host Panel'); eq(w.api.get(), null, 'flow state cleared');
}
// ── polling + invite-only: nothing sent, no size ──
{
  const w = world(); w.api.set(state(w.api, { ask: 'none', polling: true })); await w.api.gfCreate();
  const post = w.calls.find(c => c.url === '/gatherings');
  ok(post.body.size === null && post.body.tee_time_status === 'suggested' && post.body.fill_list_enabled === false && post.body.crew_id === null, 'polling invite-only create');
  eq(w.calls.filter(c => c.url === '/registrations').map(c => c.body.player_id), ['Walli'], 'only the host signed up');
  ok(w.pushes.length === 0, 'nobody is notified');
}
// ── saved crew: used as is, members asked, confirmed told ──
{
  const w = world(); w.api.set(state(w.api, { ask: 'crew', crewId: 3, crewName: 'Sham', crewMembers: ['Mike', 'Adam', 'Tom'], confirmed: ['Mike'] }));
  await w.api.gfCreate();
  const post = w.calls.find(c => c.url === '/gatherings');
  ok(post.body.crew_id === 3 && post.body.fill_list_enabled === false, 'saved crew used directly');
  ok(!w.calls.some(c => c.url === '/crews'), 'no new crew; the saved crew is not touched');
  eq(w.pushes.find(x => /invited you/.test(x.text)).names, ['Adam', 'Tom'], 'the rest of the crew is invited');
  eq(w.pushes.find(x => /added you/.test(x.text)).names, ['Mike'], 'the confirmed player is told they are in');
}
// ── pick people, named: crew saved, games hand-off ──
{
  const w = world(); w.api.set(state(w.api, { ask: 'pick', pickSet: ['Tom', 'Jeff'], pickName: 'Tuesday Four', confirmed: ['Mike'], games: ['skins', 'cttp'] }));
  await w.api.gfCreate();
  const crews = w.calls.filter(c => c.url === '/crews');
  eq(crews.map(c => [c.body.name, c.body.player_ids]), [[null, ['Tom', 'Jeff', 'Mike']], ['Tuesday Four', ['Tom', 'Jeff']]], 'one-off crew for the game, plus the named crew saved with only the picks');
  eq(w.games, [{ id: 99, picks: ['skins', 'cttp'] }], 'games go to the stakes screen for the new game');
}
// ── validation blocks the create ──
{
  const w = world(); w.api.set(state(w.api, { ask: null })); await w.api.gfCreate();
  ok(!w.calls.some(c => c.url === '/gatherings') && w.toasts.length === 1 && w.toasts[0].bad, 'no ask: nothing is created, one error shown');
  const w2 = world(); w2.api.set(state(w2.api, { ask: 'none', title: '' })); await w2.api.gfCreate();
  ok(!w2.calls.some(c => c.url === '/gatherings'), 'no title: nothing is created');
}

// ── wiring ──
ok(/<button class="host-action-btn" onclick="showGuidedGathering\(\)">\s*<span class="host-action-icon">⛳<\/span><span class="host-action-label">New<\/span>/.test(src), 'Host Panel "New" opens the guided flow');
ok(/_crewPickerMode === 'guided-in' \|\| _crewPickerMode === 'guided-ask'/.test(extractFn(src, 'closeCrewPicker')) && /gfPickerDone\(/.test(extractFn(src, 'closeCrewPicker')), 'the shared picker hands back to the guided flow');
ok(/_gf\.awaitingName/.test(extractFn(src, 'dismissCrewSaveDialog')) && /gfRender\(\)/.test(extractFn(src, 'dismissCrewSaveDialog')), 'the crew-name dialog hands back to the guided flow');
ok(/onclick="gfUseFullForm\(\)"/.test(extractFn(src, 'gfRender')), 'every step offers the full form');
ok(typeof extractFn(src, 'showNewGatheringForm') === 'string' && typeof extractFn(src, 'submitNewGathering') === 'string', 'the full form is still there');

console.log(`guided gathering: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
