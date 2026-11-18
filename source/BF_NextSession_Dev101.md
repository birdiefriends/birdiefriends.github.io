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
