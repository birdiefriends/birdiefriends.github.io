// Dev-99: the Games-form money step as a live split of the WHOLE POT. Podium three ways (% of buy-in / $ total / $ by place),
// CTP as $ a hole x paid holes, Skins the balance; every figure recomputes from the settings and nothing is hard-coded.
import fs from 'fs'; import vm from 'vm'; import { createRequire } from 'module'; import { extractFn } from './extract.mjs';
import { fileURLToPath } from 'url';
const HERE = (p) => fileURLToPath(new URL(p, import.meta.url));
const require = createRequire(import.meta.url);
const BFEngine = require('../bf_engine.js');
const src = fs.readFileSync(HERE('../portal.html'), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const dppBox = { value: '20' }; const els = {};
const doc = { getElementById: id => (id === 'games-form-dpp' ? dppBox : els[id] || null), activeElement: null };
const ctx = vm.createContext({ console, JSON, Math, Number, String, Set, Map, Array, Object, BFEngine, document: doc });
vm.runInContext(`
let GAMES_FORM_SIDE_IDS = ['altshot', 'scramble', 'hilo', 'matchplay'];
let _gamesFormSelected = new Set(['scramble', 'cttp', 'skins']);
let _gamesFormYesCount = 25, _gamesFormTouched = new Set();
let _gamesFormCttpConfig = { dollar_per_hole: 30, hole_mode: 'custom', holes: [3, 8, 12, 15], prize_holes: [17] };
let _gamesFormBirdieballConfig = {}, _gamesFormBirdiepayConfig = {}, _gamesFormFourballConfig = {}, _gamesFormLowscoreConfig = {};
let _gamesFormSide = { altshot: {}, hilo: {}, matchplay: {}, scramble: { dollar_per_player: 10, payout: 'top3', team_size: 2, pairs: Array.from({ length: 12 }, (_, i) => ['a' + i, 'b' + i]) } };
function updateGamesFormPotPreview() { gamesFormPodiumApply(); refreshGamesFormSplit(); }
function fourballSegCount() { return 1; } function periodSegCount() { return 1; } function lowscoreSegCount() { return 1; }
let _gamesFormG = null;
`, ctx);
const FN = ['escapeHtml', '_r2', 'gamesFormPodiumPlaces', 'gamesFormPodiumPlan', 'gamesFormPodiumPlayers', 'gamesFormPodiumApply', 'gamesFormPodiumInit', 'setGamesFormScramblePct', 'setGamesFormPodiumTotal', 'setGamesFormPodiumPlace', 'setGamesFormPodiumMode', 'setGamesFormPodiumPlaces', 'gamesFormSplitBuild', 'gamesFormSplitHtml', 'gamesFormSplitLive', 'refreshGamesFormSplit'];
vm.runInContext('const GAMES_FORM_PODIUM_SHARES = { 1: [100], 2: [65, 35], 3: [50, 30, 20] }; let _gamesFormPodium = { mode: "pct", pct: null, tot: null, pl: [], dirty: false };\n' + FN.map(n => extractFn(src, n)).join('\n'), ctx);
const run = c => vm.runInContext(c, ctx);
const strip = h => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const R = () => ctx.gamesFormSplitBuild().regions;
const T = id => strip(R()[id] || '');

// 1. the default: 50% of each buy-in on 24 team players
ok(/How the \$500 pot splits.*\$20 × 25 players/.test(strip(ctx.gamesFormSplitHtml())), 'header: the pot and where it comes from');
ok(T('gs-pod-total') === '$240 48% of the pot', 'podium total and its share of the pot: ' + T('gs-pod-total'));
ok(/\$10 a player × 24 players · paid on the 24 players on teams \(the other 1 player's money goes to Skins\)/.test(T('gs-pod-note')), 'podium note: rate, players, the unpaired player: ' + T('gs-pod-note'));
ok(/1st 50% \$120 \$60 2nd 30% \$72 \$36 3rd 20% \$48 \$24/.test(T('gs-pod-table')), 'places table: share, team, each partner: ' + T('gs-pod-table'));
ok(T('gs-ctp-total') === '$120 24% of the pot' && /4 paid holes \(3, 8, 12, 15\) × \$30 = \$120/.test(T('gs-ctp-note')), 'CTP: holes x $ a hole: ' + T('gs-ctp-total') + ' | ' + T('gs-ctp-note'));
ok(T('gs-skins') === '$140 28% of the pot', 'Skins is the balance: ' + T('gs-skins'));
ok(/Podium \$240 · ■ CTP \$120 · ■ Skins \$140/.test(T('gs-check')) && /All \$500 is in a game/.test(T('gs-check')), 'the check line adds the pot back up: ' + T('gs-check'));

// 2. nothing is hard-coded: every parameter moves every figure
ctx.setGamesFormScramblePct('60');
ok(run('_gamesFormSide.scramble.dollar_per_player') === 12 && run("_gamesFormTouched.has('scramble')"), '60% of a $20 buy-in = $12 a player');
ok(T('gs-pod-total') === '$288 58% of the pot' && /1st 50% \$144/.test(T('gs-pod-table')) && /\$12 a player × 24/.test(T('gs-pod-note')), 'every podium text follows the %: ' + T('gs-pod-total'));
ok(T('gs-skins') === '$92 18% of the pot', 'Skins shrinks to match: ' + T('gs-skins'));
dppBox.value = '30'; // % is of the buy-in, so a bigger buy-in grows the podium with no re-typing
run('gamesFormPodiumApply()');
ok(run('_gamesFormSide.scramble.dollar_per_player') === 18 && T('gs-pod-total') === '$432 58% of the pot', '60% follows a $30 buy-in: ' + T('gs-pod-total'));
dppBox.value = '20'; ctx.setGamesFormScramblePct('50');

// 3. $ total
ctx.setGamesFormPodiumTotal('250');
ok(T('gs-pod-total') === '$250 50% of the pot' && /1st 50% \$125/.test(T('gs-pod-table')) && /2nd 30% \$75/.test(T('gs-pod-table')) && /3rd 20% \$50/.test(T('gs-pod-table')), 'a $ total splits 50/30/20: ' + T('gs-pod-table'));
ok(run('_gamesFormSide.scramble.dollar_per_player') === 10.4167, 'stored as $ a player, rounded up so no place loses a dollar: ' + run('_gamesFormSide.scramble.dollar_per_player'));
ok(BFEngine.computeRoundPayout && true, 'engine present');

// 4. $ by place
ctx.setGamesFormPodiumMode('pl');
ok(run("_gamesFormSide.scramble.payout") === 'custom' && JSON.stringify(run('_gamesFormSide.scramble.place_shares')) === '[125,75,50]', 'switching modes carries today\'s places across: ' + JSON.stringify(run('_gamesFormSide.scramble.place_shares')));
ctx.setGamesFormPodiumPlace(0, '150');
ok(T('gs-pod-total') === '$275 55% of the pot' && /1st 55% \$150/.test(T('gs-pod-table')) && /2nd 27% \$75/.test(T('gs-pod-table')), 'hard places: total, shares and partner amounts follow: ' + T('gs-pod-table'));
ok(T('gs-skins') === '$105 21% of the pot', 'Skins follows: ' + T('gs-skins'));
// 5. places paid
ctx.setGamesFormPodiumPlaces(2);
ok(JSON.stringify(run('_gamesFormPodium.pl')) === '[178,96]' || JSON.stringify(run('_gamesFormPodium.pl')) === '[178,97]', 'fewer places re-split the same total (65/35 of $275): ' + JSON.stringify(run('_gamesFormPodium.pl')));
ctx.setGamesFormPodiumMode('pct');
ok(run('_gamesFormPodium.pct') > 0 && run('_gamesFormSide.scramble.payout') === 'top2' && run('_gamesFormSide.scramble.place_shares') === undefined, 'back to % leaves custom: ' + run('_gamesFormSide.scramble.payout'));
ctx.setGamesFormPodiumPlaces(1); ctx.setGamesFormScramblePct('50');
ok(/1st 100% \$240/.test(T('gs-pod-table')) && !/2nd/.test(T('gs-pod-table')), 'winner takes all: one place');
ctx.setGamesFormPodiumPlaces(3);

// 6. CTP and over-allocation
run("_gamesFormCttpConfig.dollar_per_hole = 20");
ok(T('gs-ctp-total') === '$80 16% of the pot' && T('gs-skins') === '$180 36% of the pot', 'CTP $20 a hole: purse and Skins both move: ' + T('gs-ctp-total') + ' | ' + T('gs-skins'));
run("_gamesFormCttpConfig.dollar_per_hole = 100");
ok(/over by \$140/.test(T('gs-skins')) && /Lower an amount/.test(T('gs-skins-note')) && /Over-allocated by \$140/.test(T('gs-check')), 'over-allocation is named: ' + T('gs-skins') + ' | ' + T('gs-check'));
run("_gamesFormCttpConfig.dollar_per_hole = 30");
// 7. the live update rewrites text only, never an input
const nodes = {}; const mk = id => (nodes[id] = { id, innerHTML: '' });
Object.keys(R()).forEach(id => { els[id] = mk(id); });
els['games-form-split'] = { innerHTML: 'KEEP', contains: () => true };
doc.activeElement = { tagName: 'INPUT' };
ctx.setGamesFormScramblePct('40');
ok(els['games-form-split'].innerHTML === 'KEEP', 'typing never rebuilds the box being typed in');
ok(strip(nodes['gs-pod-total'].innerHTML) === '$192 38% of the pot' && strip(nodes['gs-skins'].innerHTML) === '$188 38% of the pot' , 'but the figures change on the same keystroke: ' + strip(nodes['gs-pod-total'].innerHTML) + ' | ' + strip(nodes['gs-skins'].innerHTML));
doc.activeElement = null; ctx.refreshGamesFormSplit();
ok(els['games-form-split'].innerHTML !== 'KEEP' && /gw-split-scramble/.test(els['games-form-split'].innerHTML), 'with nothing focused the panel rebuilds');
console.log(`${pass} passed, ${fail} failed`); if (fail) process.exit(1);
