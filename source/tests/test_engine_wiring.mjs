// Dev-88 — portal.html must load bf_engine.js before its main script, with a
// ?v= that matches BFEngine.ENGINE_VERSION (GitHub Pages caches ~10 min; a
// stale ?v= means a new portal can run against an old engine), and the
// moved functions must be delegates, not stale copies.
import fs from 'fs'; import { fileURLToPath } from 'url'; import { loadEngine, extractFn } from './extract.mjs';
const HERE = (p) => fileURLToPath(new URL(p, import.meta.url));
const src = fs.readFileSync(HERE('../portal.html'), 'utf8');
const E = loadEngine();
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const m = src.match(/<script src="bf_engine\.js\?v=([^"]+)"><\/script>/);
ok(!!m, 'portal has <script src="bf_engine.js?v=...">');
ok(m && m[1] === E.ENGINE_VERSION, `?v=${m && m[1]} matches ENGINE_VERSION ${E.ENGINE_VERSION}`);
const tagAt = m ? src.indexOf(m[0]) : -1;
const mainAt = src.indexOf('function computeGatheringGamesPayout(');
ok(tagAt > 0 && tagAt < mainAt, 'engine tag comes before the script that uses it');
['computeGatheringGamesPayout', 'latestScorecardPerPlayer', 'scorecardMissingHoles'].forEach(n => {
  const f = extractFn(src, n);
  ok(f.includes('BFEngine.' + n + '(') && f.length < 400, n + ' is a thin delegate');
});
const docs = HERE('../../docs/bf_engine.js');
if (fs.existsSync(docs)) ok(fs.readFileSync(docs, 'utf8') === fs.readFileSync(HERE('../bf_engine.js'), 'utf8'), 'docs/ and source/ bf_engine.js identical');

// Dev-88 layer 2 -- every Gatherings UI consumer must go through the round-
// config resolver, not a raw _gatheringGamesIndex/games.includes(...) read.
ok(/function gatheringRoundConfig\(/.test(src) && /function gatheringIsGamed\(/.test(src) && /function gatheringAddon\(/.test(src), 'resolver helpers exist');
const codeOnly = src.replace(/\/\/[^\n]*/g, '');
ok(!/_liveGamesConfig\.(games|cttp_config|birdieball_config)/.test(codeOnly), 'no leftover direct reads of the raw legacy row');
ok(!codeOnly.includes('_liveGames.includes'), 'no leftover _liveGames.includes(...) checks');
[
  [extractFn(src, 'gamesSealWatermarkHtml'), 'gatheringRoundConfig'],
  [extractFn(src, 'evtScoreMode'), 'gatheringIsGamed'],
].forEach(([body, helper]) => ok(body.includes(helper + '('), 'uses ' + helper + '()'));
ok(/const _liveConfig = evt\.source === 'gathering' \? gatheringRoundConfig\(evt\.gatheringId\) : null;/.test(src), 'buildLivePanel resolves one config via gatheringRoundConfig()');
ok(/gatheringAddon\(_liveConfig, 'cttp'\)/.test(src) && /gatheringAddon\(_liveConfig, 'birdieball'\)/.test(src), 'buildLivePanel reads addons via gatheringAddon()');
ok(/return _gatheringGamesIndex\.has\(evt\.gatheringId\);/.test(src), 'hasLivePanelSupport keeps its plain existence check (unchanged on purpose)');

console.log(`${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
