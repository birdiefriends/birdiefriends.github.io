// Dev-88 — engine unification layer 3: bfe_scorecards (BFE Worker) is the ONE
// D1 scorecard store. Pins (a) every portal scorecard call goes through
// SCORECARD_API, readers ask for strokes only, writers declare strokes;
// (b) the BFE Worker stores input_type/round_key with sane defaults and
// filters by input; (c) BFE-Admin's Close Round copies are tagged points.
import fs from 'fs'; import { fileURLToPath, pathToFileURL } from 'url';
const HERE = (p) => fileURLToPath(new URL(p, import.meta.url));
const portal = fs.readFileSync(HERE('../portal.html'), 'utf8');
const admin = fs.readFileSync(HERE('../../docs/BFE-Admin.html'), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };

// (a) portal
ok(/const SCORECARD_API = BFE_API;/.test(portal), 'SCORECARD_API points at the BFE Worker');
const calls = [...portal.matchAll(/fetch\(`\$\{(\w+)\}\/scorecards([^`]*)`/g)];
ok(calls.length === 7, 'expected 7 scorecard fetches, found ' + calls.length);
calls.forEach(([whole, api, rest]) => {
  const isCompletionCheck = api === 'BFE_API' && rest.startsWith('?event=');   // Wally Cup Live Panel "all cards in" check — any input type
  ok(api === 'SCORECARD_API' || isCompletionCheck, 'goes through SCORECARD_API: ' + whole);
  if (api === 'SCORECARD_API' && rest.startsWith('?')) ok(rest.includes('input=strokes'), 'reader asks for strokes only: ' + whole);
});
const posts = [...portal.matchAll(/fetch\(`\$\{SCORECARD_API\}\/scorecards`, \{[\s\S]{0,200}?body: JSON\.stringify\(\{([\s\S]{0,120})/g)];
ok(posts.length === 2, 'two portal writers (Live Panel, Card Score Sheet), found ' + posts.length);
posts.forEach(p => ok(p[1].includes("input_type: 'strokes'"), 'writer declares strokes'));
ok(!/GATHERINGS_API\}\/scorecards/.test(portal), 'no live calls left to the main Worker scorecards table');

// (c) BFE-Admin
const adminPosts = [...admin.matchAll(/fetch\(base \+ '\/scorecards', \{[\s\S]*?\.catch\(/g)];
ok(adminPosts.length === 3, 'three Close Round copy paths, found ' + adminPosts.length);
adminPosts.forEach(m => ok(m[0].includes("input_type: 'points'") && m[0].includes("round_key: 'bfe:' + roundName"), 'Close Round copy tagged points + round_key'));

// (b) Worker, against a fake D1 that records SQL + binds
const W = (await import(pathToFileURL(HERE('../bf_experiences_worker.js')).href)).default;
const seen = [];
const DB = {
  prepare(sql) { const st = { sql, binds: [], bind(...b) { st.binds = b; return st; },
    async run() { seen.push(st); return { meta: { last_row_id: 1 } }; },
    async all() { seen.push(st); return { results: [] }; }, async first() { seen.push(st); return null; } }; return st; },
  withSession() { return DB; }
};
const env = { DB };
const post = async body => { seen.length = 0; const r = await W.fetch(new Request('https://w/scorecards', { method: 'POST', body: JSON.stringify(body) }), env, {}); return [await r.json(), seen[0]]; };
const holes = Array(18).fill(4);
let [res, st] = await post({ event_name: 'gathering:42', player: 'A', holes });
ok(res.ok && /input_type, round_key/.test(st.sql) && /input_type = excluded\.input_type/.test(st.sql), 'insert + upsert carry input_type/round_key');
ok(st.binds.slice(-2).join('|') === 'strokes|gathering:42', 'defaults: strokes, round_key = event_name: ' + st.binds.slice(-2));
[res, st] = await post({ event_name: '2026 Wally Cup - Rd1', player: 'A', holes, input_type: 'points', round_key: 'bfe:2026 Wally Cup - Rd1' });
ok(st.binds.slice(-2).join('|') === 'points|bfe:2026 Wally Cup - Rd1', 'explicit points + round_key kept');
[res, st] = await post({ event_name: 'x', player: 'A', holes, input_type: 'bogus' });
ok(st.binds.slice(-2)[0] === 'strokes', 'unknown input_type falls back to strokes');
seen.length = 0;
await W.fetch(new Request('https://w/scorecards?event=gathering%3A42&input=strokes'), env, {});
ok(/COALESCE\(input_type, 'strokes'\) = \?/.test(seen[0].sql) && seen[0].binds.join('|') === 'gathering:42|strokes', 'GET filters by input');
seen.length = 0;
await W.fetch(new Request('https://w/scorecards?event=2026%20Wally%20Cup%20-%20Rd1'), env, {});
ok(!/input_type/.test(seen[0].sql), 'GET without input returns every type (Wally Cup completion check unchanged)');
console.log(`${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
