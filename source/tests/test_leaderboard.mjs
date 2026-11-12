// Live leaderboard: ranked from the saved scores by the same engine result Close uses; stableford scrambles rank by points.
import fs from 'fs'; import vm from 'vm';
import { extractFn, loadEngine } from './extract.mjs';
import { fileURLToPath } from 'url';
const src = fs.readFileSync(fileURLToPath(new URL('../portal.html', import.meta.url)), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const E = loadEngine();
const PARS = Array(18).fill(4);
const mk = (p, f) => ({ player: p, input_type: 'strokes', holes: Array.from({ length: 18 }, (_, i) => f(i)) });
const base = { games: ['scramble'], dollar_per_player: 20, game_configs: { scramble: { dollar_per_player: 20, team_size: 2, basis: 'gross', hcp_method: 'none', pairs: [['A1','A2'],['B1','B2'],['C1','C2']], names: ['Alpha','Bravo',''], payout: 'winner' } } };
const cards = [mk('A1', i => i < 12 ? 4 : null), mk('A2', i => i < 12 ? 4 : null), mk('B1', i => i < 12 ? 3 : null), mk('B2', i => i < 12 ? 3 : null), mk('C1', i => i < 9 ? 5 : null), mk('C2', i => i < 9 ? 5 : null)];
let b = E.fourballBoard(base, cards, PARS, 'scramble');
ok(b.ranked_by === 'to_par' && b.rows[0].name === 'Bravo' && b.rows[0].to_par === -12 && b.rows[0].place === 1, 'strokes scramble: best to par first, team name carried: ' + JSON.stringify(b.rows[0]));
ok(b.rows[1].name === 'Alpha' && b.rows[1].to_par === 0 && b.rows[2].to_par === 9 && b.rows[2].thru === 9, 'then even par, then +9 thru 9');
// stableford: points, most wins (a high gross total must not outrank)
const st = JSON.parse(JSON.stringify(base)); st.game_configs.scramble.scoring = 'stableford'; st.game_configs.scramble.pars = PARS; st.game_configs.scramble.scale = 'standard';
const sc = [mk('A1', i => i < 12 ? 4 : null), mk('A2', i => i < 12 ? 4 : null), mk('B1', i => i < 12 ? 3 : null), mk('B2', i => i < 12 ? 3 : null), mk('C1', i => i < 9 ? 6 : null), mk('C2', i => i < 9 ? 6 : null)];
b = E.fourballBoard(st, sc, PARS, 'scramble');
ok(b && b.ranked_by === 'points' && b.rows[0].name === 'Bravo' && b.rows[0].total === 12 * 3 && b.rows[0].to_par === null, 'stableford: ranked by points, most first: ' + JSON.stringify(b && b.rows.map(r => [r.name, r.total, r.place])));
ok(b.rows[1].name === 'Alpha' && b.rows[1].total === 24 && b.rows[2].total === 0 && b.rows[2].place === 3, 'par = 2 points a hole, a double bogey 0');
// tie
const tie = [mk('A1', i => 4), mk('A2', i => 4), mk('B1', i => 4), mk('B2', i => 4), mk('C1', i => null), mk('C2', i => null)];
b = E.fourballBoard(base, tie, PARS, 'scramble');
ok(b.rows[0].tied && b.rows[1].tied && b.rows[0].place === 1 && b.rows[1].place === 1 && b.rows[2].place === null, 'a tie shows T1 for both, a team with no scores is unranked');
// the screen
const ctx = { GRP_ESC: s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])), BFEngine: E, currentPlayer: 'B1', isGuest: () => false, Date, Math, String, Array,
  _gatheringGamesIndex: new Map([[104, base]]) };
vm.createContext(ctx);
vm.runInContext(['leaderboardRowHtml', 'leaderboardHtml'].map(n => extractFn(src, n)).join('\n') + '\nthis.f={leaderboardRowHtml,leaderboardHtml};', ctx);
b = E.fourballBoard(base, cards, PARS, 'scramble');
const html = ctx.f.leaderboardHtml(b, 'B1', {}), text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
ok(/Bravo/.test(text) && /-12/.test(text) && /thru 9/.test(text) && /Not final until the host closes/.test(text), 'the sheet shows team, score to par, holes played and says it is not final: ' + text.slice(0, 200));
ok(/border:1.5px solid var\(--green\)/.test(html), 'the viewer\'s own team is highlighted');
ok(/No scores saved yet/.test(ctx.f.leaderboardHtml(E.fourballBoard(base, [], PARS, 'scramble'), 'B1', {})), 'before any score: a plain message');
ok(/ranked by strokes/.test(ctx.f.leaderboardHtml(b, 'B1', { noPars: true })), 'no pars: says why it ranks by strokes');
const now = Date.now(), evt = (dt) => ({ source: 'gathering', gatheringId: 104, dt: new Date(dt), name: 'X' });
ok(/Leaderboard/.test(ctx.f.leaderboardRowHtml(evt(now + 3600e3))) && !ctx.f.leaderboardRowHtml(evt(now + 3 * 86400e3)) && !ctx.f.leaderboardRowHtml(evt(now - 3 * 86400e3)), 'the card row shows on the day of the round only');
ctx._gatheringGamesIndex = new Map([[104, { games: ['skins'] }]]); ok(!ctx.f.leaderboardRowHtml(evt(now)), 'no live-scoring game, no leaderboard row');
ok(/leaderboardRowHtml\(evt\)/.test(src) && /openGatheringLeaderboard/.test(src), 'wired into the event card');
console.log(`leaderboard: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
