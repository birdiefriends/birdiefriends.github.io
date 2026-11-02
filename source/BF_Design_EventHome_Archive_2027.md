# Design note: one home per event, and a built-in archive (for 2027)

Status: NOT BUILT. Written 2026-11-02 after the 2026 BFSeries wrap-up.

## Why
The 2026 Series is shown on three separately generated pages (Results, Standings, My Series) plus Groupings and the Cup pages. Each page generator carries its own copy of the rules (for example the Season Pot logic had to be added to Standings, then again to My Series). Data lives in one browser's localStorage and the published HTML. Pieces grew "as we go" and are now spread across the app. The 2026 archive had to be assembled by hand from these pages.

## Principles
1. One home per event. Every BFE event (the Series becomes a BFE event type in 2027) has ONE page at a stable address, for example `/e/2027-series-3`, with tabs inside it: Results, Standings, My Game, Groupings, Money, plus the story/wrap-up. The Series itself is an event of type "series" whose page holds the season pot, final standings and wrap-up.
2. One record, many views. Everything is rendered from a single event record (roster, scores, payouts, handicaps, settings, notes). Pages only display. The Worker/D1 side already works this way for BFE events; the Series should use the same path instead of localStorage plus generated HTML.
3. One copy of the rules. Ranking, quota, payout and Season Pot logic live in `bf_engine.js` (tested once). The GS and the pages call it.
4. Archive is a button, not a project. Closing an event or season packages one self-contained file (the 2026 archive is the template): all views, the data as JSON, a note of the app version. No hand assembly.
5. Old addresses keep working: `/standings.html`, `/results.html`, `/mygame.html` redirect to the current event page.

## Suggested order
1. Move Season Pot, standings and My Series ranking rules into `bf_engine.js`; keep the three pages as thin views (tests already cover the maths).
2. Define the event record (one JSON shape) and store it in D1 via the Worker.
3. Build the single event page with tabs; point the old pages at it.
4. Add "Close event" / "Close season" that writes the archive file.

## 2026 archive as built
See the 2026 entries in `BF_Session_Log.md`. The builder is `source/tools/build_series_archive.mjs` (one-off script, no tests yet).
