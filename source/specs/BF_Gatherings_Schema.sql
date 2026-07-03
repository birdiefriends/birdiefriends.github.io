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
