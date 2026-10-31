// BF Cup — a roster entry flagged Sub is kept out of the pool automatically, and the host can swap him in for a player who cannot play.
import fs from 'fs'; import { JSDOM } from 'jsdom'; import { fileURLToPath } from 'url';
const HERE = p => fileURLToPath(new URL(p, import.meta.url));
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const engine = fs.readFileSync(HERE('../bf_engine.js'), 'utf8');
const page = fs.readFileSync(HERE('../../docs/bf-cup-draft.html'), 'utf8').replace(/<script src="bf_engine.js[^>]*><\/script>/, '<script>' + engine + '</script>').replace(/<script src="bf_live_match.js[^>]*><\/script>/, '<script>' + fs.readFileSync(HERE('../../docs/bf_live_match.js'), 'utf8') + '</script>');
const roster = ['Jake', 'Nate', 'P1', 'P2', 'P3', 'P4', 'Rich'].map((n, i) => ({ name: n, hcp: 5 + i, ...(n === 'Rich' ? { sub: true } : {}) }));
let doc = { sides: [{ key: 'A', name: 'A', captain: 'Jake', color: 'red', players: [] }, { key: 'B', name: 'B', captain: 'Nate', color: 'blue', players: [] }], points: { win: 1, half: 0.5, loss: 0 }, rounds: [], draft: { stats: {} }, access: { A: 'codeA', B: 'codeB' } };
const J = (x, st = 200) => ({ ok: st < 400, status: st, json: async () => x, text: async () => '' });
const fakeFetch = async (u, o) => {
  if (/results\.html/.test(u)) return { ok: true, text: async () => '' };
  if (/\/bfe\/events\?event=/.test(u)) return J({ config: { roster } });
  if (o && o.method === 'POST') { doc = JSON.parse(o.body).config; return J({ ok: true }); }
  return J({ ok: true, config: JSON.parse(JSON.stringify(doc)) });
};
const tick = ms => new Promise(r => setTimeout(r, ms));
let confirmMsg = '';
const dom = new JSDOM(page, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://x.test/bf-cup-draft.html?host=1',
  beforeParse(w) { w.fetch = fakeFetch; w.sessionStorage.setItem('bf_cup_pin', '7797'); w.confirm = (m) => { confirmMsg = m; return true; }; } });
await tick(250); let d = dom.window.document;
ok(doc.draft.subs && doc.draft.subs.join() === 'Rich' && doc.draft.pool.join() === 'Jake,Nate,P1,P2,P3,P4', 'a roster entry flagged Sub goes to the Sub box, not the pool');
ok(doc.draft.stats.Rich && doc.draft.stats.Rich.hcp === 11, 'the Sub still has his handicap');
// draft it: B first, snake B A A B -> then lock
d.querySelector('[data-first="A"]').click(); await tick(); d = dom.window.document;
d.getElementById('startDraft').click(); await tick(250); d = dom.window.document;
for (const n of ['P1', 'P2', 'P3']) { d = dom.window.document; d.querySelector('[data-pick="' + n + '"]').click(); d = dom.window.document; d.getElementById('confirmPick').click(); await tick(); }
d = dom.window.document;
ok(doc.draft.picks.length === 4 && doc.draft.picks.every(p => p.player !== 'Rich'), 'all four picks made, the Sub is never one of them');
d.getElementById('lock').click(); await tick(); d = dom.window.document;
ok(doc.draft.locked, 'teams locked');
// matches + scores that mention P1
const sideOfP1 = doc.sides.find(s => s.players.includes('P1')).key, other = sideOfP1 === 'A' ? 'B' : 'A';
doc.rounds = [{ key: 'r1', name: 'Day 1', segments: [{ key: 's', format: 'singles', from: 1, to: 18 }], matches: [{ key: 'm1', sides: [{ side: sideOfP1, players: ['P1'] }, { side: other, players: [doc.sides.find(s => s.key === other).players.find(n => n !== 'Jake' && n !== 'Nate')] }] }] }];
doc.scores = { r1: { m1: { h: { 1: { P1: 4 } } } } };
doc.draft.stats.P1 = { hcp: 6 };
const dom2 = new JSDOM(page, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://x.test/bf-cup-draft.html?host=1&view=teams',
  beforeParse(w) { w.fetch = fakeFetch; w.sessionStorage.setItem('bf_cup_pin', '7797'); w.confirm = (m) => { confirmMsg = m; return true; }; } });
await tick(300); d = dom2.window.document;
ok(d.getElementById('swapOut') && d.getElementById('swapIn') && d.getElementById('swapIn').textContent === 'Rich', 'the host sees the Substitute card with Rich as the one to swap in');
ok([...d.getElementById('swapOut').options].every(o => o.value !== 'Jake' && o.value !== 'Nate'), 'captains cannot be swapped out');
d.getElementById('swapOut').value = 'P1'; d.getElementById('swapGo').click(); await tick(250);
ok(/P1/.test(confirmMsg) && /scores entered/.test(confirmMsg), 'it asks first, and warns that P1 already has scores');
const all = JSON.stringify(doc);
ok(!/"P1"/.test(JSON.stringify({ ...doc, draft: { ...doc.draft, stats: {}, subs: [] } })), 'P1 is gone from picks, teams, matches and scores');
ok(doc.sides.find(s => s.key === sideOfP1).players.includes('Rich'), 'Rich is on P1\'s team now');
ok(doc.rounds[0].matches[0].sides.find(s => s.side === sideOfP1).players[0] === 'Rich', 'Rich is in P1\'s match');
ok(doc.scores.r1.m1.h['1'].Rich === 4 && doc.scores.r1.m1.h['1'].P1 === undefined, 'P1\'s hole score moved to Rich');
ok(doc.draft.subs.join() === 'P1', 'P1 is the Substitute now');
ok(doc.draft.stats.Rich.hcp === 11 && doc.draft.stats.P1.hcp === 6, 'stats stay with each player');
ok(doc.access.A === 'codeA' && doc.sides[0].captain === 'Jake', 'captain codes and captains are untouched');
console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
