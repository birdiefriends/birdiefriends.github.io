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
    '.lm .lmbar{display:grid;grid-template-columns:1fr;gap:8px;margin:6px 0}.lm .lmbar label{display:block;font-size:.72rem;letter-spacing:.06em;text-transform:uppercase;color:var(--dim)}.lm .lmbar select,.lm .lmbar input{display:block;width:100%;margin-top:3px;background:var(--bg2);color:var(--tx);border:1px solid var(--line);border-radius:10px;padding:11px;font:inherit;font-size:.95rem;text-transform:none;letter-spacing:0}' +
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
    '.lm .lmtiles{display:grid;grid-template-columns:repeat(10,1fr);gap:4px;grid-column:1/-1}.lm .lmt{height:42px;border-radius:9px;border:1px solid var(--line);background:var(--bg2);color:var(--tx);font:inherit;font-weight:800;font-size:1.05rem;cursor:pointer;padding:0}.lm .lmt.on{background:var(--lm-accent,var(--a));border-color:var(--tx)}.lm .lmt.pu.on{background:var(--warn);color:var(--ink)}.lm .lmt.sub{font-size:.75rem;color:var(--dim)}' +
    '.lm .lmnav{display:grid;grid-template-columns:52px 1fr 52px;gap:8px;align-items:center;margin:4px 0 8px}.lm .lmarrow{height:48px;border-radius:10px;border:1px solid var(--line);background:var(--bg2);color:var(--tx);font:inherit;font-size:1.6rem;font-weight:800;cursor:pointer}.lm .lmarrow:disabled{opacity:.3}' +
    '.lm .lmhtitle{background:none;border:0;color:var(--tx);font:inherit;font-weight:800;font-size:1.35rem;cursor:pointer;text-align:center}.lm .lmhtitle small{display:block;font-weight:500;font-size:.72rem;color:var(--dim)}' +
    '.lm .lmwin{display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--dim)}.lm .lmwin.a{background:var(--a)}.lm .lmwin.b{background:var(--b)}' +
    '.lm .lmchips{display:grid;grid-template-columns:1fr 1fr;gap:8px}.lm .lmchip{display:flex;justify-content:space-between;align-items:center;gap:6px;background:var(--bg2);color:var(--tx);border:2px solid var(--line);border-left:6px solid var(--line);border-radius:10px;padding:10px;font:inherit;font-weight:700;cursor:pointer;text-align:left}' +
    '.lm .lmseg{font-weight:800;font-size:.92rem;margin:12px 0 6px}' +
    '.lm .lmmodal{position:fixed;left:0;right:0;top:0;bottom:0;z-index:50;background:rgba(3,10,30,.72);display:flex;align-items:center;justify-content:center;padding:16px}.lm .lmmodal .lmask{width:100%;max-width:420px;margin:0;background:var(--bg2,#12306b);box-shadow:0 10px 40px rgba(0,0,0,.5)}' +
    '.lm .lmchip.a{border-left:10px solid var(--a);background:color-mix(in srgb,var(--a) 18%,var(--bg2))}.lm .lmchip.b{border-left:10px solid var(--b);background:color-mix(in srgb,var(--b) 18%,var(--bg2))}.lm .lmchip.sel{border-color:var(--tx)}.lm .lmask{border:2px solid var(--tx);border-radius:12px;padding:12px;margin:10px 0;background:var(--bg2)}.lm .lmaskt{font-weight:800;font-size:1.05rem}.lm .lmaskb{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.lm .lmaskb button{flex:1 1 40%;width:auto;margin-top:0;padding:14px 8px;font-size:1rem}.lm .lmctpl{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:8px 0;padding:8px 10px;border:1px dashed var(--dim);border-radius:10px;font-size:.88rem}.lm .lmmul{display:flex;gap:8px;align-items:center;justify-content:space-between;margin:8px 0;padding:8px 10px;border:1px dashed var(--dim);border-radius:10px;font-size:.84rem}.lm .lmns{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.lm .lmns input{width:64px;margin:0 6px}.lm .lmchip small{display:block;font-weight:500;color:var(--dim);font-size:.7rem}' +
    '.lm .lmcv{font-size:1.7rem;font-weight:800;min-width:30px;text-align:right}.lm .lmcv.pu{color:var(--warn);font-size:1.15rem}.lm .lmpick{margin:10px 0 2px}' +
    '.lm .lmbm{display:block;width:100%;background:var(--bg2);color:var(--tx);border:1px solid var(--line);border-radius:12px;padding:0;margin-top:10px;font:inherit;text-align:left;overflow:hidden}.lm .lmbmt{display:block;width:100%;background:none;color:inherit;border:0;font:inherit;text-align:left;padding:10px 10px 8px;cursor:pointer}' +
    '.lm .lmbmh{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center;font-weight:800;margin-bottom:8px}.lm .lmbmh .a{border-left:4px solid var(--a);padding-left:8px}.lm .lmbmh .b{text-align:right;border-right:4px solid var(--b);padding-right:8px}.lm .lmbmh .pt{font-size:1.15rem;text-align:center;min-width:62px;white-space:nowrap}.lm .lmbmh .pt .a,.lm .lmbmh .pt .b{border:0;padding:0}.lm .lmbmh .pt .a{color:var(--a)}.lm .lmbmh .pt .b{color:var(--b)}' +
    '.lm .lmpr{display:grid;grid-template-columns:1fr auto 1fr;gap:4px;align-items:stretch;margin-top:4px;font-size:.86rem}.lm .lmpr .mid{display:flex;align-items:center;justify-content:center;text-align:center;line-height:1.3;color:var(--dim);font-size:.74rem;padding:0 6px;min-width:96px}.lm .lmpr .c{display:flex;align-items:center;padding:7px 9px;border-radius:8px;font-weight:800;border:1px solid transparent;min-height:34px}.lm .lmpr .c.l{justify-content:flex-start}.lm .lmpr .c.r{justify-content:flex-end;text-align:right}' +
    '.lm .lmpr .c.a.win{background:var(--a);color:#fff}.lm .lmpr .c.b.win{background:var(--b);color:#fff}.lm .lmpr .c.a.up{border-color:var(--a);color:var(--a)}.lm .lmpr .c.b.up{border-color:var(--b);color:var(--b)}.lm .lmpr .mid.half{color:var(--tx);font-weight:800}' +
    '.lm .lmcar{display:flex;justify-content:center;color:var(--dim);font-size:.78rem;padding:3px 0 6px}' +
    '.lm .lmscw{padding:2px 10px 10px;border-top:1px solid var(--line)}.lm .lmsct{margin:8px 0 2px;font-size:.72rem;letter-spacing:.06em;text-transform:uppercase;color:var(--dim)}' +
    '.lm table.lmsc{width:100%;border-collapse:collapse;table-layout:fixed;font-size:.78rem;text-align:center}.lm .lmsc th,.lm .lmsc td{padding:4px 0;border-bottom:1px solid var(--line)}.lm .lmsc th{color:var(--dim);font-weight:600}.lm .lmsc td.nm,.lm .lmsc th.nm{width:27%;text-align:left;padding-left:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:700}' +
    '.lm .lmsc td.nm.a{border-left:3px solid var(--a)}.lm .lmsc td.nm.b{border-left:3px solid var(--b)}.lm .lmsc td.tt,.lm .lmsc th.tt{font-weight:800;width:11%}.lm .lmsc tr.mr td{font-weight:800;border-bottom:0}.lm .lmsc td.a{color:var(--a)}.lm .lmsc td.b{color:var(--b)}.lm .lmsc td.nm.a,.lm .lmsc td.nm.b{color:var(--tx)}' +
    '.lm .lmcir,.lm .lmsq{display:inline-block;min-width:1.55em;line-height:1.55em;border:1.5px solid var(--tx);position:relative}.lm .lmcir{border-radius:50%}.lm .lmsq{border-radius:3px}.lm .lmcir.d,.lm .lmsq.d{box-shadow:0 0 0 2px var(--bg2),0 0 0 3.5px var(--tx)}' +
    '.lm .lmsc sup{color:var(--warn);font-size:.9em;margin-left:1px}.lm .lmsc .pk{color:var(--warn);font-size:.72em}' +
    '.lm .lmgo2{display:block;width:100%;margin-top:8px;padding:10px;border-radius:10px;border:1px solid var(--line);background:none;color:var(--tx);font:inherit;font-weight:700;cursor:pointer}' +
    '.lm .lmbs{display:flex;justify-content:space-between;gap:8px;padding:4px 0;border-top:1px solid var(--line);font-size:.88rem}.lm .lmbs b.a{color:var(--a)}.lm .lmbs b.b{color:var(--b)}' +
    '.lm .lmmno{font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;color:var(--dim);margin-bottom:6px}' +
    '.lm .lmpu{width:auto!important;padding:0 8px;font-size:.78rem!important}.lm .lmpu.on{background:var(--warn)!important;color:var(--ink)!important}' +
    '.lm .lmgo{width:100%;padding:13px;border-radius:10px;border:0;background:var(--lm-accent,var(--a));color:#fff;font:inherit;font-weight:800;font-size:1rem;cursor:pointer;margin-top:8px}.lm .lmgo:disabled{opacity:1;background:var(--bg2);color:var(--dim);border:1px solid var(--line)}.lm .lmgo.ready{background:#2e9e5b;color:#fff}' +
    '.lm .lmsec{background:var(--bg2);color:var(--tx);border:1px solid var(--line);border-radius:10px;padding:9px 12px;font:inherit;font-weight:700;cursor:pointer}' +
    '.lm .lmcv.acc{color:#7be0a4;font-size:.78rem;font-weight:800}.lm .lmres{margin:6px 0 10px;padding:14px 12px;border-radius:12px;background:var(--bg2);color:#fff;text-align:center;font-weight:800;font-size:1.2rem;line-height:1.25;box-shadow:0 2px 10px rgba(0,0,0,.25)}.lm .lmres small{display:block;margin-top:4px;font-weight:600;font-size:.82rem;opacity:.9}.lm .lmres.q{background:transparent;border:2px dashed var(--bd,#4a6aa8);box-shadow:none;font-size:.95rem;font-weight:700;opacity:.85}' +
    '.lm .lmmsg{margin:8px 0;padding:8px 10px;border-radius:9px;background:var(--bg2);font-weight:600;font-size:.9rem}.lm .lmmsg.q{background:var(--warn);color:var(--ink)}.lm .lmmsg.ok{background:#1a7f3c;color:#fff}' +
    '.lm .lmdim{color:var(--dim);font-size:.82rem}.lm .lmdots{letter-spacing:3px;color:var(--warn);font-size:1.15rem;line-height:1;margin-left:10px;display:inline-block;vertical-align:middle}' +
    '.lm .lmboard{display:grid;grid-template-columns:1fr auto 1fr;gap:6px;align-items:center;text-align:center;font-weight:800}.lm .lmboard .big{font-size:1.9rem}' +
    '.lm .lmdrv{margin:8px 0;padding:8px 10px;border:1px solid var(--line);border-radius:10px;background:var(--bg2)}.lm .lmdrv .btns{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:6px 0}.lm .lmdrv button{padding:11px 6px;border-radius:10px;border:2px solid var(--line);background:var(--bg);color:var(--tx);font:inherit;font-weight:700;cursor:pointer}.lm .lmdrv button.on{border-color:var(--tx);background:var(--tx);color:var(--ink)}.lm .lmdrv .warn{color:var(--warn);font-weight:700;font-size:.85rem}' +
    '.lm .lmst{border:1px solid var(--line);border-left:5px solid var(--sc,var(--line));border-radius:12px;padding:10px 12px;margin:12px 0;background:var(--bg)}.lm .lmst.tee{--sc:#ffd36b}.lm .lmst.score{--sc:#7fd69a}.lm .lmst.ctp{--sc:#fff}' +
    '.lm .lmsth{display:flex;align-items:center;gap:8px;margin-bottom:8px}.lm .lmsth .n{width:24px;height:24px;border-radius:50%;background:var(--sc);color:var(--ink);font-weight:800;font-size:.85rem;display:flex;align-items:center;justify-content:center;flex:none}.lm .lmsth .t{font-weight:800;font-size:1.02rem}.lm .lmsth .sp{flex:1}' +
    '.lm .lmpill{font-size:.72rem;font-weight:700;border-radius:999px;padding:3px 9px;border:1px solid var(--line);color:var(--dim);white-space:nowrap}.lm .lmpill.ok{background:#1a7f4b;border-color:#1a7f4b;color:#fff}.lm .lmpill.opt{border-style:dashed}' +
    '.lm .lmst.opt .lmdrv button,.lm .lmst.opt select,.lm .lmst.opt .lmgo2{font-size:.9rem}.lm .lmst.opt{background:transparent}.lm .lmstsum{display:flex;justify-content:space-between;align-items:center;gap:8px;font-weight:600}.lm .lmstsum button{background:none;border:0;color:var(--dim);text-decoration:underline;font:inherit;font-size:.85rem;cursor:pointer}' +
    '.lm .lmtr{display:grid;grid-template-columns:78px 1fr 1fr;gap:6px;align-items:center;margin:6px 0}.lm .lmtr .tn{font-size:.72rem;font-weight:700;border-left:4px solid var(--line);padding-left:6px;color:var(--dim);line-height:1.2}.lm .lmtr .tn.a{border-left-color:var(--a)}.lm .lmtr .tn.b{border-left-color:var(--b)}.lm .lmtr button{padding:10px 4px;border-radius:10px;border:2px solid var(--line);background:var(--bg2);color:var(--tx);font:inherit;font-weight:700;cursor:pointer}.lm .lmtr button.on{border-color:var(--tx);background:var(--tx);color:var(--ink)}' +
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
        var ms = g.matches.filter(function (m) { return m.sides && m.sides.length === 2 && m.sides.every(function (sd) { return (sd.players && sd.players.length) || (sd.away && sd.away.length); }) && m.sides.some(function (sd) { return sd.players && sd.players.length; }); });
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
    if (post.drives) {                                       // Greensomes: whose drive each team used travels with the score
      cfg.drives = cfg.drives || {}; var dm = (cfg.drives[post.round] = cfg.drives[post.round] || {})[post.match] = (cfg.drives[post.round][post.match] || {});
      dm[String(post.hole)] = dm[String(post.hole)] || {};
      Object.keys(post.drives).forEach(function (k) { if (post.drives[k]) dm[String(post.hole)][k] = { player: post.drives[k], by: post.player || '', at: post.at }; else delete dm[String(post.hole)][k]; });
    }
  }
  function flush() {
    if (!S || S.flushing) return; var q = queue(); if (!q.length) return; S.flushing = true;
    var post = q[0];
    fetch(S.opts.worker + '/bfe/cup/act', { method: 'POST', body: JSON.stringify({ event_name: S.opts.event, action: 'score', round: post.round, match: post.match, hole: post.hole, scores: post.scores, drives: post.drives, player: post.player, code: S.opts.code || undefined, pin: S.opts.pin || undefined }) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j, status: r.status }; }); })
      .then(function (x) {
        if (x.ok && x.j && x.j.birdies && x.j.birdies.length) announceBirdies(x.j.birdies);
        if (x.ok || (x.status >= 400 && x.status < 500)) { var qq = queue(); qq.shift(); setQueue(qq); if (!x.ok) { S.err = 'Hole ' + post.hole + ' was NOT saved: ' + (x.j.error || x.status) + '. Pick your name at the top and enter it again.'; var c0 = S.opts.getCfg(); try { delete c0.scores[post.round][post.match].h[String(post.hole)]; } catch (e) { /* nothing local to undo */ } } else if (x.j.config) { var c = S.opts.getCfg(); if (c) { c.phases = x.j.config.phases; mergeServer(c, x.j.config.scores); } } }
        S.flushing = false; render(); if (queue().length) flush();
      })
      .catch(function () { S.flushing = false; render(); });   // offline: leave it queued, the timer retries
  }
  // Gross birdies on a skins round (the Worker flags each one once and hands the new ones back with the saved score). The push goes out the same way the portal's
  // manual Birdie Alert does (same Worker, same feed entry type 'birdie' + meta), so the Skin Status board and the portal's announcements pick it up unchanged.
  var PUSH_URL = 'https://birdiefriends-push.birdiefriends01.workers.dev/', OS_APP = '88022359-a979-4814-8a52-6f1df9884be2';
  var BRANK = { Birdie: 1, Eagle: 2, Albatross: 3 }, BEMOJI = { Birdie: '🐦', Eagle: '🦅', Albatross: '🦄' };
  function skinLine(b, prior) {
    var mineR = BRANK[b.scoreType] || 1, best = null;
    prior.filter(function (e) { return e.meta && e.meta.hole === b.hole; }).forEach(function (e) { var r = BRANK[e.meta.scoreType] || 1; if (!best || r > best.rank) best = { rank: r, scoreType: e.meta.scoreType }; });
    if (!best || mineR > best.rank) return 'Skin Frontrunner';
    if (mineR === best.rank) return 'Skin Busted!';
    return 'Trails the ' + best.scoreType + ' on this hole, no skin change';
  }
  function announceBirdies(list) {
    var cfg = S.opts.getCfg(), names = [];
    ((cfg && cfg.sides) || []).forEach(function (sd) { (sd.players || []).forEach(function (n) { if (names.indexOf(n) < 0) names.push(n); }); });
    if (!names.length) return;
    var filters = []; names.forEach(function (n, i) { if (i) filters.push({ operator: 'OR' }); filters.push({ field: 'tag', key: 'player_name', relation: '=', value: n }); });
    fetch(PUSH_URL + 'feed').then(function (r) { return r.json(); }).then(function (d) { return d.feed || []; }).catch(function () { return null; }).then(function (feed) {
      var cutoff = Date.now() - 18 * 3600 * 1000, prior = (feed || []).filter(function (e) { return e.type === 'birdie' && e.meta && e.sentAt > cutoff; });
      return list.reduce(function (chain, b) {
        return chain.then(function () {
          var msg = feed ? skinLine(b, prior) : 'Gross ' + b.scoreType.toLowerCase() + ', skin watch';
          prior.push({ type: 'birdie', meta: b, sentAt: Date.now() });
          return fetch(PUSH_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ app_id: OS_APP, headings: { en: (BEMOJI[b.scoreType] || '🐦') + ' #' + b.hole + ' — ' + b.player }, contents: { en: msg }, bf_type: 'birdie', bf_meta: { hole: b.hole, player: b.player, scoreType: b.scoreType }, url: 'https://birdiefriends.com/portal.html', filters: filters }) })
            .then(function (r) { return r.json(); }).catch(function () { return null; });
        });
      }, Promise.resolve());
    }).catch(function () { /* an announcement never blocks scoring */ });
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
      match.sides.forEach(function (sd, i) { rows.push({ key: sd.players[0], label: sd.players.join(' & '), sub: sideName(cfg, sd.side), side: i === 0 ? 'a' : 'b', strokes: dots(st.teams[i] ? st.teams[i].strokes : 0, sd.players) }); });
    } else {
      match.sides.forEach(function (sd, i) { sd.players.forEach(function (p) { var rw = st.players.filter(function (x) { return norm(x.names[0]) === norm(p); })[0]; rows.push({ key: p, label: p, sub: sideName(cfg, sd.side), side: i === 0 ? 'a' : 'b', strokes: dots(rw ? rw.strokes : 0, [p]) }); }); });
    }
    var everyone = [].concat.apply([], match.sides.map(function (sd) { return sd.players; }));
    return { fmt: fmt, rows: rows, hasSI: everyone.some(function (p) { return !!E.cupStrokeIndexFor(cfg, [p]); }) };
  }

  var FMT = { bestball: 'Fourball', altshot: 'Greensomes', singles: 'Singles' };

  function holeWinner(live, h) {                            // 'a' | 'b' | 'h' | '' for the hole strip
    for (var i = 0; i < live.segments.length; i++) {
      var sg = live.segments[i]; if (h < sg.from || h > sg.to) continue;
      var x = sg.nets[0][h - 1], y = sg.nets[1][h - 1]; if (x == null || y == null) return '';
      return x < y ? 'a' : (x > y ? 'b' : 'h');
    }
    return '';
  }
  function statusLine(cfg, live, match, atHole) {            // headline: who is up in the segment in play (or the one holding hole atHole)
    if (live.walkover) { var wk = live.walkover; return { text: wk.done ? (wk.result === 'win' ? 'Win' : wk.result === 'half' ? 'Halved' : 'Loss') + ' · ' + wk.total : (wk.thru ? wk.total + ' thru ' + wk.thru : 'Not started'), sub: 'v target ' + wk.win + ' / ' + wk.half }; }
    var seg = null; if (atHole) live.segments.forEach(function (sg) { if (atHole >= sg.from && atHole <= sg.to) seg = sg; });
    live.segments.forEach(function (sg) { if (!seg && !sg.state.decided) seg = sg; }); if (!seg) seg = live.segments[live.segments.length - 1];
    if (!seg) return { text: '', sub: '' };
    var st = seg.state, a = match.sides[0].side, b = match.sides[1].side, t = st.text;
    if (st.status === 'won') return { text: sideName(cfg, st.winner === 0 ? a : b) + ' ' + t, sub: FMT[seg.format] + ' · closed' };
    if (st.status === 'push') return { text: 'Halved', sub: FMT[seg.format] };
    if (st.thru === 0) return { text: 'Not started', sub: FMT[seg.format] + ' · holes ' + seg.from + '–' + seg.to };
    return { text: st.lead === 0 ? 'All square' : sideName(cfg, st.lead > 0 ? a : b) + ' ' + Math.abs(st.lead) + ' UP', sub: FMT[seg.format] + ' · thru ' + st.thru };
  }
  function oneLine(cfg, round, match) {
    var live = S.opts.E.cupMatchLive(cfg, round, match, entryOf(cfg, round.key, match.key)); var sl = statusLine(cfg, live, match);
    var segs = live.walkover ? (live.walkover.done ? [live.walkover.text] : []) : live.segments.filter(function (s) { return s.state.decided; }).map(function (s) { return s.state.status === 'won' ? sideName(cfg, match.sides[s.state.winner].side) + ' ' + s.state.text : 'Halved'; });
    return { live: live, text: sl.text, extra: segs.join(' · ') };
  }

  function rowVal(key, inp, posted) {                       // typed this visit, else what is already posted, else nothing (no default par)
    if (inp[key] !== undefined) return inp[key];
    if (posted) { var k = Object.keys(posted).filter(function (x) { return norm(x) === norm(key); })[0]; if (k !== undefined) return posted[k]; }
    return undefined;
  }

  // Won by concession: when every player on one side is Out (0), the other side's rows are optional. Blank = won by concession (saved as -1, no score, no skin try); a number = finished out (counts for skins).
  function optRow(rows, r, inp, posted) {
    var opp = rows.filter(function (x) { return x.m === r.m && x.side !== r.side; });
    return opp.length > 0 && opp.every(function (x) { return rowVal(x.key, inp, posted) === 0; });
  }
  function effVal(rows, r, inp, posted) {                   // what counts as entered: a posted -1 is only good while the other side is still entirely Out
    var v = rowVal(r.key, inp, posted);
    return (v !== undefined && v < 0 && !optRow(rows, r, inp, posted)) ? undefined : v;
  }
  function needRow(rows, r, inp, posted) { return effVal(rows, r, inp, posted) === undefined && !optRow(rows, r, inp, posted); }

  // The leaderboard view: the points race and every match with both of its parts (Fourball / Greensomes), one record, one renderer.
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
    if (g === 0) return '<span class="pk" title="Out of the hole">Out</span>';
    if (g < 0) return '<span class="pk" title="Won by concession">Won</span>';
    if (!par) return String(g);
    if (g <= par - 2) return '<span class="lmcir d">' + g + '</span>';
    if (g === par - 1) return '<span class="lmcir">' + g + '</span>';
    if (g === par + 1) return '<span class="lmsq">' + g + '</span>';
    if (g >= par + 2) return '<span class="lmsq d">' + g + '</span>';
    return String(g);
  }
  function scorecardHtml(cfg, round, match) {                // the real card for one match, one table per part (Fourball / Greensomes) and per nine
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
        lines.forEach(function (ln, li) {
          var sum = 0, any = false;
          h += '<tr><td class="nm ' + ln.side + '">' + esc(ln.label) + '</td>' + holes.map(function (n) {
            var g = grossAt(entry, ln.key, n); if (g === undefined) return '<td></td>';
            var st = stat(cfg, round, match, n).rows.filter(function (r) { return r.key === ln.key; })[0];
            if (g > 0) { sum += g; any = true; }
            return '<td>' + mark(g, pars && pars[n - 1]) + (st && st.strokes ? '<sup>' + '•'.repeat(st.strokes) + '</sup>' : '') + '</td>'; }).join('') + '<td class="tt">' + (any ? sum : '') + '</td></tr>';
          if (sg.format === 'altshot') {                       // whose drive was used, by initial, under the team's score
            var dsd = E.cupDriveStatus(cfg, round, match, sg).sides[li % match.sides.length];
            if (dsd && dsd.logged) h += '<tr class="dr"><td class="nm ' + ln.side + '"><span class="lmdim">drive</span></td>' + holes.map(function (n) { var p = dsd.by[n]; return '<td class="lmdim">' + (p ? esc(p.trim().charAt(0)) : '') + '</td>'; }).join('') + '<td class="tt lmdim">' + dsd.players.map(function (p) { return esc(p.trim().charAt(0)) + dsd.counts[p]; }).join(' ') + '</td></tr>';
          }
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
  function mnum(nums, round, match, hole) {                  // a pairing's number for the part that hole belongs to (Fourball 1-4, Greensomes 5-8)
    var si = 0; (round.segments || []).forEach(function (sg, i) { if (hole >= sg.from && hole <= sg.to) si = i; });
    return nums[round.key + '|' + match.key] + si * (round.matches || []).length;
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
      var nseg = r.matches[0].segments.length;
      if (nseg > 1) {                                          // a round with parts (Fourball then Greensomes): one block per part, so every match is its own line worth its own point
        for (var si = 0; si < nseg; si++) {
          var s0 = r.matches[0].segments[si];
          h += '<div class="lmseg">' + esc(FMT[s0.format] || s0.format) + ' · holes ' + s0.from + '–' + s0.to + ' <span class="lmdim">· 1 point each</span></div>';
          r.matches.forEach(function (m) {
            var sg = m.segments[si], id = r.key + '|' + m.key, oid = id + '#' + si, open = !!S.open[oid];
            var pa = sg.points ? (sg.points[keys[0]] || 0) : 0, pb = sg.points ? (sg.points[keys[1]] || 0) : 0;
            h += '<div class="lmbm"><button class="lmbmt" data-lm-open="' + esc(oid) + '"><div class="lmmno">Match ' + (nums[id] + si * r.matches.length) + groupTag(all, r.key, m.key) + '</div><div class="lmbmh"><span class="a">' + esc(S.opts.E.cupSideNames(m.sides[0]).join(' & ')) + '</span>' +
              '<span class="pt">' + (sg.decided ? '<span class="a">' + fmtPts(pa) + '</span> <span class="lmdim">–</span> <span class="b">' + fmtPts(pb) + '</span>' : '<span class="lmdim">v</span>') + '</span><span class="b">' + esc(S.opts.E.cupSideNames(m.sides[1]).join(' & ')) + '</span></div>' +
              partRow(cfg, m, sg) + '<div class="lmcar">' + (open ? '▲ Hide scorecard' : '▼ Scorecard') + '</div></button>';
            if (open && rnd) { var mt = (rnd.matches || []).filter(function (x) { return x.key === m.key; })[0]; if (mt) h += scorecardHtml(cfg, rnd, mt) + (S.opts.goScore ? '<div style="padding:0 10px 10px"><button class="lmgo2" data-lm-score="' + esc(id) + '">Enter or correct scores</button></div>' : ''); }
            h += '</div>';
          });
        }
        h += '</div>'; return;
      }
      r.matches.forEach(function (m) {
        var id = r.key + '|' + m.key, open = !!S.open[id], decided = m.segments.some(function (sg) { return sg.decided; });
        var pa = m.points[keys[0]] || 0, pb = m.points[keys[1]] || 0;
        h += '<div class="lmbm"><button class="lmbmt" data-lm-open="' + esc(id) + '"><div class="lmmno">Match ' + nums[id] + groupTag(all, r.key, m.key) + '</div><div class="lmbmh"><span class="a">' + esc(S.opts.E.cupSideNames(m.sides[0]).join(' & ')) + '</span>' +
          '<span class="pt">' + (decided ? '<span class="a">' + fmtPts(pa) + '</span> <span class="lmdim">–</span> <span class="b">' + fmtPts(pb) + '</span>' : '<span class="lmdim">v</span>') + '</span><span class="b">' + esc(S.opts.E.cupSideNames(m.sides[1]).join(' & ')) + '</span></div>' +
          m.segments.map(function (sg) { return partRow(cfg, m, sg); }).join('') + '<div class="lmcar">' + (open ? '▲ Hide scorecard' : '▼ Scorecard') + '</div></button>';
        if (open && rnd) { var mt = (rnd.matches || []).filter(function (x) { return x.key === m.key; })[0]; if (mt) h += scorecardHtml(cfg, rnd, mt) + (S.opts.goScore ? '<div style="padding:0 10px 10px"><button class="lmgo2" data-lm-score="' + esc(id) + '">Enter or correct scores</button></div>' : ''); }
        h += '</div>';
      });
      h += '</div>';
    });
    return h + '</div>';
  }
  // One numbered header per entry step (tee shot / score / closest to the pin) so the three jobs read as different things at a glance.
  function stepHead(n, icon, title, pill, ok, opt) {
    return '<div class="lmsth"><span class="n">' + n + '</span><span class="t">' + icon + ' ' + esc(title) + '</span><span class="sp"></span>' + (opt ? '<span class="lmpill opt">Optional</span>' : '') + (pill ? '<span class="lmpill' + (ok ? ' ok' : '') + '">' + esc(pill) + '</span>' : '') + '</div>';
  }
  // Greensomes: each team says whose drive it used on the hole BEFORE the score can be saved. The choice is held on the page (S.drv) until Save, then
  // travels with the score post (so it is queued offline like the score). Returns { matchKey: { sideKey: name } } or null when it is not a Greensomes hole.
  // A match that is already decided keeps being scored (skins, closest to the pin, everyone has paid to play). Its points are frozen by the engine at the
  // clinching hole, so a hole after that is "play-on": still entered, never changes the result. The tee-shot mark is optional on a play-on Greensomes hole.
  function playOn(cfg, round, match, hole) {
    var lv = S.opts.E.cupMatchLive(cfg, round, match, entryOf(cfg, round.key, match.key)), sg = lv.segments.filter(function (x) { return hole >= x.from && hole <= x.to; })[0];
    return !!(sg && sg.state.closedAt != null && hole > sg.state.closedAt);
  }
  function driveSeg(round, hole) { return (round.segments || []).filter(function (sg) { return sg.format === 'altshot' && hole >= sg.from && hole <= sg.to; })[0] || null; }
  function driveChoices(cfg, round, matches, hole, gkey) {
    if (!driveSeg(round, hole)) return null;
    var pend = (S.drv || {})[gkey + '|' + hole] || {}, out = {};
    matches.forEach(function (m) {
      var posted = ((((cfg.drives || {})[round.key] || {})[m.key]) || {})[String(hole)] || {}; out[m.key] = {};
      m.sides.forEach(function (sd) {
        var pk = m.key + '|' + sd.side, v = Object.prototype.hasOwnProperty.call(pend, pk) ? pend[pk] : (posted[sd.side] ? posted[sd.side].player : '');
        out[m.key][sd.side] = v || '';
      });
    });
    return out;
  }
  // One numbered header per entry step (tee shot / score / closest to the pin) so the three jobs read as different things at a glance.
  function stepHead(n, icon, title, pill, ok, opt) {
    return '<div class="lmsth"><span class="n">' + n + '</span><span class="t">' + icon + ' ' + esc(title) + '</span><span class="sp"></span>' + (opt ? '<span class="lmpill opt">Optional</span>' : '') + (pill ? '<span class="lmpill' + (ok ? ' ok' : '') + '">' + esc(pill) + '</span>' : '') + '</div>';
  }
  // The tee-shot card: one row per team, tap whose drive was used. Required: Save stays off until every team has one. The count includes the pick on screen.
  // Once every team has a drive the card folds to a one-line summary ("change" reopens it).
  function driveHtml(cfg, round, matches, hole, stepNo, gkey) {
    var E = S.opts.E, seg = driveSeg(round, hole); if (!seg) return '';
    var ch = driveChoices(cfg, round, matches, hole, gkey), view = Object.assign({}, cfg, { drives: JSON.parse(JSON.stringify(cfg.drives || {})) });
    matches.forEach(function (m) { m.sides.forEach(function (sd) {
      var v = ch[m.key][sd.side], dm = ((view.drives[round.key] = view.drives[round.key] || {})[m.key] = view.drives[round.key][m.key] || {});
      dm[String(hole)] = dm[String(hole)] || {}; if (v) dm[String(hole)][sd.side] = { player: v }; else delete dm[String(hole)][sd.side];
    }); });
    // picks made on OTHER holes but not saved yet still count, so the running tally matches what the player has tapped
    var pendAll = S.drv || {};
    Object.keys(pendAll).forEach(function (dk) {
      var cut = dk.lastIndexOf('|'), pp = [dk.slice(0, cut), dk.slice(cut + 1)]; if (pp[0] !== gkey || Number(pp[1]) === Number(hole) || Number(pp[1]) < seg.from || Number(pp[1]) > seg.to) return;
      matches.forEach(function (m) { m.sides.forEach(function (sd) {
        var v = pendAll[dk][m.key + '|' + sd.side]; if (!v) return;
        var dm = ((view.drives[round.key] = view.drives[round.key] || {})[m.key] = view.drives[round.key][m.key] || {});
        dm[String(pp[1])] = dm[String(pp[1])] || {}; dm[String(pp[1])][sd.side] = { player: v };
      }); });
    });
    var rowsH = '', sums = [], marked = 0, total = 0, optN = 0;
    matches.forEach(function (match) {
      var st = E.cupDriveStatus(view, round, match, seg), opt = playOn(cfg, round, match, hole);
      st.sides.forEach(function (sd) {
        if (sd.players.length < 2) return;
        if (opt) optN++; else total++;
        var mine = sd.players.filter(function (p) { return norm(p) === norm(ch[match.key][sd.side]); })[0];
        if (mine) { if (!opt) marked++; sums.push(esc(sideName(cfg, sd.side)) + ': ' + esc(shortName(mine)) + ' (' + sd.counts[mine] + ' of ' + sd.min + '+)'); }
        var warn = '';
        if (sd.impossible) warn = 'Not enough holes left for both drives to reach ' + sd.min + '. The captains decide.';
        else if (sd.forced.length) warn = (sd.forced.length === 1 ? esc(shortName(sd.forced[0])) + '’s drive' : 'Both drives') + ' must be used on the ' + (sd.left === 1 ? 'last hole' : 'last ' + sd.left + ' holes') + ' to reach ' + sd.min + '.';
        else if (sd.left > 0) { var lo = sd.players.filter(function (p) { return sd.need[p] > 0; }); if (lo.length === 1 && sd.need[lo[0]] >= sd.left - 1 && sd.left <= 3) warn = esc(shortName(lo[0])) + ' still needs ' + sd.need[lo[0]] + ' of the last ' + sd.left + '.'; }
        var line = sd.players.map(function (p) { return esc(shortName(p)) + ' <b>' + sd.counts[p] + '</b>'; }).join(' · ');
        rowsH += '<div class="lmdrv" style="border:0;padding:0;background:none;margin:6px 0"><div class="lmtr"><span class="tn ' + (sd.side === (match.sides[0] || {}).side ? 'a' : 'b') + '">' + esc(sideName(cfg, sd.side)) + '</span>'
          + sd.players.map(function (p) { return '<button data-lm-drv="' + esc(match.key) + '|' + esc(p) + '" class="' + (mine === p ? 'on' : '') + '">' + esc(shortName(p)) + '</button>'; }).join('')
          + '</div><div class="lmdim">Used: ' + line + ' · ' + sd.left + ' hole' + (sd.left === 1 ? '' : 's') + ' unmarked · each needs ' + sd.min + '</div>' + (warn ? '<div class="warn">' + warn + '</div>' : '') + '</div>';
      });
    });
    if (!total && !optN) return '';
    S.drvOpen = S.drvOpen || {};
    var key = gkey + '|' + hole, allOpt = !total, done = !allOpt && marked === total, folded = done && !S.drvOpen[key];
    var pill = allOpt ? 'Match over' : done ? 'Marked ✓' : marked ? marked + ' of ' + total + ' marked' : 'Mark whose drive';
    var h = '<div class="lmst tee">' + stepHead(stepNo, '🏌️', 'Tee shot', pill, done, allOpt);
    if (folded) return h + '<div class="lmstsum"><span>' + sums.join(' · ') + '</span><button data-lm-drvopen="' + esc(key) + '">change</button></div></div>';
    return h + '<div class="lmdim" style="margin-bottom:2px">' + (allOpt ? 'This match is already decided, so the tee shot is optional on the holes you play on.' : 'Both tee off, pick one drive, then alternate. Tap whose drive your team used.') + '</div>' + rowsH + (done ? '<div style="text-align:right"><button class="lmsec" data-lm-drvopen="' + esc(key) + '" style="padding:5px 12px;font-size:.82rem">Done</button></div>' : '') + '</div>';
  }
  // Closest to the pin (Dev-98, spec §13.15): shown on a CTP hole of a round whose games include it. Anyone playing in the round may set who is closest.
  function ctpHolesOf(cfg, round) {
    var g = round && round.games, a = g && (g.addons || []).filter(function (x) { return x && x.id === 'cttp'; })[0];
    if (!a) return null;
    return Array.isArray(a.holes) ? a.holes.map(Number) : S.opts.E.cupParThrees(cfg);
  }
  function ctpHtml(cfg, round, hole, matches, stepNo) {
    var hs = ctpHolesOf(cfg, round); if (!hs || hs.indexOf(Number(hole)) < 0) return '';
    var cur = (((cfg.ctp || {})[round.key]) || {})[String(hole)] || null, closed = !!round.payout;
    return '<div class="lmctpl" id="lmCtp"><span>🚩 Closest to pin: ' + (cur && cur.player ? '<b>' + esc(cur.player) + '</b> ✓' + (cur.dist ? ' · ' + esc(cur.dist) : '') : 'nobody yet') + '</span>'
      + (closed ? '<span class="lmdim">closed</span>' : '<button class="lmsec" data-lm-ctpopen="' + hole + '">' + (cur && cur.player ? 'Change' : 'Set') + '</button>') + '</div>';
  }
  // The prompt that follows Post hole on a closest-to-the-pin hole: a tap for each player in the group, or nobody.
  function ctpAskHtml(cfg, round, matches, gkey) {
    var a = S.ctpAsk; if (!a || a.g !== gkey) return '';
    var hs = ctpHolesOf(cfg, round); if (!hs || hs.indexOf(Number(a.hole)) < 0 || round.payout) return '';
    var cur = (((cfg.ctp || {})[round.key]) || {})[String(a.hole)] || null, players = [];
    (matches || []).forEach(function (m) { (m.sides || []).forEach(function (sd) { (sd.players || []).forEach(function (n) { if (players.indexOf(n) < 0) players.push(n); }); }); });
    return '<div class="lmmodal" id="lmCtpAsk" data-lm-ctpbg="1"><div class="lmask"><div class="lmaskt">🚩 Closest to pin on hole ' + a.hole + '?</div>'
      + (cur && cur.player ? '<div class="lmdim">Now: <b>' + esc(cur.player) + '</b>' + (cur.dist ? ' · ' + esc(cur.dist) : '') + '</div>' : '')
      + '<div class="lmaskb">' + players.map(function (n) { return '<button class="lmgo2" data-lm-ctpask="' + esc(n) + '">' + esc(shortName(n)) + '</button>'; }).join('') + '<button class="lmsec" data-lm-ctpask="">Nobody</button></div></div></div>';
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
    function gDone(g) { return liveOf(g).every(function (l) { return l.done && (l.closed || l.allEntered); }); }   // decided AND every hole in: a decided match still being played stays selectable
    // choose the group: remembered, else mine and still open, else any still open, else mine, else the first
    var grp = S.sel && all.filter(function (x) { return x.round.key === S.sel.r && x.key === S.sel.g; })[0];
    if (!grp) grp = all.filter(function (x) { return mineG(x, S.opts.player) && !gDone(x); })[0] || all.filter(function (x) { return !gDone(x); })[0] || all.filter(function (x) { return mineG(x, S.opts.player); })[0] || all[0];
    S.sel = { r: grp.round.key, g: grp.key };
    var round = grp.round, matches = grp.matches, lives = liveOf(grp), gkey = round.key + '|' + grp.key;
    var maxHole = Math.max.apply(null, round.segments.map(function (s) { return s.to; }));
    var gnext = Math.min.apply(null, lives.map(function (l) { return l.next; }));
    var allowed = Math.min(maxHole, gnext), hole = S.hole && S.hole.g === gkey ? S.hole.h : gnext;           // the › arrow will not run past the first unposted hole; the hole grid can still jump anywhere
    S.hole = { g: gkey, h: hole };
    var q = queue(), std = E.cupLiveStandings(cfg), stdOf = {};
    std.rounds.forEach(function (rr) { if (rr.key === round.key) rr.matches.forEach(function (mm) { stdOf[mm.key] = mm; }); });
    var wrapped = lives.every(function (l) { return l.closed || l.allEntered; }), finished = lives.every(function (l) { return l.done; }) && wrapped && !(S.edit && S.edit[gkey]);
    var h = '<div class="lm">';
    // who is scoring: pick the group, then who you are among its four players
    var members = []; matches.forEach(function (m) { m.sides.forEach(function (sd) { sd.players.forEach(function (p) { members.push(p); }); }); });
    var byRound = []; all.forEach(function (x) { var b = byRound.filter(function (y) { return y.round.key === x.round.key; })[0]; if (!b) byRound.push(b = { round: x.round, items: [] }); b.items.push(x); });
    h += '<div class="lmbar"><label>' + (matches.length > 1 || all.some(function (x) { return x.matches.length > 1; }) ? 'Group' : 'Match') + '<select id="lmMatchSel">' + byRound.map(function (b) {
      var fm = b.round.segments.map(function (sg) { return FMT[sg.format]; }).filter(function (v, i, a2) { return a2.indexOf(v) === i; }).join(' + ');
      return '<optgroup label="' + esc((b.round.name || b.round.key) + ' · ' + fm) + '">' + b.items.map(function (x) {
        var lv = liveOf(x), stt = lv.every(function (l) { return l.done; }) ? 'final' : (lv.some(function (l) { return l.segments.some(function (sg) { return sg.state.thru > 0; }); }) ? 'in play' : 'not started');
        var lab = (x.matches.length > 1 ? 'Group ' + x.key.slice(1) + ' · ' : '') + x.matches.map(function (m) { return 'M' + nums[x.round.key + '|' + m.key] + ' ' + m.sides.map(function (sd) { return S.opts.E.cupSideNames(sd).join('/'); }).join(' v '); }).join('  |  ') + ' · ' + stt;
        return '<option value="' + esc(x.round.key) + '|' + esc(x.key) + '"' + (x.round.key === round.key && x.key === grp.key ? ' selected' : '') + '>' + esc(lab) + '</option>';
      }).join('') + '</optgroup>';
    }).join('') + '</select></label>'
      // "I am" is only asked when the page does not already know: a host or captain link needs no name, and neither does a player whose name came from the app (or was picked before) and is in this match
      + ((S.opts.code || S.opts.pin || members.some(function (n) { return norm(n) === norm(S.opts.player); })) ? '' : '<label>I am<select id="lmMeSel"><option value="">(who are you?)</option>' + members.map(function (n) { return '<option>' + esc(n) + '</option>'; }).join('') + '</select></label>') + '</div>';
    // one header per match in the group
    matches.forEach(function (match, i) {
      var live = lives[i], sl = statusLine(cfg, live, match), lead = 0, sm = stdOf[match.key];
      live.segments.forEach(function (s) { if (!lead && !s.state.decided && s.state.thru > 0) lead = s.state.lead; });
      if (live.done && sm) { var pk = match.sides.map(function (sd) { return sm.points[sd.side] || 0; }); sl = { text: pk[0] + ' – ' + pk[1], sub: 'Final' }; lead = pk[0] > pk[1] ? 1 : pk[0] < pk[1] ? -1 : 0; }
      h += '<div class="lmc"><div class="lmmno">Match ' + nums[round.key + '|' + match.key] + (matches.length > 1 ? ' · Group ' + grp.key.slice(1) : '') + '</div><div class="lmhead">' + match.sides.map(function (sd, k) {
        var cls = (k === 0 ? 'a' : 'b') + ((k === 0 && lead > 0) || (k === 1 && lead < 0) ? ' lead' : '');
        return '<div class="lmside ' + cls + '"><span class="lmpn">' + S.opts.E.cupSideNames(sd).map(esc).join('<br>') + '</span><small>' + esc(sideName(cfg, sd.side)) + '</small></div>';
      }).join('').replace('</div><div class="lmside b', '</div><div class="lmstat">' + esc(sl.text) + '<small>' + esc(sl.sub) + '</small></div><div class="lmside b') + '</div>';
      var cl = live.closed, canClose0 = !!(S.opts.code || S.opts.pin);
      if (cl) h += '<div class="lmmsg ok">Closed by ' + esc(cl.by || 'a captain') + ': ' + esc(cl.how === 'concede' ? sideName(cfg, cl.side) + ' conceded' : cl.how === 'halve' ? 'called halved' : 'as it stands') + (canClose0 ? ' <button class="lmsec" data-lm-mreopen="' + esc(match.key) + '" style="margin-left:8px">Reopen</button>' : '') + '</div>';
      if (match.noshow) {
        var nsx = match.noshow, wo2 = live.walkover, lone2 = match.sides.filter(function (sd) { return sd.players.length === 1; })[0];
        h += '<div class="lmmsg ok">' + esc(nsx.player) + ' did not show. ' + (wo2
          ? esc(wo2.player) + ' plays the round against a target: ' + wo2.win + ' or better wins, ' + (wo2.win + 1) + '–' + wo2.half + ' halves, ' + (wo2.half + 1) + '+ loses. No hole counts worse than net double bogey (Out counts as one).'
          : (lone2 ? esc(lone2.players[0]) + ' plays alone. ' : '') + (Number(nsx.mulligans) > 0 ? nsx.mulligans + ' mulligans on the Fourball nine: a redo must be played, one per hole, any shot but putts. ' : '') + 'On Greensomes holes hit two tee shots, play the better one, then play on alone.')
          + (S.opts.pin ? ' <button class="lmsec" data-lm-nsundo="' + esc(match.key) + '" style="margin-left:8px">Undo no-show</button>' : '') + '</div>';
      }
      h += '</div>';
    });
    h += ctpAskHtml(cfg, round, matches, gkey);
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
    h += '<div class="lmnav"><button class="lmarrow" data-lm-go="-1"' + (hole <= 1 ? ' disabled' : '') + '>‹</button><button class="lmhtitle" id="lmAll">Hole ' + hole + (w0 ? ' <span class="lmwin ' + w0 + '"></span>' : '') + '<small>' + FMT[fmt0] + (cfg.handicap && cfg.handicap.strokeIndex ? ' · stroke index ' + cfg.handicap.strokeIndex[hole - 1] : '') + (anyPosted ? ' · posted' : '') + ' · tap for all holes</small></button><button class="lmarrow" data-lm-go="1"' + (hole >= allowed ? ' disabled' : '') + '>›</button></div>';
    if (S.showAll) h += '<div class="lmholes">' + Array.apply(null, Array(maxHole)).map(function (_, i) {
      var n = i + 1, w = matches.length === 1 ? holeWinner(lives[0], n) : '', segStart = round.segments.some(function (s) { return s.from === n && n > 1; });
      return '<button class="lmh ' + w + (n === hole ? ' cur' : '') + (segStart ? ' seg' : '') + '"' + '' + ' data-lm-hole="' + n + '">' + n + '</button>';
    }).join('') + '</div>';
    var firstOpen = rows.filter(function (r) { return needRow(rows, r, inp, posted); })[0];
    var who = rows.filter(function (r) { return r.key === S.who; })[0] || firstOpen || rows[0];
    S.who = who.key;
    var pv = '', skinsRound = ((round.games && round.games.addons) || []).some(function (x) { return x.id === 'skins'; });
    // what posting will do, shown before the tap: the hole result for each match, worked out by the same engine as the scoreboard
    matches.forEach(function (match) {
      var mr = rows.filter(function (r) { return r.m === match.key; }), mm = mr.filter(function (r) { return needRow(rows, r, inp, posted); }).length;
      if (match.noshow && lives[matches.indexOf(match)].walkover) { var wv = lives[matches.indexOf(match)].walkover; pv += '<div class="lmres">Target ' + wv.win + ' or better wins · ' + (wv.win + 1) + '–' + wv.half + ' halves · ' + (wv.half + 1) + '+ loses<small>' + (wv.thru ? 'Posted: ' + wv.total + ' through ' + wv.thru + ' (counting no hole worse than net double bogey)' : 'Nothing posted yet') + '</small></div>'; return; }
      if (mm) { pv += '<div class="lmres q">' + (matches.length > 1 ? 'Match ' + mnum(nums, round, match, hole) + ': ' : '') + mm + ' score' + (mm > 1 ? 's' : '') + ' to go</div>'; return; }
      var pc = JSON.parse(JSON.stringify(cfg)), sc0 = {};
      mr.forEach(function (r) { var v = effVal(rows, r, inp, posted); sc0[r.key] = v === undefined ? -1 : v; });
      applyLocal(pc, { round: round.key, match: match.key, hole: hole, scores: sc0, at: '', player: '' });
      var lv = E.cupMatchLive(pc, round, match, entryOf(pc, round.key, match.key)), wn = holeWinner(lv, hole), sl3 = statusLine(pc, lv, match, hole);
      var sgm = lv.segments.filter(function (x) { return hole >= x.from && hole <= x.to; })[0], nA = sgm && sgm.nets[0][hole - 1], nB = sgm && sgm.nets[1][hole - 1];
      var conc = nA === -99 || nB === -99, bothOut = nA === 99 && nB === 99, why = conc ? ' · by concession' : (wn !== 'h' && (nA === 99 || nB === 99) ? ' · other side out' : (bothOut ? ' · both sides out' : (nA != null && nB != null && Math.abs(nA) < 50 && Math.abs(nB) < 50 && wn !== 'h' ? ' · net ' + (wn === 'a' ? nA + ' v ' + nB : nB + ' v ' + nA) : '')));
      var outSd = null, skinTxt = ''; ['a', 'b'].forEach(function (sd) { var rr = mr.filter(function (x) { return x.side === sd; }); if (rr.length && rr.every(function (x) { return effVal(rows, x, inp, posted) === 0; })) outSd = sd; });
      if (skinsRound && outSd) { var scs = mr.filter(function (x) { return x.side !== outSd && effVal(rows, x, inp, posted) > 0; }); skinTxt = scs.length ? scs.map(function (x) { return shortName(x.key) + ' ' + effVal(rows, x, inp, posted); }).join(', ') + ' in for the skin' : 'No skin in play'; }
      pv += '<div class="lmres" style="background:' + (wn === 'a' ? 'var(--a)' : wn === 'b' ? 'var(--b)' : 'var(--bg2)') + '">' + (matches.length > 1 ? 'Match ' + mnum(nums, round, match, hole) + ' · ' : '') + (wn === 'a' ? esc(sideName(cfg, match.sides[0].side)) + ' wins hole ' + hole : wn === 'b' ? esc(sideName(cfg, match.sides[1].side)) + ' wins hole ' + hole : 'Hole ' + hole + ' halved') + esc(why) + '<small>' + esc(sl3.text) + ' · ' + esc(sl3.sub) + '</small>' + (skinTxt ? '<small><b>Skin: ' + esc(skinTxt) + '</b></small>' : '') + '</div>';
    });
    var stepNo = 0, missing0 = rows.filter(function (r) { return needRow(rows, r, inp, posted); }).length;
    if (fmt0 === 'altshot') h += driveHtml(cfg, round, matches, hole, ++stepNo, gkey);
    h += '<div class="lmst score">' + stepHead(++stepNo, '⛳', fmt0 === 'altshot' ? 'Team score' : 'Score', missing0 ? missing0 + ' to enter' : anyPosted ? 'Saved ✓' : 'Ready', !missing0 && anyPosted, false);
    h += pv;
    if (fmt0 === 'altshot') h += '<div class="lmdim" style="margin:-2px 0 6px">One ball per team: enter the team gross for the hole.' + (matches.some(function (m0) { return m0.noshow && m0.sides.some(function (sd) { return sd.players.length === 1; }); }) ? ' A lone player hits two tee shots, plays the better one, then plays on alone.' : '') + '</div>';
    h += '<div class="lmchips">' + rows.map(function (r) {
      var cur = effVal(rows, r, inp, posted), optBlank = (cur === undefined || cur < 0) && optRow(rows, r, inp, posted);
      return '<button class="lmchip ' + r.side + (r.key === who.key ? ' sel' : '') + '" data-lm-who="' + esc(r.key) + '"><span class="lmcn">' + esc(r.label) + (r.sub ? '<small class="lmtm">' + esc(r.sub) + (optBlank ? (skinsRound ? ' · played it out? tap your score' : ' · concession accepted') : '') + '</small>' : (optBlank ? '<small>' + (skinsRound ? 'played it out? tap your score' : 'concession accepted') + '</small>' : '')) + (r.strokes ? '<span class="lmdots">' + '●'.repeat(r.strokes) + '</span>' : '') + '</span><span class="lmcv' + (cur === 0 ? ' pu' : optBlank ? ' acc' : '') + '">' + (optBlank ? 'Accepted ✓' : cur === undefined ? '–' : (cur === 0 ? 'Out' : cur)) + '</span></button>';
    }).join('') + '</div>';
    matches.forEach(function (m0) {
      var mg = E.cupMulligans(m0, E.cupSegmentAt(round, hole)); if (!mg) return;
      var on = mg.used.indexOf(hole) >= 0;
      h += '<div class="lmmul"><span><b>' + esc(shortName(mg.player)) + '</b> mulligans: ' + mg.left + ' left of ' + mg.total + (mg.used.length ? ' (used on ' + mg.used.join(', ') + ')' : '') + '</span><button class="lmsec" data-lm-mul="' + esc(m0.key) + '" data-lm-on="' + (on ? '0' : '1') + '"' + (!on && !mg.left ? ' disabled' : '') + '>' + (on ? 'Undo mulligan on hole ' + hole : 'Used one on hole ' + hole) + '</button></div>';
    });
    var curw = effVal(rows, who, inp, posted), whoOpt = optRow(rows, who, inp, posted);
    h += '<div class="lmpick"><div class="lmdim" style="margin-bottom:4px">' + esc(who.label) + ' · hole ' + hole + '</div><div class="lmtiles">' + [1, 2, 3, 4, 5, 6, 7, 8].map(function (n) { return '<button class="lmt' + (curw === n ? ' on' : '') + '" data-lm-s="' + esc(who.key) + '|' + n + '">' + n + '</button>'; }).join('')
      + '<button class="lmt pu' + (curw === 0 ? ' on' : '') + '" data-lm-s="' + esc(who.key) + '|0" title="' + (fmt0 === 'bestball' ? 'Out of this hole. Your partner’s score still counts; if you are both Out the other team wins it' : 'Out of the hole: the other side wins it') + '" style="font-size:.74rem">Out</button><button class="lmt" data-lm-s="' + esc(who.key) + '|clear" aria-label="Clear this score" title="Clear this score">✕</button></div><div class="lmdim" style="margin-top:6px">Putt conceded? Enter the score as if you holed it. ' + (fmt0 === 'bestball' ? '<b>Out</b> means you are out of this hole. Your partner’s score still counts; if you are both Out, the other team wins it.' : '<b>Out</b> means you gave up the hole and the other side wins it.') + '</div>' + (whoOpt ? '<div class="lmdim" style="margin-top:6px"><b>Concession accepted.</b> The other side is out of this hole, so it is yours.' + (skinsRound ? ' Did you play it out for the skin? Tap your score. Accepted means no skin.' : '') + '</div>' : '') + '</div>';
    var missing = rows.filter(function (r) { return needRow(rows, r, inp, posted); }).length;
    var anon = !S.opts.player && !S.opts.code && !S.opts.pin;
    if (!hasSI) h += '<div class="lmdim">No stroke indexes are saved for this course, so scores count as gross (no handicap strokes).</div>';
    var dch = driveChoices(cfg, round, matches, hole, gkey), noDrive = [];
    if (dch) matches.forEach(function (m) { if (playOn(cfg, round, m, hole)) return; m.sides.forEach(function (sd) { if (sd.players.length > 1 && !dch[m.key][sd.side]) noDrive.push(sideName(cfg, sd.side)); }); });
    h += '<button class="lmgo' + (!missing && !anon && !noDrive.length ? ' ready' : '') + '" id="lmPost"' + (missing || anon || noDrive.length ? ' disabled' : '') + '>' + (anon ? 'Pick who you are above first' : missing ? 'Tap ' + missing + ' more score' + (missing > 1 ? 's' : '') : noDrive.length ? 'Mark whose drive first (' + noDrive.join(', ') + ')' : (anyPosted ? 'Update hole ' + hole : 'Post hole ' + hole)) + '</button>' + (anyPosted && !anon ? '<button class="lmsec" id="lmClear" style="margin-top:8px;width:100%">Clear hole ' + hole + ' (start it over)</button>' : '') + '</div>';
    if (S.opts.sections) h += S.opts.sections({ cfg: cfg, round: round, matches: matches, hole: hole, E: E }) || '';
    h += ctpHtml(cfg, round, hole, matches, stepNo + 1);
    if (q.length) h += '<div class="lmmsg q">⏳ ' + q.length + ' score' + (q.length > 1 ? 's' : '') + ' waiting to send. Weak signal is fine; it keeps trying.</div>';
    if (S.err) h += '<div class="lmmsg q" id="lmErr">⚠ ' + esc(S.err) + '</div>';
    if (S.msg) h += '<div class="lmmsg">' + esc(S.msg) + '</div>';
    if (!finished) matches.forEach(function (match, i) {      // decided but still being played: say so, keep the entry open
      if (!lives[i].done || lives[i].closed) return;
      var sm = stdOf[match.key], parts = sm ? sm.segments.filter(function (sg) { return sg.status === 'won'; }).map(function (sg) { return sideName(cfg, sg.winner) + ' ' + sg.text; }) : [];
      h += '<div class="lmmsg">Match ' + nums[round.key + '|' + match.key] + ' is over' + (parts.length ? ': ' + esc(parts.join(', ')) : '') + '. Points are locked. Keep scoring so everyone’s skins and closest-to-the-pin count; the round stays open until every hole is in.</div>';
    });
    if (finished) {
      h = h.slice(0, entryStart) + '<div class="lmdim" style="margin:6px 0">' + (matches.length > 1 ? 'Group complete' : 'Match complete') + '</div>' + matches.map(function (match) {
        var sm = stdOf[match.key]; if (!sm) return '';
        return (matches.length > 1 ? '<div class="lmmno" style="margin-top:6px">Match ' + nums[round.key + '|' + match.key] + '</div>' : '') + sm.segments.map(function (sg) {
          var txt = sg.status === 'won' ? sideName(cfg, sg.winner) + ' ' + sg.text : sg.status === 'push' ? 'Halved' : 'Not played';
          return '<div class="lmbs"><span class="lmdim">' + FMT[sg.format] + ' · holes ' + sg.from + '–' + sg.to + '</span><b class="' + (sg.winner === match.sides[0].side ? 'a' : sg.winner === match.sides[1].side ? 'b' : '') + '">' + esc(txt) + '</b></div>'; }).join('');
      }).join('') + '<button class="lmsec" id="lmEdit" style="margin-top:10px">Correct a score</button>';
    }
    h += '</div>';
    // marking a no-show: the HOST only, before the match has scores. Any player in any round can be picked, not just this group's.
    if (S.opts.pin) {
      var cands = [];
      (cfg.rounds || []).forEach(function (rd) { (rd.matches || []).forEach(function (mt) {
        var en0 = entryOf(cfg, rd.key, mt.key); if (mt.noshow || (en0 && en0.h && Object.keys(en0.h).length)) return;
        var sing0 = (rd.segments || []).length > 0 && rd.segments.every(function (sg) { return sg.format === 'singles'; });
        mt.sides.forEach(function (sd) { sd.players.forEach(function (n) { cands.push({ v: rd.key + '|' + mt.key + '|' + n, sing: sing0, label: n + ' · ' + (rd.name || rd.key) + ' · M' + nums[rd.key + '|' + mt.key] }); }); });
      }); });
      if (cands.length) h += '<div class="lmc"><b>Someone did not show?</b><div class="lmdim" style="margin:4px 0 8px">Pick him from any round. On a pairs day the other side plays one player with mulligans on the Fourball nine; in singles the other player plays a target score. Do this before tee-off. One no-show per match.</div>'
        + '<div class="lmns" data-lm-nsbox="1"><select data-lm-nswho>' + cands.map(function (c0) { return '<option value="' + esc(c0.v) + '" data-sing="' + (c0.sing ? '1' : '') + '">' + esc(c0.label) + '</option>'; }).join('') + '</select>'
        + '<span data-lm-nssing><label>Win with<input type="number" inputmode="numeric" data-lm-nswin> or better</label><label>Half up to<input type="number" inputmode="numeric" data-lm-nshalf></label></span>'
        + '<span data-lm-nspair><label>Mulligans<input type="number" inputmode="numeric" min="0" max="9" data-lm-nsmul></label></span>'
        + '<button class="lmsec" data-lm-nsgo="1">Mark no-show</button></div></div>';
    }
    // closing a match by hand: host or captains only, one box per match still open
    var canClose = !!(S.opts.code || S.opts.pin);
    if (canClose) matches.forEach(function (match, i) {
      if (lives[i].done) return;
      h += '<div class="lmc"><b>Close match ' + nums[round.key + '|' + match.key] + '</b><div class="lmdim" style="margin:4px 0 8px">Only for a concession or a match stopped early. A match that is mathematically over closes by itself.</div><div class="lmtabs"><button class="lmsec" data-lm-close="standing|" data-lm-cm="' + esc(match.key) + '">As it stands</button>' + match.sides.map(function (sd) { return '<button class="lmsec" data-lm-close="concede|' + esc(sd.side) + '" data-lm-cm="' + esc(match.key) + '">' + esc(sideName(cfg, sd.side)) + ' concedes</button>'; }).join('') + '<button class="lmsec" data-lm-close="halve|" data-lm-cm="' + esc(match.key) + '">Call it halved</button></div></div>';
    });
    // round control: the round finishes by itself once every match is decided or closed
    var rEnd = cfg.phases && cfg.phases['round_' + round.key + '_end'], allDone = (round.matches || []).every(function (m) { var lv = E.cupMatchLive(cfg, round, m, entryOf(cfg, round.key, m.key)); return lv.done && (lv.closed || lv.allEntered); });
    h += '<div class="lmc">' + (rEnd ? '<b>' + esc(round.name || round.key) + ' is finished.</b>' + (canClose ? ' <button class="lmsec" id="lmReopen">Reopen it</button>' : '')
      : canClose ? '<button class="lmsec" id="lmFinish">' + (allDone ? 'Finish ' : 'Finish early: ') + esc(round.name || round.key) + '</button> <span class="lmdim">' + (allDone ? 'Every match is decided and every hole is in.' : 'Some matches or holes are still open.') + '</span>'
      : '<span class="lmdim">' + esc(round.name || round.key) + ' finishes by itself when every match is decided and every hole is in.</span>') + '</div>';
    if (allDone && !rEnd && (S.opts.player || canClose)) { S.autoEnd = S.autoEnd || {}; if (!S.autoEnd[round.key]) { S.autoEnd[round.key] = true; setTimeout(function () { act(round, 'round_end'); }, 50); } }
    h += '</div>';
    el.innerHTML = h; wire(round, grp, matches, hole, rows);
  }

  // One call for the round / match actions; whatever the Worker changed is merged into the page's copy of the Cup.
  function act(round, action, extra) {
    var body = Object.assign({ event_name: S.opts.event, action: action, round: round.key, points: action === 'round_end' ? roundPoints(round) : undefined, player: S.opts.player || '', code: S.opts.code || undefined, pin: S.opts.pin || undefined }, extra || {});
    return fetch(S.opts.worker + '/bfe/cup/act', { method: 'POST', body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || r.status); return j; }); })
      .then(function (j) { var c = S.opts.getCfg(); ['phases', 'closed', 'results', 'ctp', 'drives'].forEach(function (k) { if (j.config[k] !== undefined) c[k] = j.config[k]; else delete c[k]; });
        if ((action === 'noshow' || action === 'noshow_undo' || action === 'mulligan') && j.config.rounds) c.rounds = j.config.rounds; S.msg = ''; render(); if (S.opts.onChange) S.opts.onChange(); })
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
    function cur(r) { return effVal(rows, r, S.inp[key] || {}, postedOf()); }
    function need(r) { return needRow(rows, r, S.inp[key] || {}, postedOf()); }
    var ms = el.querySelector('#lmMatchSel'); if (ms) ms.addEventListener('change', function () { var p = ms.value.split('|'); S.sel = { r: p[0], g: p[1] }; S.hole = null; S.who = null; S.msg = ''; S.err = ''; S.last = null; render(); });
    Array.prototype.forEach.call(el.querySelectorAll('[data-lm-drv]'), function (b) { b.addEventListener('click', function () {
      var p = b.getAttribute('data-lm-drv').split('|'), cfg = S.opts.getCfg();
      var mm = (round.matches || []).filter(function (x) { return x.key === p[0]; })[0], sk = mm && mm.sides.filter(function (sd) { return sd.players.some(function (n) { return norm(n) === norm(p[1]); }); })[0];
      if (!sk) return;
      var ch = driveChoices(cfg, round, matches, hole, gkey), same = ch && ch[p[0]] && norm(ch[p[0]][sk.side]) === norm(p[1]);   // tapping the chosen name again takes it back
      S.drv = S.drv || {}; var dk = gkey + '|' + hole; S.drv[dk] = S.drv[dk] || {}; S.drv[dk][p[0] + '|' + sk.side] = same ? '' : p[1];
      S.err = ''; render();
    }); });
    Array.prototype.forEach.call(el.querySelectorAll('[data-lm-drvopen]'), function (b) { b.addEventListener('click', function () { S.drvOpen = S.drvOpen || {}; var k2 = b.getAttribute('data-lm-drvopen'); S.drvOpen[k2] = !S.drvOpen[k2]; render(); }); });
    var bg = el.querySelector('[data-lm-ctpbg]'); if (bg) bg.addEventListener('click', function (e) { if (e.target === bg) { S.ctpAsk = null; render(); } });
    Array.prototype.forEach.call(el.querySelectorAll('[data-lm-ctpopen]'), function (b) { b.addEventListener('click', function () { S.ctpAsk = { g: gkey, hole: Number(b.getAttribute('data-lm-ctpopen')) }; render(); }); });
    Array.prototype.forEach.call(el.querySelectorAll('[data-lm-ctpask]'), function (b) { b.addEventListener('click', function () {
      var who = b.getAttribute('data-lm-ctpask'), ah = S.ctpAsk ? S.ctpAsk.hole : hole; S.ctpAsk = null;
      if (!who) { render(); return; }
      if (!S.opts.player && !S.opts.code && !S.opts.pin) { S.err = 'Pick who you are above first.'; render(); return; }
      S.err = ''; render(); act(round, 'ctp', { hole: ah, claim: who, dist: '' });
    }); });
    var me = el.querySelector('#lmMeSel'); if (me) me.addEventListener('change', function () { if (S.opts.setPlayer) S.opts.setPlayer(me.value); render(); });
    Array.prototype.forEach.call(el.querySelectorAll('[data-lm-hole]'), function (b) { b.addEventListener('click', function () { S.hole = { g: gkey, h: Number(b.getAttribute('data-lm-hole')) }; S.who = null; S.showAll = false; S.msg = ''; render(); }); });
    Array.prototype.forEach.call(el.querySelectorAll('[data-lm-s]'), function (b) { b.addEventListener('click', function () {
      var p = b.getAttribute('data-lm-s').split('|'), row = rows.filter(function (r) { return r.key === p[0]; })[0];
      if (p[1] === 'clear') { if (S.inp[key]) delete S.inp[key][row.key]; S.who = row.key; render(); return; }   // take back a tap: the box goes back to what was posted (or empty)
      (S.inp[key] = S.inp[key] || {})[row.key] = Number(p[1]);
      var nx = rows.filter(function (r) { return r.key !== row.key && need(r); })[0]; S.who = nx ? nx.key : row.key; render(); }); });
    Array.prototype.forEach.call(el.querySelectorAll('[data-lm-who]'), function (b) { b.addEventListener('click', function () { S.who = b.getAttribute('data-lm-who'); render(); }); });
    Array.prototype.forEach.call(el.querySelectorAll('[data-lm-go]'), function (b) { b.addEventListener('click', function () { var mx = Math.max.apply(null, round.segments.map(function (x) { return x.to; })), cf = S.opts.getCfg(), allowed = Math.min(mx, Math.min.apply(null, matches.map(function (m) { return S.opts.E.cupMatchLive(cf, round, m, entryOf(cf, round.key, m.key)).next; }))); S.hole = { g: gkey, h: Math.max(1, Math.min(mx, allowed, hole + Number(b.getAttribute('data-lm-go')))) }; S.who = null; S.msg = ''; render(); }); });
    var all = el.querySelector('#lmAll'); if (all) all.addEventListener('click', function () { S.showAll = !S.showAll; render(); });
    var clr = el.querySelector('#lmClear'); if (clr) clr.addEventListener('click', function () {
      if (!window.confirm('Clear hole ' + hole + '? Its scores' + (driveSeg(round, hole) ? ' and tee shots' : '') + ' are deleted so you can enter it again.')) return;
      var cfg = S.opts.getCfg(), qq = queue().filter(function (p) { return !(p.round === round.key && Number(p.hole) === hole && matches.some(function (m) { return m.key === p.match; })); }); setQueue(qq);
      var sent = [matches.reduce(function (pr, m) { return pr.then(function () { return act(round, 'clear_hole', { match: m.key, hole: hole }); }); }, Promise.resolve())];   // one at a time: each is a read-modify-write on the Cup record
      matches.forEach(function (m) { var e = entryOf(cfg, round.key, m.key); if (e) ['h', 't', 'by'].forEach(function (k) { if (e[k]) delete e[k][String(hole)]; }); });
      delete S.inp[key]; if (S.drv) delete S.drv[gkey + '|' + hole]; S.who = null; S.msg = ''; S.err = ''; S.last = null; render(); if (S.opts.onChange) S.opts.onChange();
      Promise.all(sent).then(function () { if (S.opts.onChange) S.opts.onChange(); });
    });
    var go = el.querySelector('#lmPost'); if (go) go.addEventListener('click', function () {
      if (rows.some(need)) return;
      var cfg = S.opts.getCfg(), at = new Date().toISOString(), E = S.opts.E, nums = E.cupMatchNumbers(cfg), lines = [];
      var wasPosted = matches.some(function (m) { var en = entryOf(cfg, round.key, m.key); return !!(en && en.h && en.h[String(hole)]); });
      matches.forEach(function (match) {                       // one post per match; the Worker lets anyone in the group score any of its matches
        var scores = {}; rows.filter(function (r) { return r.m === match.key; }).forEach(function (r) { var v = cur(r); scores[r.key] = v === undefined ? -1 : v; });
        var post = { round: round.key, match: match.key, hole: hole, scores: scores, player: S.opts.player || '', at: at };
        var dv = driveChoices(cfg, round, [match], hole, gkey); if (dv) post.drives = dv[match.key];
        applyLocal(cfg, post); var qq = queue(); qq.push(post); setQueue(qq);
      });
      matches.forEach(function (match) {
        var live = E.cupMatchLive(cfg, round, match, entryOf(cfg, round.key, match.key)), wn = holeWinner(live, hole), sl2 = statusLine(cfg, live, match);
        lines.push({ w: wn, text: 'Match ' + mnum(nums, round, match, hole) + ' · hole ' + hole + ': ' + (wn === 'a' ? sideName(cfg, match.sides[0].side) + ' wins the hole' : wn === 'b' ? sideName(cfg, match.sides[1].side) + ' wins the hole' : 'halved') + '  ·  ' + sl2.text + ' (' + sl2.sub + ')' });
      });
      delete S.inp[key]; if (S.drv) delete S.drv[gkey + '|' + hole]; S.msg = ''; S.err = ''; S.last = { g: gkey, lines: lines };
      var hs0 = ctpHolesOf(cfg, round); S.ctpAsk = (!wasPosted && hs0 && hs0.indexOf(Number(hole)) >= 0 && !round.payout) ? { g: gkey, hole: hole } : null;
      var nxt = Math.min.apply(null, matches.map(function (m) { return E.cupMatchLive(cfg, round, m, entryOf(cfg, round.key, m.key)).next; }));
      S.who = null; S.hole = { g: gkey, h: Math.min(nxt, Math.max.apply(null, round.segments.map(function (s) { return s.to; }))) };
      render(); flush(); if (S.opts.onChange) S.opts.onChange(); });
    function roundAct(action) { act(round, action); }
    Array.prototype.forEach.call(el.querySelectorAll('[data-lm-close]'), function (b) { b.addEventListener('click', function () {
      var p = b.getAttribute('data-lm-close').split('|'), mk = b.getAttribute('data-lm-cm'), msg = p[0] === 'concede' ? 'Record this match as conceded by ' + sideName(S.opts.getCfg(), p[1]) + '?' : p[0] === 'halve' ? 'Call this match halved?' : 'Close this match as it stands? Anything still open is decided on the current score.';
      if (!window.confirm(msg)) return; act(round, 'match_close', { match: mk, how: p[0], side: p[1] || undefined }); }); });
    var ed = el.querySelector('#lmEdit'); if (ed) ed.addEventListener('click', function () { S.edit = S.edit || {}; S.edit[gkey] = true; render(); });
    Array.prototype.forEach.call(el.querySelectorAll('[data-lm-mul]'), function (b) { b.addEventListener('click', function () { act(round, 'mulligan', { match: b.getAttribute('data-lm-mul'), hole: hole, on: b.getAttribute('data-lm-on') === '1' }); }); });
    Array.prototype.forEach.call(el.querySelectorAll('[data-lm-nsundo]'), function (b) { b.addEventListener('click', function () { if (!window.confirm('Put this player back in the match? Only possible before any score is entered.')) return; act(round, 'noshow_undo', { match: b.getAttribute('data-lm-nsundo') }); }); });
    Array.prototype.forEach.call(el.querySelectorAll('[data-lm-nsbox]'), function (bx) {
      var E0 = S.opts.E, cfg0 = S.opts.getCfg(), plan = S.opts.noshowPlan || {}, sel = bx.querySelector('[data-lm-nswho]');
      function parts() { var q = sel.value.split('|'); return { round: q[0], match: q[1], name: q.slice(2).join('|') }; }
      function prefill() {
        var pt = parts(), pl = plan[pt.name] || {}, sing = sel.options[sel.selectedIndex].getAttribute('data-sing') === '1';
        bx.querySelector('[data-lm-nssing]').style.display = sing ? '' : 'none'; bx.querySelector('[data-lm-nspair]').style.display = sing ? 'none' : '';
        bx.querySelector('[data-lm-nsmul]').value = pl.mulligans != null ? pl.mulligans : E0.cupMulliganDefault(E0.cupIndexOf(cfg0, pt.name));
        bx.querySelector('[data-lm-nswin]').value = pl.win != null ? pl.win : ''; bx.querySelector('[data-lm-nshalf]').value = pl.half != null ? pl.half : '';
      }
      sel.addEventListener('change', prefill); prefill();
      bx.querySelector('[data-lm-nsgo]').addEventListener('click', function () {
        var pt = parts(), sing = sel.options[sel.selectedIndex].getAttribute('data-sing') === '1', ex = { who: pt.name }, rd0 = (cfg0.rounds || []).filter(function (x) { return x.key === pt.round; })[0];
        if (!rd0) return;
        if (sing) { ex.win = Number(bx.querySelector('[data-lm-nswin]').value); ex.half = Number(bx.querySelector('[data-lm-nshalf]').value); if (!(ex.win > 0 && ex.half >= ex.win)) { S.msg = 'Enter the score that wins and the highest score that halves.'; render(); return; } }
        else ex.mulligans = Number(bx.querySelector('[data-lm-nsmul]').value);
        if (!window.confirm('Mark ' + pt.name + ' as a no-show? He leaves his match.')) return;
        act(rd0, 'noshow', ex);
      });
    });
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
