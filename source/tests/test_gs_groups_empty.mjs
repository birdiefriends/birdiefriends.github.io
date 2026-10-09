// GS v8.58: with zero groups, dropping a player on the empty Groups area starts Group 1; + Add Group sits in the Groups header.
import fs from 'fs'; import vm from 'vm';
import { extractFn } from './extract.mjs';
const src = fs.readFileSync(new URL('../BF_Golf_Scorer_8.html', import.meta.url), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const saved = []; 
const ctx = { Date, grpGroups: [], grpPlayers: [{ id: 'p1', name: 'Tom Stitt', groupId: null }, { id: 'p2', name: 'Casey', groupId: null }], grpDragId: null,
  grpRender() {}, grpSaveData() { saved.push(1); } };
vm.createContext(ctx);
vm.runInContext(['grpDropToGroup', 'grpDropToEmpty'].map(n => extractFn(src, n)).join('\n') + '; this.f = grpDropToEmpty;', ctx);
let prevented = 0;
ctx.f({ preventDefault() { prevented++; }, dataTransfer: { getData: () => 'p1' } });
ok(ctx.grpGroups.length === 1, 'a group is created');
ok(ctx.grpPlayers[0].groupId === ctx.grpGroups[0].id && ctx.grpPlayers[0].sortOrder === 0, 'the dropped player is in the new group, first');
ok(ctx.grpPlayers[1].groupId === null, 'other players untouched');
ok(saved.length === 1 && prevented >= 1, 'saved once, default prevented');
const hdr = src.indexOf('id="grp-groups-area"'); const area = src.slice(hdr, hdr + 1400);
ok(area.includes('grpAddGroup()') && area.indexOf('grpAddGroup()') < area.indexOf('grp-groups-container'), '+ Add Group is in the Groups header, above the groups');
ok(/id="grp-groups-empty" ondragover="event.preventDefault\(\)" ondrop="grpDropToEmpty\(event\)"/.test(src), 'empty state is a drop target');
ok((src.match(/onclick="grpAddGroup\(\)"/g) || []).length === 1, 'only one + Add Group button (moved, not duplicated)');
console.log(`gs_groups_empty: ${pass} pass, ${fail} fail`); process.exit(fail ? 1 : 0);
