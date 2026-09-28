// Dev-88, second pass — after v4.8.5's "kill the dupes" turned out to only
// half-fix it (both the Live Panel's own Photos section AND the rail were
// still each offering Photo/Video/Upload for a non-BFE Gathering round —
// confirmed live by Brian: "the photos capabilities are still exposed in the
// live panel... 1) The vertical rail should replace the Live Panel"), this
// covers the real fix: the Live Panel's Photos section only exists at all
// for a BFE-backed round now (its capture posts to the WCRP memories
// pipeline, which the rail deliberately never touches); a non-BFE round's
// capture lives on the rail exclusively, whether or not the Live Panel is
// open. And per the same conversation: the event card's Photo/Score/Notes
// icons are "Gaming Mode" only icons now — they drop out for as long as this
// event IS the live gamed round (getLiveEvent match), not just while the
// Live Panel happens to be expanded, and stay available in "Non-gaming
// Mode" (no games / not the live round) since the card is that event's only
// capture path — how a myMemory gets created for a non-competitive event.
import fs from 'fs'; import { extractFn } from './extract.mjs';
import { fileURLToPath } from 'url';
const HERE = (p) => fileURLToPath(new URL(p, import.meta.url));
const src = fs.readFileSync(HERE('../portal.html'), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log('FAIL', m); };

// 1) buildLivePanel: the Photos live-section only exists for a BFE-backed
// round — not rendered at all (not even an empty shell) for a non-BFE round.
const buildLivePanelSrc = extractFn(src, 'buildLivePanel');
ok(/const photosSection = isBfeRound \? `/.test(buildLivePanelSrc), 'Photos live-section gated on isBfeRound');
ok(buildLivePanelSrc.includes('${photosSection}'), 'gated photosSection is what actually gets spliced into the panel');
ok(!/\$\{isBfeRound \? 'Photos &amp;/.test(buildLivePanelSrc), 'old always-rendered header form is gone (section itself is now conditional, not just its label)');

// 2) buildLivePanelPhotoSection itself is unchanged (still renders Photo/
// Video/Upload + the BFE Note compose) — it's the CALLER that now gates it.
const photoSectionSrc = extractFn(src, 'buildLivePanelPhotoSection');
ok(photoSectionSrc.includes('live-photo-camera-input') && photoSectionSrc.includes('live-video-camera-input') && photoSectionSrc.includes('live-photo-upload-input'), 'Photo/Video/Upload inputs still defined for the BFE case that still uses this section');

// 3) Event card icon-action-row: Photo/Score/Notes gate on getLiveEvent
// matching this event, NOT on whether the Live Panel is expanded.
const cardRowMatch = src.match(/<div class="icon-action-row" style="justify-content:flex-start;gap:26px;margin:10px 4px 2px">[\s\S]*?<\/div>\s*<div id="\$\{whoId\}"/);
ok(!!cardRowMatch, 'found the live event card icon-action-row block');
const cardRow = cardRowMatch ? cardRowMatch[0] : '';
ok(cardRow.includes("getLiveEvent()?.id !== evt.id") && !cardRow.includes('_livePanelOpen && getLiveEvent()?.id === evt.id'), 'Photo/Notes gate on getLiveEvent alone, not _livePanelOpen');
ok(/getLiveEvent\(\)\?\.id === evt\.id \? '' : `/.test(cardRow), 'Score gate on getLiveEvent alone too');

// 4) Rail: the livePanelHere gate is gone — Photo/Video/Upload/Note gate on
// !bfe only, so they stay up regardless of whether the Live Panel is open.
const railSrc = extractFn(src, 'renderAtCourseRail');
ok(!railSrc.includes('livePanelHere'), 'livePanelHere gate removed from the rail entirely');
ok((railSrc.match(/\$\{!bfe \? btn\(/g) || []).length === 4, 'Photo/Video/Upload/Note each gate on plain !bfe (4 buttons)');

console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
