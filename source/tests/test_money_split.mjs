// Dev-98: the Games-form money step as a split of the WHOLE POT: Scramble podium as a % of the buy-in (with the places in dollars),
// CTP as $ a hole x paid holes, Skins as the balance. Every row says its dollars and its share of the pot.
import fs from 'fs'; import vm from 'vm'; import { createRequire } from 'module'; import { extractFn } from './extract.mjs';
import { fileURLToPath } from 'url';
const HERE = (p) => fileURLToPath(new URL(p, import.meta.url));
const require = createRequire(import.meta.url);
const BFEngine = require('../bf_engine.js');
const src = fs.readFileSync(HERE('../portal.html'), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const dppBox = { value: '20' };
const ctx = vm.createContext({ console, JSON, Math, Number, String, Set, Map, Array, Object, BFEngine, document: { getElementById: id => (id === 'games-form-dpp' ? dppBox : null), activeElement: null } });
vm.runInContext(`
let GAMES_FORM_SIDE_IDS = ['altshot', 'scramble', 'hilo', 'matchplay'];
let _gamesFormSelected = new Set(['scramble', 'cttp', 'skins']);
let _gamesFormYesCount = 25, _gamesFormTouched = new Set();
let _gamesFormCttpConfig = { dollar_per_hole: 30, hole_mode: 'custom', holes: [3, 8, 12, 15], prize_holes: [17] };
let _gamesFormBirdieballConfig = {}, _gamesFormBirdiepayConfig = {}, _gamesFormFourballConfig = {}, _gamesFormLowscoreConfig = {};
let _gamesFormSide = { altshot: {}, hilo: {}, matchplay: {}, scramble: { dollar_per_player: 10, payout: 'top3', team_size: 2, pairs: Array.from({ length: 12 }, (_, i) => ['a' + i, 'b' + i]) } };
function updateGamesFormPotPreview() {}
function fourballSegCount() { return 1; } function periodSegCount() { return 1; } function lowscoreSegCount() { return 1; }
`, ctx);
vm.runInContext(['escapeHtml', 'setGamesFormScramblePct', 'gamesFormSplitHtml'].map(n => extractFn(src, n)).join('\n'), ctx);
const html = () => ctx.gamesFormSplitHtml().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const run = c => vm.runInContext(c, ctx);

let t = html();
ok(/How the \$500 pot splits.*\$20 × 25 players/.test(t), 'header: the pot and where it comes from ($20 x 25 = $500)');
ok(/id="gw-split-scramble"[^>]*value="50"/.test(ctx.gamesFormSplitHtml()) && /Scramble podium.*%\s*of the pot/.test(t), 'podium is entered as a % (50% of each buy-in)');
ok(/\$240 podium \(48% of the pot, 24 players in teams × \$10\): 1st \$120 · 2nd \$72 · 3rd \$48/.test(t), 'podium row shows the pot and the three places in dollars (got: ' + t.slice(t.indexOf('Scramble'), t.indexOf('CTP')) + ')');
ok(/4 paid holes × \$30 = \$120 \(24% of the pot\) · 1 prize hole pays no cash/.test(t), 'CTP row: $ a hole x paid holes = purse and its share');
ok(/Skins\s*\$140/.test(t) && /the balance of the pot \(28% of the pot\)/.test(t), 'Skins is the balance: $500 - $240 - $120 = $140');
ok(/✓ \$500 pot = \$360 in the games above \+ \$140 Skins/.test(t), 'a check line adds the pot back up');
// typing a % sets the $ per player
dppBox.value = '20'; ctx.setGamesFormScramblePct('60');
ok(run('_gamesFormSide.scramble.dollar_per_player') === 12 && run("_gamesFormTouched.has('scramble')"), '60% of a $20 buy-in = $12 a player, marked as the host\'s own number');
ctx.setGamesFormScramblePct('50');
ok(run('_gamesFormSide.scramble.dollar_per_player') === 10, '50% = $10 a player');
// buy-in change keeps the % meaning the same dollars it was typed against
dppBox.value = '30'; ctx.setGamesFormScramblePct('50');
ok(run('_gamesFormSide.scramble.dollar_per_player') === 15, '50% of $30 = $15');
dppBox.value = '20'; ctx.setGamesFormScramblePct('50');
// the places follow the payout choice
run("_gamesFormSide.scramble.payout = 'winner'");
ok(/1st \$240/.test(html()) && !/2nd/.test(html()), 'winner takes all: one place');
run("_gamesFormSide.scramble.payout = 'top2'");
ok(/1st \$156 · 2nd \$84/.test(html()), 'top 2 = 65/35 of $240');
// over-allocation
run("_gamesFormCttpConfig.dollar_per_hole = 100");
t = html();
ok(/Skins\s*over by \$140/.test(t) && /Lower an amount/.test(t), 'CTP $100 x 4 takes more than is left: Skins shows over by $140');
console.log(`${pass} passed, ${fail} failed`); if (fail) process.exit(1);
