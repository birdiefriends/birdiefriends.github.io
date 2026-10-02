// Games form (v4.11.1): the Gross/Net player list leaves out Open Spots and sorts the real players A to Z.
// Why: strokes typed against "Open Spot 1" were lost when the spot was filled (the fill renames the player
// everywhere except the frozen handicap config), and unset spot rows blocked saving.
import fs from 'fs'; import vm from 'vm';
import { extractFn, loadEngine } from './extract.mjs';
import { fileURLToPath } from 'url';
const src = fs.readFileSync(fileURLToPath(new URL('../portal.html', import.meta.url)), 'utf8');
let pass = 0, fail = 0;
const eq = (a, b, m) => { const ok = JSON.stringify(a) === JSON.stringify(b); ok ? pass++ : fail++; if (!ok) console.log('FAIL', m, '\n  got', JSON.stringify(a), '\n  exp', JSON.stringify(b)); };
const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const SI = [7,11,15,1,5,9,3,17,13,12,6,2,10,4,18,8,14,16], PARS = [4,4,3,4,5,4,5,3,4,3,5,4,4,4,3,4,5,3];
const tees = [{ id: 1, tee_name: 'Green', slope_rating: 132, course_rating: 70.5, par_total: 71, holes: PARS.map((p, i) => ({ par: p, handicap: SI[i] })) }];
const reg = (p, st = 'Yes', gid = 7) => ({ gatheringId: gid, player: p, status: st });
const ctx = { BFEngine: loadEngine(), _gamesFormG: { eventShadow: false }, _gamesFormGathering: 7, _gamesFormTees: tees,
  // registration order as the Worker makes it: held seats first, then the host and crew
  gatheringRegData: [reg('Open Spot 1'), reg('Open Spot 2'), reg('Open Spot 3'), reg('Open Spot 4'),
    reg('Mohamed Walli'), reg('Mike Nagle'), reg('Adam Costa'), reg('Bailed', 'No'), reg('Elsewhere', 'Yes', 9)],
  regData: [], _gamesFormHcp: null, _gamesFormMembers: new Map(), _gamesFormSelected: new Set(['skins']),
  escapeHtml: v => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;'),
  isOpenSpotName: n => /^Open Spot \d+$/i.test(String(n || '').trim()) };
vm.createContext(ctx);
const FNS = ['gamesFormHcpOutHtml', 'gatheringGamesHcpSectionHtml', 'gamesFormEntry', 'gamesFormPlayerNames', 'gamesFormOpenSpotCount', 'gamesFormHcpIsNet', 'gamesFormResolvePlayerHcp', 'gamesFormBuildHandicapConfig', 'gamesFormSetAllTees'];
vm.runInContext(FNS.map(n => extractFn(src, n)).join('\n'), ctx);
const set = h => { ctx._gamesFormHcp = h; };

set({ skins_basis: 'net', birdiepay_basis: 'gross', allowance: 95, players: {} });
eq(ctx.gamesFormPlayerNames(), ['Adam Costa', 'Mike Nagle', 'Mohamed Walli'], 'real players only, A to Z, no Open Spots, no No answers, no other game');
eq(ctx.gamesFormOpenSpotCount(), 4, 'four held seats counted');

// the old failure: a saved key for a spot must not come back or block the save
set({ skins_basis: 'net', birdiepay_basis: 'gross', allowance: 95, players: { 'Open Spot 1': { kind: 'index', teeId: '1' }, 'Zed Late': { kind: 'gross' } } });
eq(ctx.gamesFormPlayerNames(), ['Adam Costa', 'Mike Nagle', 'Mohamed Walli', 'Zed Late'], 'a saved spot key is dropped; a saved real player stays, still sorted');

// saving with spots held no longer needs anything typed for them
set({ skins_basis: 'net', birdiepay_basis: 'gross', allowance: 95, players: {
  'Adam Costa': { kind: 'index', index: 16.6, teeId: '1' }, 'Mike Nagle': { kind: 'given', strokes: 12, teeId: '1' }, 'Mohamed Walli': { kind: 'gross' } } });
const b = ctx.gamesFormBuildHandicapConfig();
eq(b.problem, null, 'no problem with spots still open');
eq(Object.keys(b.config.players), ['Adam Costa', 'Mike Nagle', 'Mohamed Walli'], 'frozen config has the real players, A to Z, and no spot');

// the form says where the spots went
const html = ctx.gatheringGamesHcpSectionHtml();
ok(/4 open spots are not listed/.test(html), 'the net section explains the held seats');
ok(html.indexOf('Adam Costa') < html.indexOf('Mike Nagle') && html.indexOf('Mike Nagle') < html.indexOf('Mohamed Walli'), 'rows render A to Z');
ok(!/Open Spot 1/.test(html), 'no row for Open Spot 1');
ctx.gatheringRegData = [reg('Open Spot 1'), reg('Adam Costa')];
ok(/1 open spot is not listed/.test(ctx.gatheringGamesHcpSectionHtml()), 'singular wording for one seat');
ctx.gatheringRegData = [reg('Adam Costa')];
ok(!/not listed/.test(ctx.gatheringGamesHcpSectionHtml()), 'no note when there are no held seats');

// a weekend event's games work the same way
ctx._gamesFormG = { eventShadow: true, eventName: 'BF Weekend' };
ctx.regData = [{ eventName: 'BF Weekend', player: 'Open Spot 1', status: 'Yes' }, { eventName: 'BF Weekend', player: 'Zed', status: 'Yes' }, { eventName: 'BF Weekend', player: 'Al', status: 'Yes' }];
set({ skins_basis: 'net', birdiepay_basis: 'gross', allowance: 95, players: {} });
eq(ctx.gamesFormPlayerNames(), ['Al', 'Zed'], 'event games: spots left out, A to Z');

console.log(`games open spots: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
