// Dev-98 — BFE-Admin: "Games and money" on each Cup round row (section 4), generated from the game registry (real page in jsdom, fake Worker).
import fs from 'fs'; import { JSDOM } from 'jsdom'; import { fileURLToPath } from 'url';
const HERE = p => fileURLToPath(new URL(p, import.meta.url));
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const engine = fs.readFileSync(HERE('../bf_engine.js'), 'utf8');
let html = fs.readFileSync(HERE('../../docs/BFE-Admin.html'), 'utf8');
html = html.replace(/<script src="bf_engine.js[^>]*><\/script>/, () => '<script>' + engine.replace(/<\/script>/g, '<\\/script>') + '</script>');
const PARS = [4, 4, 3, 4, 5, 4, 5, 3, 4, 3, 5, 4, 4, 4, 3, 4, 5, 3];
const posts = []; let stored = null;
const json = (o, status) => ({ ok: (status || 200) < 400, status: status || 200, json: async () => o });
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://x.test/BFE-Admin.html',
  beforeParse(w) {
    w.fetch = async (u, o) => {
      if (o && o.method === 'POST') { posts.push({ u, body: JSON.parse(o.body) }); stored = JSON.parse(o.body).config; return json({ ok: true }); }
      if (/\/bfe\/players/.test(u)) return json({ ok: true, players: [] });
      if (/\/bfe\/events\?event=/.test(u)) return json({ config: null });
      if (/\/bfe\/events-list/.test(u)) return json({ events: [] });
      if (/\/bfe\/cup\?/.test(u)) return stored ? json({ config: JSON.parse(JSON.stringify(stored)) }) : json({}, 404);
      return json({ ok: true });
    };
    w.alert = () => {}; w.confirm = () => true;
  } });
const w = dom.window, d = w.document;
const wait = ms => new Promise(r => setTimeout(r, ms));
await wait(200);
const fire = (el, type) => el.dispatchEvent(new w.Event(type, { bubbles: true }));
const en = d.getElementById('cupEnabled'); en.checked = true; fire(en, 'change');
const setEngine = (tr, v) => { tr.querySelector('.r-engine').value = v; fire(tr.querySelector('.r-engine'), 'change'); };
const layout = (tr, v) => { tr._detail.querySelector('.r-layout').value = v; fire(tr._detail.querySelector('.r-layout'), 'change'); };
w.addRoundRow('Cup Sat'); w.addRoundRow('Cup Sun');
const all = [...d.querySelectorAll('#roundsBody tr.roundRow')], sat = all[all.length - 2], sun = all[all.length - 1];
setEngine(sat, 'cup_match'); setEngine(sun, 'cup_match'); layout(sat, 'fb_fs'); layout(sun, 'si18'); await wait(30);
d.getElementById('eventName').value = '2026 BF Cup'; d.getElementById('cupNameA').value = 'Team Jake'; d.getElementById('cupNameB').value = 'Team Nate';
const names = Array.from({ length: 16 }, (_, i) => 'P' + (i + 1));
w.eval('cupState.draft = ' + JSON.stringify({ pool: names, subs: [] }) + '; cupState.handicap.pars = ' + JSON.stringify(PARS));
const box = tr => tr._detail.querySelector('.r-games');
const line = tr => box(tr).querySelector('.g-line').textContent.replace(/\s+/g, ' ');
const entry = (tr, v) => { const e = box(tr).querySelector('.g-entry'); e.value = String(v); fire(e, 'input'); };
const addGame = (tr, id) => { const s = box(tr).querySelector('.g-add'); s.value = id; box(tr).querySelector('.g-addbtn').click(); };
const field = (tr, i, key, v) => { const e = box(tr).querySelector('[data-gi="' + i + '"][data-gf="' + key + '"]'); e.value = String(v); fire(e, 'input'); return e; };

ok(box(sat) && box(sun) && /Games and money/.test(box(sat).textContent), 'each Cup round row has a Games and money block');
ok(!sat.querySelector('.r-games') && sat._detail.contains(box(sat)), 'it lives with the round\'s segments in section 4 (the round\'s detail row)');
ok([...box(sat).querySelectorAll('.g-add option')].map(o => o.value).join() === 'cttp,skins,birdiepay', 'the games offered are the registry\'s Cup games: CTP, Skins, Birdie Payouts');
ok(w.eval('cupState.rounds.every(r => !r.games)'), 'nothing configured = no games in the Cup');
// --- Saturday: $5 entry, CTP at $5 a player on the default par 3s
entry(sat, 5); addGame(sat, 'cttp');
ok(box(sat).querySelectorAll('[data-gi="0"]').length === 2 && /\$ per player/.test(box(sat).textContent) && !/\$ per hole/.test(box(sat).textContent) && !/Hole mode/.test(box(sat).textContent), 'the CTP form is generated from the schema ($ per player, holes) and hides what the Cup fixes (no per-hole box, no hole mode)');
ok(/enter \$ per player/.test(line(sat)), 'before an amount is entered the line says what to enter: ' + line(sat));
field(sat, 0, 'dollar_per_player', 5); await wait(30);
ok(/Each CTP is worth \$16/.test(line(sat)) && /\$5 a player × 16 players ÷ 5 holes/.test(line(sat)) && /Round pot \$80 \(16 players\)/.test(line(sat)) && !/goes back/.test(line(sat)) && !/required/.test(line(sat)), 'CTP at $5 a player: each hole is worth $16 and the whole $80 pot is used: ' + line(sat));
ok(box(sat).querySelector('[data-gf="holes"]').placeholder === 'blank = every par 3', 'blank CTP holes mean the par 3s');
field(sat, 0, 'dollar_per_player', 2); await wait(30);
ok(/Each CTP is worth \$6/.test(line(sat)) && /the other \$50 goes back to the players/.test(line(sat)), 'a smaller CTP leaves money for the players: ' + line(sat));
field(sat, 0, 'dollar_per_player', 5); await wait(30);
// --- Skins on Saturday is refused with the reason (Greensomes holes have one score per pair)
addGame(sat, 'skins'); await wait(30);
ok(/Greensomes records one score per pair/.test(line(sat)), 'Skins on a round with Greensomes is flagged by the engine\'s own check: ' + line(sat));
box(sat).querySelector('[data-gx="1"]').click(); await wait(30);
ok(!/Greensomes records/.test(line(sat)), 'remove it and the problem clears');
// --- Sunday: $15 entry, CTP $16 a hole + skins
entry(sun, 15); addGame(sun, 'cttp'); field(sun, 0, 'dollar_per_player', 5); addGame(sun, 'skins'); await wait(30);
ok(/Weekend buy-in \$20 a player/.test(line(sun)) && /Cup Sat \$5 \+ Cup Sun \$15/.test(line(sun)), 'the weekend buy-in adds the rounds: $5 + $15 = $20');
ok(/pot \$240/.test(line(sun)) && /Skins gets the other \$160 plus any unclaimed CTP/.test(line(sun)) && /Each CTP is worth \$16/.test(line(sun)) && !/color:#b71c1c/.test(box(sun).querySelector('.g-line').innerHTML), 'Sunday: pot $240, CTP $80 set aside, skins $160, no problem: ' + line(sun));
ok(!box(sun).querySelector('[data-gf="basis"]'), 'skins is gross on a Cup (no net choice shown)');
// --- what is saved
w.cupSyncFromInputs(); w.cupSyncRounds();
const rs = JSON.parse(JSON.stringify(w.eval('cupState.rounds')));
ok(JSON.stringify(rs[0].games) === JSON.stringify({ entry_per_player: 5, addons: [{ id: 'cttp', dollar_per_player: 5 }] }), 'Saturday games in the Cup: ' + JSON.stringify(rs[0].games));
ok(JSON.stringify(rs[1].games) === JSON.stringify({ entry_per_player: 15, addons: [{ id: 'cttp', dollar_per_player: 5 }, { id: 'skins', basis: 'gross' }] }), 'Sunday games in the Cup: ' + JSON.stringify(rs[1].games));
// --- a problem blocks the save
field(sun, 0, 'dollar_per_player', 60); await wait(30);
ok(/more than the \$240\.00 pot/.test(line(sun)), 'CTP $60 a player on a $15 entry is caught by the shared pot-fit guard: ' + line(sun));
d.getElementById('cupSaveBtn').click(); await wait(80);
ok(posts.length === 0 && /Fix the games first/.test(d.getElementById('cupStatus').textContent), 'save is refused while a round\'s games do not fit');
field(sun, 0, 'dollar_per_player', 5); await wait(30);
d.getElementById('cupSaveBtn').click(); await wait(100);
ok(posts.length === 1 && stored.rounds[0].games.entry_per_player === 5 && stored.rounds[1].games.addons.length === 2, 'saved with the games on each round');
// --- reload brings the games back into the rows
for (const tr of [sat, sun]) { tr._gamesFromCup = false; tr._gamesDirty = false; w.eval('0'); }
w.eval("[...document.querySelectorAll('#roundsBody tr.roundRow')].forEach(tr => { if (tr._games) { tr._games = { entry_per_player: '', addons: [] }; cupGamesRender(tr); } })");
ok(box(sat).querySelector('.g-entry').value === '' && !box(sat).querySelector('[data-gi]'), 'rows emptied (as on a fresh page)');
await w.cupLoad(true); await wait(80);
ok(box(sat).querySelector('.g-entry').value === '5' && box(sat).querySelector('[data-gi="0"][data-gf="dollar_per_player"]').value === '5', 'Load saved Cup puts Saturday\'s games back in the form');
ok(box(sun).querySelectorAll('.g-list > div').length === 2 && /Skins/.test(box(sun).textContent), 'and Sunday\'s CTP + skins');
// --- an older Cup record with a fixed $ per hole loads without it: the form is per player only, and says what to enter
w.cupSetGames(sat, { entry_per_player: 5, addons: [{ id: 'cttp', dollar_per_hole: 5 }] }); await wait(30);
ok(box(sat).querySelector('[data-gf="dollar_per_player"]').value === '' && /enter \$ per player/.test(line(sat)) && !/\$25/.test(line(sat)), 'an old fixed $5-a-hole record loads blank and asks for $ per player: ' + line(sat));
w.cupSetGames(sat, { entry_per_player: 5, addons: [{ id: 'cttp', dollar_per_player: 5 }] }); await wait(30);
// --- a save from a page that never opened the games form must not wipe them
for (const tr of [sat, sun]) { tr._gamesFromCup = false; tr._gamesDirty = false; tr._games = { entry_per_player: '', addons: [] }; }
w.cupSyncRounds(); const before = posts.length;
d.getElementById('cupSaveBtn').click(); await wait(100);
ok(posts.length === before + 1 && stored.rounds[0].games && stored.rounds[0].games.entry_per_player === 5 && stored.rounds[1].games.addons.length === 2, 'a re-save from a page that never loaded the games keeps what the Cup holds');
// --- removing everything on purpose does remove them
for (const tr of [sat]) { tr._gamesDirty = true; w.cupSetGames(tr, null); tr._gamesDirty = true; }
w.cupSyncRounds(); d.getElementById('cupSaveBtn').click(); await wait(100);
ok(!stored.rounds[0].games && stored.rounds[1].games, 'clearing a round\'s games on purpose removes them (only that round)');
// --- a stale copy of the page must not undo the host's Substitute swap (the Cup page owns the draft, teams, pairs and matches)
w.eval("cupState.sides[0].players = ['Jeff Rapp', 'Old Mate']; cupState.draft = { subs: ['Rich Penberg'], picks: ['Jeff Rapp'] }; cupState.rounds[0].matches = [{ key: 'm1', sides: [{ side: 'A', players: ['Jeff Rapp', 'Old Mate'] }, { side: 'B', players: ['P', 'Q'] }] }];");
stored.sides[0].players = ['Rich Penberg', 'Old Mate']; stored.draft = { subs: ['Jeff Rapp'], picks: ['Rich Penberg'] };
stored.rounds[0].matches = [{ key: 'm1', sides: [{ side: 'A', players: ['Rich Penberg', 'Old Mate'] }, { side: 'B', players: ['P', 'Q'] }] }];
d.getElementById('cupSaveBtn').click(); await wait(100);
ok(stored.sides[0].players.includes('Rich Penberg') && !stored.sides[0].players.includes('Jeff Rapp') && stored.draft.subs[0] === 'Jeff Rapp' && JSON.stringify(stored.rounds[0].matches).includes('Rich Penberg') && !JSON.stringify(stored.rounds[0].matches).includes('Jeff Rapp'), 'a save from an older copy of this page keeps the swap: Rich stays in, Jeff stays out (team, draft, match)');
console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
