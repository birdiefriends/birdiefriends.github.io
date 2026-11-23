// Prizes live board (engine 1.65.0): Overall + each flight, ranked from partial cards, with the prize each place pays today.
import fs from 'fs'; import vm from 'vm'; import { fileURLToPath } from 'url';
import { loadEngine, extractFn } from './extract.mjs';
const src = fs.readFileSync(fileURLToPath(new URL('../portal.html', import.meta.url)), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const E = loadEngine(), PARS = Array(18).fill(4);
const card = (p, scores) => ({ player: p, input_type: 'strokes', hole_count: 18, holes: Array.from({ length: 18 }, (_, i) => scores[i] ?? null) });
const cards = [card('Ann', Array(12).fill(4)), card('Bo', Array(10).fill(3)), card('Cy', Array(14).fill(5)), card('Di', Array(6).fill(5))];
const tee = new Map([['ann', 'Green'], ['bo', 'Gold'], ['cy', 'Combo'], ['di', 'Green']]);
const table = { flights: [{ id: 'g', name: 'Green', tees: ['Green'] }, { id: 'c', name: 'Combo+', tees: ['Combo', 'Gold'] }], prizes: [{ scope: 'overall', place: 1, amount: 50 }, { scope: 'g', place: 1, amount: 20 }, { scope: 'c', place: 1, amount: 30 }, { scope: 'c', place: 2, amount: 10 }] };
const sc1 = { games: ['scramble', 'podium'], game_configs: { scramble: { team_size: 1, dollar_per_player: 0, pairs: [['Ann'], ['Bo'], ['Cy'], ['Di']], basis: 'gross', hcp_method: 'none' }, podium: { dollar_per_player: 4, rank_by: 'scramble', basis: 'gross', table } } };
let b = E.prizeBoard(sc1, cards, PARS, tee);
ok(b && b.scopes.map(s => s.name).join() === 'Overall,Green,Combo+' && b.ranked_by === 'to_par', 'Overall then each flight');
const O = b.scopes[0], G = b.scopes[1], C = b.scopes[2];
ok(O.rows[0].label === 'Bo' && O.rows[0].to_par === -10 && O.rows[0].prize === 50 && O.leader.label === 'Bo', 'overall: best to par leads and carries the $50 prize today');
ok(G.rows.map(r => r.label).join() === 'Ann,Di' && G.rows[0].prize === 20 && G.rows[1].prize === 0, 'Green flight only holds Green tee players; 1st pays $20');
ok(C.rows.map(r => r.label).join() === 'Bo,Cy' && C.rows[0].prize === 30 && C.rows[1].prize === 10 && C.rows[1].place === 2, 'Combo+ takes Combo and Gold tees; places 1 and 2 are paid');
ok(b.unflighted.length === 0, 'everyone has a tee, so nobody is unflighted');
b = E.prizeBoard(sc1, cards, PARS, new Map([['ann', 'Green']]));
ok([...b.unflighted].sort().join() === 'Bo,Cy,Di' && b.scopes[0].rows.length === 4, 'players with no tee are listed as unflighted but still rank Overall');
// no source game: each player on their own round
const solo = { games: ['podium'], game_configs: { podium: { dollar_per_player: 4, rank_by: 'round', basis: 'gross', table } } };
b = E.prizeBoard(solo, cards, PARS, tee);
ok(b.source === 'round' && b.scopes[0].rows[0].label === 'Bo' && b.scopes[0].rows[0].thru === 10 && b.scopes[1].rows[0].label === 'Ann', 'round totals ranking works without a side game');
ok(E.prizeBoard({ games: ['scramble'], game_configs: {} }, cards, PARS, tee) === null, 'no Prizes, no board');
b = E.prizeBoard(sc1, [], PARS, tee);
ok(b.scopes[0].rows.every(r => r.place === null && r.prize === 0), 'before any score nobody is ranked or paid');
// ties share the places they cover (whole dollars), like the payout
{ const tie = [card('Ann', Array(18).fill(4)), card('Bo', Array(18).fill(4)), card('Cy', Array(18).fill(4)), card('Di', Array(18).fill(5))];
  const tb = { flights: [], prizes: [{ scope: 'overall', place: 1, amount: 50 }, { scope: 'overall', place: 2, amount: 30 }, { scope: 'overall', place: 3, amount: 20 }] };
  const row = { games: ['podium'], game_configs: { podium: { dollar_per_player: 25, rank_by: 'round', basis: 'gross', table: tb } } };
  const o = E.prizeBoard(row, tie, PARS, null).scopes[0].rows;
  ok(o.slice(0, 3).every(r => r.tied && r.place === 1 && r.prize === 33) && o[3].prize === 0, 'three tied for 1st split places 1-3 ($100 / 3 = $33 each), the 4th gets nothing');
  const t2 = [card('Ann', Array(18).fill(4)), card('Bo', Array(18).fill(5)), card('Cy', Array(18).fill(5)), card('Di', Array(18).fill(6))];
  const o2 = E.prizeBoard(row, t2, PARS, null).scopes[0].rows;
  ok(o2[0].prize === 50 && o2[1].prize === 25 && o2[2].prize === 25 && o2[3].prize === 0, 'a tie for 2nd splits 2nd and 3rd ($25 each)'); }
// the screen: leader chips, a "You" line, prizes on paid rows, a sort switch
{ const ctx = { GRP_ESC: s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])), Date, Math, String, Array };
  vm.createContext(ctx);
  vm.runInContext('let _lbUi = { scope: "overall", sort: "score" }, _lbRepaint = null;\n' + ['lbPick', 'lbSort', 'leaderboardPrizesHtml'].map(n => extractFn(src, n)).join('\n') + '\nthis.f={lbPick,lbSort,leaderboardPrizesHtml,ui:()=>_lbUi};', ctx);
  const pb = E.prizeBoard(sc1, cards, PARS, tee), txt = h => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  let h = ctx.f.leaderboardPrizesHtml(pb, 'Ann', {}), t = txt(h);
  ok(/Overall/.test(t) && /Green/.test(t) && /Combo\+/.test(t) && (h.match(/lbPick\(/g) || []).length === 3, 'one chip per scope');
  ok(/You: .*1st Green/.test(t) && /Overall/.test(t.split('You:')[1].split('By score')[0]), 'a "You" line shows where the viewer stands in each scope');
  ok(!/\$/.test(t.split('Not final')[0]) && /Not final until the host closes/.test(t), 'no money on the live board, and it says not final');
  ctx.f.lbPick('c'); h = ctx.f.leaderboardPrizesHtml(pb, 'Ann', {}); t = txt(h);
  ok(ctx.f.ui().scope === 'c' && /Combo\+ · Gross to par/.test(t) && !/\$|PAID/.test(t), 'a flight chip shows that flight, still no money');
  ctx.f.lbPick('overall'); ctx.f.lbSort('holes'); h = ctx.f.leaderboardPrizesHtml(pb, 'Ann', {}); t = txt(h);
  ok(t.indexOf('Cy') < t.indexOf('Di') && ctx.f.ui().sort === 'holes', 'sorted by holes played: furthest along first');
  ok(/No scores saved yet/.test(ctx.f.leaderboardPrizesHtml(E.prizeBoard(sc1, [], PARS, tee), 'Ann', {})), 'before any score: a plain message');
  ok(/leaderboardPrizesHtml\(pb, currentPlayer/.test(src) && /prizeBoard\(row, cards/.test(src), 'wired into the leaderboard sheet'); }
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
