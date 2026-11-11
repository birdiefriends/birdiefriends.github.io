// Dev-98: the Games-form money step as ONE buy-in split into $ per player shares (Turkey 2Man). CTP is a share too ($ a hole is derived).
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
let _gamesFormYesCount = 25, _gamesFormCttpPP = null, _gamesFormTouched = new Set();
let _gamesFormCttpConfig = { dollar_per_hole: null, hole_mode: 'custom', holes: [3, 8, 12, 15], prize_holes: [17] };
let _gamesFormBirdieballConfig = {}, _gamesFormBirdiepayConfig = {}, _gamesFormFourballConfig = {}, _gamesFormLowscoreConfig = {};
let _gamesFormSide = { altshot: {}, hilo: {}, matchplay: {}, scramble: { dollar_per_player: 10, payout: 'top3', team_size: 2, pairs: Array.from({ length: 12 }, (_, i) => ['a' + i, 'b' + i]) } };
function updateGamesFormPotPreview() {}
function fourballSegCount() { return 1; } function periodSegCount() { return 1; } function lowscoreSegCount() { return 1; }
`, ctx);
vm.runInContext(['escapeHtml', 'gamesFormCttpPP', 'gamesFormSyncCttp', 'setGamesFormCttpPerPlayer', 'gamesFormSplitHtml'].map(n => extractFn(src, n)).join('\n'), ctx);
const html = () => ctx.gamesFormSplitHtml().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

// CTP is typed as $ per player; $ a hole is worked out for 25 players on 4 paid holes
ctx.setGamesFormCttpPerPlayer('6');
ok(vm.runInContext('_gamesFormCttpConfig.dollar_per_hole', ctx) === 37, '$6 a player x 25 / 4 paid holes = $37 a hole (got ' + vm.runInContext('_gamesFormCttpConfig.dollar_per_hole', ctx) + ')');
let t = html();
ok(/How your \$20 splits/.test(t), 'header names the buy-in');
ok(/Scramble podium.*\$240 podium pot.*1st \$120 · 2nd \$72 · 3rd \$48/.test(t), 'podium pot and its three places are spelled out');
ok(/\$148 pot = \$37 a hole on 4 paid holes · 1 prize hole pays no cash/.test(t), 'CTP shows its pot, $ a hole, and the prize hole');
ok(/Skins.*\$4\.08 per player, the rest/.test(t), 'Skins is the rest of the $20: $20 - $10 - $5.92 = $4.08');
ok(/All \$20 is in a game/.test(t), 'the check line says all of it is in a game');
// over-allocating shows up
ctx.setGamesFormCttpPerPlayer('12');
t = html();
ok(/Skins.*over by/.test(t) && /Lower an amount, or raise the buy-in/.test(t), 'shares above the buy-in are flagged');
// the holes list changing re-derives $ a hole from the same share
ctx.setGamesFormCttpPerPlayer('6');
vm.runInContext('_gamesFormCttpConfig.holes = [3, 8, 12, 15, 5]; gamesFormSyncCttp();', ctx);
ok(vm.runInContext('_gamesFormCttpConfig.dollar_per_hole', ctx) === 30, 'a fifth paid hole: $150 / 5 = $30 a hole');
// a saved config (no explicit share) reads back as a per-player share
vm.runInContext('_gamesFormCttpPP = null; _gamesFormCttpConfig.dollar_per_hole = 30; _gamesFormCttpConfig.holes = [3, 8, 12, 15, 5];', ctx);
ok(ctx.gamesFormCttpPP() === 6, 'saved $30 x 5 holes / 25 players = $6 a player');
// payout choice drives the places shown
vm.runInContext("_gamesFormSide.scramble.payout = 'winner'; _gamesFormCttpPP = 6; gamesFormSyncCttp();", ctx);
ok(/1st \$240/.test(html()) && !/2nd/.test(html()), 'winner-take-all shows one place');
console.log(`${pass} passed, ${fail} failed`); if (fail) process.exit(1);
