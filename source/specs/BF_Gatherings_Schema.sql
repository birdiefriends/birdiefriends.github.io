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
