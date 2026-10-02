# BF_BFE_NextGen_Spec.md — BFE Next-Gen Architecture: Venue Data, Game Engine, Handicap, Live Scoring

**Status:** Living spec, fourth revision (Dev-85). This is a design-notes doc, not a build
plan — nothing here is scheduled or committed, and several open questions are marked
explicitly rather than resolved. §9 adds a proposed build sequence (small iterative slices
against this doc as the roadmap, never a big-bang rewrite of a live production system),
now driven by a real deadline (§8's 2026 fall calendar) rather than an abstract order.
It exists so the architectural thinking from a Dev-85 discussion survives into future
sessions instead of needing to be re-derived. Read this before scoping any of: a
Venue/Tee Catalog rework, a new game engine beyond `stableford_quota`/`scramble_pair`, a
handicap/stroke-allocation feature, a persistent player HCP profile, a
scoring-representation/conversion feature, a team/entity-hierarchy feature (2Man, BF
Cup), a Quick Templates / spontaneous-play feature, a Gatherings/BFE convergence
feature, a live/offline scoring redesign, or before deciding what order to tackle any of
it in.

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
- ~~Buck Hill's absence from GC-API~~ — **resolved Dev-87:** it was a search-term miss.
  "Buck Hill" finds Buck Hill Falls Golf Club (Venue Manager now retries with a simplified
  name automatically). The manual-entry fallback is still needed for courses GC-API truly
  lacks — see §1a.
- Whether GC-API coverage holds up for whatever other venues get added later hasn't been
  tested beyond these five.
- Not calendar-critical for any of the known 2026 fall events (see §8) — BF Cup is played
  scratch, so it doesn't depend on course rating/slope data the way a handicap-relief
  format would.

---

## 1a. Course layouts — 9-hole play, 27-hole pairings, manual tee entry (Dev-87 design, not built)

**Why:** three real needs surfaced together in Dev-87. (1) Chooch's 9-hole league needs the games
component to know *which* nine is being played. (2) Some venues (Buck Hill) have 27 holes, and a
round is a pair of nines. (3) Courses GC-API doesn't have need a manual entry tool. Brian: "a bigger
piece of work … let's document it and tackle the dev later."

**What already exists (verified in code, Dev-87):**
- `bfe_venue_tees` rows are 18-hole tees (`holes` must be an array of 18 — the Worker rejects anything
  else), `UNIQUE(venue_id, tee_name, gender)`.
- `POST /bfe/venue-tees` **already accepts hand-entered tees**: `source:'manual'` saves with `locked=1`,
  so a later GC-API refresh can't overwrite them without `force:true`. **No Worker work is needed for
  basic manual entry** — only UI.
- Scorecards already carry `hole_count` (9|18) and `hole_half` ('front'|'back') end to end (main Worker
  D1, Card Score Sheet UI, My History detail).
- **Gap:** the Live Panel scorecard always sends `hole_half: null` (see `submitScorecard`) and has no
  notion of which nine. A 9-hole gamed Gathering played on the back nine would record its holes as
  1–9, so Skins, CTP holes and stroke holes would all line up against the wrong holes. **Fix this
  before a 9-hole league runs games.**
- The legacy venue-level par table (`venues.pars`, main Worker, Venue Manager's older "manual entry")
  is a separate 18-par list used for Card Score Sheet marks. The new editor should seed from it.

**Proposed model — a venue has one or more *layouts*; each is an 18-hole routing:**
- Standard course → one layout (blank/default). Nothing changes for existing venues.
- 27-hole course → one layout per pairing (e.g. Red/White, White/Blue, Blue/Red), each with its own
  tees, rating/slope and 18-hole hole handicaps. That's how ratings are published, and very likely how
  GC-API stores them: a "Buck Hill" search returned four near-identical "Buck Hill Falls Golf Club"
  entries, consistent with one per pairing. **Not yet opened to confirm** — spend 1 search + a few
  course lookups of the daily GC-API budget.
- 9-hole play → a layout + a half (front/back), reusing the scorecard's existing `hole_half`.
- A 9-hole-only course → one layout whose back half repeats the front (or a 9-hole-only flag), to be
  decided when a real one comes up.
- Rejected alternative: storing each *nine* as the building block and assembling rounds from nines.
  Cleaner in theory, but it fights how both GC-API and the rating system publish data, and it's a
  much larger rework. Revisit only if a course can't be described as layouts.

**Build plan (in order):**
1. **Schema:** add `layout TEXT` (NULL = default) to `bfe_venue_tees`; widen the unique key to
   `(venue_id, layout, tee_name, gender)`. Additive migration; GC-API imports fill `layout` from the
   course name when a venue has multiple GC-API courses.
2. **Manual tee editor (Venue Manager):** "➕ Add tee / ✏️ Edit tee" using the same grid as
   `venueScorecardHtml`, but with every Yds/Par/HCP cell as an input. Fields: layout, tee name, gender,
   rating, slope. Live OUT/IN/TOT sums, so you can check against the physical card. **"Copy from another
   tee"** (par + HCP are almost always the same across a course's tees, so only yardage/rating/slope
   need typing). Validation: every par 3–6; HCP must use 1–18 exactly once (highlight duplicates or
   gaps, don't just refuse); yardage optional; warn if rating/slope are missing (HCP strokes need
   them). Seed pars from `venues.pars` when present. Saves via the existing `POST /bfe/venue-tees`
   with `source:'manual'`.
3. **Holes played in the Games config:** "18 / Front 9 / Back 9" (+ a layout dropdown when the venue
   has more than one). The Live Panel scorecard shows only those holes with their real numbers, and
   sends `hole_half`. The CTP hole picker is limited to that nine. `computeGatheringGamesPayout` already
   copes with 9-length cards, but hole numbering must stay aligned with the actual holes played.
4. **Viewer/rail:** the venue viewer and the at-course rail get the layout dropdown when needed.

**Open questions:** 9-hole ratings and 9-hole stroke index (WHS publishes 9-hole ratings; the stroke
allocation for a single nine is usually the 18-hole index re-ranked 1–9, or odd/even — confirm when
handicaps are built, §4); how GC-API labels 27-hole pairings; whether any BF venue is 9-hole-only.

---

## 2. Game engine: orthogonal axes instead of one flat `engine` enum

**Current state:** `bfe_events` rounds carry a single `engine` field
(`none` / `stableford_quota` / `scramble_pair`). This conflates several genuinely separate
concerns into one value, and the whole model (chaining via `chainsFrom`, Wally Ball,
Overall Standings) grew specifically around Wally Cup's and BF Series's known flows.

**The technical spine: one composable Round Configuration object.** Whatever organizes
the *code*, the underlying data model needs a single object — base game + add-on modules
+ timeframe/chaining + entity model (§6) + venue reference + handicap/allowance config +
scoring representation (§5) + connectivity mode — that every consumer (payout calc,
results recorder, groupings, Live Panel, BFE-A UI) *reads*, never re-derives. Without
this, "payout for any combination" and "results for any combination" are a combinatorial
explosion of special cases scattered across screens, which is a nicer-looking version of
today's ad hoc `engine` checks, not a fix for them. The Host (the commissioner setting up
an event) is the person who *fills in* this config via BFE-A — a useful lens for
sequencing and prioritizing the work (see §9), but not the shape of the config itself.

**Extensibility mechanism: a registry, not more upfront design.** Brian's explicit
observation (Dev-85): "we'll never get it correctly pre-planned." The answer to that isn't
trying harder to predict every future game — it's making each base game and each add-on
module a self-contained, independently-registered definition (its own scoring function,
its own declared data needs, its own UI fragment). Adding a new format later means adding
one registry entry, not touching payout/results/groupings/UI code in six places.

**Proposed decomposition** (Brian's framing, confirmed as the right shape):

1. **Base game** — the actual scoring math for a round. Known formats, by scoring
   archetype:
   - **Cumulative-score formats** (accumulate a total across 18 holes, compare totals at
     the end): Stableford (existing, and see §5 — "quota" is a separable overlay, not
     part of the base game itself), Scramble/Foursomes (single shared team ball, no
     score-derivation needed), Best Ball/Fourball (each plays their own ball, team score
     = best of the team's net scores per hole), Hi/Lo (team score = both best *and* worst
     of the team's net scores per hole, combined), and net-new individual formats
     Bingo/Bango/Bongo, Nassau.
   - **Match-play formats** (no cumulative score at all — a running hole-by-hole
     win/lose/halve tally against a specific opponent, can end before hole 18 once
     mathematically decided, e.g. "3&2"): Wolf, and the BF Cup / Ryder-Cup-style team
     match play covered in §6 and §8. Structurally distinct from every cumulative format
     above — needs its own engine shape, not a variant of one of them.
   - Priority ordering among Bingo/Bango/Bongo, Wolf, and Nassau specifically is
     explicitly open (see §10) — none of the three is calendar-critical (§8).
2. **Add-on modules** — selectable per round regardless of base game: Skins, CTP, Podium,
   BF Ball (the rename of Wally Ball, generalized beyond Wally-Cup-specific framing).
   These are currently entangled with the stableford engine's Close Round logic and need
   to become independent, opt-in modules. Confirmed workable even on a team match-play
   base game (Brian, Dev-85: wants Skins/CTP layered into BF Cup for payout variety) —
   this is the 2Man precedent (team-level base game, individual-level CTP) generalizing
   cleanly to a third base-game type, not a new mechanism.
3. **Timeframe/chaining configuration** — generalizing what Wally Cup's `chainsFrom`
   round-sequencing already does (see `BF_WallyCup_Spec.md`), so a multi-round series
   isn't a Wally-Cup-specific concept baked into the code. BF Cup's own multi-session
   structure (§8) is a variant of this — sessions within one event roll up to a team
   total, rather than rounds within an event rolling up to Overall Standings.

**Scope resolved:** GS (`BF_Golf_Scorer_8.html`) is being sunset after this season and
already lacks a handicap calculator, same as BFE-A — so this net-new engine work targets
BFE-A only. No GS/BFE-A convergence question to solve; GS is not a target platform for any
of this.

**Longer-horizon vision, explicitly "eventually" — not near-term scope (Brian, Dev-85):**
Gatherings (`worker.js`/`birdiefriends-push`) today are pure host management —
scheduling, roster, attendance — with zero access to BFE's gaming engine. Brian's actual
long-term aim is for host-management and gaming to converge: a Gathering should
eventually be able to carry a Round Configuration and become a scored competition,
rather than "Gatherings" and "BFE events" staying two separate systems that happen to
share a Worker's D1 database. **This means the Round Configuration object should not be
designed as BFE-exclusive machinery bolted onto `bfe_events`** — it should be an
attachable capability any hosted session could eventually carry. Worth keeping in mind
while designing §2's schema even though nothing about this is scoped or scheduled: a
design that only ever imagines `bfe_events` rows having a Round Config makes this
convergence harder later than a design that treats "what kind of record has a Round
Config attached" as an open question from the start. **Real open technical question, not
yet investigated:** whether Gatherings (`worker.js`) and BFE (`bf-experiences`) actually
share one physical D1 database or are genuinely separate — there's a real clue they share
one (the Dev-80 memories bug involved deleting rows from both `bfe_event_memories` and
`event_photos` "in the same D1 database" per the bootstrap doc), but this hasn't been
confirmed against the actual schema, and it materially changes how hard this convergence
would be to build.

---

## 2a. Round Configuration v1 — draft schema, scoped to BF Cup (Dev-87 DRAFT for Brian's review)

**Status: design draft, nothing built. BF Cup work PARKED (Dev-87 close) — see the revised §9.** The generic parts (§2a.2, §2a.3's object, §2a.5 legacy mapping, §2a.7 consumer contract) are the contract for §9 layer 2. The BF-Cup-specific parts (match play, sides, §2a.9 decisions, §2a.10 slices) wait for dedicated BF Cup sessions. Originally drafted as the old §9 step 1. It is deliberately scoped to what BF Cup
(11/7–8) needs plus a lossless mapping of every round type that already exists. The fuller shape
(handicap allowance, connectivity mode, new individual games) extends it later without a rebuild.
Decisions only Brian can make are collected at the end (**§2a.9**). Nothing here should be built until
those are answered.

### 2a.1 What already exists that this builds on (verified in code, Dev-87)
- **A small registry already exists in BFE-Admin.html.** `ENGINES = { stableford_quota, scramble_pair,
  points_by_score_type }` plus `INFLUENCERS = { wally_ball }`, run by `scoreRound(roundCfg, rawInput,
  sideData)` → `engineFn(rawInput, engineParams)` then each influencer in order. **Round Config v1 is
  the formalized, stored version of exactly this triple** (`engine`, `engineParams`, `influencers`), not
  a replacement for it.
- `bfe_event_rounds` already stores `engine`, `engine_params` (JSON) and `influencers` (JSON), and
  **is deleted and reinserted on every Setup save** (results are keyed by `round_name` for that reason).
- **2Man's draft already models "a group made of teams":** `bfe_round_groups` rows carry `group_index`,
  `strategy:'draft'` and `team_label`. A BF Cup *match* is the same shape (one playing group =
  two sides' players), so Groupings is the natural place to build match pairings.
- **§5's assumption corrected:** Close Round's `computeSkins` (BFE-Admin) is hard-wired to *highest
  points wins*. It is **not** a generalized comparison-direction mechanism. The *lowest strokes wins*
  version exists separately in the portal's `computeGatheringGamesPayout` (Dev-87). Both directions
  exist, in two places, so the config must declare the direction explicitly (`compare`, below).
- Gatherings already carry a mini-config (`bfe_gathering_games`: games[], dollar_per_player,
  cttp_config, birdieball_config). It maps cleanly onto v1 (§2a.5) — the convergence path §2 asked
  to keep open.

### 2a.2 Principles
1. **Every consumer reads the config; none re-derive it.** Payout, results, Groupings, Live Panel, the
   results page and the portal all call one resolver, `roundConfig(round)`, and branch on its fields
   — never on `round.engine` string checks (today there are 35 of those in BFE-Admin alone, counted Dev-87).
2. **Legacy rounds are adapted, not migrated.** A round with no stored config gets one synthesized from
   `engine`/`engine_params`/`influencers` by `configFromLegacy()`. Wally Cup history and the Practice
   / 2Man / quota rounds keep working with zero data changes.
3. **Declared per consumer, not per round** (§6): the base game can score sides while CTP pays the
   individual — each add-on declares its own `entity`.
4. **Input matches the on-course mental model** (§5): match play is played as "we won / halved / lost
   the hole", so that's a valid capture unit in its own right.

### 2a.3 The object
```jsonc
{
  "v": 1,
  "base": {
    "game": "match_play",          // registry id: stableford | scramble_pair | match_play | scorecard_only | points_by_score_type
    "format": "fourball",          // game-specific: match_play → singles | fourball | foursomes
    "params": {}                   // game-specific (stableford: pointTable, hcpMode …)
  },
  "entity": {                      // who the BASE game scores
    "level": "side",               // individual | team | side   (side = team-of-teams, §6)
    "unit": "pair",                // what plays each match/entry: player | pair
    "derive": "best_ball"          // pair → one hole score: shared_ball | best_ball | hi_lo | null
  },
  "input": "strokes",              // Live Panel capture: strokes | points | hole_result   (see §2a.9 Q4)
  "compare": "low",                // hole/round comparison direction for this input: low (strokes) | high (points)
  "handicap": { "mode": "scratch" },        // scratch | full | allowance(pct) — BF Cup: scratch; §4 later
  "quota":    { "enabled": false, "chainsFrom": null },   // §5 split: stableford ± quota baseline
  "holes":    { "layout": null, "half": null },           // §1a: null = standard 18
  "addons": [                      // independently computed, each with its own entity
    { "id": "skins", "entity": "individual", "basis": "gross" },
    { "id": "cttp",  "entity": "individual", "holes": [3, 7, 12, 16] }
  ],
  "rollup": {                      // where this round's result goes
    "into": "side_total",          // overall | side_total | none
    "points": { "win": 1, "halve": 0.5, "loss": 0 }
  },
  "connectivity": "live"           // live | paper_then_enter (§7 — default live; BF Cup doesn't need the other yet)
}
```
**Event-level additions for side competitions** (on `bfe_events`, only when any round rolls into
`side_total`):
```jsonc
"sides": [ { "key": "red", "name": "Red", "color": "#c0392b" },
           { "key": "blue", "name": "Blue", "color": "#1f5fbf" } ],
"sideTarget": 14.5,                 // points to clinch; see §2a.9 Q2 for ties
"sideAssignment": { "Brian Hager": "red", "...": "blue" }
```

### 2a.4 Match-play engine (the one genuinely new engine)
A pure function, registered as `ENGINES.match_play`, testable in isolation like
`computeGatheringGamesPayout`:
```
matchState(holeResults[18 of 'A'|'B'|'H'|null], holesInMatch = 18) →
  { upSide: 'A'|'B'|null, upBy, played, remaining, dormie, closed, result: 'A 3&2' | 'B 2 up' | 'Halved' | null,
    points: { A, B } }
```
- A match **closes early** when `upBy > remaining` ("3&2"); if it goes the distance the result is
  "N up" or "Halved". Points come from `rollup.points`.
- **Hole winner from strokes** (if `input: strokes`): per side, derive the pair's hole score with
  `entity.derive` (fourball = best ball of the two; foursomes = the one shared ball; singles = the
  player's own), then low wins (scratch → gross, so no handicap strokes are involved this year).
- **From hole results** (if `input: hole_result`): taken directly.
- Side totals = sum of match points across every round whose `rollup.into === 'side_total'`, plus
  "clinched" once a side reaches `sideTarget`.

### 2a.5 Legacy mapping (every existing round type → v1, via `configFromLegacy`)
| Today | v1 |
|---|---|
| `stableford_quota` (+ `hcpMode`, `wally_ball` influencer, `chainsFrom`) | `base.game: stableford`, `entity.level: individual`, `input: points`, `compare: high`, `quota.enabled: true` + `chainsFrom`, `addons: [skins(high), cttp, bf_ball]`, `rollup.into: overall` (if `rolls_into_overall`) |
| `scramble_pair` (2Man) | `base.game: scramble_pair`, `entity: {level: team, unit: pair, derive: shared_ball}`, `input: points`, `compare: high`, quota from pooled partners (read-only `chainsFrom`), `addons: [skins(team), cttp(individual)]`, `rollup.into: none` |
| `scorecard_only` (Practice) | `base.game: scorecard_only`, `rollup.into: none`, no add-ons |
| `points_by_score_type` | `base.game: points_by_score_type`, `input: points`, `compare: high` |
| Gathering games (`bfe_gathering_games`) | `base.game: scorecard_only`, `input: strokes`, `compare: low`, `addons: [skins(gross), cttp{dollar_per_hole, holes}, birdieball{dollar_per_player}]`, payout = `dollar_per_player` pot (Dev-87 rules) |
| **Turkey 2Man / BlackFriday** (new, §8) | `scramble_pair` / `stableford` with `quota.enabled: false` — **config only, no new engine** |
| **BF Cup** (new) | `base.game: match_play`, `format` per session, `entity.level: side`, `rollup.into: side_total` |

### 2a.6 Storage
- **`bfe_event_rounds.config TEXT`** (new, JSON, nullable) — written by Setup alongside the existing
  columns, so it rides the same delete/reinsert on save. NULL → `configFromLegacy()`. Additive
  migration: `ALTER TABLE bfe_event_rounds ADD COLUMN config TEXT;`.
- **`bfe_events.sides TEXT`** (JSON: sides, target, assignment) — nullable, only side competitions.
- **Matches reuse `bfe_round_groups`**: one `group_index` per match; **add `side_key TEXT`** per player
  row, so a group of 4 = 2 red + 2 blue (fourball/foursomes) and a group of 2 = 1 + 1 (singles). A
  *playing group* can carry two singles matches — then `match_key` (new, nullable) separates them
  inside one group. (This also settles §6's open question for BF Cup specifically: scoring unit ≠
  playing group is allowed.)
- **`bfe_round_matches`** (new; results layer, same delete-then-insert-per-round lifecycle as
  `bfe_round_skins`): `event_id, round_name, match_key, side_a_players, side_b_players (JSON), format,
  hole_results (JSON 18), result_text, points_a, points_b, closed_at`.
- **Live capture**: hole-by-hole data goes to the existing BFE `/scorecards` (strokes) or a new
  `/bfe/match-holes` upsert (hole results), keyed by `(event, round_name, match_key, hole)` so two
  phones in the same match can't double-count — a later write for the same hole replaces the earlier
  one.

### 2a.7 Who reads what (the consumer contract)
| Consumer | Reads | Today it branches on |
|---|---|---|
| Setup (BFE-Admin) | writes `config` per round, `sides` per event | `ENGINE_OPTIONS` dropdown |
| Groupings | `entity.unit`, `sides` → build matches instead of foursomes | `engine === 'scramble_pair'` |
| Live Panel (portal) | `input`, `holes`, `addons`, match roster from groups | `evtScoreMode`, `isTeamRound` |
| Close Round | `base.game` → `ENGINES[...]`, `addons` → add-on registry, `rollup` | many of the 35 `engine ===` checks |
| Results page | `rollup.into`, side totals, match results | round-type special cases |
| Payout | `addons` + event payout plan | stableford-specific pot logic |

### 2a.8 Out of scope for v1 (deliberately)
Handicap strokes (§4 — BF Cup is scratch), Wolf / Nassau / BBB, the offline sync queue (§7; BF Cup
uses `live` and accepts the Jotform/manual fallback), the BFE-Admin redesign (after §9 Phase D),
and converting Gatherings to store a v1 config (mapping documented above, migration later).

### 2a.9 Decisions only Brian can make (needed before building)
1. **Session structure for 11/7–8:** how many sessions, which format each (fourball / foursomes /
   singles), and matches per session. Field size (16/20/24) sets the matches per session.
2. **Points and winning:** win 1 / halve ½ / loss 0? The points to clinch? What happens on a tie
   (shared, or a playoff)?
3. **Side selection:** captains' draft (reuse the 2Man draft UI), commissioner-assigned, or random?
4. **Live capture:** *hole results only* (one tap per hole per match — lightest, the match-play mental
   model) **or** *strokes per player* (more entry, but it auto-derives fourball/foursomes results **and**
   makes Skins possible — Brian asked for Skins/CTP on BF Cup for payout variety). **Skins requires
   strokes.** Recommendation: strokes per ball (each player in fourball/singles, one per pair in
   foursomes), since it serves both the match result and Skins.
5. **When a match closes early (e.g. 4&3):** do players keep recording the remaining holes (needed if
   Skins runs over the full round), or stop?
6. **Money:** a side-win payout? Per-match payouts? Skins/CTP as $-per-player carve-outs like
   Gatherings, or a pot split?
7. **Venue(s)** for the two days, and whether it's the same course both days.

### 2a.10 Build slices once §2a.9 is answered (in order, each shippable)
1. `configFromLegacy()` + `roundConfig()` resolver in BFE-Admin, and replace the `engine ===` checks with
   config reads — **behavior-neutral**, proven by re-running Close Round on Wally Cup data and diffing
   against stored results.
2. The `match_play` engine as a pure, test-first function (§2a.4).
3. Sides on the event + side-aware Groupings (match building) + `side_key`/`match_key` columns.
4. Live Panel match capture (per §2a.9 Q4) + `bfe_round_matches`.
5. Close Round for `match_play` + side totals + results page section.
6. The `quota.enabled: false` flag (Turkey 2Man 11/15, BlackFriday 11/27).
7. Go/no-go checkpoint (~Oct 24).

---

## 3. Quick Templates — one-click setup-and-go for spontaneous play

**The trigger (Brian, Dev-85):** many BF games get decided before the first tee, not
planned in advance. **BFWeekends** — confirmed as an existing Gathering type Brian uses
as commissioner to establish Saturday/Sunday tee times at BSGC (Blue Shamrock Golf Club),
carrying its own complex scheduling logic that helps the club manage cash flow — reserves
tee times, and someone often suggests a game format on the spot once the group is set.
Brian's explicit claim: these spontaneous one-offs are **more frequent** than the formal
planned events (Wally Cup, BF Cup). That means this deserves real design weight as a
first-class flow, not treatment as a stripped-down afterthought retrofitted onto the
planned-event UI once that's built.

**The mechanism falls out of the registry (§2), no new engine work required.** A
"template" is a named, saved preset of registry entries — "Nassau, individual, scratch,
standard payout" or "Skins-only" — that a host applies with one click instead of walking
through full Setup. This is the concrete shape the Gatherings/BFE convergence idea above
takes in practice: a BFWeekend's reserved tee time is already a Gathering with a roster
(the event card), so "one-click template + go" is what attaching a Round Config to a
Gathering looks like at the exact moment someone at the tee says "let's play Nassau."

**Real complexity flagged, not yet resolved:** BFWeekends' cash-flow-management
scheduling logic is nontrivial — worth checking whether the final roster is locked in
well before tee time or can still be shifting close to play, since a template needs to
bind to the actual final roster at the moment of use, not a hypothetical one set up in
advance. Unconfirmed until that logic is actually read.

**Start scratch, layer handicap later (Brian, Dev-85).** Quick templates should launch
as pure scratch options first, with handicap-aware versions of the same templates added
as a later enhancement — the same "start simple, evolve" philosophy already established
for the allowance-% and point-table configurability in §4/§5. See §4 for two ways to add
fairness incrementally once that's wanted: the full precise stroke-relief calculator, or
the much simpler tee-box-based coarse handicapping described there.

**Not calendar-critical** — Brian's own framing was "along the way," not tied to a date.
The first new individual game format via the registry (after §9's Phase A–B foundation) should double as the first
real Quick Template + Gatherings pilot, per the note already there.

---

## 4. Handicap / stroke-allocation calculator — a real gap, but not calendar-critical

**Why quota didn't need this:** the existing Stableford Quota engine bakes relief into a
single number (the quota, derived once from series history / GHIN index via BFE-A's
existing GHIN importer) applied against the round's net score. No per-hole stroke
allocation is ever computed.

**Why Wolf/Nassau/BBB/Best-Ball/Hi-Lo need it:** these formats determine *which specific
holes* a player receives a stroke on, which requires the full chain:

`HCP Index → Course Handicap (via that tee's slope/rating) → Playing Handicap (format's
allowance) → strokes-per-hole (via that tee's own hole-handicap ranking)`

GC-API's per-hole handicap data (confirmed present and tee/gender-specific — Blue
Shamrock's data showed hole handicap rankings genuinely differ between tees and between
genders on the same tee, not a shared table) is what makes the last step possible. This
calculator does not exist anywhere in BF today — not in GS, not in BFE-A.

**GHIN API access will never happen — this is permanent, not a temporary gap (Brian,
Dev-85).** GHIN's licensing fees are prohibitive, so BFE will never get live/direct API
access to handicap data. This confirms the existing GHIN-paste-import mechanism (BFE-A's
GHIN importer, built from GS's own hard-won multi-version history — see
`BF_Session_Log.md`'s Dev-57 through Dev-65 entries) is the permanent solution here, not
a stopgap awaiting a "real" integration that will never arrive.

**Real correction, "probably something we should've done from the beginning" (Brian,
Dev-85): a persistent, centrally-stored player HCP profile.** Rather than deriving or
refreshing a player's handicap freshly within each event's own scoped data, BF should
maintain one canonical HCP field per player profile that gets updated by *any*
GHIN-paste import, wherever it happens — not siloed per-event the way it effectively is
today. This directly enables Quick Templates (§3): since the roster is already known from
the event card, and each player's HCP is already centrally maintained, a spontaneous game
can pull a reasonably current number immediately, with no fresh import needed in the
moment. Pair this with a fast "quick revise" screen — a lightweight prompt to confirm or
nudge a player's stored number right before play if it looks stale — accepting some
looseness as a fair tradeoff for casual play ("close enough to be fair") rather than
blocking on a full import.

**A simpler, coarser alternative to the full stroke-allocation calculator: tee-box
selection as auto-handicapping (Brian, Dev-85).** Rather than computing exact per-hole
stroke relief, letting players self-select or be assigned different tee boxes by skill
level is a legitimate, much simpler fairness mechanism — higher-handicap players from
forward tees, lower-handicap from back tees, naturally separating skill without any
calculator at all. Worth treating as a first-class lightweight option in its own right,
not just a stepping stone toward the "real" calculator — some hosts or formats may prefer
it permanently, especially for Quick Templates (§3) where simplicity matters more than
precision.

**Confirmed NOT on BF Cup's critical path (Brian, Dev-85):** BF Cup is played scratch —
competitiveness is managed through roster construction and captain's-choice pairing, not
stroke relief. So §4 does not block the Nov 7 build (see §8). **Real future enhancement,
explicitly flagged, not scoped for this year:** Brian can see wanting an optional
quota/handicap-relief layer on BF Cup matches later ("might be more competitive"),
explicitly beyond what the old Jotform/spreadsheet tooling could ever support — a good
candidate second-year feature once §4 exists for other reasons.

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

## 5. Scoring representation — per-format input, not a universal raw capture

**Corrected framing (Brian, Dev-85 — this took several passes to land right):** the
initial assumption was that gross strokes-per-hole is (or should be) a universal raw fact
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

**"Stableford Quota" is actually two separable things, not one (Brian, Dev-85).** The
Stableford point scale per hole (net-to-par → points) and the personal-quota-baseline
comparison (is this round's point total over or under my target) always shipped together
in BF's existing engine, but they don't have to. **Turkey 2Man and BlackFriday 1-man
(§8) already prove the split is real**: both use the same Stableford point scale with the
quota-baseline comparison simply turned off — a straight leaderboard on raw point total.
That means Turkey/BlackFriday need **zero new engine work**, just a config flag
("has quota baseline: yes/no") once the Round Config decomposition exists — not a new
format to build.

**The point table itself is a configurable parameter, not a fixed formula.** BirdieFriends'
own scale gives birdie 4 points specifically to create a "birdie premium" (Brian, Dev-85:
this is the reason for the group's name) — a deliberately non-standard table, not the more
common birdie=3 scale. Same principle as §4's handicap-allowance configurability, showing
up a second time in a different place: the host must be able to define their own
point-per-net-score table, not have Brian's specific numbers baked in.

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
   anything new here** *(Done, Dev-87: it is hard-wired to highest-points-wins, not generalized — see §2a.1)* — it's very likely already the correct, working version of this
   mechanism, not something to redesign from scratch.
2. **Cross-format conversion (the deeper, harder case).** Needed when a consumer must
   bridge between formats — combining or publishing results across a quota round and a
   standard-scoring round, or converting a quota-recorded result into traditional
   net/gross terms for display (the existing "quota → standard" translation Brian
   described happening today, narrowly, at the results-display layer). This is the case
   that actually needs a common pivot representation (net-score-relative-to-par is the
   natural candidate, since a quota point value is presumably already a function of
   net-to-par for that hole) and, to go all the way to gross strokes, needs §4's
   handicap/stroke-allocation data — a quota point tells you net-to-par, not gross
   strokes, without knowing how many strokes of relief that hole carried. Not
   calendar-critical for §8's fall events.

**Net effect on the model:** not every consumer needs full value conversion. Skins-style
consumers need only a declared per-format comparison rule and operate natively on
whatever was actually recorded. Cross-format reporting/publishing consumers need the
deeper conversion chain through the handicap calculator. Building the deeper mechanism
first, when most of what's needed (skins, likely other hole-level comparisons, and both
new fall events) only ever needed the simpler rule or a config flag, would be solving a
harder problem than most consumers actually have.

---

## 6. Player entity model — individual, team, and hierarchical team-of-teams

**The finding (Brian, Dev-85):** entity granularity — is the scored unit a person or a
team — isn't a round-level property. It's declared **per consumer**, and different
consumers in the same round legitimately disagree. This is already proven in production,
not hypothetical: Wally Cup's 2Man round scores its base game at the team level (team
quota, team ranking) while CTP inside that same round still pays the individual claimant,
never the team.

**Team-based base games have their own sub-variants, distinguished by whether there's a
score-derivation rule:**
- **Scramble/Foursomes** — one shared ball, one score per team per hole. No derivation
  needed; there's only ever one number.
- **Best Ball/Fourball** — each player plays an individual ball with their own net score
  (after their own personal stroke relief, per §4); the team's hole score is the *best*
  of the team members' net scores.
- **Hi/Lo** — same individual-ball setup as Best Ball, but the team's result combines
  *both* the best and the worst of the team's net scores per hole.
- The "high handicap gets a blow" question (Brian, Dev-85) resolves cleanly here: it
  doesn't add a new mechanism, it confirms §4 must run correctly per individual team
  member *before* any team-derivation rule (best-of / hi-lo) can apply to the result.

**Hierarchical entities — team-of-teams, driven by the BF Cup / Ryder-Cup-style format
(§8):** a third level beyond individual and team is needed for events structured as
player → 2-man pairing → side. Each pairing plays a match (Foursomes, Fourball, or
Singles rules) against an opposing pairing/player from the other side; the match result
(win/loss/halve, possibly ending early) converts to standardized points that roll up to
the side's running total across multiple sessions. This is genuinely nested, not just
"a bigger team" — it needs its own rollup layer distinct from both the individual-level
handicap/scoring work and the pairing-level match engine.

**Naming is a host action, not a format identifier (Brian, Dev-85).** "BirdieFriends Cup"
is Brian's own name for his instance of this format, the same way "2026 Wally Cup" is a
host-supplied `event_name` — completely separate from which underlying engine (team match
play, modeled on Ryder/Presidents Cup conventions) the event runs on. The doc and any
future build should refer to the underlying engine generically, never assume the format
is literally the PGA event.

**Open question, unresolved:** is the scoring team always the same as the physical
playing group, or can they diverge (e.g. a foursome that's one playing group but two
separate 2-man Best Ball teams within it)? BF Cup's 2-man-pairing-within-a-side structure
doesn't resolve this either way for other formats — worth researching before assuming
either answer generalizes.

---

## 7. Live scoring vs. connectivity — a real, not hypothetical, risk

**The trigger:** Brian flagged that Buck Hill Golf Club had "all but non-existent" cell
coverage during actual play — no prior real incident is recorded in `BF_Session_Log.md`,
so this hasn't bitten a live event yet, but it easily could have. This is foresight, not a
postmortem.

**This is broader than the new games.** The existing Live Panel (Scorecard/CTP/Birdie
Alert/photo capture during play) already depends on live connectivity to submit to
Jotform in real time. The new hole-relief games make the exposure more acute (more
frequent, more state-dependent interactions during play), but the underlying fragility
already exists today for ordinary stableford rounds. BF Cup's match play (§6, §8) adds a
new instance of this: auto-calculating hole-by-hole match results (replacing the old
manual after-the-fact Red/Blue point entry) means the Live Panel needs to reliably
capture hole-by-hole results *during* play for this format specifically — a real
dependency for the Nov 7 build, not just a future concern.

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
   after the fact. Nassau, BBB, and BF Cup's match play are softer cases — they mostly
   need per-hole results tallied rather than moment-to-moment group agreement, so they
   tolerate eventual sync much better than Wolf does.

**Open idea, not a decision:** a per-venue "known connectivity" flag (e.g. Buck Hill =
poor), set once by the commissioner on the venue record, so BFE-A can default a
connectivity-sensitive format (Wolf) toward a paper-then-enter mode at a known-bad venue
instead of assuming live coordination will work and finding out mid-round that it won't.
Whether this lives on the venue record (alongside the GC-API-backed tee catalog from §1)
or somewhere else hasn't been decided.

---

## 8. The 2026 fall calendar — what's actually needed, by event

Brian's ask (Dev-85): stop discovering architecture pieces turn by turn, map the complete
known calendar against what's been designed above, and let real dates drive the build
order (§9) instead of an abstract priority.

| Event | Date | Format | New engine work needed? |
|---|---|---|---|
| BF Series | through 10/26 | Regular season league play | **None from this doc** — stays on GS through its natural end this season; GS is being sunset (§2) but not touched before then. |
| BF Cup ("BirdieFriends Cup") | 11/7–8 | Team match play (Foursomes/Fourball/Singles-style), 16/20/24 players, **scratch** (no handicap relief) | **Yes — the real build.** Entity hierarchy (§6: player → pairing → side), match-play engine (§2: hole-by-hole tally, ends early), point rollup across sessions (§2/§6), configurable side size on the draft/pairing mechanism, Live Panel hole-by-hole capture for auto-calculated match results (§7) replacing the old manual Red/Blue point entry. **Not needed:** §4's handicap calculator (scratch play), venue GC-API data (not blocking, nice-to-have). Skins/CTP layering (§2) requested for payout variety — desirable, not blocking. |
| Turkey 2Man | 11/15 | 2-player scramble, Stableford scoring, **no quota baseline** | **None** — `scramble_pair` engine already covers the team format; the "no quota baseline" behavior is the config-flag decomposition in §5, not a new format. |
| BlackFriday 1-man | 11/27 | Individual, Stableford scoring, **no quota baseline**, "hit 2 balls per shot, take the better" | **None** — same §5 config-flag decomposition as Turkey. The 2-balls-per-shot rule is a real-world play convention invisible to the data model; the scorecard only ever records the one resulting per-hole score. |

**Dev-87 update (2026-09-27):** Brian paused BF Cup development in favour of unifying the engine first (§9); BF Cup 2026 is expected to use the pre-agreed Jotform/manual fallback, and Turkey/BlackFriday get their quota-off flag once §9 Phase B lands.

**Net finding:** of three new fall asks, two (Turkey, BlackFriday) need no new engine work
at all once §5's quota/point-scale decomposition exists — they're config, not build. BF
Cup is the one genuinely hard, genuinely deadline-critical item, and its scope is smaller
than initially feared specifically *because* it's played scratch — §4 is not on its
critical path this year.

---

## 9. Build roadmap — unify the engine first, then events are configuration (revised Dev-87, 2026-09-27)

**Why this replaced the BF-Cup-first sequence.** Drafting §2a showed that most of what BF Cup needs is
plumbing *every* event needs, and that BirdieFriends currently runs **two separate game systems** that
share almost nothing. Brian (Dev-87): "Let's stop the BFCup dev, I don't think we are ready … there are
still gaming engine things to solidify … do specific dev session(s) for BFCup." The goal: individual
EventCard Gatherings and BFE-A events both run on one base engine, flow and UI, so BF Cup, Wally Cup
and a Tuesday skins game are each **configured**, not coded. **Accepted trade-off:** BF Cup 2026
(11/7–8) most likely runs on the pre-agreed Jotform/manual fallback.

**The two systems today (verified in code, Dev-87):**

| | Gatherings (EventCard) | BFE-A events (Wally Cup) |
|---|---|---|
| Game setup | `bfe_gathering_games` via Host Panel | round `engine` + `engine_params` + `influencers` via BFE-Admin Setup |
| Scorecards | main-Worker D1 `scorecards` (gross strokes), key `gathering:<id>` | Jotform (quota points) |
| CTP / side games | BFE D1 (`bfe_cttp_entries`, `bfe_birdieball_answers`) | Jotform + Close Round |
| Scoring code | `portal.html` (`computeGatheringGamesPayout`) | `BFE-Admin.html` (`ENGINES`/`INFLUENCERS`/`scoreRound`, `computeSkins`, 35 `engine ===` checks) |
| Close | Close & Calculate → `payout_summary` snapshot | Close Round → `bfe_round_results`/`_skins`/`_cttp` |
| Results | My History "Game Results" block | generated static results page |

Skins is implemented twice, with opposite comparison directions (points high vs strokes low).

**The nine foundation layers** (each shippable on its own; order below):

1. **Shared engine module (`bf_engine.js`).** Pull scoring out of both HTML files into one script both
   load (and Node tests import directly): base-game registry (stableford, scramble_pair,
   scorecard_only, points_by_score_type; match_play later), add-on registry (skins with declared
   `compare`, cttp, birdieball/bf_ball, podium), payout, rollup. Pure functions only. **The single most
   important asset** — every future format becomes one registry entry.
2. **One round identity + one stored config.** Every playable round gets a `round_key`
   (`gathering:42`, `bfe:<event>/<round>`) and a Round Config (§2a's object, minus BF Cup specifics).
   `configFromLegacy()` synthesizes one for existing BFE rounds and for `bfe_gathering_games`.
3. **One scorecard store.** Hole-by-hole in D1 for every round, tagged with its input type
   (strokes | points | hole_result). Retire Jotform scorecards the way Gathering CTP was retired
   (v4.6.1). Prerequisite for offline capture (§7) and for any consumer to read scores uniformly.
4. **One lifecycle.** Setup → Register → Group → Play → Close → Publish → History, with the same
   states and one Close call for both kinds of event, always producing the same **results snapshot**
   shape (generalizing Gatherings' `payout_summary`).
5. **One results renderer.** The snapshot drives My History's results block, a BFE results page and
   archives. (The hand-finalized 2026 Wally Cup page stays as it is — never regenerate it; see the
   2026-09-27 branch record.)
6. **Config-driven Live Panel.** Scorecard input, hole range (§1a), player/team/side pickers and
   sections all read the config — finishing what Dev-86/87 started with per-game section gating.
7. **Generic payout module.** Gatherings' rules (entry × players who played, carve-outs, round down,
   give-back) plus BFE's podium/pot plan, expressed as add-on settings.
8. **One config builder with presets.** The same builder in the Host Panel (pick a template, adjust a
   couple of numbers) and in BFE-A (full). §3's Quick Templates = saved configs. Wally Cup, Tuesday
   skins and BF Cup each become a template.
9. **Course + player data it leans on.** Layouts, manual tee editor and 9-hole selection (§1a); later
   the handicap calculator (§4) when net games arrive.

**Sequence:**
- **Phase A — prove the foundation on Gatherings** (closest to the target already: D1 scorecards, a
  stored config, a snapshot close): layers 1–4 for Gatherings, with the Dev-87 test suite
  (`source/tests/`) moved onto `bf_engine.js` and kept green throughout. Fix the Live Panel
  `hole_half: null` gap here (§1a).
- **Phase B — re-express BFE quota rounds on the shared engine, behavior-neutrally:** BFE-Admin's Close
  Round calls `bf_engine.js`; verify by recomputing Wally Cup rounds and diffing against stored
  `bfe_round_results`/`_skins`/`_cttp` (compute and diff only — never "Generate & publish" the 2026 Wally
  Cup page). Retire the 35 `engine ===` checks behind `roundConfig()`.
- **Phase C — the shared surfaces:** results renderer (5), config-driven Live Panel (6), payout module
  (7).
- **Phase D — the config builder + templates (8)**, then layouts/manual tees (9, §1a).
- **Then BF Cup, in its own sessions:** register `match_play` + a side rollup, write its config
  (§2a.3–2a.6 are the parked design), answer §2a.9. Turkey 2Man / BlackFriday become the
  `quota.enabled: false` flag at whatever point Phase B lands.

**Standing constraints** (carried from the earlier sequence, still true): small, shippable slices,
never a big-bang rewrite — this is a live system with real money; a registry, not upfront prediction
("we'll never get it correctly pre-planned"); BFE-A UI redesign follows the config's proven shape,
not before it; live-scoring resilience (§7) builds on layer 3.

---

## 10. Summary of open questions (carried forward, not yet answered)

- **§2a.9 — seven BF Cup decisions** (sessions, points/ties, side selection, capture mode, early-close
  recording, money, venue). **Parked with BF Cup** (§9); not blocking Phase A.
- §9 Phase A: where `bf_engine.js` lives (`docs/` so both pages can load it) and whether the main Worker
  or the BFE Worker owns the unified scorecard store (layer 3) — decide at the start of Phase A.
- Priority order among Bingo/Bango/Bongo, Wolf, Nassau — none calendar-critical.
- Course Handicap formula and allowance-% configurability model — needs Brian to "noodle
  on it" before this is scoped further; not calendar-critical this year.
- Per-venue connectivity flag — worth building, and where it should live, both open.
- ~~Buck Hill: GC-API absence vs. search-term miss~~ — resolved Dev-87 (search-term miss).
- §1a course layouts: confirm how GC-API returns 27-hole pairings (Buck Hill), and 9-hole ratings.
- §9's roadmap (revised Dev-87) is agreed in direction; phase order stays open to argument once real
  work surfaces constraints.
- ~~§5: does the skins-in-quota logic generalize?~~ **Answered Dev-87: no** — BFE-Admin's
  `computeSkins` is hard-wired to highest-points-wins; the strokes version lives separately in the
  portal. §9 layer 1 unifies them with a declared `compare`.
- §6: whether the scoring team is always the same as the physical playing group, or can
  diverge — unresearched, Brian has no direct experience with a format where they differ.
- §4: optional quota/handicap-relief layer for BF Cup matches — real future idea, not
  scoped, not this year.
- §2: Gatherings/BFE convergence (Round Config as an attachable capability, not
  BFE-exclusive) — explicitly "eventually," not near-term scope, and does not touch the
  Nov 7 critical path (§8/§9). Whether Gatherings and BFE actually share one D1 database
  is unconfirmed and should be checked before this is designed in earnest.
- §3: BFWeekends' cash-flow scheduling logic hasn't been read — whether a Quick Template
  can bind to a final, settled roster at tee time, or whether the roster can still be
  shifting close to play, is unconfirmed.
- §4: the persistent player HCP profile is a real, agreed correction ("should've been
  done from the beginning") but unscoped — where it lives, exactly what "any GHIN import
  updates it" means mechanically, and the design of the "quick revise" screen are all
  open.

---

## 11. New Gathering — a guided flow for hosts (design note, Dev-92 window, 2026-10-02; NOT built)

**Why.** The Dev-90/91 New Gathering form tries to expose every case at once (Crew vs Open, held seats,
leftover-seat announce, Players sheet, games). Average hosts fumble. The Dev-91 root cause was a symptom of
the same thing: Crew mode silently turned every leftover seat into a held, unannounced Open Spot. Direction
(Brian, 2026-10-02): a light guided flow that asks in the host's own terms and hides everything else.

**Brian's rulings that shape it**
1. **Capacity is a target, not a fact.** The host books the tee sheet outside BirdieFriends, and is either
   certain or polling. So the number is optional ("hoping for N" / "polling, not sure yet"), editable any time.
   Polling = `size` NULL (the Worker already skips capacity enforcement when `size` is unset).
2. **Over target is not a warning.** Existing behaviour is the answer: a Yes past `size` is saved as **Sub** and
   the host is notified (main Worker `POST /registrations`, Dev-70; push `bf_type 'gathering_capacity'`).
3. **Crew is an audience, never a roster, and it is all-or-nothing.** Never partial crew; a standing crew
   (e.g. Chooch's CGA) is always invited. "Pick people" is its own path, with no crew shortcut inside it.
4. **Crew does not make anyone a player.** Only people the host is certain about are confirmed Yes
   (Walli, 10/02: Mike and Adam were in, then he opened it to a wider audience).
5. **"Hold seats for guests" is not a flow step.** Scott Justus at Moselem (private course) ran a hierarchy of
   asks outside BF and opened the game as people declined. That is already served by *start invite-only, open
   later* (Host Panel "Open to all members" / "Announce to all members", v4.10.5-4.10.10). Open Spots,
   Fill and Release stay in the Host Panel / Advanced; the new flow never mentions them.

**The flow (one question per screen, big tap choices, back always works)**
1. **Basics:** name, venue, date + tee time, "How many are you hoping for?" (number | "Not sure yet, polling").
2. **Who's already in?** Names the host is sure of (or skip). Saved as confirmed Yes.
3. **Who should we ask about the rest?** `My crew` | `Pick people` | `All BirdieFriends` | `Nobody yet (invite-only)`.
4. **Playing for anything?** Default No. Yes opens the existing games setup (Gross/Net etc. only appears once a
   game is on).
5. **Plain-English summary, then Create.** e.g. "Mike and Adam confirmed. Open to all BirdieFriends, announced
   now. Hoping for 4. No games." Each line taps back to its step. An "Advanced" link holds rare controls.

**Decision table (answers -> stored state; no new Worker concepts needed)**

| Q2 who's in | Q3 ask the rest | Result |
|---|---|---|
| names | My crew | confirmed Yes for names; whole crew invited; invite-only |
| names | Pick people | confirmed Yes for names; picked people invited; invite-only |
| names | All BirdieFriends | confirmed Yes; open to all (`fillListEnabled`) + announcement |
| names | Nobody yet | confirmed Yes; invite-only, nobody else asked; host can open later |
| none | any | same as above with zero confirmed |

No leftover-seat question exists: an unanswered seat is simply a seat nobody has said Yes to yet. `_hostHoldN`,
`_hostLeftAnnounce`, `hostLeftoverSeats()` and `hostAutoOpenSpots()` are not used by the new flow (kept for the
Host Panel).

**Reuse, not rebuild.** `gathering_templates` (main Worker, `/gathering-templates`) already saves a host's
venue/size/type/crew; "Same as last time" should sit in front of step 1 and prefill from it. Edit Gathering
(still the pre-redesign layout) should get the same summary-with-tap-to-edit treatment later.

**Open questions**
- Polling: should the event card show "N Yes so far" vs "N of 4" depending on whether a target is set? (Proposed: yes.)
- Does "My crew" pick which crew when a host has several, or is one default crew implied? (Today a host can pick a crew.)
- Does confirming a named player send them a notice, or is that silent? (Proposed: a "you're in" push, since they are
  committed.)
- Where the existing Create-form pieces (Players sheet, Add-games dialog) are reused inside the new steps.

**Reuse: Templates, Repeat, and titles (added 2026-10-02 from the Walli case)**
- Today there are two reuse paths. **Templates** (`gathering_templates`) store title, venue, size, type, description and
  crew list, leave the date blank, and always load in crew mode; they do not store audience choice, games, or confirmed
  players. **Repeat** (`repeatGathering`) creates the next same-weekday game immediately, behind one confirm dialog that
  shows the date and audience count, and notifies the whole old crew. It copies the audience, size and auto-repeat flag,
  but not games, and registers nobody as Yes.
- Both copy the title verbatim. Hosts type the date into titles by habit (Walli: "Sham Tuesday 8/18",
  "Shamalamadingdong Friday 8/14", "Shammy 8/7"), so a repeated game keeps a stale date until the host edits it. Dated
  titles also split the Repeat picker, which groups series by exact title, and defeat the template duplicate check
  (name-based), which is unconfirmed as a pile-up cause.
- **Design:** one entry, "Start from a past game". Repeat becomes a prefill into the guided flow; the summary screen
  replaces today's confirm dialog, with a "Send as is" button so a weekly crew game stays one tap. Reuse prefills name,
  venue, target, audience and "same games as last time" (re-freeze net handicap/tee for the new date); it never copies
  confirmed players, and the date is always asked. Strip date-like text from a reused title (e.g. "8/18") and show the
  cleaned title for the host to confirm; weekday words ("Tuesday") are flagged, not auto-removed. Group the Repeat picker
  by cleaned title. Keep Templates for now; revisit once the new flow has real use.
- **Narrowing the audience on a repeated game** is not possible in Repeat today; the only way is Edit -> Who's Coming
  after the full crew was already notified. The new summary screen fixes this by letting the host change "who to ask"
  and "who's already in" before anything sends.

**Findings log (strike as we experience them)**
- 2026-10-02, Walli's 10/02 game: Crew mode turned leftover seats into held, unannounced Open Spots (fixed v4.10.5-10).
- 2026-10-02, Walli's game: he repeated an older game without changing the title, so an old date stayed in the name
  (Brian fixed it by hand). Root causes above.
- 2026-10-02: Repeat has no audience step; narrowing to specific people is only possible afterward via Edit.
- 2026-10-02: Scott Justus / Moselem (private course): host runs a hierarchy of asks outside BF and opens the game as
  people decline. Served by invite-only now, open later; no hold-seats step.

- 2026-10-02, shipped to staging as portal v4.10.11: Repeat now strips a typed date from the title, lets the host edit the
  title in its one dialog, and the Repeat picker groups dated titles as one series. Still open: Repeat has no audience step,
  and the Worker's auto-repeat engine (`worker.js` ~line 207) copies the title as-is.

**Built (portal v4.11.0, 2026-10-02) — first slice.** Host Panel "New" opens `showGuidedGathering()`; the full form stays behind
"Use the full form instead" on every step (it carries the typed name/venue/date over). Answers become a plan
(`gfBuildPlan`, pure, 65 checks in `test_guided_gathering.mjs`); `gfCreate` runs the same calls the full form does.
Decisions taken while building: (1) several saved crews -> chips to choose which, one crew is pre-picked; (2) polling sets
`size` NULL and tee time "suggested", a number sets tee time "confirmed"; (3) confirmed names get a "you're signed up" push;
(4) a saved crew is never changed to fit one game: confirmed names outside it get a one-off crew; (5) "Pick people" reuses
the shared player picker and the existing "save this as a crew?" prompt; (6) the old leftover-seat and held-seat state is
not used. Not in this slice: "Start from a past game" (Repeat/Templates still separate), the event card's "N Yes so far"
while polling, Edit Gathering.

- 2026-10-02, Brian testing: the +Games Gross/Net list showed Open Spots first, unsorted. Root cause: spots are placeholder
  registrations, and a handicap typed for "Open Spot 1" is lost when the spot is filled (the fill renames the player in
  registrations, scorecards, CTP, BirdieBall and the closed result, but not `handicap_config`); unset spot rows also blocked
  the save. Fixed in v4.11.1: spots left out, real players A to Z, a note counts the open seats. Known follow-up: after a
  spot is filled the host must reopen Games to set that player's handicap; a Worker change to rename the key in
  `handicap_config` on fill would remove that step.

**Not in scope:** guests/hold-seats flow, partial crew, tee-time booking, anything on the Edit form.

---

## 12. Intercept at the failure point — sorting out who really played (design note, 2026-10-02; NOT built)

**Principle (Brian, 2026-10-02).** A host's setup is a prediction; the round is the truth. Registration stays permissive
until tee time. Never block a player from entering anything (CTP, Birdie, BirdieBall, scorecard); block only the **money**
(Close & Calculate) until the record matches what happened. Resolve each mismatch at the FIRST point reality exposes it,
once, so everything after it just works.

**What the code does today (verified 2026-10-02).** Close & Calculate builds the pot from scorecards turned in, so the
card is already the truth for who played. But the Live Panel pickers (Birdie Alert, CTP, BirdieBall, and the player sheet
they share) list only registered players (status not No) from `gatheringRegData`; Birdie Alert defaults to the logged-in
player. A BF member who never RSVP'd can submit under their own name but isn't on the roster; a person with no BF account
can't be picked at all, so nobody can enter their card. Close checks cards vs confirmed Yes, blank holes and open spots;
a net player with no strokes is only a quiet "played scratch" line in the results after closing.

**Failure points, in the order reality exposes them**

| Point | What fails | Intercept |
|---|---|---|
| Setup | host guesses wrong or leaves things blank | stay permissive; prefill from Membership; block nothing (loosen the Games save rule) |
| First CTP / Birdie / BirdieBall / scorecard entry | player not on the roster | "Not on the list?" in the player sheet: add a player in seconds |
| Net game, new player | no index or strokes | ask once, optional, right then; skipping is fine |
| Open Spot | held seat has no name | whoever shows up takes the next open spot (existing rename), else a new row; host confirms at Close |
| Close | anything still unresolved | one reconcile screen (below) |

**Brian's rulings**
1. **Anyone in the group may add the missing player** (usually the overseer/scorekeeper): by the time anyone notices, the
   player is already on the course, so the host can't be the only one who can. Minimum is **First, Last, Cell, and Cell is
   MANDATORY** (Brian, revised 2026-10-02: an optional field just gets skipped; a required one makes the overseer ask the
   player, who is standing in the group). The only remaining risk is a made-up number, so the form checks it: a real
   10-digit number (formatted as typed), not an obvious fake (all one digit, 1234567890, 555-0000), and a number that already
   belongs to a member shows "That number is Mike Nagle's. Is this him?" instead of creating a second record, which also
   makes the cell the strongest duplicate check. This matches the Join BirdieFriends form, where Cell is already required.
2. **Every added player becomes a Membership record**, not an anonymous name: "we need membership basics for any BF
   player." Same record the existing Join BirdieFriends form creates (`submitJoinBF`: first, last, cell, member date,
   Active), so they show up in Membership, can be a handicap source, and can claim the profile later.
3. **No push to the host at join time.** The host is probably playing; the host confirms everything once, at Close.

**Add-a-player flow (design)**
- Entry: a "➕ Not on the list?" row in the Live Panel player sheet (all pickers). Works for a member and a non-member.
- Step 1: type a name. Match against existing members first ("Mike" suggests Mike Nagle) so a duplicate is never made.
  A match = pick them; no match = New player.
- New player: First, Last, Cell (required, one line: "ask them, it's so we can reach them"). Creates the Membership record.
  **Open check:** the Join form sets field 20 to "Yes" (commented as a broadcast opt-in, `bfw: 'Yes'` locally). Someone
  added by a friend has not consented to alerts, so an on-course add should leave that off until they claim the profile.
  Confirm what field 20 controls before building.
- Then: registered Yes for this game, tagged as added on the course (who added, when). On-course joins skip the Sub
  downgrade: capacity is a target, and they are physically there (main Worker Dev-70 would otherwise make them Sub).
- If the game has Open Spots, the join takes the lowest-numbered one (existing fill/rename) instead of adding a row.
- If a net game is on, one optional line: "Handicap index (or skip)". Membership index is used automatically if on file.
- Storage: needs a mark on the registration saying it was added on the course (`added_by`, `added_at`) so Close can list
  it. That is a D1 `ALTER TABLE registrations` plus the main Worker accepting the fields (Brian's paste-deploy); an
  alternative is deriving "joined on course" from the registration time vs tee time, which needs no migration but is a guess.

**Close & Calculate becomes the reconcile screen.** Blockers (Close stays disabled; each has a one-tap fix):
open spots still unfilled; a net player with no strokes (inline tee + index row, prefilled from Membership);
a card under a name that is not a registered player ("Is this Mike Nagle?" with a suggested match, or merge/remove).
Warnings the host acknowledges: signed up but no card (one tap marks them "didn't play"); blank holes; a player with a
card but no BirdieBall answer; players who joined on the course (confirm, or merge a duplicate). The pot rule is unchanged
(scorecards in).

**Loosen setup to match.** The Games form should stop refusing to save until every player's tee and index are filled
(the hurdle lazy hosts will never clear): pick Gross or Net, one tee for everyone, and the allowance; Membership indexes
fill in automatically; missing ones are resolved at the first on-course add or at Close. Trade-off: strokes are not
visible before game day for anyone without a Membership handicap.

**Build order (each slice tested and shippable alone).** (1) Add-a-player in the Live Panel pickers (member match + new
Membership record + Yes registration). (2) Open Spot take-over. (3) The Close reconcile screen. (4) Loosen the Games save
rule. Open questions: field 20 meaning; registration storage (ALTER vs derive); whether a Membership record created on
the course is flagged until the person claims it. (Duplicates: match on cell number first, then on name.)

**Findings log additions (2026-10-02)**
- Unregistered players are first exposed at the first CTP/Birdie/BirdieBall/scorecard entry, not at Close; a person with no
  BF account cannot be picked at all today.
- A net player with no strokes is silent until after Close.

**Built (v4.11.2) — add-a-player slice of §12.** "Not on the list?" row at the end of the Live Panel player sheet (Gatherings, individual rounds). Cell mandatory with plausibility check (`bfCleanCell`), duplicate match by cell then name (`bfFindMemberMatch`, confirm prompt), Membership record created WITHOUT the alerts field (20), Yes registration with `added_by`/`added_at`, no downgrade to Sub, no host push. Main Worker: `POST /registrations` accepts `added_by`; GET falls back if columns are absent. **Brian to run:** `ALTER TABLE registrations ADD COLUMN added_by TEXT; ALTER TABLE registrations ADD COLUMN added_at TEXT;` and paste-deploy `source/worker.js`. Not yet: Open Spot take-over, Close reconcile screen, loosening the Games save rule.
