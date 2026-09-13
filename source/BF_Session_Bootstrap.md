# BF_Session_Bootstrap.md — Start Here for a New BirdieFriends Session
**Status:** current as of Dev-83 close, 2026-09-12 — 2Man is closed and published, Rd3
(the final round) plays this morning. Dev-83 was, again, almost entirely reactive
real-live-event work, not the planned end-to-end verification pass (still not run — now
carried three sessions running, see §3). Opened against an actual production outage (the
`bf-experiences` Worker was running the wrong Worker's code — fixed), rebuilt the Draft
Calculator from a real screenshot request, fixed a real quota-math bug live against
Brian's own numbers (twice — once for an erroneous `quota_in` double-count, once for
average-of-averages vs. a true pool), fixed the memories-timeline chapter-boundary bug
live in two passes (the first, evidence-based fix was correct but insufficient — Rd1
genuinely had no evidence to find — the second added a manual per-round boundary
override), and closed with live 2Man support (a stuck `live_override` flag misrouting the
Live Panel, and a missing CTP claim recorded + round re-closed). Read this file first in
any new BirdieFriends chat before touching code — it's meant to be self-sufficient enough
that you never need to re-read `BF_Session_Log.md` line by line to get oriented (that log
is the detailed history; this doc is the map). Fetch it and the two spec docs below via
`curl` at session start — see §4, don't ask Brian to paste them. `BF_WallyCup_Spec.md` is
the living design reference for the Wally Cup event specifically — read it too before
touching Groupings, the results page, Close Round, Overall Standings, or the 2Man team
quota (its formula was wrong in this spec itself until Dev-83 — now corrected).
`BF_WCRP_Memories_Spec.md`'s "What actually shipped (Dev-80)" and "What changed in
Dev-83" addenda are the reference for the memories/Trip-Info work specifically. **There
is no real session numbering beyond this one (Dev-84) — don't invent or reuse "Dev-NNN"
labels for individual fixes. This has now happened twice (briefly in Dev-82, then again
all through Dev-83's own code comments, climbing from wherever Dev-82 left off through
"Dev-108") despite Dev-82 believing it had corrected the mistake same-session. It hadn't.
Whatever number the codebase's own comments are already at when you start reading them is
not a real precedent to continue from — a session is one Dev-# for its whole duration;
describe an individual change by what it touches, never by inventing it its own number.**
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
  touches. Currently v4.1.9 (see `portal_version.txt` — **bump this with every
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
## 3. Dev-84 focus — Rd3, the final round, and the event wrap-up
**Dev-84 is, again, live support, not a planned build session — but it's the last one for
this event.** Rd3 (Sun 9/13, Paupack Hills, 9:30 AM ET per §2's schedule) is the final
round; once it closes, Overall Standings and Wally Ball resolve for real for the first
time this event, using real closed-round data across the full round set. Expect the same
reactive shape as Dev-81/82/83: opening/closing the round, live scorecard issues, payout/
results questions — plus, specifically this time, wrap-up questions once the event is
actually over.
0. **First thing, before anything else:** confirm Rd3's own Live Panel opens correctly on
   its own via the natural tee-time window — Dev-83 closed with `live_override: false` and
   `live_stopped_round: "2026 Wally Cup - 2Man"` (2Man only, deliberately not touched
   further so Rd3's own auto-open wouldn't be blocked — see the Dev-83 log entry) but this
   specific interaction hasn't been independently confirmed live yet.
1. **Close Rd3 and publish** — same Close Round / Publish Results flow as every other
   round this event; confirm the payout, skins, and CTP compute cleanly with no
   missing-player warnings (the pattern of what to check is the same as Dev-83's 2Man
   re-close — see that log entry).
2. **Overall Standings and Wally Ball, for real, for the first time** — this event's
   first time either has genuinely resolved live data flowing through the full round
   chain (Practice → Rd1 → Rd2 → Rd3, 2Man excluded per §2/§3). Worth an extra-careful
   look the first time real numbers go all the way through, not just trusting the
   formulas because they tested clean earlier — confirm the champion/podium, confirm
   Wally Ball's bonus-holder resolution, confirm the payout reconciliation check
   (`payoutSummary.reconciles`) actually reconciles against real dollars.
3. **The Trip Memories chapter split for Rd3** — confirm Rd3 gets a clean "On Course"
   chapter on its own, without needing the new Dev-83 manual boundary override (Rd3
   should have normal Live Panel evidence and/or a real `closed_at`, unlike Rd1 — see
   `BF_WCRP_Memories_Spec.md`'s "What changed in Dev-83" addendum for why Rd1 needed it).
   Confirm the final post-Rd3/event-wrap-up chapter reads sensibly once there's no
   further round left to bound it.
4. **The end-to-end verification pass — now three sessions overdue (Dev-81/82/83), and
   the event is nearly over.** Don't force it in if Rd3 itself needs the attention — but
   make a deliberate call rather than letting it silently vanish from the carry-forward:
   either run whatever of it still applies before the trip fully wraps, or explicitly
   close it out as "this event finished without it, and that was fine" in the Dev-84 log
   entry. See the old checklist (Dev-83's own §3, in `BF_Session_Log.md`'s Dev-83 entry)
   for what it would have covered if useful as a final pass.
5. **If this is genuinely the last session of the 2026 Wally Cup:** consider what, if
   anything, belongs in a proper post-event close-out beyond the usual session log entry —
   final payout summary for Brian's own records, whether the Trip Info page/WCRP capture
   should be turned off now that the trip's over, whether `live_override`/
   `live_stopped_round` need resetting to a clean state for whatever event comes next.
Nothing in items 0–5 is expected to be a large build — if something real breaks, fix it in
place and log it the same way Dev-80/82/83's own live-data catches were logged (see those
entries in `BF_Session_Log.md` for the pattern: what was found, how it was verified
against live data, what Brian confirmed).
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
    working function in its own JS scope (e.g. `portal.html`/`BFE-Admin.html`'s
    `jfCreateCttpSubmission`), call that function directly via `Claude_Browser__
    javascript_tool` instead — the key never has to appear in any tool call at all.
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
## 5. Known backlog (not urgent, parked)
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
