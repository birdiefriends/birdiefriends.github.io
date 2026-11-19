// A player the host took out cannot be scored (hidden from the scoring screen, a stale phone's tap is refused), and a no-show's registration is set to No with retries.
import fs from 'fs'; import vm from 'vm'; import { extractFn } from './extract.mjs'; import { fileURLToPath } from 'url';
const src = fs.readFileSync(fileURLToPath(new URL('../portal.html', import.meta.url)), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const toasts = []; let attempts = 0, failUntil = 0; const store = {};
const ctx = vm.createContext({ console, JSON, Date, Math, Number, String, Array, Object, Promise, setTimeout: (f) => f(), toasts, showToast: m => toasts.push(m),
  localStorage: { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v; } }, GATHERINGS_API: 'https://api',
  gatheringsFetchJSON: async () => { attempts++; if (attempts <= failUntil) throw new Error('offline'); return { ok: true }; },
  gatheringRegData: [{ gatheringId: 7, player: 'Bob', status: 'Yes' }], renderAll: () => {} });
vm.runInContext(`let _sk = { gid: 7, dirty: {}, cards: {} }; let _groupSets = { 7: { published: { out: { bob: { player: 'Bob', reason: 'noshow' } } }, version: 3 } };
function skCardOf(n) { return _sk.cards[n] || (_sk.cards[n] = new Array(18).fill(null)); } function skPersist() {} function skQueueSave() { this.queued = (this.queued || 0) + 1; }
` + ['skIsOut', 'skSetScoreOne', 'liveEditSetRegNo', 'liveEditPending', 'liveEditPendingSet', 'liveEditPendingAdd', 'liveEditRetryPending'].map(n => extractFn(src, n)).join('\n') + '\nthis.api={skIsOut,skSetScoreOne,liveEditSetRegNo,liveEditPending,liveEditPendingAdd,liveEditRetryPending,get:()=>_sk};', ctx);
const A = ctx.api;
ok(A.skIsOut('Bob') && A.skIsOut(' bob ') && !A.skIsOut('Ann'), 'Bob is out; Ann is not (names are matched loosely)');
A.skSetScoreOne('Bob', 3, 5);
ok(toasts.length === 1 && /marked out by the host/.test(toasts[0]) && !A.get().dirty.Bob && !(A.get().cards.Bob && A.get().cards.Bob[2]), 'a score for an out player is refused, with a reason, and nothing is stored');
A.skSetScoreOne('Ann', 3, 4); ok(A.get().cards.Ann[2] === 4, 'an ordinary player still scores');
// registration sync: retried, then remembered
(async () => {
  failUntil = 2; attempts = 0; ok(await A.liveEditSetRegNo(7, 'Bob') === true && attempts === 3, 'two failures then success: the third try sets Bob to No');
  failUntil = 99; attempts = 0; ok(await A.liveEditSetRegNo(7, 'Bob') === false && attempts === 3, 'three failures: gives up after three tries');
  A.liveEditPendingAdd(7, 'Bob'); A.liveEditPendingAdd(7, 'Bob'); ok(A.liveEditPending().length === 1, 'the failed one is kept once');
  failUntil = 0; attempts = 0; await A.liveEditRetryPending(); ok(A.liveEditPending().length === 0 && ctx.gatheringRegData[0].status === 'No', 'the next refresh retries it, sets Bob to No and clears the list');
  console.log(`noshow_guards: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
