# BF_Session_Bootstrap.md — Start Here for a New BirdieFriends Session
**Status:** current as of Dev-87 close, 2026-09-24 — **Gatherings Close & Calculate shipped**
(portal v4.6.0 + a `BF_Experiences.js` route; v4.6.1 then moved Gatherings CTP from Jotform to D1; v4.6.2 fixed non-Skins Gatherings scoring to Jotform and added a My History Close entry for the host): the host of a gamed Gathering closes the round from
the Live Panel, the Skins/CTP/BirdieBall payout is computed on whoever actually turned in a scorecard,
and results post to that Gathering's My History story (see §2a). **The Wally Cup Rd3/Overall
carry-forward is retired** — Brian confirmed in Dev-87 that the event wrapped; it's no longer an open
item anywhere in this doc. **Not yet live-verified** — Dev-87 ended at delivery; first thing next
session is a real close on a test Gathering (see §3). Read
this file first in
any new BirdieFriends chat before touching code — it's meant to be self-sufficient enough
that you never need to re-read `BF_Session_Log.md` line by line to get oriented (that log
is the detailed history; this doc is the map). Fetch it and the spec docs below via
`curl` at session start — see §4, don't ask Brian to paste them. `BF_WallyCup_Spec.md` is
the living design reference for the Wally Cup event specifically — read it too before
touching Groupings, the results page, Close Round, Overall Standings, or the 2Man team
quota (its formula was wrong in this spec itself until Dev-83 — now corrected).
`BF_WCRP_Memories_Spec.md`'s "What actually shipped (Dev-80)", "What changed in Dev-83", and
"What changed in Dev-84" addenda are the reference for the memories/Trip-Info work
specifically. `BF_BFE_NextGen_Spec.md` is the new living design-notes doc for the BFE
rearchitecture (venue data, game engine, handicap, scoring, live scoring, build sequence) —
read it before starting any Dev-87+ work on that rearchitecture; it is still design notes,
not yet a build plan with tickets. **There is no real session numbering beyond this one
(Dev-87) — don't invent or reuse "Dev-NNN" labels for individual fixes. This has now happened
twice (briefly in Dev-82, then again all through Dev-83's own code comments, climbing from
wherever Dev-82 left off through "Dev-108") despite Dev-82 believing it had corrected the
mistake same-session. It hadn't. It was also nearly repeated in Dev-84 (a code comment briefly
read "Dev-95" before being caught and rewritten). Whatever number the codebase's own comments
are already at when you start reading them is not a real precedent to continue from — a
session is one Dev-# for its whole duration; describe an individual change by what it
touches, never by inventing it its own number.**
---
## 1. What this project is
BirdieFriends (birdiefriends.com) is a golf league management platform. Brian is the sole
developer and commissioner, builds it entirely through Claude sessions, and also plays in
it as a real competitive golfer ("Brian Hager" is his player identity — a separate,
inactive member "Brian McCabe" also exists in old data, don't confuse them). There are two
apps and two Cloudflare Workers:
- **`portal.html`** — the player-facing app. Events/Gatherings home screen, registration,
  the Live Panel (in-round scorecard/CTP/Birdie Alert/photo capture during play), results
  pages, admin/commissioner controls behind a gear icon. This is the file most session work
  touches. Currently v4.7.0 (see `portal_version.txt` — **bump this with every
  `portal.html` change and deliver it alongside**, format `vX.Y.Z · YYYY-MM-DD` /
  `Deployed: YYYY-MM-DD HH:MM`; nothing bumps it automatically).
- **`BFE-Admin.html`** — commissioner-only admin tool for BFE ("BirdieFriends
  Experiences") competitive events — currently just the 2026 Wally Cup. Roster/quota setup,
  round definitions, tee/venue policy (incl. CTP holes), payout config, Player Groupings
  (draft/flighted/social/pinned), Close Round (pulls scorecards from Jotform, computes
  skins/CTP/podium, runs the quota engine, persists results), and Publish Results (the
  player-facing results page, now including the memories scrapbook — see §2/§3). PIN-gated
  (`7797`) for anything that writes. No separate version file — tracked only via
  `BF_Session_Log.md`.
- **`BF_Experiences.js`** — the `bf-experiences` Worker (`BFE_API =
  https://bf-experiences.birdiefriends01.workers.dev`). D1-backed: `bfe_events` (event
  config: roster, rounds, teePolicy, payout, `memories_capture_open`, `trip_info_url`),
  `bfe_venue_tee_catalog` (per-venue tee/CTP info, shared by BFE-Admin's Tee Policy AND
  portal.html's Venue Manager), `bfe_round_groups` (Player Groupings),
  `bfe_round_results`/`_skins`/`_cttp` (Close Round output), `bfe_event_memories`/
  `bfe_event_memory_notes` (WCRP photos/videos/notes, keyed by `round_name` not a round
  id — see §2). **New as of Dev-86, despite the `bfe_` prefix these are Gatherings-side, not
  Wally Cup/BFE-production:** `bfe_gathering_games` (host-configured per-Gathering game
  selection — Skins/CTP/BirdieBall — + per-game config JSON incl. `cttp_config`/
  `birdieball_config`; pre-warmed client-side into `_gatheringGamesIndex`,
  `Map<gatheringId, parsedConfigRow>`, via `refreshGatheringGamesIndex()`) and
  `bfe_birdieball_answers` (`gathering_id`, `player_name`, `kept` bool, `lost_hole`,
  `lost_stroke`, `UNIQUE(gathering_id, player_name)` upsert — see §2a). Routes under `/bfe/*`.
- **Main `worker.js`** — the `birdiefriends-push` Worker (`GATHERINGS_API =
  https://birdiefriends-push.birdiefriends01.workers.dev`). Everything else: Gatherings,
  push notifications (OneSignal, via `osSendAll`/`osSendToPlayers`), the OLD/general
  photo/video capture pipeline (`event_photos` D1 table + R2 storage + `curation_status` —
  this is a completely separate table/pipeline from BFE's own `bfe_event_memories`; Portal's
  "My History" reads from this one, not the WCRP one — see the Dev-80 log for a real
  cross-system mix-up this caused), member preferences, the Membership roster. Not present
  in this cloud workspace's file list this session — treat as "known to exist, fetch/ask
  for it if a task needs to read or change it."
- **Jotform** is the actual data-entry backend for a lot of real-world input: the "Request
  Event" form (`REQUEST_FORM_ID`) is the sole source of every event/round card on the
  Portal home (including Wally Cup rounds — BFE-Admin's own round config is independent of
  this and doesn't drive the Portal home cards); a Scorecard form and a CTP form back Live
  Panel submissions and Close Round's data pull. `JOTFORM_API_KEY` is hardcoded
  client-side in `portal.html` — a known, deliberately-deferred security backlog item (see
  §5). `BFE-Admin.html`'s own copy of this key was moved server-side into the BFE Worker in
  Dev-83b — BFE-Admin no longer calls Jotform directly at all; it proxies through
  `/bfe/jotform/submissions` on `bf-experiences.birdiefriends01.workers.dev`.
**Deployment — I never do this myself.** Brian runs his own local `bf_push.bat`/
`bf_push.ps1` against a folder called AutoPush, then does his own Cloudflare
paste-and-deploy step for Worker changes. My job is to prepare and verify files, then
deliver them: `SendUserFile` first, then (when linked to Brian's computer)
`mcp__remote-devices__device_commit_files` into
`C:\Users\16177\Downloads\GolfScorer\AutoPush`. I do not run deploy commands or push to
Cloudflare/GitHub myself. **Since Dev-80, one exception:** changes to `bf_push.ps1` itself
get committed DIRECTLY to the live file at that AutoPush path (not just delivered as the
`bf_push_library.ps1` archival snapshot) — see §4 for the full rule.
## 2. Where the 2026 Wally Cup stands
**Event wrapped — confirmed by Brian, Dev-87.** Everything below is history for reference; the
Dev-84 "status unknown" note and every Rd3/Overall carry-forward are resolved.
Full design is in `BF_WallyCup_Spec.md` — read it before touching any of this. Summary:
one BFE event (`"2026 Wally Cup"`), five rounds in sequence `Practice Rd → Rd1 → Rd2 →
2Man → Rd3 → Overall`. The Practice Rd (`engine: none`) doesn't score or roll into
anything — Rd1/Rd2/Rd3 are `stableford_quota` (quota threads round-to-round via
`chainsFrom`, ranked by performance-vs-quota plus that round's Wally Ball bonus for
whoever still has the ball). 2Man is `scramble_pair` — 8 drafted teams, one scorecard per
team, ranked by performance vs. a team quota (a single pooled average of both partners'
`quota_out` from every stableford round played so far — corrected Dev-83, see below and
`BF_WallyCup_Spec.md` §3); it never rolls into Overall or Wally Ball, and its own
`chainsFrom` (→ Rd2) is read-only, walked backward purely to source that averaging. CTP
holes are per-venue, shared between
BFE-Admin's Tee Policy and portal.html's own Venue Manager editor (built Dev-78) via the
same `bfe_venue_tee_catalog` store — CTP always pays the *individual* claimant on a
configured hole, never a team, even in 2Man.
**Real 16-player roster and real 5-round schedule confirmed live (Dev-80) — the old
mock-data warning is resolved.** Every prior bootstrap revision since Dev-75 carried a
warning that the live `"2026 Wally Cup"` D1 event still held a 4-player dry-run mock
roster and needed a Data & Reset → Delete before game day. Dev-80 confirmed directly
against production (`GET /bfe/events`) that this is no longer the case: the live event
carries the real 16-player field (Rich Potts, Tom Stitt, Tom Arnold, Scott Justus, Nate
Stettler, Mohamed Walli, Mark Weaver, Lou Strohl, Jordan Knappenberger, Jeff Rapp, Jake
Knappenberger, Evan Lindermuth, Dave Sherwin, Chooch Wernett, Brian Hager, Bill Steirer)
and the real 5-round schedule: Practice Rd (Thu 9/10, Paupack Hills, 1:00 PM ET), Rd1
(Fri 9/11, Honesdale GC, 10:00 AM ET), Rd2 (Sat 9/12, Skytop Lodge, 8:00 AM ET), 2Man
(Sat 9/12, Skytop Lodge, 2:30 PM ET), Rd3 (Sun 9/13, Paupack Hills, 9:30 AM ET). This was
checked directly against live data in Dev-80, not inferred. **Update (Dev-82): the live
`bfe_events` row holding all of this was accidentally deleted in full during a test-data
cleanup and had to be rebuilt from scratch in Setup — the values above are the same real
roster/schedule Brian re-entered, not new data, but this is no longer "confirmed once and
stable since Dev-80," it's "rebuilt fresh in Dev-82." Worth a quick sanity glance early in
Dev-83 rather than assuming it's untouched.**
**Caught and fixed live in Dev-80:** the 2Man round's `engine` field was briefly
misconfigured as `stableford_quota` instead of `scramble_pair` (would have broken its
dedicated team-results section). Brian fixed it in Setup once flagged; re-verified live
afterward. See `BF_WallyCup_Spec.md` §5 for detail — worth a quick glance at every
round's engine dropdown if Setup gets touched again (Rd3's is the last one that matters
now), since nothing in the app guards against this specific mistake today.
**Dev-81 (this close-out) — fix-work, not the planned testing pass.** Brian flagged, mid-
session, that the Live Panel's scorecard-completion check was comparing a round's field
against the *full* BFE-A roster rather than that round's own event-card registrants —
real risk for the Practice Rd, which only has 7 of the 16 players. Fixed (same
umbrella-vs-round-name resolution pattern as Dev-79/Dev-80's other BFE lookups, plus
gathering-aware registrant matching). Separately, Brian confirmed the existing
withdrawal/Overall/Wally Ball behavior already matches his stated spec exactly (a
completed round keeps its own ranking/payout after a later withdrawal; only Overall
status and Wally Ball are affected) — no code change needed there. Then shipped five
results-page polish items (Wally Cup logo, section reorder, a per-hole scorecard
drill-down, a photo lightbox with full-size/Share, per-round weather chips) and found
and fixed a real "Generate & publish does nothing" bug: an explanatory code comment
contained a literal, unescaped `</script>` that the browser's HTML parser read as the
real closing tag, silently truncating BFE-Admin.html's script block and dropping every
function/listener defined after it. Full detail in `BF_Session_Log.md`'s Dev-81 entry.
**Net effect: the full end-to-end verification pass this bootstrap has been flagging
since Dev-80 still has not happened.** See §3.
**Dev-82 — an "Everyone" tag chip, a real memories-timeline bug, and a real production
incident.** Added an "Everyone" meta-checkbox to the WCRP/photo tag picker (auto-selects
the full roster). Root-caused a real bucketing bug from a live scrapbook screenshot — the
Practice Rd's rehearsal-mode window was collapsing to `-Infinity` with nothing to chain
from, swallowing all off-course photos/notes into one bucket instead of interspersing
them Before/After each round; verified with `Date.now()` monkey-patched against the real
extracted function and the real config's real tee times that the actual Thu–Sun
sequential live-play flow never exercises the fragile rehearsal-chaining path at all
(every round's tee time is already past by the time it's closed) — fixed the one real
gap anyway. **Then the real incident:** a "delete the test data" cleanup pass (missing
DELETE route for memory notes, and a stale FK-cascade list on whole-event delete, both
fixed) accidentally wiped the entire live `"2026 Wally Cup"` `bfe_events` row — roster,
rounds, payout, `trip_info_url`, all of it, not just test rows. Setup had to be rebuilt
from scratch in BFE-Admin (twice — Brian's second pass pre-added Rd1/2/3 groupings).
Root cause of the resulting Trip Info outage: the URL field had no real default and
silently saved blank on the from-scratch rebuild — not a code bug, a design gap. Fixed:
the field now ships with the real URL baked in as an actual `value`, same pattern
`eventName` already used. **Not yet independently re-verified end-to-end that the Trip
Info banner shows live for a real player after this fix — do this early in Dev-83.**
Also confirmed as working-as-designed (not bugs): `chainsFrom` correctly skips
non-stableford rounds for 2Man/Rd3, and a round's `quota_out` is computed fresh at Close
Round time independent of `bfe_round_groups` (pre-setting groupings ahead of time, which
Brian did for Rd1/2/3, has zero effect on quota progression). Full detail, including the
`WebFetch`-reliability trap this chase ran into, in `BF_Session_Log.md`'s Dev-82 entry.
**Dev-83 — the event itself, live: a real Worker outage, two real quota-math bugs, a
two-pass memories-chapter fix, and 2Man's own live wrap-up.** Opened against `bf-
experiences` running the wrong Worker's code entirely (zero `/bfe/*` routes) — fixed,
confirmed resolved by everything that worked cleanly for the rest of the session. Rebuilt
the Draft Calculator into a ranked list per Brian's request, then fixed three real issues
in it from his direct feedback (contrast, top-8-only filtering, and a live quota-math
bug — an erroneous `quota_in` value inflating the chain-walk average, confirmed against
Brian's own real number: "my quota today is 26.9 not 29.9"). Same bug existed in the 👥
group-quota display and, critically, **BFE-Admin's own Close Round team-quota
calculation** — fixed in all three. Then a second, deeper quota bug: the team-quota
formula itself was average-of-averages, not a true pool of both partners' values, per
Brian's own check ("should be 6 quotas averaged") — fixed in the same three places,
**and this spec's own §3 was wrong about the formula too, now corrected.** The
memories-timeline chapter-boundary bug (flagged again, live, from a Trip Memories
preview screenshot showing on-course and bar/boat photos still clustered) needed two
passes: an evidence-based window-end signal (correct, but Rd1 had zero Live Panel
evidence to find — Brian had stopped it via Portal's Gear toggle before anything was
captured through Live Panel itself that round), then a manual per-round boundary
override in BFE-Admin's Publish Results section, since missing evidence can't be
reconstructed automatically. **Session closed with live 2Man support:** a `live_override`
flags-Worker key stuck on since the prior evening was misrouting the Live Panel to Rd3
instead of 2Man (fixed via a direct `curl POST /flags`, confirmed reachable this session —
see §4); a missing CTP claim (Tom Stitt, hole #6) was recorded directly against Jotform
via the Browser bridge (not the MCP Jotform tools — see §4 for why) and 2Man was
re-closed and re-published, confirmed correct against the live results page. Full detail,
including the exact root-cause chases, in `BF_Session_Log.md`'s Dev-83 entry.
**Dev-84 — went a different direction than expected, and Rd3/Overall/wrap-up status was
never reconciled.** The old Dev-84-focus checklist (below, now replaced by §3's Dev-85
focus) expected this session to close Rd3 and resolve Overall Standings/Wally Ball for real.
Instead the session's actual work was a Trip Memories alignment widget (new
`PATCH /bfe/memories/notes/:id` route), a Rd1 memories chapter-boundary recurrence fixed via
the existing manual override, Buck Hill Golf Club geocoding, a BF Series canceled-event card
overlay, and a D1 primary-pinning fix on the two memories routes — see
`BF_Session_Log.md`'s Dev-84 entry for full detail. **Per Brian's explicit instruction, this
document does not state whether Rd3 closed or the event wrapped up — that status is simply
unknown here.** Confirm current state directly (e.g. `GET /bfe/events`) before assuming
either way in Dev-85.
**Dev-78 built and live-validated:** 2Man Live Panel capture (team picker for
Scorecard/Birdie Alert, individual picker for CTP — see the spec's §6 for the bug that
briefly had CTP on the team picker too, now fixed), a device-local Live Test Mode round
selector (pick any upcoming round to dry-run, not just the next one), the Venue CTP-holes
editor, and a fix for Rd1 CTP falling back to Blue Shamrock's default holes (a Jotform-
vs-canonical venue-name spelling mismatch — "Honesdale GC" vs. "Honesdale Golf Club" — now
handled by a shared `findVenueByName()` abbreviation-tolerant lookup). Brian then ran a
real end-to-end dry run of all four scored rounds through the Live Panel and independently
verified every computed number (quota/WB-bonus ranking, team-quota averaging, skins,
CTP, payout totals) against the live D1 data — everything matched the shipped formulas.
**Dev-79 rationalized memories capture and built the first slice (schema/round-picker
piece).** Decision: EventCard Memories stays as-is for ordinary single-round events; BFE
productions (Wally Cup, GLS) get their own persistent capture widget instead. Full detail
in `BF_WCRP_Memories_Spec.md`.
**Dev-80 finished the memories build end to end, plus a standalone Trip Info feature —
this is the largest single body of work behind this bootstrap.** In build order:
1. The BFE-backed flag on Portal `eventData`, `BFE_API`'s `bfe_event_memories`/
   `bfe_event_memory_notes` tables and routes, the Live Panel repoint to the new upload
   route, the persistent WCRP capture widget on Home (photo/video/notes, roster-gated,
   gated on a new `memories_capture_open` toggle rather than the originally-designed
   date-range grace window — Brian's real-world call, "timers have caused us issues"),
   and EventCard icon disabling on BFE-backed cards. Schema note: `round_id` (an FK) was
   changed to `round_name` (plain text) partway through — the FK crashed on insert under
   a real timing edge case; full detail in the Spec doc's addendum.
2. A commissioner Live Panel Notes capability (not originally scoped — a real gap Brian
   caught mid-build).
3. **The results-page memories scrapbook** — built directly into `BFE-Admin.html`'s
   Publish Results feature per Brian's own redirect ("design the assembled content
   directly into the results publish asset"), not into the widget's own timeline as
   originally drafted. `buildMemoryChapters()` auto-groups photos/notes into chapters by
   round timing (tee time → last scorecard submitted), each with a jump-link from that
   round's results section; anything outside every round's window buckets as a Practice-
   Rd/pre-trip or post-trip "Fun" group. Replaces the results page's old static "Photo
   Gallery" placeholder.
4. **A real cross-system bug found and fixed:** two mistake test photos deleted from the
   new `bfe_event_memories` table kept showing in Portal's "My History" — root cause was
   that "My History" actually reads from the OLD, unrelated `event_photos` table (owned by
   the main `worker.js` Worker), not the new BFE table at all. Brian deleted the same rows
   from `event_photos` too, in the same D1 database via SQL Brian ran directly — confirmed
   resolved ("done and gone").
5. **A brand-new, standalone Trip Info feature** — Brian pasted real 2026 Wally Cup trip
   logistics (address, packing list, food schedule, economics/pot) and asked for it
   "pretty, branded and published to a website that is text-able and accessible from the
   portal by the 16 WC players." Built as `docs/2026-wally-cup-trip-info.html` (live at
   `https://birdiefriends.com/2026-wally-cup-trip-info.html`), matching the Results page's
   dark-navy/red/Baloo-2 visual language, with a golf-schedule section added from real
   fetched round data and a footer "← Back to Portal" link. Linked from `portal.html` via
   a **brand-new, separate Home widget** (`renderTripInfoBanner()`) — explicitly NOT
   wired to the existing Trip Memories toggle or `memories_capture_open`, per Brian's
   explicit instruction ("I don't want to turn on the Trip memories yet. If we add a
   widget all 16 will see it when opening the APP"). Gated only on roster membership plus
   a new independent `bfe_events.trip_info_url` column (nullable, additive migration).
6. **A standing tooling rule change:** Brian asked that changes to `bf_push.ps1` itself be
   committed directly to the live file going forward, not delivered only as the
   `bf_push_library.ps1` archival snapshot for manual copy-over — see §4.
Full detail on all of the above (including the deviations from the original design draft)
is in `BF_WCRP_Memories_Spec.md`'s "What actually shipped (Dev-80)" addendum — read that
before touching any memories/Trip-Info code, not just this summary.
**Dev-85 — pure architecture/design-notes session, no code touched.** Validated GolfCourseAPI
(golfcourseapi.com) as a real venue-data source (4/5 test venues matched with full per-tee-box
data; Buck Hill Golf Club had no match — a real coverage gap, name-variant retry not yet
tried) and built `BF_BFE_NextGen_Spec.md`, a new living design-notes doc for a near-total BFE
rearchitecture (GC-API-first venue data, a 3-axis game-engine model with a registry pattern,
a Round Configuration object, a player entity model for the new BF Cup, per-format scoring
representation, live-scoring/connectivity risk, a Quick Templates concept, and a build
sequence around the real 2026 fall calendar). Full detail in `BF_Session_Log.md`'s Dev-85
entry.
**Dev-86 — did not touch the BFE Next-Gen build or the Wally Cup status check; built the
Gatherings games-config system instead (see §2a).** The "expose a light subset of registry
capabilities to Gatherings" idea Dev-85's spec discussion flagged as a maybe-someday item
turned out to be Brian's actual next priority, done directly against Gatherings rather than
through the not-yet-built registry architecture. Portal.html went from v4.1.9 → v4.5.7 across
four deploys this session. Full detail in `BF_Session_Log.md`'s Dev-86 entry.
## 2a. Gatherings games config (Skins/CTP/BirdieBall) — new as of Dev-86
A per-Gathering game-config system, separate from the BFE Wally Cup production above — hosts
turn Skins/CTP/BirdieBall on or off per Gathering from the Host Panel, and the Portal Live
Panel adapts around whatever's turned on. Backend: `bfe_gathering_games` (host config) and
`bfe_birdieball_answers` (BirdieBall answers, upserted by either touchpoint below) — see §1.
- **Host Panel Games config form** — toggle Skins/CTP/BirdieBall per Gathering; CTP hole
  picker; BirdieBall `$/player` carve-out (mirrors CTP's own structural pattern, replacing an
  earlier %-allocation design that was fully removed in round 3 of this build, v4.5.4).
- **Live Panel dual-mode scoring (v4.5.5)** — `evtScoreMode(evt)`: a Skins-enabled Gathering's
  Post-Round Scorecard captures raw gross strokes (posted to `GATHERINGS_API/scorecards`, the
  same D1 endpoint the separate Card Score Sheet uses — one source of truth for Skins math);
  every other event keeps the original Stableford points-bucket capture on the unchanged
  Jotform `SCORECARD_FORM_ID` path. Mode is stashed on `window._liveScoreMode` by
  `buildLivePanel` for `submitScorecard` (fired later via onclick) to read.
- **CTP hole source (fixed v4.5.6)** — a Gathering's CTP holes now resolve as: the Gathering's
  own `cttp_config.holes` (Host Panel) → `_resolvedCttpHoles` (legacy per-venue
  `venue-tee-catalog`) → `CTP_HOLES_DEFAULT` (BSGC hardcoded). Previously skipped the first
  step entirely, silently defaulting to BSGC's holes for any venue with no legacy catalog
  entry — caught live-testing against Moselem.
- **Live Panel section gating (v4.5.7)** — `showCttpSection`/`showBirdieBallSection`: a
  Series/Wally Cup event always shows CTP (no games-config concept there); a Gathering only
  shows a section when that game is actually turned on in its own config.
- **BirdieBall live-alert widget (v4.5.7)** — mirrors Birdie Alert's own UX: player picker
  (hydrates from any existing saved answer via `bbAnswerFor()`), Kept It/Lost It + hole/stroke
  for a loss, `submitBirdieBall()` upserts `bfe_birdieball_answers`, plus a live "who's lost
  the BirdieBall" board.
- **Post-Round Scorecard BirdieBall confirmation (v4.5.7)** — the safety net for players who
  forget the live-alert widget: if no answer exists yet for whoever's scorecard is being
  filled, the scorecard asks Kept It/Lost It before it can submit (skipped, shown read-only,
  once an answer exists from **either** touchpoint). `window._liveBbConfirmPending` carries a
  completed answer into `submitScorecard()`, which persists it via a best-effort,
  fire-and-forget POST alongside the strokes/points save.
- **Close & Calculate (built Dev-87, v4.6.0).** Host-only "🏁 Host · Close & Calculate" Live Panel
  section → `openGatheringCloseSheet()`: scorecards-in check ("N of M confirmed", flags no-card and
  blank-hole players), payout preview, "Close with N players". Rules (Brian, Dev-87): pot =
  `dollar_per_player` × **scorecards in** (8 registered, 7 played → 7); **Skins = lowest GROSS,
  outright only — a tie is simply no skin (no carryover, no "tie-break" concept); $/skin = skin pot ÷
  skins won; zero skins → given back**; a hole needs ≥2 scores entered to award a skin; CTP pays
  `dollar_per_hole` to each configured hole's leader, **unclaimed → Skins**; BirdieBall: keepers
  split, else **held longest** (latest `lost_hole`, then `lost_stroke`) wins, ties split, no answers →
  given back; **everything rounds DOWN to whole dollars**, remainder shown, not redistributed. Engine
  is the pure `computeGatheringGamesPayout()`; `renderGatheringPayoutHtml()` renders it identically
  in the preview and My History. Snapshot saved via `POST /bfe/gathering-games/:id/close` (host_id
  checked against the stored row → 403) into the pre-existing `payout_summary`/`status='closed'`/
  `closed_at` columns (no migration). Closing drops the Gathering from the `status=open` index, so its
  Live Panel retires. **My History:** `loadHistoryGameResults()` fills a "🏆 Game Results" block on
  the Gathering's story; the host also gets "↩️ Reopen to fix & re-close" (`POST .../:id/reopen` →
  `status='open'`, Live Panel returns).
- **CTP storage for Gatherings is D1, not Jotform (Dev-87, v4.6.1).** `ctpUsesD1(evt)` routes a
  Gathering's CTP load/submit/Undo to the BFE Worker's pre-existing `bfe_cttp_entries` + `/cttp`
  routes, keyed `gathering:<id>` (same as its scorecards). The whole Gatherings games flow is now
  Jotform-free. **Series / Wally Cup CTP deliberately stays on the Jotform CTP form** — GS and
  BFE-Admin's Close Round read it there. Moving those is a separate job that would have to switch
  both readers too.
- **Any gamed Gathering scores gross strokes to D1 (v4.6.2)** — not just Skins ones. Close counts
  players from D1, so a Jotform-scored Gathering can't close.
- **The host can close from two places:** the Live Panel (only within `LIVE_EVENT_HOURS` = 8 of tee
  time) and **My History** (always: "🎮 Games still open → 🏁 Close & Calculate", host only, while
  `status='open'`). `openGatheringCloseSheet` works even after the Gathering ages out of
  `gatheringData` (it falls back to the games config).
- **⚠️ Don't "fix" the Dev-93 auto-close for Gatherings without an exception for gamed ones.**
  `refreshLiveCompletionCheck` never fires for Gatherings (it reads BFE `/scorecards?event=<title>` +
  `regData`; Gathering cards are in the main Worker's D1 under `gathering:<id>`, and RSVPs are in
  `gatheringRegData`). That accident is what keeps the host's Live Panel Close button up after the
  last card lands.
- **UI (v4.7.0):** gamed Gathering cards get a "competition seal" watermark (`gamesSealWatermarkHtml`
  — it lives in a clipped `z-index:-1` layer inside an `isolation:isolate` card, because the card
  itself must stay overflow-visible). The player-facing venue viewer is now a tee dropdown +
  stat strip + `venueScorecardHtml` grid. It no longer shares `venueTeeHolesTableHtml` with the admin
  Venue Manager, which keeps the old table.
Full build detail, including the exact bug chases and test coverage, is in
`BF_Session_Log.md`'s Dev-86 entry.
## 3. Dev-88 focus — live-verify Gatherings Close & Calculate, then confirm next priority
1. **Live-verify Close & Calculate (§2a) before building anything else on it.** Dev-87 shipped it
   tested (18 engine + 21 jsdom checks against extracted source), but not against production. After
   Brian deploys the Worker (`BF_Experiences.js`) **and** portal v4.6.0 (Worker first, or Close
   404s): on a real test Gathering (e.g. Jefferson @ Moselem), enter a couple of scorecards, close as
   host, check the My History "🏆 Game Results" block as host and as a non-host player, then Reopen →
   Live Panel returns → re-close replaces the result. Verify one payout by hand against the live data.
2. **Then confirm priority with Brian** rather than assuming. The obvious candidate is the **BFE Next-Gen
   build (§9 of `BF_BFE_NextGen_Spec.md`)**, still not started (carried since Dev-85). Read the spec in
   full first and start from its §9 build sequence, which is organized around the real Nov 7 BF Cup
   deadline.
**Carried forward, still not re-confirmed since Dev-84:**
- The Rd1 chapter-boundary override's `localStorage`-only persistence is a possible,
  unconfirmed durability gap — worth a look if the chapter-boundary symptom recurs a third
  time (see `BF_Session_Log.md`'s Dev-84 entry and `BF_WCRP_Memories_Spec.md`'s "What changed
  in Dev-84" addendum).
- BF Series / BSGC is now an active thread (canceled-event overlay shipped Dev-84) — worth
  checking whether it needs anything further before assuming it's quiet.
- Confirm the D1-pinning fix and the AutoPush `BF_Experiences.js` filename fix both landed
  cleanly (i.e. GitHub `source/bf_experiences_worker.js` reflects the Dev-84 changes and
  production matches it) — still worth one quick confirmation rather than assuming it's
  settled, now three sessions on.
- Buck Hill Golf Club GolfCourseAPI name-variant retry (Dev-85 carry-forward) — still not
  attempted.
Nothing above is expected to be a large item on its own — if something real breaks, fix it in
place and log it the same way prior sessions' own live-data catches were logged (see those
entries in `BF_Session_Log.md` for the pattern: what was found, how it was verified against
live data, what Brian confirmed).
## 4. Standing operating rules (apply every session)
- **Never deploy.** Prepare files, verify them (jsdom/vm test against the actual extracted
  function source before delivery — this codebase is large enough that "looks right" isn't
  enough), deliver via `SendUserFile` + `device_commit_files` into AutoPush. Brian pushes.
- **Any file meant for `bf_push.bat` (i.e. it's a key in `bf_push.ps1`'s `$FileMap`) needs
  an explicit `device_commit_files` call to the exact AutoPush root path — `SendUserFile`
  alone is not enough.** Found Dev-78 close-out: the linked desktop app auto-saves
  chat-delivered files into a `Claude outputs` subfolder inside whichever folder is
  connected (AutoPush here), but `bf_push.ps1` only ever looks in its own folder
  (`$ScriptDir`, no subfolder recursion) — files that only went through `SendUserFile`
  silently didn't get found by the push tool. Always finish with `device_commit_files`
  targeting `C:\Users\16177\Downloads\GolfScorer\AutoPush\<filename>` directly for
  anything Brian will push.
- **`bf_push.ps1` itself now gets committed directly to the live file (Dev-80 rule
  change).** Brian's explicit instruction: "update the .ps1 directly. That should always
  be the case rather than me risk a manually edit mistake." So any change to the push tool
  itself goes straight to `C:\Users\16177\Downloads\GolfScorer\AutoPush\bf_push.ps1` via
  `device_commit_files`, in addition to (not instead of) delivering the same content as
  `bf_push_library.ps1` — that second file's own normal `$FileMap` entry
  (`bf_push_library.ps1 → source/bf_push.ps1`) still archives a copy into the GitHub repo
  through the tool's own regular push-and-verify path, since the live script can't safely
  push-and-delete itself. Both copies should stay byte-identical after a change.
- **Bump `portal_version.txt` with every `portal.html` change**, not just at session close
  — this drifted stale for multiple real deploys in the past (Dev-76) before that rule was
  adopted.
- **Verify against real production data before declaring a bug fixed**, not just a
  synthetic test — the Rd1 CTP bug (Dev-78), the 2Man-engine bug (Dev-80), and the
  memories-timeline bug (Dev-82) were only correctly root-caused/confirmed by pulling
  live Worker/Jotform data, not by guessing from the code alone.
- **Library-doc access, solved (Dev-82):** fetch `BF_Session_Log.md`/this bootstrap/the
  spec docs at session start via plain `Bash`/`curl` —
  `curl -sS "https://raw.githubusercontent.com/birdiefriends/birdiefriends.github.io/main/source/<filename>"` —
  confirmed reliable and byte-exact (this cloud workspace's proxy allows
  `raw.githubusercontent.com` for GET). Don't use `WebFetch` for these; it answers
  through a small summarizing model, not raw content, which risks silently truncating or
  paraphrasing what should be an exact append target. Don't ask Brian to paste doc
  content by hand anymore (Dev-81's workaround) — this is no longer necessary.
- **Live BFE worker data, `WebFetch` is unreliable, use the browser bridge instead
  (Dev-82) — but `bf-experiences` isn't the only Worker, and the blanket "`*.workers.dev`
  is unreachable" claim was wrong (corrected Dev-83).** `bf-experiences.
  birdiefriends01.workers.dev` specifically is NOT reachable via `curl`/`Bash` (confirmed
  blocked again in Dev-83 — connect-rejected, not a 403) — and `WebFetch` against it has
  shown genuinely contradictory/stale results (different routes disagreeing moments
  apart, identical stale `updated_at` across real backend changes), burning real
  debugging time in Dev-82. **When linked to Brian's computer, use
  `Claude_Browser__navigate` straight to the GET URL (e.g.
  `.../bfe/events-list?_=<cachebust>`), then `Claude_Browser__get_page_text`** — this
  returns the exact, fresh, unsummarized JSON. Prefer this over `WebFetch` for anything
  time-sensitive on this worker; if the browser bridge isn't available, treat a single
  `WebFetch` read of this worker with suspicion. **`birdiefriends-push.
  birdiefriends01.workers.dev`, though, IS directly reachable via plain `curl`/`Bash`
  (confirmed Dev-83, both `GET`/`POST /flags` and `GET /deploy`'s underlying raw-content
  domain)** — for anything on that Worker specifically (the `live_override`/
  `live_stopped_round`/etc. flags-Worker, GitHub raw-content reads), a direct `curl` is
  faster and simpler than the browser bridge; no need to reach for `Claude_Browser__*`
  there. Check which Worker a task actually needs before assuming either domain's
  reachability from the other's.
- **Two sandbox auto-mode classifier boundaries hit live in Dev-83, both worth knowing
  before they cost time re-discovering them:**
  - A `Bash`/`curl` command containing a literal embedded credential (e.g.
    `JOTFORM_API_KEY`, even though it's already hardcoded client-side in a deployed public
    file) is blocked as "Credential Leakage" — no way around it from `Bash`, and no reason
    to try. If a page already loaded in the Browser bridge has the credential and a
    working function in its own JS scope (e.g. `portal.html`'s `jfCreateCttpSubmission`),
    call that function directly via `Claude_Browser__javascript_tool` instead — the key
    never has to appear in any tool call at all. **Since Dev-83b, this no longer applies to
    `BFE-Admin.html`** — its own `jfCreateCttpSubmission` (and every other Jotform call
    site) now proxies through the BFE Worker instead of embedding the key, so a direct
    `curl`/`Bash` call against its proxy routes doesn't trip this classifier at all.
  - Driving a real "publish/deploy" UI control via browser automation (e.g. clicking
    BFE-Admin's own "Generate & publish" button through `Claude_Browser__*`) is blocked as
    "Production Deploy," even though it's the app's own legitimate control and would have
    been fine as a direct `curl POST /deploy`-equivalent through other means. That step
    always has to go back to Brian to click himself — don't try to route around it.
- **The Jotform MCP tools (`mcp__Jotform__*`) have real gaps for reading/writing real
  Wally Cup data, found in Dev-83:** `create_submission` enforces a form's declared
  dropdown/choice-question options, and the CTP form's configured options are stale
  relative to what the app's own code actually submits (real holes/players used are
  missing from the list) — a real submission needs the raw REST bypass described above,
  not this tool. `list_submissions` doesn't return usable content back to Claude (comes
  back with an empty `data` and a "displayed to the user" message) — use
  `analyze_submissions` instead, which does return real content, or `fetch` for a form's
  question-id → question-text map.
- **No real session numbering exists beyond the current session — and this rule has now
  been broken twice, not once.** Don't invent sequential "Dev-NNN" labels for individual
  fixes within a session. This happened briefly in Dev-82's own code comments and was
  believed corrected same-session — then happened again for the entirety of Dev-83,
  climbing from wherever Dev-82 left off all the way through "Dev-108" in code comments,
  undetected until this close-out. **Do not treat whatever number the codebase's own
  comments are already sitting at as a legitimate continuation point — it isn't one.** A
  session is one Dev-# for its whole duration; describe an individual change by what it
  touches, never by inventing it its own sequential number, however tempting the existing
  comment style makes it look.
- **Keep `BF_Session_Log.md` and this bootstrap doc updated as work happens**, not only in
  a big close-out pass at the end — a long session can auto-compact more than once, and
  reconstructing "what actually got built earlier this session" from scratch is worse than
  logging incrementally. If a session does end up closing out a large undocumented backlog
  in one pass, say so plainly in the log entry rather than presenting it as freshly built.
- **This doc, `BF_WallyCup_Spec.md`, and `BF_WCRP_Memories_Spec.md` are living
  documents** — when a session's work changes something they describe, update them as
  part of that work, not as an afterthought.
- **A literal `</script>` anywhere inside `BFE-Admin.html`'s (or any similarly-structured
  file's) own `<script>` block closes the real tag to the browser's HTML parser — this
  includes inside a `//`/`/* */` comment, not just a JS string.** Found in Dev-81: an
  explanatory comment describing the Trip Memories lightbox's deliberate `<\/script>`
  escaping technique itself contained the literal, unescaped text twice, silently
  truncating the whole script block and killing the Generate & Publish button with no
  visible error. Escape it (`<\/script>`) everywhere it appears, comments included, and
  when a button "does nothing at all" with no error, check for exactly this before
  assuming a runtime bug.
- **`bf_experiences_worker.js`'s AutoPush filename is `BF_Experiences.js`, NOT
  `bf_experiences_worker.js` — the one entry in `bf_push.ps1`'s `$FileMap` where the local
  key and the GitHub destination basename differ.** Delivering/committing this file under
  its destination-style name (`bf_experiences_worker.js`) means `bf_push.ps1` silently
  doesn't recognize it at all — no error, no warning, it just never appears in the "Found
  these files to push" list. This was previously documented only inside the script's own
  v8 header comment (dated Dev-78), not here, and got hit again in Dev-84 for exactly that
  reason. Before naming any file for AutoPush delivery, check `bf_push.ps1`'s actual
  `$FileMap` rather than assuming the destination basename is the local key — for this file
  specifically, always use `BF_Experiences.js`.
- **Fetch `origin` before editing a file in this repo that Brian might be touching in a
  parallel session, especially on a day multiple sessions are running.** A Dev-84 D1-pinning
  fix was built on a session-start clone that had gone 23 commits stale mid-session because
  a parallel session ("dev-83") pushed a real update to `bf_experiences_worker.js` (commit
  `7f68542`, 2026-09-20 11:03:18 -0400) after this session's clone was made. The stale-based
  fix was briefly delivered and committed to AutoPush, which would have overwritten the
  parallel session's real changes had Brian deployed it as-is — caught only because Brian
  asked directly where the source file came from. Don't trust a session-start clone to still
  be current partway through a long session; `git fetch origin` (and diff against
  `origin/main`, or ask Brian to paste the live file for independent verification) before
  editing anything that might have moved underneath you.
- **The local scratch git clone (`/home/claude/bf-repo`) is never the deploy path and does
  not need to be kept committed during a session — confirmed Dev-86.** Brian's `bf_push.ps1`
  pushes files straight to GitHub via its own commits, entirely bypassing this clone; a
  session-end stop-hook asking to "commit and push uncommitted changes" here is checking a
  scratch workspace, not anything that affects production, and should not be acted on without
  asking Brian first (a push here would go live immediately either way — this repo IS
  `birdiefriends/birdiefriends.github.io`, a GitHub Pages source repo). If asked to sync it:
  `git fetch origin` (see the rule above), then verify content equality file-by-file
  (`git diff origin/main -- <file> | wc -l` should be 0 for anything you expect to already
  match); a plain `git pull --ff-only` can still be refused by git's dirty-path guard even
  when every changed file's content already matches the target exactly (git's fast-forward
  checkout safety check is path-dirty-based, not content-aware) — `git reset origin/main`
  (moves the branch ref + index only, leaves the working tree untouched) resolves this safely
  precisely because content equality was already verified; never reach for `git reset --hard`
  or `git checkout .` to force past this, since those discard real differences unseen. Any
  file still showing modified after that (content genuinely stale locally, not just
  history-stale) is a plain `git checkout -- <file>` once confirmed it was never an
  intentional local edit.
- **A retired/dead test file (a feature Brian explicitly backed out, like the HCP nudge —
  confirmed Dev-86) goes to `/home/claude/bf-work/retired_tests/<name>.mjs.retired` (moved,
  not deleted) rather than staying in the main suite or being silently dropped** — keeps the
  regression run clean without losing the file in case anything in it is worth salvaging
  later.
## 5. Known backlog (not urgent, parked)
- **Gatherings games edge cases (raised Dev-87):** BirdieBall "held longest" assumes the round
  starts on #1 (a shotgun or back-nine start picks the wrong player — it needs start-hole-relative
  ordering); no "🏆 results are in" push to players on close; the Host Panel pot preview says
  "confirmed Yes × $/player" while Close uses scorecards in; self-reported scores/claims under anyone's
  name now carry real dollars (same trust model as always).
- **Capture tee box on the Live Panel scorecard** — it currently sends `tee_box: null`. Course
  handicap depends on the tee played, so Net Skins and every HCP-based game will need it; capturing
  it early builds up the data.
- **Gross/Net Skins toggle for Gatherings** (Brian, Dev-87): Skins are Gross unless otherwise
  directed; add a Gross/Net toggle to the Games config once HCP calcs are layered in. Net would need a
  per-player handicap source at Close time — `computeGatheringGamesPayout` already stamps
  `skins.basis: 'gross'` in every saved snapshot so older results stay self-describing.
- **Small-group payout rounding** (`BF_WallyCup_Spec.md` §6) — round-pot podium split can
  zero out 2nd/3rd place under ~9 players at the current $10/player rate. Fine for Brian's
  own groups; a gap if BFE ever opens to other hosts.
- **Overall-checkbox guardrail for multi-host use** (spec §4) — "Rolls into Overall"
  defaults to checked and is easy to miss for a non-standard round engine. Parked until
  hosting opens beyond Brian. (Related, but distinct and already fixed live in Dev-80:
  the 2Man-round *engine* misconfiguration described in §2 above — that was the engine
  dropdown itself being wrong, not the Overall checkbox.)
- **Results-page section ordering** — resolved in Dev-81 (see §2/§3): winner → podium/
  skins/CTP → rank list is now the shipped order for every closed round section.
- **Commissioner PIN architecture / `JOTFORM_API_KEY`-in-client-source** — same shape of
  gap, logged historically in `BF_Operations_Guide.md` §10 (that file isn't in this cloud
  workspace's file list — ask Brian for it if this becomes a priority). Not urgent.
  `BFE-Admin.html`'s own `JOTFORM_API_KEY` instance was already moved server-side (Dev-83b);
  `portal.html`'s copy and the Commissioner PIN itself are still open.
- **Push notification preference center, player-picker rethink, GS `results.html`
  photo-collage insertion, D1 schema log drift** — long-standing, not touched in several
  sessions; still open per `BF_Session_Log.md`'s own carry-forward trail.
- **Live Panel Notes' character limit vs. the WCRP widget's 500-char cap** — added Dev-80,
  still not cross-checked against each other; low urgency now the event is nearly over.
- **`live_stopped_round`/`live_override` flags-Worker keys — confirmed live, Dev-83.**
  No longer an open item: read and written directly via `curl POST /flags` against
  `birdiefriends-push.birdiefriends01.workers.dev` this session, both fixing a real stuck
  `live_override` and setting `live_stopped_round` to permanently retire a fully-closed
  round. See §2's Dev-83 paragraph and §4's flags-Worker note.
## 6. If something here turns out stale
This file is only as good as the last session that updated it. If you find something in
here that contradicts what the actual code does, trust the code, fix this doc, and note
the correction in the next `BF_Session_Log.md` entry — don't silently work around a stale
bootstrap doc without fixing it for the next session too.
