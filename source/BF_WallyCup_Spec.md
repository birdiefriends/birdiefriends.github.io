# BF Experiences (BFE) / Wally Cup — Competitive Events Architecture Spec

**Status as of Dev-76 (2026-09-03, closed).** Committed to the repo for the first time in
Dev-73 — it existed only as a local file (`WC_spec.txt`, from Dev-71) before that. Rd1
tees off 10am, 9/11/2026. Dev-74 believed the full scoring engine (quota, skins, CTP,
Wally Ball, Overall) was built and end-to-end validated; Dev-75 actually dry-ran the real
event through it and found that claim was premature — podium-tie payouts and unclaimed-
CTP-hole money were both silently broken, never exercised by Dev-74's synthetic test
data. Both are fixed, plus withdraw-a-player support, a Save/Generate ordering bug fix,
and a Close Round roster-vs-scorecard mismatch alert. **Dev-76 built §8 Phase 3** — the
player-facing results page — end to end against the real (test/dry-run) D1 data, added
CTP hole-winner persistence (`bfe_round_cttp`), then across four addenda: fixed the
mobile table layout, matched the portal.html results entry point to the site's existing
plain-link convention (superseding the modal it originally shipped with), confirmed CTP
live against real re-closed data, and — after Brian caught it days later — root-caused
and fixed a Wally Ball season-history regression that a later re-close had silently
introduced, fixed a vs-par plumbing bug (never actually worked since first built),
and shipped a 3-iteration mobile-readability redesign of the leaderboard rows plus a
longest-held-first Wally Ball section sort. **Phase 3 is now genuinely complete** — see
§8 for the corrected phase status. Next up per Brian's own ordering: 2Man scramble
(§4/§8, still ❓ open), then the Photos/memories phase. For the full narrative reasoning
behind any decision below, see the Dev-71 through Dev-76 entries (including all four
Dev-76 addenda) in `BF_Session_Log.md`; this doc is the standing architecture reference,
not a replacement for that history.

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
  individual round in the chain — confirmed, no rename needed). ✅ **Built and fully
  validated, Dev-74** — quota math ported from GS (§3), plus `adjustQuota` (half-
  performance adjustment) and the ±25% `QUOTA_CAP_PCT` cap. Verified end-to-end this
  session with a complete, hand-checked Rd1→Rd2→Rd3 test cycle on realistic data (see
  Dev-74 entry in `BF_Session_Log.md`) — chain integrity (each round's New quota exactly
  matches the next round's Quota in) confirmed across all 16 players, both hops. The
  ±25% cap itself was never actually triggered by that test data, though — still an
  untested edge case, not a confirmed-working one.
- **Influencer:** `wally_ball`, `points: 1` on Rd1, `1` on Rd2, `2` on Rd3 — folds
  visibly into that round's total, flows into the Overall podium. ✅ **Built and
  validated, Dev-74**, including a fix along the way: the round-level bonus was
  initially (incorrectly) withheld from a player already eliminated from the season-long
  Wally Ball pot; confirmed by Brian this is wrong — the round bonus must be fully
  independent of season-pool elimination — and fixed. Also added this session:
  `BFE-Admin.html`'s Overall standings now breaks out each player's *cumulative* Wally
  Ball bonus (across all closed rounds) as its own column, separate from quota-based
  "Total +/-", since the two numbers can otherwise read as contradictory to a player.
- **2Man** is its own scoring module — `scramble_pair` engine, no influencers, explicitly
  excluded from Overall (a team result can't fairly redistribute individual credit, so no
  dormant weighting knob either). Building this now doubles as the prototype for Turkey
  2Man in November. ❓ **Still open — scramble scoring formula undefined — but
  de-prioritized, Dev-74.** Brian confirmed end of Dev-74 that the 2Man scramble is a
  **standalone event with no bearing on the Wally Cup outcome** and will be tackled on
  its own timeline. This item no longer blocks any Wally Cup Rd1–3 work (the validated
  chain above is confirmed as the real WC's actual individual-scoring structure) — it's
  needed only before that separate scramble event is actually run.
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
  Panel. ⚠️ **Diverged from this plan, Dev-74 — no sync step was built, and none is
  needed.** `BFE-Admin.html`'s "Close Round" action reads scorecards directly from the
  live Jotform API (`SCORECARD_FORM_ID`, same form/QIDs as the Live Panel) at close time,
  computes results client-side, and writes straight to the new `bfe_round_results`/
  `bfe_round_skins` tables (§8) — it never reads or writes `bfe_scorecards` at all.
  `bfe_scorecards` (and its `/bfe/scorecards` route on the new Worker) exists and is used
  only by `BFE-Admin.html`'s **test**-scorecard generator, as a stand-in data source for
  local testing — not by the real Close Round flow. If a future session wants an actual
  synced copy of live Jotform data in `bfe_scorecards` for some other reason, that's still
  unbuilt; for Close Round's own purposes it turned out not to be needed.
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
  never see Jotform's hosted form or these labels). ✅ **Wired into
  `submitScorecard()`/`buildLivePanel()` and confirmed live, Dev-74** — see the Dev-74
  entry in `BF_Session_Log.md` for the byte-identical-against-GitHub verification.
- **Output — data/results now, media later:** the results package follows the Event
  Sites pattern (the Garrett's Last Swing precedent) rather than BFSeries'
  `results.html`/`standings.html`, and publishes per round (each round closes
  independently, finalizing CttP/Skins immediately and rolling into the Overall chain),
  with the full cumulative Overall/podium held as the "Big Reveal" until after the last
  round closes. Explicit scope boundary: **this phase is the data/standings package
  only** — round-by-round leaderboards, quota progression, CttP/Skins winners, 2Man
  results (clearly separated), Wally Ball tracker. Photos, chapters, and narrative
  curation (GS's Photo Organizer, kept alive specifically for this) are deliberately
  deferred to their own later phase, not bundled into this build. 📋 **Still not
  started — Dev-76's next priority**, now that Phase 2 (below) is genuinely (not just
  believed) fully built and validated, per Dev-75. Whatever gets built here must carry
  forward the two player-facing clarity
  fixes from Dev-74's admin-side results tables: the Rank(Score+WB)-vs-+/-(vs.-quota)
  distinction, and the cumulative Wally Ball bonus breakout — both exist specifically
  because the raw numbers read as contradictory otherwise, and that's just as true in
  public as it is in the admin tool.
- **Skins** — confirmed by Brian, Dev-73: computed independently of quota (per-hole max
  points winner, ties = no skin), applies in **every** WC round including 2Man, and feeds
  only into payout — not a factor in the quota/performance calc. ✅ **Ported and
  validated, Dev-74** — `computeSkins()` in `BFE-Admin.html`, confirmed against multiple
  full test rounds including a player winning more than one skin in the same round.
- **Data isolation:** new, small D1 tables, all prefixed `bfe_` (BF Experiences) rather
  than `wc_` — deliberately, since these are meant to serve BFCup/Turkey 2Man/BlackFriday
  too, not just Wally Cup. Confirmed Dev-73, direct D1 audit — as-built vs. planned:
  - ✅ `bfe_scorecards`, `bfe_cttp_entries` — live, matches this spec's original naming.
  - ✅ `bfe_event_config`, `bfe_venue_tee_catalog`, `bfe_player_profiles`,
    `bfe_events`, `bfe_event_rounds`, `bfe_event_roster` — live, but **not named or
    anticipated anywhere in the original draft of this spec** (a "Setup/master-data
    layer" designed and built after this document was originally written — see the
    §4a divergence note below for the tee-catalog piece specifically). **Dev-75:**
    `bfe_event_roster` gained `withdrawn INTEGER DEFAULT 0` / `withdrawn_note TEXT` —
    lets a Host mark a player who can't finish all 3 rounds, excluding them from Overall
    standings/podium *and* the Wally Ball pot (both season-long roll-ups) without
    touching their own already-closed round results/payouts. Migration run and
    `bf_experiences_worker.js` redeployed by Brian, confirmed live.
  - ✅ `bfe_round_results`, `bfe_round_skins` — **built and live, Dev-74**, superseding
    the `bfe_quota_progress` name this spec originally guessed at. Holds one row per
    player per closed round (`quota_in`/`actual_points`/`performance`/`quota_out`/
    `wb_status`/`wb_hole`/`wb_stroke`/`rank`/payout columns) and one row per skins winner,
    keyed on `event_id`+`round_name`; the POST route does a full delete-then-insert per
    key, so re-closing a round is safe. This is the results/computation layer the
    original spec called for — round-results math, payout calc, and cross-round rollup
    (quota chaining, Overall standings, the Wally Ball pot) are all built on top of these
    two tables now. **Correction, Dev-75:** Dev-74 called this "confirmed via a full
    Rd1→Rd2→Rd3 test cycle," but that cycle never exercised a podium tie or an unclaimed
    CTP hole — both were silently broken until Dev-75's actual dry-run found and fixed
    them (podium-tie splitting ported from `BF_Golf_Scorer_8.html` and applied to both
    round-level *and* Overall podiums; unclaimed/unrecognized CTP money now rolls into
    skins at settlement time, computed from actual paid amounts rather than the
    pre-round pool estimate). Payout calc is now genuinely, not just believed,
    end-to-end correct.
  - 📋 `bfe_scramble_pairs`, `bfe_scramble_results` (or whatever names/shapes the eventual
    2Man build actually needs) — still **do not exist**. No longer urgent — see the 2Man
    de-prioritization note above (§4) — but still the entire missing piece for that
    format when its build window arrives.
    WC yet. This is the critical remaining build (§8).
  Same PIN-gated CRUD pattern as `gathering_templates`/`venues`, living in a **separate
  Cloudflare Worker** (§4b), not worker.js. Never touches `playerHistory`.
- **Venue tee catalog** (new) — see §4a below.
- **UI architecture** (new) — see §4c below.

**Open items for Brian (updated Dev-74):** **the 2Man scramble scoring formula**,
flagged above, is still undefined — but Brian confirmed end of Dev-74 that 2Man is a
standalone event separate from the Wally Cup outcome, so this no longer blocks anything
against the 9/11 deadline; revisit when that event's own build window arrives. Everything
else from the original list (CttP's Jotform dependency, publish rhythm) was resolved back
in Dev-73.

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

## 8. Current build status & phased plan (added Dev-73, updated Dev-74, corrected Dev-75,
updated through Dev-76 addendum 4)

This section is the living answer to "what's left" — update it each session rather than
re-deriving status from scratch. See `BF_Session_Log.md`'s Dev-73 through Dev-76 (all
addenda) entries for the full reasoning behind this plan.

- **Phase 0 — Jotform (✅ done, Dev-73):** 3 new Wally Ball fields added to the shared
  `SCORECARD_FORM_ID` (250963587514163) form: `wallyBallStatus` (QID 33),
  `WallyBallLostHole` (QID 34), `wallyBallStroke` (QID 35).
- **Phase 1 — Live Panel wiring (hard deadline 9/11): ✅ done and confirmed live, Dev-74.**
  1. ✅ `WB_QID = {status:'33', hole:'34', stroke:'35'}` added to `submitScorecard()` in
     `portal.html`, included in its POST body.
  2. ✅ Wally Ball input step (Y/N, conditional Hole#/Stroke# when "No") added to
     `buildLivePanel()`'s Post-Round Scorecard section.
  3. ✅ `hasLivePanelSupport()` flipped to `true` for `format-wally`/`format-scramble`
     (still-open side effect: this also covers any non-WC event using a scramble format —
     see §4).
  4. ✅ Verified live: `docs/portal.html` on GitHub confirmed byte-identical to the final
     local copy, `portal_version.txt` at `v4.0.0 · 2026-08-31`. (End-to-end test against a
     disposable Jotform test event happened implicitly via the Phase 2 test cycle below,
     which exercises the same Live-Panel-shaped scorecard data through Close Round.)
- **Phase 2 — results/computation layer (soft deadline, days after 9/11): ✅ built and
  genuinely validated end-to-end, Dev-75** (Dev-74's "fully validated" claim was
  premature — see the correction below).
  1. ✅ D1 results tables built as `bfe_round_results`/`bfe_round_skins` (not
     `bfe_quota_progress` — see §4's Data isolation bullet for the as-built shape).
     **Dev-75:** `bfe_event_roster` also gained `withdrawn`/`withdrawn_note` columns —
     see §4's Data isolation bullet.
  2. ✅ `adjustQuota`/`applyQuotaCap` (§3) and the skins-per-hole-winner loop (§4) ported
     into `BFE-Admin.html`.
  3. ⚠️ Turned out not to be needed — see §4's Scorecard/CttP capture divergence note:
     Close Round reads Jotform live at close time instead of via a synced
     `bfe_scorecards` copy.
  4. 2Man scramble scoring formula (❓ open, §4) — **de-prioritized, Dev-74**, no longer
     blocking this phase; 2Man confirmed a standalone event, tackled separately.
  5. ✅ "Close Round" action built in `BFE-Admin.html`: payout calc (podium/skins/CTP),
     Wally Ball round bonus + season pot resolution, Overall rollup across exactly 3
     rounds — a new calc, as anticipated (GS's `calcSeriesPerformance()` doesn't fit).
     Dev-74 validated this via a hand-verified Rd1→Rd2→Rd3 test cycle on realistic data
     and called it complete. **Correction, Dev-75:** that test data never produced a
     podium tie or an unclaimed CTP hole, so both were silently broken — podium-tie
     payouts weren't split (naive positional indexing, both at the round level and in
     Overall Standings), and an unclaimed/unrecognized-name CTP hole's money simply
     evaporated instead of rolling into skins. Both ported from `BF_Golf_Scorer_8.html`
     and fixed, Dev-75. Also shipped Dev-75, closing gaps flagged in earlier "what
     haven't we tested" reviews: a Scorecard Check admin tool (roster-vs-Jotform
     coverage, ported from `portal.html`), a Close Round roster-vs-scorecard mismatch
     alert with one-click withdraw, withdraw-a-player support (excludes a player from
     Overall/Wally-Ball-pot without touching their own closed-round results), and a
     Save/Generate ordering bug fix. Full detail and reasoning in the Dev-75 entry,
     `BF_Session_Log.md`.
- **Phase 3 — publishing: ✅ built, tested, and hardened end-to-end — genuinely complete,
  Dev-76 + addenda 1-4.** One living static
  page (not per-round separate pages — the design reference's own single-page,
  numbered-section structure turned out to be the right shape: a round rail, one
  section per round, Overall held back until every `rollsIntoOverall` round closes,
  then Wally Ball / 2Man-placeholder / Photos-placeholder sections), generated inside
  `BFE-Admin.html` (new §10, "Publish results page") and pushed via the existing main-
  Worker `POST /deploy` mechanism to `docs/wally-cup-results.html` — matches this
  bullet's original plan, just as one page rather than several. Reads back
  already-computed, already-persisted numbers from `/bfe/events` (roster/rounds/
  payout) and `/bfe/round-results` (results/skins/cttp) rather than re-deriving
  scoring/tie-split logic — the only things actually computed fresh are vs-par (from
  `/scorecards` hole arrays + the main Worker's `/venues` pars) and the season-long
  Wally Ball pot resolution (including the same-round-elimination "held it longest"
  tiebreak), neither of which Phase 2 persists anywhere. Carries forward the Dev-74
  clarity fixes from the start (Rank/Podium $ is Score+WB vs. quota; the results page's
  Overall Standings are deliberately WB-inclusive too — see the Dev-76 entry in
  `BF_Session_Log.md` for why that's a considered choice, not a mismatch with
  `BFE-Admin.html`'s own quota-only "Total +/-"). **Needed one small Phase 2 addition**:
  `bfe_round_cttp` (CTP hole-winner detail — hole/player/dist/payout), since Close
  Round computed it in memory but never persisted it, only the per-player payout total.
  **✅ Live and confirmed correct (Dev-76 addendum 3).** The table and Worker deploy were
  both fine from the start; the earlier "CTP not showing" report traced to Rd1-3 having
  originally closed before this feature existed, so no historical rows had ever been
  written for them. Re-closing them (safe/idempotent — delete-then-insert per
  event+round, same lifecycle as `bfe_round_skins`) backfilled the table correctly;
  Brian confirmed CTP data displays correctly after republishing.
  Also added: a read-only "🏆 Results" entry point for `format-wally`/`format-scramble`
  events in `portal.html` — the persistent Results-tab card plus a per-event-card icon,
  both plain `<a href="/wally-cup-results.html">` links (no modal, no iframe), matching
  the exact convention every other `results-link-card` already uses (**Dev-76 addendum
  2** — supersedes the iframe-modal approach the feature originally shipped with in the
  main Dev-76 entry; default to plain navigation links for any future "view a published
  page" affordance, including 2Man/Photos, unless Brian says otherwise).
  `source/WallyCup_Results_Design_Reference.dc.html` (Dev-75) supplied the visual
  language (CSS lifted verbatim) and confirmed-correct ground-truth numbers, which the
  real generator's output was checked against exactly (champion, Overall order, the
  Wally Ball tiebreak) before shipping — it was never itself wired up, per its own
  header note.
- **Dev-76 addendum 4 (2026-09-03) — a real regression, found and fixed, not just
  polish:** re-closing Rd1→Rd2→Rd3 to backfill CTP (addendum 3) silently broke the
  Wally Ball season pot — the `alreadyOut` check in both the Close Round handler and the
  test-scorecard generator excluded only "any other round with this name," not rounds
  chronologically *after* the one being closed, so a Rd1 re-close performed after Rd2/Rd3
  already had results read those later losses backward as "already out before Rd1 even
  started." Fixed to use each round's real index in `assembledConfig.rounds`/
  `roundsList`; Brian re-closed Rd1→Rd2→Rd3 against the fix and confirmed the season
  tracker (Lou Strohl's pot win via tiebreak, everyone else's correct loss hole) came
  back correctly. Same addendum also fixed a separate, longer-standing bug — vs-par had
  silently never worked since first built, because `fetchResultsPageData()` checked
  `Array.isArray()` on the whole `GET /scorecards` response object (`{ok, scorecards:
  [...]}`) instead of its `.scorecards` field, so `scorecardsByRound` was unconditionally
  empty; `computeVsPar` itself was correct the whole time — and shipped a 3-iteration
  mobile-readability redesign of the per-round leaderboard rows (name on its own line,
  a real 2×2 grid below it for quota/perf/WB/payout, the perf-calc popover made
  absolutely-positioned so it no longer reflows the grid) plus a longest-held-first sort
  for the Wally Ball section. Full root-cause writeups and code detail: the Dev-76
  addendum 4 entry in `BF_Session_Log.md`.
- **Before real Rd1 (10am 9/11):** the "2026 Wally Cup" event in D1 currently holds
  Dev-74/75's test data (real roster, generated test scorecards) — needs a clean Data &
  Reset → Delete and fresh Setup with the real roster/tee assignments before the real
  event, so real Rd1 doesn't chain off test quota_out values. **Still not done** — every
  session through Dev-76 addendum 4 has used this test data for verification rather than
  doing the cleanup; it remains the one prerequisite before the real event.
