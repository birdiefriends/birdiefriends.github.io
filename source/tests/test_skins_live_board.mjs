// Live Skins board (live scoring rounds): skins won so far by the engine's own rule, by team in a Scramble round.
import fs from 'fs'; import vm from 'vm';
import { extractFn, loadEngine } from './extract.mjs';
import { fileURLToPath } from 'url';
const src = fs.readFileSync(fileURLToPath(new URL('../portal.html', import.meta.url)), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const E = loadEngine();
const card = (player, f) => ({ player, holes: Array.from({ length: 18 }, (_, i) => f(i + 1)) });
const row = { games: ['cttp', 'scramble', 'skins'], dollar_per_player: 20, cttp_config: { dollar_per_hole: 5, holes: [3] },
  game_configs: { scramble: { dollar_per_player: 10, basis: 'gross', scoring: 'strokes', hcp_method: 'none', payout: 'top2', pairs: [['A1', 'A2'], ['B1', 'B2']] } } };
const ctx = { console, BFEngine: E, _fbLive: null, escapeHtml: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'), fbOverlayCards: () => ctx._fbLive.cards };
vm.createContext(ctx);
vm.runInContext(extractFn(src, 'skinWonText') + '\n' + extractFn(src, 'skinsLiveSectionHtml') + '\nthis.S = skinsLiveSectionHtml;', ctx);
ok(/Loading/.test(ctx.S({})), 'before the field is loaded it says Loading');
ctx._fbLive = { row, cards: [] };
ok(/No skins won yet/.test(ctx.S({})), 'no scores: no skins won yet');
// team A birdies #3 and #7 outright (3 vs 4); #5 ties
ctx._fbLive = { row, cards: [card('A1', h => (h === 3 || h === 7 ? 3 : 4)), card('A2', h => (h === 3 || h === 7 ? 3 : 4)), card('B1', () => 4), card('B2', () => 4)] };
let h = ctx.S({});
ok(/2 skins won so far/.test(h) && /A1 &amp; A2/.test(h) && /#3 \(3\)/.test(h) && /#7 \(3\)/.test(h), 'the team that wins holes outright is listed with its holes and scores: ' + h.replace(/<[^>]+>/g, ' ').slice(0, 160));
ok(/by team/.test(h) && /tie wins nothing/.test(h), 'the note says team skins and that ties win nothing');
ctx._fbLive = { row, cards: [card('A1', () => 4), card('A2', () => 4), card('B1', () => 4), card('B2', () => 4)] };
ok(/No skins won yet/.test(ctx.S({})), 'all ties: no skins');
console.log(`skins_live_board: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
