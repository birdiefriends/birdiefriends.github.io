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
        const { results: events } = await env.DB.prepare(
          `SELECT id, event_name, event_family, event_date, status, updated_at FROM bfe_events ORDER BY updated_at DESC`
        ).all();
        const summary = [];
        for (const e of events) {
          const rounds  = await env.DB.prepare(`SELECT COUNT(*) AS n FROM bfe_event_rounds WHERE event_id = ?`).bind(e.id).first();
          const roster  = await env.DB.prepare(`SELECT COUNT(*) AS n FROM bfe_event_roster WHERE event_id = ?`).bind(e.id).first();
          const results = await env.DB.prepare(`SELECT COUNT(*) AS n FROM bfe_round_results WHERE event_id = ?`).bind(e.id).first();
          const skins   = await env.DB.prepare(`SELECT COUNT(*) AS n FROM bfe_round_skins WHERE event_id = ?`).bind(e.id).first();
          const groups  = await env.DB.prepare(`SELECT COUNT(*) AS n FROM bfe_round_groups WHERE event_id = ?`).bind(e.id).first();
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
        await env.DB.prepare(
          `INSERT INTO bfe_events (event_name, event_family, event_date, event_end_date, memories_capture_open, trip_info_url, hcp_mode, status, tee_policy, payout_plan, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
           ON CONFLICT(event_name) DO UPDATE SET
             event_family = excluded.event_family, event_date = excluded.event_date, event_end_date = excluded.event_end_date,
             memories_capture_open = excluded.memories_capture_open, trip_info_url = excluded.trip_info_url, hcp_mode = excluded.hcp_mode, status = excluded.status,
             tee_policy = excluded.tee_policy, payout_plan = excluded.payout_plan, updated_at = excluded.updated_at`
        ).bind(event_name, event_family || null, event_date || null, event_end_date || null, captureOpen, trip_info_url || null,
               hcp_mode || 'fixed', status || 'draft',
               tee_policy ? JSON.stringify(tee_policy) : null, payout_plan ? JSON.stringify(payout_plan) : null).run();

        const eventRow = await env.DB.prepare(`SELECT id FROM bfe_events WHERE event_name = ?`).bind(event_name).first();
        const eventId = eventRow.id;

        await env.DB.prepare(`DELETE FROM bfe_event_rounds WHERE event_id = ?`).bind(eventId).run();
        await env.DB.prepare(`DELETE FROM bfe_event_roster WHERE event_id = ?`).bind(eventId).run();

        // Pass 1: insert rounds without chains_from_round_id (don't know the
        // ids yet), remembering each round's name -> new id as we go.
        const nameToId = {};
        for (let i = 0; i < rounds.length; i++) {
          const r = rounds[i];
          const result = await env.DB.prepare(
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
            await env.DB.prepare(`UPDATE bfe_event_rounds SET chains_from_round_id = ? WHERE id = ?`)
              .bind(nameToId[r.chainsFrom], nameToId[r.name]).run();
          }
        }

        for (const p of (roster || [])) {
          if (!p.name) continue;
          await env.DB.prepare(
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
        const eventRow = await env.DB.prepare(`SELECT * FROM bfe_events WHERE event_name = ?`).bind(eventName).first();
        if (!eventRow) {
          return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
        const { results: roundRows } = await env.DB.prepare(`SELECT * FROM bfe_event_rounds WHERE event_id = ? ORDER BY sort_order ASC`).bind(eventRow.id).all();
        const { results: rosterRows } = await env.DB.prepare(`SELECT * FROM bfe_event_roster WHERE event_id = ? ORDER BY id ASC`).bind(eventRow.id).all();

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
    if (request.method === 'DELETE' && url.pathname.startsWith('/bfe/events/')) {
      try {
        const eventName = decodeURIComponent(url.pathname.split('/bfe/events/')[1]);
        const pin = url.searchParams.get('pin');
        if (String(pin) !== '7797') {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
        const eventRow = await env.DB.prepare(`SELECT id FROM bfe_events WHERE event_name = ?`).bind(eventName).first();
        if (eventRow) {
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
        const eventName  = url.searchParams.get('event');
        const eventIdQ   = url.searchParams.get('event_id');
        const roundNameQ = url.searchParams.get('round_name'); // Dev-80 fix — was round_id
        const pin        = url.searchParams.get('pin');
        const isAdmin    = String(pin) === '7797';

        let eventId = eventIdQ ? Number(eventIdQ) : null;
        if (!eventId && eventName) {
          const eventRow = await env.DB.prepare(`SELECT id FROM bfe_events WHERE event_name = ?`).bind(eventName).first();
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
        const { results } = await env.DB.prepare(sql).bind(...binds).all();
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
        const eventName = url.searchParams.get('event');
        const eventIdQ  = url.searchParams.get('event_id');
        let eventId = eventIdQ ? Number(eventIdQ) : null;
        if (!eventId && eventName) {
          const eventRow = await env.DB.prepare(`SELECT id FROM bfe_events WHERE event_name = ?`).bind(eventName).first();
          eventId = eventRow ? eventRow.id : null;
        }
        if (!eventId) {
          return new Response(JSON.stringify({ ok: true, notes: [] }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
        const { results } = await env.DB.prepare(
          `SELECT * FROM bfe_event_memory_notes WHERE event_id = ? ORDER BY created_at ASC`
        ).bind(eventId).all();
        return new Response(JSON.stringify({ ok: true, notes: results }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Database error: ' + String(e.message || e) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
};