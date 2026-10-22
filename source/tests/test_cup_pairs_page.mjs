// Dev-95 — Saturday pairs on the draft page: captain taps two players to pair them, suggestion, lock, reveal; host sees both; watcher sees status.
import fs from 'fs'; import { JSDOM } from 'jsdom'; import { fileURLToPath } from 'url';
const HERE = p => fileURLToPath(new URL(p, import.meta.url));
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const engine = fs.readFileSync(HERE('../bf_engine.js'), 'utf8');
const page = fs.readFileSync(HERE('../../docs/bf-cup-draft.html'), 'utf8').replace(/<script src="bf_engine.js[^>]*><\/script>/, '<script>' + engine + '</script>');
const A = ['Jake', 'A1', 'A2', 'A3'], B = ['Nate', 'B1', 'B2', 'B3'];
const stats = { Jake: { hcp: 8 }, A1: { hcp: 20 }, A2: { hcp: 12 }, A3: { hcp: 14 }, Nate: { hcp: 9 }, B1: { hcp: 18 }, B2: { hcp: 11 }, B3: { hcp: 15 } };
let doc = { sides: [{ key: 'A', name: 'Team Jake', captain: 'Jake', color: 'red', players: A }, { key: 'B', name: 'Team Nate', captain: 'Nate', color: 'blue', players: B }], points: { win: 1, half: 0.5, loss: 0 }, rounds: [],
  draft: { started: true, first: 'A', pool: ['A1', 'A2', 'A3', 'B1', 'B2', 'B3'], stats, picks: [], locked: true }, access: { A: 'AAA111', B: 'BBB222' }, pairs: {} };
const calls = [];
const red = (viewer, host) => { const c = JSON.parse(JSON.stringify(doc)); delete c.access;
  const rev = c.sides.every(s => c.pairs && c.pairs[s.key] && c.pairs[s.key].locked);
  Object.keys(c.pairs || {}).forEach(k => { if (!host && !rev && k !== viewer) c.pairs[k] = { locked: !!c.pairs[k].locked, count: (c.pairs[k].list || []).length }; }); return c; };
const fakeFetch = async (u, o) => {
  const J = (x, status = 200) => ({ ok: status < 400, status, json: async () => x });
  calls.push({ u, o });
  if (/\/bfe\/cup\/act/.test(u)) {
    const b = JSON.parse(o.body), side = b.code === 'AAA111' ? 'A' : 'B';
    doc.pairs = doc.pairs || {};
    if (b.action === 'pair_set') doc.pairs[side] = { list: b.pairs, locked: false };
    if (b.action === 'pair_lock') doc.pairs[side].locked = true;
    if (b.action === 'pair_unlock') doc.pairs[side].locked = false;
    return J({ ok: true, config: red(side) });
  }
  if (o && o.method === 'POST') { doc = JSON.parse(o.body).config; return J({ ok: true }); }
  const cap = (u.match(/[?&]cap=([^&]+)/) || [])[1];
  if (cap) { const you = Object.keys(doc.access).find(k => doc.access[k] === cap); return you ? J({ ok: true, config: red(you), you }) : J({ error: 'x' }, 403); }
  if (/[?&]pin=7797/.test(u)) return J({ ok: true, config: JSON.parse(JSON.stringify(doc)) });
  return J({ ok: true, config: red('') });
};
const tick = (ms = 80) => new Promise(r => setTimeout(r, ms));
async function open(query, pin) {
  const dom = new JSDOM(page, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://x.test/bf-cup-draft.html' + query,
    beforeParse(w) { w.fetch = fakeFetch; if (pin) w.sessionStorage.setItem('bf_cup_pin', pin); w.confirm = () => true; } });
  await tick(150); return dom;
}
const click = async (dom, sel) => { dom.window.document.querySelector(sel).click(); await tick(120); };
let dom = await open('?cap=AAA111'); let d = dom.window.document;
ok(/Saturday pairs/.test(d.body.textContent) && d.querySelectorAll('[data-pp]').length === 4, 'captain A sees his four players to pair');
ok(d.getElementById('pLock').disabled, 'cannot lock with nobody paired');
await click(dom, '[data-pp="Jake"]'); d = dom.window.document;
ok(/Jake<\/b>|✓ Jake/.test(d.body.innerHTML) && d.querySelector('.pp.sel') && /Tap a partner/.test(d.body.textContent), 'first tap selects, with a check mark and a prompt');
await click(dom, '[data-pp="A1"]'); d = dom.window.document;
const sets = calls.filter(c => /act/.test(c.u));
ok(sets.length === 1 && JSON.parse(sets[0].o.body).action === 'pair_set' && JSON.stringify(JSON.parse(sets[0].o.body).pairs) === '[["Jake","A1"]]', 'second tap makes the pair and saves it');
ok(/HCP 28/.test(d.querySelector('.pairc').textContent) && d.querySelectorAll('[data-pp]').length === 2, 'the pair card shows combined HCP and leaves two unpaired');
await click(dom, '[data-unpair="0"]'); d = dom.window.document;
ok(d.querySelectorAll('[data-pp]').length === 4 && !d.querySelector('.pairc'), 'breaking a pair returns both players');
await click(dom, '#pSuggest'); d = dom.window.document;
ok(d.querySelectorAll('.pairc').length === 2 && d.getElementById('pLock') && !d.getElementById('pLock').disabled, 'balanced suggestion pairs everyone and unlocks the Lock button');
ok(/Even-ness: [\d.]+ strokes/.test(d.body.textContent), 'shows how even his pairs are');
await click(dom, '#pLock'); d = dom.window.document;
ok(doc.pairs.A.locked && /Locked/.test(d.body.textContent) && d.getElementById('pUnlock') && !d.querySelector('[data-pp]:not([disabled])'), 'locking freezes his pairs and offers Unlock');
// the other captain cannot see A's pairs yet
dom = await open('?cap=BBB222'); d = dom.window.document;
ok(/Team Jake: 🔒 locked/.test(d.body.textContent) && d.querySelectorAll('.pairc').length === 0 && !/A2 &amp; A3|A3 &amp; A2/.test(d.body.innerHTML), 'captain B sees A is locked but not the pairs');
dom = await open(''); d = dom.window.document;
ok(/Saturday pairs/.test(d.body.textContent) && !d.querySelector('.pairc') && /building their pairs/.test(d.body.textContent), 'a spectator sees status only');
// B builds and locks, then everyone sees both
dom = await open('?cap=BBB222'); d = dom.window.document;
await click(dom, '#pSuggest'); await click(dom, '#pLock'); d = dom.window.document;
ok(/Both sides are locked/.test(d.body.textContent) && d.querySelectorAll('.pairc').length === 4, 'once both lock, both sides show with their pairs');
dom = await open(''); d = dom.window.document;
ok(d.querySelectorAll('.pairc').length === 4, 'and so does a spectator');
// host: both tabs, reopen
dom = await open('?host=1', '7797'); d = dom.window.document;
ok(d.querySelectorAll('[data-preopen]').length === 2, 'the commissioner can reopen either side');
await click(dom, '[data-preopen="B"]'); d = dom.window.document;
ok(doc.pairs.B.locked === false && d.querySelectorAll('[data-ptab]').length === 2 && /Lock my pairs/.test(d.body.textContent), 'reopened side shows the builder with side tabs for the host');
console.log(`test_cup_pairs_page: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
