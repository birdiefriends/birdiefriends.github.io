
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
