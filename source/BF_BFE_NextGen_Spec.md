# BF_BFE_NextGen_Spec.md — BFE Next-Gen Architecture: Venue Data, Game Engine, Handicap, Live Scoring

**Status:** Living spec, first draft (Dev-85). This is a design-notes doc, not a build
plan — nothing here is scheduled or committed, and several open questions are marked
explicitly rather than resolved. It exists so the architectural thinking from a Dev-85
discussion survives into future sessions instead of needing to be re-derived. Read this
before scoping any of: a Venue/Tee Catalog rework, a new game engine beyond
`stableford_quota`/`scramble_pair`, a handicap/stroke-allocation feature, or a live/offline
scoring redesign.

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

## 4. Live scoring vs. connectivity — a real, not hypothetical, risk

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

## 5. Summary of open questions (carried forward, not yet answered)

- Priority order among Bingo/Bango/Bongo, Wolf, Nassau.
- Course Handicap formula and allowance-% configurability model — needs Brian to "noodle
  on it" before this is scoped further.
- Per-venue connectivity flag — worth building, and where it should live, both open.
- Buck Hill: confirm genuine GC-API absence (try name variants) vs. a search-term miss.
