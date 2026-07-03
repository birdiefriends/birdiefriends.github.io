export default {
  async fetch(request, env) {

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    // DELETE /subscription/:id — delete one specific push subscription (stale dupe cleanup)
    // Called by portal Admin subscriber panel "Delete" button
    if (request.method === 'DELETE' && url.pathname.startsWith('/subscription/')) {
      const subId = url.pathname.split('/subscription/')[1];
      if (!subId) return new Response(JSON.stringify({ error: 'Missing subscription ID' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      const appId = url.searchParams.get('app_id');

      // Try v5 subscriptions endpoint first
      const osUrl = `https://api.onesignal.com/apps/${appId}/subscriptions/${subId}`;
      const osResp = await fetch(osUrl, {
        method: 'DELETE',
        headers: { 'Authorization': 'Key ' + env.OS_REST_KEY, 'Accept': 'application/json' }
      });

      if (osResp.status === 200 || osResp.status === 204) {
        return new Response(JSON.stringify({ success: true, status: osResp.status }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Fallback: v1 players endpoint (older subscriptions may only respond to this)
      const v1Url = `https://api.onesignal.com/players/${subId}?app_id=${appId}`;
      const v1Resp = await fetch(v1Url, {
        method: 'DELETE',
        headers: { 'Authorization': 'Key ' + env.OS_REST_KEY, 'Accept': 'application/json' }
      });
      const ok = v1Resp.status === 200 || v1Resp.status === 204;
      let body = {};
      try { body = await v1Resp.json(); } catch(e) {}
      return new Response(JSON.stringify({ success: ok, status: v1Resp.status, detail: body }), {
        status: ok ? 200 : v1Resp.status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // DELETE /user/:externalId/stale — delete all but the newest subscription for a named player
    if (request.method === 'DELETE' && url.pathname.includes('/stale')) {
      const match = url.pathname.match(/^\/user\/(.+)\/stale$/);
      if (!match) return new Response(JSON.stringify({ error: 'Invalid path' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      const externalId = decodeURIComponent(match[1]);
      const appId = url.searchParams.get('app_id');

      const listUrl = `https://api.onesignal.com/players?app_id=${appId}&limit=300`;
      const listResp = await fetch(listUrl, {
        headers: { 'Authorization': 'Key ' + env.OS_REST_KEY, 'Accept': 'application/json' }
      });
      const listData = await listResp.json();
      const players = (listData.players || []).filter(p =>
        p.external_user_id === externalId && p.invalid_identifier !== true
      );

      if (players.length <= 1) {
        return new Response(JSON.stringify({ success: true, deleted: 0, kept: players.length }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      players.sort((a, b) => (b.created_at || 0) - (a.created_at || 0) || b.id.localeCompare(a.id));
      const keep = players[0];
      const stale = players.slice(1);

      const deletions = await Promise.all(stale.map(async p => {
        const delUrl = `https://api.onesignal.com/apps/${appId}/subscriptions/${p.id}`;
        const delResp = await fetch(delUrl, {
          method: 'DELETE',
          headers: { 'Authorization': 'Key ' + env.OS_REST_KEY }
        });
        return { id: p.id, status: delResp.status };
      }));

      return new Response(JSON.stringify({
        success: true,
        kept: keep.id,
        deleted: deletions.length,
        deletions
      }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // DELETE /notifications/clear — delete OneSignal sent messages (PIN required)
    // Body: { pin, app_id } → delete all 50 most recent
    // Body: { pin, app_id, ids: [...] } → delete specific IDs only
    if (request.method === 'DELETE' && url.pathname === '/notifications/clear') {
      let body;
      try { body = await request.json(); } catch(e) {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      if (String(body.pin) !== '7797') {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }

      const appId = body.app_id;
      if (!appId) {
        return new Response(JSON.stringify({ error: 'Missing app_id' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }

      let toDelete = [];

      if (body.ids && Array.isArray(body.ids) && body.ids.length > 0) {
        // Specific IDs provided — delete only those
        toDelete = body.ids;
      } else {
        // No IDs — fetch all recent notifications then delete all
        // Use same URL pattern as GET /notifications route (confirmed working)
        const listResp = await fetch(
          `https://api.onesignal.com/notifications?app_id=${appId}&limit=50&kind=1`,
          { headers: { 'Authorization': 'Key ' + env.OS_REST_KEY, 'Accept': 'application/json' } }
        );
        const listData = await listResp.json();
        console.log('[notifications/clear] list fetch status:', listResp.status, 'count:', (listData.notifications || []).length);
        toDelete = (listData.notifications || []).map(n => n.id);
      }

      if (toDelete.length === 0) {
        console.log('[notifications/clear] nothing to delete');
        return new Response(JSON.stringify({ deleted: 0, failed: 0, errors: [], total: 0 }), {
          status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      console.log('[notifications/clear] attempting to delete', toDelete.length, 'notifications');

      let deleted = 0, failed = 0;
      const errors = [];
      for (const id of toDelete) {
        // Use v1 URL — confirmed correct endpoint for notification delete
        const delResp = await fetch(
          `https://onesignal.com/api/v1/notifications/${id}?app_id=${appId}`,
          { method: 'DELETE', headers: { 'Authorization': 'Key ' + env.OS_REST_KEY } }
        );
        const delBody = await delResp.json().catch(() => ({}));
        if (delResp.ok) {
          deleted++;
        } else {
          failed++;
          errors.push({ id, status: delResp.status, detail: delBody });
          console.warn('[notifications/clear] delete failed:', id, delResp.status, JSON.stringify(delBody));
        }
      }

      console.log('[notifications/clear] done — deleted:', deleted, 'failed:', failed);

      return new Response(
        JSON.stringify({ deleted, failed, errors, total: toDelete.length }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // GET /flags — read all flags from KV (public, no auth)
    if (request.method === 'GET' && url.pathname === '/flags') {
      const keys = ['maintenance', 'live_test', 'live_override', 'live_override_since', 'gathering_panel_live'];
      const entries = await Promise.all(keys.map(async k => [k, await env.BF_FLAGS.get(k)]));
      const flags = {};
      entries.forEach(([k, v]) => {
        if (v === null) return;
        flags[k] = v === 'true' ? true : v === 'false' ? false : v;
      });
      return new Response(JSON.stringify(flags), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // POST /flags — write a flag to KV (PIN required)
    if (request.method === 'POST' && url.pathname === '/flags') {
      let body;
      try { body = await request.json(); } catch(e) {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      const { pin, key, value, since } = body;
      if (pin !== '7797') {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      const allowed = ['maintenance', 'live_test', 'live_override', 'gathering_panel_live'];
      if (!allowed.includes(key)) {
        return new Response(JSON.stringify({ error: 'Unknown flag key' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      await env.BF_FLAGS.put(key, String(value));
      if (key === 'live_override' && value === true && since) {
        await env.BF_FLAGS.put('live_override_since', since);
      } else if (key === 'live_override' && value === false) {
        await env.BF_FLAGS.delete('live_override_since');
      }
      return new Response(JSON.stringify({ ok: true, key, value }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // ============================================================
    // GATHERINGS — Dev-43, D1-backed (env.DB), MLP scope only.
    // No PIN: hosting is open to any player (spec §6). Trust model
    // matches existing Jotform client writes — host_id/player_id is
    // whatever the calling client says it is, no session auth layer.
    // ============================================================

    // POST /gatherings — create a Gathering
    if (request.method === 'POST' && url.pathname === '/gatherings') {
      let body;
      try { body = await request.json(); } catch(e) {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      const { host_id, title, venue, event_time, size, crew_id, fill_list_enabled, gathering_type, description, tee_time_status } = body;
      if (!host_id || !title || !event_time) {
        return new Response(JSON.stringify({ error: 'host_id, title, and event_time are required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      try {
        const result = await env.DB.prepare(
          `INSERT INTO gatherings (host_id, title, venue, event_time, size, crew_id, fill_list_enabled, status, gathering_type, description, tee_time_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`
        ).bind(host_id, title, venue || null, event_time, size || null, crew_id || null, fill_list_enabled ? 1 : 0, gathering_type || null, description || null, tee_time_status || 'confirmed').run();
        return new Response(JSON.stringify({ ok: true, id: result.meta.last_row_id }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (e) {
        const msg = String(e.message || e).includes('FOREIGN KEY') ? 'crew_id does not exist' : 'Database error creating Gathering';
        return new Response(JSON.stringify({ error: msg }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    // POST /gatherings/:id/cancel — cancel a Gathering (host only)
    if (request.method === 'POST' && /^\/gatherings\/\d+\/cancel$/.test(url.pathname)) {
      const gatheringId = url.pathname.split('/')[2];
      let body;
      try { body = await request.json(); } catch(e) {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      const { host_id } = body;
      if (!host_id) {
        return new Response(JSON.stringify({ error: 'host_id is required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      try {
        const gathering = await env.DB.prepare(`SELECT host_id FROM gatherings WHERE id = ?`).bind(gatheringId).first();
        if (!gathering) {
          return new Response(JSON.stringify({ error: 'Gathering not found' }), { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
        if (gathering.host_id !== host_id) {
          return new Response(JSON.stringify({ error: 'Only the host can cancel this Gathering' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
        await env.DB.prepare(`UPDATE gatherings SET status = 'cancelled' WHERE id = ?`).bind(gatheringId).run();

        // Notify on cancel — Worker-side so we always reach the full crew/respondents,
        // not just whoever the portal's gatheringRegData happened to have loaded.
        // Crew mode: notify all crew_members. Open mode: notify Yes/Sub registrants only.
        try {
          const fullG = await env.DB.prepare(`SELECT * FROM gatherings WHERE id = ?`).bind(gatheringId).first();
          const gTitle = fullG ? fullG.title : 'a Gathering';
          let notifyIds = [];
          if (fullG && fullG.fill_list_enabled) {
            const { results: regs } = await env.DB.prepare(
              `SELECT player_id FROM registrations WHERE gathering_id = ? AND status IN ('yes','sub')`
            ).bind(gatheringId).all();
            notifyIds = regs.map(r => r.player_id).filter(id => id !== host_id);
          } else if (fullG && fullG.crew_id) {
            const { results: members } = await env.DB.prepare(
              `SELECT player_id FROM crew_members WHERE crew_id = ?`
            ).bind(fullG.crew_id).all();
            notifyIds = members.map(r => r.player_id).filter(id => id !== host_id);
          }
          if (notifyIds.length) {
            const sentAt = Date.now();
            const kvKey  = `feed::${sentAt}`;
            const bfMeta = { gathering_id: Number(gatheringId), invited: notifyIds };
            const notifyPayload = {
              app_id: env.OS_APP_ID,
              headings: { en: '❌ Gathering Cancelled' },
              contents: { en: `"${gTitle}" has been cancelled.` },
              filters: notifyIds.flatMap((id, i) => [
                ...(i > 0 ? [{ operator: 'OR' }] : []),
                { field: 'tag', key: 'player_name', relation: '=', value: id }
              ]),
              url: 'https://birdiefriends.com/portal.html',
              bf_type: 'gathering_cancelled',
              bf_meta: bfMeta
            };
            await env.BF_FLAGS.put(kvKey, JSON.stringify({
              id: `feed-${sentAt}`, key: kvKey,
              title: notifyPayload.headings.en, body: notifyPayload.contents.en,
              sentAt, type: 'gathering_cancelled', meta: bfMeta
            }));
            fetch('https://onesignal.com/api/v1/notifications', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': 'Key ' + env.OS_REST_KEY },
              body: JSON.stringify(notifyPayload)
            }).catch(e => console.warn('Cancel notify push failed:', e));
          }
        } catch(notifyErr) {
          console.warn('Cancel: notify failed (non-blocking):', notifyErr);
        }

        return new Response(JSON.stringify({ ok: true, id: Number(gatheringId), status: 'cancelled' }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Database error cancelling Gathering' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    // PATCH /gatherings/:id — edit a Gathering's metadata (host only, Dev-48)
    // Editable fields: title, venue, event_time, size, gathering_type, description.
    // Crew membership changes are out of scope — use POST /crews/:id/members/add.
    // Returns { ok, dateChanged } so the portal knows whether to trigger
    // re-confirmation flow (notification + stale-response flag on cards).
    if (request.method === 'PATCH' && /^\/gatherings\/\d+$/.test(url.pathname)) {
      const gatheringId = url.pathname.split('/')[2];
      let body;
      try { body = await request.json(); } catch(e) {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      const { host_id } = body;
      if (!host_id) {
        return new Response(JSON.stringify({ error: 'host_id is required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      try {
        const gathering = await env.DB.prepare(
          `SELECT host_id, event_time, title, crew_id FROM gatherings WHERE id = ? AND status = 'active'`
        ).bind(gatheringId).first();
        if (!gathering) {
          return new Response(JSON.stringify({ error: 'Gathering not found' }), { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
        if (gathering.host_id !== host_id) {
          return new Response(JSON.stringify({ error: 'Only the host can edit this Gathering' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }

        // Build dynamic UPDATE — only set fields present in the request body.
        const allowed = ['title', 'venue', 'event_time', 'size', 'gathering_type', 'description', 'tee_time_status'];
        const setClauses = [];
        const binds = [];
        for (const field of allowed) {
          if (Object.prototype.hasOwnProperty.call(body, field)) {
            setClauses.push(`${field} = ?`);
            binds.push(body[field] ?? null);
          }
        }
        if (setClauses.length === 0) {
          return new Response(JSON.stringify({ error: 'No editable fields provided' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
        binds.push(gatheringId);
        await env.DB.prepare(
          `UPDATE gatherings SET ${setClauses.join(', ')} WHERE id = ?`
        ).bind(...binds).run();

        // Detect date change — if event_time changed, portal will trigger
        // re-confirmation flow (notification + stale banner on crew cards).
        const dateChanged = Object.prototype.hasOwnProperty.call(body, 'event_time') &&
          body.event_time !== gathering.event_time;

        // If date changed, notify full crew via push so they can re-confirm.
        // Fetch crew members using the same crew_id stored on the Gathering.
        if (dateChanged && gathering.crew_id) {
          try {
            const { results: crewMembers } = await env.DB.prepare(
              `SELECT player_id FROM crew_members WHERE crew_id = ?`
            ).bind(gathering.crew_id).all();
            const notifyIds = crewMembers.map(r => r.player_id).filter(id => id !== host_id);
            if (notifyIds.length) {
              const newTitle = Object.prototype.hasOwnProperty.call(body, 'title') ? body.title : gathering.title;
              // Parse date/time directly from the ISO string the portal sends
              // (e.g. "2026-06-25T11:00:00-04:00") — Workers run in UTC so
              // toLocaleDateString() would shift the hour. Extract wall-clock
              // components from the string itself instead.
              const etStr   = body.event_time; // e.g. "2026-06-25T11:00:00-04:00"
              const etParts = etStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
              let dateStr;
              if (etParts) {
                const [,yr,mo,dy,hr,mn] = etParts;
                const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                const days   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
                // Use UTC date object just for day-of-week (date part is unambiguous)
                const dowDt  = new Date(`${yr}-${mo}-${dy}T12:00:00Z`);
                const dow    = days[dowDt.getUTCDay()];
                const mon    = months[parseInt(mo,10)-1];
                const h24    = parseInt(hr,10);
                const h12    = h24 % 12 || 12;
                const ampm   = h24 < 12 ? 'AM' : 'PM';
                const minStr = mn === '00' ? '' : `:${mn}`;
                dateStr = `${dow}, ${mon} ${parseInt(dy,10)}, ${h12}${minStr} ${ampm}`;
              } else {
                dateStr = new Date(etStr).toUTCString(); // fallback
              }
              // Fire-and-forget to Worker's own POST / route — same pattern as cancel/invite
              const notifyPayload = {
                app_id: env.OS_APP_ID,
                headings: { en: '📅 Gathering Updated' },
                contents: { en: `"${newTitle}" has moved to ${dateStr}. Please re-confirm your plans.` },
                filters: notifyIds.flatMap((id, i) => [
                  ...(i > 0 ? [{ operator: 'OR' }] : []),
                  { field: 'tag', key: 'player_name', relation: '=', value: id }
                ]),
                url: 'https://birdiefriends.com/portal.html',
                bf_type: 'gathering_date_changed',
                bf_meta: { gathering_id: Number(gatheringId), invited: notifyIds }
              };
              // Write to KV feed directly (same pattern as feed_only path)
              const sentAt = Date.now();
              const kvKey  = `feed::${sentAt}`;
              const entry  = {
                id: `feed-${sentAt}`, key: kvKey,
                title: notifyPayload.headings.en,
                body: notifyPayload.contents.en,
                sentAt, type: 'gathering_date_changed',
                meta: notifyPayload.bf_meta
              };
              await env.BF_FLAGS.put(kvKey, JSON.stringify(entry));
              // Push via OneSignal (best-effort — edit succeeds even if notify fails)
              fetch('https://onesignal.com/api/v1/notifications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Key ' + env.OS_REST_KEY },
                body: JSON.stringify(notifyPayload)
              }).catch(e => console.warn('PATCH date-change notify failed:', e));
            }
          } catch(notifyErr) {
            console.warn('PATCH: crew notify fetch failed (non-blocking):', notifyErr);
          }
        }

        return new Response(JSON.stringify({ ok: true, id: Number(gatheringId), dateChanged }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Database error editing Gathering' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    // GET /gatherings?player_id=X — Gatherings visible to a player:
    // their own (as host) + any they're invited to via Crew membership.
    // Cancelled Gatherings excluded — "past ones quietly disappear."
    if (request.method === 'GET' && url.pathname === '/gatherings') {
      const playerId = url.searchParams.get('player_id');
      if (!playerId) {
        return new Response(JSON.stringify({ error: 'player_id is required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      try {
        // gathering_alerts=true → also return fill_list_enabled gatherings (open broadcast)
        const gatheringAlerts = url.searchParams.get('gathering_alerts') === 'true';
        const sql = gatheringAlerts
          ? `SELECT DISTINCT g.*, c.name AS crew_name FROM gatherings g
             LEFT JOIN crew_members cm ON cm.crew_id = g.crew_id
             LEFT JOIN crews c ON c.id = g.crew_id
             WHERE g.status = 'active' AND (g.host_id = ? OR cm.player_id = ? OR g.fill_list_enabled = 1)
             ORDER BY g.event_time ASC`
          : `SELECT DISTINCT g.*, c.name AS crew_name FROM gatherings g
             LEFT JOIN crew_members cm ON cm.crew_id = g.crew_id
             LEFT JOIN crews c ON c.id = g.crew_id
             WHERE g.status = 'active' AND (g.host_id = ? OR cm.player_id = ?)
             ORDER BY g.event_time ASC`;
        const { results } = await env.DB.prepare(sql).bind(playerId, playerId).all();
        return new Response(JSON.stringify({ ok: true, gatherings: results }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Database error fetching Gatherings' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    // POST /crews — create a Crew (ad hoc or saved; name null = ad hoc/unsaved)
    if (request.method === 'POST' && url.pathname === '/crews') {
      let body;
      try { body = await request.json(); } catch(e) {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      const { host_id, name, player_ids } = body;
      if (!host_id || !Array.isArray(player_ids) || player_ids.length === 0) {
        return new Response(JSON.stringify({ error: 'host_id and a non-empty player_ids array are required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      try {
        const crewResult = await env.DB.prepare(
          `INSERT INTO crews (host_id, name) VALUES (?, ?)`
        ).bind(host_id, name || null).run();
        const crewId = crewResult.meta.last_row_id;
        const inserts = player_ids.map(pid =>
          env.DB.prepare(`INSERT INTO crew_members (crew_id, player_id) VALUES (?, ?)`).bind(crewId, pid)
        );
        await env.DB.batch(inserts);
        return new Response(JSON.stringify({ ok: true, id: crewId }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Database error creating Crew' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    // GET /crews?host_id=X — a host's saved Crews (name not null; ad hoc Crews omitted)
    if (request.method === 'GET' && url.pathname === '/crews') {
      const hostId = url.searchParams.get('host_id');
      if (!hostId) {
        return new Response(JSON.stringify({ error: 'host_id is required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      try {
        const { results } = await env.DB.prepare(
          `SELECT * FROM crews WHERE host_id = ? AND name IS NOT NULL ORDER BY name ASC`
        ).bind(hostId).all();
        return new Response(JSON.stringify({ ok: true, crews: results }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Database error fetching Crews' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    // GET /crews/:id/members — a Crew's player_ids. Needed by the Host
    // Management panel (Dev-45) so reusing a saved Crew can still notify its
    // members on Gathering create/cancel without re-picking the list each time.
    if (request.method === 'GET' && /^\/crews\/\d+\/members$/.test(url.pathname)) {
      const crewId = url.pathname.split('/')[2];
      try {
        const { results } = await env.DB.prepare(
          `SELECT player_id FROM crew_members WHERE crew_id = ?`
        ).bind(crewId).all();
        return new Response(JSON.stringify({ ok: true, player_ids: results.map(r => r.player_id) }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Database error fetching Crew members' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    // POST /crews/:id/members/add — add new members to an existing Crew (Dev-46).
    // Idempotent: INSERT OR IGNORE skips duplicates, so re-inviting an existing
    // member is safe. Returns the full updated member list so the caller can
    // notify only the newly added players without a second fetch.
    // Body: { player_ids: [...] }
    if (request.method === 'POST' && /^\/crews\/\d+\/members\/add$/.test(url.pathname)) {
      const crewId = url.pathname.split('/')[2];
      let body;
      try { body = await request.json(); } catch(e) {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      const { player_ids } = body;
      if (!Array.isArray(player_ids) || player_ids.length === 0) {
        return new Response(JSON.stringify({ error: 'player_ids must be a non-empty array' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      try {
        const inserts = player_ids.map(pid =>
          env.DB.prepare(`INSERT OR IGNORE INTO crew_members (crew_id, player_id) VALUES (?, ?)`).bind(crewId, pid)
        );
        await env.DB.batch(inserts);
        const { results } = await env.DB.prepare(
          `SELECT player_id FROM crew_members WHERE crew_id = ?`
        ).bind(crewId).all();
        return new Response(JSON.stringify({ ok: true, player_ids: results.map(r => r.player_id) }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Database error adding Crew members' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    // POST /registrations — set a player's Yes/No/Sub response for a Gathering (upsert)
    if (request.method === 'POST' && url.pathname === '/registrations') {
      let body;
      try { body = await request.json(); } catch(e) {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      const { gathering_id, player_id, status, confirmed_for, host_note } = body;
      if (!gathering_id || !player_id || !['yes','no','sub'].includes(status)) {
        return new Response(JSON.stringify({ error: 'gathering_id, player_id, and status (yes/no/sub) are required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      try {
        // confirmed_for stores the event_time the player responded to.
        // Portal uses it to detect stale responses after a date change (Dev-48).
        // host_note is an optional free-text message from crew to host (Dev-49).
        await env.DB.prepare(
          `INSERT INTO registrations (gathering_id, player_id, status, registered_at, confirmed_for, host_note)
           VALUES (?, ?, ?, datetime('now'), ?, ?)
           ON CONFLICT (gathering_id, player_id) DO UPDATE SET
             status = excluded.status,
             registered_at = excluded.registered_at,
             confirmed_for = excluded.confirmed_for,
             host_note = excluded.host_note`
        ).bind(gathering_id, player_id, status, confirmed_for || null, host_note || null).run();
        return new Response(JSON.stringify({ ok: true, gathering_id: Number(gathering_id), player_id, status }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (e) {
        const msg = String(e.message || e).includes('FOREIGN KEY') ? 'gathering_id does not exist' : 'Database error saving registration';
        return new Response(JSON.stringify({ error: msg }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    // GET /gatherings/:id/registrations — host's view of who's responded
    if (request.method === 'GET' && /^\/gatherings\/\d+\/registrations$/.test(url.pathname)) {
      const gatheringId = url.pathname.split('/')[2];
      try {
        const { results } = await env.DB.prepare(
          `SELECT player_id, status, registered_at, confirmed_for, host_note FROM registrations WHERE gathering_id = ? ORDER BY registered_at ASC`
        ).bind(gatheringId).all();
        return new Response(JSON.stringify({ ok: true, registrations: results }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Database error fetching registrations' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    // GET /venues?pin=X — commissioner view returns ALL venues (active + inactive)
    // GET /venues        — public view returns active venues only (existing behaviour preserved)
    if (request.method === 'GET' && url.pathname === '/venues') {
      const pin = url.searchParams.get('pin');
      const isCommissioner = (pin === '7797');
      try {
        const sql = isCommissioner
          ? `SELECT id, name, active, sort_order FROM venues ORDER BY sort_order ASC, name ASC`
          : `SELECT id, name FROM venues WHERE active = 1 ORDER BY sort_order ASC, name ASC`;
        const rows = await env.DB.prepare(sql).all();
        return new Response(JSON.stringify({ ok: true, venues: rows.results }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch(e) {
        return new Response(JSON.stringify({ error: 'Database error fetching venues' }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // POST /venues — commissioner adds a new venue. PIN-gated.
    if (request.method === 'POST' && url.pathname === '/venues') {
      const body = await request.json();
      const { pin, name, sort_order } = body;
      if (pin !== '7797') return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      if (!name || !name.trim()) return new Response(JSON.stringify({ error: 'name is required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      try {
        // Place new venue just before "Other" (sort_order 99) by default
        const order = (sort_order != null) ? sort_order : 90;
        const result = await env.DB.prepare(
          `INSERT INTO venues (name, active, sort_order) VALUES (?, 1, ?)`
        ).bind(name.trim(), order).run();
        return new Response(JSON.stringify({ ok: true, id: result.meta.last_row_id }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch(e) {
        return new Response(JSON.stringify({ error: 'Database error adding venue' }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // PATCH /venues/:id — commissioner toggles active status. PIN-gated.
    const venuePatchMatch = url.pathname.match(/^\/venues\/(\d+)$/);
    if (request.method === 'PATCH' && venuePatchMatch) {
      const venueId = venuePatchMatch[1];
      const body = await request.json();
      const { pin, active } = body;
      if (pin !== '7797') return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      if (active == null) return new Response(JSON.stringify({ error: 'active is required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      try {
        await env.DB.prepare(`UPDATE venues SET active = ? WHERE id = ?`).bind(active ? 1 : 0, venueId).run();
        return new Response(JSON.stringify({ ok: true }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch(e) {
        return new Response(JSON.stringify({ error: 'Database error updating venue' }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // POST /gathering-templates — save a new template. No PIN (open-trust model per §16).
    if (request.method === 'POST' && url.pathname === '/gathering-templates') {
      const body = await request.json();
      const { host_id, name, title, venue, capacity, gathering_type, description, crew_snapshot } = body;
      if (!host_id || !name || !title) {
        return new Response(JSON.stringify({ error: 'host_id, name, and title are required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      try {
        const result = await env.DB.prepare(
          `INSERT INTO gathering_templates (host_id, name, title, venue, capacity, gathering_type, description, crew_snapshot)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          host_id, name, title,
          venue || null, capacity || null,
          gathering_type || null, description || null,
          crew_snapshot ? JSON.stringify(crew_snapshot) : null
        ).run();
        return new Response(JSON.stringify({ ok: true, id: result.meta.last_row_id }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch(e) {
        return new Response(JSON.stringify({ error: 'Database error saving template' }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // GET /gathering-templates?host_id=X — list all templates for a host.
    if (request.method === 'GET' && url.pathname === '/gathering-templates') {
      const hostId = url.searchParams.get('host_id');
      if (!hostId) return new Response(JSON.stringify({ error: 'host_id is required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      try {
        const rows = await env.DB.prepare(
          `SELECT id, name, title, venue, capacity, gathering_type, description, crew_snapshot, created_at
           FROM gathering_templates WHERE host_id = ? ORDER BY created_at DESC`
        ).bind(hostId).all();
        const templates = rows.results.map(t => ({
          ...t,
          crew_snapshot: t.crew_snapshot ? JSON.parse(t.crew_snapshot) : []
        }));
        return new Response(JSON.stringify({ ok: true, templates }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch(e) {
        return new Response(JSON.stringify({ error: 'Database error fetching templates' }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // DELETE /gathering-templates/:id?host_id=X — delete a template, ownership verified.
    const templateDeleteMatch = url.pathname.match(/^\/gathering-templates\/(\d+)$/);
    if (request.method === 'DELETE' && templateDeleteMatch) {
      const templateId = templateDeleteMatch[1];
      const hostId = url.searchParams.get('host_id');
      if (!hostId) return new Response(JSON.stringify({ error: 'host_id is required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      try {
        // Verify ownership before deleting
        const row = await env.DB.prepare(`SELECT host_id FROM gathering_templates WHERE id = ?`).bind(templateId).first();
        if (!row) return new Response(JSON.stringify({ error: 'Template not found' }), { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        if (row.host_id !== hostId) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        await env.DB.prepare(`DELETE FROM gathering_templates WHERE id = ?`).bind(templateId).run();
        return new Response(JSON.stringify({ ok: true }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch(e) {
        return new Response(JSON.stringify({ error: 'Database error deleting template' }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // GET /gatherings/all?pin=X — commissioner view of ALL active gatherings
    // grouped by host, with crew member count and registration counts per status.
    // PIN-gated (same PIN as /deploy and /flags).
    if (request.method === 'GET' && url.pathname === '/gatherings/all') {
      const pin = url.searchParams.get('pin');
      if (pin !== '7797') {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      try {
        const { results } = await env.DB.prepare(`
          SELECT
            g.id, g.host_id, g.title, g.event_time, g.venue, g.gathering_type,
            g.size, g.fill_list_enabled, g.tee_time_status, g.status,
            g.created_at,
            COALESCE(cm_count.cnt, 0) AS crew_size,
            COALESCE(yes_count.cnt, 0) AS yes_count,
            COALESCE(sub_count.cnt, 0) AS sub_count,
            COALESCE(no_count.cnt, 0) AS no_count
          FROM gatherings g
          LEFT JOIN (
            SELECT crew_id, COUNT(*) AS cnt FROM crew_members GROUP BY crew_id
          ) cm_count ON cm_count.crew_id = g.crew_id
          LEFT JOIN (
            SELECT gathering_id, COUNT(*) AS cnt FROM registrations WHERE status = 'yes' GROUP BY gathering_id
          ) yes_count ON yes_count.gathering_id = g.id
          LEFT JOIN (
            SELECT gathering_id, COUNT(*) AS cnt FROM registrations WHERE status = 'sub' GROUP BY gathering_id
          ) sub_count ON sub_count.gathering_id = g.id
          LEFT JOIN (
            SELECT gathering_id, COUNT(*) AS cnt FROM registrations WHERE status = 'no' GROUP BY gathering_id
          ) no_count ON no_count.gathering_id = g.id
          WHERE g.status = 'active'
          ORDER BY g.host_id ASC, g.event_time ASC
        `).all();
        return new Response(JSON.stringify({ ok: true, gatherings: results }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Database error: ' + e.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    // DELETE /gatherings/:id/admin?pin=X — commissioner hard-delete of any Gathering
    // Removes registrations, crew_members, crew, and gathering rows.
    if (request.method === 'DELETE' && /^\/gatherings\/\d+\/admin$/.test(url.pathname)) {
      const pin = url.searchParams.get('pin');
      if (pin !== '7797') {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      const gatheringId = url.pathname.split('/')[2];
      try {
        const g = await env.DB.prepare(`SELECT crew_id FROM gatherings WHERE id = ?`).bind(gatheringId).first();
        if (!g) return new Response(JSON.stringify({ error: 'Gathering not found' }), { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        await env.DB.batch([
          env.DB.prepare(`DELETE FROM registrations WHERE gathering_id = ?`).bind(gatheringId),
          env.DB.prepare(`DELETE FROM gatherings WHERE id = ?`).bind(gatheringId),
        ]);
        if (g.crew_id) {
          await env.DB.batch([
            env.DB.prepare(`DELETE FROM crew_members WHERE crew_id = ?`).bind(g.crew_id),
            env.DB.prepare(`DELETE FROM crews WHERE id = ?`).bind(g.crew_id),
          ]);
        }
        return new Response(JSON.stringify({ ok: true, deleted: Number(gatheringId) }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Database error: ' + e.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    // POST /gatherings/purge-test — true DELETE of test Gatherings + their Crews,
    // crew_members, and registrations (PIN required — destructive, unlike the rest
    // of the Gatherings routes which trust the client per §6; deletion warrants the
    // same discipline as /deploy and /rollback).
    // Body: { pin, host_id, prefix } — prefix defaults to "TEST — " if omitted.
    // Deletes child rows before parents to satisfy D1's enforced foreign keys:
    //   registrations → gatherings, then crew_members → crews. A crew is only
    //   deleted if no remaining (non-deleted) gathering still references it.
    if (request.method === 'POST' && url.pathname === '/gatherings/purge-test') {
      let body;
      try { body = await request.json(); } catch(e) {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      if (String(body.pin) !== '7797') {
        return new Response(JSON.stringify({ error: 'Invalid PIN' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      const { host_id, prefix } = body;
      if (!host_id) {
        return new Response(JSON.stringify({ error: 'host_id is required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      const titlePrefix = (prefix || 'TEST — ') + '%';

      try {
        const { results: matches } = await env.DB.prepare(
          `SELECT id, crew_id FROM gatherings WHERE host_id = ? AND title LIKE ?`
        ).bind(host_id, titlePrefix).all();

        if (!matches.length) {
          return new Response(JSON.stringify({ ok: true, gatherings_deleted: 0, crews_deleted: 0, registrations_deleted: 0 }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        const gatheringIds = matches.map(m => m.id);
        const crewIds = [...new Set(matches.map(m => m.crew_id).filter(id => id !== null))];
        const gPlaceholders = gatheringIds.map(() => '?').join(',');

        const regResult = await env.DB.prepare(
          `DELETE FROM registrations WHERE gathering_id IN (${gPlaceholders})`
        ).bind(...gatheringIds).run();

        const gathResult = await env.DB.prepare(
          `DELETE FROM gatherings WHERE id IN (${gPlaceholders})`
        ).bind(...gatheringIds).run();

        let crewsDeleted = 0;
        if (crewIds.length) {
          const cPlaceholders = crewIds.map(() => '?').join(',');
          // Only delete crews no longer referenced by any remaining gathering
          const { results: stillUsed } = await env.DB.prepare(
            `SELECT DISTINCT crew_id FROM gatherings WHERE crew_id IN (${cPlaceholders})`
          ).bind(...crewIds).all();
          const stillUsedIds = new Set(stillUsed.map(r => r.crew_id));
          const safeToDeleteIds = crewIds.filter(id => !stillUsedIds.has(id));

          if (safeToDeleteIds.length) {
            const sPlaceholders = safeToDeleteIds.map(() => '?').join(',');
            await env.DB.prepare(
              `DELETE FROM crew_members WHERE crew_id IN (${sPlaceholders})`
            ).bind(...safeToDeleteIds).run();
            const crewResult = await env.DB.prepare(
              `DELETE FROM crews WHERE id IN (${sPlaceholders})`
            ).bind(...safeToDeleteIds).run();
            crewsDeleted = crewResult.meta.changes || 0;
          }
        }

        return new Response(JSON.stringify({
          ok: true,
          gatherings_deleted: gathResult.meta.changes || 0,
          crews_deleted: crewsDeleted,
          registrations_deleted: regResult.meta.changes || 0
        }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Database error purging test Gatherings: ' + String(e.message || e) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    // POST /gatherings/purge-all — true DELETE of ALL Gatherings for a host
    // (not just test ones). PIN required. Wipes gatherings, crews, crew_members,
    // and registrations. Commissioner-only nuclear option for D1 cleanup.
    // Body: { pin, host_id }
    if (request.method === 'POST' && url.pathname === '/gatherings/purge-all') {
      let body;
      try { body = await request.json(); } catch(e) {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      if (String(body.pin) !== '7797') {
        return new Response(JSON.stringify({ error: 'Invalid PIN' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      const { host_id } = body;
      if (!host_id) {
        return new Response(JSON.stringify({ error: 'host_id is required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      try {
        const { results: matches } = await env.DB.prepare(
          `SELECT id, crew_id FROM gatherings WHERE host_id = ?`
        ).bind(host_id).all();

        if (!matches.length) {
          return new Response(JSON.stringify({ ok: true, gatherings_deleted: 0, crews_deleted: 0, registrations_deleted: 0 }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        const gatheringIds = matches.map(m => m.id);
        const crewIds = [...new Set(matches.map(m => m.crew_id).filter(id => id !== null))];
        const gPlaceholders = gatheringIds.map(() => '?').join(',');

        const regResult = await env.DB.prepare(
          `DELETE FROM registrations WHERE gathering_id IN (${gPlaceholders})`
        ).bind(...gatheringIds).run();

        const gathResult = await env.DB.prepare(
          `DELETE FROM gatherings WHERE id IN (${gPlaceholders})`
        ).bind(...gatheringIds).run();

        let crewsDeleted = 0;
        if (crewIds.length) {
          const cPlaceholders = crewIds.map(() => '?').join(',');
          const { results: stillUsed } = await env.DB.prepare(
            `SELECT DISTINCT crew_id FROM gatherings WHERE crew_id IN (${cPlaceholders})`
          ).bind(...crewIds).all();
          const stillUsedIds = new Set(stillUsed.map(r => r.crew_id));
          const safeToDeleteIds = crewIds.filter(id => !stillUsedIds.has(id));
          if (safeToDeleteIds.length) {
            const sPlaceholders = safeToDeleteIds.map(() => '?').join(',');
            await env.DB.prepare(`DELETE FROM crew_members WHERE crew_id IN (${sPlaceholders})`).bind(...safeToDeleteIds).run();
            const crewResult = await env.DB.prepare(`DELETE FROM crews WHERE id IN (${sPlaceholders})`).bind(...safeToDeleteIds).run();
            crewsDeleted = crewResult.meta.changes || 0;
          }
        }

        return new Response(JSON.stringify({
          ok: true,
          gatherings_deleted: gathResult.meta.changes || 0,
          crews_deleted: crewsDeleted,
          registrations_deleted: regResult.meta.changes || 0
        }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Database error purging all Gatherings: ' + String(e.message || e) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    // ============================================================
    // PHOTOS — Dev-54 test capture, D1-backed (env.DB) + R2-backed (env.PHOTOS_BUCKET)
    // Requires the PHOTOS_BUCKET R2 binding to exist on this Worker before these
    // routes will function — see BF_Operations_Guide.md setup note.
    // ============================================================

    // POST /photos/upload — accepts multipart/form-data, writes bytes to R2 and
    // a metadata row to D1. Body fields: pin, event_name, section, file, caption? (optional)
    // section must be one of: pre_competition | on_course | post_round
    // 25MB server-side cap regardless of what the client already checked — client-side
    // checks are a UX nicety, not a guarantee. media_type is inferred from file.type,
    // never trusted from the client directly. Response: { ok, id, r2_key, media_type }
    const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
    if (request.method === 'POST' && url.pathname === '/photos/upload') {
      let form;
      try { form = await request.formData(); } catch(e) {
        return new Response(JSON.stringify({ error: 'Invalid form data' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      const pin        = form.get('pin');
      const eventName  = form.get('event_name');
      const section    = form.get('section');
      const caption    = form.get('caption') || null;
      const capturedBy = form.get('captured_by') || null;
      const file       = form.get('file');

      if (String(pin) !== '7797') {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      if (!eventName || !section) {
        return new Response(JSON.stringify({ error: 'Missing event_name or section' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      if (!['pre_competition','on_course','post_round'].includes(section)) {
        return new Response(JSON.stringify({ error: 'section must be pre_competition, on_course, or post_round' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      if (!file || typeof file === 'string') {
        return new Response(JSON.stringify({ error: 'Missing file' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        return new Response(JSON.stringify({ error: `File too large (${(file.size/1024/1024).toFixed(1)}MB) — 25MB max. For video, keep clips under ~20 seconds.` }), { status: 413, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      if (!env.PHOTOS_BUCKET) {
        return new Response(JSON.stringify({ error: 'PHOTOS_BUCKET binding not configured on this Worker yet' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }

      const mediaType = (file.type || '').startsWith('video/') ? 'video' : 'image';
      const ext    = (file.name && file.name.includes('.')) ? file.name.split('.').pop().toLowerCase() : (mediaType === 'video' ? 'mp4' : 'jpg');
      const slug   = eventName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const key    = `photos/${slug}/${section}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;

      await env.PHOTOS_BUCKET.put(key, await file.arrayBuffer(), {
        httpMetadata: { contentType: file.type || (mediaType === 'video' ? 'video/mp4' : 'image/jpeg') }
      });

      const result = await env.DB.prepare(
        `INSERT INTO event_photos (event_name, section, r2_key, captured_by, caption, media_type)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(eventName, section, key, capturedBy, caption, mediaType).run();

      return new Response(JSON.stringify({ ok: true, id: result.meta.last_row_id, r2_key: key, media_type: mediaType }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // GET /photos?event=X&section=Y&status=Z&pin=W
    // Public callers (no pin) only ever see curation_status='approved', regardless
    // of what status= they pass — the filter is enforced server-side, not trusted
    // from the query string. Commissioner Admin passes pin to see pending/rejected too.
    if (request.method === 'GET' && url.pathname === '/photos') {
      const eventName = url.searchParams.get('event');
      const section    = url.searchParams.get('section');
      const pin        = url.searchParams.get('pin');
      const isAdmin     = String(pin) === '7797';
      const status      = isAdmin ? (url.searchParams.get('status') || null) : 'approved';

      let sql = `SELECT id, event_name, section, r2_key, media_type, captured_by, caption, is_trophy_moment, curation_status, sort_order, created_at FROM event_photos WHERE 1=1`;
      const binds = [];
      if (eventName) { sql += ` AND event_name = ?`; binds.push(eventName); }
      if (section)    { sql += ` AND section = ?`;    binds.push(section); }
      if (status)      { sql += ` AND curation_status = ?`; binds.push(status); }
      sql += ` ORDER BY section, sort_order IS NULL, sort_order, created_at`;

      const { results } = await env.DB.prepare(sql).bind(...binds).all();
      return new Response(JSON.stringify({ photos: results }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // DELETE /photos/:id — permanent removal (R2 object + D1 row). PIN required, query param
    // ?pin=7797. This is deliberately separate from PATCH curation_status='rejected' — reject
    // is reversible (can be flipped back to pending/approved), delete is not. No trash/undo.
    if (request.method === 'DELETE' && url.pathname.startsWith('/photos/')) {
      const photoId = url.pathname.split('/photos/')[1];
      const pin     = url.searchParams.get('pin');
      if (String(pin) !== '7797') {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      const row = await env.DB.prepare(`SELECT r2_key FROM event_photos WHERE id = ?`).bind(photoId).first();
      if (!row) {
        return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      if (env.PHOTOS_BUCKET) {
        await env.PHOTOS_BUCKET.delete(row.r2_key);
      }
      await env.DB.prepare(`DELETE FROM event_photos WHERE id = ?`).bind(photoId).run();
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // PATCH /photos/:id — curation actions (approve/reject/trophy toggle/reorder). PIN required.
    // Body: { pin, curation_status?, is_trophy_moment?, sort_order? }
    if (request.method === 'PATCH' && url.pathname.startsWith('/photos/')) {
      const photoId = url.pathname.split('/photos/')[1];
      let body;
      try { body = await request.json(); } catch(e) {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      if (String(body.pin) !== '7797') {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      const fields = [];
      const binds  = [];
      if (body.curation_status !== undefined) {
        if (!['pending','approved','rejected'].includes(body.curation_status)) {
          return new Response(JSON.stringify({ error: 'Invalid curation_status' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
        fields.push('curation_status = ?'); binds.push(body.curation_status);
      }
      if (body.is_trophy_moment !== undefined) { fields.push('is_trophy_moment = ?'); binds.push(body.is_trophy_moment ? 1 : 0); }
      if (body.sort_order !== undefined)        { fields.push('sort_order = ?');        binds.push(body.sort_order); }
      if (!fields.length) {
        return new Response(JSON.stringify({ error: 'No updatable fields provided' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      binds.push(photoId);
      await env.DB.prepare(`UPDATE event_photos SET ${fields.join(', ')} WHERE id = ?`).bind(...binds).run();
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // GET /photos/serve/:id — streams the actual image bytes from R2.
    // Unapproved photos are only servable with a valid pin (Commissioner Admin preview).
    if (request.method === 'GET' && url.pathname.startsWith('/photos/serve/')) {
      const photoId = url.pathname.split('/photos/serve/')[1];
      const pin     = url.searchParams.get('pin');
      const isAdmin = String(pin) === '7797';

      const row = await env.DB.prepare(`SELECT r2_key, curation_status FROM event_photos WHERE id = ?`).bind(photoId).first();
      if (!row) return new Response('Not found', { status: 404, headers: corsHeaders });
      if (row.curation_status !== 'approved' && !isAdmin) {
        return new Response('Not found', { status: 404, headers: corsHeaders });
      }
      if (!env.PHOTOS_BUCKET) {
        return new Response(JSON.stringify({ error: 'PHOTOS_BUCKET binding not configured on this Worker yet' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      const obj = await env.PHOTOS_BUCKET.get(row.r2_key);
      if (!obj) return new Response('Not found', { status: 404, headers: corsHeaders });
      return new Response(obj.body, {
        headers: { 'Content-Type': obj.httpMetadata?.contentType || 'image/jpeg', 'Cache-Control': 'public, max-age=3600', ...corsHeaders }
      });
    }

    // Shared path map used by /history, /rollback, and /deploy
    const FILE_PATHS = {
      portal:    'source/portal.html',
      guide:     'source/guide.html',
      worker:    'source/worker.js',
      golfscore: 'source/BF_Golf_Scorer_8.html',
      ops_guide: 'source/BF_Operations_Guide.md',
    };
    const GH_REPO    = 'birdiefriends/birdiefriends.github.io';
    const GH_BRANCH  = 'main';
    const ghHeaders  = {
      'Authorization': 'token ' + env.GH_TOKEN,
      'Accept':        'application/vnd.github.v3+json',
      'User-Agent':    'birdiefriends-worker',
    };

    // GET /history?file=<key>&n=<count> — commit history for a source file (no auth)
    if (request.method === 'GET' && url.pathname === '/history') {
      const fileKey = url.searchParams.get('file');
      const n       = Math.min(parseInt(url.searchParams.get('n') || '20', 10), 50);
      const ghPath  = FILE_PATHS[fileKey];
      if (!ghPath) {
        return new Response(JSON.stringify({ error: 'Unknown file key' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      const commitsUrl = `https://api.github.com/repos/${GH_REPO}/commits?path=${ghPath}&per_page=${n}&sha=${GH_BRANCH}`;
      const resp = await fetch(commitsUrl, { headers: ghHeaders });
      if (!resp.ok) {
        const errText = await resp.text();
        return new Response(JSON.stringify({ error: 'GitHub error', status: resp.status, detail: errText }), { status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      const commits = await resp.json();
      return new Response(JSON.stringify({
        commits: commits.map(c => ({
          sha:     c.sha,
          short:   c.sha.slice(0, 7),
          message: c.commit.message,
          date:    c.commit.committer.date,
        }))
      }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // POST /rollback — restore a source file to a prior commit SHA (PIN required)
    // Body: { pin, file: <key>, sha: <full commit SHA to restore> }
    // Response: { ok, newCommitSha } — creates a new forward commit with the old content
    if (request.method === 'POST' && url.pathname === '/rollback') {
      let body;
      try { body = await request.json(); } catch(e) {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      const { pin, file: fileKey, sha } = body;
      if (String(pin) !== '7797') {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      const ghPath = FILE_PATHS[fileKey];
      if (!ghPath || !sha) {
        return new Response(JSON.stringify({ error: 'Missing file or sha' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      const contentsUrl = `https://api.github.com/repos/${GH_REPO}/contents/${ghPath}`;

      // 1. Fetch file content at the target SHA
      const atShaResp = await fetch(`${contentsUrl}?ref=${sha}`, { headers: ghHeaders });
      if (!atShaResp.ok) {
        return new Response(JSON.stringify({ error: 'Could not fetch file at target SHA', status: atShaResp.status }), { status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      const atShaData = await atShaResp.json();
      // GitHub returns base64 with embedded newlines — strip them before re-PUT
      const restoredContent = (atShaData.content || '').replace(/\n/g, '');

      // 2. Get current SHA on main (required for the PUT)
      const currentResp = await fetch(`${contentsUrl}?ref=${GH_BRANCH}`, { headers: ghHeaders });
      if (!currentResp.ok) {
        return new Response(JSON.stringify({ error: 'Could not fetch current file SHA' }), { status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      const currentData  = await currentResp.json();
      const currentSha   = currentData.sha;

      // 3. Push old content as a new forward commit
      const putResp = await fetch(contentsUrl, {
        method: 'PUT',
        headers: { ...ghHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Rollback ${ghPath} to ${sha.slice(0, 7)}`,
          content: restoredContent,
          sha:     currentSha,
          branch:  GH_BRANCH,
        }),
      });
      const putData = await putResp.json();
      if (putResp.status !== 200 && putResp.status !== 201) {
        return new Response(JSON.stringify({ error: 'GitHub commit failed', status: putResp.status, detail: putData }), { status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      return new Response(JSON.stringify({ ok: true, newCommitSha: putData.commit.sha }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // POST /deploy — push arbitrary content to a source/ or docs/ file in GitHub (PIN required)
    // Body: { pin, path: "source/<file>" or "docs/<file>", content: "<file contents>", message: "<commit msg>" }
    // path must start with "source/" or "docs/" (enforced server-side)  VERSION: 2026-06-18b
    // Handles both new-file creation (no sha) and existing-file updates (fetches current sha)
    // Response: { ok, commitSha }
    if (request.method === 'POST' && url.pathname === '/deploy') {
      let body;
      try { body = await request.json(); } catch(e) {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      const { pin, path: ghPath, content, message } = body;
      if (String(pin) !== '7797') {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      if (!ghPath || (!ghPath.startsWith('source/') && !ghPath.startsWith('docs/'))) {
        return new Response(JSON.stringify({ error: 'path must start with source/ or docs/' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      if (!content) {
        return new Response(JSON.stringify({ error: 'Missing content' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }

      const contentsUrl = `https://api.github.com/repos/${GH_REPO}/contents/${ghPath}`;

      // Encode content as base64
      const encoded = btoa(unescape(encodeURIComponent(content)));

      // Try to get current file SHA (needed for updates; omit for new files)
      let currentSha;
      const currentResp = await fetch(`${contentsUrl}?ref=${GH_BRANCH}`, { headers: ghHeaders });
      if (currentResp.ok) {
        const currentData = await currentResp.json();
        currentSha = currentData.sha;
      } else if (currentResp.status !== 404) {
        const errText = await currentResp.text();
        return new Response(JSON.stringify({ error: 'GitHub error fetching current SHA', status: currentResp.status, detail: errText }), { status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      // 404 = new file, currentSha stays undefined — omit sha from PUT body

      const putBody = {
        message: message || `Deploy ${ghPath}`,
        content: encoded,
        branch:  GH_BRANCH,
      };
      if (currentSha) putBody.sha = currentSha;

      const putResp = await fetch(contentsUrl, {
        method: 'PUT',
        headers: { ...ghHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(putBody),
      });
      const putData = await putResp.json();
      if (putResp.status !== 200 && putResp.status !== 201) {
        return new Response(JSON.stringify({ error: 'GitHub commit failed', status: putResp.status, detail: putData }), { status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      return new Response(JSON.stringify({ ok: true, commitSha: putData.commit.sha }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // GET /subscriptions — fetch all push subscribers
    if (request.method === 'GET' && url.pathname === '/subscriptions') {
      const appId = url.searchParams.get('app_id');
      const osUrl = `https://api.onesignal.com/players?app_id=${appId}&limit=300`;
      const osResp = await fetch(osUrl, {
        headers: { 'Authorization': 'Key ' + env.OS_REST_KEY, 'Accept': 'application/json' }
      });
      const data = await osResp.json();
      return new Response(JSON.stringify(data), {
        status: osResp.status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // GET /notifications — fetch sent notification history
    if (request.method === 'GET' && url.pathname === '/notifications') {
      const appId = url.searchParams.get('app_id');
      const limit = url.searchParams.get('limit') || '50';
      const osUrl = `https://api.onesignal.com/notifications?app_id=${appId}&limit=${limit}&kind=1`;
      const osResp = await fetch(osUrl, {
        headers: { 'Authorization': 'Key ' + env.OS_REST_KEY, 'Accept': 'application/json' }
      });
      const data = await osResp.json();
      return new Response(JSON.stringify(data), {
        status: osResp.status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // GET /members/:player_id/prefs — fetch Tier-2 preferences from member_preferences D1 table
    if (request.method === 'GET' && /^\/members\/[^/]+\/prefs$/.test(url.pathname)) {
      const playerId = decodeURIComponent(url.pathname.split('/')[2]);
      try {
        const row = await env.DB.prepare(`SELECT prefs FROM member_preferences WHERE player_id = ?`).bind(playerId).first();
        const prefs = row ? JSON.parse(row.prefs) : {};
        return new Response(JSON.stringify({ ok: true, player_id: playerId, prefs }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch(e) {
        return new Response(JSON.stringify({ error: 'Database error fetching prefs' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    // PUT /members/:player_id/prefs — upsert Tier-2 preferences (player-scoped, no PIN)
    if (request.method === 'PUT' && /^\/members\/[^/]+\/prefs$/.test(url.pathname)) {
      const playerId = decodeURIComponent(url.pathname.split('/')[2]);
      let body;
      try { body = await request.json(); } catch(e) {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      const { prefs } = body;
      if (typeof prefs !== 'object' || prefs === null || Array.isArray(prefs)) {
        return new Response(JSON.stringify({ error: 'prefs must be a plain object' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      try {
        await env.DB.prepare(
          `INSERT INTO member_preferences (player_id, prefs, updated_at) VALUES (?, ?, datetime('now'))
           ON CONFLICT (player_id) DO UPDATE SET prefs = excluded.prefs, updated_at = excluded.updated_at`
        ).bind(playerId, JSON.stringify(prefs)).run();
        return new Response(JSON.stringify({ ok: true, player_id: playerId, prefs }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch(e) {
        return new Response(JSON.stringify({ error: 'Database error saving prefs' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
    }

    // GET /feed — read KV announcement feed, newest-first, max 50
    if (request.method === 'GET' && url.pathname === '/feed') {
      const list = await env.BF_FLAGS.list({ prefix: 'feed::' });
      const entries = await Promise.all(
        list.keys.map(async k => {
          const val = await env.BF_FLAGS.get(k.name);
          try { return JSON.parse(val); } catch(e) { return null; }
        })
      );
      const feed = entries
        .filter(Boolean)
        .sort((a, b) => b.sentAt - a.sentAt)
        .slice(0, 50);
      return new Response(JSON.stringify({ feed }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // DELETE /feed — clear feed entries (PIN required)
    // Body: { pin }         → clear all entries
    // Body: { pin, key }    → clear one entry by KV key (e.g. "feed::1748880000000")
    if (request.method === 'DELETE' && url.pathname === '/feed') {
      let body;
      try { body = await request.json(); } catch(e) {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      if (String(body.pin) !== '7797') {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      if (body.key) {
        // Delete single entry
        await env.BF_FLAGS.delete(body.key);
        return new Response(JSON.stringify({ ok: true, deleted: 1 }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } else {
        // Delete all feed entries
        const list = await env.BF_FLAGS.list({ prefix: 'feed::' });
        await Promise.all(list.keys.map(k => env.BF_FLAGS.delete(k.name)));
        return new Response(JSON.stringify({ ok: true, deleted: list.keys.length }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // POST / — send a notification
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    let payload;
    try {
      payload = await request.json();
    } catch(e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    delete payload.api_key;

    // feed_only: true — skip OneSignal, write directly to KV feed.
    // Used when invited players have no push subscriptions but still need
    // to see the announcement when they open the portal.
    if (payload.feed_only) {
      const sentAt  = Date.now();
      const kvKey   = `feed::${sentAt}`;
      const title   = (payload.headings && (payload.headings.en || Object.values(payload.headings)[0])) || '';
      const body    = (payload.contents && (payload.contents.en || Object.values(payload.contents)[0])) || '';
      const type    = payload.bf_type || 'broadcast';
      const meta    = payload.bf_meta || null;
      const entry   = { id: `feed-${sentAt}`, key: kvKey, title, body, sentAt, type, meta };
      await env.BF_FLAGS.put(kvKey, JSON.stringify(entry));
      return new Response(JSON.stringify({ ok: true, feedKey: kvKey, recipients: 0 }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const osResp = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Key ' + env.OS_REST_KEY },
      body: JSON.stringify(payload),
    });

    const data = await osResp.json();

    // Write to KV feed on successful send
    let feedKey;
    if (osResp.status === 200 && data.id) {
      const sentAt  = Date.now();
      const kvKey   = `feed::${sentAt}`;
      feedKey       = kvKey;
      const title   = (payload.headings   && (payload.headings.en   || Object.values(payload.headings)[0]))   || '';
      const body    = (payload.contents   && (payload.contents.en   || Object.values(payload.contents)[0]))   || '';
      const type    = payload.bf_type || 'broadcast'; // portal sets bf_type; default broadcast
      const meta    = payload.bf_meta || null;        // optional structured data, e.g. { hole, player, scoreType }
      const entry   = { id: data.id, key: kvKey, title, body, sentAt, type, meta };
      await env.BF_FLAGS.put(kvKey, JSON.stringify(entry));

      // Prune entries older than 48 hours
      const cutoff  = sentAt - 48 * 60 * 60 * 1000;
      const allKeys = await env.BF_FLAGS.list({ prefix: 'feed::' });
      await Promise.all(
        allKeys.keys
          .filter(k => {
            const ts = parseInt(k.name.replace('feed::', ''), 10);
            return ts < cutoff;
          })
          .map(k => env.BF_FLAGS.delete(k.name))
      );
    }

    return new Response(JSON.stringify({ ...data, feedKey }), {
      status: osResp.status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
};
