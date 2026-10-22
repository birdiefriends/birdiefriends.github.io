// Dev-95 — Saturday matchup draw on the draft page: host starts it, captains put up / respond on their links, watchers see it live.
import fs from 'fs'; import { JSDOM } from 'jsdom'; import { fileURLToPath } from 'url'; import { loadEngine } from './extract.mjs';
const HERE = p => fileURLToPath(new URL(p, import.meta.url));
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const E = loadEngine();
const engine = fs.readFileSync(HERE('../bf_engine.js'), 'utf8');
const page = fs.readFileSync(HERE('../../docs/bf-cup-draft.html'), 'utf8').replace(/<script src="bf_engine.js[^>]*><\/script>/, '<script>' + engine + '</script>');
const stats = {}; ['a1','a2','a3','a4','b1','b2','b3','b4'].forEach((n, i) => stats[n] = { hcp: 5 + i });
let doc = { sides: [{ key: 'A', name: 'Team Jake', captain: 'a1', color: 'red', players: ['a1','a2','a3','a4'] }, { key: 'B', name: 'Team Nate', captain: 'b1', color: 'blue', players: ['b1','b2','b3','b4'] }], points: { win: 1, half: 0.5, loss: 0 },
  rounds: [{ key: 'sat', name: 'Saturday', segments: [{ key: 's1', format: 'bestball', from: 1, to: 18 }], matches: [] }],
  draft: { started: true, first: 'A', pool: [], stats, picks: [], locked: true }, access: { A: 'AAA111', B: 'BBB222' },
  pairs: { A: { list: [['a1','a2'],['a3','a4']], locked: true }, B: { list: [['b1','b2'],['b3','b4']], locked: true } } };
const calls = [];
const pub = () => { const c = JSON.parse(JSON.stringify(doc)); delete c.access; return c; };
const fakeFetch = async (u, o) => {
  const J = (x, status = 200) => ({ ok: status < 400, status, json: async () => x });
  calls.push({ u, o });
  if (/\/bfe\/cup\/act/.test(u)) {
    const b = JSON.parse(o.body), side = b.code === 'AAA111' ? 'A' : 'B';
    const r = E.cupMatchupPick(doc, side, b.pair); if (!r.ok) return J({ error: r.reason }, 409);
    doc.matchup = r.matchup; const v = E.cupMatchupView(doc); if (v.done) { doc.rounds[0].matches = v.matches; doc.matchup.done = true; }
    return J({ ok: true, config: pub() });
  }
  if (o && o.method === 'POST') { doc = JSON.parse(o.body).config; return J({ ok: true }); }
  const cap = (u.match(/[?&]cap=([^&]+)/) || [])[1];
  if (cap) { const you = Object.keys(doc.access).find(k => doc.access[k] === cap); return you ? J({ ok: true, config: pub(), you }) : J({ error: 'x' }, 403); }
  if (/[?&]pin=7797/.test(u)) return J({ ok: true, config: JSON.parse(JSON.stringify(doc)) });
  return J({ ok: true, config: pub() });
};
const tick = (ms = 80) => new Promise(r => setTimeout(r, ms));
async function open(query, pin) {
  const dom = new JSDOM(page, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://x.test/bf-cup-draft.html' + query,
    beforeParse(w) { w.fetch = fakeFetch; if (pin) w.sessionStorage.setItem('bf_cup_pin', pin); w.confirm = () => true; } });
  await tick(150); return dom;
}
const click = async (dom, sel) => { const el = dom.window.document.querySelector(sel); if (!el) throw new Error('missing ' + sel); el.click(); await tick(120); };
let dom = await open('?cap=AAA111'); let d = dom.window.document;
ok(/Saturday matchups/.test(d.body.textContent) && /commissioner will start/.test(d.body.textContent) && !d.getElementById('muStart'), 'before the host starts, a captain just waits');
dom = await open('?host=1', '7797'); d = dom.window.document;
ok(d.getElementById('muStart') && /lost the coin toss/.test(d.getElementById('muFirst').innerHTML) && d.getElementById('muFirst').value === 'B', 'host starts it; the coin-toss loser is the default starter');
await click(dom, '#muStart'); d = dom.window.document;
ok(doc.matchup && doc.matchup.first === 'B' && /Team Nate/.test(d.querySelector('.mu-banner').textContent) && /puts up a pair/.test(d.querySelector('.mu-banner').textContent), 'draw is on, Nate puts up first');
dom = await open('?cap=AAA111'); d = dom.window.document;
ok(d.querySelectorAll('[data-mpick]').length === 0 && /Team Nate/.test(d.querySelector('.mu-banner').textContent), 'Jake cannot pick while Nate is on the clock');
dom = await open('?cap=BBB222'); d = dom.window.document;
ok(d.querySelectorAll('[data-mpick]').length === 2 && /your move/.test(d.body.textContent), 'Nate can tap his own two pairs');
await click(dom, '[data-mpick="1"][data-mside="B"]'); d = dom.window.document;
ok(d.getElementById('muConfirm') && /put up/.test(d.querySelector('.sheet').textContent) && /b3 &amp; b4|b3 & b4/.test(d.querySelector('.sheet').textContent), 'tap asks to confirm');
await click(dom, '#muConfirm'); d = dom.window.document;
const act = calls.filter(c => /act/.test(c.u)).pop();
ok(JSON.parse(act.o.body).action === 'match_pick' && JSON.parse(act.o.body).code === 'BBB222' && doc.matchup.log.length === 1, 'the pick goes through /bfe/cup/act with his code');
dom = await open('?cap=AAA111'); d = dom.window.document;
ok(/answers b3 &amp; b4|answers b3 & b4/.test(d.querySelector('.mu-banner').textContent) && d.querySelectorAll('[data-mpick]').length === 2, 'Jake is asked to answer that pair and can tap his pairs');
await click(dom, '[data-mpick="0"]'); await click(dom, '#muConfirm'); d = dom.window.document;
ok(doc.matchup.done === true && doc.rounds[0].matches.length === 2 && /Matchups are set/.test(d.body.textContent) && d.querySelectorAll('.match').length === 2, 'with two pairs a side the first response finishes it; the last pair meets automatically');
ok(doc.rounds[0].matches[0].sides[0].players.join() === 'a1,a2' && doc.rounds[0].matches[0].sides[1].players.join() === 'b3,b4', 'match 1 is the put-up pair versus the answer, in side order');
dom = await open(''); d = dom.window.document;
ok(d.querySelectorAll('.match').length === 2 && /strokes apart|dead even/.test(d.body.textContent), 'a watcher sees the matches with how even each is');
dom = await open('?host=1', '7797'); d = dom.window.document;
await click(dom, '#muUndo'); d = dom.window.document;
ok(doc.matchup.log.length === 1 && doc.rounds[0].matches.length === 0 && !doc.matchup.done, 'host undo takes back the last pick and clears the written matches');
console.log(`test_cup_matchup_page: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
