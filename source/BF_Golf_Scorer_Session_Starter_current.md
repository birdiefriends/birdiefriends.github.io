<!-- CLAUDE INSTRUCTIONS — READ FIRST
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

# BirdieFriends Golf Scorer — Session 31 Starter
**Date:** TBD (follows Session 30, 2026-06-08)
**Portal Version (production):** v3.10.88 · 2026-06-06 ← fetched from library at session start
**GolfScorer Version:** v8.6 · 2026-05-28d (deployed, unchanged)
**Worker Version:** 2026-06-03 (KV Feed confirmed working end-to-end)
**Live URL:** https://birdiefriends.com/portal.html
**Jotform API Key:** dd0cb09a71eee7d0db3aa690e292660f

---

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
| `launch_golf_scorer.py` | Only if changing the local GolfScorer launcher |

> **Session starter convention (Golden Rule #17):** At session end, save the updated starter as `BF_Golf_Scorer_Session_Starter_current.md` in the GolfScorer folder and run the bat. GitHub history is the version archive — no numbered copies needed.

---

## ⚠️ VERSION RULE — GOLDEN

> **Claude deploys via `bf_deploy.py` — platform independent, no bat, no uploads.**
> `source/portal_version.txt` is the sole version source of truth. `bf_deploy.py` reads it, increments patch, and pushes atomically. Works from any device.

Example: current version is v3.10.79 → Claude runs bf_deploy.py → deploys as v3.10.80 ✅

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

### Push notification message audit (before BFSeries#4)
Audit ALL templates:
- [ ] Birdie alert — first birdie / bust / already busted ✅ fixed Session 25
- [ ] CttP leader announcement
- [ ] Commissioner broadcast
- [ ] Sub promotion
- [ ] End of round / skins results

### Push recipient scope
- Birdie Alerts + CttP → ALL members with pushId + bfw=Yes (not just registered players)
- Only registered-player filtering for: sub promotion, end-of-round scoring
- Update `osSendToPlayers` filter logic per notification type

### Active/Inactive auto-reset (Jeremy Burkett + Tony Hager)
- Fastest fix: hardcode exempt array like COMMISSIONERS array
- Option A: `const ACTIVE_EXEMPT = ['Jeremy Burkett', 'Tony Hager']`

---

## Infrastructure Reference

### Versions
| Component | Version | Status |
|-----------|---------|--------|
| Portal | v3.10.75 · 2026-06-03 | Production ✅ |
| GolfScorer | v8.6 · 2026-05-28d | Deployed ✅ |
| Worker | 2026-06-03 | Deployed ✅ — deploy/history/rollback added |
| deploy.html | 2026-06-03 | Live ✅ — birdiefriends.com/deploy.html |
| launch_golf_scorer.py | 2026-06-01 | Current ✅ |
| deploy_portal.py | 2026-06-03 | Current ✅ — source mirrors + version push |
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
| feed::{timestamp} | JSON | **Planned** — KV feed entries |

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
3. Upload deploy_portal.py / launch_golf_scorer.py only if changing those secrets files

Portal (after Claude produces output):
1. Download birdiefriends_portal.html from Claude output
2. Place in GolfScorer folder (overwrite existing)
3. Double-click deploy_portal.bat
4. Confirm version bump in console output
5. Wait ~60 seconds → hard refresh on phone
6. Confirm new version in header

Worker (when changed):
1. Download worker.js from Claude output
2. Cloudflare → Workers → birdiefriends-push → Edit code → paste → Save and Deploy
3. Save worker.js to GolfScorer folder (bat mirrors it to source/ on next run)

GolfScorer (when changed):
1. Download BF_Golf_Scorer_8.html from Claude output
2. Replace file in GolfScorer folder
3. Double-click Launch_Golf_Scorer.bat
4. VERIFY VERSION IN HEADER before doing anything

Session end:
1. Save updated session starter as BF_Golf_Scorer_Session_Starter_current.md
2. Run bat — all source files mirror to GitHub library
```

### Known Issues Carried Forward
- OneSignal delete of delivered messages — not possible via API; KV Feed is the fix
- GS state persistence not implemented — re-fetch from Jotform required after restart
- TEST_PREVIEW_MODE must be False on event day
- BL-17: Two Series events same day → only first gets live banner
- Active/Inactive auto-reset: Jeremy Burkett + Tony Hager
- Push delivery sporadic on course — device-side (Focus Mode / Safari vs PWA icon)
- Tim Wargo Android push notification: Samsung Internet PWA incompatible; Chrome PWA installed but BFUpdates was No — fixed; confirmed working after Jotform update
- garretts-last-swing.html: dead photo overlay code, table width formatting, needs clean rewrite in Session 31
