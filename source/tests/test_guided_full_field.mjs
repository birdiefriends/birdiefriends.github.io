// Guided Gathering: when everyone is already named, the "who should we ask" step is skipped.
import fs from 'fs'; import { fileURLToPath } from 'url'; import { extractFn } from './extract.mjs';
const src = fs.readFileSync(fileURLToPath(new URL('../portal.html', import.meta.url)), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const NAMES = ['gfFieldFull', 'gfNext', 'gfBack', 'gfJump', 'gfSummaryLines'];
const api = new Function('deps', `const {gfReadBasics,gfBasicsError,gfRender,gfBuildPlan,showToast,renderHostPanelList}=deps; let _gf=null; ${NAMES.map(n => extractFn(src, n)).join('\n')}
  return { set: v => { _gf = v; }, get: () => _gf, ${NAMES.join(',')} };`)({ gfReadBasics() {}, gfBasicsError: () => null, gfRender() {}, gfBuildPlan: () => ({ confirmed: [], wantGames: false }), showToast() {}, renderHostPanelList() {}, document: { getElementById: () => null } });
const mk = o => Object.assign({ step: 1, target: 4, polling: false, playing: true, confirmed: new Set(['A', 'B', 'C']), ask: null, pickSet: new Set(), wantGames: false }, o);
ok(api.gfFieldFull(mk()), 'host + 3 named = 4 target: full');
ok(!api.gfFieldFull(mk({ confirmed: new Set(['A', 'B']) })), '3 of 4: not full');
ok(!api.gfFieldFull(mk({ polling: true })), 'polling: never full');
ok(!api.gfFieldFull(mk({ playing: false })), 'host not playing: 3 of 4, not full');
api.set(mk()); api.gfNext();
ok(api.get().step === 3 && api.get().ask === 'none', 'full: Next skips the ask step and goes to games, invite-only');
api.gfBack(); ok(api.get().step === 1, 'Back from games returns to who is in, not the skipped step');
api.set(mk({ confirmed: new Set(['A', 'B']) })); api.gfNext();
ok(api.get().step === 2 && api.get().ask === null, 'not full: the ask step still appears');
api.set(mk()); api.gfNext(); api.get().confirmed.delete('A'); api.get().step = 1; api.gfNext();
ok(api.get().step === 2 && api.get().ask === null, 'field no longer full: auto invite-only is cleared, ask step returns');
api.set(mk({ step: 4 })); api.gfJump(2); ok(api.get().step === 1, 'full: the summary Change for "who to ask" goes to who is in');
ok(/step:\s*2,\s*text:\s*'The field is full/.test(extractFn(src, 'gfSummaryLines')), 'summary says the field is full');
console.log(`guided full field: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
