# BirdieFriends — Operations Guide
**Last Updated:** 2026-06-18 (Session 40 — /deploy proven for all files; docs/ path added; deploy limitations eliminated)
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
1. **`source/portal_version.txt` is the sole version source of truth.** Never guess or manually edit the version string. Claude reads it at session start, increments the patch number, and pushes all FOUR files atomically via `/deploy`: `source/portal_version.txt`, `docs/portal_version.txt`, `source/portal.html`, `docs/portal.html` (see §3). As of Dev-54, `portal.html` no longer hardcodes the version string — it fetches `docs/portal_version.txt` live at page load (same-origin, no CORS/CDN-lag) and falls back silently to whatever static text is in the HTML if the fetch fails. `docs/portal_version.txt` must exist and stay current or the live display goes stale silently — it is now a required file, not just a tracking doc.

2. **Claude does not import `bf_deploy.py` and execute its TOKEN-authenticated functions** (`deploy()`, `deploy_file()`, `rollback()`). The file contains an embedded GitHub token — Claude does not hold or use API tokens directly to take actions, regardless of user authorization. `bf_deploy.py` may be fetched and read for reference logic, but never executed. The Worker's `POST /deploy` route handles all deploys instead — PIN and content only, token stays in Cloudflare.

3. **All file deploys use `POST /deploy` on the Worker.** This covers portal, GolfScorer, worker source, ops guide, session starter, and all other managed files. No file size limitation in practice (tested to 445KB on Cloudflare free tier). For files larger than shell argument limits, write the JSON payload to a temp file and use `--data-binary @file`. See §3 for the exact pattern.

4. **Always run `node --check` before deploying portal changes.** Extract inline `<script>` blocks, concatenate, write to temp `.js`, run `node --check`. Non-negotiable — caught two blank-load incidents in Session 34.

5. **Worker code changes: Claude pushes `source/worker.js` to GitHub AND presents the file for Cloudflare paste — both in the same turn.** Claude never waits for Brian to push the library copy; handing Brian the file without immediately syncing the library is the root cause of source drift. The correct sequence every time: (1) Claude writes the change, (2) Claude pushes `source/worker.js` via `/deploy`, (3) Claude presents the file via `present_files` for Brian to paste into Cloudflare dashboard. If Brian confirms the paste failed, the library is still current to what Claude built — no gap is created. Never split these steps across turns.

6. **Claude never reconstructs secrets files from scratch.** Upload `deploy_portal.py` or `launch_golf_scorer.py` before modifying — changes must be additive.

7. **Claude never reconstructs `worker.js` from scratch.** `source/worker.js` is fetched from the library at every session start.

8. **At session end, Claude deploys the updated session starter and ops guide via `/deploy`.** No bat, no manual copy, no download needed.

**Testing & Safety**
9. **Never test the portal from a local file for Jotform data.** Jotform API blocks `file://` origins. UI testing only; data requires `https://birdiefriends.com/portal.html`.
10. **TEST_PREVIEW_MODE must be False on event day.** Check `launch_golf_scorer.py` before launching. When True, publishes go to local `preview/` only — players see nothing.
11. **Export GolfScorer JSON before any mock/test run.** Rollback = reimport the JSON export.
12. **Always run a syntax check before deploying.** Apostrophes in single-quoted strings (`'you\'re'`) and nested onclick quotes are the common failure modes. Pre-compute escaped variables rather than inline `.replace()` inside onclick attrs.

**Operations**
13. **GS does not go to the course.** Laptop stays home. All scoring happens post-round. Groupings can be published the night before.
14. **Use Event Control (not Live Test Mode) for production event starts.** Live Test Mode is dev only.
15. **Remote flags affect all devices instantly.** KV flags take effect on next page load for every user.
16. **After Publish Groupings, wait ~60 seconds before sharing the link.** GitHub Pages CDN caches aggressively.
17. **When something doesn't work, check the phone first.** The portal is mobile-first PWA — iOS rendering and PWA chrome require a real device.
18. **After updating `launch_golf_scorer.py`, restart the server.** Close the console window and reopen `Launch_Golf_Scorer.bat`. As of Session 37 the server window no longer auto-minimizes — leave it visible; a GitHub pull failure or port conflict now prints a loud, explicit message there instead of failing silently.

**Versioning Philosophy**
19. **Patch / Minor / Major:**
    - **Patch (3.10.x):** bug fixes, UI tweaks, copy changes, adding a button. No new capability.
    - **Minor (3.10 → 3.11):** meaningful new feature a player would notice. Next trigger: Alerts/Inbox launch → **3.11.0**.
    - **Major (3.x → 4.0):** architectural shift — new backend, off Jotform, commercial multi-tenant.

**Template Integrity**
20. **Generated HTML templates (results.html, standings.html, mygame.html, groupings.html) must have every `onclick` reference a function that actually exists in that same file, and no duplicate element IDs.** A `node --check` syntax gate catches JS errors but catches neither of these — both fail completely silently (nothing happens on click, no console error visible at a glance). Confirmed bug, Session 37: the Groups tab's `onclick="openGroupingsForEvent()"` called a function that was never defined anywhere in `generateResultsPage()`'s output, and the `tab-groups` content panel was duplicated wholesale in the same template. Spot-check before trusting a template fix: `grep` every `onclick="X("` target and confirm `function X` exists; `grep -c 'id="..."'` for anything that should be unique.

---

## 3. Deploy Procedures

### Portal (docs/portal.html)
Claude handles this entirely — no download or laptop needed.

**Full deploy sequence (version increment + publish):**
```python
# Run as a python3 script in bash_tool — handles all three files atomically

import json, re

# 1. Read current version and increment patch
with open('/home/claude/portal_version.txt') as f:
    ver_txt = f.read()
match = re.search(r'v3\.(\d+)\.(\d+)', ver_txt)
minor, patch = int(match.group(1)), int(match.group(2))
new_patch = patch + 1
today = '2026-06-18'  # update to actual date
new_ver = f'v3.{minor}.{new_patch} · {today}'
new_ver_txt = f'{new_ver}\nDeployed: {today} {__import__("datetime").datetime.now().strftime("%H:%M")}\n'

# 2. Update version string in portal HTML
with open('/home/claude/birdiefriends_portal.html') as f:
    portal = f.read()
portal = re.sub(r'v3\.\d+\.\d+ · \d{4}-\d{2}-\d{2}', new_ver, portal)

# 3. Write payload files
for path, content in [
    ('docs/portal.html',          portal),
    ('source/portal.html',        portal),
    ('source/portal_version.txt', new_ver_txt),
]:
    with open(f'/tmp/deploy_{path.replace("/","_")}.json', 'w') as f:
        json.dump({'pin':'7797','path':path,'content':content,
                   'message':f'Portal {new_ver}'}, f)

print(f'Ready to push: {new_ver}')
```
Then push each payload file:
```bash
for f in /tmp/deploy_docs_portal.html.json /tmp/deploy_source_portal.html.json /tmp/deploy_source_portal_version.txt.json; do
  curl -s -X POST "https://birdiefriends-push.birdiefriends01.workers.dev/deploy" \
    -H "Content-Type: application/json" \
    -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" \
    --data-binary @$f --max-time 60
  echo ""
done
```

**If phone shows old version after a deploy:** close tab fully and reopen, try `?v=X`, check raw file on GitHub.

**Hardened version sync (read-only check, no deploy):**
```bash
VER_URL="https://raw.githubusercontent.com/birdiefriends/birdiefriends.github.io/main/source/portal_version.txt"
curl -s "$VER_URL"
```

### GolfScorer (source/BF_Golf_Scorer_8.html)
Claude handles this entirely — no download needed. The version suffix (a→b→…→z→aa) must be bumped manually in the file content before pushing. `Launch_Golf_Scorer.bat` auto-pulls the updated file from GitHub on next startup.

```bash
python3 -c "
import json
with open('/home/claude/BF_Golf_Scorer_8.html') as f:
    content = f.read()
payload = {'pin':'7797','path':'source/BF_Golf_Scorer_8.html',
           'content':content,'message':'GolfScorer v8.17·YYYY-MM-DDx — description'}
with open('/tmp/gs_payload.json','w') as f:
    json.dump(payload, f)
print(len(content), 'bytes')
"
curl -s -X POST "https://birdiefriends-push.birdiefriends01.workers.dev/deploy" \
  -H "Content-Type: application/json" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" \
  --data-binary @/tmp/gs_payload.json --max-time 60
```

### Cloudflare Worker (source/worker.js)
Two steps — both required:

**Step 1 — Push source to library (Claude):**
```bash
python3 -c "
import json
with open('/home/claude/worker.js') as f:
    content = f.read()
payload = {'pin':'7797','path':'source/worker.js',
           'content':content,'message':'Worker YYYY-MM-DDx — description'}
with open('/tmp/worker_payload.json','w') as f:
    json.dump(payload, f)
"
curl -s -X POST "https://birdiefriends-push.birdiefriends01.workers.dev/deploy" \
  -H "Content-Type: application/json" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" \
  --data-binary @/tmp/worker_payload.json --max-time 30
```

**Step 2 — Paste live (user):**
> dash.cloudflare.com → Workers & Pages → birdiefriends-push → Edit code → paste → Save and Deploy

### Single-file library docs (ops guide, session starter, business plan, etc.)
```bash
python3 -c "
import json
with open('/home/claude/<filename>') as f:
    content = f.read()
payload = {'pin':'7797','path':'source/<filename>',
           'content':content,'message':'Session 4X — description'}
with open('/tmp/payload.json','w') as f:
    json.dump(payload, f)
"
curl -s -X POST "https://birdiefriends-push.birdiefriends01.workers.dev/deploy" \
  -H "Content-Type: application/json" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" \
  --data-binary @/tmp/payload.json --max-time 30
```

### Generated Pages (My Series, Results, Standings, Groupings)
1. Launch GS → score event → Calculate Results
2. Click **🏁 End of Event** — runs Save to Series → Push to Sheets → Publish All Pages as one tracked action, with per-step status and per-step retry. Or run the three individually via the Actions bar if preferred.

**Groupings publish (separate, pre-round):**
- Click **🌐 Publish Groupings** in Groups tab → set Status → **Final** before final publish
- Deploys `groupings.html` + `groupings-meta.json` + the permanent archive copy
- Wait ~60s before sharing link
- `grpPublish Final` writes the archive pointer into `bf_groupings_archive` localStorage; `saveEventToSeries()` attaches `groupingsFile` automatically — no manual follow-up needed.

### Token Recovery
GitHub token lost: github.com → Settings → Developer settings → Personal access tokens → GolfScorer → Regenerate. Paste new `ghp_...` into BOTH `deploy_portal.py` line 16 AND `launch_golf_scorer.py` line 39. Both must match or one will fail with 401. Note: this is the classic token used by those laptop-only scripts — separate from the Worker's `GH_TOKEN` Cloudflare secret, which is a fine-grained PAT managed entirely in Cloudflare.

---

## 4. System Reference

### Current Versions
| Component | Version | Status |
|-----------|---------|--------|
| Portal | v3.13.2 · 2026-06-21 | Production ✅ |
| GolfScorer | v8.17 · 2026-06-17g | Deployed ✅ |
| Worker | 2026-06-18b | Deployed ✅ — `/deploy` accepts `source/` and `docs/` paths |
| deploy.html | 2026-06-18 | Live ✅ — all tabs functional (Session BP-1 fix) |
| bf_deploy.py | 2026-06-18 | In library for reference only — TOKEN-authenticated functions not invoked by Claude |
| bf_architecture.html | 2026-06-12 | Library ✅ |
| Launch_Golf_Scorer.bat / launch_golf_scorer.py | 2026-06-17 | Current ✅ — laptop-only, not in GitHub |

### Library Files (fetched at session start)
| File | Path |
|------|------|
| Session Starter | `source/BF_Golf_Scorer_Session_Starter_current.md` |
| Ops Guide | `source/BF_Operations_Guide.md` |
| Portal version | `source/portal_version.txt` |
| Portal HTML | `docs/portal.html` |
| Worker | `source/worker.js` |
| Deploy script | `source/bf_deploy.py` (reference only) |
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
| DELETE | `/notifications/clear` | PIN | Cancel scheduled notifications — cannot delete delivered |
| GET | `/history?file=X&n=20` | None | Last N commits for a managed file |
| POST | `/rollback` | PIN | Restore file to a prior commit SHA |
| POST | `/deploy` | PIN | Push file content to GitHub. Accepts `source/` or `docs/` paths. No meaningful size limit on free tier (tested to 445KB). |
| GET | `/feed` | None | Worker KV notification feed |
| DELETE | `/feed` | PIN | Clear KV feed entries |

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
Device-local only — genuinely tied to this specific device (push subscription
endpoint, this-device's PWA install/PIN state, this-browser's UI dismissals).
| Key | Purpose |
|-----|---------|
| `bf_player` / `bf_player_name` (legacy) | Selected player name on this device |
| `bf_guest` | `'1'` when Guest mode |
| `bf_commissioner` | `'verified'` when PIN confirmed on this device |
| `bf_os_sub_id` / `bf_os_player` / `bf_os_health` | This device's OneSignal push subscription identity/health cache |
| `bf_os_dismissed_{player}` | Notification-permission-prompt dismissed on this device |
| `bf_pwa_first_launch_done` / `bf_install_nudge_dismissed` | This device's PWA install state/nudge |
| `bf_photo_banner_open` | Photo Capture banner collapsed/expanded (UI convenience only) |
| `bf_push_audit_{date}` / `bf_inactivity_check` | Once-per-day background-job throttles (idempotent if they fire on >1 device) |
| `bf_swipe_tip_dismissed` | "Swipe to park" onboarding tip — low-stakes if it reappears on a new device |
| `bf_groups_data` | GolfScorer (separate app) Groups tab state |

**Migrated to D1 (Dev-55)** — these used to be `localStorage` and broke across
a player's own multiple devices; now backed by `player_event_state`,
`player_meta`, `player_announcement_dismissals`, and `commissioner_checklist_state`.
See "Player Personalization (D1-backed, Dev-55)" below. The legacy keys
(`bf_hidden_events_{player}`, `bf_seen_events_{player}`, `bf_first_load_{player}`,
`bf_announcements_dismissed`, `bf_sunday_done_{date}`) are still read once, client-side,
purely as a first-device migration source — never written to again after that.

**Removed (Dev-55)** — `bf_fivesome_pending_{eventId}` was write-only dead code
(set/cleared on registration but never read by anything); deleted along with the
`seedFivesomeFlags()` function that maintained it.


### Player Personalization (D1-backed, Dev-55)
Replaces what used to be per-device `localStorage` for anything that affects what
a player actually sees — Parked events, "NEW" badges, and dismissed Announcements
used to silently reset or duplicate across a player's own phone/iPad/laptop.

**Tables:**
| Table | Shape | Purpose |
|-------|-------|---------|
| `player_event_state` | `player_id, event_id, state('parked'\|'seen')` — PK all three | Parked (swiped-off) events + Seen events (clears "NEW" badge) |
| `player_meta` | `player_id` PK, `first_load`, `migrated_at`, `announcements_migrated_at` | `first_load` anchors "is this new to me" (bulk-seeded backdated to `2020-01-01` for the existing roster at migration time, so no returning member's first visit floods everything as "NEW"). `migrated_at`/`announcements_migrated_at` (added later same session) are the migration-complete flags — see below, these are NOT the same thing as row-presence in the tables above |
| `player_announcement_dismissals` | `player_id, announcement_id` — PK both | Dismissed Announcement feed entries (was a single non-player-scoped global key before Dev-55) |
| `commissioner_checklist_state` | `checklist_date, player_name` — PK both | Sunday Checklist "handled" checkboxes (commissioner-only) |

**Migration pattern (first-device-wins):** `GET /player-state/:player_id` returns
`migrated`/`migratedAnnouncements` booleans. If false, the client captures whatever's
in this device's local `localStorage` and pushes it once via `POST /player-state/:player_id/migrate`
— idempotent (`INSERT OR IGNORE`), safe to fire from more than one device. Every
other device for that player sees `migrated: true` from then on and just reads D1.

**Fix (later same session) — migrated flag is NOT row-presence.** The original design used
"does this player have any rows in `player_event_state`" as the migration-complete
check. That broke under a very normal, common action in this app: **proxy
registration** — anyone registering *for* another player via the name-switcher
(e.g. Charlie registers Dave). That proxy action calls `restoreEvent()`/`markEventSeen()`
under the target player's identity, writing a real row via `POST .../event` — before
that player's own device has ever opened the app. Under row-presence logic, that
incidental row would falsely mark them "already migrated," so their real device's
first load would skip capturing their actual local Parked/Seen history and silently
lose it. Fixed by adding explicit `migrated_at`/`announcements_migrated_at` columns
on `player_meta`, set **only** by `POST .../migrate` itself — never by `.../event`
or `.../announcement`. Verified live: a simulated proxy write followed by a real
`/migrate` call correctly preserved both the incidental row and the player's real
local history, with `migrated` staying `false` in between.

**Worker routes:** `GET /player-state/:player_id`, `POST /player-state/:player_id/migrate`,
`.../event` (single Parked/Seen toggle), `.../seen-bulk`, `.../announcement`,
`.../announcements-bulk`, `GET /player-state/stats?pin=` (aggregate — see Engagement
tool below), `GET /commissioner-checklist?date=X&pin=`,
`POST /commissioner-checklist/toggle?pin=`, and the one-time `POST /player-meta/seed?pin=`
(fetches the live Jotform roster server-side, bulk-seeds `player_meta` with a backdated
`first_load` — re-runnable for stragglers who join mid-migration).

**Route-ordering gotcha:** `GET /player-state/stats` was silently shadowed
by the generic `GET /player-state/:player_id` catch-all, since `stats` matched the
`:player_id` regex like any other string and that route was checked first in the
file. Symptom was subtle — request succeeded (200, `ok:true`) but with the wrong
response shape, so the portal's `.forEach` on a missing field threw and left the UI
stuck on "Loading…" forever, no visible error. Fixed with an explicit exclusion
(`psGetMatch[1] !== 'stats'`) rather than reordering the file. **General lesson:**
any new literal-path route added under an existing `/:param`-style catch-all needs
either to be checked first, or explicitly excluded from the catch-all's match — this
class of bug won't throw at deploy time, only silently misroute at request time.

**Portal side:** all reads/writes stay **synchronous** against an in-memory
`_playerStateCache`, populated once (async) by `loadPlayerState()` at login and at
portal-open for a returning player — same pattern as `gatheringData`. This means
none of the existing call sites throughout the app (`dismissEvent`, `markEventSeen`,
`isNewToPlayer`, etc.) needed to change signature; only their internals did.

**Engagement tool (Commissioner Admin → Communicate → 📊 Engagement):**
Standalone collapsible card (not squeezed into Push Subscribers — that was a
first-pass placement mistake, moved to its own card once flagged). Shows two
distinct pictures per player, sorted by all-time registration frequency:
- **History (lifetime)** — total Parked/Seen counts ever. An engagement indicator,
  but biased by tenure — every row is permanent, nothing prunes when an event
  expires, so it only ever grows and doesn't reflect *current* behavior.
- **Right Now (of N open)** — of everything currently on Home today (same
  denominator for every player), how much is 📦 Parked / ✅ Seen / ◌ Untouched.
  This is the actual "playing plan" view — a Series-only player should show high
  Untouched (everything else is just noise to them) with minimal Parked (never
  bothered to actively hide anything, just ignored it).
Purpose: testing whether Parked is genuinely used/understood, or whether low
event volume just means nobody's hit the need yet — ties back to the still-open
"does Parked deserve its own nav slot" question from the original Dev-54 investigation.
Check back after Series #5 recruitment brings a real mix of frequent/infrequent
players through a real registration push.


- **App ID:** `88022359-a979-4814-8a52-6f1df9884be2`
- **REST Key:** Cloudflare Worker secret `OS_REST_KEY` — rich key format (`os_v2_app_...`)
- **Legacy key:** still enabled — do not disable until confirmed unneeded
- **IP Allowlist:** leave unchecked when creating keys — Workers use rotating IPs

### Laptop Folder Structure
```
Downloads/GolfScorer/
├── birdiefriends_portal.html     ← Portal source (Claude deploys via Worker /deploy)
├── deploy_portal.py              ← Secrets — never in GitHub
├── launch_golf_scorer.py         ← Secrets — never in GitHub
├── Launch_Golf_Scorer.bat        ← Starts local GolfScorer server
├── BF_Golf_Scorer_8.html         ← Auto-pulled by launcher on startup
└── worker.js                     ← Cloudflare Worker source
```

---

## 5. Live Event System

### Overview
When a Live-Panel-eligible event's tee time arrives, the portal activates a **Live Event Banner** for all registered players. Non-registered players see no banner. Eligibility is gated by `hasLivePanelSupport(evt)` (Dev-45) — Series only today; Wally Cup/BF Cup/Scramble are architecturally wired but intentionally return `false` until GS is extended to their scoring models (Wally Cup targeted Sept 2026, others Oct/Nov 2026 — flip each format's line in `hasLivePanelSupport()` when ready, no other changes needed). "BF Weekend Times" and Gatherings are permanently excluded by design, not just pending — confirmed Dev-45.

### Live window
- **Auto:** Tee time → tee time + 8 hours (`LIVE_EVENT_HOURS = 8`)
- **Manual:** Commissioner taps Start Live Now in Admin → Event Control

### Event Card Lifecycle
- **Pre-event:** normal register/unregister buttons
- **During round (in-progress state):** Register/Unregister replaced by a status row, **branched on `hasLivePanelSupport(evt)` (Dev-45):** Tier 2 (Series today) → ⛳ "Round in progress · Xh Ym in · Tap the banner to enter scores," real tap-target into the Live Panel. Tier 1 (everything else) → ⛳ "In-Progress · Xh Ym in," no scoring promise, no fake tap affordance. Both tiers block registration.
- **Sunset:** Series and BF Weekend Times events visible until tee +6h; other events tee +5h (both format-aware, `formatClass()`-driven)
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
- **Cross-device detection:** skin status determined by querying the shared Worker `/feed` for prior birdie-type entries on the same hole — NOT the per-device `_skinHoles` object, which can't see entries from other overseers' phones. Critical fix (Session 35).
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
3. The server runs in its own titled window ("BF Golf Scorer Server") and does not auto-minimize — leave it visible. A GitHub pull failure or a port-8743 conflict prints a loud, explicit message there.

### Data Recovery
- All Groups tab state in localStorage key `bf_groups_data`
- Recovery: open console → `grpOnTabOpen()`
- Export: Groups tab → Export JSON. Import: Groups tab → Import JSON.

### Groupings Archive System (rebuilt Session 37 — read this before touching it again)
**The mechanism, as it actually works now:**
1. `grpPublish('Final')` writes `groupings-{slug}.html` to GitHub (the permanent archive copy) **and** persists `{ eventName: archiveFile }` into a durable `bf_groupings_archive` localStorage map — independent of any other state, survives New Event resets.
2. `saveEventToSeries()` (runs post-round, when the event record is first created) reads that map and attaches `groupingsFile` to the event's record **at creation time** — fully automatic, no manual step.
3. `generateResultsPage()` builds `GROUPINGS_ARCHIVE` from `ALL_SERIES_DATA.events[].groupingsFile` on every page load.
4. The Groups tab's enabled/disabled look and the groupings-nav-link both re-sync on page load now too (a separate fix), not only on an event-pill click.

**Why this needed rebuilding:** the old description of this system existed in the docs but `grpPublish` had no connection at all to the event record, which doesn't even exist yet at Final-groupings time (that's pre-round). Every event needed a manual patch to results.html. This silently broke for Series#4. Confirmed via direct JSON inspection before being trusted as fixed.

**Two further, separate real bugs found and fixed in `generateResultsPage()`'s output (Session 37):**
- The Groups tab's `onclick="openGroupingsForEvent()"` called a function that didn't exist anywhere in the file. Fixed to `onclick="switchTab('groups',this)"`.
- The `tab-content` panel was duplicated wholesale in the template — two identical `id="tab-groups"` divs. Removed the duplicate.
- **Lesson:** a correct tooltip/opacity state (proof the data logic ran) is not proof the click works — these are two independent failure modes. See Golden Rule #20.

**Outliers:**
- Series#2: no archive (pre-system) — Groups tab dimmed, by design, no recovery
- Series#3: embed mode missing (published before v8.17o) — nav visible in iframe; do NOT republish (would corrupt historical quotas)
- Series#4: fixed retroactively this session (live results.html + local GS export both patched)
- Series#5+: fully automatic, no manual step

**Known separate issue, not fixed:** `generateSeriesPage()` (standings.html) has the same broken onclick with no supporting JS/content panel at all — vestigial, parked.

### No-HCP Player Flow (e.g. Rich Potts)
- `grpMergePlayers` sets `isNoHcp: false` by default — new player ≠ no GHIN handicap
- Commissioner manually blanks HCP field → triggers `isNoHcp: true` → tee dropdown appears
- `grpPublish()` blocks if tee is blank (hard guard)
- Kick Off passes tee to Tab 2; `goToScorecard()` blocks again if blank (second guard)
- Event 1 is baseline — no quota, no podium. Event 2+ enters full quota system.

### View Saved Event (Tab 5, Session 37)
A selector above the Results content, defaulting to "— Live / Current —". Picking any already-saved event renders it through the same `renderResults()` display (Podium/Skins/CTP/Money) used for live results, sourced entirely from series data — no scorecard re-import needed. Read-only by design.

### New Event Safety Guard (Session 37)
`resetAll()` now detects an unsaved scored round before clearing anything: hard-blocks if the loaded event has entered scores but isn't yet in `season_data.events`, requires typing `DISCARD` verbatim to proceed. Falls back to the original lightweight confirm when nothing's at risk.

### End of Event (Session 37)
Gold button, first position in the Actions bar. Runs Save to Series → Push to Sheets → Publish All Pages as one tracked sequence with per-step status and per-step retry. Save finding the event already saved shows "✅ (already saved)" and skips rather than re-running. Gates on whatever's in the live `event-name` field.

### Quota Display (fixed Session 34, hardened Session 35)
- Always click **Fetch Registrants** after launching GS before publishing groupings
- All three display sites (player card, HCP table, published groupings) compute quota LIVE via `grpGetEstimatedQuota(p.name, p.hcp, p.tee)` at render time
- `grpUpdateHcp` (card inline HCP edit) stores adjustment-formula quota, not raw formula

### HCP Source of Truth (Session 35)
- **Groups tab (`playerHistory.currentHcp`, series-tracked) is the SOLE source of truth for HCP.** No double entry.
- The "Player Profiles" store (`bf_player_profiles`, Tab 7) is a stale, parallel HCP source — caused a full-roster mismatch before Series#4 results. Retiring it is pending.
- **If Tab 2 doesn't match Groups tab/groupings:** re-run Kick Off.

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
- **Setup requirement:** Push to Sheets needs `bf-golf-scorer-key.json` physically present in the GolfScorer folder. Service account: `bf-golf-scorer@birdiefriends-golf.iam.gserviceaccount.com`. If the key file goes missing, generate a new key for the same existing service account (Google Cloud Console → IAM & Admin → Service Accounts → Keys → Add Key → JSON).

---

## 8. Portal Navigation & UX

### Bottom Nav Tabs
| Tab | Icon | Notes |
|-----|------|-------|
| My Events | ⛳ | Swipeable cards; parked events hidden |
| Parked | 🅿️ | Events swiped from My Events |
| Schedule | 🗓️ | Events player is registered for |
| Results | 🏆 | Results, Standings, My Series, Groupings links |
| My Game | ⛳ | Portal-native screen (donut chart, money/nemesis callouts) for the current/most recent event. Distinct from the static "My Series" page reachable from the Results hub — that one shows historical breakdown across all past events. |

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
| **Jotform API key off client-side** | 🔲 Backlog, low urgency | `JOTFORM_API_KEY` hardcoded in `portal.html`. Fix: move to Cloudflare Worker secret (`env.JOTFORM_API_KEY`, same pattern as `OS_REST_KEY`/`GH_TOKEN`), add Worker proxy routes, migrate every portal call site. Larger lift than the GitHub token fix (Session 40) — many call sites across registration, scorecard, CttP, membership. Needs its own focused session with careful testing since portal.html is live-player-facing. Not urgent: lower-risk key than a GitHub write token, and current dev/bizplan capability isn't blocked by it. |
| **GS atomicity — `grpPublish Final` should write `results.html` directly** | 🔲 Carried over | Flagged end of Session 36, still untouched. Removes manual-ordering dependency between pre-round groupings publish and post-round results publish. |
| **Alerts / Inbox** | 🔲 Next (Session A) | Worker: scope field, per-type TTL, `/inbox?player=` endpoint. Portal: inbox UI below Upcoming, read/unread, dismiss. |
| **Cancelled Events** | 🔴 Priority | Commissioner marks cancelled → push → card shows ❌ → ghost on Schedule tab. Needs KV flag per event ID. |
| standings.html Groups tab is dead | 🔲 Low | Same broken onclick as the now-fixed results.html, but no supporting JS/content panel at all. Bigger question: does a per-event Groups tab belong on a season-wide standings page? |
| guide.html missing My Game tab | 🔲 Low | The portal-native My Game bottom-nav button (Session 36) was never added to the player guide. Deferred while screen content was settling. |
| Active/InActive auto-reset | 🔲 Quick fix | Jeremy Burkett + Tony Hager. Fastest: hardcode exempt array like COMMISSIONERS. |
| **My Schedule's "Can't Make It — Unregister" button was invisible (white-on-white)** | ✅ Fixed Dev-45 | Pre-existing bug, unrelated to Gatherings work — `.btn-cant-make-it` (white-ish translucent text/bg/border) was designed for the dark green event cards on Home, where its 3 other usages all live. `renderSchedule()`'s instance reused the same class inside a white `.schedule-event-row` card (`var(--card): #ffffff`), rendering as a near-invisible sliver — reported by Brian as "a random character" on the first Gathering ever to land in someone's My Schedule, which is what finally put eyes on this corner of the UI. Fixed by swapping to `.btn-ghost`, already styled correctly for white backgrounds and used elsewhere. Worth a glance at other rarely-visited screens for the same dark-card-class-on-white-card mismatch — this one went unnoticed for a long time. |
| **`portal_version.txt` disconnected from the in-app version display** | ✅ Fixed Dev-45, recurred Dev-54, hardened Dev-54, **recurred a third time Dev-55, ✅ permanently fixed Dev-55** | Recurred exactly as predicted a third time — Dev-54's fix made the live app fetch `docs/portal_version.txt`, but the *reference deploy script* in `BF_Golf_Scorer_Session_Starter_current.md` was never updated to actually push that file, so a Dev-55 deploy that copied the stale 3-file script left `docs/portal_version.txt` on the old version while everything else (code, `source/portal_version.txt`) was current — header showed the wrong version for real, not just a display glitch. Root-fixed this time in the place that actually matters: the reference script itself now writes and pushes **four** files every time, with an explicit comment calling out `docs/portal_version.txt` as the one the live app reads. Also fixed a smaller adjacent bug in the same script: the patch-number bump wasn't zero-padded (`v3.17.4` instead of `v3.17.04`). |
| Live Feed UI | 🔲 After Inbox | Styled activity stream in live panel. Color-coded by type. 60s auto-refresh. |
| **deploy.html Library tab — unauthenticated GitHub API rate limit** | 🔲 Backlog | Each Library section (Source, Business plan, Specs) does 1 directory-listing call + 1 commit-lookup call per file, unauthenticated (60 req/hr/IP cap by design — see code comment in `deploy.html`, no write-scoped token in a publicly-served file). Adding the Specs section (Dev-42) pushed total calls per full Library load high enough to hit the cap in normal use, surfacing as silent "No commits found" fallbacks or "Error loading: GitHub 403" per section. Not a bug — a pre-existing constraint that bit harder once a third section was added, and will keep biting as the library grows. Fix: batch each section into one call via GitHub's tree API instead of N+1 (one listing call + one tree call per section, vs. one call per file). |
| Self-service event management | 🔲 Backlog | Member creates event, becomes temp commish. |
| GS state persistence | 🔲 Backlog | Auto-save event state after Calculate Results; "Resume pending event?" on reload. |
| CttP holes per event | 🔲 Future | Add CttP Holes field to Event Request form. |
| Sub promotion notification | 🔲 Planned | Flip `OS_NOTIFY_SUB_PROMOTION = true` when ready. |
| BL-17: Two Series events same day | 🔲 Low | `getLiveEvent()` uses Array.find() — first match wins. |
| **BL-18: Gathering registration does not trigger Active/Inactive restore** | 🔲 Backlog | When a player registers for a Jotform-backed Series event, the portal auto-restores them from Inactive → Active. This logic does not fire for D1 Gathering registrations — `submitGatheringRegistration` writes to D1 only, never touches the Jotform Membership form's `Active` field. Confirmed live Dev-48: Test1 registered Yes for a Gathering, remained Inactive. Not blocking soft-launch (Hosts are marking members manually at this scale) but should be wired before Gatherings sees significant volume. |
| **BL-19: Worker library ahead of Cloudflare — silent gap risk** | 🔲 Process | Rule 5 (push + present in same turn) handles the normal case. Gap risk remains when Worker changes are built as spec-ahead work and intentionally held back from Cloudflare. Dev-48 exposed this: PATCH route was built and pushed to the library but never presented for paste, because it was pre-built for a future session. **Process fix:** any Worker change held back from Cloudflare intentionally must be flagged explicitly in the session close notes — "Worker library is ahead of Cloudflare, contains X — paste at Dev-N+1 start." Add to session close checklist. |
| Players list broken on one iPhone | 🔲 Parked | Suspected older WebKit. |
| **48hr-lock / 5th-player capacity logic scoped to format, not "has a capacity number"** | ✅ Shipped Dev-45 | Was: `getCapacityStatus()`'s 48hr-lock + 5th-player/Schrödinger 2nd-tee-time logic triggered for *any* event with `evt.capacity` set, regardless of format. Fixed: new Event Format option **"BF Weekend Times"** added to the Request Event form (Brian, live during session — no new QID, same field). `formatClass()` maps it to `format-weekend`. `getCapacityStatus()` now dispatches: `format-weekend` → `getWeekendCapacityStatus()` (the original lock/5th-player engine, untouched logic, isolated); everything else (Series, Wally, Cup, Scramble, Gatherings, blank/Individual Play, ParTee, Practice) → `getSimpleCapacityStatus()` (shared open/full/waitlist model, also replaces the old Gathering-only `getGatheringCapacityStatus()` which is now this same shared function). Confirmed scope Dev-45: Weekend Times is reservation logistics only (BF's own 2-tee-time booking pattern), not a scoring/format distinction — a Host running their own event never needs this since they manage their own tee times with the venue directly. Sunset/in-progress windows (6hr) extended to `format-weekend` alongside Series, since both are full BSGC rounds of the same duration. Deployed `docs/portal.html` + `source/portal.html`, v3.11.4. |
| **Live Panel gating decoupled from format string matching** | ✅ Shipped Dev-45 | Surfaced while scoping the capacity fix: `getLiveEvent()` was hardcoded to `formatClass(e.format) === 'format-series'`, conflating "is this Series" with "does this event get CttP/Scorecard/Skins." New `hasLivePanelSupport(evt)` function is the single chokepoint, decoupled from `formatClass()` — confirmed Dev-45: CttP/Scorecard is the foundational data-capture step (Skins reads from Scorecard; Birdie Alerts are a notification layer on top), not interchangeable with format. Today: Series only (`true`); Wally Cup/BF Cup/Scramble explicitly `false` with `// TODO: flip true once GS supports this format` markers (Wally Cup targeted Sept 2026, others Oct/Nov 2026 — each is a one-line flip, no architecture change needed); BF Weekend Times and Gatherings permanently `false` by design. Future Host self-service Live Panel access (raised as a commercialization goal) now has a clean single point to extend rather than unpicking format-matching logic. `getLiveEvent()` and the live-banner styling check both rewired to use it. |
| **In-progress card copy still hardcoded to scoring language for every format** | ✅ Shipped Dev-45 | `buildEventCard()`'s in-progress block now branches on `hasLivePanelSupport(evt)`. **Tier 2** (true — Series today): unchanged "⛳ Round in progress · Xh Ym in · Tap the banner to enter scores," real tap-target into the actual Live Panel. **Tier 1** (false — Gatherings, BF Weekend Times, Wally/Cup/Scramble, blank/Individual Play, ParTee, Practice): minimal "⛳ In-Progress · Xh Ym in," no scoring promise, no fake tap affordance, registration still blocked on both tiers. Brian smoke-tested the underlying Dev-45 changes live before this fix shipped: forced live banner launched cleanly for a real event (no caching issues), and three existing 5th/48hr events relabeled to BF Weekend Times rendered correctly in the Portal. **Not yet smoke-tested:** the tee-management/48hr-lock logic itself under real registration timing, and this specific card-copy change. Two Live-mode concepts (Coordination Live — multi-group visibility; Integrity Live — auditable shared scoring/stakes, e.g. Tony Choy's side-game) remain captured as future considerations, independent of this fix. |

| **D1 transient infrastructure errors ("DB storage... object to be reset")** | ✅ Hardened Dev-54 | Hit live during Dev-54 — confirmed via Cloudflare's own status page as an active Durable Objects/D1 incident (ENAM), not an app bug. Diagnosed by testing two unrelated, long-stable D1 routes (Gatherings, Venues) and confirming identical failures before considering any rollback. Added `d1RetryRead()` — auto-retry wrapper for READ-ONLY D1 queries only. Deliberately not applied to writes (INSERT/UPDATE/DELETE): blind-retrying a write risks double-applying a mutation if the first attempt actually succeeded before the error surfaced. All photo routes also wrapped in try/catch as part of the same fix — turns any future opaque Cloudflare 500 into a real, readable error message instead of a generic crash page. |
| **GitHub Pages stuck-queue / failed-deploy remediation** | 📝 Process note | Learned live Dev-54 across two separate incidents. A **failed** run: re-running it directly often works if the underlying build artifact is already valid (check the run's own step-by-step breakdown — if `build` succeeded and only `deploy` failed with "Deployment failed, try again later," that's GitHub's own admission it's on their end). A run **stuck in Queued** (even after a manual re-run): re-running again just re-queues behind itself — doesn't help. The fix that actually works: push any small new commit. The workflow's concurrency group cancels the stuck/queued run and starts a fresh one, same mechanism that normally cancels an in-progress run when a newer commit lands. Confirmed GitHub's Contents API (`/deploy` route) is a fully separate subsystem from Actions/Pages — commits keep succeeding even during a Pages outage; only the live-site rebuild is affected. BZP work (docs-only, no Pages deployment involved) is entirely unaffected by this class of outage. |
| **Photo Capture R2 setup** | 📝 Reference | Bucket `birdiefriends-photos`, Standard storage class (Infrequent Access considered and rejected — wrong fit for an actively-served gallery; adds a per-GB retrieval fee and 30-day minimum duration for content read on every page view). Bound to the Worker as `PHOTOS_BUCKET` via Cloudflare dashboard → Worker → Settings → Bindings (manual, one-time, not something `/deploy` can do — that route only handles GitHub commits). If this Worker is ever redeployed from scratch, this binding must be re-added manually before any `/photos/*` route will function — they return a clear "binding not configured" error rather than crashing if it's missing. |
| **Device-local state that should be player-synced ("Parked syndrome")** | ✅ Resolved Dev-55 | `bf_hidden_events_`, `bf_seen_events_`, and `bf_first_load_` moved to D1 (`player_event_state`, `player_meta`) — first device per player captures local state once and pushes it, every other device reads from D1 from then on. Dev-55's full assessment sweep of *every* localStorage key and admin tool found two more instances of the same root problem: `bf_announcements_dismissed` (was global, not even per-player — now per-player in `player_announcement_dismissals`) and the Commissioner Sunday Checklist's `bf_sunday_done_{date}` (now `commissioner_checklist_state`). Also found and removed `bf_fivesome_pending_{eventId}` — not a sync bug, just dead write-only code that nothing ever read. Full architecture in "Player Personalization (D1-backed, Dev-55)" below. |

---

## 11. Future Considerations — Commercial Path

### GolfScorer — Phone/iPad Executable
**Decision (Session 34):** Deferred. If BirdieFriends goes commercial, GS will be fully rewritten — no point engineering onto the current single-file architecture.

---

## 12. Session History

### Session 40 — 2026-06-18
- **Deploy infrastructure — all limitations eliminated:** Proven via live testing that Cloudflare free tier allows 100MB request bodies (not 100KB as previously documented). Portal (420KB) and GolfScorer (369KB) both deploy successfully via `POST /deploy`. The "no Claude-safe mechanism for portal/GolfScorer deploys" gap is fully closed.
- **`/deploy` route added to Worker (was missing):** Session BP-1 noted the source was synced, but the `/deploy` route was not present in `source/worker.js`. Added and deployed (Session 40). Worker source in library now matches live.
- **`/deploy` expanded to accept `docs/` paths:** Portal live file is at `docs/portal.html` (GitHub Pages). Worker previously restricted to `source/` only. Updated to accept `source/` or `docs/` — confirmed working. Worker version 2026-06-18b.
- **Deploy procedures rewritten in Ops Guide and Session Starter** to reflect actual current state — all legacy "unresolved" and "no Claude-safe mechanism" language removed.
- **`bf_deploy.py` role clarified:** The rule against Claude executing its TOKEN-authenticated functions is a credential hygiene rule, not a capability limitation. The Worker `/deploy` route covers all files Claude needs to push. `bf_deploy.py` remains in the library for reference only.
- **`launch_golf_scorer.py` secrets cleanup:** GITHUB_TOKEN removed from auto-pull (public repo, unauthenticated). Token retained for Publish All Pages writes (legitimate, laptop-only). Old classic token rotated — new token in place. ANTHROPIC_API_KEY removed entirely; OCR feature retired (digital scorecard is the settled solution); Anthropic key revoked. `deploy_portal.py` deleted from laptop. Launcher tested and confirmed: unauthenticated pull working, new token valid, GolfScorer v8.17·2026-06-17g pulled successfully.

### Session BP-1 / Chat#39 — 2026-06-18
- Business plan library bootstrapped (`source/bizplan/`): BF_BizPlan_Vision.md, BF_BizPlan_GateLog.md, BF_BizPlan_Session_Log.md, BF_Capability_Inventory.md deployed.
- deploy.html: stale WORKER_URL fixed, literal `\n` sequences in Claude tab fixed, Business Plan section added to Library tab.
- Worker: `/history` and `/rollback` endpoints added; source synced to library (partially — `/deploy` route was still missing, fixed Session 40).

### Session 38 — 2026-06-18
- **Finding:** Claude had been directly executing `bf_deploy.py`'s embedded GitHub TOKEN — identified as inconsistent with credential handling rules. Going forward, Claude does not invoke TOKEN-authenticated functions.
- **Worker `/deploy` route added** (PIN-gated, `env.GH_TOKEN` Cloudflare secret, `source/` path restriction at the time). Verified end-to-end against a test file.
- **`deploy_file()` patched** in `bf_deploy.py` to handle new-file creation (404-on-missing-sha).
- **Network egress note:** `birdiefriends-push.birdiefriends01.workers.dev` must be in the sandbox allowlist before session start — adding mid-session doesn't apply retroactively.

### Session 37 — 2026-06-17/18
- **Groupings archive rebuilt (the actual fix):** `grpPublish('Final')` now persists `{eventName: archiveFile}` to `bf_groupings_archive` localStorage; `saveEventToSeries()` reads it and attaches `groupingsFile` automatically. Series#4 fixed retroactively.
- **Two further bugs in `generateResultsPage()`:** onclick pointed at a non-existent function; `tab-groups` content panel duplicated. Both fixed. New Golden Rule #20 added.
- **New Event safety guard:** hard-blocks on unsaved scored round, requires typing `DISCARD`.
- **View Saved Event (Tab 5):** read-only selector for any saved event.
- **End of Event:** one tracked action — Save to Series → Push to Sheets → Publish All Pages.
- **Launcher hardened:** loud port-conflict failure, visible server window, kill-old-server verified.
- **My Game → My Series naming pass** across all generated pages.

### Session 35 — Series#4 Post-Round (2026-06-14)
- Quota display bug v2 fixed: all three render sites now compute live via `grpGetEstimatedQuota`. `grpUpdateHcp` fixed to store adjustment-formula quota.
- HCP in published groupings: player HCP shown next to name.
- Cross-device skin-stop fix (v3.10.107): `submitBirdieAlert` checks shared Worker `/feed` for prior birdies across all devices.
- Birdie/Eagle/Albatross selector (v3.10.108).
- HCP source of truth confirmed: Groups tab is sole source; "Load from Profiles" is stale.

### Session 34 — Chat#34 BF Dev - Series#4 Prep (2026-06-12)
- Bootstrap fix; `node --check` mandatory pre-deploy gate established.
- GS quota display bug (v8.17a): `grpMergePlayers` re-fetches `currentHcp` + recomputes quota on every Fetch Registrants.
- Portal v3.10.96–v3.10.106: CttP player picker, live panel dark header strips, groupings iframe sheet, event card in-progress state, Scorecard Check admin card.

### Session 33 — 2026-06-11
- Notification architecture: `submitBirdieAlert` + `sendCtpNotification` now route through `osSendAll()`.
- Complete `bfType` taxonomy applied. Message copy rewritten with full names.
- All 6 admin cards collapsible via shared `toggleAdminCard()`.

### Session 32 — 2026-06-09
- GS: `↺ New Event` button; Players tab onclick fix; `resetAll()` clears Groups tab.
- Groupings archive system end-to-end; Groups tab in results; embed mode.

### Session 31 — 2026-06-05/06
- Garrett's Last Swing archive: self-contained HTML with 36 base64-embedded photos.

### Session 30 — 2026-06-04
- Garrett's Last Swing gallery page; event site schema documented.

### Session 29 — 2026-06-03
- Worker KV Feed live. `bf_deploy.py` established as canonical deploy script.

### Session 28 — 2026-06-02/03
- Worker: `GET /history`, `POST /deploy`, `POST /rollback` endpoints added.
- deploy.html Claude tab with copy button.

### Session 27 — 2026-05-31/06-01
- OneSignal identity rebuilt: Jotform `pushId` (QID 23) as single source of truth.

### Session 26 — 2026-05-30
- Push Broadcast card in Admin; Schrödinger 5th-player orange chip.

### Sessions 19–25 — May 2026
- Live Event System built (gold banner, Birdie Alert, CttP, Scorecard)
- Cloudflare KV feature flags; reusable dark-themed player picker
- Portal v3.9.x → v3.10.x

### Sessions 12–18 — May 2026
- Member management switched to Jotform live feed; self-registration flow; Commissioner PIN lock
- Full OneSignal push integration; Cloudflare Worker proxy

### Sessions 1–9 — May 2026
- GolfScorer v8.x built: Stableford quota scoring, Best 4 series formula, flight standings
- Groups tab: drag-drop builder, Jotform registrant fetch, tee time calculator

---

## 13. Complete Version History

### Portal
| Version | Key Change |
|---------|-----------|
| v3.10.0 | New nav, swipe-to-dismiss, Schedule tab, Admin to ⚙️ gear |
| v3.10.23 | Nav renamed: Home→⛳ My Events, Events→🅿️ Parked |
| v3.10.29–32 | Fivesome warning banner + detection |
| v3.10.50 | iOS 3-step visual install guide; Android one-tap native install |
| v3.10.51 | Event Control: Start Live Now / Close Event; live_override flag |
| v3.10.58 | Jotform-first notification architecture — pushId as identity |
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
| 2026-06-18a | /deploy route confirmed present in library source; source synced to live |
| 2026-06-18b | /deploy expanded to accept docs/ paths in addition to source/ |

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
| v8.17 · 2026-06-17a | Permanent groupings-archive fix: grpPublish persists bf_groupings_archive map; saveEventToSeries attaches groupingsFile automatically |
| v8.17 · 2026-06-17b | New Event safety guard — hard-blocks on unsaved scored round, requires typing DISCARD |
| v8.17 · 2026-06-17c | View Saved Event selector added to Tab 5 |
| v8.17 · 2026-06-17d | End of Event — Save to Series → Push to Sheets → Publish All Pages as one tracked, retryable action |
| v8.17 · 2026-06-17e | My Game → My Series naming fix across all generated-page nav and publish-toast text |
| v8.17 · 2026-06-17f | Groups tab initial-load sync fix |
| v8.17 · 2026-06-17g | Real Groups tab click fix: onclick pointed at non-existent function; duplicate tab-content panel removed |
