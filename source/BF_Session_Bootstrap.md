# BirdieFriends Session Bootstrap

## To start any session (Chat #30+), paste this single command into Claude:

```
Fetch https://raw.githubusercontent.com/birdiefriends/birdiefriends.github.io/main/source/BF_Session_Bootstrap.md and follow all instructions in it exactly.
```

---

## Claude — read this rule before attempting any fetch below:

**FETCH RULE — NON-NEGOTIABLE:**
Use `bash_tool` with `curl` for ALL raw GitHub URL fetches in this bootstrap (steps 1–6
below). Do NOT use the `web_fetch` tool for `raw.githubusercontent.com` URLs — it only
allows fetching URLs that were directly pasted by the user or already returned by a
prior search/fetch, so a constructed library URL will be blocked. The only URL fetched
via `web_fetch` in this whole process is this bootstrap file itself (pasted by the user
in the initial command above) — every step below uses `curl`.

---

## Claude — execute these steps automatically, in order, before anything else:

1. Fetch and read `BF_Golf_Scorer_Session_Starter_current.md` from the library (curl)
2. Fetch and read `BF_Operations_Guide.md` from the library (curl)
3. Fetch and read `BF_Session_Log.md` from the library (curl) — sole source of truth for
   the current Dev session number (last entry's `Dev-N` + 1)
4. Fetch `portal_version.txt` from the library — sole version source of truth (curl)
5. Fetch `docs/portal.html` from GitHub → save to `/home/claude/birdiefriends_portal.html` (curl)
6. Fetch `source/worker.js` from GitHub → save to `/home/claude/worker.js` (curl)
7. Fetch `source/bf_deploy.py` from GitHub → save to `/home/claude/bf_deploy.py` (curl)
8. Report: session #, portal version, worker version, file sizes — confirm fully loaded
   and ready. **Also state the exact chat-rename string** (e.g. `Dev#42 - <topic>`,
   topic filled in once the session's focus is clear) so the chat title can be pasted
   directly rather than guessed.

**At session close:** append a new entry to `BF_Session_Log.md` (mirroring the existing
entries' format) and push it via `/deploy` before ending — this is what keeps the
counter authoritative instead of drifting back into manual numbering.

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
