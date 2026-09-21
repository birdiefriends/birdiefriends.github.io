# BF_BFE_NextGen_Spec.md — BFE Next-Gen Architecture: Venue Data, Game Engine, Handicap, Live Scoring

**Status:** Living spec, second revision (Dev-85). This is a design-notes doc, not a build
plan — nothing here is scheduled or committed, and several open questions are marked
explicitly rather than resolved. §6 adds a proposed build sequence (small iterative slices
against this doc as the roadmap, never a big-bang rewrite of a live production system) —
also proposed, not committed. It exists so the architectural thinking from a Dev-85
discussion survives into future sessions instead of needing to be re-derived. Read this
before scoping any of: a Venue/Tee Catalog rework, a new game engine beyond
`stableford_quota`/`scramble_pair`, a handicap/stroke-allocation feature, a live/offline
scoring redesign, or before deciding what order to tackle any of it in.

The trigger for this doc: Brian signed up for a free GolfCourseAPI
(`golfcourseapi.com`) account and we validated it live via the browser bridge against
five real venues (Honesdale GC, Paupack Hills Country Club, Skytop Lodge, Blue Shamrock
GC all matched cleanly with full tee data including per-hole par/yardage/handicap and
lat/long; Buck Hill Golf Club returned zero search results — a real coverage gap, not a
key/auth problem). Free tier is 35 requests/day, no card on file. `api.golfcourseapi.com`
is not on this cloud workspace's network allowlist (confirmed — `curl`/`Bash` gets a
proxy-level connect-rejected, same as `bf-experiences.workers.dev`), so any direct testing
from a Claude session has to go through the browser bridge (`Claude_Browser__javascript_tool`
running `fetch()` with the key in the `Authorization: Bearer` header), the same workaround
already established for the BFE Worker. Writes (`POST`/`PATCH /v1/courses`) require a
paid GolfCourseAPI tier and aren't part of this plan — this is a read-only data source.

**Key handling:** the API key Brian obtained must never be hardcoded client-side the way
`JOTFORM_API_KEY` currently is in `portal.html` (an already-flagged backlog gap — see
`BF_Session_Bootstrap.md` §5). The intended shape, once this is actually built, is a
Worker secret on `bf-experiences` (`wrangler secret put`) behind a new proxy route (e.g.
`GET /bfe/coursedata/search`), matching the fix already applied to Jotform calls in
Dev-83b. BFE-Admin/portal would call that proxy route, never GolfCourseAPI directly, so
the key never reaches a browser or a public file.

---

## 1. Venue/course data: GC-API-first, D1 as cache + fallback

**Current state:** `bfe_venue_tee_catalog` (D1) is the sole source of truth today, shared
by BFE-Admin's Tee Policy editor and portal.html's Venue Manager. Every field — course
rating, slope, yardage, par, per-hole par/yardage/handicap — is typed in by hand per venue.

**Proposed direction:** flip the priority. A venue lookup becomes: check D1 first for a
cached/overridden record → if absent, call GC-API (via the Worker proxy above) and cache
the result into D1 → if GC-API also has nothing (Buck Hill's case), fall back to the
existing manual-entry form. D1 stops being "the data" and becomes "the cache, the
override, and the fallback."

**Why the cache layer matters, not just a one-time import:** GC-API's own tee naming can
need a human's judgment before it's trustworthy for BF's purposes. Blue Shamrock's data
confirmed this isn't messiness to fix — "Green/Gold" is GS's existing "Combo tee" concept,
correctly reflected in the API — but the general principle stands: once a commissioner
corrects or confirms a venue's tee data in D1, that correction must never be silently
clobbered by a later re-fetch. This is the same non-destructive-override pattern already
proven out in GS for handicaps (`isDiffHcp`/`hcpOverridden` flags protecting a manual
correction from being overwritten by the next auto-refresh) — worth reusing the pattern,
not reinventing it.

**Also unlocked for free:** `location.latitude`/`longitude` came back on every successful
search/get-by-id call (added to the API in v1.1.0, 2026-09-13). This replaces the manual
geocoding Brian has been doing per new venue (Buck Hill was geocoded by hand in Dev-84) —
worth wiring in even independent of the tee-data work, since it's a much smaller lift.

**Open/unverified:**
- Buck Hill's absence from GC-API's dataset means the manual-entry fallback path is not
  optional — it's a real, expected branch, not a rare edge case. Worth trying a name
  variant search (e.g. "Buck Hill Falls Golf Club") before concluding it's simply absent.
- Whether GC-API coverage holds up for whatever other venues get added later hasn't been
  tested beyond these five.

---

## 2. Game engine: three orthogonal axes instead of one flat `engine` enum

**Current state:** `bfe_events` rounds carry a single `engine` field
(`none` / `stableford_quota` / `scramble_pair`). This conflates three genuinely separate
concerns into one value, and the whole model (chaining via `chainsFrom`, Wally Ball,
Overall Standings) grew specifically around Wally Cup's and BF Series's known flows.

**The technical spine: one composable Round Configuration object.** Whatever organizes
the *code*, the underlying data model needs a single object — base game + add-on modules
+ timeframe/chaining + venue reference + handicap/allowance config + connectivity mode —
that every consumer (payout calc, results recorder, groupings, Live Panel, BFE-A UI)
*reads*, never re-derives. Without this, "payout for any combination" and "results for
any combination" are a combinatorial explosion of special cases scattered across screens,
which is a nicer-looking version of today's ad hoc `engine` checks, not a fix for them.
The Host (the commissioner setting up an event) is the person who *fills in* this config
via BFE-A — a useful lens for sequencing and prioritizing the work (see §6), but not the
shape of the config itself.

**Extensibility mechanism: a registry, not more upfront design.** Brian's explicit
observation (Dev-85): "we'll never get it correctly pre-planned." The answer to that isn't
trying harder to predict every future game — it's making each base game and each add-on
module a self-contained, independently-registered definition (its own scoring function,
its own declared data needs, its own UI fragment). Adding a new format later means adding
one registry entry, not touching payout/results/groupings/UI code in six places.

**Proposed decomposition** (Brian's framing, confirmed as the right shape):

1. **Base game** — the actual scoring math for a round: Stableford Quota (existing),
   Scramble Pair (existing), plus net-new formats: Bingo/Bango/Bongo, Wolf, Nassau.
   Priority ordering among the three new formats is explicitly open — not yet decided.
2. **Add-on modules** — selectable per round regardless of base game: Skins, CTP, Podium,
   BF Ball (the rename of Wally Ball, generalized beyond Wally-Cup-specific framing).
   These are currently entangled with the stableford engine's Close Round logic and need
   to become independent, opt-in modules.
3. **Timeframe/chaining configuration** — generalizing what Wally Cup's `chainsFrom`
   round-sequencing already does (see `BF_WallyCup_Spec.md`), so a multi-round series
   isn't a Wally-Cup-specific concept baked into the code.

**Scope resolved:** GS (`BF_Golf_Scorer_8.html`) is being sunset after this season and
already lacks a handicap calculator, same as BFE-A — so this net-new engine work targets
BFE-A only. No GS/BFE-A convergence question to solve; GS is not a target platform for any
of this.

---

## 3. Handicap / stroke-allocation calculator — the real net-new gap

**Why quota didn't need this:** the existing Stableford Quota engine bakes relief into a
single number (the quota, derived once from series history / GHIN index via BFE-A's
existing GHIN importer) applied against the round's net score. No per-hole stroke
allocation is ever computed.

**Why Wolf/Nassau/BBB do need it:** these formats determine *which specific holes* a
player receives a stroke on, which requires the full chain:

`HCP Index → Course Handicap (via that tee's slope/rating) → Playing Handicap (format's
allowance) → strokes-per-hole (via that tee's own hole-handicap ranking)`

GC-API's per-hole handicap data (confirmed present and tee/gender-specific — Blue
Shamrock's data showed hole handicap rankings genuinely differ between tees and between
genders on the same tee, not a shared table) is what makes the last step possible. This
calculator does not exist anywhere in BF today — not in GS, not in BFE-A.

**Explicit design principle (Brian, Dev-85): design for flexibility, not a fixed personal
formula.** The playing-handicap allowance must be configurable, not hardcoded — same
pattern as Tee Policy already being per-venue-configurable rather than fixed. Open
questions, deliberately unresolved:
- Standard USGA/WHS Course Handicap formula (Index × Slope/113 + (Rating − Par)) is the
  presumed base, but not confirmed.
- Playing-handicap allowance percentage (100% vs. a house variant like 90%/95%, which some
  groups use for certain team formats) needs to be configurable per game/event, not fixed
  platform-wide.
- This is independent of and does not block the add-on modules (Skins/CTP/Podium/BF Ball)
  or the quota engine, which don't need stroke allocation at all.

---

## 4. Scoring representation — per-format input, not a universal raw capture

**Corrected framing (Brian, Dev-85 — this took two passes to land right):** the initial
assumption was that gross strokes-per-hole is (or should be) a universal raw fact
captured during play, with every other representation (Stableford points, quota,
net/gross totals) derived from it. That's wrong. **There is no fixed universal raw
capture today.** What goes into the Jotform Scorecard field is whatever matches that
format's actual on-course mental model — quota points (0–6 scale) for quota events,
because that's how a player is genuinely thinking mid-round ("I need 30, I'm at 25 with 3
holes to go"); gross/net strokes for a standard event, because that player is thinking
"I need a birdie to hit my target." Jotform itself doesn't enforce either convention — it
lives in how the round/format is set up, not in the form.

**Design principle:** each game format declares its own on-course input representation,
matched to how players actually think while playing that format — not forced onto a
common raw unit for its own sake.

**Two genuinely different needs, requiring two different mechanisms — do not conflate
them:**

1. **Within-format comparison (simpler than initially assumed).** Skins is the concrete
   example: it only needs to know, per hole, whether a single player achieved an
   unmatched best score — "did I win this hole outright." That requires no conversion to
   any common representation at all, just a **declared comparison direction per format**:
   in quota points, the *largest* unmatched number on a hole wins; in strokes, the
   *smallest* unmatched number wins. Skins already runs inside quota events in production
   today (Wally Cup's Rd1/Rd2/Rd3), which means Close Round's existing code already
   implements exactly this per-format comparison-direction rule. **Action item: read that
   existing skins-in-quota logic in `BFE-Admin.html`'s Close Round before designing
   anything new here** — it's very likely already the correct, working version of this
   mechanism, not something to redesign from scratch. This belongs in whichever session
   tackles step 4 of §6's sequence (the Stableford-Quota migration).
2. **Cross-format conversion (the deeper, harder case).** Needed when a consumer must
   bridge between formats — combining or publishing results across a quota round and a
   standard-scoring round, or converting a quota-recorded result into traditional
   net/gross terms for display (the existing "quota → standard" translation Brian
   described happening today, narrowly, at the results-display layer). This is the case
   that actually needs a common pivot representation (net-score-relative-to-par is the
   natural candidate, since a quota point value is presumably already a function of
   net-to-par for that hole) and, to go all the way to gross strokes, needs §3's
   handicap/stroke-allocation data — a quota point tells you net-to-par, not gross
   strokes, without knowing how many strokes of relief that hole carried.

**Net effect on the model:** not every consumer needs full value conversion. Skins-style
consumers need only a declared per-format comparison rule and operate natively on
whatever was actually recorded. Cross-format reporting/publishing consumers need the
deeper conversion chain through the handicap calculator. Building the deeper mechanism
first, when most of what's needed (skins, likely other hole-level comparisons) only ever
needed the simpler rule, would be solving a harder problem than most consumers actually
have.

---

## 5. Live scoring vs. connectivity — a real, not hypothetical, risk

**The trigger:** Brian flagged that Buck Hill Golf Club had "all but non-existent" cell
coverage during actual play — no prior real incident is recorded in `BF_Session_Log.md`,
so this hasn't bitten a live event yet, but it easily could have. This is foresight, not a
postmortem.

**This is broader than the new games.** The existing Live Panel (Scorecard/CTP/Birdie
Alert/photo capture during play) already depends on live connectivity to submit to
Jotform in real time. The new hole-relief games make the exposure more acute (more
frequent, more state-dependent interactions during play), but the underlying fragility
already exists today for ordinary stableford rounds.

**Two genuinely different problems, needing different answers:**

1. **Recording your own data (scores, CTP claims, hole results).** Solvable with a
   local-first write + background sync queue: the device writes to local storage
   instantly regardless of connectivity, with a visible pending/synced indicator, and a
   background process retries the sync whenever signal returns. This generalizes and
   formalizes a pattern that already exists as an unintentional one-off (the Trip
   Memories chapter-boundary override's `localStorage`-only persistence, flagged in
   `BF_WCRP_Memories_Spec.md` as an unconfirmed durability gap) into a deliberate
   architectural stance: the network is eventually-consistent, never something the entry
   flow blocks on.
2. **Coordinating live multiplayer state.** Genuinely harder and not fully solvable by an
   offline queue. Wolf specifically needs the group to agree, in the moment, who declared
   wolf before the next shot — that's a live decision, not a fact that can be queued and
   reconciled afterward. At a zero-signal venue, Wolf has to fall back to being played the
   old way (called out loud / tracked on paper or a single scorecard) with entry happening
   after the fact. Nassau and BBB are softer cases — they mostly need per-hole results
   tallied rather than moment-to-moment group agreement, so they tolerate eventual sync
   much better than Wolf does.

**Open idea, not a decision:** a per-venue "known connectivity" flag (e.g. Buck Hill =
poor), set once by the commissioner on the venue record, so BFE-A can default a
connectivity-sensitive format (Wolf) toward a paper-then-enter mode at a known-bad venue
instead of assuming live coordination will work and finding out mid-round that it won't.
Whether this lives on the venue record (alongside the GC-API-backed tee catalog from §1)
or somewhere else hasn't been decided.

---

## 6. Proposed build sequence (Dev-85 discussion) — a proposed order, not a commitment

Brian's framing going in: with almost every part of the system touched (venue management,
player profiles/course handicaps, the gaming engine, payout calc, results recording,
groupings, BFE-A UI/UX, Live Panel), this isn't a bolt-on capability — it's a
rearchitecture. The approach agreed on: small, iterative, shippable slices against this
doc as the roadmap, never a big-bang rewrite, because this is a live system real people
use for real events and real money — it has to keep working for existing formats
throughout.

**"Organize by Host" — right as a prioritization compass, not as the technical
structure.** Organizing the *code* around Host-facing screens (Setup, Groupings, Close
Round, Publish Results) would relocate today's ad hoc `engine`-checking problem into
prettier UI rather than fix it — each screen would grow its own copy of "what game is
this." The Round Configuration object (§2) is the technical spine; "does this slice make
the Host's job more complete" is the right question for *sequencing and priority*, which
is what the order below is built around.

**Proposed order, with reasoning:**

1. **Round Configuration schema — design only, no UI yet.** Has to exist before anything
   else can be built against it without getting rebuilt once the shape changes.
2. **Venue data (GC-API + D1 cache/fallback, §1).** Do this early — most isolated of
   everything listed, doesn't touch the game engine at all, already validated live
   against 5 real venues.
3. **Handicap calculator (§3), as a standalone testable unit.** Verify it against known
   real numbers (Brian's own index and known course handicaps at specific tees) before
   any game or UI depends on it.
4. **Migrate ONE existing, known-good format (Stableford Quota, single round) onto the
   new Round Config end-to-end** — Setup → Live Panel → Close Round → payout → results.
   Pure refactor, zero new player-facing capability. Its only job is proving the new
   spine doesn't break something already live. Historical events keep their existing flat
   `engine` field as-is — this is additive going forward, not a retroactive migration.
   **Also read the existing skins-in-quota comparison logic in `BFE-Admin.html`'s Close
   Round as part of this slice** (see §4) — it's very likely already the correct,
   working version of the per-format comparison-direction rule and should inform, not be
   redesigned around, the general mechanism.
5. **One add-on module (Skins is probably simplest) as a pluggable piece on that same
   slice.** Proves the base-game/add-on separation is real, not just a diagram — and
   should land as a thin wrapper around whatever comparison logic step 4 already found,
   generalized to declare its per-format comparison direction (§4) rather than rewritten.
6. **Live-scoring resilience (§5: local-first + sync queue).** Pulled forward rather than
   deferred to "whenever Wolf needs it" — it's insurance for the *existing* Live Panel
   too, and Buck Hill already proved the exposure is real, not hypothetical.
7. **One new game format via the registry — Nassau or BBB before Wolf.** Neither needs
   live multiplayer coordination, so this exercises a full new-game build through the
   registry without also having to solve live group-coordination in the same step.
8. **BFE-A UI/UX redesign last, not first.** Redesigning the admin UI before the config
   model has proven out on two real game formats risks redesigning it twice. The UI
   should follow the shape the config actually takes, not a guess at it made up front.

## 7. Summary of open questions (carried forward, not yet answered)

- Priority order among Bingo/Bango/Bongo, Wolf, Nassau.
- Course Handicap formula and allowance-% configurability model — needs Brian to "noodle
  on it" before this is scoped further.
- Per-venue connectivity flag — worth building, and where it should live, both open.
- Buck Hill: confirm genuine GC-API absence (try name variants) vs. a search-term miss.
- §6's build sequence is a proposed order, not a decision — open to being argued with in
  a future session, especially step ordering once real work starts surfacing constraints
  the discussion didn't anticipate.
- §4: whether the existing skins-in-quota logic already generalizes cleanly to a
  declared-comparison-direction mechanism, or whether it's more tightly coupled to the
  quota engine specifically than assumed here — unconfirmed until that code is actually
  read (see §6 step 4).
