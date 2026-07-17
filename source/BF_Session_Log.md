
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

## Dev-48 addendum 3 — closing polish (v3.16.28 → v3.16.30)

- Golf Format select styled to match white field treatment (both create and edit forms)
- Gathering create form: Date, Time, Capacity marked required (*); capacity validated on submit
- Placeholders cleaned up: Title → "Name your Gathering", Description → "Share something interesting with the crew.", Venue → "BSGC" (no e.g.)
- Venue dropdown (D1-backed venues table) flagged as Dev-49 backlog — BSGC, Whitetail, Moselem Springs, Other
- deploy.html Claude tab: BizPlan session start section restored (was missing)

**Final portal version: v3.16.30 · 2026-06-23**
**Dev-48 fully closed.**

---

## Session Dev-49 · 2026-06-23

**Focus:** Gathering crew notification controls, member preferences, filter engine, Host UX polish, Gatherings announcement draft.

**Opening incident — Shamwedensday:**
- Mohamed Walli found the Dev Controls panel (left on by Brian), created "Shamwedensday" gathering, registered himself. Purged via `POST /gatherings/purge-all` with `host_id: "Mohamed Walli"`. No D1 admin tools in portal — flagged as Dev-50 opener.
- Walli's instinct was valid: "I just want to find anyone to play" = the open broadcast use case. Proved the need before launch.

**Gathering crew notification controls — full implementation:**

**Architecture decisions:**
- `bfw=Yes` (commissioner channel) kept separate from Gathering open broadcasts — needs its own opt-in field.
- New Jotform Membership field: **GatheringAlerts** (QID 26, field name `gatheringalerts`), hidden, Yes/No. Default: Yes (opt-out model — blank = Yes in parser).
- Two hosting modes: **Invite a Crew** (named crew, targeted notify) vs **Open to Members** (`fill_list_enabled=true`, notifies all `gatheringAlerts=Yes` members).
- Notification type `gathering_open_invite` added for open broadcasts — separate from `gathering_invite` (crew-only).

**Worker changes (deployed, paste confirmed):**
- `GET /gatherings` — `?gathering_alerts=true` param: includes `fill_list_enabled=1` Gatherings in results.
- `POST /gatherings/:id/cancel` — moved notifications Worker-side. Crew mode: notifies full `crew_members` via OneSignal tag filter. Open mode: notifies Yes/Sub registrants only. Removes stale `gatheringRegData` dependency.
- `GET /members/:player_id/prefs` — fetch Tier-2 prefs from `member_preferences` D1.
- `PUT /members/:player_id/prefs` — upsert Tier-2 prefs.

**D1 migration (Entry 4, run by Brian):**
- `member_preferences` table: `player_id TEXT PK, prefs TEXT DEFAULT '{}', updated_at TEXT`.

**Portal changes (v3.16.31 → v3.16.41):**
- `memberData` parser: `gatheringAlerts` field from QID 26. Opt-out default: blank = Yes.
- `loadGatherings`: passes `&gathering_alerts=true/false`; fetches `member_preferences` prefs before filtering; `fillListEnabled` added to gatheringData normalization.
- **Create form mode selector**: 👥 Invite a Crew / 📢 Open to Members pill buttons with subtitles ("Pick specific people" / "Anyone available can join"). `_hostMode` state var. `setHostMode()` shows/hides crew picker vs open explanation.
- `submitNewGathering`: open mode skips crew creation, notifies all `gatheringAlerts=Yes` members with `gathering_open_invite` type. Crew validation and capacity check gated to crew mode only.
- Cancel: portal-side notification removed — Worker handles it.
- `buildAnnouncementsHTML`: `gathering_open_invite` visible to `gatheringAlerts=Yes` members only.
- **⚙️ Gear button**: now visible to all logged-in non-guest members (was commissioner-only). `updateAdminNav()` updated. Title changed to "Settings".
- **screen-admin restructure**: My Preferences section above Commissioner Admin. Commissioner admin cards wrapped in `#commissioner-admin-section` div, hidden for non-commissioners. `showScreen('admin')` toggles visibility based on `isCommissioner()`.
- **My Preferences card**: 🔔 Gathering Alerts toggle (On/Off, writes to Jotform QID 26 via edit API, optimistic update + revert on failure). Filter panel shown when Alerts is On.
- **Declarative filter engine** (`gatheringFilters` rule array in `member_preferences`):
  - `FILTER_FIELDS`: day, time, format, venue, capacity, host extractors.
  - `FILTER_OPS`: in, nin, eq, neq, gte, lte.
  - `gatheringMatchesFilters(g, filters)` — AND logic across rules, pass-through on unknown field/op or null value.
  - **Exclusion paradigm** (opt-out): all chips green by default, tap to exclude. Rules use `op: 'nin'`. Empty rule array = all Gatherings visible.
  - Three filter dimensions in UI: 📅 Day (Mon–Sun chips), ⏰ Time (Morning/Afternoon/Evening), ⛳ Format (Individual/4-Man/2-Man/Best Ball/Match Play).
  - Hint text: "All open Gatherings visible" or "Hiding: Days: Mon, Tue · Formats: Match Play".
  - Instruction: "Everything is on by default. Tap to hide..."
  - `toggleFilterChip()` — adds/removes values from nin exclusion rules, drops rule when empty, saves to D1, re-runs `refreshGatherings()`.
  - `renderFilterPanel()` — renders chip states and hint from current `_memberPrefs`.
- **Active restore fix**: `restoreActiveIfNeeded()` now wired to `submitRegistration` (Jotform events) on Yes/Sub, not just Gathering registrations. Mike Nagle diagnosed as trigger for fix.

**Announcement drafted (ready to send when gathering_panel_live flipped):**
- Push + portal announcement card to be sent manually via Admin → Push Notification to All Members.
- Copy locked. Signed off: "More golf. Less group chat. / Questions or feedback? Text Brian."

**Carry-forward for Dev-50:**
- **D1 admin tools** (priority — must have before real Gathering volume): portal Commissioner Admin card showing all active Gatherings (any host), per-Gathering registration detail, delete button (PIN-gated). Also: member_preferences viewer (who has Gathering Alerts on, what filters set).
- Flip `gathering_panel_live` KV flag → send announcement.
- Venue dropdown (D1-backed: BSGC, Whitetail, Moselem Springs, Other).
- Gathering Templates implementation (§20).
- deploy.html — copy instruction to BFM repair (flagged Dev-48 close).
- Gathering attachments via R2 (backlog).
- Crew onboarding spec §5 (own session).

**Final portal version: v3.16.41 · 2026-06-23**
**Dev-49 fully closed.**

---

## Session Dev-49 Addendum · 2026-06-24

**Additional work shipped (v3.16.42 → v3.16.56):**

**Tee time status (Suggested/Confirmed):**
- D1 migration Entry 5: `tee_time_status TEXT NOT NULL DEFAULT 'confirmed'` on `gatherings`.
- Create and edit forms: segmented toggle (Suggested / Confirmed) replacing two-button layout.
- Crew card: `(suggested)` indicator beside time when not confirmed.
- Host panel: amber `📅 Suggested` / green `✅ Confirmed` badge on time line.
- **🔒 Confirmed Tee Time — Notify Crew** button in host panel when Suggested — PATCH to confirmed, notifies Yes/Sub crew via push (`gathering_date_changed` type), re-renders immediately.
- Tee time confirmed notification body: `"[title]" is confirmed — [date] at [time]. See you out there!`

**Crew → Host note (built then unwound):**
- D1 migration Entry 6: `host_note TEXT` on `registrations` (schema kept, UI removed).
- Built: textarea on crew cards, host panel note display per player. Removed: same session — pivoted to Text the Host as the right mechanism. D1 column and Worker route preserved.

**Text the Host:**
- 💬 Text [FirstName] link in Gathering card meta row for non-host members with a known cell.
- Uses `sms:` URL scheme — opens native messaging. No BF infrastructure. BirdieFriends handles structure, iMessage handles nuance.

**Gathering card UX:**
- Compact horizontal meta row for Gatherings: `📍 venue · ⛳ format · 💬 Text [host]` — single line instead of three.
- Mode selector (Invite a Crew / Open to Members) and tee time toggle both converted to segmented controls.
- Button subtitles: "Pick specific people" / "Anyone available can join"; "Still working it out" / "Tee time is locked".

**Gathering Alerts UI:**
- ⚙️ Gear screen: My Preferences card now collapsible/expandable via chevron ▸/▾.
- Filter panel hidden by default, expands on tap, resets collapsed each time screen opens.
- Commissioner Admin cards now properly hidden for non-commissioners (were exposed when gear became visible to all).

**Registration bug fixes:**
- `regData` sync bug: after Gathering registration, `regData` (load-time snapshot) wasn't updated — card stayed unregistered. Fixed by also upserting into `regData` in `submitGatheringRegistration`.
- Gathering Unregister button was calling `changeRegistration` (Jotform path) with synthetic D1 ID — routed to wrong backend. Fixed to `submitRegistration('No')` → correct D1 path.
- Schedule tab "Can't Make It" had same crossover — fixed with source check.
- `myGatheringReg` scope error: defined in `buildEventCard` but used in `buildActionButtons` (separate function). Fixed by adding local lookup in `buildActionButtons`.
- Edit form tee time status read used `.style.background` (inline style) — broken after switch to CSS classes. Fixed to `.classList.contains('seg-btn-active')`.
- `restoreActiveIfNeeded()` wired to Jotform event registration (Yes/Sub) — previously only Gathering registrations triggered it.

**Architecture correction (confirmed Dev-49):**
- `Host: Yes` in Jotform Membership (QID for host field) is a **collector/tag**, NOT a gate. It records who has hosted a Gathering — for future analytics, targeted communications, host reputation features. It does NOT gate access to the Gather UI.
- The actual gate is the `gathering_panel_live` KV flag (commissioner-controlled, whole community).
- Any member can host once `gathering_panel_live` is true. Host:Yes is written as a side-effect of hosting, not a prerequisite. Previous session log entries and documentation referencing Host:Yes as a gate were incorrect.
- Walli (Mohamed Walli) correctly received Host:Yes after creating a Gathering — this is the intended behavior.

**Carry-forward for Dev-50 (updated):**
- **D1 admin tools** (priority): all Gatherings view, per-Gathering registrations, delete button — must have before real volume builds.
- Flip `gathering_panel_live` KV flag → send Gatherings announcement.
- Fix Mike Nagle InActive status in Jotform Membership (manual).
- Venue dropdown (D1-backed: BSGC, Whitetail, Moselem Springs, Other).
- Gathering Templates implementation (§20).
- deploy.html — copy instruction to BFM repair.
- Gathering attachments via R2 (backlog).
- Crew onboarding spec §5 (own session).
- Original Lord's Valley unregister→re-register bug (non-Gathering Jotform events) — may still exist, investigate.

**Final portal version: v3.16.56 · 2026-06-24**
**Dev-49 fully and truly closed.**

---

## Session Dev-49 Final Addendum · 2026-06-24 (post-launch)

**Gatherings went live during this session.** Announcement sent via Push Notification to All Members. Push reported `invalid_player_ids` for one stale token (Jeff Rapp) — led to a chain of improvements.

**Push notification reliability improvements (v3.16.57–v3.16.60):**

**v3.16.57 — Stale token error handling**
`osSend()` previously returned `ok: false` for any `data.errors` from OneSignal, including `invalid_player_ids` which is a non-fatal warning (push still delivered to all valid tokens). Fixed to treat `invalid_player_ids`-only errors as warnings. Broadcast result shows `✅ Sent to N subscribers (1 stale token — check Push Subscribers)` instead of ❌ failure toast.

**v3.16.58 — Notification settings moved from ⓘ About to ⚙️ Gear**
Push Notifications card (subscribe/unsubscribe, Sync, How to fix, Reset) relocated from About/Info screen to Gear/Settings under My Preferences. About screen is now information-only. `updateAboutNotifUI()` now also called on Gear open. Same element IDs preserved — no JS logic changes needed.

**v3.16.59 — Auto-heal pushId mismatch on Gear open**
`updateAboutNotifUI()` now compares current `OneSignal.User.PushSubscription.id` vs stored Jotform `member.pushId`. On mismatch, silently writes the new ID to Jotform and updates local memberData. Player sees "🔄 Refreshing subscription…" briefly then "🔔 Notifications are ON". Non-blocking — failure is swallowed.

**v3.16.60 — Auto-heal on portal open (primary trigger)**
`osIdentityRefresh()` (runs 3.5s after every portal load via `osHealthCheck`) upgraded to compare current OneSignal ID against Jotform `member.pushId`, not just localStorage cache. localStorage can be cleared independently — Jotform is the source of truth. Now heals stale IDs on every portal open, not just when the member visits Gear. Console logs `[OS] pushId synced to Jotform for [player] (was stale)` when a fix is applied.

**Self-healing flow (complete):**
1. Player opens portal → `osIdentityRefresh` runs silently 3.5s later
2. Current OneSignal ID compared to Jotform pushId
3. Mismatch → writes new ID to Jotform, updates local memberData
4. Player never sees anything — just works

**Remaining gap (Dev-50):** Proactive admin audit — batch-check all member pushIds against OneSignal subscription API independently of sends. Commissioner tool to surface stale tokens before a push fails. Individual 📲 Test button per player already exists in Push Subscribers card for manual verification.

**Architecture note — push notification resolution path:**
- 📲 Test button (Push Subscribers admin card): immediate per-player confirmation
- Auto-heal (portal open): self-corrects on next portal visit
- ⚙️ Gear → Sync: manual fix, writes current ID to Jotform
- ⚙️ Gear → Reset & start over: full re-subscription flow
- Dev-50: proactive batch audit for commissioner visibility

**Final portal version: v3.16.60 · 2026-06-24**
**Dev-49 session closed. Gatherings is live.**

---

## Session Dev-50 · 2026-06-24

**Focus:** Gear screen cleanup, Commissioner Admin restructure, Gatherings Admin D1 tools (first pass).

**Confirmed done from Dev-49 carry-forward:**
- `gathering_panel_live` KV flag flipped → Gatherings live for all members
- Mike Nagle InActive status fixed in Jotform
- Lord's Valley unregister→re-register bug confirmed resolved (Dev-49 fix held)

**Gear screen / My Preferences:**
- 🔔 Notification Settings card migrated from About screen to Gear (My Preferences section). `updateAboutNotifUI()` now fires on Gear open. About screen is now information-only.
- Notification Settings card made collapsible (same pattern as Gathering Alerts). Header summary shows "On — tap to manage" / "Off — tap to turn on" reflecting live subscription state.

**Commissioner Admin restructure — Dev Controls dissolved:**
All tools redistributed into four labeled sections:
- **Communicate:** Push Notification to All, Broadcast Text to All, Announcement Feed, Push Subscribers
- **Gatherings:** 🏌️ Gatherings Admin (Host Management Panel + Gathering Test Mode + D1 tools)
- **Event Day:** Event Day Controls card (Live Panel Event Control + Live Scorecard Test Mode), Scorecard Check
- **System:** Start Claude Session, Maintenance Mode, Notification Prompt Reset, Request an Event
- "Dev Controls" card eliminated — contents fully redistributed
- "New Events Reset" tool removed entirely (dev utility, no production value)
- "Event Control" renamed to "Live Panel Event Control"
- Maintenance Mode promoted to its own top-level System card

**Gatherings Admin D1 tools (first pass):**
- New Worker route: `GET /gatherings/all?pin=7797` — commissioner view of all active Gatherings, all hosts, with crew size + yes/sub/no counts via JOINs. PIN-gated.
- New Worker route: `DELETE /gatherings/:id/admin?pin=7797` — hard-delete any Gathering (registrations + crew + crew_members + gathering row). PIN-gated.
- Portal: "📋 All Active Gatherings" sub-section in Gatherings Admin. Auto-loads on first expand, Refresh button. Groups rows by host. Per-Gathering actions: 🗑️ Delete (confirm dialog), 📣 Broadcast to Crew (pre-fills Push composer), 👥 Registrations (alert with yes/sub/no list).
- Bugs fixed: `g.format` → `g.gathering_type`, `g.capacity` → `g.size` (D1 column names differ from portal display labels).

**Carry-forward for Dev-51:**
- Test Data Seeder — seed `TEST — ` prefixed Gatherings with varied formats/modes/registrations for admin tool verification. Paired pruner deletes only `TEST — %` rows, safe against real member data.
- Proactive pushId health check (Dev-49/50 carry-forward) — batch validator + admin tool.
- Venue dropdown (D1-backed: BSGC, Whitetail, Moselem Springs, Other).
- Gathering Templates §20 implementation.
- deploy.html — copy instruction to BFM repair.

**Final portal version: v3.16.67 · 2026-06-24**
**Dev-50 closed.**

---

## Session Dev-50 Addendum · 2026-06-26

**Live production issues resolved same session:**

**v3.16.68 — Open mode Gathering visibility bug fixed**
Chooch Wernett created "Woodstone this sunday" as an Open mode Gathering — push notification reached Dave Sherwin and others, but the card was invisible in the portal. Root cause: `gaParam` was derived from the member's `gatheringAlerts` preference (`Yes/No`), gating both notification delivery AND card visibility. Members with Gathering Alerts off couldn't see Open mode Gatherings at all — notification with no card to act on.

Fix: hardcode `gaParam = 'true'` in the portal Gatherings fetch so all active members always receive Open mode Gathering cards. Gathering Alerts preference now controls **notifications only**, not card visibility. Crew-mode Gatherings (invite-only) are unaffected — they remain visible only to invited crew members.

**Mohamed Walli push notifications:**
Android Chrome had `birdiefriends.com` blocked at the site-level permissions layer (prior blocking event). Unblocked via Chrome Settings → Site Settings → Notifications. Gear → Notification Settings → Sync Notifications re-registered his token. Confirmed working.

**Schema note for future sessions:**
D1 `gatherings` table uses `size` (not `capacity`) and `gathering_type` (not `format`). Portal display labels differ from D1 column names — always verify against Worker INSERT statements, not portal UI copy.

**Final portal version: v3.16.68 · 2026-06-26**
**Dev-50 fully closed.**

---

## Session Dev-51 · 2026-06-26

**Focus:** Commissioner Admin tooling improvements, proactive pushId audit, Gatherings Admin UX, venue autocomplete with Google Places.

**Bugs fixed:**
- **Admin section visible after player switch:** `commissioner-admin-section` visibility was only re-evaluated inside `showScreen('admin')`. If Gear was already open when switching players (e.g. Brian → Walli on Walli's phone), admin tools stayed visible. Fixed by adding explicit visibility update directly in `selectPlayer()` after `renderAll()`. (v3.16.69)

**Push ID Audit:**
- **Manual audit tool (🔍 Audit button):** Added to Push Subscribers card header. Fetches live OneSignal subscriptions, cross-references against Jotform pushIds, classifies each active BFW=Yes member as Valid / Stale / Missing. Stale rows get a 🗑️ Clear button that writes empty string to Jotform QID 23 — auto-heal picks up the correct ID on next portal open. (v3.16.69)
- **Silent daily auto-audit:** `osCommissionerAudit()` added to `osHealthCheck` — fires 5s after portal load when commissioner is logged in. Gated by `bf_push_audit_YYYY-MM-DD` localStorage key — runs once per calendar day. Silently clears any stale tokens, shows a single toast if anything was cleared. Ron Grow's stale token found and cleared on first run. (v3.16.70)

**Gatherings Admin card improvements:**
- **💬 Text Host:** Host name header now includes an `sms:` link to host's cell from `memberData`. Shown only when cell is on file.
- **Capacity fill indicator:** Yes count now shows as "X/Y" when size is set (e.g. "4/8"), plain count for uncapped Open Gatherings.
- **Inline Registrations:** Replaced `alert()` with inline toggle panel below action row. Shows Yes/Sub/No groups with player names. Button toggles to "👥 Hide" when open. (v3.16.71)

**Venue Autocomplete:**
- Replaced plain `<input>` venue fields in both create and edit forms with smart autocomplete.
- `GET /venues` Worker route added — returns active venues from D1 `venues` table ordered by `sort_order`.
- `loadVenues()` fetches D1 list once per session, pre-warmed on `openHostPanel()`.
- On focus (empty field): shows full "Your Courses" D1 list immediately.
- On type: narrows D1 matches + fires Google Places `AutocompleteSuggestion` API (new API — migrated away from deprecated `AutocompleteService`).
- Smart golf hint: appends " golf" to query only if query doesn't already contain golf/country/club/links.
- Result filter: main text only, keywords golf/country/club/links — catches Woodstone, Lord's Valley, etc. while filtering noise.
- Free-form hint text below field: "Can't find your course? Just type the name and continue."
- Google Places API key: `AIzaSyAn1TR2p6JbWR2fr5ydhkurygKpYU9HYtw` (restricted to `https://birdiefriends.com/*`).
- D1 migration required (Entry 7): `venues` table with BSGC, Whitetail, Moselem Springs, Woodstone, Lord's Valley, Other.

**Carry-forward for Dev-52:**
- **D1 migrations to run** (Cloudflare Console → D1 → birdiefriends-gatherings):
  ```sql
  CREATE TABLE IF NOT EXISTS venues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 99
  );
  INSERT INTO venues (name, sort_order) VALUES
    ('Blue Shamrock Golf Club', 1),
    ('Whitetail Golf Club', 2),
    ('Moselem Springs Golf Club', 3),
    ('Woodstone Country Club', 4),
    ('Lord''s Valley Country Club', 5),
    ('Other', 99);
  ```
- **Venue manager in Gatherings Admin** — add/deactivate venues without D1 Console. Planned this session, not built.
- **Worker paste** — `GET /venues` route added to worker this session; confirm it was pasted into Cloudflare dashboard.
- Venue dropdown: test new Places API (`AutocompleteSuggestion`) on device — Lord's Valley investigation ongoing (not in Google Places data).
- Gathering Templates §20 implementation.
- Gathering attachments via R2 (backlog).
- Crew onboarding spec §5 (own session).

**Final portal version: v3.16.78 · 2026-06-26**
**Dev-51 closed.**

---

## Session Dev-52 · 2026-06-27

**Focus:** Venue Manager (Gatherings Admin), Gathering Templates (§20), text formatting enforcement.

**Pre-session D1 migrations (Brian ran in Cloudflare Console):**
- `gathering_templates` table created (id, host_id, name, title, venue, capacity, gathering_type, description, crew_snapshot, created_at)
- `venues` table confirmed populated: Blue Shamrock Golf Club, Whitetail Golf Club, Moselem Springs Golf Club, Woodstone Country Club, Lord's Valley Country Club, Other (6 rows, IDs 1–6)

**Worker changes (deployed, paste confirmed):**
- `GET /venues?pin=7797` — commissioner view returns all venues (active + inactive); no pin returns active only (supersedes old active-only route)
- `POST /venues` — PIN-gated, adds new venue at sort_order 90 (just before Other at 99)
- `PATCH /venues/:id` — PIN-gated, toggles active status (0/1)
- `POST /gathering-templates` — save template; host_id, name, title, venue, capacity, gathering_type, description, crew_snapshot (JSON)
- `GET /gathering-templates?host_id=X` — list host's templates, crew_snapshot parsed from JSON
- `DELETE /gathering-templates/:id?host_id=X` — delete with server-side host_id ownership check

**Portal changes (v3.16.78 → v3.16.83):**

**Text formatting utilities:**
- `toTitleCase()` — capitalizes words, skips articles/prepositions mid-string (a, an, the, at, by, for, in, of, on, or, and, but, nor, to, up, as, is)
- `toSentenceCase()` — capitalizes first letter only
- Applied in `submitNewGathering` and `submitEditGathering`: title → title case, format → title case, description → sentence case, venue untransformed
- Also applied to template name on save

**Gathering Templates (§20 — fully implemented):**
- `_hostTemplates` module-level cache, loaded on every Host panel open via `loadHostTemplates()`
- `📋 From Template` button — appears alongside New Gathering when host has ≥1 template; styled as dark green CTA pill matching New Gathering
- `showTemplatePicker()` — sheet listing saved templates as host-gathering-card style cards with green meta chips (venue, format, crew count); ⛳ Use Template + Delete action strip
- `applyTemplate()` — pre-fills create form (title, venue, capacity, format, description); date/time always blank; resolves crew snapshot against current memberData; silently drops departed members with toast count; sets crew mode
- `promptSaveAsTemplate()` — fires after every successful create via native prompt (default = Gathering title); also triggered by ☆ Template button on existing host panel cards
- `saveTemplate()` — POST to Worker, refreshes `_hostTemplates` cache silently
- `deleteTemplate()` — confirm → DELETE → re-renders picker or returns to list if last template deleted
- ☆ Template secondary action added to each Gathering card in host panel action row

**Venue Manager (Gatherings Admin card):**
- New 📍 Venue Manager collapsible sub-section (auto-loads on first expand)
- `loadAdminVenues()` — fetches GET /venues?pin=7797, renders rows with Active/Inactive badge + Deactivate/Reactivate button
- `adminToggleVenue()` — PATCH /venues/:id, clears `_venues` autocomplete cache on change
- `adminAddVenue()` — POST /venues, name auto-title-cased, clears cache, refreshes list; Enter key supported
- 📋 All Active Gatherings also converted to collapsible sub-section (auto-loads on first expand, max-height 420px with scroll)
- `toggleAdminSubSection()` helper added for both sub-sections

**Style fixes:**
- From Template button: matches New Gathering CTA pill exactly (slightly darker green gradient to distinguish)
- Template picker cards: use host-gathering-card class (green left border, #f7fbf9 background, shadow), green pill chips for meta, action strip matches rest of host panel

**Carry-forward for Dev-53:**
- Chooch IRL testing of Templates — gather feedback
- Crew name display on member-facing Gathering card (observed in Dev-52 screenshots — "Rough Riders" visible in host panel but absent from member card)
- Session versioning discipline: local portal_version.txt must be re-fetched from GitHub at start of each deploy sequence within a session to avoid duplicate version numbers (happened twice this session)

**Final portal version: v3.16.83 · 2026-06-27**
**Dev-52 closed.**

## Dev-52 Addendum · 2026-06-27 (post-close backlog work)

**Backlog review and cleanup:**

**Killed:**
- CttP negative distance input validation — deferred indefinitely
- Push notification message copy audit — deferred
- Live panel UX overhaul — deferred
- Chooch IRL template feedback as a tracked item — will surface naturally
- Session versioning discipline — **fixed**: deploy script now always fetches `portal_version.txt` fresh from GitHub via `subprocess.check_output(curl)` before computing next version. Never reads local file. Session Starter updated and pushed.

**Shipped during backlog review (v3.16.84 → v3.16.85):**

**v3.16.84 — Crew name on member-facing Gathering card**
- `buildEventCard()` now renders `👥 {crewName}` in the Gathering meta row for crew-mode Gatherings (`fillListEnabled = false`). Open-mode Gatherings excluded (no crew name). Data was already in `gatheringData.crewName` — just not surfaced on the card.

**v3.16.85 — Type-aware Announcement Feed styling**
- `buildAnnouncementsHTML()` rewritten with `typeConfig()` lookup — each `bf_type` gets its own icon, accent background, border color, and label:
  - 🦅 Birdie Alert (gold), 🎯 Closest to Pin (green), ⛳ Gathering Invite (blue), 📢 Open Gathering (blue), 📅 Date Changed (amber), ❌ Cancelled (red), 🎉 You're In! (green), 🗓️ New Event (green), ⏰ Reminder (green), 📣 Broadcast (neutral)
- Timestamp now includes time of day, not just date
- Entries render as rounded pill cards with matching accent fill — replaces flat divider-row list

**Live Feed backlog item killed** — existing Announcements card *is* the feed; type-aware styling delivers the same value without a second component.

**Open backlog carrying to Dev-53:**
- Push notification preference center — single Settings home for all BF notification types (Gathering Alerts + BF event notifications unified)
- Player picker rethink — mirror gathering crew selector / live panel pattern

**Final portal version: v3.16.85 · 2026-06-27**
**Dev-52 fully closed.**

---

## Session Dev-53 · 2026-07-01

**Focus:** Gathering issues surfaced by Chooch's IRL recurring-host use (Templates, crew naming, response clarity).

**Host Gathering Archive (v3.16.86):**
- Expired Gatherings (`dt < now`) now drop out of the main Host panel list automatically — pure client-side filter against `gatheringData`, no D1 change.
- New **📦 Archive (N)** link opens a read-only view of past Gatherings (info + tappable Yes/Sub/No response breakdown). No Edit/Invite/Cancel — those don't apply once the round is over. ☆ Save as Template kept available (reusing a good past one-off is still useful).

**Clickable crew name + crew-name title-case bug (v3.16.87):**
- New `showCrewMembers(crewId, crewName)` modal — tap `👥 [crew name]` (Host panel active list, Archive list, and member-facing event card) to see the roster (avatar initials, name, inactive flag), fetched from `GET /crews/:id/members`.
- **Bug found:** the Dev-52 title-case mandate only covered Gathering title/type/description and template names — it never touched `dismissCrewSaveDialog()`. Crew names typed into the "💾 Save this Crew?" prompt were stored verbatim. Root-caused as a coverage gap, not a regression. Fixed at the point of capture.
- Chooch's existing "Rough riders" crew corrected to "Rough Riders" via one-time manual D1 UPDATE (Brian ran in Console) — code fix only prevents new occurrences, doesn't retroactively fix stored data.

**Recurring-host template duplication (v3.16.88):**
- Chooch's "CGA Tuesday Golf League" had spawned two near-identical templates (different venue spelling, one missing its crew snapshot).
- **Root cause:** `promptSaveAsTemplate()` auto-fires after *every* successful Gathering create, regardless of whether a template with that name already exists — a recurring host gets re-prompted every single occurrence.
- **Fix:** auto-fire path now skips the prompt when a same-name template already exists for the host (case-insensitive match against `_hostTemplates`). The explicit ☆ Template button (manual save from an existing card) is unaffected — still always prompts, so a host can deliberately save a genuine variant.
- Cleaned up Chooch's data directly via the Worker API: deleted the incomplete duplicate (id 3, empty crew snapshot), kept the complete one (id 4, 10-person crew snapshot).

**Gathering "Can't Make It" status indicator (v3.16.89):**
- **Bug found:** Gatherings show a status badge above the three response buttons when Yes/Sub, but a "No" response fell through to the exact same three-button block as never having responded at all — no badge, no indication.
- **Fix:** "No" now shows a `✕ Can't Make It` badge and highlights the active button (`btn-selected` ring), while keeping all three buttons live so the response can still be changed — matches the Gathering's always-three-way toggle model.

**Carry-forward for Dev-54:**
- Push notification preference center — single Settings home for all BF notification types (carried from Dev-52).
- Player picker rethink — mirror gathering crew selector / live panel pattern (carried from Dev-52).
- Optional: PIN-gated crew-rename route, if manual D1 fixes for crew names recur.

**Final portal version: v3.16.89 · 2026-07-01**
**Dev-53 closed.**

## Dev-53 Addendum · 2026-07-01 (continued — GLS photo capability planning)

**Focus:** Debate-and-document session on the recurring "photo workflow" open item from the BZP track — charted the full self-service design, then staged it down to a small, buildable first proof case, and synced the resolution back into the bizplan docs.

**Design arc (full detail in `BF_EventSite_Schema.md` §9f and §9g):**
- Reframed the long-open "automated base tier vs. manual premium tier" bizplan question — it wasn't actually a binary. Settled model: self-service capture (metadata-light, human-tagged at the moment of capture) + Host-owned curation that's never the founder's job for community Gatherings.
- §9f — general self-service system: Section Manager (golf sections auto-populate from Rounds data, non-golf sections Host-defined), BF Upload (first-party capture, avoids lossy delivery channels that strip EXIF), Timeline vs. Scrapbook split (not every photo needs precise placement), Host cut/no-cut review. Three infrastructure questions flagged open: metadata store (D1 recommended), photo storage (GitHub Pages vs. R2), site rendering (data-driven template vs. static generation).
- §9g — staged the design down to a real, small, buildable first test: **BF Series/Cup capture-first pilot.** No Section Manager needed (rounds already exist as GS data); 3 fixed story sections (working titles, not locked): Pre-Competition, On the Course, Post-Round (West Saloon). Capture button lives inside the existing Live Panel, inheriting the same Tier-2 eligibility gate already governing Scorecard/CttP — any registered player on the course can use it, no new access model. Brian captures the winner shot himself, tagged with the existing `trophy_moment` role. Curation happens in a Commissioner Admin collection card (same shape as Gatherings Admin) before publish. Publish inserts the approved photo collage into GolfScorer's existing `results.html` output — flagged as a cross-dependency on GS's own codebase (separate from portal.html), to be scoped in a session where GS source is actually available.
- WallyCup identified as the eventual flagship-scale target (full GLS-equivalent treatment), timed alongside the already-known-necessary GS production re-architecture — deliberately *not* the first build.
- Backlog item surfaced but not scoped in: auto-expire the Live Panel eligibility window (safety net alongside manual close) — would improve Scorecard/CttP eligibility too, not just photos.

**BZP sync (this session's last task):**
- `BF_BizPlan_GateLog.md` — Gate 1 Open item resolved into Settled (photo workflow model, with the build-cost/effort question narrowed and left genuinely open); Gate 4 Open item and Cross-Gate Risk Register row both updated to point at the resolved model and the pilot as the mechanism for getting a real cost number.
- `BF_Capability_Inventory.md` — near-term roadmap and commercial roadmap photo entries rewritten to describe the two-stage (pilot → flagship) model instead of the old single automated-ingestion description; version bumped to v0.8.
- `BF_BizPlan_Vision.md` — left untouched; this was a tactical/viability-tracking sync (Gate Log, Capability Inventory), not a positioning change.

**Candidate launch dates (not committed to either):** BF Series Event #5 · 7/19/2026, or Event #6 · 8/16/2026.

**Carry-forward for Dev-54:**
- Build the BF Series/Cup pilot: Live Panel capture button (reusing existing Tier-2 eligibility gate), small D1 table for photo metadata, Commissioner Admin collection/curation card.
- GS `results.html` photo-collage insertion — needs a session with GolfScorer source available (separate local app, not fetchable from this session).
- Auto-expire Live Panel eligibility window — small standalone item, affects Scorecard/CttP too.
- Decide (at build time, not before): whether the 3 story-section labels are hard-fixed or per-event editable.

**Chat rename suggestion for next session:** `Dev#54 - BF Series Photo Pilot`

**Dev-53 fully closed (addendum included).**

## Session Dev-54 · 2026-07-03/04

**Focus:** Built the BF Series photo pilot end-to-end (D1 + R2 architecture, capture, curation, video support). Surfaced and fixed a recurring-Gathering UX/notification bug via a new Repeat feature, iterated through several rounds of design polish on it. Investigated two separate live infrastructure outages (Cloudflare D1/Durable Objects, GitHub Pages). Closed with an architecture audit of device-local state that's incomplete — carried forward as the next session's primary focus.

**Photo Capture architecture (D1 + R2, deliberately bypasses Jotform):**
- New `event_photos` D1 table (`birdiefriends-gatherings` DB) — `event_name`, `section` (`pre_competition`/`on_course`/`post_round`), `r2_key`, `media_type`, `curation_status`, `is_trophy_moment`, `sort_order`. Schema logged as Entries 7–8 in `BF_Gatherings_Schema.sql`.
- New R2 bucket `birdiefriends-photos` (Standard storage class — Infrequent Access was considered and rejected, wrong fit for an actively-served gallery), bound to the Worker as `PHOTOS_BUCKET`.
- Four new Worker routes: `POST /photos/upload` (multipart, writes R2 + D1 in one request — no Jotform, no sync/polling step needed as a result), `GET /photos` (public reads forced to `curation_status='approved'` server-side, admin reads via pin), `PATCH /photos/:id` (curation), `DELETE /photos/:id` (permanent — deliberately separate from reject, which stays reversible), `GET /photos/serve/:id` (streams from R2, unapproved photos 404 without pin).
- Video support added same session: `media_type` inferred server-side from MIME type (never trusted from client), 25MB server-enforced cap (client-side duration/size checks are UX only), no thumbnail generation (no ffmpeg-class processing in a Worker — native `<video controls>` instead), no Range/seek support (fine at ~20s clip lengths).
- Portal UI: capture tool moved from buried Commissioner Admin → a Home-screen collapsible banner (Live-Panel visual pattern), gated to `isCommissioner()` only (i.e., Brian's profile specifically, not just "logged in"). Two capture entry points: classic file picker + upload button, and a quick-capture path (hidden camera input, auto-uploads on selection, no second tap).
- All Worker routes wrapped in try/catch after a live debugging session traced a generic Cloudflare 500 back to an actual D1 infrastructure incident (see below) — the try/catch itself was the right fix regardless of cause, since it turns future opaque crashes into real error messages.
- Live end-to-end test confirmed working: upload → R2 write → D1 insert → serve → curation gate (unapproved 404s publicly, approved 200s) — all verified via direct curl round-trip, not just UI observation.

**Infrastructure incidents (both external, not app bugs):**
- **Cloudflare D1/Durable Objects outage** (mid-session) — `D1_ERROR: Internal error while starting up D1 DB storage caused object to be reset`, confirmed via Cloudflare's own status page (D1 + Durable Objects both showing Degraded Performance, active ENAM incident). Diagnosed by testing two completely unrelated, long-stable D1 routes (Gatherings, Venues) and confirming they failed identically — proved database-wide, not photos-code-specific, before any rollback was attempted. Added `d1RetryRead()` — auto-retry wrapper for read-only D1 queries only (writes deliberately excluded — blind-retrying a POST risks double-applying a mutation if the first attempt actually succeeded before the error surfaced).
- **GitHub Pages deployment outage** (separate incident, later same session) — repeated failed/stuck-queued `pages build and deployment` runs, unrelated to content (confirmed via a `source/worker.js`-only commit, which touches nothing Pages serves, still triggering and failing a rebuild). Fresh pushes reliably cleared stuck queued runs (new commit cancels the old one via the workflow's concurrency group); plain re-runs did not. Resolved on its own after ~1 hour; no permanent mitigation needed since GitHub's Contents API (used by `/deploy`) is a separate subsystem from Actions/Pages and was never actually down — commits kept succeeding throughout, only the live-site rebuild was affected.

**Portal version display — hardened, recurrence closed out:**
- Same bug as Dev-45 (`portal_version.txt` disconnected from the actual on-page version string) recurred here. Root-fixed instead of re-patched this time: `portal.html`'s version spans now fetch `docs/portal_version.txt` live at `DOMContentLoaded` and populate themselves, rather than two hardcoded literals that had to be remembered and updated by hand on every version bump. `docs/portal_version.txt` added as a required file (previously `source/` only was a tracking doc, never read by the live page).

**Gathering fixes — guard + Repeat feature (multi-pass):**
- **Root cause investigated:** Chooch tried to edit an already-past Gathering's date forward to set up "next Tuesday," which fired a confusing date-changed → cancelled → new-invite notification burst to his crew within 3 minutes (traced via KV feed entries — two different gathering IDs, #27 cancelled then #30 created fresh under the same title).
- **Guard added:** `PATCH /gatherings/:id` now rejects a date-change if the Gathering's current `event_time` has already passed (409, clear error message).
- **Repeat feature built:** one-tap reuse from any Gathering card (any status — active or archived, not just past ones, after a real gap was caught: Charlie's exact scenario was wanting to repeat a still-*upcoming* card). Computes the next occurrence of the same weekday from *today* (not +7 from whatever old date happened to be on the card), inherits title/venue/format/crew, skips the New Gathering form entirely, confirms with a concrete preview (actual computed date + real audience count) before sending. Guard's error message updated to point at Repeat instead of Templates once it existed.
- **Discoverability iterated twice:** Repeat started buried inside Archive-only (invisible for the exact recurring-host use case it was built for) → promoted to a top-level action alongside New/From Template, via a purpose-built picker (not the full Archive) deduplicated by title so a host with months of the same weekly game sees one row per distinct series, not every historical instance.
- **Visual iterated twice more:** initial purple gradient action-bar replaced with a fixed icon bar matching the bottom nav's exact visual language (flat `--green-dark`, icon-top/label-below, no gradients) — then relocated from a bottom-footer position to blend directly under the sheet header, at Brian's request, since it read as a second competing nav bar at the bottom of the screen.
- **Button consistency pass:** all white/transparent "ghost" buttons in this panel (Repeat, Template, Cancel Gathering, Delete) migrated to two real semantic variants — `.btn-secondary` (light green, existing) for normal actions, new `.btn-secondary-danger` (light red fill) for destructive ones — replacing several one-off inline color overrides that had drifted inconsistent from each other. Scoped to this panel only; `.btn-ghost` itself untouched globally (used elsewhere in an 11,800-line file not audited this session).
- **Section labels added:** "Upcoming (N)" / "Past (N)" headers on the main list and Archive respectively, reusing the existing `.section-label` style already used in Admin — Brian had correctly flagged both views lacked any heading identifying what the cards represented.

**Architecture audit — "Parked syndrome" (open, carried forward):**
- Investigated at Brian's request after he suspected the "Parked" nav concept (bottom nav, one of five slots) might be poorly understood or simply unused.
- Finding was more decisive than expected: **`bf_hidden_events_<player>` is stored only in `localStorage`** — zero references anywhere in `worker.js`, never synced to D1/KV/Jotform. Usage is genuinely unknowable, including by Brian — not just hard to check, structurally invisible to every admin tool that exists.
- Confirmed via direct testing that this also breaks across Brian's own multi-device usage (laptop/iPad/phone) — parking on one device is invisible on another, since `localStorage` doesn't sync.
- Widened the audit per Brian's request ("what else suffers from this") — found two more instances of the same root problem: `bf_seen_events_<player>` (drives the "NEW" badge; reappears on a different device even after being seen) and `bf_first_load_<player>` (stamps "first ever use" per-device; logging into a second device for the first time floods every historical event back in as "NEW" simultaneously — arguably the most visible/jarring of the three).
- Cross-checked the rest of the app's `localStorage` usage and confirmed several other keys are *correctly* device-local and should stay that way: `bf_commissioner` (PIN-verified-this-device — syncing would be a security regression, not a fix), `bf_os_sub_id`/`bf_os_player`/`bf_os_health` (push subscription identifiers, inherently tied to one device's push endpoint), `bf_os_dismissed_` (notification-permission-prompt state, tied to device-level OS permission), `bf_player`/`bf_player_name` (who's logged in on this specific device).

**Carry-forward for Dev-55 — the actual next-session focus, per Brian's explicit request to close out documentation now so the next session deals with just this:**
- **Build:** consolidate `bf_hidden_events_`, `bf_seen_events_`, and `bf_first_load_` from `localStorage` into D1 — chosen over a KV-blob approach specifically because a normalized table directly answers "how many players actually use Parked" as a real query (`SELECT COUNT(DISTINCT player_id) ...`), which was the whole reason this investigation started, and because the naive version costs barely more effort than KV would here.
- **Proposed schema** (not yet run — needs a fresh-session D1 migration):
  ```sql
  CREATE TABLE player_event_state (
    player_id  TEXT NOT NULL,
    event_id   TEXT NOT NULL,
    state      TEXT NOT NULL CHECK (state IN ('parked','seen')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (player_id, event_id, state)
  );
  CREATE TABLE player_meta (
    player_id  TEXT PRIMARY KEY,
    first_load TEXT NOT NULL DEFAULT (datetime('now'))
  );
  ```
- **Scope of the client-side change:** small on purpose — none of the existing call sites across the app that check "is this parked" or "is this new" need to change. Only the insides of three existing helper-function groups need rewriting: `getDismissedEvents()`/`dismissEvent()`/`restoreEvent()`, `getSeenEvents()`/`markEventSeen()`/`markAllNewSeen()`, `getPlayerFirstLoad()`. Swap their `localStorage` calls for a fetch backed by an in-memory cache loaded once at login, same shape as how `gatheringData` is already loaded.
- **Explicitly NOT decided yet, worth resolving early next session:** whether "Parked" deserves its permanent bottom-nav slot at all once real usage becomes visible, versus folding into something lighter (e.g. auto-filtering cards already marked "Can't Make It," which wouldn't need its own gesture or storage). Fixing the sync bug makes the feature correct; it doesn't answer whether it should exist in its current form. Cheapest path to a real answer: ship the D1 fix, instrument it, look at actual usage in a few weeks before deciding.
- Do **not** re-litigate the Photo Capture architecture, Repeat feature, or Gathering guard next session — all fully built, deployed, and confirmed working as of this session's close. Only remaining Photo Capture item is the eventual `results.html` photo-collage insertion, which needs a session with GS source available (unrelated to Dev-55's actual focus).

**Final portal version: v3.17.01 · 2026-07-04**
**Dev-54 closed.**

## Dev-54 Addendum · 2026-07-04 (continued — RSVP button consistency + Parked-migration design)

**Focus:** Two small shipped fixes that landed after the original close-out was written, plus a full design pass on the Parked/Seen/FirstLoad migration plan — refined twice through discussion into something meaningfully simpler than the first sketch. No further dev work performed this addendum (budget-constrained) — this is a documentation-only update so the next session starts on the final, correct plan rather than an earlier draft of it.

**RSVP button consistency (v3.17.02–v3.17.03) — shipped, not carry-forward:**
- Same underlying principle applied to two response-state branches in `buildActionButtons()`: only show buttons for actions not yet taken. A status badge showing the current state made the matching action button redundant — worse, in the "Can't Make It" case it rendered *highlighted* as if inviting a re-click of something already done.
- **"Can't Make It" branch (v3.17.02):** removed the redundant `btn-selected` "✕ Can't make it" button. Now shows badge + the two switchable actions (Register, I Can Sub) only.
- **Already-registered (Yes/Sub) branch (v3.17.03):** previously collapsed to badge + a single generic "Unregister" button — discovered that button's `onclick` was already just `submitRegistration(...,'No')`, i.e. functionally identical to "Can't Make It" wearing a different label. Replaced with the actual two switchable actions directly (Yes↔Sub↔No), consistent with every other branch in the function.
- Both fixes scoped precisely to what was asked in the moment — no broader RSVP redesign attempted.

**Parked/Seen/FirstLoad migration — design finalized, supersedes the merge-based sketch in the main Dev-54 entry above:**
- Discovered a real, serious transition risk in the originally-planned migration that the main entry's carry-forward notes don't yet reflect: if `player_meta.first_load` is created lazily ("now," the first time a player's row is touched post-migration), every player would see every historical event flood back in as "NEW" simultaneously on launch day — the exact bug this whole investigation started from, but hitting the entire user base at once instead of one device at a time.
- **Fix, already agreed:** `player_meta` must be seeded in one deliberate bulk D1 insert *at migration time*, backdated to before any currently-active event was created — not left to populate itself per-player on first touch. This is a one-line but load-bearing detail; must not be skipped or forgotten during the actual Dev-55 build.
- **Parked/Seen data itself:** confirmed this cannot be centrally backfilled — it only ever existed in each player's own device's `localStorage`, never synced anywhere reachable. Initially discussed a client-side "capture trap" (each device reports its local data once, Worker unions it into D1) with careful merge semantics: union for Parked/Seen (sets — safe to combine regardless of which device reports first), "earliest wins" for `first_load` (a single timestamp, not a set — a later-reporting device must never overwrite an earlier true value).
- **Simplified further, this is the final design:** rather than full union/merge logic, first-device-to-report for a given player becomes the source of truth outright; any other device checks first (does this player already have rows in `player_event_state`?), and if so, skips capture entirely and just switches to reading/writing D1 from then on. Reasoning: the scenario the merge logic was protecting against — the *same* player using *multiple* devices for this specific low-traffic feature, with genuinely different state on each, in the narrow window before their first device migrates — is a small enough intersection that building for it solves a hypothetical, not a real cost. Brian is most likely the only genuine multi-device user of this feature; anyone else naturally converges on a primary device.
- **No new schema field needed for migration state** — "does this player already have rows in `player_event_state`" *is* the migration-complete check. Nothing extra to track, no flag to set or forget to set.
- **This also means no schema/logic difference between an existing player transitioning and a brand-new player onboarding** — a new player's device just "migrates" empty sets, which doubles as their first real D1 rows being created. One code path, not two.

**Carry-forward for Dev-55 — updated and final (replaces the corresponding bullet in the main Dev-54 entry above):**
- Build order: (1) run the `player_event_state` / `player_meta` D1 migration, including the bulk backdated `first_load` seed for all existing players — this must happen before any client code changes go live, not after; (2) rewrite the insides of `getDismissedEvents`/`dismissEvent`/`restoreEvent`, `getSeenEvents`/`markEventSeen`/`markAllNewSeen`, `getPlayerFirstLoad` to check-then-fetch-or-migrate against D1 instead of `localStorage`, per the first-device-wins design above; (3) confirm no call sites elsewhere in the app need to change — they shouldn't, all three helper-function groups keep their existing signatures.
- Everything else from the original Dev-54 carry-forward (schema shape, effort estimate, the still-open "does Parked deserve its nav slot" question) stands as written above — this addendum only replaces the migration-mechanics portion of the plan.

**Dev-54 fully closed (addendum included).**

---

## Session Dev-55 · 2026-07-05

**Focus:** D1-backed player personalization migration (Parked/Seen/FirstLoad), a real production version-display bug and its permanent fix, a full assessment sweep of every localStorage key and admin tool, and a resulting second round of the same D1 migration for two more findings.

**Player Personalization migration (Parked/Seen/FirstLoad → D1):**
- New D1 tables: `player_event_state` (`player_id, event_id, state['parked'|'seen']`), `player_meta` (`player_id, first_load`).
- New Worker routes: `GET /player-state/:player_id`, `POST .../migrate`, `POST .../event`, `POST .../seen-bulk`, and admin `POST /player-meta/seed?pin=` (fetches the live Jotform roster server-side, bulk-seeds `player_meta` with a backdated `first_load` — ran once this session, seeded 73 players to `2020-01-01`, re-runnable for stragglers).
- Migration pattern: first-device-wins. `migrated` boolean (row presence in `player_event_state`) tells the client whether to capture local `localStorage` state once via `/migrate`, or just read D1. No separate migration-complete flag needed — row presence *is* the check, which also means a brand-new player's first device migrating empty sets is indistinguishable from (and correctly doubles as) their first real D1 rows.
- Portal side: `_playerStateCache` (in-memory, loaded once via `loadPlayerState()` at login/portal-open) keeps `getDismissedEvents`/`dismissEvent`/`restoreEvent`/`getSeenEvents`/`markEventSeen`/`markAllNewSeen`/`getPlayerFirstLoad` fully synchronous — zero call-site changes needed anywhere else in the app.
- **Verified live end-to-end** same session: seeded roster confirmed via curl round-trip (migrate → event toggle → restore, all correct); Brian's own device (Brian Hager) did a real first-device capture — 14 Parked + 23 Seen events landed in D1 correctly, `first_load` stayed backdated.

**Real production bug — `docs/portal_version.txt` never deployed:**
- Root cause: the portal deploy script only pushed 3 files (`docs/portal.html`, `source/portal.html`, `source/portal_version.txt`) — copied verbatim from the Session Starter's reference script, which was never updated after Dev-54 added `docs/portal_version.txt` as a 4th required file. Result: the live app was running fully-correct v3.17.04 code the whole time, it just never got told its own version number — header stuck on v3.17.03 across phone, laptop, and even a fresh Incognito window (ruling out any caching explanation before the real cause was found).
- Diagnosed via GitHub's Contents API (uncached) confirming `docs/portal_version.txt` genuinely lagged `source/portal_version.txt` — not a CDN/propagation issue as first suspected.
- **Permanently fixed at the source of the recurring pattern**: `BF_Golf_Scorer_Session_Starter_current.md`'s reference deploy script now pushes all 4 files unconditionally, with an explicit comment flagging `docs/portal_version.txt` as the one the live app actually reads. Also fixed an adjacent bug in the same script: the version-bump patch number wasn't zero-padded (`v3.17.4` instead of `v3.17.04`).
- Third occurrence of the same root problem on record (Dev-45, Dev-54, Dev-55) — this time the fix lives in the script text itself, not just a note to remember.

**Full assessment sweep (every localStorage key + every admin tool, on request):**
- Confirmed correctly device-local (no action): `bf_commissioner`, `bf_player`/`bf_guest`/`bf_player_name`, `bf_os_sub_id`/`bf_os_player`/`bf_os_health`, `bf_os_dismissed_`, `bf_photo_banner_open`, `bf_pwa_first_launch_done`, `bf_install_nudge_dismissed`, `bf_push_audit_{date}`, `bf_inactivity_check`, `bf_swipe_tip_dismissed` (low-stakes judgment call — left local).
- **Found — Announcements dismissed (`bf_announcements_dismissed`):** was a single GLOBAL key, not even per-player. Migrated to D1 (`player_announcement_dismissals`), folded into the same `GET /player-state` response (`announcementsDismissed`/`migratedAnnouncements`) and the same `/migrate` call (extended to accept an `announcements` array). New routes `POST /player-state/:player_id/announcement` and `.../announcements-bulk`.
- **Found — Commissioner Sunday Checklist (`bf_sunday_done_{date}`):** device-local "handled" checkboxes for the notification-setup checklist — didn't sync across Brian's own devices. Migrated to D1 (`commissioner_checklist_state`), new PIN-gated routes `GET /commissioner-checklist?date=&pin=` and `POST /commissioner-checklist/toggle?pin=`. `sundayToggle()` rewritten with optimistic UI update.
- **Found and removed — `bf_fivesome_pending_{eventId}`:** not a sync bug — dead, write-only code. Set/cleared on registration but confirmed via full-file grep that nothing ever reads it; the real "you're the 5th player" banner is computed live from `regData` each render via `getCapacityStatus().fivePending`. Removed along with the now-pointless `seedFivesomeFlags()` function and its call site.
- All four D1 migrations for this session verified live via direct curl round-trips before moving on to docs.

**D1 migration (Brian ran in Cloudflare Console, this session):**
```sql
CREATE TABLE IF NOT EXISTS player_event_state (
  player_id  TEXT NOT NULL,
  event_id   TEXT NOT NULL,
  state      TEXT NOT NULL CHECK (state IN ('parked','seen')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (player_id, event_id, state)
);
CREATE TABLE IF NOT EXISTS player_meta (
  player_id  TEXT PRIMARY KEY,
  first_load TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS player_announcement_dismissals (
  player_id       TEXT NOT NULL,
  announcement_id TEXT NOT NULL,
  dismissed_at    TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (player_id, announcement_id)
);
CREATE TABLE IF NOT EXISTS commissioner_checklist_state (
  checklist_date TEXT NOT NULL,
  player_name    TEXT NOT NULL,
  done_at        TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (checklist_date, player_name)
);
```

**Docs updated this session:**
- `BF_Operations_Guide.md` — Portal localStorage Keys table rewritten (device-local vs. migrated-to-D1 vs. removed); new "Player Personalization (D1-backed, Dev-55)" architecture section; Known Issues rows for "Parked syndrome" and `portal_version.txt` both updated to reflect resolution/third-occurrence.
- `bf_architecture.html` — `d1` node description updated to list the full current table set and the personalization layer's purpose; added an explicit currency warning under the Migration Log that the ERD diagram itself still only shows the original Dev-43 Gatherings core (Entries 4–12+ not yet drawn in) — flagged as a known gap rather than silently left stale.
- `BF_Golf_Scorer_Session_Starter_current.md` — deploy script fix (see above), covered in its own commit earlier this session.

**Deferred (budget-conscious call, not forgotten):**
- Full SVG ERD redraw in `bf_architecture.html` to visually include venues, gathering_templates, member_preferences, event_photos, and all four Dev-55 tables. Already been stale since Dev-49 (predates this session) — sizable enough to warrant its own dedicated pass rather than folding into this sweep.

**Carry-forward for Dev-56:**
- Full `bf_architecture.html` ERD redraw (see above).
- Instrument real "Parked" nav-slot usage now that `player_event_state` is a real, queryable table (`SELECT COUNT(DISTINCT player_id) ... WHERE state='parked'`) — the original motivating question from the Dev-54 investigation, now actually answerable. Still explicitly undecided whether Parked deserves its own bottom-nav slot.
- Everything else from Dev-53/54 backlog not touched this session: push notification preference center, player picker rethink, GS `results.html` photo-collage insertion (needs a session with GolfScorer source available).

**Final portal version: v3.17.05 · 2026-07-05**
**Dev-55 closed.**

---

## Dev-55 Addendum · 2026-07-05 (continued — migration-integrity fix, routing bug, Engagement tool)

**Focus:** Closed a real data-integrity gap in the migration design from earlier in this same session (proxy registration could falsely mark a player "already migrated"), fixed a silent routing bug, and built a Commissioner Engagement tool to actually answer the "does anyone use Parked" question Dev-54 originally raised — directly in response to Brian's own instinct to test the personalization selector like Chooch's Repeat-feature mismatch: watch real behavior instead of assuming the design is right.

**Migration-integrity fix — proxy registration could falsely trip "already migrated":**
- Root cause: the `migrated` check earlier in this session was "does this player have any rows in `player_event_state`." Proxy registration (anyone registering *for* another player via the name-switcher — a normal, frequent action in this app) writes a real row under the target player's identity via `restoreEvent()`/`markEventSeen()` — before that player's own device has ever opened the app. That incidental row would falsely satisfy the row-presence check, causing the real player's actual first load to skip capturing their genuine local Parked/Seen history and silently lose it.
- Fix: added `migrated_at`/`announcements_migrated_at` columns to `player_meta` (D1 migration run by Brian), set only by `POST .../migrate` via `COALESCE` (never overwrites a genuine first-migration timestamp). `GET /player-state/:player_id` now checks these flags instead of row-presence. No portal.html change needed — client already just reads a `migrated` boolean.
- **Verified live** with a full simulated scenario: proxy write (Chooch-style registering for a test "Dave") → confirmed `migrated` stayed `false` → real `/migrate` call with the target's own local history → confirmed `migrated` flipped `true` with **both** the incidental row and the real local history intact, nothing lost or overwritten.
- Confirmed real Chooch, Walli, and Dave Sherwin still showed `migrated: false` at time of fix — not a hypothetical, actively protecting three real upcoming first-loads.
- Explicitly scoped: MyGame/Live Panel proxy entry (Birdie Alert, CttP, Scorecard) writes directly to Jotform under an explicit "who is this for" field, separate from `currentPlayer` — confirmed unrelated to this gap, no exposure there.

**Route-ordering bug — `/player-state/stats` silently shadowed:**
- `GET /player-state/stats` (added earlier this session for the Engagement tool) was being intercepted by the earlier, more general `GET /player-state/:player_id` catch-all, since `stats` matched the `:player_id` regex like any literal string and that route was checked first in the file.
- Symptom was quiet: request returned 200 with `ok:true`, just the wrong response shape — so the portal's `.forEach` on a missing field threw client-side, leaving the UI stuck on "Loading engagement stats…" with no visible error. Brian caught this from a screenshot, not a console log.
- Fixed with an explicit exclusion (`psGetMatch[1] !== 'stats'`) on the catch-all rather than reordering the file.
- Documented as a general pattern in the Ops Guide: any new literal-path route added under an existing `:param`-style catch-all needs to either be checked first or explicitly excluded — this class of bug won't throw at deploy time, only silently misroute at request time.

**Commissioner Engagement tool — built, then relocated, then extended:**
- New Worker route `GET /player-state/stats?pin=` — single table scan + JS aggregation over `player_event_state`, returns per-player `parked_count`/`seen_count`/`last_parked_at` plus (added later) `parked_ids`/`seen_ids` arrays, needed for the "Right Now" cross-reference below.
- **First-pass placement mistake, caught and fixed:** initially bolted onto the Push Subscribers card as a fourth header button — visually clipped on a phone screen (Brian's screenshot showed the label cut off), and thematically wrong (subscriber/push-health tools vs. app-usage analytics). Relocated to its own standalone collapsible card under Communicate, using the existing generic `toggleAdminCard()` pattern — set up to scale cleanly since Brian expects to add more tools like it.
- **Two-picture design, per Brian's explicit framing** ("history is an indicator of historic BF engagement, the now is a picture of a player's playing plan"):
  - **History (lifetime)** — total Parked/Seen counts ever. Explicitly flagged as biased by tenure (every row is permanent, nothing prunes on event expiry) — useful as a broad engagement signal, not a live-behavior one.
  - **Right Now (of N open)** — of everything currently on Home today (same denominator across all players), how much is 📦 Parked / ✅ Seen / ◌ Untouched per player. Directly tests the Series-only-player hypothesis: high Untouched + minimal Parked would mean "ignored, not actively hidden" — a different UX conclusion than "Parked is broken."
- Table sorted by all-time registration frequency (most frequent players first) so the correlation Brian's testing — does Parked usage cluster among infrequent players — reads directly off the row order.

**D1 migration (Brian ran in Cloudflare Console, this addendum):**
```sql
ALTER TABLE player_meta ADD COLUMN migrated_at TEXT;
ALTER TABLE player_meta ADD COLUMN announcements_migrated_at TEXT;
```

**Docs updated:**
- `BF_Operations_Guide.md` — "Player Personalization" section rewritten to cover the `migrated_at` fix (with the exact failure mode explained, not just "fixed"), the route-ordering lesson generalized for future sessions, and the Engagement tool's two-picture design and purpose.

**Carry-forward for Dev-56 — updated and final (supersedes the list in the main Dev-55 entry above):**
- Check the Engagement tool's Right Now breakdown after Series #5 recruitment brings a real mix of frequent/infrequent players through an actual registration push — this is the real test of the original Dev-54 "does Parked deserve its nav slot" question.
- `bf_architecture.html` full ERD redraw — deferred from earlier in this session, now further behind (`player_meta.migrated_at`/`announcements_migrated_at` columns added on top of the four tables the diagram already doesn't show).
- Cloudflare Worker Endpoints quick-reference table in `BF_Operations_Guide.md` — predates Dev-43, has never listed any Gatherings/venues/templates/photos/player-state/checklist route. Flagged, not fixed — the Player Personalization section serves as the authoritative reference for the newest routes in the meantime.
- Everything else from Dev-53/54 backlog not touched: push notification preference center, player picker rethink, GS `results.html` photo-collage insertion.

**Final portal version: v3.17.08 · 2026-07-05**
**Dev-55 fully closed (addendum included).**

---

## Session Dev-56 · 2026-07-06

**Focus:** BF Series recruiting tools — Registration Tracker (roster + commissioner status override, Jotform updated_at timeline, AWR flag, Inactive Player recruiting integration), gear-panel Refresh UX fix, and a full catch-up of the D1 architecture documentation that had silently drifted stale.

**Registration Tracker — new Commissioner Admin tool (Communicate section):**
- Built in response to BF Series #5 recruiting need: a simple per-event roster list showing every active member's Yes/Sub/No status, with tap-to-set buttons so the commissioner can correct a status directly (e.g. a player who replied No by text instead of in-app).
- Pure client-side — reuses `eventData`/`regData`/`memberData` already loaded, writes go straight to Jotform via the same PUT-beats-POST pattern `submitRegistration()` uses. No new Worker/D1 needed for the base feature.
- Diagnosed why "No" statuses existed at all despite the card only ever offering Yes/Sub to register: "No" is only ever written via Unregister (`changeRegistration(...,'No',...)`) flipping an existing Yes/Sub submission — never a direct registration path. Confirmed via `buildActionButtons()`.
- **Jotform `updated_at` wired in:** `parseRegSubmissions()` now captures `s.updated_at` (falls back to `created_at` if never edited) alongside `createdAt`. All local optimistic writes (`submitRegistration`, `changeRegistration`, `adminSetRegistration`) now stamp `updatedAt` too. Tracker rows show a timeline (e.g. "Registered Jul 1 → No Jul 4") whenever a submission's answer was actually edited (>1min gap heuristic to exclude create-then-immediately-same-value noise).
- Event picker restricted to **BF Series events only** (via the existing `formatBadge()` classifier — excludes Gatherings, WallyCup, etc.), current/upcoming only (`dt >= startOfToday`), soonest one pre-selected. Fixes recurring wrong-event-selection mistakes.

**AWR (Awaiting Registration) — commissioner-set flag, separate from Jotform:**
- Initially mislabeled the plain "no reply" bucket as AWR — corrected same session once Brian clarified AWR should mean "I know they're playing, they just haven't registered" (a fact only the commissioner knows), not "unknown."
- Deliberately kept OUT of the real Jotform Register? field/regData: that status flows through capacity counts, Text All Players, push targeting, and event-card rendering everywhere else in the app, all of which assume only Yes/Sub/No. A 4th real registration value there would have rippled into all of it.
- New D1 table `registration_intent` (event-scoped, presence = flagged) + Worker routes `GET /registration-intent`, `POST /registration-intent/toggle` (both PIN-gated). Tracker now shows five buckets: Yes / Sub / No / 🟡 AWR (flagged) / ⬜ No reply (true unknown) — sorted with true unknowns first, then AWR, then real statuses.

**Inactive Players — recruiting shortlist (new Admin card, Communicate section):**
- Problem: Jotform has no "interested in BF Series" field for Inactive members, and the full Inactive roster is too large to act on blindly, but Brian often knows specific individuals want back in.
- New D1 table `inactive_player_interest` (player-level, NOT event-scoped — durable across events) + Worker routes `GET /inactive-interest`, `POST /inactive-interest/toggle`. Card lists all Inactive members with a ☆/⭐ Mark Interested toggle; starred players float to top; a "📱 Text Interested" button group-texts just that shortlist (reuses the existing `sms:` multi-recipient pattern from `textAllPlayers()`).
- **Tied into Registration Tracker per Brian's request:** starred Inactive players now merge into the tracker roster for the selected event, tagged 💤 Inactive, with the full Yes/Sub/No/AWR button set. Registering one Yes/Sub auto-restores them to Active in Jotform via a new `restoreActiveIfNeededByName()` helper (name-parameterized twin of the existing `restoreActiveIfNeeded()` used for self-registration) — closes the loop from "known interested" → "registered" → "active member" without a separate manual step.

**Gear panel — Refresh auto-expand fix:**
- Bug: tapping a card's header ↻ Refresh button when the card was collapsed still fetched data into the (hidden) body — looked like nothing happened.
- Fixed generically via a new `expandAdminCard(cardId)` helper (force-open, never closes) wired into all five affected Refresh buttons: Announcements, Push Subscribers, Engagement, Registration Tracker, Scorecard Check.

**Architecture documentation catch-up (`bf_architecture.html` + `BF_Gatherings_Schema.sql`):**
- Requested by Brian to close the long-standing "ERD redraw" punchlist gap (deferred at Dev-55 as too large for that session's budget).
- Found the actual authoritative source, `source/specs/BF_Gatherings_Schema.sql`, had itself silently stalled at Entry 8 (Dev-54) — missing venues, gathering_templates, the entire Dev-55 player-personalization migration, and this session's two new tables. Fixed at the source: appended Entries 9–15 covering all of it, with the same per-entry rationale-comment style as the existing log.
- `bf_architecture.html` migration log extended to match (Entries 1–15); `DETAILS.d1`, `.worker`, `.admin`, `.portal` entries rewritten to drop stale claims (old 4-table D1 count, "planned D1 binding" language, dissolved "Dev Controls" admin card, hardcoded portal version number that goes stale immediately) and reflect current reality (14 D1 tables, /deploy-based Worker deploy flow, four-section Admin panel).
- **Did not** attempt the full visual SVG ERD redraw (new boxes/FKs for the 11 tables added since Entry 3) — confirmed still a real, sizable dedicated-session task, not something to rush into a documentation-catchup pass. Currency note in the doc itself now says so explicitly and lists exactly what's missing from the picture.

**Deploy-flow note (carried forward from this session, worth remembering):** the Worker's `/deploy` route 403'd (Cloudflare error 1010) on a plain Python `urllib` request — fixed by sending a browser-style `User-Agent` header. Not a code bug, a WAF quirk on the deploy mechanism itself.

**Workflow preference set this session (now in memory, applies going forward):** whenever a change needs Brian's manual action outside chat — Worker paste, D1 migration — the relevant file(s) get shared as a downloadable chat artifact in the same turn, not just referenced as "pushed to GitHub."

**D1 migrations run by Brian this session:**
```sql
CREATE TABLE IF NOT EXISTS registration_intent (
  event_name  TEXT NOT NULL,
  player_name TEXT NOT NULL,
  marked_at   TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (event_name, player_name)
);
CREATE TABLE IF NOT EXISTS inactive_player_interest (
  player_name TEXT PRIMARY KEY,
  marked_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
```
Worker pasted/deployed twice this session (once for each new table's routes).

**Addendum (post-close, same session):**
- **AWR tidiness fix (v3.17.16):** the `registration_intent` row wasn't being cleaned
  up once a real Yes/Sub registration existed for that player+event — harmless
  (bucket logic in `renderRegTrackList()` already hides AWR once a real status
  exists) but silently accumulating dead rows. Added `clearRegistrationIntent()`,
  a fire-and-forget helper (Worker route is a no-op DELETE if no row exists), wired
  into every path that can produce a real Yes/Sub: self-registration
  (`submitRegistration`), unregister-then-Undo (`changeRegistration`), and the
  commissioner override (`adminSetRegistration`). No Worker/D1 change needed —
  reused the existing `/registration-intent/toggle` route.
- **BZP track — deploy contract finally documented:** unrelated to the Dev track
  directly, but done in this chat: a BZP session had no working knowledge of the
  `/deploy` request contract (JSON body shape, PIN field, and critically the
  Cloudflare-WAF-blocks-non-browser-User-Agent gotcha) despite every session
  needing to push files — it had never been written down anywhere fetchable,
  only ever explained fresh in-chat or done by Brian directly. Fixed at the
  source: `source/BF_BizPlan_Bootstrap.md` now has the full contract, the same
  WAF gotcha this Dev track already knew about, and a working Python example.
  Cross-referencing here since it's the kind of gap that could easily recur on
  the Dev side too if `BF_Session_Bootstrap.md` ever lost this section — worth
  a periodic sanity check that it's still there.

**Carry-forward for Dev-57:**
- Full `bf_architecture.html` SVG ERD redraw — now has an accurate, complete text-based migration log to draw from (Entries 1–15), so the redraw itself is the only remaining work; still its own dedicated session.
- Cloudflare Worker Endpoints quick-reference table in `BF_Operations_Guide.md` — still stale (predates Dev-43), still flagged not fixed.
- Check the Engagement tool's Right Now breakdown once BF Series #5 recruitment brings a real registration push through (original Dev-54 "does Parked deserve its nav slot" question).
- Everything else from Dev-53/54/55 backlog not touched: push notification preference center, player picker rethink, GS `results.html` photo-collage insertion.

**Final portal version: v3.17.16 · 2026-07-06**
**Dev-56 closed.**

---

## Session Dev-57 · 2026-07-07

**Focus:** Photo Capture event-picker correction, GS groupings → D1 sync (closing the tee-time data gap), a reactive Worker security sweep, and full Live Panel Photo Capture — player-facing capture with server-side auto-classification.

**Photo Capture — event picker + containerization:**
- Free-text event name field replaced with a real dropdown — non-hosted events (`source !== 'gathering'`), 7-day-back-through-upcoming window, soonest-first default, plus a **📁 All Events** option that surfaces legacy/test rows too.
- Photo list now containerizes by Event → Section (story order: Pre-Comp → On-Course → Post-Round) instead of a flat thumbnail wrap.
- Uploads now resolve `event_name` from the selected `eventData` entry, not typed text — prevents future drift between photos and real events.
- `PATCH /photos/:id` extended to accept `event_name`/`section` corrections. Used to retag the 3 existing test photos onto `"2026 BFSeries#5"` (confirmed live via curl).

**GS groupings → D1 sync (closes the tee-time data gap):**
- New D1 table `event_groupings` (`event_name, player_name, group_number, tee_time`).
- New Worker routes: `POST /groupings/publish` (replace-on-publish — every GS Publish Groupings click, including day-of audibles, fully replaces the prior set for that event) and `GET /groupings` (PIN-gated, no public tier).
- `BF_Golf_Scorer_8.html`'s `grpPublish()` now fires a fire-and-forget POST to `/groupings/publish` alongside its existing Netlify deploy, with its own status-line note (`📊 N tee times synced` / sync failure) so a D1 hiccup never blocks the public groupings page from going live.
- **Verified live:** Brian published a Preliminary #5 grouping — 19 players, 5 groups, 07:06–07:38 tee times, confirmed correct via `GET /groupings?pin=7797&event=2026%20BFSeries%235`.
- Preliminary/Final/Hidden status is unchanged GS-side logic — only governs what's written to the public `groupings.html` page. The D1 write is independent and fires regardless of visibility, which is fine specifically because the read route is PIN-gated (see below) — Hidden's "players can't see it" guarantee holds end-to-end.

**Reactive Worker security sweep — PIN gating:**
- `GET /groupings` shipped with no PIN originally — caught same-session when Brian asked about the Hidden/testing interaction. Fixed: PIN required, full stop (no public tier, unlike `/photos`).
- Prompted a full audit of all 39 Worker routes. Found 3 more pre-existing (not new) unauthenticated routes with real exposure: `DELETE /subscription/:id` (a mutation — could delete any subscriber's push subscription), `GET /subscriptions` (up to 300 OneSignal subscriber records), `GET /notifications` (send history). All 3 PIN-gated; portal's 3 caller sites updated to pass `pin=COMMISSIONER_PIN` (both were already behind `isCommissioner()` client-side, so no behavior change for Brian).
- Deliberately did **not** gate `GET /members/:player_id/prefs` — that one's genuinely self-service (players read/write their own Gathering Alerts filters, no PIN today), and gating it would break the feature rather than fix a gap. Consistent with the app's original trust-based identity model, not an inconsistency to correct.
- Brian flagged the pattern itself — gates keep getting added route-by-route with no overall plan. Logged as its own backlog line in `BF_Operations_Guide.md` (§10), explicitly tied to the same shape as the existing `JOTFORM_API_KEY`-in-client-source row: a real fix (session token, or full per-commissioner auth) deferred until it's a priority, not urgent today.

**Live Panel Photo Capture — full player-facing build:**
- Two hot buttons — **Open Camera** (zero-tap, capture and upload in the same instant) and **Upload** (existing file, inherently ambiguous timing) — added to Live Panel, moved to the top section for no-scroll access per Brian's request.
- `/photos/upload` split into two modes: **admin** (pin=7797, explicit section, unchanged from Dev-54) and **player** (no PIN — trust-based on `currentPlayer`, same model as Scorecard/CttP submission, not a new precedent). Player mode's `section` is optional.
- **Server-side auto-classification** (`classifyPhotoSection()`): scorecard-submitted (client-reported, Worker has no Jotform credentials of its own) → `post_round` full stop; else compares `captured_at` (EXIF if available, else "now") against the real tee time from `event_groupings`; falls back to the event's own published start time if no groupings row exists for that player (late sub, unpublished); falls back to `on_course` if no reference time at all.
- **Upload path — layered timeline design** (Brian's spec: metadata → upload time → curation): client attempts a minimal hand-rolled JPEG EXIF `DateTimeOriginal` read before upload (deliberately scoped to JPEG only — HEIC and metadata-stripped files, including Brian's Oakley camera glasses, correctly return null). Upload always shows a 3-chip dialog (🌅/⛳/🏆) pre-selected with the best available guess, one tap to confirm or correct — Open Camera skips this entirely since capture/upload timing is unambiguous.
- New `.icon-action-btn` CSS component — fixed circular icon-top/label-below buttons matching the header nav's existing visual language, replacing oval `btn-secondary` buttons for Open Camera/Upload specifically. Scoped as a first migrated surface, not an app-wide rewrite; documented in its own comment block as the intended pattern going forward.
- **UX rationalization discussed, not yet written down elsewhere:** icon-action-btn fits parallel peer actions, short/nameable-in-one-icon, high-frequency/muscle-memory, space-constrained. Oval buttons fit a single primary per-screen action, state-dependent labels, infrequent/high-stakes/destructive actions, linear flow steps. Candidate next migration target flagged in-conversation: Gathering panel's Repeat/Template/Cancel row (looks like 3 peer actions, currently oval).
- **Known limitations, by design:** classification keys off the *photographer's* own tee time/scorecard, not the subject's; EXIF read is JPEG-only.

**Bug found and fixed — Android 14/15 Chrome camera-picker regression:**
- Confirmed live via Brian's own device: tapping Open Camera opened the Google Photos picker sheet instead of the camera, same as Upload. Root cause is a known, currently-open Chrome bug (issue 317289301) — `capture="environment"` is being silently ignored on Android 14/15, more likely to degrade when `accept` spans both `image/*` and `video/*` (needed here since Live Panel supports both). Not an app bug.
- Fixed via the documented (unofficial) workaround: appending a bogus MIME type (`android/allowCamera`) to the `accept` list, which forces Chrome back to the fuller system chooser that still includes an explicit Camera tile. Applied to both the Live Panel camera input and the commissioner test panel's Quick Capture input. Flagged as fragile — not part of any spec, could stop working on a future Chrome update without warning. **Not yet confirmed working on-device** — Brian was going to test and report back.

**Worker library ahead of Cloudflare, closed out post-session:** the final `worker.js` — containing the player-mode `/photos/upload` split, `classifyPhotoSection()`, and the 3-route security PIN gates — was pushed to GitHub and shared as a downloadable artifact. Paste-into-Cloudflare wasn't confirmed before the session ended, but Brian confirmed shortly after that this exact version was deployed. No longer a blocker — Open Camera/Upload should work end-to-end (camera-picker fix + upload + auto-classification) pending Brian's on-device test.

**Carry-forward for Dev-58:**
- Confirm the Android camera-picker workaround actually launches the camera on Brian's device, and that a real capture uploads successfully end-to-end (pending his report).
- Once both confirmed: full end-to-end test of auto-classification — Open Camera before/after a real tee time, Upload with/without EXIF, a scorecard-submitted player forcing Post-Round.
- GS `results.html` photo-collage insertion — previously blocked on "needs a session with GS source available," but `BF_Golf_Scorer_8.html` is confirmed in the library now (used this session to add the groupings sync). Block is stale; unblock whenever it's prioritized.
- Icon-action-btn migration — Gathering panel's Repeat/Template/Cancel row flagged as the next candidate; UX rationalization framework (peer actions/icon vs. single-primary-or-stateful/oval) discussed in-chat but not yet written into a doc — worth formalizing in the Ops Guide if the migration continues.
- `worker.js` is over 2,000 lines — Brian flagged this organically mid-session. Not urgent, but worth a table-of-contents comment block or module split whenever there's a light session, to make future security-style audits faster than a full manual scan.
- Full `bf_architecture.html` SVG ERD redraw — still open, still its own dedicated session (now further behind: `event_groupings` and the 3 newly-PIN-gated routes aren't reflected either).
- Cloudflare Worker Endpoints quick-reference table in `BF_Operations_Guide.md` — still stale.
- Commissioner PIN architecture — logged as backlog (§10), not urgent, deferred until it's a real priority.
- Everything else from Dev-53/54/55/56 backlog not touched: push notification preference center, player picker rethink.

**Final portal version: v3.17.21 · 2026-07-07**
**Dev-57 closed — Cloudflare deploy confirmed. Camera-fix on-device test still pending Brian's report.**

---

## Session Dev-58 · 2026-07-07

**Focus:** Unplanned — investigated and fixed a Gathering title-collision bug reported live by Brian while Chooch was actively using the app to set up next week's recurring "CGA Tuesday Golf League." Not the intended session topic, but blocked everything else until resolved.

**Bug #1 — host accidentally self-invited on every recurring Gathering:**
- Chooch's saved "Rough Riders" Crew (id 19, reused across every weekly instance) had his own name baked into its D1 membership from whenever it was first built — likely an oversight, since nothing in the crew picker ever prevented a host from selecting themselves.
- Every Gathering create/repeat that reused this Crew therefore notified Chooch of his own event ("Chooch Wernett invited you to..."), which read as a confusing duplicate and triggered a create → cancel → recreate loop (gathering #31 cancelled, #32 recreated with the same bug) while he tried to fix what looked broken.
- **Fixed at three layers:** `openCrewPicker()`/`openCrewPickerForInvite()` now exclude the host from the selectable list; `applyTemplate()` strips the host from an older template's `crew_snapshot` on load; `submitNewGathering()`/`submitInviteMore()` both got a defensive filter so the host can never end up in a notify list regardless of source.
- **Data cleanup:** Chooch's stale template (id 4, self-included) deleted and recreated clean (id 5, 9 members). New Worker route `POST /crews/:id/members/remove?pin=` added (no prior removal endpoint existed) and used to strip Chooch from the actual "Rough Riders" Crew (id 19) so future reuse doesn't rely on the defensive filter alone.

**Bug #2 — the real root cause, found after Bug #1's fix: Gathering registration/capacity data was matched by title, not by unique ID:**
- Once #30 (today, Jul 7) and #32 (next week, Jul 14) both existed as active Gatherings sharing the identical title "CGA Tuesday Golf League" — the normal, expected outcome of a recurring weekly series — every place that displays "my status" or headcount for a Gathering was matching `regData` rows by `eventName === evt.name` (title) instead of `gatheringId`. This silently merged #30's real data into #32's card: Brian saw #30's 4/4 Yes count and his own July 4th "Can't Make It" response to *today's* round showing on *next week's* card.
- Worse: the write path itself was affected. `submitGatheringRegistration()`'s local `regData` upsert matched an existing row by title+player, not `gatheringId`+player — so registering for #32 could silently overwrite #30's stored row in the local mirror rather than creating #32's own row.
- **Fixed across every call site:** `findMyReg()` (added optional `gatheringId` param, used at all 3 call sites — buildEventCard, swipe handler, Schedule tab), `buildEventCard()`'s yes/reg/sub counts (new `regMatchesEvt()` helper), `getSimpleCapacityStatus()` (drives Gatherings' waitlist/capacity state directly), `getMyCapacityDisplay()`'s waitlist-position lookup, and `submitGatheringRegistration()`'s local upsert index.
- **Bug #3 (caught by Brian reviewing a follow-up screenshot, same root cause, different code path):** `buildPlayerChips()` — the "Players ›" expand list under each card — was still matching by title even after the above fixes landed. Headcount showed correctly (0/4 for #32) but tapping Players still showed #30's real Yes-list (BJ, Chooch, Jake, Jordan) instead of #32's actual 0 Yes / 2 No. Fixed the same way: function now takes the full `evt` object and matches Gatherings by `gatheringId`.
- **Known residual, left untouched:** `buildLivePanel()`'s `evtPlayers` dropdown (~line 7375) still matches by title. Only exercised during an active live round; two same-titled Gatherings would need to be live simultaneously to collide, which won't happen for a weekly series a week apart. Documented rather than risked touching live-round code without on-the-spot testing.
- Verified complete: audited every remaining `regData.filter(... eventName === evt.name ...)` in the file; all non-Gathering call sites (BF Weekend Times' `getWeekendCapacityStatus`, the capacity-collapse job which explicitly excludes Gatherings, regular Jotform-event branches) intentionally left on title-matching since it's correct for their event types.

**Confirmed clean via live data after each fix:**
- All 3 active Gatherings pulled and checked for title collisions — only #30/#32 collided (both Chooch's, both the same series). No other host has Gatherings yet, so no other collisions exist to find.
- Chooch's own device screenshots (My Events, Parked, Rough Riders roster, Host Gatherings dashboard) confirmed correct post-fix: #32 card now shows its own real 0 Yes / 0 Sub / 2 No, accurate "Can't Make It" (his own real response to #32, not bleed from #30), and Rough Riders roster now 9 members without him.

**Root-cause note for future sessions:** this class of bug has likely been latent since Gatherings launched (Dev-49) — `eventName`-based matching only breaks when two Gatherings share a title, which requires either two hosts naming things identically or (as here) a single host's recurring series reaching its second occurrence. Repeat/Templates (Dev-54) made recurring same-titled Gatherings the *normal* case, so this was always going to surface once any host's weekly series hit week 2. Chooch's series is the first to get there.

**Worker deployed:** `POST /crews/:id/members/remove?pin=` (new route), pasted and confirmed live by Brian mid-session.

**Carry-forward for Dev-59:**
- Original Dev-58 intent was never reached — check with Brian on what that was.
- Live Panel `evtPlayers` title-matching (buildLivePanel, ~line 7375) — same class of bug as this session's fixes, deliberately left alone as low-risk/untested. Worth a defensive fix in a calmer session.
- Watch Chooch's "CGA Tuesday Golf League" series for its 3rd occurrence (week after next) to confirm the fix holds with zero manual checking needed.
- Everything carried from Dev-57 untouched this session: camera-picker on-device confirmation, GS `results.html` photo-collage insertion, icon-action-btn migration, `worker.js` size/organization, full ERD redraw, stale Worker Endpoints table, Commissioner PIN architecture, push notification preference center, player picker rethink.

**Final portal version: v3.17.24 · 2026-07-07**
**Dev-58 closed.**

---

### Addendum to Dev-58 — same calendar day, appended in error, kept intentionally

Brian opened a fresh chat the same morning intending to start Dev-59, but the conversation continued directly from Dev-58's close without a session boundary — an accidental append, not a planning choice. Rather than retroactively split the record, Brian chose to document this whole block as part of Dev-58 as-is, and start a **legitimate Dev-59** fresh next time. Everything below happened after the "Dev-58 closed" line above, in the same chat.

**Photo Capture — event picker + containerization corrections (portal, v3.17.17–v3.17.20):**
- Free-text event name field replaced with a dropdown — non-hosted events, 7-day-back-through-upcoming window, plus a 📁 All Events option surfacing legacy/test rows.
- Photo list containerizes by Event → Section (story order) instead of a flat wrap.
- `PATCH /photos/:id` extended to accept `event_name`/`section` corrections — used to retag 3 test photos onto `2026 BFSeries#5`.
- Photos moved to the top of the Live Panel (no-scroll access); new `.icon-action-btn` component (fixed circle, icon-top/label-below) replaced oval buttons for Open Camera/Upload specifically — scoped as the first migrated surface, not an app-wide rewrite. UX rationalization discussed in-chat (icon-action-btn for parallel/frequent/space-constrained actions; oval for single-primary/stateful-label/high-stakes actions) — not yet written into a doc.

**GS groupings → D1 sync — closes the tee-time data gap:**
- New D1 table `event_groupings`; `POST /groupings/publish` (replace-on-publish, fires from GS's `grpPublish()` alongside its existing Netlify deploy) and `GET /groupings` (PIN-gated).
- Verified live with real data: 19 players, 5 groups, Series #5 Preliminary grouping.

**Reactive security sweep:** `GET /groupings` shipped with no PIN originally, caught same-session — fixed. Prompted a full 39-route audit; found and PIN-gated 3 more pre-existing open routes (`DELETE /subscription/:id`, `GET /subscriptions`, `GET /notifications`). Deliberately left `GET /members/:player_id/prefs` open — genuinely self-service, gating it would break the feature. Brian flagged the reactive pattern itself; logged as its own backlog item (Commissioner PIN architecture, no overall plan) rather than just fixed and forgotten.

**Live Panel Photo Capture — full player-facing build (portal, v3.17.19–v3.17.21):**
- Two hot buttons — Open Camera (zero-tap) and Upload (existing file) — added to Live Panel.
- `/photos/upload` split into admin (PIN, explicit section) and player (no PIN, trust-based on `currentPlayer`, same model as Scorecard/CttP) modes.
- Server-side auto-classification (`classifyPhotoSection()`): scorecard-submitted (client-reported) → post_round; else compares `captured_at` against real tee time from `event_groupings`, falling back to event start time, falling back to on_course.
- Upload path: minimal hand-rolled JPEG EXIF reader (DateTimeOriginal), always resolves through a 3-chip dialog pre-selected with the best guess — Open Camera skips this since timing is unambiguous.
- **Bug found and fixed:** Android 14/15 Chrome regression silently drops `capture="environment"` to the Photo Picker instead of the camera (Chrome issue 317289301, not an app bug). Fixed via the `android/allowCamera` bogus-MIME-type workaround, restoring an explicit Camera option in the chooser (a 3-tap path now, not zero-tap — Android's `Intent.createChooser()` deliberately disables "remember this choice" by design, confirmed via Google's own docs, not fixable from the web side). **Confirmed working on Brian's device** — camera launches after a chooser dialog.

**Photo metadata investigation — real-world test:** Brian's Oakley Meta Vanguard photo, shared via a direct connector, retained full EXIF (`Make: Meta, Model: Vanguard, DateTimeOriginal` present) — contradicting his earlier GLS experience, suggesting export *path* (direct share vs. re-share through another platform) determines EXIF survival, not the glasses themselves.

**Oakley Meta live integration — scoped, not built:** Meta's Wearables Device Access Toolkit (DAT) is real (developer preview, supports Oakley Meta HSTN, 18Birdies cited as an early partner) but is a native iOS/Kotlin SDK — a separate app project, not a portal.html change, and gated on Meta's still-limited developer access. **MacroDroid folder-watch alternative discussed and scoped in detail** (trigger on Meta AI's phone-sync folder → HTTP POST to the existing `/photos/upload` route, zero new backend code) as the actual near-term plan — not built, explicitly held for later testing. Confirmed the real import chain: glasses → Meta AI app auto-import (case-close trigger, or manual) → phone gallery → (future) automation → Worker. No true real-time path without the native SDK.

**Capture-window debate — captured, not resolved:** `LIVE_EVENT_HOURS = 8` gates the whole Live Panel including Photos. Brian's real post-round pattern often runs longer. Decision: **keep 8hrs for now**, observe real player behavior at #5 before changing anything. Options discussed but not built: a separate longer-window Gear-menu capture path (simpler than Live Panel's, since post-window is definitionally post_round, no classification needed) vs. relying on players to contact Brian directly. Explicitly distinguished from an eventual GSL-type always-on capture surface — different tier of the same capability, not a stretched version of today's bounded-round assumptions. Photo republish flagged as coupled to the (still unbuilt) Publish step, not a separate problem.

**GS Photo Organizer — native panel, full build (GS v8.18–v8.26):**
- New nav tab 6 "📸 Photos" — reuses the Dev-57 Worker routes wholesale, zero new backend for the base feature.
- **Design correction mid-build:** initially coupled to `event-name` (only set via Groups tab → Kick Off Event) — Brian caught this immediately as the wrong coupling (photo curation is retroactive, shouldn't require spinning up a live scoring session). Rebuilt with its own independent event picker.
- **Second correction:** that independent picker initially queried the Registration/RSVP form with no filtering, surfacing the full historical archive back to May — fixed to query the correct form (**Request Event**, which has the real Date & Time field, not Registration) with the same 7-day-back-through-upcoming window as the portal's picker, using `getAnswer()`/`parseDateFromJF()` ported verbatim from the portal for identical parsing behavior in both tools.
- **Chronological sort bug found and fixed:** `captured_at` was computed for classification purposes only and then discarded — photos were actually sorting by upload time, not real capture time. Added a `captured_at` column (D1 migration executed), persisted at upload (EXIF value, or upload-instant for Open Camera since those are simultaneous), `GET /photos` now sorts by it.
- **Redesigned to 3-column layout** (one column per chapter) per Brian's request, anticipating ~40 photos/event at scale — chronological within each column, visible capture-time label per thumbnail so the order is verifiable at a glance, not just trusted.
- **Chapter-edit dropdown** added to every thumbnail — direct one-click reassignment, replacing the need for a manual PATCH/curl correction.

**GHIN → GS HCP import — built and iterated three times against real failures, not shipped speculatively:**
- "Paste GHIN List" feature added to Groups tab HCP table, reusing `grpCalcTeeAndQuota`/`grpGetEstimatedQuota` for identical tee/quota derivation to manual entry.
- **v1** assumed clean tab-separated column paste — broken immediately: GHIN's drag-select triggers the browser's link-drag gesture instead of a text selection (a real GHIN/browser interaction issue, confirmed by Brian, not fixable from our side), forcing Ctrl+A (whole-page select) as the only viable method, which a column-based parser can't handle.
- **v2** attempted a markdown-link-smashed-text fallback — insufficient once real full-page paste data (nav, footer, copyright junk) was actually tested against it.
- **v3 (shipped, v8.25):** complete rewrite — searches the whole pasted blob for each roster player's name anywhere in the text, grabs the nearest plausible handicap number (-10 to 54 range, handles `+1.7` plus-handicaps) within a window after it. No row/column assumptions at all. Verified 23/23 against Brian's actual real GHIN data plus realistic nav/footer noise before shipping.
- **v4 (shipped, v8.26):** real-world test came back 10/20 matched. Diagnosed the 10 "not found" as two distinct causes, not one bug — genuine BF-nickname-vs-GHIN-formal-name mismatches (BJ Kolonia↔Brian Kolonia, Chooch Wernett↔Charlie Wernett, Rich Penberg↔Richard Penberg) vs. players simply absent from what was pasted (including Brian Hager himself — GHIN's `/following` page excludes the account owner by definition). Repurposed the existing Profiles-tab `nickname` field (previously just a display label) as a manual GHIN-alias slot, checked as a fallback search term. **Not yet re-tested with real aliases entered** — first thing to verify at Dev-59.

**Also touched:** GS_VERSION was being silently left stale across edits — caught and corrected (now bumped every GS deploy, v8.17→v8.26, matching the portal's existing version-bump discipline). Clarified GS's actual local-pull mechanism is `Launch_Golf_Scorer.bat` (local-only, not in the GitHub library, auto-pulls on launch) — corrected an earlier wrong claim that no pull mechanism existed.

**Carry-forward for the real Dev-59:**
- **BF name ↔ GHIN name mapping table, with a "no GHIN record" map** — Brian's explicit next-session starting focus. The Profiles-tab nickname-as-alias fix is a stopgap; a proper dedicated mapping (plus a way to flag players who genuinely have no GHIN account, so they stop showing as false "not found" every time) is the real ask.
- Re-verify the GHIN paste import end-to-end once BJ/Chooch/Rich aliases are actually entered in Profiles.
- Confirm Ron Grow, Wilbur Hlay, Mohamed Walli, Jeremy Burkett, Lou Strohl, Rich Potts are actually on Brian's GHIN "Following" list (open question, not a code issue).
- GS `results.html` photo-collage insertion (Publish) — Photo Organizer curation is fully built; taking the *approved* set and actually inserting it into the public page is not. Real gap Brian named himself, not yet scoped in detail.
- Photo republish process — deferred with Publish itself, captured so it isn't a surprise later.
- Capture-window (`LIVE_EVENT_HOURS = 8`) — holding as-is, revisit after observing real player behavior at #5.
- Everything still carried from Dev-57/58 untouched: icon-action-btn migration beyond Live Panel Photos (Gathering panel's Repeat/Template/Cancel row flagged as next candidate), `worker.js` size/organization (now even larger after this session's additions), full `bf_architecture.html` ERD redraw, stale Worker Endpoints reference table, Commissioner PIN architecture (logged, not urgent), push notification preference center, player picker rethink.

**Portal work in this addendum topped out at v3.17.21** (Live Panel Photo Capture + icon-action-btn). The live `portal.html` currently reflects v3.17.24, from the separate parallel session that used the actual Dev-58 slot for Gatherings bug fixes — no conflict, that work simply landed after this block's.
**Final GS version: v8.26 · 2026-07-07**
**Addendum closed. Next session opens as a legitimate Dev-59.**

---

## Dev-59 · 2026-07-10

**GHIN Name field — redesigned to single field, 4 states (GS v8.27–v8.29):** Initial plan was a dedicated GS-side Profiles-tab mapping table; Brian redirected twice toward simplicity — first to just add a `GHIN Name` field on the Jotform Membership form (turned out it already existed) and have GS read it directly (no local mapping data at all), then to fold the planned separate `DiffHCP` field into that same `GHIN Name` field rather than adding a second one. Landed on: one Membership-form field, four states read by `grpApplyGhinPaste()` — blank (search roster name), an actual name (alias, searched too), `NoHCP`/`N/A`/etc. (marks `isNoHcp`, baseline quota, silent), `DiffHCP` (has a real HCP from elsewhere, flagged every paste as a manual-update reminder, never touched). A stray hidden `DiffHCP` field from the abandoned two-field attempt is still sitting unused on the Membership form — Jotform delete via the MCP connector silently no-op'd twice; harmless, needs a 10-second manual delete whenever convenient.

**Real bug found and fixed (GS v8.30):** first live retest came back with all 9 flagged players still showing "not found," despite Jotform data being correct. Root cause was two-fold — GS's `getAnswer()` call for First/Last Name was missing fallback keys (`'name'`/`'lastname'`) that portal.html's proven-working version for this same form includes, and the Membership fetch was cached once per GS session with no way to refresh after a mid-session Jotform edit. Fixed both: aligned key list exactly to portal.html's, removed the cache entirely (always refetches on panel-open and Apply), added a visible status line (`✓ N GHIN Name flags loaded from Jotform (M members total)`) so a future empty-fetch failure is visible immediately instead of only showing up as silent downstream mismatches.

**NoHCP E1→E2 quota preview bug found and fixed (GS v8.31):** Rich Potts flagged his own 2nd-event quota showing "Baseline" instead of his 1st-event achievement. Root cause: two separate code paths compute this — the event-save logic (already correct, already tested, matches the public results page's "Why this quota?" explanation) vs. the Groups tab's pre-event preview (`grpGetEstimatedQuota`), which never got the same special-case pass-through and only handled it once a *second* real quota existed to regress from. Fixed by mirroring the authoritative save-time rule in both `grpGetEstimatedQuota` and the `grpQuotaBreakdown` tooltip.

**Memory/backlog audit:** Brian suspected two long-standing backlog items were already resolved. Confirmed both, traced to Dev-52's own addendum backlog cleanup (June 27) which explicitly killed "CttP negative distance," "push notification copy audit," and — caught independently — "Live panel UX overhaul," none of which ever should have resurfaced in persistent memory. All three removed. CttP fix additionally verified directly in portal.html's live code (keystroke-level block + submit-level check), not just presumed.

**Oakley Meta Vanguard bulk photo import — Worker side complete, MacroDroid side unfinished:**
- `/photos/upload` extended with a raw-body + query-param mode (metadata via URL params, whole body is the file) for MacroDroid's HTTP Request action, which has no true multipart/form-data support — multipart mode (portal/GS) untouched and still the primary path.
- Multipart mode hardened: falls back to the first file-shaped field under any name, not just `file`, and 400 errors now report which fields were actually received.
- Temp debug logging added (`GET /debug/last-upload?pin=7797`, via `BF_FLAGS` KV) — captures exactly what any request to `/photos/upload` looked like regardless of which path/error it hits. This was the single most useful diagnostic of the session (caught a `capture_by`/`captured_by` typo directly, no phone screenshots needed) — **recommend keeping this permanently rather than stripping it**, it's cheap and has already paid for itself once.
- Bulk-import intelligence added for the "loop over the whole camera-roll folder" use case: `captured_at` is derived from Meta's `YYYYMMDD_HHMMSS_xxxxxxxx` filename convention when not explicitly sent; files outside a window around `event_start` (3h before/10h after) are skipped (200, not stored) rather than filed under the wrong event; dedup by the filename's trailing hex ID prevents duplicate rows on repeated bulk runs.
- End-to-end proof of the single-photo path: a manually-triggered "Shortcut Launched" test macro successfully uploaded a real photo (id 6, confirmed via `/photos` query, auto-classified `on_course`) — the whole pipeline works for one file at a time today.

**MacroDroid bulk macro — genuinely difficult UI, real progress, not finished.** Session log doesn't usually narrate this much UI struggle, but it matters for Dev-60 continuity: MacroDroid's variable/array system is powerful but almost entirely undocumented in its own UI (no persistent config screens on some actions, dead-end variable pickers, "Test" buttons that reveal nothing without a follow-up System Log check). What's confirmed built and working, action by action:
1. **List Files (All File Access)** on `/storage/emulated/0/Download/Meta AI`, output type **Array** (not Dictionary — Dictionary keys aren't reliably orderable for iteration) into `meta_files_arr`. Confirmed via debug log that each entry is a structured record with `[filename]`, `[fullPath]`, `[uri]`, `[lastModified]`, etc. — not a plain path string, which is *why* naive indexing attempts kept failing.
2. **Iterate Dictionary/Array** over `meta_files_arr`. Confirmed correct — a first attempt using a manually-built `counter` variable (Set Variable int=0, increment via "Value + 1" inside the loop, decrement pattern fully verified in System Log) proved the loop mechanics themselves work, but `[array][counter]`-style bracket chaining in plain text fields could never be gotten to resolve to a real path (`{lv=array}[{lv=counter}]` syntax repeatedly evaluated to the *entire* array being dumped, confirmed via the debug endpoint's captured request). Replaced the counter approach with the proper `Iterate Dictionary/Array` action once found — MacroDroid's own wiki confirms it exposes `[iterator_value]` (current item) and `[iterator_array_index]` (current index) as magic text, not as anything selectable via any variable picker in the app (this is why it took so long to find — it's undocumented in-app, only in the external wiki).
3. **Confirmed via debug log:** `[iterator_value]` alone correctly resolves to exactly one file record per pass (not all 296) — loop iteration itself is proven correct.
4. **Not yet solved:** extracting a single sub-field (`fullPath`/`filename`) from that per-iteration record inline in a text field. `[iterator_value][fullPath]` renders as a literal dictionary-summary string ("8 entries[fullPath]"), not the actual path. Tried and exhausted this session: `Set Variable → Dictionary → Copy Other Dictionary` (only offers pre-existing named array/dict variables as a source, not the loop-scoped `iterator_value`); the guided "Array Index" picker's "Define manually" dialog (only ever produced the same whole-array dump, never validated green).

**Carry-forward for Dev-60:**
- **First thing to try:** `{lv=meta_files_arr}[iterator_array_index][fullPath]` in the File path field (and the `[filename]` equivalent for the filename query param) — an untried combination of the two independently-confirmed-working pieces (the `{lv=}` bracket-chaining syntax that correctly built literal `meta_files_arr[0]`, `[1]`, etc. earlier, combined with the real `iterator_array_index` magic text token from the official wiki, used as a literal index rather than wrapped in `{lv=}` since it isn't a stored variable).
- If that fails: consider Text Manipulation (regex extraction) on `[iterator_value]`'s string form as a fallback path, or revisit whether Array Manipulation has an operation we haven't tried yet (only "Sort Ascending" was seen — the dropdown wasn't fully explored).
- **The counter-based loop scaffolding was fully deleted** partway through this session in favor of the Iterate action — current macro state is: List Files → Iterate Dictionary/Array (`meta_files_arr`) → HTTP Request (POST, still pointing at the unresolved `[iterator_value][fullPath]`/`[filename]` values) → End Loop. No dangling counter variables left behind.
- The original single-file "Shortcut Launched" test trigger is still intact underneath all of this and still works — safe fallback if the bulk loop is set aside again.
- Once the bulk macro works: still need to swap the trigger from manual "Shortcut Launched" to an automatic folder-watch trigger for true hands-off capture, and decide whether photos+videos both get auto-swept or videos stay manual.
- GHIN "Following" list open question (from earlier in this same session) still unconfirmed: Ron Grow, Wilbur Hlay, Mohamed Walli, Jeremy Burkett, Lou Strohl, Rich Potts.
- Everything else carried from Dev-57/58 untouched: icon-action-btn migration beyond Live Panel Photos, `worker.js` size/organization, full `bf_architecture.html` ERD redraw, stale Worker Endpoints reference table, Commissioner PIN architecture, push notification preference center, push notification recipient domain (all-`bfw=Yes` vs. registered-only), notification feed → Worker KV redesign, player picker rethink, Player Analytics/Insights layer, proactive pushId health check, GS `results.html` photo-collage Publish step.

**Final versions this session: GS v8.31 · 2026-07-09. Worker: library pushed through commit `e1b2c348` (bulk-import filename/window/dedup logic, built on top of the debug-logging revision Brian confirmed pasting into Cloudflare earlier) — but Brian's paste-confirmation for this specific last commit was never explicitly given in-session. Verify at Dev-60 start whether it's actually live before relying on the window-skip/dedup behavior.**
**Dev-59 closed. Next session opens as Dev-60.**

---

## Session Dev-60 · 2026-07-10

**Focus:** Oakley Meta Vanguard bulk photo import — resolved MacroDroid per-file field extraction, added upload-path safety guards after a Cloudflare KV usage scare, shipped a Photo Organizer lightbox feature.

**MacroDroid bulk loop — file-path extraction solved:**
- Confirmed live via `/photos/upload` debug logging (added Dev-59): `{lv=meta_files_arr}[iterator_array_index][fullPath]`-style bracket chaining could not be made to resolve to a real per-file value — abandoned after further testing.
- Solved instead with a Text Manipulation (regex) step on `[iterator_value]`'s string form: correct Split delimiter (a leading-space bug from an earlier unconfirmed instruction cost several debug cycles before being caught), Group 1 capture mode — critically **not** "First match," which was returning the entire regex match including trailing `--` junk.
- HTTP Request file path constructed as `/storage/emulated/0/Download/MetaTest/{lv=current_filename}`.
- 3 test photos (ids 7, 8, 9) uploaded successfully end-to-end with correct filenames and `captured_at` timestamps derived from Meta AI's filename convention. Retagged from test event name to `2026 BFSeries#5` via `PATCH /photos/:id`.

**KV usage scare and safety guards (all confirmed live via curl round-trip):**
- Cloudflare KV usage hit 50% of the daily free-tier limit mid-session. Root cause: every `/photos/upload` call — success, duplicate-skip, or error — was writing to KV via the Dev-59 debug-logging feature (`BF_FLAGS.put('debug_last_upload', ...)`), and MacroDroid's iterative testing was hitting that endpoint repeatedly.
- **Kill switch:** new `photos_upload_paused` flag (`GET/POST /flags`, PIN-gated) — Admin panel "Photo Upload Pause" card. While paused, upload attempts get a clean `503` before touching D1, KV, or R2. Verified live.
- **D1 rate counter:** new `upload_attempts_log` D1 table (Brian ran the migration SQL) — tracks attempts as a daily-cap backstop independent of the manual kill switch. Verified writing correctly under live test.
- **Debug logging filtered:** confirmed the "only log meaningful results" filter is working as intended — dedup/window-skip requests don't spam the debug log, but genuine errors and successes still do.

**GS Photo Organizer — double-click expand lightbox (GS v8.32):**
- Double-click any thumbnail (photo or video) in the Photo Organizer opens it full-size in an overlay — dark background, media scaled to fit, caption showing capturer + timestamp underneath.
- Dismiss via × button, click-outside, or Esc.
- Video gets a full-size `<video controls autoplay>` — double-click both expands and starts playback rather than showing a frozen frame.
- Deployed to `source/BF_Golf_Scorer_8.html`, commit `9aba600`.

**Carry-forward for Dev-61:**
- Full 296-file production run against the real Meta AI folder — Brian clearing the folder first so only the real usable photo set gets processed (avoids reprocessing today's test noise).
- Swap MacroDroid trigger from manual "Shortcut Launched" to automatic folder-watch for true hands-off capture.
- Clean up 6 test photo rows (ids 2, 3, 4, 7, 8, 9) before BFSeries#5.
- Everything else carried from Dev-57/58/59 untouched: icon-action-btn migration beyond Live Panel Photos, `worker.js` size/organization, full `bf_architecture.html` ERD redraw, stale Worker Endpoints reference table, Commissioner PIN architecture, push notification preference center, push notification recipient domain (all-`bfw=Yes` vs. registered-only), notification feed → Worker KV redesign, player picker rethink, Player Analytics/Insights layer, proactive pushId health check, GS `results.html` photo-collage Publish step, GHIN "Following" list confirmation (Ron Grow, Wilbur Hlay, Mohamed Walli, Jeremy Burkett, Lou Strohl, Rich Potts).

**Session note:** this session's close-out was not logged at the time (chat ended at 82% budget without an explicit close-out pass) — reconstructed and appended retroactively at the start of Dev-61, from the Dev#60 chat transcript. Portal/worker exact final version numbers for this specific session weren't independently re-confirmed during reconstruction; verify against the live `portal_version.txt` / Cloudflare paste state if precision matters before relying on them.

**GS version: v8.32 · 2026-07-10**
**Dev-60 closed (logged retroactively at Dev-61 open).**
**Dev-61 opens next.**

---

## Session Dev-61 · 2026-07-11

**Focus:** MacroDroid bulk photo import — production-hardened the macro (trigger, safety guard, correct tagging, per-file move scoping, cleaned up a wasted-request quirk). Confirmed Live Panel photo capture access and metadata sort logic already correct via code review. Decided against a full 296-file production run — not representative of real event volume.

**Scope decision:** the 296-file Meta AI folder sweep (Dev-59/60 goal) was dropped — it's accumulated personal-glasses history, not a realistic BF event volume, and would only exercise the bulk-loop mechanics without real value. Real events will run a handful of photos at a time.

**MacroDroid — trigger hardened (home-screen icon):**
- "Shortcut Launched" trigger (already present) turned out to be the correct mechanism — no new trigger type needed. The actual missing piece was placement: Android's native "pin to home screen" flow needed to be re-triggered by deleting and re-adding the trigger, which surfaced the system pin dialog. Appears in the System Log as "Widget Button (Custom)."
- Custom icon: extracted the existing BirdieFriends PWA icon from `docs/manifest.json`'s embedded base64 (`BF_icon.png`, 256×256) and applied it via MacroDroid's icon picker.

**MacroDroid — accidental-trigger guard added:**
- Option Dialog ("Meta Glasses Upload — Proceed with Upload?") added as the first action, with "Block next actions until complete" checked so the macro waits for a response before doing anything.
- Left button ("Cancel") wired to **Stop Macro** via the button's own action dropdown — no separate If/condition action needed, Option Dialog supports per-button actions natively.

**MacroDroid — event tagging fixed:**
- The HTTP Request's `event_name` query param was still hardcoded to the placeholder `MacroDroid Test` from earlier testing. Changed to `2026 BFSeries#5` — MacroDroid URL-encodes the `#`/space automatically, no manual encoding needed.
- 4 stray photo rows (ids 6, 10, 11, 12) that had landed under `MacroDroid Test` were retagged via `PATCH /photos/:id` (PIN must be in the JSON body, not the query string — a real gotcha, first attempt 403'd). Brian later deleted these 4 himself as routine housekeeping — not a bug, initial alarm over "disappeared" rows was a false trail.

**MacroDroid — real bug found and fixed: "Move All Files" instead of per-file move.**
- The Move step (File Operation, Storage Framework) was configured with **Select File Type → All Files**, not scoped to the current loop iteration. Consequence: the moment *any* file in the loop succeeded, the action swept the *entire* Meta AI folder to Meta History — including files still waiting their turn that had never actually uploaded. This is what caused an earlier false "both files moved successfully" report when only one had actually reached the server.
- Fixed: **Select File Type → Specify File Pattern → `{lv=current_filename}`** (inserted via the variable picker, not typed) — now each iteration only ever moves its own file, verified via a fully clean two-file test run in the System Log.

**MacroDroid — async race condition fixed:**
- HTTP Request's "Block next actions until complete" was unchecked, so the macro evaluated `http_status` before the network response had actually returned — the `If` check was reading a *stale* value left over from a previous request, not the current one. This was the root cause of the "file moved but never uploaded" scenario for Testmove2.jpg earlier in the session. Checked the box; confirmed via System Log timestamps that HTTP Request → `http_status` update → `If` check now land together.

**MacroDroid — content-body file path corrected:**
- Content Body's file-attachment path still referenced the old `MetaTest` test folder from initial development; updated to the real `/storage/emulated/0/Download/Meta AI/{lv=current_filename}`.

**MacroDroid — wasted-request quirk eliminated (cosmetic, not urgent, done anyway):**
- The `Split to array` step (needed to make per-item field extraction work at all, back in Dev-59/60 — confirmed still required, not dead code) reliably produces one garbage `[0]`-style fragment ahead of each real file's data, costing one harmless-but-wasted 400 per run.
- Fixed with a guard rather than touching the fragile Split/Iterate mechanism: new `If [{lv=current_filename} Excludes "."]  → Continue Loop` inserted between Extract text and HTTP Request. Real filenames always contain a period (`.jpg`/`.mp4`); the garbage fragment never does, so the guard can't false-positive on a real file. Verified via System Log: garbage pass now skips straight to the next iteration with zero HTTP Request, zero log noise.

**Final macro shape (Meta Upload), confirmed working end-to-end:**
```
Trigger: Shortcut Launched (home-screen icon, custom BF icon)
→ Option Dialog (Cancel → Stop Macro; Run → continue)
→ List Files (Meta AI, All Files) → meta_files_arr
→ Split to array → chunks_arr
→ Iterate Dictionary/Array (chunks_arr)
    → Extract text → current_filename
    → If [excludes "."] → Continue Loop
    → HTTP Request POST (raw body, Meta AI/{current_filename}, event_name=2026 BFSeries#5)
    → If [http_status = 200]
        → Move File (Specify File Pattern: {current_filename}, Meta AI → Meta History)
→ End Loop
```

**Live Panel photo capture — re-confirmed via code review (no changes needed):**
- `buildLivePanelPhotoSection()` renders unconditionally inside `buildLivePanel()`, which only renders when the live banner is showing — requiring the player be registered AND within `LIVE_EVENT_HOURS` (8hrs) of tee time. Same Tier-2 gate as Scorecard/CttP, already correct.
- Open capture-window question from Dev-58 remains genuinely unresolved (whether 8hrs is long enough for real round pace) — still deferred pending real Series #5 data.

**GS Photo Organizer sort logic — re-confirmed via code review (no changes needed):**
- `GET /photos` already sorts `ORDER BY section, sort_order IS NULL, sort_order, COALESCE(captured_at, created_at)` — true capture-time chronological order within each chapter, confirmed correct.

**40-photo GS-O scale test — not started.** Discussion began (synthetic seed vs. real photos vs. live upload batch) but the session pivoted to the MacroDroid deep-dive before a method was chosen.

**Publish step design — not started.** Flagged as next session's focus.

**D1 state at close — 8 test photo rows under `2026 BFSeries#5`, all need cleanup before real event traffic:**
ids 2, 3, 4, 7, 8, 9 (older test-era photos) + 17, 18 (tonight's final clean Testmove1/Testmove2 run).

**Carry-forward for Dev-62:**
- **Clean up all 8 test photo rows** (ids 2, 3, 4, 7, 8, 9, 17, 18) before BFSeries#5 real traffic — delete via `DELETE /photos/:id?pin=7797` (permanent, R2 + D1) once no longer needed for reference.
- **40-photo GS Photo Organizer scale test** — decide method (synthetic seed script vs. real batch upload) and run it; verify 3-column layout, chronological accuracy, and general usability at that volume.
- **Design the photo publish step** — inserting the curated/approved set into GolfScorer's `results.html` output. Real gap Brian flagged himself at Dev-58; not yet scoped in any detail. This is the last major open piece of the photo system.
- Everything else carried from Dev-57/58/59/60 untouched: icon-action-btn migration beyond Live Panel Photos, `worker.js` size/organization, full `bf_architecture.html` ERD redraw, stale Worker Endpoints reference table, Commissioner PIN architecture, push notification preference center, push notification recipient domain (all-`bfw=Yes` vs. registered-only), notification feed → Worker KV redesign, player picker rethink, Player Analytics/Insights layer, proactive pushId health check, GHIN "Following" list confirmation (Ron Grow, Wilbur Hlay, Mohamed Walli, Jeremy Burkett, Lou Strohl, Rich Potts).

**Portal/Worker/GS versions: unchanged this session — no worker.js, portal.html, or BF_Golf_Scorer_8.html edits were made. All work was MacroDroid configuration + Worker API calls (PATCH retag) using the existing deployed Worker.**
**Dev-61 closed.**

## Session Dev-62 · 2026-07-13

**Focus:** Started as three carry-forward items from Dev-61 (test photo cleanup, 40-photo scale test, photo publish step design) but pivoted almost entirely into real-time bug hunting once BFSeries#5 payout planning and live MacroDroid/Photo Organizer testing surfaced a chain of genuine production bugs. Results.html consolidation (Highlights tab + Photos tab) was explicitly deferred to Dev-63 once the scope became clear.

**GHIN import / Groups tab sync bug (GS v8.33):**
- `grpApplyGhinPaste()` correctly updated `p.hcp`/`p.quota` in the underlying player data for every matched player, but only called `grpRenderHcpTable()` afterward — never `grpRenderPool()`/`grpRenderGroups()`. Any player already placed in a group kept showing the stale pre-import HCP/quota card (Brian's own case: HCP updated to 7.2 in the ranking table, but his Group 4 card still showed 6.1).
- Fixed by adding the missing re-renders after the batch update, matching what the single-player manual edit path (`grpTableUpdateHcp`) already did correctly.

**Proportional payout formula (GS v8.34 → v8.35):**
- Replaced the old flat $40/$20/$10 podium + $10/hole CTP model — which had become disproportionate to skins as BFSeries#5 grew to 22-24 players (skins pool was ballooning toward ~75% of the pool).
- New model: podium 20% of pool (weighted 2:1:0.5 across 1st/2nd/3rd), CTP 15% of pool (split across 5 holes), each rounded to nearest $5, balance to skins. Ratio reverse-engineered so a real skin (~5.5/round average, computed from actual 2024-2026 history Brian pulled from GS's own season data) lands close to the 1st-place podium prize at BFSeries#5's ~22-player size — confirmed live: 22 players → $50/$25/$15 podium, $15/hole CTP.
- Real historical skins-per-round data (20 events, 2024-2026) showed essentially zero correlation between field size and skin count (r=0.12) — contrary to intuition, bigger fields don't reliably produce fewer skins via tie-suppression in this dataset.
- v8.35 follow-up: skins now floor to the nearest whole dollar (was fractional cents, unpayable in cash) — leftover from the floor is tracked (`skinLeftover`) and displayed on the Results tab ("$X left over from rounding — keep it, don't try to split it") rather than silently disappearing.
- Fix applied identically to both `calculatePayout()` (live Results tab) and the duplicate calc embedded in `generateResultsPage()`'s results.html template — cross-verified byte-identical output across 12 field sizes before shipping. Full test suite (money-conservation invariant, no negatives, boundary ties, tiny/huge fields) run against the actual extracted deployed function, not just reasoned about.
- Explicitly scoped away from `generateSeriesPage()`'s Season Money/Overall leaderboard (`QUOTA_PRIZES_M`, still flat $40/$20/$10) — that's a separate, not-yet-designed system (BFSeries#5 Overall pot, $20 buy-in, % podiums across Overall/Green/Combo/Gold flights) that needs its own dedicated session.

**Payout Cheat Sheet (new portal admin card, v3.17.25 → v3.17.29):**
- New Commissioner Admin card mirroring the GS proportional formula exactly — reference table for players 8-32, with an adjustable "avg skins" input estimating $/skin. Verified byte-identical to GS's real output before shipping.
- Initially placed in System section, corrected to Event Day per Brian's feedback (v3.17.27) — gameday reference material belongs where gameday tools live.
- Updated to match the whole-dollar skins rounding (v3.17.28).

**Photo curation paradigm shift — approved-by-default (worker.js):**
- `/photos/upload`'s INSERT now explicitly sets `curation_status='approved'` instead of relying on the D1 schema default of `'pending'`. Brian's workflow doesn't scale at real event volume (dozens of photos/event) with approve-everything — flipped to reject-by-exception: photos go live immediately, commissioner spot-checks and rejects/deletes only the bad ones.
- D1 schema's `DEFAULT 'pending'` was deliberately left as-is (now just unused dead text) rather than migrated — the explicit INSERT value achieves the goal without a schema change.

**Video media_type bug (worker.js):**
- MacroDroid's raw-body uploads don't reliably send a per-file `video/*` Content-Type header — real .mp4 files were landing with `media_type: 'image'`, causing the Photo Organizer to render a broken `<img>` tag instead of `<video>`.
- Fixed with a filename-extension fallback (`.mp4`/`.mov`/`.m4v`/`.webm` treated as video regardless of Content-Type) — also fixed the same blind-trust problem in what gets stored as the R2 object's own Content-Type header.
- Added `media_type` as a PATCH-able field so existing misclassified rows can be corrected without re-upload. Found and fixed 3 affected rows (confirmed via a full 16-photo, all-events sweep — no other events affected).

**Meta filename timezone bug (worker.js) — real, non-obvious root cause:**
- Meta AI's `YYYYMMDD_HHMMSS` filename timestamp is the phone's **local** (Eastern) time, but the old derivation code appended `.000Z` directly, stamping local digits as if already UTC — every filename-derived `captured_at` displayed 4-5 hours early (a real 7:38 AM capture showed as 3:38 AM in the photo lightbox).
- Fixed with `localWallTimeToUTC()`, a proper Eastern→UTC conversion via `Intl.DateTimeFormat` that correctly handles the EDT/EST boundary (tested against both summer and winter dates plus a round-trip check) rather than a hardcoded fixed offset.
- Root-cause isolated to the server-side MacroDroid filename-parsing path only — the portal's client-side EXIF reader (regular Live Panel uploads) was already correct, since it runs on the phone itself in the phone's own timezone.
- Added `captured_at` as a PATCH-able field; corrected the 8 real rows affected by the pre-fix bug (ids 27-34) using the proper conversion. One of Claude's own correction-script bugs caught mid-fix: id 27 had already been manually corrected in an isolated diagnostic test earlier and got double-offset by the batch script — caught in verification, fixed before calling it done.
- Diagnosed a false alarm along the way: Brian's first re-test after pasting the fix still showed old (wrong) values — traced to Cloudflare deploy propagation lag (his test ran right at the edge of the rollout window), not a persisting code bug. Confirmed via a direct isolated re-test moments later.

**Bulk photo actions (GS v8.36):**
- Photo Organizer gained checkbox-based multi-select with a bulk action bar (Select All / Clear / Approve / Reject / Move to Chapter / Delete) — all actions fire concurrently via `Promise.all`, not sequentially. Pure GS-side change, no Worker/Cloudflare paste needed.
- Direct response to real-volume pain: approve-by-exception at dozens-of-photos scale still needed a way to act on multiple bad ones at once.

**Live Event Test Mode investigation (not a bug):**
- Brian reported the BFSeries#5 event card had vanished from the portal Home screen. Traced to `live_test: true` on the Worker's KV flags — when Live Event Test Mode is on, the portal pulls the next Live-Panel-eligible event out of the normal card list and shows it via the Live Banner instead (by design). Leftover from earlier testing, not a data or code bug. Brian confirmed and disabled it himself.

**Photo Capture banner → read-only Photo Viewer modal (portal v3.17.29):**
- The Dev-54 pilot's persistent purple "Photo Capture" banner (upload + curation UI) never had a dismiss path — only collapse/expand — so it sat permanently on Home regardless of relevance.
- Fully superseded by Live Panel's own capture buttons (Dev-57) and GS's Photo Organizer curation (Dev-58, now with bulk actions) — removed entirely and replaced with a lean read-only viewer (event picker + story-grouped thumbnail grid, no upload/curation buttons) opened via the existing header camera icon instead of occupying permanent Home space.
- Caught a real self-inflicted bug mid-edit: `PHOTO_MAX_BYTES`/`VIDEO_MAX_SECONDS`/`readVideoDuration` turned out to be shared with Live Panel's own upload validation, not exclusive to the old banner — first deletion pass would have silently broken Live Panel's file-size/video-length checks. Caught via reference check before deploying, restored.

**Results.html consolidation — investigated, deliberately deferred to Dev-63:**
- Searched past-session notes per Brian's request and found a full, previously-designed-but-never-shipped mockup (Dev-54, Jul 5): consolidate Podium/Skins/CTP into one "Highlights" tab, add a dedicated "📸 Photos" tab with the 3-section story (Pre-Competition/On the Course/Post-Round), trophy_moment icon on the podium card. Verified directly against live `generateResultsPage()` — confirmed none of it ever shipped (still the original 8 separate tabs).
- Also found a second, further exploratory thread (dated Jul 9, chat-title-mismatched — likely another "appended in error" case like Dev-58's addendum) that started wiring a native GS panel version but didn't reach `generateResultsPage()` either.
- The actual publish mechanism (curated photos → static results.html at publish time) was confirmed still fully unbuilt — the real remaining gap, unchanged since Dev-53/58.
- Explicitly held for Dev-63 as its own focused session rather than squeezed in after today's bug-fixing chain.

**Still not done — carried forward again from Dev-61 (unblocked, just not reached):**
- **Delete the 8 test photo rows** (ids 2, 3, 4, 7, 8, 9, 17, 18 — confirmed some still present, e.g. ids 2/3/4) before real BFSeries#5 traffic muddies the data. Now trivial with the new bulk-delete feature.
- **40-photo GS Photo Organizer scale test** — still not run; method (synthetic seed vs. real batch) still undecided.

**Carry-forward for Dev-63:**
- **Results.html rebuild — the actual next-session focus:** Highlights tab (consolidate Podium/Skins/CTP), Photos tab (3-section story, wired to real approved photos via `GET /photos?event=X`), and the publish-time mechanism in `grpPublish Final`/`generateResultsPage()` to actually embed the curated set into the static page. Prior mockup design (Dev-54) available as a starting reference, not a finished spec.
- Delete the 8 lingering test photo rows before real traffic.
- 40-photo GS Photo Organizer scale test.
- Season Money / Overall-pot flight system (Overall, Green, Combo, Gold, % podiums, $20 buy-in) — flagged this session as needing its own dedicated design pass, separate from the per-event payout formula fixed today.
- Everything else carried from Dev-57/58/59/60/61 untouched: icon-action-btn migration beyond Live Panel Photos, `worker.js` size/organization, full `bf_architecture.html` ERD redraw, stale Worker Endpoints reference table, Commissioner PIN architecture, push notification preference center, push notification recipient domain (all-`bfw=Yes` vs. registered-only), notification feed → Worker KV redesign, player picker rethink, Player Analytics/Insights layer, proactive pushId health check, GHIN "Following" list confirmation (Ron Grow, Wilbur Hlay, Mohamed Walli, Jeremy Burkett, Lou Strohl, Rich Potts).

**Final versions this session:**
- GS: v8.36 · 2026-07-13 (v8.33 Groups sync fix → v8.34 proportional payout → v8.35 whole-dollar skins → v8.36 bulk photo actions)
- Portal: v3.17.29 · 2026-07-13 (v3.17.25 Payout Cheat Sheet → v3.17.26 add card → v3.17.27 move to Event Day → v3.17.28 whole-dollar skins → v3.17.29 Photo Viewer modal)
- Worker: 3 deploys this session, all confirmed live and tested — approved-by-default photo curation, video media_type + R2 content-type fix, Meta filename timezone fix (`localWallTimeToUTC`) with `captured_at`/`media_type` now PATCH-able for future corrections.

**Dev-62 closed.**

---

## Session Dev-63 · 2026-07-14

**Focus:** Results.html rebuild — the item deferred from Dev-62. Consolidated Podium/Skins/CTP/Money into a single Highlights tab, added a Photos tab (3-section story, embedded at publish time), and fixed a pre-existing duplicate-Groups-tab bug found during the review.

**Scope decisions (confirmed with Brian before build):**
- **Photos tab data source:** embedded at GS publish time (matches how series/event data is already embedded for client-side event switching) rather than live-fetched by the static page — a photo approved/rejected after publish won't show until the next Publish. Brian's explicit call.
- **Highlights tab scope:** Podium + Skins + CTP + Money, all four folded into one tab (Brian expanded the original Dev-54 mockup's Podium+Skins+CTP scope to include Money too).
- **Historical events (Series 2-4):** confirmed zero risk to underlying scores/quotas/standings data — the rebuild only reorganizes tab markup and adds a new embed step. Series 2-4 simply show an empty Photos tab (no photo capture existed yet for those events) — expected, not a bug.

**Bug found and fixed — duplicate Groups tab:** `generateResultsPage()` had two identical `<div class="tab-content" id="tab-groups">` blocks back to back (both with `id="groups-iframe"`/`id="groups-no-archive"`), a duplicate-ID landmine that happened to be harmless only because both copies were byte-identical. Deduped to one.

**Tab consolidation (8 tabs → 6):**
- New tab order: Highlights · Standings · vs Par · 🐦 Birdies · 📸 Photos · ⛳ Groups.
- Highlights tab = 4 stacked cards (Podium, Skins, CTP, Money) with stable IDs (`highlights-podium-card`/`-skins-card`/`-ctp-card`/`-money-card`) added specifically so the client-side `loadEvent()` event-switcher function — which previously targeted `#tab-podium`/`#tab-skins`/`#tab-ctp`/`#tab-money` — could be re-pointed without breaking the event-pill switcher. All four selectors updated; verified via extraction + `node --check`.
- No data/calculation logic touched — purely a markup reorganization, confirming the zero-impact-to-history requirement above.

**Photos tab — built end-to-end:**
- Server-side: `generateResultsPage()` now accepts a 4th `photosData` param (`{ eventName: [approved photo rows] }`), groups the current event's photos into the three story sections (🌅 Pre-Competition / ⛳ On the Course / 🏆 Post-Round), renders a 3-column thumbnail grid per section (images via `<img>`, videos via `<video>`, 🏆 trophy-moment badge overlay), and shows a plain empty state when an event has no photos.
- Client-side: `ALL_PHOTOS_DATA` embedded alongside the existing `ALL_SERIES_DATA` JSON; new `renderPhotosTab(eventName)` mirrors the server-side grouping logic and is called from `loadEvent()` so the event-pill switcher updates Photos along with every other tab.
- Simple click-to-expand lightbox added (`openPhotoLightbox`/`closePhotoLightbox`) — dark overlay, tap outside or × to dismiss, video gets `controls autoplay` on open.
- Photos served via the existing public `GET /photos/serve/:id` route (approved-only, no PIN needed) — no Worker changes required for this session.

**Publish-time photo fetch — new `fetchPhotosForEvents()` helper:**
- Added a standalone async helper: takes a list of event names, calls `GET /photos?event=X` (Worker's existing public-approved-only tier) for each, returns `{eventName: [...]}`. Fail-open per event (a Worker/D1 hiccup never blocks the public page from publishing) — same philosophy as the Dev-57 groupings-sync fire-and-forget pattern.
- Wired into both publish paths: `publishAllPagesCore()` (the real End-of-Event/Publish-All flow — fetches photos for every event in the season) and `publishToNetlify()` (the manual live-mode Publish Results button — fetches for the season's events plus the current live event name).

**Verification performed (no live Worker/D1 access needed — pure code review + Node syntax tooling):**
- Extracted the outer `<script>` block and ran `node --check` — valid.
- Extracted the *nested* client-side script (the one embedded inside `generateResultsPage()`'s returned HTML string), reversed the outer template-literal escaping (`` \` ``→`` ` ``, `\$`→`$`, `\\`→`\`), stubbed the 3 real interpolation points (`ALL_SERIES_DATA`/`ALL_PHOTOS_DATA`/`PHOTOS_SERVE_BASE_CLIENT`), and ran `node --check` again — valid. Confirmed the double-escaped onclick-handler string concatenation in `renderPhotosTab()` (nested inside the template literal) resolves to correct HTML via a standalone Node repro of the exact same string-building logic.
- Confirmed no leftover references anywhere in the file to the removed `#tab-podium`/`#tab-skins`/`#tab-ctp`/`#tab-money` IDs.

**Deployed:** `source/BF_Golf_Scorer_8.html` pushed via `POST /deploy`, confirmed live via a fresh raw-GitHub fetch (Highlights/Photos tab markers and `GS_VERSION` both present in the pulled copy). No Worker or portal.html changes this session — Brian's local GS app picks this up on next launch via its existing auto-pull mechanism.

**Carry-forward for Dev-64:**
- **Live on-device verification** — this session's work was built and syntax-verified but not yet exercised against real live data (a real Publish click, real approved photos rendering in the grid, real event-switcher pill clicks moving Photos/Highlights correctly). First priority next session.
- Delete the 8 lingering test photo rows (ids 2, 3, 4, 7, 8, 9, 17, 18) — still not done, carried since Dev-61.
- 40-photo GS Photo Organizer scale test — still not run.
- Season Money / Overall-pot flight system (Overall, Green, Combo, Gold, % podiums, $20 buy-in) — still needs its own dedicated design pass (flagged Dev-62).
- Everything else carried from Dev-57/58/59/60/61/62 untouched: icon-action-btn migration beyond Live Panel Photos, `worker.js` size/organization, full `bf_architecture.html` ERD redraw, stale Worker Endpoints reference table, Commissioner PIN architecture, push notification preference center, push notification recipient domain (all-`bfw=Yes` vs. registered-only), notification feed → Worker KV redesign, player picker rethink, Player Analytics/Insights layer, proactive pushId health check, GHIN "Following" list confirmation (Ron Grow, Wilbur Hlay, Mohamed Walli, Jeremy Burkett, Lou Strohl, Rich Potts).

**Final versions this session:**
- GS: v8.37 · 2026-07-14 (v8.36 → v8.37, results.html rebuild)
- Portal: unchanged (v3.17.31, no portal.html edits this session)
- Worker: unchanged (no worker.js edits this session — Photos tab reuses existing public `GET /photos` and `GET /photos/serve/:id` routes as-is)

**Dev-63 closed.**

## Dev-63 Addendum — same chat, appended after a premature close-out

The line above ("Dev-63 closed") was written after just the initial results.html
rebuild — the session actually continued for a substantial amount of further work,
triggered by Brian catching a real production discrepancy. Documenting it all here
rather than retroactively editing the closed entry above.

**Highlights tab polish:** CTP and Skins cards swapped to Podium → CTP → Skins →
Money order (Brian's call). Verified in the real generated output, not just the
source edit. Tab later renamed from "Highlights" to "Winners" (label only — internal
`tab-highlights`/`highlights-*` IDs left untouched, zero functional risk for a
one-word display change).

**Photo ordering confirmed, not changed:** Brian asked to confirm photo grid order
reflects real capture-time metadata, not upload order. Traced the full chain — the
Worker's `GET /photos` already sorts by `section, sort_order, COALESCE(captured_at,
created_at)` (real EXIF/filename-derived timestamp first); the new GS-side code only
ever `.filter()`s that list, never re-sorts. Proved it with a standalone Node repro
using deliberately-scrambled upload-vs-capture order. No code change needed, already
correct.

**Netlify investigation — real production discovery:** Brian noticed the Netlify
project dashboard (`birdiefriends.netlify.app`) showed "Last deployed from Netlify
Drop... 2 months ago," and separately that `docs/results.html` hadn't updated since
June 17 despite Publish clicks in between. Investigated by directly fetching
`birdiefriends.com/results.html` — confirmed it's served via GitHub Pages
(`docs/results.html`), not Netlify at all; the Netlify project is a stale, disconnected
relic unrelated to what's actually live. Brian confirmed he has no memory of Netlify
being genuinely wired in during early development and `bf_architecture.html` never
referenced it either.

**Netlify relay retirement (shipped this session, GS v8.39):**
- Found and removed 5 real call sites hitting `/api/netlify/deploy` on the local
  launcher's Python server: `publishAllPagesCore()` (live, wired to 3 buttons),
  `grpPublish()`'s groupings deploy, `resetGroupingsToHoldingCore()`. Two more
  functions calling the same dead endpoint — `publishToNetlify()` and
  `publishSeriesStandings()` — turned out to be entirely unused dead code (no button,
  no caller anywhere in the file) and were deleted outright rather than migrated.
- New `deployPagesToGitHub()` helper: pushes each generated page straight to `docs/`
  on GitHub via the Worker's existing PIN-gated `POST /deploy` route — the same
  mechanism `docs/portal.html` already uses. Every publish is now a real, inspectable
  GitHub commit with the same rollback story as any other managed file.
- Removed the entire "Preview Mode" banner/badge system (`checkPreviewMode()` IIFE,
  `openPreviewFolder()`, the `preview-mode-badge` DOM element) — it only existed to
  relabel buttons when the local server reported `preview_mode`, which no longer
  applies now that publishing doesn't route through that server.
- Cosmetic cleanup: `netlify-publish-btn` → `publish-pages-btn`, `birdieRowsNetlify` →
  `birdieRowsHtml`, stray comments reworded.
- Verified via `node --check` on both the outer script and the unescaped nested
  client-side script (same rigor as the original rebuild), then re-ran the real
  `generateResultsPage()` function against sample data in-sandbox to confirm nothing
  broke — plumbing-only change, visually identical output.

**Real production verification — genuine success, initially looked like a failure:**
Brian ran a real "Publish All Pages" and saw the live page still showing old content
in his browser — turned out to be a stale browser cache, not a failed publish.
Confirmed via a cache-busted direct fetch of `docs/results.html`: the new content
(GS v8.40, correct Highlights card order, Photos tab) was genuinely live. Real lesson
for future verification: always fetch with a cache-buster before concluding a publish
failed, browser tabs can and do hold stale responses.

**Header version display — same root-cause class as the Dev-55 portal_version.txt
bug, found via a screenshot (GS v8.43):** GS's own in-app header showed a hardcoded
`v8.17 · 2026-07-10a` — two separate literal strings, completely disconnected from
`GS_VERSION`, last synced who-knows-when and never touched since. Root-fixed rather
than re-patched: removed both hardcoded strings, header now reads directly from
`GS_VERSION` (single source of truth, same fix philosophy as Dev-55's
`portal_version.txt` — two copies of the same fact will eventually disagree, one
source of truth can't).

**Money List history bug — the significant one, real financial data integrity issue:**
Brian caught the Series#4 Money List showing different dollar amounts than before
(compared against his own earlier screenshot). Root cause: `calculatePayout()` is a
pure function with zero per-event formula versioning — recalculated fresh from raw
scores every time results.html regenerates, using whatever formula is CURRENT. When
Dev-62's proportional payout structure replaced the old flat $40/$20/$10 podium +
$10/hole CTP model, every already-paid-out historical event (Series#2/3/4) silently
had its Money List rewritten to what the NEW formula would pay, not what was actually
handed out in cash.
- **Recovery:** pulled the last pre-Dev-62 commit of `docs/results.html` (`79c07c8d`,
  June 17) directly from GitHub commit history via the public web UI's embedded JSON
  payload (worked around `api.github.com`'s unauthenticated rate limit, which was hit
  repeatedly this session), extracted the embedded `ALL_SERIES_DATA`, and recomputed
  all three events' correct historical payouts using the exact old formula (also
  recovered from that era's source commit). Series#4's reconstructed numbers matched
  Brian's own screenshot exactly, validating the method before trusting it for
  Series#2/#3 (which had no independent screenshot to check against).
- **Root fix:** `saveEventToSeries()` now computes and freezes a `payoutSnapshot` on
  the event record at save-time — identical protection pattern to the existing
  per-event quota/actual snapshot, which exists for exactly this reason. Both
  `generateResultsPage()`'s server-render path and its embedded client-side
  event-pill-switcher duplicate now check for a stored snapshot first and only fall
  back to live recalculation for events that predate the fix.
- **Backfill:** new **⚕ Fix Historical Payouts** button (Series tab) — confirm-gated,
  idempotent, restores the exact recovered dollar amounts for Series#2/3/4 by setting
  their `payoutSnapshot` field only (scores/quotas/standings untouched). Brian still
  needs to click it (and Export JSON first as backup) — not yet confirmed run as of
  this addendum.
- Verified the fix mechanically: a synthetic historical event with deliberately
  wrong/garbage live score data still rendered its frozen snapshot dollar amounts
  correctly, proving the snapshot-first logic actually short-circuits live
  recalculation rather than just running alongside it.

**Two more real bugs found via a single screenshot (results.html header + top nav):**
- **Header title/date frozen on event-pill switch:** the header `<div>`s for event
  title/date had no `id` attributes at all in the markup; `loadEvent()`'s
  header-update code targeted `document.getElementById('hdr-event-date')`, an ID that
  simply didn't exist — silent no-op every single time. Every other tab updated
  correctly on pill click; only the header stayed stuck on whatever was
  server-rendered at initial page load. Fixed: real IDs added to both divs,
  `loadEvent()` now updates title, date, and `document.title` (browser tab title —
  also never wired up before).
- **Top nav "⛳ Groupings" link hijacked by the event-pill selector:**
  `updateGroupingsLink()` dynamically rewrote the white nav bar's Groupings href to
  match whichever event was selected via the results.html pills — so browsing to an
  old event silently redirected general-purpose navigation to that event's archive
  instead of the live/current groupings page. Per Brian's explicit design intent: the
  top nav should always be a static link to the live page; only the **Groups tab**
  (in the in-page tab bar) should be event-aware. Removed the function and both call
  sites entirely — nav link is now the static `/groupings.html` baked into the
  markup, full stop. Groups tab behavior untouched.

**New idea captured, not built — AI-generated event narratives:** Brian's concept —
short, humorous per-player + overall event write-ups generated from historical data
already in GS (quota/skins/CTP/season trends), to accompany the Photos tab as a way
to memorialize events without anyone writing anything. Full concept captured in new
`source/specs/BF_EventNarratives_Spec.md`: batched LLM call at Publish time (not
live per-page-view — static site, no backend to hold credentials), new PIN-gated
Worker route holding an Anthropic key as a Cloudflare secret (explicitly learning
from a real precedent already in this codebase — a prior `ANTHROPIC_API_KEY` in
`launch_golf_scorer.py` was deliberately revoked and removed during the Session 40
credential-hygiene pass), tone guardrails (good-natured ribbing, never personal or
repeatedly-negative about one person), and a preview-before-publish step recommended
at least initially. Not scoped for a build — open questions listed in the spec for
Dev-64 to resolve before any code gets written.

**Docs updated this addendum:**
- `BF_Operations_Guide.md` — Generated Pages deploy procedure rewritten for the new
  `docs/`-direct mechanism; Token Recovery section updated (flagged
  `launch_golf_scorer.py`'s Publish-relay token as possibly now-unused, Brian's to
  confirm/remove); Current Versions table brought current across the board (was
  stale since ~Dev-40/Session-40 era for several rows); four new Backlog & Known
  Issues rows (money-list history bug, Netlify retirement, header title/date fix,
  top-nav Groupings fix); new forward-looking row for the narrative concept.
- `bf_architecture.html` — `golfscorer` DETAILS node rewritten (v8.43, new publish
  mechanism, payoutSnapshot). New Dev-63-specific currency note added, kept
  deliberately separate from the existing Dev-56 D1/ERD currency note — no
  schema/Worker changes this session, ERD redraw still its own deferred session as
  before.
- `source/specs/BF_EventNarratives_Spec.md` — new file, full concept spec (see above).

**Carry-forward for Dev-64 — final, supersedes the shorter list in the entry above:**
- **Brian needs to click "⚕ Fix Historical Payouts" (Series tab) and then re-Publish**
  — the code fix and backfill data are deployed, but the actual localStorage
  correction hasn't been applied/republished as of this addendum. First thing to
  verify next session.
- **AI-generated event narratives** — candidate main focus, per `BF_EventNarratives_Spec.md`.
  Needs the open questions in that doc resolved (API key provisioning, preview-vs-auto
  publish, v1 scope) before any code gets written.
- **Live on-device verification of the full results.html rebuild** — real Publish
  click, real photos rendering, real event-switcher behavior. Largely done this
  addendum via Brian's own screenshots (nav fixed, payout fixed, title/date fixed
  live) but worth a final confirmation pass.
- `launch_golf_scorer.py` GitHub token — possibly unused now, Brian to check/remove
  next time that file is open (see Token Recovery in Ops Guide).
- Delete the 8 lingering test photo rows (ids 2, 3, 4, 7, 8, 9, 17, 18) — still not
  done, carried since Dev-61.
- 40-photo GS Photo Organizer scale test — still not run.
- Season Money / Overall-pot flight system — still needs its own dedicated design pass
  (flagged Dev-62).
- Everything else carried from Dev-57 through Dev-62 untouched: icon-action-btn
  migration beyond Live Panel Photos, `worker.js` size/organization, full
  `bf_architecture.html` ERD redraw (D1/ERD specifically, unrelated to this session's
  GolfScorer-node update), stale Worker Endpoints reference table, Commissioner PIN
  architecture, push notification preference center, push notification recipient
  domain (all-`bfw=Yes` vs. registered-only), notification feed → Worker KV redesign,
  player picker rethink, Player Analytics/Insights layer, proactive pushId health
  check, GHIN "Following" list confirmation (Ron Grow, Wilbur Hlay, Mohamed Walli,
  Jeremy Burkett, Lou Strohl, Rich Potts).

**Final versions this addendum:**
- GS: v8.43 · 2026-07-14 (v8.37 rebuild → v8.38 CTP/Skins order → v8.39 Netlify
  retirement → v8.40 header version fix → v8.41 payout history fix → v8.42 title/nav
  fixes → v8.43 Winners rename)
- Portal: unchanged (v3.17.31, no portal.html edits this session)
- Worker: unchanged (no worker.js edits — everything reused existing routes)
- `bf_architecture.html`: updated this addendum (GolfScorer node + Dev-63 currency note)
- `BF_Operations_Guide.md`: updated this addendum
- New: `source/specs/BF_EventNarratives_Spec.md`

**Dev-63 fully closed (addendum included).**

---

## Session Dev-64 · 2026-07-16 (in progress)

**Focus so far:** Diagnosed and fixed the recurring "Failed to fetch... GHIN Name flags from Jotform" bug Brian flagged from the Groups tab GHIN paste-import UI — traced to `launch_golf_scorer.py`'s local proxy server, not Jotform or GS itself.

**Root cause — single-threaded local proxy server:**
`launch_golf_scorer.py` used `socketserver.TCPServer`, which handles exactly one HTTP request at a time. GS fires several proxy calls in close succession — the GHIN Name map fetch on every Groups-panel open/Apply (Dev-59 removed its cache specifically to always refetch fresh), plus portal events/registrations, sheets/netlify status, groupings, scorecard submissions. While the server was busy on one call, others queued behind it; if any single call ever hung on the network, the entire server froze for every caller — matching Brian's report that it "usually needs a relaunch" to clear, since only killing the process actually released a stuck connection.

**Fix — threaded local server:**
Swapped `socketserver.TCPServer` for a `socketserver.ThreadingMixIn` + `http.server.HTTPServer` combination (`daemon_threads=True`, `allow_reuse_address=True`). Each request now runs on its own thread, so one slow/stuck call can no longer block the rest. `allow_reuse_address` also reduces "port already in use" on quick relaunches (a related, previously-undiagnosed annoyance). No route/proxy logic touched — purely how the server is constructed. **Confirmed fixed** — Brian pasted the real key back into the local runtime copy, relaunched GS, issue resolved.

**`launch_golf_scorer.py` backup — real gap closed:**
This file had never been backed up anywhere, by design (laptop-only, holds `JOTFORM_API_KEY` in plaintext). Brian caught this while reviewing the fix and asked for a backup. Pushed a sanitized copy to `source/launch_golf_scorer.py` with `JOTFORM_API_KEY` blanked to `""` — confirmed via grep on the pulled raw file that the real key is not present. Brian confirmed the real key is back in the local runtime copy — the library copy stays blank on every future push of this file. Documented in Ops Guide §3 Token Recovery and added a Known Issues row (§10).

**Files touched this session:**
- `source/launch_golf_scorer.py` — new library backup, sanitized (key blanked), threading fix included
- `source/BF_Operations_Guide.md` — Token Recovery note + new Known Issues rows for this session's fixes
- `docs/portal.html` + `source/portal.html` + `docs/portal_version.txt` + `source/portal_version.txt` — gatheringId-aware matching fix (v3.17.32), universal RSVP icon-row redesign (v3.17.33), Share BirdieFriends button (v3.17.34)
- `source/BF_Golf_Scorer_8.html` — unpublished-groupings-changes banner (v8.44), then DiffHCP persistence fix (v8.45)

**Per-event "Send Notification" — already existed, surfaced + hardened:**
Brian asked to add a way to push OneSignal notifications to only the players registered for a specific event, from the event card. Found this was already fully built (commissioner-only "📣 Send Notification" button under the card's "Players ›" expand, `openCommissionerPush()`/`sendCommissionerPush()`, targets via `osSendToPlayers()`, documented in Ops Guide §6 as `bfType: 'event_push'`) — just not discoverable from the card face itself, one tap deeper than expected.

While confirming it, found a real latent gap: `textAllPlayers()`, `openCommissionerPush()`, and `sendCommissionerPush()` all matched registrations by raw `eventName` string, not the gathering-ID-aware matching Dev-58 applied everywhere else after the Chooch recurring-Gathering title-collision bug (same class: a same-titled recurring Gathering in its 2nd+ week could pull in the wrong week's registrants). Harmless for BF Series events (unique titles) but real for Gatherings. Fixed all three functions to match by `gatheringId` when `evt.source === 'gathering'`, falling back to title match otherwise — same pattern already used in `findMyReg`/`buildEventCard`/`getSimpleCapacityStatus`. `node --check` run on all extracted inline script blocks before deploy, clean.

**Portal deployed:** v3.17.32 · 2026-07-16, all 4 files (`docs/portal.html`, `source/portal.html`, `source/portal_version.txt`, `docs/portal_version.txt`).

**RSVP redesign — universal icon-row Yes/Sub/No control (Series + Gatherings):**
Brian reported real player feedback: a couple of players were registering Yes and immediately unregistering as a workaround, because Series/Weekend events had no explicit "No" option before registering — only "Register." (Gatherings already had Yes/No/Sub as three separate full-width stacked buttons, but Brian doesn't like the real-estate cost of that pattern either.) Mocked up three compact alternatives (segmented toggle, icon row, inline compact buttons) styled directly on the actual dark-green card colors before building anything; Brian picked the icon row — small circular Yes/Sub/No icons with the current status shown filled/gold, matching the existing `icon-action-btn` component already used for Live Panel Photo Capture (Dev-57) and explicitly flagged then as the intended pattern for exactly this kind of control (parallel, short-nameable, space-constrained peer actions).

**Scope, per Brian's explicit "universal approach" request:** replaced `buildActionButtons()` entirely for both Gatherings and standard (Series/Weekend/etc.) events with a new shared `buildRsvpIconRow(evt, myReg, opts)` helper. Every prior status branch (never responded, registered Yes/Sub, declined, stale-response, hard-capacity-locked, 5th-player-pending) now renders the same three-icon row instead of its own bespoke button set — current status highlighted, tapping any icon submits that status directly via the existing `submitRegistration()`, which already routes Gatherings to `submitGatheringRegistration()` and handles new-vs-existing PUT/POST internally.

**Capacity semantics preserved exactly, not simplified away:**
- Series' existing overflow behavior (a full event's "eager Yes" tap actually submits as `Sub`, not `Yes`, to avoid literally exceeding the cap) is preserved via a `yesSubmitsAs` override — the icon still reads "Yes," the literal submitted value changes underneath, same as the old single-button label swap did.
- Gatherings' existing behavior (Yes tap always submits literal `Yes` even over capacity — an intentional over-cap waitlist model, different from Series on purpose) is untouched — no override applied there.
- The hard-capacity-lock edge case (Series only) disables the Yes icon (grayed, non-interactive) unless the player is already Yes, mirroring the old lock's intent exactly; Sub and No stay live.

**Real gap closed as a side effect:** `submitRegistration()`'s direct-`'No'` path was previously unreachable for Series events (only `changeRegistration()`'s Unregister button ever produced `'No'`, with its own correct toast/park behavior) — now that the icon row lets players submit `No` directly, that path had to be made correct too. Fixed to park the card and show "Marked as not attending [event]" (mirroring `submitGatheringRegistration()`'s existing `'No'` handling) instead of falling through to a wrong "🔄 Sub registered" toast.

**Trade-off, stated plainly:** the old Series-only "Unregister" button routed through `changeRegistration()`, which shows an Undo toast on cancel. The new universal icon row routes every tap (including No) through `submitRegistration()` uniformly for both event types — matching how Gatherings' three buttons already worked (no Undo toast) rather than preserving a Series-only affordance during the merge. Switching back is still one tap on the Yes/Sub icon, just without the toast's explicit Undo action.

`node --check` run on all extracted inline script blocks before deploy, clean. Spot-checked every new `onclick` target and CSS class resolves.

**Portal deployed:** v3.17.33 · 2026-07-16, all 4 files.

**Groupings/GS quota mismatch — real staleness, root cause found, banner shipped:**
Brian caught Wilbur Hlay showing a different quota on the live `groupings.html` (HCP 8.6, no adjustment) than in GS's Groups tab (HCP 8.3, with a visible "HCP change (8.6→8.3)" quota-adjustment breakdown), and flagged that other players could be affected too. Investigated by pulling the live `docs/groupings.html` directly — it already showed HCP 8.3 by the time of investigation (the file's `publishedAt` timestamp was very recent, same day), meaning the mismatch had already resolved itself via a subsequent Publish click before or during this conversation.

**Root cause confirmed:** `grpPublish()` bakes a one-time snapshot of GS's in-memory `grpPlayers` into the static `groupings.html` at the moment "Publish Groupings" is clicked — there's no live connection between the Groups tab and the public page afterward. Any HCP/quota correction made in GS after the last publish (GHIN import, manual table edit, group/tee-time change) silently goes stale on the public page with zero warning, until Publish is clicked again. This is the existing, intentional "replace-on-publish" architecture from Dev-57 — not a new bug, but a real blind spot: nothing ever told the commissioner the two had drifted apart.

**Fix shipped (GS v8.44) — unpublished-changes banner:**
- New `grpComputePublishFingerprint()` — a lightweight fingerprint of exactly what generates the published page (each player's group assignment, sort order, HCP, quota, tee), independent of anything irrelevant like admin panel state.
- `_grpPublishedFingerprint` module-level snapshot, captured on every successful **non-Hidden** publish (a Hidden/holding-page publish doesn't show real grouping data, so it's deliberately excluded from marking things "in sync").
- `grpUpdatePublishStatusBanner()` compares the live fingerprint against the last-published one and shows/hides a new amber banner ("⚠ Groupings changed since last publish — the public page doesn't reflect this yet") next to the Publish button.
- Hooked into `grpRenderPool()` and `grpRenderGroups()` — both already fire after every meaningful mutation (confirmed via the Dev-62 fix that made GHIN imports re-render both), so the banner check runs automatically after any relevant change without needing to instrument each individual mutation call site (GHIN paste, manual HCP edit, drag-and-drop reassignment, etc. all funnel through these two renders).
- `_grpPublishedFingerprint` resets to `null` on a fresh `grpFetchRegistrants()` call, so switching events or starting a new session doesn't spuriously compare against an unrelated prior publish.

`node --check` clean on the full extracted script; confirmed the new banner element ID is unique and both new functions are singly-defined before deploy.

**Portal follow-up:** none needed — this was entirely GS-side (native app), no worker.js or portal.html changes.

**DiffHCP manual HCP entries silently overwritten on re-fetch — real bug, fixed:**
Brian reported Wilbur Hlay and Jeremy Burkett (both DiffHCP — real handicaps, no GHIN account) needed their manually-entered HCP re-typed repeatedly, not holding persistently. Traced to `grpMergePlayers()` (runs on every "Fetch Registrants" click): its "always refresh HCP + quota from latest series history" step only ever checked `!existing.isNoHcp` — DiffHCP players were never distinguished from normal GHIN-tracked players at the data level (the DiffHCP concept only ever existed transiently, re-derived each paste from the Membership form's GHIN Name field, never stored on the player object itself). So every re-fetch silently overwrote their manually-typed HCP with stale `playerHistory[name].currentHcp` from series data — the same value every time, since GHIN never has a real number for these two.

**Fix (GS v8.45):** added a persistent `isDiffHcp` flag actually stored on the player record. Set `true` in `grpApplyGhinPaste()`'s existing DIFF_HCP branch; cleared back to `false` if a later paste finds the Membership form's GHIN Name field reset to blank/normal (so it doesn't outlive the situation that caused it). `grpMergePlayers()`'s refresh guard changed from `!existing.isNoHcp` to `!existing.isNoHcp && !existing.isDiffHcp`. New players default to `isDiffHcp: false`. `grpSaveData()`/`grpGetData()` already persist `grpPlayers` generically (JSON round-trip), so no separate storage-layer change needed. `node --check` clean; confirmed the four edit sites landed via the commit patch directly (raw.githubusercontent.com was showing its usual multi-minute-stale cache).

**Portal follow-up:** none — GS-side only, same as the groupings banner fix above.

**Share BirdieFriends button — About screen (portal v3.17.34):**
Brian asked for a way to share the app, suggested the Info/About area. Added a new card in `screen-about`, matching the existing "New to BirdieFriends?" card's styling exactly (dark green card, gold button) — sits right below it. New `shareApp()` function uses the native Web Share API (`navigator.share`) when available, which is the standard mobile share-sheet pattern (iOS/Android — the two platforms the app is actually used on, per the existing iOS/WebKit notes in Ops Guide §8); falls back to clipboard-copy with a toast, then a raw `prompt()` as a last resort for anything with neither. Shares `https://birdiefriends.com` (the public landing page) rather than `portal.html` directly — a first-time recipient needs the sign-up flow, not the existing-member Player Picker gate. `AbortError` (user backing out of the native share sheet) is treated as a normal cancel, not a logged/toasted failure. `node --check` clean; confirmed `shareApp` is singly-defined and the button's `onclick` resolves to it.

**Carry-forward / still open from Dev-63, untouched so far this session:**
- **Live on-device verification of the RSVP icon row** — built and syntax-checked but not yet exercised against real live data (real Yes/Sub/No taps on both a Series card and a Gathering card, capacity-lock/overflow edge cases, the new direct-No park/toast behavior). First priority next session.
- **Live on-device verification of the unpublished-changes banner** — built and syntax-checked but not yet exercised against a real GHIN import/HCP edit followed by a Publish click. Second priority next session.
- **Live on-device verification of the DiffHCP fix** — re-enter Wilbur/Jeremy's HCP, click Fetch Registrants again, confirm it holds this time. Third priority next session.
- **Live on-device verification of the Share button** — tap it on an actual phone (iOS + Android if possible) and confirm the native share sheet opens rather than falling through to clipboard. Fourth priority next session. (Revised v3.17.35: share text shortened to "Welcome to BirdieFriends." and target link changed to `portal.html` instead of the landing page, per Brian's follow-up.)
- Brian still needs to click **⚕ Fix Historical Payouts** (Series tab) and re-Publish — money-list history fix deployed but not yet applied/republished
- Delete the 8 lingering test photo rows (ids 2, 3, 4, 7, 8, 9, 17, 18) — carried since Dev-61
- 40-photo GS Photo Organizer scale test — still not run
- AI-generated event narratives (`BF_EventNarratives_Spec.md`) — open questions need resolving before any code
- Season Money / Overall-pot flight system — needs its own dedicated design pass
- Everything else carried from Dev-57 through Dev-63 untouched: icon-action-btn migration beyond Live Panel Photos, `worker.js` size/organization, full `bf_architecture.html` D1/ERD redraw, stale Worker Endpoints reference table, Commissioner PIN architecture, push notification preference center, push notification recipient domain (all-`bfw=Yes` vs. registered-only), notification feed → Worker KV redesign, player picker rethink, Player Analytics/Insights layer, proactive pushId health check, GHIN "Following" list confirmation (Ron Grow, Wilbur Hlay, Mohamed Walli, Jeremy Burkett, Lou Strohl, Rich Potts), `launch_golf_scorer.py` GitHub token possibly-unused cleanup.

**Session still open — not yet closed.**
