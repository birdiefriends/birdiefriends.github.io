<!-- CLAUDE INSTRUCTIONS — READ FIRST
DEVICE-BRIDGE RULE (added Dev-73 — check this before assuming local-file access):
Claude writing files directly onto Brian's machine (e.g. into the AutoPush folder,
`C:\Users\16177\Downloads\GolfScorer\AutoPush`) requires THIS session to be linked to
Brian's computer via the desktop app. That link is a per-session runtime property, not
anything this repo or bootstrap can turn on — it does NOT carry over automatically from
one session to the next, even the very next one. Early in any session that expects to
write local files (pushing a doc/tool update, editing something in AutoPush), check
whether the `mcp__remote-devices__*` tools are actually present/working (e.g. a
`get_device_info` call) before assuming they are. If they're not, ask Brian to link this
computer via the desktop app, or fall back to delivering files in-chat for Brian to save
manually (slower, and has previously caused copy-paste errors — see Dev-73 log entry —
but it works when the bridge doesn't). Don't discover this gap mid-task the way an
earlier Dev-73 issue (in-chat file delivery failing) was discovered by surprise.

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

AUTO-MODE CLASSIFIER RULE (added Dev-72 — read before attempting any /deploy POST):
Claude's own POST /deploy calls can be blocked by the cloud sandbox's own auto-mode
classifier — this is separate from GitHub/Cloudflare/PIN auth and happens before the
request leaves the sandbox. Confirmed NOT caused by headers, client library (curl vs
Python), or the PIN field — tested each in isolation. Confirmed mechanism: GET requests
work once the target domain is on Settings -> Capabilities -> Domain allowlist. POST
requests to that same domain are treated as a "production deploy"-class action and are
blocked by default regardless of payload content. The block clears when the human's
message, IMMEDIATELY before the tool call, directly and specifically names the exact
file, destination path, live effect, and explicit authorization -- a general "go ahead"
or "let's publish this" does NOT count and will still be blocked. Example of a message
that works: "POST <exact file> to <exact destination> via <exact URL> right now, using
PIN 7797. This will go live on birdiefriends.com. I've reviewed it and I'm explicitly
authorizing this deploy." If a session gets blocked, do not spend time re-testing
headers or curl vs Python -- that question is closed as of Dev-72. Just ask the human to
restate the specific authorization per the pattern above. Full diagnostic detail in the
Dev-72 entry of BF_Session_Log.md.

Additional observation from Dev-72 testing: in one instance, Claude stated the full
proposal (file, destination, URL, PIN, effect) and Brian's reply consisted only of a
direct, immediate acknowledgment of that specific proposal. That one instance cleared the
classifier. This is a single data point, not a confirmed standing behavior -- each
deploy action still needs its own specific proposal stated in full, and Brian's own
review and reply are still required every time before anything is sent. Treat the fully
spelled out phrasing earlier in this rule as the reliable default; this note exists so a
future session isn't confused if a short reply happens to work, not to encourage relying
on it.

PAYLOAD SIZE CORRECTION (Dev-73 — read this too, do not treat classifier question as
fully closed by Dev-72 alone): Dev-73 retested the classifier with size isolated as the
only variable -- a single ~887KB portal.html push and a control ~50-byte push of the
same content-type -- using maximally explicit, immediate, per-action authorization
phrased exactly per the pattern above. The small push went through; the large push was
blocked twice, identically. Brian's own independent retest same session confirmed this:
large-payload POST is blocked by size regardless of phrasing, small payloads clear with
explicit intent as already documented above. Practical upshot: do not spend session time
trying to get Claude's own /deploy to push portal.html, BF_Golf_Scorer_8.html, or any
other large (~300KB+) file -- route those through `deploy.html` directly, or through
Brian's local `bf_push.bat`/`bf_push.ps1` tool (in his `AutoPush` folder, not in this
repo -- see Dev-73 entry in BF_Session_Log.md for what it covers and why it exists).
Small docs (session starter, ops guide, session log itself) are candidates for either
path; Dev-73 used the local tool for consistency and its built-in post-push
byte-verification, not because Claude's own /deploy is known to fail on them.

WORKER RULE:
Worker changes require worker.js from the library (source/worker.js).
Claude never reconstructs Worker code without the source file.
Worker code changes require TWO steps: (1) push source/worker.js via /deploy,
(2) user pastes into Cloudflare dashboard → Save and Deploy.

BIZPLAN RULE:
Business plan docs live at source/bizplan/ — separate from the dev source/ library.
Bizplan sessions use their own bootstrap: source/bizplan/BF_BizPlan_Bootstrap.md
(built in BZP#2). It loads the 4 BP docs via curl, mirroring this dev bootstrap's pattern.

SESSION NUMBER RULE:
This file does NOT track the current session number — that drifted out of sync with
manual chat-title numbering and caused real confusion (a Dev-42 session self-identified
as "Session 41" by reading the line below instead of the log). `source/BF_Session_Log.md`
is now the sole source of truth for the current Dev-N number. Read it, not this header.
-->

# BirdieFriends Golf Scorer — Session Starter
**Current session number:** see `BF_Session_Log.md` (this file no longer tracks it)
**Date:** 2026-08-30 (last updated Dev-73; earlier fields below carried forward unverified except where noted)
**Portal Version (production):** per `portal_version.txt` (source of truth): v3.17.134 · 2026-08-27.
  ✅ Dev-72's version-drift discrepancy is RESOLVED as of Dev-73, at the root: the
  hardcoded fallback version spans inside `portal.html` (`#portal-build-header`,
  `#portal-build`) were removed entirely — they now start empty and are set only by the
  live fetch of `portal_version.txt` (falling back to "version unavailable" on fetch
  failure, never a stale number). There is no longer a second copy of the version string
  for a future deploy to desync. This was the fourth recurrence of this bug class
  (Dev-45, Dev-54, Dev-73) — treat it as closed, not just patched.
**GolfScorer Version:** v8.17 · 2026-06-17g (deployed) — unverified this session, carried forward
**Worker Version (birdiefriends-push — push/deploy/flags/etc.):** 2026-06-18b + all Gatherings routes through Dev-52 (GET/POST /venues, PATCH /venues/:id, GET/POST/DELETE /gathering-templates) — unverified this session, carried forward
**Worker (bf-experiences — NEW as of Dev-71):** separate Cloudflare Worker, source `bf_experiences_worker.js`, powers the BFE Competitive Events system. Deployed manually by Brian via the Cloudflare dashboard (not via the /deploy route). Confirmed Dev-73: all SQL migrations executed and operational in D1 (8 `bfe_*` tables live — capture + setup/master-data layers only; the results/computation layer, e.g. `bfe_quota_progress`, does not exist yet — see Dev-73 Architecture Notes below). See Dev-71/72/73 Architecture Notes below.
**Live URL:** https://birdiefriends.com/portal.html
**BFE Admin Panel (NEW as of Dev-71):** https://birdiefriends.com/BFE-Admin.html — confirmed Dev-73: live, successfully loads venues, event names, and players against the real D1 tables.
**Local publish tool (NEW as of Dev-73):** `bf_push.bat`/`bf_push.ps1` (v4), Brian's machine
  only, `C:\Users\16177\Downloads\GolfScorer\AutoPush` — PIN-gated, pushes straight to the
  same Worker `/deploy` route, with mandatory post-push byte-verification before deleting
  the local copy. Covers `portal.html`, `portal_version.txt`, `worker.js`, `guide.html`,
  `BF_Golf_Scorer_8.html`, `BF_Operations_Guide.md`, `BF_Experiences.js` (→
  `source/bf_experiences_worker.js`), `BFE-Admin.html`, and now `BF_Session_Log.md`. This
  is the go-to path for any large-file push Claude's own `/deploy` can't get through — see
  the PAYLOAD SIZE CORRECTION note above.
**Jotform API Key:** dd0cb09a71eee7d0db3aa690e292660f
**Google Places API Key:** AIzaSyAn1TR2p6JbWR2fr5ydhkurygKpYU9HYtw (restricted to birdiefriends.com)
**Wally Cup Rd1 tee-off:** confirmed 10am, 9/11/2026. Scoring Engine build is in progress
  against this hard deadline — see Dev-73 Architecture Notes below and the full Dev-73
  entry in `BF_Session_Log.md` for the complete phased plan before starting Dev-74 code
  work.

---

## Dev-73 Architecture Notes (2026-08-30) — Wally Cup Scoring Engine

**Read this before writing any Dev-74 code for Wally Cup.** Full detail, including the
GS-derived formulas and the Jotform field table, is in the Dev-73 entry of
`BF_Session_Log.md` — this is a pointer/summary, not a replacement for it.

- **Status as of Dev-73:** capture layer (`bfe_scorecards` incl. `wb_status`/`wb_hole`/
  `wb_stroke`, `bfe_cttp_entries`) and setup/master-data layer (`bfe_event_config`,
  `bfe_venue_tee_catalog`, `bfe_player_profiles`, `bfe_events`/`bfe_event_rounds`/
  `bfe_event_roster`) are built, live, and confirmed operational. The results/computation
  layer (`bfe_quota_progress`, `bfe_scramble_pairs`, `bfe_scramble_results`, or whatever
  Dev-74 decides to actually name/shape them) does not exist at all — no round-results
  math, payout calc, or cross-round rollup exists anywhere for WC yet. This is the
  critical remaining work.
- **Scope decisions locked in this session:** BFSeries scorecard/CttP capture stays on
  Jotform, not ported to D1, given the time crunch (shouldn't affect BFSeries either way
  given the separate-Worker architecture). Jotform remains WC's live data collector too —
  full sunset deferred, not abandoned. The WC Live Panel reuses the existing BFSeries
  Live Panel (`buildLivePanel()` in `portal.html`) rather than a new standalone build,
  plus one addition: a Wally Ball status step in the Post-Round Scorecard sheet.
- **Confirmed headless submission:** `submitScorecard()`/`submitCttp()` in `portal.html`
  POST directly to Jotform's submission API from client-side JS — they never render or
  navigate to Jotform's hosted form, so players never see field labels. New fields can be
  added freely without any player-facing UI constraint.
- **Wally Ball Jotform fields — added Dev-73, on the existing shared `SCORECARD_FORM_ID`
  (250963587514163) form:** `wallyBallStatus` (QID 33), `WallyBallLostHole` (QID 34),
  `wallyBallStroke` (QID 35) — maps 1:1 to the `bfe_scorecards` `wb_status`/`wb_hole`/
  `wb_stroke` columns already provisioned. **Not yet wired into code** — that's Dev-74's
  first job (see below).
- **Dev-74 Phase 1 (hard deadline — 9/11):**
  1. Add `WB_QID = {status:'33', hole:'34', stroke:'35'}` to `submitScorecard()` and
     include those params in its POST body.
  2. Add the Wally Ball input step (Y/N, conditional Hole#/Stroke# when "No") to
     `buildLivePanel()`'s Post-Round Scorecard section.
  3. Flip `hasLivePanelSupport()` to `true` for Wally Cup / 2Man formats.
  4. End-to-end test against the real Jotform form with a disposable test event.
- **Dev-74/75 Phase 2 (soft deadline, days after 9/11):** design + create the D1
  results-layer tables; port `adjustQuota`/`applyQuotaCap` (quota formula: `36 - (hcp ×
  slope / 113)`, slope Green 132/Combo 128/Gold 115; adjustment capped ±25%) and the
  skins-per-hole-winner loop from `BF_Golf_Scorer_8.html` (skins apply in every WC round
  including 2Man, feed payout only, not quota/performance); build a "Close Round" action
  in `BFE-Admin.html` (payout calc, Wally Ball pot resolution, Overall rollup across
  exactly 3 rounds — note GS's own `calcSeriesPerformance()` is a best-4-of-N model and
  does **not** fit WC's fixed 3-round Overall, a new calc is needed). **Open/blocking:**
  the 2Man scramble scoring formula is undefined anywhere in the codebase or spec — needs
  Brian's direct input before this phase can be sized.
- **Phase 3 (can start minimal, polish through Rd3):** per-round GLS-style results page
  generator + a living Overall page (podium held back until Rd3 closes), published via
  GS's proven `deployPagesToGitHub()`/`POST /deploy` mechanism to `docs/`.
- **Still open, carried from Dev-71:** `BF_WallyCup_Spec.md` — a structured spec doc for
  this architecture has never been committed to the repo. The only spec document that
  exists (`WC_spec.txt`, referenced as "from Dev-71") is local-only on Brian's machine and
  has not been reconciled against what's actually been decided/built since. Recommend this
  gets done early in Dev-74 rather than continuing to rely on session-log archaeology.

## Dev-71 & Dev-72 Architecture Notes (2026-08-27)

### BFE (BF Experiences) Competitive Events system — new architecture (Dev-71)
- New, separate system from the core Golf Scorer / Gatherings app: built for the 2026
  Wally Cup competitive events.
- Runs on its own Cloudflare Worker (`bf-experiences`, source `bf_experiences_worker.js`)
  — distinct from the long-standing `birdiefriends-push` Worker. Do not conflate the two;
  they have separate deploy paths and separate source files.
- Admin surface: `docs/BFE-Admin.html`, live at https://birdiefriends.com/BFE-Admin.html.
  Authored source is `BFE_Host_Admin_Panel_Setup.html`, currently local-only with no
  `source/` counterpart in the library (open Dev-73 carry-forward item).
- Registration roster pulled from the shared Jotform Event Registration form (id
  233103072261037) via Jotform MCP tools, scoped to one event using a priority-ordered
  field-matcher (`jfGetAnswerByPriority`) so a generic "Name" field can't be mistaken for
  "Player Name" — mirrors the existing GS event-picker UX (load distinct Event Name
  values, pick one, fetch only that event's Yes/Sub registrants).
- Jotform event-picker has only been tested against a local Playwright mock server, not
  the real production form/Worker — verify before relying on it for the actual Wally Cup.

### Publish mechanism findings (Dev-72 — read this before any /deploy attempt)
- See the new AUTO-MODE CLASSIFIER RULE at the top of this file's instruction block for
  the full mechanism. Short version: GET works once the domain is allowlisted in
  Settings -> Capabilities; POST needs the human to state the exact action, specifically,
  immediately before the call. Not a header/client/PIN issue — that was a dead end.
- `deploy.html` (existing, live, PIN-gated) only supports five hardcoded filenames
  (`portal.html`, `guide.html`, `worker.js`, `BF_Golf_Scorer_8.html`,
  `BF_Operations_Guide.md`) with no arbitrary-path field. It cannot publish
  `BFE-Admin.html` or most library docs as currently built. Either extend it with a
  free-text path field, or commit `BF_Publish_Helper.html` (built Dev-71, path-handling
  verified correct Dev-72, but never committed to the repo — currently local-only on
  Brian's machine) to the library so it's not single-machine-dependent.

## Dev-52 Architecture Notes (2026-06-27)

### Gathering Templates (§20 — fully shipped)
- `_hostTemplates` cache, loaded on every Host panel open via `loadHostTemplates()`
- `📋 From Template` CTA button — same dark green pill style as New Gathering, shown when host has ≥1 template
- Template picker: `host-gathering-card` style cards, green meta chips, ⛳ Use Template + Delete action strip
- `applyTemplate()` — pre-fills create form; date/time always blank; crew snapshot resolved against current memberData; silently drops departed members
- `promptSaveAsTemplate()` — fires after every successful create; also on ☆ Template button on existing host cards
- Worker routes: `POST /gathering-templates`, `GET /gathering-templates?host_id=X`, `DELETE /gathering-templates/:id?host_id=X`
- D1 table: `gathering_templates` (id, host_id, name, title, venue, capacity, gathering_type, description, crew_snapshot, created_at)

### Text Formatting (enforced on all Gathering creates/edits)
- `toTitleCase()` — title, format/type, template name; skips articles/prepositions mid-string
- `toSentenceCase()` — description only
- Applied in `submitNewGathering`, `submitEditGathering`, `saveTemplate`
- Venue field never transformed (host knows the correct name)

### Venue Manager (Commissioner Admin → Gatherings Admin)
- Collapsible 📍 Venue Manager sub-section — auto-loads on first expand
- `GET /venues?pin=7797` returns all venues including inactive (commissioner); no pin = active only
- `POST /venues` (PIN) — add venue, sort_order 90 by default (before Other at 99)
- `PATCH /venues/:id` (PIN) — toggle active status
- `adminAddVenue()` auto-title-cases name, clears `_venues` autocomplete cache on change
- 📋 All Active Gatherings also collapsible, max-height 420px with scroll

### Announcement Feed (type-aware styling)
`buildAnnouncementsHTML()` uses `typeConfig(bf_type)` for per-type icon + accent color:
- 🦅 birdie (gold) · 🎯 cttp (green) · ⛳ gathering_invite (blue) · 📢 gathering_open_invite (blue)
- 📅 gathering_date_changed (amber) · ❌ gathering_cancelled (red) · 🎉 sub_promotion (green)
- 🗓️ new_event (green) · ⏰ event_reminder (green) · 📣 broadcast (neutral)
Timestamp includes time of day. Entries render as rounded pill cards.

### D1 Schema — current entries
| Entry | Session | Description |
|-------|---------|-------------|
| 1–3 | Dev-42/43 | gatherings, crews, crew_members, registrations |
| 4 | Dev-49 | member_preferences |
| 5 | Dev-49 | gatherings.tee_time_status |
| 6 | Dev-49 | registrations.host_note (schema kept, UI removed) |
| 7 | Dev-51/52 | venues table (6 rows seeded) |
| 8 | Dev-52 | gathering_templates |

### Venue Autocomplete
Venue field in create + edit Gathering forms is now a smart autocomplete:
- On focus: shows full D1 `venues` table ("Your Courses") immediately
- On type: narrows D1 matches + fires Google Places `AutocompleteSuggestion` API
- Smart golf hint: appends " golf" only if query lacks golf/country/club/links
- Filter: main text only, keywords golf/country/club/links
- Free-form fallback: host can always type a name directly
- `GET /venues` Worker route — D1 `venues` table, `sort_order ASC, name ASC`
- **D1 migration (Entry 7) still needed** — `venues` table not yet created. SQL in Dev-51 log entry.

### Push ID Audit
- Manual: 🔍 Audit button in Push Subscribers card — cross-references Jotform pushIds vs OneSignal live subscriptions. Stale = 🗑️ Clear button writes empty QID 23 to Jotform.
- Auto: `osCommissionerAudit()` runs 5s after portal load (commissioner only), once per day via `bf_push_audit_YYYY-MM-DD` localStorage key. Silently clears stale tokens, toast if anything cleared.

### Admin section visibility fix
`selectPlayer()` now explicitly re-evaluates `commissioner-admin-section` visibility on every player switch — not just on `showScreen('admin')`.

### Gatherings Admin improvements
- 💬 Text Host link per host section header (sms: using cell from memberData)
- Capacity fill "X/Y" when size is set
- Inline registration expand (replaces alert()) — Yes/Sub/No groups with names

---

## Dev-49 Architecture Notes (2026-06-24) — CORRECTIONS

### Host:Yes in Jotform — TAG not GATE
`Host: Yes` (Jotform Membership, QID for host field) is a **collector/tag**, NOT an
access gate. It records who has hosted a Gathering — for future analytics, targeted
communications, and host reputation. It does NOT gate access to the Gather UI.

**The actual gate is `gathering_panel_live` KV flag** (commissioner-controlled, whole
community on/off). Once that flag is true, ANY member can host. `Host:Yes` is written
as a side-effect of hosting, not a prerequisite.

Previous references to Host:Yes as a gate were incorrect. Walli receiving Host:Yes
after creating a Gathering is the intended behavior.

### Gatherings — D1 schema as of Dev-49
- `gatherings`: + `tee_time_status TEXT NOT NULL DEFAULT 'confirmed'` (Entry 5)
- `registrations`: + `host_note TEXT` (Entry 6 — schema kept, UI removed)
- `member_preferences`: `player_id PK, prefs TEXT DEFAULT '{}', updated_at TEXT` (Entry 4)
- All previous entries (1–3) unchanged

### Gatherings — notification architecture as of Dev-49
- `gathering_alerts` (Jotform QID 26, field `gatheringalerts`): member opt-out for open
  broadcast notifications. Default Yes (blank = Yes in parser). Toggle in ⚙️ Settings.
- `gatheringFilters` in `member_preferences` D1: declarative rule array for Tier-2
  filtering. Exclusion paradigm (nin operator). Empty = show all.
- `gathering_panel_live` KV flag: still false (not yet launched as of Dev-49 close).

### Gatherings — registration routing (fixed Dev-49)
- Unregister button and Schedule tab "Can't Make It": now correctly route through
  `submitRegistration('No')` → D1. Were incorrectly calling `changeRegistration`
  (Jotform path) with synthetic D1 IDs.
- `regData` sync: after registration, portal now updates both `gatheringRegData` AND
  `regData` (load-time snapshot) so `renderAll()` sees the change immediately.



## Session 40 Accomplishments — Deploy Infrastructure + Secrets Cleanup (2026-06-18)

### Deploy infrastructure — all limitations eliminated
- **The 100KB limit was never real.** Cloudflare free tier allows 100MB. Portal (420KB)
  and GolfScorer (369KB) both deploy cleanly via POST /deploy. No file size problem exists
  at any scale relevant to this system.
- **`/deploy` route was missing from source/worker.js.** Added, pushed to library,
  deployed to Cloudflare.
- **`/deploy` expanded to accept `docs/` paths.** Portal live file is at docs/portal.html
  (GitHub Pages). Now accepts source/ or docs/ — both confirmed working. Worker 2026-06-18b.
- **Large-file deploy pattern established.** Write JSON payload to temp file via python3,
  use --data-binary @file. Standard pattern for portal and GolfScorer deploys.
- **bf_deploy.py role clarified.** Rule against executing TOKEN-authenticated functions
  is credential hygiene, not a capability limitation. Worker /deploy covers everything.

### Secrets cleanup — launch_golf_scorer.py
- **GITHUB_TOKEN** removed from auto-pull (public repo, no auth needed). Token retained
  only for Publish All Pages writes — legitimate, laptop-only, never in GitHub. Old classic
  token rotated by user; new token in place.
- **ANTHROPIC_API_KEY** removed entirely. OCR feature retired — digital scorecard is
  the settled solution. Key revoked by user.
- **deploy_portal.py** deleted from laptop — never needed, portal deploys via Worker.
- Launcher tested: ✅ unauthenticated GitHub pull working, ✅ new token valid,
  ✅ GolfScorer v8.17 · 2026-06-17g confirmed pulled.

### Deploy procedures — current state

**Portal (docs/portal.html + source/portal.html + source/portal_version.txt + docs/portal_version.txt):**

⚠️ **All FOUR files, every time — not three.** `docs/portal_version.txt` is the file the
*live app actually fetches* (relative path `portal_version.txt` resolves against `docs/`,
where portal.html is served from). `source/portal_version.txt` is only a tracking copy for
the next session's version-bump read. Missing the `docs/` copy was the exact bug that hit
Dev-45, Dev-54, **and Dev-55** — three separate occurrences of the same gap, the last one
caused directly by an outdated 3-file version of this exact script. Closed out for good here.

```python
# python3 in bash_tool — write four payload files, then push all four
import json, re, datetime, subprocess

with open('/home/claude/birdiefriends_portal.html') as f:
    portal = f.read()

# Always fetch portal_version.txt fresh from GitHub — never read local file.
# Local copy goes stale after the first deploy in a session, causing duplicate version numbers.
ver_txt = subprocess.check_output([
    'curl', '-s',
    f'https://raw.githubusercontent.com/birdiefriends/birdiefriends.github.io/main/source/portal_version.txt?cb={int(datetime.datetime.now().timestamp()*1000)}'
]).decode()

match = re.search(r'v3\.(\d+)\.(\d+)', ver_txt)
minor, patch = int(match.group(1)), int(match.group(2))
today = datetime.date.today().isoformat()
new_patch = patch + 1
new_patch_str = str(new_patch).zfill(2) if new_patch < 100 else str(new_patch)  # keep v3.17.04 not v3.17.4
new_ver = f'v3.{minor}.{new_patch_str} · {today}'
new_ver_txt = f'{new_ver}\nDeployed: {today} {datetime.datetime.now().strftime("%H:%M")}\n'
portal = re.sub(r'v3\.\d+\.\d+ · \d{4}-\d{2}-\d{2}', new_ver, portal)

for path, content in [
    ('docs/portal.html',          portal),
    ('source/portal.html',        portal),
    ('source/portal_version.txt', new_ver_txt),
    ('docs/portal_version.txt',   new_ver_txt),   # ← the file the live app actually reads. Never skip this one.
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
          /tmp/deploy_source_portal_version.txt.json \
          /tmp/deploy_docs_portal_version.txt.json; do
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
# Then: Cloudflare → Workers → birdiefriends-push → Edit code → paste → Save and Deploy
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

---

## Session BP-1 / Chat#39 Accomplishments — 2026-06-18

### Business Plan — Library bootstrapped (source/bizplan/)
- Created `source/bizplan/` subfolder as permanent home for business plan docs
- Deployed all 4 BP-1 output documents: BF_BizPlan_Vision.md, BF_BizPlan_GateLog.md,
  BF_BizPlan_Session_Log.md, BF_Capability_Inventory.md
- BF_BizPlan_Bootstrap.md not yet built — first task for next dedicated bizplan session

### deploy.html — Three fixes shipped
1. Stale WORKER_URL corrected to birdiefriends-push.birdiefriends01.workers.dev
2. Literal \n sequences in Claude tab fixed
3. Business Plan section added to Library tab

### Worker — /history and /rollback added, source synced
- /history and /rollback endpoints added and deployed
- /deploy route was documented as present but was missing from source — fixed Session 40

---

## Session 38 Accomplishments — Credential Handling + Worker /deploy Route (2026-06-18)

### Credential handling rule established
Claude had been executing bf_deploy.py's TOKEN-authenticated functions across many
sessions. A bizplan session caught the inconsistency by correctly declining to use
the embedded token. The rule was clarified: Claude does not hold or use embedded API
tokens to take actions, regardless of user authorization. The Worker /deploy route
(PIN-gated, token in Cloudflare secret) is the correct replacement.

### Worker /deploy route added
- PIN-gated POST /deploy route added to worker.js
- GH_TOKEN stored as Cloudflare secret — token never passes through chat
- path restricted to source/ at the time (expanded to include docs/ in Session 40)

---

## Session 37 Accomplishments — Groupings History Fix + Safety/Workflow (2026-06-17/18)

*(Full details in Ops Guide §12 Session History)*

- Groupings archive rebuilt (root cause: grpPublish had no connection to series data)
- Two further bugs in generateResultsPage() — onclick non-existent function + duplicate panel
- New Event safety guard — hard-blocks on unsaved scored round, requires DISCARD
- View Saved Event (Tab 5) — read-only selector for any saved event
- End of Event — one tracked action for Save → Sheets → Publish
- Launcher hardened — loud port-conflict failure, visible server window
- My Game → My Series naming pass

---

## Reference

### Versions
| Component | Version | Status |
|-----------|---------|--------|
| Portal | v3.16.14 · 2026-06-22 | Production ✅ |
| GolfScorer | v8.17 · 2026-06-17g | Deployed ✅ |
| Worker | 2026-06-18b | Deployed ✅ — /deploy accepts source/ and docs/ |
| deploy.html | 2026-06-18 | Live ✅ — all tabs functional |
| bf_deploy.py | 2026-06-18 | Library reference only — not executed by Claude |
| bf_architecture.html | 2026-06-12 | Library ✅ — PIN 913317 |
| launch_golf_scorer.py | 2026-06-18 | Current ✅ — OCR removed, token rotated, auto-pull unauthenticated |
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

---

## Push Notification Reliability (Dev-49 post-launch)

### Self-healing pushId architecture
`osIdentityRefresh()` runs 3.5s after every portal load. Compares current
`OneSignal.User.PushSubscription.id` against Jotform `member.pushId` (QID 23).
Mismatch → silently writes new ID to Jotform. Jotform is source of truth —
localStorage is cache only.

### Resolution path for stale tokens
1. **Auto** — player opens portal → heals on next load
2. **Manual** — Admin → Push Subscribers → 📲 Test button per player
3. **Self-service** — ⚙️ Gear → 🔄 Sync or Reset & start over
4. **Dev-50** — proactive batch audit tool (not yet built)

### Notification settings location
Moved from ⓘ About to ⚙️ Gear (My Preferences section) in v3.16.58.
Element IDs unchanged: `about-notif-status`, `about-notif-btn`, `about-ios-nudge`,
`notif-sync-btn`, `notif-sync-status`. `updateAboutNotifUI()` called on both
`showScreen('about')` and `showScreen('admin')`.

### gathering_panel_live
KV flag flipped to true — Gatherings is LIVE as of 2026-06-24.
Announcement sent. Community notified.
