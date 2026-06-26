
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
