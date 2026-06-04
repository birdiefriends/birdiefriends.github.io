# BirdieFriends — Operations Guide
**Last Updated:** 2026-06-04 (Session 29 — KV Feed shipped; bat retired for library mirroring; Claude direct is now standard for all managed files; Golden Rule #19 added)  
**Maintained by:** Commissioner (Brian Hager) + Claude  
**Purpose:** Ground truth for running, deploying, and testing the BirdieFriends system.  
Update this file at the end of every session.

---

## ⚠️ Golden Rules
1. **Never test the portal from a local file for Jotform data.** The Jotform API blocks `file://` origins. UI testing locally is fine; data requires `https://birdiefriends.com/portal.html`.
2. **The portal file on your laptop is named `birdiefriends_portal.html`.** GitHub stores it as `docs/portal.html`. The deploy scripts handle the rename automatically.
3. **When something doesn't work, check the phone first, not the laptop.** The portal is a mobile-first PWA — swipe gestures, iOS rendering, and PWA chrome all require a real device.
4. **After updating launch_golf_scorer.py, restart the server.** Close the console window and reopen `Launch_Golf_Scorer.bat`.
5. **Always run a syntax check before deploying.** Node's `new Function()` tolerates some errors that Chrome rejects. Specifically: unescaped apostrophes in single-quoted strings (`'you're'` → `'you\'re'`), and complex onclick attributes with nested quotes — use `data-` attributes instead of inline string arguments.
6. **Remote flags affect all devices instantly.** All flags are stored in Cloudflare KV — toggling from Admin takes effect on next page load for every user.
7. **Use Event Control (not Live Test Mode) for production event starts.** Live Test Mode is for dev only. Event Control Start/Close is the operational path.
8. **Export GolfScorer JSON before any mock/test run.** Rollback = reimport the JSON export.
9. **After Publish Groupings, wait ~60 seconds before sharing the link.** Netlify CDN caches aggressively — the published page may serve stale content briefly.
10. **Bump GS version on every output.** No file leaves Claude without a version increment. Verify header shows correct version before doing anything after deploy.
11. **GS does not go to the course.** Laptop stays home. All scoring happens post-round at home. Groupings can be published the night before/morning of and GS closed.
12. **TEST_PREVIEW_MODE must be False on event day.** Check `launch_golf_scorer.py` before launching. When True, publishes save to local preview/ folder only.
13. **`source/portal_version.txt` in GitHub is the sole version source of truth.** Claude reads it at session start via the hardened sync script. When deploying via the Claude-direct flow (`bf_deploy.py`), Claude increments the patch and pushes `portal_version.txt` as part of the same atomic deploy. When deploying via the bat (laptop), `deploy_portal.bat` owns the increment. Claude never guesses or manually edits the version outside of `bf_deploy.py`.
14. **Version sync is a mandatory first bash step.** After copying the portal HTML to the working directory, immediately fetch the live version from GitHub and apply it. See hardened sync script below — never use the bare one-liner (empty LIVE_VER would wipe all version strings).
15. **worker.js is fetched from the library automatically at session start.** Claude never reconstructs Worker code from scratch. `source/worker.js` in GitHub is the canonical source — the bootstrap fetches it to `/home/claude/worker.js` every session.
16. **Always upload `deploy_portal.py` and `launch_golf_scorer.py` if changes to those files are planned.** These are the only files that cannot be in GitHub — they contain secrets. Claude never reconstructs them from scratch. Before modifying either `.py` file, upload the current version so changes are additive, not replacement. All other files (portal, worker, bf_deploy.py) are library-managed and fetched automatically.
17. **Save the session starter as `BF_Golf_Scorer_Session_Starter_current.md` in the GolfScorer folder before running the bat.** The bat mirrors it to `source/` on every deploy — GitHub history is the version archive. No numbered copies needed.
18. **For phone/tablet deploys, Claude pushes directly to the GitHub API — not via the Worker `/deploy` endpoint.** The Worker's `/deploy` endpoint has a ~100KB request body limit (Cloudflare free tier) which the portal (350KB+) exceeds, returning an empty response. Claude uses the GitHub token embedded in worker.js to call the GitHub Contents API directly. The Worker `/deploy` endpoint remains useful only for small files (ops guide, worker.js itself).
19. **`deploy_portal.bat` is retired for library mirroring.** Claude direct (GitHub API via `bf_deploy.py`) is the standard deploy path for all managed files — portal, worker, session starter, ops guide, bootstrap, deploy.html. The bat is no longer needed and the GolfScorer folder archive does not need to be undone. The only files that still require laptop-local handling are the secrets files (`deploy_portal.py`, `launch_golf_scorer.py`) which never go to GitHub.

---

## Hardened Version Sync Script (run at session start after cp)

```bash
PORTAL="/home/claude/birdiefriends_portal.html"
GITHUB_URL="https://raw.githubusercontent.com/birdiefriends/birdiefriends.github.io/main/docs/portal.html"
VER_URL="https://raw.githubusercontent.com/birdiefriends/birdiefriends.github.io/main/source/portal_version.txt"

LIVE_VER=$(curl -s --max-time 10 "$GITHUB_URL" | grep -o 'v3\.10\.[0-9]* · [0-9-]*' | head -1)

if [ -z "$LIVE_VER" ]; then
  echo "⚠️  GitHub HTML fetch failed — trying source/portal_version.txt"
  LIVE_VER=$(curl -s --max-time 10 "$VER_URL" | grep -o 'v3\.10\.[0-9]* · [0-9-]*' | head -1)
fi

if [ -z "$LIVE_VER" ]; then
  echo "❌ Cannot determine live version — aborting. Do not proceed."
  exit 1
fi

sed -i "s/v3\.10\.[0-9]* · [0-9-]*/${LIVE_VER}/g" "$PORTAL"
APPLIED=$(grep -o 'v3\.10\.[0-9]* · [0-9-]*' "$PORTAL" | head -1)
echo "✅ Portal synced to: $APPLIED"
```

---

## Laptop Folder Structure

```
Downloads/
└── GolfScorer/
    ├── birdiefriends_portal.html     ← Portal source (edit/deploy this)
    ├── worker.js                     ← Cloudflare Worker source ← NEW: upload each session
    ├── deploy_portal.bat             ← Double-click to deploy portal
    ├── deploy_portal.py              ← Called by the bat above
    ├── deploy_landing_page.bat       ← Deploy birdiefriends.com homepage
    ├── deploy_landing_page.py        ← Called by the bat above
    ├── Launch_Golf_Scorer.bat        ← Starts local GolfScorer server + opens Chrome
    ├── launch_golf_scorer.py         ← Python server (port 8743)
    ├── BF_Golf_Scorer_8.html         ← GolfScorer app (local tool)
    ├── manifest.json                 ← PWA manifest for portal
    ├── sw.js                         ← Service worker stub (disabled)
    ├── OneSignalSDKWorker.js         ← OneSignal push SW (deployed by deploy_portal.py)
    ├── guide.html                            ← Player guide (deployed alongside portal)
    ├── BF_Golf_Scorer_Session_Starter_current.md ← Session starter (bat pickup → source/)
    └── BF_Operations_Guide.md        ← This file
```

**Note:** `.tmp` files that appear in the GolfScorer folder are download artifacts from Claude sessions — safe to delete anytime.

---

## GitHub Repository
- **Repo:** `birdiefriends/birdiefriends.github.io`
- **Branch:** `main`
- **Pages URL:** `https://birdiefriends.com`
- **Token:** stored in `deploy_portal.py` and `deploy_landing_page.py`
- **Key files in repo:**
  - `docs/portal.html` → birdiefriends.com/portal.html
  - `docs/index.html` → birdiefriends.com (landing page)
  - `docs/mygame.html` → birdiefriends.com/mygame.html
  - `docs/results.html` → birdiefriends.com/results.html
  - `docs/standings.html` → birdiefriends.com/standings.html
  - `docs/groupings.html` → birdiefriends.com/groupings.html
  - `docs/groupings-meta.json` → groupings metadata (published by GolfScorer)
  - `docs/manifest.json` → PWA manifest
  - `docs/sw.js` → service worker stub
  - `docs/OneSignalSDKWorker.js` → OneSignal push service worker
  - `docs/guide.html` → birdiefriends.com/guide.html (player guide — deployed by deploy_portal.bat)

---

## Deploy: Portal

### ✅ Standard flow (any device — phone, tablet, laptop)
Claude makes the change, increments the version, and pushes directly to GitHub via the GitHub API. No file download, no bat, no laptop required.

1. Describe the change to Claude
2. Claude fetches portal from GitHub, makes the change, increments version, pushes to `docs/portal.html` + `source/portal.html` + `source/portal_version.txt`
3. Wait ~60 seconds → hard refresh → confirm new version in header

Claude uses `source/bf_deploy.py` from the library for this. The script reads `portal_version.txt`, increments patch, updates the portal HTML, and pushes all three files atomically.

**To start a new session from any device:** open `birdiefriends.com/deploy.html` → **Claude tab** → tap **📋 Copy Session Start Command** → paste into Claude. Claude auto-fetches the entire library and is ready to work.

### 💻 Laptop-only flow (GolfScorer HTML only)
The bat is retired for library mirroring. The only remaining laptop-only deploy is `BF_Golf_Scorer_8.html` — the local scoring tool that runs on localhost and is deployed via the bat.

1. Download `BF_Golf_Scorer_8.html` from Claude output
2. Place in `Downloads/GolfScorer/` (overwrite existing)
3. Double-click **`deploy_portal.bat`** — mirrors GolfScorer HTML to `source/`
4. All other files (portal, worker, ops guide, session starter, etc.) are deployed by Claude direct — no bat needed

### Expected console output (healthy deploy)
```
Deploying BirdieFriends Portal...
✅ Read birdiefriends_portal.html (XXX,XXX bytes)
✅ Version bumped: v3.10.68 · 2026-06-01 → v3.10.69 · 2026-06-02  (2 occurrences)
✅ birdiefriends_portal.html updated locally
✅ Got current docs/portal.html (sha: XXXXXXXX…)
✅ docs/portal.html deployed
✅ Got current docs/OneSignalSDKWorker.js (sha: XXXXXXXX…)
✅ docs/OneSignalSDKWorker.js deployed

⛳ birdiefriends.com/portal.html → v3.10.69 · 2026-06-02
   Allow ~60 seconds for GitHub Pages to update
Press any key to continue . . .
```

### deploy_portal.py — Auto-Increment
Every deploy automatically increments the patch version and updates the date. The local file is updated first, then pushed to GitHub. No manual version tracking needed.

**Files deployed by deploy_portal.bat (in order):**
1. `birdiefriends_portal.html` → `docs/portal.html` (version bumped)
2. `OneSignalSDKWorker.js` → `docs/OneSignalSDKWorker.js` (if present)
3. `guide.html` → `docs/guide.html` (if present)
4. `deploy.html` → `docs/deploy.html` (if present)
5. Source mirrors → `source/` (all silently skipped if file missing):
   - `birdiefriends_portal.html` → `source/portal.html`
   - `guide.html` → `source/guide.html`
   - `deploy.html` → `source/deploy.html`
   - `worker.js` → `source/worker.js`
   - `BF_Golf_Scorer_8.html` → `source/BF_Golf_Scorer_8.html`
   - `BF_Operations_Guide.md` → `source/BF_Operations_Guide.md`
   - `BF_Golf_Scorer_Session_Starter_current.md` → `source/BF_Golf_Scorer_Session_Starter_current.md`

**Session starter convention:** Save as `BF_Golf_Scorer_Session_Starter_current.md` in GolfScorer folder. Bat mirrors it to `source/` — GitHub history is the version archive.

**Version rule:** `portal_version.txt` is the sole source of truth for the current production version. Claude reads it at session start via the bootstrap (fetched from `source/portal_version.txt`). deploy_portal.bat adds 1 on every laptop deploy; `bf_deploy.py` adds 1 on every Claude-direct deploy — both push the updated version file atomically.

**Token recovery:** If token is lost, go to github.com → Settings → Developer settings → Personal access tokens → Tokens (classic) → GolfScorer → Regenerate. Paste new `ghp_...` value into BOTH `deploy_portal.py` line 16 AND `launch_golf_scorer.py` line 39. Both files must have the same token or one will fail with GitHub 401.

### If the phone shows old version after 60 seconds
- Close the tab completely and reopen
- Try adding `?v=X` to the URL
- Check GitHub directly to confirm version number in file

### If deploy fails
- **GitHub 401:** Token expired — update token in BOTH `deploy_portal.py` AND `launch_golf_scorer.py` (same token required in both)
- **GitHub 422:** SHA mismatch — run again
- **File not found:** Make sure `birdiefriends_portal.html` is in the GolfScorer folder

---

## Deploy: Cloudflare Worker

### Steps
1. Go to dash.cloudflare.com → Workers & Pages → birdiefriends-push
2. Click **Edit code**
3. Paste contents of `worker.js` (overwrite entire editor)
4. Click **Save and Deploy**
5. Confirm new version in Deployments tab

### Worker file management
- `worker.js` is fetched from `source/worker.js` in the library automatically at session start — no upload needed
- After any Worker deploy, Claude pushes the updated `worker.js` directly to `source/worker.js` in the library — no bat needed
- Claude never reconstructs Worker code from scratch — `source/worker.js` is the canonical source

### Worker `/deploy` endpoint — size limit
The Cloudflare free tier enforces a ~100KB request body limit. The portal (~350KB) exceeds this — the Worker returns an empty response with no error. **For portal deploys from phone/tablet, Claude calls the GitHub Contents API directly** using the token in worker.js. The `/deploy` endpoint works fine for small files (worker.js, ops guide, etc.).

### Worker secrets (Variables and Secrets tab → Settings)
| Secret | Value | Notes |
|--------|-------|-------|
| `OS_REST_KEY` | Rich API key | Updated 2026-06-02 to new rich key format |

**OS_REST_KEY recovery:** OneSignal dashboard → Settings → Keys & IDs → BirdieFriends Portal key → Rotate → copy full value → paste into Cloudflare Worker secret.

---

## Deploy: Generated Pages (MyGame, Results, Standings, Groupings)

1. Open GolfScorer at `http://localhost:8743/BF_Golf_Scorer_8.html`
2. Score the event and calculate results
3. Click **🌐 Publish All Pages**
4. Wait ~60 seconds, check birdiefriends.com

**Note:** All generated pages include a `← Portal` back-link in the nav pill row. Baked into `BF_Golf_Scorer_8.html` — no extra steps needed.

### Groupings Publish (separate from Publish All Pages)
- Click **🌐 Publish Groupings** in the Groups tab
- Deploys both `groupings.html` AND `groupings-meta.json` to Netlify
- `groupings-meta.json` contains: `{eventName, status, visibility, publishedAt}`
- Portal reads meta on load — shows groupings link only on the matching event card
- Wait ~60 seconds before sharing link (Netlify CDN cache)
- Set Status to **Final** before final publish

---

## Running GolfScorer (Local Scoring Tool)

1. Double-click **`Launch_Golf_Scorer.bat`**
2. Chrome opens at `http://localhost:8743/BF_Golf_Scorer_8.html`
3. Console window minimizes — leave it running

### GolfScorer Data Recovery
- All Groups tab state saves to localStorage key: `bf_groups_data`
- To inspect: open console → `localStorage.getItem('bf_groups_data')`
- To reload after page refresh: open console → `grpOnTabOpen()`
- To export for backup: Groups tab → Export JSON button
- To restore: Groups tab → Import JSON button
- **Always Export JSON before any mock/test run** — rollback = reimport

### TEST_PREVIEW_MODE (Safe Testing)
Set `TEST_PREVIEW_MODE = True` in `launch_golf_scorer.py` before any test run.  
When True: all Publish calls (Publish All Pages, Publish Groupings) save HTML to local `preview/` folder instead of pushing to GitHub Pages. GS shows amber banner. Players see nothing.  
**Set back to False for event day.** Confirm by checking GS header — no amber banner = live mode.

### Post-Round GS Workflow (Laptop stays home)
1. **Night before:** Finalize HCP/groups → Publish Groupings (Preliminary) → close GS
2. **Morning of event:** Set Final → Publish Groupings → close laptop
3. **Post-round at home:** Launch GS → update groups to reflect actuals (no-shows, subs) → Kick Off Event → Scorecard tab: Fetch from Jotform → CttP tab: Auto-fill from Jotform → Results tab: Calculate → Save to Series → Push to Sheets → Publish All Pages

---

## Portal Navigation (v3.10.0+)

### Bottom Nav Tabs
| Tab | Icon | Screen | Notes |
|-----|------|--------|-------|
| My Events | ⛳ | Curated event list | Swipeable cards; parked events hidden |
| Parked | 🅿️ | Set-aside events | Events swiped from My Events |
| Schedule | 🗓️ | My registered events | Shows only events player is signed up for |
| Results | 🏆 | Results links | Results, Standings, My Game, Groupings |

### Commissioner Admin Access
- **⚙️ gear icon** in the header (top right, next to bell and player pill)
- Visible only when logged in as commissioner (PIN verified)
- Taps into the full Admin screen — Event Control, Broadcast, Dev Controls, Push Subscribers, Notification Reset
- Admin is no longer a bottom nav tab

### About / Notifications
- Notification settings and About info accessible via ⓘ button in header
- Player guide linked from About screen: `birdiefriends.com/guide.html`

---

## Maintenance Mode & Remote Flags

### Architecture
Flags are stored in **Cloudflare KV** (`BF_FLAGS` namespace) and served by the `birdiefriends-push` Worker. The portal fetches flags on every page load before rendering anything. All devices see the same state.

### Cloudflare Resources
| Resource | Details |
|----------|---------|
| Worker | `birdiefriends-push` |
| Worker URL | `https://birdiefriends-push.birdiefriends01.workers.dev/` |
| KV Namespace | `BF_FLAGS` |
| Account | Birdiefriends01@gmail.com |

### KV Flags
| Key | Type | Purpose |
|-----|------|---------|
| `maintenance` | bool | Portal offline for all players |
| `live_test` | bool | Force live banner — dev/testing only |
| `live_override` | bool | Commissioner manual event start (production) |
| `live_override_since` | ISO string | Timestamp set when override starts |

### Flag endpoints
- **Read:** `GET /flags` → `{"maintenance":false,"live_test":false,"live_override":false}` — no auth, public
- **Write:** `POST /flags` with `{pin:"7797", key:"...", value:true|false}` — PIN required

### Toggling flags via Admin
Tap **⚙️ gear icon** → **Dev Controls** (commissioner login required):

**⛳ Event Control** (top of Dev Controls — production use)
- **▶️ Start Live Now** — sets `live_override: true`, all players see live banner immediately
- **⏹️ Close Event** — sets `live_override: false`, banner clears for everyone
- Status shows: `🟢 LIVE — started 8:00 AM` or `⚪ Not live`
- Auto-closes 8 hours after tee time regardless

**Maintenance Mode**
- Enable → all players see "Back Shortly" screen on next load
- Commissioner bypass: `https://birdiefriends.com/portal.html?preview=7797`
- Disable → portal returns to normal for everyone

**Live Scorecard Test Mode**
- Enable → live event banner appears on next upcoming BF Series event regardless of tee time
- **DEV/TESTING ONLY** — use Event Control for production
- ⚠️ Disable before any BF Series tee time

### Verifying flag state
Visit in browser: `https://birdiefriends-push.birdiefriends01.workers.dev/flags`

---

## Live Event System (v3.9.26+)

### Overview
When a BF Series event's tee time arrives (or commissioner starts manually), the portal activates a **Live Event Banner** for all registered players. Non-registered players see no banner.

### Live window
- **Auto:** Tee time → tee time + 8 hours (`LIVE_EVENT_HOURS = 8`)
- **Manual:** Commissioner taps Start Live Now → auto-closes at tee time + 8 hours

### Event Control — Operational Sequence
1. **~60 min before tee time** — tap **▶️ Start Live Now** in Admin → Event Control
2. Players can now explore Birdie Alert, CttP, Scorecard before round starts
3. **Post-round** — tap **⏹️ Close Event** (or wait for auto-close at tee time + 8h)

### Banner sections (in order)
1. **🦅 Birdie Alert** — any registered player announces a birdie; skin detection fires push notification
2. **🎯 Closest to the Pin** — live CttP leaderboard; last submission per hole wins (timestamp)
3. **📋 Post-round Scorecard** — hidden behind "🏁 End Round — Enter Scorecards" button; expands for overseer data entry

### Birdie Alert
- Player dropdown (defaults to current player, can pick any registered player)
- Hole grid (#1–#18)
- Tap "🦅 Announce Birdie" → push notification fires to all subscribers
- **Skin detection (in-session memory only — no Jotform write):**
  - First birdie on hole → "{Full Name} birdied #N — skin is live! Beat it to win."
  - Second birdie on same hole → "Skin busted on #N — {Player2} matched {Player1}. No skin on this hole."
  - Third+ birdie on busted hole → "{Player} birdied #N — hole already busted, no skin."
  - Full names used throughout — avoids duplicate first name ambiguity

### CttP (Closest to the Pin)
- Active holes for BSGC: #3, #8, #10, #15, #18
- Tap hole pill → optional distance entry (ft.in format e.g. 4.5) → submit
- Last submission per hole = current leader (timestamp wins — honor system)
- Push notification fires on each new leader
- Reads from Jotform CttP form on panel open; refreshes each time
- Distance input hardened: `oninput` strips non-numeric characters; `submitCttp()` rejects negatives
- **Form ID:** `251002357493048`

### Post-Round Scorecard
- Tap "🏁 End Round — Enter Scorecards" to expand
- Overseer selects player via player picker sheet, enters point scores hole by hole
- Point values: Albatross=8, Eagle=6, Birdie=4, Par=2, Bogey=1, Bogey+=0
- Front/Back/Total auto-calculate
- Submit → green ✅ confirmation card shows (total pts + player name)
- Two options after confirm: **👤 Enter Next Player's Scorecard** (resets, stays in panel) or **✓ Done — All Scorecards In** (closes panel)
- **Form ID:** `250963587514163`

### Groupings Link in Live Panel
- 📋 Groupings & Tee Times link appears at top of expanded live panel
- Same visibility conditions as event card groupings link (meta exists + visible + event name match)
- Shows (Preliminary) or (Final) label

### Point values (scorecard)
**Left to right:** 0 Bogey+ · 1 Bogey · 2 Par · 4 Birdie · 6 Eagle · 8 Albatross

### Golf course tag
Standardized to `BSGC` for Blue Shamrock GC. Update when other courses added.

---

## Push Notifications & Subscriber Management

### Architecture — Jotform-First (v3.10.58+)
**Jotform Membership form QID 23 (`pushId`)** is the single source of truth for notification identity.

- **Subscribe flow:** OneSignal SDK grants a push ID → portal writes it to Jotform `pushId` field → done
- **Send flow:** Load Jotform members where `bfw=Yes` + `active=Active` + `pushId` present → send to `include_player_ids`
- **No OneSignal identity reads needed** — `external_user_id`, `OneSignal.login()`, aliases all removed
- **OneSignal is purely a delivery pipe** — it doesn't need to know player names

### How push notifications work
Portal → Cloudflare Worker (`/`) → OneSignal API → player devices. Fire and forget.
Targeting: `include_player_ids: [pushId, pushId, ...]` sourced from Jotform memberData.

### iOS Requirements
- iOS 16.4+ required
- Portal must be **installed as PWA** (Add to Home Screen) — does NOT work in Safari browser tab
- `window.navigator.standalone === true` detects PWA vs browser

### PWA Install Flow
**iOS (3 steps):**
1. Tap Share button ⎋ at bottom of Safari (box with arrow pointing up)
2. Tap "Add to Home Screen" — scroll share sheet, tap + icon, tap Add top-right
3. Open from home screen icon → tap Allow when prompted for notifications

**Android (one tap when available):**
- Portal shows **"⬇️ Install App — one tap"** button if Chrome fires `beforeinstallprompt`
- Tap → Chrome native install dialog → one more tap → done
- If prompt not available: Chrome menu ⋮ → "Add to Home Screen"

**First PWA launch auto-prompt:**
- Portal detects first launch from home screen icon
- Waits 2 seconds, shows toast "🔔 Tap Allow to get BirdieFriends notifications!"
- Fires notification permission request automatically

### Push ID Sync (replaces OneSignal identity)
`writeSubscriptionToMember(pushId)` called at:
1. Subscribe time (`osSubscribe`) — writes new pushId to Jotform
2. Player select time (`selectPlayer`) — writes if Jotform record is missing pushId
3. App load (`osIdentityRefresh`) — syncs if pushId changed since last session

### Duplicate Subscription Cleanup
- Retired — Jotform owns one pushId per player, no dupe management needed
- Worker `DELETE /user/:id/stale` endpoint still exists but is no longer called
- Admin Delete button still available for manual OneSignal cleanup if needed

### Subscriber Admin Panel (⚙️ gear → Push Subscribers)
Two sections (Jotform-based — no OneSignal read needed):
- ✅ **Subscribed** — Active + BFUpdates=Yes members with a pushId in Jotform. Shows truncated Push ID (tap to copy). 📲 Test button sends direct push to verify delivery — shows actual OneSignal error on failure.
- ❌ **Not subscribed** — Active + BFUpdates=Yes members with no pushId on file. Shows Member Since date. Instructions: open portal → select name → tap 🔕 bell.

**📋 Checklist button** — opens Sunday-style hit list with persistent checkboxes (keyed by date). Works on phone. Shows same two tiers with iPhone/Android setup instructions.

### Push Notification Diagnostics (from BFSeries#3)
- **Sporadic delivery on course:** Most likely iOS Focus Mode silently swallowing pushes, or player opened portal from Safari tab instead of home screen icon. Ask players to check Settings → Focus before event.
- **Player has no pushId in Jotform:** Manually paste OneSignal ID from OneSignal User Records dashboard into Jotform membership QID 23. Confirmed working — Ron Grow and Tony Choy added this way 2026-06-01.
- **Player sees announcements but no pop notifications:** pushId is valid (subscription exists), problem is device-level display (notification banner style set to "None" in iOS Settings, or Focus Mode active).
- **Message queue is reliable fallback:** Even when pop notifications fail, players can open the app and see all announcements in the feed. This is the intended fallback for on-course use.

### Targeting methods
| Method | Function | Use case |
|--------|----------|----------|
| All BFUpdates subscribers | `osSendAll()` | Broadcasts — uses Jotform pushIds |
| Named players only | `osSendToPlayers(names[])` | Event-scoped — looks up pushIds from memberData |
| Specific device | `osSend({include_player_ids})` | Direct test or one-off push |

### Announcement Feed — Known Limitation
The portal announcement feed reads from **OneSignal notification history**. OneSignal's API only supports cancelling scheduled/in-flight messages — it cannot delete already-delivered messages via API. The "Delete All" button in Admin therefore cannot clear the feed for all players.

**Workaround for now:** Use Commissioner Broadcast to send a cancellation/update message. Players can individually dismiss announcements.

**Permanent fix (backlogged — Worker KV Feed):** Worker writes a structured entry to KV on every notification send. Portal reads `/feed` endpoint instead of OneSignal history. Commissioner controls the data completely. See backlog item below.

### OneSignal API Keys
| Key | Status | Notes |
|-----|--------|-------|
| Legacy API Key | ⚠️ Active (do not disable yet) | Still used for notification sends via Worker POST / |
| BirdieFriends Portal | ✅ Active | Rich key — rotated 2026-06-02, stored in Worker OS_REST_KEY secret |

**Key format:** Rich keys start with `os_v2_app_...` — much longer than legacy keys.

---

## Jotform

### API Key
`dd0cb09a71eee7d0db3aa690e292660f`

### Form IDs
| Form | ID |
|------|-----|
| Event Registration | 233103072261037 |
| Event Request | 233113019726045 |
| Membership | 233083522910045 |
| Series Scorecard | 250963587514163 |
| Closest to the Pin (CttP) | 251002357493048 |

### Membership Form QIDs
| QID | Field | Notes |
|-----|-------|-------|
| 3 | First Name | `name` |
| 6 | Last Name | `lastname` |
| 7 | Nick Name | `nickname` |
| 8 | Cell Phone | `cellPhone` |
| 4 | Email | `email` |
| 10 | Member Date | `memberDate` |
| 20 | Broadcast opt-in | `bfw` — Values: `Yes` / `No` |
| 22 | Active | `active` — Values: `Active` / `InActive` |
| 23 | Push ID | `pushId` — Written at subscribe time |

### Series Scorecard Form QIDs
| QID | Field | Notes |
|-----|-------|-------|
| 31 | Name | Dropdown — pre-populated roster |
| 30 | Event | Text, pre-filled |
| 28 | Golf Course | Text, pre-filled (BSGC) |
| 4 | Hole #1 | Points 0/1/2/4/6/8 |
| 7–23 | Holes #2–#18 | QID sequence: 7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23 |
| 24 | Front | Auto-calc |
| 25 | Back | Auto-calc |
| 26 | Total | Auto-calc |

### CttP Form QIDs
| QID | Field | Notes |
|-----|-------|-------|
| 3 | Hole # | Radio: #3, #8, #10, #15, #18 |
| 4 | Player Name | Dropdown — roster |
| 5 | Distance ft.in | Optional, e.g. 4.5 |
| 7 | Event | Text, pre-filled |

### Event Request Form Fields
| QID | Field | Notes |
|-----|-------|-------|
| 4 | Date & Time | Returns long-form: "Saturday, June 6, 2026 09:20 AM" |
| 5 | Event Location | Default: BSGC |
| 6 | Event Format | Radio |
| 10 | Event Name | |
| 11 | Requestor Name | |
| 13 | Capacity | |

---

## Portal Architecture Quick Reference

### Key Constants
```javascript
const JOTFORM_API_KEY   = 'dd0cb09a71eee7d0db3aa690e292660f';
const REQUEST_FORM_ID   = '233113019726045';
const REGISTER_FORM_ID  = '233103072261037';
const MEMBER_FORM_ID    = '233083522910045';
const SCORECARD_FORM_ID = '250963587514163';
const CTP_FORM_ID       = '251002357493048';
const COMMISSIONERS     = ['Brian Hager'];
const COMMISSIONER_PIN  = '7797';
const COMMISH_PHONE     = '6177104755';
const BATCH_SIZE        = 20;
const OS_APP_ID         = '88022359-a979-4814-8a52-6f1df9884be2';
const OS_API            = 'https://birdiefriends-push.birdiefriends01.workers.dev/';
const LIVE_EVENT_HOURS  = 8;
const CTP_HOLES_DEFAULT = [3,8,10,15,18];
const MEMBER_PUSH_QID   = '23';
```

### Remote Flags (Cloudflare KV)
| Flag | KV Key | Effect |
|------|--------|--------|
| Maintenance Mode | `maintenance` | Hides portal for all users; bypass `?preview=7797` |
| Live Test Mode | `live_test` | Forces live banner — dev/testing only |
| Live Override | `live_override` | Commissioner manual event start — production use |
| Live Override Since | `live_override_since` | ISO timestamp of manual start |

### localStorage Keys
- `bf_player` — selected player name
- `bf_guest` — `'1'` when in Guest mode
- `bf_player_initials` — initials for avatar
- `bf_inactivity_check` — date of last inactivity check
- `bf_commissioner` — `'verified'` when PIN confirmed
- `bf_os_dismissed_{player}` — notification prompt dismissed per player
- `bf_install_nudge_dismissed` — PWA install nudge dismissed (per device)
- `bf_pwa_first_launch_done` — first PWA launch auto-prompt already fired
- `bf_swipe_tip_dismissed` — swipe tip card dismissed (per device)
- `bf_broadcast_state` — JSON batch state for in-progress broadcast
- `bf_hidden_events_{player}` — JSON array of event IDs swiped off My Events
- `bf_seen_events_{player}` — JSON set of event IDs marked as seen
- `bf_first_load_{player}` — ISO timestamp of player's first app load
- `bf_announcements_dismissed` — JSON array of dismissed announcement IDs

### 5th Player Flow
- `getCapacityStatus()` → `fivePending: true` when 5 registered on 8-man event
- `getMyCapacityDisplay()` identifies 5th player by sorting `yesRegs` by `createdAt` — last registrant sees warning
- Gold ⏳ banner on card: "Spot not yet confirmed — contact Commissioner if still 5th morning of event"
- Warning clears automatically when 6th player joins

### Groupings Link on Event Cards
- Portal fetches `groupings-meta.json` on load (alongside remote flags)
- Link shows only when: meta exists + `visibility === 'visible'` + `evt.name === meta.eventName`
- Label shows "(Preliminary)" when `status === 'Preliminary'`
- GolfScorer publishes meta automatically on every Publish Groupings click

---

## Cloudflare Worker

### Worker: birdiefriends-push
| Property | Value |
|----------|-------|
| Name | `birdiefriends-push` |
| URL | `https://birdiefriends-push.birdiefriends01.workers.dev/` |
| Account | Birdiefriends01@gmail.com |
| Secret | `OS_REST_KEY` — OneSignal rich API key (updated 2026-06-02) |
| KV Binding | `BF_FLAGS` → `BF_FLAGS` namespace |

### Worker Endpoints (complete — v2026-06-02)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/` | None | Send OneSignal push notification |
| GET | `/flags` | None | Read all KV flags |
| POST | `/flags` | PIN 7797 | Write flag to KV (+ live_override_since timestamp) |
| GET | `/subscriptions` | None | Fetch OneSignal subscriber list |
| GET | `/notifications` | None | Fetch sent notification history |
| DELETE | `/subscription/:id` | None | Delete one specific push subscription |
| DELETE | `/user/:externalId/stale` | None | Delete all but newest subscription for named player |
| DELETE | `/notifications/clear` | PIN 7797 | Attempt to cancel notifications (limited — see note below) |

**⚠️ DELETE /notifications/clear limitation:** OneSignal's cancel API only works on scheduled/in-flight messages. Already-delivered messages cannot be deleted via API. This endpoint will return 0 deleted / N failed for all delivered messages. Permanent fix is the Worker KV Feed (backlogged).

### OneSignal
- **App ID:** `88022359-a979-4814-8a52-6f1df9884be2`
- **REST Key:** stored in Cloudflare Worker secret `OS_REST_KEY` only — rich key format (`os_v2_app_...`)
- **Legacy key:** still enabled in OneSignal dashboard — do not disable until Worker POST / is confirmed working with rich key
- **Device type codes:** 0=Safari (iOS), 1=Android, 5=Chrome, 7=Safari, 8=Firefox, 9=Safari (iOS), 11=Edge, 17=Chrome (Android)
- **Key rule:** When creating a new API key, leave IP Allowlist unchecked — Workers use rotating IPs

### OneSignal Feature Flags (in portal code)
```javascript
const OS_NOTIFY_NEW_EVENT      = false;  // auto-fire when new event published
const OS_NOTIFY_SUB_PROMOTION  = false;  // flip true when ready
const OS_NOTIFY_EVENT_REMINDER = false;  // needs scheduler
```

---

## GolfScorer Reference

### Version History
| Version | Key Change |
|---------|-----------|
| v8.0 | Initial release |
| v8.1 | groupings-meta.json published alongside groupings.html; table-layout:fixed for quota column; version date bump |
| v8.2 | grpOnTabOpen() called on page load (was missing — caused empty Groups tab on refresh); Quota column width increased to 62px |
| v8.3 | Preview Mode UI (amber banner, relabeled buttons, local file links); GS_VERSION constant; quota fix attempt 1 |
| v8.4 | getPlayers() quota fix attempt 2 (incorrect — iterative drift) |
| v8.5 | getPlayers() quota fix: calls grpGetEstimatedQuota() directly — single source of truth matching groupings page exactly |
| v8.15 | Tie payout fix: Math.floor on share, T-N podium labels, tie-aware medal display (live + published) |
| v8.6 | fmtDiff: smart result display (2 decimals only when needed to show real difference) |

### Groups Tab — Data Persistence
- State saves to `localStorage['bf_groups_data']` on every change
- Contains: players, groups, eventName, firstTee, status, visibility
- **v8.2 fix:** `grpOnTabOpen()` now called on page load — data restored even without switching tabs
- Recovery command if UI shows empty: open console → `grpOnTabOpen()`

### Groupings Publish
- Deploys `groupings.html` + `groupings-meta.json` to Netlify simultaneously
- Meta format: `{eventName, status, visibility, publishedAt}`
- Portal reads meta to show/hide groupings link on event cards
- Set First Tee Time correctly before publishing — it's baked into the generated HTML

### Groupings Display (groupings.html)
- Table uses `table-layout:fixed` — columns never clip regardless of name length
- Column widths: Player=auto, Rank=48px, Evts=36px, Tee=58px, Quota=62px
- Long names (Knappenberger) wrap within Player column
- Netlify CDN cache: wait ~60s after publish before sharing link

---

## iOS / WebKit Notes

- Push notifications require **iOS 16.4+** and portal **installed as PWA**
- Does NOT work in Safari browser tab — must launch from home screen icon
- `window.navigator.standalone === true` detects PWA vs browser
- Minimum 44px tap targets on all interactive elements
- No hover-dependent functionality
- `overflow:hidden` on full card breaks expand/collapse in older WebKit — apply to `.event-card-top` only

---

## Backlog & Known Issues

| Item | Status | Notes |
|------|--------|-------|
| **Worker KV Feed** | 🔴 Priority — Session 27 | Replace OneSignal history as feed source of truth. Worker writes KV entry on every send. New GET /feed + DELETE /feed endpoints. Portal reads /feed. Commissioner can clear. Rolling 48hr/50-entry window. Prerequisite for Live Feed UI upgrade. Full spec in Session 26 starter. |
| **Cancelled Events** | 🔴 Priority — Session 27 | Commissioner marks event cancelled → push to registered players → card shows ❌ cancelled state → ghost entry on Schedule tab. Needs KV flag per event ID + Jotform row handling (hide vs delete). Full spec needed. |
| Live Feed UI upgrade | 🔲 After KV Feed | Styled activity stream in live panel. Color-coded by type (birdie/CttP/commissioner). Auto-refresh 60s. Push becomes nudge not primary delivery. Requires KV Feed first. |
| Push recipient scope | 🔲 Session 27 | Birdie Alerts + CttP → all members with pushId+bfw=Yes. Only registered-player filter for sub promotion. |
| Active/Inactive auto-reset | 🔲 Session 27 | Jeremy Burkett + Tony Hager reset after manual Active set. Fastest fix: hardcode exempt array like COMMISSIONERS array. |
| Push notification message audit | 🔲 Before next event | Audit ALL notification templates before BFSeries#4: birdie alert, CttP leader, skins bust, sub promotion, end of round, commissioner broadcast. Skins message was wrong at BFSeries#3. |
| BL-08 — Self-service event management | 🔲 Backlog | Member creates event, becomes temp commish |
| BL-14 — Event type / badge field | 🔲 Backlog | Separate Event Type from Event Format; drives badge/visual treatment |
| Live overseer group scoring | 🔲 Post May 31 | Read groupings data; overseer enters for whole group |
| CttP holes per event | 🔲 Future | Add CttP Holes field to Event Request form |
| Sub promotion notification | 🔲 Planned | Flip `OS_NOTIFY_SUB_PROMOTION = true` when ready |
| Event reminder notification | 🔲 Planned | Needs scheduler |
| Dead code cleanup | 🔲 Future | `buildHeroCard` still in portal — never called |
| GS state persistence | 🔲 Session 23 Priority 1 | After Calculate Results, auto-save event state to localStorage `bf_pending_event`. On reload: "Resume pending event?" — avoids Jotform re-fetch |
| Players list broken on one iPhone | 🔲 Parked | Suspected older WebKit |
| BL-17: Two Series Events Same Day | 🔲 Low urgency | `getLiveEvent()` uses Array.find() — first match wins |

---

## Session Handoff Checklist

- [ ] If portal changed: Claude deploys via `bf_deploy.py` — live in ~60s, no action needed
- [ ] If worker.js changed: deploy to Cloudflare manually (Workers → birdiefriends-push → Edit code → paste → Save and Deploy)
- [ ] If session starter / ops guide changed: Claude pushes directly to library — no action needed
- [ ] Test on phone — confirm version number and basic functionality
- [ ] Verify remote flags at `/flags` endpoint
- [ ] Next session: open `deploy.html` → Claude tab → Copy Session Start Command → paste into Claude
- [ ] Save worker.js to GolfScorer folder if it changed this session
- [ ] Update this `BF_Operations_Guide.md` with anything new learned

---

## GitHub Pages Deploy Troubleshooting

### Symptom: Deploy bat says success but old version still serving
**Diagnosis steps:**
1. Check raw file in repo: `raw.githubusercontent.com/birdiefriends/birdiefriends.github.io/main/docs/portal.html`
2. If raw file is correct → CDN caching problem
3. If raw file is wrong → deploy script didn't push the right file

**CDN cache fixes (in order):**
1. Hard reload: Ctrl+Shift+R
2. Incognito window
3. Re-run deploy_portal.bat
4. Edit portal.html directly in GitHub (add space → commit)
5. Wait — can take several hours with custom domains

**Note:** birdiefriends.com DNS is NOT proxied through Cloudflare. No Cloudflare cache to purge for the portal.

---

## Complete Version History

### Portal
| Version | Key Change |
|---------|-----------|
| v3.10.0 | New nav, swipe-to-dismiss, Schedule tab, Admin to ⚙️ gear |
| v3.10.1–19 | See Session 20 starter |
| v3.10.23 | Nav renamed: Home→⛳ My Events, Events→🅿️ Parked |
| v3.10.24–28 | Guide, pulseCard, About fixes |
| v3.10.29–32 | Fivesome warning banner + detection |
| v3.10.33–40 | Fivesome refinements, duplicate subscriber detection, pulseCard |
| v3.10.41 | Fivesome: parseRegSubmissions adds createdAt; fivePending state; localStorage-free detection |
| v3.10.42 | Subscriber panel: OneSignal ID column; Delete ↗ links |
| v3.10.43 | Subscriber panel syntax fix (osBaseUrl scope, surrogate emoji encoding) |
| v3.10.44 | osBaseUrl hoisted to function scope (was inside if-block — caused "not defined" error) |
| v3.10.45 | Groupings link on event cards — 7-day time window (replaced by exact match in .47) |
| v3.10.46 | Fivesome: suppress status badge when pending banner showing |
| v3.10.47 | Groupings link: exact eventName match via groupings-meta.json; shows (Preliminary) label |
| v3.10.48 | Worker DELETE routes wired up; adminDeleteSubscription(); osPruneStaleSubscriptions() |
| v3.10.49 | Delete button shows actual HTTP status on failure; Worker tries v5 then v1 endpoint |
| v3.10.50 | iOS 3-step visual install guide; Android one-tap native install; first-PWA-launch auto-prompt |
| v3.10.51 | Event Control: Start Live Now / Close Event; live_override flag; updateEventControlUI() |
| v3.10.52–57 | Notification identity investigation: v1/v5/jf source badges, osIdentityRefresh, osHealthCheck, iOS install guide improvements, syncNotifications button, How-to-fix guide modal (superseded by v3.10.58 rebuild) |
| v3.10.58 | **Jotform-first notification architecture** — removed OneSignal.login(), osPruneStale, external_user_id reliance. osSendAll/osSendToPlayers use Jotform pushIds. loadAdminSubscribers rebuilt. Sunday Checklist + adminSendTestPush added. memberDate in parsed member object. |
| v3.10.59–64 | Syntax fixes; Test button error detail; deploy_portal.py auto-increment wired in; Schedule tab unregister; 48hr lock scoped to cap>4 |
| v3.10.65 | Text All Players multi-select dialog; GitHub token sync (launch_golf_scorer.py); guide.html added to deploy |
| v3.10.66 | Skins message logic fixed (full names, 3 states); re-register bug fixed; scorecard submit→confirm→next flow; groupings link in live panel; CttP input hardened |
| v3.10.67–68 | Session 25 cleanup; version sync hardened; Worker app_id fix prepared |
| v3.10.69 | app_id added to both DELETE /notifications/clear portal calls (adminDeleteOneNotification + adminClearAllNotifications) |
| v3.10.70 | 48hr lock: added yesCount===0 guard — never show Sub if nobody registered yet |
| v3.10.71 | 48hr lock: root fix — lock condition now includes !is4man — 4-player events never lock regardless of 48hr window |
| v3.10.72 | Code Library: deploy_portal.py updated — deploys deploy.html, mirrors source files to source/ on every bat run |
| v3.10.77–79 | Session 28 test deploys: Going→Registered→Going→Registered via Claude-direct bf_deploy.py flow |

### Worker
| Date | Key Change |
|------|-----------|
| Pre-session 21 | POST /, GET /flags, POST /flags, GET /subscriptions, GET /notifications |
| 2026-05-27 | Added DELETE /subscription/:id, DELETE /user/:id/stale, live_override flag support, live_override_since timestamp, corsHeaders consolidated |
| 2026-06-01 | Added DELETE /notifications/clear (PIN required; fetch list then delete; returns {deleted, failed, errors, total}) |
| 2026-06-02 | OS_REST_KEY updated to OneSignal rich key format. DELETE /notifications/clear confirmed limited to cancelling scheduled messages only — cannot delete delivered messages. |
| 2026-06-03 | Added GET /history, POST /deploy, POST /rollback — GitHub-backed version control and remote deploy system. GitHub token hardcoded in Worker. |

### GolfScorer
| Version | Key Change |
|---------|-----------|
| v8.0 | Initial release |
| v8.1 | groupings-meta.json publish; table-layout:fixed; version display |
| v8.2 | grpOnTabOpen() on page load fix; Quota column 62px |
| v8.3 | Preview Mode UI (amber banner, relabeled buttons, local file links); GS_VERSION constant; quota fix attempt 1 |
| v8.4 | getPlayers() quota fix attempt 2 (incorrect — iterative drift) |
| v8.5 | getPlayers() quota fix: calls grpGetEstimatedQuota() directly — single source of truth matching groupings page exactly |
| v8.15 | Tie payout fix: Math.floor on share, T-N podium labels, tie-aware medal display (live + published) |
| v8.6 | fmtDiff: smart result display (2 decimals only when needed to show real difference) |

### launch_golf_scorer.py
| Date | Key Change |
|------|-----------|
| Pre-session 22 | GitHub Pages deploy, Google Sheets push, Jotform proxy, Claude Vision OCR, portal deploy |
| 2026-05-28 | TEST_PREVIEW_MODE flag; /api/preview/list route; /api/netlify/status returns preview_mode; gsVersion in sheets push payload; build_sheets_data stamps GS version in sheet title row |
| 2026-06-01 | GitHub token updated to match deploy_portal.py |

### Tie Payout Rules (FINALIZED 2026-05-12)

Pool the prizes for all tied positions, split evenly, floor to nearest dollar. Surplus stays in treasury.

| Scenario | Each tied player gets | Next place |
|---|---|---|
| Sole 1st, 2nd, 3rd | $40 / $20 / $10 | — |
| 2-way tie 1st | $30 each | 3rd still gets $10 |
| 3-way tie 1st | $23 each ($1 to treasury) | Nothing below |
| 2-way tie 2nd | $15 each | Nothing below |
| 3-way tie 2nd | $10 each | Nothing below |
| 2-way tie 3rd | $5 each | Nothing below |
| 3-way tie 3rd | $3 each ($1 to treasury) | Nothing below |
| 4-way tie 3rd | $2 each ($2 to treasury) | Nothing below |

**Rule:** when N players tie for a position, sum all prizes from that position through the last position consumed by the tie group, floor-divide by N. Players below the tie group receive nothing.

**Podium display:** tied players show T-1, T-2, or T-3 labels instead of 🥇🥈🥉. Both the live GS results tab and the published results.html apply this.

### Google Sheets
- **URL:** https://docs.google.com/spreadsheets/d/1QvnXGY8TLgCgAhXt8SBRbwa7eUz-Vouhu6Tyituee20
- **Tabs:** Raw Data, Standings, Green Flight, Combo Flight, Gold Flight
- **Workflow:** Calculate Results → Save to Series → Push to Sheets
