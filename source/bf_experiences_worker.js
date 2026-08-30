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
    if (request.method === 'POST' && url.pathname === '/bfe/events') {
      let body;
      try { body = await request.json(); } catch (e) {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      const { event_name, event_family, hcp_mode, status, tee_policy, payout_plan, rounds, roster, pin } = body;
      if (String(pin) !== '7797') {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      if (!event_name || !Array.isArray(rounds)) {
        return new Response(JSON.stringify({ error: 'event_name and rounds (array) are required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      try {
        await env.DB.prepare(
          `INSERT INTO bfe_events (event_name, event_family, hcp_mode, status, tee_policy, payout_plan, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
           ON CONFLICT(event_name) DO UPDATE SET
             event_family = excluded.event_family, hcp_mode = excluded.hcp_mode, status = excluded.status,
             tee_policy = excluded.tee_policy, payout_plan = excluded.payout_plan, updated_at = excluded.updated_at`
        ).bind(event_name, event_family || null, hcp_mode || 'fixed', status || 'draft',
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
            `INSERT INTO bfe_event_rounds (event_id, sort_order, name, engine, engine_params, influencers, venue_id, venue_name, rolls_into_overall, chains_from_round_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`
          ).bind(eventId, i, r.name, r.engine, r.engineParams ? JSON.stringify(r.engineParams) : null,
                 r.influencers ? JSON.stringify(r.influencers) : null, r.venueId || null, r.venue || null,
                 r.rollsIntoOverall === false ? 0 : 1).run();
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
          name: r.name, engine: r.engine,
          engineParams: r.engine_params ? JSON.parse(r.engine_params) : undefined,
          influencers: r.influencers ? JSON.parse(r.influencers) : [],
          venue: r.venue_name, venueId: r.venue_id,
          rollsIntoOverall: !!r.rolls_into_overall,
          chainsFrom: r.chains_from_round_id ? (idToName[r.chains_from_round_id] || null) : null
        }));
        const roster = rosterRows.map(p => ({
          name: p.player_name, email: p.email, hcp: p.hcp_at_event,
          tee: { name: p.tee_name, slope: p.slope }, slope: p.slope,
          initialQuota: p.initial_quota, isNoHcp: !!p.is_no_hcp
        }));

        const config = {
          eventName: eventRow.event_name, eventFamily: eventRow.event_family, hcpMode: eventRow.hcp_mode,
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
          await env.DB.prepare(`DELETE FROM bfe_events WHERE id = ?`).bind(eventRow.id).run();
        }
        return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Delete error: ' + String(e.message || e) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
};