import fs from 'fs'; import vm from 'vm'; import { extractFn } from './extract.mjs';
import { fileURLToPath } from 'url';
const HERE = (p) => fileURLToPath(new URL(p, import.meta.url));
const src = fs.readFileSync(HERE('../portal.html'), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const G = { source: 'gathering', gatheringId: 42, name: 'Jefferson Event' }, S = { source: 'jotform', name: 'BSGC Series #9' };
function setup(live, { d1Ok = true } = {}) {
  const calls = []; const pushes = []; let undoFn = null; const toasts = [];
  const ctx = { console, JSON, Math, Number, String, Object, Array, parseInt, parseFloat, isNaN, encodeURIComponent, URLSearchParams,
    BFE_API: 'https://bfe', JF_API: 'https://jf', JOTFORM_API_KEY: 'K', CTP_FORM_ID: 'F', CTP_QID: { hole: 'h', player: 'p', event: 'e', dist: 'd' },
    LIVE_EVENT_TEST_MODE: false, currentPlayer: 'Brian Hager', eventData: [G, S], getLiveEvent: () => live,
    renderLiveBanner: () => {}, showToast: (m, e) => toasts.push([m, !!e]), showUndoToast: (m, fn) => { toasts.push([m, false]); undoFn = fn; },
    sendCtpNotification: (h, b) => pushes.push(h), osSendToPlayers: async () => {}, document: { getElementById: () => ({ value: '8.5' }) },
    fetch: async (url, opts = {}) => { calls.push([url, opts.method || 'GET', opts.body]);
      if (url.startsWith('https://bfe/cttp?')) return { json: async () => ({ ok: true, entries: [
        { id: 3, hole: 3, player: 'Tony Choy', dist: 4, captured_at: '2026-09-25 14:00:05' },
        { id: 1, hole: 3, player: 'Scott Justus', dist: 9, captured_at: '2026-09-25 13:10:00' },
        { id: 2, hole: 3, player: 'Brian Hager', dist: 6, captured_at: '2026-09-25 14:00:05' },
        { id: 4, hole: 7, player: 'Rich Potts', dist: null, captured_at: '2026-09-25 14:30:00' } ] }) };
      if (url === 'https://bfe/cttp' && opts.method === 'POST') return { json: async () => d1Ok ? { ok: true, id: 99 } : { ok: false, error: 'db down' } };
      if (url.startsWith('https://jf/form/F/submissions') && opts.method === 'POST') return { json: async () => ({ content: { submissionID: 'J1' } }) };
      if (url.startsWith('https://jf/form/F/submissions')) return { json: async () => ({ content: [] }) };
      return { json: async () => ({ ok: true }) }; } };
  vm.createContext(ctx);
  vm.runInContext(['evtPhotoKey','ctpUsesD1','loadCtpData','submitCttp'].map(n => extractFn(src, n)).join('\n') +
    `\nvar _ctpData = {}, _ctpHistory = {}, _ctpHole = null, _ctpPlayer = null, _ctpSubmitting = false;
     this.get = () => ({ _ctpData, _ctpHistory, _ctpSubmitting }); this.set = (h, p) => { _ctpHole = h; _ctpPlayer = p; };`, ctx);
  return Object.assign(ctx, { calls, pushes, toasts, undo: () => undoFn && undoFn() });
}
// Load — Gathering reads D1 by gathering key, newest leads (id breaks same-second tie)
let c = setup(G); await c.loadCtpData(G);
ok(c.calls[0][0] === 'https://bfe/cttp?event=gathering%3A42', 'D1 read by gathering key: ' + c.calls[0][0]);
let st = c.get();
ok(st._ctpData[3].player === 'Tony Choy' && st._ctpData[3].dist === 4, 'same-second tie → higher id (Tony) leads');
ok(st._ctpHistory[3].map(e => e.player).join() === 'Scott Justus,Brian Hager,Tony Choy', 'history oldest-first');
ok(st._ctpData[7].player === 'Rich Potts' && st._ctpData[7].dist === null, 'null dist kept as null');
ok(!c.calls.some(x => x[0].startsWith('https://jf')), 'no Jotform call for a Gathering');
// Load — Series stays on Jotform
c = setup(S); await c.loadCtpData(S);
ok(c.calls.length === 1 && c.calls[0][0].startsWith('https://jf/form/F/submissions'), 'Series still reads Jotform');
// Submit — Gathering posts D1 JSON, pushes, undo deletes the D1 row as claimant
c = setup(G); c.set(3, 'Scott Justus'); await c.submitCttp('Jefferson Event');
const post = c.calls.find(x => x[1] === 'POST');
ok(post && post[0] === 'https://bfe/cttp', 'D1 POST route');
const pb = JSON.parse(post[2]);
ok(pb.event_name === 'gathering:42' && pb.hole === 3 && pb.player === 'Scott Justus' && pb.dist === 8.5, 'D1 payload: ' + post[2]);
ok(c.pushes.length === 1 && c.get()._ctpData[3].player === 'Scott Justus', 'push sent + local leader updated');
await c.undo();
const del = c.calls.find(x => x[1] === 'DELETE');
ok(del && del[0] === 'https://bfe/cttp/99?requested_by=Scott%20Justus', 'undo deletes D1 row as claimant: ' + (del && del[0]));
ok(!c.calls.some(x => x[0].startsWith('https://jf')), 'no Jotform call on Gathering submit/undo');
// Submit — D1 failure: no push, no local leader, error toast
c = setup(G, { d1Ok: false }); c.set(3, 'Scott Justus'); await c.submitCttp('Jefferson Event');
ok(c.pushes.length === 0 && !c.get()._ctpData[3] && c.toasts.some(t => t[1]) && c.get()._ctpSubmitting === false, 'failed save → no push, no leader, error toast, unlocked');
// Submit — Series still Jotform; undo still Jotform
c = setup(S); c.set(5, 'Brian Hager'); await c.submitCttp('BSGC Series #9');
ok(c.calls.some(x => x[1] === 'POST' && x[0].startsWith('https://jf/form/F/submissions')), 'Series submit → Jotform');
await c.undo();
ok(c.calls.some(x => x[1] === 'DELETE' && x[0] === 'https://jf/submission/J1?apiKey=K'), 'Series undo → Jotform');
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
