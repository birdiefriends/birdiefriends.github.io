# BirdieFriends Session Bootstrap

## To start any session (Chat #30+), paste this single command into Claude:

```
Fetch https://raw.githubusercontent.com/birdiefriends/birdiefriends.github.io/main/source/BF_Session_Bootstrap.md and follow all instructions in it exactly.
```

---

## Claude — execute these steps automatically, in order, before anything else:

> ⚠️ **FETCH METHOD — MANDATORY:** Use `bash_tool` with `curl` for ALL file fetches below.
> Do NOT use the `web_fetch` tool for raw GitHub URLs — it requires a prior search result and will block the bootstrap. All six files must be fetched in a single `bash_tool` call.

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
3. Report: session #, portal version, worker version, file sizes — confirm fully loaded and ready

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
