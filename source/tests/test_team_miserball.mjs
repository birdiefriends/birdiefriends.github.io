// Team MiserBall: a lost ball is written for the whole team and read back as the team's; the close counts teams; the legacy row carries "team".
import fs from 'fs'; import vm from 'vm';
import { extractFn, loadEngine } from './extract.mjs'; import { fileURLToPath } from 'url';
const src = fs.readFileSync(fileURLToPath(new URL('../portal.html', import.meta.url)), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const E = loadEngine();
const cfg = { addons: [{ id: 'birdieball', team: true, dollar_per_player: 5 }, { id: 'scramble', pairs: [['Ann', 'Bob'], ['Cy', 'Di']] }] };
const posts = [];
const ctx = { BFEngine: E, BFE_API: 'x', _bbAnswers: [], _bbAnswersForGathering: 7, gatheringRoundConfig: () => cfg, gatheringAddon: (c, id) => c.addons.find(a => a.id === id) || null,
  fetch: async (u, o) => { posts.push(JSON.parse(o.body)); return { json: async () => ({ ok: true }) }; } }; vm.createContext(ctx);
vm.runInContext(['bbRawAnswer', 'bbTeamsFor', 'bbTeamOf', 'bbLostScore', 'bbAnswerFor', 'bbPostAnswers'].map(n => extractFn(src, n)).join('\n') + '\nthis.F = { bbTeamOf, bbAnswerFor, bbPostAnswers, bbTeamsFor };', ctx);
const F = ctx.F;
ok(F.bbTeamOf('Bob').join() === 'Ann,Bob' && F.bbTeamOf('Zed').join() === 'Zed', 'teammates found, a player on no team stands alone');
await F.bbPostAnswers(7, 'Ann', { kept: false, lost_hole: 6, lost_stroke: 2 });
ok(posts.length === 2 && posts.map(p => p.player_name).sort().join() === 'Ann,Bob' && posts.every(p => p.kept === false && p.lost_hole === 6), 'a lost ball is saved for both partners');
ok(F.bbAnswerFor('Bob').kept === false && F.bbAnswerFor('Bob').lost_hole === 6, "Bob reads the team's loss");
posts.length = 0;
await F.bbPostAnswers(7, 'Bob', { kept: false, lost_hole: 12, lost_stroke: 1 });
ok(posts.length === 1 && posts[0].player_name === 'Bob', 'a LATER loss by the other partner does not replace the earlier team loss for Ann');
ok(F.bbAnswerFor('Ann').lost_hole === 6 && F.bbAnswerFor('Bob').lost_hole === 6, "the team's answer stays its earliest lost ball (#6)");
posts.length = 0;
await F.bbPostAnswers(7, 'Cy', { kept: true });
ok(posts.map(p => p.player_name).sort().join() === 'Cy,Di' && posts.every(p => p.kept === true), '"kept" fills in a partner with no answer');
posts.length = 0; await F.bbPostAnswers(7, 'Di', { kept: true });
ok(posts.length === 1, '"kept" never overwrites a partner who already has an answer');
// individual MiserBall is untouched
cfg.addons[0].team = false; ctx._bbAnswers.length = 0; posts.length = 0;
await F.bbPostAnswers(7, 'Ann', { kept: false, lost_hole: 3, lost_stroke: 1 });
ok(posts.length === 1 && F.bbAnswerFor('Bob') === null, 'without By team only the player is written');
// end to end from the saved row (legacy shape the Worker stores)
const row = { games: ['birdieball', 'scramble'], dollar_per_player: 10, birdieball_config: { dollar_per_player: 5, team: true }, game_configs: { scramble: { dollar_per_player: 0, basis: 'gross', scoring: 'strokes', hcp_method: 'none', pairs: [['Ann', 'Bob'], ['Cy', 'Di']] } } };
const card = n => ({ player: n, holes: Array(18).fill(4) });
const r = E.computeGatheringGamesPayout(row, ['Ann', 'Bob', 'Cy', 'Di'].map(card), {}, [{ player_name: 'Ann', kept: true }, { player_name: 'Bob', kept: true }, { player_name: 'Cy', kept: false, lost_hole: 4, lost_stroke: 1 }, { player_name: 'Di', kept: true }]);
ok(r.birdieball && r.birdieball.by === 'team' && r.birdieball.winners.join() === 'Ann & Bob', 'the saved row plays as a team MiserBall: Ann & Bob win, got ' + JSON.stringify(r.birdieball && r.birdieball.winners));
ok(r.payouts.find(p => p.player === 'Ann & Bob').birdieball === 20, 'paid to the team as one amount');
// the results card (close sheet and MyHistory) tells each team's story
{
  const esc = x => String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const c2 = { BFEngine: E, escapeHtml: esc, esc, norm: x => String(x).trim().toLowerCase() };
  ['scrambleResultsHtml', 'fourballResultsHeatHtml', 'gpBtnStyle', 'gpSort', 'gpTab', 'gpTabStyle', 'isScrB', 'sideResultHeroHtml'].forEach(n => { c2[n] = () => ''; }); vm.createContext(c2);
  let html = ''; try { vm.runInContext(extractFn(src, 'renderGatheringPayoutHtml') + '\nthis.f = renderGatheringPayoutHtml;', c2); html = c2.f(JSON.parse(JSON.stringify(r))); } catch (e) { console.log('RENDER ERR', e.message); fail++; }
  ok(/Kept both balls all round/.test(html) && /Ann &amp; Bob/.test(html) && /Out on #4/.test(html) && /Cy lost it/.test(html), 'results card: winning team, and the team that is out with who lost it and where');
}
// fixed pot and the host's own name for the game
{
  const row2 = { games: ['birdieball'], dollar_per_player: 20, birdieball_config: { dollar_per_player: 0.8334, pot_total: 20, name: 'Turkey-Ball<b>' } };
  const names = Array.from({ length: 24 }, (_, i) => 'P' + (i + 1));
  const rr = E.computeGatheringGamesPayout(row2, names.map(card), {}, [{ player_name: 'P1', kept: true }, { player_name: 'P2', kept: true }]);
  ok(rr.birdieball.pot === 20 && rr.birdieball.per_winner === 10, 'a $20 fixed pot with 24 players: two keepers $10 each, got ' + JSON.stringify([rr.birdieball.pot, rr.birdieball.per_winner]));
  ok(rr.birdieball.name === 'Turkey-Ballb', 'the name rides on the result, stripped of markup characters: ' + rr.birdieball.name);
  const c3 = { gatheringRoundConfig: () => ({ addons: [{ id: 'birdieball', name: 'Wally-Ball' }] }), gatheringAddon: (c, id) => c.addons.find(a => a.id === id) || null, _bbAnswersForGathering: 7 }; vm.createContext(c3);
  vm.runInContext(['bbCleanName', 'bbName'].map(n => extractFn(src, n)).join('\n') + '\nthis.N = bbName;', c3);
  ok(c3.N() === 'Wally-Ball' && c3.N(7) === 'Wally-Ball', 'the live screens read the configured name');
  c3.gatheringRoundConfig = () => ({ addons: [{ id: 'birdieball' }] });
  ok(c3.N() === 'MiserBall', 'no name set: MiserBall');
}
console.log(`team_miserball: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
