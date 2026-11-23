// Live Edit (Dev-101) engine: the as-played copy, the preview (orphans, sizes, errors vs warnings) and the host-confidence line.
import { loadEngine } from './extract.mjs';
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };
const E = loadEngine(), LE = E.BFLiveEdit;
ok(!!LE && E.ENGINE_VERSION === '1.65.1', 'engine exposes BFLiveEdit, version 1.65.1');
const set = { v: 1, mode: 'shotgun', holes: 18, group_size: 4, groups: [
  { members: ['A','B','C','D'], start_hole: 1 }, { members: ['E','F','G','H'], start_hole: 4 }, { members: ['I','J','K','L'], start_hole: 7 } ] };
const teams = { pairs: [['A','B'],['C','D'],['E','F'],['G','H'],['I','J'],['K','L']], names: ['','','','','',''] };
const plan = LE.fromPlan(set, teams, { team_size: 2 });
ok(plan.planned.players === 12 && plan.planned.groups === 3 && plan.teams.length === 6, 'plan captured');

// whole team no-show: nobody orphaned, pot shrinks, group of 2 is a warning not an error
let p = LE.preview(plan, [{ op: 'out', player: 'K', reason: 'noshow' }, { op: 'out', player: 'L', reason: 'noshow' }]);
ok(p.can_apply && p.orphans.length === 0, 'whole team out: no orphan, can apply');
ok(p.sizes.join() === '4,4,2' && p.warnings.some(w => w.code === 'over') === false, 'sizes 4,4,2');
ok(LE.inPot(p.state) === 10, 'pot is 10 players');
ok(/Planned: 12 players, 3 groups\. Playing: 10 players, 3 groups\. Out: K & L \(no-show\)\./.test(p.line), 'line: ' + p.line);
ok(p.state.out.k && !LE.startHoles(p.state).k && LE.startHoles(p.state).i === 7, 'start holes follow the as-played groups');

// one partner out: the other is an orphan, with choices and NO default
p = LE.preview(plan, [{ op: 'out', player: 'L', reason: 'noshow' }]);
ok(p.orphans.length === 1 && p.orphans[0].players[0] === 'K', 'K is the orphan');
const kinds = p.orphans[0].options.map(o => o.kind);
ok(kinds[0] === 'solo' && kinds.includes('join') && !kinds.includes('pair'), 'options: solo + join other teams (no other orphan to pair with)');
ok(p.orphans[0].options.filter(o => o.kind === 'join').length === 5, 'joins every other full team');
ok(/K is playing alone\./.test(p.line), 'line names the solo');
ok(p.can_apply, 'doing nothing is allowed: K simply plays alone');

// two orphans from different teams can pair up
p = LE.preview(plan, [{ op: 'out', player: 'L', reason: 'noshow' }, { op: 'out', player: 'B', reason: 'noshow' }]);
ok(p.orphans.length === 2 && p.orphans[0].options.some(o => o.kind === 'pair'), 'two orphans can pair');
p = LE.preview(plan, [{ op: 'out', player: 'L', reason: 'noshow' }, { op: 'out', player: 'B', reason: 'noshow' }, { op: 'join', player: 'K', with: 'A' }]);
ok(p.orphans.length === 0 && p.state.teams.some(t => t.members.length === 2 && t.members.includes('K') && t.members.includes('A')), 'K joined A: pair, no orphans');
ok(p.state.groups[0].members.includes('K') && !p.state.groups[2].members.includes('K'), 'K moved into A\'s group');

// 3-some: K joins E&F; group 2 becomes 5, warning only; scramble teams carry the 3-some
p = LE.preview(plan, [{ op: 'out', player: 'L', reason: 'noshow' }, { op: 'join', player: 'K', with: 'E' }]);
ok(p.state.groups[1].members.length === 5 && p.warnings.some(w => w.code === 'over' && w.group === 1) && p.can_apply, '5-some warns but applies');
ok(LE.scrambleTeams(p.state).pairs.some(pr => pr.length === 3), 'scramble teams include a 3-some');
ok(/E & F & K is a 3-some/.test(p.line), 'line: ' + p.line);

// solo + moves + start hole + new group
p = LE.preview(plan, [{ op: 'solo', player: 'K' }, { op: 'move', players: ['K'], group: 3 }, { op: 'startHole', group: 3, hole: 10 }]);
ok(p.state.groups.length === 4 && p.state.groups[3].members.join() === 'K' && p.state.groups[3].start_hole === 10, 'K starts a new group on 10');
ok(p.state.teams.some(t => t.members.join() === 'K') && p.state.teams.some(t => t.members.join() === 'L'), 'K and L each a team of one');
ok(p.warnings.some(w => w.code === 'alone'), '1-player group is a warning');
ok(p.orphans.length === 2, 'both left alone are listed for the host');

// split team warns
p = LE.preview(plan, [{ op: 'move', players: ['A'], group: 1 }]);
ok(p.warnings.some(w => w.code === 'split'), 'moving one partner away warns that the team is split');
// moving an emptied group: it disappears; start hole counts
p = LE.preview(plan, [{ op: 'move', players: ['I','J','K','L'], group: 0 }]);
ok(p.state.groups.length === 2 && p.sizes.join() === '8,4', 'emptied group disappears');
// shared hole is advice
p = LE.preview(plan, [{ op: 'startHole', group: 2, hole: 1 }]);
ok(p.warnings.some(w => w.code === 'hole_shared' && w.hole === 1) && p.can_apply, 'two groups on a hole: warning');

// errors block apply
const bad = JSON.parse(JSON.stringify(plan)); bad.groups[1].members.push('A');
p = LE.preview(bad, []);
ok(!p.can_apply && p.errors.some(e => e.code === 'duplicate'), 'a player in two groups blocks Apply');
const nob = LE.preview(plan, 'ABCDEFGHIJKL'.split('').map(n => ({ op: 'out', player: n, reason: 'noshow' })));
ok(!nob.can_apply, 'nobody left blocks Apply');

// withdrew: stays on team and in pot, but is marked
p = LE.preview(plan, [{ op: 'out', player: 'L', reason: 'withdrew' }]);
ok(LE.inPot(p.state) === 12 && p.orphans.length === 0 && /Out: L \(withdrew\)/.test(p.line), 'withdrawn player keeps their ante and team');
// cards: no-show's keyed card is dropped, a withdrawn player's card counts
const cards = [{ player: 'K' }, { player: 'L' }, { player: 'A' }];
ok(LE.activeCards(LE.preview(plan, [{ op: 'out', player: 'K', reason: 'noshow' }]).state, cards).map(c => c.player).join() === 'L,A', 'no-show card excluded');
ok(LE.activeCards(p.state, cards).length === 3, 'withdrawn card kept');
// back: an Out player can return
const back = LE.apply(LE.apply(plan, [{ op: 'out', player: 'K', reason: 'noshow' }]).state, [{ op: 'back', player: 'K', group: 2 }]).state;
ok(back.groups[2].members.includes('K') && !back.out.k && back.teams.some(t => t.members.join() === 'K'), 'restored as a solo in the chosen group');
// apply does not mutate its input
ok(plan.groups[2].members.length === 4 && !plan.out.k, 'input state is untouched');

// ── swap and add (a recruit from the parking lot) ──
// replace: L is a no-show, Z takes L's place: same team (with K), same group, same start hole
p = LE.preview(plan, [{ op: 'replace', out: 'L', player: 'Z' }]);
ok(p.state.teams.some(t => t.members.includes('K') && t.members.includes('Z')) && p.orphans.length === 0, 'Z replaces L on K\'s team: no orphan');
ok(p.state.groups[2].members.includes('Z') && !p.state.groups[2].members.includes('L') && p.state.groups[2].start_hole === 7, 'Z is in L\'s group, same hole');
ok(LE.inPot(p.state) === 12 && /Out: L \(no-show\)\. Added: Z\./.test(p.line), 'pot unchanged (L out, Z in); line: ' + p.line);
ok(LE.startHoles(p.state).z === 7, 'Z starts where L did');
// replace a whole team member whose partner already left: Z becomes a team of one in that group
p = LE.preview(plan, [{ op: 'out', player: 'K', reason: 'noshow' }, { op: 'replace', out: 'L', player: 'Z' }]);
ok(p.state.teams.some(t => t.members.join() === 'Z') && p.state.groups[2].members.join() === 'I,J,Z', 'replacing the last of a team: Z is alone in the group');
// add: joins a team (3-some) or plays alone in a group or a new group
p = LE.preview(plan, [{ op: 'add', player: 'Z', with: 'E' }]);
ok(p.state.teams.some(t => t.members.length === 3 && t.members.includes('Z')) && p.state.groups[1].members.includes('Z') && p.sizes.join() === '4,5,4', 'Z joins E & F as a 3-some in group 2');
ok(LE.inPot(p.state) === 13 && /Playing: 13 players/.test(p.line) && /Planned: 12/.test(p.line) && /Added: Z\./.test(p.line), 'Planned 12, Playing 13: ' + p.line);
p = LE.preview(plan, [{ op: 'add', player: 'Z', group: 0 }]);
ok(p.state.teams.some(t => t.members.join() === 'Z') && p.state.groups[0].members.includes('Z') && p.orphans.some(o => o.players[0] === 'Z'), 'Z alone in group 1 and listed as short of a team');
p = LE.preview(plan, [{ op: 'add', player: 'Z', group: 3 }, { op: 'startHole', group: 3, hole: 10 }]);
ok(p.state.groups.length === 4 && p.state.groups[3].members.join() === 'Z' && p.state.groups[3].start_hole === 10, 'Z in a new group on 10');
// adding someone already playing does nothing; adding a returning no-show clears Out
p = LE.preview(plan, [{ op: 'add', player: 'A', with: 'E' }]);
ok(p.state.groups[0].members.includes('A') && !p.state.groups[1].members.includes('A') && p.sizes.join() === '4,4,4', 'adding a player who is already playing is ignored');
p = LE.preview(plan, [{ op: 'out', player: 'K', reason: 'noshow' }, { op: 'add', player: 'K', group: 2 }]);
ok(!p.state.out.k && p.state.groups[2].members.includes('K'), 'a no-show who shows up can be added back');
// options listing: no default, every group offered
const opts = LE.addOptions(plan, 'Z');
ok(opts.filter(o => o.kind === 'join').length === 6 && opts.filter(o => o.kind === 'solo').length === 3 && opts[opts.length - 1].kind === 'newgroup', 'add options: join each team, play alone in each group, or a new group');
ok(opts.find(o => o.kind === 'join' && o.with === 'E').group_size_after === 5, 'each option shows the group size it makes');
// a recruit's card counts, a no-show's does not
ok(LE.activeCards(LE.preview(plan, [{ op: 'replace', out: 'L', player: 'Z' }]).state, [{ player: 'L' }, { player: 'Z' }]).map(c => c.player).join() === 'Z', 'replacement card counts, no-show card does not');
console.log(`live_edit_engine: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
