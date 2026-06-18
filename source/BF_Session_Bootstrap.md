# BirdieFriends Session Bootstrap

## To start any session (Chat #30+), paste this single command into Claude:

```
Fetch https://raw.githubusercontent.com/birdiefriends/birdiefriends.github.io/main/source/BF_Session_Bootstrap.md and follow all instructions in it exactly.
```

---

## Claude — execute these steps automatically, in order, before anything else:

> ⚠️ **FETCH METHOD — MANDATORY:** Use `bash_tool` with `curl` for ALL file fetches below.
> Do NOT use the `web_fetch` tool for raw GitHub URLs — it requires a prior search result and will block the bootstrap. All six files must be fetched in a single `bash_tool` call.

> ⚠️ **DEPLOY METHOD — CHANGED (Session 38, 2026-06-18):** Do NOT import `bf_deploy.py` and call `deploy_file()` / `deploy()` to author commits — its embedded `TOKEN` is a live GitHub credential, and Claude should never hold or use API keys/tokens directly, regardless of how thoroughly the user authorizes it. `bf_deploy.py` may still be fetched and read for reference (e.g. the GS version-bump regex) but must never be executed against the live token.
>
> **New mechanism — single-file pushes** (docs, `worker.js` mirror, session starter, ops guide, business plan files, etc.): POST to the Worker's `/deploy` route. PIN and content only — no token ever passes through chat.
> ```bash
> curl -s -X POST "https://birdiefriends-push.birdiefriends01.workers.dev/deploy" \
>   -H "Content-Type: application/json" \
>   -d '{"pin":"7797","path":"source/<file>","content":"<file contents>","message":"<commit message>"}'
> ```
> Path must start with `source/` (enforced server-side, defense-in-depth). Creates new files or updates existing ones — the 404-on-missing-sha case is handled. The actual GitHub token lives only in the Worker's Cloudflare secret `GH_TOKEN` (set 2026-06-18) and is never visible to Claude.
>
> **Requires:** `birdiefriends-push.birdiefriends01.workers.dev` must already be in this session's network egress allowlist (Settings → Capabilities → Code execution and file creation → Allow network egress → Additional allowed domains) *before the session starts* — adding it mid-session does not apply retroactively. If a call to this host 403s with `host_not_allowed`, that's the cause; it needs a fresh session, not a retry.
>
> **Known gap, not yet covered by `/deploy`:** the atomic `portal.html` + `portal_version.txt` push, and the auto GolfScorer-version-bump logic, currently only exist in `bf_deploy.py`'s `deploy()` / `deploy_file()` — which Claude can no longer execute. Until that logic is ported into the Worker route, **portal and GolfScorer deploys have no settled Claude-safe mechanism yet.** Don't fall back to the old token path to fill this gap — surface it to the user and decide together before pushing either file.

**Run this exact bash block first:**

```bash
BASE="https://raw.githubusercontent.com/birdiefriends/birdiefriends.github.io/main"
curl -s "$BASE/source/BF_Golf_Scorer_Session_Starter_current.md" -o /home/claude/BF_Golf_Scorer_Session_Starter_current.md && echo "Session Starter: OK"
curl -s "$BASE/source/BF_Operations_Guide.md"                    -o /home/claude/BF_Operations_Guide.md && echo "Ops Guide: OK"
curl -s "$BASE/source/portal_version.txt"                        -o /home/claude/portal_version.txt && echo "Version: $(cat /home/claude/portal_version.txt)"
curl -s "$BASE/docs/portal.html"                                 -o /home/claude/birdiefriends_portal.html && echo "Portal: OK"
curl -s "$BASE/source/worker.js"                                 -o /home/claude/worker.js && echo "Worker: OK"
curl -s "$BASE/source/bf_deploy.py"                              -o /home/claude/bf_deploy.py && echo "Deploy: OK"
echo "--- Sizes ---"
ls -lh /home/claude/BF_Golf_Scorer_Session_Starter_current.md /home/claude/BF_Operations_Guide.md /home/claude/portal_version.txt /home/claude/birdiefriends_portal.html /home/claude/worker.js /home/claude/bf_deploy.py
```

**Then:**
1. Read `BF_Golf_Scorer_Session_Starter_current.md` into context (view tool)
2. Read `BF_Operations_Guide.md` into context (view tool)
3. Report: session #, portal version, worker version, file sizes, **and confirm whether the `/deploy` Worker route is reachable** (a quick test push is fine, but check the deploy-method note above first if it 403s) — confirm fully loaded and ready

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
| Deploy script | `source/bf_deploy.py` |

---

## Uploads — secrets only (laptop only, never in GitHub)

| File | When needed |
|------|-------------|
| `deploy_portal.py` | Only if changing the bat deploy script |
| `launch_golf_scorer.py` | Only if changing the local GolfScorer launcher |

---

## Key URLs

| Resource | URL |
|----------|-----|
| Portal | https://birdiefriends.com/portal.html |
| Deploy panel | https://birdiefriends.com/deploy.html |
| Library (GitHub) | https://github.com/birdiefriends/birdiefriends.github.io/tree/main/source |
| Worker | https://birdiefriends-push.birdiefriends01.workers.dev |
