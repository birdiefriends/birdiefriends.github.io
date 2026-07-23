-- BF Gatherings — D1 Schema Log
-- Database: birdiefriends-gatherings (D1, bound to Worker as env.DB)
-- This file is the authoritative migration history. Append new entries below,
-- never edit history. Each entry should be run in the D1 Console and then
-- mirrored here via /deploy, in that order.

-- ============================================================
-- Entry 1 — 2026-06-20 — Session Dev-43
-- Initial MLP schema: gatherings, crews, crew_members, registrations
-- Per BF_Gatherings_Spec.md §9 / §11 Q7 — MLP scope only.
-- Deferred to a later entry: fill_list_members, host_exclusions,
-- player_host_mutes (Post-MLP, see spec §11 Q2).
-- ============================================================

CREATE TABLE gatherings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  host_id TEXT NOT NULL,
  title TEXT NOT NULL,
  venue TEXT,
  event_time TEXT NOT NULL,
  size INTEGER,
  crew_id INTEGER REFERENCES crews(id),
  fill_list_enabled INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE crews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  host_id TEXT NOT NULL,
  name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE crew_members (
  crew_id INTEGER NOT NULL REFERENCES crews(id),
  player_id TEXT NOT NULL,
  PRIMARY KEY (crew_id, player_id)
);

CREATE TABLE registrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gathering_id INTEGER NOT NULL REFERENCES gatherings(id),
  player_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('yes','no','sub')),
  registered_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (gathering_id, player_id)
);

-- Confirmed live via D1 Console, Session Dev-43:
-- SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%';
-- → gatherings, crews, crew_members, registrations

-- ============================================================
-- Entry 2 — 2026-06-21 — Session Dev-45
-- Added gathering_type column for descriptive sub-format (Individual Play,
-- 4 Man Scramble, 2 Man Scramble, 1 Man Scramble, etc.) — Host-facing only,
-- kept deliberately separate from the existing badge/format-class machinery
-- (which stays "Gathering" → "Host Gathering" badge, untouched). Confirmed
-- live via D1 Console, Brian, 2026-06-21.
-- Worker (POST /gatherings insert, GET /gatherings select) and portal
-- (dropdown + display) wiring NOT YET DONE — carried to next session.
-- ============================================================

ALTER TABLE gatherings ADD COLUMN gathering_type TEXT;

-- ============================================================
-- Entry 3 — 2026-06-22 — Session Dev-47
-- Added description column (optional free-text, Host-authored). Displayed
-- as an expandable "📋 Details ▸" section on Crew member event cards;
-- shown inline on Host Management Panel card. Worker POST /gatherings
-- and portal form/card wiring shipped same session (v3.16.3).
-- Confirmed live via D1 Console, Brian, 2026-06-22.
-- ============================================================

ALTER TABLE gatherings ADD COLUMN description TEXT;

-- ============================================================
-- Entry 4 — 2026-06-23 — Session Dev-49
-- Added member_preferences table for Tier-2 notification prefs.
-- Binary Gathering Alerts gate lives in Jotform QID 26 (gatheringalerts).
-- This table stores richer per-member preferences (days/times/venues)
-- for future Tier-2 matching — JSON blob in `prefs` column.
-- Worker routes: GET /members/:player_id/prefs, PUT /members/:player_id/prefs.
-- ============================================================

CREATE TABLE IF NOT EXISTS member_preferences (
  player_id  TEXT PRIMARY KEY,
  prefs      TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- Entry 5 — 2026-06-23 — Session Dev-49 (addendum)
-- Added tee_time_status column to gatherings table.
-- Values: 'confirmed' (default) | 'suggested' (host still working it out).
-- Shown on crew cards as "(suggested)" beside the time when not confirmed.
-- Worker: POST /gatherings insert + PATCH /gatherings/:id allowed fields updated.
-- ============================================================

ALTER TABLE gatherings ADD COLUMN tee_time_status TEXT NOT NULL DEFAULT 'confirmed';

-- ============================================================
-- Entry 6 — 2026-06-23 — Session Dev-49 (addendum)
-- Added host_note column to registrations table.
-- Optional free-text message from crew member to host, submitted
-- alongside Yes/No/Sub response. Shown in Host Management Panel
-- per-player response detail. Blank/null = no note.
-- ============================================================

ALTER TABLE registrations ADD COLUMN host_note TEXT;

-- ============================================================
-- Entry 7 — 2026-07-03 — Session Dev-54
-- Photo Capture architecture (§9g pilot testbed). Deliberately bypasses
-- Jotform — capture goes straight to the Worker (POST /photos/upload),
-- which writes bytes to R2 (env.PHOTOS_BUCKET) and metadata to D1 in the
-- same request. No sync/polling step needed as a result.
-- REQUIRES: PHOTOS_BUCKET R2 bucket created + bound to the Worker in the
-- Cloudflare dashboard BEFORE the new Worker routes will function —
-- this is a manual one-time step, not something /deploy can do.
-- Worker routes added same session: POST /photos/upload, GET /photos,
-- PATCH /photos/:id (curation), GET /photos/serve/:id (R2 stream, gated
-- to approved-only unless pin supplied).
-- Portal: Photo Capture Test panel added to Commissioner Admin →
-- Event Day Controls (Dev-54).
-- ============================================================

CREATE TABLE event_photos (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  event_name        TEXT NOT NULL,
  section           TEXT NOT NULL CHECK (section IN ('pre_competition','on_course','post_round')),
  r2_key            TEXT NOT NULL,
  captured_by       TEXT,
  caption           TEXT,
  is_trophy_moment  INTEGER NOT NULL DEFAULT 0,
  curation_status   TEXT NOT NULL DEFAULT 'pending' CHECK (curation_status IN ('pending','approved','rejected')),
  sort_order        INTEGER,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_event_photos_lookup ON event_photos(event_name, section, curation_status);

-- ============================================================
-- Entry 8 — 2026-07-03 — Session Dev-54
-- Video capture support for the Photo Capture Test panel. Deliberately
-- minimal: no thumbnail generation (no ffmpeg-class processing available in
-- a Worker), no Range/seek support on GET /photos/serve/:id (fine at the
-- ~20-second clip lengths this enforces). Constraints enforced both
-- client-side (UX) and server-side (real limit, per Worker request body
-- size ceiling): 25MB max file size, ~20s soft max clip duration (checked
-- client-side via <video> loadedmetadata before upload attempt).
-- media_type is inferred server-side from the uploaded file's MIME type,
-- never trusted from the client.
-- ============================================================

ALTER TABLE event_photos ADD COLUMN media_type TEXT NOT NULL DEFAULT 'image';

-- ============================================================
-- Entry 9 — 2026-06-26 — Session Dev-51
-- Venue Manager / autocomplete. Backs the "Your Courses" D1-first
-- suggestion list in Gathering create/edit forms, ahead of falling
-- through to the Google Places AutocompleteSuggestion API.
-- Worker routes: GET /venues (public, active-only), GET /venues?pin=
-- (commissioner, all rows), POST /venues, PATCH /venues/:id (toggle active).
-- Seeded same session: Blue Shamrock, Whitetail, Moselem Springs,
-- Woodstone, Lord's Valley, Other.
-- ============================================================

CREATE TABLE IF NOT EXISTS venues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 99
);

-- ============================================================
-- Entry 10 — 2026-06-27 — Session Dev-52
-- Gathering Templates (§20) — pull-based reuse for recurring hosts
-- (Chooch/Tony use case). crew_snapshot is a point-in-time JSON copy,
-- not a live reference — departed members are silently dropped with a
-- toast count when a template is applied. Date/time never stored.
-- Worker routes: POST/GET/DELETE /gathering-templates.
-- ============================================================

CREATE TABLE IF NOT EXISTS gathering_templates (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  host_id        TEXT NOT NULL,
  name           TEXT NOT NULL,
  title          TEXT,
  venue          TEXT,
  capacity       INTEGER,
  gathering_type TEXT,
  description    TEXT,
  crew_snapshot  TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- Entry 11 — 2026-07-05 — Session Dev-55
-- Player Personalization migration — Parked/Seen/FirstLoad moved off
-- localStorage (was device-local, broke across Brian's own laptop/
-- iPad/phone use — "Parked syndrome", open since Dev-54's audit).
-- First-device-wins capture pattern: row presence in player_event_state
-- is what tells a client whether to capture local state once via
-- /migrate, or just read D1 from then on.
-- Worker routes: GET /player-state/:player_id, POST .../migrate,
-- POST .../event, POST .../seen-bulk, admin POST /player-meta/seed.
-- ============================================================

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

-- ============================================================
-- Entry 12 — 2026-07-05 — Session Dev-55
-- Same sweep as Entry 11 — two more localStorage keys found to have
-- the identical device-local bug: bf_announcements_dismissed (was a
-- single GLOBAL key, not even per-player) and bf_sunday_done_{date}
-- (Commissioner Sunday Checklist, didn't sync across Brian's devices).
-- Worker routes: POST /player-state/:player_id/announcement,
-- .../announcements-bulk; GET/POST /commissioner-checklist(/toggle).
-- ============================================================

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

-- ============================================================
-- Entry 13 — 2026-07-05 — Session Dev-55 (addendum)
-- Migration-integrity fix: the original "migrated = any row exists in
-- player_event_state" check could be falsely tripped by proxy
-- registration (registering a Gathering slot for another player writes
-- a real row under their identity before their own device ever opens
-- the app) — silently skipping their real first-device capture and
-- losing their genuine local Parked/Seen history.
-- migrated_at is set only via POST .../migrate using COALESCE, so it
-- never overwrites a genuine first-migration timestamp.
-- ============================================================

ALTER TABLE player_meta ADD COLUMN migrated_at TEXT;
ALTER TABLE player_meta ADD COLUMN announcements_migrated_at TEXT;

-- ============================================================
-- Entry 14 — 2026-07-06 — Session Dev-56
-- Registration Intent / AWR (Awaiting Registration) flag. A
-- commissioner-only side-note for the Registration Tracker tool —
-- "I know they're playing, they just haven't registered yet" — kept
-- deliberately OUT of the real Jotform Register? answer/regData, since
-- that status flows through capacity counts, Text All Players, push
-- targeting, and event-card rendering across the whole app. Row
-- presence = flagged; per-event, unlike Entry 15 below.
-- Worker routes: GET /registration-intent, POST /registration-intent/toggle.
-- ============================================================

CREATE TABLE IF NOT EXISTS registration_intent (
  event_name  TEXT NOT NULL,
  player_name TEXT NOT NULL,
  marked_at   TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (event_name, player_name)
);

-- ============================================================
-- Entry 15 — 2026-07-06 — Session Dev-56
-- Inactive Player Interest — a durable, player-level flag (NOT
-- event-scoped like Entry 14) marking Inactive members the
-- commissioner knows want back in. Jotform has no "interested in BF
-- Series" field, and the full Inactive roster is too large to recruit
-- against blindly; this builds a reusable shortlist over time. Tied
-- into the Registration Tracker (starred players appear there too,
-- tagged 💤 Inactive; registering one Yes/Sub auto-restores them to
-- Active in Jotform via the existing restoreActiveIfNeeded pattern).
-- Worker routes: GET /inactive-interest, POST /inactive-interest/toggle.
-- ============================================================

CREATE TABLE IF NOT EXISTS inactive_player_interest (
  player_name TEXT PRIMARY KEY,
  marked_at   TEXT NOT NULL DEFAULT (datetime('now'))
);


-- ============================================================
-- Entry 16 -- 2026-07-07 -- Session Dev-57
-- Event Groupings -- synced from GolfScorer's grpPublish() alongside
-- its existing GitHub Pages deploy. Gives the Worker a real per-player
-- tee time independent of the event's own published start time, used
-- by classifyPhotoSection() to tell pre_competition/on_course/post_round
-- photos apart without relying on client-reported guesses alone.
-- Worker routes: POST /groupings/publish (replace-on-publish, PIN-gated),
-- GET /groupings (PIN-gated).
-- ============================================================

CREATE TABLE IF NOT EXISTS event_groupings (
  event_name   TEXT NOT NULL,
  player_name  TEXT NOT NULL,
  group_number INTEGER,
  tee_time     TEXT
);

-- ============================================================
-- Entry 17 -- 2026-07-10 -- Session Dev-60
-- Upload Attempts Log -- a D1-backed daily cap on photo upload attempts,
-- built as a backstop independent of the manual Photo Upload Pause KV
-- kill switch (that switch was later found to be dead code -- see
-- Dev-63 notes -- it only drives its own admin display, nothing
-- upstream ever checks it). Verified writing correctly under live test
-- at the time. NOTE (added Dev-67, retroactively): not referenced
-- anywhere in the current worker.js as of this entry's addition --
-- status (still in active use vs. quietly orphaned) not reconfirmed
-- when this catch-up entry was written. Flagged for Brian to check.
-- ============================================================

CREATE TABLE IF NOT EXISTS upload_attempts_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  event_name  TEXT NOT NULL,
  player_name TEXT,
  attempted_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- Entry 18 -- 2026-07-21 -- Session Dev-65
-- Scorecards -- a portal-native "Log My Score" capture path (card +
-- Live Panel), deliberately separate from the Jotform-backed
-- SCORECARD_FORM_ID pipeline that still feeds official Series
-- quota/points/payouts untouched. Same event_name /
-- 'gathering:<id>' key convention as event_photos. One row per
-- player per event (upsert on save).
-- Worker routes: POST/GET/DELETE /scorecards.
-- ============================================================

CREATE TABLE IF NOT EXISTS scorecards (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  event_name  TEXT NOT NULL,
  player      TEXT NOT NULL,
  holes       TEXT,
  marks       TEXT,
  tee_box     TEXT,
  front9      INTEGER,
  back9       INTEGER,
  total       INTEGER,
  captured_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- Entry 19 -- 2026-07-21 -- Session Dev-66
-- Par-aware fast-capture scorecard entry + real 9-hole support.
-- venues.pars stores the 18-hole par layout per venue (Front 9/Back 9
-- grids in Venue Manager); scorecard mark entry couples to it directly
-- when known. gatherings.holes and scorecards.hole_count/hole_half
-- carry 9-vs-18-hole and which-half state through the whole capture
-- and history path.
-- Worker routes: PATCH /venues/:id/pars, pars exposed on GET /venues;
-- holes on Gatherings create/edit; hole_count/hole_half on scorecards
-- create.
-- NOTE (added Dev-67): this entry originally also listed
-- "ALTER TABLE scorecards ADD COLUMN venue TEXT" as executed this
-- session. It wasn't -- confirmed via live PRAGMA table_info after
-- Save My Score started throwing D1_ERROR "no column named venue"
-- in production. See Entry 21 for the actual fix. Log corrected
-- rather than left wrong.
-- ============================================================

ALTER TABLE venues ADD COLUMN pars TEXT;
ALTER TABLE gatherings ADD COLUMN holes INTEGER;
ALTER TABLE scorecards ADD COLUMN hole_count INTEGER;
ALTER TABLE scorecards ADD COLUMN hole_half TEXT;

-- ============================================================
-- Entry 20 -- 2026-07-22 -- Session Dev-67
-- Weather History + Sticky Notes -- the "app that remembers golf"
-- framing continued. venues.lat/lng is a manual, commissioner-entered
-- coordinate (Venue Manager) -- deliberately not auto-geocoded by
-- default, since a small local course is often unresolvable by name
-- through a general geocoding service and a wrong silent guess would
-- be worse than an honest gap. geocode_cache is the automatic fallback
-- for any venue without a manual entry: a one-time lookup against
-- Open-Meteo's free Geocoding API, cached by normalized venue name so
-- it only ever runs once. event_weather caches one Open-Meteo Archive
-- API result per event (historical weather for a fixed date never
-- changes) -- fetched fire-and-forget right after a player's first
-- photo or scorecard capture for that event. event_notes is a running
-- comment thread per event, addable by registered Yes/Sub players and
-- Crew/Host only, readable by anyone who can see the card -- shown on
-- both the live event card and My History.
-- Worker routes: PATCH /venues/:id/coords; GET/POST /weather,
-- POST /weather/capture; GET/POST /notes, DELETE /notes/:id.
-- ============================================================

CREATE TABLE IF NOT EXISTS geocode_cache (
  venue_key  TEXT PRIMARY KEY,
  lat        REAL NOT NULL,
  lng        REAL NOT NULL,
  source     TEXT NOT NULL DEFAULT 'auto',
  cached_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS event_weather (
  event_name    TEXT PRIMARY KEY,
  venue         TEXT NOT NULL,
  event_date    TEXT NOT NULL,
  temp_high     REAL,
  temp_low      REAL,
  wind_speed    REAL,
  precip_amount REAL,
  weather_code  INTEGER,
  fetched_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS event_notes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  event_name  TEXT NOT NULL,
  player      TEXT NOT NULL,
  note        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

ALTER TABLE venues ADD COLUMN lat REAL;
ALTER TABLE venues ADD COLUMN lng REAL;

-- ============================================================
-- Entry 21 -- 2026-07-22 -- Session Dev-67
-- The real fix behind Entry 19's correction above: scorecards.venue
-- was documented as added in Dev-66 but never actually was. "Save My
-- Score" started throwing D1_ERROR ("no column named venue") in
-- production. Diagnosed via a temporary PRAGMA table_info debug
-- route (GET /debug/schema?table=X&pin=..., worker.js) rather than
-- guessing from this log -- which is exactly what caught the log
-- itself being wrong, not just the table. Verify live schema before
-- trusting the paper trail; this file included.
-- ============================================================

ALTER TABLE scorecards ADD COLUMN venue TEXT;

-- ============================================================
-- Entry 22 -- 2026-07-22 -- Session Dev-67
-- Venue crest/logo upload for My History scrapbook badges. Same R2
-- pipeline event_photos already uses (env.PHOTOS_BUCKET), one image
-- per venue under venue-logos/<id>.<ext>.
-- Worker routes: POST /venues/:id/logo, GET /venues/:id/logo,
-- POST /venues/:id/logo/clear.
-- ============================================================

ALTER TABLE venues ADD COLUMN logo_key TEXT;

-- ============================================================
-- Entry 23 -- 2026-07-22 -- Session Dev-67
-- Per-venue theme motif: a small emoji (or briefly, custom SVG --
-- tried and reverted same session, didn't read clearly at small/
-- faint scale) scattered faintly behind My History content for that
-- venue -- the list row header, the moment detail view, and the
-- scorecard, all constrained to areas known to stay sparse regardless
-- of how much content a given moment has (an earlier attempt at
-- scattering across the whole card got hidden behind opaque photo
-- tiles and note chips).
-- Worker route: PATCH /venues/:id/motif.
-- ============================================================

ALTER TABLE venues ADD COLUMN theme_motif TEXT;

-- ============================================================
-- Entry 24 -- 2026-07-23 -- Session Dev-68
-- upload_attempts_log (Dev-60) confirmed dead -- built as a D1-backed
-- daily rate-limit backstop during a Cloudflare KV usage scare, but
-- never actually wired to anything (zero references anywhere in
-- worker.js -- no write on upload, no read, no enforcement). The KV
-- usage scare it was meant to guard against was already resolved by
-- the photos_upload_paused kill switch + debug-log filtering that
-- same Dev-60 session. Dropped rather than wired up for a threat
-- that no longer applies. Brian ran this in Cloudflare Console.
-- ============================================================

DROP TABLE IF EXISTS upload_attempts_log;
