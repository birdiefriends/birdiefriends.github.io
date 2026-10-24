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
    '.lm .lmtabs{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0}' +
    '.lm .lmtab{background:var(--bg2);color:var(--tx);border:1px solid var(--line);border-radius:10px;padding:8px 10px;font:inherit;font-size:.85rem;cursor:pointer;text-align:left}' +
    '.lm .lmtab.on{border-color:var(--tx);box-shadow:0 0 0 1px var(--tx)}.lm .lmtab small{display:block;color:var(--dim)}' +
    '.lm .lmhead{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center;text-align:center}' +
    '.lm .lmside{border-radius:10px;padding:8px 6px;font-weight:700;border-top:5px solid var(--line);background:var(--bg2)}' +
    '.lm .lmside.a{border-top-color:var(--a)}.lm .lmside.b{border-top-color:var(--b)}.lm .lmside.lead.a{background:var(--a)}.lm .lmside.lead.b{background:var(--b)}' +
    '.lm .lmside small{display:block;font-weight:500;color:var(--dim);font-size:.75rem}.lm .lmside.lead small{color:var(--tx)}' +
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
    '.lm .lmpu{width:auto!important;padding:0 8px;font-size:.78rem!important}.lm .lmpu.on{background:var(--warn)!important;color:var(--ink)!important}' +
    '.lm .lmgo{width:100%;padding:13px;border-radius:10px;border:0;background:var(--lm-accent,var(--a));color:#fff;font:inherit;font-weight:800;font-size:1rem;cursor:pointer;margin-top:8px}.lm .lmgo:disabled{opacity:.45}' +
    '.lm .lmsec{background:var(--bg2);color:var(--tx);border:1px solid var(--line);border-radius:10px;padding:9px 12px;font:inherit;font-weight:700;cursor:pointer}' +
    '.lm .lmmsg{margin:8px 0;padding:8px 10px;border-radius:9px;background:var(--bg2);font-weight:600;font-size:.9rem}.lm .lmmsg.q{background:var(--warn);color:var(--ink)}.lm .lmmsg.ok{background:#1a7f3c;color:#fff}' +
    '.lm .lmdim{color:var(--dim);font-size:.82rem}.lm .lmdots{letter-spacing:2px;color:var(--warn)}' +
    '.lm .lmboard{display:grid;grid-template-columns:1fr auto 1fr;gap:6px;align-items:center;text-align:center;font-weight:800}.lm .lmboard .big{font-size:1.9rem}' +
    '.lm .lmml{display:grid;grid-template-columns:1fr auto;gap:6px;padding:6px 0;border-top:1px solid var(--line);font-size:.88rem}';

  var S = null;          // module state
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function norm(s) { return String(s == null ? '' : s).trim().toLowerCase(); }
  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage can be blocked */ } }

  function matchesOf(cfg) {                                 // every match that has two real sides, with its round
    var out = [];
    (cfg.rounds || []).forEach(function (r) { (r.matches || []).forEach(function (m) { if (m.sides && m.sides.length === 2 && m.sides.every(function (s) { return s.players && s.players.length; })) out.push({ round: r, match: m }); }); });
    return out;
  }
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
        if (x.ok || (x.status >= 400 && x.status < 500)) { var qq = queue(); qq.shift(); setQueue(qq); if (!x.ok) S.msg = 'A score was refused: ' + (x.j.error || x.status); else if (x.j.config) { var c = S.opts.getCfg(); if (c) { c.phases = x.j.config.phases; mergeServer(c, x.j.config.scores); } } }
        S.flushing = false; render(); if (queue().length) flush();
      })
      .catch(function () { S.flushing = false; render(); });   // offline: leave it queued, the timer retries
  }
  function mergeServer(cfg, serverScores) {                 // server wins, but keep holes still waiting in the queue
    var keep = queue(); cfg.scores = JSON.parse(JSON.stringify(serverScores || {}));
    keep.forEach(function (p) { applyLocal(cfg, p); });
  }

  function stat(cfg, round, match, hole) {                  // strokes the players / teams get on this hole, and who is entering what
    var E = S.opts.E, rule = E.cupHandicapRule(cfg), hc = E.cupHcpMap(cfg), si = (cfg.handicap && cfg.handicap.strokeIndex) || null;
    var st = E.cupMatchStrokes(match, hc, rule), seg = E.cupSegmentAt(round, hole), fmt = seg ? seg.format : 'bestball';
    var rows = [];
    function dots(n) { var a = E.cupHoleStrokes(n, si || [])[hole - 1]; return a || 0; }
    if (fmt === 'altshot') {
      match.sides.forEach(function (sd, i) { rows.push({ key: sd.players[0], label: sideName(cfg, sd.side), sub: sd.players.join(' & '), side: i === 0 ? 'a' : 'b', strokes: dots(st.teams[i] ? st.teams[i].strokes : 0) }); });
    } else {
      match.sides.forEach(function (sd, i) { sd.players.forEach(function (p) { var rw = st.players.filter(function (x) { return norm(x.names[0]) === norm(p); })[0]; rows.push({ key: p, label: p, sub: '', side: i === 0 ? 'a' : 'b', strokes: dots(rw ? rw.strokes : 0) }); }); });
    }
    return { fmt: fmt, rows: rows, hasSI: !!si };
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
  function render() {
    if (!S) return;
    var cfg = S.opts.getCfg(), el = S.el; if (!cfg) { el.innerHTML = ''; return; }
    var all = matchesOf(cfg);
    if (!all.length) { el.innerHTML = '<div class="lm"><div class="lmc lmdim">Matches are not set yet. The scoring opens once the draw is done.</div></div>'; return; }
    var E = S.opts.E;
    // choose the match: remembered, else mine, else the first
    var sel = S.sel && all.filter(function (x) { return x.round.key === S.sel.r && x.match.key === S.sel.m; })[0];
    if (!sel) sel = all.filter(function (x) { return mine(x.match, S.opts.player); })[0] || all[0];
    S.sel = { r: sel.round.key, m: sel.match.key };
    var round = sel.round, match = sel.match, entry = entryOf(cfg, round.key, match.key), live = E.cupMatchLive(cfg, round, match, entry);
    var maxHole = Math.max.apply(null, round.segments.map(function (s) { return s.to; }));
    var hole = S.hole && S.hole.m === match.key && S.hole.r === round.key ? S.hole.h : live.next;
    S.hole = { r: round.key, m: match.key, h: hole };
    var q = queue(), standings = E.cupLiveStandings(cfg);
    var sl = statusLine(cfg, live, match);
    var lead = 0; live.segments.forEach(function (s) { if (!lead && !s.state.decided && s.state.thru > 0) lead = s.state.lead; });
    var h = '<div class="lm">';
    // team totals
    var keys = (cfg.sides || []).map(function (s) { return s.key; });
    h += '<div class="lmc"><div class="lmboard"><div style="color:var(--a)"><span class="big">' + standings.points[keys[0]] + '</span><div class="lmdim">' + esc(sideName(cfg, keys[0])) + '</div></div><div class="lmdim">POINTS<br>' + standings.target + ' to win</div><div style="color:var(--b)"><span class="big">' + standings.points[keys[1]] + '</span><div class="lmdim">' + esc(sideName(cfg, keys[1])) + '</div></div></div></div>';
    // match picker
    h += '<div class="lmtabs">' + all.map(function (x) {
      var ol = oneLine(cfg, x.round, x.match), on = x.round.key === round.key && x.match.key === match.key;
      var label = x.match.sides.map(function (s) { return s.players.join('/'); }).join(' v ');
      return '<button class="lmtab' + (on ? ' on' : '') + '" data-lm-sel="' + esc(x.round.key) + '|' + esc(x.match.key) + '">' + (mine(x.match, S.opts.player) ? '★ ' : '') + esc((x.round.name || x.round.key) + ' · ' + x.match.key.toUpperCase()) + '<small>' + esc(label) + '</small><small>' + esc(ol.text) + '</small></button>';
    }).join('') + '</div>';
    // match header
    h += '<div class="lmc"><div class="lmhead">' + match.sides.map(function (sd, i) {
      var cls = (i === 0 ? 'a' : 'b') + ((i === 0 && lead > 0) || (i === 1 && lead < 0) ? ' lead' : '');
      return '<div class="lmside ' + cls + '">' + esc(sideName(cfg, sd.side)) + '<small>' + esc(sd.players.join(' & ')) + '</small></div>';
    }).join('').replace('</div><div class="lmside b', '</div><div class="lmstat">' + esc(sl.text) + '<small>' + esc(sl.sub) + '</small></div><div class="lmside b') + '</div>';
    // hole strip
    h += '<div class="lmholes">' + Array.apply(null, Array(maxHole)).map(function (_, i) {
      var n = i + 1, w = holeWinner(live, n), segStart = round.segments.some(function (s) { return s.from === n && n > 1; });
      return '<button class="lmh ' + w + (n === hole ? ' cur' : '') + (segStart ? ' seg' : '') + '" data-lm-hole="' + n + '">' + n + '</button>';
    }).join('') + '</div>';
    // entry
    var info = stat(cfg, round, match, hole), posted = entry && entry.h && entry.h[String(hole)];
    var inp = S.inp[round.key + '|' + match.key + '|' + hole] = S.inp[round.key + '|' + match.key + '|' + hole] || {};
    h += '<div style="font-weight:800;margin:6px 0">Hole ' + hole + ' <span class="lmdim">· ' + FMT[info.fmt] + (cfg.handicap && cfg.handicap.strokeIndex ? ' · stroke index ' + cfg.handicap.strokeIndex[hole - 1] : '') + (posted ? ' · posted' : '') + '</span></div>';
    info.rows.forEach(function (r) {
      var cur = rowVal(r.key, inp, posted);
      h += '<div class="lmrow"><div class="lmname ' + r.side + '">' + esc(r.label) + (r.strokes ? ' <span class="lmdots" title="handicap strokes on this hole">' + '●'.repeat(r.strokes) + '</span>' : '') + (r.sub ? '<small>' + esc(r.sub) + '</small>' : '') + '</div>'
        + '<div class="lmval' + (cur === 0 ? ' pu' : '') + '">' + (cur === undefined ? '–' : (cur === 0 ? 'Pick up' : cur)) + '</div>'
        + '<div class="lmtiles">' + [2, 3, 4, 5, 6, 7, 8].map(function (n) { return '<button class="lmt' + (cur === n ? ' on' : '') + '" data-lm-s="' + esc(r.key) + '|' + n + '">' + n + '</button>'; }).join('')
        + '<button class="lmt sub' + (cur >= 9 ? ' on' : '') + '" data-lm-s="' + esc(r.key) + '|more">' + (cur >= 9 ? cur : '9+') + '</button><button class="lmt pu' + (cur === 0 ? ' on' : '') + '" data-lm-s="' + esc(r.key) + '|0">P</button></div></div>';
    });
    var missing = info.rows.filter(function (r) { return rowVal(r.key, inp, posted) === undefined; }).length;
    if (!info.hasSI) h += '<div class="lmdim">No stroke indexes are saved for this course, so scores count as gross (no handicap strokes).</div>';
    h += '<button class="lmgo" id="lmPost"' + (missing ? ' disabled' : '') + '>' + (missing ? 'Tap ' + missing + ' more score' + (missing > 1 ? 's' : '') : (posted ? 'Update hole ' + hole : 'Post hole ' + hole)) + '</button>';
    if (S.opts.sections) h += S.opts.sections({ cfg: cfg, round: round, match: match, hole: hole, E: E }) || '';
    if (q.length) h += '<div class="lmmsg q">⏳ ' + q.length + ' hole' + (q.length > 1 ? 's' : '') + ' waiting to send. Weak signal is fine; it keeps trying.</div>';
    if (S.msg) h += '<div class="lmmsg">' + esc(S.msg) + '</div>';
    if (live.done) h += '<div class="lmmsg ok">This match is decided. ' + esc(sl.text) + '. You can keep entering holes for fun; the result does not change.</div>';
    h += '</div>';
    // all matches
    h += '<div class="lmc"><b>All matches</b>' + all.map(function (x) { var ol = oneLine(cfg, x.round, x.match); return '<div class="lmml"><span>' + esc((x.round.name || x.round.key) + ' ' + x.match.key.toUpperCase() + ' · ' + x.match.sides.map(function (s) { return s.players.join('/'); }).join(' v ')) + '</span><b>' + esc(ol.text) + (ol.extra ? ' <span class="lmdim">(' + esc(ol.extra) + ')</span>' : '') + '</b></div>'; }).join('') + '</div>';
    // round control
    var rEnd = cfg.phases && cfg.phases['round_' + round.key + '_end'], allDone = (round.matches || []).every(function (m) { return E.cupMatchLive(cfg, round, m, entryOf(cfg, round.key, m.key)).done; });
    h += '<div class="lmc">' + (rEnd ? '<b>' + esc(round.name || round.key) + ' is finished.</b> <button class="lmsec" id="lmReopen">Reopen it</button>' : '<button class="lmsec" id="lmFinish"' + '>' + (allDone ? 'Finish ' : 'Finish early: ') + esc(round.name || round.key) + '</button> <span class="lmdim">' + (allDone ? 'Every match is decided.' : 'Some matches are still open.') + '</span>') + '</div>';
    h += '</div>';
    el.innerHTML = h; wire(round, match, hole, info);
  }

  function wire(round, match, hole, info) {
    var el = S.el, key = round.key + '|' + match.key + '|' + hole;
    function cur(r) { var cfg = S.opts.getCfg(), e = entryOf(cfg, round.key, match.key); return rowVal(r.key, S.inp[key] || {}, e && e.h && e.h[String(hole)]); }
    Array.prototype.forEach.call(el.querySelectorAll('[data-lm-sel]'), function (b) { b.addEventListener('click', function () { var p = b.getAttribute('data-lm-sel').split('|'); S.sel = { r: p[0], m: p[1] }; S.hole = null; S.msg = ''; render(); }); });
    Array.prototype.forEach.call(el.querySelectorAll('[data-lm-hole]'), function (b) { b.addEventListener('click', function () { S.hole = { r: round.key, m: match.key, h: Number(b.getAttribute('data-lm-hole')) }; S.msg = ''; render(); }); });
    Array.prototype.forEach.call(el.querySelectorAll('[data-lm-s]'), function (b) { b.addEventListener('click', function () {
      var p = b.getAttribute('data-lm-s').split('|'), row = info.rows.filter(function (r) { return r.key === p[0]; })[0], c = cur(row), v;
      if (p[1] === 'more') v = c >= 9 ? Math.min(15, c + 1) : 9; else v = Number(p[1]);
      (S.inp[key] = S.inp[key] || {})[row.key] = v; render(); }); });
    var go = el.querySelector('#lmPost'); if (go) go.addEventListener('click', function () {
      var scores = {}; info.rows.forEach(function (r) { scores[r.key] = cur(r); }); if (info.rows.some(function (r) { return scores[r.key] === undefined; })) return;
      var post = { round: round.key, match: match.key, hole: hole, scores: scores, player: S.opts.player || '', at: new Date().toISOString() };
      var cfg = S.opts.getCfg(); applyLocal(cfg, post); var qq = queue(); qq.push(post); setQueue(qq);
      delete S.inp[key]; S.msg = ''; var live = S.opts.E.cupMatchLive(cfg, round, match, entryOf(cfg, round.key, match.key));
      S.hole = { r: round.key, m: match.key, h: Math.min(live.next, Math.max.apply(null, round.segments.map(function (s) { return s.to; }))) };
      render(); flush(); if (S.opts.onChange) S.opts.onChange(); });
    function roundAct(action) { fetch(S.opts.worker + '/bfe/cup/act', { method: 'POST', body: JSON.stringify({ event_name: S.opts.event, action: action, round: round.key, player: S.opts.player || '', code: S.opts.code || undefined, pin: S.opts.pin || undefined }) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || r.status); return j; }); }).then(function (j) { var c = S.opts.getCfg(); c.phases = j.config.phases; S.msg = ''; render(); if (S.opts.onChange) S.opts.onChange(); })
      .catch(function (e) { S.msg = 'Could not do that: ' + e.message; render(); }); }
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
    attach: function (el) { if (!S) return; S.el = el; var cfg = S.opts.getCfg(); if (cfg) queue().forEach(function (p) { applyLocal(cfg, p); }); render(); },
    // call after the page reloaded the Cup from the server: keep unsent holes on top of the fresh scores
    refresh: function () { if (!S) return; var cfg = S.opts.getCfg(); if (cfg && queue().length) { var q = queue(); q.forEach(function (p) { applyLocal(cfg, p); }); } render(); },
    pending: function () { return S ? queue().length : 0; }
  };
})(window);
