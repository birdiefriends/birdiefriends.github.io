# Next session: Dev-100 (written 2026-11-13, end of Dev-99)

## State at the end of Dev-99 ("Turkey 2Man game day: Groups, the hole-by-hole flow and Plans", 2026-11-11 to 11-13)
- `main` = `bcbacc6`; portal **v4.67.0**, `bf_engine.js` **1.56.0**. Main Worker (`worker.js`) and BFE Worker both deployed by Brian (Plans routes included).
- Tests: per-file `node test_*.mjs`; `run_all.mjs` takes about 3.5 minutes (run it in the background and poll). Known pre-existing failures only: `test_at_course`, `test_dupe_removal`, `test_rail_drag`.
- **Turkey 2Man runs Sun 11/15, 9:00 AM shotgun, Blue Shamrock, Gathering 104** (11 teams, 22 players, gross, $20 buy-in, podium $80/$40/$20, CTP $20 x 5 paid holes with #17 no-cash, Skins the balance). Plans on it: a Breakfast plan (opt-in) and the Awards Party (count-me-in).
- Read `docs/BF_Plans_Spec.md` for Plans, `docs/BF_Session_Log.md` (Dev-99 entry) for the full list.

## First thing: what actually happened Sunday
Ask Brian how the 2Man went before starting anything new. Things that were only sandbox-tested and need a real-world verdict:
1. Hole-by-hole flow on real phones (score, CTP on #3, MiserBall, shotgun start order), and a player dropping mid-round.
2. Automatic birdie/eagle alerts and the Leaderboard on the card.
3. The first real Close & Calculate: Podium $140, CTP $100, Skins $200.
4. The Plans push to 22 players, the "Are you in?" prompt, the awards-party count.
5. Whether Groups needed a last-minute change after publish (Preliminary and Final both drive scoring; stale open phones after a regroup are unverified).

## Dev-100 candidates
1. **Plan announcements (agreed design, not built):** a "Message attendees" button for the plan creator and host; one push to Yes and Maybe players; the latest message pinned on the plan card with a timestamp; about 3 messages per plan per day; one-way, no SMS, no contact info. Push reaches only players with notifications on, so the pinned line is the fallback.
2. **Plans beyond Gatherings:** Series and Cup events (container is keyed by `gathering_id` today; a scope key would generalise it). Plan modules (notes, checklists) after the shell.
3. **Plans gaps:** a creator who unregisters keeps their plan (host decides); a host removing a player does not open the unregister dialog (the Worker count safety net still applies); no push when a plan is edited or cancelled.
4. **Progressive Gatherings-first paint on load** (slow start is mostly the legacy Jotform fetches). The loading state is in; real progressive paint is not.
5. **Registration change log** (`registered_at` is overwritten on every change, so "when did X say Yes" cannot be answered).
6. Skin status lines on alerts; silent-publish for Groups; handicap-balanced groups; avoid/force pair UI; Series/Cup adapters for group sets (`BFGroups` is already shared).
7. Net scramble ranking (the 2Man used gross).
8. The BF Series "Request an Event" card still uses Jotform on purpose.
9. Dev-99 candidates left open from Dev-98: frozen final Cup record, Money tab redesign, Host Audit tab, visible build stamp, event wrap-up action (see `BF_NextSession_Dev99.md`, items 1 to 11; check which are still open).

## Brian's steps still open at Dev-99 close
- Dry-run on a throwaway Gathering before Sunday; publish Groups with start holes; re-save Games setup if the team count changes (a 12th team).
- Create the awards/pizza plan details as he wants them; test Plans once on a throwaway (count-me-in plan, late Yes, unregister).

## Standing instructions
- Design first with Brian; stage on `claude-staging`; merge to `main` only on his say-so (he said "build and merge" through most of Dev-99; confirm each time).
- Worker changes are delivered as the Worker file (`SendUserFile` of `source/worker.js`); he deploys it. Deploy order: Worker first, then reload the portal.
- Commit trailers: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and `Claude-Session: <session url>`.
- Bump `source/portal_version.txt` and mirror `portal.html`, `portal_version.txt` to `docs/` with every portal change; engine changes bump `?v=` in portal.html, docs/bf-cup-draft.html, docs/BFE-Admin.html, docs/bf-cup-results.html.
- Minimal words in player-facing UI; plainspoken, cause-and-effect explanations; never state a rule Brian did not give. Brian's player identity is "Brian Hager".
