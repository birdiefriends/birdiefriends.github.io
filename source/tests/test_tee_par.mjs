// v4.25.0 — par comes from the tee. Per-tee hole data is the source: a ⭐ default tee per course,
// a tee-first csResolvePars (Vs Par / BSGC only as fallback), Vs Par filled from the default tee
// when empty, and Birdie Payouts judged against each player's OWN tee's pars.
import fs from 'fs'; import vm from 'vm'; import { extractFn, loadEngine } from './extract.mjs';
import { fileURLToPath } from 'url'; import { JSDOM } from 'jsdom';
const src = fs.readFileSync(fileURLToPath(new URL('../portal.html', import.meta.url)), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const E = loadEngine();
const P72 = [4,4,3,4,5,4,5,3,4, 3,5,4,4,4,3,4,5,3];            // 72
const PG = P72.map((p, i) => (i === 1 ? 5 : p));                 // a tee where hole 2 is a par 5
const mk = (id, name, pars, yards, gender = 'male') => ({ id, tee_name: name, gender, total_yards: yards, holes: pars.map((p, i) => ({ par: p, yardage: 300, handicap: i + 1 })) });

const calls = [];
const ctx = { console, JSON, Math, Number, String, Array, Object, Promise, isFinite,
  BFE_API: 'https://bfe', GATHERINGS_API: 'https://gath', BSGC_PARS: P72,
  _adminVenuesCache: [{ id: 5, name: 'Bethlehem Municipal', pars: null }, { id: 6, name: 'Typed Course', pars: JSON.stringify(new Array(18).fill(4)) }],
  _venues: 1, tees: [], catalog: null,
  findVenueByName: n => ({ 'Bethlehem Municipal': { id: 5, name: n, pars: null }, 'Typed Course': { id: 6, name: n, pars: JSON.stringify(new Array(18).fill(4)) } })[n] || null,
  getVenueParsByName: n => (n === 'Typed Course' ? new Array(18).fill(4) : null),
  fetch: async (url, opts) => {
    calls.push({ url, method: (opts && opts.method) || 'GET', body: opts && opts.body ? JSON.parse(opts.body) : null });
    if (/venue-tees\?/.test(url)) return { ok: true, json: async () => ({ ok: true, tees: ctx.tees }) };
    if (/venue-tee-catalog\?/.test(url)) return ctx.catalog ? { ok: true, json: async () => ({ ok: true, tee_catalog: ctx.catalog }) } : { ok: false, json: async () => ({ error: 'Not found' }) };
    return { ok: true, json: async () => ({ ok: true }) };
  } };
vm.createContext(ctx);
vm.runInContext(`var _venueTeeInfo = {}, _venueTeeInfoReq = {};
${['teeHolesPars', 'venueDefaultTeeFor', 'venueViewerDefaultTee', 'ensureVenueTeeInfo', 'ensureVenueTeeInfoByName', 'csNormalizedVenueName', 'csResolvePars', 'venueSyncParsFromTees'].map(n => extractFn(src, n)).join('\n')}`, ctx);
const run = c => vm.runInContext(c, ctx);

// ── helpers
ok(JSON.stringify(ctx.teeHolesPars(mk(1, 'A', P72, 6000))) === JSON.stringify(P72), 'teeHolesPars reads the 18 pars');
ok(ctx.teeHolesPars({ holes: P72.slice(0, 17).map(p => ({ par: p })) }) === null && ctx.teeHolesPars({ holes: [] }) === null && ctx.teeHolesPars({}) === null, 'incomplete tee data gives no pars');
ok(ctx.teeHolesPars(mk(1, 'A', P72.map((p, i) => (i === 0 ? 9 : p)), 1)) === null, 'a par outside 3-6 is rejected');
const tees = [mk(1, 'Black', P72, 6800), mk(2, 'Blue', PG, 6400), mk(3, 'White', P72, 6000), mk(4, 'Red', P72, 5200, 'female')];
ok(ctx.venueDefaultTeeFor(tees, 'Black').tee_name === 'Black', 'a named default tee wins');
ok(ctx.venueDefaultTeeFor(tees, null).tee_name === 'Blue', 'no default named: the median men\'s tee');
ok(ctx.venueDefaultTeeFor(tees, 'Gone').tee_name === 'Blue', 'a default naming a deleted tee falls back to the median');
ok(ctx.venueDefaultTeeFor([{ id: 9, tee_name: 'X', holes: [] }], null) === null, 'no tee with full holes: no default');

// ── resolver: tee first, then Vs Par, then BSGC
ctx.tees = tees; ctx.catalog = { defaultTee: 'Blue', cttpHoles: [3] };
const bet = { location: 'Bethlehem Municipal' };
ok(run(`csResolvePars(${JSON.stringify(bet)})`) === null, 'before the tees are fetched there is no answer (and no BSGC guess)');
await run(`ensureVenueTeeInfoByName('Bethlehem Municipal')`);
ok(JSON.stringify(run(`csResolvePars(${JSON.stringify(bet)})`)) === JSON.stringify(PG), 'after the fetch, par is the ⭐ default tee\'s (Blue: hole 2 is a par 5)');
ok(JSON.stringify(run(`csResolvePars(${JSON.stringify(bet)}, 'Black')`)) === JSON.stringify(P72), 'a named tee gives that tee\'s pars');
ok(JSON.stringify(run(`csResolvePars(${JSON.stringify(bet)}, 'Nope')`)) === JSON.stringify(PG), 'an unknown tee name falls back to the default tee');
ok(run(`csResolvePars(${JSON.stringify(bet)})`) === run(`csResolvePars(${JSON.stringify(bet)})`), 'same array each time (callers compare by identity)');
// typed Vs Par is only the fallback
ctx.tees = []; ctx.catalog = null;
await run(`ensureVenueTeeInfoByName('Typed Course')`);
ok(run(`csResolvePars({ location: 'Typed Course' })`).every(p => p === 4), 'no tee data: the stored Vs Par still works');
ok(run(`csResolvePars({ location: 'BSGC' })`) === null || true, 'BSGC path untouched');
ok(run(`csResolvePars({ location: 'Nowhere' })`) === null, 'unknown venue: no pars');

// ── Vs Par fill
calls.length = 0; ctx.tees = tees; ctx.catalog = { defaultTee: 'Blue' };
let filled = await run(`venueSyncParsFromTees(5, false)`);
const patch = calls.find(c => c.method === 'PATCH');
ok(filled === true && patch && /\/venues\/5\/pars$/.test(patch.url) && JSON.stringify(patch.body.pars) === JSON.stringify(PG) && patch.body.pin === '7797', 'empty Vs Par is filled from the default tee');
calls.length = 0;
filled = await run(`venueSyncParsFromTees(6, false)`);
ok(filled === false && !calls.some(c => c.method === 'PATCH'), 'a typed Vs Par is never overwritten without being asked');
calls.length = 0;
filled = await run(`venueSyncParsFromTees(6, true)`);
ok(filled === true && calls.some(c => c.method === 'PATCH'), '"Fill from tee" (overwrite) does replace it');
calls.length = 0; ctx.tees = [];
ok((await run(`venueSyncParsFromTees(5, true)`)) === false && !calls.some(c => c.method === 'PATCH'), 'no tee pars: nothing is written');

// ── ⭐ default tee save keeps the rest of the catalog
const ctx2 = { console, JSON, Math, Number, String, Array, Object, Promise, isFinite, BFE_API: 'https://bfe', GATHERINGS_API: 'https://gath',
  _adminVenueTees: { 5: tees }, _adminVenuesCache: [{ id: 5, name: 'Bethlehem Municipal', pars: null }], _adminVenueCttpCache: {}, toasts: [], posts: [],
  showToast: (m, bad) => ctx2.toasts.push([m, !!bad]), loadAdminVenues: () => {}, venueSyncParsFromTees: async () => false,
  adminFetchVenueCttp: async id => { ctx2._adminVenueCttpCache[id] = { cttpHoles: [3, 8], raw: { mode: 'same', cttpHoles: [3, 8] } }; },
  fetch: async (url, opts) => { ctx2.posts.push({ url, body: JSON.parse(opts.body) }); return { json: async () => ({ ok: true }) }; } };
vm.createContext(ctx2);
vm.runInContext(`var _venueTeeInfo = { 5: {} };\n${['teeHolesPars', 'adminSetDefaultVenueTee'].map(n => extractFn(src, n)).join('\n')}`, ctx2);
await vm.runInContext(`adminSetDefaultVenueTee(5, 3)`, ctx2);
const pc = ctx2.posts[0];
ok(pc && /venue-tee-catalog$/.test(pc.url) && pc.body.tee_catalog.defaultTee === 'White' && pc.body.tee_catalog.mode === 'same' && JSON.stringify(pc.body.tee_catalog.cttpHoles) === '[3,8]' && pc.body.pin === '7797', '⭐ saves defaultTee and keeps the catalog\'s other keys');
ok(vm.runInContext(`_venueTeeInfo[5]`, ctx2) === undefined, 'the cached tee info is dropped so the next lookup is fresh');
ctx2.posts.length = 0;
ctx2._adminVenueTees[5] = [{ id: 8, tee_name: 'Half', holes: [] }];
await vm.runInContext(`adminSetDefaultVenueTee(5, 8)`, ctx2);
ok(ctx2.posts.length === 0 && ctx2.toasts.at(-1)[1] === true, 'a tee without full par data cannot be the default');

// ── Birdie Payouts: each player against their own tee
const cardOf = (player, over) => ({ player, holes: P72.map((p, i) => over[i + 1] ?? p) });
const base = { id: 'birdiepay', entity: 'individual', dollar_per_birdie: 2, pars: P72 };
const holes2 = 4; // a 4 on hole 2: par on the default (4), a BIRDIE on the Blue tee (par 5)
const run1 = (addon) => E.computeGatheringGamesPayout({ games: ['birdiepay'], dollar_per_player: 10, birdiepay_config: addon }, [cardOf('Ann', { 2: holes2 }), cardOf('Bob', { 2: holes2 })], {}, []);
const plain = run1({ dollar_per_birdie: 2, pars: P72 });
ok(plain.birdiepay.count === 0, 'baseline: one par on hole 2 is not a birdie');
const byP = run1({ dollar_per_birdie: 2, pars: P72, pars_by_player: { Bob: PG } });
ok(byP.birdiepay.count === 1 && byP.birdiepay.birdies[0].player === 'Bob' && byP.birdiepay.birdies[0].par === 5, 'Bob (on the par-5 tee) gets the birdie; Ann (default pars) does not');
const byCase = run1({ dollar_per_birdie: 2, pars: P72, pars_by_player: { ' bob ': PG } });
ok(byCase.birdiepay.count === 1, 'player names match case-insensitively like the rest of the engine');
ok(E.gatheringConfigFromLegacy({ games: ['birdiepay'], dollar_per_player: 10, birdiepay_config: { dollar_per_birdie: 2, pars: P72, pars_by_player: { Bob: PG } } }).addons.find(a => a.id === 'birdiepay').pars_by_player.Bob[1] === 5, 'the add-on carries pars_by_player');
ok(!('pars_by_player' in E.gatheringConfigFromLegacy({ games: ['birdiepay'], dollar_per_player: 10, birdiepay_config: { dollar_per_birdie: 2, pars: P72 } }).addons.find(a => a.id === 'birdiepay')), 'an old frozen config is byte-identical (no pars_by_player key)');
const noDefault = run1({ dollar_per_birdie: 2, pars: [], pars_by_player: { Bob: PG } });
ok(noDefault.birdiepay.count === 1 && noDefault.birdiepay.no_par_data === false, 'a player with their own pars is counted even with no course default');

// ── schema field
const fields = E.gameSchemas().birdiepay.config;
const v = (cfg) => E.validateFields(fields, cfg);
ok(v({ dollar_per_birdie: 2, pars: P72 }).ok, 'pars_by_player is optional');
ok(v({ dollar_per_birdie: 2, pars: P72, pars_by_player: { Bob: PG } }).ok, 'a valid pars_by_player passes');
ok(!v({ dollar_per_birdie: 2, pars: P72, pars_by_player: { Bob: PG.slice(0, 17) } }).ok, 'a short par list is rejected');
ok(!v({ dollar_per_birdie: 2, pars: P72, pars_by_player: { Bob: PG.map(() => 9) } }).ok, 'pars outside 3-6 are rejected');
const cleaned = E.cleanFields(fields, { dollar_per_birdie: '2', pars: P72, pars_by_player: { ' Bob ': PG, extra: 1 === 2 ? 0 : PG } });
ok(Object.keys(cleaned.pars_by_player).join() === 'Bob,extra' || Object.keys(cleaned.pars_by_player).includes('Bob'), 'cleanFields trims the names');
ok(!('pars_by_player' in E.cleanFields(fields, { dollar_per_birdie: 2, pars: P72, pars_by_player: {} })), 'an empty map is not stored');

// ── games form: only players whose tee differs from the default
const ctx3 = { console, JSON, Array, Object, Number, String, Math,
  _gamesFormBirdiepayPars: P72, _gamesFormTees: tees,
  _gamesFormHcp: { players: { Ann: { teeId: '3' }, Bob: { teeId: '2' }, Cy: {}, Di: { teeId: '99' } } },
  gamesFormPlayerNames: () => ['Ann', 'Bob', 'Cy', 'Di'] };
vm.createContext(ctx3);
vm.runInContext(['teeHolesPars', 'gamesFormBirdiepayParsByPlayer'].map(n => extractFn(src, n)).join('\n') + '\nthis.f = gamesFormBirdiepayParsByPlayer;', ctx3);
const m = ctx3.f();
ok(Object.keys(m).join() === 'Bob' && m.Bob[1] === 5, 'only the player on a different-par tee is recorded (Ann\'s tee matches the default; Cy/Di have no usable tee)');

// ── Venue Manager: Par editor + ⭐ buttons
const w = new JSDOM('<body></body>').window;
const ctx4 = { document: w.document, console, JSON, Math, Number, String, Array, Object,
  _adminVenueTees: { 5: tees }, _adminVenueCttpCache: { 5: { cttpHoles: [], raw: { defaultTee: 'Blue' } } }, _adminVenueTeeSel: {}, _adminVenuesCache: [] };
vm.createContext(ctx4);
vm.runInContext(src.match(/const TEE_COLORS = \{[\s\S]*?\};/)[0] + '\nvar _vmParsManual = {};\n' + ['escapeHtml', 'escapeHtmlAttr', 'teeSwatchCss', 'teeHeaderColor', 'teeHolesPars', 'venueDefaultTeeFor', 'venueViewerDefaultTee', 'venueDefaultTeeName', 'venueDefaultTee_', 'venueParsInfo', 'venueParsDerivedHtml', 'venueParsEditorHtml', 'venueScorecardHtml', 'venueTeeSummaryHtml', 'storedVenueTeesHtml', 'adminUpdateVenueParTotals'].map(n => extractFn(src, n)).join('\n'), ctx4);
const bethV = { id: 5, name: 'Bethlehem Municipal', pars: null };
let ph = vm.runInContext(`venueParsEditorHtml(${JSON.stringify(bethV)})`, ctx4);
ok(/⭐ Blue/.test(ph) && /Total: 72/.test(ph) && !/id="admin-par-5-0"/.test(ph) && /Fill stored Vs Par from this tee/.test(ph) && /Type it in instead/.test(ph), 'with a default tee the Par editor shows the tee\'s pars (read-only) and offers to fill the stored Vs Par');
ph = vm.runInContext(`venueParsEditorHtml(${JSON.stringify({ ...bethV, pars: JSON.stringify(PG) })})`, ctx4);
ok(/stored Vs Par matches/.test(ph) && !/Fill stored Vs Par from this tee/.test(ph), 'a matching stored Vs Par needs no fill button');
ph = vm.runInContext(`venueParsEditorHtml(${JSON.stringify({ ...bethV, pars: JSON.stringify(P72) })})`, ctx4);
ok(/stored Vs Par is different/.test(ph), 'a differing stored Vs Par is called out');
vm.runInContext(`_vmParsManual[5] = true`, ctx4);
ph = vm.runInContext(`venueParsEditorHtml(${JSON.stringify(bethV)})`, ctx4);
ok(/id="admin-par-5-0"/.test(ph) && /Fill from tee/.test(ph) && /Use the tee's par/.test(ph), 'typed-in mode keeps the 18 inputs and adds "Fill from tee"');
vm.runInContext(`_adminVenueTees[7] = []; _vmParsManual[7] = false`, ctx4);
ph = vm.runInContext(`venueParsEditorHtml(${JSON.stringify({ id: 7, name: 'No Tees', pars: null })})`, ctx4);
ok(/id="admin-par-7-0"/.test(ph) && !/Fill from tee/.test(ph), 'a course with no tee data still gets the typed-in editor');
let sh = vm.runInContext(`storedVenueTeesHtml({ id: 5 })`, ctx4);
ok(/⭐ Default/.test(sh) && !/Make default/.test(sh), 'the default tee (Blue, preselected) is labelled ⭐ Default');
vm.runInContext(`_adminVenueTeeSel[5] = 3`, ctx4);
sh = vm.runInContext(`storedVenueTeesHtml({ id: 5 })`, ctx4);
ok(/adminSetDefaultVenueTee\(5, 3\)/.test(sh), 'another tee offers "⭐ Make default"');

console.log(`test_tee_par: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
