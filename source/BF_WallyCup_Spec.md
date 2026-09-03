# BF_WallyCup_Spec.md — 2026 Wally Cup Architecture Spec

**Status:** Living spec, second revision. Covers the event structure already live
(Rd1/Rd2/Rd3, Wally Ball, Overall Standings, results page) plus the 2-Man Scramble round
(Dev-78) — draft board, team scoring with team quota, results section, and the Overall
guardrail fix are all built and delivered. Read this before touching Groupings, the
results page, Close Round, or the Overall Standings rollup — it's the reference
`BF_Session_Bootstrap.md` and `BF_Session_Log.md` have both been missing.

---

## 1. Event structure

The 2026 Wally Cup is one BFE event (`event_name: "2026 Wally Cup"`) with rounds played
across a single trip:

`Rd1 → Rd2 → 2Man → Rd3 → Overall`

Rd1, Rd2, and Rd3 are standard individual stableford-quota rounds and roll into Overall
Standings (Wally-Ball-inclusive `roundPerf`, per the Dev-76 design decision). **2Man does
not roll into Overall** — it is a standalone competition that happens to run inside the
same trip and the same app, with its own podium and its own money, and is deliberately
excluded from the season-long quota chain and from Wally Ball.

Sequence on the day: 2Man is played and closed between Rd2 and Rd3. Winners are named and
results published that evening; Rd3 (and the resumption of the Overall chase) happens the
next morning.

## 2. Groupings — the 2Man draft

**Ranking basis:** After Rd2 closes, rank all 16 players by their rolling Overall
Standings performance (same stat driving the existing Overall Standings table).

**Draft mechanic — deliberately human, not algorithmic.** The bottom 8 players (ranks
9–16) are "captains." In order from worst to best (16th picks first, down through 9th),
each captain picks one partner from the top 8 pool; a top-8 player is removed from the
pool once picked. This always produces 8 two-person teams, each pairing one bottom-half
captain with one top-half partner. The last captain (rank 9) has no real choice — whoever
is left in the pool is the partner.

This is intentional: a pure ranking-based pairing algorithm systematically produces
mismatched, no-fun pairs (a strong player carrying a weak one is exhausting for both), and
years of trying to solve that with a formula haven't worked. The draft's human
decision-making is the actual design goal, not a placeholder for a smarter algorithm. A
lucky low-vs-low pairing can still land on a team by chance — the **team quota** described
in §3 exists to keep that pairing from unfairly out-ranking a stronger team on raw points
alone, without touching the draft mechanic itself.

**Tool requirement:** a lightweight, mobile-friendly "draft board" — run live at the pub
between rounds. Shows the 8 captains in pick order, lets the host tap the on-the-clock
captain then tap an available top-8 name to lock in a team, and removes that player from
the pool. Needs a **lightweight edit/swap** capability after the fact, since informal
in-person trades ("negotiation") can happen and a full redo shouldn't be required for one
swap. No formal trade workflow or approval process needed — this is host judgment, not a
system rule.

**Foursomes for play:** 2 teams per physical playing group, assigned by draft order,
no optimization needed:
- Group 1: team of the 16th-ranked captain + team of the 15th-ranked captain
- Group 2: 14th + 13th
- Group 3: 12th + 11th
- Group 4: 10th + 9th

**Team nicknames:** optional free-text nickname per team, entered fresh for this event
(e.g., "The Peg-Leg Turkeys"). **Not a persistent/managed concept** — no team-history
tracking, no cross-event memory of past pairings or nicknames, no reuse suggestion if the
same two players pair up again in a future event. Simple entry per event only. The real
player names remain the source of truth for all scoring, history, and lookups — the
nickname is purely a display label layered on top (e.g., shown as "The Peg-Leg Turkeys
(Brian Hager & Scott Justus)" or similar), never a replacement identifier.

## 3. Scoring

**Engine:** same per-hole points scoring already used for stableford rounds. Capture and
points math are unchanged from stableford — what's new is what a team is *ranked against*.

**Team quota.** Per Brian's spec — "each player's RD1-3 quotas averaged" — each partner's
own quota is smoothed across every stableford round played so far this trip, not just
their latest one, then the two partners' numbers are averaged together. Concretely, for
each player: collect the quota they carried *into* every stableford round in the chain
leading up to 2Man (`quota_in` for Rd1, `quota_in` for Rd2, ...), plus the quota they'd
carry into the round immediately after (`quota_out` of the most recent closed round —
i.e. the quota entering Rd3). With Rd1 and Rd2 both closed by the time 2Man plays, that's
3 values per player ("RD1-3"), averaged into that player's own number; the two partners'
numbers are then averaged into the team quota. This smooths out one hot or cold round
rather than weighting the most recent round alone. All of it is read via the same
`chainsFrom` mechanism that already threads quota from round to round for Overall — no
new handicap math, just averaging numbers BFE-Admin already has on hand for every closed
stableford round in the chain. 2Man itself does **not** feed the real quota chain (Rd3's
`chainsFrom` still points to Rd2, not to 2Man) — 2Man's chainsFrom is read-only, walked
backward purely to find which rounds' quotas to average.

Teams and the individual podium/standings are ranked by **performance**
(`actualPoints - teamQuota`), not raw points, so a team that beats its combined target
outranks a team that scored more points but underperformed a higher target. This is the
fix for the "two weak players get luckily paired and it's not really competitive" case
Brian flagged when reviewing test data — the team quota keeps that pairing from
out-ranking a stronger team just because low-vs-low produces a lower target too, since
both teams are judged against how they did relative to their own combined ability, not
against each other's raw score. If either partner has no quota on record (e.g. a "No-HCP"
player), the team falls back to ranking by raw `actualPoints` for that team only. Close
Round hard-stops with an error if Rd2 (the chainsFrom round) hasn't closed yet, since
there's no quota to average until it has.

**Capture:** the Jotform capture form/fields don't change. What changes is usage — a
scramble has one score per hole for the team, so only one partner submits per team.
**8 total scorecard submissions** (one per team), not 16. The submission needs to
identify both players on the team (pull from that round's groupings record rather than
requiring both names typed by hand), and the display needs to show the team identity
(nickname, if set, plus the real names underneath).

**CTTP, Skins, Podium:** computed the same way as a normal round, scoped to the 8 teams
instead of 16 individuals.

**Payout:** same $/player round-pot mechanism already built in BFE-Admin (§6 Payout) — no
new payout engine needed. $10/player for this round's pot, standard proportional split
(podium 20% weighted, CTP 15% across the round's CTP holes, remainder to skins). This
pot is separate from the Overall podium pot and Wally Ball pot, consistent with 2Man being
a standalone competition.

## 4. Overall exclusion — guardrail needed

The Rounds setup UI already has a "Rolls into Overall" checkbox per round, and the
helper text confirms unchecking it is the intended mechanism for a standalone round to
skip the Overall quota chain and Wally Ball. **Gap found this session:** that checkbox
defaults to checked and is easy to miss — it was checked for the 2Man row in a real test
setup and went unnoticed.

**Fix needed:** a confirmation prompt when saving a round with "Rolls into Overall"
checked while the round's engine isn't the standard individual-stableford-quota engine
(2Man scramble, or any future non-standard format) — surfaced before save, not after.

**Parked for later:** if this app is ever opened up to hosts other than Brian, this
probably needs a stronger default (Overall unchecked by default for any non-standard
engine, not just a warning) rather than relying on a host to catch a warning dialog. Not
solved in this pass — worth its own conversation if/when that's actually on the table.

## 5. Reporting

The results page already has a placeholder section anticipating 2Man's insertion, with
the nav rail matching the full event scope:

`Rd1 — Rd2 — 2Man — Rd3 — Overall`

2Man's results section follows the same generator pattern as the other rounds (team
standings instead of individual, same CTP/skins detail treatment). No separate standalone
page needed — it's one more section on the existing results page.

## 6. Open items carried forward

- **Team quota** (§3) — built, not just parked: teams rank by performance vs. each
  partner's own quota averaged across every stableford round played so far (Rd1 + Rd2's
  quota_in, plus Rd2's quota_out), then the two partners' numbers averaged together —
  not just a snapshot of the latest round. Tested against the real close-round logic
  (multi-round chain walking, a single-prior-round edge case, No-HCP fallback dropping
  just that player's missing value, and the chainsFrom-not-closed hard stop).
- **Results-publish gap Brian found:** a round's incoming ("pre-round") quota can't
  appear in that round's own results section, because the report only ever renders
  *closed* rounds' saved results — there's nothing to show for a round that hasn't
  played yet. Not a bug to fix in the report; Brian's call is that a live/pending number
  like that belongs on a future "event card" concept instead, separate from the
  post-close report. Parked — not scoped or built.
- **Overall-checkbox guardrail for multi-host use** (§4) — parked until hosting is opened
  beyond Brian.
- **Capture-side team identification** — portal.html's Jotform Live Panel doesn't have a
  built affordance yet for a submitter to pick "which team am I" from the saved draft
  data; for now the submitter types the team's display name by convention, matching
  whatever the draft board shows. Worth a real UI pass before this is opened to other
  hosts, not required for the 2026 Wally Cup.
- **Results-page section ordering** — the 2Man section currently renders after Wally Ball
  in scroll order; only the nav rail's `#twoman` link jumps to the right spot. A full
  section-reorder was judged riskier than valuable this close to the event and was
  deferred.
- Build order and sizing for the draft-board tool, the capture-form team association, and
  the results-page 2Man section have not yet been scoped — this spec is the design
  reference, not a build plan.
