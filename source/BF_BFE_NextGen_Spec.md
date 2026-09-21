# BF_BFE_NextGen_Spec.md — BFE Next-Gen Architecture: Venue Data, Game Engine, Handicap, Live Scoring

**Status:** Living spec, third revision (Dev-85). This is a design-notes doc, not a build
plan — nothing here is scheduled or committed, and several open questions are marked
explicitly rather than resolved. §8 adds a proposed build sequence (small iterative slices
against this doc as the roadmap, never a big-bang rewrite of a live production system),
now driven by a real deadline (§7's 2026 fall calendar) rather than an abstract order.
It exists so the architectural thinking from a Dev-85 discussion survives into future
sessions instead of needing to be re-derived. Read this before scoping any of: a
Venue/Tee Catalog rework, a new game engine beyond `stableford_quota`/`scramble_pair`, a
handicap/stroke-allocation feature, a scoring-representation/conversion feature, a
team/entity-hierarchy feature (2Man, BF Cup), a live/offline scoring redesign, or before
deciding what order to tackle any of it in.

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
- Not calendar-critical for any of the known 2026 fall events (see §7) — BF Cup is played
  scratch, so it doesn't depend on course rating/slope data the way a handicap-relief
  format would.

---

## 2. Game engine: orthogonal axes instead of one flat `engine` enum

**Current state:** `bfe_events` rounds carry a single `engine` field
(`none` / `stableford_quota` / `scramble_pair`). This conflates several genuinely separate
concerns into one value, and the whole model (chaining via `chainsFrom`, Wally Ball,
Overall Standings) grew specifically around Wally Cup's and BF Series's known flows.

**The technical spine: one composable Round Configuration object.** Whatever organizes
the *code*, the underlying data model needs a single object — base game + add-on modules
+ timeframe/chaining + entity model (§5) + venue reference + handicap/allowance config +
scoring representation (§4) + connectivity mode — that every consumer (payout calc,
results recorder, groupings, Live Panel, BFE-A UI) *reads*, never re-derives. Without
this, "payout for any combination" and "results for any combination" are a combinatorial
explosion of special cases scattered across screens, which is a nicer-looking version of
today's ad hoc `engine` checks, not a fix for them. The Host (the commissioner setting up
an event) is the person who *fills in* this config via BFE-A — a useful lens for
sequencing and prioritizing the work (see §8), but not the shape of the config itself.

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
     the end): Stableford (existing, and see §4 — "quota" is a separable overlay, not
     part of the base game itself), Scramble/Foursomes (single shared team ball, no
     score-derivation needed), Best Ball/Fourball (each plays their own ball, team score
     = best of the team's net scores per hole), Hi/Lo (team score = both best *and* worst
     of the team's net scores per hole, combined), and net-new individual formats
     Bingo/Bango/Bongo, Nassau.
   - **Match-play formats** (no cumulative score at all — a running hole-by-hole
     win/lose/halve tally against a specific opponent, can end before hole 18 once
     mathematically decided, e.g. "3&2"): Wolf, and the BF Cup / Ryder-Cup-style team
     match play covered in §5 and §7. Structurally distinct from every cumulative format
     above — needs its own engine shape, not a variant of one of them.
   - Priority ordering among Bingo/Bango/Bongo, Wolf, and Nassau specifically is
     explicitly open (see §9) — none of the three is calendar-critical (§7).
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
   structure (§7) is a variant of this — sessions within one event roll up to a team
   total, rather than rounds within an event rolling up to Overall Standings.

**Scope resolved:** GS (`BF_Golf_Scorer_8.html`) is being sunset after this season and
already lacks a handicap calculator, same as BFE-A — so this net-new engine work targets
BFE-A only. No GS/BFE-A convergence question to solve; GS is not a target platform for any
of this.

---

## 3. Handicap / stroke-allocation calculator — a real gap, but not calendar-critical

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

**Confirmed NOT on BF Cup's critical path (Brian, Dev-85):** BF Cup is played scratch —
competitiveness is managed through roster construction and captain's-choice pairing, not
stroke relief. So §3 does not block the Nov 7 build (see §7). **Real future enhancement,
explicitly flagged, not scoped for this year:** Brian can see wanting an optional
quota/handicap-relief layer on BF Cup matches later ("might be more competitive"),
explicitly beyond what the old Jotform/spreadsheet tooling could ever support — a good
candidate second-year feature once §3 exists for other reasons.

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
(§7) already prove the split is real**: both use the same Stableford point scale with the
quota-baseline comparison simply turned off — a straight leaderboard on raw point total.
That means Turkey/BlackFriday need **zero new engine work**, just a config flag
("has quota baseline: yes/no") once the Round Config decomposition exists — not a new
format to build.

**The point table itself is a configurable parameter, not a fixed formula.** BirdieFriends'
own scale gives birdie 4 points specifically to create a "birdie premium" (Brian, Dev-85:
this is the reason for the group's name) — a deliberately non-standard table, not the more
common birdie=3 scale. Same principle as §3's handicap-allowance configurability, showing
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
   anything new here** — it's very likely already the correct, working version of this
   mechanism, not something to redesign from scratch.
2. **Cross-format conversion (the deeper, harder case).** Needed when a consumer must
   bridge between formats — combining or publishing results across a quota round and a
   standard-scoring round, or converting a quota-recorded result into traditional
   net/gross terms for display (the existing "quota → standard" translation Brian
   described happening today, narrowly, at the results-display layer). This is the case
   that actually needs a common pivot representation (net-score-relative-to-par is the
   natural candidate, since a quota point value is presumably already a function of
   net-to-par for that hole) and, to go all the way to gross strokes, needs §3's
   handicap/stroke-allocation data — a quota point tells you net-to-par, not gross
   strokes, without knowing how many strokes of relief that hole carried. Not
   calendar-critical for §7's fall events.

**Net effect on the model:** not every consumer needs full value conversion. Skins-style
consumers need only a declared per-format comparison rule and operate natively on
whatever was actually recorded. Cross-format reporting/publishing consumers need the
deeper conversion chain through the handicap calculator. Building the deeper mechanism
first, when most of what's needed (skins, likely other hole-level comparisons, and both
new fall events) only ever needed the simpler rule or a config flag, would be solving a
harder problem than most consumers actually have.

---

## 5. Player entity model — individual, team, and hierarchical team-of-teams

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
  (after their own personal stroke relief, per §3); the team's hole score is the *best*
  of the team members' net scores.
- **Hi/Lo** — same individual-ball setup as Best Ball, but the team's result combines
  *both* the best and the worst of the team's net scores per hole.
- The "high handicap gets a blow" question (Brian, Dev-85) resolves cleanly here: it
  doesn't add a new mechanism, it confirms §3 must run correctly per individual team
  member *before* any team-derivation rule (best-of / hi-lo) can apply to the result.

**Hierarchical entities — team-of-teams, driven by the BF Cup / Ryder-Cup-style format
(§7):** a third level beyond individual and team is needed for events structured as
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

## 6. Live scoring vs. connectivity — a real, not hypothetical, risk

**The trigger:** Brian flagged that Buck Hill Golf Club had "all but non-existent" cell
coverage during actual play — no prior real incident is recorded in `BF_Session_Log.md`,
so this hasn't bitten a live event yet, but it easily could have. This is foresight, not a
postmortem.

**This is broader than the new games.** The existing Live Panel (Scorecard/CTP/Birdie
Alert/photo capture during play) already depends on live connectivity to submit to
Jotform in real time. The new hole-relief games make the exposure more acute (more
frequent, more state-dependent interactions during play), but the underlying fragility
already exists today for ordinary stableford rounds. BF Cup's match play (§5, §7) adds a
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

## 7. The 2026 fall calendar — what's actually needed, by event

Brian's ask (Dev-85): stop discovering architecture pieces turn by turn, map the complete
known calendar against what's been designed above, and let real dates drive the build
order (§8) instead of an abstract priority.

| Event | Date | Format | New engine work needed? |
|---|---|---|---|
| BF Series | through 10/26 | Regular season league play | **None from this doc** — stays on GS through its natural end this season; GS is being sunset (§2) but not touched before then. |
| BF Cup ("BirdieFriends Cup") | 11/7–8 | Team match play (Foursomes/Fourball/Singles-style), 16/20/24 players, **scratch** (no handicap relief) | **Yes — the real build.** Entity hierarchy (§5: player → pairing → side), match-play engine (§2: hole-by-hole tally, ends early), point rollup across sessions (§2/§5), configurable side size on the draft/pairing mechanism, Live Panel hole-by-hole capture for auto-calculated match results (§6) replacing the old manual Red/Blue point entry. **Not needed:** §3's handicap calculator (scratch play), venue GC-API data (not blocking, nice-to-have). Skins/CTP layering (§2) requested for payout variety — desirable, not blocking. |
| Turkey 2Man | 11/15 | 2-player scramble, Stableford scoring, **no quota baseline** | **None** — `scramble_pair` engine already covers the team format; the "no quota baseline" behavior is the config-flag decomposition in §4, not a new format. |
| BlackFriday 1-man | 11/27 | Individual, Stableford scoring, **no quota baseline**, "hit 2 balls per shot, take the better" | **None** — same §4 config-flag decomposition as Turkey. The 2-balls-per-shot rule is a real-world play convention invisible to the data model; the scorecard only ever records the one resulting per-hole score. |

**Net finding:** of three new fall asks, two (Turkey, BlackFriday) need no new engine work
at all once §4's quota/point-scale decomposition exists — they're config, not build. BF
Cup is the one genuinely hard, genuinely deadline-critical item, and its scope is smaller
than initially feared specifically *because* it's played scratch — §3 is not on its
critical path this year.

---

## 8. Proposed build sequence — revised around the Nov 7 deadline

Brian's framing going in: with almost every part of the system touched (venue management,
player profiles/course handicaps, the gaming engine, payout calc, results recording,
groupings, BFE-A UI/UX, Live Panel), this isn't a bolt-on capability — it's a
rearchitecture. The approach agreed on: small, iterative, shippable slices against this
doc as the roadmap, never a big-bang rewrite, because this is a live system real people
use for real events and real money — it has to keep working for existing formats
throughout. §7's calendar sharpened this from an abstract order into a real forcing
function.

**"Organize by Host" — right as a prioritization compass, not as the technical
structure.** Organizing the *code* around Host-facing screens (Setup, Groupings, Close
Round, Publish Results) would relocate today's ad hoc `engine`-checking problem into
prettier UI rather than fix it — each screen would grow its own copy of "what game is
this." The Round Configuration object (§2) is the technical spine; "does this slice make
the Host's job more complete" is the right question for *sequencing and priority*.

**Proposed order, with reasoning:**

1. **Round Configuration schema — design only, no UI yet.** Has to exist before anything
   else can be built against it without getting rebuilt once the shape changes. Scope it
   to what BF Cup actually needs first (base game = match play, entity = hierarchical,
   scratch/no handicap config, add-ons optional) rather than the full eventual shape —
   the fuller shape (quota baseline flag, handicap allowance, connectivity mode) can
   extend it afterward without a rebuild, per §2's registry principle.
2. **BF Cup's critical path (§5, §7): entity hierarchy, match-play engine, point rollup,
   configurable side size, Live Panel hole-by-hole capture.** This replaces "migrate
   Stableford Quota onto the new Round Config" as the first real vertical slice — a real
   Nov 7 deadline is a better forcing function than a synthetic refactor for proving the
   new architecture, and it exercises genuinely new territory (match play, hierarchy)
   rather than just re-plumbing something that already works. **Also read the existing
   skins-in-quota comparison logic in `BFE-Admin.html`'s Close Round before designing
   anything new for Skins-on-BF-Cup** (see §4) — likely already the correct
   comparison-direction mechanism, generalizable rather than reusable-from-scratch.
3. **§4's quota/point-scale decomposition (config flag, not new engine)** — unlocks
   Turkey 2Man (11/15) and BlackFriday 1-man (11/27) for free once done. Small, isolated,
   worth doing alongside or immediately after BF Cup's core build since both fall events
   land within 3 weeks of BF Cup.
4. **Go/no-go checkpoint, a couple weeks before Nov 7.** Brian confirmed the Jotform/
   manual fallback is acceptable for BF Cup if the BFE build isn't ready — this turns
   "we're behind" into a calm, pre-agreed decision rather than a last-minute scramble.
5. **Venue data (GC-API + D1 cache/fallback, §1).** Do this whenever convenient after the
   fall crunch — most isolated of everything listed, doesn't touch the game engine at
   all, already validated live against 5 real venues, and not calendar-critical for any
   2026 fall event.
6. **Handicap calculator (§3), as a standalone testable unit.** Verify it against known
   real numbers (Brian's own index and known course handicaps at specific tees) before
   any game or UI depends on it. Needed for Wolf/Nassau/BBB/Best-Ball/Hi-Lo and for the
   future BF-Cup-with-handicap-relief option (§3) — none of which are this year's
   problem.
7. **One new individual game format via the registry — Nassau or BBB before Wolf.**
   Neither needs live multiplayer coordination, so this exercises a full new-game build
   through the registry without also having to solve live group-coordination in the same
   step.
8. **Live-scoring resilience (§6: local-first + sync queue), generalized beyond BF Cup's
   own hole-by-hole capture.** Insurance for the *existing* Live Panel too, and Buck Hill
   already proved the exposure is real, not hypothetical.
9. **BFE-A UI/UX redesign last, not first.** Redesigning the admin UI before the config
   model has proven out on real game formats (BF Cup, then Turkey/BlackFriday, then a new
   individual format) risks redesigning it twice. The UI should follow the shape the
   config actually takes, not a guess at it made up front.

---

## 9. Summary of open questions (carried forward, not yet answered)

- Priority order among Bingo/Bango/Bongo, Wolf, Nassau — none calendar-critical.
- Course Handicap formula and allowance-% configurability model — needs Brian to "noodle
  on it" before this is scoped further; not calendar-critical this year.
- Per-venue connectivity flag — worth building, and where it should live, both open.
- Buck Hill: confirm genuine GC-API absence (try name variants) vs. a search-term miss.
- §8's build sequence is a proposed order, not a decision — open to being argued with in
  a future session, especially step ordering once real work starts surfacing constraints
  the discussion didn't anticipate.
- §4: whether the existing skins-in-quota logic already generalizes cleanly to a
  declared-comparison-direction mechanism, or whether it's more tightly coupled to the
  quota engine specifically than assumed here — unconfirmed until that code is actually
  read (§8 step 2).
- §5: whether the scoring team is always the same as the physical playing group, or can
  diverge — unresearched, Brian has no direct experience with a format where they differ.
- §3: optional quota/handicap-relief layer for BF Cup matches — real future idea, not
  scoped, not this year.
