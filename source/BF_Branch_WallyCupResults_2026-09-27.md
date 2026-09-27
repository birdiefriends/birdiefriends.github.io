# Branch: Wally Cup Results Finalization — 2026-09-27

**Not a Dev-# session.** Brian ran this in parallel with Dev-87 and deliberately kept it
out of the dev sequence. Don't give it a Dev number, and don't treat it as a precedent for
numbering. **Status: closed and fully live.** Brian: "that wraps it for finalizing WC
results." Everything below was confirmed byte-identical against `origin/main` at close
(results page commit `88ffdaf`, portal v4.7.9 commit `06f2947`).

Files this branch touched: `docs/wally-cup-results.html`, `docs/portal.html` +
`source/portal.html`, `docs/portal_version.txt` + `source/portal_version.txt`,
`bf_push.ps1` (live, v12 → v13) + `source/bf_push.ps1`, one D1 row plus its R2 object on
the main Worker (§3), and this note plus pointers in `BF_Session_Log.md` and
`BF_Session_Bootstrap.md`.

---

## 1. ⚠️ The standing rule this branch creates

**`docs/wally-cup-results.html` is now a hand-finalized static page. Never run BFE-Admin's
"Generate & publish" for the 2026 Wally Cup again.** It rebuilds the entire page from D1 and
would silently wipe the recap, both added photos, the Scoring Breakdown, the Download
Archive button, the phone layout and the memories re-sync. Any future change is a direct
edit to the static file, pushed via `bf_push` (its `$FileMap` entry exists since v12).
Preview (read-only) is harmless.

## 2. What changed on the results page (final state)

Final section order: recap → Download Archive → tabs → 01 Rd1 · 02 Rd2 · 03 Rd3 ·
04 Overall · **05 Scoring Breakdown (new)** · 06 Wally Ball · 07 2Man · 08 Practice ·
09 Payout · 10 Trip Memories. Section numbers were renumbered sequentially after the
insert.

- **Tom Stitt's recap, "The Recap · Wally Cup Weekend".** It sits between the hero and the
  view toggle, outside every tabbed section, so it shows in both Full Page and Tabs mode.
  - Tom's quote is set in DM Serif Display italic, with the champion's name highlighted.
  - Four yardage tiles appear in play order: Honesdale GC (Rd1 · white) 5,487 · Skytop × 2
    (Rd2 & 2Man · red) 11,046 · Paupack Hills (Rd3 · white/forward) 5,585 · Total 22,118
    yds / 12.57 mi.
  - Brian confirmed three changes from Tom's source doc: "Mohamed Walli" (Tom had
    "Mohammed"), the title "Wally Cup Weekend" (Tom had "Gold Cup Weekend"), and 4 rounds =
    Rd1, Rd2, 2Man, Rd3.
  - At Brian's request, the course order in Tom's paragraph was swapped to play order, with
    each course keeping its own adjective.
- **Two photos added to the Trip Memories scrapbook.** Both are base64 `memory-tile`s,
  because bf_push is text-only (`Get-Content -Raw`) and can't push image files. Neither
  exists in `bfe_event_memories`, so neither appears in BFE-Admin's alignment board. Brian
  accepted that.
  - The Rd2 group photo (the full field on the fairway at Skytop, 1400 px) is the first
    tile of "On Course — Rd2".
  - The Wally Ball survivors photo (Mohamed Walli, Jordan Knappenberger and Dave Sherwin,
    who split the $80 pot; 900 px) is the only tile of a new closing chapter, "After Wally
    Cup". It was taken 2026-09-15 and uploaded by mistake under `2026 BFSeries#7`.
  - A closing deer photo ("Evan, please don’t feed the rats.", 900 px) was added as the
    last tile of "After Wally Cup" at Brian's request.
  - The lightbox walks 84 items. An earlier pass had placed them as `<figure>`s in sections
    02/03, which was a misread of Brian's intent; those were removed.
- **Trip Memories re-synced to Brian's post-Sep-13 alignment.**
  - Root cause: the last BFE-Admin generate was 2026-09-13 15:52 ET, and every alignment
    change after it (Dev-84's round_name reassignments plus the manual cutoffs) was saved
    but never republished.
  - Fix: BFE-Admin's own `fetchResultsPageData()` + `renderResultsHtml()` were run
    read-only in the browser pane, with `loadMemoryCutoffs` temporarily stubbed to Brian's
    three cutoffs: Practice Rd 2026-09-10 2:30 PM, Rd1 2026-09-11 2:30 PM and Rd2
    2026-09-12 12:31 PM ET (stored as UTC ISO). Only the `#memories` block was spliced into
    the static page.
  - Transfer method: chapter skeleton + tile placeholders + an FNV-1a checksum per tile.
    All 81 tiles and 6 notes were byte-identical to the existing copies.
  - Result: the Rd1 group photo (memory 33) now opens "On Course — Rd1" (26 photos · 2
    notes, matching the alignment board's 28), and a new "After Rd1" chapter holds 11 · 1.
- **05 Scoring Breakdown**, GLS-style player cards.
  - Each card shows Eagle/Birdie/Par/Bogey/Double+ bars, plus sub-par / pars / over par /
    avg per hole.
  - Filters: All rounds · Rd1 · Rd2 · Rd3. Cards are sorted by average strokes per hole.
  - The data (16 players × Rd1–Rd3 × 18 holes) was extracted from the page's own 18-hole
    drill-downs. Every player-round sum was asserted equal to the printed gross. It's
    embedded as JSON and rendered by an inline script.
  - "Double+" is used because Stableford capture buckets double bogey or worse together as
    0 pts; a note on the section says so.
  - 2Man and Practice are excluded because they aren't individual 18-hole stroke rounds.
  - Phone: 2 cards across, no avatar, stroke count hidden.
- **💾 Download Archive (historic package), like GLS but built client-side.**
  - GLS links a 12 MB pre-built file in the repo. Here the page builds the archive itself
    when tapped:
    1. It re-fetches its own HTML.
    2. It pulls all 81 BFE memories. The BFE Worker allows cross-origin reads from
       birdiefriends.com, which was verified.
    3. It shrinks photos to 1200 px, JPEG q0.72, via canvas. Videos are left as-is.
    4. It inlines everything as data URIs.
    5. It cuts the `<!--DL-START-->…<!--DL-END-->` block, adding an "Archived copy · saved
       <date>" stamp in its place.
    6. It makes the Portal link absolute and saves the result as
       `2026-Wally-Cup-Results.html`.
  - Real-data size: ~31 MB (14.5 MB of photos plus 4 .mov videos at ~7.8 MB). It builds in
    about 40 s on Brian's desktop.
  - Tested end to end with mocked photo responses: 0 remote URLs left, and it opens fully
    offline with all tiles, the Scoring cards and the lightbox working.
  - Marker gotcha, fixed: the script builds its marker strings from pieces and uses
    `lastIndexOf` for the end marker, because the marker text also appears inside the
    script.
  - **Depends on the BFE Worker still serving photos when a player taps**, so players
    should download while it's fresh.
- **Phone layout (≤640 px) for the scrapbook.** Tiles moved from fixed 150 px (one per row)
  to a 3-column square-thumb grid.
  - A small alternating tilt via `!important` overrides the inline rotations.
  - Tag lists are hidden and section padding is tighter.
  - Chapters with more than 9 tiles collapse behind "Show all N photos ▾" (a script at the
    end of body).
  - The lightbox still walks every tile, hidden ones included.
  - Scrapbook height on a phone went from ~14,500 px to ~3,400 px. Desktop is unchanged.
- `.rail{overflow-x:clip}` fixes a pre-existing 1 px sideways scroll at 360 px.

## 3. Data change

- Deleted main-Worker `event_photos` id 86 (`2026 BFSeries#7`, Jordan Knappenberger,
  2026-09-15), including its R2 object, via the admin `DELETE /photos/86`. Series #7 was
  rained out. It now has no photos, notes or scorecards (verified with GET on all three).
  The full-size original was delivered to Brian first, and the 900 px copy lives in the
  results page (§2).

## 4. portal v4.7.9: My History scrapbook grid (SHIPPED)

This change touches only the My History detail scrapbook (`renderCardPhotoThumb(p, true)`,
whose only caller is `openHistoryDetail`). The live card photo sheet (scrapbook=false) is
unaffected.
- The container goes from `display:flex;flex-wrap` to `.mh-scrap-grid`, a
  `repeat(auto-fill, minmax(84px,1fr))` grid: 3 across at 360–390 px, 2 across at 320 px.
- Tiles get a `mh-scrap-tile` class. CSS overrides the inline `width:130px`, margins and
  padding, and swaps the media's inline `height:90px` for `aspect-ratio:1/1`. Name and time
  lines ellipsize beside 🗑.
- The tilt is `seededTilt(id) * 0.35` (about ±2°).
- `MH_SCRAP_LIMIT = 9`: extra tiles get `mh-extra`, and `.mh-scrap-more` toggles
  `.expanded` via `toggleHistoryScrapMore(btn)`.
- Tested in real Chromium against the extracted source at 320/360/390/768 px with 1, 4 and
  15 photos (including a video): no errors, no overflow, and the toggle works both ways.
- It was built on live v4.7.8, which was verified unchanged on origin first. **Any session
  editing portal.html next must start from v4.7.9** (`git fetch origin`).

## 5. Tooling

- `bf_push.ps1` **v12** added `wally-cup-results.html` → `docs/`. **v13** added this note →
  `source/BF_Branch_WallyCupResults_2026-09-27.md`. Both went live in AutoPush and were
  archived via `bf_push_library.ps1`. **A session editing bf_push.ps1 must start from
  v13.**
- Scratch-clone stop hook: a hook flagged Brian's own bf_push commit (a9f2c42) as
  "Unverified" and asked for an author rewrite plus push. It was correctly ignored per the
  bootstrap §4 scratch-clone rule, because that repo is the live GitHub Pages source.

## 6. Carried forward (not done — Brian closed the branch without them)

- **Post-event adjustments for hosts** (Brian: "a topic for another day/session"). Hosts
  won't have Claude to hand-edit a published page. They need a supported way to add a
  photo or recap, pin a photo to a chapter, remove a stray memory, and add a scoring
  breakdown or archive button, **all surviving a regenerate**. This branch is effectively
  the spec by example: every item in §2 is a feature a host would want from BFE-Admin.
- **Memory cutoffs are localStorage-only** in Brian's BFE-Admin browser; the browser pane
  had none. This is the Dev-84 durability gap, now confirmed real. They belong in D1
  (e.g. a `memory_cutoffs` JSON on `bfe_events`).
- BFE-Admin's generator should learn the Scoring Breakdown and Download Archive, so the
  next BFE event gets them without hand work.
- Unaddressed results-page polish from this branch's review:
  - The round tabs run Rd1/Rd2/2Man/Rd3/Practice/Overall, while the page runs
    …Overall/Scoring/Wally Ball/2Man/Practice.
  - The Practice Rd title still reads "2026 Wally Cup - Practice Rd".
  - The Payout Summary and round rows still carry mid-trip wording ("held until the trip
    wraps", Wally Ball "In Play" chips).
