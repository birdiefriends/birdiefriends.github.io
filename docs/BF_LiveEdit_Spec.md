# BF Live Edit (host edit mode for roster and groups) — design spec for Dev-101

Status: **designed with Brian on 2026-11-16, not built.** Brian agreed with the shape ("pause, reconfigure, restart" as an edit session). Three decisions are still open (see "Open decisions"). Nothing here is shipped.

## 1. Why (what happened at the Turkey 2Man, Sun 2026-11-15)
- Two players (Tom Kobal, Troy Schwab, one scramble team) no-showed. The host plans a group pattern and the app codifies the on-course execution from it (published Groups, start holes, scramble pairs, MiserBall order by start hole, CTP and coin duties). A last-second change corrupts that codification.
- When the Live Panel launches, the host is locked out of the Groups config and the unregister action. The only repair was the Close dialog's "remove player", which can drop a player but cannot move anyone.
- Result: the partner left in a 2-some could not be re-paired, the shotgun hole counts were wrong (course management), group-mates keyed scores for the missing team (bogus 153s), and ante/pot math was only repairable at close.
- Brian's framing: "a Pause Event, reconfigure, restart event process is a more flexible approach."

## 2. Principle
Lock the **money and game rules** at launch, not the **roster and groups**. Real events change after launch. The thing to protect is scoring continuity, not the config.

## 3. Design

### 3.1 Edit mode (instead of a hard pause)
- Host taps "Edit groups & roster" on the Live Panel. Scoring, CTP and MiserBall answers keep running for everyone (a hard pause would stop group-mates scoring mid-round, which is worse than the no-show).
- Players see a small banner while a session is open: "Host is adjusting groups."
- Host (and commissioner) only. One open edit session per Gathering; stamp it with a version number so a stale second editor is refused.
- Co-host/overseer editing is an open decision.

### 3.2 Draft, then Apply (atomic)
All edits go into a draft copy of the config; nothing is live until Apply. This is what prevents the half-edited, corrupted state. Draft actions:
- **Unregister / mark Out** a player (reason: no-show, or withdrew after N holes).
- **Move** a player or a whole team to another group; **set a team's start hole** (shotgun).
- **Split or merge teams**; **orphaned partner** forced choice: play solo as their own team / merge into another team as a 3-some / pair with another leftover.
- Add a late player (reuses the existing add path).

### 3.3 Impact preview on every change
Live, before Apply: group sizes ("Group 6 now has 2 players"), start-hole counts ("hole 5 has 2, hole 9 has 6"), teams with one player, scorecards that will be held aside, ante and pot change. Hard errors disable Apply (a team with zero players, a player in two groups). Soft warnings do not.

### 3.4 Apply recalculates everything derived from config
Scramble pairs and team names, `inputs.startHoles`, MiserBall ranking (hole-played from each group's start), group list and "Groups & Starting Holes" on the event card, birdie coin duties, Skins/Turkey team keys, ante and pot (`players_count * ante`, ante check). Scores already keyed stay (keyed by player). Use the same derivations the Close dialog uses (`gatheringRowWithLiveTeams`, `gcActiveCards`) so live and close agree.

### 3.5 Removed players: quarantine, not delete
- A scorecard for a player marked Out is held aside, excluded from leaderboard and payouts, restorable. Generalises today's `gcActiveCards` filter and the v4.80.4 rule "players taken off a game are excluded even if scores were keyed".
- Group-mates get a notice on their scoring screen: "Troy is out, stop scoring him."
- No-show ante: refund by default (no-show leaves the pot); a withdrawal after holes played keeps the ante and counts played holes. Whether the refund is automatic or a host choice is open.

### 3.6 Change log and notifications
- Every Apply writes a log row: time, who, summary ("removed Tom Kobal and Troy Schwab; moved Team 11 to hole 6"). Visible to the host in the Live Panel and later in My History.
- Push only to affected players: "You're now in Group 4, start hole 7." Announcements are currently switched off by Brian (2026-11-16) and must be re-tested; build this on the existing per-player push used by Groups publish.

### 3.7 What stays locked at launch
Ante, prize structure, game list and rules. Changing money mid-round is a separate decision and not part of this screen.

### 3.8 Optional later: pre-launch check-in
One screen at the first tee: each player Present / No-show, with the same impact preview, launch blocked until all marked. Edit mode covers most of this, so build it second.

## 4. Where it touches code (proposed names, verify before building)
- Portal `source/portal.html`: Live Panel entry button and banner; edit-session screen reusing the Groups screen (`BFEngine.BFGroups` is shared); impact-preview function (pure, put in `bf_engine.js` so it is unit-testable); Apply handler; log list; `gcRemoveAdded` and `gcActiveCards` become callers of the shared "mark Out" logic.
- Engine `source/bf_engine.js`: pure `previewRosterChange(config, groups, draft)` (sizes, hole counts, orphans, errors) and `applyRosterChange` derivations.
- BFE Worker `source/bf_experiences_worker.js`: one atomic apply route (proposed `POST /bfe/gathering-roster/apply`, body = version + draft ops, rejects on stale version), a `gathering_roster_log` table (lazy-create like Plans), and a held-scorecards flag or table. Whether the groups store and the registrations store live behind the same Worker needs checking: registrations are POSTed to `GATHERINGS_API/registrations` (status `no`), groups publish has its own path, so Apply may have to fan out; keep it all-or-nothing or document the failure mode.
- Delivery rule: any Worker change is delivered as the Worker file for Brian to paste-deploy; Worker first, then reload the portal.

## 5. Tests to write
- Preview: orphan cases (solo, 3-some, pair leftovers), shotgun hole counts, errors vs warnings.
- Apply: pairs, `startHoles`, MiserBall order and pot/ante recomputed; scores kept; removed player's card excluded; restore works.
- Concurrency: stale version refused; second editor refused.
- Notifications only to moved players.
- Regression: Close dialog and leaderboard agree with live after a mid-round regroup.

## 6. Open decisions (Brian)
1. Orphaned partner default: solo team, or merged 3-some? (Merge is fairer in a scramble but changes the team count.)
2. No-show ante refund: automatic, or host chooses each time?
3. Editor: host only, or also a designated on-course co-host?
(Settled: scoring keeps running during edit mode; build edit mode first, check-in later; mid-round withdrawal can wait if it adds scope.)

## 7. Related shipped work in Dev-100 that this builds on
v4.80.3/4.80.4 (Close dialog can remove a no-show, with or without a card; removed players excluded even with keyed scores), v4.81.1 (commissioner can delete a scorecard from the score detail; use it to clear a no-show's bogus card).
