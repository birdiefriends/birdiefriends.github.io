// The host's Fix teams icon on the event card: host/commissioner only, upcoming or today, not closed, not canceled.
import fs from 'fs'; import vm from 'vm'; import { extractFn } from './extract.mjs'; import { fileURLToPath } from 'url';
const src = fs.readFileSync(fileURLToPath(new URL('../portal.html', import.meta.url)), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const ctx = vm.createContext({ console, Date, Number, String, isNaN, currentPlayer: 'Brian', isGuest: () => false, isCommissioner: () => false, _closedGamesGids: new Set() });
vm.runInContext(['eventLocalDay', 'liveEditCardBtnHtml'].map(n => extractFn(src, n)).join('\n') + '\nthis.f = liveEditCardBtnHtml;', ctx);
const f = ctx.f, today = new Date(), yest = new Date(Date.now() - 36 * 3600e3);
const evt = (o) => Object.assign({ source: 'gathering', gatheringId: 7, hostId: 'Brian', dt: today }, o || {});
ok(/openLiveEdit\(7\)/.test(f(evt(), false)) && /Fix teams/.test(f(evt(), false)), 'the host sees Fix teams on their event card');
ok(f(evt({ hostId: 'Sam' }), false) === '', 'another player does not');
ok(f(evt(), true) === '' && f(evt({ dt: yest }), false) === '' && f(evt({ source: 'event' }), false) === '', 'not on a canceled, past or non-Gathering card');
ctx._closedGamesGids.add(7); ok(f(evt(), false) === '', 'not once the games are closed');
ctx._closedGamesGids.clear(); ctx.isCommissioner = () => true; ok(f(evt({ hostId: 'Sam' }), false) !== '', 'the commissioner sees it too');
console.log(`live_edit_card_button: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
