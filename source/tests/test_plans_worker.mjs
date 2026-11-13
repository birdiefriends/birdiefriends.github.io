// Main Worker: /plans (real SQLite). Access by role (host / player / invited), the per-Gathering create setting,
// the per-plan audience, RSVP with guests, edit / cancel, and the one push when a plan is created.
import { fileURLToPath, pathToFileURL } from 'url';
import { DatabaseSync } from 'node:sqlite';
const HERE = (p) => fileURLToPath(new URL(p, import.meta.url));
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const W = (await import(pathToFileURL(HERE('../worker.js')).href)).default;
const db = new DatabaseSync(':memory:');
db.exec(`CREATE TABLE gatherings (id INTEGER PRIMARY KEY, host_id TEXT, title TEXT, event_time TEXT, status TEXT DEFAULT 'active', crew_id INTEGER, fill_list_enabled INTEGER DEFAULT 0);
  CREATE TABLE registrations (gathering_id INTEGER, player_id TEXT, status TEXT, is_placeholder INTEGER DEFAULT 0, PRIMARY KEY (gathering_id, player_id));
  CREATE TABLE crew_members (crew_id INTEGER, player_id TEXT);
  INSERT INTO gatherings (id, host_id, title, event_time, crew_id) VALUES (104, 'Brian Hager', '2026 Turkey 2Man', '2026-11-15T09:00', 7);
  INSERT INTO gatherings (id, host_id, title, event_time, crew_id) VALUES (105, 'Other Host', 'Another', '2026-11-20T09:00', 8);
  INSERT INTO registrations VALUES (104,'Ann Player','yes',0),(104,'Bob Player','yes',0),(104,'Cy Maybe','no',0),(104,'Di Sub','sub',0);
  INSERT INTO crew_members VALUES (7,'Ed Invited'),(7,'Ann Player'),(7,'Cy Maybe');`);
function makeD1(db) {
  const wrap = (sql) => { const st = { binds: [], bind(...b) { st.binds = b; return st; },
    async first() { return db.prepare(sql).get(...st.binds) ?? null; }, async all() { return { results: db.prepare(sql).all(...st.binds) }; },
    async run() { const r = db.prepare(sql).run(...st.binds); return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }; } }; return st; };
  return { prepare: wrap, withSession() { return this; } };
}
const pushes = []; globalThis.fetch = async (u, o) => { pushes.push(JSON.parse(o.body)); return new Response('{}'); };
const env = { DB: makeD1(db), OS_APP_ID: 'app', OS_REST_KEY: 'key' };
const call = async (method, path, body) => { const r = await W.fetch(new Request('https://w' + path, { method, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil: p => p }); return { status: r.status, json: await r.json() }; };
const view = (gid, who) => call('GET', `/plans?gathering_id=${gid}&player_id=${encodeURIComponent(who)}`);

// roles
let r = await view(104, 'Brian Hager'); ok(r.json.role === 'host' && r.json.can_create, 'the host is host and can create');
r = await view(104, 'Ann Player'); ok(r.json.role === 'player' && r.json.can_create, 'a golf Yes is a player and can create by default');
r = await view(104, 'Ed Invited'); ok(r.json.role === 'invited' && !r.json.can_create, 'a Crew member who has not answered is invited and cannot create by default');
r = await view(104, 'Cy Maybe'); ok(r.json.role === 'invited', 'someone who said No is still invited (sees the basics)');
r = await view(104, 'Di Sub'); ok(r.json.role === 'invited', 'a Sub has answered, so is invited');
r = await view(104, 'Stranger'); ok(r.json.role === 'none' && r.json.plans.length === 0 && !r.json.can_create, 'a stranger sees nothing');
r = await view(999, 'Ann Player'); ok(r.status === 404, 'unknown Gathering is a 404');

// create
r = await call('POST', '/plans', { gathering_id: 104, player_id: 'Ed Invited', title: 'Bar after' }); ok(r.status === 403, 'an invited non-player cannot create by default');
pushes.length = 0;
r = await call('POST', '/plans', { gathering_id: 104, player_id: 'Ann Player', title: 'Breakfast', starts_at: '2026-11-15T07:00', place: 'Blue Shamrock Grill', description: 'Eggs before the shotgun', notes: 'Ask for the back room' });
ok(r.status === 200 && r.json.id === 1, 'a player creates a plan: ' + JSON.stringify(r.json));
ok(r.json.notified === 1 && pushes.length === 1 && pushes[0].filters[0].value === 'Bob Player' && /New plan: Breakfast/.test(pushes[0].headings.en), 'one push, to the other golf Yes player only: ' + JSON.stringify(pushes.map(p => p.filters[0].value)));
r = await call('POST', '/plans', { gathering_id: 104, player_id: 'Ann Player', title: '', }); ok(r.status === 400, 'a title is required');
r = await call('POST', '/plans', { gathering_id: 104, player_id: 'Stranger', title: 'x' }); ok(r.status === 403, 'a stranger cannot create');

// reading: basics for everyone invited, full for those with access
r = await view(104, 'Ed Invited');
const p1 = r.json.plans[0];
ok(p1.title === 'Breakfast' && p1.place === 'Blue Shamrock Grill' && p1.counts.yes === 1, 'an invited member sees the basics and the count');
ok(p1.can_join === true && p1.attendees && p1.notes === 'Ask for the back room', 'on a plan open to everyone invited they also get notes and attendees');
// players-only plan
r = await call('POST', '/plans', { gathering_id: 104, player_id: 'Ann Player', title: 'Players dinner', audience: 'players' });
const pid2 = r.json.id;
r = await view(104, 'Ed Invited'); const p2 = r.json.plans.find(p => p.id === pid2);
ok(p2 && p2.can_join === false && p2.attendees === undefined && p2.notes === undefined && p2.counts.yes === 1, 'a players-only plan shows an invited non-player only the basics and the count');
r = await call('POST', `/plans/${pid2}/rsvp`, { player_id: 'Ed Invited', status: 'yes' }); ok(r.status === 403, 'and they cannot RSVP to it');
r = await call('POST', `/plans/${pid2}/rsvp`, { player_id: 'Bob Player', status: 'yes', guests: 2 }); ok(r.status === 200 && r.json.guests === 2, 'a player can RSVP with guests');
r = await view(104, 'Bob Player'); const p2b = r.json.plans.find(p => p.id === pid2);
ok(p2b.counts.yes === 2 && p2b.counts.guests === 2 && p2b.my.status === 'yes' && p2b.attendees.length === 2, 'counts include guests, my RSVP is returned, attendees listed');
r = await call('POST', `/plans/${pid2}/rsvp`, { player_id: 'Bob Player', status: 'no', guests: 3 });
r = await view(104, 'Bob Player'); const p2c = r.json.plans.find(p => p.id === pid2);
ok(p2c.counts.no === 1 && p2c.counts.yes === 1 && p2c.counts.guests === 0 && !p2c.attendees.some(a => a.player === 'Bob Player'), 'changing to No clears guests and drops them from the attendee list');
r = await call('POST', `/plans/1/rsvp`, { player_id: 'Ed Invited', status: 'maybe' }); ok(r.status === 200, 'an invited member can RSVP to a plan open to everyone invited');
r = await call('POST', `/plans/1/rsvp`, { player_id: 'Ed Invited', status: 'sure' }); ok(r.status === 400, 'bad status refused');
r = await call('POST', `/plans/1/rsvp`, { player_id: 'Stranger', status: 'yes' }); ok(r.status === 403, 'a stranger cannot RSVP');

// the host setting
r = await call('POST', '/plans/settings', { gathering_id: 104, host_id: 'Ann Player', who_can_create: 'invited' }); ok(r.status === 403, 'only the host changes the setting');
r = await call('POST', '/plans/settings', { gathering_id: 104, host_id: 'Brian Hager', who_can_create: 'wide open' }); ok(r.status === 400, 'a bad setting is refused');
r = await call('POST', '/plans/settings', { gathering_id: 104, host_id: 'Brian Hager', who_can_create: 'invited' }); ok(r.status === 200, 'host sets invited');
r = await call('POST', '/plans', { gathering_id: 104, player_id: 'Ed Invited', title: 'Happy hour demo', notify: false }); ok(r.status === 200, 'now an invited non-player can create');
const edPlan = r.json.id;
r = await call('POST', '/plans/settings', { gathering_id: 104, host_id: 'Brian Hager', who_can_create: 'host' }); 
r = await call('POST', '/plans', { gathering_id: 104, player_id: 'Ann Player', title: 'No more' }); ok(r.status === 403 && /turned plans off/.test(r.json.error), 'host-only: even a player cannot create');
r = await call('POST', '/plans', { gathering_id: 104, player_id: 'Brian Hager', title: 'Host plan', notify: false }); ok(r.status === 200, 'host-only: the host still can');
r = await view(104, 'Ann Player'); ok(r.json.can_create === false && r.json.who_can_create === 'host', 'the viewer is told they cannot create');
r = await view(105, 'Ann Player'); ok(r.json.role === 'none' && r.json.who_can_create === 'players', 'settings are per Gathering');

// edit and cancel
r = await call('POST', `/plans/1`, { player_id: 'Bob Player', title: 'Hijack' }); ok(r.status === 403, 'someone else cannot edit');
r = await call('POST', `/plans/1`, { player_id: 'Ann Player', title: 'Big breakfast', place: 'Clubhouse' }); ok(r.status === 200, 'the creator edits');
r = await call('POST', `/plans/1`, { player_id: 'Ann Player' }); ok(r.status === 400, 'an empty edit is refused');
r = await view(104, 'Bob Player'); ok(r.json.plans.find(p => p.id === 1).title === 'Big breakfast', 'the edit shows');
r = await call('POST', `/plans/${edPlan}`, { player_id: 'Brian Hager', status: 'cancelled' }); ok(r.status === 200, 'the host can cancel anyone\'s plan');
r = await view(104, 'Bob Player'); ok(!r.json.plans.some(p => p.id === edPlan), 'a cancelled plan disappears');
r = await call('POST', `/plans/${edPlan}/rsvp`, { player_id: 'Bob Player', status: 'yes' }); ok(r.status === 400, 'a cancelled plan takes no RSVPs');
r = await call('POST', '/plans/9999', { player_id: 'Brian Hager', title: 'x' }); ok(r.status === 404, 'unknown plan is a 404');

// default-Yes plan (awards / pizza party): golf Yes players count as going until they decline
await call('POST', '/plans/settings', { gathering_id: 104, host_id: 'Brian Hager', who_can_create: 'players' });
pushes.length = 0;
r = await call('POST', '/plans', { gathering_id: 104, player_id: 'Brian Hager', title: 'Awards + pizza', audience: 'players', default_yes: true });
const pz = r.json.id; ok(r.status === 200 && /counted in/.test(pushes[0].contents.en), 'a default-Yes plan pushes "you are counted in"');
r = await view(104, 'Ann Player'); let pp = r.json.plans.find(p => p.id === pz);
ok(pp.default_yes && pp.counts.yes === 3 && pp.my.assumed && pp.needs_response, 'golf Yes players (Ann, Bob and the host) are counted, and Ann is asked to respond: ' + JSON.stringify(pp.counts));
r = await view(104, 'Brian Hager'); pp = r.json.plans.find(p => p.id === pz); ok(!pp.needs_response && !pp.my.assumed, 'the creator is not prompted');
r = await view(104, 'Ed Invited'); pp = r.json.plans.find(p => p.id === pz); ok(pp.counts.yes === 3 && !pp.needs_response && pp.can_join === false, 'a non-player is not assumed or prompted');
r = await call('GET', '/plans/pending?player_id=Ann%20Player'); ok(JSON.stringify(r.json.gathering_ids) === '[104]', 'pending lists the Gathering for Ann: ' + JSON.stringify(r.json));
ok(r.json.plans.some(p => p.id === pz && p.default_yes && p.counts.yes === 3 && p.gathering_title === '2026 Turkey 2Man'), 'pending carries the plan details for the launch prompt: ' + JSON.stringify(r.json.plans.map(p => [p.id, p.title])));
ok(r.json.plans.find(p => p.id === pz).going.length === 0 && r.json.plans.some(p => p.id !== pz && p.going.includes('Ann Player') === false && p.going.length > 0), 'opt-in plans carry the Yes names, count-me-in plans do not');
ok(r.json.plans.some(p => p.id !== pz), 'it also lists plans she simply has not answered yet (not only count-me-in ones)');
r = await call('GET', '/plans/pending?player_id=Ed%20Invited'); ok(r.json.gathering_ids.length === 0, 'and not for a non-player');
await call('POST', `/plans/${pz}/rsvp`, { player_id: 'Ann Player', status: 'no' });
r = await view(104, 'Ann Player'); pp = r.json.plans.find(p => p.id === pz); ok(pp.counts.yes === 2 && pp.counts.no === 1 && !pp.needs_response && pp.my.status === 'no', 'declining takes her out of the count and clears the prompt');
await call('POST', `/plans/${pz}/rsvp`, { player_id: 'Bob Player', status: 'yes' });
r = await call('GET', '/plans/pending?player_id=Ann%20Player'); ok(!r.json.plans.some(p => p.id === pz), 'once answered, that plan is no longer pending');
r = await call('GET', '/plans/pending?player_id=Bob%20Player'); ok(!r.json.plans.some(p => p.id === pz), 'confirming also clears it');
r = await call('GET', '/plans/pending?player_id=Brian%20Hager'); ok(r.json.plans.length === 0, 'a creator is never prompted for their own plans');
console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
