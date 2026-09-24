// ══════════════════════════════════════════════════════════════════════════
// BF Experiences Worker — separate from the main worker.js on purpose
// ══════════════════════════════════════════════════════════════════════════
// The main worker.js is what BFSeries' Live Panel, registration, and
// Gatherings depend on every week, and it's a single-script, no-partial-
// deploy artifact (paste into Cloudflare, Save and Deploy — any mistake
// anywhere takes down every route at once). Same reasoning that keeps GS
// frozen for the rest of 2026 applies here: this new system deploys
// repeatedly all season (Wally Cup now, then BFCup/Turkey 2Man/BlackFriday),
// and none of that churn should ever be able to touch the file BFSeries
// depends on. This Worker owns all of it instead — its own script, its own
// deploy, zero shared blast radius with the main worker.
//
// Binds the SAME D1 database as the main worker (add this Worker as a
// second binding to that database in the Cloudflare dashboard) — no reason
// to split the data, only the deploy artifact.
//
// REVISED: originally planned to reuse the main worker's existing
// `scorecards` table as-is (it's already generic/format-agnostic — no
// technical reason it couldn't work). Reconsidered: "the new system never
// writes to a table the main worker owns" is a stronger, cleaner isolation
// guarantee than "this table happens to be safe to share" — same reasoning
// that already justified the separate Worker itself, just carried one level
// deeper. So this Worker owns its OWN scorecards table too, not just CttP.
//
// Consequence, noted rather than hidden: portal.html's My History feature
// reads scores from the main worker's /scorecards only today — once new-
// system events write here instead, My History needs to fetch from BOTH
// workers and merge, or a player's Wally Cup rounds won't show up in their
// own history. A real integration point for later, not a blocker now.
//
// All tables prefixed `bfe_` (BF Experiences) — deliberately NOT `wc_`,
// since these are meant to serve BFCup/Turkey 2Man/BlackFriday too, not
// just Wally Cup. Manual step before these routes work — run once in the
// D1 Console:
//   CREATE TABLE bfe_scorecards (
//     id INTEGER PRIMARY KEY AUTOINCREMENT,
//     event_name TEXT NOT NULL,
//     player TEXT NOT NULL,
//     holes TEXT NOT NULL,
//     marks TEXT,
//     tee_box TEXT,
//     front9 REAL, back9 REAL, total REAL,
//     hole_count INTEGER DEFAULT 18,
//     hole_half TEXT,
//     venue TEXT,
//     wb_status TEXT,      -- 'kept' | 'lost' | null (not yet reported)
//     wb_hole INTEGER,     -- only set when wb_status = 'lost'
//     wb_stroke INTEGER,   -- only set when wb_status = 'lost'
//     captured_at TEXT NOT NULL DEFAULT (datetime('now')),
//     UNIQUE(event_name, player)
//   );
//   CREATE TABLE bfe_cttp_entries (
//     id INTEGER PRIMARY KEY AUTOINCREMENT,
//     event_name TEXT NOT NULL,
//     hole INTEGER NOT NULL,
//     player TEXT NOT NULL,
//     dist REAL,
//     captured_at TEXT NOT NULL DEFAULT (datetime('now'))
//   );
//   CREATE TABLE bfe_event_config (
//     id INTEGER PRIMARY KEY AUTOINCREMENT,
//     event_name TEXT NOT NULL UNIQUE,
//     config TEXT NOT NULL,        -- full JSON: roster + rounds + venues +
//                                   -- payout, exactly what buildWallyCupEventConfig
//                                   -- (bf_setup.js) produces, plus a top-level
//                                   -- `status` a Host can flip ('draft'|'live'|'closed')
//     updated_at TEXT NOT NULL DEFAULT (datetime('now'))
//   );
//
// Added for the Setup screen's registration/venue/HCP overhaul:
//
//   CREATE TABLE bfe_venue_tee_catalog (
//     id INTEGER PRIMARY KEY AUTOINCREMENT,
//     venue_id INTEGER NOT NULL UNIQUE,   -- matches an id from the shared
//                                          -- `venues` table (main worker's
//                                          -- GET /venues) — NOT owned or
//                                          -- written by this Worker; this
//                                          -- table just attaches tee/slope
//                                          -- data to an existing venue by id
//     venue_name TEXT,                    -- denormalized copy, display/debug only
//     tee_catalog TEXT NOT NULL,          -- JSON: {mode:'same', tee:{name,slope}}
//                                          -- or {mode:'by_hcp_tier', tiers:[...]}
//                                          -- "last-known-good, adjustable default"
//                                          -- (spec §4a) — a saved event snapshots
//                                          -- its OWN resolved copy, this is just
//                                          -- the prefill Setup offers next time
//     updated_at TEXT NOT NULL DEFAULT (datetime('now'))
//   );
//
// Added for the Dev-86 multi-tee venue redesign (BF_BFE_NextGen_Spec.md §1 —
// GC-API-first, D1 as cache + fallback, non-destructive-override pattern).
// bfe_venue_tee_catalog (above) stays as-is — it's the lightweight "which
// tee does a player get" POLICY (same-for-all vs by-HCP-tier). This table is
// the actual per-tee DATA that policy and event config point at: real
// per-hole par/yardage/handicap for every tee a venue has in play (Green,
// Gold, Green/Gold Combo, etc.), not one flat par line per venue.
//
//   CREATE TABLE bfe_venue_tees (
//     id INTEGER PRIMARY KEY AUTOINCREMENT,
//     venue_id INTEGER NOT NULL,          -- matches an id from the shared
//                                          -- `venues` table (main worker) —
//                                          -- same cross-Worker-reference
//                                          -- pattern as bfe_venue_tee_catalog
//     venue_name TEXT,                    -- denormalized, display/debug only
//     tee_name TEXT NOT NULL,             -- e.g. "Green", "Green/Gold Combo"
//     gender TEXT,                        -- 'male' | 'female' | null
//     course_rating REAL,
//     slope_rating REAL,
//     total_yards INTEGER,
//     par_total INTEGER,
//     holes TEXT NOT NULL,                -- JSON array, 18x {par, yardage, handicap}
//                                          -- handicap = stroke-index rank (1-18)
//     gc_api_course_id TEXT,              -- GC-API course id this came from, if any
//     source TEXT NOT NULL DEFAULT 'gc_api', -- 'gc_api' | 'manual'
//     locked INTEGER NOT NULL DEFAULT 0,  -- 1 once a human has hand-edited this
//                                          -- tee (via manual entry, or editing a
//                                          -- gc_api-sourced row) — a later GC-API
//                                          -- refresh must NOT silently overwrite
//                                          -- a locked row (spec's override-
//                                          -- protection pattern); caller must
//                                          -- pass force:true to replace it anyway
//     updated_at TEXT NOT NULL DEFAULT (datetime('now')),
//     UNIQUE(venue_id, tee_name, gender)
//   );
//
//   CREATE TABLE bfe_player_profiles (
//     name TEXT PRIMARY KEY,
//     current_hcp REAL,
//     hcp_history TEXT,                   -- JSON array of {date, hcp}, oldest first
//     active INTEGER DEFAULT 1,
//     ghin_member INTEGER DEFAULT 0,
//     nickname TEXT,
//     updated_at TEXT NOT NULL DEFAULT (datetime('now'))
//   );
//   -- Mirrors GS's own Profiles store (BF_Golf_Scorer_8.html: getProfiles/
//   -- saveProfiles, Quick HCP Panel), ported here because Setup runs in a
//   -- browser, not GS's laptop-local storage, and needs the same "Stored
//   -- HCP vs New HCP" continuity to survive across sessions/devices.
//
// ── Competitive Events (Master Data / Bill-of-Materials architecture) ──────
// bfe_event_config (above) was v1: one JSON blob per event. This is v2 —
// the same Event/Round/Roster relationship the Master Data & BOM diagram
// describes, as real tables instead of a document. venues/bfe_venue_tee_
// catalog/bfe_player_profiles are the MASTER DATA layer (already built,
// above — nothing changes there). These three are the ASSEMBLY layer: one
// Event (parent) owning many Rounds and a Roster (children), referencing
// master data by id rather than duplicating it. bfe_event_config is left
// in place, untouched, alongside these — not because both are meant to be
// used going forward, but because removing it is unnecessary churn against
// a table nothing currently depends on breaking.
//
//   CREATE TABLE bfe_events (
//     id INTEGER PRIMARY KEY AUTOINCREMENT,
//     event_name TEXT NOT NULL UNIQUE,
//     event_family TEXT,
//     event_date TEXT,              -- Dev-74: Rd1's date (YYYY-MM-DD) for
//                                     -- multi-day events like Wally Cup —
//                                     -- entered once in Setup section 1, not
//                                     -- derived from Jotform (that form has
//                                     -- no reliable per-event date field).
//                                     -- Drives the historic-event filter on
//                                     -- Setup's registration-event dropdown.
//                                     -- Added via ALTER TABLE, see migration
//                                     -- note below the CREATE TABLE block.
//     hcp_mode TEXT NOT NULL DEFAULT 'fixed',
//     status TEXT NOT NULL DEFAULT 'draft',
//     tee_policy TEXT,             -- JSON: the resolved teePolicy used for
//                                   -- this event's initial quotas (frozen
//                                   -- snapshot, same reasoning as GS's
//                                   -- payoutSnapshot — a later edit to a
//                                   -- venue's tee catalog default must never
//                                   -- retroactively change this event's math)
//     payout_plan TEXT,            -- JSON: recommendPayoutConfig() output —
//                                   -- one cohesive plan, not naturally split
//                                   -- into rows the way rounds/roster are
//     created_at TEXT NOT NULL DEFAULT (datetime('now')),
//     updated_at TEXT NOT NULL DEFAULT (datetime('now'))
//   );
//   -- Migration for an existing database (bfe_events predates event_date):
//   --   ALTER TABLE bfe_events ADD COLUMN event_date TEXT;
//   -- Migration for an existing database (bfe_event_rounds predates tee_time, Dev-83):
//   --   ALTER TABLE bfe_event_rounds ADD COLUMN tee_time TEXT;
//   CREATE TABLE bfe_event_rounds (
//     id INTEGER PRIMARY KEY AUTOINCREMENT,
//     event_id INTEGER NOT NULL REFERENCES bfe_events(id),
//     sort_order INTEGER NOT NULL,
//     name TEXT NOT NULL,
//     engine TEXT NOT NULL,
//     engine_params TEXT,          -- JSON
//     influencers TEXT,            -- JSON array
//     venue_id INTEGER,            -- references the shared venues table's id
//     venue_name TEXT,             -- denormalized, display only
//     rolls_into_overall INTEGER NOT NULL DEFAULT 1,
//     chains_from_round_id INTEGER REFERENCES bfe_event_rounds(id),
//     tee_time TEXT,                -- Dev-83: ISO datetime, resolved in Setup
//                                    -- §4 from whichever Jotform Request Event
//                                    -- submission or GATHERINGS_API Gathering
//                                    -- this round's name matched (see Setup's
//                                    -- loadRoundNameOptions()) — not typed by
//                                    -- hand. Nothing else in this file computes
//                                    -- it; a round picked from neither source
//                                    -- (a name typed fresh, not yet on either
//                                    -- system) simply saves NULL here.
//     UNIQUE(event_id, name)
//   );
//   CREATE TABLE bfe_event_roster (
//     id INTEGER PRIMARY KEY AUTOINCREMENT,
//     event_id INTEGER NOT NULL REFERENCES bfe_events(id),
//     player_name TEXT NOT NULL,   -- references bfe_player_profiles.name
//     email TEXT,
//     hcp_at_event REAL,
//     tee_name TEXT,
//     slope REAL,
//     initial_quota REAL,
//     is_no_hcp INTEGER DEFAULT 0,
//     UNIQUE(event_id, player_name)
//   );
//
// ── Results layer (Dev-74 — Wally Cup scoring engine) ──────────────────────
// Keyed by (event_id, round_name), NOT round_id — bfe_event_rounds rows get
// fully DELETEd/re-INSERTed on every POST /bfe/events save (see above), so
// a stored round_id would silently orphan itself the moment a host re-saves
// Setup after a round has already been closed. round_name is what's stable
// (it's also required to be identical to the Jotform "Event Name" a player's
// scorecard submission carries, so it doubles as the natural join key).
//
//   CREATE TABLE bfe_round_results (
//     id INTEGER PRIMARY KEY AUTOINCREMENT,
//     event_id INTEGER NOT NULL REFERENCES bfe_events(id),
//     round_name TEXT NOT NULL,
//     player_name TEXT NOT NULL,
//     quota_in REAL,        -- quota entering this round (roster.initial_quota for the
//                             -- first stableford round, else the chained-from round's quota_out)
//     actual_points REAL,   -- this round's total points, from Jotform
//     performance REAL,     -- actual_points - quota_in (pre Wally-Ball-bonus)
//     quota_out REAL,       -- adjustQuota() output — feeds quota_in for whatever round
//                             -- chains from this one
//     wb_status TEXT,       -- 'Yes' | 'No' | NULL (mirrors the portal's WB_QID.status)
//     wb_hole INTEGER,
//     wb_stroke INTEGER,
//     rank INTEGER,         -- final standing for THIS round (post Wally-Ball-bonus,
//                             -- i.e. what scoreRound()'s influencer chain produced) —
//                             -- this is what podium payout is paid against, not performance
//     payout_podium REAL DEFAULT 0,
//     payout_skins REAL DEFAULT 0,
//     payout_cttp REAL DEFAULT 0,   -- always 0 for now — CTP payout resolution isn't
//                                     -- wired yet (no code anywhere matches Jotform CTP
//                                     -- entries to a round); flagged, not forgotten
//     closed_at TEXT NOT NULL DEFAULT (datetime('now')),
//     UNIQUE(event_id, round_name, player_name)
//   );
//   CREATE TABLE bfe_round_skins (
//     id INTEGER PRIMARY KEY AUTOINCREMENT,
//     event_id INTEGER NOT NULL REFERENCES bfe_events(id),
//     round_name TEXT NOT NULL,
//     hole INTEGER NOT NULL,
//     winner TEXT NOT NULL,
//     pts REAL,
//     UNIQUE(event_id, round_name, hole)
//   );
//
// ── Dev-76 addition — CTP hole winners, persisted ──────────────────────────
// Close Round already computes each round's CTP hole winners in memory
// (cttpWinners: {hole, player, dist, payout}) to pay them out, but never
// saved the per-hole detail anywhere — only the aggregate payout_cttp per
// player landed in bfe_round_results. That's enough to pay people, but not
// enough for the results page to show "Hole 6 — Mohamed Walli — 43.9′ —
// $10" the way it shows Skins. Same shape/lifecycle as bfe_round_skins:
// delete-then-insert per (event_id, round_name) on every POST /bfe/round-
// results, so re-closing a round is safe here too.
//   CREATE TABLE bfe_round_cttp (
//     id INTEGER PRIMARY KEY AUTOINCREMENT,
//     event_id INTEGER NOT NULL REFERENCES bfe_events(id),
//     round_name TEXT NOT NULL,
//     hole INTEGER NOT NULL,
//     winner TEXT NOT NULL,
//     dist REAL,
//     payout REAL DEFAULT 0,
//     UNIQUE(event_id, round_name, hole)
//   );
//
// ── Dev-77 addition — playing groups (foursomes), per round ────────────────
// A separate table on purpose, not a column on bfe_event_rounds: Setup's
// Save (POST /bfe/events) does a full delete-then-reinsert of every round on
// EVERY save, so anything stored there would get silently wiped by the next
// unrelated Setup edit. Groups are generated/edited later, independently, in
// BFE-Admin's own Groupings section — same delete-then-insert-per-round
// lifecycle as skins/cttp above, just keyed by round_name instead of hole.
// One row per player (not one JSON blob per round) so a single player's
// group is a plain WHERE, matching every other per-player table here.
//   CREATE TABLE bfe_round_groups (
//     id INTEGER PRIMARY KEY AUTOINCREMENT,
//     event_id INTEGER NOT NULL REFERENCES bfe_events(id),
//     round_name TEXT NOT NULL,
//     group_index INTEGER NOT NULL,   -- 0-based, display as Group N = index+1
//     player_name TEXT NOT NULL,
//     strategy TEXT,                   -- 'social' | 'quota' | 'standings' | 'random' | 'draft' — what Generate/Draft used
//     team_label TEXT,                 -- Dev-78 (2Man). Optional nickname for this group_index's
//                                       -- TEAM (e.g. "The Peg-Leg Turkeys") — same value written on
//                                       -- both player rows of that group_index. NULL for ordinary
//                                       -- 4-some strategies; only meaningful when strategy='draft'.
//                                       -- Per-event only, no cross-event history/reuse (Brian's call).
//     UNIQUE(event_id, round_name, player_name)
//   );
//   -- Migration for an existing database (bfe_round_groups predates team_label):
//   --   ALTER TABLE bfe_round_groups ADD COLUMN team_label TEXT;
//
// ── WCRP Memories (Dev-80, Pass 2 of BF_BFE_Memories_Plan.md §6 — build order
// is BF_WCRP_Memories_Spec.md §8) ───────────────────────────────────────────
// Dev-79 (§8 step 1) already shipped tee_time + the Setup §4 round picker.
// This adds the actual capture surface: two new tables plus a per-event
// grace-window column, all owned by this Worker (same "never write to a
// table the main worker owns" isolation as everything else here) and R2
// keyed under its own `bfe/<event_id>/...` prefix in the SAME PHOTOS_BUCKET
// the main worker already binds (spec §"Ownership": "published only to the
// WCRP" is enforced by storage namespace, not convention) — requires the
// PHOTOS_BUCKET R2 binding to also be added to THIS Worker in the Cloudflare
// dashboard (it doesn't have one yet; every other table here is D1-only).
//
//   ALTER TABLE bfe_events ADD COLUMN memories_grace_hours INTEGER;
//   -- Superseded same-day (Dev-80, live-tested against the real WC event):
//   -- a computed date-range-±-hours eligibility window sounded fine on paper
//   -- but Brian's real-world call was "timers have caused us issues" — this
//   -- column stays in the schema (harmless, unread) but nothing gates on it
//   -- anymore. See memories_capture_open below, the actual live gate now.
//   ALTER TABLE bfe_events ADD COLUMN memories_capture_open INTEGER NOT NULL DEFAULT 0;
//   -- Dev-80 same day, second widget: a standalone "Trip Info" page link
//   -- (address, packing list, food schedule, economics — logistics content,
//   -- not photos/notes) shown on Home to this event's roster, deliberately
//   -- NOT gated by memories_capture_open — Brian wants players able to see
//   -- trip logistics well before he's ready to open Memories capture. NULL/
//   -- blank = no widget shown for this event at all (portal.html's
//   -- findTripInfoEligibleEvent() skips any summary with no tripInfoUrl).
//   ALTER TABLE bfe_events ADD COLUMN trip_info_url TEXT;
//   -- Plain host on/off switch — a commissioner flips this in BFE-Admin when
//   -- the trip's actual capture window should be open, and back off after.
//   -- No date math anywhere: WCRP widget eligibility (portal.html) is just
//   -- "is this player on the roster AND is this true," full stop. Defaults
//   -- to 0/closed so a freshly-saved event doesn't silently start accepting
//   -- captures before the host means it to.
//
//   CREATE TABLE bfe_event_memories (
//     id INTEGER PRIMARY KEY AUTOINCREMENT,
//     event_id INTEGER NOT NULL REFERENCES bfe_events(id),
//     round_name TEXT,       -- NULL = not yet placed in a round's timeline.
//                            -- Dev-80 same-day fix (Brian's real Save blew up
//                            -- on this the moment a memory referenced a round):
//                            -- this was originally `round_id INTEGER REFERENCES
//                            -- bfe_event_rounds(id)`, but bfe_event_rounds rows
//                            -- get fully DELETEd/re-INSERTed on every Setup Save
//                            -- (see the "Results layer" note above) — the exact
//                            -- same instability bfe_round_results/bfe_round_
//                            -- skins/etc. already solved by keying on round_NAME
//                            -- instead. A hard FK on round_id didn't just risk
//                            -- silently orphaning like those tables warned
//                            -- about — with real FK enforcement on, it hard-
//                            -- failed the ENTIRE Setup Save with SQLITE_
//                            -- CONSTRAINT_FOREIGNKEY the instant any round had
//                            -- a memory attached to it. round_name is what's
//                            -- stable, same reasoning as the results layer.
//                            -- Live Panel repoint (spec §6, portal.html) sends
//                            -- this explicitly since it already knows which
//                            -- live round the capture belongs to; the WCRP
//                            -- widget (no round in mind — pub, house,
//                            -- transport) always uploads NULL here. Spec's
//                            -- render-time [tee_time, MAX(scorecard
//                            -- captured_at)] auto-classification is Step 7
//                            -- (Results-page wiring) work, deliberately not
//                            -- built in this pass — round_name stored here is
//                            -- authoritative as-is until that lands.
//     media_type TEXT NOT NULL,      -- 'photo' | 'video'
//     r2_key TEXT NOT NULL,          -- bfe/<event_id>/<uuid>.<ext> — own
//                                     -- namespace, never the shared event_photos
//                                     -- bucket path the main worker uses
//     captured_by TEXT NOT NULL,
//     caption TEXT,
//     tagged_players TEXT,           -- JSON array of player names (spec §9 —
//                                     -- Brian's call, Dev-80: full picker in
//                                     -- this pass, not deferred)
//     section_label TEXT,            -- host-set chapter override (curation view,
//                                     -- Step 7 — column exists now, unused until then)
//     is_trophy_moment INTEGER DEFAULT 0,
//     curation_status TEXT NOT NULL DEFAULT 'approved',
//                            -- reject-by-exception, same posture Dev-62 already
//                            -- set for event_photos — live immediately, PATCH
//                            -- below is how a host walks one back
//     captured_at TEXT NOT NULL,
//     created_at TEXT NOT NULL DEFAULT (datetime('now'))
//   );
//   CREATE TABLE bfe_event_memory_notes (
//     id INTEGER PRIMARY KEY AUTOINCREMENT,
//     event_id INTEGER NOT NULL REFERENCES bfe_events(id),
//     round_name TEXT,   -- same round_id -> round_name fix as above, same NULL convention
//     player TEXT NOT NULL,
//     note TEXT NOT NULL,
//     created_at TEXT NOT NULL DEFAULT (datetime('now'))
//   );
//
//   -- One-time migration for a Worker that already ran the ORIGINAL
//   -- round_id-based CREATE TABLE statements above (SQLite can't ALTER a
//   -- column's type/constraints or drop a FK in place, so this rebuilds both
//   -- tables — safe to run even with existing rows, including the one real
//   -- test photo from live-testing this pass):
//   CREATE TABLE bfe_event_memories_new (
//     id INTEGER PRIMARY KEY AUTOINCREMENT,
//     event_id INTEGER NOT NULL REFERENCES bfe_events(id),
//     round_name TEXT,
//     media_type TEXT NOT NULL,
//     r2_key TEXT NOT NULL,
//     captured_by TEXT NOT NULL,
//     caption TEXT,
//     tagged_players TEXT,
//     section_label TEXT,
//     is_trophy_moment INTEGER DEFAULT 0,
//     curation_status TEXT NOT NULL DEFAULT 'approved',
//     captured_at TEXT NOT NULL,
//     created_at TEXT NOT NULL DEFAULT (datetime('now'))
//   );
//   INSERT INTO bfe_event_memories_new (id, event_id, round_name, media_type, r2_key, captured_by, caption, tagged_players, section_label, is_trophy_moment, curation_status, captured_at, created_at)
//     SELECT id, event_id, NULL, media_type, r2_key, captured_by, caption, tagged_players, section_label, is_trophy_moment, curation_status, captured_at, created_at FROM bfe_event_memories;
//   DROP TABLE bfe_event_memories;
//   ALTER TABLE bfe_event_memories_new RENAME TO bfe_event_memories;
//
//   CREATE TABLE bfe_event_memory_notes_new (
//     id INTEGER PRIMARY KEY AUTOINCREMENT,
//     event_id INTEGER NOT NULL REFERENCES bfe_events(id),
//     round_name TEXT,
//     player TEXT NOT NULL,
//     note TEXT NOT NULL,
//     created_at TEXT NOT NULL DEFAULT (datetime('now'))
//   );
//   INSERT INTO bfe_event_memory_notes_new (id, event_id, round_name, player, note, created_at)
//     SELECT id, event_id, NULL, player, note, created_at FROM bfe_event_memory_notes;
//   DROP TABLE bfe_event_memory_notes;
//   ALTER TABLE bfe_event_memory_notes_new RENAME TO bfe_event_memory_notes;
// ══════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════
// Dev-86 addition — bf_players (D1-native player master table)
// Additive only — does NOT touch or deprecate bfe_player_profiles above
// (still read by Setup as-is). New identity model: a stable D1 id, not a
// name string and not a Jotform submission id. Jotform Membership stays
// the system of record for signup/active-status/portal prefs; this table
// is a D1-native mirror plus the new home for member insight Jotform has
// no concept of (HCP, and eventually Round Config rosters/templates).
// One-way sync only, Jotform -> D1, read-through via POST /bfe/players/
// resolve on first touch — nothing here ever writes back to Jotform.
// See source/bf_players_migration.sql for the create-and-seed script (run
// once in the D1 Console; seeds from the existing bfe_player_profiles
// rows, jotform_submission_id left NULL until first resolved).
//   CREATE TABLE bf_players (
//     id INTEGER PRIMARY KEY AUTOINCREMENT,
//     jotform_submission_id TEXT UNIQUE,  -- bridge to Membership; NULL until first read-through
//     name TEXT NOT NULL,                 -- denormalized display copy, NOT the key
//     nickname TEXT,
//     current_hcp REAL,
//     hcp_history TEXT,                   -- JSON [{date, hcp, source, flagged}], oldest first
//     hcp_source TEXT,                    -- source of the CURRENT value: ghin_import | estimated | manual | no_hcp | player_weekly
//                                          -- 'estimated' locks player_weekly self-report until replaced
//     last_hcp_prompted_at TEXT,          -- last time Portal's weekly HCP nudge was shown to this player
//     ghin_member INTEGER DEFAULT 0,
//     active INTEGER DEFAULT 1,
//     synced_at TEXT,
//     created_at TEXT NOT NULL DEFAULT (datetime('now')),
//     updated_at TEXT NOT NULL DEFAULT (datetime('now'))
//   );
// Routes: GET /bfe/players, POST /bfe/players/resolve, PATCH /bfe/players/
// :id/hcp, POST /bfe/players/:id/hcp-prompt-shown — see inline comments
// at each route below for the HCP source/lock rules.
// ══════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════
// Jotform proxy (Dev-109) — BFE-Admin.html used to hold JOTFORM_API_KEY and
// call api.jotform.com directly from the browser (same pattern portal.html
// still uses in production). Moved server-side: that hardcoded key sitting
// in plain client-side page source on GitHub Pages was a real leaked-secret
// liability, and separately it turned out to get silently blocked by
// platform-level credential-leak protection when the file traveled through
// some delivery paths — the file would "download" with nothing arriving,
// no error surfaced either side. This Worker is now the only thing that
// ever sees the real key; BFE-Admin.html calls the two routes below instead.
// ══════════════════════════════════════════════════════════════════════════
const JOTFORM_API_KEY = 'dd0cb09a71eee7d0db3aa690e292660f';
const JF_API = 'https://api.jotform.com';

export default {
  async fetch(request, env, ctx) {

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    // ── Scorecards ───────────────────────────────────────────────────────
    // Same shape as the main worker's /scorecards (proven, no reason to
    // change the contract), plus wb_status/wb_hole/wb_stroke for Wally Ball
    // — captured in the same Post-Round submission by the 4some Overseer,
    // "Still have it?" / "Lost on hole #, stroke #", per spec §4.
    if (request.method === 'POST' && url.pathname === '/scorecards') {
      let body;
      try { body = await request.json(); } catch(e) {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      const { event_name, player, holes, marks, tee_box, front9, back9, total, hole_count, hole_half, venue,
              wb_status, wb_hole, wb_stroke } = body;
      if (!event_name || !player || !Array.isArray(holes) || holes.length !== 18) {
        return new Response(JSON.stringify({ error: 'event_name, player, and an 18-entry holes array are required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      const marksJson = Array.isArray(marks) && marks.length === 18 ? JSON.stringify(marks) : null;
      const holeCount = (hole_count === 9) ? 9 : 18;
      const holeHalf  = (holeCount === 9 && (hole_half === 'back' || hole_half === 'front')) ? hole_half : null;
      const wbStatus  = (wb_status === 'kept' || wb_status === 'lost') ? wb_status : null;
      try {
        const result = await env.DB.prepare(
          `INSERT INTO bfe_scorecards (event_name, player, holes, marks, tee_box, front9, back9, total, hole_count, hole_half, venue, wb_status, wb_hole, wb_stroke, captured_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
           ON CONFLICT(event_name, player) DO UPDATE SET
             holes = excluded.holes, marks = excluded.marks, tee_box = excluded.tee_box,
             front9 = excluded.front9, back9 = excluded.back9,
             total = excluded.total, hole_count = excluded.hole_count, hole_half = excluded.hole_half,
             venue = excluded.venue, wb_status = excluded.wb_status, wb_hole = excluded.wb_hole,
             wb_stroke = excluded.wb_stroke, captured_at = excluded.captured_at`
        ).bind(event_name, player, JSON.stringify(holes), marksJson, tee_box || null, front9 ?? null, back9 ?? null,
               total ?? null, holeCount, holeHalf, venue || null,
               wbStatus, wbStatus === 'lost' ? (wb_hole ?? null) : null, wbStatus === 'lost' ? (wb_stroke ?? null) : null)
          .run();
        return new Response(JSON.stringify({ ok: true, id: result.meta.last_row_id }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Database error saving scorecard: ' + String(e.message || e) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    // GET /scorecards?event=<key> or ?player=<name> — same filter shape as
    // the main worker's version. No PIN — self-reported, same openness.
    if (request.method === 'GET' && url.pathname === '/scorecards') {
      try {
        const event  = url.searchParams.get('event');
        const player = url.searchParams.get('player');
        const venue  = url.searchParams.get('venue');
        let sql = `SELECT * FROM bfe_scorecards WHERE 1=1`;
        const binds = [];
        if (event)  { sql += ` AND event_name = ?`; binds.push(event); }
        if (player) { sql += ` AND player = ?`;      binds.push(player); }
        if (venue)  { sql += ` AND venue = ?`;       binds.push(venue); }
        sql += ` ORDER BY captured_at DESC`;
        const { results } = await env.DB.prepare(sql).bind(...binds).all();
        const scorecards = results.map(r => ({ ...r, holes: JSON.parse(r.holes), marks: r.marks ? JSON.parse(r.marks) : null }));
        return new Response(JSON.stringify({ ok: true, scorecards }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Database error: ' + String(e.message || e) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    // DELETE /scorecards/:id — same two-path auth as everything else here.
    if (request.method === 'DELETE' && url.pathname.startsWith('/scorecards/')) {
      try {
        const scId        = url.pathname.split('/scorecards/')[1];
        const pin         = url.searchParams.get('pin');
        const requestedBy = url.searchParams.get('requested_by');
        const isAdmin     = String(pin) === '7797';
        const row = await env.DB.prepare(`SELECT player FROM bfe_scorecards WHERE id = ?`).bind(scId).first();
        if (!row) {
          return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
        const norm = s => (s || '').trim().toLowerCase();
        const isOwner = requestedBy && norm(requestedBy) === norm(row.player);
        if (!isAdmin && !isOwner) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
        await env.DB.prepare(`DELETE FROM bfe_scorecards WHERE id = ?`).bind(scId).run();
        return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Delete error: ' + String(e.message || e) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    // ── CttP entries ─────────────────────────────────────────────────────
    // Replaces the Jotform round-trip for the new system. Same shape/trust
    // model as /scorecards on the main worker: no PIN on POST, self-reported,
    // event-scoped by event_name. Deliberately an INSERT, not an upsert —
    // CttP already has a "history trail" concept client-side (multiple
    // players can claim a hole over a round; the leader is just the latest
    // row) — GET returns the full ordered history, client derives the
    // leader from it exactly like it already does with Jotform submissions
    // today; only the data source changes.
    if (request.method === 'POST' && url.pathname === '/cttp') {
      let body;
      try { body = await request.json(); } catch(e) {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      const { event_name, hole, player, dist } = body;
      if (!event_name || !hole || !player) {
        return new Response(JSON.stringify({ error: 'event_name, hole, and player are required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      try {
        const result = await env.DB.prepare(
          `INSERT INTO bfe_cttp_entries (event_name, hole, player, dist, captured_at) VALUES (?, ?, ?, ?, datetime('now'))`
        ).bind(event_name, hole, player, (dist !== undefined && dist !== null) ? dist : null).run();
        return new Response(JSON.stringify({ ok: true, id: result.meta.last_row_id }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Database error saving CttP entry: ' + String(e.message || e) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    // GET /cttp?event=<name> (full history) or &hole=<n> (one hole) — mirrors
    // GET /scorecards' filter shape. No PIN — same openness as self-reported data.
    if (request.method === 'GET' && url.pathname === '/cttp') {
      try {
        const event = url.searchParams.get('event');
        const hole  = url.searchParams.get('hole');
        let sql = `SELECT * FROM bfe_cttp_entries WHERE 1=1`;
        const binds = [];
        if (event) { sql += ` AND event_name = ?`; binds.push(event); }
        if (hole)  { sql += ` AND hole = ?`;        binds.push(hole); }
        sql += ` ORDER BY captured_at ASC`;
        const { results } = await env.DB.prepare(sql).bind(...binds).all();
        return new Response(JSON.stringify({ ok: true, entries: results }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Database error: ' + String(e.message || e) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    // DELETE /cttp/:id — same two-path auth as the main worker's DELETE
    // /scorecards/:id: ?pin=7797 (any), or ?requested_by=<name> matching the
    // entry's own player. Feeds the existing CttP "Undo" flow — today it
    // deletes the Jotform submission; wired to this route, it deletes the row.
    if (request.method === 'DELETE' && url.pathname.startsWith('/cttp/')) {
      try {
        const entryId     = url.pathname.split('/cttp/')[1];
        const pin         = url.searchParams.get('pin');
        const requestedBy = url.searchParams.get('requested_by');
        const isAdmin     = String(pin) === '7797';

        const row = await env.DB.prepare(`SELECT player FROM bfe_cttp_entries WHERE id = ?`).bind(entryId).first();
        if (!row) {
          return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
        const norm = s => (s || '').trim().toLowerCase();
        const isOwner = requestedBy && norm(requestedBy) === norm(row.player);
        if (!isAdmin && !isOwner) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
        await env.DB.prepare(`DELETE FROM bfe_cttp_entries WHERE id = ?`).bind(entryId).run();
        return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Delete error: ' + String(e.message || e) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    // ── Event config ─────────────────────────────────────────────────────
    // What the BFE Host Admin Panel's Setup screen saves and loads: the
    // fully-assembled event config JSON (roster + rounds + venues + payout,
    // the exact shape buildWallyCupEventConfig produces in bf_setup.js).
    // One row per event_name, upserted — Setup is expected to be revisited
    // and re-saved as a Host works through it, not a one-shot write.
    //
    // POST is PIN-gated: unlike Scorecards/CttP (self-reported by players,
    // low stakes if wrong), this is the Host's event definition — quotas,
    // tee policy, payout plan — everything downstream reads from it, so it
    // gets the same admin-only bar as the destructive DELETE routes above.
    if (request.method === 'POST' && url.pathname === '/bfe/event-config') {
      let body;
      try { body = await request.json(); } catch (e) {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      const { event_name, config, pin } = body;
      if (String(pin) !== '7797') {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      if (!event_name || !config || typeof config !== 'object') {
        return new Response(JSON.stringify({ error: 'event_name and config (object) are required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      try {
        const result = await env.DB.prepare(
          `INSERT INTO bfe_event_config (event_name, config, updated_at)
           VALUES (?, ?, datetime('now'))
           ON CONFLICT(event_name) DO UPDATE SET
             config = excluded.config, updated_at = excluded.updated_at`
        ).bind(event_name, JSON.stringify(config)).run();
        return new Response(JSON.stringify({ ok: true, id: result.meta.last_row_id }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Database error saving event config: ' + String(e.message || e) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    // GET /bfe/event-config?event=<name> — no PIN. Live Panel, results pages,
    // and players' own clients all need to read event metadata (round list,
    // venues, quotas) without an admin PIN; nothing sensitive lives here that
    // isn't already visible to participants during the event itself.
    if (request.method === 'GET' && url.pathname === '/bfe/event-config') {
      try {
        const event = url.searchParams.get('event');
        if (!event) {
          return new Response(JSON.stringify({ error: 'event query param is required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
        const row = await env.DB.prepare(`SELECT * FROM bfe_event_config WHERE event_name = ?`).bind(event).first();
        if (!row) {
          return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
        return new Response(JSON.stringify({ ok: true, event_name: row.event_name, config: JSON.parse(row.config), updated_at: row.updated_at }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Database error: ' + String(e.message || e) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    // DELETE /bfe/event-config/:event_name — PIN-gated, same admin bar as the
    // POST. Lets a Host tear down and rebuild a config during Setup iteration
    // without leaving a stale row behind under the same event_name.
    if (request.method === 'DELETE' && url.pathname.startsWith('/bfe/event-config/')) {
      try {
        const eventName = decodeURIComponent(url.pathname.split('/bfe/event-config/')[1]);
        const pin = url.searchParams.get('pin');
        if (String(pin) !== '7797') {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
        await env.DB.prepare(`DELETE FROM bfe_event_config WHERE event_name = ?`).bind(eventName).run();
        return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Delete error: ' + String(e.message || e) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    // ── Venue tee catalog ────────────────────────────────────────────────
    // "Last-known-good, adjustable default" (spec §4a) for a venue's tee/
    // slope data — Setup prefills from this when a host picks a venue for a
    // round, but the event's OWN config snapshots its own resolved copy, so
    // a later correction here never rewrites a past event's quotas.
    if (request.method === 'GET' && url.pathname === '/bfe/venue-tee-catalog') {
      try {
        const venueId = url.searchParams.get('venue_id');
        if (!venueId) {
          return new Response(JSON.stringify({ error: 'venue_id query param is required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
        const row = await env.DB.prepare(`SELECT * FROM bfe_venue_tee_catalog WHERE venue_id = ?`).bind(venueId).first();
        if (!row) {
          return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
        return new Response(JSON.stringify({ ok: true, venue_id: row.venue_id, venue_name: row.venue_name, tee_catalog: JSON.parse(row.tee_catalog), updated_at: row.updated_at }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Database error: ' + String(e.message || e) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    // POST /bfe/venue-tee-catalog — PIN-gated, same admin bar as event-config
    // saves: this seeds what every future Setup session sees as the default
    // for a venue, so a bad entry here has downstream consequences.
    if (request.method === 'POST' && url.pathname === '/bfe/venue-tee-catalog') {
      let body;
      try { body = await request.json(); } catch (e) {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      const { venue_id, venue_name, tee_catalog, pin } = body;
      if (String(pin) !== '7797') {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      if (!venue_id || !tee_catalog || typeof tee_catalog !== 'object') {
        return new Response(JSON.stringify({ error: 'venue_id and tee_catalog (object) are required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      try {
        const result = await env.DB.prepare(
          `INSERT INTO bfe_venue_tee_catalog (venue_id, venue_name, tee_catalog, updated_at)
           VALUES (?, ?, ?, datetime('now'))
           ON CONFLICT(venue_id) DO UPDATE SET
             venue_name = excluded.venue_name, tee_catalog = excluded.tee_catalog, updated_at = excluded.updated_at`
        ).bind(venue_id, venue_name || null, JSON.stringify(tee_catalog)).run();
        return new Response(JSON.stringify({ ok: true, id: result.meta.last_row_id }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Database error saving tee catalog: ' + String(e.message || e) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    // ── Venue tees (Dev-86 multi-tee redesign) ──────────────────────────
    // Real per-hole data for every tee a venue has in play, replacing the
    // old single flat `pars` array on the main worker's `venues` table for
    // any venue upgraded here. See the bfe_venue_tees schema comment above.

    // GET /bfe/venue-tees?venue_id=X — every stored tee for one venue.
    if (request.method === 'GET' && url.pathname === '/bfe/venue-tees') {
      try {
        const venueId = url.searchParams.get('venue_id');
        if (!venueId) {
          return new Response(JSON.stringify({ error: 'venue_id query param is required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
        const { results } = await env.DB.prepare(`SELECT * FROM bfe_venue_tees WHERE venue_id = ? ORDER BY tee_name ASC, gender ASC`).bind(venueId).all();
        const tees = (results || []).map(r => ({ ...r, holes: JSON.parse(r.holes), locked: !!r.locked }));
        return new Response(JSON.stringify({ ok: true, venue_id: Number(venueId), tees }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Database error: ' + String(e.message || e) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    // POST /bfe/venue-tees — add or update one tee. PIN-gated, same admin
    // bar as event-config/venue-tee-catalog saves. Body: { venue_id,
    // venue_name, tee_name, gender, course_rating, slope_rating,
    // total_yards, par_total, holes (18x {par,yardage,handicap}),
    // gc_api_course_id, source ('gc_api'|'manual'), force, pin }.
    //
    // Override protection: if a matching row (same venue_id+tee_name+gender)
    // already exists and is locked, this refuses to overwrite it unless
    // force:true is passed — so a GC-API re-fetch never silently clobbers a
    // hand-correction. A 'manual' source save always sets locked=1 on write
    // (a human just told us this data directly); a 'gc_api' source save
    // sets locked=0 unless it's itself overwriting a locked row via force,
    // in which case it stays locked=0 (GC-API data is being restored as the
    // source of truth again).
    if (request.method === 'POST' && url.pathname === '/bfe/venue-tees') {
      let body;
      try { body = await request.json(); } catch (e) {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      const { venue_id, venue_name, tee_name, gender, course_rating, slope_rating, total_yards, par_total, holes, gc_api_course_id, source, force, pin } = body;
      if (String(pin) !== '7797') {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      if (!venue_id || !tee_name || !Array.isArray(holes) || holes.length !== 18) {
        return new Response(JSON.stringify({ error: 'venue_id, tee_name, and holes (array of 18) are required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      const teeSource = source === 'manual' ? 'manual' : 'gc_api';
      try {
        const existing = await env.DB.prepare(`SELECT id, locked FROM bfe_venue_tees WHERE venue_id = ? AND tee_name = ? AND gender IS ?`).bind(venue_id, tee_name, gender ?? null).first();
        if (existing && existing.locked && !force) {
          return new Response(JSON.stringify({ error: 'locked', message: `"${tee_name}" has been manually edited here and won't be auto-overwritten. Pass force:true to replace it anyway.` }), { status: 409, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
        const newLocked = teeSource === 'manual' ? 1 : 0;
        const result = await env.DB.prepare(
          `INSERT INTO bfe_venue_tees (venue_id, venue_name, tee_name, gender, course_rating, slope_rating, total_yards, par_total, holes, gc_api_course_id, source, locked, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
           ON CONFLICT(venue_id, tee_name, gender) DO UPDATE SET
             venue_name = excluded.venue_name, course_rating = excluded.course_rating, slope_rating = excluded.slope_rating,
             total_yards = excluded.total_yards, par_total = excluded.par_total, holes = excluded.holes,
             gc_api_course_id = excluded.gc_api_course_id, source = excluded.source, locked = excluded.locked, updated_at = excluded.updated_at`
        ).bind(venue_id, venue_name || null, tee_name, gender || null, course_rating ?? null, slope_rating ?? null, total_yards ?? null, par_total ?? null, JSON.stringify(holes), gc_api_course_id || null, teeSource, newLocked).run();
        return new Response(JSON.stringify({ ok: true, id: existing ? existing.id : result.meta.last_row_id, locked: !!newLocked }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Database error saving tee: ' + String(e.message || e) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    // DELETE /bfe/venue-tees/:id — PIN-gated (pin passed as query param since
    // DELETE bodies are awkward cross-client; same low-stakes tradeoff as
    // other admin-only routes in this file).
    const venueTeeDeleteMatch = url.pathname.match(/^\/bfe\/venue-tees\/(\d+)$/);
    if (request.method === 'DELETE' && venueTeeDeleteMatch) {
      const teeId = venueTeeDeleteMatch[1];
      const pin = url.searchParams.get('pin');
      if (String(pin) !== '7797') {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      try {
        await env.DB.prepare(`DELETE FROM bfe_venue_tees WHERE id = ?`).bind(teeId).run();
        return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Delete error: ' + String(e.message || e) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    // ── Player profiles ─────────────────────────────────────────────────
    // Ported from GS's Profiles store (getProfiles/saveProfiles + Quick HCP
    // Panel) — same "Stored HCP vs New HCP" continuity, just backed by D1
    // instead of GS's laptop-local storage so it survives across browsers.
    // GET is open (Setup needs it just to prefill a pulled roster's HCPs;
    // nothing sensitive lives here that isn't already visible on a scorecard).
    if (request.method === 'GET' && url.pathname === '/bfe/player-profiles') {
      try {
        const { results } = await env.DB.prepare(`SELECT * FROM bfe_player_profiles ORDER BY name ASC`).all();
        const profiles = results.map(r => ({ ...r, hcp_history: r.hcp_history ? JSON.parse(r.hcp_history) : [] }));
        return new Response(JSON.stringify({ ok: true, profiles }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Database error: ' + String(e.message || e) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    // POST /bfe/player-profiles — PIN-gated (this is the Host applying a
    // Quick HCP update, same admin bar as event-config). Body: { profiles:
    // [{name, hcp, active, ghinMember, nickname}, ...], pin } — accepts one
    // or many in a single call, mirroring GS's applyQuickHCPUpdate applying
    // an entire panel's worth of changes at once. Only appends to hcp_history
    // when the HCP actually changed, exactly like GS's updateProfileHCP.
    if (request.method === 'POST' && url.pathname === '/bfe/player-profiles') {
      let body;
      try { body = await request.json(); } catch (e) {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      const { profiles, pin } = body;
      if (String(pin) !== '7797') {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      if (!Array.isArray(profiles) || !profiles.length) {
        return new Response(JSON.stringify({ error: 'profiles (non-empty array) is required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      try {
        let updated = 0;
        for (const p of profiles) {
          if (!p.name) continue;
          const existing = await env.DB.prepare(`SELECT current_hcp, hcp_history FROM bfe_player_profiles WHERE name = ?`).bind(p.name).first();
          const hcp = (p.hcp === undefined || p.hcp === null || isNaN(p.hcp)) ? null : Number(p.hcp);
          let history = existing?.hcp_history ? JSON.parse(existing.hcp_history) : [];
          const hcpChanged = !existing || existing.current_hcp !== hcp;
          if (hcpChanged && hcp !== null) {
            history.push({ date: new Date().toISOString().slice(0, 10), hcp });
          }
          await env.DB.prepare(
            `INSERT INTO bfe_player_profiles (name, current_hcp, hcp_history, active, ghin_member, nickname, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
             ON CONFLICT(name) DO UPDATE SET
               current_hcp = excluded.current_hcp, hcp_history = excluded.hcp_history,
               active = excluded.active, ghin_member = excluded.ghin_member,
               nickname = excluded.nickname, updated_at = excluded.updated_at`
          ).bind(p.name, hcp, JSON.stringify(history), p.active === false ? 0 : 1, p.ghinMember ? 1 : 0, p.nickname || null).run();
          updated++;
        }
        return new Response(JSON.stringify({ ok: true, updated }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Database error saving profiles: ' + String(e.message || e) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    // ── bf_players (Dev-86 — D1-native player master table) ───────────────
    // Deliberately separate from bfe_player_profiles above (left untouched,
    // still read by Setup) — this is the new, D1-native master identity:
    // own stable id, not name-as-PK (bfe_player_profiles) and not a Jotform
    // submission id (every player_id/host_id in the Gatherings tables). One-
    // way sync only, Jotform -> D1: Jotform Membership stays the system of
    // record for signup/active-status/portal prefs; nothing here ever writes
    // back to Jotform. jotform_submission_id is the bridge column, filled in
    // lazily by /bfe/players/resolve the first time a caller (e.g. Gatherings'
    // existing stub-creation flow, BF_Gatherings_Spec.md §5) already has a
    // Jotform submission in hand — this Worker never calls Jotform itself.
    //
    // HCP source/lock rules (decided with Brian, Dev-86):
    //   ghin_import  — always gospel. Applied unconditionally, never flagged,
    //                  clears any existing self-report lock.
    //   estimated    — Brian's own judgment call for a player with no GHIN
    //                  and no other tracked HCP. Applied unconditionally, AND
    //                  locks that player out of player_weekly self-report
    //                  until replaced by ghin_import/estimated/manual.
    //   manual       — a one-off commissioner correction. Applied
    //                  unconditionally, does NOT lock (unlike 'estimated').
    //   player_weekly — the Portal's weekly self-report nudge. Rejected
    //                  (423) if the player is currently estimated-locked.
    //                  Otherwise always applied (never blocked on magnitude)
    //                  but flagged:true when the delta from the player's
    //                  last current_hcp is >= 1.0, so a Host can see
    //                  "self-reported, flagged" on their own event's roster
    //                  without the number itself being second-guessed
    //                  automatically. Host-facing surfacing of that flag is
    //                  separate follow-up work, not built in this slice.
    //
    // Manual migration step (D1 Console, once, before these routes work):
    // see source/bf_players_migration.sql — creates the table and seeds it
    // from the existing bfe_player_profiles rows.
    const HCP_FLAG_DELTA = 1.0;
    const HCP_VALID_SOURCES = ['ghin_import', 'estimated', 'manual', 'no_hcp', 'player_weekly'];
    // no_hcp (Dev-86 addition, 2026-09-24): an explicit "we don't have
    // enough data to even estimate" state (e.g. a player after one
    // BFSeries event, no GHIN profile) — distinct from a player who's
    // simply never been touched (hcp_source IS NULL). Locks player_weekly
    // the same way estimated does.
    const HCP_LOCKING_SOURCES = ['estimated', 'no_hcp'];

    // GET /bfe/players — list all, same shape/ordering as /bfe/player-profiles
    if (request.method === 'GET' && url.pathname === '/bfe/players') {
      try {
        const { results } = await env.DB.prepare(`SELECT * FROM bf_players ORDER BY name ASC`).all();
        const players = results.map(r => ({ ...r, hcp_history: r.hcp_history ? JSON.parse(r.hcp_history) : [] }));
        return new Response(JSON.stringify({ ok: true, players }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'List error: ' + String(e.message || e) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    // POST /bfe/players/resolve  { jotform_submission_id, name, nickname? }
    // Read-through: returns the existing row for this Jotform submission id,
    // or creates one. Idempotent — safe to call on every touch, not just the
    // first.
    if (request.method === 'POST' && url.pathname === '/bfe/players/resolve') {
      try {
        const body = await request.json();
        const { jotform_submission_id, name, nickname } = body || {};
        if (!jotform_submission_id || !name) {
          return new Response(JSON.stringify({ error: 'jotform_submission_id and name are required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
        const existing = await env.DB.prepare(`SELECT * FROM bf_players WHERE jotform_submission_id = ?`).bind(jotform_submission_id).first();
        if (existing) {
          return new Response(JSON.stringify({ ok: true, created: false, player: { ...existing, hcp_history: existing.hcp_history ? JSON.parse(existing.hcp_history) : [] } }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
        const result = await env.DB.prepare(
          `INSERT INTO bf_players (jotform_submission_id, name, nickname, synced_at, updated_at)
           VALUES (?, ?, ?, datetime('now'), datetime('now'))`
        ).bind(jotform_submission_id, name, nickname || null).run();
        const created = await env.DB.prepare(`SELECT * FROM bf_players WHERE id = ?`).bind(result.meta.last_row_id).first();
        return new Response(JSON.stringify({ ok: true, created: true, player: { ...created, hcp_history: created.hcp_history ? JSON.parse(created.hcp_history) : [] } }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Resolve error: ' + String(e.message || e) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    // PATCH /bfe/players/:id/hcp  { hcp, source }
    if (request.method === 'PATCH' && url.pathname.startsWith('/bfe/players/') && url.pathname.endsWith('/hcp')) {
      try {
        const playerId = url.pathname.split('/bfe/players/')[1].split('/hcp')[0];
        const body = await request.json();
        const source = body?.source;
        if (!HCP_VALID_SOURCES.includes(source)) {
          return new Response(JSON.stringify({ error: `source must be one of: ${HCP_VALID_SOURCES.join(', ')}` }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
        // no_hcp always means null, whatever (if anything) was sent as `hcp`.
        const hcp = source === 'no_hcp'
          ? null
          : (body?.hcp === undefined || body?.hcp === null || isNaN(body.hcp)) ? null : Number(body.hcp);
        // player_weekly is the PLAYER's own self-report from the Portal — they
        // don't know the commissioner PIN, so it stays open, same posture as
        // the rest of the Portal-facing write paths. Every other source is a
        // Host/Commissioner action writing an authoritative value, so it needs
        // the same PIN discipline already used for bfe_player_profiles writes.
        if (source !== 'player_weekly' && String(body?.pin) !== '7797') {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
        const existing = await env.DB.prepare(`SELECT current_hcp, hcp_history, hcp_source FROM bf_players WHERE id = ?`).bind(playerId).first();
        if (!existing) {
          return new Response(JSON.stringify({ error: 'Player not found' }), { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
        const locked = HCP_LOCKING_SOURCES.includes(existing.hcp_source);
        if (source === 'player_weekly' && locked) {
          const lockedMessage = existing.hcp_source === 'no_hcp'
            ? 'This player has no established HCP yet — ask the commissioner to set one before self-reporting.'
            : 'This player\'s HCP is commissioner-estimated and locked from self-report.';
          return new Response(JSON.stringify({ error: lockedMessage, locked: true, lockedReason: existing.hcp_source }), { status: 423, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
        let history = existing.hcp_history ? JSON.parse(existing.hcp_history) : [];
        const changed = existing.current_hcp !== hcp;
        const delta = (existing.current_hcp === null || existing.current_hcp === undefined || hcp === null) ? null : Math.abs(hcp - existing.current_hcp);
        const flagged = source === 'player_weekly' && delta !== null && delta >= HCP_FLAG_DELTA;
        if (changed) {
          history.push({ date: new Date().toISOString().slice(0, 10), hcp, source, flagged });
        }
        await env.DB.prepare(
          `UPDATE bf_players SET current_hcp = ?, hcp_history = ?, hcp_source = ?, updated_at = datetime('now') WHERE id = ?`
        ).bind(hcp, JSON.stringify(history), source, playerId).run();
        return new Response(JSON.stringify({ ok: true, changed, flagged, delta, locked: false }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Update error: ' + String(e.message || e) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    // POST /bfe/players/:id/hcp-prompt-shown — stamps last_hcp_prompted_at,
    // so the Portal's weekly nudge fires once a week per player, not once
    // per app open.
    if (request.method === 'POST' && url.pathname.startsWith('/bfe/players/') && url.pathname.endsWith('/hcp-prompt-shown')) {
      try {
        const playerId = url.pathname.split('/bfe/players/')[1].split('/hcp-prompt-shown')[0];
        await env.DB.prepare(`UPDATE bf_players SET last_hcp_prompted_at = datetime('now') WHERE id = ?`).bind(playerId).run();
        return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Stamp error: ' + String(e.message || e) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    // ── Competitive Events (v2 — Master Data / BOM assembly) ──────────────
    // POST /bfe/events — full-replace semantics: upserts the parent Event
    // row, then deletes and re-inserts ALL of that event's Rounds and
    // Roster from the payload. Deliberately not a granular per-round PATCH
    // — Setup still generates and saves the whole tree in one action, same
    // as v1's single blob PUT; what's different is the WORKER decomposes
    // that payload into real relational rows instead of storing it as one
    // JSON document. This is the "fudge the UI, get the data structure
    // right" step: proves the Event/Round/Roster shape against real 2026
    // Wally Cup data now, without requiring independent per-section save UI
    // yet (that's a later polish pass once the structure itself is proven).
    // GET /bfe/events-list — lightweight summary of every event stored (id,
    // name, status, updated_at, plus row counts for rounds/roster/round-
    // results/skins). Dev-74, for the Admin panel's Data & Reset tool — built
    // because there was no way to see what test data had already accumulated
    // in D1 short of the Cloudflare D1 console itself. Read-only, no PIN,
    // same posture as the other GET routes.
    if (request.method === 'GET' && url.pathname === '/bfe/events-list') {
      try {
        // Dev-106 — Setup save (POST /bfe/events) writes go straight to D1's
        // primary, but a plain env.DB.prepare() read here can be routed to
        // ANY read replica, including one that hasn't caught up yet. Caught
        // live: right after Brian rebuilt Setup, this route returned zero
        // events while GET /bfe/events?event=<name> (same table, same
        // moment) returned the full row — classic read-replica lag, not a
        // real empty table. withSession('first-primary') pins every read in
        // this request to the primary, same guarantee a write gets, so a
        // fresh save is never invisible to the next events-list poll. Event
        // rosters/rounds/results here are tiny and read rarely (Setup save,
        // Data & Reset panel, Portal's Trip Info index) — the small latency
        // cost of always hitting primary is a non-issue for this workload.
        const db = (typeof env.DB.withSession === 'function') ? env.DB.withSession('first-primary') : env.DB;
        const { results: events } = await db.prepare(
          `SELECT id, event_name, event_family, event_date, status, updated_at FROM bfe_events ORDER BY updated_at DESC`
        ).all();
        const summary = [];
        for (const e of events) {
          const rounds  = await db.prepare(`SELECT COUNT(*) AS n FROM bfe_event_rounds WHERE event_id = ?`).bind(e.id).first();
          const roster  = await db.prepare(`SELECT COUNT(*) AS n FROM bfe_event_roster WHERE event_id = ?`).bind(e.id).first();
          const results = await db.prepare(`SELECT COUNT(*) AS n FROM bfe_round_results WHERE event_id = ?`).bind(e.id).first();
          const skins   = await db.prepare(`SELECT COUNT(*) AS n FROM bfe_round_skins WHERE event_id = ?`).bind(e.id).first();
          const groups  = await db.prepare(`SELECT COUNT(*) AS n FROM bfe_round_groups WHERE event_id = ?`).bind(e.id).first();
          summary.push({ ...e, rounds: rounds.n, roster: roster.n, results: results.n, skins: skins.n, groups: groups.n });
        }
        return new Response(JSON.stringify({ ok: true, events: summary }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Database error: ' + String(e.message || e) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    if (request.method === 'POST' && url.pathname === '/bfe/events') {
      let body;
      try { body = await request.json(); } catch (e) {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      const { event_name, event_family, event_date, event_end_date, memories_capture_open, trip_info_url, hcp_mode, status, tee_policy, payout_plan, rounds, roster, pin } = body;
      if (String(pin) !== '7797') {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      if (!event_name || !Array.isArray(rounds)) {
        return new Response(JSON.stringify({ error: 'event_name and rounds (array) are required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      try {
        // Dev-77: event_end_date is optional and additive — a NULL/undefined
        // value here just means "single-day event," same as before this
        // column existed. Requires the bfe_events.event_end_date column
        // (migration below) to already exist — see Dev-77 note.
        // Dev-80 (revised same day): memories_capture_open is the plain on/off
        // switch that replaced the grace-window timer idea — see this
        // column's own migration note above for why.
        const captureOpen = memories_capture_open ? 1 : 0;
        // Dev-106 — same session used start-to-finish through this route so
        // the id read back a few lines below (and everything chained off
        // it) is guaranteed to see the INSERT/UPDATE that just ran, not a
        // replica that hasn't caught up yet.
        const db = (typeof env.DB.withSession === 'function') ? env.DB.withSession('first-primary') : env.DB;
        await db.prepare(
          `INSERT INTO bfe_events (event_name, event_family, event_date, event_end_date, memories_capture_open, trip_info_url, hcp_mode, status, tee_policy, payout_plan, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
           ON CONFLICT(event_name) DO UPDATE SET
             event_family = excluded.event_family, event_date = excluded.event_date, event_end_date = excluded.event_end_date,
             memories_capture_open = excluded.memories_capture_open, trip_info_url = excluded.trip_info_url, hcp_mode = excluded.hcp_mode, status = excluded.status,
             tee_policy = excluded.tee_policy, payout_plan = excluded.payout_plan, updated_at = excluded.updated_at`
        ).bind(event_name, event_family || null, event_date || null, event_end_date || null, captureOpen, trip_info_url || null,
               hcp_mode || 'fixed', status || 'draft',
               tee_policy ? JSON.stringify(tee_policy) : null, payout_plan ? JSON.stringify(payout_plan) : null).run();

        const eventRow = await db.prepare(`SELECT id FROM bfe_events WHERE event_name = ?`).bind(event_name).first();
        const eventId = eventRow.id;

        await db.prepare(`DELETE FROM bfe_event_rounds WHERE event_id = ?`).bind(eventId).run();
        await db.prepare(`DELETE FROM bfe_event_roster WHERE event_id = ?`).bind(eventId).run();

        // Pass 1: insert rounds without chains_from_round_id (don't know the
        // ids yet), remembering each round's name -> new id as we go.
        const nameToId = {};
        for (let i = 0; i < rounds.length; i++) {
          const r = rounds[i];
          const result = await db.prepare(
            `INSERT INTO bfe_event_rounds (event_id, sort_order, name, engine, engine_params, influencers, venue_id, venue_name, rolls_into_overall, chains_from_round_id, tee_time)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`
          ).bind(eventId, i, r.name, r.engine, r.engineParams ? JSON.stringify(r.engineParams) : null,
                 r.influencers ? JSON.stringify(r.influencers) : null, r.venueId || null, r.venue || null,
                 r.rollsIntoOverall === false ? 0 : 1, r.teeTime || null).run();
          nameToId[r.name] = result.meta.last_row_id;
        }
        // Pass 2: now that every round in this batch has a real id, resolve
        // chainsFrom (a round NAME, same convention bf_setup.js already
        // uses) into the actual self-referencing chains_from_round_id.
        for (const r of rounds) {
          if (r.chainsFrom && nameToId[r.chainsFrom]) {
            await db.prepare(`UPDATE bfe_event_rounds SET chains_from_round_id = ? WHERE id = ?`)
              .bind(nameToId[r.chainsFrom], nameToId[r.name]).run();
          }
        }

        for (const p of (roster || [])) {
          if (!p.name) continue;
          await db.prepare(
            `INSERT INTO bfe_event_roster (event_id, player_name, email, hcp_at_event, tee_name, slope, initial_quota, is_no_hcp)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(eventId, p.name, p.email || null, (p.hcp === undefined || p.hcp === null) ? null : Number(p.hcp),
                 p.tee?.name || null, p.slope ?? p.tee?.slope ?? null, p.initialQuota ?? null, p.isNoHcp ? 1 : 0).run();
        }

        return new Response(JSON.stringify({ ok: true, event_id: eventId }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Database error saving event: ' + String(e.message || e) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    // GET /bfe/events?event=<name> — reassembles the full tree (event +
    // ordered rounds + roster) into the same shape v1's saved `config` used
    // (roster/rounds/payout/teePolicy), so the Setup screen's existing
    // render/generate code barely has to change — only what it calls to
    // save and load, not how it displays what comes back.
    if (request.method === 'GET' && url.pathname === '/bfe/events') {
      try {
        const eventName = url.searchParams.get('event');
        if (!eventName) {
          return new Response(JSON.stringify({ error: 'event query param is required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
        // Dev-106 — same read-replica-lag fix as /bfe/events-list above;
        // pin this route to primary too so it can never disagree with it.
        const db = (typeof env.DB.withSession === 'function') ? env.DB.withSession('first-primary') : env.DB;
        const eventRow = await db.prepare(`SELECT * FROM bfe_events WHERE event_name = ?`).bind(eventName).first();
        if (!eventRow) {
          return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
        const { results: roundRows } = await db.prepare(`SELECT * FROM bfe_event_rounds WHERE event_id = ? ORDER BY sort_order ASC`).bind(eventRow.id).all();
        const { results: rosterRows } = await db.prepare(`SELECT * FROM bfe_event_roster WHERE event_id = ? ORDER BY id ASC`).bind(eventRow.id).all();

        const idToName = {};
        roundRows.forEach(r => { idToName[r.id] = r.name; });

        const rounds = roundRows.map(r => ({
          id: r.id,   // Dev-80: read-only convenience for callers that need the
                      // real row id for THIS load — never meant to be cached/
                      // reused across a Setup re-save (see this route's own
                      // comment above on why round IDs aren't the join key
                      // anywhere else in this file). The memories/notes
                      // upload paths use round NAME instead (r.name below),
                      // same fix as bfe_round_results/bfe_round_skins — this
                      // id field is kept only in case a future caller needs
                      // it, not currently used by WCRP Memories.
          name: r.name, engine: r.engine,
          engineParams: r.engine_params ? JSON.parse(r.engine_params) : undefined,
          influencers: r.influencers ? JSON.parse(r.influencers) : [],
          venue: r.venue_name, venueId: r.venue_id,
          rollsIntoOverall: !!r.rolls_into_overall,
          chainsFrom: r.chains_from_round_id ? (idToName[r.chains_from_round_id] || null) : null,
          teeTime: r.tee_time || null   // Dev-83
        }));
        const roster = rosterRows.map(p => ({
          name: p.player_name, email: p.email, hcp: p.hcp_at_event,
          tee: { name: p.tee_name, slope: p.slope }, slope: p.slope,
          initialQuota: p.initial_quota, isNoHcp: !!p.is_no_hcp
        }));

        const config = {
          eventName: eventRow.event_name, eventFamily: eventRow.event_family, eventDate: eventRow.event_date, eventEndDate: eventRow.event_end_date,
          memoriesCaptureOpen: !!eventRow.memories_capture_open,
          tripInfoUrl: eventRow.trip_info_url || null,
          hcpMode: eventRow.hcp_mode,
          status: eventRow.status, teePolicy: eventRow.tee_policy ? JSON.parse(eventRow.tee_policy) : null,
          payout: eventRow.payout_plan ? JSON.parse(eventRow.payout_plan) : null,
          roster, rounds
        };
        return new Response(JSON.stringify({ ok: true, event_name: eventRow.event_name, config, updated_at: eventRow.updated_at }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Database error: ' + String(e.message || e) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    // DELETE /bfe/events/:event_name — PIN-gated, cascades rounds/roster
    // manually (D1/SQLite here doesn't auto-cascade FKs).
    //
    // Dev-77 fix: bfe_round_groups was added this session with its own
    // event_id FK to bfe_events, but never added here — so deleting an
    // event that had ANY saved groups (even for a round whose
    // bfe_event_rounds row had since been cleared by a later Setup Save;
    // groups don't get cleaned up by that, only by this route or a fresh
    // Save/regenerate) failed with SQLITE_CONSTRAINT_FOREIGNKEY, D1
    // refusing to delete a bfe_events row still referenced by a child
    // table this route didn't know about. Every FK-referencing child table
    // must be deleted here before the parent bfe_events row — this is the
    // list to extend the next time a new one is added.
    //
    // Dev-105 fix: same failure mode, same root cause — bfe_event_memories
    // and bfe_event_memory_notes (Trip Memories / WCRP, added well after
    // Dev-77) were never added here either, so deleting a test event with
    // any captured photos/videos/notes on it (real 2026 Wally Cup rehearsal
    // data, this pass) hit the exact SQLITE_CONSTRAINT_FOREIGNKEY error
    // again. Memories additionally own an R2 object apiece (r2_key) — those
    // don't get cleaned up by a D1 DELETE at all, so this reads every
    // r2_key for the event FIRST and deletes each from R2 before touching
    // any D1 row, same "R2 object + D1 row both go" posture as the
    // single-memory DELETE route above.
    if (request.method === 'DELETE' && url.pathname.startsWith('/bfe/events/')) {
      try {
        const eventName = decodeURIComponent(url.pathname.split('/bfe/events/')[1]);
        const pin = url.searchParams.get('pin');
        if (String(pin) !== '7797') {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
        const eventRow = await env.DB.prepare(`SELECT id FROM bfe_events WHERE event_name = ?`).bind(eventName).first();
        if (eventRow) {
          if (env.PHOTOS_BUCKET) {
            const { results: memRows } = await env.DB.prepare(`SELECT r2_key FROM bfe_event_memories WHERE event_id = ?`).bind(eventRow.id).all();
            for (const m of (memRows || [])) {
              if (m.r2_key) { await env.PHOTOS_BUCKET.delete(m.r2_key); }
            }
          }
          await env.DB.prepare(`DELETE FROM bfe_event_memories WHERE event_id = ?`).bind(eventRow.id).run();
          await env.DB.prepare(`DELETE FROM bfe_event_memory_notes WHERE event_id = ?`).bind(eventRow.id).run();
          await env.DB.prepare(`DELETE FROM bfe_event_rounds WHERE event_id = ?`).bind(eventRow.id).run();
          await env.DB.prepare(`DELETE FROM bfe_event_roster WHERE event_id = ?`).bind(eventRow.id).run();
          await env.DB.prepare(`DELETE FROM bfe_round_results WHERE event_id = ?`).bind(eventRow.id).run();
          await env.DB.prepare(`DELETE FROM bfe_round_skins WHERE event_id = ?`).bind(eventRow.id).run();
          await env.DB.prepare(`DELETE FROM bfe_round_cttp WHERE event_id = ?`).bind(eventRow.id).run();
          await env.DB.prepare(`DELETE FROM bfe_round_groups WHERE event_id = ?`).bind(eventRow.id).run();
          await env.DB.prepare(`DELETE FROM bfe_events WHERE id = ?`).bind(eventRow.id).run();
        }
        return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Delete error: ' + String(e.message || e) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    // ── Round results (Dev-74 — Wally Cup scoring engine) ──────────────────
    // Computed client-side (BFE-Admin.html's "Close Round" action) from live
    // Jotform scorecard data — same reason /scorecards above takes finished
    // rows rather than raw form fields: this Worker has no Jotform credentials
    // of its own. This route just persists the already-computed result.
    // POST replaces whatever was previously saved for this (event, round) —
    // re-closing a round (e.g. after a scoring correction) is meant to be safe.
    if (request.method === 'POST' && url.pathname === '/bfe/round-results') {
      let body;
      try { body = await request.json(); } catch (e) {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      const { event_name, round_name, results, skins, cttp, pin } = body;
      if (String(pin) !== '7797') {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      if (!event_name || !round_name || !Array.isArray(results)) {
        return new Response(JSON.stringify({ error: 'event_name, round_name, and results (array) are required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      try {
        const eventRow = await env.DB.prepare(`SELECT id FROM bfe_events WHERE event_name = ?`).bind(event_name).first();
        if (!eventRow) {
          return new Response(JSON.stringify({ error: 'Unknown event_name — save the event config first' }), { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
        const eventId = eventRow.id;
        await env.DB.prepare(`DELETE FROM bfe_round_results WHERE event_id = ? AND round_name = ?`).bind(eventId, round_name).run();
        await env.DB.prepare(`DELETE FROM bfe_round_skins WHERE event_id = ? AND round_name = ?`).bind(eventId, round_name).run();
        await env.DB.prepare(`DELETE FROM bfe_round_cttp WHERE event_id = ? AND round_name = ?`).bind(eventId, round_name).run();
        for (const r of results) {
          await env.DB.prepare(
            `INSERT INTO bfe_round_results (event_id, round_name, player_name, quota_in, actual_points, performance, quota_out, wb_status, wb_hole, wb_stroke, rank, payout_podium, payout_skins, payout_cttp)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(eventId, round_name, r.playerName,
                 r.quotaIn ?? null, r.actualPoints ?? null, r.performance ?? null, r.quotaOut ?? null,
                 r.wbStatus ?? null, r.wbHole ?? null, r.wbStroke ?? null, r.rank ?? null,
                 r.payoutPodium || 0, r.payoutSkins || 0, r.payoutCttp || 0).run();
        }
        for (const s of (skins || [])) {
          await env.DB.prepare(
            `INSERT INTO bfe_round_skins (event_id, round_name, hole, winner, pts) VALUES (?, ?, ?, ?, ?)`
          ).bind(eventId, round_name, s.hole, s.winner, s.pts ?? null).run();
        }
        for (const c of (cttp || [])) {
          await env.DB.prepare(
            `INSERT INTO bfe_round_cttp (event_id, round_name, hole, winner, dist, payout) VALUES (?, ?, ?, ?, ?, ?)`
          ).bind(eventId, round_name, c.hole, c.player, c.dist ?? null, c.payout ?? 0).run();
        }
        return new Response(JSON.stringify({ ok: true, event_id: eventId, round_name, saved: results.length }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Database error saving round results: ' + String(e.message || e) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    // GET /bfe/round-results?event=<name>[&round=<name>] — all persisted
    // results for the event (round omitted), or just one round's. Omitted-
    // round form is what "Close Round" uses to chain quota_out forward into
    // the next round and to compute the running Wally Ball / Overall standings.
    if (request.method === 'GET' && url.pathname === '/bfe/round-results') {
      try {
        const eventName = url.searchParams.get('event');
        const roundName = url.searchParams.get('round');
        if (!eventName) {
          return new Response(JSON.stringify({ error: 'event query param is required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
        const eventRow = await env.DB.prepare(`SELECT id FROM bfe_events WHERE event_name = ?`).bind(eventName).first();
        if (!eventRow) {
          return new Response(JSON.stringify({ ok: true, results: [], skins: [], cttp: [] }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
        let results, skins, cttp;
        if (roundName) {
          results = (await env.DB.prepare(`SELECT * FROM bfe_round_results WHERE event_id = ? AND round_name = ? ORDER BY rank ASC`).bind(eventRow.id, roundName).all()).results;
          skins   = (await env.DB.prepare(`SELECT * FROM bfe_round_skins WHERE event_id = ? AND round_name = ? ORDER BY hole ASC`).bind(eventRow.id, roundName).all()).results;
          cttp    = (await env.DB.prepare(`SELECT * FROM bfe_round_cttp WHERE event_id = ? AND round_name = ? ORDER BY hole ASC`).bind(eventRow.id, roundName).all()).results;
        } else {
          results = (await env.DB.prepare(`SELECT * FROM bfe_round_results WHERE event_id = ? ORDER BY round_name ASC, rank ASC`).bind(eventRow.id).all()).results;
          skins   = (await env.DB.prepare(`SELECT * FROM bfe_round_skins WHERE event_id = ? ORDER BY round_name ASC, hole ASC`).bind(eventRow.id).all()).results;
          cttp    = (await env.DB.prepare(`SELECT * FROM bfe_round_cttp WHERE event_id = ? ORDER BY round_name ASC, hole ASC`).bind(eventRow.id).all()).results;
        }
        return new Response(JSON.stringify({ ok: true, results, skins, cttp }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Database error: ' + String(e.message || e) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    // ── Round Groupings (Dev-77) ──────────────────────────────────────────
    // POST /bfe/round-groups — full-replace for ONE round, same
    // delete-then-insert lifecycle as round-results/skins/cttp: safe to
    // regenerate or hand-edit and re-save as many times as a Host wants
    // before the round tees off. PIN-gated — this decides who plays with
    // whom, same admin-only bar as event-config/round-results.
    if (request.method === 'POST' && url.pathname === '/bfe/round-groups') {
      let body;
      try { body = await request.json(); } catch (e) {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      const { event_name, round_name, groups, strategy, labels, pin } = body;
      if (String(pin) !== '7797') {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      if (!event_name || !round_name || !Array.isArray(groups)) {
        return new Response(JSON.stringify({ error: 'event_name, round_name, and groups (array of arrays) are required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      // Dev-78 (2Man draft): optional `labels` array, same length/order as
      // `groups` — labels[gi] is that group_index's team nickname, written
      // onto every player row in that group. Absent/short/blank entries are
      // just null, same as every ordinary (non-draft) Save.
      try {
        const eventRow = await env.DB.prepare(`SELECT id FROM bfe_events WHERE event_name = ?`).bind(event_name).first();
        if (!eventRow) {
          return new Response(JSON.stringify({ error: 'Unknown event_name — save the event config first' }), { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
        const eventId = eventRow.id;
        await env.DB.prepare(`DELETE FROM bfe_round_groups WHERE event_id = ? AND round_name = ?`).bind(eventId, round_name).run();
        let placed = 0;
        for (let gi = 0; gi < groups.length; gi++) {
          const label = (Array.isArray(labels) && labels[gi]) ? String(labels[gi]).trim() || null : null;
          for (const playerName of (groups[gi] || [])) {
            if (!playerName) continue;
            await env.DB.prepare(
              `INSERT INTO bfe_round_groups (event_id, round_name, group_index, player_name, strategy, team_label) VALUES (?, ?, ?, ?, ?, ?)`
            ).bind(eventId, round_name, gi, playerName, strategy || null, label).run();
            placed++;
          }
        }
        return new Response(JSON.stringify({ ok: true, event_id: eventId, round_name, groups: groups.length, placed }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Database error saving groups: ' + String(e.message || e) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    // GET /bfe/round-groups?event=<name>[&round=<name>] — flat rows if
    // &round is given the caller already knows which round it's asking
    // about; omitted returns every round's rows for the event so the
    // Portal (and BFE-Admin's own reload) can group them client-side by
    // round_name in one fetch instead of one request per round.
    if (request.method === 'GET' && url.pathname === '/bfe/round-groups') {
      try {
        const eventName = url.searchParams.get('event');
        const roundName = url.searchParams.get('round');
        if (!eventName) {
          return new Response(JSON.stringify({ error: 'event query param is required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
        const eventRow = await env.DB.prepare(`SELECT id FROM bfe_events WHERE event_name = ?`).bind(eventName).first();
        if (!eventRow) {
          return new Response(JSON.stringify({ ok: true, rows: [] }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
        let rows;
        if (roundName) {
          rows = (await env.DB.prepare(`SELECT * FROM bfe_round_groups WHERE event_id = ? AND round_name = ? ORDER BY group_index ASC, player_name ASC`).bind(eventRow.id, roundName).all()).results;
        } else {
          rows = (await env.DB.prepare(`SELECT * FROM bfe_round_groups WHERE event_id = ? ORDER BY round_name ASC, group_index ASC, player_name ASC`).bind(eventRow.id).all()).results;
        }
        return new Response(JSON.stringify({ ok: true, rows }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Database error: ' + String(e.message || e) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    // ── WCRP Memories (Dev-80) ──────────────────────────────────────────
    // POST /bfe/memories/upload — multipart/form-data, mirrors the main
    // worker's POST /photos/upload pipeline (compress-on-client, 25MB
    // server-side cap regardless of client checks, media_type inferred from
    // file.type/extension — never trusted verbatim), simplified: no EXIF-
    // filename dedup/window-skip logic (that's a bulk-import concern this
    // capture surface doesn't have) and no server-side section
    // classification (spec's render-time round placement is Step 7, not
    // built here — round_id is stored exactly as sent, NULL if omitted).
    // No PIN — same trust-based model as every other player-facing capture
    // in this app (Scorecard/CttP/photos): event_id + captured_by identify
    // the request, not a shared admin secret.
    // Body fields: event_id (or event_name), round_name?, captured_by, caption?,
    // tagged_players? (JSON array string), captured_at?, file.
    const MEMORIES_MAX_BYTES = 25 * 1024 * 1024;
    if (request.method === 'POST' && url.pathname === '/bfe/memories/upload') {
      try {
        const reqContentType = (request.headers.get('content-type') || '').toLowerCase();
        if (!reqContentType.includes('multipart/form-data')) {
          return new Response(JSON.stringify({ error: 'Expected multipart/form-data' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
        let form;
        try { form = await request.formData(); } catch (e) {
          return new Response(JSON.stringify({ error: 'Invalid form data' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
        const eventIdRaw   = form.get('event_id');
        const eventName    = form.get('event_name');
        const roundNameRaw = form.get('round_name'); // Dev-80 fix — was round_id, see schema comment above
        const capturedBy   = form.get('captured_by');
        const caption      = form.get('caption') || null;
        const taggedRaw    = form.get('tagged_players');
        const capturedAt   = form.get('captured_at');
        let file = form.get('file');
        if (!file || typeof file === 'string') {
          for (const [, v] of form.entries()) {
            if (v && typeof v !== 'string') { file = v; break; }
          }
        }
        if (!capturedBy) {
          return new Response(JSON.stringify({ error: 'Missing captured_by' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
        if (!file || typeof file === 'string') {
          return new Response(JSON.stringify({ error: 'Missing file' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
        if (!env.PHOTOS_BUCKET) {
          return new Response(JSON.stringify({ error: 'PHOTOS_BUCKET binding not configured on this Worker yet' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }

        // event_id can arrive directly (Live Panel already resolved it via
        // the BFE-backed index) or by event_name (widget upload, resolved
        // here) — either is accepted, event_id preferred when both are sent.
        let eventId = eventIdRaw ? Number(eventIdRaw) : null;
        if (!eventId && eventName) {
          const eventRow = await env.DB.prepare(`SELECT id FROM bfe_events WHERE event_name = ?`).bind(eventName).first();
          if (!eventRow) {
            return new Response(JSON.stringify({ error: 'Unknown event' }), { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
          }
          eventId = eventRow.id;
        }
        if (!eventId) {
          return new Response(JSON.stringify({ error: 'event_id or event_name is required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
        const roundName = (roundNameRaw !== null && roundNameRaw !== undefined && roundNameRaw !== '') ? String(roundNameRaw) : null;

        const fileBytes = await file.arrayBuffer();
        const fileSize   = file.size;
        const fileName   = file.name || '';
        if (fileSize > MEMORIES_MAX_BYTES) {
          return new Response(JSON.stringify({ error: `File too large (${(fileSize/1024/1024).toFixed(1)}MB) — 25MB max. For video, keep clips short.` }), { status: 413, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }

        const extFromName = (fileName && fileName.includes('.')) ? fileName.split('.').pop().toLowerCase() : '';
        const VIDEO_EXTS = ['mp4', 'mov', 'm4v', 'webm'];
        const looksLikeVideo = (file.type || '').startsWith('video/') || VIDEO_EXTS.includes(extFromName);
        const mediaType = looksLikeVideo ? 'video' : 'image';
        const ext = extFromName || (mediaType === 'video' ? 'mp4' : 'jpg');
        const isSpecificType = /^(image|video)\//.test(file.type || '');
        const storedContentType = isSpecificType ? file.type : (mediaType === 'video' ? 'video/mp4' : 'image/jpeg');
        // Own namespace under the shared bucket (spec's "Ownership" principle
        // — never the main worker's photos/<slug>/<section>/... prefix).
        const key = `bfe/${eventId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

        await env.PHOTOS_BUCKET.put(key, fileBytes, { httpMetadata: { contentType: storedContentType } });

        let taggedPlayers = null;
        if (taggedRaw) {
          try {
            const parsed = JSON.parse(taggedRaw);
            if (Array.isArray(parsed) && parsed.length) taggedPlayers = JSON.stringify(parsed.filter(Boolean));
          } catch (e) { /* malformed tagging list — store nothing rather than fail the whole upload */ }
        }
        const capturedAtFinal = capturedAt || new Date().toISOString();

        const result = await env.DB.prepare(
          `INSERT INTO bfe_event_memories (event_id, round_name, media_type, r2_key, captured_by, caption, tagged_players, curation_status, captured_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', ?)`
        ).bind(eventId, roundName, mediaType, key, capturedBy, caption, taggedPlayers, capturedAtFinal).run();

        return new Response(JSON.stringify({ ok: true, id: result.meta.last_row_id, r2_key: key, media_type: mediaType, event_id: eventId, round_name: roundName }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Upload error: ' + String(e.message || e) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    // GET /bfe/memories?event=<name>[&event_id=<id>][&round_name=<name>][&pin=]
    // Public callers (no pin) only ever see curation_status='approved',
    // enforced server-side same as GET /photos. Commissioner (pin) sees
    // everything so the curation view (Step 7, not built yet) has something
    // to work with later without this route needing to change.
    if (request.method === 'GET' && url.pathname === '/bfe/memories') {
      try {
        // Pinned to D1 primary — same read-replica-staleness fix already
        // applied to GET /bfe/events-list, GET /bfe/events, POST /bfe/events.
        const db = (typeof env.DB.withSession === 'function') ? env.DB.withSession('first-primary') : env.DB;
        const eventName  = url.searchParams.get('event');
        const eventIdQ   = url.searchParams.get('event_id');
        const roundNameQ = url.searchParams.get('round_name'); // Dev-80 fix — was round_id
        const pin        = url.searchParams.get('pin');
        const isAdmin    = String(pin) === '7797';

        let eventId = eventIdQ ? Number(eventIdQ) : null;
        if (!eventId && eventName) {
          const eventRow = await db.prepare(`SELECT id FROM bfe_events WHERE event_name = ?`).bind(eventName).first();
          eventId = eventRow ? eventRow.id : null;
        }
        if (!eventId) {
          return new Response(JSON.stringify({ ok: true, memories: [] }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
        let sql = `SELECT id, event_id, round_name, media_type, captured_by, caption, tagged_players, section_label, is_trophy_moment, curation_status, captured_at, created_at FROM bfe_event_memories WHERE event_id = ?`;
        const binds = [eventId];
        if (roundNameQ) { sql += ` AND round_name = ?`; binds.push(roundNameQ); }
        if (!isAdmin) { sql += ` AND curation_status = 'approved'`; }
        sql += ` ORDER BY captured_at ASC`;
        const { results } = await db.prepare(sql).bind(...binds).all();
        const memories = results.map(r => ({ ...r, tagged_players: r.tagged_players ? JSON.parse(r.tagged_players) : [] }));
        return new Response(JSON.stringify({ ok: true, memories }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Database error: ' + String(e.message || e) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    // GET /bfe/memories/serve/:id — streams the R2 bytes. Public, no PIN,
    // same posture as GET /photos/serve/:id — nothing sensitive lives in an
    // approved capture that isn't already visible via the list route.
    if (request.method === 'GET' && url.pathname.startsWith('/bfe/memories/serve/')) {
      try {
        const memId = url.pathname.split('/bfe/memories/serve/')[1];
        const row = await env.DB.prepare(`SELECT r2_key, curation_status FROM bfe_event_memories WHERE id = ?`).bind(memId).first();
        if (!row || !env.PHOTOS_BUCKET) {
          return new Response('Not found', { status: 404, headers: corsHeaders });
        }
        const obj = await env.PHOTOS_BUCKET.get(row.r2_key);
        if (!obj) return new Response('Not found', { status: 404, headers: corsHeaders });
        const headers = new Headers(corsHeaders);
        obj.writeHttpMetadata(headers);
        headers.set('etag', obj.httpEtag);
        headers.set('cache-control', 'public, max-age=31536000, immutable');
        return new Response(obj.body, { headers });
      } catch (e) {
        return new Response('Error: ' + String(e.message || e), { status: 500, headers: corsHeaders });
      }
    }

    // PATCH /bfe/memories/notes/:id — Dev-84: commissioner alignment
    // correction for notes, mirroring the photo PATCH just below (round_name
    // only — notes have no curation_status/is_trophy_moment/section_label
    // concept). Notes previously had POST + GET + DELETE but no way to just
    // move a misplaced one to the right round — this is what the Trip
    // Memories alignment widget in BFE-Admin.html calls. Checked BEFORE the
    // broader PATCH /bfe/memories/ handler below — same startsWith
    // collision as the DELETE routes above, so an id of "notes/5" doesn't
    // get swallowed by the generic photo route first.
    if (request.method === 'PATCH' && url.pathname.startsWith('/bfe/memories/notes/')) {
      let body;
      try { body = await request.json(); } catch (e) {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      const noteId = url.pathname.split('/bfe/memories/notes/')[1];
      if (String(body.pin) !== '7797') {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      if (body.round_name === undefined) {
        return new Response(JSON.stringify({ error: 'No recognized fields to update' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      try {
        await env.DB.prepare(`UPDATE bfe_event_memory_notes SET round_name = ? WHERE id = ?`)
          .bind(body.round_name === null ? null : String(body.round_name), noteId).run();
        return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Database error: ' + String(e.message || e) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    // PATCH /bfe/memories/:id — commissioner curation (Step 7 will build the
    // UI that calls this; the route itself is built now so upload/list/serve/
    // delete/PATCH ship as one complete surface). PIN-gated — same admin bar
    // as every other host-only write in this file. Accepts any subset of
    // curation_status ('approved'|'rejected'), is_trophy_moment, round_name
    // (reassign — corrects a mis-timed auto/manual placement), section_label.
    if (request.method === 'PATCH' && url.pathname.startsWith('/bfe/memories/')) {
      let body;
      try { body = await request.json(); } catch (e) {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      const memId = url.pathname.split('/bfe/memories/')[1];
      if (String(body.pin) !== '7797') {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      const fields = [];
      const binds = [];
      if (body.curation_status !== undefined && ['approved', 'rejected'].includes(body.curation_status)) {
        fields.push('curation_status = ?'); binds.push(body.curation_status);
      }
      if (body.is_trophy_moment !== undefined) { fields.push('is_trophy_moment = ?'); binds.push(body.is_trophy_moment ? 1 : 0); }
      if (body.round_name !== undefined) { fields.push('round_name = ?'); binds.push(body.round_name === null ? null : String(body.round_name)); }
      if (body.section_label !== undefined) { fields.push('section_label = ?'); binds.push(body.section_label || null); }
      if (!fields.length) {
        return new Response(JSON.stringify({ error: 'No recognized fields to update' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      try {
        binds.push(memId);
        await env.DB.prepare(`UPDATE bfe_event_memories SET ${fields.join(', ')} WHERE id = ?`).bind(...binds).run();
        return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Database error: ' + String(e.message || e) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    // DELETE /bfe/memories/notes/:id — Dev-104: notes had a POST + GET all
    // along but no way to remove one — surfaced doing pre-event test-data
    // cleanup (real 2026 Wally Cup rehearsal notes needed deleting and there
    // was nowhere to send that request). Same two-path auth as DELETE
    // /bfe/memories/:id: ?pin=7797 (any), or ?requested_by=<name> matching
    // the row's own `player` (verified server-side). No R2 object to clean
    // up — notes are D1-only. Checked BEFORE the broader
    // /bfe/memories/:id DELETE below since that one matches on
    // startsWith('/bfe/memories/') and would otherwise swallow this path
    // first and 404 on an id of "notes/5".
    if (request.method === 'DELETE' && url.pathname.startsWith('/bfe/memories/notes/')) {
      try {
        const noteId      = url.pathname.split('/bfe/memories/notes/')[1];
        const pin         = url.searchParams.get('pin');
        const requestedBy = url.searchParams.get('requested_by');
        const isAdmin     = String(pin) === '7797';
        const row = await env.DB.prepare(`SELECT player FROM bfe_event_memory_notes WHERE id = ?`).bind(noteId).first();
        if (!row) {
          return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
        const norm = s => (s || '').trim().toLowerCase();
        const isOwner = requestedBy && norm(requestedBy) === norm(row.player);
        if (!isAdmin && !isOwner) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
        await env.DB.prepare(`DELETE FROM bfe_event_memory_notes WHERE id = ?`).bind(noteId).run();
        return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Delete error: ' + String(e.message || e) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    // DELETE /bfe/memories/:id — same two-path auth as DELETE /photos/:id:
    // ?pin=7797 (any), or ?requested_by=<name> matching the row's own
    // captured_by (verified server-side, never trusted from the client).
    // Permanent — R2 object + D1 row both go, no trash/undo, same posture as
    // /photos.
    if (request.method === 'DELETE' && url.pathname.startsWith('/bfe/memories/')) {
      try {
        const memId       = url.pathname.split('/bfe/memories/')[1];
        const pin         = url.searchParams.get('pin');
        const requestedBy = url.searchParams.get('requested_by');
        const isAdmin     = String(pin) === '7797';
        const row = await env.DB.prepare(`SELECT r2_key, captured_by FROM bfe_event_memories WHERE id = ?`).bind(memId).first();
        if (!row) {
          return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
        const norm = s => (s || '').trim().toLowerCase();
        const isOwner = requestedBy && norm(requestedBy) === norm(row.captured_by);
        if (!isAdmin && !isOwner) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
        if (env.PHOTOS_BUCKET) { await env.PHOTOS_BUCKET.delete(row.r2_key); }
        await env.DB.prepare(`DELETE FROM bfe_event_memories WHERE id = ?`).bind(memId).run();
        return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Delete error: ' + String(e.message || e) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    // POST /bfe/memories/notes — same trust model as upload (no PIN, player
    // + event identify the row). Body: event_id|event_name, round_name?,
    // player, note (character cap enforced client-side per spec §9's 500
    // decision — server just stores whatever arrives, same posture as the
    // main worker's own /notes route).
    if (request.method === 'POST' && url.pathname === '/bfe/memories/notes') {
      let body;
      try { body = await request.json(); } catch (e) {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      const { event_id, event_name, round_name, player, note } = body; // Dev-80 fix — was round_id
      if (!player || !note) {
        return new Response(JSON.stringify({ error: 'player and note are required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      try {
        let eventId = event_id ? Number(event_id) : null;
        if (!eventId && event_name) {
          const eventRow = await env.DB.prepare(`SELECT id FROM bfe_events WHERE event_name = ?`).bind(event_name).first();
          eventId = eventRow ? eventRow.id : null;
        }
        if (!eventId) {
          return new Response(JSON.stringify({ error: 'Unknown event' }), { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
        const result = await env.DB.prepare(
          `INSERT INTO bfe_event_memory_notes (event_id, round_name, player, note) VALUES (?, ?, ?, ?)`
        ).bind(eventId, round_name || null, player, note).run();
        return new Response(JSON.stringify({ ok: true, id: result.meta.last_row_id }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Database error saving note: ' + String(e.message || e) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    // GET /bfe/memories/notes?event=<name>[&event_id=]  — open read, same as
    // GET /bfe/memories (notes carry no curation gate — spec has no
    // reject-by-exception concept for notes, only for photos/video).
    if (request.method === 'GET' && url.pathname === '/bfe/memories/notes') {
      try {
        // Pinned to D1 primary — see matching comment on GET /bfe/memories above.
        const db = (typeof env.DB.withSession === 'function') ? env.DB.withSession('first-primary') : env.DB;
        const eventName = url.searchParams.get('event');
        const eventIdQ  = url.searchParams.get('event_id');
        let eventId = eventIdQ ? Number(eventIdQ) : null;
        if (!eventId && eventName) {
          const eventRow = await db.prepare(`SELECT id FROM bfe_events WHERE event_name = ?`).bind(eventName).first();
          eventId = eventRow ? eventRow.id : null;
        }
        if (!eventId) {
          return new Response(JSON.stringify({ ok: true, notes: [] }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
        const { results } = await db.prepare(
          `SELECT * FROM bfe_event_memory_notes WHERE event_id = ? ORDER BY created_at ASC`
        ).bind(eventId).all();
        return new Response(JSON.stringify({ ok: true, notes: results }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Database error: ' + String(e.message || e) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    // GET /bfe/jotform/submissions?formId=<id>&filter=<url-encoded JSON>&limit=<n>
    // Mirrors api.jotform.com/form/:id/submissions's own contract exactly
    // (same {responseCode, message, content} envelope) so BFE-Admin.html's
    // jfFetchSubmissions() barely changed — just swapped which URL it calls.
    // No PIN: this only ever surfaces the same submission data the Admin
    // panel already displayed with the key sitting in plain client-side JS,
    // so nothing gets MORE exposed by opening it up — same posture as
    // GET /bfe/event-config above.
    if (request.method === 'GET' && url.pathname === '/bfe/jotform/submissions') {
      const formId = url.searchParams.get('formId');
      if (!formId) {
        return new Response(JSON.stringify({ error: 'formId query param is required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      const filter = url.searchParams.get('filter');
      const limit  = url.searchParams.get('limit') || '1000';
      const jfUrl = `${JF_API}/form/${encodeURIComponent(formId)}/submissions?apiKey=${JOTFORM_API_KEY}&limit=${encodeURIComponent(limit)}` +
                    (filter ? `&filter=${encodeURIComponent(filter)}` : '');
      try {
        const jfRes = await fetch(jfUrl);
        const jfJson = await jfRes.json();
        return new Response(JSON.stringify(jfJson), { status: jfRes.status, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Jotform proxy error: ' + String(e.message || e) }), { status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    // POST /bfe/jotform/submissions — body: { formId, fields: {qid: value, ...}, pin }
    // PIN-gated like the other admin write routes above: unlike the GET side,
    // a raw client fetch could always READ with the key visible in Network
    // tab, but couldn't WRITE without also copying that key out — so this is
    // a genuinely new capability once proxied, and gets the same 7797 gate
    // event-config/venue-tee-catalog already use rather than being left open.
    if (request.method === 'POST' && url.pathname === '/bfe/jotform/submissions') {
      let body;
      try { body = await request.json(); } catch (e) {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      const { formId, fields, pin } = body;
      if (String(pin) !== '7797') {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      if (!formId || !fields || typeof fields !== 'object') {
        return new Response(JSON.stringify({ error: 'formId and fields (object) are required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      const params = new URLSearchParams();
      for (const [qid, value] of Object.entries(fields)) {
        params.set(`submission[${qid}]`, String(value));
      }
      try {
        const jfRes = await fetch(`${JF_API}/form/${encodeURIComponent(formId)}/submissions?apiKey=${JOTFORM_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString()
        });
        const jfJson = await jfRes.json();
        return new Response(JSON.stringify(jfJson), { status: jfRes.status, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Jotform proxy error: ' + String(e.message || e) }), { status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    // ── GolfCourseAPI proxy (Dev-86, venue management — BF_BFE_NextGen_Spec.md
    // §1: "GC-API-first, D1 as cache + fallback"). Unlike JOTFORM_API_KEY above
    // (a known, already-flagged hardcoded-secret gap), this key is a real
    // Worker secret (env.GOLFCOURSE_API_KEY — set via `wrangler secret put` or
    // the Cloudflare dashboard, never committed to this file) — it must never
    // reach a browser. Read-only lookups only: GolfCourseAPI's own write
    // endpoints need a paid tier and aren't part of this proxy. These two
    // routes never write to D1 themselves — Venue Manager (portal.html) uses
    // their results to let the commissioner pick a tee, which is then saved
    // via POST /bfe/venue-tees above (a separate, explicit step) rather than
    // anything here auto-applying data. Confirmed live response shapes
    // against the real API (2026-09-24):
    //   GET /v1/search?search_query=X ->
    //     { courses: [{ id, club_name, course_name,
    //                    location: { city, state, latitude, longitude, ... } }] }
    //   GET /v1/courses/:id ->
    //     { course: { id, club_name, course_name, location: {...},
    //                  tees: { male: [tee...], female: [tee...] } } }
    //     each tee: { tee_name, course_rating, slope_rating, total_yards,
    //                 par_total, holes: [{ par, yardage, handicap } x18] }
    const GC_API_BASE = 'https://api.golfcourseapi.com';

    // GET /bfe/coursedata/search?q=<name>
    if (request.method === 'GET' && url.pathname === '/bfe/coursedata/search') {
      const q = (url.searchParams.get('q') || '').trim();
      if (!q) {
        return new Response(JSON.stringify({ error: 'q (search query) is required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      if (!env.GOLFCOURSE_API_KEY) {
        return new Response(JSON.stringify({ error: 'GolfCourseAPI is not configured on this Worker yet (missing GOLFCOURSE_API_KEY secret)' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      try {
        const gcRes = await fetch(`${GC_API_BASE}/v1/search?search_query=${encodeURIComponent(q)}`, {
          headers: { 'Authorization': 'Key ' + env.GOLFCOURSE_API_KEY }
        });
        const gcJson = await gcRes.json();
        if (!gcRes.ok) {
          return new Response(JSON.stringify({ error: gcJson.message || `GolfCourseAPI search failed (${gcRes.status})` }), { status: gcRes.status, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
        const courses = (gcJson.courses || []).map(c => ({
          id: c.id,
          club_name: c.club_name,
          course_name: c.course_name,
          city: c.location?.city ?? null,
          state: c.location?.state ?? null,
          latitude: c.location?.latitude ?? null,
          longitude: c.location?.longitude ?? null
        }));
        return new Response(JSON.stringify({ ok: true, courses }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'GolfCourseAPI search error: ' + String(e.message || e) }), { status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    // GET /bfe/coursedata/courses/:id — full tee/hole detail for one course.
    const courseDetailsMatch = url.pathname.match(/^\/bfe\/coursedata\/courses\/([^/]+)$/);
    if (request.method === 'GET' && courseDetailsMatch) {
      const courseId = decodeURIComponent(courseDetailsMatch[1]);
      if (!env.GOLFCOURSE_API_KEY) {
        return new Response(JSON.stringify({ error: 'GolfCourseAPI is not configured on this Worker yet (missing GOLFCOURSE_API_KEY secret)' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      try {
        const gcRes = await fetch(`${GC_API_BASE}/v1/courses/${encodeURIComponent(courseId)}`, {
          headers: { 'Authorization': 'Key ' + env.GOLFCOURSE_API_KEY }
        });
        const gcJson = await gcRes.json();
        if (!gcRes.ok) {
          return new Response(JSON.stringify({ error: gcJson.message || `GolfCourseAPI course lookup failed (${gcRes.status})` }), { status: gcRes.status, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
        const c = gcJson.course || {};
        // Flatten male+female tees into one list with a `gender` tag — Venue
        // Manager's own model (bfe_venue_tee_catalog) is "same tee for
        // everyone" or "by HCP tier", not gendered, so this just gives the
        // commissioner every tee GC-API has on offer to choose from.
        const tees = [
          ...(c.tees?.male || []).map(t => ({ ...t, gender: 'male' })),
          ...(c.tees?.female || []).map(t => ({ ...t, gender: 'female' }))
        ];
        return new Response(JSON.stringify({
          ok: true,
          id: c.id,
          club_name: c.club_name,
          course_name: c.course_name,
          latitude: c.location?.latitude ?? null,
          longitude: c.location?.longitude ?? null,
          tees
        }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'GolfCourseAPI course lookup error: ' + String(e.message || e) }), { status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
};
