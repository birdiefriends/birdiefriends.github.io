// Dev-94 — Alternate Shot / Match Play results: hero card, story tags, no individual ranking for one-ball games.
import fs from 'fs'; import vm from 'vm';
import { extractFn, loadEngine } from './extract.mjs';
import { fileURLToPath } from 'url';
const src = fs.readFileSync(fileURLToPath(new URL('../portal.html', import.meta.url)), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const E = loadEngine();
const arr = f => Array.from({ length: 18 }, (_, i) => f(i + 1));
const card = (player, f) => ({ player, holes: arr(f) });
const ctx = { BFEngine: E, escapeHtml: v => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;') }; vm.createContext(ctx);
const names = ['sideResultHeroHtml', 'fourballResultsHeatHtml', 'fbIni', 'fbShort', 'renderGatheringPayoutHtml', 'gpTabStyle', 'gpBtnStyle'];
vm.runInContext(names.map(n => extractFn(src, n)).join('\n') + '\nthis.api={' + names.join(',') + '};', ctx);
const A = Object.assign({}, ctx.api, { sideMatchStory: E.sideMatchStory, sideGroupResults: E.sideGroupResults });
const H = s => s.map(r => ({ res: r }));
let st = A.sideMatchStory(H(['A', 'A', 'T', 'B', 'B', 'B', 'A']));
ok(st.a === 3 && st.b === 3 && st.t === 1 && st.lead === 0, 'tally 3-3, 1 halved');
ok(st.maxA === 2 && st.maxB === 1 && st.changes === 1, 'biggest lead 2 UP, one lead change (got max ' + st.maxA + '/' + st.maxB + ', changes ' + st.changes + ')');
st = A.sideMatchStory(H(['A', 'T', 'A', 'A']));
ok(st.neverTrailed === 'A' && st.changes === 0, 'never trailed');

const asRow = (pairs, extra = {}) => ({ games: ['altshot'], dollar_per_player: 10, game_configs: { altshot: Object.assign({ dollar_per_player: 10, basis: 'gross', pairs }, extra) } });
// Ann&Bob win 7 holes, lose 2, halve the rest
const win = f => f;
const snap = E.computeGatheringGamesPayout(asRow([['Ann', 'Bob'], ['Cy', 'Di']]), [
  card('Ann', h => (h <= 7 ? 4 : h <= 9 ? 6 : 5)), card('Bob', h => (h <= 7 ? 4 : h <= 9 ? 6 : 5)),
  card('Cy', h => (h <= 7 ? 5 : h <= 9 ? 4 : 5)), card('Di', h => (h <= 7 ? 5 : h <= 9 ? 4 : 5))], {}, []);
const res = A.sideGroupResults(snap.altshot);
ok(res.length === 1 && res[0].status === 'won' && res[0].winner === 0, 'A-S: Ann & Bob win');
ok(/stroke/.test(res[0].big) && /holes 7 – 2, 9 halved/.test(res[0].small), 'strokes-paid A-S headline is strokes, holes are the story (got ' + res[0].big + ' / ' + res[0].small + ')');
const hero = A.sideResultHeroHtml(snap.altshot, 'altshot');
ok(/Ann &amp; Bob/.test(hero) && /beat/.test(hero) && /\$20 each/.test(hero), 'hero names the winners and the payout');

// holes-won A-S with a decided margin and Match Play early decision
const mpSnap = E.computeGatheringGamesPayout({ games: ['matchplay'], dollar_per_player: 10, game_configs: { matchplay: { dollar_per_player: 10, basis: 'gross', matches: [['Ann', 'Bob']] } } },
  [card('Ann', h => (h <= 16 ? (h <= 3 ? 4 : 5) : 5)), card('Bob', () => 5)], {}, []);
const mr = A.sideGroupResults(mpSnap.matchplay);
ok(mr[0].status === 'won' && mr[0].big === '3&2' && mr[0].decidedEarly, 'Match Play headline 3&2, decided early (got ' + mr[0].big + ')');
const mh = A.sideResultHeroHtml(mpSnap.matchplay, 'matchplay');
ok(/3&amp;2/.test(mh) && /Decided early/.test(mh) && /never trailed|Wire to wire/.test(mh), 'Match Play hero shows 3&2 and a story tag');
const zero = E.computeGatheringGamesPayout({ games: ['matchplay'], dollar_per_player: 0, game_configs: { matchplay: { dollar_per_player: 0, basis: 'gross', matches: [['Ann', 'Bob']] } } }, [card('Ann', () => 4), card('Bob', () => 5)], {}, []);
ok(/Bob buys/.test(A.sideResultHeroHtml(zero.matchplay, 'matchplay')), '$0 match: the loser buys');
const halved = E.computeGatheringGamesPayout({ games: ['matchplay'], dollar_per_player: 10, game_configs: { matchplay: { dollar_per_player: 10, basis: 'gross', matches: [['Ann', 'Bob']] } } }, [card('Ann', () => 4), card('Bob', () => 4)], {}, []);
ok(/Halved/.test(A.sideResultHeroHtml(halved.matchplay, 'matchplay')) && /Antes back/.test(A.sideResultHeroHtml(halved.matchplay, 'matchplay')), 'halved match says so');

// Summary: one-ball only -> no Net/Gross ranking, hero on top
const html = A.renderGatheringPayoutHtml(snap, null);
ok(!/data-gp-btn="net"/.test(html) && !/data-gp-btn="gross"/.test(html), 'no Net/Gross ranking buttons for one-ball-only rounds');
ok(/beat/.test(html), 'summary carries the result card');
// a round that also has Skins keeps the ranking
const mixed = E.computeGatheringGamesPayout({ games: ['skins', 'altshot'], dollar_per_player: 10, handicap_config: { allowance: 95, mode: 'net', stroke_index: arr(h => h), players: { Ann: { kind: 'given', strokes: 0 }, Bob: { kind: 'given', strokes: 0 }, Cy: { kind: 'given', strokes: 0 }, Di: { kind: 'given', strokes: 0 } }, skins_basis: 'net' },
  game_configs: { altshot: { dollar_per_player: 5, basis: 'gross', pairs: [['Ann', 'Bob'], ['Cy', 'Di']] } } }, [card('Ann', () => 4), card('Bob', () => 4), card('Cy', () => 5), card('Di', () => 5)], {}, []);
ok(/data-gp-btn="net"|data-gp-btn="money"/.test(A.renderGatheringPayoutHtml(mixed, null)), 'mixed round still renders');

const mpHtml = A.renderGatheringPayoutHtml(mpSnap, null);
ok(/Hole by hole/.test(html) && /Hole by hole/.test(mpHtml), 'both panels carry the hole-by-hole strip');
ok(/3&amp;2/.test(mpHtml) && /data-gp-btn/.test(mpHtml) === false, 'Match Play only round: result on top, single sort (no buttons)');

// winner-first: the winner's number leads, whichever side they were listed on
{
  const row = { games: ['matchplay'], dollar_per_player: 12, game_configs: { matchplay: { dollar_per_player: 12, basis: 'gross', period: 'fbt', matches: [['Ann', 'Bob']] } } };
  // Bob wins front and back, halves the middle
  const snapB = E.computeGatheringGamesPayout(row, [card('Ann', h => (h <= 6 || h > 12 ? 5 : 4)), card('Bob', h => (h <= 6 || h > 12 ? 4 : 4))], {}, []);
  const r = A.sideGroupResults(snapB.matchplay)[0];
  ok(r.winner === 1 && /^3 – 0$/.test(r.big), 'period pots read winner-first: 3 – 0 (got ' + r.big + ')');
  ok(/holes 6 – 0|holes 12 – 0/.test(r.small) || /holes \d+ – \d+/.test(r.small), 'holes tally present');
  const hh = r.small.match(/holes (\d+) – (\d+)/); ok(hh && Number(hh[1]) >= Number(hh[2]), 'holes tally is the winner\'s first (got ' + r.small + ')');
}
// the money table: antes handed back get their own column, net vs buy-in shown
{
  const row = { games: ['matchplay'], dollar_per_player: 12, game_configs: { matchplay: { dollar_per_player: 12, basis: 'gross', period: 'fbt', matches: [['Ann', 'Bob']] } } };
  const snap2 = E.computeGatheringGamesPayout(row, [card('Ann', h => (h <= 6 ? 4 : 5)), card('Bob', h => (h <= 6 ? 5 : 5))], {}, []);
  const t = A.renderGatheringPayoutHtml(snap2, null).replace(/<[^>]+>/g, '|').replace(/\|+/g, '|');
  ok(/↩/.test(A.renderGatheringPayoutHtml(snap2, null)), 'a halved pot adds the antes-back column');
  ok(/buy-in/.test(t) && /\+\$/.test(t), 'net vs buy-in shown with a plus for winners (got ' + t.slice(0, 300) + ')');
}
// initials never collide
const fb = vm.runInContext(extractFn(src, 'fbIni') + ';fbIni', ctx);
ok(fb(['Test2 Two'], ['Test3 Three']) !== fb(['Test3 Three'], ['Test2 Two']) && fb(['Test2'], ['Test3']) === 'Test2', 'Test2 / Test3 get distinct initials (got ' + fb(['Test2'], ['Test3']) + ')');
ok(fb(['Brian'], ['Tony']) === 'B', 'normal names stay one letter');

console.log(`test_side_results: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
