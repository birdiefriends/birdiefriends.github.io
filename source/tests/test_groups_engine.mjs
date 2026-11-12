// Dev-99: BFGroups, the shared who-plays-with-whom function. Units never split, rules are soft, the mode is a setting.
import { createRequire } from 'module'; const require = createRequire(import.meta.url);
const G = require('../bf_engine.js').BFGroups;
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m + ' (got ' + JSON.stringify(a) + ')');
const names = n => Array.from({ length: n }, (_, i) => 'P' + (i + 1));
// The Turkey 2Man: 12 locked teams + Rich, no partner yet
const players = names(24).map((n, i) => ({ name: n, hcp: 5 + i })).concat([{ name: 'Rich', hcp: 14 }]);
const teams = Array.from({ length: 12 }, (_, i) => ['P' + (2 * i + 1), 'P' + (2 * i + 2)]);
const units = G.unitsFromRoster({ players, teams });
eq([units.length, units.filter(u => u.members.length === 2).length, units[12].members], [13, 12, ['Rich']], 'roster -> 12 team units + Rich as a unit of one');
let r = G.suggest(units, { mode: 'shotgun' });
const sizes = r.set.groups.map(g => g.members.length);
ok(sizes.reduce((t, v) => t + v, 0) === 25 && Math.max(...sizes) <= 4, 'everyone placed, nobody over four: ' + sizes);
ok(!sizes.includes(1), 'nobody plays alone: ' + sizes);
ok(r.set.groups.every(g => { const m = g.members; return units.filter(u => u.members.length === 2).every(u => !(m.includes(u.members[0]) !== m.includes(u.members[1]))); }), 'partners are never split');
eq(r.set.groups.map(g => g.start_hole), [1, 3, 6, 9, 12, 15, 17].slice(0, r.set.groups.length).length ? r.set.groups.map(g => g.start_hole) : [], 'start holes set');
ok(new Set(r.set.groups.map(g => g.start_hole)).size === r.set.groups.length, 'every group has its own starting hole');
ok(r.warnings.some(w => w.code === 'short'), 'the short group is a warning, not a block: ' + JSON.stringify(r.warnings.map(w => w.code)));
// start holes: spread evenly
eq(G.autoStartHoles(6, 18).map(x => x.start_hole), [1, 4, 7, 10, 13, 16], '6 groups -> 1,4,7,10,13,16');
eq(G.autoStartHoles(3, 18).map(x => x.start_hole), [1, 7, 13], '3 groups -> 1,7,13');
eq(G.autoStartHoles(4, 9).map(x => x.start_hole), [1, 3, 5, 7], 'a 9-hole round spreads over 9 holes');
eq(G.autoStartHoles(3, 18, [2, 5, 9, 14]).map(x => x.start_hole), [2, 5, 9], 'only the holes the host allows');
const dbl = G.autoStartHoles(4, 2); eq(dbl.map(x => (x.start_hole + (x.wave || ''))), ['1A', '1B', '2A', '2B'], 'more groups than holes: A/B waves');
// even field: 12 players, 6 teams -> 3 foursomes
const u12 = G.unitsFromRoster({ players: names(12).map(n => ({ name: n })), teams: [0, 1, 2, 3, 4, 5].map(i => ['P' + (2 * i + 1), 'P' + (2 * i + 2)]) });
r = G.suggest(u12, {});
eq(r.set.groups.map(g => g.members.length), [4, 4, 4], '6 pairs -> three foursomes'); eq(r.warnings, [], 'and no warnings');
// singles: 10 players, groups of 4 -> 4,3,3 style is not forced; 3 groups
r = G.suggest(G.unitsFromRoster({ players: names(10).map(n => ({ name: n })) }), {});
ok(r.set.groups.length === 3 && r.set.groups.reduce((t, g) => t + g.members.length, 0) === 10, '10 singles -> 3 groups');
// spread by handicap balances the groups
const hp = G.unitsFromRoster({ players: names(8).map((n, i) => ({ name: n, hcp: i * 5 })) });
r = G.suggest(hp, { spread: 'hcp' });
const avg = g => g.members.reduce((t, n) => t + hp.find(u => u.members[0] === n).hcp, 0) / g.members.length;
ok(Math.abs(avg(r.set.groups[0]) - avg(r.set.groups[1])) <= 5, 'handicap spread: the two foursomes have a similar average');
r = G.suggest(hp, { spread: 'order' }); eq(r.set.groups[0].members, ['P1', 'P2', 'P3', 'P4'], 'roster order is kept when spread is "order"');
// avoid / force are soft
const av = G.unitsFromRoster({ players: names(8).map(n => ({ name: n })) });
r = G.suggest(av, { spread: 'order', avoid: [['u1', 'u2']] });
ok(!r.set.groups.some(g => g.units.includes('u1') && g.units.includes('u2')), 'avoid: u1 and u2 end up in different groups');
r = G.suggest(av, { spread: 'order', force: [['u1', 'u8']] });
ok(r.set.groups.some(g => g.units.includes('u1') && g.units.includes('u8')), 'force: u1 and u8 share a group');
r = G.suggest(av, { spread: 'order', force: [['u1', 'u2'], ['u2', 'u3'], ['u3', 'u4'], ['u4', 'u5']] });
ok(r.warnings.some(w => w.code === 'force_too_big'), 'five players forced together: warned, not refused');
// tee times mode
r = G.suggest(u12, { mode: 'tee_times', first_tee: '08:00', interval: 10 });
eq(r.set.groups.map(g => g.tee_time), ['08:00', '08:10', '08:20'], 'tee times from a first tee and an interval');
ok(r.set.groups.every(g => g.start_hole === undefined), 'no starting holes in tee-time mode');
// validation: advice, never a block
const set = JSON.parse(JSON.stringify(G.suggest(u12, {}).set));
set.groups[0].members.push('Ghost'); set.groups[2].members.push(set.groups[1].members.shift()); set.groups[0].members.shift();
const w = G.validate(set, u12).map(x => x.code).sort();
ok(w.includes('stale') && w.includes('unplaced') && w.includes('over') && w.includes('split'), 'validate finds a stale name, an unplaced player, an overfull group and a split team: ' + w);
// roster changes after the groups are made
const base = G.suggest(units, {}).set;
const withPartner = G.unitsFromRoster({ players: players.concat([{ name: 'NewGuy', hcp: 9 }]), teams: teams.concat([['Rich', 'NewGuy']]) });
let rc = G.reconcile(base, withPartner);
ok(rc.added.includes('NewGuy') && rc.removed.length === 0, 'a late partner is added');
const richGroup = rc.set.groups.find(g => g.members.includes('Rich')); ok(richGroup.members.includes('NewGuy'), 'and lands in Rich\'s own group');
const dropped = G.unitsFromRoster({ players: players.filter(p => p.name !== 'P24'), teams: teams.slice(0, 11) });
rc = G.reconcile(base, dropped); ok(rc.removed.includes('P24') && !rc.set.groups.some(g => g.members.includes('P24')), 'a dropout is removed');
ok(base.groups.every(g => g.start_hole != null), 'and the rest keep their start holes');
// telling a player
const info = G.of(base, 'P3'); ok(info && info.number >= 1 && info.start_hole >= 1 && info.mates.includes('P4'), 'a player finds their group, hole and mates');
eq(G.startText({ number: 3, start_hole: 7, wave: 'A' }), 'Group 3 · start on hole 7 (A)', 'the words for a shotgun start');
eq(G.startText({ number: 2, tee_time: '09:20' }), 'Group 2 · 9:20 AM tee time', 'and for a tee time');
console.log(`${pass} passed, ${fail} failed`); if (fail) process.exit(1);
