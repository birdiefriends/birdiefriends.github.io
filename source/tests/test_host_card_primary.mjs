// The host card gets ONE dark (primary) button: the next thing the host should do for the event's state.
import fs from 'fs'; import vm from 'vm'; import { extractFn } from './extract.mjs'; import { fileURLToPath } from 'url';
const src = fs.readFileSync(fileURLToPath(new URL('../portal.html', import.meta.url)), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const ctx = vm.createContext({ console, document: { getElementById: () => null } });
vm.runInContext(['hostCardPrimary', 'toggleHostMore'].map(n => extractFn(src, n)).join('\n') + '\nthis.f = hostCardPrimary;', ctx);
const f = ctx.f, base = { live: false, gamesSet: true, needsGroups: false, groupsPublished: false, spotsLeft: 0 };
ok(f({ ...base, live: true, gamesSet: false, spotsLeft: 3 }) === 'fix', 'live: Fix teams is the one dark button, whatever else is unfinished');
ok(f({ ...base, gamesSet: false }) === 'games', 'setup: games not set up yet -> Games');
ok(f({ ...base, needsGroups: true }) === 'groups', 'setup: games done, groups needed and not published -> Playing groups');
ok(f({ ...base, needsGroups: true, groupsPublished: true, spotsLeft: 2 }) === 'announce', 'setup: groups done, spots open -> fill the field');
ok(f({ ...base }) === 'none', 'nothing left to do: no dark button');
// the markup keeps exactly one primary per card and folds the rest into More while live
const block = src.slice(src.indexOf('listHtml = mine.map(g => {'), src.indexOf('body.innerHTML = `\n    ${mine.length > 0'));
ok((block.match(/btn-primary/g) || []).length === 1 && /cls = k =>/.test(block), 'the card markup has a single computed primary class');
ok(/host-more-\$\{g\.gatheringId\}/.test(block) && /live \? `<\/div><button/.test(block), 'while live, Invite / Open / Repeat / Template / Cancel / Delete sit behind More');
console.log(`host_card_primary: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
