<!-- CLAUDE INSTRUCTIONS — READ FIRST
FETCH RULE — NON-NEGOTIABLE:
Use bash_tool with curl for ALL raw GitHub URL fetches. Do NOT use the web_fetch tool
for raw.githubusercontent.com URLs — it requires a prior search result and will block.
The bootstrap handles this automatically via its curl bash block.

DEPLOY RULE:
Claude does NOT import bf_deploy.py and call its TOKEN-authenticated functions
(deploy(), deploy_file(), rollback()). The file contains an embedded GitHub token;
Claude does not hold or use API tokens directly to take actions, regardless of how
thoroughly the user authorizes it. bf_deploy.py may be fetched and read for reference
logic (e.g. the GS version-bump regex) but must never be executed against the live token.

All deploys — including portal.html, GolfScorer, worker.js source, ops guide, session
starter, and all bizplan docs — use the Worker's POST /deploy route instead:
  curl -s -X POST "https://birdiefriends-push.birdiefriends01.workers.dev/deploy" \
    -H "Content-Type: application/json" \
    -H "User-Agent: Mozilla/5.0 ..." \
    --data-binary @/tmp/payload.json
For large files (portal ~420KB, GolfScorer ~370KB) write the JSON payload to a temp
file via python3 and use --data-binary @file — do NOT pass content inline to -d.
No file size limitation in practice — Cloudflare free tier allows 100MB. Tested to 445KB.

WORKER RULE:
Worker changes require worker.js from the library (source/worker.js).
Claude never reconstructs Worker code without the source file.
Worker code changes require TWO steps: (1) push source/worker.js via /deploy,
(2) user pastes into Cloudflare dashboard → Save and Deploy.

BIZPLAN RULE:
Business plan docs live at source/bizplan/ — separate from the dev source/ library.
BF_BizPlan_Bootstrap.md not yet built. For now, bizplan sessions load the 4 BP docs
directly from source/bizplan/ via curl at session start.
-->

# BirdieFriends Golf Scorer — Session 41 Starter
**Date:** TBD (follows Session 40, 2026-06-18)
**Portal Version (production):** v3.10.139 · 2026-06-16
**GolfScorer Version:** v8.17 · 2026-06-17g (deployed)
**Worker Version:** 2026-06-18b (deployed — /deploy accepts source/ and docs/ paths)
**Live URL:** https://birdiefriends.com/portal.html
**Jotform API Key:** dd0cb09a71eee7d0db3aa690e292660f

---

## Session 40 Accomplishments — Deploy Infrastructure Fully Resolved (2026-06-18)

### All deploy limitations eliminated

The "no Claude-safe mechanism for portal/GolfScorer deploys" gap that had been carried
forward since Session 38 is fully closed. Summary of what was proven and fixed:

**The 100KB limit was never real.** Cloudflare free tier allows 100MB request bodies.
The portal (420KB) and GolfScorer (369KB) both deploy cleanly via POST /deploy.
The confusion came from a misremembered or misapplied constraint — there is no file
size problem at any scale relevant to this system.

**The /deploy route was missing from source/worker.js.** Session BP-1 documented the
source as "fully synced" but the /deploy route was not present in the library copy.
Confirmed by direct inspection at session start. The route was added to worker.js,
pushed to the library via /deploy, and deployed to Cloudflare by the user.

**The /deploy route was expanded to accept docs/ paths.** The portal live file is at
docs/portal.html (served by GitHub Pages). The original /deploy route only accepted
source/ paths, so docs/portal.html couldn't be pushed. Updated to accept source/ or
docs/ — both confirmed working. Worker version bumped to 2026-06-18b.

**Large-file deploy pattern established.** Shell argument limits prevent passing large
files inline to curl's -d flag. Correct pattern: write JSON payload to a temp file via
python3 -c, then use --data-binary @/tmp/payload.json. This is now the standard for
portal and GolfScorer deploys.

**bf_deploy.py role clarified.** The rule against Claude executing its TOKEN-authenticated
functions is a credential hygiene principle — Claude does not hold or use API tokens
to take actions. It is not a capability limitation. The Worker /deploy route covers
everything Claude needs to push. bf_deploy.py stays in the library for reference only
(e.g. reading the GS version-bump regex).

### Deploy procedures — current state

**Portal (docs/portal.html + source/portal.html + source/portal_version.txt):**
```python
# python3 in bash_tool — write three payload files, then push all three
import json, re, datetime

with open('/home/claude/birdiefriends_portal.html') as f:
    portal = f.read()
with open('/home/claude/portal_version.txt') as f:
    ver_txt = f.read()

match = re.search(r'v3\.(\d+)\.(\d+)', ver_txt)
minor, patch = int(match.group(1)), int(match.group(2))
today = datetime.date.today().isoformat()
new_ver = f'v3.{minor}.{patch + 1} · {today}'
new_ver_txt = f'{new_ver}\nDeployed: {today} {datetime.datetime.now().strftime("%H:%M")}\n'
portal = re.sub(r'v3\.\d+\.\d+ · \d{4}-\d{2}-\d{2}', new_ver, portal)

for path, content in [
    ('docs/portal.html',          portal),
    ('source/portal.html',        portal),
    ('source/portal_version.txt', new_ver_txt),
]:
    safe = path.replace('/','_')
    with open(f'/tmp/deploy_{safe}.json', 'w') as f:
        json.dump({'pin':'7797','path':path,'content':content,
                   'message':f'Portal {new_ver}'}, f)
print(f'Payloads ready: {new_ver}')
```
```bash
for f in /tmp/deploy_docs_portal.html.json \
          /tmp/deploy_source_portal.html.json \
          /tmp/deploy_source_portal_version.txt.json; do
  curl -s -X POST "https://birdiefriends-push.birdiefriends01.workers.dev/deploy" \
    -H "Content-Type: application/json" \
    -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" \
    --data-binary @$f --max-time 60
  echo ""
done
```

**GolfScorer (source/BF_Golf_Scorer_8.html):**
Bump the version suffix (a→b→…) manually in the file content before pushing.
```bash
python3 -c "
import json
with open('/home/claude/BF_Golf_Scorer_8.html') as f:
    content = f.read()
payload = {'pin':'7797','path':'source/BF_Golf_Scorer_8.html',
           'content':content,'message':'GolfScorer v8.17·DATE — description'}
with open('/tmp/gs_payload.json','w') as f:
    json.dump(payload, f)
print(len(content), 'bytes')
"
curl -s -X POST "https://birdiefriends-push.birdiefriends01.workers.dev/deploy" \
  -H "Content-Type: application/json" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" \
  --data-binary @/tmp/gs_payload.json --max-time 60
```

**Worker (source/worker.js) — always two steps:**
```bash
# Step 1: push library source (Claude)
python3 -c "
import json
with open('/home/claude/worker.js') as f:
    content = f.read()
payload = {'pin':'7797','path':'source/worker.js',
           'content':content,'message':'Worker DATE — description'}
with open('/tmp/worker_payload.json','w') as f:
    json.dump(payload, f)
"
curl -s -X POST "https://birdiefriends-push.birdiefriends01.workers.dev/deploy" \
  -H "Content-Type: application/json" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" \
  --data-binary @/tmp/worker_payload.json --max-time 30
# Step 2: user pastes worker.js into Cloudflare → Save and Deploy
```

**Single-file library docs (ops guide, session starter, bizplan docs):**
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

### Not done this session
- **GS atomicity** (`grpPublish Final` should write `results.html` directly) — carried
  forward from Session 36, still untouched. First task next dev session if nothing more urgent.
- **BF_BizPlan_Bootstrap.md** not yet built — first task for next dedicated bizplan session.

---

## Session BP-1 / Chat#39 Accomplishments — 2026-06-18

### Business Plan — Library bootstrapped (source/bizplan/)
- Created `source/bizplan/` subfolder as permanent home for business plan docs
- Deployed all 4 BP-1 output documents: BF_BizPlan_Vision.md, BF_BizPlan_GateLog.md,
  BF_BizPlan_Session_Log.md, BF_Capability_Inventory.md
- BF_BizPlan_Bootstrap.md not yet built — flagged as first task for next bizplan session

### deploy.html — Three fixes shipped
1. Stale WORKER_URL corrected to birdiefriends-push.birdiefriends01.workers.dev
2. Literal \n sequences in Claude tab fixed (24 backslash-n artifacts from prior session)
3. Business Plan section added to Library tab; generalized renderDirList() function

### Worker — /history and /rollback added, source synced
- /history endpoint: GET /history?file=<key>&n=<count>
- /rollback endpoint: POST /rollback { pin, file, sha }
- Worker pasted into Cloudflare by user — confirmed deployed
- Note: /deploy route was documented as present but was missing from source/worker.js —
  confirmed and fixed in Session 40.

---

## Session 38 Accomplishments — Credential Handling + Worker /deploy Route (2026-06-18)

### Credential handling rule established
Claude had been executing bf_deploy.py's TOKEN-authenticated functions directly. A
parallel bizplan session correctly declined to do so. The rule was clarified and applied
consistently going forward: Claude does not hold or use embedded API tokens to take
actions, regardless of user authorization. bf_deploy.py may be read for reference only.

### Worker /deploy route added
- PIN-gated POST /deploy route added to worker.js
- Takes { pin, path, content, message }, path restricted to source/ at the time
- GH_TOKEN stored as Cloudflare secret — token never passes through chat
- Verified end-to-end against a test file

### Network egress note (re-confirmed Session 40)
birdiefriends-push.birdiefriends01.workers.dev must be in the Claude sandbox network
egress allowlist before the session starts — adding mid-session does not apply
retroactively. Confirmed working in Session 40.

---

## Session 37 Accomplishments — Groupings History Fix + Safety/Workflow (2026-06-17/18)

*(Full details in Ops Guide §12 Session History)*

- **Groupings archive rebuilt** (root cause: grpPublish had no connection to series data)
- **Two further bugs in generateResultsPage()** — onclick non-existent function + duplicate panel
- **New Event safety guard** — hard-blocks on unsaved scored round, requires DISCARD
- **View Saved Event (Tab 5)** — read-only selector for any saved event
- **End of Event** — one tracked action for Save → Sheets → Publish
- **Launcher hardened** — loud port-conflict failure, visible server window
- **My Game → My Series naming pass**

---

## Reference

### Versions
| Component | Version | Status |
|-----------|---------|--------|
| Portal | v3.10.139 · 2026-06-16 | Production ✅ |
| GolfScorer | v8.17 · 2026-06-17g | Deployed ✅ |
| Worker | 2026-06-18b | Deployed ✅ — /deploy accepts source/ and docs/ |
| deploy.html | 2026-06-18 | Live ✅ — all tabs functional |
| bf_deploy.py | 2026-06-18 | Library reference only — not executed by Claude |
| bf_architecture.html | 2026-06-12 | Library ✅ — PIN 913317 |
| launch_golf_scorer.py | 2026-06-17 | Current ✅ — laptop-only |
| Launch_Golf_Scorer.bat | 2026-06-17 | Current ✅ |
| guide.html | 2026-06-17 | Live ✅ |

### Worker Endpoints
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/` | None | Send push notification |
| GET | `/flags` | None | Read all KV flags |
| POST | `/flags` | PIN 7797 | Write flag to KV |
| GET | `/subscriptions` | None | Fetch OneSignal subscribers |
| GET | `/notifications` | None | Fetch notification history |
| DELETE | `/subscription/:id` | None | Delete one push subscription |
| DELETE | `/notifications/clear` | PIN 7797 | Cancel scheduled notifications |
| GET | `/history?file=X&n=20` | None | Last N commits for a managed file |
| POST | `/deploy` | PIN 7797 | Push file to GitHub — source/ or docs/ paths, no size limit |
| POST | `/rollback` | PIN 7797 | Restore file to a prior commit SHA |
| GET | `/feed` | None | Worker KV announcement feed |
| DELETE | `/feed` | PIN 7797 | Clear KV feed entries |

### KV Flags
| Key | Type | Purpose |
|-----|------|---------|
| maintenance | bool | Portal offline for all |
| live_test | bool | Force live banner (dev only) |
| live_override | bool | Commissioner manual event start |
| live_override_since | ISO string | Timestamp of manual start |
| feed::{timestamp} | JSON | KV feed entries (title, body, sentAt, type) |

### Jotform Form IDs
| Form | ID |
|------|-----|
| Event Registration | 233103072261037 |
| Event Request | 233113019726045 |
| Membership | 233083522910045 |
| Series Scorecard | 250963587514163 |
| Closest to the Pin | 251002357493048 |

### Known Issues Carried Forward
- **GS atomicity** (`grpPublish Final` → write `results.html` directly) — flagged Session 36, still untouched
- standings.html Groups tab is dead (broken onclick, zero supporting JS/content panel)
- guide.html doesn't document the portal-native My Game bottom-nav button
- OneSignal delete of delivered messages — not possible via API; KV Feed is the fix
- GS state persistence not implemented — re-fetch from Jotform required after restart
- TEST_PREVIEW_MODE must be False on event day
- BL-17: Two Series events same day → only first gets live banner
- Active/Inactive auto-reset: Jeremy Burkett + Tony Hager
- Push delivery sporadic on course — device-side (Focus Mode / Safari vs PWA icon)
- Retire "Load from Profiles" / Quick HCP panel — stale parallel HCP source, pending confirmation
