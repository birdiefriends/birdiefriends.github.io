// Repeat (v4.10.11) — running the REAL cleanRepeatTitle and repeatGathering from portal.html.
// Pins: a date typed into a title is stripped on Repeat, weekday words stay, the
// host can edit the title in the single dialog, cancel makes no game, and the
// Repeat picker groups dated titles into one series.
import fs from 'fs';
import { extractFn } from './extract.mjs';
const src = fs.readFileSync(new URL('../portal.html', import.meta.url), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };

const clean = new Function(extractFn(src, 'cleanRepeatTitle') + '; return cleanRepeatTitle;')();
const cases = [
  ['Sham Tuesday 8/18', 'Sham Tuesday'],
  ['Shamalamadingdong Friday 8/14', 'Shamalamadingdong Friday'],
  ['Shammy 8/7', 'Shammy'],
  ['Shammy 8-7-26', 'Shammy'],
  ['CGA Tuesday (8/4)', 'CGA Tuesday'],
  ['Moselem Aug 18', 'Moselem'],
  ['Moselem August 18th, 2026', 'Moselem'],
  ['8/18 - Sham', 'Sham'],
  ['Sham', 'Sham'],
  ['4-man scramble', '4-man scramble'],
  ['May Madness', 'May Madness'],
  ['8/18', '8/18'],            // would be empty: keep original
  ['', ''],
];
for (const [i, o] of cases) ok(clean(i) === o, `clean(${JSON.stringify(i)}) = ${JSON.stringify(clean(i))}, want ${JSON.stringify(o)}`);

// ── repeatGathering: one dialog, edited title is what gets created and notified ──
function run(promptAnswer) {
  const posts = [], sent = [], prompts = [];
  const g = { gatheringId: 7, hostId: 'Walli', name: 'Sham Tuesday 8/18', dt: new Date('2026-08-18T14:00:00'),
    location: 'Blue Shamrock Golf Club', capacity: 4, crewId: 3, crewName: 'Sham', fillListEnabled: false,
    gatheringType: 'Individual Play', description: null, teeTimeStatus: 'confirmed', autoRepeat: false };
  const body = extractFn(src, 'repeatGathering');
  const factory = new Function('deps', `const {gatheringData,currentPlayer,memberData,GATHERINGS_API,nextOccurrenceOfWeekday,formatDate,formatTime,
    toLocalISOString,gatheringsFetchJSON,osSendToPlayers,showToast,refreshGatherings,renderHostArchiveList,cleanRepeatTitle,window,confirm}=deps;
    ${body}; return repeatGathering;`);
  const next = new Date('2026-10-06T14:00:00');
  const fn = factory({
    gatheringData: [g], currentPlayer: 'Walli', memberData: [], GATHERINGS_API: 'https://x',
    nextOccurrenceOfWeekday: () => next, formatDate: () => 'Tue, Oct 6', formatTime: () => '2:00 PM',
    toLocalISOString: d => d.toISOString(),
    gatheringsFetchJSON: async (url, opt) => {
      if (url.includes('/members')) return { ok: true, player_ids: ['Mike', 'Adam'] };
      posts.push(JSON.parse(opt.body)); return { ok: true, id: 99 };
    },
    osSendToPlayers: (names, title, bodyText) => { sent.push({ names, bodyText }); return Promise.resolve(); },
    showToast: () => {}, refreshGatherings: async () => {}, renderHostArchiveList: () => {},
    cleanRepeatTitle: clean,
    window: { prompt: (msg, def) => { prompts.push({ msg, def }); return typeof promptAnswer === 'function' ? promptAnswer(def) : promptAnswer; } },
    confirm: () => { throw new Error('confirm() must not be used'); },
  });
  return fn(7).then(() => ({ posts, sent, prompts }));
}
let r = await run(d => d);                       // accept the pre-filled title
ok(r.prompts.length === 1, 'exactly one dialog');
ok(r.prompts[0].def === 'Sham Tuesday', 'prefilled with date stripped');
ok(/Notify: Sham \(2 players\)/.test(r.prompts[0].msg) && /Oct 6/.test(r.prompts[0].msg), 'dialog still shows date and audience');
ok(r.posts.length === 1 && r.posts[0].title === 'Sham Tuesday', 'created with cleaned title');
ok(r.posts[0].size === 4 && r.posts[0].crew_id === 3 && r.posts[0].venue === 'Blue Shamrock Golf Club', 'other fields copied');
ok(r.sent.length === 1 && /"Sham Tuesday"/.test(r.sent[0].bodyText) && !/8\/18/.test(r.sent[0].bodyText), 'invite names the clean title');
r = await run('  Sham Special  ');
ok(r.posts[0].title === 'Sham Special' && /"Sham Special"/.test(r.sent[0].bodyText), 'edited title used (trimmed)');
r = await run('   ');
ok(r.posts[0].title === 'Sham Tuesday', 'blank answer falls back to cleaned title');
r = await run(null);
ok(r.posts.length === 0 && r.sent.length === 0, 'cancel creates nothing and notifies no one');

// ── picker grouping: dated titles are one series ──
const picker = extractFn(src, 'showRepeatPicker');
ok(/cleanRepeatTitle\(g\.name\)\.toLowerCase\(\)/.test(picker), 'picker groups on the cleaned title');
ok(/escapeHtml\(cleanRepeatTitle\(g\.name\)\)/.test(picker), 'picker shows the cleaned title, escaped');

console.log(`repeat title: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
