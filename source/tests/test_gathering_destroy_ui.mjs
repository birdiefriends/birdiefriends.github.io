// Commissioner "Delete this round" in the portal: who sees the button, the typed-title gate, the request, the refresh.
import fs from 'fs'; import vm from 'vm'; import { fileURLToPath } from 'url';
import { extractFn } from './extract.mjs';
const src = fs.readFileSync(fileURLToPath(new URL('../portal.html', import.meta.url)), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
let gcd = 0, panelClosed = 0, commish = true, answer = 'Testgames1', calls = [], toasts = [], refreshed = 0, closed = 0, reload = 0, resp = { ok: true, status: 200, body: { ok: true, title: 'Testgames1', deleted: { registrations: 4, scorecards: 4 } } };
const ctx = { console, JSON, Number, String, Promise, setTimeout, BFE_API: 'https://bfe', COMMISSIONER_PIN: '7797',
  isCommissioner: () => commish, prompt: () => answer, showToast: (m, e) => toasts.push([m, !!e]),
  fetch: async (u, o) => { calls.push([u, JSON.parse(o.body)]); return { ok: resp.ok, json: async () => resp.body }; },
  refreshGatherings: async () => { refreshed++; }, closeHistoryDetailView: () => { closed++; }, loadMyHistory: async () => { reload++; }, closeHostSheet: () => {}, closeGamesCardDialog: () => { gcd++; }, closeHostPanel: () => { panelClosed++; } };
vm.createContext(ctx);
vm.runInContext(['destroyRoundButtonHtml', 'destroyRound'].map(n => extractFn(src, n)).join('\n') + '\nthis.f={destroyRoundButtonHtml,destroyRound};', ctx);
const f = ctx.f;
ok(/destroyRound\(7,'Testgames1'\)/.test(f.destroyRoundButtonHtml(7, 'Testgames1', 'history')), 'commissioner sees the button');
commish = false;
ok(f.destroyRoundButtonHtml(7, 'Testgames1', 'history') === '', 'everyone else sees nothing');
await f.destroyRound(7, 'Testgames1'); ok(calls.length === 0, 'and the function itself refuses for a non-commissioner');
commish = true;
ok(f.destroyRoundButtonHtml(null, 'x', 'history') === '' && f.destroyRoundButtonHtml(7, '', 'history') === '', 'no button without a round id and a title');
ok(!/'Bob's/.test(f.destroyRoundButtonHtml(7, "Bob's Round", 'host')) && /Bob\\'s Round/.test(f.destroyRoundButtonHtml(7, "Bob's Round", 'host')), 'an apostrophe in the title cannot break the button');
answer = 'wrong'; await f.destroyRound(7, 'Testgames1');
ok(calls.length === 0 && toasts.slice(-1)[0][1] === true, 'wrong title typed: nothing sent');
answer = null; await f.destroyRound(7, 'Testgames1'); ok(calls.length === 0, 'cancelled prompt: nothing sent');
answer = ' testgames1 '; await f.destroyRound(7, 'Testgames1');
ok(calls.length === 1 && calls[0][0] === 'https://bfe/bfe/gathering-destroy' && calls[0][1].pin === '7797' && calls[0][1].gathering_id === 7 && calls[0][1].confirm_title === ' testgames1 ', 'right title: one request with PIN, id and the typed title');
ok(refreshed === 1 && closed === 1 && reload === 1 && /4 players, 4 scorecards/.test(toasts.slice(-1)[0][0]), 'success: detail closes, lists reload, toast says what went');
resp = { ok: false, status: 409, body: { error: 'This round has 2 photos. Delete them from the round first, then delete the round.' } };
await f.destroyRound(7, 'Testgames1');
ok(/2 photos/.test(toasts.slice(-1)[0][0]) && toasts.slice(-1)[0][1] === true && refreshed === 1, 'a refusal from the Worker is shown, nothing refreshed');
ok(panelClosed >= 1 && gcd >= 1, 'after a delete the Gatherings panel is closed (class), not removed');
console.log(`gathering destroy ui: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
