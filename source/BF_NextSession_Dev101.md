# Next session: Dev-101 (written 2026-11-16, end of Dev-100)

## State at the end of Dev-100 ("Turkey 2Man game day, payouts and the day after", 2026-11-13 to 11-16)
- `main` = `59a4b76`; portal **v4.81.1**, `bf_engine.js` **1.56.0**. Main Worker (`worker.js`, v4.80.6 KV-budget fix) deployed by Brian. BFE Worker (`bf_experiences_worker.js`) changed during the session (Turkeys, MiserBall, scramble `prize` schemas via `node source/tests/sync_worker_schemas.mjs`); confirm with Brian that the current file is the one deployed.
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
