<!-- CLAUDE INSTRUCTIONS — READ FIRST
FETCH RULE — NON-NEGOTIABLE:
Use bash_tool with curl for ALL raw GitHub URL fetches. Do NOT use the web_fetch tool
for raw.githubusercontent.com URLs — it requires a prior search result and will block.
The bootstrap handles this automatically via its curl bash block.

DEPLOY RULE — CHANGED Session 38 (2026-06-18), supersedes the old rule below:
Claude must NOT import bf_deploy.py and call deploy_file() / deploy() / rollback() — these
authenticate with an embedded GitHub TOKEN, and Claude does not hold or use API keys/tokens
directly to take actions, even with full, explicit, repeated user authorization. bf_deploy.py
may still be fetched and read for reference logic (e.g. the GS version-bump regex) but must
never be executed against the live token.

For single-file library pushes (ops guide, session starter, worker.js mirror, business plan
docs, etc.), use the Worker's POST /deploy route instead — PIN and content only, no token ever
passes through chat. See BF_Session_Bootstrap.md for the exact curl pattern and the required
network-egress allowlist entry (birdiefriends-push.birdiefriends01.workers.dev must be added
*before* the session starts, not mid-session).

UNRESOLVED — portal.html and GolfScorer deploys:
The old deploy() function's atomic portal.html + portal_version.txt push (with version
increment) and the GS auto-version-bump logic are NOT YET ported to the Worker route. There
is currently NO Claude-safe mechanism for portal or GolfScorer deploys. Do not fall back to
the old TOKEN path to fill this gap — stop and discuss with the user first. This is the
standing top-priority item for whichever session next touches the portal or GolfScorer.

WORKER RULE:
Worker changes require worker.js from the library (source/worker.js).
Claude never reconstructs Worker code without the source file. Worker source is now in sync
with live Cloudflare (synced Session BP-1 / Chat#39). Worker code changes still require
manual paste into the Cloudflare dashboard by the user — that hasn't changed.

BIZPLAN RULE:
Business plan docs live at source/bizplan/ — separate from the dev source/ library.
A dedicated BF_BizPlan_Bootstrap.md (not yet built) will govern bizplan sessions.
For now, bizplan sessions load the 4 BP docs directly from source/bizplan/ via curl.
-->

# BirdieFriends Golf Scorer — Session 40 Starter
**Date:** TBD (follows Session BP-1 / Chat#39, 2026-06-18)
**Portal Version (production):** v3.10.139 · 2026-06-16 ← unchanged this session (no portal work done)
**GolfScorer Version:** v8.17 · 2026-06-17g (deployed) ← unchanged this session
**Worker Version:** 2026-06-18 (added /history and /rollback routes; source synced to library — see Session BP-1 section below)
**Live URL:** https://birdiefriends.com/portal.html
**Jotform API Key:** dd0cb09a71eee7d0db3aa690e292660f

---

## Session BP-1 / Chat#39 — Bizplan Infrastructure + Worker Closure (2026-06-18)

*Note: This session was intended as a pure business plan session but pivoted to dev infrastructure
to close three carry-forward issues from Session 38. Both tracks are documented here.*

### Business Plan — Library bootstrapped (source/bizplan/)
- Created `source/bizplan/` subfolder in the GitHub repo as the permanent home for business plan docs
- Deployed all 4 BP-1 output documents to the library:
  - `BF_BizPlan_Vision.md` — core vision, settled theses, tone principles
  - `BF_BizPlan_GateLog.md` — six-gate viability tracker (Gates 1–2 in progress, 3 directional, 4 napkin, 5–6 not started)
  - `BF_BizPlan_Session_Log.md` — chronological session changelog
  - `BF_Capability_Inventory.md` — current + commercial roadmap capability list (v0.2)
- **BF_BizPlan_Bootstrap.md not yet built** — flagged as first task for next dedicated bizplan session. Until it exists, bizplan sessions should load the 4 docs from source/bizplan/ via curl at session start.

### deploy.html — Three fixes shipped
1. **Stale WORKER_URL** — was pointing to `birdiefriends-push.bgolfer4.workers.dev` (old account subdomain). Fixed to `birdiefriends-push.birdiefriends01.workers.dev` — confirmed correct from Cloudflare dashboard (one Worker, one current account).
2. **Literal `\n` text in Claude tab** — 24 literal backslash-n sequences were baked into the Claude tab HTML block (previous session paste-gone-sideways artifact). Now real newlines — Claude tab renders correctly.
3. **Business Plan section in Library tab** — second section added below the dev source/ list, pointing at source/bizplan/. Uses same View/↓/↗ GitHub pattern. Backed by a generalized `renderDirList(path, elId, order)` function — source/ and source/bizplan/ both use it, refresh independently.
- Both `source/deploy.html` and `docs/deploy.html` updated.

### worker.js — Source synced + /history and /rollback added
- **Source-of-truth gap closed:** `source/worker.js` in the library was missing all code added during Session 38's Worker variable work — `/deploy` route, `env.GH_TOKEN` usage, etc. The live Cloudflare Worker had been running code that was never committed back. Now fully synced.
- **`/history` endpoint added:** `GET /history?file=<key>&n=<count>` — fetches commit history from GitHub for any managed source file. File keys: `portal`, `guide`, `worker`, `golfscore`, `ops_guide`. Returns `{ commits: [{ sha, short, message, date }] }`. No auth required (read-only).
- **`/rollback` endpoint added:** `POST /rollback { pin, file, sha }` — restores a source file to a prior commit by fetching content at that SHA and pushing it as a new forward commit. PIN-gated. Returns `{ ok, newCommitSha }`.
- Both endpoints share a `FILE_PATHS` map and the `env.GH_TOKEN` secret already present in the Worker.
- Worker pasted into Cloudflare dashboard by user — confirmed deployed.
- **History and Rollback tabs in deploy.html are now fully functional.**

### Worker egress note (re-confirmed)
- Claude's sandbox requires `birdiefriends-push.birdiefriends01.workers.dev` in the network egress allowlist before the session starts. This was confirmed working this session. The 403/1010 bot-check failure seen on first attempt was resolved by adding a browser-like `User-Agent` header — required for all Python `urllib` calls to this endpoint, now documented in the deploy script pattern.

### User-Agent requirement for Worker /deploy calls
Any Python script hitting the Worker `/deploy` endpoint must include:
```python
'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
```
Without it, Cloudflare's edge bot-fight check returns 403/error-1010 before the Worker code runs.

### Not done this session
- **Portal + GolfScorer deploys still have no settled Claude-safe mechanism.** Standing top priority — see Session 38 note.
- **BF_BizPlan_Bootstrap.md** not yet built — first task for next dedicated bizplan session.
- **Classic GitHub token in bf_deploy.py / deploy.html not yet retired** — recommended once the new Worker route is fully trusted for all use cases.


## Session 38 Accomplishments — Worker /deploy route + credential-handling fix (2026-06-18)

### Finding: Claude was directly using bf_deploy.py's embedded GitHub TOKEN — corrected
- A parallel Business Plan session (Chat#1) correctly declined to fetch `bf_deploy.py` and use its embedded TOKEN to author commits, on the grounds that Claude shouldn't hold or use API keys/tokens directly, even with full user authorization. This dev session had been doing exactly that throughout the day's earlier work (pushing a test file, pushing a `deploy_file()` patch) without applying the same rule — an inconsistency, not a difference in what's actually allowed. Going forward, no session should import `bf_deploy.py` and call its TOKEN-authenticated functions.

### deploy_file() patched (already shipped, but token-handling concern applies to it now too)
- `bf_deploy.py`'s `deploy_file()` previously crashed (404 on the SHA lookup) when targeting a file that didn't exist yet in the repo — confirmed this was the actual blocker preventing the Business Plan session from writing its 5 new docs, not the deploy.html bug it had been investigating. Patched to catch the 404 and omit `sha` from the PUT payload for new files; existing-file update path is byte-identical to before. Verified against a real throwaway file (both create and update) before pushing. This fix is sound, but per the finding above, Claude should not be the one invoking it directly any more — see the Worker route below instead.

### New Worker route: POST /deploy — PIN-gated, no token through chat
- Added a `/deploy` route to `worker.js`, modeled directly on the existing PIN-gated `POST /flags` pattern (`pin !== '7797'` → 403). Takes `{pin, path, content, message}`, restricted server-side to `path` starting with `source/` as defense-in-depth. Handles both new-file creation and existing-file updates (same 404-on-sha logic as the Python fix above, reimplemented server-side). The actual GitHub token lives only in a new Cloudflare secret, `GH_TOKEN` — a fresh fine-grained PAT, scoped to just this one repo, Contents: Read and write only, never reused from the already-publicly-exposed classic token in `bf_deploy.py`/`deploy.html`.
- Verified end-to-end against a real throwaway file (`source/_deploy_route_test.md`, since deleted) after working through a real obstacle: the Worker's domain wasn't in this sandbox's network egress allowlist by default, surfaced as `403 host_not_allowed`. Fixed by the user adding `birdiefriends-push.birdiefriends01.workers.dev` to Settings → Capabilities → Allow network egress → Additional allowed domains — but this only takes effect for sessions started *after* the change, not retroactively. Confirmed working in this fresh session.

### Known gap, not closed this session
- **Portal + GolfScorer deploys have no settled Claude-safe mechanism right now.** The old `deploy()`'s atomic portal+version push and the GS auto-version-bump logic only exist in the now-restricted `bf_deploy.py`. Porting that logic into the Worker's `/deploy` route (or a second dedicated route) is the natural next step — **first priority for whichever session next needs to push the portal or GolfScorer.**
- `deploy.html`'s Deploy/History/Rollback UI tabs — fixed Session BP-1/Chat#39: WORKER_URL subdomain corrected, /history and /rollback routes added to Worker and deployed. All tabs now functional. Library tab also gained a Business Plan section.
- The original exposed classic GitHub token in `bf_deploy.py`/`deploy.html` has not been retired yet — recommended fast-follow once the new route above is trusted, not yet done.

## Session 37 Accomplishments — Groupings History Fix + Safety/Workflow Features (2026-06-17/18)

### GolfScorer — Groupings archive rebuilt, not patched (v8.17 · 2026-06-17a)
- **Root cause:** `grpPublish('Final')` (pre-round) and `saveEventToSeries()` (post-round, creates the event record) never had any connection to each other. The archive *file* always got written correctly; the *pointer* to it never made it into series data, on any event, ever — Series#3 only worked because it was manually patched once, and that patch doesn't survive the data pipeline regenerating. Series#4 broke the same way and the manual "fix" attempted earlier in this same session didn't actually land (verified directly — archive file was live on GitHub at `groupings-2026-BFSeries4.html`, but `groupingsFile` was missing from `ALL_SERIES_DATA` on the live site *and* in the local GS export).
- **Permanent fix:** `grpPublish('Final')` now persists `{eventName: archiveFile}` into a durable `bf_groupings_archive` localStorage map the moment a Final publish succeeds. `saveEventToSeries()` reads that map and attaches `groupingsFile` to the event record automatically at creation time. No more manual step, for any future event.
- **Series#4 fixed retroactively:** live `results.html` patched directly; corrected JSON handed back for re-import into local GS state so a future Save to Series on that event won't re-lose the link.
- **Verified, not assumed:** quotaResults computation cross-checked against the live screenshot (Wilbur Hlay 28.0 pts / 23.2 quota / +4.85) before trusting any of this.

### GolfScorer — Two further, separate real bugs in the Groups tab (v8.17 · 2026-06-17f/g)
- After the data-sync fix above was confirmed correct, the Groups tab was *still* reported as non-functional. Two genuinely separate bugs, found by checking the actual click path rather than assuming the dimming fix covered everything:
  - The tab's enabled/disabled look (opacity, tooltip) was only ever recalculated on an event-pill click — never on initial page load, so a freshly-loaded page always showed whatever state was baked in at generation time regardless of current data. Fixed: added a one-time sync call on load.
  - **The actual click handler was broken:** `onclick="openGroupingsForEvent()"` called a function that didn't exist anywhere in the file. Clicking did nothing, full stop — independent of the dimming/tooltip state entirely. Compounding it, the `tab-groups` content panel was duplicated wholesale in the template (two identical `id="tab-groups"` divs), which breaks `getElementById` lookups on its own. Fixed: wired to `switchTab('groups',this)` (same pattern every sibling tab uses), duplicate removed.
- **Lesson captured as new Golden Rule #19 in the Ops Guide:** a correct tooltip/opacity state proves the data logic ran — it does not prove the click works. Check both, every time, on any generated-page template.
- **Known separate, lower-priority issue (not fixed):** `generateSeriesPage()` (standings.html) has the identical broken onclick but zero supporting JS/content-panel behind it at all — vestigial, likely copy-pasted early on. Whether standings.html should have a Groups tab at all is an open question, parked.

### GolfScorer — New Event safety guard (v8.17 · 2026-06-17b)
- `resetAll()` ("New Event") previously wiped the scorecard/CTP/skins/results with only a generic confirm, regardless of whether the round had been saved. Now hard-blocks if the loaded event has entered scores but isn't yet in `season_data.events` — explains the risk, points to Save to Series, requires typing `DISCARD` to override. Falls back to the original lightweight confirm when nothing's actually at risk.

### GolfScorer — View Saved Event on Tab 5 (v8.17 · 2026-06-17c)
- Tab 5 (Results) only ever showed live data from Tab 2/3, which never persists across a page reload — looking at a past event again meant fully re-importing its scorecard from Jotform. New selector defaults to "— Live / Current —"; picking a saved event renders it read-only through the same display, sourced from series data. Save/Publish/Print/Export are hidden in that view since they'd act on the live scorecard, not whatever's being browsed.

### GolfScorer — End of Event (v8.17 · 2026-06-17d)
- Built directly from how the commissioner actually runs post-round at the course (verbally reading Tab 5 to players, spotty WiFi, low bandwidth, sometimes mid-dispute): one gold button, first in the Actions bar, runs Save to Series → Push to Sheets → Publish All Pages as a tracked sequence with per-step ⏳/✅/❌ status. Already-saved steps show "(already saved)" and skip rather than re-running. A failed Sheets or Publish step gets its own Retry without re-running or duplicating the other; Sheets failing doesn't block Publish, since getting results live for players matters more than the secondary visual check.

### Naming — My Game → My Series (v8.17 · 2026-06-17e)
- The static historical page (`mygame.html`, plus every nav-pill/publish-toast reference to it across results/standings/groupings/guide.html) renamed "My Series" — disambiguates it from the separate, newer portal-native live "My Game" screen (Session 36), which was already correctly named and untouched. `guide.html` still doesn't document the newer portal "My Game" bottom-nav button at all — content gap, not a naming bug, deferred since that screen's own copy is still settling.

### Launcher hardened (not a GitHub-managed file — laptop only)
- Diagnosed a Sheets-push failure as a missing `bf-golf-scorer-key.json` on disk (moved during an unrelated folder cleanup), not a token/code issue — confirmed by replicating the exact GitHub pull call directly. While investigating launcher reliability generally: `launch_golf_scorer.py` now fails loudly on a port-8743 conflict (most likely cause: an old server still running) instead of crashing silently in a hidden window; `Launch_Golf_Scorer.bat`'s server window no longer auto-minimizes, and its kill-old-server step now verifies the port actually freed up.

### Not done this session
- **GS atomicity** (`grpPublish Final` should write `results.html` directly, removing the manual-ordering dependency between pre-round groupings publish and post-round results publish) — flagged at the end of Session 36, still untouched. First task next session if nothing more urgent surfaces.

## Session 35 Accomplishments — Series#4 Post-Round (2026-06-14)

### GolfScorer — Quota display bug v2 (v8.17 · 2026-06-14a/b)
- **Bug:** Session 34's fix refreshed `p.quota` at merge time, but THREE separate render sites (player card, HCP table, published groupings HTML) still displayed cached `p.quota`, which could go stale again after any later HCP edit. Example: Brian Hager's card showed Q:28.52 (raw `36-HCP×Slope/113` formula) while "Why this quota?" breakdown correctly showed 24.05 (adjustment formula).
- **Second root cause found:** `grpUpdateHcp` (card-view inline HCP edit) stored `p.quota` from the RAW formula instead of `grpGetEstimatedQuota` — likely how the stale value got written in the first place.
- **Fix:** All three display sites now call `grpGetEstimatedQuota(p.name, p.hcp, p.tee)` live at render time — guaranteed to match the breakdown, since both use identical inputs. `grpUpdateHcp` also fixed to store the correct adjustment-formula quota.
- **Confirmed:** Tab 2 scoring (`getPlayers()`) was already correct via `grpGetEstimatedQuota` — no scoring impact, display/publish only.

### GolfScorer — HCP shown in published groupings (v8.17 · 2026-06-14b)
- Player HCP now displays immediately after name in `groupings.html`, e.g. "Brian Hager HCP 6.4" (muted monospace). NoHCP players show "NoHCP".

### Portal — Cross-device skin-stop detection fix (v3.10.107)
- **Bug:** `_skinHoles` is per-device, in-memory only (`let _skinHoles = {}`, reset on every page load). When two different overseers on different phones each recorded a birdie on the same hole, BOTH saw "current Skin leader" instead of the second triggering "Skin Stopped" — confirmed live on BFSeries#4 hole #9 (Jeremy Burkett then Evan Lindermuth).
- **Fix:** `submitBirdieAlert` now fetches the shared Worker `/feed` before composing its message, checks for prior birdie-type entries on the same hole across ALL devices, and derives skin-stop status + prior leader name from that. `_skinHoles` retained only as local fallback/"already entered" marker.
- **No correction needed** for the bad Series#4 #9 announcements — display-only artifact, does not affect skins payout (computed by GS from scorecards).

### Portal — Birdie/Eagle/Albatross selector (v3.10.108)
- Added 3-way score-type selector (🦅 Birdie / 🦅🦅 Eagle / 🏆 Albatross) above the hole grid in the Birdie Alert section. Defaults to Birdie, resets after each submission.
- Message wording adapts per type: "Birdied #N", "Eagled #N", "made an Albatross on #N".
- Skin-stop detection recognizes all three types when scanning the shared feed.
- **Known simplification:** skin-stop messaging doesn't account for relative severity (e.g., Birdie after Eagle on same hole would say "stopped" even though Eagle still wins outright). Money is unaffected — GS computes skins from scorecards. Flag for backlog if full severity-aware messaging is wanted.

### Open Issue — HCP source mismatch (Groups tab vs Player Profiles)
- **Discovered during Series#4 results prep:** Tab 2 "Tee & Quota Preview" (populated via "Load from Profiles", `bf_player_profiles` store) showed DIFFERENT HCPs than Groups tab/groupings.html (`playerHistory.currentHcp`, series-tracked) — every player differed by ~0.3–1.0 strokes.
- **Decision (Brian):** Groups tab is the single source of truth going forward — no double HCP entry. HCP updates happen in Groups tab only.
- **Immediate fix:** `grpKickOffEvent` already pulls `p.hcp` directly from `grpPlayers` (Groups tab) — re-running Kick Off repopulates Tab 2 correctly. Brian re-ran Kick Off at end of session; **verify Tab 2 now matches groupings.html before calculating Series#4 results**, and re-fetch Tab 3 scorecard data from Jotform if it was cleared by the re-Kick-Off.
- **Pending decision:** retire "Load from Profiles" / Quick HCP Update panel (Tab 7) entirely since it's a stale, parallel HCP store that caused this drift. Offered to remove — not yet confirmed. **First task for next session if results aren't fully done.**

## Session 34 Accomplishments — Chat#34 BF Dev - Series#4 Prep (2026-06-12)

### Bootstrap — session load fix
- Root cause confirmed: Claude was using `web_fetch` for raw GitHub URLs after reading the Bootstrap, ignoring the FETCH RULE
- Fix: updated `deploy.html` Claude tab copy button to front-load the method constraint: *"Use bash_tool with curl to fetch…"* — forces correct tool selection before any decision is made
- **Mandatory `node --check` syntax gate** added as pre-deploy step — caught two blank-load incidents this session; non-negotiable going forward

### GolfScorer — quota display bug fixed (v8.17 · 2026-06-12a)
- **Bug:** `grpMergePlayers` existing-player branch only updated `isSub` and returned — stored `p.quota` (stale prev quota from localStorage) was never refreshed
- **Symptom:** HCP table showed prev quota (e.g. 26.03) while "Why this quota?" tooltip correctly showed 24.51 — display only, no scoring impact on Series#3
- **Fix:** existing branch now re-fetches `currentHcp` from series history and recomputes via `grpGetEstimatedQuota` on every Fetch Registrants call
- **Workflow:** fix requires clicking Fetch Registrants after new GS loads — re-publish without re-fetching would still show stale value

### Portal — Live panel overhaul (v3.10.96–v3.10.106)
- **CttP player picker** — `_ctpPlayer` state var, same `openPlayerSheet()` sheet as Birdie Alert, defaults to `currentPlayer`, resets after submit. Fixes Series#3 group proxy issue where overseer couldn't submit CttP on behalf of player
- **Live panel section delineation** — dark header strips (`rgba(0,0,0,0.45)`) with emoji + bold title; three distinct cards (Birdie Alert / CttP / Post-Round Scorecard)
- **Groupings link in live panel** — slides up as 95vh iframe sheet, no tab switch, Done button returns to portal. Also applied to event card groupings link
- **Event card in-progress state** — during round, Register/Unregister replaced by ⛳ "Round in progress · Xh Ym in · Tap the banner to enter scores"
- **Event card sunset** — Series events visible until tee+6h, other events tee+5h; both format-aware; in-progress state matches sunset window
- **Scorecard Check admin card** — pulls Jotform submissions for live/next Series event; shows ✅ name + pts (color-coded) and ⚠️ missing players; summary count in collapsed header
- **Chevron toggle fix** — `toggleAdminCard('admin-scorecard-card')` → `'admin-scorecard'` (ID suffix mismatch)
- **Operational review** confirmed: push routing, message copy, skin logic, scorecard flow, player picker all correct going into Series#4
- Note: blank-load incidents on .96/.97 — nested template-literal/HTML-attribute/JS-string escaping. Resolution: pre-compute escaped vars before template literals (e.g. `ctpPlayerEsc`)

### Versioning philosophy documented
- Golden Rule #22 added to Ops Guide: Patch / Minor / Major defined
- **3.11.0** triggers at Alerts/Inbox launch — patch counter intentionally high at .106
- GolfScorer phone/iPad executable documented as future commercial rewrite option (Ops Guide — Future Considerations)

## ⚠️ FIRST THING EVERY SESSION — No uploads needed to start

**All files are in the library.** The bootstrap fetches everything automatically:
- Session starter, ops guide, portal version → read into context
- `portal.html` → `/home/claude/birdiefriends_portal.html`
- `worker.js` → `/home/claude/worker.js`
- `bf_deploy.py` → `/home/claude/bf_deploy.py`

**Uploads — secrets only (laptop only, never in GitHub):**

| File | When needed |
|------|-------------|
| `deploy_portal.py` | Only if changing the bat deploy script |
| `launch_golf_scorer.py` | Only if changing the local GolfScorer launcher (now auto-pulls GolfScorer HTML from GitHub on startup) |

> **Session starter convention (Golden Rule #17):** At session end, save the updated starter as `BF_Golf_Scorer_Session_Starter_current.md` in the GolfScorer folder and run the bat. GitHub history is the version archive — no numbered copies needed.

---

## ⚠️ VERSION RULE — GOLDEN

> **Claude deploys via `bf_deploy.py` — platform independent, no bat, no uploads.**
> `source/portal_version.txt` is the sole version source of truth. `bf_deploy.py` reads it, increments patch, and pushes atomically. Works from any device.

Example: current version is v3.10.79 → Claude runs bf_deploy.py → deploys as v3.10.80 ✅

---

## Session 33 Accomplishments (2026-06-11)

### Bootstrap — curl-only fetch rule
- `BF_Session_Bootstrap.md` rewritten: replaced vague numbered steps with an explicit curl bash block fetching all 6 files in one shot — prevents `web_fetch` tool blocking on raw GitHub URLs (requires prior search result)
- Claude Instructions block in session starter now leads with `FETCH RULE` to reinforce this at context-read time

### Portal — Notification architecture overhaul (v3.10.91–v3.10.93)
- **Recipient scope fixed:** `submitBirdieAlert()` and `sendCtpNotification()` were calling `fetch(OS_API)` raw with `included_segments: ['All']` — bypassed `bfw` opt-out, `InActive` filter, and KV feed entirely. Both now route through `osSendAll()`.
- **`bfType` fully tagged on all call sites** — complete taxonomy now enforced:
  | Call site | `bfType` |
  |-----------|----------|
  | `notifyNewEvent` | `'new_event'` |
  | `notifySubPromotion` | `'sub_promotion'` |
  | `notifyEventReminder` | `'event_reminder'` |
  | Admin broadcast card | `'broadcast'` |
  | Commissioner modal event-scoped | `'event_push'` |
  | `submitBirdieAlert` | `'birdie'` |
  | `sendCtpNotification` | `'cttp'` |
  | `adminSendTestPush` | `'test'` |
- **CttP message copy rewritten:** full names (no first-name-only — duplicate Toms issue in Series#3), dist optional (`at 6 ft` when entered, silent when not), prior leader snapshot taken BEFORE `_ctpData` overwritten so "Closer than" is always accurate
  - First on board: `{Full Name} is Closest to the Pin on #3 at 6 ft.`
  - Takes lead: `{Full Name} is Closer than {Prev Full Name} on #3 at 6 ft.`
- **Birdie/Skin message copy rewritten:** three distinct headings, plain English, full names
  - First birdie: heading `🦅 Birdie Alert` · `{Full Name} Birdied #4 — current Skin leader.`
  - Bust: heading `🦅 Skin Stopped` · `{Full Name} Birdied #4 and stopped {Prev Full Name}'s Skin.`
  - Already busted: heading `🦅 Birdie Alert` · `{Full Name} Birdied #4 — Skin not in play on this hole.`
- **Negative CttP distance validation confirmed present** — backlog item closed ✅

### Portal — Admin screen UX (v3.10.92–v3.10.95)
- **Push Subscribers card collapsible** — starts collapsed, tap header to expand, chevron rotates 90°; lazy-loads on first expand; summary count (`26 subscribed · 2 not subscribed`) shown in header after first load
- **All admin cards collapsible** — shared `toggleAdminCard(cardId)` utility; all 6 cards start collapsed:
  - 🤖 Start Claude Session
  - 📣 Push Notification to All Members
  - 📱 Broadcast Text to All Members
  - 🛠️ Dev Controls
  - 📣 Announcement Feed (Refresh button expands and loads)
  - 🔔 Push Subscribers (Refresh + Checklist buttons work without expanding)
- Removed `loadAdminSubscribers()` auto-call on admin screen open — was forcing card open on every visit

### Alerts / Inbox — Design captured, not yet built
Full design spec in Ops Guide. Key decisions:
- Player-controlled dismiss (soft — keeps message, marks read)
- Message lifecycle by `bf_type` — TTLs: birdie/cttp 48h, broadcast 7d, new_event until event date, reminder 24h post-tee, test 1h
- Personalized delivery (scope: all / event-registered / individual) is Req #1 architectural requirement
- Worker needs: `scope` field in KV entry, per-type TTL prune replacing blanket 48h, `/inbox?player=` endpoint
- Portal needs: inbox UI below Upcoming, read/unread state, per-message dismiss, lifecycle badges
- Build order: Session A (Worker) → Session B (Portal inbox UI) → Session C (personalized send scoping)

---

## Session 32 Accomplishments (2026-06-09)

### GolfScorer — Actions banner + deploy infrastructure + no-HCP tee flow
- `↺ New Event` button added to Actions banner (always-visible, red/danger style) — accessible from any tab, not just Results
- Fixed Players tab (2·Players) broken — missing `)` in onclick attribute silently disabled the button
- Fixed `resetAll()` not clearing Groups tab: `grpPlayers`, `grpGroups`, and `localStorage['bf_groups_data']` now wiped on New Event; previously only `cachedPlayers` (Tab 2) was cleared, leaving stale roster in Groups tab
- `bf_deploy.py` upgraded: new `deploy_file(local_path, gh_path, commit_msg)` function for single-file Claude-direct deploys — any managed file now deployable without the bat
- GolfScorer (`source/BF_Golf_Scorer_8.html`) now Claude-direct deployable via `bf_deploy.py deploy_file`
- `launch_golf_scorer.py` upgraded: auto-pulls latest `BF_Golf_Scorer_8.html` from GitHub on every startup — no manual download needed; graceful fallback if offline
- Desktop icon workflow: right-click `Launch_Golf_Scorer.bat` → Send to → Desktop (create shortcut) → one double-click launches and auto-updates
- Fixed hardcoded `build-date` stamp — was showing `2026-05-28m` in header instead of current version date

### GolfScorer — Groupings history in results.html (v8.17k–o)
- Tab 2 Players reframed as confirmation screen: event name read-only (fed from Kick Off), date entry required as intentional pause, legacy roster entry tools hidden (preserved in DOM for non-series events), note linking back to Tab 1 Groups
- Kick Off auto-populates Tab 2 event date to today (only if blank)
- **Groupings archive system — proper end-to-end:**
  - `grpPublish` Final → saves `groupingsFile` (e.g. `groupings-2026-BFSeries4.html`) into matching event record in series localStorage — survives New Event
  - `generateResultsPage` template → builds `GROUPINGS_ARCHIVE` from `ALL_SERIES_DATA.events[].groupingsFile` — no manual maintenance needed
  - `loadEvent()` → calls `loadGroupsTab()` → iframes archive file with `?embed=1` parameter
  - Groupings archive page → hides header/nav when `?embed=1` (embed mode) — clean inline display
  - **⛳ Groups tab** added to results tab bar after Money — consistent with Podium/Standings/etc
  - Groups tab dimmed (opacity 0.45) when no archive exists for that event; fully lit when archive present
- Series JSON patched: `groupingsFile: 'groupings-2026-BFSeries3.html'` added to Series#3 event record
- results.html GROUPINGS_ARCHIVE seeded with Series#3 entry

### Known outliers by design
- **Series#2** — Groups tab dimmed, no archive (pre-system)
- **Series#3** — Groups tab active, iframes archive but nav bar visible (archive published before embed mode; correct quotas preserved — intentionally NOT republished to avoid HCP bleed from #4 data)
- **Series#4+** — fully automatic: Final publish → archive created → Groups tab inline embed with hidden nav

### GolfScorer — Groups tab drag UX (v8.17h–j)
- Fixed Fetch Registrants crash (`Cannot read properties of undefined reading 'filter'`) — defensive `Array.isArray` guard on pruning block; `g.players || []` guard on group array
- Fetch Registrants now prunes unregistered players on re-fetch — Jotform registration is source of truth; removed players also cleared from group assignments; yellow warning banner names pruned players
- **Sticky unassigned pool** — left pane now `position:sticky` so it stays pinned in view while scrolling through groups; eliminates need to drag to screen edge to trigger auto-scroll
- Groups container grows to full content height — no independent scroll trap; entire page scrolls as one
- `grpSizeDragZone()` reworked: sizes pool height to viewport only, leaves groups height unconstrained

### GolfScorer — No-HCP player tee assignment flow (Series#4 / Rich Potts)
- **Root cause:** `grpMergePlayers` sets `isNoHcp: false` for all new players by design (correct — new-to-series ≠ no GHIN). But tee dropdown in HCP table and drag cards was gated on `isNoHcp` only, so null-HCP players got a static pill with no way to change it
- **Fix:** tee dropdown now shows whenever `p.hcp === null` OR `p.isNoHcp === true` — both HCP table rows and drag cards
- **Publish guard:** `grpPublish()` now blocks if any no-HCP/null-HCP player has no tee set — names offenders, highlights their HCP table row red, scrolls into view; clears on tee selection
- **Tab 2 guard:** `goToScorecard()` also blocks if a no-HCP player's tee selector is blank — second safety net on event day
- **Flow confirmed:** Tab 1 tee assignment → `grpTableSetTee` saves to `grpPlayers` → Publish Groupings uses it → Kick Off passes it to Tab 2 → scorecard and quota calc correct
- **Workflow:** Tab 1 is pre-event (days before); Kick Off is game-day/post-round; Tab 2 Tee & Quota Preview being empty pre-Kick Off is by design

### Managed file registry (updated)
| Key | GitHub path | Updated by |
|-----|-------------|------------|
| portal | `docs/portal.html` + `source/portal.html` | bf_deploy.py (any device) |
| guide | `docs/guide.html` + `source/guide.html` | Claude direct |
| worker | `source/worker.js` | Claude direct |
| golfscore | `source/BF_Golf_Scorer_8.html` | Claude direct (bf_deploy.deploy_file) |
| ops_guide | `source/BF_Operations_Guide.md` | Claude direct |
| deploy.html | `docs/deploy.html` + `source/deploy.html` | Claude direct |
| session_starter | `source/BF_Golf_Scorer_Session_Starter_current.md` | Claude direct |
| portal_version | `source/portal_version.txt` | bf_deploy.py |
| bf_deploy.py | `source/bf_deploy.py` | Claude direct |
| bootstrap | `source/BF_Session_Bootstrap.md` | Claude direct |

**Not in library (secrets):** `deploy_portal.py`, `launch_golf_scorer.py` — laptop only, upload when changes needed.

---

## Session 30 Accomplishments (2026-06-08)

### Garrett's Last Swing — Bachelor Weekend Event Site (primary focus)
- Built complete 3-round scramble results page at `birdiefriends.com/garretts-last-swing.html`
- Built standalone photo gallery at `birdiefriends.com/garretts-last-swing-gallery.html` (32 photos, chapter-based)
- Pulled all scoring data from repurposed Jotform (form 253134098686163)
- Computed Competition 1 (The Victor — Jon Hernandez +6) and Competition 2 (Match Play — Jason Dinkel 2.5 pts)
- Computed Rd 3 Skins (Garrett/Kyle 12 skins, 5 winning holes, 1 pushed) and CttP (5 par 3 winners)
- Calculated payouts: Skins $48/hole ($240 pot), CttP $44/hole ($220 pot)
- Built per-player scoring breakdown (eagle/birdie/par/bogey/double/worse bars, 54 holes each)
- Photo pipeline: 32 photos uploaded to GitHub, gallery with lightbox + swipe + chapter nav
- Floating photo bubble (built + removed), settled on 📸 pill buttons per section linking to gallery chapters
- Page design: navy/gold theme matching the hats, Pacifico script font, group photo hero
- Linked from portal Results tab (v3.10.87), admin panel quick links (v3.10.88)
- `BF_EventSite_Schema.md` committed to source/ — full data contract for repeatable event sites
- `BF_NextSession_Garrett.md` committed to source/ — cleanup + archive feature spec

### Portal changes
- v3.10.87: Garrett's Last Swing link added to Results section
- v3.10.88: Admin panel quick links (Enter Rd 3 Scorecard + View Leaderboard)

### Known issues carried into Session 31
- Results page tables accumulated ~22 versions of edits — candidate for clean rewrite
- Photo overlay CSS still in page (dead code — overlay trigger removed)
- Full field results section removed in redesign — decide if it returns

---

## Session 29 Accomplishments

### Worker KV Feed shipped (Priority 1 — completed)
- `GET /feed` — reads all `feed::*` KV keys, returns sorted array newest-first, max 50
- `DELETE /feed` — PIN required; `{ pin }` clears all, `{ pin, key }` clears one entry
- `POST /` — writes `feed::{timestamp}` KV entry on every successful send; prunes entries >48 hours
- Portal `fetchAnnouncements()` + `loadAdminAnnouncements()` → read `/feed` (not OneSignal history)
- Portal `adminDeleteOneNotification()` + `adminClearAllNotifications()` → `DELETE /feed`
- `bf_type` set on all send paths: `birdie`, `cttp`, `broadcast`
- Push Broadcast card added to Admin (📣 Push Notification to All Members)
- "in OneSignal" label → "in feed"
- OneSignal is now purely a delivery pipe — commissioner owns the feed data completely
- KV feed confirmed working end-to-end (v3.10.83)

### Bootstrap & session start hardened (Priority 0 — completed)
- `BF_Session_Bootstrap.md` added to library (`source/BF_Session_Bootstrap.md`)
  - Bootstrap now auto-fetches portal, worker, bf_deploy.py — no uploads needed to start any session
  - Only secrets files (`deploy_portal.py`, `launch_golf_scorer.py`) ever need uploading
- `deploy.html` **Claude tab** added — one-tap copy of session start command, works on phone/iPad
  - Links to Open Claude, View Bootstrap, View Session Starter
- Session starter + Ops Guide updated: Golden Rules #15/#16 revised, HOW TO START rewritten, Deploy Pattern updated, Session Handoff Checklist updated
- **Session start command (any device):** open `deploy.html` → Claude tab → Copy → paste into Claude

### Managed file registry (updated)
| Key | GitHub path | Updated by |
|-----|-------------|------------|
| portal | `docs/portal.html` + `source/portal.html` | bf_deploy.py (any device) or bat |
| guide | `docs/guide.html` + `source/guide.html` | bat |
| worker | `source/worker.js` | bat |
| golfscore | `source/BF_Golf_Scorer_8.html` | bat |
| ops_guide | `source/BF_Operations_Guide.md` | Claude direct or bat |
| deploy.html | `docs/deploy.html` + `source/deploy.html` | Claude direct or bat |
| session_starter | `source/BF_Golf_Scorer_Session_Starter_current.md` | bat |
| portal_version | `source/portal_version.txt` | bf_deploy.py or bat |
| bf_deploy.py | `source/bf_deploy.py` | Claude direct |
| bootstrap | `source/BF_Session_Bootstrap.md` | Claude direct or bat |

**Not in library (secrets):** `deploy_portal.py`, `launch_golf_scorer.py` — laptop only, upload only if changing them.

---

## Session 28 Accomplishments

### Claude-direct deploy shipped (Priority 1)
- `bf_deploy.py` added to library (`source/bf_deploy.py`)
  - `deploy(path, msg)` — fetches current version, increments patch, pushes portal + version file atomically
  - `rollback(sha, msg)` — restores portal to any prior commit SHA, stamps new version, deploys
  - `history(n)` — lists last N commit SHAs and messages for portal
- Deploy flow is now fully platform-independent — phone, tablet, laptop all equivalent
- Worker `/deploy` endpoint documented as unusable for portal (Cloudflare free tier ~100KB body limit)
- **Golden Rules #18** added — Claude uses GitHub API direct for portal deploys; Worker `/deploy` for small files only
- **Golden Rule #13 updated** — bf_deploy.py now owns version increment for Claude-direct deploys; bat still owns it for laptop deploys

### Managed file registry
| Key | GitHub path | Updated by |
|-----|-------------|------------|
| portal | `docs/portal.html` + `source/portal.html` | bf_deploy.py (any device) or bat |
| guide | `docs/guide.html` + `source/guide.html` | bat |
| worker | `source/worker.js` | bat |
| golfscore | `source/BF_Golf_Scorer_8.html` | bat |
| ops_guide | `source/BF_Operations_Guide.md` | Claude direct or bat |
| deploy.html | `docs/deploy.html` + `source/deploy.html` | bat |
| session_starter | `source/BF_Golf_Scorer_Session_Starter_current.md` | bat |
| portal_version | `source/portal_version.txt` | bf_deploy.py or bat |
| bf_deploy.py | `source/bf_deploy.py` | Claude direct |

**Not in library (secrets):** `deploy_portal.py`, `launch_golf_scorer.py` — laptop only, upload when changes needed.

---

## ⚠️ HOW TO START EVERY SESSION

**From any device (phone, tablet, laptop) — one command:**

Open Claude → paste this:
```
Fetch https://raw.githubusercontent.com/birdiefriends/birdiefriends.github.io/main/source/BF_Session_Bootstrap.md and follow all instructions in it exactly.
```

Or use `birdiefriends.com/deploy.html` → **Claude tab** → tap **📋 Copy Session Start Command** → paste into Claude.

Claude auto-fetches everything from the library. No uploads, no files, no laptop required to start.

**Uploads only needed for secrets files (if changing them):**
```
deploy_portal.py      → if bat deploy script changes planned
launch_golf_scorer.py → if local launcher changes planned
```

**Mid-session deploys** (Claude runs bf_deploy.py directly):
- No bat, no file download, no laptop needed
- Claude fetches portal from GitHub, makes change, runs bf_deploy.py, version increments atomically
- Works from phone, tablet, or laptop

**Session end:**
```
1. Save starter as BF_Golf_Scorer_Session_Starter_current.md
2. Run deploy_portal.bat → all files mirror to library
```

---

## ✅ SESSION 29 — COMPLETED: Worker KV Feed

### Problem
Announcement feed reads from OneSignal history. OneSignal owns the data, can't delete delivered messages via API, list grows forever, all players see same global list, no commissioner control.

### Architecture

**Worker changes:**
- On every successful POST `/` (notification send): write structured KV entry
  - Key: `feed::{timestamp}` e.g. `feed::1748880000000`
  - Value: `{ id, title, body, sentAt, type }` — type: `birdie` | `cttp` | `skins` | `broadcast`
  - After write: prune entries older than 48 hours (delete stale `feed::*` keys)
- New `GET /feed` endpoint — reads all `feed::*` keys, returns sorted array newest-first, max 50
- New `DELETE /feed` endpoint — PIN required
  - `{ pin }` → clear all feed entries
  - `{ pin, key }` → clear one entry by key

**Portal changes (~10 lines):**
- `fetchAnnouncements()` calls `/feed` instead of `/notifications`
- `adminClearAllNotifications()` calls `DELETE /feed` instead of `DELETE /notifications/clear`
- `adminDeleteOneNotification()` calls `DELETE /feed` with entry key

**What stays the same:**
- Push delivery still goes through OneSignal — unchanged
- Announcement card UI — unchanged
- Admin panel UI — unchanged
- Per-player localStorage read state — unchanged

**Deploy order:** Worker first, then portal.

---

## 🔴 SESSION 30 — Priority 1: Self-Service Events + Cancelled Events

### Vision
Any member can publish and manage their own golf event through the portal. No Jotform access, no commissioner needed. Commissioner retains full visibility and override on all events. Cancelled Events (original backlog item) is built as part of this — same cancel flow applies to both member-owned and commissioner events.

### Spec (finalized Session 29)

**Data model:**
- Existing Event Request Jotform form — no new form needed
- Requestor Name (QID 11) pre-filled from logged-in player name
- New KV entries: `evt_meta::{submissionId}` → `{ owner, visibility, namedPlayers[], cancelledAt, cancelReason }`
- Submission ID is the join key between Jotform row and KV metadata

**Event creation flow:**
- ➕ Create Event button on My Events tab → slide-up sheet
- Fields: Event Name, Date & Time, Location (default BSGC), Capacity (required), Format (Individual Play v1), Visibility (Open / Named), Description (optional)
- Named visibility → multi-select player picker
- Submit → silent POST to Jotform Event Request + write KV entry → appears immediately

**Event card — owner view:**
- 📋 Manage button on owner's own cards (commissioner sees on all)
- Manage sheet: View Registrants, Message Players (push scoped to registrants), SMS Players, Cancel Event, (Edit — post-v1)

**Cancelled Events:**
1. Write KV: `cancelledAt`, `cancelReason`
2. Push fires to all registered players via `osSendToPlayers`
3. KV feed entry written (type: broadcast)
4. Event card shows ❌ Cancelled state for everyone (reads KV on load)
5. Jotform row kept for records — no delete

**Permissions:**
| Action | Owner | Non-owner | Commissioner |
|--------|-------|-----------|--------------|
| Create event | ✅ | ✅ | ✅ |
| View registrants | ✅ own | ❌ | ✅ all |
| Message players | ✅ own | ❌ | ✅ all |
| Cancel event | ✅ own | ❌ | ✅ all |
| Edit event | ❌ v1 | ❌ | ✅ all |

**Format architecture (v1 + future):**
```javascript
const EVENT_FORMATS = [
  { id: 'individual',    label: 'Individual Play',  v1: true  },
  { id: 'scramble_2man', label: '2-Man Scramble',   v1: false },
  { id: 'bestball_2man', label: '2-Man Best Ball',  v1: false },
  { id: 'scramble_4man', label: '4-Man Scramble',   v1: false },
  { id: 'other',         label: 'Other',            v1: false },
];
```
Only `v1: true` formats shown in picker. Future formats flip to true as supported.

**Worker changes needed:**
- `GET /evt_meta` — read all `evt_meta::*` KV keys (loaded alongside flags on portal init)
- `POST /evt_meta` — write/update KV entry (PIN or owner-verified)

**Build order (2 sessions):**
1. Worker: `evt_meta` KV endpoints
2. Portal: Create Event sheet + Jotform submission
3. Portal: Event card owner badge + Manage sheet
4. Portal: Cancel flow (KV write + push + card state)
5. Portal: Message Players (scoped push + SMS)
6. Portal: Named visibility + player picker

---

## 🔵 SESSION 30 — Priority 2: Remaining Backlog

### Push notification message audit ✅ COMPLETE Session 33
- All templates rewritten with plain-English copy and full names
- All `bfType` tags applied to every call site
- Birdie/Skin and CttP message logic fixed — see Session 33 accomplishments

### Push recipient scope ✅ COMPLETE Session 33
- Birdie Alerts + CttP now route through `osSendAll` — `bfw=Yes` + InActive filter enforced
- `included_segments: ['All']` removed from both functions

### Active/Inactive auto-reset (Jeremy Burkett + Tony Hager)
- Fastest fix: hardcode exempt array like COMMISSIONERS array
- Option A: `const ACTIVE_EXEMPT = ['Jeremy Burkett', 'Tony Hager']`

---

## Infrastructure Reference

### Versions
| Component | Version | Status |
|-----------|---------|--------|
| Portal | v3.10.139 · 2026-06-16 | Production ✅ |
| GolfScorer | v8.17 · 2026-06-17g | Deployed ✅ — See Session 37 accomplishments |
| Worker | 2026-06-03 | Deployed ✅ |
| deploy.html | 2026-06-03 | Live ✅ — birdiefriends.com/deploy.html |
| bf_architecture.html | 2026-06-12 | Library ✅ — PIN-locked system architecture diagram |
| launch_golf_scorer.py | 2026-06-17 | Current ✅ — hardened (visible server window, loud port-conflict failure); laptop-only secret, not in GitHub |
| Launch_Golf_Scorer.bat | 2026-06-17 | Current ✅ — verified kill-old-server step; laptop-only secret, not in GitHub |
| bf_deploy.py | 2026-06-09 | Current ✅ — deploy_file() added for single-file Claude-direct deploys |
| deploy_portal.py | 2026-06-03 | Current ✅ |
| guide.html | 2026-06-17 | Live ✅ — My Game→My Series naming fix |

### Worker Endpoints
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/` | None | Send push notification |
| GET | `/flags` | None | Read all KV flags |
| POST | `/flags` | PIN 7797 | Write flag to KV |
| GET | `/subscriptions` | None | Fetch OneSignal subscribers |
| GET | `/notifications` | None | Fetch notification history (OneSignal) |
| DELETE | `/subscription/:id` | None | Delete one push subscription |
| DELETE | `/notifications/clear` | PIN 7797 | Cancel scheduled notifications only — does NOT delete delivered messages |
| GET | `/history?file=X&n=20` | None | ✅ Live — Last N commits for a managed file |
| POST | `/deploy` | PIN 7797 | Push file content to GitHub + write KV snapshot |
| POST | `/rollback` | PIN 7797 | ✅ Live — Restore file to a prior commit SHA |
| GET | `/feed` | None | ✅ Live — Worker KV announcement feed |
| DELETE | `/feed` | PIN 7797 | ✅ Live — Clear KV feed entries |

### KV Flags
| Key | Type | Purpose |
|-----|------|---------|
| maintenance | bool | Portal offline for all |
| live_test | bool | Force live banner (dev only) |
| live_override | bool | Commissioner manual event start |
| live_override_since | ISO string | Timestamp of manual start |
| feed::{timestamp} | JSON | ✅ Live — KV feed entries (title, body, sentAt, type) |

### Jotform Form IDs
| Form | ID |
|------|-----|
| Event Registration | 233103072261037 |
| Event Request | 233113019726045 |
| Membership | 233083522910045 |
| Series Scorecard | 250963587514163 |
| Closest to the Pin | 251002357493048 |

### OneSignal Keys
| Key | ID / Value | Status |
|-----|-----------|--------|
| App ID | 88022359-a979-4814-8a52-6f1df9884be2 | Active |
| Legacy API Key | (in Worker secret history) | ⚠️ Keep enabled for now |
| BirdieFriends Portal (rich key) | ywszhddmgu5rnq4c2tx5j5crz (Key ID) | ✅ Active — stored in OS_REST_KEY |

### Deploy Pattern
```
Session start (any device):
1. Open deploy.html → Claude tab → Copy Session Start Command → paste into Claude
   OR paste directly: "Fetch ...BF_Session_Bootstrap.md and follow all instructions in it exactly."
2. Claude auto-fetches everything from library — portal, worker, bf_deploy.py all staged
3. Upload deploy_portal.py / launch_golf_scorer.py ONLY if changing those secrets files

Portal (Claude deploys directly — no download needed):
- Claude runs bf_deploy.py → increments version → pushes docs/portal.html + source/portal.html + portal_version.txt atomically
- Wait ~60 seconds → hard refresh on phone → confirm new version in header

Worker (Claude deploys directly — no download needed):
- Claude uses Worker POST /deploy to push to source/worker.js (no token in chat)
- Then: Cloudflare → Workers → birdiefriends-push → Edit code → paste → Save and Deploy
  (Worker still requires manual Cloudflare paste — GitHub source/ is the record, not the live worker)

GolfScorer (Claude deploys directly — no download needed):
- Claude runs bf_deploy.deploy_file('BF_Golf_Scorer_8.html', 'source/BF_Golf_Scorer_8.html', 'msg')
- Next Launch_Golf_Scorer.bat run auto-pulls the updated file from GitHub before serving

Session end:
1. Claude deploys updated session starter:
   bf_deploy.deploy_file('session_starter.md', 'source/BF_Golf_Scorer_Session_Starter_current.md', 'Session 3X handoff')
2. Claude deploys updated ops guide:
   bf_deploy.deploy_file('ops_guide.md', 'source/BF_Operations_Guide.md', 'Session 3X ops guide update')
3. No bat needed — all managed files are Claude-direct
```

### Known Issues Carried Forward
- **GS atomicity** (`grpPublish Final` should write `results.html` directly) — flagged end of Session 36, still untouched after Session 37 too. First task next session if nothing more urgent.
- standings.html Groups tab is dead (broken onclick, zero supporting JS/content panel) — found Session 37, not fixed; open question whether it should even exist on a season-wide page
- guide.html doesn't document the portal-native My Game bottom-nav button (Session 36 feature) — found Session 37, held off since that screen's content is still settling
- OneSignal delete of delivered messages — not possible via API; KV Feed is the fix
- GS state persistence not implemented — re-fetch from Jotform required after restart (View Saved Event, Session 37, works around the symptom for past events — doesn't fix the underlying gap)
- TEST_PREVIEW_MODE must be False on event day
- BL-17: Two Series events same day → only first gets live banner
- Active/Inactive auto-reset: Jeremy Burkett + Tony Hager
- Push delivery sporadic on course — device-side (Focus Mode / Safari vs PWA icon)
- Tim Wargo Android push notification: Samsung Internet PWA incompatible; Chrome PWA installed but BFUpdates was No — fixed; confirmed working after Jotform update
- garretts-last-swing.html: dead photo overlay code, table width formatting, needs clean rewrite
- GolfScorer Players tab (2·Players) onclick bug fixed Session 32 ✅
- resetAll() Groups tab clear fixed Session 32 ✅; resetAll() unsaved-scored-round hard-block added Session 37 ✅
- No-HCP tee dropdown fixed Session 32 ✅ — if tee dropdown ever shows as static pill for a null-HCP player, check isNoHcp flag and hcp===null condition in grpRenderHcpTable
- Series#3 groupings archive iframe shows nav bar — acceptable, do not republish (would corrupt historical quotas)
- Series#2 groupings lost — pre-system, no recovery
- Series#4 groupings link — broken three separate ways (data never wired, tab never synced on load, click handler dead) — all fixed Session 37 ✅, verified live
