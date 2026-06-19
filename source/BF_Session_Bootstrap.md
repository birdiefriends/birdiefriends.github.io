# BirdieFriends Session Bootstrap

## To start any session (Chat #30+), paste this single command into Claude:

```
Fetch https://raw.githubusercontent.com/birdiefriends/birdiefriends.github.io/main/source/BF_Session_Bootstrap.md and follow all instructions in it exactly.
```

---

## Claude — execute these steps automatically, in order, before anything else:

> ⚠️ **FETCH METHOD — MANDATORY:** Use `bash_tool` with `curl` for ALL file fetches below.
> Do NOT use the `web_fetch` tool for raw GitHub URLs — it requires a prior search result and will block the bootstrap. All six files must be fetched in a single `bash_tool` call.

> ⚠️ **DEPLOY METHOD:** Do NOT import `bf_deploy.py` and call `deploy_file()` / `deploy()` to author commits — Claude should never hold or use API keys/tokens directly, regardless of how thoroughly the user authorizes it. `bf_deploy.py` is reference-only (e.g. the GS version-bump regex) and must never be executed.
>
> **All deploys go through the Worker's `/deploy` route** — PIN and content only, no token ever passes through chat. This covers every file in the system: portal (`docs/portal.html` + `source/portal.html` + `source/portal_version.txt`), GolfScorer, worker.js source, ops guide, session starter, business plan docs — no exceptions, no gaps. Confirmed via live testing (Session 40): no meaningful file size limit on Cloudflare's free tier (tested to 445KB).
> ```bash
> curl -s -X POST "https://birdiefriends-push.birdiefriends01.workers.dev/deploy" \
>   -H "Content-Type: application/json" \
>   -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" \
>   --data-binary @/tmp/payload.json
> ```
> Path must start with `source/` or `docs/` (enforced server-side). For files written via `python3 -c`, build the JSON payload to a temp file first and use `--data-binary @file` rather than passing content inline to `-d` — avoids shell argument-length failures on larger files like portal.html. The actual GitHub token lives only in the Worker's Cloudflare secret `GH_TOKEN` and is never visible to Claude. Worker code changes additionally require a manual paste into the Cloudflare dashboard after the `/deploy` push — see Ops Guide §3.
>
> **Requires:** `birdiefriends-push.birdiefriends01.workers.dev` must already be in this session's network egress allowlist (Settings → Capabilities → Code execution and file creation → Allow network egress → Additional allowed domains) *before the session starts* — adding it mid-session does not apply retroactively. If a call to this host 403s with `host_not_allowed`, that's the cause; it needs a fresh session, not a retry.

**Run this exact bash block first:**

```bash
BASE="https://raw.githubusercontent.com/birdiefriends/birdiefriends.github.io/main"
curl -s "$BASE/source/BF_Golf_Scorer_Session_Starter_current.md" -o /home/claude/BF_Golf_Scorer_Session_Starter_current.md && echo "Session Starter: OK"
curl -s "$BASE/source/BF_Operations_Guide.md"                    -o /home/claude/BF_Operations_Guide.md && echo "Ops Guide: OK"
curl -s "$BASE/source/portal_version.txt"                        -o /home/claude/portal_version.txt && echo "Version: $(cat /home/claude/portal_version.txt)"
curl -s "$BASE/docs/portal.html"                                 -o /home/claude/birdiefriends_portal.html && echo "Portal: OK"
curl -s "$BASE/source/worker.js"                                 -o /home/claude/worker.js && echo "Worker: OK"
curl -s "$BASE/source/bf_deploy.py"                              -o /home/claude/bf_deploy.py && echo "Deploy (reference only): OK"
echo "--- Sizes ---"
ls -lh /home/claude/BF_Golf_Scorer_Session_Starter_current.md /home/claude/BF_Operations_Guide.md /home/claude/portal_version.txt /home/claude/birdiefriends_portal.html /home/claude/worker.js /home/claude/bf_deploy.py
```

**Then:**
1. Read `BF_Golf_Scorer_Session_Starter_current.md` into context (view tool)
2. Read `BF_Operations_Guide.md` into context (view tool)
3. Report: session #, portal version, worker version, file sizes, and confirm whether the `/deploy` Worker route is reachable (a quick test push is fine) — confirm fully loaded and ready

**All files are in the library. No uploads needed to start a session.**

---

## Library base URL
```
https://raw.githubusercontent.com/birdiefriends/birdiefriends.github.io/main/
```

| File | Library path |
|------|-------------|
| Session Starter | `source/BF_Golf_Scorer_Session_Starter_current.md` |
| Ops Guide | `source/BF_Operations_Guide.md` |
| Portal version | `source/portal_version.txt` |
| Portal HTML | `docs/portal.html` |
| Worker | `source/worker.js` |
| Deploy script | `source/bf_deploy.py` (reference only — not executed) |

---

## Uploads — secrets only (laptop only, never in GitHub)

| File | When needed |
|------|-------------|
| `launch_golf_scorer.py` | Only if changing the local GolfScorer launcher |

`deploy_portal.py` was retired in Session 40 — portal deploys go through the Worker `/deploy` route instead. No longer needed on the laptop.

---

## Related — Business Plan sessions

Business plan sessions use a separate bootstrap and don't need this file's six dev
assets. Start a bizplan session with:
```
Fetch https://raw.githubusercontent.com/birdiefriends/birdiefriends.github.io/main/source/bizplan/BF_BizPlan_Bootstrap.md and follow all instructions in it exactly.
```

---

## Key URLs

| Resource | URL |
|----------|-----|
| Portal | https://birdiefriends.com/portal.html |
| Deploy panel | https://birdiefriends.com/deploy.html |
| Library (GitHub) | https://github.com/birdiefriends/birdiefriends.github.io/tree/main/source |
| Worker | https://birdiefriends-push.birdiefriends01.workers.dev |
