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

1. Fetch `BF_Session_Log.md` with a cache-busting query string — `raw.githubusercontent.com`
   sits behind a CDN with a several-minute cache TTL, which has caused stale reads
   shortly after a same-night close-out/seed. A unique query string forces a fresh
   fetch with no added rate-limit risk:
   ```
   curl -s "https://raw.githubusercontent.com/birdiefriends/birdiefriends.github.io/main/source/BF_Session_Log.md?cb=$(date +%s%N)"
   ```
   This is the sole source of truth for the current Dev session number (last entry's
   `Dev-N` + 1). Read this **first**, before the Session Starter — the Starter's header
   no longer tracks the number. If the result still looks stale (e.g. shows a session
   you'd expect to already be closed), fall back to the GitHub Contents API:
   ```
   curl -s "https://api.github.com/repos/birdiefriends/birdiefriends.github.io/contents/source/BF_Session_Log.md" \
     | python3 -c "import json,sys,base64; print(base64.b64decode(json.load(sys.stdin)['content']).decode())"
   ```
   Note: the API fallback is unauthenticated (60 req/hr/IP) and can itself be
   rate-limited by other activity that hour (e.g. heavy `deploy.html` Library tab use) —
   if both methods fail to produce a confident answer, say so plainly in the step 8
   report rather than guessing.
2. Fetch and read `BF_Golf_Scorer_Session_Starter_current.md` from the library (curl)
3. Fetch and read `BF_Operations_Guide.md` from the library (curl)
4. Fetch `portal_version.txt` from the library — sole version source of truth (curl)
5. Fetch `docs/portal.html` from GitHub → save to `/home/claude/birdiefriends_portal.html` (curl)
6. Fetch `source/worker.js` from GitHub → save to `/home/claude/worker.js` (curl)
7. Fetch `source/bf_deploy.py` from GitHub → save to `/home/claude/bf_deploy.py` (curl)
8. Report: session #, portal version, worker version, file sizes — confirm fully loaded
   and ready. **Also state the exact chat-rename string** (e.g. `Dev#42 - <topic>`,
   topic filled in once the session's focus is clear) so the chat title can be pasted
   directly rather than guessed. **Also state device-bridge/AutoPush status** (added
   Dev-74 — see the Session Starter's `DEVICE-BRIDGE RULE`): whether the device bridge is
   reachable (`get_device_info`) and whether the AutoPush folder specifically is in
   `connectedFolders`. If Brian's session-start paste included the folder-authorization
   sentence (see the recommended combined command below) and the request still didn't
   go through, or he pasted the old bootstrap-only command, say so plainly here rather
   than silently trying `device_request_folder_access` on your own initiative — that call
   is blocked by the sandbox's own classifier when Claude initiates it unprompted.

**At session close:** append a new entry to `BF_Session_Log.md` (mirroring the existing
entries' format) and push it via `/deploy` before ending — this is what keeps the
counter authoritative instead of drifting back into manual numbering.

**All files are in the library. No uploads needed to start a session.**

---

## Recommended session-start command (added Dev-74 — bundles AutoPush authorization)

The single-line command at the top of this file still works, but leaves the AutoPush
folder unconnected for the session (folder connection doesn't carry over between
sessions any more than the device link itself does — see the Starter's
`DEVICE-BRIDGE RULE`). This version does both jobs in one paste; it's the one published
on `deploy.html`'s Claude tab:

```
Fetch https://raw.githubusercontent.com/birdiefriends/birdiefriends.github.io/main/source/BF_Session_Bootstrap.md and follow all instructions in it exactly. Also, right now: request access to the folder C:\Users\16177\Downloads\GolfScorer\AutoPush on this computer via device_request_folder_access — I'm explicitly authorizing this folder-connection request for this session.
```

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
| Wally Cup spec | `source/BF_WallyCup_Spec.md` (fetch only if continuing BFE/Wally Cup work) |
| BFE Admin Panel | `docs/BFE-Admin.html` (added Dev-74 — **not fetched by steps 1–7 above**; fetch this explicitly via curl only if continuing BFE Competitive Events / Wally Cup Admin work, since it's a ~130KB file most sessions don't need) |

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
