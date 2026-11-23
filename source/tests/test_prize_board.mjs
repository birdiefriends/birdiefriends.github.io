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
// the tiebreak: silent when nothing is tied for money, a tie to call once the field has finished, and the host's recorded order settles it
{ const tb = { flights: [], prizes: [{ scope: 'overall', place: 1, amount: 50 }, { scope: 'overall', place: 2, amount: 30 }] };
  const mkRow = (extra) => ({ games: ['podium'], game_configs: { podium: Object.assign({ dollar_per_player: 25, rank_by: 'round', basis: 'gross', table: tb, tiebreak: ['Putt-off'] }, extra || {}) } });
  const full = (n, v) => card(n, Array(18).fill(v));
  const tied = [full('Ann', 4), full('Bo', 4), full('Cy', 5), full('Di', 6)];
  let b = E.prizeBoard(mkRow(), tied, PARS, null);
  ok(b.ties.length === 1 && b.ties[0].players.sort().join() === 'Ann,Bo' && b.ties[0].place === 1 && b.tiebreak === 'Putt-off', 'a tie for 1st with the field finished is a tie to call, and carries the host\'s rule');
  ok(E.prizeBoard(mkRow(), [full('Ann', 4), full('Bo', 5), full('Cy', 5), full('Di', 6)], PARS, null).ties.length === 1, 'a tie for 2nd (2nd and 3rd pay differently, 3rd pays nothing) is also a tie to call');
  ok(E.prizeBoard(mkRow(), [full('Ann', 4), full('Bo', 5), full('Cy', 6), full('Di', 6)], PARS, null).ties.length === 0, 'a tie for 3rd, where nothing is paid, stays silent');
  ok(E.prizeBoard(mkRow(), [card('Ann', Array(10).fill(4)), card('Bo', Array(10).fill(4)), full('Cy', 5), full('Di', 6)], PARS, null).ties.length === 0, 'a tie while players are still out is silent');
  b = E.prizeBoard(mkRow({ tie_order: { overall: ['Bo', 'Ann'] } }), tied, PARS, null);
  ok(b.ties.length === 0 && b.scopes[0].rows[0].label === 'Bo' && b.scopes[0].rows[0].place === 1 && b.scopes[0].rows[1].label === 'Ann' && b.scopes[0].rows[1].place === 2 && b.settled.length === 2, 'the recorded order settles it: Bo 1st, Ann 2nd, no tie left');
  const pay = r => E.computeRoundPayout({ payout: { entry_per_player: 25 }, addons: [{ id: 'podium', entity: 'individual', dollar_per_player: 25, basis: 'gross', rank_by: 'round', table: tb, tiebreak: ['Putt-off'], ...(r || {}) }] }, { scorecards: tied });
  let pr = pay(); ok(pr.payouts.find(x => x.player === 'Ann').podium === 40 && pr.podium.ties && pr.podium.ties.length === 1, 'unrecorded: the payout splits (1st+2nd = $80, $40 each) and reports the tie');
  pr = pay({ tie_order: { overall: ['Bo', 'Ann'] } }); ok(pr.payouts.find(x => x.player === 'Bo').podium === 50 && pr.payouts.find(x => x.player === 'Ann').podium === 30 && !pr.podium.ties && pr.podium.settled.length === 2, 'recorded: Bo takes 1st ($50), Ann 2nd ($30), the tie is cleared');
  pr = pay({ tie_order: { overall: ['Ann'] } }); ok(pr.payouts.find(x => x.player === 'Ann').podium === 50 && pr.payouts.find(x => x.player === 'Bo').podium === 30, 'naming only the winner puts the other tied player next'); }
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
// the loud part: banner for everyone, "Record who won" for the host only, tap order, save, silent when no tie
{ const calls = [], sheets = [], toasts = [];
  const ctx = { GRP_ESC: s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])), Date, Math, String, Array, JSON, Object, currentPlayer: 'Brian Hager', BFE_API: 'https://bfe.test',
    openHostSheet: (title, html) => sheets.push({ title, html }), closeHostSheet() {}, showToast: m => toasts.push(m), openGatheringLeaderboard: g => calls.push(['lb', g]), openGatheringCloseSheet: g => calls.push(['close', g]),
    fetch: async (url, o) => { calls.push(['post', url, JSON.parse(o.body)]); return { ok: true, json: async () => ({ ok: true, tie_order: { overall: JSON.parse(o.body).order } }) }; }, _gatheringGamesIndex: new Map() };
  vm.createContext(ctx);
  vm.runInContext(['tiebreakBannerHtml', 'openTiebreakRecord', 'tiebreakRecordPaint', 'tiebreakTap', 'tiebreakPost', 'tiebreakSave', 'tiebreakClear'].map(n => extractFn(src, n)).join('\n').replace(/^/, 'let _tbTies = [], _tbCtx = null, _tbPick = [], _tbRecording = false;\n') + '\nthis.f={tiebreakBannerHtml,openTiebreakRecord,tiebreakTap,tiebreakSave,tiebreakClear,rec:()=>_tbRecording};', ctx);
  const ties = [{ scope: 'overall', scope_name: 'Overall', place: 1, players: ['Brian Hager', 'Scott Justus'] }], txt = h => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  ok(ctx.f.tiebreakBannerHtml([], 'Putt-off', true, 7, 'lb', []) === '', 'no tie, nothing on screen: silent');
  let h = ctx.f.tiebreakBannerHtml(ties, 'Putt-off', false, 7, 'lb', []), x = txt(h);
  ok(/TIEBREAK NEEDED/.test(x) && /Tie for 1st/.test(x) && /Brian Hager/.test(x) && /Scott Justus/.test(x) && /Putt-off/.test(x) && /find the host/.test(x) && !/Record who won/.test(x), 'players see the loud banner with the tied names and the rule, and are told to find the host');
  h = ctx.f.tiebreakBannerHtml(ties, '', true, 7, 'lb', []); x = txt(h);
  ok(/Record who won/.test(x) && /host will call the tiebreak/i.test(x), 'the host gets the record button; no rule set says the host will call it');
  ctx.f.openTiebreakRecord(0); ok(ctx.f.rec() === true && /Tap the players in the order/.test(sheets.at(-1).html), 'the record screen opens and blocks the refresh from painting over it');
  ctx.f.tiebreakTap('Scott Justus'); ok(/disabled/.test(sheets.at(-1).html) === false, 'one pick of two is enough to save (the other takes the next place)');
  await ctx.f.tiebreakSave();
  const post = calls.find(c => c[0] === 'post');
  ok(post && /\/bfe\/gathering-games\/7\/tiebreak$/.test(post[1]) && post[2].host_id === 'Brian Hager' && post[2].scope === 'overall' && post[2].order.join() === 'Scott Justus', 'saving posts the order to the Worker as the host');
  ok(calls.some(c => c[0] === 'lb' && c[1] === 7) && ctx.f.rec() === false, 'then the leaderboard reopens with the result');
  h = ctx.f.tiebreakBannerHtml([], 'Putt-off', true, 7, 'lb', [{ scope: 'overall', scope_name: 'Overall', place: 1, player: 'Scott Justus' }]); x = txt(h);
  ok(/Tiebreak settled/.test(x) && /Scott Justus/.test(x) && /Undo/.test(x) && !/TIEBREAK NEEDED/.test(x), 'once recorded: a calm settled line, with Undo for the host'); }
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
