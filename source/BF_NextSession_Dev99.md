# Next session: Dev-99 (written 2026-11-11, end of Dev-98)

## State at the end of Dev-98 ("The BF Cup weekend", 2026-11-02 to 11-11)
- `main` = `0fc8edc` (engine 1.49.0, live panel v39). Worker deployed (noshow/mulligan). Nothing unmerged except the close docs, if "merge it" has not been said yet.
- **Portal label is stale:** `portal.html` changed (rail Photo/Video/Upload/Note always on, Results-list Cup card, Series banner off) but the header still says v4.52.8 and `source/portal_version.txt` is unchanged. Bump to 4.52.9 on the next portal change, in both `docs/portal.html` and `source/portal.html` (identical copies).
- Tests: per-file `node test_*.mjs` (run_all takes over 2 minutes). Known failures only `test_at_course`, `test_rail_drag`.
- **The Cup result:** Team Jake 8.5, Team Nate 7.5. Money not yet closed in the app (no `closed` key on `/bfe/cup` as of 11/11).
- Read `BF_Lessons_BFCup_2026.md` first (lessons, observations, BFE reuse ideas).

## Brian's own steps still open
1. Close Day 1 money, then Day 2 (host page `bf-cup-draft.html?event=2026%20BirdieFriends%20Cup&host=1`, PIN; event cards have expired, so type the URL). Reopen Day 2 first if a correction is needed.
2. Pay out. Weekend: $320 collected, $319 paid, $1 left over.
3. Turn off the memories switch in BFE-Admin; check whether the event needs a completed/archived status.
4. Click "Download the results" on `bf-cup-results.html` and send the file (becomes the frozen snapshot).

## Dev-99 candidates
1. **Frozen final record:** save the downloaded `bf-cup-results.json` as a static file; make `bf-cup-results.html` prefer it over the live Worker record.
2. **Money tab redesign** (Brian: "we did a poor job"): one weekend list of all 16 players (paid in, won, net), a Collected / Paid out / Left over line, round detail underneath, bigger text.
3. **Host Audit tab:** strokes, hole winners per nine, points, CTP and skins, payout reconciliation, flags (gross 1 on a par 4, Outs, missing holes). No more raw-JSON reads through WebFetch.
4. **Visible build stamp** (engine + panel versions) on the Cup page, to diagnose stale phone caches.
5. **Event wrap-up action:** close money in order, reconcile, freeze the snapshot, publish a Results-list card from config (the Cup card was hand-added in `portal.html`), retire banners.
6. Verify the Walli hole 2 gross "1" was corrected; Sunday hole 3 CTP was unclaimed (rolled into skins).
7. Brief tab money line lacks ante/payout numbers; the claude.ai briefing doc is stale.
8. Skins/money with a no-show was never verified on real data.
9. Cup vs GHIN handicap mismatches (the Cup keeps its own copy; Handicaps tab is the reference).
10. Unverified on real phones: rail Photo/Note upload, Teams tab, Results-list Cup card.
11. Still open from Dev-97: Turkey 2Man (11/15, Dev-96 thread), money-list payoutSnapshot differences, Series #7/#8 missing data, Groupings card flag, 2027 event-home design (`BF_Design_EventHome_Archive_2027.md`).

## Standing instructions
- Design first with Brian; stage on `claude-staging`; merge to `main` only on "merge it" / "build and merge".
- Worker changes are delivered as the Worker file (he deploys).
- Commit trailers: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and `Claude-Session: <session url>`.
- Minimal words in player-facing UI; plainspoken, cause-and-effect explanations; never state a rule Brian did not give.
- Do not mix Cup data into Series pages. Tell him "hard-refresh" with every page merge.
