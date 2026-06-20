# BirdieFriends — Dev Session Log
*Chronological changelog · One entry per session · Mirrors `source/bizplan/BF_BizPlan_Session_Log.md`*

---

## Known history (reconstructed, not authoritative)

This log did not exist before Dev-41. Prior dev sessions were tracked only by manual
chat-title numbering (`Chat#N`), which drifted from the canonical session count kept in
`BF_Golf_Scorer_Session_Starter_current.md`'s header (e.g. that file read "Session 41
Starter, follows Session 40" while this chat was manually titled "Session 38 bootstrap
initialization" — a 3-session gap). A literal collision also exists in chat history:
two separate chats are both titled `Chat#37`. These are not corrected retroactively;
this log starts clean at Dev-41 and is the source of truth going forward.

Rough prior reference points, for context only (dates/numbers not independently verified
against this log):
- `Chat#34` — Series#4 prep, node --check syntax gate established
- `Chat#36` — Series#4 post-round
- `Chat#37` (×2, colliding titles) — Deploy Improvements / GS Grouping & End-of-Event
- `Chat#38` — Parallel dev session; also did bizplan work later retitled BP-1
- `Chat#39` — Final bizdev deploy; discovered `/deploy` route missing from worker.js
- `Chat#40` ("Final Secrets Cleanup") — eliminated false 100KB limit, added `/deploy`
  route, removed embedded tokens/keys, confirmed Session 40 in session starter header

---

## Session Dev-41 · June 19, 2026

**Focus:** Bootstrap fetch-rule cleanup; session-numbering drift fix; session log
infrastructure created for the dev track (mirroring the bizplan track's existing log)

**Key decisions:**
- Root cause of the bootstrap fetch failure identified: `web_fetch` only allows URLs
  pasted directly by the user or already returned by a prior search/fetch — a
  constructed library URL is blocked. Not a worker.js issue; worker.js has no
  GitHub-proxy routes at all.
- `BF_Session_Bootstrap.md`'s FETCH RULE moved to the top of the file, before any
  fetch is attempted, instead of living only in the session starter's header (which
  isn't read until after the failure already happened)
- Session-numbering drift named as a structural problem: two tracks (Dev, BZP) sharing
  one mental numbering scheme, tracked only by manual chat-title edits with no single
  source of truth. Decision: each track gets its own log file as the authoritative
  counter; chat titles become a *report*, not the *source*, of the session number.
- Naming convention standardized: log entries use `Dev-N` / `BZP-N` (hyphen, matches
  existing bizplan log style); chat titles use `Dev#N` / `BZP#N` (hash, matches
  existing chat-title style). Same number, different punctuation by context.
- Bizplan track already had this solved (`BF_BizPlan_Session_Log.md`, BP-1/BP-2) —
  no backfill needed there, just aligning the dev track to match and adding the
  rename-string report step to both bootstraps.

**Artifacts created/updated:**
- `BF_Session_Bootstrap.md` → FETCH RULE moved to top (prior turn this session)
- `BF_Session_Log.md` (this file, new)
- `BF_BizPlan_Bootstrap.md` → step 5 now also reports the exact chat-rename string

**Carry-forward for next session:**
- Bootstrap step 7 (dev) and step 5 (bizplan) now report an exact rename string
  (e.g. `Dev#42 - <topic>`) — paste it into the chat title at session start.
- At session close, append the next entry to this file (or the bizplan log) before
  ending — that's what keeps the counter authoritative instead of drifting again.

**Session closed clean** — this work was incidental cleanup noticed on entry, not the
original intent for the chat. Closing here rather than continuing into new feature work,
so Dev-42 starts focused.

---

## Session Dev-42 · 2026-06-20

**Focus:** Gatherings — self-service Host capability, full planning pass (no code
written; spec only).

**What happened:** Reframed the original "multi-tenant event management" placeholder
down to its actual scope — self-service hosting with guardrails, explicitly distinct
from the BizPlan's true multi-tenant/commercial track. Built `BF_Gatherings_Spec.md`
from scratch across a long single session:
- Terminology: Gathering / Host / Crew / My Gatherings, chosen to align with existing
  "gathering design platform" bizplan positioning.
- Reach model (§4): Crew ∪ Fill List (opt-in, day-of-week filtered) − Host Exclusions
  − Player Mutes. No public/Discover surface exists at all — architecturally rejected,
  not deferred.
- Storage decision (§8): Cloudflare D1 for Gatherings/Crews/registrations — KV rejected
  (no query layer), full Jotform migration explicitly declined and parked (winter
  project / commercialization trigger), Jotform keeps doing exactly what it does today.
- MLP scope (§11 Q2) locked: Create/Cancel/Notify Crew/Register via required Yes-No-Sub
  response/saved reusable Crews. Fill List, Exclusion/Mute UI, Host tiering UI, and a
  "duplicate last Gathering" shortcut all pushed Post-MLP.
- Registration/swipe behavior (§11 Q13) resolved: swipe IS the No action for Gatherings,
  re-exposing dormant Yes/No/Sub Jotform vocabulary rather than inventing new states.
- Host-initiated onboarding (§5) fully designed: new Crew members become real Jotform
  Membership stubs (`Pending` status, not `InActive`), Cell-based de-dup against all
  records, short Worker-KV claim-link (`invite:{code}`), explicit `bfw` consent captured
  from the person themselves (never set by the Host), existing "Join BirdieFriends"
  self-serve path flagged as needing the same de-dup retrofit.
- Multi-club dimension (§12) raised, discussed at length, explicitly deferred — no club
  modeling in v1, fulfillment trust sits with the Host, real version of this problem
  folds into the same future multi-tenant/national-scale question already named in the
  Ops Guide as the v4.0 trigger.
- Flagged for future sessions, not blocking MLP: operational fix scaling / Claude's role
  as a safe proxy for community-requested actions (§13), and the existing player-picker's
  active-only narrowing needing real attention once Pending volume grows (§5).

**Architecture diagram + deploy panel updated to match:**
- `bf_architecture.html`: added a "planned" Cloudflare D1 node, Worker→D1 connector,
  new legend entry, updated Worker/D1 detail panels.
- `deploy.html` Library tab: added a third section, "Capability specs — source/specs/",
  mirroring the existing bizplan-folder pattern.
- New `source/specs/` folder created — first home for capability spec docs, separate
  from process docs and live app code.

**Real bug caught and fixed mid-session:** both `deploy.html` and `bf_architecture.html`
were deployed to `source/` only and never mirrored to `docs/` — the actual GitHub Pages
live tree is `docs/`, not `source/`. Both files now match across both trees. Worth
carrying forward as a standing checklist item: any player/Host-facing file deploy needs
a `docs/` mirror push, not just `source/`, or the live site silently doesn't change.

**Artifacts created/updated:**
- `source/specs/BF_Gatherings_Spec.md` (new, full spec, §1–§14)
- `source/bf_architecture.html` + `docs/bf_architecture.html` (D1 node added, mirrored)
- `source/deploy.html` + `docs/deploy.html` (Specs section added, mirrored)
- `BF_Operations_Guide.md` — new backlog item: deploy.html Library tab unauthenticated
  GitHub API rate limit (surfaced by adding the third Library section)

**Carry-forward for next session:**
- Q7 (D1 setup mechanics) — binding D1 to the Worker, schema creation, deploy-flow gap
  for future schema changes. Laptop work, explicitly not a chat discussion item.
- §13 (operational fix scaling / Claude-as-proxy) — flagged for its own dedicated
  planning session once Host volume or the proxy concept itself is ready to design.
- §5 (picker active-only narrowing at scale) — flagged for a future UX/data session.

**Session closed clean** — full spec resolved end to end, no open threads left dangling
mid-decision. Next session (laptop) starts on Q7.

---

## Session Dev-43 · 2026-06-20

**Focus:** Gatherings — D1 setup mechanics (§14/§11 Q7), then Worker API plumbing on top
of it (originally scoped as next-session work, pulled forward since time allowed).

**What happened — D1 setup (Q7, resolved):**
- Created `birdiefriends-gatherings` D1 database via Cloudflare dashboard.
- Bound to the Worker as `env.DB` (binding name `DB`).
- Created MLP schema: `gatherings`, `crews`, `crew_members`, `registrations` — the 3
  Post-MLP tables (`fill_list_members`, `host_exclusions`, `player_host_mutes`)
  deliberately deferred, per spec §11 Q2/Q7.
- Migration-tracking decision: lightest viable option — `source/specs/BF_Gatherings_Schema.sql`
  is the authoritative append-only schema log. Each future D1 change gets run in the
  Console, then mirrored into that file via `/deploy`. No tooling/framework adopted.

**What happened — Worker API (pulled forward from "next session"):**
Built and deployed 7 D1-backed routes in `worker.js` — `POST /gatherings`,
`POST /gatherings/:id/cancel` (host-only, server-verified), `GET /gatherings?player_id=X`
(host's own + Crew-member visibility, cancelled rows excluded), `POST /crews` (create +
members in one call), `GET /crews?host_id=X`, `POST /registrations` (upsert, not
duplicate — `UNIQUE(gathering_id, player_id)`), `GET /gatherings/:id/registrations`.
No PIN — hosting is open per §6, same trust model as existing Jotform client writes.

**Design correction caught mid-session (now spec §15):** the Live-Panel-style pop-out
is **Host-management-only** — create/view-responses/cancel. Crew members do **not** get
a parallel UI; a Gathering they're invited to is just another card in the *existing*
My Events / Parked / Calendar views, same swipe-as-No mechanics as a Series Event card.
This shrinks the eventual #3 (UI) lift considerably — it's "extend existing card
rendering to also query `/gatherings`," not "build a new screen."

**Real bug caught in smoke testing, fixed same session:** an invalid `crew_id` or
`gathering_id` was crashing requests with a raw Cloudflare `error code: 1101`
(unhandled exception — D1 enforces foreign keys by default) instead of a clean 400.
Added try/catch around every new D1 call; verified post-fix that bad input now returns
`{"error":"crew_id does not exist"}` with proper status codes, and valid creates still
succeed. Two Worker deploys this session: routes first, error handling second.

**Smoke-tested end to end:** create, host-view list, register, upsert-not-duplicate,
host-only cancel auth (403 for wrong host), cancelled-Gatherings-disappear, Crew
creation + Crew-member visibility, FK error handling. All passed. Test rows cleaned
from D1 via Console after each round.

**Artifacts created/updated:**
- `birdiefriends-gatherings` D1 database (new, Cloudflare)
- `source/specs/BF_Gatherings_Schema.sql` (new — schema migration log)
- `source/worker.js` (Gatherings/Crews/Registrations routes + D1 error handling;
  two deploys, commits `de6c4ee7…` and `bde14338…`)
- `source/specs/BF_Gatherings_Spec.md` — §15 (Host-only panel correction) and §16
  (Worker API reference) added, commit `ad2ca979…`

**Carry-forward for next session:**
- **#2 — Crew onboarding (spec §5):** stub Membership creation, cell-based de-dup,
  `Pending` status, claim-link via KV. Flagged as the most security-sensitive piece
  (writes into the live Membership roster) — deserves its own focused session, not a
  tail-end add-on.
- **#3 — Portal UI:** extend My Events/Parked/Calendar card-rendering to also pull from
  `GET /gatherings?player_id=X` and render Gathering cards alongside Series Event cards,
  backed by `/registrations` instead of the Jotform Event Registration form. Per §15,
  this is now a smaller lift than originally framed — no parallel UI system needed.
  Host-management panel (mirroring the Live Panel paradigm) is the other half of #3.

**Session closed clean** — D1 setup, full API layer, and a real bug all landed and
verified working, with the design correction logged before it could cause rework later.

---

## Session Dev-44 · TBD

**Focus:** Choice between two carry-forward items from Dev-43 — to be decided at session
start:
- **#2 — Crew onboarding (spec §5):** stub Membership creation, cell-based de-dup,
  `Pending` status, claim-link via KV. Security-sensitive (writes into live Membership
  roster); warrants a dedicated, focused session.
- **#3 — Portal UI:** extend My Events/Parked/Calendar to render Gathering cards
  (Crew-member side) + build the Host-management panel mirroring the Live Panel
  paradigm (Host side). Smaller lift than originally scoped, per Dev-43's §15 correction.

**Not yet started — placeholder entry only.** Bootstrap will report this as `Dev#44`
on next session start; rename string to use:
`Dev#44 - Gatherings: <#2 or #3, topic TBD>`
