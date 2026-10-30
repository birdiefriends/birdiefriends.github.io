/* BF Live Match panel (Dev-95). A re-usable match-play scoring panel for any BFE that has a "match" structure
   (the BF Cup today; any host's team or head-to-head event later). It is config-driven, not Cup-specific:
     - what is played where comes from cfg.rounds[].segments (format + hole range) and cfg.rounds[].matches
     - handicap strokes come from the engine (BFEngine.cupMatchStrokes / cupHoleStrokes) and cfg.handicap.strokeIndex
     - look comes from CSS tokens (--lm-*) so a host theme can re-skin it without touching the code
     - side games (skins, CTP, ...) plug in through opts.sections(ctx) which returns extra HTML under the hole entry
   Scores are posted one hole at a time and queued in localStorage when the signal is bad.
   Usage: BFLiveMatch.mount(el, { E, getCfg, worker, event, player, code, pin, sections, onChange }) ; BFLiveMatch.refresh() */
(function (root) {
  'use strict';
  var CSS = '' +
    '.lm{--a:var(--lm-a,#d6203a);--b:var(--lm-b,#2f6fe0);--bg:var(--lm-card,#10306a);--bg2:var(--lm-card2,#183f82);--tx:var(--lm-text,#fff);--dim:var(--lm-dim,rgba(255,255,255,.68));--line:var(--lm-line,rgba(255,255,255,.16));--good:var(--lm-good,#7fd69a);--warn:var(--lm-warn,#ffd36b);--ink:var(--lm-ink,#0a1f44);color:var(--tx)}' +
    '.lm *{box-sizing:border-box}' +
    '.lm .lmc{background:var(--bg);border:1px solid var(--line);border-radius:12px;padding:12px;margin:10px 0}' +
    '.lm .lmbar{display:grid;grid-template-columns:1fr;gap:8px;margin:6px 0}.lm .lmbar label{display:block;font-size:.72rem;letter-spacing:.06em;text-transform:uppercase;color:var(--dim)}.lm .lmbar select{display:block;width:100%;margin-top:3px;background:var(--bg2);color:var(--tx);border:1px solid var(--line);border-radius:10px;padding:11px;font:inherit;font-size:.95rem;text-transform:none;letter-spacing:0}' +
    '.lm .lmtabs{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0}' +
    '.lm .lmtab{background:var(--bg2);color:var(--tx);border:1px solid var(--line);border-radius:10px;padding:8px 10px;font:inherit;font-size:.85rem;cursor:pointer;text-align:left}' +
    '.lm .lmtab.on{border-color:var(--tx);box-shadow:0 0 0 1px var(--tx)}.lm .lmtab small{display:block;color:var(--dim)}' +
    '.lm .lmhead{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center;text-align:center}' +
    '.lm .lmside{border-radius:10px;padding:8px 6px;font-weight:700;border-top:5px solid var(--line);background:var(--bg2)}' +
    '.lm .lmside.a{border-top-color:var(--a)}.lm .lmside.b{border-top-color:var(--b)}.lm .lmside.lead.a{background:var(--a)}.lm .lmside.lead.b{background:var(--b)}' +
    '.lm .lmpn{display:block;font-size:1.05rem;line-height:1.25}.lm .lmside small{margin-top:3px;display:block;font-weight:500;color:var(--dim);font-size:.75rem}.lm .lmside.lead small{color:var(--tx)}' +
    '.lm .lmstat{font-weight:800;font-size:1.05rem;min-width:84px}.lm .lmstat small{display:block;font-weight:500;color:var(--dim);font-size:.72rem}' +
    '.lm .lmholes{display:grid;grid-template-columns:repeat(9,1fr);gap:4px;margin:10px 0}' +
    '.lm .lmh{border:1px solid var(--line);background:var(--bg2);color:var(--tx);border-radius:7px;padding:6px 0;font:inherit;font-size:.78rem;font-weight:700;cursor:pointer;text-align:center}' +
    '.lm .lmh.a{background:var(--a)}.lm .lmh.b{background:var(--b)}.lm .lmh.h{background:var(--dim);color:var(--ink)}.lm .lmh.cur{outline:2px solid var(--tx);outline-offset:1px}.lm .lmh.seg{border-left:3px solid var(--tx)}' +
    '.lm .lmrow{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;padding:8px 0;border-top:1px solid var(--line)}' +
    '.lm .lmrow:first-of-type{border-top:0}.lm .lmname{font-weight:700}.lm .lmname small{display:block;font-weight:500;color:var(--dim)}' +
    '.lm .lmname.a{border-left:4px solid var(--a);padding-left:8px}.lm .lmname.b{border-left:4px solid var(--b);padding-left:8px}' +
    '.lm .lmstep{display:flex;align-items:center;gap:6px}.lm .lmstep button{width:46px;height:46px;border-radius:10px;border:1px solid var(--line);background:var(--bg2);color:var(--tx);font:inherit;font-size:1.4rem;font-weight:800;cursor:pointer}' +
    '.lm .lmval{min-width:44px;text-align:center;font-size:1.6rem;font-weight:800}.lm .lmval.pu{font-size:1rem;color:var(--warn)}' +
    '.lm .lmtiles{display:grid;grid-template-columns:repeat(9,1fr);gap:4px;grid-column:1/-1}.lm .lmt{height:42px;border-radius:9px;border:1px solid var(--line);background:var(--bg2);color:var(--tx);font:inherit;font-weight:800;font-size:1.05rem;cursor:pointer;padding:0}.lm .lmt.on{background:var(--lm-accent,var(--a));border-color:var(--tx)}.lm .lmt.pu.on{background:var(--warn);color:var(--ink)}.lm .lmt.sub{font-size:.75rem;color:var(--dim)}' +
    '.lm .lmnav{display:grid;grid-template-columns:52px 1fr 52px;gap:8px;align-items:center;margin:4px 0 8px}.lm .lmarrow{height:48px;border-radius:10px;border:1px solid var(--line);background:var(--bg2);color:var(--tx);font:inherit;font-size:1.6rem;font-weight:800;cursor:pointer}.lm .lmarrow:disabled{opacity:.3}' +
    '.lm .lmhtitle{background:none;border:0;color:var(--tx);font:inherit;font-weight:800;font-size:1.35rem;cursor:pointer;text-align:center}.lm .lmhtitle small{display:block;font-weight:500;font-size:.72rem;color:var(--dim)}' +
    '.lm .lmwin{display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--dim)}.lm .lmwin.a{background:var(--a)}.lm .lmwin.b{background:var(--b)}' +
    '.lm .lmchips{display:grid;grid-template-columns:1fr 1fr;gap:8px}.lm .lmchip{display:flex;justify-content:space-between;align-items:center;gap:6px;background:var(--bg2);color:var(--tx);border:2px solid var(--line);border-left:6px solid var(--line);border-radius:10px;padding:10px;font:inherit;font-weight:700;cursor:pointer;text-align:left}' +
    '.lm .lmchip.a{border-left-color:var(--a)}.lm .lmchip.b{border-left-color:var(--b)}.lm .lmchip.sel{border-color:var(--tx)}.lm .lmchip small{display:block;font-weight:500;color:var(--dim);font-size:.7rem}' +
    '.lm .lmcv{font-size:1.7rem;font-weight:800;min-width:30px;text-align:right}.lm .lmcv.pu{color:var(--warn)}.lm .lmpick{margin:10px 0 2px}' +
    '.lm .lmbm{display:block;width:100%;background:var(--bg2);color:var(--tx);border:1px solid var(--line);border-radius:12px;padding:0;margin-top:10px;font:inherit;text-align:left;overflow:hidden}.lm .lmbmt{display:block;width:100%;background:none;color:inherit;border:0;font:inherit;text-align:left;padding:10px 10px 8px;cursor:pointer}' +
    '.lm .lmbmh{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center;font-weight:800;margin-bottom:8px}.lm .lmbmh .a{border-left:4px solid var(--a);padding-left:8px}.lm .lmbmh .b{text-align:right;border-right:4px solid var(--b);padding-right:8px}.lm .lmbmh .pt{font-size:1.15rem;text-align:center;min-width:62px;white-space:nowrap}.lm .lmbmh .pt .a,.lm .lmbmh .pt .b{border:0;padding:0}.lm .lmbmh .pt .a{color:var(--a)}.lm .lmbmh .pt .b{color:var(--b)}' +
    '.lm .lmpr{display:grid;grid-template-columns:1fr auto 1fr;gap:4px;align-items:stretch;margin-top:4px;font-size:.86rem}.lm .lmpr .mid{display:flex;align-items:center;justify-content:center;text-align:center;line-height:1.3;color:var(--dim);font-size:.74rem;padding:0 6px;min-width:96px}.lm .lmpr .c{display:flex;align-items:center;padding:7px 9px;border-radius:8px;font-weight:800;border:1px solid transparent;min-height:34px}.lm .lmpr .c.l{justify-content:flex-start}.lm .lmpr .c.r{justify-content:flex-end;text-align:right}' +
    '.lm .lmpr .c.a.win{background:var(--a);color:#fff}.lm .lmpr .c.b.win{background:var(--b);color:#fff}.lm .lmpr .c.a.up{border-color:var(--a);color:var(--a)}.lm .lmpr .c.b.up{border-color:var(--b);color:var(--b)}.lm .lmpr .mid.half{color:var(--tx);font-weight:800}' +
    '.lm .lmcar{display:flex;justify-content:center;color:var(--dim);font-size:.78rem;padding:3px 0 6px}' +
    '.lm .lmscw{padding:2px 10px 10px;border-top:1px solid var(--line)}.lm .lmsct{margin:8px 0 2px;font-size:.72rem;letter-spacing:.06em;text-transform:uppercase;color:var(--dim)}' +
    '.lm table.lmsc{width:100%;border-collapse:collapse;table-layout:fixed;font-size:.78rem;text-align:center}.lm .lmsc th,.lm .lmsc td{padding:4px 0;border-bottom:1px solid var(--line)}.lm .lmsc th{color:var(--dim);font-weight:600}.lm .lmsc td.nm,.lm .lmsc th.nm{width:27%;text-align:left;padding-left:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:700}' +
    '.lm .lmsc td.nm.a{border-left:3px solid var(--a)}.lm .lmsc td.nm.b{border-left:3px solid var(--b)}.lm .lmsc td.tt,.lm .lmsc th.tt{font-weight:800;width:11%}.lm .lmsc tr.mr td{font-weight:800;border-bottom:0}.lm .lmsc td.a{color:var(--a)}.lm .lmsc td.b{color:var(--b)}.lm .lmsc td.nm.a,.lm .lmsc td.nm.b{color:var(--tx)}' +
    '.lm .lmcir,.lm .lmsq{display:inline-block;min-width:1.55em;line-height:1.55em;border:1.5px solid var(--tx);position:relative}.lm .lmcir{border-radius:50%}.lm .lmsq{border-radius:3px}.lm .lmcir.d,.lm .lmsq.d{box-shadow:0 0 0 2px var(--bg2),0 0 0 3.5px var(--tx)}' +
    '.lm .lmsc sup{color:var(--warn);font-size:.9em;margin-left:1px}.lm .lmsc .pk{color:var(--warn)}' +
    '.lm .lmgo2{display:block;width:100%;margin-top:8px;padding:10px;border-radius:10px;border:1px solid var(--line);background:none;color:var(--tx);font:inherit;font-weight:700;cursor:pointer}' +
    '.lm .lmbs{display:flex;justify-content:space-between;gap:8px;padding:4px 0;border-top:1px solid var(--line);font-size:.88rem}.lm .lmbs b.a{color:var(--a)}.lm .lmbs b.b{color:var(--b)}' +
    '.lm .lmmno{font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;color:var(--dim);margin-bottom:6px}' +
    '.lm .lmpu{width:auto!important;padding:0 8px;font-size:.78rem!important}.lm .lmpu.on{background:var(--warn)!important;color:var(--ink)!important}' +
    '.lm .lmgo{width:100%;padding:13px;border-radius:10px;border:0;background:var(--lm-accent,var(--a));color:#fff;font:inherit;font-weight:800;font-size:1rem;cursor:pointer;margin-top:8px}.lm .lmgo:disabled{opacity:.45}' +
    '.lm .lmsec{background:var(--bg2);color:var(--tx);border:1px solid var(--line);border-radius:10px;padding:9px 12px;font:inherit;font-weight:700;cursor:pointer}' +
    '.lm .lmmsg{margin:8px 0;padding:8px 10px;border-radius:9px;background:var(--bg2);font-weight:600;font-size:.9rem}.lm .lmmsg.q{background:var(--warn);color:var(--ink)}.lm .lmmsg.ok{background:#1a7f3c;color:#fff}' +
    '.lm .lmdim{color:var(--dim);font-size:.82rem}.lm .lmdots{letter-spacing:3px;color:var(--warn);font-size:1.15rem;line-height:1;margin-left:10px;display:inline-block;vertical-align:middle}' +
    '.lm .lmboard{display:grid;grid-template-columns:1fr auto 1fr;gap:6px;align-items:center;text-align:center;font-weight:800}.lm .lmboard .big{font-size:1.9rem}' +
    '.lm .lmml{display:grid;grid-template-columns:1fr auto;gap:6px;padding:6px 0;border-top:1px solid var(--line);font-size:.88rem}';

  var S = null;          // module state
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function norm(s) { return String(s == null ? '' : s).trim().toLowerCase(); }
  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage can be blocked */ } }

  function groupsOf(cfg) {                                  // the foursomes: each has a round and the matches it plays (BFEngine.cupGroupsOf)
    var out = [];
    (cfg.rounds || []).forEach(function (r) {
      S.opts.E.cupGroupsOf(r).forEach(function (g) {
        var ms = g.matches.filter(function (m) { return m.sides && m.sides.length === 2 && m.sides.every(function (sd) { return sd.players && sd.players.length; }); });
        if (ms.length) out.push({ round: r, key: g.key, matches: ms });
      });
    });
    return out;
  }
  function mineG(g, player) { return g.matches.some(function (m) { return mine(m, player); }); }
  function sideName(cfg, key) { var s = (cfg.sides || []).filter(function (x) { return x.key === key; })[0]; return s ? (s.name || key) : key; }
  function entryOf(cfg, rk, mk) { return ((cfg.scores || {})[rk] || {})[mk] || null; }
  function mine(m, player) { return !!player && m.sides.some(function (s) { return s.players.some(function (p) { return norm(p) === norm(player); }); }); }

  function pendingKey() { return 'bf_lm_q_' + S.opts.event; }
  function queue() { return lsGet(pendingKey()) || []; }
  function setQueue(q) { lsSet(pendingKey(), q); }

  function applyLocal(cfg, post) {                          // optimistic: show the score at once, the server confirms later
    cfg.scores = cfg.scores || {}; var r = cfg.scores[post.round] = cfg.scores[post.round] || {}; var e = r[post.match] = r[post.match] || { h: {}, t: {}, by: {} };
    e.h[String(post.hole)] = post.scores; e.t[String(post.hole)] = post.at; e.by[String(post.hole)] = post.player || '';
  }
  function flush() {
    if (!S || S.flushing) return; var q = queue(); if (!q.length) return; S.flushing = true;
    var post = q[0];
    fetch(S.opts.worker + '/bfe/cup/act', { method: 'POST', body: JSON.stringify({ event_name: S.opts.event, action: 'score', round: post.round, match: post.match, hole: post.hole, scores: post.scores, player: post.player, code: S.opts.code || undefined, pin: S.opts.pin || undefined }) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j, status: r.status }; }); })
      .then(function (x) {
        if (x.ok || (x.status >= 400 && x.status < 500)) { var qq = queue(); qq.shift(); setQueue(qq); if (!x.ok) { S.err = 'Hole ' + post.hole + ' was NOT saved: ' + (x.j.error || x.status) + '. Pick your name at the top and enter it again.'; var c0 = S.opts.getCfg(); try { delete c0.scores[post.round][post.match].h[String(post.hole)]; } catch (e) { /* nothing local to undo */ } } else if (x.j.config) { var c = S.opts.getCfg(); if (c) { c.phases = x.j.config.phases; mergeServer(c, x.j.config.scores); } } }
        S.flushing = false; render(); if (queue().length) flush();
      })
      .catch(function () { S.flushing = false; render(); });   // offline: leave it queued, the timer retries
  }
  function mergeServer(cfg, serverScores) {                 // server wins, but keep holes still waiting in the queue
    var keep = queue(); cfg.scores = JSON.parse(JSON.stringify(serverScores || {}));
    keep.forEach(function (p) { applyLocal(cfg, p); });
  }

  function stat(cfg, round, match, hole) {                  // strokes the players / teams get on this hole, and who is entering what
    var E = S.opts.E, rule = E.cupHandicapRule(cfg), hc = E.cupHcpMap(cfg);
    var st = E.cupMatchStrokes(match, hc, rule), seg = E.cupSegmentAt(round, hole), fmt = seg ? seg.format : 'bestball';
    var rows = [];
    // each player (or pair) places his strokes with the hole stroke indexes of HIS tee (tee by handicap); a one-tee Cup uses the Cup's tee
    function dots(n, names) { var a = E.cupHoleStrokes(n, E.cupStrokeIndexFor(cfg, names) || [])[hole - 1]; return a || 0; }
    if (fmt === 'altshot') {
      match.sides.forEach(function (sd, i) { rows.push({ key: sd.players[0], label: sideName(cfg, sd.side), sub: sd.players.join(' & '), side: i === 0 ? 'a' : 'b', strokes: dots(st.teams[i] ? st.teams[i].strokes : 0, sd.players) }); });
    } else {
      match.sides.forEach(function (sd, i) { sd.players.forEach(function (p) { var rw = st.players.filter(function (x) { return norm(x.names[0]) === norm(p); })[0]; rows.push({ key: p, label: p, sub: '', side: i === 0 ? 'a' : 'b', strokes: dots(rw ? rw.strokes : 0, [p]) }); }); });
    }
    var everyone = [].concat.apply([], match.sides.map(function (sd) { return sd.players; }));
    return { fmt: fmt, rows: rows, hasSI: everyone.some(function (p) { return !!E.cupStrokeIndexFor(cfg, [p]); }) };
  }

  var FMT = { bestball: 'Fourball', altshot: 'Foursomes', singles: 'Singles' };

  function holeWinner(live, h) {                            // 'a' | 'b' | 'h' | '' for the hole strip
    for (var i = 0; i < live.segments.length; i++) {
      var sg = live.segments[i]; if (h < sg.from || h > sg.to) continue;
      var x = sg.nets[0][h - 1], y = sg.nets[1][h - 1]; if (x == null || y == null) return '';
      return x < y ? 'a' : (x > y ? 'b' : 'h');
    }
    return '';
  }
  function statusLine(cfg, live, match) {                   // headline: who is up in the segment in play
    var seg = null; live.segments.forEach(function (sg) { if (!seg && !sg.state.decided) seg = sg; }); if (!seg) seg = live.segments[live.segments.length - 1];
    if (!seg) return { text: '', sub: '' };
    var st = seg.state, a = match.sides[0].side, b = match.sides[1].side, t = st.text;
    if (st.status === 'won') return { text: sideName(cfg, st.winner === 0 ? a : b) + ' ' + t, sub: FMT[seg.format] + ' · closed' };
    if (st.status === 'push') return { text: 'Halved', sub: FMT[seg.format] };
    if (st.thru === 0) return { text: 'Not started', sub: FMT[seg.format] + ' · holes ' + seg.from + '–' + seg.to };
    return { text: st.lead === 0 ? 'All square' : sideName(cfg, st.lead > 0 ? a : b) + ' ' + Math.abs(st.lead) + ' UP', sub: FMT[seg.format] + ' · thru ' + st.thru };
  }
  function oneLine(cfg, round, match) {
    var live = S.opts.E.cupMatchLive(cfg, round, match, entryOf(cfg, round.key, match.key)); var sl = statusLine(cfg, live, match);
    var segs = live.segments.filter(function (s) { return s.state.decided; }).map(function (s) { return s.state.status === 'won' ? sideName(cfg, match.sides[s.state.winner].side) + ' ' + s.state.text : 'Halved'; });
    return { live: live, text: sl.text, extra: segs.join(' · ') };
  }

  function rowVal(key, inp, posted) {                       // typed this visit, else what is already posted, else nothing (no default par)
    if (inp[key] !== undefined) return inp[key];
    if (posted) { var k = Object.keys(posted).filter(function (x) { return norm(x) === norm(key); })[0]; if (k !== undefined) return posted[k]; }
    return undefined;
  }

  // The leaderboard view: the points race and every match with both of its parts (Fourball / Foursomes), one record, one renderer.
  function groupTag(all, rk, mk) {                           // " · Group 2" when two matches share a foursome
    var g = all.filter(function (x) { return x.round.key === rk && x.matches.some(function (m) { return m.key === mk; }); })[0];
    return g && g.matches.length > 1 ? ' · Group ' + g.key.slice(1) : '';
  }
  // ---- pars: from the Cup's saved tee (cfg.handicap.pars); older Cups fetch them once from the Venue Manager. Never guessed.
  function parsOf(cfg) {
    var h = cfg.handicap || {};
    if (Array.isArray(h.pars) && h.pars.length === 18 && h.pars.every(function (n) { return Number(n) >= 3 && Number(n) <= 6; })) return h.pars.map(Number);
    if (S.pars) return S.pars;
    if (h.venueId && h.tee && !S.parsTried) {
      S.parsTried = true;
      fetch(S.opts.worker + '/bfe/venue-tees?venue_id=' + encodeURIComponent(h.venueId)).then(function (r) { return r.json(); }).then(function (j) {
        var t = (j.tees || []).filter(function (x) { return x.tee_name === h.tee; })[0], pr = t && (t.holes || []).map(function (x) { return Number(x.par); });
        if (pr && pr.length === 18 && pr.every(function (n) { return n >= 3 && n <= 6; })) { S.pars = pr; render(); }
      }).catch(function () { /* no pars: the card shows plain numbers */ });
    }
    return null;
  }
  function shortName(n) { var p = String(n).trim().split(/\s+/); return p.length > 1 ? p[0] + ' ' + p[p.length - 1].charAt(0) + '.' : p[0]; }
  function grossAt(entry, name, hole) {
    var hh = entry && entry.h && entry.h[String(hole)]; if (!hh) return undefined;
    var k = Object.keys(hh).filter(function (x) { return norm(x) === norm(name); })[0]; return k === undefined ? undefined : hh[k];
  }
  function mark(g, par) {                                    // birdie = circle, bogey = square, eagle / double bogey = double
    if (g === 0) return '<span class="pk">P</span>';
    if (!par) return String(g);
    if (g <= par - 2) return '<span class="lmcir d">' + g + '</span>';
    if (g === par - 1) return '<span class="lmcir">' + g + '</span>';
    if (g === par + 1) return '<span class="lmsq">' + g + '</span>';
    if (g >= par + 2) return '<span class="lmsq d">' + g + '</span>';
    return String(g);
  }
  function scorecardHtml(cfg, round, match) {                // the real card for one match, one table per part (Fourball / Foursomes) and per nine
    var E = S.opts.E, entry = entryOf(cfg, round.key, match.key), live = E.cupMatchLive(cfg, round, match, entry), pars = parsOf(cfg), h = '<div class="lmscw">';
    live.segments.forEach(function (sg) {
      var spans = []; for (var a = sg.from; a <= sg.to;) { var b = Math.min(sg.to, a <= 9 ? 9 : 18); spans.push([a, b]); a = b + 1; }
      spans.forEach(function (sp) {
        var holes = []; for (var x = sp[0]; x <= sp[1]; x++) holes.push(x);
        var tot = sp[0] === 1 && sp[1] === 9 ? 'Out' : sp[0] === 10 && sp[1] === 18 ? 'In' : 'Tot';
        h += '<div class="lmsct">' + FMT[sg.format] + ' · holes ' + sp[0] + '–' + sp[1] + '</div><table class="lmsc"><thead><tr><th class="nm"></th>' + holes.map(function (n) { return '<th>' + n + '</th>'; }).join('') + '<th class="tt">' + tot + '</th></tr>' +
          (pars ? '<tr><th class="nm">Par</th>' + holes.map(function (n) { return '<th>' + pars[n - 1] + '</th>'; }).join('') + '<th class="tt">' + holes.reduce(function (t, n) { return t + pars[n - 1]; }, 0) + '</th></tr>' : '') + '</thead><tbody>';
        var lines = [];                                       // one line per player (team in foursomes)
        match.sides.forEach(function (sd, i) {
          if (sg.format === 'altshot') lines.push({ key: sd.players[0], label: sd.players.map(shortName).join(' / '), side: i === 0 ? 'a' : 'b' });
          else sd.players.forEach(function (p) { lines.push({ key: p, label: shortName(p), side: i === 0 ? 'a' : 'b' }); });
        });
        lines.forEach(function (ln) {
          var sum = 0, any = false;
          h += '<tr><td class="nm ' + ln.side + '">' + esc(ln.label) + '</td>' + holes.map(function (n) {
            var g = grossAt(entry, ln.key, n); if (g === undefined) return '<td></td>';
            var st = stat(cfg, round, match, n).rows.filter(function (r) { return r.key === ln.key; })[0];
            if (g > 0) { sum += g; any = true; }
            return '<td>' + mark(g, pars && pars[n - 1]) + (st && st.strokes ? '<sup>' + '•'.repeat(st.strokes) + '</sup>' : '') + '</td>'; }).join('') + '<td class="tt">' + (any ? sum : '') + '</td></tr>';
        });
        var lead = 0, over = false;                           // running match status after each hole; blank once the match is mathematically over
        for (var y = sg.from; y < sp[0]; y++) { var p0 = sg.nets[0][y - 1], q0 = sg.nets[1][y - 1]; if (p0 != null && q0 != null) { lead += p0 < q0 ? 1 : p0 > q0 ? -1 : 0; if (Math.abs(lead) > sg.to - y) over = true; } }
        h += '<tr class="mr"><td class="nm">Match</td>' + holes.map(function (n) {
          var p1 = sg.nets[0][n - 1], q1 = sg.nets[1][n - 1]; if (over || p1 == null || q1 == null) return '<td></td>';
          lead += p1 < q1 ? 1 : p1 > q1 ? -1 : 0; if (Math.abs(lead) > sg.to - n) over = true;
          return '<td class="' + (lead > 0 ? 'a' : lead < 0 ? 'b' : '') + '">' + (lead === 0 ? 'AS' : Math.abs(lead)) + '</td>'; }).join('') + '<td class="tt"></td></tr></tbody></table>';
      });
    });
    if (!pars) h += '<div class="lmdim" style="margin-top:6px">Circles and squares need this tee’s hole pars. They appear once the course tee is saved in the Cup setup.</div>';
    return h + '</div>';
  }
  function partRow(cfg, m, sg) {                             // one part of a match: the winning side lights up, halves sit in the middle
    var A = m.sides[0].side, B = m.sides[1].side, lbl = FMT[sg.format] + ' · ' + sg.from + '–' + sg.to;
    var aw = sg.decided && sg.winner === A, bw = sg.decided && sg.winner === B, half = sg.decided && !sg.winner;
    var live = !sg.decided && sg.thru > 0 && sg.lead !== 0, txt = sg.text || '';
    var l = aw ? txt : (live && sg.lead > 0 ? Math.abs(sg.lead) + ' UP' : ''), r = bw ? txt : (live && sg.lead < 0 ? Math.abs(sg.lead) + ' UP' : '');
    var mid = esc(lbl) + (half ? '' : '') ;
    if (half) mid = '<b>Halved</b><br>' + esc(lbl);
    else if (sg.decided) mid = esc(lbl);
    else if (sg.thru > 0) mid = esc(lbl) + '<br>' + (sg.lead === 0 ? 'All square · ' : '') + 'thru ' + sg.thru;
    else mid = esc(lbl) + '<br>Not started';
    return '<div class="lmpr"><div class="c l a' + (aw ? ' win' : l ? ' up' : '') + '">' + esc(l) + '</div><div class="mid' + (half ? ' half' : '') + '"><span>' + mid + '</span></div><div class="c r b' + (bw ? ' win' : r ? ' up' : '') + '">' + esc(r) + '</div></div>';
  }
  function fmtPts(n) { return n === 0.5 ? '½' : (n % 1 === 0.5 ? Math.floor(n) + '½' : String(n)); }
  function boardHtml(cfg, all, standings, nums) {
    var keys = (cfg.sides || []).map(function (x) { return x.key; }), h = '<div class="lm">';
    h += '<div class="lmc"><div class="lmboard"><div style="color:var(--a)"><span class="big">' + standings.points[keys[0]] + '</span><div class="lmdim">' + esc(sideName(cfg, keys[0])) + '</div></div><div class="lmdim">POINTS<br>' + standings.target + ' to win</div><div style="color:var(--b)"><span class="big">' + standings.points[keys[1]] + '</span><div class="lmdim">' + esc(sideName(cfg, keys[1])) + '</div></div></div>' + (standings.clinched ? '<div class="lmmsg ok" style="margin-top:8px;text-align:center">' + esc(sideName(cfg, standings.clinched)) + ' has clinched the Cup</div>' : '') + '</div>';
    S.open = S.open || {};
    standings.rounds.forEach(function (r) {
      if (!r.matches.length) return;
      var rnd = (cfg.rounds || []).filter(function (x) { return x.key === r.key; })[0];
      h += '<div class="lmc"><b>' + esc(r.name || r.key) + '</b>' + (r.done ? ' <span class="lmdim">· final</span>' : '');
      r.matches.forEach(function (m) {
        var id = r.key + '|' + m.key, open = !!S.open[id], decided = m.segments.some(function (sg) { return sg.decided; });
        var pa = m.points[keys[0]] || 0, pb = m.points[keys[1]] || 0;
        h += '<div class="lmbm"><button class="lmbmt" data-lm-open="' + esc(id) + '"><div class="lmmno">Match ' + nums[id] + groupTag(all, r.key, m.key) + '</div><div class="lmbmh"><span class="a">' + esc(m.sides[0].players.join(' & ')) + '</span>' +
          '<span class="pt">' + (decided ? '<span class="a">' + fmtPts(pa) + '</span> <span class="lmdim">–</span> <span class="b">' + fmtPts(pb) + '</span>' : '<span class="lmdim">v</span>') + '</span><span class="b">' + esc(m.sides[1].players.join(' & ')) + '</span></div>' +
          m.segments.map(function (sg) { return partRow(cfg, m, sg); }).join('') + '<div class="lmcar">' + (open ? '▲ Hide scorecard' : '▼ Scorecard') + '</div></button>';
        if (open && rnd) { var mt = (rnd.matches || []).filter(function (x) { return x.key === m.key; })[0]; if (mt) h += scorecardHtml(cfg, rnd, mt) + (S.opts.goScore ? '<div style="padding:0 10px 10px"><button class="lmgo2" data-lm-score="' + esc(id) + '">Enter or correct scores</button></div>' : ''); }
        h += '</div>';
      });
      h += '</div>';
    });
    return h + '</div>';
  }
  function render() {
    if (!S) return;
    var cfg = S.opts.getCfg(), el = S.el; if (!cfg) { el.innerHTML = ''; return; }
    var E = S.opts.E, all = groupsOf(cfg), nums = E.cupMatchNumbers(cfg);
    if (!all.length) { el.innerHTML = '<div class="lm"><div class="lmc lmdim">Matches are not set yet. The scoring opens once the draw is done.</div></div>'; return; }
    if (S.view === 'board') {
      el.innerHTML = boardHtml(cfg, all, E.cupLiveStandings(cfg), nums);
      function toggle(id) { S.open[id] = !S.open[id]; var y = window.pageYOffset; render(); if (y > 0) window.scrollTo(0, y); }
      Array.prototype.forEach.call(el.querySelectorAll('[data-lm-open]'), function (b) { b.addEventListener('click', function () { toggle(b.getAttribute('data-lm-open')); }); });
      Array.prototype.forEach.call(el.querySelectorAll('[data-lm-score]'), function (b) { b.addEventListener('click', function () {
        var p = b.getAttribute('data-lm-score').split('|'), g = all.filter(function (x) { return x.round.key === p[0] && x.matches.some(function (m) { return m.key === p[1]; }); })[0];
        if (g) { S.sel = { r: g.round.key, g: g.key }; S.hole = null; if (S.opts.goScore) S.opts.goScore(); } }); });
      return;
    }
    function liveOf(g) { return g.matches.map(function (m) { return E.cupMatchLive(cfg, g.round, m, entryOf(cfg, g.round.key, m.key)); }); }
    function gDone(g) { return liveOf(g).every(function (l) { return l.done; }); }
    // choose the group: remembered, else mine and still open, else any still open, else mine, else the first
    var grp = S.sel && all.filter(function (x) { return x.round.key === S.sel.r && x.key === S.sel.g; })[0];
    if (!grp) grp = all.filter(function (x) { return mineG(x, S.opts.player) && !gDone(x); })[0] || all.filter(function (x) { return !gDone(x); })[0] || all.filter(function (x) { return mineG(x, S.opts.player); })[0] || all[0];
    S.sel = { r: grp.round.key, g: grp.key };
    var round = grp.round, matches = grp.matches, lives = liveOf(grp), gkey = round.key + '|' + grp.key;
    var maxHole = Math.max.apply(null, round.segments.map(function (s) { return s.to; }));
    var gnext = Math.min.apply(null, lives.map(function (l) { return l.next; }));
    var hole = S.hole && S.hole.g === gkey ? S.hole.h : gnext;
    S.hole = { g: gkey, h: hole };
    var q = queue(), std = E.cupLiveStandings(cfg), stdOf = {};
    std.rounds.forEach(function (rr) { if (rr.key === round.key) rr.matches.forEach(function (mm) { stdOf[mm.key] = mm; }); });
    var finished = lives.every(function (l) { return l.done; }) && !(S.edit && S.edit[gkey]);
    var h = '<div class="lm">';
    // who is scoring: pick the group, then who you are among its four players
    var members = []; matches.forEach(function (m) { m.sides.forEach(function (sd) { sd.players.forEach(function (p) { members.push(p); }); }); });
    var byRound = []; all.forEach(function (x) { var b = byRound.filter(function (y) { return y.round.key === x.round.key; })[0]; if (!b) byRound.push(b = { round: x.round, items: [] }); b.items.push(x); });
    h += '<div class="lmbar"><label>' + (matches.length > 1 || all.some(function (x) { return x.matches.length > 1; }) ? 'Group' : 'Match') + '<select id="lmMatchSel">' + byRound.map(function (b) {
      var fm = b.round.segments.map(function (sg) { return FMT[sg.format]; }).filter(function (v, i, a2) { return a2.indexOf(v) === i; }).join(' + ');
      return '<optgroup label="' + esc((b.round.name || b.round.key) + ' · ' + fm) + '">' + b.items.map(function (x) {
        var lv = liveOf(x), stt = lv.every(function (l) { return l.done; }) ? 'final' : (lv.some(function (l) { return l.segments.some(function (sg) { return sg.state.thru > 0; }); }) ? 'in play' : 'not started');
        var lab = (x.matches.length > 1 ? 'Group ' + x.key.slice(1) + ' · ' : '') + x.matches.map(function (m) { return 'M' + nums[x.round.key + '|' + m.key] + ' ' + m.sides.map(function (sd) { return sd.players.join('/'); }).join(' v '); }).join('  |  ') + ' · ' + stt;
        return '<option value="' + esc(x.round.key) + '|' + esc(x.key) + '"' + (x.round.key === round.key && x.key === grp.key ? ' selected' : '') + '>' + esc(lab) + '</option>';
      }).join('') + '</optgroup>';
    }).join('') + '</select></label><label>I am<select id="lmMeSel"><option value="">(who are you?)</option>' + members.map(function (n) { return '<option' + (norm(n) === norm(S.opts.player) ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') + '</select></label></div>';
    // one header per match in the group
    matches.forEach(function (match, i) {
      var live = lives[i], sl = statusLine(cfg, live, match), lead = 0, sm = stdOf[match.key];
      live.segments.forEach(function (s) { if (!lead && !s.state.decided && s.state.thru > 0) lead = s.state.lead; });
      if (live.done && sm) { var pk = match.sides.map(function (sd) { return sm.points[sd.side] || 0; }); sl = { text: pk[0] + ' – ' + pk[1], sub: 'Final' }; lead = pk[0] > pk[1] ? 1 : pk[0] < pk[1] ? -1 : 0; }
      h += '<div class="lmc"><div class="lmmno">Match ' + nums[round.key + '|' + match.key] + (matches.length > 1 ? ' · Group ' + grp.key.slice(1) : '') + '</div><div class="lmhead">' + match.sides.map(function (sd, k) {
        var cls = (k === 0 ? 'a' : 'b') + ((k === 0 && lead > 0) || (k === 1 && lead < 0) ? ' lead' : '');
        return '<div class="lmside ' + cls + '"><span class="lmpn">' + sd.players.map(esc).join('<br>') + '</span><small>' + esc(sideName(cfg, sd.side)) + '</small></div>';
      }).join('').replace('</div><div class="lmside b', '</div><div class="lmstat">' + esc(sl.text) + '<small>' + esc(sl.sub) + '</small></div><div class="lmside b') + '</div>';
      var cl = live.closed, canClose0 = !!(S.opts.code || S.opts.pin);
      if (cl) h += '<div class="lmmsg ok">Closed by ' + esc(cl.by || 'a captain') + ': ' + esc(cl.how === 'concede' ? sideName(cfg, cl.side) + ' conceded' : cl.how === 'halve' ? 'called halved' : 'as it stands') + (canClose0 ? ' <button class="lmsec" data-lm-mreopen="' + esc(match.key) + '" style="margin-left:8px">Reopen</button>' : '') + '</div>';
      h += '</div>';
    });
    if (S.last && S.last.g === gkey) h += S.last.lines.map(function (ln) { return '<div class="lmmsg ok" style="background:' + (ln.w === 'a' ? 'var(--a)' : ln.w === 'b' ? 'var(--b)' : 'var(--bg2)') + '">' + esc(ln.text) + '</div>'; }).join('');
    h += '<div class="lmdim" style="margin:6px 0">' + round.segments.map(function (sg) { return 'Holes ' + sg.from + '–' + sg.to + ': ' + FMT[sg.format]; }).join(' · ') + '</div>';
    h += '<div class="lmc">'; var entryStart = h.length;
    // entry: hole by hole, tap a player, the numbers pop for that player (same flow as the gathering panel). One scorer keeps all four players.
    var rows = [], hasSI = true, fmt0 = 'bestball', posted = {}, anyPosted = false;
    matches.forEach(function (match) {
      var info0 = stat(cfg, round, match, hole); fmt0 = info0.fmt; hasSI = info0.hasSI;
      info0.rows.forEach(function (r) { r.m = match.key; rows.push(r); });
      var en = entryOf(cfg, round.key, match.key), ph = en && en.h && en.h[String(hole)];
      if (ph) { anyPosted = true; Object.keys(ph).forEach(function (k) { posted[k] = ph[k]; }); }
    });
    var inp = S.inp[gkey + '|' + hole] = S.inp[gkey + '|' + hole] || {};
    var w0 = matches.length === 1 ? holeWinner(lives[0], hole) : '';
    h += '<div class="lmnav"><button class="lmarrow" data-lm-go="-1"' + (hole <= 1 ? ' disabled' : '') + '>‹</button><button class="lmhtitle" id="lmAll">Hole ' + hole + (w0 ? ' <span class="lmwin ' + w0 + '"></span>' : '') + '<small>' + FMT[fmt0] + (cfg.handicap && cfg.handicap.strokeIndex ? ' · stroke index ' + cfg.handicap.strokeIndex[hole - 1] : '') + (anyPosted ? ' · posted' : '') + ' · tap for all holes</small></button><button class="lmarrow" data-lm-go="1"' + (hole >= maxHole ? ' disabled' : '') + '>›</button></div>';
    if (S.showAll) h += '<div class="lmholes">' + Array.apply(null, Array(maxHole)).map(function (_, i) {
      var n = i + 1, w = matches.length === 1 ? holeWinner(lives[0], n) : '', segStart = round.segments.some(function (s) { return s.from === n && n > 1; });
      return '<button class="lmh ' + w + (n === hole ? ' cur' : '') + (segStart ? ' seg' : '') + '" data-lm-hole="' + n + '">' + n + '</button>';
    }).join('') + '</div>';
    var firstOpen = rows.filter(function (r) { return rowVal(r.key, inp, posted) === undefined; })[0];
    var who = rows.filter(function (r) { return r.key === S.who; })[0] || firstOpen || rows[0];
    S.who = who.key;
    h += '<div class="lmchips">' + rows.map(function (r) {
      var cur = rowVal(r.key, inp, posted);
      return '<button class="lmchip ' + r.side + (r.key === who.key ? ' sel' : '') + '" data-lm-who="' + esc(r.key) + '"><span class="lmcn">' + esc(r.label) + (r.sub ? '<small>' + esc(r.sub) + '</small>' : '') + (r.strokes ? '<span class="lmdots">' + '●'.repeat(r.strokes) + '</span>' : '') + '</span><span class="lmcv' + (cur === 0 ? ' pu' : '') + '">' + (cur === undefined ? '–' : (cur === 0 ? 'P' : cur)) + '</span></button>';
    }).join('') + '</div>';
    var curw = rowVal(who.key, inp, posted);
    if (fmt0 === 'altshot') h += '<div class="lmdim" style="margin:6px 0">Foursomes: one ball per team. Enter the team gross for the hole.</div>';
    h += '<div class="lmpick"><div class="lmdim" style="margin-bottom:4px">' + esc(who.label) + ' · hole ' + hole + '</div><div class="lmtiles">' + [1, 2, 3, 4, 5, 6, 7, 8].map(function (n) { return '<button class="lmt' + (curw === n ? ' on' : '') + '" data-lm-s="' + esc(who.key) + '|' + n + '">' + n + '</button>'; }).join('')
      + '<button class="lmt pu' + (curw === 0 ? ' on' : '') + '" data-lm-s="' + esc(who.key) + '|0">P</button></div></div>';
    var missing = rows.filter(function (r) { return rowVal(r.key, inp, posted) === undefined; }).length;
    var anon = !S.opts.player && !S.opts.code && !S.opts.pin;
    if (!hasSI) h += '<div class="lmdim">No stroke indexes are saved for this course, so scores count as gross (no handicap strokes).</div>';
    h += '<button class="lmgo" id="lmPost"' + (missing || anon ? ' disabled' : '') + '>' + (anon ? 'Pick who you are above first' : missing ? 'Tap ' + missing + ' more score' + (missing > 1 ? 's' : '') : (anyPosted ? 'Update hole ' + hole : 'Post hole ' + hole)) + '</button>';
    if (S.opts.sections) h += S.opts.sections({ cfg: cfg, round: round, matches: matches, hole: hole, E: E }) || '';
    if (q.length) h += '<div class="lmmsg q">⏳ ' + q.length + ' score' + (q.length > 1 ? 's' : '') + ' waiting to send. Weak signal is fine; it keeps trying.</div>';
    if (S.err) h += '<div class="lmmsg q" id="lmErr">⚠ ' + esc(S.err) + '</div>';
    if (S.msg) h += '<div class="lmmsg">' + esc(S.msg) + '</div>';
    if (lives.every(function (l) { return l.done; }) && !finished) h += '<div class="lmmsg">Already decided. Only correct a score here if one was entered wrong.</div>';
    if (finished) {
      h = h.slice(0, entryStart) + '<div class="lmdim" style="margin:6px 0">' + (matches.length > 1 ? 'Group complete' : 'Match complete') + '</div>' + matches.map(function (match) {
        var sm = stdOf[match.key]; if (!sm) return '';
        return (matches.length > 1 ? '<div class="lmmno" style="margin-top:6px">Match ' + nums[round.key + '|' + match.key] + '</div>' : '') + sm.segments.map(function (sg) {
          var txt = sg.status === 'won' ? sideName(cfg, sg.winner) + ' ' + sg.text : sg.status === 'push' ? 'Halved' : 'Not played';
          return '<div class="lmbs"><span class="lmdim">' + FMT[sg.format] + ' · holes ' + sg.from + '–' + sg.to + '</span><b class="' + (sg.winner === match.sides[0].side ? 'a' : sg.winner === match.sides[1].side ? 'b' : '') + '">' + esc(txt) + '</b></div>'; }).join('');
      }).join('') + '<button class="lmsec" id="lmEdit" style="margin-top:10px">Correct a score</button>';
    }
    h += '</div>';
    // closing a match by hand: host or captains only, one box per match still open
    var canClose = !!(S.opts.code || S.opts.pin);
    if (canClose) matches.forEach(function (match, i) {
      if (lives[i].done) return;
      h += '<div class="lmc"><b>Close match ' + nums[round.key + '|' + match.key] + '</b><div class="lmdim" style="margin:4px 0 8px">Only for a concession or a match stopped early. A match that is mathematically over closes by itself.</div><div class="lmtabs"><button class="lmsec" data-lm-close="standing|" data-lm-cm="' + esc(match.key) + '">As it stands</button>' + match.sides.map(function (sd) { return '<button class="lmsec" data-lm-close="concede|' + esc(sd.side) + '" data-lm-cm="' + esc(match.key) + '">' + esc(sideName(cfg, sd.side)) + ' concedes</button>'; }).join('') + '<button class="lmsec" data-lm-close="halve|" data-lm-cm="' + esc(match.key) + '">Call it halved</button></div></div>';
    });
    // round control: the round finishes by itself once every match is decided or closed
    var rEnd = cfg.phases && cfg.phases['round_' + round.key + '_end'], allDone = (round.matches || []).every(function (m) { return E.cupMatchLive(cfg, round, m, entryOf(cfg, round.key, m.key)).done; });
    h += '<div class="lmc">' + (rEnd ? '<b>' + esc(round.name || round.key) + ' is finished.</b>' + (canClose ? ' <button class="lmsec" id="lmReopen">Reopen it</button>' : '')
      : canClose ? '<button class="lmsec" id="lmFinish">' + (allDone ? 'Finish ' : 'Finish early: ') + esc(round.name || round.key) + '</button> <span class="lmdim">' + (allDone ? 'Every match is decided.' : 'Some matches are still open.') + '</span>'
      : '<span class="lmdim">' + esc(round.name || round.key) + ' finishes by itself when every match is decided.</span>') + '</div>';
    if (allDone && !rEnd && (S.opts.player || canClose)) { S.autoEnd = S.autoEnd || {}; if (!S.autoEnd[round.key]) { S.autoEnd[round.key] = true; setTimeout(function () { act(round, 'round_end'); }, 50); } }
    h += '</div>';
    el.innerHTML = h; wire(round, grp, matches, hole, rows);
  }

  // One call for the round / match actions; whatever the Worker changed is merged into the page's copy of the Cup.
  function act(round, action, extra) {
    var body = Object.assign({ event_name: S.opts.event, action: action, round: round.key, points: action === 'round_end' ? roundPoints(round) : undefined, player: S.opts.player || '', code: S.opts.code || undefined, pin: S.opts.pin || undefined }, extra || {});
    return fetch(S.opts.worker + '/bfe/cup/act', { method: 'POST', body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || r.status); return j; }); })
      .then(function (j) { var c = S.opts.getCfg(); ['phases', 'closed', 'results'].forEach(function (k) { if (j.config[k] !== undefined) c[k] = j.config[k]; else delete c[k]; }); S.msg = ''; render(); if (S.opts.onChange) S.opts.onChange(); })
      .catch(function (e) { S.msg = 'Could not do that: ' + e.message; render(); });
  }
  function roundPoints(round) {                              // this round's points per side, from the same engine the scoreboard uses
    var cfg = S.opts.getCfg(), st = S.opts.E.cupLiveStandings(cfg), keys = (cfg.sides || []).map(function (x) { return x.key; }), out = {};
    keys.forEach(function (k) { out[k] = 0; });
    var r = st.rounds.filter(function (x) { return x.key === round.key; })[0];
    if (r) r.matches.forEach(function (m) { keys.forEach(function (k) { out[k] += m.points[k] || 0; }); });
    return out;
  }
  function wire(round, grp, matches, hole, rows) {
    var el = S.el, gkey = round.key + '|' + grp.key, key = gkey + '|' + hole;
    function postedOf() { var cfg = S.opts.getCfg(), out = {}; matches.forEach(function (m) { var e = entryOf(cfg, round.key, m.key), p = e && e.h && e.h[String(hole)]; if (p) Object.keys(p).forEach(function (k) { out[k] = p[k]; }); }); return out; }
    function cur(r) { return rowVal(r.key, S.inp[key] || {}, postedOf()); }
    var ms = el.querySelector('#lmMatchSel'); if (ms) ms.addEventListener('change', function () { var p = ms.value.split('|'); S.sel = { r: p[0], g: p[1] }; S.hole = null; S.who = null; S.msg = ''; S.err = ''; S.last = null; render(); });
    var me = el.querySelector('#lmMeSel'); if (me) me.addEventListener('change', function () { if (S.opts.setPlayer) S.opts.setPlayer(me.value); render(); });
    Array.prototype.forEach.call(el.querySelectorAll('[data-lm-hole]'), function (b) { b.addEventListener('click', function () { S.hole = { g: gkey, h: Number(b.getAttribute('data-lm-hole')) }; S.who = null; S.showAll = false; S.msg = ''; render(); }); });
    Array.prototype.forEach.call(el.querySelectorAll('[data-lm-s]'), function (b) { b.addEventListener('click', function () {
      var p = b.getAttribute('data-lm-s').split('|'), row = rows.filter(function (r) { return r.key === p[0]; })[0];
      (S.inp[key] = S.inp[key] || {})[row.key] = Number(p[1]);
      var nx = rows.filter(function (r) { return r.key !== row.key && cur(r) === undefined; })[0]; S.who = nx ? nx.key : row.key; render(); }); });
    Array.prototype.forEach.call(el.querySelectorAll('[data-lm-who]'), function (b) { b.addEventListener('click', function () { S.who = b.getAttribute('data-lm-who'); render(); }); });
    Array.prototype.forEach.call(el.querySelectorAll('[data-lm-go]'), function (b) { b.addEventListener('click', function () { var mx = Math.max.apply(null, round.segments.map(function (x) { return x.to; })); S.hole = { g: gkey, h: Math.max(1, Math.min(mx, hole + Number(b.getAttribute('data-lm-go')))) }; S.who = null; S.msg = ''; render(); }); });
    var all = el.querySelector('#lmAll'); if (all) all.addEventListener('click', function () { S.showAll = !S.showAll; render(); });
    var go = el.querySelector('#lmPost'); if (go) go.addEventListener('click', function () {
      if (rows.some(function (r) { return cur(r) === undefined; })) return;
      var cfg = S.opts.getCfg(), at = new Date().toISOString(), E = S.opts.E, nums = E.cupMatchNumbers(cfg), lines = [];
      matches.forEach(function (match) {                       // one post per match; the Worker lets anyone in the group score any of its matches
        var scores = {}; rows.filter(function (r) { return r.m === match.key; }).forEach(function (r) { scores[r.key] = cur(r); });
        var post = { round: round.key, match: match.key, hole: hole, scores: scores, player: S.opts.player || '', at: at };
        applyLocal(cfg, post); var qq = queue(); qq.push(post); setQueue(qq);
      });
      matches.forEach(function (match) {
        var live = E.cupMatchLive(cfg, round, match, entryOf(cfg, round.key, match.key)), wn = holeWinner(live, hole), sl2 = statusLine(cfg, live, match);
        lines.push({ w: wn, text: 'Match ' + nums[round.key + '|' + match.key] + ' · hole ' + hole + ': ' + (wn === 'a' ? sideName(cfg, match.sides[0].side) + ' wins the hole' : wn === 'b' ? sideName(cfg, match.sides[1].side) + ' wins the hole' : 'halved') + '  ·  ' + sl2.text + ' (' + sl2.sub + ')' });
      });
      delete S.inp[key]; S.msg = ''; S.err = ''; S.last = { g: gkey, lines: lines };
      var nxt = Math.min.apply(null, matches.map(function (m) { return E.cupMatchLive(cfg, round, m, entryOf(cfg, round.key, m.key)).next; }));
      S.who = null; S.hole = { g: gkey, h: Math.min(nxt, Math.max.apply(null, round.segments.map(function (s) { return s.to; }))) };
      render(); flush(); if (S.opts.onChange) S.opts.onChange(); });
    function roundAct(action) { act(round, action); }
    Array.prototype.forEach.call(el.querySelectorAll('[data-lm-close]'), function (b) { b.addEventListener('click', function () {
      var p = b.getAttribute('data-lm-close').split('|'), mk = b.getAttribute('data-lm-cm'), msg = p[0] === 'concede' ? 'Record this match as conceded by ' + sideName(S.opts.getCfg(), p[1]) + '?' : p[0] === 'halve' ? 'Call this match halved?' : 'Close this match as it stands? Anything still open is decided on the current score.';
      if (!window.confirm(msg)) return; act(round, 'match_close', { match: mk, how: p[0], side: p[1] || undefined }); }); });
    var ed = el.querySelector('#lmEdit'); if (ed) ed.addEventListener('click', function () { S.edit = S.edit || {}; S.edit[gkey] = true; render(); });
    Array.prototype.forEach.call(el.querySelectorAll('[data-lm-mreopen]'), function (b) { b.addEventListener('click', function () { act(round, 'match_reopen', { match: b.getAttribute('data-lm-mreopen') }); }); });
    var fin = el.querySelector('#lmFinish'); if (fin) fin.addEventListener('click', function () { if (fin.textContent.indexOf('early') > 0 && !window.confirm('Some matches are not decided. Finish the round anyway?')) return; roundAct('round_end'); });
    var ro = el.querySelector('#lmReopen'); if (ro) ro.addEventListener('click', function () { roundAct('round_reopen'); });
  }

  root.BFLiveMatch = {
    css: CSS,
    mount: function (el, opts) {
      S = { el: el, opts: opts, sel: null, hole: null, inp: {}, msg: '', flushing: false };
      if (!document.getElementById('lm-css')) { var st = document.createElement('style'); st.id = 'lm-css'; st.textContent = CSS; document.head.appendChild(st); }
      window.addEventListener('online', flush); setInterval(flush, 6000);
      render(); flush();
    },
    // the page re-draws its whole body on every change; hand the panel its new element
    setView: function (v) { if (S) S.view = v; },
    attach: function (el) { if (!S) return; S.el = el; var cfg = S.opts.getCfg(); if (cfg) queue().forEach(function (p) { applyLocal(cfg, p); }); render(); },
    // call after the page reloaded the Cup from the server: keep unsent holes on top of the fresh scores
    refresh: function () { if (!S) return; var cfg = S.opts.getCfg(); if (cfg && queue().length) { var q = queue(); q.forEach(function (p) { applyLocal(cfg, p); }); } render(); },
    pending: function () { return S ? queue().length : 0; }
  };
})(window);
