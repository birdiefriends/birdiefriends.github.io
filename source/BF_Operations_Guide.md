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

**Deploy mechanism (Dev-63):** results.html/standings.html/mygame.html and groupings.html/groupings-meta.json all push straight to `docs/` on GitHub via the Worker's PIN-gated `POST /deploy` route — `deployPagesToGitHub()` in `BF_Golf_Scorer_8.html`, same route the source file and portal.html already use. This replaced an opaque local-launcher relay (`/api/netlify/deploy` on `launch_golf_scorer.py`'s local Python server) that was historically named for Netlify. Investigated Dev-63 after Brian noticed `docs/results.html` hadn't updated since June 17 despite Publish clicks reporting success: the Netlify project itself (`birdiefriends.netlify.app`) was confirmed stale and disconnected — last touched via a manual "Netlify Drop" upload in May, unrelated to what's actually serving birdiefriends.com (which is, and has been, GitHub Pages). Whether the local relay itself was quietly pushing to GitHub directly via its own embedded token at some point, or simply wasn't reaching production reliably, is unclear and no longer matters — every publish is now a real, inspectable GitHub commit with the same rollback story as any other managed file. See Backlog table below for the resulting money-list history bug this surfaced and its fix.

**Groupings publish (separate, pre-round):**
- Click **🌐 Publish Groupings** in Groups tab → set Status → **Final** before final publish
- Deploys `groupings.html` + `groupings-meta.json` + the permanent archive copy — all via the same `deployPagesToGitHub()` path above
- Wait ~60s before sharing link
- `grpPublish Final` writes the archive pointer into `bf_groupings_archive` localStorage; `saveEventToSeries()` attaches `groupingsFile` automatically — no manual follow-up needed.
- The white nav bar's "⛳ Groupings" link on results.html is a static `/groupings.html` link, always — it does not follow the event-pill selector (fixed Dev-63; previously it dynamically re-pointed to whichever event's archive was selected, hijacking general-purpose navigation). The **Groups tab** within results.html (not the white nav) is the event-aware one — that's the intended place to browse a specific past event's archived groupings.

### Token Recovery
GitHub token lost: github.com → Settings → Developer settings → Personal access tokens → GolfScorer → Regenerate. Paste new `ghp_...` into `deploy_portal.py` line 16. Note: this is the classic token used by that laptop-only script — separate from the Worker's `GH_TOKEN` Cloudflare secret, which is a fine-grained PAT managed entirely in Cloudflare and is what all Claude-driven deploys actually use, including GS's Publish flow as of Dev-63. **Possible cleanup, not yet done:** `launch_golf_scorer.py` line 39 previously held a GitHub token specifically for the old Publish-All-Pages relay (see Session 40 entry below) — since that relay is retired (Dev-63), this token may now be fully unused. Worth Brian confirming and removing it next time that file is opened, consistent with the Session 40 credential-hygiene pass.

**`launch_golf_scorer.py` backup (Dev-64):** this file previously had no backup anywhere — laptop-only by design since it holds `JOTFORM_API_KEY` in plaintext. A sanitized copy now lives at `source/launch_golf_scorer.py` in the public library with `JOTFORM_API_KEY = ""`. If the laptop copy is ever lost, pull the library copy and paste the real key back into the **local runtime copy** — the real value is not recorded here either, since this Ops Guide is itself pushed to the same public library. Any future push of this file to the library must blank the key again first — never commit the real value to `source/`.

---

## 4. System Reference

### Current Versions
| Component | Version | Status |
|-----------|---------|--------|
| Portal | v3.17.36 · 2026-07-19 | Production ✅ — Live Panel camera fix (removed risky Android MIME hack, fixed silent capture failure), Share BirdieFriends button, universal RSVP icon-row redesign, gatheringId-aware matching fix (Dev-64) |
| GolfScorer | v8.47 · 2026-07-18 | Deployed ✅ — Quota Stability Rule badge finalized (Dev-64); 25% per-event cap, DiffHCP persistence fix, unpublished-groupings-changes banner (Dev-64); results.html rebuild, Netlify-relay retirement, payoutSnapshot fix all Dev-63 |
| Worker | 2026-06-18b | Deployed ✅ — `/deploy` accepts `source/` and `docs/` paths. No Worker changes Dev-63/64. |
| deploy.html | 2026-06-18 | Live ✅ — all tabs functional (Session BP-1 fix) |
| bf_deploy.py | 2026-06-18 | In library for reference only — TOKEN-authenticated functions not invoked by Claude |
| bf_architecture.html | 2026-07-14 (Dev-63) | Library ✅ — GolfScorer node + publish-path note updated; ERD/D1 sections still current as of Dev-56, untouched |
| Launch_Golf_Scorer.bat / launch_golf_scorer.py | 2026-07-16 (Dev-64) | Current ✅ — laptop-only, not in GitHub. Threaded-server fix confirmed live; sanitized backup (key blanked) now in library at `source/launch_golf_scorer.py`. Publish-relay token may now be unused, see Token Recovery above (Dev-63) |

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

### BF Series Recruiting Tools — Registration Tracker, AWR, Inactive Player Interest (Dev-56)
Built for BF Series #5 recruiting. Three pieces, two of them D1-backed, one pure client-side.

**Registration Tracker (Commissioner Admin → Communicate → 🎯 Registration Tracker):**
Per-event roster list with tap-to-set Yes/Sub/No — lets the commissioner correct a
player's status directly (e.g. someone who replied No by text instead of in-app)
without switching identity via the name-switcher. Pure client-side: reuses
`eventData`/`regData`/`memberData` already loaded, writes go straight to Jotform via
the same PUT-beats-POST pattern `submitRegistration()` uses for a player's own
registration (`adminSetRegistration()`). No new D1/Worker needed for this base piece.

Event picker is restricted to **BF Series events only** (via `formatBadge(e.format)
=== 'BF Series'` — excludes Gatherings, WallyCup, etc.) and **current/upcoming only**
(`e.dt >= startOfToday`), with the soonest one pre-selected — fixes a recurring
wrong-event-selection mistake.

Each row also shows a **Registered → status timeline** when Jotform's `updated_at`
differs meaningfully from `created_at` (e.g. "Registered Jul 1 → No Jul 4") — tells
the commissioner who bailed early (low concern) vs. who flipped right before the
event (worth a follow-up text). `parseRegSubmissions()` now captures `updated_at`
(falls back to `created_at` if the submission was never edited); all local
optimistic writes stamp `updatedAt` too so the timeline is accurate immediately,
not just after the next full reload.

**AWR — Awaiting Registration (commissioner flag, separate from Jotform):**
A per-event flag for "I know they're playing, they just haven't registered" —
learned via text/conversation, not something Jotform can represent. Deliberately
kept **out of** the real Register? answer/`regData`: that status flows through
capacity counts, Text All Players, push targeting, and event-card rendering
everywhere else in the app, all of which assume only Yes/Sub/No. A 4th real
registration value there would ripple into all of it. Instead it's a standalone
flag table, same shape as `commissioner_checklist_state` — presence of a row = flagged.

| Table | Shape | Purpose |
|-------|-------|---------|
| `registration_intent` | `event_name, player_name` — PK both | AWR flag, **event-scoped** |

Tracker shows five buckets, sorted true-unknowns-first: ⬜ No reply → 🟡 AWR (flagged)
→ ✅ Yes → 🔄 Sub → ❌ No. Worker routes: `GET /registration-intent?event=&pin=`,
`POST /registration-intent/toggle?pin=` (body: `event_name, player_name, action`).

**Tidiness (v3.17.16):** once a real Yes/Sub exists for that player+event, any
lingering `registration_intent` row is auto-cleared via `clearRegistrationIntent()`
— fired from every path that can produce a real Yes/Sub (self-registration,
unregister-then-Undo, commissioner override). Fire-and-forget; the toggle route's
`remove` action is a no-op DELETE if there was never a flag, so it's safe to call
unconditionally.

**Inactive Player Interest (Commissioner Admin → Communicate → 💤 Inactive Players):**
Jotform has no "interested in BF Series" field for Inactive members, and the full
Inactive roster is too large to recruit against blindly — but the commissioner often
knows specific individuals want back in. A ☆/⭐ toggle per Inactive member builds a
persistent recruiting shortlist over time; a "📱 Text Interested" button group-texts
just the starred set (reuses the existing `sms:` multi-recipient pattern from
`textAllPlayers()`).

| Table | Shape | Purpose |
|-------|-------|---------|
| `inactive_player_interest` | `player_name` PK | Interest flag, **NOT event-scoped** — durable across events, unlike `registration_intent` above |

Worker routes: `GET /inactive-interest?pin=`, `POST /inactive-interest/toggle?pin=`
(body: `player_name, action`).

**Tied into Registration Tracker:** starred Inactive players merge into the tracker
roster for the selected event, tagged 💤 Inactive, with the full Yes/Sub/No/AWR
button set. Registering one Yes/Sub calls `restoreActiveIfNeededByName()` (a
name-parameterized twin of the existing `restoreActiveIfNeeded()`) to auto-restore
them to Active in Jotform — closes the loop from "known interested" → "registered" →
"active member" in one action instead of a separate manual reactivation step.

**Gear-panel Refresh fix (applies beyond this feature):** tapping a collapsed
card's header ↻ Refresh button used to fetch into a hidden body — looked like
nothing happened. Fixed generically with `expandAdminCard(cardId)` (force-open,
never closes), wired into all five affected cards: Announcements, Push Subscribers,
Engagement, Registration Tracker, Scorecard Check.


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

### Unpublished Groupings Changes Banner (Dev-64)
`grpPublish()` bakes a one-time snapshot of `grpPlayers` into the static `groupings.html` at click time — there's no live connection to the Groups tab afterward. Any HCP/quota correction made after the last publish (GHIN import, manual table edit, group/tee-time change) silently goes stale on the public page with no warning. Caught live when a GHIN-corrected HCP for Wilbur Hlay didn't match the already-published page.

**Mechanism:** `grpComputePublishFingerprint()` builds a lightweight fingerprint of exactly what generates the published page (per-player group assignment, sort order, HCP, quota, tee). `_grpPublishedFingerprint` is captured on every successful **non-Hidden** publish (a Hidden/holding-page publish is deliberately excluded — it doesn't show real grouping data). `grpUpdatePublishStatusBanner()` compares live vs. last-published and shows/hides the amber banner next to the Publish button — hooked into `grpRenderPool()`/`grpRenderGroups()`, both of which already fire after every meaningful mutation, so no individual mutation site needed separate instrumentation. Resets to `null` on a fresh `grpFetchRegistrants()` call so switching events doesn't compare against an unrelated prior publish.

**Not yet live-verified** — built and syntax-checked (GS v8.44) but not yet exercised against a real GHIN import/HCP edit followed by Publish. First thing to check next session.

### No-HCP Player Flow (e.g. Rich Potts)
- `grpMergePlayers` sets `isNoHcp: false` by default — new player ≠ no GHIN handicap
- Commissioner manually blanks HCP field → triggers `isNoHcp: true` → tee dropdown appears
- `grpPublish()` blocks if tee is blank (hard guard)
- Kick Off passes tee to Tab 2; `goToScorecard()` blocks again if blank (second guard)
- Event 1 is baseline — no quota, no podium. Event 2+ enters full quota system.

### DiffHCP Player Flow — manual entries used to get silently overwritten (fixed Dev-64)
DiffHCP players (e.g. Wilbur Hlay, Jeremy Burkett) have a real handicap, just not sourced from GHIN — the Membership form's hidden GHIN Name field is set to `DiffHCP`, which tells `grpApplyGhinPaste()` to never search for or touch their HCP during a paste, only flag it as a standing reminder to update by hand.

**The bug that was here:** that DiffHCP status only ever existed transiently, re-derived from the Membership form on each paste — never actually stored on the player object. `grpMergePlayers()` (runs on every "Fetch Registrants" click) has an "always refresh HCP from latest series history" step that only checked `!existing.isNoHcp`, so it couldn't tell a DiffHCP player apart from a normal one and silently overwrote the commissioner's manually-typed HCP with stale `playerHistory.currentHcp` every time. Reported live: Brian kept having to re-enter Wilbur/Jeremy's HCP.

**Fix (v8.45):** `p.isDiffHcp` is now a real, persisted flag — set `true` in the DIFF_HCP paste branch, cleared back to `false` if a later paste finds the Membership field reset to normal. `grpMergePlayers`'s refresh guard is now `!existing.isNoHcp && !existing.isDiffHcp`. Not yet live-verified — first thing to check next session: re-enter Wilbur/Jeremy's HCP, click Fetch Registrants, confirm it holds.

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
- **Initial quota formula (first scored event):** `36 − (HCP × Slope / 113)` — Green slope 132, Combo 128, Gold 115
- **Adjustment formula (every event after):** `adjustQuota()` — `newQuota = prevQuota + perfAdj + hcpAdj`, where `perfAdj = 0.5 × (actualScore − prevQuota)` (50% regression toward last performance) and `hcpAdj = (prevHcp − newHcp) × (slope / 113)`. NoHCP players skip the HCP term entirely.
- **Quota Stability Rule (Dev-64, GS v8.46):** the combined per-event adjustment (`perfAdj + hcpAdj`) is capped at 25% of `prevQuota` in either direction — `QUOTA_CAP_PCT = 0.25`, applied via `applyQuotaCap()` inside `adjustQuota()`, so it governs both the real post-event scoring update and the Groupings-tab pre-event estimate from one place. Surfaced when Rich Penberg's BFSeries#5 quota compounded down to 0.95 (a bad round and a 3-stroke HCP jump landed the same cycle on an already-modest base) — nearly guaranteeing a runaway "performance" differential on his next round regardless of true current form. Backtested against BFSeries#2–#4 real data: 25% would have capped Carl Stadtmueller and Jake Knappenberger's #2→#3 drops (nobody else); 50% would have capped nobody historically. **Applies prospectively only** — `adjustQuota()` always reads `prevQuota` from whatever's already recorded in `playerHistory`, so past events are never recalculated (confirmed this wouldn't have even changed Carl's #3 podium placement, but the decision not to touch history stands regardless of what any specific recalculation would show).
  - `grpQuotaBreakdown()` ("Why this quota?" panel — same function both the live Groups tab and the published `groupings.html` call) always shows a **Full calculation** line (uncapped) followed by a bold **Actual quota** line (capped). When the cap actually triggers, a compact amber badge ("🔒 25% cap applied") appears between them — `grpQuotaCapBadge()`, reusing the warning color already established for the unpublished-changes banner. No numeric floor/ceiling range shown inline (an earlier draft had one — Brian asked for it removed in favor of just the applicable capped number). The full player-facing definition (`QUOTA_STABILITY_RULE_TEXT`) lives as a native `title` tooltip on the badge, not inline text — available on hover/long-press, not permanently taking up space.
  - **Not added to `guide.html`** — deliberate scope decision, since the guide doesn't explain quota mechanics at any technical depth today and a rule definition without its surrounding formula would be inconsistent with the rest of that document. Revisit if Brian wants a plain-language quota section added there.
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

### RSVP Control — universal icon row (Dev-64)
Every event card (Series, Weekend, Gatherings, everything) uses the same compact three-icon Yes/Sub/No control — `buildRsvpIconRow(evt, myReg, opts)`, called from `buildActionButtons()`. Current status renders filled/gold (`.icon-action-badge.primary`); the other two render translucent (`.secondary`). Replaces the old design where Gatherings had three stacked full-width buttons and Series had only a single "Register"/"Unregister" button with no pre-registration "No" option — the missing "No" was the direct trigger: players were registering Yes then immediately unregistering as a workaround to record a decline. `icon-action-btn`/`.icon-action-row` CSS (Dev-57, Live Panel Photo Capture) is the shared component — no new CSS needed.

Every icon tap calls `submitRegistration(evtId, evtName, this, answer)` directly — no separate confirm step. `submitRegistration` already routes Gatherings to `submitGatheringRegistration` and does its own PUT-vs-POST lookup for Series events; `changeRegistration` is no longer used by any RSVP button (previously the "Unregister" path only — its Undo-toast-on-cancel affordance was Series-only and is not preserved by the icon row, which is uniform with how Gatherings already worked).

**Capacity semantics — preserved, not simplified:**
- Series overflow: a full event's Yes tap silently submits `Sub` instead (`opts.yesSubmitsAs`) — same behavior as the old button-label swap, just expressed as an icon override instead of changing the label text.
- Gatherings: Yes tap always submits literal `Yes` even over capacity (intentional over-cap waitlist model — different from Series on purpose, both preserved as-is).
- Hard capacity lock (Series only): Yes icon disabled (`opts.disabledKeys`) unless already Yes; Sub/No stay live.

**`submitRegistration`'s direct-`'No'` path** was previously unreachable for Series events (only `changeRegistration`'s Unregister ever produced it) — now fixed to park the card + "Marked as not attending" toast, mirroring `submitGatheringRegistration`'s existing `'No'` handling, instead of a stale "🔄 Sub registered" toast.

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

### About Screen (ℹ️ icon in header)
`screen-about`. Cards top to bottom: **New to BirdieFriends?** (links to `guide.html`), **Share BirdieFriends** (Dev-64 — `shareApp()`, native Web Share API with clipboard-copy fallback; text "Welcome to BirdieFriends.", links to `portal.html` — revised v3.17.35 per Brian, originally shared the landing page with longer text), **About the App** (home course/tee info, GHIN signup pointer, Message the Commish), build version footer.

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
| **AI-generated event narratives** | 🔲 Next (candidate Dev-64) | Concept captured Dev-63 — see `source/specs/BF_EventNarratives_Spec.md`. Short, humorous per-player + overall event write-ups generated from existing historical data (quota/skins/CTP/season trends) at Publish time, via a new PIN-gated Worker route holding an Anthropic key as a Cloudflare secret. Tone/moderation guardrails and a preview-before-publish step are explicitly called out in the spec as needed before this goes live-facing. Not yet scoped for a build — needs its own design session. |
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
| **Money List silently rewrote paid-out history when the payout formula changed** | ✅ Fixed Dev-63 | `calculatePayout()` is a pure function with no per-event formula versioning — recalculated fresh from raw scores every time results.html regenerated, using whatever formula is CURRENT. When the Dev-62 proportional payout structure replaced the old flat $40/$20/$10 podium + $10/hole CTP model, every already-paid-out historical event (Series#2/3/4) silently got its Money List rewritten to what the NEW formula would pay, not what was actually handed out in cash — surfaced when Brian compared a fresh republish against his own earlier screenshot. Real historical amounts recovered by pulling the last pre-Dev-62 commit of `docs/results.html` from GitHub history and recomputing with the exact old formula (also recovered from git history), verified against Brian's screenshot (exact match). **Root fix:** `saveEventToSeries()` now computes and freezes a `payoutSnapshot` on the event record at save-time — same protection pattern already used for quota/actual. `generateResultsPage()` (both server-render and the client-side event-pill switcher) uses the frozen snapshot for any event that has one, only recalculating live for events that predate the fix. One-time backfill button (**⚕ Fix Historical Payouts**, Series tab) restores the exact recovered numbers for Series#2/3/4. Any event saved from this point forward is permanently immune to future formula changes. |
| **Netlify relay retirement — see Deploy Procedures §3 "Generated Pages" above** | ✅ Fixed Dev-63 | Full detail there; summary: GS's Publish flow now pushes straight to `docs/` via the Worker's `/deploy` route instead of an opaque, historically-Netlify-named local relay that had lost any real connection to what serves birdiefriends.com. |
| **results.html header title/date frozen on event-pill switch** | ✅ Fixed Dev-63 | The header `<div>`s for event title/date had no `id` attributes at all; `loadEvent()`'s header-update code was targeting `document.getElementById('hdr-event-date')`, an ID that didn't exist anywhere in the markup — silent no-op. Every other tab (Highlights/Standings/Photos/etc.) updated correctly on pill click; only the header stayed frozen on whatever was server-rendered at page load. Added real IDs to both divs; `loadEvent()` now also updates the browser tab title (`document.title`), which was never wired up either. |
| **Top nav "⛳ Groupings" link hijacked by the event-pill selector** | ✅ Fixed Dev-63 | `updateGroupingsLink()` dynamically rewrote the white nav bar's Groupings href to whichever event was currently selected via the results.html event pills — so browsing an old event's history silently redirected general-purpose navigation to that event's archive instead of the live groupings page. Removed the function and both call sites entirely; the nav link is now always the static `/groupings.html` baked into the markup. The **Groups tab** (in the in-page tab bar, not the white nav) remains correctly event-aware — that's the intended place to reach a specific event's archived groupings, per Brian's explicit design intent. |
| **GitHub Pages stuck-queue / failed-deploy remediation** | 📝 Process note | Learned live Dev-54 across two separate incidents. A **failed** run: re-running it directly often works if the underlying build artifact is already valid (check the run's own step-by-step breakdown — if `build` succeeded and only `deploy` failed with "Deployment failed, try again later," that's GitHub's own admission it's on their end). A run **stuck in Queued** (even after a manual re-run): re-running again just re-queues behind itself — doesn't help. The fix that actually works: push any small new commit. The workflow's concurrency group cancels the stuck/queued run and starts a fresh one, same mechanism that normally cancels an in-progress run when a newer commit lands. Confirmed GitHub's Contents API (`/deploy` route) is a fully separate subsystem from Actions/Pages — commits keep succeeding even during a Pages outage; only the live-site rebuild is affected. BZP work (docs-only, no Pages deployment involved) is entirely unaffected by this class of outage. |
| **Photo Capture R2 setup** | 📝 Reference | Bucket `birdiefriends-photos`, Standard storage class (Infrequent Access considered and rejected — wrong fit for an actively-served gallery; adds a per-GB retrieval fee and 30-day minimum duration for content read on every page view). Bound to the Worker as `PHOTOS_BUCKET` via Cloudflare dashboard → Worker → Settings → Bindings (manual, one-time, not something `/deploy` can do — that route only handles GitHub commits). If this Worker is ever redeployed from scratch, this binding must be re-added manually before any `/photos/*` route will function — they return a clear "binding not configured" error rather than crashing if it's missing. |
| **Device-local state that should be player-synced ("Parked syndrome")** | ✅ Resolved Dev-55 | `bf_hidden_events_`, `bf_seen_events_`, and `bf_first_load_` moved to D1 (`player_event_state`, `player_meta`) — first device per player captures local state once and pushes it, every other device reads from D1 from then on. Dev-55's full assessment sweep of *every* localStorage key and admin tool found two more instances of the same root problem: `bf_announcements_dismissed` (was global, not even per-player — now per-player in `player_announcement_dismissals`) and the Commissioner Sunday Checklist's `bf_sunday_done_{date}` (now `commissioner_checklist_state`). Also found and removed `bf_fivesome_pending_{eventId}` — not a sync bug, just dead write-only code that nothing ever read. Full architecture in "Player Personalization (D1-backed, Dev-55)" below. |
| **D1 schema log / architecture doc had silently drifted stale** | ✅ Resolved Dev-56 | `source/specs/BF_Gatherings_Schema.sql` — the *authoritative* migration log — had stopped at Entry 8 (Dev-54), missing venues, gathering_templates, the whole Dev-55 personalization migration, and Dev-56's two new tables. Caught while updating `bf_architecture.html` per Brian's request; fixed at the source (Entries 9–15 appended) rather than just patching the downstream doc. `bf_architecture.html`'s `DETAILS.d1`/`.worker`/`.admin`/`.portal` entries also rewritten to drop stale claims (4-table D1 count, "planned D1 binding," dissolved Dev Controls card, hardcoded version number). The visual SVG ERD itself still only draws the original 4-table core — explicitly still deferred as its own dedicated redraw session, now with an accurate, complete text log to draw from. |
| **Commissioner PIN — client-side "secret" with no overall plan** | 🔲 Backlog, not urgent | `7797` is hardcoded directly in `docs/portal.html` (public, unauthenticated GitHub Pages) — both as the `COMMISSIONER_PIN` constant and as raw literals scattered across several fetch calls instead of always referencing the constant. Anyone who opens dev tools on the live site has it in seconds; this was the original Session 1-28 trust-based design, not a regression. Dev-57 added PIN checks to several previously-open Worker routes (`/groupings`, `DELETE /subscription/:id`, `GET /subscriptions`, `GET /notifications`) during a reactive security sweep — each fix was correct in isolation, but Brian flagged the pattern itself: gates keep getting added route-by-route with no overall plan for what the PIN scheme is actually supposed to protect against, or when a real fix (session token issued after PIN entry, not re-sent as a literal on every request; or full per-commissioner auth) becomes worth the lift. Related: `JOTFORM_API_KEY` row above has the same "real secret sitting in public client-side source" shape. Worth one session, whenever it's a priority, to treat both as one architecture decision instead of continuing to patch individual routes as they're noticed. |
| **Photo Organizer — native GS panel** | ✅ Resolved Dev-58 | Built as GS nav tab 6, independent event picker (queries the Request Event form directly for real dates, not a proxy), 3-column chapter layout, chronological sort by real `captured_at`, chapter-reassignment dropdown per photo. Backend fully shared with the portal's Dev-57 work — no new Worker routes needed. |
| **Photo capture window vs. post-event reality — debated, not resolved** | 🔲 Decision deferred, 8hr window kept for now | `LIVE_EVENT_HOURS = 8` gates the whole Live Panel (Scorecard/CttP/Photos together) — for a 7:00 AM tee time that's roughly a 3:00 PM cutoff. Brian's own post-round pattern routinely runs later than that (different venues, extended Saloon time), and photos both surface and worsen the gap — a player who wants to add a photo after the window closes has no path today, whereas that friction didn't exist pre-Photos. Real tension: self-closing (no capture surface relying on Brian to manually shut anything down) vs. capturing what people actually want to add after-hours. **Decision for now: keep the 8hr window as-is, observe real player behavior at #5 and BF Series events after, before changing anything** — genuinely unclear how much appetite this player base has for photo-journaling a round (Brian's read: golfers here skew "historians" — focused on scores/stats — not documentarians; unclear if that holds once the capability exists). Options discussed, none built: (1) a separate Gear-menu capture button on a longer bounded grace window (e.g. 24hr from tee time) that skips tee-time/scorecard classification entirely and just hardcodes `post_round` — genuinely simpler than Live Panel's capture, not harder, since post-window is definitionally after the round; (2) leaving it exactly as-is and relying on players to contact Brian directly to add a missed photo, which requires the republish flow below to exist anyway. Also surfaced: `getLiveEvent()` is the sole "what event is live right now" resolver and only exists because of the 8hr window — any post-window capture path needs its own separate event-resolution logic, not a reuse of that function. Explicitly **not** the same problem as an eventual GSL-type always-on capture surface — that's a different tier of the same BF Engine capability (multi-day, after-hours-is-the-point), worth designing fresh when it's actually in front of us rather than retrofitting bounded-round assumptions onto it. |
| **Photo republish — coupled to Publish, not a separate problem** | 🔲 Deferred with Publish itself | If a photo gets added after an event's photo history is published (see Photo Organizer → GS results.html insertion, unblocked but not built), there's no defined process for safely republishing without disrupting whatever's already live. Nothing to design here until Publish itself exists — captured only so it isn't rediscovered as a surprise once Publish is being built. |
| **Per-event payout formula — proportional model** | ✅ Shipped Dev-62 | Replaced flat $40/$20/$10 podium + $10/hole CTP (had become disproportionate to skins as BFSeries#5 grew to 22-24 players). New: podium 20% of pool weighted 2:1:0.5, CTP 15% of pool across 5 holes, each rounded to $5, balance to skins — skins additionally floor to whole dollars (unpayable fractional cents otherwise), leftover displayed on the Results tab rather than silently dropped. Lives in `calculatePayout()` (GS Results tab) and the duplicate inside `generateResultsPage()` — both must be updated together, confirmed byte-identical output before shipping. Portal's new Payout Cheat Sheet (Commissioner Admin → Event Day) mirrors the same formula for gameday sanity-checking. Does NOT touch `generateSeriesPage()`'s season-long Money leaderboard (`QUOTA_PRIZES_M`, still flat) — see next row. |
| **Season Money / Overall-pot flight system — needs its own design session** | 🔲 Backlog, real gap | Starting BFSeries#5, qualifying players contribute an extra $20 into a season-long "Overall" pot, paid out as % podiums (1st/2nd/3rd) across four flights (Overall, Green, Combo, Gold). Brian indicated this was modeled once in GS already but may need revisiting — not confirmed where that model lives or whether it's still accurate. Separate system from the per-event payout formula fixed Dev-62; `generateSeriesPage()`'s existing Money leaderboard (flat $40/$20/$10, recomputed live from `playerHistory` on every render) is the closest existing code but wasn't designed with a $20 buy-in or flights in mind. Needs a dedicated session before real money changes hands on it. |
| **Text All Players / Send Notification matched by title, not gatheringId — same bug class as Dev-58** | ✅ Fixed Dev-64 | `textAllPlayers()`, `openCommissionerPush()`, and `sendCommissionerPush()` (the commissioner-only "📱 Text All Players"/"📣 Send Notification" buttons under an event card's Players expand) all filtered `regData` by raw `eventName` string match, missed during the Dev-58 sweep that fixed this same class of bug (`findMyReg`/`buildEventCard`/`getSimpleCapacityStatus`) after Chooch's recurring-Gathering title collision. Harmless for BF Series events (always-unique titles) but a real risk for Gatherings — a same-titled recurring Gathering in week 2+ could have texted or pushed the wrong week's crew. Fixed all three functions to match by `gatheringId` when `evt.source === 'gathering'`, falling back to title match otherwise, same pattern as the rest of the app. Deployed v3.17.32. Surfaced while confirming the per-event "Send Notification" feature already existed and did what Brian was asking for (registered-players-only OneSignal push, `bfType: 'event_push'` — see §6 above) — it just wasn't discoverable from the card face itself. |
| **RSVP icon row — universal Yes/Sub/No redesign** | 🟡 Shipped Dev-64, not yet live-verified | Full detail in §8 "RSVP Control" above. Real player feedback (Yes-then-immediately-Unregister as a workaround for a missing "No" option) drove the redesign; Brian picked the icon-row layout after a 3-option visual mockup. Capacity overflow/lock semantics preserved via `opts.yesSubmitsAs`/`opts.disabledKeys`, not simplified away. Known trade-off: the old Series-only Undo-toast-on-Unregister is gone — every RSVP action now routes through `submitRegistration` uniformly (matching how Gatherings' buttons already worked), no Undo affordance on any status change including No. First priority next session: exercise on real devices — Series card, Gathering card, capacity-lock/overflow edge cases, direct-No park/toast behavior. |
| **`launch_golf_scorer.py` — "Failed to fetch"/needs-relaunch pattern** | ✅ Fixed & confirmed Dev-64 | Root cause: the local launcher used `socketserver.TCPServer`, which handles exactly one request at a time. GS fires several proxy calls close together (GHIN Name map on every Groups-panel open/Apply per Dev-59's no-cache fix, plus portal events/registrations, sheets/netlify status, groupings, scorecard submissions) — while the server was busy on one, others queued behind it, and if any single call ever hung on the network the whole server froze for every caller until the process was killed and relaunched. Fixed by switching to a `socketserver.ThreadingMixIn` + `http.server.HTTPServer` combo (`daemon_threads=True`, `allow_reuse_address=True`) — each request now runs on its own thread, so one slow/stuck call can't block the rest; `allow_reuse_address` also reduces "port already in use" on quick relaunches. Brian relaunched with the fix and confirmed the issue is resolved. **Also fixed same session:** this file had never had a backup anywhere — laptop-only by design because it holds `JOTFORM_API_KEY` in plaintext. A sanitized copy (key blanked to `""`, real value never leaves the laptop) is now pushed to `source/launch_golf_scorer.py` as a reference/recovery backup — see Token Recovery in §3 above. Brian confirmed the real key is back in the local runtime copy; the library copy stays blank on every future push. |
| **Live Panel camera — only 1 of several players' photos reached the server at BFSeries#5** | 🟢 Two fixes shipped Dev-64, promising signal since | Real live-event incident. Confirmed via `GET /photos?event=...` and `GET /debug/last-upload?pin=7797` that D1 had exactly one successful row (Jeff Rapp) before the fix — no trace of any other attempt, meaning the failure point was client-side, before any request reached the Worker (server-side failures already surface as toasts via `livePanelUploadCore()`'s try/catch). Mixed iOS/Android group affected, not isolated to one OS. Two fixes shipped on best available evidence: (1) removed the `android/allowCamera` bogus-MIME entry from the camera input's `accept` list — flagged fragile since Dev-57, never confirmed working on a real device; (2) fixed a real, separate, definitely-real bug found while investigating — `livePanelCameraPicked()`/`livePanelUploadPicked()` both silently `return`ed with zero user feedback when `input.files[0]` was empty (fires both on a legitimate cancel and on any other unexplained failure — no way to tell those apart client-side, so the fix is a quiet status-text update, not an alarming error toast). **Update, same session:** Paul Kametz and Nate Stettler both successfully uploaded post-round photos (ids 38, 39) shortly after the deploy — two distinct new players succeeding, not a repeat of the one player who already worked, on a genuinely mixed device group. Encouraging, not yet conclusive — three total successful uploads across one event isn't enough volume to fully rule out an intermittent issue. Keep watching at the next live event with a fuller field. |
| **Photo Upload Pause kill switch (Dev-60) is dead code** | 🔲 Found Dev-64, not fixed — Brian to decide | `PHOTOS_UPLOAD_PAUSED` is set from the admin flags fetch and drives the toggle's own status display (🔴 Paused / ⚪ Active) — but nothing anywhere actually checks it before allowing an upload through. Not in `/photos/upload` (worker.js), not in `livePanelCameraPicked()`/`livePanelUploadCore()` (portal). Toggling it on or off currently has zero effect on real uploads. Found while investigating the camera capture incident above — not the cause of that incident (nothing was toggled at the time), but a real, separate gap: the toggle implies a protection that doesn't exist. Needs a decision: wire up a real check (Worker-side, matching the original Dev-60 design intent), or remove the vestigial UI so it stops being misleading. |

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
