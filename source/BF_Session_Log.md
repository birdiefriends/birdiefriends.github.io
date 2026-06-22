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

## Session Dev-44 · 2026-06-21

**Focus:** Gatherings — #3 chosen (Portal UI, Crew-member side only). Crew-member card
rendering for Home/Parked/Schedule, plus an isolated admin test harness so Brian can
exercise the D1-backed flow without involving real members.

**What happened — Crew-member card rendering:**
- `eventData`/`regData` (already global, shared by Home/Parked/Schedule/capacity engine)
  extended to merge in Gatherings: `loadGatherings()` pulls `GET /gatherings?player_id=X`
  + per-gathering `GET /gatherings/:id/registrations`, normalizes into the same shape
  Jotform events use (`source:'gathering'` flag added for branching).
- Capacity engine branched (`getGatheringCapacityStatus`) — simple open/full model,
  deliberately skipping the Series-Event-only 48hr-lock/fivesome logic, which doesn't
  apply to Gatherings.
- Register/unregister branched to a parallel D1 write path (`submitGatheringRegistration`,
  `changeGatheringRegistration`) alongside the existing Jotform path, selected by
  `evt.source`.
- Swipe wired per spec §11 Q13 — Gatherings write `status:'no'` to D1 on swipe (even
  after a prior Yes), bypassing the Series-Event "can't swipe while registered" guard,
  which doesn't apply here.
- New `format-gathering` badge — labeled **"Host Gathering"** (not "Gathering") per
  Brian's call mid-session, to read clearly as host-run rather than BF-run.
- **Schedule tab needed zero extra code.** Verified `renderSchedule()` was already
  fully generic over the shared `eventData`/`regData` arrays with no Jotform-specific
  logic — Gatherings a player registers for show up there automatically. The
  "Calendar/Schedule wiring" carry-forward item from Dev-43 turned out to already be
  covered by building the data layer generically from the start.
- **Host-management panel — not built.** Scoped for #3 but explicitly deferred to a
  future session (budget-conscious call late in this session); Brian still hosts test
  Gatherings via the new admin test button rather than a real Host UI.

**What happened — Gathering Test Mode (admin panel):**
- New Dev Controls section: **Create Test Gathering** / **Delete My Test Gatherings**.
- Isolation strategy: ad hoc Crew = [commissioner only] per test Gathering — reuses
  the same Crew visibility filter (§4) that scopes real Gatherings, so test data is
  invisible to every real player without a separate test/prod flag. Host identity is
  the commissioner's real name (`currentPlayer`); considered a dedicated "Test Host"
  identity, decided against — no real confusion risk at current scale.
- **New Worker route, `POST /gatherings/purge-test`** (PIN-gated, unlike the rest of
  the open-trust Gatherings routes — deletion warrants `/deploy`-level discipline).
  True `DELETE` across all 4 tables (registrations → gatherings, then crew_members →
  crews, child-before-parent per D1's enforced FKs), not a soft cancel. Smoke-tested
  end to end via curl before handoff: create → register → purge → confirmed zero rows
  left in any table; wrong PIN rejected; re-running with nothing to delete returns
  clean zeroes.
- Status feedback upgraded mid-session — first pass was a quiet hint-text line easy to
  miss; rebuilt as a bordered, color-coded box showing real details (Gathering #,
  title, venue/time) plus a "→ View card on Home" button that jumps tabs and pulses
  the card, so success is visually obvious without hunting for it.

**Real bug caught and fixed (Brian, via screenshot):** Gatherings were landing at the
very *end* of the Home list regardless of date — `parseEventSubmissions` already sorts
Jotform events by date, but `mergeGatherings` was appending Gatherings after that sort
instead of before it. Fixed: `mergeGatherings` now sorts the combined list by date.
(Verified after the fix that a same-day test Gathering correctly sorting to position #1
ahead of a July event was *not* a bug — Brian's own read on a second look.)

**Version scheme changed:** Brian called this significant enough to leave 3.10.x patch
bumps behind. New convention: minor version (3.X.0) for real feature work, patch
(3.X.Y) for fixes/tweaks within that feature arc. Portal moved 3.10.139 → 3.11.0 this
session, then patched forward to 3.11.3 for the fixes above. Considered 4.0 and
rejected — that number is already reserved in the Ops Guide for the true multi-tenant/
off-Jotform architectural rewrite, a materially different and larger effort than
Gatherings; reusing it here would collide with that meaning in the changelog.

**Artifacts created/updated:**
- `docs/portal.html` + `source/portal.html` — v3.10.139 → v3.11.3 across 6 deploys
  this session (card rendering, test-mode admin button, version scheme change,
  feedback UX rebuild, sort fix + badge rename)
- `source/worker.js` — `POST /gatherings/purge-test` added; pushed to library and
  manually deployed to Cloudflare by Brian (Claude cannot deploy Worker code directly)
- `source/portal_version.txt` — tracks 3.11.3

**Carry-forward for next session:**
- **#2 — Crew onboarding (spec §5):** unchanged from Dev-43 — stub Membership
  creation, cell-based de-dup, `Pending` status, claim-link via KV. Still the most
  security-sensitive piece (writes into the live Membership roster); still warrants
  its own focused session.
- **#3 (remainder) — Host Management panel:** create/view-responses/cancel UI for
  Hosts, mirroring the Live Panel paradigm per spec §15. Crew-member side is done;
  this is the other half.
- Doc sync: this entry, plus `BF_Gatherings_Spec.md` and the session starter header,
  updated same-session as a deliberate close-out step (budget-conscious — chose doc
  sync over starting new feature work at 71% usage).

**Late addendum — card behavior review (discussion only, no code):** Reviewing a
live test card screenshot during the post-tee-time window surfaced two cross-cutting
issues, both pre-existing and not Gathering-specific, just newly visible because this
was the first time anyone looked closely at a non-Series card in that state:
1. The in-progress card content ("Round in progress · Tap the banner to enter scores")
   fires for any format, but the actual scoring entry point (`getLiveEvent()`) is
   hardcoded to Series only — so Wally/Cup/Scramble/Individual/Gathering cards have
   likely been showing a misleading scoring callout in that window all along.
2. The 48hr-lock/5th-player capacity logic triggers off "has a capacity number," not
   off format — it's really a Sat/Sun-BSGC-specific rule that was never formally scoped
   to just that case.
Logged to `BF_Operations_Guide.md` §10 (Backlog) as two 🔴 blocking items — Brian wants
these resolved before continuing Gathering Dev, so the Host panel and any further card
work isn't built on a misleading foundation. See Ops Guide for full detail.

**Session closed clean** — Crew-member rendering shipped and smoke-tested live, a
real sort bug was caught and fixed same-session via Brian's screenshot, and the test
harness (create/delete + visible feedback) is in solid shape for whoever picks up the
Host panel next.

---

## Session Dev-45 · 2026-06-21

**Focus:** Neither carry-forward item from Dev-44 — instead, a budget-constrained
debate/capture pass on the in-progress card bug (confirmed live via Brian's screenshot
of a Gathering test card), followed by a full-budget implementation pass once usage
reset, scoped per Brian's direction to "solidify any underlying portal, jotform, or
operations constructs which might impact the Gathering function" before further
Gathering feature work.

**Part 1 — Architecture debate (constrained budget, capture-only):**
Confirmed the screenshot bug via code: `buildEventCard()`'s in-progress block fires for
any format with no check, while `getLiveEvent()` (the real scoring/Live Panel entry
point) was hardcoded `format-series` only. Settled a two-tier model — Tier 1 (generic
"In-Progress" collapsed row, no scoring promise, registration blocked, available to
every format) vs. Tier 2 (capability-gated tap-target into the real Live Panel).
Reframed the Tier 2 gating question away from format entirely, surfacing two
independent triggers: **Coordination Live** (multi-group visibility — a large Gathering
has the same cross-group problem a Series event does, small ones don't) and
**Integrity Live** (auditable shared scoring/stakes — Tony Choy's private side-game as
the originating example, parked as a future custom-games/recommendation-engine
consideration, not Dev-45 scope). Full writeup captured in `BF_Operations_Guide.md` §10.

**Part 2 — Implementation (full budget):** Working through the Tier 2 gating question
in chat surfaced a deeper issue: the "is this Series" test conflated three unrelated
things — reservation logistics (BSGC's 2-tee-time/48hr-lock pattern), scoring/GS
support, and Live Panel access. Brian clarified via a screenshot of the live Event
Format options that several formats (ParTee, Practice, Private Event — now retired)
weren't even in the `formatClass()` taxonomy at all. Resolved by:

- **New Event Format option "BF Weekend Times"** added directly to the Request Event
  form (Brian, live, no new QID — same field). Confirmed scope: this is reservation
  logistics only (BF's own 2-tee-time booking pattern, course releases the 2nd tee time
  if 6+ confirmed registrations aren't secured within 48hrs), not a scoring/format
  distinction. Hosts never need this — they manage their own tee times with the venue
  directly, BirdieFriends has no role there.
- **`getCapacityStatus()` refactored:** dispatches to `getWeekendCapacityStatus()`
  (the original 48hr-lock/5th-player engine, untouched logic, now isolated to
  `format-weekend` only) or `getSimpleCapacityStatus()` (shared open/full/waitlist
  model — also absorbs the old Gathering-only path, now the default for everything
  else: Series, Wally, Cup, Scramble, blank/Individual Play, ParTee, Practice).
- **New `hasLivePanelSupport(evt)` chokepoint**, decoupled from `formatClass()`
  entirely. Surfaced from Brian's point that CttP/Scorecard is the foundational
  data-capture step (Skins reads from Scorecard data; Birdie Alerts are a notification
  layer on top, not the substance) — so Live Panel access is its own concern, not a
  byproduct of format string matching. Today: Series only. Wally Cup/BF Cup/Scramble
  wired with `// TODO` flip markers (Wally Cup targeted Sept 2026, others Oct/Nov
  2026 — confirmed GS hasn't been extended to their scoring models yet, intentionally
  kept separate to avoid confusion). BF Weekend Times and Gatherings permanently
  excluded by design. `getLiveEvent()` and the live-banner styling check rewired to
  use it — also fixes a latent gap where the Live Panel never actually checked
  `LIVE_EVENT_HOURS` (8hr) consistently against the in-progress card's 6hr window.
- Sunset/in-progress windows (6hr) extended to `format-weekend` alongside Series,
  since both are full BSGC rounds of identical duration.

**Deployed:** `docs/portal.html` + `source/portal.html` (v3.11.4, `node --check`
clean), `source/portal_version.txt`, `source/BF_Operations_Guide.md` (§10 backlog
updated — capacity logic and Live Panel gating marked ✅ Shipped; Live Panel docs
section rewritten to describe the new gating).

**Carried forward — explicitly NOT done this session:**
- **Tier 1 card-copy fix** — `buildEventCard()`'s in-progress block still hardcodes
  "⛳ Round in progress · Tap the banner to enter scores" for every format, regardless
  of `hasLivePanelSupport()`. The *gating* is now correct (Gatherings/Weekend/Wally
  genuinely can't open the Live Panel), but the *card text* hasn't been updated to stop
  promising it. This was the original Dev-44 screenshot bug's visible symptom — still
  visible until the Tier 1/Tier 2 card UI split (fully speced, see Ops Guide §10) is
  built. Logged as 🔴 Next up.
- Crew onboarding (Dev-44 #2) — still untouched, still flagged security-sensitive,
  still warrants its own dedicated session.
- Host Management panel (Dev-44 #3 remainder) — still untouched.
- 48hr-lock / capacity *logic* shipped this session, but **not smoke-tested live**
  against a real BF Weekend Times event yet — recommend a quick live check next
  session before trusting it under real registration pressure.

---

**Dev-45 continued — same session, budget refreshed mid-session.** Picked the
Tier 1 card-copy fix back up, then built the full Host Management Panel
(Dev-44 #3 remainder), then several rounds of bugfix/UX iteration once Brian
started live-testing it. Versions: v3.12.2 → v3.13.2 across this stretch.

**Tier 1 card-copy fix shipped (v3.12.2):** `buildEventCard()`'s in-progress block
now branches on `hasLivePanelSupport(evt)` — Tier 2 (Series) keeps the real
"tap to enter scores" copy, Tier 1 (everything else) shows a minimal
"⛳ In-Progress · Xh Ym in" with no scoring promise. Closes the original
Dev-44 screenshot bug end-to-end.

**Bug found independently — Schedule tab "Can't Make It" button invisible
(v3.12.3).** Pre-existing, unrelated to Gatherings — `.btn-cant-make-it` (white-ish,
built for dark Home cards) was reused inside My Schedule's white card list,
rendering as a near-invisible sliver. Brian reported it as "a random character."
Fixed by swapping to `.btn-ghost`. First Gathering ever to land in someone's
Schedule is what finally put eyes on this corner of the UI.

**Host Management Panel built (v3.12.0 → v3.13.2), spec §3/§15's other half:**
- **v3.12.0:** Core panel — entry point on Home, create/view-responses/cancel,
  saved + ad hoc Crews, Notify Crew via `osSendToPlayers`. New Worker route
  `GET /crews/:id/members` (needed so reusing a saved Crew can still notify its
  current members).
- **v3.12.1:** Gated behind a new KV flag `gathering_panel_live` (off by default) —
  Brian's call after realizing a live test would push a real notification to real
  Crew members. Dev Controls → 🏌️ Host Management Panel toggle, same pattern as
  Maintenance/Live Test.
- **v3.12.2:** Fixed a real stuck-loading bug Brian hit live — none of the
  Gatherings/Crews fetches had a timeout, including `loadGatherings()`'s
  per-gathering registration `Promise.all` (runs after every create/cancel via
  `refreshGatherings()`). A single hung request left the Create button spinning
  forever with no way out but a hard refresh. New `gatheringsFetchJSON()` helper,
  10s timeout via `AbortController`, applied to all 7 Gatherings/Crews call sites.
- **v3.13.0 — full UX pass per Brian's feedback after live-testing:**
  "Cancel" → "Cancel Gathering"; new Crew Picker sheet matching the Live Panel's
  player picker (search + alphabetical groups + avatars + multi-select with a
  Done footer) replacing a plain 2-column button grid; "Are you playing?" toggle
  (default Yes) auto-registers the Host on create — Brian's point: "I setup the
  event, and then had to also register on the card, most hosts will also play";
  status pills (color-coded Yes/Sub/No) on the Host's Gathering list; explicit
  "✕ Can't make it" button on Gathering cards alongside swipe. Building that last
  one caught a real bug: it would have shown a misleading "Sub registered" toast
  and left the card active — fixed `submitGatheringRegistration()` to handle No
  correctly (parks the card, accurate toast), matching what swipe already did.
- **v3.13.1 — Sub redefined as a deliberate response, not just overflow.**
  Brian's real example: he's in Charlie's Whitetail Crew, routinely tells Charlie
  "I'll play as a last resort." Gathering cards now always offer Yes / Sub / No as
  three equal buttons regardless of capacity, not just when full. No backend
  change needed — `yes/sub/no` was already the full status vocabulary (spec §9);
  this was purely a UI gap.
- **v3.13.2 — more live-testing feedback:** light green sheet background (`#EAF6F0`,
  inputs stay white) with tighter form spacing per Brian's request; **unified the
  saved-Crew and ad-hoc-picker data paths** — selecting a saved Crew now fetches
  its real members via the v3.12.0 route and loads them directly into the picker's
  state. Fixes a real bug Brian hit: reopening "Select players…" after picking a
  saved Crew showed an empty grid, because the two were previously disconnected
  (saved Crew stored only a `crew_id`, the picker only ever read/wrote a separate
  ad hoc set). Editing the list after loading a saved Crew now forks it into a
  fresh ad hoc list rather than silently rewriting the original.

**Schema migration — run, not yet wired.** `ALTER TABLE gatherings ADD COLUMN
gathering_type TEXT;` run live by Brian via D1 Console (Entry 2,
`BF_Gatherings_Schema.sql`) for a descriptive sub-format field (Individual Play,
4 Man Scramble, etc. — the Host-relevant subset of the Request Event form's
Event Format list). Worker insert + portal dropdown + display **not yet built**
— session ended at 90% budget before this piece. Full carry-forward detail in
`BF_Gatherings_Spec.md` §19.

**Session ended deliberately at ~90% budget, mid-arc, by Brian's call** — documented
rather than pushed further. Next session should pick up gathering_type wiring
first (small, well-scoped, schema already in place), then the remaining Dev-44
items (Crew onboarding, still flagged security-sensitive) whenever there's a
dedicated block for them.


## Session Dev-46 · 2026-06-22

**Focus:** `gathering_type` wiring — the carry-forward item from Dev-45 (schema column already in D1, wiring not yet built).

**What happened:**
- **Worker (`worker.js`):** `POST /gatherings` destructure extended to include `gathering_type`; INSERT column list and `.bind()` updated to persist it (nullable — existing Gatherings without a type unaffected; `GET /gatherings` `SELECT *` already picked it up automatically).
- **Portal (`docs/portal.html` + `source/portal.html`, v3.13.3):**
  - `loadGatherings()` maps `g.gathering_type` → `gatheringType` on the normalized event object.
  - `showNewGatheringForm()` — new **Format** dropdown added under ⛳ The Basics (between date/time/size row and "Who's Coming"). Options: Individual Play, 4 Man Scramble, 2 Man Scramble, 1 Man Scramble, Best Ball, Match Play, Stroke Play. Optional field — passes `null` if left blank.
  - `submitNewGathering()` reads `host-new-type` and includes `gathering_type` in the POST body.
  - `buildEventCard()` — shows `⛳ {gatheringType}` as a meta-line on the Gathering event card when set.
  - `renderHostPanelList()` — shows `⛳ {gatheringType}` under the date/time line in the Host panel list when set.
- **`source/portal_version.txt`** updated to v3.13.3 · 2026-06-22.
- All three files deployed via Worker `/deploy` route (commits `d33e95f`, `6f6aa80`, `4550321`).

**Artifacts created/updated:**
- `source/worker.js` — `gathering_type` added to `POST /gatherings` (deployed by Brian via Cloudflare dashboard)
- `docs/portal.html` + `source/portal.html` — v3.13.3
- `source/portal_version.txt` — v3.13.3 · 2026-06-22

**Carry-forward for next session:**
- Further test & enhance work on the Gatherings Host panel (Brian's call at session close — more to do, budget ran out).
- Crew onboarding (Dev-44 #2) — still untouched, still flagged security-sensitive, still warrants its own dedicated session.

**Session closed at near-full budget** — single focused item fully shipped.

## Session Dev-46 · 2026-06-22

**Focus:** `gathering_type` wiring — the carry-forward item from Dev-45 (schema column already in D1, wiring not yet built).

**What happened:**
- **Worker (`worker.js`):** `POST /gatherings` destructure extended to include `gathering_type`; INSERT column list and `.bind()` updated to persist it (nullable — existing Gatherings without a type unaffected; `GET /gatherings` `SELECT *` already picked it up automatically).
- **Portal (`docs/portal.html` + `source/portal.html`, v3.13.3):**
  - `loadGatherings()` maps `g.gathering_type` → `gatheringType` on the normalized event object.
  - `showNewGatheringForm()` — new **Format** dropdown added under ⛳ The Basics (between date/time/size row and "Who's Coming"). Options: Individual Play, 4 Man Scramble, 2 Man Scramble, 1 Man Scramble, Best Ball, Match Play, Stroke Play. Optional field — passes `null` if left blank.
  - `submitNewGathering()` reads `host-new-type` and includes `gathering_type` in the POST body.
  - `buildEventCard()` — shows `⛳ {gatheringType}` as a meta-line on the Gathering event card when set.
  - `renderHostPanelList()` — shows `⛳ {gatheringType}` under the date/time line in the Host panel list when set.
- **`source/portal_version.txt`** updated to v3.13.3 · 2026-06-22.
- All three files deployed via Worker `/deploy` route (commits `d33e95f`, `6f6aa80`, `4550321`).

**Artifacts created/updated:**
- `source/worker.js` — `gathering_type` added to `POST /gatherings` (deployed by Brian via Cloudflare dashboard)
- `docs/portal.html` + `source/portal.html` — v3.13.3
- `source/portal_version.txt` — v3.13.3 · 2026-06-22

**Carry-forward for next session:**
- Further test & enhance work on the Gatherings Host panel (Brian's call at session close — more to do, budget ran out).
- Crew onboarding (Dev-44 #2) — still untouched, still flagged security-sensitive, still warrants its own dedicated session.

**Session closed at near-full budget** — single focused item fully shipped.

---

## Session Dev-46 continued (same session, extended work)

**Portal versions across this session:** v3.13.3 → v3.15.7 across ~25 deploys

**Major work completed:**

**gathering_type wiring (spec §19, carry-forward from Dev-45):**
- Worker `POST /gatherings` now persists `gathering_type`
- Host form: Golf Format dropdown (defaults Individual Play)
- `loadGatherings()` maps `gatheringType` to normalized event object
- Displayed on event card meta line and Host panel list

**Host panel UX overhaul (many iterations with Brian live-testing):**
- View Responses → inline toggle on pills row (▸/▾ caret), no drill-down screen
- Pills row is the tap target — removed "View Responses" button entirely
- Two-button action row: ➕ Invite Others + Cancel Gathering
- Card visual polish: warm `#f7fbf9` background, divider line above actions

**Invite Others (post-create crew expansion):**
- New Worker route `POST /crews/:id/members/add` (INSERT OR IGNORE, idempotent)
- `hostInviteOthers()` fetches actual D1 crew members for exclusion list (not just responders)
- Crew picker opens in `invite` mode, pre-excludes existing members
- On Done: adds to D1, sends gathering_invite push, refreshes panel

**New to BirdieFriends? inline form in crew picker:**
- Full-width button stacked below search in picker header
- Mini-form (first, last, cell) drops in above the list
- Cell de-dup against all members (digits-only normalize, 10+ digit match)
- On dup: auto-selects existing member, shows warning, closes form
- On clean: posts to Membership form, adds to local memberData, auto-selects

**Crew picker UX:**
- All members shown regardless of InActive/Pending status (scoped fix — identity picker and Live Panel unchanged)
- Single-char search = starts-with (jump to letter); multi-char = substring
- Header label white/bold, mode-aware ("Select players" vs "Invite Others")

**Save-crew dialog:**
- Blocking modal after picker Done (not inline — forces the decision)
- Crew name stored in `_pendingCrewName` JS var (not DOM element which gets removed)
- Skip clears name, Enter confirms, `submitNewGathering` reads the var safely

**New Gathering form UX:**
- Date/Time: full click area via `showPicker()` on div wrapper
- Size on own line, labeled "Tee Time Capacity" with hint text
- Golf Format dropdown defaults Individual Play
- Are You Playing: single toggle button (green=yes, muted outline=not playing)
- Section order: Basics → Are You Playing → Who's Coming → Create Gathering
- Back button in header (hidden on list view), Cancel replaces Done on create form (red-tinted)
- Title and Venue marked required (*)

**Tier 1 in-progress card:** brighter — green tint, bold label, time sub-line

**Admin panel:**
- ☢️ Clear ALL My D1 Data button — `POST /gatherings/purge-all` Worker route (no title filter, deletes everything for host)
- Confirmed working: cleared Paupack Hills test event

**Host promotion:**
- `HOST_QID = '25'` confirmed (Brian added Host Yes/No field to Membership form)
- `host` parsed from memberData alongside `bfw`
- `submitNewGathering` silently writes Host:Yes on first create (best-effort, non-blocking)

**Crew picker filter fix:** Invite Others exclusion now fetches actual D1 crew members, not just responders (players who hadn't responded were showing in the invite list)

**Parked for future sessions:**
- Gathering Description (free text, `description TEXT` D1 column needed)
- Attachment URL (paste-a-link, `attachment_url TEXT` D1 column needed)
- Host → Commissioner feedback button (mailto: bridge)
- Full Crew onboarding / spec §5 (Pending stub, claim-link, bfw consent) — still security-sensitive, own session
- Host promotion auto-tracking (QID wired, needs live verification)

**Session closed:** Brian live-testing 2nd and 3rd Gathering creates to verify saved Crew chips appear on subsequent New Gathering forms.

---

## Dev-46 addendum — late-session work (v3.15.8 → v3.16.1)

**Validation hardening:**
- Capacity check on create: crew size + host (if playing) must ≥ capacity. Applies to both ad hoc and saved Crews (`_hostCrewPicked` always populated via `selectSavedCrew`). Toast: "Add more players — X selected but capacity is N"
- Venue required: was marked * but not enforced — now blocked at submit
- Past date/time: rejected with "Date and time must be in the future"

**Live testing results (Brian, 3 Gatherings):**
- Notifications fired correctly on create
- Gathering cards showing HOST GATHERING badge, capacity (1/4), In-Progress at 1h 50m ✅
- Saved Crew chip appeared correctly on 3rd Gathering create ✅
- Capacity validation caught under-crew bug ✅
- Host:Yes confirmed written to Jotform Membership ✅
- purge-all confirmed working (cleared Paupack Hills) ✅

**Visual polish:**
- My Gatherings home entry: BF green gradient, bold white text, shadow — replaces peachy gold
- Host panel cards: capacity shown inline on meta line (👥 N)
- Save-crew: blocking modal dialog (not inline) forces decision after picker Done
- Cancel (red-tinted) replaces Done on create form header; Done restored on list view

**Remaining bugs found during testing:**
- RoughRiders Gathering (Jun 22 today, already in-progress) was creatable with a past datetime — now blocked by validation

**Carry-forward for Dev-47:**
- Branch findings from live testing (Brian's call at close — specific items TBD at Dev-47 start)
- Gathering Description + Attachment URL (D1 columns needed first)
- Host → Commissioner feedback button
- Crew onboarding spec §5 (own dedicated session)
- Verify Host:Yes write on fresh Gathering create (confirmed this session but worth a clean retest)

**Final portal version: v3.16.1 · 2026-06-22**

## Session Dev-47 · 2026-06-22

**Focus:** Gatherings Host panel polish and bug fixes from Dev-46 live testing; portal UX hardening across several discovery-driven iterations with Brian testing live throughout.

**What happened — bugs fixed:**
- **Announcement bleed** (`gathering_invite` notifications appearing for all members): root cause was the KV feed being global while `osSendToPlayers` early-returned when no push IDs existed, bypassing the feed write entirely. Two-part fix: (1) `feed_only: true` path added to Worker `POST /` handler — skips OneSignal, writes KV directly; (2) `osSendToPlayers` now calls `osSend({ feed_only: true })` instead of returning `{ ok: false }` when no push IDs. Portal filter in `buildAnnouncementsHTML` hides `gathering_invite` entries whose `meta.invited` doesn't include `currentPlayer`.
- **Toast invisible behind Host sheet** (z-index 300 vs sheet z-index 9200): `.bf-toast` z-index bumped to 9999 in both CSS blocks — fixes all validation toasts (title required, venue required, capacity, past datetime) when sheet is open.
- **Gathering notification URL → birdiefriends.com root**: all three `osSendToPlayers`/`osSendAll` calls for `gathering_invite` and `gathering_cancelled` had empty string URL; updated to `portal.html`.
- **Cell Phone label missing** in "Add to BirdieFriends" mini-form: added visible label + `autocomplete="off"` to suppress browser phone picker dropdown.
- **Pending crew name not shown** after save-crew dialog: `renderHostCrewSummary` now checks `_pendingCrewName` as middle case; `dismissCrewSaveDialog` calls `renderHostCrewSummary()` on exit.
- **Host could invite themselves** via Invite Others: `hostInviteOthers` now unions `currentPlayer` into the exclusion list — host is implicit member-zero via `host_id`, not in `crew_members`.
- **"OR SELECT INDIVIDUAL PLAYERS" label shown even when named crew active**: label gets `id="who-coming-individual-label"`; `renderHostCrewSummary` hides it when `namedCrew` is truthy, shows it otherwise.

**What happened — features shipped:**
- **Gathering Description field**: D1 Entry 3 (`ALTER TABLE gatherings ADD COLUMN description TEXT`), Worker `POST /gatherings` updated, portal form textarea (optional, resizable), `buildEventCard` expandable `📋 Details ▸` toggle on Crew cards, Host panel shows inline.
- **`feed_only` Worker path**: push-free KV feed write for players without push subscriptions.
- **Who's Coming UX overhaul**: three labelled navigation paths — "Select an existing Crew" / "Create a New Crew" / "Or Select Individual Players". `openCrewPickerForNew()` clears all crew state before opening. Dynamic button: `✏️ "CrewName" · N players · tap to adjust` vs `👥 Select players…`.
- **Crew name on Host Panel card**: Worker `GET /gatherings` now LEFT JOINs `crews` and returns `crew_name`; normalized as `crewName` in `loadGatherings`; displayed as `👥 CrewName` on host panel card.
- **D1 schema ERD** added to `bf_architecture.html` — PIN-gated, shows all 4 tables with FK relationships, migration log, entry annotations. D1 node click drills to schema section. Corrected "planned" → "live" throughout.

**Decisions made:**
- **Host → Commissioner feedback button**: killed. Players can text. Avoids BirdieFriends becoming a helpdesk for use errors.
- **Attachment URL (gathering flyer)**: right feature, wrong session. Jotform file upload is an available interim path (proven via scorecard photo) but acknowledged as a hack. Proper implementation is Cloudflare R2 (Worker upload endpoint, presigned URLs, image display on Crew card) — scoped as a future dedicated session.
- **Crew onboarding (spec §5)**: still parked, still security-sensitive, still warrants its own session.

**Artifacts created/updated:**
- `docs/portal.html` + `source/portal.html` — v3.16.1 → v3.16.13 across 13 deploys
- `source/portal_version.txt` — v3.16.13 · 2026-06-22
- `source/worker.js` — `feed_only` path + `gathering_type` description + `crew_name` JOIN
- `source/specs/BF_Gatherings_Schema.sql` — Entry 3 (description column)
- `source/bf_architecture.html` + `docs/bf_architecture.html` — D1 schema ERD added, PIN-gated

**Carry-forward for Dev-48:**
- **Gathering attachments (R2)** — Cloudflare R2 storage, Worker upload endpoint, image/file display on Crew card. Interim: Jotform file upload path exists if pressure comes before R2 session.
- **Crew onboarding (spec §5)** — Pending stub, claim-link, bfw consent. Security-sensitive, own session.
- **BF Weekend Times live check** — 48hr-lock capacity logic shipped Dev-45 but not smoke-tested against a real event yet.
- **Host:Yes verification** — confirmed Dev-46, worth a clean retest on fresh Gathering create.

**Final portal version: v3.16.13 · 2026-06-22**

## Dev-47 addendum — late-session fixes (v3.16.14)

**Announcement visibility fix:**
- Root cause: host filtered out of their own `gathering_invite` announcements because `meta.invited` only contains crew members, not the host.
- Fix: `buildAnnouncementsHTML` filter now passes if `currentPlayer` is in `meta.invited` OR is the host of that gathering (matched via `meta.gathering_id` against `gatheringData`).
- Verified: Brian now sees all 3 test gathering announcements in his feed.

**Crew name on Host Panel:**
- Worker `GET /gatherings` now LEFT JOINs `crews` and returns `crew_name`.
- Normalized as `crewName` in `loadGatherings`; displayed as `👥 CrewName` on host panel card.

**Attachment URL / R2 discussion:**
- Feature confirmed desirable — host has a flyer (photo or digital), crew needs to see it.
- Paste-a-link rejected: players aren't consistently capable of the URL-copy workflow.
- Jotform file upload acknowledged as a proven interim path (scorecard photo precedent) but a hack.
- Decision: proper implementation is Cloudflare R2. Scoped for a future dedicated session.

**Feedback button:**
- Killed. Players can text. Avoids BirdieFriends becoming a helpdesk.

**Soft-launch readiness assessment:**
- Gatherings feature ready for soft-launch to trusted hosts with existing BF members in their crew.
- Pre-launch checklist: (1) flip `gathering_panel_live` KV flag, (2) mark hosts with Host:Yes on Membership form.
- Crew onboarding (spec §5) not a blocker — same manual process as any new BF member.
- Gathering edit (#4) needed before full community open — next session priority.
- BF Weekend Times capacity logic unsmoke-tested — real verification Thu Jun 26 morning before Sat 6/27 event.

**Final portal version: v3.16.14 · 2026-06-22**
