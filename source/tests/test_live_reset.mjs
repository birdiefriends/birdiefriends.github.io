// "Reset to automatic": clears forced start, Live Test Mode and any manual stop, closes nothing.
import fs from 'fs'; import vm from 'vm';
import { extractFn } from './extract.mjs';
import { fileURLToPath } from 'url';
const src = fs.readFileSync(fileURLToPath(new URL('../portal.html', import.meta.url)), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const posts = [], toasts = [], removed = [];
const ctx = { console, Promise, Error, setTimeout: () => {}, location: { reload() {} }, localStorage: { removeItem: k => removed.push(k) },
  postFlag: async (k, v) => { posts.push([k, v]); }, showToast: m => toasts.push(m), updateEventControlUI() {}, getLiveEvent: () => ({ name: 'X' }),
  LIVE_TEST_EVENT_KEY: 'bf_live_test_event' };
vm.createContext(ctx);
vm.runInContext('let LIVE_OVERRIDE = true, LIVE_OVERRIDE_SINCE = "t", LIVE_STOPPED_ROUND = "2026 BFSeries#9", LIVE_EVENT_TEST_MODE = true, LIVE_TEST_EVENT_OVERRIDE = "R";\n' + extractFn(src, 'eventControl') + '\nthis.run = eventControl; this.st = () => [LIVE_OVERRIDE, LIVE_STOPPED_ROUND, LIVE_EVENT_TEST_MODE, LIVE_TEST_EVENT_OVERRIDE];', ctx);
await ctx.run('reset');
const m = Object.fromEntries(posts);
ok(m.live_override === false && m.live_stopped_round === null && m.live_test === false, 'reset clears override, stop and test mode on the server');
ok(JSON.stringify(ctx.st()) === JSON.stringify([false, null, false, null]), 'reset clears the local state');
ok(removed.includes('bf_live_test_event'), 'reset clears the device-only round pick');
ok(!posts.some(p => p[0] === 'live_stopped_round' && p[1] && p[1] !== null), 'reset never records a stop');
ok(/\bid="btn-event-reset"/.test(src) && /eventControl\('reset'\)/.test(src), 'button is on the Event Day panel');
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
