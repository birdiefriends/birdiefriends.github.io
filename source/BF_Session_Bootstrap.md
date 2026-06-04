# BirdieFriends Session Bootstrap

## To start any session (Chat #30+), paste this single command into Claude:

```
Fetch https://raw.githubusercontent.com/birdiefriends/birdiefriends.github.io/main/source/BF_Session_Bootstrap.md and follow all instructions in it exactly.
```

---

## Claude — execute these steps automatically, in order, before anything else:

1. Fetch and read `BF_Golf_Scorer_Session_Starter_current.md` from the library
2. Fetch and read `BF_Operations_Guide.md` from the library
3. Fetch `portal_version.txt` from the library — sole version source of truth
4. Fetch `docs/portal.html` from GitHub → save to `/home/claude/birdiefriends_portal.html`
5. Fetch `source/worker.js` from GitHub → save to `/home/claude/worker.js`
6. Fetch `source/bf_deploy.py` from GitHub → save to `/home/claude/bf_deploy.py`
7. Report: session #, portal version, worker version, file sizes — confirm fully loaded and ready

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
