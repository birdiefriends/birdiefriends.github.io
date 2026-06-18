# BirdieFriends — Operations Guide
**Last Updated:** 2026-06-18 (Session 38 — credential-handling fix, Worker /deploy route)
**Maintained by:** Commissioner (Brian Hager) + Claude
**Purpose:** Ground truth for running, deploying, and testing the BirdieFriends system. Update at the end of every session.

---

## 1. Quick Reference — Event Day

### Key URLs
| Resource | URL |
|----------|-----|
| Portal (live) | https://birdiefriends.com/portal.html |
| Deploy panel | https://birdiefriends.com/deploy.html |
| Groupings | https://birdiefriends.com/groupings.html |
| Results | https://birdiefriends.com/results.html |
| Worker | https://birdiefriends-push.birdiefriends01.workers.dev/ |
| Flag check | https://birdiefriends-push.birdiefriends01.workers.dev/flags |
| GitHub library | https://github.com/birdiefriends/birdiefriends.github.io/tree/main/source |
| Architecture diagram | source/bf_architecture.html (PIN-locked) |

### Key Credentials
| Item | Value |
|------|-------|
| Commissioner PIN | 7797 |
| Jotform API Key | dd0cb09a71eee7d0db3aa690e292660f |
| OneSignal App ID | 88022359-a979-4814-8a52-6f1df9884be2 |
| Cloudflare account | Birdiefriends01@gmail.com |
| GitHub repo | birdiefriends/birdiefriends.github.io |

### Event Day Sequence
**Night before:**
1. Finalize HCP / groups in GolfScorer → Publish Groupings (Preliminary) → close GS

**Morning of event:**
1. Set Final → Publish Groupings → close laptop

**~60 min before tee time:**
1. Admin → Event Control → ▶️ Start Live Now

**On course:**
- Players enter Birdie Alert and CttP from the live banner
- Overseers proxy CttP/Birdie for their group using the 👤 Change picker
- Admin → 📝 Scorecard Check to monitor submissions

**Post-round (at home):**
1. Admin → Event Control → ⏹️ Close Event
2. Launch GS → update groups for actuals → Kick Off Event
3. Scorecard tab: Fetch from Jotform → CttP: Auto-fill from Jotform
4. Results: Calculate → Save to Series → Push to Sheets → Publish All Pages

### Session Start (any device)
1. Open `birdiefriends.com/deploy.html` → Claude tab → **📋 Copy Session Start Command** → paste into Claude
2. Claude auto-fetches library and is ready

---

## 2. Golden Rules

**Deploy & Version**
1. **`source/portal_version.txt` is the sole version source of truth.** The old `bf_deploy.py`-based flow read it, incremented patch, and pushed `docs/portal.html` + `source/portal.html` + `portal_version.txt` atomically. **As of Session 38, Claude no longer executes that flow directly** (see rule 1a) — but the version-truth principle itself is unchanged: never guess or manually edit the version.
1a. **NEW Session 38 — Claude does not import `bf_deploy.py` and call its TOKEN-authenticated functions** (`deploy()`, `deploy_file()`, `rollback()`). The embedded `TOKEN` is a live GitHub credential; Claude doesn't hold or use API keys/tokens directly to take actions, even with full user authorization. `bf_deploy.py` may still be read for reference logic only. For single-file pushes, use the Worker's `POST /deploy` route instead (PIN + content, no token — see §3 and §4 endpoint table). **Portal and GolfScorer deploys currently have no replacement mechanism** — both exceed the Worker's ~100KB body limit (§4), so porting `/deploy` doesn't trivially cover them. Unresolved; flag to the user rather than falling back to the old token path.
2. **Always run `node --check` before deploying portal changes.** Extract inline `<script>` blocks, concatenate, write to temp `.js`, run `node --check`. Non-negotiable — caught two blank-load incidents in Session 34.
3. **`bf_deploy.deploy_file(local_path, gh_path, msg)`** is the function the now-working Worker `/deploy` route reimplements server-side (same 404-on-sha handling). Use the Worker route, not the Python function directly — see rule 1a.
4. **`deploy_portal.bat` is retired.** The Worker `/deploy` route (PIN-gated, no token) is the standard for single-file library pushes as of Session 38. Secrets files (`deploy_portal.py`, `launch_golf_scorer.py`) stay laptop-only, unrelated to this change.
5. **Claude never reconstructs secrets files from scratch.** Upload `deploy_portal.py` or `launch_golf_scorer.py` before modifying — changes must be additive.
6. **Claude never reconstructs `worker.js` from scratch.** `source/worker.js` is fetched from the library at every session start.
7. **At session end, Claude deploys the updated session starter and ops guide directly.** No bat, no manual copy.

**Testing & Safety**
8. **Never test the portal from a local file for Jotform data.** Jotform API blocks `file://` origins. UI testing only; data requires `https://birdiefriends.com/portal.html`.
9. **TEST_PREVIEW_MODE must be False on event day.** Check `launch_golf_scorer.py` before launching. When True, publishes go to local `preview/` only — players see nothing.
10. **Export GolfScorer JSON before any mock/test run.** Rollback = reimport the JSON export.
11. **Always run a syntax check before deploying.** Apostrophes in single-quoted strings (`'you\'re'`) and nested onclick quotes are the common failure modes. Pre-compute escaped variables rather than inline `.replace()` inside onclick attrs.

**Operations**
12. **GS does not go to the course.** Laptop stays home. All scoring happens post-round. Groupings can be published the night before.
13. **Use Event Control (not Live Test Mode) for production event starts.** Live Test Mode is dev only.
14. **Remote flags affect all devices instantly.** KV flags take effect on next page load for every user.
15. **After Publish Groupings, wait ~60 seconds before sharing the link.** GitHub Pages CDN caches aggressively.
16. **When something doesn't work, check the phone first.** The portal is mobile-first PWA — iOS rendering and PWA chrome require a real device.
17. **After updating `launch_golf_scorer.py`, restart the server.** Close the console window and reopen `Launch_Golf_Scorer.bat`. As of Session 37 the server window no longer auto-minimizes — leave it visible; a GitHub pull failure or port conflict now prints a loud, explicit message there instead of failing silently.

**Versioning Philosophy**
18. **Patch / Minor / Major:**
    - **Patch (3.10.x):** bug fixes, UI tweaks, copy changes, adding a button. No new capability.
    - **Minor (3.10 → 3.11):** meaningful new feature a player would notice. Next trigger: Alerts/Inbox launch → **3.11.0**.
    - **Major (3.x → 4.0):** architectural shift — new backend, off Jotform, commercial multi-tenant.

**Template Integrity**
19. **Generated HTML templates (results.html, standings.html, mygame.html, groupings.html) must have every `onclick` reference a function that actually exists in that same file, and no duplicate element IDs.** A `node --check` syntax gate catches JS errors but catches neither of these — both fail completely silently (nothing happens on click, no console error visible at a glance). Confirmed bug, Session 37: the Groups tab's `onclick="openGroupingsForEvent()"` called a function that was never defined anywhere in `generateResultsPage()`'s output, and the `tab-groups` content panel was duplicated wholesale in the same template. Spot-check before trusting a template fix: `grep` every `onclick="X("` target and confirm `function X` exists; `grep -c 'id="..."'` for anything that should be unique.

---

## 3. Deploy Procedures

### Portal — UNRESOLVED as of Session 38, no Claude-safe mechanism
The old flow (`python3 bf_deploy.py birdiefriends_portal.html "<msg>"`) required Claude to execute `bf_deploy.py`'s embedded GitHub TOKEN directly — no longer something Claude does (see Golden Rule 1a). The Worker's `/deploy` route can't simply replace it either: the portal is ~350KB+, well past Cloudflare's ~100KB free-tier body limit (§4). Until this is solved (larger body limit, chunked upload, or some other path), **portal deploys need to be discussed with the user case by case** rather than defaulted to either the old token path or assumed-working new infrastructure.

**Hardened version sync (run if version mismatch suspected; read-only, no deploy):**
```bash
PORTAL="/home/claude/birdiefriends_portal.html"
VER_URL="https://raw.githubusercontent.com/birdiefriends/birdiefriends.github.io/main/source/portal_version.txt"
LIVE_VER=$(curl -s --max-time 10 "$VER_URL" | grep -o 'v3\.[0-9]*\.[0-9]* · [0-9-]*' | head -1)
if [ -z "$LIVE_VER" ]; then echo "❌ Cannot determine live version — aborting."; exit 1; fi
sed -i "s/v3\.[0-9]*\.[0-9]* · [0-9-]*/${LIVE_VER}/g" "$PORTAL"
echo "✅ Portal synced to: $LIVE_VER"
```

**If phone shows old version after a deploy:** close tab fully and reopen, try `?v=X`, check raw file on GitHub.

### Single-file deploys (worker, GolfScorer, ops guide, session starter, business plan docs, etc.)
As of Session 38, use the Worker's `POST /deploy` route — PIN and content only, no token through chat:
```bash
curl -s -X POST "https://birdiefriends-push.birdiefriends01.workers.dev/deploy" \
  -H "Content-Type: application/json" \
  -d '{"pin":"7797","path":"source/<file>","content":"<file contents>","message":"<commit message>"}'
```
Path must start with `source/`. Handles new-file creation and existing-file updates. **Caveat:** GolfScorer (~370KB) also exceeds the ~100KB Worker body limit — same unresolved status as the portal, not yet usable via this route. The version-suffix auto-increment that the old `deploy_file()` did for GolfScorer paths (a→b→…→z→aa) is also not yet reimplemented in the Worker route — bump it manually in the content before pushing until that's ported.

### Cloudflare Worker (code changes, not data deploys)
Worker code changes still require manual Cloudflare paste — GitHub `source/worker.js` is the record, not the live worker. This is unrelated to the credential question above; it's always required regardless.
1. dash.cloudflare.com → Workers & Pages → birdiefriends-push → Edit code
2. Paste `worker.js` contents (overwrite entire editor) → Save and Deploy

### Generated Pages (My Series, Results, Standings, Groupings)
1. Launch GS → score event → Calculate Results
2. Click **🏁 End of Event** (Session 37+) — runs Save to Series → Push to Sheets → Publish All Pages as one tracked action, with per-step status and per-step retry. Or run the three individually via the Actions bar if preferred.

**Groupings publish (separate, pre-round):**
- Click **🌐 Publish Groupings** in Groups tab
- Set Status → **Final** before final publish
- Deploys `groupings.html` + `groupings-meta.json` + the permanent archive copy
- Wait ~60s before sharing link
- **As of Session 37, no manual follow-up needed:** `grpPublish` Final now writes the archive pointer into a durable `bf_groupings_archive` localStorage map keyed by event name; `saveEventToSeries()` reads that map and attaches `groupingsFile` to the event record automatically when the round is saved. The old manual checklist step ("verify groupingsFile is in series data, then re-publish") is gone — this is what it replaced.

### Token Recovery
GitHub token lost: github.com → Settings → Developer settings → Personal access tokens → GolfScorer → Regenerate. Paste new `ghp_...` into BOTH `deploy_portal.py` line 16 AND `launch_golf_scorer.py` line 39. Both must match or one will fail with 401.

---

## 4. System Reference

### Current Versions
| Component | Version | Status |
|-----------|---------|--------|
| Portal | v3.10.139 · 2026-06-16 | Production ✅ |
| GolfScorer | v8.17 · 2026-06-17g | Deployed ✅ |
| Worker | 2026-06-18 | Deployed ✅ — added PIN-gated `POST /deploy` route + `GH_TOKEN` secret (Session 38) |
| deploy.html | 2026-06-12 | Live ⚠️ — Library tab (view/download) works; Deploy/History/Rollback tabs are broken (wrong `WORKER_URL` subdomain + routes that never existed), confirmed Session 38. Not yet fixed. |
| bf_deploy.py | 2026-06-18 | Current, but **restricted** — Claude no longer executes its TOKEN-authenticated functions (Session 38, Golden Rule 1a). `deploy_file()`'s new-file-creation patch is sound; the restriction is about who invokes it, not the code itself. |
| bf_architecture.html | 2026-06-12 | Library ✅ |
| Launch_Golf_Scorer.bat / launch_golf_scorer.py | 2026-06-17 | Current ✅ — hardened (visible server window, loud port-conflict failure); laptop-only, not in GitHub |

### Library Files (fetched at session start)
| File | Path |
|------|------|
| Session Starter | `source/BF_Golf_Scorer_Session_Starter_current.md` |
| Ops Guide | `source/BF_Operations_Guide.md` |
| Portal version | `source/portal_version.txt` |
| Portal HTML | `docs/portal.html` |
| Worker | `source/worker.js` |
| Deploy script | `source/bf_deploy.py` |
| Architecture diagram | `source/bf_architecture.html` |

### Cloudflare Worker Endpoints
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/` | None | Send OneSignal push notification |
| GET | `/flags` | None | Read all KV flags |
| POST | `/flags` | PIN | Write KV flag |
| GET | `/subscriptions` | None | Fetch OneSignal subscriber list |
| GET | `/notifications` | None | Fetch sent notification history |
| DELETE | `/subscription/:id` | None | Delete one push subscription |
| DELETE | `/notifications/clear` | PIN | Cancel scheduled notifications only — cannot delete delivered |
| POST | `/deploy` | PIN | **Real as of Session 38.** Push/create a file under `source/` to GitHub via `env.GH_TOKEN` (Cloudflare secret, never seen by Claude). Subject to the ~100KB body limit below. No KV snapshot — commits straight to GitHub, that's it. |
| GET | `/feed` | None | Worker KV notification feed |
| DELETE | `/feed` | PIN | Clear KV feed entries |

**Corrected, Session 38:** `GET /history` and `POST /rollback` were listed in this table previously but were never actually implemented — that was aspirational documentation matching `deploy.html`'s broken UI assumptions, not Worker reality (confirmed by direct inspection of `worker.js`'s route table). They don't exist. If/when built, they'd belong here.

**⚠️ Worker body size limit:** Cloudflare free tier ~100KB. Portal (~350KB+) and GolfScorer (~370KB+) both exceed this — `/deploy` can't currently take either. See Golden Rule 1a and §3 for the resulting unresolved gap.

### KV Flags
| Key | Type | Purpose |
|-----|------|---------|
| `maintenance` | bool | Portal offline for all players; bypass `?preview=7797` |
| `live_test` | bool | Force live banner — dev/testing only |
| `live_override` | bool | Commissioner manual event start — production |
| `live_override_since` | ISO string | Timestamp of manual start |
| `feed::{timestamp}` | JSON | Live notification feed entries |

### Jotform Form IDs
| Form | ID |
|------|-----|
| Event Registration | 233103072261037 |
| Event Request | 233113019726045 |
| Membership | 233083522910045 |
| Series Scorecard | 250963587514163 |
| Closest to the Pin | 251002357493048 |

### Jotform QIDs — Membership
| QID | Field | Notes |
|-----|-------|-------|
| 3 | First Name | `name` |
| 6 | Last Name | `lastname` |
| 7 | Nick Name | `nickname` |
| 8 | Cell Phone | `cellPhone` |
| 4 | Email | `email` |
| 10 | Member Date | `memberDate` |
| 20 | Broadcast opt-in | `bfw` — Yes / No |
| 22 | Active | `active` — Active / InActive |
| 23 | Push ID | `pushId` — written at subscribe time |

### Jotform QIDs — Series Scorecard
| QID | Field |
|-----|-------|
| 31 | Player Name |
| 30 | Event |
| 28 | Course (BSGC) |
| 4,7–23 | Holes #1–#18 (points 0/1/2/4/6/8) |
| 24 | Front 9 total |
| 25 | Back 9 total |
| 26 | Total |

### Jotform QIDs — CttP
| QID | Field |
|-----|-------|
| 3 | Hole # |
| 4 | Player Name |
| 5 | Distance (ft, optional) |
| 7 | Event |

### Portal Key Constants
```javascript
const COMMISSIONERS     = ['Brian Hager'];
const COMMISSIONER_PIN  = '7797';
const LIVE_EVENT_HOURS  = 8;
const CTP_HOLES_DEFAULT = [3,8,10,15,18];
const OS_APP_ID         = '88022359-a979-4814-8a52-6f1df9884be2';
const OS_API            = 'https://birdiefriends-push.birdiefriends01.workers.dev/';
```

### Portal localStorage Keys
| Key | Purpose |
|-----|---------|
| `bf_player` | Selected player name |
| `bf_guest` | `'1'` when Guest mode |
| `bf_commissioner` | `'verified'` when PIN confirmed |
| `bf_hidden_events_{player}` | Events swiped off My Events |
| `bf_seen_events_{player}` | Events marked seen |
| `bf_announcements_dismissed` | Dismissed announcement IDs |
| `bf_groups_data` | GolfScorer Groups tab state |

### OneSignal
- **App ID:** `88022359-a979-4814-8a52-6f1df9884be2`
- **REST Key:** Cloudflare Worker secret `OS_REST_KEY` — rich key format (`os_v2_app_...`)
- **Legacy key:** still enabled — do not disable until confirmed unneeded
- **IP Allowlist:** leave unchecked when creating keys — Workers use rotating IPs

### Laptop Folder Structure
```
Downloads/GolfScorer/
├── birdiefriends_portal.html     ← Portal source (Claude deploys)
├── deploy_portal.py              ← Secrets — never in GitHub
├── launch_golf_scorer.py         ← Secrets — never in GitHub
├── Launch_Golf_Scorer.bat        ← Starts local GolfScorer server
├── BF_Golf_Scorer_8.html         ← Auto-pulled by launcher on startup
└── worker.js                     ← Cloudflare Worker source
```

---

## 5. Live Event System

### Overview
When a BF Series event's tee time arrives, the portal activates a **Live Event Banner** for all registered players. Non-registered players see no banner.

### Live window
- **Auto:** Tee time → tee time + 8 hours (`LIVE_EVENT_HOURS = 8`)
- **Manual:** Commissioner taps Start Live Now in Admin → Event Control

### Event Card Lifecycle
- **Pre-event:** normal register/unregister buttons
- **During round (in-progress state):** Register/Unregister replaced by ⛳ "Round in progress · Xh Ym in · Tap the banner to enter scores"
- **Sunset:** Series events visible until tee +6h; other events tee +5h (both format-aware)
- **After sunset:** card disappears; banner stays active until tee +8h (commissioner controls)

### Banner Sections
1. **🦅 Birdie Alert** — player picker (defaults to current player, tap Change to proxy), hole grid, push fires on submit
2. **🎯 Closest to the Pin** — player picker (same), hole pills, optional distance, live leaderboard
3. **📋 Post-Round Scorecard** — hidden behind "🏁 End Round" button; overseer selects player, enters points hole-by-hole

### Groupings Link in Live Panel
📋 Groupings & Tee Times appears at top of live panel when groupings are published and visible. Opens as in-page iframe slide-up sheet — no tab switch, Done returns to portal.

### Birdie / Skin Message Logic
- **Score type selector:** 🦅 Birdie / 🦅🦅 Eagle / 🏆 Albatross — defaults to Birdie, resets after each submission. Verb adapts: "Birdied #N", "Eagled #N", "made an Albatross on #N".
- First sub-par score on hole: `{emoji} {Type} Alert` · `{Full Name} {verb phrase} — current Skin leader.`
- Second sub-par score on hole: `{emoji} Skin Stopped` · `{Full Name} {verb phrase} and stopped {Prev Full Name}'s Skin.`
- Already busted: `{emoji} {Type} Alert` · `{Full Name} {verb phrase} — Skin not in play on this hole.`
- **Cross-device detection:** skin status determined by querying the shared Worker `/feed` for prior birdie-type entries on the same hole — NOT the per-device `_skinHoles` object, which can't see entries from other overseers' phones. Critical fix (Session 35) — previously two different overseers on the same hole both saw "current Skin leader."
- **Known simplification:** doesn't account for relative severity across types (Eagle then Birdie on same hole says "stopped" even though Eagle still wins outright). Doesn't affect skins payout — GS computes from scorecards.

### CttP Message Logic
- First on hole: `{Full Name} is Closest to the Pin on #N at X ft.`
- Takes lead: `{Full Name} is Closer than {Prev Full Name} on #N at X ft.`
- Prior leader snapshot taken BEFORE `_ctpData` is overwritten — "Closer than" always accurate
- Distance omitted silently when not entered; negative distance rejected at input

### Point Values (Scorecard)
| Score | Points |
|-------|--------|
| Albatross | 8 |
| Eagle | 6 |
| Birdie | 4 |
| Par | 2 |
| Bogey | 1 |
| Bogey+ | 0 |

### Scorecard Check (Admin)
Admin → 📝 Scorecard Check → ↻ Refresh. Pulls Jotform submissions for live/next Series event. Shows ✅ player + total pts (color-coded: green ≥36, normal ≥28, gold <28) and ⚠️ missing players. Summary count in collapsed header.

---

## 6. Push Notifications

### Architecture
**Jotform Membership QID 23 (`pushId`)** is the single source of truth for notification identity.

- **Subscribe:** OneSignal SDK grants pushId → portal writes to Jotform → done
- **Send:** Load Jotform members where `bfw=Yes` + `active=Active` + `pushId` present → `include_player_ids`
- **OneSignal is a delivery pipe only** — no identity reads, no aliases, no external_user_id

Portal → Cloudflare Worker (`/`) → OneSignal → player devices.

### Targeting Methods
| Method | Function | Use case |
|--------|----------|----------|
| All BFUpdates subscribers | `osSendAll()` | Broadcasts, birdie alerts, CttP |
| Named players only | `osSendToPlayers(names[])` | Event-scoped pushes |
| Specific device | `osSend({include_player_ids})` | Direct test |

### `bfType` Taxonomy
| Call site | `bfType` |
|-----------|----------|
| `notifyNewEvent` | `'new_event'` |
| `notifySubPromotion` | `'sub_promotion'` |
| `notifyEventReminder` | `'event_reminder'` |
| Admin broadcast | `'broadcast'` |
| Commissioner modal | `'event_push'` |
| `submitBirdieAlert` (Birdie/Eagle/Albatross) | `'birdie'` |
| `sendCtpNotification` | `'cttp'` |
| `adminSendTestPush` | `'test'` |

### iOS Requirements
- iOS 16.4+ required
- Portal must be **installed as PWA** (Add to Home Screen) — does NOT work in Safari browser tab
- PWA install: Safari → Share ⎋ → Add to Home Screen → open from home screen icon → tap Allow

### Push Diagnostics
- **Sporadic delivery on course:** Check iOS Focus Mode (Settings → Focus). Ask players before event.
- **No pushId in Jotform:** Manually paste OneSignal ID from OneSignal User Records into Jotform membership QID 23.
- **Pop notifications absent but announcements visible:** pushId valid, problem is device-level (notification banner = None in iOS Settings, or Focus Mode).
- **Fallback:** Announcement feed in portal is always reliable even when pop notifications fail.

### Alerts / Inbox — Design Captured (Session 33), Not Yet Built
**Build order:** Session A (Worker: scope field, per-type TTL, `/inbox?player=` endpoint) → Session B (Portal inbox UI) → Session C (commissioner send scoping)

**Lifecycle TTLs:**
| bfType | TTL |
|--------|-----|
| `birdie` / `cttp` | 48h |
| `broadcast` | 7 days |
| `new_event` / `sub_promotion` / `event_push` | Until event date |
| `event_reminder` | 24h post tee-time |
| `test` | 1h |

---

## 7. GolfScorer Reference

### Running GolfScorer
1. Double-click **`Launch_Golf_Scorer.bat`** — auto-pulls latest GS from GitHub on startup
2. Chrome opens at `http://localhost:8743/BF_Golf_Scorer_8.html`
3. As of Session 37, the server runs in its own titled window ("BF Golf Scorer Server") and does **not** auto-minimize — leave it visible. A GitHub pull failure or a port-8743 conflict (most likely cause: an old server process still running) now prints a loud, explicit message there instead of dying silently behind a hidden window.

### Data Recovery
- All Groups tab state in localStorage key `bf_groups_data`
- Recovery: open console → `grpOnTabOpen()`
- Export: Groups tab → Export JSON. Import: Groups tab → Import JSON.

### Groupings Archive System (rebuilt Session 37 — read this before touching it again)
**The mechanism, as it actually works now:**
1. `grpPublish('Final')` writes `groupings-{slug}.html` to GitHub (the permanent archive copy) **and** persists `{ eventName: archiveFile }` into a durable `bf_groupings_archive` localStorage map — independent of any other state, survives New Event resets.
2. `saveEventToSeries()` (runs post-round, when the event record is first created) reads that map and attaches `groupingsFile` to the event's record **at creation time** — fully automatic, no manual step.
3. `generateResultsPage()` builds `GROUPINGS_ARCHIVE` from `ALL_SERIES_DATA.events[].groupingsFile` on every page load.
4. The Groups tab's enabled/disabled look and the groupings-nav-link both re-sync on page load now too (a separate fix — see below), not only on an event-pill click.

**Why this needed rebuilding:** the *old* description of this system (steps 1–3 above existed in the docs but step 1 never actually wrote to series data — `grpPublish` had no connection at all to the event record, which doesn't even exist yet at Final-groupings time, since that's pre-round). Every event needed a manual patch to results.html to wire the archive in. This silently broke for Series#4 — the archive file existed and was live on GitHub, but the pointer never made it into series data, on the live site *or* in the local GS export. Confirmed via direct JSON inspection three separate times this session before being trusted as fixed.

**Two further, separate real bugs found and fixed in `generateResultsPage()`'s output (Session 37), after the data-sync fix above was already verified correct:**
- The Groups tab's `onclick="openGroupingsForEvent()"` called a function that didn't exist anywhere in the file — clicking it did nothing, full stop, regardless of archive state. Fixed to `onclick="switchTab('groups',this)"`, the same pattern every sibling tab already uses.
- The `tab-groups` content panel (containing the iframe) was duplicated wholesale in the template — two identical `id="tab-groups"` divs. Removed the duplicate.
- **Lesson:** a correct tooltip/opacity state (proof the *data* logic ran) is not proof the *click* works — these are two independent failure modes and both need checking. See Golden Rule #19.

**Outliers:**
- Series#2: no archive (pre-system) — Groups tab dimmed, by design, no recovery
- Series#3: embed mode missing (published before v8.17o) — nav visible in iframe; do NOT republish (would corrupt historical quotas)
- Series#4: fixed retroactively this session (live results.html + local GS export both patched)
- Series#5+: fully automatic, no manual step

**Known separate issue, not fixed:** `generateSeriesPage()` (standings.html) has its own copy of the Groups tab button with the same broken `onclick="openGroupingsForEvent()"`, but standings.html has *no* `GROUPINGS_ARCHIVE`, `loadGroupsTab`, or `tab-groups` content panel behind it at all — it's vestigial, likely copy-pasted from the results.html template early on. Whether standings.html should have a working Groups tab at all is an open question (it's a season-wide view, not a single-event view) — bigger than a quick fix, parked for a future session.

### No-HCP Player Flow (e.g. Rich Potts)
- `grpMergePlayers` sets `isNoHcp: false` by default — new player ≠ no GHIN handicap
- Commissioner manually blanks HCP field → triggers `isNoHcp: true` → tee dropdown appears
- `grpPublish()` blocks if tee is blank (hard guard)
- Kick Off passes tee to Tab 2; `goToScorecard()` blocks again if blank (second guard)
- Event 1 is baseline — no quota, no podium. Event 2+ enters full quota system.

### View Saved Event (Tab 5, Session 37)
A selector above the Results content, defaulting to "— Live / Current —". Picking any already-saved event renders it through the same `renderResults()` display (Podium/Skins/CTP/Money) used for live results, sourced entirely from series data — no scorecard re-import needed. Read-only by design: Save to Series, Publish, Print, and Export are hidden in this view since they act on the live scorecard, not whatever's being browsed. Built because Tab 2/3 (Players/Scorecard) state has never persisted across a page reload — before this, looking at a past event again meant re-running the entire Jotform/paste import from scratch.

### New Event Safety Guard (Session 37)
`resetAll()` now detects an unsaved scored round before clearing anything: if the loaded event has entered scores but isn't yet in `season_data.events`, it skips the normal confirm entirely and hard-blocks — explains the risk, points to Save to Series, and requires typing `DISCARD` verbatim to proceed anyway. Falls back to the original lightweight confirm when nothing's at risk (event already saved, or no scores entered yet).

### End of Event (Session 37)
Gold button, first position in the Actions bar, always available. Runs Save to Series → Push to Sheets → Publish All Pages as one tracked sequence with a small status panel (⏳/✅/❌ per step). If Save finds the event already saved, it shows "✅ (already saved)" and skips rather than re-running — never duplicates. If Sheets or Publish fails (the realistic failure mode — spotty WiFi at the course), only that step gets a Retry button; the other one isn't blocked, since getting results live for players matters more than the Sheets visual-check. Save failing (missing players/event) stops the chain early, since there'd be nothing new for the other two steps to act on. Gates on whatever's in the live `event-name` field — has no effect if nothing's loaded (e.g. right after a fresh GS restart).

### Quota Display (fixed Session 34, hardened Session 35)
- Always click **Fetch Registrants** after launching GS before publishing groupings
- `grpMergePlayers` refreshes `p.hcp`/`p.quota` from series history via `grpGetEstimatedQuota` on every fetch
- **Session 35:** all THREE display sites (player card, HCP table, published groupings) now compute quota LIVE via `grpGetEstimatedQuota(p.name, p.hcp, p.tee)` at render time — can never show a value that disagrees with "Why this quota?" again, regardless of when `p.quota` was last cached
- `grpUpdateHcp` (card inline HCP edit) also fixed to store the adjustment-formula quota, not the raw `36-HCP×Slope/113` formula
- Published groupings now shows player HCP next to name (e.g. "Brian Hager HCP 6.4"), NoHCP players show "NoHCP"

### HCP Source of Truth (Session 35)
- **Groups tab (`playerHistory.currentHcp`, series-tracked) is the SOLE source of truth for HCP.** No double entry.
- The separate "Player Profiles" store (`bf_player_profiles`, Tab 7) and its "Load from Profiles" / Quick HCP Update workflow are a STALE, PARALLEL HCP source that caused a full-roster mismatch before Series#4 results (every player off by ~0.3–1.0 strokes between Tab 2 Quota Preview and Groups tab/groupings).
- **If Tab 2 doesn't match Groups tab/groupings:** re-run Kick Off — `grpKickOffEvent` pulls `p.hcp` directly from `grpPlayers` (Groups tab), correcting Tab 2. Re-Kick-Off also clears Tab 3 scorecard inputs — re-fetch from Jotform afterward if needed.
- **Pending:** retire "Load from Profiles" / Quick HCP panel entirely (offered, not yet confirmed) — first task next session if not already done.

### Scoring Rules
- **Quota formula:** `36 − (HCP × Slope / 113)` — Green slope 132, Combo 128, Gold 115
- **Best 4 of N** events count toward series standings
- **NoHCP E1 synthetic:** baseline event, no quota, no podium eligibility

### Tie Payout Rules
Pool prizes for tied positions, split evenly, floor to nearest dollar. Surplus to treasury.

| Scenario | Each tied player gets | Below |
|---|---|---|
| Sole 1st / 2nd / 3rd | $40 / $20 / $10 | — |
| 2-way tie 1st | $30 each | 3rd gets $10 |
| 3-way tie 1st | $23 each ($1 treasury) | Nothing |
| 2-way tie 2nd | $15 each | Nothing |
| 2-way tie 3rd | $5 each | Nothing |

**Podium display:** T-1, T-2, T-3 labels replace 🥇🥈🥉 on ties.

### Google Sheets
- **URL:** https://docs.google.com/spreadsheets/d/1QvnXGY8TLgCgAhXt8SBRbwa7eUz-Vouhu6Tyituee20
- **Tabs:** Raw Data, Standings, Green Flight, Combo Flight, Gold Flight
- **Workflow:** Calculate Results → Save to Series → Push to Sheets (or just **End of Event**, Session 37+, which runs all three)
- **Setup requirement (diagnosed Session 37, not a code bug):** Push to Sheets needs `bf-golf-scorer-key.json` (Google service account key) physically present in the GolfScorer folder — `Service account key not found` means the file is missing from disk, full stop, not a permissions or token issue. It's a local-file-existence check. Service account: `bf-golf-scorer@birdiefriends-golf.iam.gserviceaccount.com` — already exists and is already shared on the Sheet; if the key file ever goes missing again, generate a *new* key for that *same* existing service account (Google Cloud Console → IAM & Admin → Service Accounts → Keys → Add Key → JSON) rather than redoing setup from scratch. No effect on anything player-facing if it's broken — purely a secondary visual cross-check.

---

## 8. Portal Navigation & UX

### Bottom Nav Tabs
| Tab | Icon | Notes |
|-----|------|-------|
| My Events | ⛳ | Swipeable cards; parked events hidden |
| Parked | 🅿️ | Events swiped from My Events |
| Schedule | 🗓️ | Events player is registered for |
| Results | 🏆 | Results, Standings, My Series, Groupings links |
| My Game | ⛳ | Added Session 36 — live, portal-native screen (donut chart, money/nemesis callouts) for the current/most recent event. Distinct from the static "My Series" page (the old `mygame.html`, renamed Session 37) reachable from the Results hub — that one shows historical breakdown across all past events, not the live one. Content noted as still settling; `guide.html` doesn't document this tab yet (gap, not urgent). |

### Admin Access
⚙️ gear icon in header (commissioner PIN required). Cards: Event Control, Push Broadcast, Text All, Dev Controls, Announcement Feed, Push Subscribers, Scorecard Check. All cards start collapsed.

### Event Card Groupings Link
Portal fetches `groupings-meta.json` on load. Link shows only when: meta exists + `visibility=visible` + `evt.name` matches. Opens as in-page iframe slide-up sheet.

### 5th Player Flow
`getCapacityStatus()` → `fivePending: true` when 5 registered on 8-man event. Gold ⏳ warning on 5th registrant's card. Clears when 6th joins.

### iOS / WebKit Notes
- Push notifications: iOS 16.4+ + PWA install required
- Minimum 44px tap targets on all interactive elements
- No hover-dependent functionality
- `overflow:hidden` on full card breaks expand/collapse in older WebKit — apply to `.event-card-top` only

---

## 9. Event Sites Pattern (Garrett's Last Swing)

Standalone results pages for non-BFSeries events. Deployed to `birdiefriends.com/<slug>.html`. Schema: `source/BF_EventSite_Schema.md`.

**Photo storage:** `docs/gls-photo-<id>.<ext>` — uploaded via GitHub API. Future events use their own prefix.

**Competition types used:**
- `scramble_individual_cumulative` — lowest 3-round total wins
- `match_play_cart_group` — hole-by-hole, 1pt win / 0.5pt tie
- `skins_field` — all teams one pot, ties carry
- `cttp` — par 3s, individual winner per hole

---

## 10. Backlog & Known Issues

| Item | Priority | Notes |
|------|----------|-------|
| **GS atomicity — `grpPublish Final` should write `results.html` directly** | 🔲 Carried over, untouched | Pre-dates Session 37 — flagged at end of Session 36, not started this session either. Currently two separate steps (pre-round groupings publish vs. post-round results publish) depend on manual ordering; collapsing into one atomic action removes that dependency. |
| **Alerts / Inbox** | 🔲 Next (Session A) | Worker: scope field, per-type TTL, `/inbox?player=` endpoint. Portal: inbox UI below Upcoming, read/unread, dismiss. |
| **Cancelled Events** | 🔴 Priority | Commissioner marks cancelled → push → card shows ❌ → ghost on Schedule tab. Needs KV flag per event ID. |
| standings.html Groups tab is dead | 🔲 Low, found Session 37 | Same broken `onclick` as the now-fixed results.html, but no `GROUPINGS_ARCHIVE`/content panel behind it at all. Bigger question first: does a per-event Groups tab even belong on a season-wide standings page? |
| guide.html missing My Game tab | 🔲 Low, found Session 37 | The portal-native My Game bottom-nav button (Session 36) was never added to the player guide. Held off writing copy since the screen's own content was still being iterated on. |
| Active/InActive auto-reset | 🔲 Quick fix | Jeremy Burkett + Tony Hager. Fastest: hardcode exempt array like COMMISSIONERS. |
| Live Feed UI | 🔲 After Inbox | Styled activity stream in live panel. Color-coded by type. 60s auto-refresh. |
| Self-service event management | 🔲 Backlog | Member creates event, becomes temp commish. |
| GS state persistence | 🔲 Backlog | Auto-save event state after Calculate Results; "Resume pending event?" on reload. Tab 2/3 state loss after any reload is also why View Saved Event (Session 37) exists — works around this, doesn't fix it. |
| CttP holes per event | 🔲 Future | Add CttP Holes field to Event Request form. |
| Sub promotion notification | 🔲 Planned | Flip `OS_NOTIFY_SUB_PROMOTION = true` when ready. |
| BL-17: Two Series events same day | 🔲 Low | `getLiveEvent()` uses Array.find() — first match wins. |
| Players list broken on one iPhone | 🔲 Parked | Suspected older WebKit. |

---

## 11. Future Considerations — Commercial Path

### GolfScorer — Phone/iPad Executable
**Decision (Session 34):** Deferred. If BirdieFriends goes commercial, GS will be fully rewritten — no point engineering onto the current single-file architecture.

**Option A (GitHub Pages hosting) — what it would take:**
- Host `BF_Golf_Scorer_8.html` at `birdiefriends.com/gs.html`
- Replace all `fetch('/publish/...')` Python server calls with GitHub Contents API calls
- Rework TEST_PREVIEW_MODE; proxy GitHub token through Worker (body size risk)
- localStorage scoring state works fine on any device already

**Why deferred:** GS stays home on event day (Rule #12). A commercial rewrite would use a proper backend (React/Vue, real-time multi-group scoring, cloud DB) making this moot. Effort if pursued on current codebase: ~2–3 sessions.

---

## 12. Session History

### Session 37 — 2026-06-17/18
- **Groupings archive rebuilt (the actual fix, not a patch):** root cause was `grpPublish` never connecting to series data at all — Final-groupings happens pre-round, before the event record even exists. New mechanism: `grpPublish('Final')` persists `{eventName: archiveFile}` to a durable `bf_groupings_archive` localStorage map; `saveEventToSeries()` reads it and attaches `groupingsFile` automatically at event-creation time. Series#4 fixed retroactively (live results.html + local GS export, both verified by direct JSON inspection, not assumption).
- **Two further, separate real bugs found in `generateResultsPage()`'s Groups tab**, discovered only after the data-sync fix above was already confirmed correct: `onclick="openGroupingsForEvent()"` called a function that didn't exist anywhere in the file, and the `tab-groups` content panel was duplicated wholesale in the template. Both fixed; new Golden Rule #19 added so this class of bug gets checked for by default next time. standings.html has the same broken onclick with no supporting panel at all behind it — separate, lower-priority, parked.
- **New Event safety guard:** `resetAll()` hard-blocks (requires typing `DISCARD`) if the loaded event has scores entered but isn't yet saved to series — was previously a single generic confirm regardless of risk.
- **View Saved Event (Tab 5):** read-only selector for any already-saved event, rendered through the same display as live results, sourced from series data — no scorecard re-import needed. Verified against known values (Series#4 podium) before trusting it.
- **End of Event:** one action runs Save to Series → Push to Sheets → Publish All Pages with per-step status and per-step retry — built for real conditions (spotty WiFi, post-round, low bandwidth), not the calm-office case the four separate buttons assumed.
- **Launcher hardened:** `launch_golf_scorer.py` now fails loudly (not silently) on a port-8743 conflict, explaining that an old server is likely still running; `Launch_Golf_Scorer.bat`'s server window no longer auto-minimizes, and its kill-old-server step now verifies the port actually freed up instead of assuming success.
- **My Game → My Series naming pass:** the static historical page (`mygame.html`) and every reference to it (nav pills on results/standings/groupings, publish toasts, guide.html) renamed to "My Series," disambiguating it from the separate, newer portal-native live "My Game" screen (Session 36), which was already correctly named and untouched.
- **Diagnosed, not a regression:** Sheets push failure was a missing `bf-golf-scorer-key.json` on disk (moved during a folder cleanup), not a token or code issue — confirmed by replicating the GitHub pull call directly and finding it worked fine.
- **Not done this session:** GS atomicity (`grpPublish Final` → write `results.html` directly) — carried over from Session 36, still untouched. First task next session if nothing more urgent.

### Session 35 — Series#4 Post-Round (2026-06-14)
- **GS quota display bug v2 (v8.17·2026-06-14a/b):** Session 34 fix refreshed `p.quota` at merge time, but 3 render sites (card, table, published groupings) still used the cached value — could go stale again after any HCP edit. Fixed all 3 to compute live via `grpGetEstimatedQuota`. Also fixed `grpUpdateHcp` (card inline edit), which stored the raw-formula quota instead of the adjustment-formula quota — likely the original source of the stale value. Confirmed Tab 2 scoring was already correct (display/publish only).
- **HCP in published groupings (v8.17·2026-06-14b):** player HCP shown next to name, e.g. "Brian Hager HCP 6.4"; NoHCP players show "NoHCP".
- **Cross-device skin-stop fix (v3.10.107):** `_skinHoles` is per-device in-memory only — two overseers on different phones both saw "current Skin leader" for the same hole (confirmed live on Series#4 #9). `submitBirdieAlert` now checks the shared Worker `/feed` for prior birdies on the hole across all devices before composing its message.
- **Birdie/Eagle/Albatross selector (v3.10.108):** 3-way score-type selector added to Birdie Alert; message verb and emoji adapt per type; skin-stop detection recognizes all three.
- **HCP source of truth confirmed:** Groups tab (`playerHistory.currentHcp`) is sole source — "Load from Profiles" (Tab 7, `bf_player_profiles`) is a stale parallel store that caused a full-roster HCP/quota mismatch ahead of Series#4 results. Re-running Kick Off corrects Tab 2. Retiring the Profiles HCP path is pending — first task next session if needed.

### Session 34 — Chat#34 BF Dev - Series#4 Prep (2026-06-12)
- **Bootstrap fix:** deploy.html copy button now enforces `bash_tool curl` method; `node --check` mandatory pre-deploy gate
- **GS quota display bug (v8.17a):** `grpMergePlayers` existing-player branch now re-fetches `currentHcp` + recomputes quota via `grpGetEstimatedQuota` on every Fetch Registrants — was showing stale stored prev quota. Display only; no Series#3 scoring impact.
- **Portal v3.10.96–v3.10.106:** CttP player picker (`_ctpPlayer` state + `openPlayerSheet`); live panel section delineation (dark header strips); groupings iframe sheet (both live panel + event card); event card in-progress state (⛳ + elapsed time); event card sunset (Series +6h, others +5h); Scorecard Check admin card; scorecard chevron fix; architecture diagram in library
- **Versioning philosophy:** Golden Rule added; 3.11.0 triggers at Alerts/Inbox launch

### Session 33 — 2026-06-11
- **Notification architecture:** `submitBirdieAlert` + `sendCtpNotification` now route through `osSendAll()` — `bfw=Yes` + InActive filter enforced; `included_segments: ['All']` removed
- **bfType taxonomy:** complete — all call sites tagged
- **Message copy rewritten:** full names throughout; CttP prior-leader snapshot before `_ctpData` overwrite
- **Admin cards:** all 6 collapsible via shared `toggleAdminCard()`; Push Subscribers lazy-loads
- **Alerts/Inbox design captured** in this guide

### Session 32 — 2026-06-09
- **GS:** `↺ New Event` button; Players tab onclick fix; `resetAll()` clears Groups tab; `deploy_file()` added to `bf_deploy.py`; `launch_golf_scorer.py` auto-pulls GS from GitHub on startup
- **Groupings archive:** `grpPublish Final` saves to series localStorage; `generateResultsPage` builds `GROUPINGS_ARCHIVE`; ⛳ Groups tab added to results; embed mode for iframe display

### Session 31 — 2026-06-05/06
- Garrett's Last Swing archive: self-contained `garretts-last-swing-ARCHIVE.html` with 36 base64-embedded photos, competition records, full scorecards

### Session 30 — 2026-06-04
- Garrett's Last Swing gallery page; event site schema documented in `BF_EventSite_Schema.md`

### Session 29 — 2026-06-03
- Worker KV Feed live: `feed::{timestamp}` entries on every push send; `GET /feed` + `DELETE /feed` endpoints; portal reads `/feed` not OneSignal history
- `bf_deploy.py` established as canonical Claude-direct deploy script; bootstrap hardened

### Session 28 — 2026-06-02/03
- Worker: `GET /history`, `POST /deploy`, `POST /rollback` endpoints; GitHub token in Worker
- deploy.html Claude tab with copy button; `start.html` for mobile session starts

### Session 27 — 2026-05-31/06-01
- OneSignal identity rebuilt: Jotform `pushId` (QID 23) as single source of truth; `external_user_id` removed; Admin shows clean two-tier subscribed/not-subscribed view

### Session 26 — 2026-05-30
- Push Broadcast card in Admin; Schrödinger 5th-player orange chip; fivesome warning scoped to 5th registrant only

### Sessions 19–25 — May 2026
- Live Event System built (gold banner, Birdie Alert, CttP, Scorecard)
- Cloudflare KV feature flags (`BF_FLAGS` namespace)
- Reusable dark-themed slide-up player picker
- Portal v3.9.x → v3.10.x: new nav (My Events / Parked / Schedule / Results), swipe-to-dismiss, Schedule tab

### Sessions 12–18 — May 2026
- Member management switched to Jotform live feed; self-registration flow; Commissioner PIN lock
- Full OneSignal push integration; Cloudflare Worker proxy; per-player subscription; Admin subscriber table

### Sessions 1–9 — May 2026
- GolfScorer v8.x built: Stableford quota scoring, Best 4 series formula, flight standings, player profiles
- Groups tab: drag-drop builder, Jotform registrant fetch, tee time calculator, Preliminary/Final publish states
- Synthetic 8-event test season validated scoring engine

---

## 13. Complete Version History

### Portal
| Version | Key Change |
|---------|-----------|
| v3.10.0 | New nav, swipe-to-dismiss, Schedule tab, Admin to ⚙️ gear |
| v3.10.23 | Nav renamed: Home→⛳ My Events, Events→🅿️ Parked |
| v3.10.29–32 | Fivesome warning banner + detection |
| v3.10.50 | iOS 3-step visual install guide; Android one-tap native install; first-PWA-launch auto-prompt |
| v3.10.51 | Event Control: Start Live Now / Close Event; live_override flag |
| v3.10.58 | **Jotform-first notification architecture** — pushId as identity; osSendAll/osSendToPlayers rebuilt |
| v3.10.65 | Text All Players; guide.html added to deploy |
| v3.10.66 | Skins message logic; re-register bug; scorecard submit→confirm→next flow |
| v3.10.91 | Fix notification recipient scope — osSendAll() for Birdie Alert + CttP |
| v3.10.92 | Push Subscribers card collapsible |
| v3.10.93 | Complete bfType tagging |
| v3.10.95 | All 6 admin cards collapsible |
| v3.10.96–98 | CttP player picker (blank-load hotfixes for escaping bug) |
| v3.10.99 | Live section dark header strips |
| v3.10.100 | Groupings iframe sheet + event card sunset tee+6h/+5h |
| v3.10.101 | Groupings sheet on event card |
| v3.10.102 | Event card in-progress state; sunset aligned |
| v3.10.103–104 | Sunset tuning (Series +6h, others +5h, format-aware) |
| v3.10.105 | Scorecard Check admin card |
| v3.10.106 | Scorecard chevron fix; architecture diagram in library |
| v3.10.107 | Cross-device skin-stop detection via shared /feed |
| v3.10.108 | Birdie/Eagle/Albatross selector in Live Birdie Alert |

### Worker
| Date | Key Change |
|------|-----------|
| 2026-05-27 | DELETE /subscription/:id; live_override flag + timestamp |
| 2026-06-01 | DELETE /notifications/clear (PIN required) |
| 2026-06-02 | OS_REST_KEY → rich key format |
| 2026-06-03 | GET /history, POST /deploy, POST /rollback; KV feed (feed::{timestamp}), GET /feed, DELETE /feed |

### GolfScorer (v8.17 series)
| Version | Key Change |
|---------|------------|
| v8.17a | New Event button in Actions banner |
| v8.17b | Players tab onclick fix; resetAll() clears Groups tab |
| v8.17c–d | No-HCP tee guards (grpPublish + goToScorecard both block) |
| v8.17e | Tee dropdown for null-HCP players (not just isNoHcp flag) |
| v8.17f | Remove button on drag cards |
| v8.17g–h | Fetch Registrants prunes unregistered; defensive guards |
| v8.17i–j | Layout fixes: overflow, sticky pool |
| v8.17k | Kick Off auto-populates Tab 2 event date |
| v8.17l | Tab 2 reframed as confirmation screen |
| v8.17m–o | Groupings archive system end-to-end; Groups tab in results; embed mode |
| v8.17 · 2026-06-12a | Quota display fix: grpMergePlayers refreshes existing player quotas on re-fetch |
| v8.17 · 2026-06-14a | Quota display v2: 3 render sites compute live via grpGetEstimatedQuota; grpUpdateHcp fixed |
| v8.17 · 2026-06-14b | Player HCP shown next to name in published groupings |
| v8.17 · 2026-06-17a | Permanent groupings-archive fix: grpPublish persists `bf_groupings_archive` map; saveEventToSeries attaches groupingsFile automatically |
| v8.17 · 2026-06-17b | New Event safety guard — hard-blocks on unsaved scored round, requires typing DISCARD to override |
| v8.17 · 2026-06-17c | View Saved Event selector added to Tab 5 |
| v8.17 · 2026-06-17d | End of Event — Save to Series → Push to Sheets → Publish All Pages as one tracked, retryable action |
| v8.17 · 2026-06-17e | My Game → My Series naming fix across all generated-page nav and publish-toast text |
| v8.17 · 2026-06-17f | Groups tab initial-load sync fix (opacity/title/cursor were only ever updated on a pill click, never on first load) |
| v8.17 · 2026-06-17g | Real Groups tab click fix: onclick pointed at a non-existent function, plus duplicate tab-content panel removed, in generateResultsPage |

