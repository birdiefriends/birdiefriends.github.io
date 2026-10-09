// v4.15.0 — Release 1: one "Add a player" sheet with a member picker, Edit registers picks, read-back after every add.
import fs from 'fs'; import vm from 'vm';
import { extractFn } from './extract.mjs';
const src = fs.readFileSync(new URL('../portal.html', import.meta.url), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const F = n => extractFn(src, n);

// ── pure helpers ──
const H = new Function([F('bfAddPickList'), F('gatheringCanAddPlayers'), F('editNewPlayers'), F('gatheringCountText'),
  'return { bfAddPickList, gatheringCanAddPlayers, editNewPlayers, gatheringCountText };'].join('\n'))();
const members = [
  { display: 'Brian Hager', active: 'Active' }, { display: 'Casey Scanlan', active: 'InActive' },
  { display: 'Mike Scanlan', active: 'Active' }, { display: 'Open Spot 1', active: 'Active' }, { display: 'Ann Lee', active: 'Active' }];
const regs = [
  { gatheringId: 78, player: 'Brian Hager', status: 'Yes' }, { gatheringId: 78, player: 'Mike Scanlan', status: 'Yes' },
  { gatheringId: 78, player: 'Ann Lee', status: 'No' }, { gatheringId: 99, player: 'Casey Scanlan', status: 'Yes' }];
let pl = H.bfAddPickList(members, regs, 78, '');
ok(JSON.stringify(pl.map(x => x.display)) === '["Ann Lee","Casey Scanlan"]', 'picker: excludes players already Yes/Sub here and Open Spots; keeps a "No" and other-game players');
ok(pl.find(x => x.display === 'Casey Scanlan').inactive === true, 'picker: InActive members are listed and flagged, not hidden');
ok(H.bfAddPickList(members, regs, 78, 'cas').length === 1, 'picker: search filters');
ok(H.gatheringCanAddPlayers({ gatheringId: 78, hostId: 'Brian Hager' }, 'Brian Hager', []), 'can add: host');
ok(H.gatheringCanAddPlayers({ gatheringId: 78, hostId: 'X', invited: true }, 'Walli', []), 'can add: invited');
ok(H.gatheringCanAddPlayers({ gatheringId: 78, hostId: 'X' }, 'Mike Scanlan', regs), 'can add: already playing');
ok(!H.gatheringCanAddPlayers({ gatheringId: 78, hostId: 'X' }, 'Stranger', regs), 'cannot add: not involved');
ok(!H.gatheringCanAddPlayers({ gatheringId: 78, hostId: 'X' }, 'Ann Lee', regs), 'cannot add: declined (No)');
ok(JSON.stringify(H.editNewPlayers(['Mike Scanlan', 'Casey Scanlan', 'Brian Hager', 'Open Spot 2'], regs, 78, 'Brian Hager')) === '["Casey Scanlan"]', 'Edit: only picks with no registration row are registered (host, Open Spots, existing rows skipped)');
ok(H.gatheringCountText([{ status: 'Yes', player: 'A' }, { status: 'Yes', player: 'Open Spot 1' }, { status: 'No', player: 'B' }], 4) === '1/4', 'count text ignores Open Spots and No');

// ── runAddPlayer end to end with a fake server ──
function world({ saves = true, readbackDown = false } = {}) {
  const server = [{ player_id: 'Brian Hager', status: 'yes' }, { player_id: 'Mike Scanlan', status: 'yes' }, { player_id: 'Scott Justus', status: 'yes' }];
  const calls = [], toasts = [], errs = [];
  const ctx = {
    console, Date, Promise, JSON, Array, Set, Object, String, URLSearchParams, Error,
    GATHERINGS_API: 'G', BFE_API: 'B', JF_API: 'J', JOTFORM_API_KEY: 'k', currentPlayer: 'Brian Hager',
    gatheringData: [{ gatheringId: 78, name: 'Post-Jefferson Classic', capacity: 4 }],
    gatheringRegData: server.map(r => ({ gatheringId: 78, player: r.player_id, status: 'Yes' })), regData: [],
    memberData: [{ id: '55', display: 'Casey Scanlan', active: 'InActive' }],
    _addP: { opt: { gatheringId: 78, eventName: 'Post-Jefferson Classic' }, busy: false, view: 'pick', cb: null },
    document: { getElementById: () => null }, closeAddPlayerDialog() { ctx._addP = null; }, closePlayerSheet() {},
    showToast: (m) => toasts.push(m), renderAll() {}, renderLiveBanner() {},
    renderAddPlayerForm: (m) => errs.push(m), apOpenSpots: () => [],
    gatheringsFetchJSON: async (u) => {
      if (readbackDown) throw new Error('offline');
      return { ok: true, registrations: server };
    },
    fetch: async (u, o) => {
      calls.push([u, o && o.body]);
      if (u.startsWith('J/')) { return { json: async () => ({ responseCode: 200 }) }; }
      if (u.endsWith('/registrations') && o.method === 'POST') {
        const b = JSON.parse(o.body); if (saves) server.push({ player_id: b.player_id, status: 'yes', added_by: b.added_by });
        return { json: async () => ({ ok: true }) };
      }
      return { json: async () => ({ ok: true }) };
    }
  };
  vm.createContext(ctx);
  vm.runInContext(['gatheringReadBack', 'gatheringCountText', 'activateMemberByName', 'runAddPlayer'].map(F).join('\n') + '; this.runAddPlayer = runAddPlayer;', ctx);
  return { ctx, calls, toasts, errs };
}
let w = world();
await w.ctx.runAddPlayer({ action: 'use', member: w.ctx.memberData[0] });
ok(w.toasts.some(t => t.includes('Casey Scanlan added — 4/4')), 'pick an existing member: toast shows the verified count 4/4');
const regCall = w.calls.find(c => c[0] === 'G/registrations'); const rb = JSON.parse(regCall[1]);
ok(rb.player_id === 'Casey Scanlan' && rb.status === 'yes' && rb.added_by === 'Brian Hager' && rb.gathering_id === 78, 'registration is Yes, marked added_by, for the right game');
ok(w.calls.some(c => c[0].startsWith('J/submission/55') && c[1].includes('Active')), 'an InActive member is flipped back to Active when added');
ok(w.ctx.memberData[0].active === 'Active', 'local member record updated to Active');
ok(w.ctx.gatheringRegData.some(r => r.gatheringId === 78 && r.player === 'Casey Scanlan' && r.status === 'Yes'), 'local roster has Casey from the read-back');
ok(w.errs.length === 0, 'no error shown');

w = world({ saves: false });
await w.ctx.runAddPlayer({ action: 'use', member: w.ctx.memberData[0] });
ok(w.errs.length === 1 && /did not save/i.test(w.errs[0]), 'POST said ok but the roster lacks the player: loud error, not a success');
ok(!w.toasts.some(t => /added/.test(t)), 'no success toast when the read-back disagrees');
ok(!w.ctx.gatheringRegData.some(r => r.player === 'Casey Scanlan'), 'no phantom local row');

w = world({ readbackDown: true });
await w.ctx.runAddPlayer({ action: 'use', member: w.ctx.memberData[0] });
ok(w.errs.length === 0 && w.toasts.some(t => t.includes('Casey Scanlan added')), 'read-back unreachable: add still reported (no false failure), local roster updated');
ok(w.ctx.gatheringRegData.some(r => r.player === 'Casey Scanlan'), 'local fallback adds the row');

// ── wiring ──
const card = src.slice(src.indexOf('function buildAddPlayerBtn'), src.indexOf('function buildPlayerChips'));
ok(card.includes('gatheringCanAddPlayers(evt, currentPlayer, gatheringRegData)') && card.includes('hostAddPlayer('), 'event card: Add a player button, gated');
ok(/\$\{buildAddPlayerBtn\(evt\)\}/.test(src), 'card renders the button in the Players list');
const ed = src.slice(src.indexOf('async function submitEditGathering'), src.indexOf('const GATHERING_GAMES_META'));
ok(ed.includes('editNewPlayers([..._hostCrewPicked]') && ed.includes("status: 'yes', added_by: currentPlayer"), 'Edit registers newly picked players as playing');
ok(/Players you pick here are added to the game as playing/.test(src), 'Edit form tells the host what Save does');
ok(src.includes('apShowNew()') && src.includes('apPickMember('), 'dialog: member picker with New person fallback');
console.log(`fill_seat: ${pass} pass, ${fail} fail`); process.exit(fail ? 1 : 0);
