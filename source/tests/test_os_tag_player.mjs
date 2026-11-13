// The portal tags this device with player_name so Worker pushes (birdie alerts, Plans, host notices) can find the person.
import fs from 'fs'; import vm from 'vm';
import { extractFn } from './extract.mjs';
import { fileURLToPath } from 'url';
const src = fs.readFileSync(fileURLToPath(new URL('../portal.html', import.meta.url)), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const store = {}, tags = [];
const ctx = { console, currentPlayer: 'Dave Sherwin', localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
  OneSignal: { User: { addTag: (k, v) => tags.push([k, v]) } } };
vm.createContext(ctx);
vm.runInContext(extractFn(src, 'osTagPlayer') + '\nthis.T = osTagPlayer;', ctx);
ctx.T(); ok(tags.length === 1 && tags[0][0] === 'player_name' && tags[0][1] === 'Dave Sherwin', 'tags the device with the signed-in player');
ctx.T(); ok(tags.length === 1, 'not re-sent when unchanged');
ctx.T(true); ok(tags.length === 2, 'force re-sends (new subscription)');
ctx.currentPlayer = 'Brian Hager'; ctx.T(); ok(tags.length === 3 && tags[2][1] === 'Brian Hager', 'follows a player switch on the same device');
ctx.currentPlayer = 'Guest'; ctx.T(true); ok(tags.length === 3, 'never tags Guest');
ctx.currentPlayer = ''; ctx.T(true); ok(tags.length === 3, 'never tags nobody');
ctx.currentPlayer = 'Dave Sherwin'; ctx.OneSignal = undefined; let threw = false; try { ctx.T(true); } catch (e) { threw = true; } ok(!threw, 'no SDK loaded is harmless');
ok(/osTagPlayer\(\);\s*const subId = OneSignal\.User\.PushSubscription\.id;/.test(src) && (src.match(/osTagPlayer\(true\)/g) || []).length === 2, 'wired into every app load, first subscribe and the Sync button');
console.log(`os_tag_player: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
