# BF Experiences (BFE) / Wally Cup — Competitive Events Architecture Spec

**Status as of Dev-73 (2026-08-30).** This is the first time this spec has been
committed to the repo — it existed only as a local file (`WC_spec.txt`, from Dev-71)
until now. Rd1 tees off 10am, 9/11/2026. For the full narrative reasoning behind any
decision below, see the Dev-71/72/73 entries in `BF_Session_Log.md`; this doc is the
standing architecture reference, not a replacement for that history.

**A note on completeness:** the draft Brian supplied this session picked up mid-thought,
at what reads as the tail of an opening philosophy/principle discussion (§1–2) — that
opening text itself wasn't in what was provided. §1 below reconstructs it from what §3–4
clearly presuppose and from the Dev-71 log entry; flag it for correction if the original
wording differed from what's captured here.

**Status legend used throughout:** ✅ built & confirmed live · 🔧 built, not yet wired to
the rest of the flow · 📋 planned, not started · ⚠️ diverged from the plan below (noted
inline) · ❓ open, needs Brian's input.

---

## 1. Origin & philosophy (reconstructed — see note above)

BF Experiences (BFE) is BirdieFriends' architecture for competitive, multi-round events —
Wally Cup first, with BFCup, Turkey 2Man, and BlackFriday 1Man following behind it later
in 2026 (§5). It is explicitly **not** a Wally-Cup-specific build; it's meant to become
the one shared platform all of these events run on, with Wally Cup as the proving ground.
It is deliberately kept separate from GS/BFSeries rather than added onto it (§2, §3).

## 2. Architecture principle (non-negotiable)

An event is a metadata record naming which engine, which influencers, and how rounds
chain — never a code branch. The Player View / results renderer reads a generic `result`
shape (`total`, `modifiers[]`, `rank`) and never branches on event type either. This is
the one piece of the design treated as non-negotiable from day one — cheap to get right
now, expensive to retrofit once named per-event branches already exist. The engine
*catalog* itself stays incremental: each new engine (`stableford_quota`, `scramble_pair`,
eventually `match_play`, `points_by_score_type`) gets designed for real when its event is
actually in front of us, not guessed at now.

## 3. Where GS fits

GS (`BF_Golf_Scorer_8.html`) gets **zero new code for the rest of 2026** — no Wally Cup
tab, no shared functions, nothing. Two documented reasons this matters, not just caution
for its own sake: every GS deploy redeploys the entire file (no partial deploy), and this
exact codebase has twice shipped a bug from a change that looked isolated but wasn't (the
Dev-63 `fetchJotformProxy` scoping bug; the HCP-override fix that missed a third write
path). Touching GS during the remaining BFSeries events is the single highest-risk thing
we could do, independent of how good the new WC code is. ✅ Held through Dev-73 — GS has
not been touched.

What *does* get reused from GS: the quota math itself — `36 − (HCP × Slope / 113)`
initial formula, `adjustQuota()`'s `prevQuota + perfAdj + hcpAdj`, the 25%-cap Quota
Stability Rule — copied into the new standalone as its own function, not referenced or
shared. Confirmed Dev-73 by direct code read: this logic is ~20 lines, trivially
portable, and unchanged from what's described here. Divergence between the copy and GS's
original isn't a concern this season, since GS's version won't change again before 2027.
**Not yet ported** — this is Dev-74/75 Phase 2 work (§8).

## 4. Wally Cup 2026 — concrete build

**New standalone tool** (own file, own deploy path — never GS). Scoped narrower than a
full alternate platform:

- **Roster/venue setup** — 16 players, 3 venues (Homesdale GC, Skytop Lodge, Peapack
  Hills GC), one metadata record per round (`2026 Wally Cup - Rd1/Rd2/2Man/Rd3`, matching
  the portal's actual event names — no renaming). ✅ Built — `bfe_events`/
  `bfe_event_rounds`/`bfe_event_roster` plus `bfe_event_config` and `bfe_player_profiles`
  exist in D1 and are live; `BFE-Admin.html` confirmed Dev-73 to successfully load
  venues, event names, and players against them. These specific table names/shapes are
  an implementation detail decided after this spec was drafted — not named here
  originally, documented here for the first time as the actual as-built schema.
- **Engine:** `stableford_quota`, chained Rd1 → Rd2 → Rd3 (portal's "Rd3" is the 3rd/final
  individual round in the chain — confirmed, no rename needed). 📋 Engine logic itself
  not yet built — quota math exists in GS (§3) but hasn't been ported into this system.
- **Influencer:** `wally_ball`, `points: 1` on Rd1, `1` on Rd2, `2` on Rd3 — folds
  visibly into that round's total, flows into the Overall podium. 📋 Not yet built —
  depends on the round-results engine above and the Wally Ball capture data (below).
- **2Man** is its own scoring module — `scramble_pair` engine, no influencers, explicitly
  excluded from Overall (a team result can't fairly redistribute individual credit, so no
  dormant weighting knob either). Building this now doubles as the prototype for Turkey
  2Man in November. ❓ **Correction, Dev-73 — this spec's original "Open items for Brian:
  none remaining" claim (below) was wrong on this point.** The actual scramble scoring
  formula for 2Man has never been defined anywhere in this codebase or in any earlier
  version of this spec. This blocks sizing/building the 2Man engine and its payout calc
  (§8 Phase 2) and needs Brian's direct input before that work can start.
- **Scorecard and CttP capture — ⚠️ revised again, Dev-73, superseding the "isolated to
  the new Worker" plan below.** Original plan (kept verbatim in the next paragraph for
  the record) was to drop Jotform entirely for the new system and write straight to the
  new Worker's D1 tables from the Live Panel. Given the 9/11 timeline, Dev-73 reversed
  this: **Jotform remains the live data-collection mechanism for Wally Cup**, exactly as
  it already is for BFSeries — full Jotform sunset is deferred, not abandoned. The
  practical effect: `bfe_scorecards`/`bfe_cttp_entries` (below) still exist as the
  system's data tables, but they get populated by reading Jotform submissions into D1
  (reusing the existing `jfGetAnswerByPriority` field-matching pattern already used for
  the registration roster, §4c) rather than by direct client-side POST from the Live
  Panel. That read-and-sync step is 📋 not yet built — Dev-74/75 Phase 2 (§8).
- Original plan, superseded above, kept for context: *"Scorecard AND CttP capture both
  isolated to the new Worker — revised: originally planned to reuse the main worker's
  existing `/scorecards` table as-is (it's already generic, no technical reason it
  couldn't work). Reconsidered: 'the new system never writes to a table the main worker
  owns' is a stronger, cleaner guarantee... So `bfe_scorecards` and `bfe_cttp_entries` are
  both new tables on the new Worker (§4b), not the main one — CttP additionally drops the
  Jotform round-trip entirely... in favor of the same D1-backed pattern."* **BFSeries'
  own Scorecard/CttP remains completely untouched either way** — still the main worker,
  still Jotform, since GS/BFSeries stays frozen. Consequence still worth naming: once
  Wally Cup data lives in `bfe_scorecards` (however it gets there), portal.html's My
  History needs to fetch and merge from both the main worker and the new one, or a player
  won't see their Wally Cup rounds in their own history. Real, manageable, still for
  later.
- **Wally Ball capture** — entered by the foursome Overseer (the existing overseer/proxy
  pattern already in the Live Panel) as one more field in the same Post-Round Scorecard
  submission — "Still have it?" / "Lost on hole #, stroke #." Lives as `wb_status`/
  `wb_hole`/`wb_stroke` columns directly on the `bfe_scorecards` row, not a separate
  table — no join needed to answer either the achievement-points question (did they still
  have it going into this round) or the $ pot question (who held it longest, down to the
  stroke). Policing is social — the foursome holds itself accountable — same trust model
  as self-reported Marks/CttP. ✅ Columns confirmed live on `bfe_scorecards`. ✅ The
  Jotform side of capture (per the revised note above) is also done as of Dev-73: three
  new fields added to the shared `SCORECARD_FORM_ID` form — `wallyBallStatus` (QID 33),
  `WallyBallLostHole` (QID 34), `wallyBallStroke` (QID 35), confirmed headless (players
  never see Jotform's hosted form or these labels). 🔧 **Not yet wired into
  `submitScorecard()`/`buildLivePanel()`** — Dev-74 Phase 1, the immediate next work item
  (§8).
- **Output — data/results now, media later:** the results package follows the Event
  Sites pattern (the Garrett's Last Swing precedent) rather than BFSeries'
  `results.html`/`standings.html`, and publishes per round (each round closes
  independently, finalizing CttP/Skins immediately and rolling into the Overall chain),
  with the full cumulative Overall/podium held as the "Big Reveal" until after the last
  round closes. Explicit scope boundary: **this phase is the data/standings package
  only** — round-by-round leaderboards, quota progression, CttP/Skins winners, 2Man
  results (clearly separated), Wally Ball tracker. Photos, chapters, and narrative
  curation (GS's Photo Organizer, kept alive specifically for this) are deliberately
  deferred to their own later phase, not bundled into this build. 📋 Not started — Dev-74
  Phase 3 (§8), can start minimal and polish through Rd3.
- **Skins** — confirmed by Brian, Dev-73: computed independently of quota (per-hole max
  points winner, ties = no skin), applies in **every** WC round including 2Man, and feeds
  only into payout — not a factor in the quota/performance calc. Not in the original
  draft of this spec; documented here for the first time. 📋 Not yet ported (§8 Phase 2).
- **Data isolation:** new, small D1 tables, all prefixed `bfe_` (BF Experiences) rather
  than `wc_` — deliberately, since these are meant to serve BFCup/Turkey 2Man/BlackFriday
  too, not just Wally Cup. Confirmed Dev-73, direct D1 audit — as-built vs. planned:
  - ✅ `bfe_scorecards`, `bfe_cttp_entries` — live, matches this spec's original naming.
  - ✅ `bfe_event_config`, `bfe_venue_tee_catalog`, `bfe_player_profiles`,
    `bfe_events`, `bfe_event_rounds`, `bfe_event_roster` — live, but **not named or
    anticipated anywhere in the original draft of this spec** (a "Setup/master-data
    layer" designed and built after this document was originally written — see the
    §4a divergence note below for the tee-catalog piece specifically).
  - 📋 `bfe_quota_progress`, `bfe_scramble_pairs`, `bfe_scramble_results` (or whatever
    Dev-74 decides to actually name/shape them) — **do not exist**. Confirmed via direct
    `sqlite_master` listing, Dev-73. This is the entire missing results/computation
    layer — no round-results math, payout calc, or cross-round rollup exists anywhere for
    WC yet. This is the critical remaining build (§8).
  Same PIN-gated CRUD pattern as `gathering_templates`/`venues`, living in a **separate
  Cloudflare Worker** (§4b), not worker.js. Never touches `playerHistory`.
- **Venue tee catalog** (new) — see §4a below.
- **UI architecture** (new) — see §4c below.

**Open items for Brian (corrected, Dev-73):** the original draft claimed none remained.
One does: **the 2Man scramble scoring formula**, flagged above — needed before that
engine or its payout math can be built. Everything else from the original list (CttP's
Jotform dependency, publish rhythm) was resolved, though the Jotform resolution itself
has since been reversed by the time-crunch decision above.

---

## 4a. Venue tee catalog

Two different kinds of fact, kept in two different places rather than one:

- **What tees exist at a venue** — names, colors, slope ratings. A physical property of
  the course, not of any one event.
- **How a given event assigns players to them** — the `teePolicy` (`same` or
  `by_hcp_tier`, and which HCP thresholds) an event's Setup step builds, picking from
  that venue's catalog. This can differ event to event even at the same course — Wally
  Cup might run 2 tiers at Skytop this year, a future event might run 3.

**⚠️ Divergence from the original plan:** this spec originally called for tee data to
live as an extension of the existing Gatherings `venues` table (`teeBoxes: [{ name,
slope, color? }]`, added via the shared `PATCH /venues/:id` route) — reasoning being it's
genuinely shared reference data. What's actually live in D1 as of Dev-73 is a dedicated
`bfe_venue_tee_catalog` table on the new Worker instead, consistent with the `bfe_`-
prefix isolation principle established elsewhere in §4/§4b. This session didn't do a
deep read of that table's actual columns or of the venue-tee-catalog route's logic —
only confirmed its existence and that `BFE-Admin.html` successfully reads venues through
it. **Whoever picks up Dev-74 should verify the mechanics below (first-exotic-venue
default behavior, freeze-at-setup-completion) actually match what was built**, rather
than assuming the original design intent was carried through unchanged just because the
underlying goal (one saved catalog per venue, defaults forward) is presumably still the
same.

**The first-exotic-venue case:** the first Host who runs an experience somewhere new has
to enter that venue's tee catalog from scratch — real, unavoidable work, but it's a
one-time cost per venue, not per event. Once saved, it becomes the **default** the next
time *any* event (Wally Cup returning, BFCup, Turkey 2Man, a different Host entirely) is
set up at that venue — Setup pre-fills from the stored catalog instead of asking for
slope numbers again.

**It's a default, not a frozen source of truth** — if a Host adjusts anything during
their event's setup (a corrected slope, a renamed tee, an added or dropped tier), that
overwrites the venue's stored catalog and becomes the new default going forward. This
mirrors a pattern already shipped in this codebase (Dev-66's "last-known-tee-box-per-
venue" lookup on `/scorecards`) — same idea, one level up: last-known-good, not
versioned history.

**One consequence worth designing in, not discovering later:** because the catalog can
drift, an event's *actual resolved* `teePolicy` (the tiers and slopes genuinely used)
needs to be frozen onto that event's own record at Setup-completion time — not
re-derived live from the venue's current catalog. Otherwise a later correction to
Skytop's slope numbers would silently recompute a past Wally Cup's quotas after the fact.
Same principle already established elsewhere in this codebase (GS's `payoutSnapshot`,
frozen at save-time specifically so a future formula change can't rewrite historical
payouts) — applied here to tee/slope data instead of payout math.

---

## 4b. Separate Worker, not additive routes in worker.js

Originally considered as additive routes in the existing worker.js (same pattern as
`venues`/`gathering_templates`), then reconsidered given how much this system will
redeploy over the season — Wally Cup now, then BFCup/Turkey 2Man/BlackFriday behind it —
against worker.js's actual deploy mechanics: a single script, no partial deploy, a
manual paste-into-Cloudflare-and-Save-and-Deploy step where any mistake anywhere takes
every route down at once, including the ones BFSeries' Live Panel depends on weekly.
Same risk profile that already justified freezing GS for the rest of 2026 (§3), applied
here to worker.js too.

**Resolution:** a separate Worker (`bf_experiences_worker.js`, deployed as
`bf-experiences`) owns every new-system route (`/scorecards`, `/cttp`, all `bfe_*`
tables and the setup/master-data routes) — its own script, its own deploy, zero shared
blast radius with the file BFSeries depends on. It binds the **same D1 database** as the
main worker (a second binding) — no reason to split the data, only the deploy artifact;
the main worker's own `venues` table is still available to read directly for genuinely
shared reference data. No GitHub-Pages-push route needed on this Worker — that stays on
the main worker's existing `/deploy` mechanism, reused as-is for pushing any new static
files (`BFE-Admin.html`) since it's already generic by path, not BFSeries-specific logic.

✅ **Confirmed exactly as designed, Dev-73** — direct read of `bf_experiences_worker.js`
(41.8K, supplied by Brian from the live Cloudflare dashboard copy, since this file had
never been tracked anywhere before) confirms all of the above: full CREATE TABLE
migration history for all 8 live `bfe_*` tables, CORS handling, PIN-or-owner auth on
deletes, and the routes described here. No TODOs or stubs found in it.

**Consequence for the deploy-safety calendar (§6):** the safe-window discipline applies
specifically to **portal.html** — still a shared, single-deploy file. The new Worker can
deploy at any time, as often as needed, with zero risk to BFSeries.

---

## 4c. UI architecture — three surfaces, one shared shell

**Portal.html — stays the shared shell, barely touched.** New-system events already
render as ordinary event cards today (format rendering is already generic). The Live
Panel isn't rebuilt either — it's the *same* Scorecard/CttP/Skins Live Panel Series
already uses, currently gated shut for `format-wally`; flipping `hasLivePanelSupport()`
opens it, unchanged, with one addition (the Wally Ball step folded into the existing
Scorecard sheet — 🔧 not yet wired, Dev-74 Phase 1). Card tools (Photos, Notes, Rules,
Yardage, RSVP) stay exactly as reachable during a live round as they already are for
Series (Dev-68's established behavior — Live Panel and card coexist, not one replacing
the other).

**⚠️ Revised, Dev-73 — supersedes the data-flow description below.** The original plan
was that submitting a round's scorecard would fire to the *new* Worker instead of the
main one for new-system events. Per the Jotform-stays decision in §4, that's deferred:
for Rd1 (and likely all of Wally Cup 2026), the Live Panel keeps submitting to Jotform
exactly as it does for BFSeries — same `submitScorecard()`/`submitCttp()` functions, same
headless direct-POST-to-Jotform's-API mechanism, just with the three new Wally Ball QIDs
included. The new Worker's D1 tables get populated by a separate read/sync step (§4,
§8), not by a different submit target in the Live Panel itself. The original plan is
still the eventual direction — full Jotform sunset — just not landing in time for 9/11.

**BFE Host Admin Panel** — a **separate page from portal.html**, same reasoning as the
separate Worker: Setup and round-close UI will iterate constantly while this gets built,
and portal.html is the file every player depends on for RSVP and live scoring every
week — that churn shouldn't land in the same deploy artifact. Host-only. Talks
exclusively to the new Worker. ✅ Built and live as `BFE-Admin.html` (renamed from
"Operator Console" in the original draft — the more honest name, since it needs to serve
BFCup/Turkey 2Man/BlackFriday too, not just Wally Cup). Confirmed Dev-73: successfully
loads venues, event names, and players. 📋 The "close this round" action (reads raw data
out of D1, runs the ported engine, writes quota/points/payout results back) is not yet
built — Dev-74/75 Phase 2 (§8).

**Player-facing results** — a new read-only icon on new-system event cards, alongside
Photos/Rules/Yardage — card tool access is unaffected either way. Pulls from the new
Worker's data, rendered with the generic Player View component: base + modifiers + total
+ quota + rank. Players never leave portal.html to follow the tournament. 📋 Not started
— depends on the results/computation layer existing first (§8 Phase 2/3).

Flow, end to end, **as currently planned for 9/11** (revised from the original): 
**portal.html** (shell + Live Panel, minimally touched) → **Jotform** (still the live
collector, headless, now including the 3 Wally Ball fields) → **new Worker** (reads
Jotform submissions into `bfe_*` data, runs the engine server-side once built) →
**BFE Host Admin Panel** (Setup + round-close, Host-only) → back into **portal.html** as
a read-only results icon for players.

---

## 5. Season roadmap (light — not fully designed yet)

| Event | Date | Format | Target engine | Notes |
|---|---|---|---|---|
| BirdieFriends Cup | 11/7–8 | 2 teams of 8 (16 players), Sat: 9 holes foursomes + 9 holes fourball, Sun: individual singles match play. Teams built by Brian for competitive balance; captains set matchups. Vanilla Ryder Cup format, no added wrinkles. | `match_play` — needs 3 scoring modes (singles / alternate-shot pair / best-ball pair) sharing one 1pt-win/0.5pt-tie mechanic, already precedented in GLS's `match_play_cart_group`. Multi-session-per-event structure is new — BFCup needs several sessions rolling into one team total, which WC's config (one round → one engine) doesn't need to support. | Team-assignment tooling is new setup-flow scope, not just roster entry. |
| Turkey 2Man | 11/15 | 10+ two-player teams | `scramble_pair` — direct reuse of the module built for WC's 2Man | Confirms the module generalizes past a single instance. Depends on WC's 2Man scramble formula being defined first (§4 open item). |
| BlackFriday 1Man | 11/27 | Individual, each player hits 2 balls per shot, plays the better result (solo scramble-style) | `points_by_score_type` — flat point table off the self-reported `marks` field already captured by the existing generic Scorecard, no HCP/quota | The "2-ball" mechanic is invisible to scoring — it only affects how the player generates their number on the course, not what the engine does with it. |

Engine work for these three happens when each event's build window arrives, extracting
genuinely shared pieces from what WC and BFCup reveal rather than guessing the full
catalog now. No changes to this section as of Dev-73 — unstarted, unchanged from the
original draft.

---

## 6. Deploy-safety calendar

All 2026 dates in one place. Since the new Worker (§4b) carries zero BFSeries risk, this
discipline applies specifically to **portal.html** — still a shared single-deploy file:

- **Now → 9/9:** WC build & test window. No live event anywhere nearby — safest window
  of the season for shared-file changes (the `hasLivePanelSupport` flip, the Wally Ball
  Live Panel step).
- **9/10–13:** Wally Cup live — first real stress test of the new system.
- **9/14–26:** ~2-week soak period before the first remaining BFSeries event (9/27) —
  time to fix anything WC surfaced with zero time pressure.
- **9/27, 10/11, 10/25:** BFSeries events — standing rule, no portal.html deploys in the
  48–72 hours before any of these, for the rest of the season, regardless of which
  project the change belongs to. The new Worker is exempt from this rule entirely.
- **11/7–8, 11/15, 11/27:** BFCup / Turkey 2Man / BlackFriday live windows — same
  discipline applies in reverse (don't let one new event's rushed deploy collide with
  another's weekend).

No changes as of Dev-73 — still the governing calendar, unchanged from the original
draft.

---

## 7. 2027 direction (brief, not designed yet)

Once BFSeries' 2026 season closes and the new engine has run four real events, BFSeries
becomes another metadata record in the same registry — `computeStablefordQuota` already
exists (once ported, §8) and would already be proven at that point, having been
exercised live at Wally Cup. This is the "one sharable architecture before the 2027
season" goal — deliberately not designed further here; revisit once the 2026 evidence is
in. No changes as of Dev-73.

---

## 8. Current build status & phased plan (added Dev-73)

This section is the living answer to "what's left" — update it each session rather than
re-deriving status from scratch. See `BF_Session_Log.md`'s Dev-73 entry for the full
reasoning behind this plan.

- **Phase 0 — Jotform (✅ done, Dev-73):** 3 new Wally Ball fields added to the shared
  `SCORECARD_FORM_ID` (250963587514163) form: `wallyBallStatus` (QID 33),
  `WallyBallLostHole` (QID 34), `wallyBallStroke` (QID 35).
- **Phase 1 — Live Panel wiring (hard deadline 9/11):**
  1. Add `WB_QID = {status:'33', hole:'34', stroke:'35'}` to `submitScorecard()` in
     `portal.html` and include those params in its POST body.
  2. Add the Wally Ball input step (Y/N, conditional Hole#/Stroke# when "No") to
     `buildLivePanel()`'s Post-Round Scorecard section.
  3. Flip `hasLivePanelSupport()` to `true` for Wally Cup / 2Man formats.
  4. End-to-end test against the real Jotform form with a disposable test event.
- **Phase 2 — results/computation layer (soft deadline, days after 9/11):**
  1. Design and create the D1 results tables (`bfe_quota_progress`,
     `bfe_scramble_pairs`, `bfe_scramble_results`, or revised names/shapes as needed).
  2. Port `adjustQuota`/`applyQuotaCap` (§3) and the skins-per-hole-winner loop (§4) from
     `BF_Golf_Scorer_8.html`.
  3. Build the Jotform-read bridge into `bfe_scorecards`/`bfe_cttp_entries` (reusing the
     `jfGetAnswerByPriority` pattern already used for the registration roster).
  4. Get Brian's definition of the 2Man scramble scoring formula (❓ open, §4) — blocks
     the rest of this phase for the 2Man format specifically.
  5. Build the "Close Round" action in `BFE-Admin.html`: payout calc, Wally Ball pot
     resolution, Overall rollup across exactly 3 rounds. Note: GS's own
     `calcSeriesPerformance()` is a best-4-of-N model and does **not** fit WC's fixed
     3-round Overall — confirmed by direct read, Dev-73. A new calc is needed; there is
     no existing precedent for this in the codebase.
- **Phase 3 — publishing (can start minimal, polish through Rd3):** per-round GLS-style
  results page generator, plus a living Overall page (podium held back until Rd3
  closes), published via GS's proven `deployPagesToGitHub()`/`POST /deploy` mechanism to
  `docs/`. Matches §4's "data/results now, media later" scope boundary — no photo/
  narrative curation in this phase.
