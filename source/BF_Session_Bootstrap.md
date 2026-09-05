# BF_Session_Bootstrap.md — Start Here for a New BirdieFriends Session

**Status:** current as of Dev-78 close, 2026-09-05. Read this file first in any new
BirdieFriends chat before touching code — it's meant to be self-sufficient enough that you
never need to re-read `BF_Session_Log.md` line by line to get oriented (that log is the
detailed history; this doc is the map). `BF_WallyCup_Spec.md` is the living design
reference for the Wally Cup event specifically — read it too before touching Groupings,
the results page, Close Round, or Overall Standings.

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
  touches. Currently v4.0.8 (see `portal_version.txt` — **bump this with every
  `portal.html` change and deliver it alongside**, format `vX.Y.Z · YYYY-MM-DD` /
  `Deployed: YYYY-MM-DD HH:MM`; nothing bumps it automatically).
- **`BFE-Admin.html`** — commissioner-only admin tool for BFE ("BirdieFriends
  Experiences") competitive events — currently just the 2026 Wally Cup. Roster/quota setup,
  round definitions, tee/venue policy (incl. CTP holes), payout config, Player Groupings
  (draft/flighted/social/pinned), and Close Round (pulls scorecards from Jotform, computes
  skins/CTP/podium, runs the quota engine, persists results). PIN-gated (`7797`) for
  anything that writes.
- **`BF_Experiences.js`** — the `bf-experiences` Worker (`BFE_API =
  https://bf-experiences.birdiefriends01.workers.dev`). D1-backed: `bfe_events` (event
  config: roster, rounds, teePolicy, payout), `bfe_venue_tee_catalog` (per-venue tee/CTP
  info, shared by BFE-Admin's Tee Policy AND portal.html's Venue Manager), `bfe_round_groups`
  (Player Groupings), `bfe_round_results`/`_skins`/`_cttp` (Close Round output). Routes under
  `/bfe/*`.
- **Main `worker.js`** — the `birdiefriends-push` Worker (`GATHERINGS_API =
  https://birdiefriends-push.birdiefriends01.workers.dev`). Everything else: Gatherings,
  push notifications (OneSignal, via `osSendAll`/`osSendToPlayers`), photo/video capture
  (`event_photos` D1 table + R2 storage + `curation_status`), member preferences, the
  Membership roster. Not present in this cloud workspace's file list this session — treat
  as "known to exist, fetch/ask for it if a task needs to read or change it."
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
Cloudflare/GitHub myself.

## 2. Where the 2026 Wally Cup stands

Full design is in `BF_WallyCup_Spec.md` — read it before touching any of this. Summary:
one BFE event (`"2026 Wally Cup"`), four rounds in sequence `Rd1 → Rd2 → 2Man → Rd3 →
Overall`. Rd1/Rd2/Rd3 are `stableford_quota` (quota threads round-to-round via
`chainsFrom`, ranked by performance-vs-quota plus that round's Wally Ball bonus for
whoever still has the ball). 2Man is `scramble_pair` — 8 drafted teams, one scorecard per
team, ranked by performance vs. a team quota (each partner's own quota averaged across
every stableford round played so far, then the two partners averaged together); it never
rolls into Overall or Wally Ball, and its own `chainsFrom` (→ Rd2) is read-only, walked
backward purely to source that averaging. CTP holes are per-venue, shared between
BFE-Admin's Tee Policy and portal.html's own Venue Manager editor (built Dev-78) via the
same `bfe_venue_tee_catalog` store — CTP always pays the *individual* claimant on a
configured hole, never a team, even in 2Man.

**Dev-78 built and live-validated:** 2Man Live Panel capture (team picker for
Scorecard/Birdie Alert, individual picker for CTP — see the spec's §6 for the bug that
briefly had CTP on the team picker too, now fixed), a device-local Live Test Mode round
selector (pick any upcoming round to dry-run, not just the next one), the Venue CTP-holes
editor, and a fix for Rd1 CTP falling back to Blue Shamrock's default holes (a Jotform-
vs-canonical venue-name spelling mismatch — "Honesdale GC" vs. "Honesdale Golf Club" — now
handled by a shared `findVenueByName()` abbreviation-tolerant lookup). Brian then ran a
real end-to-end dry run of all four rounds through the Live Panel and independently
verified every computed number (quota/WB-bonus ranking, team-quota averaging, skins,
CTP, payout totals) against the live D1 data — everything matched the shipped formulas.

**⚠️ Outstanding before real Rd1 (10am 9/11), not a Dev-79 task — flag to Brian early:**
the live `"2026 Wally Cup"` D1 event is still that dry run's 4-player mock roster/results
(Brian's words: "using 4 players to minimize data entry"), not the real 16-player field.
It needs a Data & Reset → Delete in BFE-Admin, then a fresh real Setup + real
Draft/Groupings, before game day. This has been carried forward since Dev-75/77 and still
isn't done — don't assume it happened without confirming with Brian.

## 3. Dev-79 focus (per Brian, set at Dev-78's close)

1. **Photo capture / "memories" display** for BFE events. Main `worker.js`'s existing
   `event_photos`/R2/`curation_status` pipeline (built for Gatherings) is a plausible head
   start, but hasn't been verified against BFE's data shape (events keyed by `event_name`
   in `bfe_events`, not a Gathering's `gathering_id`) — check that before assuming it
   plugs in directly.
2. **Modify the results pages** — Brian hasn't specified the scope yet. Ask at the start of
   Dev-79 rather than guessing; don't assume it's related to #1 just because they were
   mentioned in the same breath.

## 4. Standing operating rules (apply every session)

- **Never deploy.** Prepare files, verify them (jsdom/vm test against the actual extracted
  function source before delivery — this codebase is large enough that "looks right" isn't
  enough), deliver via `SendUserFile` + `device_commit_files` into AutoPush. Brian pushes.
- **Any file meant for `bf_push.bat` (i.e. it's a key in `bf_push_library.ps1`'s
  `$FileMap`) needs an explicit `device_commit_files` call to the exact AutoPush root path
  — `SendUserFile` alone is not enough.** Found Dev-78 close-out: the linked desktop app
  auto-saves chat-delivered files into a `Claude outputs` subfolder inside whichever
  folder is connected (AutoPush here), but `bf_push.ps1` only ever looks in its own folder
  (`$ScriptDir`, no subfolder recursion) — files that only went through `SendUserFile`
  silently didn't get found by the push tool. Always finish with `device_commit_files`
  targeting `C:\Users\16177\Downloads\GolfScorer\AutoPush\<filename>` directly for
  anything Brian will push, the same way `portal.html`/`portal_version.txt` already were
  this session — don't rely on the auto-save subfolder for those.
- **Bump `portal_version.txt` with every `portal.html` change**, not just at session close
  — this drifted stale for multiple real deploys in the past (Dev-76) before that rule was
  adopted.
- **Verify against real production data before declaring a bug fixed**, not just a
  synthetic test — the Rd1 CTP bug (Dev-78) and several earlier ones were only correctly
  root-caused by pulling live Worker/Jotform data via the built-in browser tool, not by
  guessing from the code alone.
- **Keep `BF_Session_Log.md` and this bootstrap doc updated as work happens**, not only in
  a big close-out pass at the end — a long session can auto-compact more than once, and
  reconstructing "what actually got built earlier this session" from scratch (as this
  close-out entry had to do for the pre-Dev-78-visible-window scramble-engine work) is
  worse than logging incrementally. If a session does end up closing out a large
  undocumented backlog in one pass, say so plainly in the log entry rather than presenting
  it as freshly built.
- **This doc and the Wally Cup spec are living documents** — when a session's work changes
  something they describe, update them as part of that work, not as an afterthought.

## 5. Known backlog (not urgent, parked)

- **Small-group payout rounding** (`BF_WallyCup_Spec.md` §6) — round-pot podium split can
  zero out 2nd/3rd place under ~9 players at the current $10/player rate. Fine for Brian's
  own groups; a gap if BFE ever opens to other hosts.
- **Overall-checkbox guardrail for multi-host use** (spec §4) — "Rolls into Overall"
  defaults to checked and is easy to miss for a non-standard round engine. Parked until
  hosting opens beyond Brian.
- **Results-page section ordering** — 2Man's results section renders after Wally Ball in
  scroll order; only the nav rail's jump link goes to the right spot. Deferred as
  lower-value than risk, this close to the event.
- **Commissioner PIN architecture / `JOTFORM_API_KEY`-in-client-source** — same shape of
  gap, logged historically in `BF_Operations_Guide.md` §10 (that file isn't in this cloud
  workspace's file list — ask Brian for it if this becomes a priority). Not urgent.
- **Push notification preference center, player-picker rethink, GS `results.html`
  photo-collage insertion, D1 schema log drift** — long-standing, not touched in several
  sessions; still open per `BF_Session_Log.md`'s own carry-forward trail.

## 6. If something here turns out stale

This file is only as good as the last session that updated it. If you find something in
here that contradicts what the actual code does, trust the code, fix this doc, and note
the correction in the next `BF_Session_Log.md` entry — don't silently work around a stale
bootstrap doc without fixing it for the next session too.
