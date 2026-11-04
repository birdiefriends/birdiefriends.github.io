// Announcements addressed to one person (partner requests, full-game notices) show only to that person in the portal feed (Brian, 2026-11-04).
import fs from 'fs';
const src = fs.readFileSync(new URL('../portal.html', import.meta.url), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL ' + m); } };
const i = src.indexOf('function buildAnnouncementsHTML('), j = src.indexOf('\n}\n', i);
const body = src.slice(i, j + 3);
const feed = [
  { id: 'a', bf_type: 'gathering_partner', headings: { en: 'Partner request' }, contents: { en: 'x' }, sentAt: 1, meta: { invited: ['Tony'], gathering_id: 5 } },
  { id: 'b', bf_type: 'gathering_capacity', headings: { en: 'Full' }, contents: { en: 'y' }, sentAt: 2, meta: { gathering_id: 5 } },
  { id: 'c', bf_type: 'broadcast', headings: { en: 'Hello' }, contents: { en: 'z' }, sentAt: 3 }
];
function run(player, hosts) {
  const base = { currentPlayer: player, getDismissedIds: () => new Set(), gatheringData: hosts ? [{ gatheringId: 5, hostId: player }] : [], memberData: [], escapeHtml: s => s, esc: s => s };
  const scope = new Proxy(base, { has: () => true, get: (t, k) => k in t ? t[k] : (k === Symbol.unscopables ? undefined : (...a) => ''), });
  const fn = new Function('scope', 'with (scope) { ' + body + ' return buildAnnouncementsHTML; }');
  let html = ''; try { html = fn(scope)(feed, false) || ''; } catch (e) { html = 'ERR ' + e.message; }
  return html;
}
let h = run('Tony', false);
ok(/Partner request/.test(h) && /Hello/.test(h) && !/Full/.test(h), 'the named partner sees the partner request and the broadcast, not the host notice: ' + h.slice(0, 80));
h = run('Chooch', false);
ok(!/Partner request/.test(h) && !/Full/.test(h) && /Hello/.test(h), 'everyone else sees only the broadcast');
h = run('Brian', true);
ok(/Full/.test(h) && !/Partner request/.test(h), 'the host sees the full-game notice');
console.log(`test_announce_audience: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
