// A player taken off the game (registration "No") must not count, even if their group keyed scores for them.
import fs from 'fs'; import vm from 'vm';
import { extractFn } from './extract.mjs';
import { fileURLToPath } from 'url';
const src = fs.readFileSync(fileURLToPath(new URL('../portal.html', import.meta.url)), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const c = { gatheringRegData: [
  { gatheringId: 7, player: 'Tom Kobal', status: 'No' }, { gatheringId: 7, player: 'Troy Schwab', status: 'No' },
  { gatheringId: 7, player: 'Carl Stadtmueller', status: 'Yes' }, { gatheringId: 8, player: 'Carl Stadtmueller', status: 'No' }] };
vm.createContext(c); vm.runInContext(extractFn(src, 'gcActiveCards') + '\nthis.f = gcActiveCards;', c);
const cards = ['Tom Kobal', 'troy schwab ', 'Carl Stadtmueller', 'Scott Skeens'].map(p => ({ player: p, holes: [4] }));
const r = c.f(7, cards);
ok(r.length === 2 && r.every(x => !/kobal|schwab/i.test(x.player)), 'removed players dropped (case/space tolerant)');
ok(c.f(8, cards).length === 3, 'another gathering unaffected except its own removals');
ok(c.f(9, cards).length === 4, 'no removals: untouched');
ok(/gcActiveCards\(gatheringId, allCards\)/.test(src) && /No-show: remove/.test(src), 'close sheet uses it and offers removal for players with cards');
console.log(`removed_player_cards: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
