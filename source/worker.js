export default {
  async fetch(request, env) {

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
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
      const keys = ['maintenance', 'live_test', 'live_override', 'live_override_since'];
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
      const allowed = ['maintenance', 'live_test', 'live_override'];
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
