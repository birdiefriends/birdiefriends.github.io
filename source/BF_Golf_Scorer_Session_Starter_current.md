<!-- CLAUDE INSTRUCTIONS — READ FIRST
VERSION RULE — NON-NEGOTIABLE:
Claude must output the portal at THE SAME version found in portal_version.txt.
The version in the uploaded HTML file is IRRELEVANT — ignore it for versioning.
Do NOT increment. Do NOT change the date. deploy_portal.bat owns the increment.
If portal_version.txt says v3.10.69 · 2026-06-02, Claude outputs v3.10.69 · 2026-06-02.
The deploy will land at v3.10.70. That is correct and expected.

If portal_version.txt has NOT been uploaded to this session:
STOP. Before producing any portal HTML output, ask:
"Before I make any portal changes, please upload portal_version.txt from your GolfScorer folder."
Do NOT use the version from the uploaded HTML. Do NOT guess. Wait for portal_version.txt.

VERSION SYNC — MANDATORY FIRST STEP BEFORE ANY CODE CHANGE:
portal_version.txt is NOT reliable mid-session — Brian deploys multiple times per session.
ALWAYS fetch the live version directly from GitHub using the HARDENED script below.
The bare one-liner is UNSAFE — if curl returns empty, sed wipes all version strings.

HARDENED VERSION SYNC (copy exactly):
  PORTAL="/home/claude/birdiefriends_portal.html"
  GITHUB_URL="https://raw.githubusercontent.com/birdiefriends/birdiefriends.github.io/main/docs/portal.html"
  LIVE_VER=$(curl -s --max-time 10 "$GITHUB_URL" | grep -o 'v3\.10\.[0-9]* · [0-9-]*' | head -1)
  if [ -z "$LIVE_VER" ]; then
    LIVE_VER=$(grep -o 'v3\.10\.[0-9]* · [0-9-]*' portal_version.txt | head -1)
  fi
  if [ -z "$LIVE_VER" ]; then echo "❌ Cannot determine version — abort"; exit 1; fi
  sed -i "s/v3\.10\.[0-9]* · [0-9-]*/${LIVE_VER}/g" "$PORTAL"
  grep -o 'v3\.10\.[0-9]* · [0-9-]*' "$PORTAL" | head -1

WORKER RULE:
If Worker changes are planned, worker.js MUST be uploaded at session start.
Claude never reconstructs Worker code without the source file.
If worker.js is missing and Worker changes are needed: STOP and ask for it.
-->

# BirdieFriends Golf Scorer — Session 28 Starter
**Date:** TBD (follows Session 27, 2026-06-03)
**Portal Version (production):** v3.10.72 · 2026-06-03 ← Claude outputs THIS version (verify via GitHub fetch)
**GolfScorer Version:** v8.6 · 2026-05-28d (deployed, unchanged)
**Worker Version:** 2026-06-03 (deploy/history/rollback endpoints added)
**Live URL:** https://birdiefriends.com/portal.html
**Jotform API Key:** dd0cb09a71eee7d0db3aa690e292660f

---

## ⚠️ FIRST THING EVERY SESSION — Required uploads

| File | Required | Purpose |
|------|----------|---------|
| `portal_version.txt` | ✅ Always | Version baseline — Claude won't touch portal without it |
| `birdiefriends_portal.html` | ✅ Always | Portal source |
| `worker.js` | ✅ If Worker changes planned | Claude won't touch Worker without it |
| `deploy_portal.py` | ✅ If deploy script changes planned | Claude won't touch it without it (Golden Rule #16) |
| `launch_golf_scorer.py` | ✅ If launcher changes planned | Claude won't touch it without it (Golden Rule #16) |
| `BF_Operations_Guide.md` | ✅ Recommended | Reference for architecture decisions |
| This session starter | ✅ Always | Context and priorities |

> **Session starter convention (Golden Rule #17):** At session end, save the updated starter as BOTH `BF_Golf_Scorer_Session_Starter_NN.md` (numbered archive) AND `BF_Golf_Scorer_Session_Starter_current.md` in the GolfScorer folder. The bat mirrors `_current.md` to `source/` — that's the library copy. Upload the numbered one to Claude at session start.

---

## ⚠️ VERSION RULE — GOLDEN

> **Claude never increments the portal version.**
> Claude reads portal_version.txt and outputs that SAME version. deploy_portal.bat owns the increment.
> The version in the uploaded HTML is irrelevant — it always lags production by one deploy.

Example: GitHub fetch returns v3.10.69 → Claude outputs v3.10.69 → deploy lands at v3.10.70 ✅

---

## Session 27 Accomplishments

### Code Library + Remote Deploy system shipped (Priority 3)
- `worker.js` — added `GET /history`, `POST /deploy`, `POST /rollback` endpoints
  - `/history` — returns last N commits for any managed file (calls GitHub API)
  - `/deploy` — pushes file content to GitHub + writes KV snapshot entry (PIN required)
  - `/rollback` — restores file to any prior commit SHA as new commit (PIN required)
  - GitHub token stored directly in Worker (acceptable for this app)
- `deploy.html` — live at birdiefriends.com/deploy.html (PIN 7797)
  - **Deploy tab** — pick file, load from disk or paste, version string auto-detected, one-tap deploy
  - **History tab** — per-file commit list, tap any row to restore, confirm before executing
  - **Log tab** — session deploy/rollback activity feed
- `deploy_portal.py` — updated to deploy `deploy.html` to `docs/` and mirror 7 source files to `source/` on every bat run
  - Mirrors: `source/portal.html`, `source/guide.html`, `source/deploy.html`, `source/worker.js`, `source/BF_Golf_Scorer_8.html`, `source/BF_Operations_Guide.md`, `source/BF_Golf_Scorer_Session_Starter_current.md`
  - `.py` files excluded from mirrors — GitHub secret scanning blocks them (correct behavior)
- **Golden Rule #16** added — upload `deploy_portal.py` and `launch_golf_scorer.py` at session start if changes planned; never reconstruct from scratch

### Managed file registry
| Key | GitHub path | Deploy path |
|-----|-------------|-------------|
| portal | `docs/portal.html` + `source/portal.html` | birdiefriends.com/portal.html |
| guide | `docs/guide.html` + `source/guide.html` | birdiefriends.com/guide.html |
| worker | `source/worker.js` | Cloudflare (manual paste) |
| golfscore | `source/BF_Golf_Scorer_8.html` | localhost (manual copy) |
| ops_guide | `source/BF_Operations_Guide.md` | — |
| deploy.html | `docs/deploy.html` + `source/deploy.html` | birdiefriends.com/deploy.html |
| session_starter | `source/BF_Golf_Scorer_Session_Starter_current.md` | — |

---

## 🔴 SESSION 28 — Priority 1: Worker KV Feed

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

## 🔴 SESSION 28 — Priority 2: Cancelled Events

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

## 🔵 SESSION 28 — Priority 3: Remaining Backlog

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
| Portal | v3.10.72 · 2026-06-03 | Production ✅ |
| GolfScorer | v8.6 · 2026-05-28d | Deployed ✅ |
| Worker | 2026-06-03 | Deployed ✅ — deploy/history/rollback added |
| deploy.html | 2026-06-03 | Live ✅ — birdiefriends.com/deploy.html |
| launch_golf_scorer.py | 2026-06-01 | Current ✅ |
| deploy_portal.py | 2026-06-03 | Current ✅ — source mirrors added |
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
Portal:
1. Download birdiefriends_portal.html from Claude output
2. Place in GolfScorer folder (overwrite existing)
3. Double-click deploy_portal.bat
4. Confirm version bump in console output
5. Wait ~60 seconds → hard refresh on phone
6. Confirm new version in header
7. ⚠️ Upload portal_version.txt at START of next session

Worker (when changed):
1. Download worker.js from Claude output
2. Cloudflare → Workers → birdiefriends-push → Edit code → paste → Save and Deploy
3. Save worker.js to GolfScorer folder
4. ⚠️ Upload worker.js at START of next session if further Worker changes planned

GolfScorer:
1. Download BF_Golf_Scorer_8.html from Claude output
2. Replace file in GolfScorer folder
3. Double-click Launch_Golf_Scorer.bat
4. VERIFY VERSION IN HEADER before doing anything
```

### Known Issues Carried Forward
- OneSignal delete of delivered messages — not possible via API; KV Feed is the fix
- GS state persistence not implemented — re-fetch from Jotform required after restart
- TEST_PREVIEW_MODE must be False on event day
- BL-17: Two Series events same day → only first gets live banner
- Active/Inactive auto-reset: Jeremy Burkett + Tony Hager
- Push delivery sporadic on course — device-side (Focus Mode / Safari vs PWA icon)
