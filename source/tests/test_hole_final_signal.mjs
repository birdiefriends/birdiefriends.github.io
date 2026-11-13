// The phone tells the Worker a hole is final when Next is tapped with every score on it in (birdie alerts wait for this).
import fs from 'fs'; import vm from 'vm';
import { extractFn } from './extract.mjs';
import { fileURLToPath } from 'url';
const src = fs.readFileSync(fileURLToPath(new URL('../portal.html', import.meta.url)), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const posts = []; let failNext = false;
const ctx = { console, showToast() {},  BFE_API: 'https://bfe', _skChain: {}, renderLiveBanner() {}, skOrder: () => [1, 2, 3, 4], skCardOf: n => ctx._sk.cards[n] || [],
  skGroup: () => ({ players: ['Ann', 'Bob'] }),
  fetch: async (u, o) => { if (failNext) return { ok: false, status: 503 }; posts.push({ u, body: JSON.parse(o.body) }); return { ok: true, status: 200 }; } };
ctx._sk = { key: 'gathering:9', hole: 2, sel: 0, cards: { Ann: [4, 4, null], Bob: [4, null, null] }, finalQueue: [] };
vm.createContext(ctx);
vm.runInContext(['skFinalizeHole', 'skFlushFinal', 'skFinishRound', 'skNav'].map(n => extractFn(src, n)).join('\n') + '\nthis.NAV = skNav; this.FIN = skFinishRound;', ctx);
const tick = () => new Promise(r => setTimeout(r, 5));
ctx.NAV(1); await tick();
ok(posts.length === 0, 'Next with a score still missing on the hole sends nothing');
ctx._sk.hole = 1; ctx.NAV(1); await tick();
ok(posts.length === 1 && posts[0].u === 'https://bfe/bfe/hole-final' && posts[0].body.hole === 1 && posts[0].body.event_name === 'gathering:9' && posts[0].body.players.join() === 'Ann,Bob', 'Next with every score in sends hole-final for that hole and group');
ctx._sk.hole = 2; ctx.NAV(-1); await tick();
ok(posts.length === 1, 'Previous never finalizes');
ctx._sk.cards.Bob[1] = 5; ctx._sk.hole = 2; failNext = true; ctx.NAV(1); await tick();
ok(posts.length === 1 && ctx._sk.finalQueue.length === 1, 'a failed send stays queued');
failNext = false; ctx._sk._finalBusy = false; ctx._sk.hole = 2; ctx.NAV(1); await tick();
ok(posts.some(p => p.body.hole === 2) && ctx._sk.finalQueue.length === 0, 'the next tap retries and clears the queue');
// Post Round: finalizes every hole the whole group has scored, including the last hole that has no Next.
posts.length = 0; ctx._sk.finalQueue = []; ctx._sk.cards = { Ann: [4, 4, 3, 2], Bob: [4, 5, 3, null] }; ctx._sk.groupIdx = 0; ctx._sk._finalBusy = false;
ctx.FIN(); await tick();
ok(posts.map(p => p.body.hole).join() === '1,2,3' && ctx._sk.finished[0] === true, 'Post Round finalizes each hole the group fully scored (1-3; hole 4 is incomplete), and marks the group finished');
ctx._sk.cards.Bob[3] = 4; ctx._sk._finalBusy = false; posts.length = 0; ctx.FIN(); await tick();
ok(posts.some(p => p.body.hole === 4), 'tapping again after the last score is in finalizes the last hole too');
console.log(`hole_final_signal: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
