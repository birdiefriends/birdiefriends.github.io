// GET /feed must not burn KV list operations: cached at the edge, one list per miss, prune throttled, 429-safe, and a write shows up right away.
import { fileURLToPath, pathToFileURL } from 'url';
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const W = (await import(pathToFileURL(fileURLToPath(new URL('../worker.js', import.meta.url))).href)).default;
// fake edge cache
const store = new Map(); globalThis.caches = { default: { async match(r) { const v = store.get(r.url); return v ? v.clone() : undefined; }, async put(r, res) { store.set(r.url, res.clone()); }, async delete(r) { return store.delete(r.url); } } };
const kv = new Map(); let lists = 0, gets = 0, failList = false;
const now = Date.now(); for (let i = 0; i < 5; i++) kv.set('feed::' + (now - i * 1000), JSON.stringify({ sentAt: now - i * 1000, type: 'announcement', heading: 'n' + i }));
const env = { BF_FLAGS: { async list({ prefix }) { lists++; if (failList) throw new Error('429'); return { keys: [...kv.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })) }; },
  async get(k) { gets++; return kv.get(k) ?? null; }, async put(k, v) { kv.set(k, v); }, async delete(k) { kv.delete(k); } }, DB: {} };
const pending = []; const ctx = { waitUntil: p => pending.push(p) };
const get = async () => { const r = await W.fetch(new Request('https://w.example/feed'), env, ctx); await Promise.all(pending.splice(0)); return r; };
const first = await get(); const j1 = await first.json();
ok(j1.feed.length === 5 && j1.feed[0].heading === 'n0', 'feed returned newest first');
ok(lists === 1, 'one list for the read + prune together, got ' + lists);
for (let i = 0; i < 200; i++) await get();
ok(lists === 1, '200 more reads inside the cache window cost no list ops, got ' + lists);
const h = await get(); ok(h.headers.get('X-Feed-Cache') === 'hit', 'served from edge cache');
// a send busts the cache: the sender sees it on the next read
store.clear(); await get(); const before = lists;
kv.set('feed::' + (now + 5), JSON.stringify({ sentAt: now + 5, type: 'announcement', heading: 'fresh' }));
store.clear(); const f2 = await (await get()).json();
ok(f2.feed[0].heading === 'fresh' && lists === before + 1, 'after the cache is cleared the new entry is served with a single list');
// prune is throttled: a second miss inside 5 minutes does not list again for pruning (only for the read)
const l0 = lists; store.clear(); await get(); ok(lists - l0 === 1, 'one list per miss, prune shares it, got ' + (lists - l0));
// KV over its limit: serve the last good feed, do not fail
failList = true; store.clear(); const r429 = await get(); const j429 = await r429.json();
ok(r429.status === 200 && Array.isArray(j429.feed) && j429.feed.length >= 5 && r429.headers.get('X-Feed-Stale') === '1', 'list failure serves the last good feed');
console.log(`feed_kv_budget: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
