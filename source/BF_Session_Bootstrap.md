# BF_Session_Bootstrap.md — Start Here for a New BirdieFriends Session
**Status:** **Dev-91 — "Net (handicap) play" (2026-10-01 – 10-02). Complete — start the next session as Dev-92.** Portal is now **v4.10.4**, `bf_engine.js` **1.4.0**, `bf_experiences_worker.js` **2,621 lines (deployed, D1 `handicap_config` column added)**; everything is merged to `main` (last commit `28796a2`). Shipped: (1) **Shared net/gross foundation in the engine** (`courseHandicap`, `playingHandicap`, `strokesOnHole`, `rankWithin`, `netCard`): USGA course handicap x allowance (default 95%), strokes allocated by each tee's hole handicap, 18+ wraps (20 = a second stroke on SI 1-2), plus handicaps give back on the easiest holes. Skins and Birdie Payouts each take `basis: 'gross'|'net'` (Gross default, byte-identical to Dev-90 output; `test_engine_parity.mjs` 5,005 checks unchanged); net skin = lowest NET outright, a tie is no skin; net birdie = net <= par-1, an eagle still pays once; **everyone gets their allowance-adjusted handicap, no play-off-the-low-man** (Brian). (2) **Games form "Gross or Net" section** (v4.10.0-4.10.2): per-game switch, allowance %, per-player tee + Index / Strokes given / None, one compact row per player, "Same tee for everyone"; **prefilled from Membership** (`GET /bfe/players`, `bf_players.current_hcp`; `hcp_source = 'no_hcp'` or no number defaults to Strokes Given; exact case-insensitive name match). Everything is resolved and FROZEN into `handicap_config` at save (tee, kind, strokes, that tee's 18-hole stroke index). (3) **Strokes visible before game day** (v4.10.3-4.10.4): the event card's Games details labels Skins/Birdie Payouts Gross or Net and has a Handicap strokes row with "Strokes by hole" (the rail's stroke card, viewer's row marked "(you)") and "Course with strokes" (Course viewer shades the chosen player's stroke holes with a STK row and a player picker, switching to that player's tee). The At-the-course rail also got a read-only Strokes button. Close preview and My History show strokes plus net and gross side by side. **Open into Dev-92:** see §5 "Dev-92 start list". Process notes: the test suite needs `npm i jsdom acorn --no-save` first (delete `node_modules`/`package-lock.json` after); two failures are expected (`test_at_course.mjs` stale, `test_rail_drag.mjs` needs Playwright); **`git checkout -B claude-staging origin/main` DISCARDS any unmerged commit on `claude-staging` (it silently dropped a bootstrap-reminder commit this session) — merge or re-apply first.** Full detail: `BF_Session_Log.md` "Dev-91" entries.

**Previous status (Dev-90):** **Dev-90 — "Open spots, the New Gathering redesign, and games everywhere" (2026-10-01). Complete — start the next session as Dev-91.** Portal is now **v4.9.16**, `bf_engine.js` **1.3.2**, `bf_experiences_worker.js` **2,582 lines (deployed)**; everything is merged to `main` (last commit `6f0a45d`). Shipped: (1) **Open spots** (v4.9.0/4.9.1): placeholder "Open Spot N" players a host must fill with a real member before Close. (2) **New Gathering setup redesign** (v4.9.2): switches, select-style rows, Players sheet, Add-games dialog, Holes above Format, default Individual Play (the *Edit* Gathering form still has the old layout). (3) **Darker fall My History tone** (v4.9.3). (4) **Event games** (v4.9.4–4.9.8): a Yes player on a BF Weekend Times (any non-Gathering, non-Series, non-BFE-backed) card can "+ Games" any time up to the event day (first to save is the game host; hidden shadow Gathering row, see §2a); hosts can "+ Games" a hosted card; the + Games disc leads the icon row in a lighter green. (5) **At-the-course rail** shows the event name as a vertical strip on the outer edge (v4.9.5). (6) **Weekend Live Panel** (v4.9.9): a non-Series event with an open shadow games config gets the Live Panel (`eventShadowGamed()` / `panelGamesGid()`), so Skins, CTP, BirdieBall and Birdie Payouts all work; BF Series path untouched (regression-tested). (7) **BirdieBall** (v4.9.10/4.9.11): the Live Panel card is now a **lost-ball alert only**; the scorecard ALWAYS asks Kept/Lost (pre-filled from any alert) and is the source of truth; a lost alert **pushes the round's other registered players** (`bf_type 'birdieball'`, feed card added; test mode = commissioner only). (8) **(i) descriptors** (v4.9.12/4.9.13) on every game in setup and the Event Card Games details (`GAME_INFO`). (9) **Suggested amounts** (v4.9.14–4.9.16, engine 1.3.x): pick the buy-in ($5/$10/$20 or typed) and `BFEngine.suggestGameAmounts` fills CTP/BirdieBall/Birdie amounts in whole dollars for 4-8 players (headcount = max(4, confirmed Yes)); Brian's chosen "middle option" for a $10 foursome with 4 par 3s = CTP $3/hole, BirdieBall $2/player, $3/birdie (CTP purse 30% of pot, birdie 30% of buy-in, BirdieBall 20% of buy-in); typed amounts stick, "Re-suggest" overrides. Skins carryover was deliberately NOT built (Brian: a different game from a skin pot — it would be its own game). **Open into Dev-91:** see §5 "Dev-91 start list". Process notes: one reusable `claude-staging` branch (§0); the test suite needs `npm i jsdom acorn --no-save` first (delete `node_modules`/`package-lock.json` after) and skips `test_rail_drag.mjs` (needs Playwright) and the stale `test_at_course.mjs`. Full detail: `BF_Session_Log.md` "Dev-90 addendum" sections (v4.9.1 … v4.9.16) and the close-out entry.

**Previous status (Dev-89):** **Dev-89 — Birdie Payouts game, pot over-commit guard, and GitHub publishing restored (2026-09-29 – 09-30). Complete.** Portal is now **v4.8.18**, `bf_engine.js` **1.2.0**. (1) New Gatherings game **Birdie Payouts** (portal v4.8.15): a flat $ per birdie-or-better, counted from gross scorecards against the venue's par, paid out of the buy-in pot after CTP/BirdieBall and before Skins (§2a). Needs the Worker's new `birdiepay_config` column — Brian deployed the Worker; **confirm the one-time D1 `ALTER TABLE bfe_gathering_games ADD COLUMN birdiepay_config TEXT;` was run by saving a Birdie Payouts config once** (the Worker returns a clear error naming the column if not). (2) **Pot over-commit fix** (v4.8.16, engine 1.2.0): CTP and BirdieBall can no longer pay out more than the pot holds — the Host Panel form refuses to save an over-committed config, and Close & Calculate caps CTP/BirdieBall to what the pot has (same reduced amount per hole; results explain it). Rounds that fit the pot are byte-identical to Dev-87 (`test_engine_parity.mjs`). (3) **GitHub publishing is back** — see §0; Claude pushed to `main` twice at Brian's explicit go-ahead (v4.8.17, v4.8.18: comment-only publish tests, commits `c5f836d`, `379e467`). (4) **Session numbering corrected (Brian, 2026-09-30):** the session this doc previously called "Dev-89" (the 9/29 live on-course support day, Log entries #15–20) was really the tail of **Dev-88** — the Log has always had ONE Dev-88 entry for it — so the older blocks below that say "Dev-89" for that work, the `BF_Dev89_Session_Starter.md` filename, and some code comments mean Dev-88. This session is Dev-89. Open from this session: a Games work list in §5 (streamline adding games; "Suggest amounts" recommendation), GitHub's `test_at_course.mjs` is stale (§5), and the first brand-new phone/iPad session has not yet run the §0 check.

**Dev-88 (continued, 2026-09-29) — live on-course support day: swipe-bug fix, "At the course" cascade v2, rail/event-card cleanup, BFE-Admin.html Android-overwrite recovery, GHIN plus-handicap sign fix, Live Panel scorecard marks fix (2026-09-29). Complete.** Portal was then **v4.8.14**. Full detail in `BF_Session_Log.md` entries #15–20 and `BF_Dev89_Session_Starter.md` (read that file first if you have it — it's the concise version of everything below). Highlights: (1) a left-swipe on Home was silently firing the same No-write as tapping No even for an active Yes/Sub registration — fixed at the root in `initSwipeListeners()`, after twice cancelling Brian's own live registration on-course (`test_swipe_guard.mjs`). (2) "At the course" rail existence rebuilt as cascade v2 — three independent OR triggers (proximity, a 15-min pre-tee-time window, a manual header toggle) replacing an AND-chain where any one missing gate meant the rail silently never showed; closure is manual-only now, no auto-close (`test_at_course.mjs` rewritten, 57 checks). (3) rail got a vertical event-name label (`.acr-name`, `writing-mode: vertical-rl`) and the event card had Yardage/Rules/Venue removed (pure rail duplicates) and its Score icon re-gated to "competitive, ever" not "live, right now" (`test_score_competitive_gate.mjs`). (4) `BFE-Admin.html` — outside the normal source/docs mirror, no `source/` copy at all — had 405 lines silently deleted by a stale Android AutoPush the day before (the whole Membership HCP Sync section, Dev-86); restored wholesale, HCP Sync's row-include now defaults on for every GHIN match regardless of active status, and a real sign bug was fixed in all three GHIN-paste sites (`parseFloat('+3.2')` was dropping GHIN's plus-handicap marker, inverting the quota for any better-than-scratch player). (5) the Live Panel's own Post-Round Scorecard (`submitScorecard()`, the path actually used on-course — separate from My History's `submitCardScore()`) had always hardcoded `marks: null`, losing My History's circle/square styling for every live-entered round; now computes marks from par the same way Card Score Sheet does (`test_live_panel_9hole.mjs`, 15 → 23 checks) — **not retroactive**, rounds already saved with null marks need a re-save to backfill (Brian: not worth doing for the one test round it currently affects). Full suite: 20 files, all green.

**Dev-88 — engine unification §9 Phase A, complete for Gatherings (2026-09-28).** Shipped `bf_engine.js` (shared engine, layer 1) + portal v4.8.0; one-D1-scorecard-store (layer 3) as v4.8.1; round-key + stored config for Gatherings (layer 2, `gatheringRoundConfig()`/`gatheringIsGamed()`/`gatheringAddon()`) as v4.8.2; the Live Panel `hole_half: null` fix (layer 4, spec §1a) as v4.8.4. **Phase A done — see the Dev-88 log entry for all four layers.** Phase B (re-express BFE quota rounds on the shared engine) not started, only on Brian's go-ahead. `bf_push` v17 (auto-maps `bftest_*`). Sidebar work same window, not Phase A: v4.8.3 (Venue Manager rename, GC-API Lookup link from Weather Location — `worker.js`'s rename PATCH still needs Brian's own Cloudflare paste-deploy step, `bf_push.bat` only archives it to GitHub); v4.8.5–v4.8.9, a live 4-player Gathering used as a real-world shakedown for the whole "At the course" rail (dupe-capture-icon cleanup, BETA→everyone, a Games pot-breakdown icon on the card, two live radius corrections after Brian's own house turned out to be inside the gate, and a caught-and-fixed deploy desync). Full detail in the Dev-88 log entry.

BF Cup development is paused on purpose (Brian, 2026-09-27); its design is parked in spec §2a. Earlier in Dev-87 (2026-09-24) — **Gatherings Close & Calculate shipped**
(portal v4.6.0 + a `BF_Experiences.js` route; v4.6.1 then moved Gatherings CTP from Jotform to D1; v4.6.2 fixed non-Skins Gatherings scoring to Jotform and added a My History Close entry for the host): the host of a gamed Gathering closes the round from
the Live Panel, the Skins/CTP/BirdieBall payout is computed on whoever actually turned in a scorecard,
and results post to that Gathering's My History story (see §2a). **The Wally Cup Rd3/Overall
carry-forward is retired** — Brian confirmed in Dev-87 that the event wrapped; it's no longer an open
item anywhere in this doc. **Live-verified Dev-88/89** — several real gamed Gatherings have now been
closed live at BSGC with correct Skins/CTP/BirdieBall payout results (confirmed by Brian's own
screenshot); no longer an open item. Read
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
not yet a build plan with tickets. **There is no real session numbering beyond Dev-89
(2026-09-30, this session) — don't invent or reuse "Dev-NNN" labels for individual
fixes. This has now happened
twice (briefly in Dev-82, then again all through Dev-83's own code comments, climbing from
wherever Dev-82 left off through "Dev-108") despite Dev-82 believing it had corrected the
mistake same-session. It hadn't. It was also nearly repeated in Dev-84 (a code comment briefly
read "Dev-95" before being caught and rewritten). Whatever number the codebase's own comments
are already at when you start reading them is not a real precedent to continue from — a
session is one Dev-# for its whole duration; describe an individual change by what it
touches, never by inventing it its own number.**
**⚠️ Parallel branch, 2026-09-27 (not a Dev session): Wally Cup results finalized.**
Record: `BF_Branch_WallyCupResults_2026-09-27.md` (fetch it like the other library docs).
What matters for every later session:
1. `docs/wally-cup-results.html` is now hand-finalized. **Never run BFE-Admin "Generate &
   publish" for the 2026 Wally Cup again**; edit the static file directly.
2. portal.html is now **v4.7.9** (shipped from that branch), so start from it.
3. bf_push.ps1 is now **v17** (Dev-88): v14 test suite, v15 `.json` verify fix, v16 `bf_engine.js` first in `$FileMap`, v17 auto-maps any `bftest_*` file.
4. Brian's Trip Memories cutoffs are confirmed to live only in his BFE-Admin browser's
   localStorage.
---
## 0. Session start check — GitHub publish connection (do this FIRST, before any work)
Added 2026-09-30. Claude can publish straight to this repo from a cloud session (proven 2026-09-30: a real
push to `main`, commit `c5f836d`, at Brian's explicit go-ahead) — **but only while the Claude GitHub App is
installed on the repo and this session has the repo attached.** The refusals that preceded that day said
"link your GitHub account" / "push refused" and are easy to mistake for something else, so check
up front, don't discover it at delivery time:
1. Call `add_repo` with owner `birdiefriends`, repo `birdiefriends.github.io`, `access: "push"`. Read the
   result, not just whether it returned: a `push_check: "refused"` field, or a note that pushes will be
   refused, means the connection is NOT good. "already attached" alone is not proof either.
2. Prove push works without publishing anything: a clone of the repo, then
   `git push --dry-run origin HEAD:refs/heads/claude-push-check` (contacts GitHub and needs write access;
   creates nothing). If it is refused, treat the connection as down.
3. **If it is down: tell Brian in your first message, before any other work, with the fix** — install the
   Claude GitHub App on the `birdiefriends` account for the `birdiefriends.github.io` repo only
   (https://github.com/apps/claude/installations/select_target), or re-link GitHub at
   https://claude.ai/customize/connectors?auth_start=github&auth_start_force=1 (Settings → Connectors should
   show "GitHub Integration" connected and, under it, the Claude GitHub App installed). Retry once after he's
   done it; don't loop. If it stays down, fall back to the AutoPush delivery path in §4 and say so plainly.
4. Say the result in one line at the top of the session ("GitHub publish: OK" / "GitHub publish: DOWN — …").
> **PUBLISHING MODE — either/or, never both (Brian, 2026-09-30).**
> - **DIRECT mode is the default.** Claude publishes to `main` from the cloud session (on Brian's explicit go-ahead, else to the single `claude-staging` branch). In this mode Claude **never** writes anything into the AutoPush folder — no `device_commit_files`, no "refresh the local copies" — and Brian does not run `bf_push`.
> - **AUTOPUSH mode exists only when Brian explicitly says so in that conversation** (e.g. "use AutoPush this time" / "override direct"). Then Claude delivers to AutoPush as §1/§4 describe, and does **not** push to `main` itself.
> - Why: `bf_push` pushes whatever is in AutoPush straight to `main`. If AutoPush holds anything older than `main`, an accidental run overwrites `main` with stale content. Keeping AutoPush out of the loop in direct mode means there is nothing there to be stale.
> - **Guard at session start (direct mode):** if the AutoPush folder is connected, list it and tell Brian which files there are `$FileMap` keys (i.e. deployable by `bf_push`). Offer to move them into a `_to_delete/` subfolder so an accidental `bf_push` finds nothing; never delete or overwrite them without asking. Say which mode the session is in on the same line as the §0 result ("GitHub publish: OK — DIRECT mode").
> - Worker (`.js`) changes are unaffected by mode: they are never pushed by Claude and stay Brian's paste-deploy. In direct mode Claude pushes the Worker *source* to `main` like any file and Brian pastes it into Cloudflare.

Rules while it's up: **publish to `main` only on Brian's explicit go-ahead in that conversation**; otherwise
push to the ONE reusable branch **`claude-staging`** (Pages serves only `main`, so nothing goes live) and he merges.
**Staging branch rule (Brian, 2026-10-01):** never create per-topic `claude-staging-*` branches — GitHub won't let the cloud
session delete branches (HTTP 403), so they pile up for Brian to delete by hand. Before each task:
`git checkout -B claude-staging origin/main` (or `main` after a fetch), do the work, then
`git push --force origin claude-staging` — force is fine on THIS branch only (plain `--force-with-lease` is rejected as
"stale info" because the session proxy keeps no remote-tracking ref), **never on `main`**. After "merge it", fast-forward `main`
to it and leave `claude-staging` in place; it is simply reset to `main` on the next task. If the stop hook says the branch has
no remote, run `git update-ref refs/remotes/origin/claude-staging $(git rev-parse HEAD)` (local bookkeeping only). Always
`git fetch origin` and confirm nothing newer is on `main` before pushing, run the test suite first, and report
exactly what went out. **Publishing is EITHER/OR (Brian, 2026-09-30) — see the mode box above. After a direct push, do NOT copy anything into AutoPush** (this replaces the earlier "refresh AutoPush copies" rule, which is retired). A push does NOT deploy a Worker — Cloudflare paste-deploys stay Brian's. This is the
working rule for now; it supersedes "I never do this myself" in §1 for GitHub pushes only, pending Brian's own
final wording. The connection is account-level, so it should work from any device's Claude UI — **confirmed
2026-09-30 from the laptop, and from a phone request inside the same cloud session; a brand-new phone/iPad chat running this §0 check has not happened yet — log its result here when it does.**
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
  touches. Currently v4.7.9 (see `portal_version.txt` — **bump this with every
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
**Deployment — I never do this myself.** *(Superseded 2026-09-30 by the §0 either/or publishing-mode box: DIRECT mode is default and AutoPush is not touched; the AutoPush description below applies only when Brian explicitly switches to AUTOPUSH mode.)* *(For GitHub pushes this is superseded in part by §0, 2026-09-30: with the connection up and Brian's explicit go-ahead, Claude may push to `main`. Cloudflare Worker deploys are unchanged and stay Brian's.)* Brian runs his own local `bf_push.bat`/
`bf_push.ps1` against a folder called AutoPush, then does his own Cloudflare
paste-and-deploy step for Worker changes. My job is to prepare and verify files, then
deliver them: `SendUserFile` first, then (when linked to Brian's computer)
`mcp__remote-devices__device_commit_files` into
`C:\Users\16177\Downloads\GolfScorer\AutoPush`. I do not run deploy commands or push to
Cloudflare/GitHub myself. **Since Dev-80, one exception:** changes to `bf_push.ps1` itself
get written DIRECTLY to the live file at that AutoPush path, and the same content is pushed to
`source/bf_push.ps1` on `main` (the `bf_push_library.ps1` snapshot route is retired, 2026-09-30) —
see §4 for the full rule.
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
   committed directly to the live file going forward, not left for manual copy-over
   (as of 2026-09-30 the repo archive copy goes straight to `main`, not via a
   `bf_push_library.ps1` snapshot) — see §4.
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
  itself must stay overflow-visible). The player venue viewer **and** Venue Manager's stored-tees
  list both render through `venueTeeSummaryHtml` (tee dropdown + stat strip + `venueScorecardHtml`
  grid, v4.7.4). The old `venueTeeHolesTableHtml` table is gone.
- **"At the course" rail — BETA, Brian only (v4.7.2).** Location-gated vertical toolbar (see the
  Session Log's Dev-87 item 8). The gate is `AT_COURSE_BETA_PLAYERS`; widening it needs a designed
  location-permission moment first. It depends on venue `lat/lng`, which the main Worker's public
  `GET /venues` now returns (five venues still have none). This is the proving ground for the
  In-Play hub direction Brian is weighing. It auto-tucks while the Live Panel is open (v4.7.3), and it
  can be dragged to either side at any height, remembered per device (v4.7.7). **Location check verified live
  at Moselem (Dev-87).** Test mode (`?atcourse=1`) lapses after 4 h, and a tap on TEST ✕ turns it off (v4.7.8).
- **Birdie Payouts (Dev-89, portal v4.8.15, engine 1.1.0).** A fourth Gatherings game. Host sets one number,
  **$ per birdie**; every hole a player scores gross ≤ par − 1 pays that flat amount to that player (an eagle
  or better is still ONE payout, not scaled). Comes out of the same $/player pot **after** CTP (order 10) and
  BirdieBall (20), at order 30, **before** Skins (90, residual), so Skins gets what's left. Par comes from a
  table **frozen into the saved config at setup** (`birdiepay_config: {dollar_per_birdie, pars:[18]}`, from
  `csResolvePars`) — never guessed at close; no par table → the form warns and refuses to save, and a config
  saved without one pays nothing and says "No par data was saved". 9-hole back-nine cards read pars 10–18.
  If birdies would cost more than the pot has left, every birdie pays the same reduced amount
  (`floor(left ÷ birdies)`, order-independent) and the results say so. Shows on the event card's Games
  details, the Close preview, and My History Game Results (each birdie listed, 🐤 chip). Worker: `VALID_GAMES`
  includes `birdiepay`; its config is written in its **own** `UPDATE` so Skins/CTP/BirdieBall saves survive an
  un-migrated column. Tests: `test_birdie_payouts.mjs` (78 checks incl. a 3,000-round conservation fuzz).
- **Pot over-commit guard (Dev-89, v4.8.16, engine 1.2.0).** Before this, a CTP purse + BirdieBall larger than
  the pot silently paid out more than was collected. Now: the Host Panel's Games form warns live and refuses
  to save when CTP + BirdieBall exceed the pot (confirmed-Yes × $/player) or BirdieBall's rate exceeds the
  whole $/player; and `bf_engine.js` caps CTP (uniform reduced $/hole, result gets `capped`/`paid_per_hole`)
  and BirdieBall (`capped`/`configured_pot`) to what the pot has left. **The one deliberate departure from
  Dev-87's output**, and only for over-committed configs; rounds that fit are byte-identical and
  already-saved snapshots are frozen and untouched. `test_engine_parity.mjs` now checks fits for exact parity
  and over-committed ones for conservation.
- **Open spots — placeholder players (Dev-90, portal v4.9.0 + BFE Worker).** A seat held for someone the host
  can't name yet: a `registrations` row named "Open Spot N" with `is_placeholder = 1` (needs the one-time
  `ALTER TABLE registrations ADD COLUMN is_placeholder INTEGER NOT NULL DEFAULT 0;`). **Every spot must be resolved
  to a real member** — BFE Worker `POST /bfe/gathering-spots/:id/fill` renames it in registrations, bfe_scorecards,
  bfe_cttp_entries, bfe_birdieball_answers and the closed payout_summary in ONE atomic D1 batch (both Workers share
  the one D1 database), and `POST .../close` returns 409 while any spot is open. Host-only UI: "Open Spots" stepper
  in New Gathering, "➕ Open spot" + Fill on Host Panel cards (Upcoming and Archive), Fill picker lists real active
  members only, Close sheet disabled until filled. Main Worker untouched. Tests: `test_open_spots.mjs` (real
  SQLite), `test_open_spots_ui.mjs`. Not renamed: photo/note player tags. Deploy order: D1 step, then the Worker
  paste-deploy, then the portal.
- **Event games — games on a non-Gathering event, + Games from the card (Dev-90, portal v4.9.4 + BFE Worker).** A Yes
  player on a BF Weekend Times (any non-Gathering, non-BF-Series, non-BFE-backed) card can tap "+ Games" **any time up to the event day** (v4.9.6; originally day-of only — Brian OK'd early setup); the
  first to SAVE games owns them ("game host"). Under the hood a hidden **shadow Gathering** row (`gatherings.status =
  'event_shadow'`, `event_ref = '<event name>|<YYYY-MM-DD>'`, size NULL) is created by BFE Worker `POST /bfe/event-games/shadow`
  (idempotent, unique index) so config/close/payout/My History work unchanged; the main Worker never lists it (all its
  queries filter `status='active'`). Scorecards stay under the **event's own name** (the Score icon already saves them
  there); the Close sheet reads them via `gamesScoreKeyForGid()`, and the result shows on the event's My History group.
  **All four games are offered since v4.9.9**: an event with an open shadow config gets the Live Panel (`hasLivePanelSupport` → `eventShadowGamed`, checked before the format ladder; BF Series never qualifies), where CTP is kept in D1 under the event name and BirdieBall answers under the shadow's `gathering_id`; the panel's Close button shows for the config's `host_id`. Hosts
  can also "+ Games" a hosted card with no games (today or later). Closed results are never overwritten from the card
  (`_closedGamesGids`). Worker also got first-writer-wins on `POST /bfe/gathering-games` and `DELETE ...?host_id=`.
  **Deploy order: D1 (`ALTER TABLE gatherings ADD COLUMN event_ref TEXT;` then `CREATE UNIQUE INDEX idx_gatherings_event_ref
  ON gatherings(event_ref);`), then paste-deploy `bf_experiences_worker.js`, then the portal.** Known gap: `purge-all` in the
  main Worker deletes a host's shadows without removing their BFE rows. Tests: `test_event_games.mjs`.
Full build detail, including the exact bug chases and test coverage, is in
`BF_Session_Log.md`'s Dev-86 entry.
## 3. Dev-88 focus — engine unification, Phase A (prove it on Gatherings)
**Read `BF_BFE_NextGen_Spec.md` §9 in full first** (the two-systems table, the nine layers, Phases A–D),
then §2a.2/§2a.3/§2a.5/§2a.7 (the generic Round Config contract). BF Cup is **parked** (§2a.9's seven
decisions wait for dedicated BF Cup sessions) — don't start match play.

**Phase A, in order:**
1. **Two decisions to settle with Brian at the start:** where `bf_engine.js` lives (likely `docs/`, so
   portal.html and BFE-Admin.html can both `<script src>` it — needs a `bf_push.ps1` `$FileMap` entry,
   edited directly on the live file per the Dev-80 rule), and which Worker owns the unified scorecard
   store (layer 3; main-Worker D1 already holds Gathering strokes).
2. ~~**Extract the Gatherings engine into `bf_engine.js`**~~ — **done (layer 1, portal v4.8.0).**
   `computeGatheringGamesPayout` and its helpers are registry entries in `bf_engine.js`; portal.html
   calls the module. `source/tests/` repointed at the module, all checks green.
3. ~~**Round key + stored config for Gatherings** (layer 2)~~ — **done (portal v4.8.2).**
   `bfe_gathering_games` now expressed through `BFEngine.gatheringConfigFromLegacy()` via three new
   resolver helpers (`gatheringRoundConfig`/`gatheringIsGamed`/`gatheringAddon`), replacing five separate
   raw reads of the legacy row across the event-card seal, `evtScoreMode`, and the Live Panel's
   CTP/BirdieBall section gating + CTP-holes resolution. 12,003-check fuzz test proves exact parity on
   form-valid data; malformed-data divergence is real but bounded and counted, not hidden (new is
   stricter by design). `hasLivePanelSupport` was deliberately left as a plain existence check — it isn't
   shape-derived. Full detail in the Dev-88 log entry.
4. ~~**Fix the Live Panel `hole_half: null` gap** (spec §1a)~~ — **done (layer 4, portal v4.8.4).**
   The real gap was bigger than the spec text alone implied: the Live Panel scorecard required all
   18 holes for any 9-hole gamed Gathering, not just misrecorded which half. Fixed with a
   `_scHoleHalf` Front/Back toggle (mirrors Card Score Sheet's `_csHoleHalf` pattern) — a 9-hole
   event now shows one 9-hole grid and sends the real `hole_half`/`hole_count`; 18-hole events are
   unchanged. Full detail in the Dev-88 log entry.
5. Log incrementally; small shippable slices, each behavior-neutral unless Brian asks otherwise.

**Phase A is complete for Gatherings — all four layers shipped and tested (portal v4.8.0–v4.8.2,
v4.8.4; 17,258 checks, all green).** Per spec §9, next is **Phase B (re-express BFE quota rounds on
the shared engine)** — not started, only on Brian's go-ahead.

**Resolved since Dev-87:** Close & Calculate and Gathering CTP on D1 — live-verified across several
real gamed Gatherings through Dev-88/89, correct Skins/CTP/BirdieBall payouts confirmed by Brian. The
"at the course" rail is no longer beta — opened to every signed-in registered player in Dev-88
(v4.8.6) and rebuilt as a three-trigger cascade (proximity/tee-time-window/manual toggle) late in Dev-88 (2026-09-29; this doc once called it Dev-89)
(v4.8.11), so the original "location-permission moment" design question is moot — existence no longer
depends on a first-run GPS permission prompt at all. **Still open:** the In-Play hub decision is still
Brian's to make.

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
- ~~Buck Hill GolfCourseAPI name-variant retry~~ — **resolved Dev-87 (v4.7.5)**: Venue Manager's
  search now retries automatically with a simplified name; "Buck Hill" finds Buck Hill Falls GC.
  GolfCourseAPI matches were found for Paupack, Skytop, Woodstone, Honesdale and Lords Valley too — all
  five venues missing coordinates can now be filled from GC-API Lookup.
Nothing above is expected to be a large item on its own — if something real breaks, fix it in
place and log it the same way prior sessions' own live-data catches were logged (see those
entries in `BF_Session_Log.md` for the pattern: what was found, how it was verified against
live data, what Brian confirmed).
## 4. Standing operating rules (apply every session)
- **`bf_engine.js` is the shared game engine (Dev-88).** Scoring/payout logic goes THERE as registry
  entries, not into portal.html or BFE-Admin.html. When it changes, bump `ENGINE_VERSION` and portal's
  `<script src="bf_engine.js?v=...">` together (`test_engine_wiring.mjs` fails otherwise), and deliver
  it alongside portal.html — bf_push pushes it first. `test_engine_parity.mjs` pins the Dev-87
  Gatherings payout; a deliberate payout change means updating that test and logging why.
- **Scorecards: new work is D1-only, in `bfe_scorecards` (BFE Worker) — Brian, Dev-88.** Portal goes
  through `SCORECARD_API`; every row declares `input_type` (strokes|points|hole_result). **A reader of
  gross strokes must pass `input=strokes`** — Wally Cup rows are Stableford points. The main Worker's
  `scorecards` table is frozen (read-only fallback). Series Jotform scorecards stay untouched until the
  2026 Series concludes.
- **Run the test suite before delivering any portal.html change (added Dev-87).** `source/tests/`:
  `npm install && node run_all.mjs` (details in its README). It tests the real functions inside
  portal.html. A failing test means either the behavior changed on purpose (update the test and say so
  in the log) or by accident (fix the code). Add tests for new engine/UI logic in the same style.
- **Before editing any library doc, sync to `origin/main` first — especially the Log and Bootstrap
  (Dev-87).** A parallel session (the 2026-09-27 Wally Cup branch) pushed Log/Bootstrap/portal updates
  mid-session. Dev-87 caught it only because `git diff --stat` showed files it hadn't touched: whole-file
  delivery of a stale Log/Bootstrap would have erased the other session's notes. Fetch, reset to origin,
  re-apply your edits, and check `git diff --stat` lists only files you meant to change before delivering.
- **GolfCourseAPI calls spend Brian's 35/day free quota** — no casual probing (see §5).
- **Never deploy.** Prepare files, verify them (jsdom/vm test against the actual extracted
  function source before delivery — this codebase is large enough that "looks right" isn't
  enough), deliver via `SendUserFile` + `device_commit_files` into AutoPush. Brian pushes.
- **AUTOPUSH mode only (see §0 mode box): ** the rule below applies only after Brian explicitly overrides direct mode. In DIRECT mode never write to AutoPush.
- **Any file meant for `bf_push.bat` (i.e. it's a key in `bf_push.ps1`'s `$FileMap`) needs
  an explicit `device_commit_files` call to the exact AutoPush root path — `SendUserFile`
  alone is not enough.** Found Dev-78 close-out: the linked desktop app auto-saves
  chat-delivered files into a `Claude outputs` subfolder inside whichever folder is
  connected (AutoPush here), but `bf_push.ps1` only ever looks in its own folder
  (`$ScriptDir`, no subfolder recursion) — files that only went through `SendUserFile`
  silently didn't get found by the push tool. Always finish with `device_commit_files`
  targeting `C:\Users\16177\Downloads\GolfScorer\AutoPush\<filename>` directly for
  anything Brian will push.
- **`bf_push.ps1` itself — how a change to the push tool is delivered (Dev-80 rule, revised
  2026-09-30).** Brian's explicit instruction (Dev-80): "update the .ps1 directly. That should
  always be the case rather than me risk a manually edit mistake." So when Brian asks for a change
  to the push tool, Claude (1) writes it straight to the live
  `C:\Users\16177\Downloads\GolfScorer\AutoPush\bf_push.ps1` via `device_commit_files` (guard the
  write with the file's `expectedMtimeMs`), and (2) puts the **same bytes** at `source/bf_push.ps1`
  on `main` through the normal direct-publish path (staging branch, then `main` on Brian's go-ahead).
  The old `bf_push_library.ps1` snapshot is **retired**: do not drop it in AutoPush — under the
  either/or publishing rule (§0 mode box) AutoPush is not used to publish, and the snapshot would
  only sit there as one more file a stray run could push. (Its `$FileMap` line is harmless and can
  stay.) This live-script write is the one thing Claude puts in AutoPush in DIRECT mode, and only
  when Brian has asked for a tool change; v18 refuses to push anything without a one-shot
  `AUTOPUSH_OK.txt` marker, so the script itself can't publish anything by accident. Both copies
  must stay byte-identical (check with a diff after delivering).
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
  **(Dev-87: for code work, also `git clone --depth 50 https://github.com/birdiefriends/birdiefriends.github.io.git`
  into `/home/claude/bf-repo` — it's public, so cloning works without push access — to get `docs/portal.html`,
  `docs/BFE-Admin.html` and `source/tests/` together; `git fetch` + compare against `origin/main` before
  every delivery.)** —
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
- **Dev-92 start list (from the Dev-91 close, 2026-10-02).**
  1. **Design the game registry FIRST — a design note in `BF_BFE_NextGen_Spec.md`, no code until Brian signs off.** Brian's requirement: one definition per game so adding a game is plug-and-play (this is the "streamline adding a new game" item below; **STANDING REMINDER: remind him of it whenever he asks for a new game**). **It must support BFE-A multi-day experiences:** an event is an ordered set of rounds/days, each with its own daily format, packaged as ONE experience with cumulative standings and payouts (the Wally Cup shape: rounds, `chainsFrom`, Overall). **The next big proof is the BF Cup: a 2-day, Ryder-Cup-style team event** (two teams, foursomes / fourball / singles match play, points per match, cumulative team points). So the registry needs two levels, not one: (a) **base games** (spec §2a/§9: entity individual|team, input strokes|points|hole_result, compare; today `scorecard_only`; Phase B adds stableford_quota, scramble_pair, points_by_score_type; BF Cup adds match play, spec §2a.4) and (b) **add-ons** (the money games: CTP, BirdieBall, Birdie Payouts, Skins, plus whatever comes next), plus an event-level aggregator (rounds in sequence, cumulative standings). Read spec §9 and §2a (esp. §2a.9, the seven decisions Brian still owes for BF Cup) first. The net/gross foundation (Dev-91) is already generic and should carry over: a base game or add-on just declares `basis` and reads strokes through `BFEngine.netCard`.
  2. **Build the registry in three mergeable layers** (each tested, parity suite green): (a) engine — game metadata (label, icon, seal, (i) text, config-field schema, net-capable flag, fixed-cost hook for the pot-fit guard, suggestion rule, result renderer) in the registry; ledger fields and payout totals read registered ids instead of hand-listing; (b) Worker — one generic `game_configs` TEXT column (JSON keyed by game id; one ALTER, one paste-deploy, then no more per-game migrations), shape-checked only, legacy columns still read through the adapter, closed `payout_summary` frozen; (c) portal — the Games form, pot preview, over-commit guard, details card, seal, results, rail Strokes card all loop over the registry. Today a game touches ~17 portal functions (50 mentions of birdiepay), ~28 Worker places, ~14 engine places. A registry-driven conformance test (required members, conservation fuzz, gross and net paths) should run for every game automatically. Stays custom per game: the payout logic, any live-input UI (CTP / BirdieBall Live Panel widgets), and team games until the entity model exists.
  3. **First game built on the new registry is the proof** (carryover skins was Brian's earlier candidate; ask which he wants).
  4. **Not yet tested end to end on real data** (Brian never ran the dry run): the live Worker save with `handicap_config`, the rail Strokes card, Close & Calculate on a net round, My History net lines, Course-with-strokes on a phone. First real use is any gamed round Brian sets to Net. Watch for it.
  5. **Known gaps / assumptions (Dev-91):** the Index comes from Membership by exact (case-insensitive) name match, so a name mismatch shows "Not found in Membership" and the host types strokes; a plus handicap is assumed stored as a negative `current_hcp`; rounding follows USGA Appendix C as understood (round once, after the allowance) and is worth confirming against the USGA calculator; the Course viewer's stroke shading assumes an 18-hole round (a 9-hole round's strokes are not re-ranked there); the Edit Gathering form still has the pre-redesign layout; `test_at_course.mjs` is stale.
- **Carried from the Dev-90 start list:**
  (Dev-90 close, 2026-10-01; items 2-5 below are still open unless noted above):
  1. **Watch the first real Weekend-event run** (Brian will announce the feature to players): + Games as a Yes player → Live Panel (CTP, BirdieBall alert, scorecard, birdie alert) → Close & Calculate → My History. Also confirm the BirdieBall lost push actually lands on a phone (its `bf_type` `'birdieball'` is free-form in the push Worker but has not been seen live), and that the suggested amounts feel right on the real form. Expect tuning of the suggestion shares after real use.
  2. **Streamline adding a new game** (item 1 of the Games work list below) — **STANDING REMINDER (Brian, 2026-10-01): when he asks for a new game, FIRST remind him this is still undone and should come before the game.** Still the first thing to do before ANY new game; it also absorbs `GAME_INFO` (i) text, the suggestion rule and the form sections into the one game definition.
  3. **Edit Gathering form** still has the pre-redesign layout; bring it in line with the New Gathering form (switches, rows, Players sheet, Games dialog).
  4. **Possible new games (each its own game, not a switch):** carryover skins (traditional, per-hole value, ties roll forward); **net (handicap) skins** — the lever if less-skilled players still get too little back (needs tee box capture first, see below).
  5. **Known gaps:** main Worker `purge-all` deletes a host's shadow Gathering rows without removing their BFE rows (scorecards/CTP/BirdieBall); a Weekend event's Score icon and the Live Panel scorecard both save strokes under the event name (intentional, but a first-time double entry is possible); `test_at_course.mjs` is stale (see below); BirdieBall "held longest" still assumes a #1 start.
- **`test_at_course.mjs` on GitHub is stale and fails against the current portal (found Dev-89).** The copy in
  `source/tests/` (148 lines) still expects constants (`AT_COURSE_TEST_HOURS`) that Dev-88's rail cascade v2
  removed; Brian's AutoPush folder has the rewritten 57-check version (see the Dev-88 status block) but it isn't named with the
  `bftest_` prefix, so `bf_push` never pushed it. Fix: rename to `bftest_test_at_course.mjs` and push, or have
  Claude stage it from AutoPush and commit it. Until then the full suite shows one expected failure here.
  (AutoPush also held local `test_dupe_removal.mjs`, `test_rail_drag.mjs`, `test_score_competitive_gate.mjs` at
  the same time — check those against `source/tests/` too.)
- **WORK LIST — Games (added 2026-09-29, Brian).** Two linked items, in this order:
  1. **Streamline adding a new game (do first — it makes item 2 and every later game cheaper).**
     Adding Birdie Payouts (portal v4.8.15) touched ~6 places in 3 files plus a D1 migration:
     `bf_engine.js` (an `ADDONS` entry, `gatheringConfigFromLegacy`, and hand-listed result/ledger/total
     lines in `computeRoundPayout`); `portal.html` (`GATHERING_GAMES_META`, `GAMES_SEAL_LABELS`, a
     `_gamesForm…Config` state var + section HTML + setter + toggle-reset, the pot preview, the
     `submitGatheringGames` validation/payload, `renderGatheringPayoutHtml`'s section + payout chip,
     `gatheringGameDetailsBody`'s row, and copy strings that name the games); the Worker (`VALID_GAMES`,
     per-game validation, a per-game config column, GET parse, INSERT/UPDATE, schema comment) and a
     one-time D1 `ALTER TABLE`. It worked, and the engine half was genuinely one registry entry — but the
     rest is the same game described five times, and each copy can drift. Direction: ONE game definition
     (id, label, icon, seal label, config fields + validation, carve function, result renderer, details
     row, fixed-cost hook for the pot-fit guard) that the form, results, details card and Worker
     validation are all driven from; store per-game config as one generic JSON column keyed by game id
     so a new game never needs a migration; generalize `gamesFormOverCommit` so each game declares its
     own fixed cost instead of the guard hard-coding CTP + BirdieBall. Keep the frozen `payout_summary`
     shape and `test_engine_parity.mjs` green (Dev-87 output must stay byte-identical for rounds that fit
     the pot). Own session; do it before the next new game, not after.
  2. **[BUILT v4.9.14 / engine 1.3.0 — `BFEngine.suggestGameAmounts`, portal `applyGamesSuggestion`; the text below is the original brief]** **"Suggest amounts" $ payout recommendation ("we figure it out for the host").** A pure engine
     function taking $/player, expected headcount, games ticked and the venue's par-3 count, returning a
     suggested CTP $/hole, BirdieBall $/player and Birdie Payouts $/birdie; a "Suggest amounts" button on
     the Host Panel Games form fills the fields, the host can still edit, and the live pot preview +
     over-commit guard (v4.8.16) check the result. Stored config stays in dollars (Dev-86 decision) — any
     percentages only choose the starting dollars. Show the headcount it assumed and let the host re-run
     it (CTP is a fixed purse, BirdieBall scales with players, so a suggestion made at 8 players is off at
     5). **Open decisions for Brian before building:** the split rule (a starting proposal: Skins keeps at
     least ~half; CTP ~10–15% across the par 3s; BirdieBall ~$1–2/player; birdie payouts sized so a typical
     field's birdies use ~15% — the birdie share should be conservative since how many birdies a group makes
     is a guess, though the engine's cap means a wrong guess can't overpay); whether the host picks
     Skins' share and we fill in the rest, or one button applies the default split; and whether the birdie
     estimate should use the group's handicaps (Membership has them; leave out of the first version).
- **Course layouts + manual tee editor + 9-hole games (designed Dev-87, not built)** — full plan in
  `BF_BFE_NextGen_Spec.md` §1a. The prerequisite bug to fix first: the Live Panel scorecard always sends
  `hole_half: null`, so a 9-hole gamed Gathering on the back nine would misalign every hole.
- **GolfCourseAPI free tier is tiny (reportedly ~35 requests/day, shared by everything using the key).**
  Every search and course lookup counts, including Claude's verification probes. Once it's spent, calls
  return 429 until the reset (the portal says so plainly since v4.7.6). Budget it, and consider caching
  search/course responses in D1 on the BFE Worker if Venue Manager use grows.
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
