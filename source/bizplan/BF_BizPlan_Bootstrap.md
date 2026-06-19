# BirdieFriends Business Plan — Session Bootstrap

## To start any bizplan session, paste this single command into Claude:

```
Fetch https://raw.githubusercontent.com/birdiefriends/birdiefriends.github.io/main/source/BF_BizPlan_Bootstrap.md and follow all instructions in it exactly.
```

---

## Claude — execute these steps automatically, in order, before anything else:

> ⚠️ **FETCH METHOD — MANDATORY:** Use `bash_tool` with `curl` for ALL file fetches below.
> Do NOT use the `web_fetch` tool for raw GitHub URLs — it requires a prior search result and will block the bootstrap. All four files must be fetched in a single `bash_tool` call.

> ⚠️ **DEPLOY METHOD:** All bizplan doc pushes go through the Worker's `/deploy` route — PIN and content only, no token ever passes through chat. Claude does not import or execute `bf_deploy.py`'s TOKEN-authenticated functions; that file is reference-only.
> ```bash
> curl -s -X POST "https://birdiefriends-push.birdiefriends01.workers.dev/deploy" \
>   -H "Content-Type: application/json" \
>   -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" \
>   --data-binary @/tmp/payload.json
> ```
> Path must start with `source/bizplan/<filename>`. For files written via `python3 -c`, build the JSON payload to a temp file first and use `--data-binary @file` rather than passing content inline to `-d` — avoids shell argument-length failures on longer docs.
>
> **Requires:** `birdiefriends-push.birdiefriends01.workers.dev` must already be in this session's network egress allowlist (Settings → Capabilities → Code execution and file creation → Allow network egress → Additional allowed domains) *before the session starts* — adding it mid-session does not apply retroactively. If a call to this host 403s with `host_not_allowed`, that's the cause; it needs a fresh session, not a retry.

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
3. Read `BF_BizPlan_Session_Log.md` into context (view tool)
4. Read `BF_Capability_Inventory.md` into context (view tool)
5. Report: session #, last session's gate status, file sizes, and confirm whether the `/deploy` Worker route is reachable (a quick test push is fine) — confirm fully loaded and ready

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
