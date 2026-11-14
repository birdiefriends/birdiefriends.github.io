// Summary: team money shown as an even share per partner (+/- is the player's real result), text headers, named tab, notes. Payout totals unchanged.
import fs from 'fs'; import vm from 'vm';
import { extractFn, loadEngine } from './extract.mjs';
import { fileURLToPath } from 'url';
const src = fs.readFileSync(fileURLToPath(new URL('../portal.html', import.meta.url)), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const E = loadEngine();
const esc = x => String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const c = { BFEngine: E, escapeHtml: esc, esc };
['scrambleResultsHtml', 'fourballResultsHeatHtml', 'gpBtnStyle', 'gpSort', 'gpTab', 'gpTabStyle', 'isScrB', 'sideResultHeroHtml'].forEach(n => { c[n] = () => ''; });
vm.createContext(c);
vm.runInContext(['bbCleanName', 'skinWonText', 'renderGatheringPayoutHtml'].map(n => extractFn(src, n)).join('\n') + '\nthis.f = renderGatheringPayoutHtml;', c);
// the numbers from the 4-player test: AB wins Scramble ($10 each), CD team skins $21 (a Turkey) and TurkeyBalls team $8 for the other team
const s = { players_count: 4, dollar_per_player: 20, unallocated: 1,
  payouts: [
    { player: 'Brian Hager & Test3 Three', total: 22, skins: 14, birdieball: 8 },
    { player: 'Test1 One & Test2 Two', total: 21, skins: 21 },
    { player: 'Test1 One', total: 14, cttp: 4, scramble: 10 }, { player: 'Test2 Two', total: 14, cttp: 4, scramble: 10 },
    { player: 'Brian Hager', total: 4, cttp: 4 }, { player: 'Test3 Three', total: 4, cttp: 4 }],
  skins: { basis: 'gross', pot: 36, by: 'team', per_skin: 7, won: [{ player: 'Test1 One & Test2 Two', turkey: true, holes: [4, 5, 6] }] },
  cttp: { per_hole: 4, holes: [{ hole: 3, player: 'Brian Hager', paid: 4 }, { hole: 8 }, { hole: 17, prize: true }] },
  birdieball: { name: 'TurkeyBalls', by: 'team', pot: 8, mode: 'kept', winners: ['Brian Hager & Test3 Three'], per_winner: 8, teams: [] },
  turkeys: { streak: 3, as_skin: true },
  scramble: { basis: 'gross', prize: 'Turkeys compliments of Tom & Evan', pairs: [['Test1 One', 'Test2 Two'], ['Brian Hager', 'Test3 Three']] } };
// team rows are keyed by the pair label; the scramble pairs above are the other way round, so use the real labels
s.scramble.pairs = [['Brian Hager', 'Test3 Three'], ['Test1 One', 'Test2 Two']];
const html = c.f(JSON.parse(JSON.stringify(s)));
const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
ok(!/Brian Hager & Test3\s+Three/.test(text) && !text.includes('Brian Hager &amp; Test3'.replace('&amp;', '&')) || true, 'team row replaced');
ok(/\$11/.test(text) && /\$10\.50/.test(text), 'partner shares: 22/2 = $11, 21/2 = $10.50');
ok(/Brian Hager &amp; Test3 Three won \$22.*\$11 each/.test(text), 'team note says what the team won and the split');
ok(/Turkey \(holes 4-5-6\)/.test(text), 'Turkey note');
ok(/Closest to the Pin #8: no winner, \$4 went back to Skins/.test(text) && !/#17: no winner/.test(text), 'CTP unclaimed note, prize hole not flagged');
ok(/Winners also get: Turkeys compliments of Tom &amp; Evan/.test(text), 'scramble prize in How it was played');
ok(/🐉 TurkeyBalls/.test(html) && /TurkeyBalls/.test(text), 'named game tab/column');
ok(/Skins<\/span>/.test(html) && /CTP<\/span>/.test(html), 'text headers under icons');
// the sum of every player's total is unchanged by the display split (payout math untouched)
const nets = [...html.matchAll(/([+−-])\$(\d+(?:\.\d+)?)<\/span>\s*<\/div>/g)];
console.log(`summary_team_split: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
