# BirdieFriends test suites (`source/tests/`)

Started in Dev-87. These test the **real functions inside `source/portal.html`**: `extract.mjs`
parses the page's inline scripts with acorn and pulls named function declarations out by name,
so every test runs against the shipped source, not a copy.

**Run:** `cd source/tests && npm install && node run_all.mjs` (Node 18+).
`test_rail_drag.mjs` drives a real Chromium through Playwright. Set `BF_CHROMIUM` to a
Chromium binary if it isn't at `/opt/pw-browsers/chromium`, or it's reported as skipped.

| File | Covers |
|---|---|
| `syntax_check.mjs` | Every inline `<script>` in portal.html parses |
| `test_gathering_payout.mjs` | `computeGatheringGamesPayout`: Skins (gross, outright, ≥2 scores), CTP (unclaimed → Skins), BirdieBall (kept / held longest / give-back), round-down, conservation |
| `test_gathering_close_ui.mjs` | Close & Calculate sheet, save payload, host gate, My History results + Reopen, aged-out Gatherings |
| `test_birdie_payouts.mjs` | Birdie Payouts add-on: birdie-or-better count vs par, flat $ from the pot before Skins, cap, 9-hole back nine, no-par-data, conservation fuzz, old snapshots unchanged, Host Panel form/save payload, results + event-card details, Worker wiring |
| `test_game_registry.mjs` | Dev-93 conformance loop over every registered game: required members, config schema, fixtures reproduce exact payouts, validator, generic pot-fit guard wording, 400-round conservation fuzz |
| `test_worker_game_configs.mjs` | Dev-93 R3: BFE Worker validates/stores game configs through the schemas generated from bf_engine.js; legacy column shapes unchanged; generic `game_configs`; works before the migration; fails if the generated block is stale (`node sync_worker_schemas.mjs` regenerates it) |
| `test_fourball_form.mjs` | Dev-93 Fourball step 3: Games-form section (pair editor, Gross/Net + Own/Off-the-low, ✨ Suggest pairs, pot preview, over-commit, save payload incl. `game_configs.fourball`) and `recommendPairs` unit tests |
| `test_rail_cancel.mjs` | Dev-93: At-the-course rail off switch sticks past tee time; cancelled events never launch the rail or the Live Panel (test rounds excepted) |
| `test_fourball_live.mjs` | Dev-93: Fourball live board (partial cards, to-par ranking, net, agrees with the Close winner) and the Live Panel section |
| `test_fourball_segments.mjs` | Dev-93: Fourball pot variants: segments, strokes vs holes won, foursome vs field, pushes, match view |
| `test_live_scoring.mjs` | Dev-93: live scoring (Score mode): foursome groups, initials, merge, save per tap, offline retry, BF Series untouched |
| `test_live_panel_sections.mjs` | Dev-93: Live Panel sections follow the round's games; a non-gamed round (BF Series) keeps the classic panel |
| `test_score_mode.mjs` | `evtScoreMode`: any gamed Gathering captures strokes |
| `test_ctp_d1.mjs` | Gathering CTP on D1 (load/submit/undo) vs Series on Jotform |
| `test_at_course.mjs` | At-the-course rail: location gate, beta gate, test mode (expiry, tap-off), auto-tuck with Live Panel |
| `test_rail_drag.mjs` | Rail drag/snap/persist in real Chromium |
| `test_venue_admin.mjs` | Shared tee summary: admin stored tees + player venue viewer |
| `test_venue_dialog.mjs` | v4.24.0 Venue Manager: course list (search, Needs setup), one dialog per course, tee / hole-handicap editor (duplicate-handicap check, manual save payload, add by hand) |
| `test_tee_par.mjs` | v4.25.0 par from the tee: default-tee pick, tee-first `csResolvePars`, Vs Par fill rules, ⭐ save keeps catalog, Par editor modes, Birdie Payouts `pars_by_player` (engine, schema, form) |
| `test_gc_search.mjs` | GC-API search status persistence, name-variant retry, 429 quota message |
| `test_side_games.mjs` | v4.26.0 Match Play + Alternate Shot: `matchSegmentResult` (early 3&2, halved, live), pots, play-on, $0, off-the-low vs full, A-S one score per pair, live mirroring, results tabs |
| `test_hilo.mjs` | v4.28.0 Hi-Lo: 2 points a hole (low + high), ties give nobody the point, push on level, periods, net off the low, match view / headline, form blank/load, wizard steps |
| `test_side_results.mjs` | v4.26.5 A-S / Match Play results: story (lead changes, biggest lead), hero card text (3&2, strokes, $0 buys, halved), hole strip, no individual ranking for one-ball rounds |
| `test_game_traits.mjs` | v4.27.0 registry traits are consistent; live/results/strokes screens never hard-code Alternate Shot / Match Play; multi-side-game chooser; engine match story |

`moselem_tees.json` is a snapshot of Moselem's four real tees (2026-09-24), used as fixture data.

**When a test starts failing after a portal change:** check whether the behavior changed on
purpose (then update the test and say so in the session log) or by accident (then fix the code).
