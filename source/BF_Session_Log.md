
---

## Session Dev-48 · 2026-06-23

**Focus:** Gathering Templates spec (§20), Gathering Edit spec + full implementation (§21), soft-launch prep (Host gate), announcement privacy fix.

**Spec work (discuss → document → build pattern):**
- **§20 — Gathering Templates:** Pull-based reuse model (not calendar recurrence) for Chooch/Tony recurring host needs. `gathering_templates` D1 table, crew snapshot (not live reference), date/time never stored in template. Two save entry points (post-create prompt + secondary action on existing Gathering). Template picker as "📋 From Template" in Host panel. Build deferred — spec locked, D1 migration and 3 Worker routes + 5 portal touches documented for next implementation session.
- **§21 — Gathering Edit:** Full design settled before coding. Editable fields: title, venue, date/time, capacity, format, description. Crew changes excluded (Invite Others is the add path). Date/time change triggers: automatic push + KV feed notification to full crew, stale-response flag on all registrations, card banner prompting re-confirm. Capacity reduction below Yes count: soft warning, Host confirms, no registrations touched. Spec pushed to library.

**Implementation — Gathering Edit (fully shipped):**
- `PATCH /gatherings/:id` Worker route — host auth, dynamic UPDATE, date-change detection, crew notification via OneSignal + KV feed.
- `confirmed_for TEXT` D1 migration on `registrations` (Brian ran in Console, Entry 5 in `BF_Gatherings_Schema.sql`).
- Portal: edit form in Host panel (pre-populated), capacity soft-warning, post-save messaging, stale-response banner on crew cards, Yes/Sub/No re-confirm picker when stale.
- Announcement privacy: `gathering_date_changed` and `gathering_cancelled` types added to the crew-only filter in `buildAnnouncementsHTML` (was filtering `gathering_invite` only — date-change notifications were visible to all members).
- Host entry point gated by `Host: Yes` membership field — confirmed Test1 (not a Host) no longer sees "Host a Gathering."

**Bugs found and fixed during live testing:**
- CORS: `PATCH` missing from `Access-Control-Allow-Methods` header → "failed to fetch."
- Regex over-escape: `\\\\/` in PATCH route regex → Cloudflare syntax error on paste.
- Timezone: portal was sending `toISOString()` (UTC) for Gathering create/edit event_time — stored and displayed correctly but 4-hour Eastern shift visible in notification message copy. Fixed: portal now sends local ISO string with offset (`-04:00`); Worker notification formatter now parses wall-clock components from the ISO string directly instead of using `toLocaleDateString()` in UTC context.
- Stale banner not clearing after re-confirm: two bugs — (1) stale check was comparing strings (`confirmedFor !== evt.dateTime.toISOString()`) but formats differed after timezone fix; fixed to compare milliseconds. (2) `submitGatheringRegistration` was updating `regData` (Jotform array) instead of `gatheringRegData` (D1 array), and not updating `confirmedFor` on the local object — so `renderAll()` always re-evaluated stale against the unchanged in-memory value. Fixed both.
- Date/time picker: `pointer-events:none` on both form inputs (edit + create) prevented direct interaction on Windows Chrome — removed; inputs now directly clickable. iOS clock picker confirmed working correctly.
- Worker library/Cloudflare gap: PATCH route was pre-built in Dev-48 and pushed to library but never presented for Cloudflare paste — surfaced as "failed to fetch." Confirmed Dev-47 was clean; gap was created within Dev-48 itself. BL-19 logged; session close checklist item added to Ops Guide.

**Soft-launch readiness:**
- Host:Yes gate on portal entry point — confirmed working (Test1 sees no Host panel).
- `gathering_panel_live` KV flag still `false` — not flipped this session (Brian's call; Chooch and Tony need Host:Yes marked in Jotform first).
- Pre-launch checklist: (1) Mark Chooch + Tony with Host:Yes in Jotform Membership, (2) flip `gathering_panel_live` flag via Admin panel.

**Artifacts created/updated:**
- `source/specs/BF_Gatherings_Spec.md` — §20 (Templates) + §21 (Edit) added
- `source/worker.js` — PATCH route, CORS fix, UTC notification formatter (4 deploys)
- `docs/portal.html` + `source/portal.html` — v3.16.14 → v3.16.18 (8 deploys)
- `source/portal_version.txt` — v3.16.18 · 2026-06-23
- `source/BF_Operations_Guide.md` — BL-18 (Gathering Active restore gap), BL-19 (Worker library/Cloudflare gap process)

**Carry-forward for Dev-49:**
- Mark Chooch + Tony with Host:Yes in Jotform → flip `gathering_panel_live` → soft-launch
- Gathering Templates implementation (§20) — D1 migration + 3 Worker routes + 5 portal touches
- BF Weekend Times capacity smoke test — before Sat Jun 27 event
- Gathering attachments via R2 (backlog)
- Crew onboarding spec §5 (own dedicated session, security-sensitive)

## Dev-48 addendum — late-session work (v3.16.19 → v3.16.23)

**BL-18 fix — Gathering registration restores InActive members:**
- New `restoreActiveIfNeeded()` helper fires immediately on Yes/Sub Gathering registration — writes `submission[22]: Active` to Jotform Membership, updates local `memberData`. Best-effort, non-blocking.
- `runInactivityCheck` daily batch extended to include `gatheringRegData` future Yes/Sub registrations when evaluating restore eligibility. Both paths now consistent.
- Confirmed live: Test1 registered Yes for a Gathering → flipped to Active in Jotform immediately.

**Model shift — Gatherings open to all BF members:**
- Host:Yes gate removed from `renderHostEntryPoint`. Any logged-in BF member sees the 🏌️ header icon when `gathering_panel_live` is on.
- Auto-promote to Host:Yes on first successful Gathering create remains — it's now tracking, not access control.
- Rationale: intended model at scale is any member can host; Host:Yes gate was a dev-period safety measure, not a permanent design.

**Header icon entry point:**
- 🏌️ button added to header bar (alongside ⚙️ gear, ⓘ about, 🔕 bell). Tapping opens Host panel directly from anywhere in the app. Shown only when `gathering_panel_live` is on and player is logged in.
- Home screen "My Gatherings" row removed — header icon is the sole entry point now.

**Announcement privacy extended:**
- `gathering_date_changed` and `gathering_cancelled` types now crew-scoped in `buildAnnouncementsHTML` (was `gathering_invite` only). Confirmed Scott no longer sees Woodloch Play Day date-change announcements.

**eventTime string/Date split fix:**
- `submitNewGathering` — `eventTime` was changed to a local ISO string for the POST body, but `formatDate()`/`formatTime()` calls still treated it as a Date object → `dt.toLocaleDateString is not a function` error on Gathering create. Fixed: `eventTimeDate` Date object kept for all formatting; `eventTime` string used only for POST body and `rawEventTime` storage.

**Final state:**
- Portal: v3.16.23 · 2026-06-23
- `gathering_panel_live` KV flag: still `false` — ready to flip
- BF Weekend Times smoke test: deferred to IRL Thu Jun 26 (5th-man gate confirmed working in prior test)

**Carry-forward for Dev-49:**
- Flip `gathering_panel_live` → Gatherings live for all members
- Gathering Templates implementation (§20)
- deploy.html — copy instruction to BFM lost (Brian flagged at session close, repair next session)
- Gathering attachments via R2 (backlog)
- Crew onboarding spec §5 (own dedicated session, security-sensitive)

## Dev-48 addendum 2 — final session work (v3.16.24 → v3.16.27)

**Action sub-bar (seamless header extension):**
- Moved all action icons out of the header into a sticky sub-bar below it — same dark green, seamless visual, works on any phone width regardless of screen size. Solves the player-pill overflow issue seen on other members' phones.
- Header now: brand left · 🔕 Bell + Player Pill right (bell moved here — tied to player identity/PWA setup)
- Sub-bar: 👥 Gather (orange circle, labeled) · 🆕 New (blue pill with count) · ⓘ About · ⚙️ Gear
- Gather: orange circle badge (`#E8711A`) with "Gather" label — distinctive, action-oriented
- New: blue pill (`#2980B9`) — matches existing blue that players recognized from the old header button

**About page cleanup:**
- Removed "Request an Event" card — no longer relevant now that Gatherings handles self-service hosting

**Final portal version: v3.16.27 · 2026-06-23**

**Dev-48 fully closed.**
