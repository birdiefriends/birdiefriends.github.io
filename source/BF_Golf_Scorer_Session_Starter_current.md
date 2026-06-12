<!-- CLAUDE INSTRUCTIONS — READ FIRST
FETCH RULE — NON-NEGOTIABLE:
Use bash_tool with curl for ALL raw GitHub URL fetches. Do NOT use the web_fetch tool
for raw.githubusercontent.com URLs — it requires a prior search result and will block.
The bootstrap handles this automatically via its curl bash block.

DEPLOY RULE — NON-NEGOTIABLE:
Claude deploys the portal directly via the GitHub API using bf_deploy.py from the library.
source/portal_version.txt in GitHub is the sole version source of truth.
bf_deploy.py reads the current version, increments patch, updates the portal HTML, and pushes
docs/portal.html + source/portal.html + source/portal_version.txt atomically.
Do NOT use any uploaded file for version baseline. Do NOT guess the version.

DEPLOY FLOW (every portal change):
  1. curl portal from GitHub → /home/claude/birdiefriends_portal.html
  2. curl bf_deploy.py from library → /home/claude/bf_deploy.py
  3. Make changes to portal
  4. python3 /home/claude/bf_deploy.py /home/claude/birdiefriends_portal.html "<commit message>"
  Increments version, pushes all three files, prints new version. Done.

ROLLBACK FLOW:
  import sys; sys.path.insert(0,'/home/claude'); import bf_deploy; bf_deploy.rollback('<sha>', '<msg>')

WORKER RULE:
Worker changes require worker.js from the library (source/worker.js).
Claude never reconstructs Worker code without the source file.
-->

# BirdieFriends Golf Scorer — Session 34 Starter
**Date:** TBD (follows Session 34, 2026-06-12)
**Portal Version (production):** v3.10.99 · 2026-06-12 ← fetched from library at session start
**GolfScorer Version:** v8.17 · 2026-06-12a (deployed)
**Worker Version:** 2026-06-03 (KV Feed confirmed working end-to-end)
**Live URL:** https://birdiefriends.com/portal.html
**Jotform API Key:** dd0cb09a71eee7d0db3aa690e292660f

---

---

## Session 34 Accomplishments (2026-06-12)

### Bootstrap — session load fix
- Root cause confirmed: Claude was using `web_fetch` for raw GitHub URLs after reading the Bootstrap, ignoring the FETCH RULE
- Fix: updated `deploy.html` Claude tab copy button to front-load the method constraint: *"Use bash_tool with curl to fetch…"* — forces correct tool selection before any decision is made
- Syntax check (`node --check`) added as mandatory pre-deploy step after blank-load incidents this session

### GolfScorer — quota display bug fixed (v8.17 · 2026-06-12a)
- **Bug:** `grpMergePlayers` existing-player branch only updated `isSub` and returned — stored `p.quota` (stale prev quota from localStorage) was never refreshed
- **Symptom:** HCP table showed prev quota (e.g. 26.03) while "Why this quota?" tooltip correctly showed estimated quota (e.g. 24.51) — display only, no scoring impact
- **Fix:** existing branch now re-fetches `currentHcp` from series history and recomputes via `grpGetEstimatedQuota` on every Fetch Registrants call
- **Workflow note:** fix requires clicking Fetch Registrants after new GS loads — re-publish without re-fetching would still show stale value

### Portal — Live panel delineation + CttP player picker (v3.10.96–v3.10.99)
- **CttP player picker added** — `_ctpPlayer` state var, same `openPlayerSheet()` sheet as Birdie Alert, defaults to `currentPlayer`, resets after submit. Fixes Series#3 proxy issue where overseer couldn't submit CttP on behalf of group member
- **All three live sections** (Birdie Alert, CttP, Post-Round Scorecard) now have distinct dark header strips (`rgba(0,0,0,0.45)`) with emoji + title in bright white, content body below in lighter dark card — `overflow:hidden` keeps corners crisp
- **Operational review** confirmed: push routing, message copy, skin logic, scorecard flow, player picker all correct
- Note: blank-load incidents on .96 and .97 — caused by nested template-literal/HTML-attribute/JS-string escaping in CttP picker onclick. Fixed by pre-computing `ctpPlayerEsc` before the template literal. Mandatory `node --check` now gates all future deploys

### Future Considerations logged
- GolfScorer phone/iPad executable documented in Ops Guide as Option A (GitHub Pages hosting) — deferred pending commercial rewrite

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
| Portal | v3.10.95 · 2026-06-11 | Production ✅ |
| GolfScorer | v8.17 · 2026-06-09o | Deployed ✅ — See Session 32 accomplishments |
| Worker | 2026-06-03 | Deployed ✅ |
| deploy.html | 2026-06-03 | Live ✅ — birdiefriends.com/deploy.html |
| launch_golf_scorer.py | 2026-06-09 | Current ✅ — auto-pulls GolfScorer HTML from GitHub on startup |
| bf_deploy.py | 2026-06-09 | Current ✅ — deploy_file() added for single-file Claude-direct deploys |
| deploy_portal.py | 2026-06-03 | Current ✅ |
| guide.html | Session 25 | Live ✅ |

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
| GET | `/history?file=X&n=20` | None | Last N commits for a managed file |
| POST | `/deploy` | PIN 7797 | Push file content to GitHub + write KV snapshot |
| POST | `/rollback` | PIN 7797 | Restore file to a prior commit SHA |
| GET | `/feed` | None | **Planned** — Worker KV feed |
| DELETE | `/feed` | PIN 7797 | **Planned** — Clear KV feed entries |

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
- Claude runs bf_deploy.deploy_file('worker.js', 'source/worker.js', 'msg')
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
- OneSignal delete of delivered messages — not possible via API; KV Feed is the fix
- GS state persistence not implemented — re-fetch from Jotform required after restart
- TEST_PREVIEW_MODE must be False on event day
- BL-17: Two Series events same day → only first gets live banner
- Active/Inactive auto-reset: Jeremy Burkett + Tony Hager
- Push delivery sporadic on course — device-side (Focus Mode / Safari vs PWA icon)
- Tim Wargo Android push notification: Samsung Internet PWA incompatible; Chrome PWA installed but BFUpdates was No — fixed; confirmed working after Jotform update
- garretts-last-swing.html: dead photo overlay code, table width formatting, needs clean rewrite
- GolfScorer Players tab (2·Players) onclick bug fixed Session 32 ✅
- resetAll() Groups tab clear fixed Session 32 ✅
- No-HCP tee dropdown fixed Session 32 ✅ — if tee dropdown ever shows as static pill for a null-HCP player, check isNoHcp flag and hcp===null condition in grpRenderHcpTable
- Series#3 groupings archive iframe shows nav bar — acceptable, do not republish (would corrupt historical quotas)
- Series#2 groupings lost — pre-system, no recovery
