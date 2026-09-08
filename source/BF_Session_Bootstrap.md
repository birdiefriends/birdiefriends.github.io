# BF_Session_Bootstrap.md — Start Here for a New BirdieFriends Session

**Status:** current as of Dev-80 close, 2026-09-08. Dev-80 ("WCRP Memories Pass 2 —
capture pipeline + results-page scrapbook + Trip Info widget") is fully shipped and
live — see §2 and §3 below. Read this file first in any new BirdieFriends chat before
touching code — it's meant to be self-sufficient enough that you never need to re-read
`BF_Session_Log.md` line by line to get oriented (that log is the detailed history; this
doc is the map). `BF_WallyCup_Spec.md` is the living design reference for the Wally Cup
event specifically — read it too before touching Groupings, the results page, Close
Round, or Overall Standings. `BF_WCRP_Memories_Spec.md`'s "What actually shipped
(Dev-80)" addendum is the reference for the memories/Trip-Info work specifically.

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
  touches. Currently v4.1.5 (see `portal_version.txt` — **bump this with every
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
  id — see §2). Routes under `/bfe/*`.
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
  Panel submissions and Close Round's data pull. `JOTFORM_API_KEY` is hardcoded client-side
  — a known, deliberately-deferred security backlog item (see §5).

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

Full design is in `BF_WallyCup_Spec.md` — read it before touching any of this. Summary:
one BFE event (`"2026 Wally Cup"`), five rounds in sequence `Practice Rd → Rd1 → Rd2 →
2Man → Rd3 → Overall`. The Practice Rd (`engine: none`) doesn't score or roll into
anything — Rd1/Rd2/Rd3 are `stableford_quota` (quota threads round-to-round via
`chainsFrom`, ranked by performance-vs-quota plus that round's Wally Ball bonus for
whoever still has the ball). 2Man is `scramble_pair` — 8 drafted teams, one scorecard per
team, ranked by performance vs. a team quota (each partner's own quota averaged across
every stableford round played so far, then the two partners averaged together); it never
rolls into Overall or Wally Ball, and its own `chainsFrom` (→ Rd2) is read-only, walked
backward purely to source that averaging. CTP holes are per-venue, shared between
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
(Sat 9/12, Skytop Lodge, 2:30 PM ET), Rd3 (Sun 9/13, Paupack Hills, 9:30 AM ET). **Do not
assume this needs re-confirming going into Dev-81 unless something looks off** — this was
checked directly against live data this session, not inferred.

**Caught and fixed live this session:** the 2Man round's `engine` field was briefly
misconfigured as `stableford_quota` instead of `scramble_pair` (would have broken its
dedicated team-results section). Brian fixed it in Setup once flagged; re-verified live
afterward. See `BF_WallyCup_Spec.md` §5 for detail — worth a quick glance at every
round's engine dropdown during Dev-81's end-to-end pass, since nothing in the app guards
against this specific mistake today.

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
this is this session's main body of work.** In build order:

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

## 3. Dev-81 focus — end-to-end testing, ahead of real Rd1 (10am ET, 9/11)

Dev-80 closed out the full memories build and the Trip Info feature; nothing is mid-flight
from this session. Dev-81's job is verification, not new building — walk the real flows a
real trip day will exercise, using the real 16-player roster and real 5-round schedule
confirmed live in §2, with enough runway before Thursday's Practice Rd (9/10) and Friday's
real Rd1 (10am ET, 9/11) to fix anything found. Suggested pass, roughly in trip order:

1. **Live Panel capture, all 5 rounds** — scorecard submission, CTP, Birdie Alert, and
   photo/video capture for a normal stableford round; the 2Man team-picker path
   specifically (confirm the engine fix from this session holds); the Practice Rd (no
   engine — confirm nothing in the capture path assumes every round is scored).
2. **The WCRP memories widget** — toggle `memories_capture_open` on, confirm the Home
   banner appears only for real rostered players, capture a real photo/note, confirm it
   lands in `bfe_event_memories` (not the old `event_photos` table — see §2 item 4 for why
   that distinction matters), confirm EventCard's Photos/Notes icons are correctly
   disabled on BFE-backed round cards.
3. **The results-page scrapbook** — Close a round, Publish Results, confirm chapters
   auto-group correctly against real tee times and real scorecard timestamps, confirm
   jump-links land in the right place, confirm the pre-trip/post-trip "Fun" bucket
   behaves as expected for anything captured outside a round's window.
4. **The Trip Info widget** — confirm the Home banner appears for all 16 rostered players
   (and only them), confirm the link opens the live page correctly on both desktop and a
   real phone, spot-check the golf schedule against the live round data one more time.
5. **Live Panel Notes** — exercise the new commissioner note-compose capability; while
   there, check its character limit against the WCRP widget's 500-char cap (`BF_WCRP_
  Memories_Spec.md` §9 flags this as unconfirmed).
6. **A final pass over every round's Setup config** — engine, tee policy, CTP holes,
   `chainsFrom`, `rollsIntoOverall` — given the live 2Man-engine mistake found this
   session, worth a deliberate look rather than assuming Setup is correct because it
   looked correct once.

Nothing here is expected to be a large build — this is a verification pass. If something
real breaks, fix it in place and log it the same way Dev-80's own live-data catches were
logged (see the Dev-80 entries in `BF_Session_Log.md` for the pattern: what was found, how
it was verified against live data, what Brian confirmed).

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
  synthetic test — the Rd1 CTP bug (Dev-78) and the 2Man-engine bug (Dev-80) were only
  correctly root-caused/confirmed by pulling live Worker/Jotform data, not by guessing
  from the code alone. **One known tool quirk (Dev-80):** the by-name event-config route
  (`GET /bfe/events?event=<name>`) intermittently returns stale/empty results specifically
  through the `WebFetch` tool, even when the underlying data is correct — always append a
  fresh cache-busting query param and be prepared to re-fetch once before trusting an
  unexpected-looking result from that route.
- **Keep `BF_Session_Log.md` and this bootstrap doc updated as work happens**, not only in
  a big close-out pass at the end — a long session can auto-compact more than once, and
  reconstructing "what actually got built earlier this session" from scratch is worse than
  logging incrementally. If a session does end up closing out a large undocumented backlog
  in one pass, say so plainly in the log entry rather than presenting it as freshly built.
- **This doc, `BF_WallyCup_Spec.md`, and `BF_WCRP_Memories_Spec.md` are living
  documents** — when a session's work changes something they describe, update them as
  part of that work, not as an afterthought.

## 5. Known backlog (not urgent, parked)

- **Small-group payout rounding** (`BF_WallyCup_Spec.md` §6) — round-pot podium split can
  zero out 2nd/3rd place under ~9 players at the current $10/player rate. Fine for Brian's
  own groups; a gap if BFE ever opens to other hosts.
- **Overall-checkbox guardrail for multi-host use** (spec §4) — "Rolls into Overall"
  defaults to checked and is easy to miss for a non-standard round engine. Parked until
  hosting opens beyond Brian. (Related, but distinct and already fixed live this session:
  the 2Man-round *engine* misconfiguration described in §2 above — that was the engine
  dropdown itself being wrong, not the Overall checkbox.)
- **Results-page section ordering** — 2Man's results section renders after Wally Ball in
  scroll order; only the nav rail's jump link goes to the right spot. Deferred as
  lower-value than risk, this close to the event. Confirmed unchanged by Dev-80's own
  results-page work (the memories scrapbook was added after this section, doesn't touch
  its ordering).
- **Commissioner PIN architecture / `JOTFORM_API_KEY`-in-client-source** — same shape of
  gap, logged historically in `BF_Operations_Guide.md` §10 (that file isn't in this cloud
  workspace's file list — ask Brian for it if this becomes a priority). Not urgent.
- **Push notification preference center, player-picker rethink, GS `results.html`
  photo-collage insertion, D1 schema log drift** — long-standing, not touched in several
  sessions; still open per `BF_Session_Log.md`'s own carry-forward trail.
- **Live Panel Notes' character limit vs. the WCRP widget's 500-char cap** — added Dev-80,
  not cross-checked against each other yet; worth confirming in Dev-81 if it matters (see
  §3 item 5).

## 6. If something here turns out stale

This file is only as good as the last session that updated it. If you find something in
here that contradicts what the actual code does, trust the code, fix this doc, and note
the correction in the next `BF_Session_Log.md` entry — don't silently work around a stale
bootstrap doc without fixing it for the next session too.
