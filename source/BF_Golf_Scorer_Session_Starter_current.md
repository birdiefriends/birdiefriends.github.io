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

# BirdieFriends Golf Scorer — Session 29 Starter
**Date:** TBD (follows Session 28, 2026-06-03)
**Portal Version (production):** v3.10.79 · 2026-06-03 ← fetched from library at session start
**GolfScorer Version:** v8.6 · 2026-05-28d (deployed, unchanged)
**Worker Version:** 2026-06-03 (deploy/history/rollback endpoints added)
**Live URL:** https://birdiefriends.com/portal.html
**Jotform API Key:** dd0cb09a71eee7d0db3aa690e292660f

---

## ⚠️ FIRST THING EVERY SESSION — Required uploads

| File | Required | Purpose |
|------|----------|---------|
| `birdiefriends_portal.html` | ✅ Always | Portal source |
| `worker.js` | ✅ If Worker changes planned | Claude won't touch Worker without it (Golden Rule #15) |
| `deploy_portal.py` | ✅ If deploy script changes planned | Claude won't touch it without it (Golden Rule #16) |
| `launch_golf_scorer.py` | ✅ If launcher changes planned | Claude won't touch it without it (Golden Rule #16) |

> **Everything else is fetched from the library.** Session starter, ops guide, and portal version are all read directly from `source/` in GitHub via the bootstrap. No other uploads needed.

> **Session starter convention (Golden Rule #17):** At session end, save the updated starter as `BF_Golf_Scorer_Session_Starter_current.md` in the GolfScorer folder and run the bat. GitHub history is the version archive — no numbered copies needed.

---

## ⚠️ VERSION RULE — GOLDEN

> **Claude deploys via `bf_deploy.py` — platform independent, no bat, no uploads.**
> `source/portal_version.txt` is the sole version source of truth. `bf_deploy.py` reads it, increments patch, and pushes atomically. Works from any device.

Example: current version is v3.10.79 → Claude runs bf_deploy.py → deploys as v3.10.80 ✅

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

**Step 1 — Paste bootstrap** (no uploads needed to start):
```
Paste contents of BF_Session_Bootstrap.md into Claude
```
Claude will fetch from library: session starter, ops guide, portal version.

**Step 2 — Upload portal source** (required for any portal edits):
```
Upload: birdiefriends_portal.html
```

**Step 3 — Upload secret files only if changing them:**
```
worker.js          → if Worker changes planned
deploy_portal.py   → if deploy script changes planned
launch_golf_scorer.py → if launcher changes planned
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

## 🔴 SESSION 29 — Priority 1: Worker KV Feed

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

## 🔴 SESSION 29 — Priority 2: Cancelled Events

### Concept
Commissioner needs to cancel an event and notify registered players.

### Full solution (needs dedicated session)
1. Commissioner marks event cancelled → KV flag keyed to event ID
2. Cancellation push fires automatically to registered players
3. Event card shows ❌ Cancelled state persistently (reads KV flag on load)
4. Ghost entry on Schedule tab showing event was cancelled
5. Jotform row options: hide vs delete vs keep for records

### For immediate needs (before next session)
Use Commissioner Broadcast from portal → reaches all bfw=Yes members. Then handle Jotform row manually.

---

## 🔵 SESSION 29 — Priority 3: Remaining Backlog

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
Session start (any session):
1. Paste BF_Session_Bootstrap.md into Claude
2. Claude fetches session starter, ops guide, portal_version.txt from library
3. Upload birdiefriends_portal.html (always needed for portal edits)
4. Upload worker.js / deploy_portal.py / launch_golf_scorer.py only if changing them

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
