// Dev-95 — the BF Cup draft page (real page in jsdom, fake Worker): setup, stats paste, coin, picks, meter, undo, lock, watch mode.
import fs from 'fs'; import { JSDOM } from 'jsdom'; import { fileURLToPath } from 'url';
const HERE = p => fileURLToPath(new URL(p, import.meta.url));
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const engine = fs.readFileSync(HERE('../bf_engine.js'), 'utf8');
const raw = fs.readFileSync(HERE('../../docs/bf-cup-draft.html'), 'utf8');
ok(raw.includes('<script src="bf_engine.js?v=1.24.2">'), 'page loads the matching engine version');
const page = raw.replace(/<script src="bf_engine.js[^>]*><\/script>/, '<script>' + engine + '</script>');
// fake Worker
let doc = { sides: [{ key: 'A', name: 'Team Jake', captain: 'Jake K', color: 'red', players: [] }, { key: 'B', name: 'Team Nate', captain: 'Nate S', color: 'blue', players: [] }], points: { win: 1, half: 0.5, loss: 0 }, rounds: [], pool: ['Jake K', 'Nate S', 'P1', 'P2', 'P3', 'P4'] };
const posts = [];
const fakeFetch = async (u, o) => {
  const J = (x, status = 200) => ({ ok: status < 400, status, json: async () => x });
  if (/\/bfe\/players/.test(u)) return J({ ok: true, players: [{ name: 'P1', current_hcp: 4.5 }, { name: 'p2', current_hcp: 12 }] });
  if (o && o.method === 'POST') { const b = JSON.parse(o.body); if (b.pin !== '7797') return J({ error: 'Unauthorized' }, 403); doc = b.config; posts.push(b); return J({ ok: true }); }
  return J({ ok: true, config: JSON.parse(JSON.stringify(doc)) });
};
async function open(query, pin) {
  const dom = new JSDOM(page, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://x.test/bf-cup-draft.html' + query,
    beforeParse(w) { w.fetch = fakeFetch; if (pin) w.sessionStorage.setItem('bf_cup_pin', pin); w.confirm = () => true; } });
  await new Promise(r => setTimeout(r, 150)); return dom;
}
const tick = (ms = 80) => new Promise(r => setTimeout(r, ms));
let dom = await open('?host=1', '7797'); let d = dom.window.document, w = dom.window;
ok(d.getElementById('poolTxt') && d.getElementById('startDraft').disabled, 'host sees setup; Start is disabled until ready');
ok(!(await open('', null)).window.document.getElementById('poolTxt'), 'a viewer does not see the setup');
d.getElementById('poolTxt').value = 'P1\nP2\nP3\nP4'; d.getElementById('poolSave').click(); await tick();
ok(doc.draft.pool.length === 4, 'pool saved');
d = dom.window.document; d.getElementById('fillHcp').click(); await tick(150); d = dom.window.document;
ok(doc.draft.stats.P1.hcp === 4.5 && doc.draft.stats.P2.hcp === 12, 'handicaps filled from Membership (case-insensitive)');
d.getElementById('statsTxt').value = 'Player\tAVG Achievement\tSum of Birdie Count\tHCP\tPlayer Ranking\nP1\t30\t10\t4.5\t1\nP2\t20\t2\t12\t3\nP3\t25\t5\t8\t2\nP4\t15\t0\t18\t4\nJake K\t28\t6\t6\t5\nNate S\t27\t7\t7\t6\nGhost\t1\t1\t1\t1';
d.getElementById('statsApply').click(); await tick(); d = dom.window.document;
ok(doc.draft.stats.P3.avg === 25 && doc.draft.stats['Jake K'].birdies === 6 && !doc.draft.stats.Ghost, 'stats pasted in, unknown names ignored');
ok(/Ghost/.test(d.body.textContent), 'unmatched names are reported');
d.querySelector('[data-first="B"]').click(); await tick(); d = dom.window.document;
ok(doc.draft.first === 'B' && !d.getElementById('startDraft').disabled, 'toss result set, Start enabled');
d.getElementById('startDraft').click(); await tick(); d = dom.window.document;
ok(doc.draft.started && /Pick 1 of 4/.test(d.body.textContent) && /Team Nate/.test(d.querySelector('.banner.live').textContent), 'draft open, Team Nate (toss winner) on the clock');
ok(d.querySelectorAll('[data-pick]').length === 4 && d.querySelector('.meter'), 'player cards and the balance meter are shown');
// pick P1 for Nate
d.querySelector('[data-pick="P1"]').click(); d = dom.window.document;
ok(/P1/.test(d.querySelector('.sheet').textContent), 'tapping a card asks to confirm');
d.getElementById('confirmPick').click(); await tick(); d = dom.window.document;
ok(doc.draft.picks.length === 1 && doc.draft.picks[0].side === 'B' && doc.draft.picks[0].player === 'P1', 'pick saved to the Worker for the side on the clock');
ok(/Team Jake/.test(d.querySelector('.banner.live').textContent) && /Pick 2/.test(d.body.textContent), 'now Team Jake is on the clock (snake)');
ok(/HCP/.test(d.querySelector('.meter').textContent) && /5\.8/.test(d.querySelector('.meter').textContent) && /6\.0/.test(d.querySelector('.meter').textContent), 'meter shows the averages (Nate 5.8, Jake 6.0)');
// a watcher sees the same, with no pick buttons enabled
ok(d.querySelector('.card.team.cred h2').textContent === 'Team Jake' && d.querySelector('.card.team.cblue h2').textContent === 'Team Nate', 'Team Jake is red, Team Nate is blue');
const wdom = await open('', null); const wd = wdom.window.document;
ok(/LIVE/.test(wd.querySelector('.banner').textContent) && wd.querySelectorAll('[data-pick]:not([disabled])').length === 0, 'watch mode: live banner, cards are not clickable');
// finish: Jake P2, P3 (snake: B A A B), Nate P4
for (const n of ['P2', 'P3', 'P4']) { d = dom.window.document; d.querySelector('[data-pick="' + n + '"]').click(); d = dom.window.document; d.getElementById('confirmPick').click(); await tick(); }
d = dom.window.document;
ok(doc.draft.picks.map(p => p.side).join('') === 'BAAB', 'snake order holds through the draft (got ' + doc.draft.picks.map(p => p.side).join('') + ')');
ok(/Every player is picked/.test(d.body.textContent) && d.getElementById('lock'), 'draft complete, host can lock');
d.getElementById('undo').click(); await tick(); d = dom.window.document;
ok(doc.draft.picks.length === 3 && d.querySelectorAll('[data-pick]').length === 1, 'undo hands the last player back');
d.querySelector('[data-pick="P4"]').click(); d = dom.window.document; d.getElementById('confirmPick').click(); await tick(); d = dom.window.document;
d.getElementById('lock').click(); await tick(); d = dom.window.document;
ok(doc.sides[0].players.join() === 'Jake K,P2,P3' && doc.sides[1].players.join() === 'Nate S,P1,P4' && doc.draft.locked, 'locking writes the rosters (captain first) into the Cup');
ok(posts.every(p => p.pin === '7797'), 'every save carried the PIN');
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
