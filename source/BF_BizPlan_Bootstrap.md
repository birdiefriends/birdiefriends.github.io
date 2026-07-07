# BirdieFriends Business Plan — Session Bootstrap

## To start any bizplan session, paste this single command into Claude:

```
Fetch https://raw.githubusercontent.com/birdiefriends/birdiefriends.github.io/main/source/BF_BizPlan_Bootstrap.md and follow all instructions in it exactly.
```

---

## Claude — execute these steps automatically, in order, before anything else:

**Fetch method:** Use `bash_tool` with `curl` for the four library file fetches below (raw GitHub URLs aren't reachable via `web_fetch` without a prior search result).

**Deploy route — full request contract (tested and confirmed working, Dev-56):**

Bizplan doc pushes go through the Worker's `/deploy` route. This is the exact,
complete contract — nothing else is needed to push a file.

```
POST https://birdiefriends-push.birdiefriends01.workers.dev/deploy
Content-Type: application/json
User-Agent: <any browser-style string — see gotcha below, this is NOT optional>

{
  "pin": "7797",
  "path": "source/bizplan/BF_BizPlan_Session_Log.md",
  "content": "<full file content as a plain string, not base64>",
  "message": "<git commit message>"
}
```

- **`path`** must start with `source/` or `docs/` — for bizplan files this is always
  `source/bizplan/<filename>`.
- **`content`** is the complete new file content (not a diff/patch) — this always
  overwrites the whole file.
- Response on success: `{"ok": true, "commitSha": "<sha>"}`. On failure: an error
  body with a `message` field — read it, don't just retry blindly.

**⚠ Critical gotcha — Cloudflare WAF blocks the request without a browser User-Agent.**
Python's `urllib` default User-Agent (and likely other bare HTTP clients) gets a
`403` with `error code: 1010` from Cloudflare — this is a WAF rule on the Worker
route itself, not a bug in the route or an auth failure. Always set an explicit
browser-style `User-Agent` header, e.g.:
```
Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36
```
`curl` sets its own default UA that also gets blocked — pass `-A` explicitly there
too, or use `-H "User-Agent: ..."`.

**Minimal working example (bash_tool, Python via urllib):**
```python
import json, urllib.request

payload = json.dumps({
    "pin": "7797",
    "path": "source/bizplan/BF_BizPlan_Session_Log.md",
    "content": open("/home/claude/BF_BizPlan_Session_Log.md").read(),
    "message": "BP-N session log entry"
}).encode("utf-8")

req = urllib.request.Request(
    "https://birdiefriends-push.birdiefriends01.workers.dev/deploy",
    data=payload,
    headers={
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    },
    method="POST",
)
with urllib.request.urlopen(req) as r:
    print(json.loads(r.read()))
```

Not used during session start — only a reachability check happens then (see step 5).
Brian provides explicit go-ahead in chat before any actual write.

**Run this exact bash block first:**

```bash
BASE="https://raw.githubusercontent.com/birdiefriends/birdiefriends.github.io/main/source/bizplan"
curl -s "$BASE/BF_BizPlan_Vision.md"          -o /home/claude/BF_BizPlan_Vision.md          && echo "Vision: OK"
curl -s "$BASE/BF_BizPlan_GateLog.md"         -o /home/claude/BF_BizPlan_GateLog.md         && echo "GateLog: OK"
curl -s "$BASE/BF_BizPlan_Session_Log.md"     -o /home/claude/BF_BizPlan_Session_Log.md     && echo "Session Log: OK"
curl -s "$BASE/BF_Capability_Inventory.md"    -o /home/claude/BF_Capability_Inventory.md    && echo "Capability Inventory: OK"
echo "--- Sizes ---"
ls -lh /home/claude/BF_BizPlan_Vision.md /home/claude/BF_BizPlan_GateLog.md /home/claude/BF_BizPlan_Session_Log.md /home/claude/BF_Capability_Inventory.md
```

**Then:**
1. Read `BF_BizPlan_Vision.md` into context (view tool)
2. Read `BF_BizPlan_GateLog.md` into context (view tool)
3. Read `BF_BizPlan_Session_Log.md` into context (view tool) — sole source of truth for
   the current BZP session number (last entry's `BP-N` + 1)
4. Read `BF_Capability_Inventory.md` into context (view tool)
5. Confirm the `/deploy` route is reachable with a harmless request only (e.g. a bare
   GET, which should return 405 since the route is POST-only) — do not send a test
   write/POST during session start. A write only happens later in the session, and
   only on Brian's explicit instruction given directly in chat.
6. Report: session #, last session's gate status, file sizes, deploy-route
   reachability, and the exact chat-rename string (e.g. `BZP#3 - <topic>`, topic
   filled in once the session's focus is clear).

**At session close:** append a new entry to `BF_BizPlan_Session_Log.md` and push it via
`/deploy` — only after Brian confirms in chat he wants it pushed. This keeps the
session counter authoritative without making any file in the repo a source of
standing write authorization.

**All files are in the library. No uploads needed to start a session.**

---

## Library base URL
```
https://raw.githubusercontent.com/birdiefriends/birdiefriends.github.io/main/source/bizplan/
```

| File | Library path | Purpose |
|------|--------------|---------|
| Vision | `source/bizplan/BF_BizPlan_Vision.md` | Positioning, fee model, Ambassador network, BF Rewards |
| Gate Log | `source/bizplan/BF_BizPlan_GateLog.md` | Decision gates — what's confirmed vs. still open |
| Session Log | `source/bizplan/BF_BizPlan_Session_Log.md` | Running history of bizplan sessions |
| Capability Inventory | `source/bizplan/BF_Capability_Inventory.md` | What the platform can already do, mapped to commercial claims |

---

## Relationship to dev sessions

Bizplan sessions are a separate track from dev sessions and use a separate bootstrap
(`source/BF_Session_Bootstrap.md` for dev). The two tracks share the same GitHub repo
and Worker, but bizplan sessions do not need the portal, GolfScorer, or worker.js source —
only the four files above. If a bizplan session needs to reference current platform
capability in detail, fetch `BF_Operations_Guide.md` (`source/BF_Operations_Guide.md`)
read-only, in addition to the four bizplan files.

---

## Key URLs

| Resource | URL |
|----------|-----|
| Portal | https://birdiefriends.com/portal.html |
| Deploy panel | https://birdiefriends.com/deploy.html |
| Library (GitHub) | https://github.com/birdiefriends/birdiefriends.github.io/tree/main/source/bizplan |
| Worker | https://birdiefriends-push.birdiefriends01.workers.dev |
