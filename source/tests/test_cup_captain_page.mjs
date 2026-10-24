// Dev-95 — captain mode on the draft page: his own link, only his turn, picks go through /bfe/cup/act; host shows the links.
import fs from 'fs'; import { JSDOM } from 'jsdom'; import { fileURLToPath } from 'url';
const HERE = p => fileURLToPath(new URL(p, import.meta.url));
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const engine = fs.readFileSync(HERE('../bf_engine.js'), 'utf8');
const raw = fs.readFileSync(HERE('../../docs/bf-cup-draft.html'), 'utf8');
const page = raw.replace(/<script src="bf_engine.js[^>]*><\/script>/, '<script>' + engine + '</script>').replace(/<script src="bf_live_match.js[^>]*><\/script>/, '<script>' + fs.readFileSync(HERE('../../docs/bf_live_match.js'), 'utf8') + '</script>');
let doc = { sides: [{ key: 'A', name: 'Team Jake', captain: 'Jake', color: 'red', players: [] }, { key: 'B', name: 'Team Nate', captain: 'Nate', color: 'blue', players: [] }], points: { win: 1, half: 0.5, loss: 0 }, rounds: [],
  draft: { started: true, first: 'A', pool: ['P1', 'P2', 'P3', 'P4'], stats: {}, picks: [], locked: false }, access: { A: 'AAA111', B: 'BBB222' } };
const calls = [];
const fakeFetch = async (u, o) => {
  const J = (x, status = 200) => ({ ok: status < 400, status, json: async () => x });
  calls.push({ u, o });
  const pub = () => { const c = JSON.parse(JSON.stringify(doc)); delete c.access; return c; };
  if (/\/bfe\/cup\/act/.test(u)) { const b = JSON.parse(o.body); doc.draft.picks.push({ n: doc.draft.picks.length + 1, side: b.code === 'AAA111' ? 'A' : 'B', player: b.player }); return J({ ok: true, config: pub() }); }
  if (o && o.method === 'POST') { const b = JSON.parse(o.body); doc = b.config; return J({ ok: true }); }
  const cap = (u.match(/[?&]cap=([^&]+)/) || [])[1];
  if (cap) { const you = Object.keys(doc.access).find(k => doc.access[k] === cap); return you ? J({ ok: true, config: pub(), you }) : J({ error: 'Unauthorized' }, 403); }
  if (/[?&]pin=7797/.test(u)) return J({ ok: true, config: JSON.parse(JSON.stringify(doc)) });
  return J({ ok: true, config: pub() });
};
const posts0 = () => { const p = calls.filter(c => c.o && c.o.method === 'POST' && !/act/.test(c.u)).pop(); return p ? JSON.parse(p.o.body).config.access : null; };
const tick = (ms = 80) => new Promise(r => setTimeout(r, ms));
async function open(query, pin) {
  const dom = new JSDOM(page, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://x.test/bf-cup-draft.html' + query,
    beforeParse(w) { w.fetch = fakeFetch; if (pin) w.sessionStorage.setItem('bf_cup_pin', pin); w.confirm = () => true; } });
  await tick(150); return dom;
}
let dom = await open('?cap=AAA111'); let d = dom.window.document;
ok(/YOUR PICK/.test(d.body.textContent) && /Team Jake/.test(d.body.textContent), 'captain A sees it is his pick');
ok([...d.querySelectorAll('[data-pick]')].every(b => !b.disabled) && d.querySelectorAll('[data-pick]').length === 4, 'his player cards are tappable on his turn');
ok(!d.getElementById('undo') && !d.getElementById('resetDraft') && !d.querySelector('[data-copy]'), 'a captain has no host controls and never sees the codes');
d.querySelector('[data-pick="P2"]').click(); await tick(); d = dom.window.document;
ok(d.getElementById('confirmPick') && /P2/.test(d.querySelector('.sheet').textContent), 'tap asks to confirm');
d.getElementById('confirmPick').click(); await tick(150); d = dom.window.document;
const act = calls.filter(c => /\/bfe\/cup\/act/.test(c.u)).pop();
ok(act && JSON.parse(act.o.body).code === 'AAA111' && JSON.parse(act.o.body).player === 'P2' && JSON.parse(act.o.body).action === 'pick', 'the pick goes through /bfe/cup/act with his code');
ok(doc.draft.picks.length === 1 && /Waiting for Team Nate/.test(d.body.textContent) && !d.querySelector('tr.pr.can'), 'after picking he waits and cannot pick again out of turn');
dom = await open('?cap=BBB222'); d = dom.window.document;
ok(/Waiting for Team Jake|YOUR PICK/.test(d.body.textContent) && /YOUR PICK/.test(d.body.textContent), 'captain B is on the clock for pick 2 (snake)');
dom = await open('?cap=wrong'); d = dom.window.document;
ok(/not valid/.test(d.body.textContent) && !d.querySelector('[data-pick]'), 'a bad link is refused');
dom = await open(''); d = dom.window.document;
ok(!d.querySelector('tr.pr.can') && ![...d.querySelectorAll('.banner')].some(b => /YOUR PICK/.test(b.textContent)), 'a spectator can only watch');
dom = await open('?host=1', '7797'); d = dom.window.document;
ok([...d.querySelectorAll('[data-copy]')].length === 2 && /cap=AAA111/.test(d.body.innerHTML) && /cap=BBB222/.test(d.body.innerHTML), 'the host sees both captain links');
// starting a draft generates codes
doc = { sides: doc.sides, points: doc.points, rounds: [], draft: { started: false, first: 'A', pool: ['P1', 'P2'], stats: {}, picks: [] } };
dom = await open('?host=1', '7797'); d = dom.window.document;
d.getElementById('startDraft').click(); await tick(150);
ok(posts0() && /^[A-Z0-9]{6}$/.test(posts0().A) && /^[A-Z0-9]{6}$/.test(posts0().B) && posts0().A !== posts0().B, 'starting the draft makes a different code for each side');

// everyone is picked: each captain gets a sign-off button, a spectator and the host see the status
{
  const saved = JSON.parse(JSON.stringify(doc));
  doc.access = { A: 'AAA111', B: 'BBB222' }; doc.draft = { started: true, first: 'A', pool: ['P1', 'P2'], stats: {}, picks: [{ n: 1, side: 'A', player: 'P1' }, { n: 2, side: 'B', player: 'P2' }], locked: false, signoff: { A: true } };
  let dm = await open('?cap=AAA111'); let dd = dm.window.document;
  ok(dd.getElementById('unsign') && !dd.getElementById('signoff') && /Jake signed off/.test(dd.body.textContent), 'a captain who has signed sees "take it back" and the status');
  dm = await open('?cap=BBB222'); dd = dm.window.document;
  ok(dd.getElementById('signoff') && /Nate to sign off/.test(dd.body.textContent), 'the other captain sees the Sign off button');
  dd.getElementById('signoff').click(); await tick(200);
  ok(calls.some(c => /act/.test(c.u) && c.o && JSON.parse(c.o.body).action === 'signoff' && JSON.parse(c.o.body).code === 'BBB222'), 'the button posts a signoff with his code');
  dm = await open(''); dd = dm.window.document; ok(!dd.getElementById('signoff') && /signed off/.test(dd.body.textContent), 'a spectator sees the status but no button');
  dm = await open('?host=1', '7797'); dd = dm.window.document; ok(!dd.getElementById('signoff') && /host override/.test(dd.body.textContent), 'the host can still lock, labeled as an override');
  doc = saved;
}

// team draft with a captain in control: no first side yet, he sees Start / Defer / Coin toss, the other captain waits
{
  const saved = JSON.parse(JSON.stringify(doc));
  doc.access = { A: 'AAA111', B: 'BBB222' }; doc.draft = { started: true, control: 'A', pool: ['P1', 'P2'], stats: {}, picks: [], locked: false };
  let dm = await open('?cap=AAA111'); let dd = dm.window.document;
  ok(dd.querySelectorAll('[data-ochoice]').length === 3 && /You are in control/.test(dd.body.textContent) && !dd.querySelector('tr.pr.can'), 'the captain in control sees the three choices and cannot pick yet');
  dm = await open('?cap=BBB222'); dd = dm.window.document;
  ok(!dd.querySelector('[data-ochoice]') && /Team Jake is deciding/.test(dd.body.textContent), 'the other captain waits and sees who is deciding');
  dm = await open('?host=1', '7797'); dd = dm.window.document;
  ok(dd.querySelectorAll('[data-oforce]').length === 2, 'the host can still decide for him');
  doc = saved;
}

{ const dm = await open('?cap=AAA111'); const a = dm.window.document.getElementById('backApp'); ok(a && /Back to the app/.test(a.textContent) && a.getAttribute('href') === 'portal.html', 'the draft page has a Back to the app link'); }
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
