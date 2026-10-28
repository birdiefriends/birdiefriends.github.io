// v4.48.0 — Scramble on the Games form: defaults, round-trip of a saved config, the save payload, results panel, Teams-of-2 prefill.
import fs from 'fs'; import vm from 'vm'; import { createRequire } from 'module'; import { extractFn } from './extract.mjs';
import { fileURLToPath } from 'url';
const HERE = (p) => fileURLToPath(new URL(p, import.meta.url));
const require = createRequire(import.meta.url);
const BFEngine = require('../bf_engine.js');
const src = fs.readFileSync(HERE('../portal.html'), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const ctx = vm.createContext({ console, JSON, Math, Number, String, Set, Map, Array, Object, BFEngine });
vm.runInContext(['gamesFormSideBlank', 'gamesFormSideFrom', 'isScrB', 'scrambleResultsHtml', 'escapeHtml'].map(n => extractFn(src, n)).join('\n'), ctx);

const b = ctx.gamesFormSideBlank('scramble');
ok(b.basis === 'net' && b.scoring === 'strokes' && b.hcp_method === 'low_high' && b.low_pct === 35 && b.high_pct === 15 && b.allowance === 25 && b.payout === 'winner', 'blank scramble: net, strokes, 35/15, winner');
ok(Array.isArray(b.pairs) && b.pairs.length === 0, 'blank scramble starts with no teams');
const saved = { dollar_per_player: 20, basis: 'net', net_mode: 'low', hcp_method: 'combined', allowance: 30, scoring: 'stableford', scale: 'standard', payout: 'top3', pairs: [['Ann', 'Bob']] };
const f = ctx.gamesFormSideFrom('scramble', saved);
ok(f.scoring === 'stableford' && f.scale === 'standard' && f.hcp_method === 'combined' && f.allowance === 30 && f.payout === 'top3' && f.net_mode === 'low' && f.pairs[0].join() === 'Ann,Bob', 'a saved scramble config round-trips into the form');
ok(ctx.gamesFormSideFrom('scramble', { hcp_method: 'bogus', payout: 'x', scoring: 'y' }).hcp_method === 'low_high', 'junk values fall back to the defaults');
// what the form saves must validate in the engine
const cfg = { dollar_per_player: 10, basis: 'net', net_mode: 'own', scoring: 'stableford', scale: 'bf', hcp_method: 'low_high', low_pct: 35, high_pct: 15, allowance: 25, payout: 'top2', pars: Array(18).fill(4), pairs: [['Ann', 'Bob'], ['Cy', 'Di']] };
ok(BFEngine.validateGameConfig('scramble', cfg).ok, 'the config the form builds passes engine validation');
// wiring pins
ok(/GW_SIDE_STEP = \{[^}]*scramble: 'scpairs'/.test(src) && /scpairs: 'Scramble teams'/.test(src), 'wizard has a Scramble teams step');
ok(/Stableford needs par data for this venue/.test(src) && /cfg\.pars = _gamesFormBirdiepayPars\.slice\(\)/.test(src), 'Stableford refuses to save without par data and freezes the pars');
ok(/delete cfg\.period/.test(src), 'a scramble is whole round: no period saved');
ok(/g\.teamSize === 2 && !g\.eventShadow/.test(src) && /teamsState\(gatheringRegData\.filter/.test(src), 'Teams of 2 Gatherings pre-fill Scramble teams from locked pairs');
// results panel
const fres = { format: 'scramble', scoring: 'stableford', scale: 'bf', basis: 'net', hcp_method: 'low_high', payout: 'top2', pot: 40,
  pairs: [['Ann', 'Bob'], ['Cy', 'Di']], winners: [['Cy', 'Di']],
  standings: [{ pair: ['Cy', 'Di'], total: 40, complete: true, place: 1, tied: false, played: 18 }, { pair: ['Ann', 'Bob'], total: 36, complete: true, place: 2, tied: false, played: 18 }],
  places: [{ place: 1, pairs: [['Cy', 'Di']], per_player: 13 }, { place: 2, pairs: [['Ann', 'Bob']], per_player: 7 }] };
const line = (l, r) => `<div>${l}|${r}</div>`, nm = pr => pr.join(' &amp; ');
const html = ctx.scrambleResultsHtml(fres, line, nm, ctx.escapeHtml);
ok(/40 pts · \$13 each/.test(html) && /36 pts · \$7 each/.test(html), 'leaderboard shows points and each place\'s payout');
ok(html.indexOf('Cy &amp; Di') < html.indexOf('Ann &amp; Bob'), 'leader first');
ok(/pays top 2/.test(html) && /Stableford \(birdie premium\)/.test(html), 'the rules are stated');
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
