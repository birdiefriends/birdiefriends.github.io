// Dev-88 (2026-09-29) — three related event-card/rail changes from the same
// design-review conversation:
//   1. The rail now shows which round it's tied to (a truncated event-name
//      label, .acr-name) — Brian: "when it's active it should be clearly
//      articulated what it's tied to," since cascade v2 (portal v4.8.11) can
//      latch the rail on well before/after the obvious "this is clearly my
//      round right now" moment.
//   2. Yardage/Rules/Venue dropped from the event card entirely — Brian:
//      "strip duplicate icons from the Event Cards, yardage, rules are 2
//      examples." All three are identical functions to the rail's own
//      Yardage/Rules/Course buttons, unlike Photo/Notes which are a genuine
//      second capture path, not a pure duplicate.
//   3. The card's Score icon gate tightened from "not the live round right
//      now" to "not competitive at all, ever" — Brian: "the scorecard icon
//      should only be active in non-competition games... when there's not a
//      competitive event that captures the scorecard as part of the live
//      panel process." A gamed Gathering or BFE round hides Score even
//      before/after its live window, not just during it.
import fs from 'fs'; import { extractFn } from './extract.mjs';
import { fileURLToPath } from 'url';
const HERE = (p) => fileURLToPath(new URL(p, import.meta.url));
const src = fs.readFileSync(HERE('../portal.html'), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };

// 1) Rail shows the event name.
const railSrc = extractFn(src, 'renderAtCourseRail');
ok(railSrc.includes('class="acr-name"') && railSrc.includes('${escapeHtml(evt.name)}'), 'rail markup includes a truncated event-name label');
ok(railSrc.includes('title="${escapeHtml(evt.name)}'), 'rail status pill\'s title also carries the full event name (untruncated fallback)');

// 2) Event card: Yardage/Rules/Venue are gone; Photo/Score/Notes/Games remain.
const cardRowMatch = src.match(/<div class="icon-action-row" style="justify-content:flex-start;gap:26px;margin:10px 4px 2px">[\s\S]*?<\/div>\s*<div id="\$\{whoId\}"/);
ok(!!cardRowMatch, 'found the event card icon-action-row block');
const cardRow = cardRowMatch ? cardRowMatch[0] : '';
ok(!cardRow.includes("openYardageModal()"), 'Yardage button removed from the event card');
ok(!cardRow.includes("openRulesModal()"), 'Rules button removed from the event card');
ok(!cardRow.includes("openVenueViewerModal('${evt.id}')") || !cardRow.includes('>Venue<'), 'Venue button removed from the event card (same duplicate-of-rail reasoning)');
ok(cardRow.includes("openCardPhotoSheet('${evt.id}')"), 'Photo capture stays on the card (real second capture path, not a pure duplicate)');
ok(cardRow.includes("openCardNoteSheet('${evt.id}')"), 'Notes capture stays on the card too');
ok(cardRow.includes("openGameDetailsModal('${evt.id}')"), 'Games detail stays on the card (not on the rail at all — different from Yardage/Rules/Venue)');

// 3) Score gate: competitive-ever (isBFEBackedCard OR gamed Gathering), not
// live-right-now. The old `getLiveEvent()?.id === evt.id ? '' : ...` shape
// for Score specifically must be gone.
ok(/\$\{\(isBFEBackedCard\(evt\) \|\| \(evt\.source === 'gathering' && gatheringIsGamed\(gatheringRoundConfig\(evt\.gatheringId\)\)\)\) \? '' : `/.test(cardRow), 'Score gated on ever-competitive (BFE or gamed Gathering), not just the live round');
// Sanity: this new Score gate condition is textually distinct from Photo/
// Notes' getLiveEvent-based gate, confirming they didn't just get merged by
// accident.
const scoreGateIdx = cardRow.indexOf("openCardScoreSheet('${evt.id}')");
const photoGateIdx = cardRow.indexOf("openCardPhotoSheet('${evt.id}')");
ok(scoreGateIdx > photoGateIdx && photoGateIdx > -1, 'Score button still present, ordered after Photo as before');
const scoreBlockStart = cardRow.lastIndexOf('${', scoreGateIdx);
const scoreConditionSrc = cardRow.slice(cardRow.lastIndexOf('<!--', scoreBlockStart), scoreGateIdx);
ok(!scoreConditionSrc.includes("getLiveEvent()?.id === evt.id ? '' :"), 'old live-window-only Score gate shape is gone, replaced by the competitive check');

console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
