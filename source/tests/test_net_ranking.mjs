// v4.13.0 — Gross and Net rankings (for fun, no money) for a round with a Net setup,
// from the real engine; and how the portal renders them (Close preview + My History share it).
import fs from 'fs'; import { extractFn, loadEngine } from './extract.mjs';
const src = fs.readFileSync(new URL('../portal.html', import.meta.url), 'utf8');
const E = loadEngine();
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const SI = Array.from({ length: 18 }, (_, i) => i + 1);
const PARS = Array(18).fill(4);
const card = (player, v) => ({ player, holes: Array(18).fill(v) });
const cfg = (players, net = true) => ({ games: ['skins'], dollar_per_player: 10,
  handicap_config: { allowance: 95, skins_basis: net ? 'net' : 'gross', birdiepay_basis: 'gross', players } });
const spec = strokes => ({ kind: 'given', strokes, stroke_index: SI });
// Ann shoots 90 gross (5/hole) with 18 strokes -> net 72; Bob 80 (about 4.44) -> use mixed; Cy 72 gross scratch
const bob = Array(18).fill(4).map((v, i) => (i < 8 ? 5 : 4)); // 8*5 + 10*4 = 80
const cards = [card('Ann Lee', 5), { player: 'Bob Roy', holes: bob }, card('Cy Young', 4), { player: 'Dee Part', holes: [4, 4, null, ...Array(15).fill(4)] }];
const r = E.computeGatheringGamesPayout(cfg({ 'Ann Lee': spec(18), 'Bob Roy': spec(0), 'Cy Young': spec(0), 'Dee Part': spec(0) }), cards, {}, []);
ok(r.rankings && r.rankings.gross.map(x => x.player).join() === 'Cy Young,Bob Roy,Ann Lee', 'gross ranking, lowest first, incomplete card left out');
ok(r.rankings.gross.map(x => x.total).join() === '72,80,90', 'gross totals');
ok(r.rankings.net.map(x => x.player).join() === 'Ann Lee,Cy Young,Bob Roy' && r.rankings.net[0].total === 72 && r.rankings.net[0].strokes === 18, 'net ranking uses strokes received (Ann 90-18=72, ties Cy at 72)');
ok(r.rankings.net[0].tied && r.rankings.net[1].tied && r.rankings.net[0].place === 1 && r.rankings.net[1].place === 1 && r.rankings.net[2].place === 3, 'ties share a place (T1, T1, 3)');
ok(r.payouts.reduce((a, x) => a + x.total, 0) + r.unallocated === r.total_pot, 'rankings move no money (pot conserved)');
const g = E.computeGatheringGamesPayout({ games: ['skins'], dollar_per_player: 10 }, cards, {}, []);
ok(!('rankings' in g), 'all-gross round: no rankings block, snapshot shape unchanged');
// a player with no strokes set plays scratch in the ranking too (and is already flagged)
const m = E.computeGatheringGamesPayout(cfg({ 'Ann Lee': spec(18) }), [card('Ann Lee', 5), card('Cy Young', 4)], {}, []);
ok(m.rankings.net.find(x => x.player === 'Cy Young').total === 72, 'unset player ranks as scratch');

// ranking-only: games stay gross, rankings still produced
const ro = E.computeGatheringGamesPayout({ games: ['skins'], dollar_per_player: 10, handicap_config: { allowance: 95, skins_basis: 'gross', birdiepay_basis: 'gross', ranking: true, players: { 'Ann Lee': spec(18), 'Cy Young': spec(0) } } },
  [card('Ann Lee', 5), card('Cy Young', 4)], {}, []);
ok(ro.rankings && ro.rankings.net[0].player === 'Ann Lee' && ro.skins.basis === 'gross', 'ranking-only config: rankings appear, Skins stays gross');
const same = E.computeGatheringGamesPayout({ games: ['skins'], dollar_per_player: 10 }, [card('Ann Lee', 5), card('Cy Young', 4)], {}, []);
ok(JSON.stringify(ro.payouts) === JSON.stringify(same.payouts), 'ranking-only changes no payout');

// rendering
const render = new Function('escapeHtml', ['renderGatheringPayoutHtml','gpTabStyle','gpBtnStyle'].map(n => extractFn(src, n)).join('\n') + '; return renderGatheringPayoutHtml;')(s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
const html = render(r);
ok(/Rank by/.test(html) && /data-gp-btn="net"/.test(html) && /data-gp-btn="gross"/.test(html) && /data-gp-btn="money"/.test(html), 'summary has the Net / Gross / $ ranking toggle');
ok(/data-gp-sort="net"/.test(html) && /data-gp-sort="gross"/.test(html) && />T1</.test(html) && />90</.test(html), 'summary rows carry net and gross scores with shared places');
const netPanel = html.split('data-gp-sort="net"')[1].split('data-gp-sort="gross"')[0];
ok(netPanel.indexOf('Ann Lee') < netPanel.indexOf('Cy Young') && netPanel.indexOf('Cy Young') < netPanel.indexOf('Bob Roy'), 'net order: Ann/Cy tie at 72, Bob 80 last');
ok(/data-gp-tab="sum"/.test(html) && /data-gp-tab="skins"/.test(html) && /data-gp-tab="str"/.test(html), 'tabs: summary, skins, strokes');
const gh = render(g);
ok(!/Rank by/.test(gh) && /data-gp-sort="money"/.test(gh), 'gross round: summary ranked by $, no score toggle');
console.log(`net ranking: ${pass} pass, ${fail} fail`); process.exit(fail ? 1 : 0);
