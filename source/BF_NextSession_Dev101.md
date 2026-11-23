# Next session: Dev-101 (written 2026-11-16, end of Dev-100)

## State at the end of Dev-100 ("Turkey 2Man game day, payouts and the day after", 2026-11-13 to 11-16)
- `main` = see git log (v4.81.2 fix is the last portal commit); portal **v4.81.2**, `bf_engine.js` **1.56.0**. Main Worker (`worker.js`, v4.80.6 KV-budget fix) deployed by Brian. BFE Worker (`bf_experiences_worker.js`) changed during the session (Turkeys, MiserBall, scramble `prize` schemas via `node source/tests/sync_worker_schemas.mjs`); confirm with Brian that the current file is the one deployed.
- Tests: per-file `node test_*.mjs`; `run_all.mjs` takes about 3.5 minutes (run in background and poll). Known pre-existing failures only: `test_at_course`, `test_dupe_removal`, `test_rail_drag`.
- The Turkey 2Man (Gathering 104, Sun 11/15, 24 registered, 22 played, 12 scramble teams) was played, closed and paid out from the new whole-dollar list.
- Read `docs/BF_LiveEdit_Spec.md` (the Dev-101 build) and the Dev-100 entry in `docs/BF_Session_Log.md`.

## Dev-101 main item: Live Edit (host edit mode for roster and groups)
Designed with Brian 2026-11-16, spec in `docs/BF_LiveEdit_Spec.md`. Summary: after launch the host can open an edit session (scoring keeps running), draft unregister/move/start-hole/orphan-partner changes with a live impact preview, then Apply atomically; removed players' cards are quarantined; change log; push only to moved players. Money and game rules stay locked.
Ask Brian the three open decisions first: (1) orphaned partner default (solo vs 3-some), (2) no-show ante refund automatic or host choice, (3) host only or on-course co-host.

## Other candidates
1. **Test pass before the "1Man":** announcements were switched off by Brian (2026-11-16); re-test push and feed end to end (Groups publish, birdie alerts, Plans messages). Verify the whole payout flow once on a throwaway.
2. Host one-tap "No-show" control on the Live panel (subsumed by Live Edit if built).
3. Clean up leftovers from the 2Man: the bogus Tom Kobal and Troy Schwab scorecard rows (Brian can now delete them from the score detail as commissioner, v4.81.1), then Reopen and re-close to refresh the results card.
4. Decide whether to remove the collapsed "Full breakdown (+/-)" table from the results Summary entirely (it is only tucked away).
5. Phone-verify things that were sandbox-tested only: hole-by-hole flow, stale open phones after a regroup, Plans push.
6. Remaining Dev-100 candidates from `BF_NextSession_Dev100.md` (Plan announcements are built as v4.68.0; the rest stand): Plans beyond Gatherings, progressive Gatherings-first paint, registration change log, net scramble ranking.
7. KV budget: Cloudflare free tier is 1,000 list ops per day. The feed Worker now caches and throttles, but watch the email alerts; a paid KV plan is the fallback.

## Brian's steps still open at Dev-100 close
- Paste-deploy the BFE Worker file if not already done (see state above).
- Purge the two no-show scorecards and re-close the 2Man results if he wants the card clean.

## Standing instructions
- Auto-merge and push to `main` without asking (Brian, 2026-11-13) unless he says not to. Still design first with Brian for anything non-trivial.
- Worker changes are delivered as the Worker file (`SendUserFile`); he deploys it. Deploy order: Worker first, then reload the portal. Always show/deliver the file itself.
- Commit trailers: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and `Claude-Session: <session url>`.
- Bump `source/portal_version.txt` and mirror `portal.html`, `portal_version.txt` to `docs/` with every portal change; engine changes bump `?v=` in portal.html, docs/bf-cup-draft.html, docs/BFE-Admin.
- Minimal words in player-facing UI; plainspoken, cause-and-effect explanations; never state a rule Brian did not give. Brian's player identity is "Brian Hager".

## Dev-101 progress (2026-11-16, update)
- **Built (portal v4.82.0, engine 1.57.0, main Worker `worker.js` needs paste-deploy):** Live Edit v1. Spec `docs/BF_LiveEdit_Spec.md` sections 6 and 6b hold Brian's decisions (host decides orphans, no default; ante follows presence: no-show out of the pot, left-early stays; host/commissioner only; plan vs as-played; host confidence line).
- **How it is stored:** the as-played roster rides inside the published Groups document (`teams`, `out`, `planned`). Apply = ONE `POST /group-sets/gathering/:id/publish` with the whole draft and `if_version` (new, Worker change: stale editor gets 409 `code:'stale'`). The existing publish already pushes only players whose group or hole changed. No-show registrations are then set to No (best effort).
- **Readers:** `gatheringAsPlayed`, `gatheringRowWithLiveTeams` (as-played scramble teams win), `gcActiveCards` (no-show card excluded), `gatheringStartHoles` (already read the published set). Scramble engine now scores teams of size 1-4 (was exactly the event size): pot = players in, team prize splits equally among the players on the team, handicap = event method at the team's own size.
- **UI:** "Fix groups" button on the Live Panel (host or commissioner), `openLiveEdit` / `leRender` in portal.html. Open phones check the published version every 60 s (`liveGroupSetCheck`).
- **Not built / verify on phones:** player-side "Host is adjusting groups" banner; a separate who's-here screen (Fix groups is the exception path); refusing scores for an Out player at entry (scorecards do not store who keyed them; Close and boards already ignore a no-show's card); late-player add; change-log screen (dropped by Brian). Phone-verify: regroup mid-round on a throwaway Gathering, stale open phones, scoring screen for the moved group, Close after a regroup.
- **Brian's step:** paste-deploy `source/worker.js` (only the `if_version` check changed), Worker first, then reload the portal.
- **Swap and add (v4.83.0, engine 1.58.0):** Fix groups has "Replace..." (a no-show's team, group and start hole go to the recruit) and "+ Add player" (host picks: join a team, own team in a group, or a new group). Both use the existing course Add a player dialog, which registers the recruit Yes immediately (not part of Apply). The recruit is saved in the same Groups document (`added`). Worker unchanged since the `if_version` deploy.
- **Fix groups always available (v4.84.0):** the button shows for the host/commissioner on BOTH the Scorekeeping and Leaderboard sides of the Live Panel. If no groups were ever published, the plan is built from the registrations (Yes players, teams kept together, groups of up to 4, mode `tee_times`) and the first Apply publishes it with the change. Found by Brian's NoShow test on 2026-11-18 (the button was hidden because nothing was published).
- **Teams vs playing groups wording (v4.86.0, Brian 2026-11-18):** teams = partners; groups = who tees off together. Host card button and screen are "Playing groups" ("Build playing groups" / "Rebuild playing groups", helper line "Teams stay together. This sets who tees off together."). The step is hidden when everyone fits in one group (`gatheringNeedsGroups`: 4 or fewer Yes players and nothing published); the app treats that as one group. Live Panel button and sheet are "Fix teams & groups". Flow: register teams, groups are automatic when obvious, fix on the day.
- **Fix teams & groups button (v4.87.0):** moved to a quiet footer of the Live Panel (both sides), out of the scoring area, per Brian.

- v4.88.0: Fix teams & groups is now a centered, draggable window (title bar drags, position survives re-renders, no outside-tap close). Yellow hint strip changes with state (who isn't playing / what happened to X / tap a group / check and Save). "How it will look" summary card, teams as pills inside group cards, per-player actions (Didn't show / Replace / Left early / Move / Play on their own), sticky footer Save changes + Undo. Add a player overlay also centered and draggable (bfDraggable helper). venue dialog #vm-dialog not changed; ask Brian if that was the one he meant.

- Engine 1.59.0 / portal v4.89.0: audit of what reads the plan (start holes). Only Turkeys and MiserBall "longest survivor" decide results from it; scorekeeper hole order, coin duty, player "where you start" card and notices are display only; thru, skins, stroke, team prizes, Close do not read it. New BFEngine.effectiveStartHoles(cards, planned): a player's real start = first hole of their scored run (wraps 18→1); plan is fallback (nothing scored, all 18 scored, 9-hole cards, ambiguous gaps). Applied at top of computeRoundPayout. Principle (Brian): logic lives in the game formats, not the environment (shotgun/tee times/back-nine start); layers = tell players (groups), live collection (guardrails), environment, post-round calcs, host management. NEXT: smaller cascade tool (move group to hole with push-back, close-the-gap prompt, restore the hole_shared warning hidden in leRender), decisions pending from Brian: leave vs close empty hole, lock vs warn for groups already scoring.

- Portal v4.90.0: start hole is a SUGGESTION (Brian's decision: no cascade tool, no gap logic, no lock). Scorekeeper screen: shotgun group with no scores is asked once "Which hole are you starting on?" (host suggestion highlighted); choice stored in localStorage bf_sk_start_<key>; "Change" link beside "Your start hole" until a score exists. skStartFor order: confirmed hole → inferred from group's scores (BFEngine.effectiveStartHoles) → host plan → 1. Tee-time groups are not prompted. Fix window still has per-group "Starts hole N" (no push-back); restore the hole_shared info note in leRender (hidden by mistake) and consider trimming start-hole controls to an optional note. Group sizes 1-5 stay; groups remain host-managed via the Fix tool.

- DROPPED ON PURPOSE (Brian, 2026-11-18): no "Host is adjusting groups" player banner (broadcasts would confuse unaffected players; only players whose group/hole changed get the existing notice) and no shared-hole warning (two groups on a hole are separate micro-worlds). Do not rebuild. Remaining: phone verification at the 1Man (regroup mid-round, stale phones, Close after a regroup); Brian will text issues from the course.

- Portal v4.91.0 / engine 1.60.0: HOST-SET TEAMS ARE THE MASTER (Brian). Scramble config gets teams_by ('host'|'players'). hostSetTeamsFor(gid) + teamsState wrapper (old logic = teamsStateFromPicks): host-set teams win on the card, partner prompts, Players sheet, live panel and Close (gatheringRowWithLiveTeams reads teamsState); a host team with a member who is not Yes is incomplete (member shows "needs a partner"). Games form: teams_by set at save by gamesFormTeamsBy (hand-made/changed teams = host; same as players' picks = players; clearing all = players); form no longer overwrites host teams from registrations. Registration skips the partner question and Change-partner is blocked when host-set; player card says "Your host is setting the teams". BFE Worker needs REDEPLOY (schema header carries teams_by; without it the flag is dropped on save). Root cause found: the panel/Close read teams from registrations, so teams built only in Games config were invisible (panel said "Nobody is set up").

- Portal v4.92.0: ✏️ "Fix teams" icon on the host's event card icon row (liveEditCardBtnHtml, after Games; host/commissioner, Gathering cards only, not past/closed/canceled). Same tool as the live panel footer. Brian's concern: hosts may be confused by yet another config link (event config vs game details). Naming rule: label by the job ("Fix teams"), not by config. Still to do: tuck Build playing groups behind "Start over" after first publish; add if_version to the Groups screen publish.

- Portal v4.93.0: event card 'Round in progress' status restyled (was dim green text on the green card): dark strip, green left accent, white title, brighter detail. Wording 'Tap the banner at the top to enter scores'.

- Portal v4.94.0: in-progress strip runs the full card width (margin 0 -18px -18px) so it lines up with the Leaderboard row and banners.

- Portal v4.95.0: Host panel (My Gatherings) cards: ONE dark primary button by state via hostCardPrimary (live: Fix teams; setup: Games -> Playing groups -> fill the field -> none). Fix teams button added to the card (when anyone is registered). While live, Invite/Open to all/Repeat/Template/Cancel/Delete fold behind a More toggle (toggleHostMore). Colors: dark = next step, light = other, yellow = needs action, pink = destructive.

- Portal v4.96.0: players the host marked out cannot be scored (Brian: an unregistered player must not be able to record scores). skIsOut reads published.out; skGroups hides them from the scoring screen; skSetScoreOne refuses with a toast; skPost re-fetches the group set at most every 20s before saving and drops the score if the player is now out. No-show registration sync retries 3x (liveEditSetRegNo); leftovers kept in localStorage bf_le_regpending and retried on each live-panel refresh (liveEditRetryPending). Open: no-show on a host-set team (Brian thinking), Groups screen if_version stale check (low priority), real-event dry run.

- Portal v4.97.0: Groups screen 'I'll place the players myself' (groupsStartManual): empty groups sized to the field (start holes/times pre-filled), everyone in 'Not in a group', host places with the row menu or drag handle. For the 1Man (individual, groups of 3). Note: row menu (groupsMenu) still uses the bottom-anchored openHostSheet.

- Portal v4.98.0 / engine 1.61.0: Groups settings 'Hole spacing' (Spread out | Every hole). start_pack in BFGroups.schedule/suggest rules: back-to-back starts 1,2,3... (A/B doubling only when groups > holes). Brian's 1Man: every hole.

## v4.99.0 — Playing groups panes scroll independently
- The "Not in a group" pool and the groups list are now separate scroll boxes (`.grp-pane`, ids `grp-pool-pane` / `grp-groups-pane`; 60vh, 28vh/42vh on phones).
- Touch drag auto-scrolls whichever pane is under the finger (not just the pane the drag started in), so the last groups can be reached.
- Full suite: only the four known baseline failures.

## v4.100.0 — Tee box on the Playing groups setup (engine 1.62.0)
- Decision (Brian): no automated tee rules (handicap/age variants are too many). Just a plain-words Tee box on the Groups setup.
- Setup row: one tee for everyone (Black…Silver, None, Other…); a player's ⋯ menu sets that player (or team) to a different tee. Saved in the Groups doc as `tee_default` + `tees{lowercased name: tee}`; no Worker change (doc is stored as JSON).
- `BFGroups.of` returns `tee`; the player's event-card banner shows "Group 3 · start on hole 7 · Blue tees". Not used in scoring. Tee-for-handicap stays in the Games form (net).

## v4.101.0 — Refresh from registration on the Playing groups screen
- 🔄 button re-reads registrations and takes dropped players out of their groups on screen (unsaved edits kept). New Yes players are NOT auto-placed; they wait in "Not in a group". Says plainly if the registration list could not be reached.

## v4.102.0 — Prizes: overall + flights, several places (Individual Low Score; engine 1.63.0)
- Games → Individual Low Score → "Places & flights". Config `lowscore.podium = { flights:[{id,name,tees[]|players[]}], prizes:[{scope:'overall'|flightId, place 1-5, amount | pct}] }`. Schema type `podium` (validateFields/cleanFields; Worker embeds it, so **bf_experiences_worker.js must be redeployed before saving a prize table**, an old Worker would silently drop `podium`).
- Calculator (`lowscorePodium`): each scope (Overall + each flight) ranks complete rounds; ties share the places they cover (whole dollars, odd dollars reported); a player can win overall AND in their flight; table over the pot scales every prize and flags it; unpaid prizes/odd dollars go back to everyone via giveBack.
- Flight membership = one function (`flightOfPlayer`): by tee box from the published Groups (`teeByPlayer` via `payoutExtra`/`gatheringTeesByPlayer`) or by name list. New ways (handicap, age) are new cases there only.
- Results tab shows each prize with its winner(s); period other than Round turns prizes off. Next games (Scramble place_shares already has its own) could reuse `lowscorePodium`.

## v4.103.0 — Prizes is its own game (pot-level podium, any game type); engine 1.64.0
- Supersedes v4.102.0: the prize table is no longer inside Individual Low Score. New game `podium` ("🏆 Prizes", group Prizes, picked in Games like any game; own $/player into a prize pot).
- Config `game_configs.podium = { dollar_per_player, rank_by: auto|round|scramble|fourball|altshot|hilo|lowscore, basis, table: { flights:[{id,name,tees[]|players[]}], prizes:[{scope:'overall'|flightId, place 1-5, amount|pct}] } }`. Worker redeploy needed (schema is generated from the engine; delivered to Brian).
- Calculator (`ADDONS.podium`, order 27, after the games, before Skins): `state.results` lets it read the standings of the games before it. Ranks rows from the chosen source ('round' = each player's own total, gross/net; a game = its standings, teams are one entry, stableford = higher wins; 'auto' = first ranked game else round). Overall + each flight paid separately; ties share the places they cover (whole dollars, odd dollars reported); table over the pot scales every prize and flags it; unpaid prize money goes back to everyone. Money lands in ledger field `podium` (payouts table column, results tab "🏆 Prizes").
- Flight membership = `flightOfPlayer` (tee box from the published Groups via `payoutExtra`/`gatheringTeesByPlayer`, or a name list); a team is in a flight only when all members are. New flight rules (handicap, age) are new cases there only.
- 1Man: Scramble (Players per team = 1, $0 of its own) + Prizes ranked by Scramble (or Automatic). BF Series can feed the same `ADDONS.podium` / `prizeRows` later.
- Known gaps: payout-table team splitting for Prizes only covers Scramble teams (the portal's existing split); not yet run end to end on a live team-of-1 Scramble event.

## v4.104.0 — Scramble Pays → "Flights & places"
- Scramble Pays step has a 4th option, "Flights & places": zeroes the Scramble's own pot, turns the Prizes game on (rank_by 'scramble') and jumps to the Prizes screen. Picking any other Pays option turns Prizes back off. Money step hides the Scramble podium card in this mode (Prizes row carries the money).
- Engine unchanged (1.64.0); no Worker change beyond the v4.103 file (podium schema) which must be deployed.
- Still to verify: reopening a saved config shows "Flights & places"; team-of-1 Scramble + Prizes through live scoring/Close.

## v4.104.1 — Prizes screen was blank
- The whole Prizes section sat inside `.gw-money` (hidden on every wizard screen but the last). Only the $ per player row is money-only now; flights/places/ranked-by show on the Prizes step. Rule: anything a host configures on a setup screen must not live inside `.gw-money`.

## v4.105.0 — custom tee boxes in Prizes flights
- Flight tee picker now offers custom tees (any already in a flight or typed in Playing groups) plus an "Other…" button. Matching is case-insensitive on the tee name, so it must be spelled the same as in Playing groups.

## v4.106.0 — Prizes pot derived from the places
- Prize places are typed in dollars; the prize pot = sum of places, and `dollar_per_player` is computed (ceil to the cent over Yes count) by `pzSync()` (runs on every table edit and when the money step builds). No $/player retype. Money step Prizes row is a read-only total; Skins takes the remainder as before. Presets are dollar amounts (~40% of buy-in pot, rounded to $5).
- Older tables with % places keep the typed $/player input (pzHasPct).
- Tee flights, ranking and the engine are unchanged.

## v4.107.0 — live leaderboard follows the Prizes config (engine 1.65.0)
- `BFEngine.prizeBoard(row, cards, pars, teeByPlayer)`: per scope (Overall + each flight) live rows from partial cards, ranked by the Prizes' source game or each player's round, each row carries today's prize. Flights use the published tee boxes (same `flightOfRow`).
- Leaderboard sheet: when the event has Prizes, shows leader chips (one per scope, tap to switch), a "You: 1st Green · T3 Overall" line, By score / By holes played sort, prize pills on paid rows and a PAID PLACES divider. Card row now also shows for a Prizes-only event. Events without Prizes keep the old board.
- Worker file regenerated only for the schema-header version string (no behaviour change); redeploy optional.
- Net basis on a round-ranked Prizes shows gross live (note says so); net applies at Close.

## v4.107.1
- MiserBall money card shows its total and % of pot in the right margin like the others; "Play it by team" is hidden when the Scramble is team size 1 (a team of one is the individual game).
