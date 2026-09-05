# BF_WallyCup_Spec.md — 2026 Wally Cup Architecture Spec

**Status:** Living spec, third revision. Covers the event structure already live
(Rd1/Rd2/Rd3, Wally Ball, Overall Standings, results page) plus the 2-Man Scramble round
(Dev-78) — draft board, team scoring with team quota, results section, and the Overall
guardrail fix are all built and delivered. Live Panel capture support for 2Man (team
picker for Scorecard/Birdie Alert, individual picker for CttP), the Live Test Mode round
selector, the BF-Series-compatible Venue CTP-holes editor, and the Wally Cup Rd1
venue-name-mismatch fix are also built and delivered (Dev-78). **Brian ran a full manual
end-to-end dry run of Rd1 → Rd2 → 2Man → Rd3 through the Live Panel (a 4-player mock
roster, "to minimize data entry") and verified the computed results independently against
the shipped formulas — no discrepancies found. The process and every calculation are
considered ready for real Rd1, 10am 9/11 — but the live "2026 Wally Cup" D1 event is still
this dry run's 4-player mock data and needs a Data & Reset → Delete plus a fresh real
Setup + real Draft/Groupings before game day (carried since Dev-75/77, still not done).**
Read this before touching Groupings,
the results page, Close Round, or the Overall Standings rollup — it's the reference.
`BF_Session_Bootstrap.md` and `BF_Session_Log.md` are both kept current as of Dev-78.

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
- **Small-group payout rounding — flagged during live 2Man testing (2026-09-05), parked
  until hosting is opened beyond Brian.** BFE-Admin's round-pot podium split (20% of the
  round pool, weights 2/1/0.5, each share rounded to the nearest $5 via `roundTo5`) can
  silently zero out 2nd and/or 3rd place in a small field — e.g. a 4-player round at
  $10/player/round pays podium as $5/$0/$0, not a broken 3-place split. Working as designed
  today (Brian's own groups are large enough that this never bites), but a real gap if BFE
  is opened to other hosts running smaller competitions: at the current $10/player rate and
  default weights, a round needs **9 players** before all three podium spots pay out
  nonzero. Not scoped or built — needs a design pass (adjustable rounding granularity, a
  minimum-pool guardrail, or a UI that gracefully collapses to fewer paid places for a small
  field) before general host availability.
- **Capture-side team identification** — built and delivered. The Live Panel fetches the
  2Man round's saved draft teams the same way the groupings card does, and **Post-Round
  Scorecard and Birdie Alert** swap their player picker for a team picker whenever the
  live round's engine is `scramble_pair` — same "Nickname (Real A & Real B)" convention as
  the groupings display, so a submitter taps their team rather than typing a name by hand.
  The picker never falls back to the tapping player's own name for a team round (unlike
  the individual-round picker, which defaults to "whoever's logged in") — nothing is
  pre-selected, so a submission can't accidentally go out under the wrong identity. Also
  fixed as part of this: the Wally Ball "do you still have it" question was being asked on
  2Man scorecard submissions (format-scramble was in the same eligibility list as
  format-wally) even though 2Man is explicitly excluded from Wally Ball per §1 — it's now
  gated on the round's actual engine instead of the coarser format-class string, so it's
  skipped for 2Man specifically without affecting any real Wally-Cup individual round.
  **CttP is the one exception, and stays individual even in a team round** — found and
  fixed during live 2Man testing (2026-09-05): CttP entry was initially swapped to the
  team picker along with the other two sections, but BFE-Admin's Close Round has always
  paid CTP to the *individual* claimant on the configured hole, never the team (see §5/§3
  — "computed the same way as a normal round" was never meant to make CTP team-scoped, and
  Close Round's own roster check only ever recognizes individual names). A team-picker CTP
  claim submitted a team name Close Round couldn't match against the roster, so it silently
  went unpaid ("CTP claim(s) from a name not on this roster, not paid"). Fixed by reverting
  just the CttP section back to the individual roster picker, defaulting to whoever's
  logged in exactly like a non-team round — confirmed against Brian's own live 2Man test
  data that a CttP claim now correctly resolves to a real name and gets paid.
- **Live Test Mode round selector (Dev-78)** — Live Panel's commissioner Test Mode
  previously only ever showed the next upcoming event; a device-local (not synced to the
  shared flags KV) event selector was added so Brian can pick any specific upcoming round
  — e.g. jump straight to "2026 Wally Cup - 2Man" — to dry-run the whole WC entry flow
  round by round without waiting for real tee times. Past events drop off the list
  automatically.
- **Venue CTP-holes editor for BF Series (Dev-78)** — BF Series' CttP entry was
  hard-coded to Blue Shamrock's par-3 holes, since BF Series has no BFE-Admin round setup
  to configure CTP holes through. Fixed with a Venue Manager CTP-holes editor (read-modify
  -write against the same shared `bfe_venue_tee_catalog` store BFE-Admin's own Tee Policy
  writes to) so any venue's CTP holes can be set once, from either app, and the Live Panel
  picks them up automatically by venue regardless of which app scheduled the round. BFE-
  Admin's own venue tee-block also picked up a latent bug fix alongside this: every block
  started blank until a host manually clicked "Load saved catalog," and the "save as
  default" checkbox defaulted to checked — a Save without that manual click could silently
  overwrite a venue's saved CTP holes with an empty array. Fixed by auto-loading each
  block's saved catalog the moment it's built.
- **Wally Cup Rd1 CTP fallback bug — root-caused and fixed (2026-09-05):** Rd1 was showing
  Blue Shamrock's default CTP holes instead of Honesdale's configured `[6,13]`. Root cause
  confirmed against live production data: the Jotform "Request Event" submission for Rd1
  has `eventLocation = "Honesdale GC"`, while the canonical venue name is "Honesdale Golf
  Club" — an exact-match venue lookup silently failed and fell through to the BSGC default.
  Fixed at the code level (works regardless of whether the Jotform submission itself ever
  gets corrected): a shared `findVenueByName()` helper now tries an exact match first, then
  a narrow GC/Golf-Club and CC/Country-Club abbreviation-normalized fallback, rewired into
  every venue-lookup call site (logo, motif, pars, CTP holes) — verified it doesn't
  false-positive-match two genuinely different courses.
- **Live Panel notification safety, verified (2026-09-05):** confirmed by tracing every
  `osSendAll`/`osSendToPlayers` call site reachable from the Live Panel that CttP and
  Birdie Alert — the only two real notification triggers in it — already correctly send
  test-only pushes (to the submitting player, `[TEST]`-prefixed) rather than broadcasting
  to all BirdieFriends while Test Mode is on. Scorecard submission and photo/video capture
  send no notification at all. No fix was needed here.
- **Results-page section ordering** — the 2Man section currently renders after Wally Ball
  in scroll order; only the nav rail's `#twoman` link jumps to the right spot. A full
  section-reorder was judged riskier than valuable this close to the event and was
  deferred.
- Build order and sizing for the draft-board tool, the capture-form team association, and
  the results-page 2Man section have not yet been scoped — this spec is the design
  reference, not a build plan.
