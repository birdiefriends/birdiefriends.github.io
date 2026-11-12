// Main Worker: /group-sets (real SQLite). A host saves a draft, publishes it, players read only the published set and get their start pushed.
import { fileURLToPath, pathToFileURL } from 'url';
import { DatabaseSync } from 'node:sqlite';
const HERE = (p) => fileURLToPath(new URL(p, import.meta.url));
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const W = (await import(pathToFileURL(HERE('../worker.js')).href)).default;
const db = new DatabaseSync(':memory:');
db.exec(`CREATE TABLE gatherings (id INTEGER PRIMARY KEY, host_id TEXT, title TEXT, event_time TEXT, status TEXT DEFAULT 'active'); INSERT INTO gatherings (id, host_id, title, event_time) VALUES (104, 'Brian Hager', '2026 Turkey 2Man', '2026-11-15T09:00');`);
function makeD1(db) {
  const wrap = (sql) => { const st = { binds: [], bind(...b) { st.binds = b; return st; },
    async first() { return db.prepare(sql).get(...st.binds) ?? null; }, async all() { return { results: db.prepare(sql).all(...st.binds) }; },
    async run() { const r = db.prepare(sql).run(...st.binds); return { meta: { changes: Number(r.changes) } }; } }; return st; };
  return { prepare: wrap, withSession() { return this; } };
}
const pushes = []; globalThis.fetch = async (u, o) => { pushes.push(JSON.parse(o.body)); return new Response('{}'); };
const env = { DB: makeD1(db), OS_APP_ID: 'app', OS_REST_KEY: 'key' };
const call = async (method, path, body) => { const r = await W.fetch(new Request('https://w' + path, { method, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil: p => p }); return { status: r.status, json: await r.json().catch(() => ({})) }; };
const draft = { v: 1, mode: 'shotgun', holes: 18, group_size: 4, groups: [{ members: ['Ann', 'Bob', 'Cy', 'Di'], start_hole: 1 }, { members: ['Ed', 'Flo'], start_hole: 7 }] };
let r = await call('POST', '/group-sets/gathering/104', { host_id: 'Someone Else', draft });
ok(r.status === 403, 'only the host can save: ' + r.status);
r = await call('POST', '/group-sets/gathering/104', { host_id: 'Brian Hager', draft });
ok(r.status === 200 && r.json.ok, 'host saves a draft: ' + JSON.stringify(r.json));
r = await call('GET', '/group-sets/gathering/104');
ok(r.json.published === null && r.json.draft === undefined, 'a player sees nothing until it is published, and never the draft');
r = await call('GET', '/group-sets/gathering/104?host_id=Brian%20Hager');
ok(r.json.draft && r.json.draft.groups.length === 2 && r.json.can_edit, 'the host reads the draft back');
r = await call('POST', '/group-sets/gathering/104/publish', { host_id: 'Brian Hager' });
ok(r.status === 200 && r.json.version === 1 && r.json.notified === 6, 'publish: version 1, six players told: ' + JSON.stringify(r.json));
ok(pushes.length === 6 && /Group 2, start on hole 7/.test(pushes.find(p => p.filters[0].value === 'Flo').contents.en) && /With Ed/.test(pushes.find(p => p.filters[0].value === 'Flo').contents.en), 'each player is told their own hole and who they play with');
r = await call('GET', '/group-sets/gathering/104');
ok(r.json.published && r.json.published.groups[1].start_hole === 7 && r.json.version === 1, 'now a player can read it');
// a re-publish only pushes the people who moved
pushes.length = 0; const d2 = JSON.parse(JSON.stringify(draft)); d2.groups[1].start_hole = 10;
await call('POST', '/group-sets/gathering/104', { host_id: 'Brian Hager', draft: d2 });
r = await call('POST', '/group-sets/gathering/104/publish', { host_id: 'Brian Hager' });
ok(r.json.version === 2 && r.json.notified === 2 && pushes.every(p => /Updated: you are in Group 2, start on hole 10/.test(p.contents.en)), 'only the two whose hole changed are told, as an update: ' + JSON.stringify(r.json));
r = await call('POST', '/group-sets/gathering/104/publish', { host_id: 'Brian Hager', notify: false });
ok(r.json.notified === 0, 'notify:false stays quiet');
r = await call('POST', '/group-sets/gathering/104', { host_id: 'Brian Hager', draft: { nope: 1 } });
ok(r.status === 400, 'a draft without groups is refused');
r = await call('POST', '/group-sets/series/9', { pin: '7797', draft });
ok(r.status === 200, 'the commissioner can save for any event type (series here)');
console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
