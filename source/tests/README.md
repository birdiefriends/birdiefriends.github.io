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
| `test_score_mode.mjs` | `evtScoreMode`: any gamed Gathering captures strokes |
| `test_ctp_d1.mjs` | Gathering CTP on D1 (load/submit/undo) vs Series on Jotform |
| `test_at_course.mjs` | At-the-course rail: location gate, beta gate, test mode (expiry, tap-off), auto-tuck with Live Panel |
| `test_rail_drag.mjs` | Rail drag/snap/persist in real Chromium |
| `test_venue_admin.mjs` | Shared tee summary: admin stored tees + player venue viewer |
| `test_gc_search.mjs` | GC-API search status persistence, name-variant retry, 429 quota message |

`moselem_tees.json` is a snapshot of Moselem's four real tees (2026-09-24), used as fixture data.

**When a test starts failing after a portal change:** check whether the behavior changed on
purpose (then update the test and say so in the session log) or by accident (then fix the code).
