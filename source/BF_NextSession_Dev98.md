# Next session: Dev-98 (written 2026-11-02, end of Dev-97)

## State at the end of Dev-97
- `main` = `d1c8229` (portal v4.52.0, GS v8.67, engine 1.44.0). Nothing unmerged. Tests: `cd source/tests && node run_all.mjs` (run in the background, it takes over 2 minutes).
- The stop hook "N unpushed commits" message is STALE (it compares against `main`). Verify with `git ls-remote origin claude-staging` versus `git rev-parse --short HEAD`.
- Live: the 2026 Series wrap-up (`/series-2026-wrap.html`), the archive (`/bf-series-2026-ARCHIVE.html`), the Home banner, the Results screen groups, the landing-page card, and the push broadcast "Open this page" field. Brian sent the announcement push on 11/2.

## DONE: the final Series pages are published (11-02, verified live)
Standings (Season Pot tab FINAL, Money column), results and My Series (Final results card) carry the final flag. Nothing to do. To republish: GS 7 · Series > Season Pot settings > (Season is over ticked) Save settings > Publish All Pages (Save to Series is not needed unless an event changed).

## Things to check or decide
1. BF Cup weekend 11/7-11/8 (BSGC): confirm the draft state on `/bfe/cup` (built-in browser only), the Saturday pairings, the Sub swap, and captain links have never been run on the real Cup. The practice copy "2026 BirdieFriends Cup (practice)" still exists in D1 (harmless). BFSeries and BFCup are unrelated apart from the performance data (Brian's rule): never mix Cup data into Series pages.
2. Money list: the Money tab recomputes skins, the per-event `payoutSnapshot` shows different totals (Bill Steirer $254.33 vs $260, Scott Justus $260.29 vs $256). Check against cash actually paid and decide which is the truth, then align.
3. Series #7 and #8 are not in the data (only #2,3,4,5,6,9,10); only the last event has a results page on the site, so the archive has Series #10 results only.
4. The wrap-up page claims BJ's "second title (2024, 2026)" came from Brian, not the data.
5. Groupings card on the Results screen is hidden by `RESULTS_SHOW_GROUPINGS = false`; flip it (or make it follow the next Series event) for 2027.
6. The Home banner is `SERIES_WRAP` in portal.html: retire (`on:false`) or point it at the next story when 2027 starts.

## Ideas parked (not asked for today)
- Player stats: aggregate across events and capture game data (Brian: "not today"). My Game (in app) already has hole-level stats; My Series is the quota/score page.
- 2027: one home per event, one event record, one copy of the rules, archive as a button. See `BF_Design_EventHome_Archive_2027.md`. Archive builder: `source/tools/build_series_archive.mjs`.
- Announcements card cannot show the tap link of a push (Worker feed stores title and body only); a Worker change would be needed.

## Standing instructions
- When a Worker change needs pasting, deliver the Worker file itself. (None pending.)
- DIRECT mode never writes into the AutoPush folder unless Brian says "use AutoPush".
- Brian says "merge it" to approve; staging first for anything that reaches every member.
