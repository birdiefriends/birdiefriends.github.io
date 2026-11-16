// Live Edit (Dev-101) glue: state loader and the one-publish save (version-checked, stale refused, no-show registrations set to No).
import fs from 'fs'; import vm from 'vm';
import { extractFn, loadEngine } from './extract.mjs';
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const src = fs.readFileSync(new URL('../portal.html', import.meta.url), 'utf8');
const E = loadEngine(), LE = E.BFLiveEdit;
const set = { v: 1, mode: 'shotgun', holes: 18, group_size: 4, status: 'final', groups: [{ members: ['A','B','C','D'], start_hole: 1 }, { members: ['E','F','G','H'], start_hole: 4 }] };
const calls = [];
let serverVersion = 5;
const ctx = { console, BFEngine: E, GATHERINGS_API: 'https://api', currentPlayer: 'Host',
  gatheringData: [{ gatheringId: 104, name: 'Turkey 2Man', teamSize: 2 }],
  gatheringRegData: ['A','B','C','D','E','F','G','H'].map(p => ({ gatheringId: 104, player: p, status: 'Yes' })),
  _groupSets: { 104: { published: set, version: 5 } },
  teamSizeOf: x => Number(x && x.teamSize) || 0,
  teamsState: () => ({ pairs: [['A','B'],['C','D'],['E','F'],['G','H']], names: ['','','',''] }),
  gatheringsFetchJSON: async (url, opts) => { const b = JSON.parse(opts.body); calls.push({ url, b });
    if (/publish$/.test(url)) return b.if_version !== serverVersion ? { error: 'stale', code: 'stale', version: serverVersion } : { ok: true, version: ++serverVersion, notified: 1 };
    return { ok: true }; } };
vm.createContext(ctx);
vm.runInContext(['liveEditState','liveEditSave'].map(n => extractFn(src, n)).join('\n') + '\nthis.f={liveEditState,liveEditSave};', ctx);
const st0 = ctx.f.liveEditState(104);
ok(st0.planned.players === 8 && st0.teams.length === 4 && st0.team_size === 2, 'state built from the plan and the registration teams');
const next = LE.apply(st0, [{ op: 'out', player: 'H', reason: 'noshow' }, { op: 'join', player: 'G', with: 'E' }]).state;
const res = await ctx.f.liveEditSave(104, next, 'Turkey 2Man');
const pub = calls[0];
ok(/publish$/.test(pub.url) && pub.b.if_version === 5, 'one publish call carrying the version it started from');
ok(pub.b.draft.teams.some(t => t.members.length === 3) && pub.b.draft.out.h.reason === 'noshow' && pub.b.draft.planned.players === 8, 'document carries teams, out and the plan counts');
ok(pub.b.draft.mode === 'shotgun' && pub.b.draft.status === 'final' && pub.b.draft.groups[1].members.includes('G'), 'rest of the Groups document kept');
ok(calls.length === 2 && /registrations$/.test(calls[1].url) && calls[1].b.status === 'no' && calls[1].b.player_id === 'H', 'no-show registration set to No');
ok(ctx.gatheringRegData.find(r => r.player === 'H').status === 'No' && ctx._groupSets[104].version === 6 && res.version === 6, 'local state updated');
// second edit starts from the saved copy, not from the registrations
const st1 = ctx.f.liveEditState(104);
ok(st1.planned.players === 8 && st1.out.h && st1.teams.some(t => t.members.length === 3), 'second session starts from the as-played copy; plan counts kept');
// stale editor is refused, and nothing local changes
ctx._groupSets[104].version = 5;   // this phone is behind (server is at 6)
let err = null; try { await ctx.f.liveEditSave(104, next, 'x'); } catch (e) { err = e; }
ok(err && err.code === 'stale', 'a stale editor is refused');
ok(ctx._groupSets[104].version === 5, 'a refused save changes nothing locally');
console.log(`live_edit_save: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
