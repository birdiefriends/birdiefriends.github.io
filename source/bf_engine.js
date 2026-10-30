/* ════════════════════════════════════════════════════════════════════════
   bf_engine.js — BirdieFriends shared game engine (Dev-88, engine
   unification Phase A — see source/BF_BFE_NextGen_Spec.md §9 layer 1).

   ONE place for game scoring + payout math, loaded by portal.html (and,
   from Phase B, BFE-Admin.html) with <script src="bf_engine.js?v=...">,
   and imported directly by the Node tests in source/tests/.

   Rules for this file:
     • Pure functions only — no DOM, no fetch, no globals read. Anything
       it needs is passed in. That's what lets the tests run it as-is.
     • Every game is a registry entry. A new format = a new entry, not a
       new branch in five files.
     • Behavior changes here change real money. Any change to an existing
       entry's output needs a test update AND a Session Log line saying so.

   Load order: portal.html loads this BEFORE its own inline script. The
   `?v=` query must match ENGINE_VERSION below whenever this file changes
   (GitHub Pages caches ~10 min; the query is what makes a new portal pick
   up the matching engine). bf_push.ps1 pushes this before portal.html.
   ════════════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.BFEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const ENGINE_VERSION = '1.44.0';

  const norm = s => String(s || '').trim().toLowerCase();

  // ── Hole-by-hole skins (the comparison half only — no money) ───────────
  // compare: 'low' (strokes — Gatherings) | 'high' (Stableford points —
  // BFE quota rounds, wired in Phase B). A skin is the OUTRIGHT best score
  // on a hole: a tie at the best = no skin, no carryover. A hole needs ≥2
  // entered scores to be a contest (blank/incomplete cards beat nobody).
  // cards: [{player, holes:[number|null, …]}]
  // opts.net (Dev-91): scores are NET, which can legitimately be 0 or below
  // (a gross 1 on a par 3 with a stroke is a net 0); only blanks (null) are
  // excluded. Gross keeps its original "> 0" rule byte-for-byte.
  function skinsWon(cards, compare, opts) {
    const dir = compare === 'high' ? 'high' : 'low';
    const netScores = !!(opts && opts.net);
    const list = (cards || []).filter(c => c && c.player);
    const holeCount = Math.max(0, ...list.map(c => Array.isArray(c.holes) ? c.holes.length : 0));
    const won = [];
    for (let h = 0; h < holeCount; h++) {
      const entries = list
        .map(c => ({ player: c.player, s: Array.isArray(c.holes) ? c.holes[h] : null }))
        .filter(e => typeof e.s === 'number' && (netScores || (dir === 'low' ? e.s > 0 : e.s >= 0)));
      if (entries.length < 2) continue;
      const best = dir === 'low' ? Math.min(...entries.map(e => e.s)) : Math.max(...entries.map(e => e.s));
      const at = entries.filter(e => e.s === best);
      if (at.length === 1) won.push(dir === 'low'
        ? { hole: h + 1, player: at[0].player, strokes: best }
        : { hole: h + 1, player: at[0].player, points: best });
    }
    return won;
  }


  // ── Handicap strokes (Dev-91) — the shared net/gross foundation ────────
  // Every net game reads strokes through these four functions, so a new net
  // game never re-derives them. Pure: slope/rating/par/stroke-index come in.
  //
  // USGA Course Handicap = Index × (Slope ÷ 113) + (Rating − Par). The
  // Playing Handicap applies the format's allowance (95% for individual
  // stroke play) to the UNROUNDED course handicap and rounds once at the end.
  // A plus handicap is a negative Index. Nine-hole rounds use half.
  function courseHandicap(index, slope, rating, par) {
    return Number(index) * (Number(slope) / 113) + (Number(rating) - Number(par));
  }
  function playingHandicap(spec, allowancePct, holeCount) {
    const a = (allowancePct == null || allowancePct === '' ? 95 : Number(allowancePct)) / 100;
    const raw = courseHandicap(spec.index, spec.slope, spec.rating, spec.par);
    const per = holeCount === 9 ? 0.5 : 1;
    return {
      course_hcp: Math.round(raw * per * 10) / 10,
      strokes: Math.round(raw * a * per)
    };
  }
  // Strokes a player receives on a hole with stroke index `si` (1 = hardest)
  // out of `n` holes. 18+ wraps: 20 strokes = one everywhere + a second on
  // SI 1-2. Negative (plus handicap) strokes are GIVEN BACK on the easiest
  // holes, mirror image.
  function strokesOnHole(strokes, si, n) {
    n = n || 18;
    const s = Math.trunc(Number(strokes)) || 0;
    const r = Math.trunc(Number(si));
    if (!(r >= 1 && r <= n)) return 0;
    if (s >= 0) return Math.floor(s / n) + (r <= s % n ? 1 : 0);
    const g = -s;
    return -(Math.floor(g / n) + (r > n - (g % n) ? 1 : 0));
  }
  // Re-rank a nine's stroke indexes (e.g. 7,1,13,…) to 1-9 for 9-hole play.
  function rankWithin(si) {
    const order = si.map((v, i) => [Number(v), i]).sort((a, b) => a[0] - b[0]);
    const out = new Array(si.length);
    order.forEach(([, i], rank) => { out[i] = rank + 1; });
    return out;
  }
  // Gross card → net card for one player. `spec` = frozen per-player entry
  // { strokes, stroke_index:[18] }; `fallbackSI` is the round-level table.
  // Blank holes stay null. Returns { holes (net), received, gross, strokes }.
  function netCard(card, spec, fallbackSI) {
    const holes = Array.isArray(card.holes) ? card.holes : [];
    const half = (card.hole_count === 9 && card.hole_half === 'back') ? 9 : 0;
    const si18 = (spec && Array.isArray(spec.stroke_index) && spec.stroke_index.length === 18) ? spec.stroke_index
      : (Array.isArray(fallbackSI) && fallbackSI.length === 18 ? fallbackSI : null);
    const strokes = spec && Number.isFinite(Number(spec.strokes)) ? Math.trunc(Number(spec.strokes)) : 0;
    const n = holes.length === 9 ? 9 : 18;
    let si = null;
    if (si18) si = n === 9 ? rankWithin(si18.slice(half, half + 9)) : si18.slice();
    const received = holes.map((_, i) => (si ? strokesOnHole(strokes, si[i], n) : 0));
    return {
      holes: holes.map((g, i) => (typeof g === 'number' && g > 0 ? g - received[i] : null)),
      received, gross: holes.slice(), strokes, missing_si: !si && strokes !== 0
    };
  }

  // v4.13.0 — Gross and Net rankings for a round that has a Net setup: for fun, not a game (no
  // money moves). Only completed cards rank (every hole in); ties share a place. Lowest wins.
  function buildRankings(cards, netByPlayer) {
    const rows = [];
    (cards || []).forEach(c => {
      const nb = netByPlayer.get(norm(c.player));
      if (!nb) return;
      const expected = c.hole_count === 9 ? 9 : 18;
      const grossHoles = nb.gross.filter(g => typeof g === 'number' && g > 0);
      const netHoles = nb.holes.filter(v => v != null);
      if (grossHoles.length !== expected || netHoles.length !== expected) return;
      rows.push({ player: c.player, gross: grossHoles.reduce((a, b) => a + b, 0), net: netHoles.reduce((a, b) => a + b, 0), strokes: nb.strokes });
    });
    const place = (list, key) => {
      const sorted = list.slice().sort((a, b) => a[key] - b[key] || a.player.localeCompare(b.player));
      return sorted.map((r, i) => {
        const firstSame = sorted.findIndex(x => x[key] === r[key]);
        const tied = sorted.filter(x => x[key] === r[key]).length > 1;
        return { player: r.player, place: firstSame + 1, tied, total: r[key], gross: r.gross, strokes: r.strokes };
      });
    };
    return { gross: place(rows, 'gross'), net: place(rows, 'net') };
  }

  // ── Payout ledger shared by every add-on in one close ──────────────────
  // Rounds DOWN to whole dollars on every split; the remainder is reported
  // as unallocated, never silently redistributed (Brian, Dev-87).
  function makeLedger(players) {
    const canonical = new Map(players.map(p => [norm(p), p]));
    const rows = new Map(players.map(p => [p, { player: p, skins: 0, cttp: 0, birdieball: 0, given_back: 0 }]));
    const n = players.length;
    const canon = name => canonical.get(norm(name)) || name;
    const credit = (name, field, amt) => {
      if (!(amt > 0)) return;
      const key = canon(name);
      if (!rows.has(key)) rows.set(key, { player: key, skins: 0, cttp: 0, birdieball: 0, given_back: 0 });
      const row = rows.get(key);
      row[field] = (row[field] || 0) + amt; // birdiepay (Dev-89) is added lazily so pre-existing snapshots keep their exact shape
    };
    const giveBack = pot => {
      if (!(pot > 0) || !n) return { each: 0, unallocated: Math.max(0, pot) };
      const each = Math.floor(pot / n);
      players.forEach(p => credit(p, 'given_back', each));
      return { each, unallocated: pot - each * n };
    };
    return { players, n, canonical, canon, has: name => canonical.has(norm(name)), credit, giveBack, rows };
  }

  // ── Add-on registry ────────────────────────────────────────────────────
  // Each add-on: { id, order, carve(state, addon, inputs) → result }.
  // `order` is the payout pipeline position: fixed carve-outs first, then
  // the residual game (skins) takes whatever pot is left. state carries
  // remaining (pot not yet carved), unallocated, and rollover (money that
  // flows to the residual game, e.g. unclaimed CTP).
  const ADDONS = {
    // Closest to the pin: fixed $ per configured hole to that hole's leader
    // (most-recent claim — the caller passes leaders already resolved).
    // An unclaimed hole's money rolls into the residual game (Skins).
    // Dev-89: a carve-out can never take more than the pot has left. If the
    // configured $/hole × holes is more than that (a small field against a
    // fixed CTP purse), every hole is paid the same reduced amount — floor of
    // what's left ÷ holes — and the result says `capped`. Uncapped results
    // keep their exact prior shape (no new keys).
    cttp: {
      id: 'cttp', order: 10, entity: 'individual',
      carve(state, addon, inputs) {
        const L = state.ledger;
        const configuredPerHole = Number(addon.dollar_per_hole) || 0;
        const holes = (addon.holes || []).slice().sort((a, b) => a - b);
        const avail = Math.max(0, state.remaining);
        const capped = holes.length > 0 && configuredPerHole * holes.length > avail;
        const perHole = capped ? Math.floor(avail / holes.length) : configuredPerHole;
        const leaders = inputs.ctpLeaders;
        let unclaimed = 0;
        const rows = holes.map(h => {
          const lead = leaders && (leaders[h] || leaders[String(h)]);
          if (lead && lead.player) {
            L.credit(lead.player, 'cttp', perHole);
            return { hole: h, player: L.canon(lead.player), dist: lead.dist ?? null, paid: perHole };
          }
          unclaimed += perHole;
          return { hole: h, player: null, dist: null, paid: 0 };
        });
        state.remaining -= perHole * holes.length;
        state.rollover += unclaimed;
        return Object.assign(
          { per_hole: capped ? configuredPerHole : perHole, holes: rows, unclaimed_to_skins: unclaimed },
          capped ? { capped: true, paid_per_hole: perHole } : {}
        );
      }
    },

    // BirdieBall: $ per player × N. Everyone who kept it splits it; if
    // nobody kept it, whoever held it longest (latest lost_hole, then
    // lost_stroke) wins, ties split; no answers at all → given back.
    // Only answers from players who turned in a card count.
    birdieball: {
      id: 'birdieball', order: 20, entity: 'individual',
      carve(state, addon, inputs) {
        const L = state.ledger;
        const configuredPot = (Number(addon.dollar_per_player) || 0) * L.n;
        // Dev-89: never more than the pot has left (after CTP). Only reported when it bites.
        const pot = Math.min(configuredPot, Math.max(0, state.remaining));
        const capped = pot < configuredPot;
        state.remaining -= pot;
        const answers = (inputs.bbAnswers || []).filter(a => L.has(a.player_name));
        const kept = answers.filter(a => a.kept);
        let mode, winners;
        if (kept.length) {
          mode = 'kept';
          winners = kept.map(a => L.canonical.get(norm(a.player_name)));
        } else {
          const lost = answers.filter(a => !a.kept && a.lost_hole != null);
          if (lost.length) {
            mode = 'longest';
            const score = a => (Number(a.lost_hole) || 0) * 100 + (Number(a.lost_stroke) || 0);
            const best = Math.max(...lost.map(score));
            winners = lost.filter(a => score(a) === best).map(a => L.canonical.get(norm(a.player_name)));
          } else {
            mode = 'none';
            winners = [];
          }
        }
        let perWinner = 0, unalloc = 0, givenBackEach = 0;
        if (winners.length) {
          perWinner = Math.floor(pot / winners.length);
          winners.forEach(w => L.credit(w, 'birdieball', perWinner));
          unalloc = pot - perWinner * winners.length;
        } else {
          const gb = L.giveBack(pot);
          givenBackEach = gb.each; unalloc = gb.unallocated;
        }
        state.unallocated += unalloc;
        const longest = mode === 'longest'
          ? answers.filter(a => winners.includes(L.canonical.get(norm(a.player_name))))[0]
          : null;
        // Every player's status, so the result card can show the whole story (kept / lost where / no answer).
        const byName = new Map(answers.map(a => [norm(a.player_name), a]));
        const roster = [...L.rows.values()].map(r => {
          const a = byName.get(norm(r.player));
          const status = !a ? 'none' : (a.kept ? 'kept' : 'lost');
          return { player: r.player, status,
            hole: status === 'lost' && a.lost_hole != null ? a.lost_hole : null,
            stroke: status === 'lost' && a.lost_stroke != null ? a.lost_stroke : null,
            won: winners.includes(r.player) };
        });
        return Object.assign({
          pot, mode, winners, per_winner: perWinner, given_back_each: givenBackEach,
          longest_hole: longest ? longest.lost_hole : null, longest_stroke: longest ? longest.lost_stroke : null,
          players: roster
        }, capped ? { capped: true, configured_pot: configuredPot } : {});
      }
    },

    // Birdie Payouts (Dev-89): a flat $ per birdie-or-better, paid to whoever
    // made it, taken out of the SAME buy-in pot before Skins (Skins gets what
    // is left). Birdie = gross strokes at least 1 under that hole's par; an
    // eagle or better is still ONE payout (flat, not scaled). Pars come from
    // the add-on's own frozen `pars` (18 numbers, saved from the venue when
    // the host set the game up) — never guessed; no par table → pays nothing
    // and says so. A 9-hole back-nine card (hole_count 9 + hole_half 'back')
    // reads pars 10-18. If the birdies would cost more than the pot has left,
    // every birdie is paid the same reduced amount (floor of what's left ÷
    // birdies) rather than favoring whoever birdied first; the shortfall is
    // reported as `capped`. Whatever a cap leaves stays with Skins.
    birdiepay: {
      id: 'birdiepay', order: 30, entity: 'individual',
      carve(state, addon, inputs) {
        const L = state.ledger;
        const per = Number(addon.dollar_per_birdie) || 0;
        const pars = Array.isArray(addon.pars) ? addon.pars : [];
        const okPars = a => Array.isArray(a) && a.length === 18 && a.every(p => Number(p) > 0);
        const havePars = okPars(pars);
        // v1.17.0: pars_by_player = each player's own tee's pars (tees of one course do not all share a par
        // layout). A player without an entry is judged against the round's default `pars`.
        const byPlayer = new Map();
        if (addon.pars_by_player && typeof addon.pars_by_player === 'object') {
          Object.keys(addon.pars_by_player).forEach(k => { if (okPars(addon.pars_by_player[k])) byPlayer.set(norm(k), addon.pars_by_player[k]); });
        }
        const net = addon.basis === 'net';
        const birdies = [];
        if (havePars || byPlayer.size) {
          (inputs.scorecards || []).forEach(c => {
            const cPars = byPlayer.get(norm(c.player)) || (havePars ? pars : null);
            if (!cPars) return;
            const holes = Array.isArray(c.holes) ? c.holes : [];
            const off = (c.hole_count === 9 && c.hole_half === 'back') ? 9 : 0;
            // Dev-91: basis 'net' judges the birdie on gross − strokes received
            // (a par with a stroke is a net birdie; eagles are still ONE payout).
            const nc = net && inputs.netByPlayer ? inputs.netByPlayer.get(norm(c.player)) : null;
            holes.forEach((strokes, i) => {
              const par = Number(cPars[off + i]);
              if (!(typeof strokes === 'number' && strokes > 0 && par > 0)) return;
              if (!net) {
                if (strokes <= par - 1) birdies.push({ hole: off + i + 1, player: L.canon(c.player), strokes, par });
              } else {
                const received = nc ? nc.received[i] : 0;
                const netScore = strokes - received;
                if (netScore <= par - 1) birdies.push({ hole: off + i + 1, player: L.canon(c.player), strokes, par, net: netScore, received });
              }
            });
          });
        }
        const count = birdies.length;
        const owed = per * count;
        const avail = Math.max(0, state.remaining);
        const capped = owed > avail;
        const paidEach = !count ? 0 : capped ? Math.floor(avail / count) : per;
        birdies.forEach(b => { b.paid = paidEach; L.credit(b.player, 'birdiepay', paidEach); });
        const totalPaid = paidEach * count;
        state.remaining -= totalPaid;
        return {
          per_birdie: per, count, paid_each: paidEach, total_paid: totalPaid,
          capped, shortfall: capped ? owed - totalPaid : 0,
          no_par_data: !havePars && !byPlayer.size, birdies,
          ...(net ? { basis: 'net' } : {})
        };
      }
    },

    // Skins — the residual game: takes everything not carved out above,
    // plus rollover. $/skin = pot ÷ skins won (round down); zero skins won
    // → pot given back evenly.
    skins: {
      id: 'skins', order: 90, entity: 'individual', residual: true,
      carve(state, addon, inputs) {
        const L = state.ledger;
        const pot = Math.max(0, state.remaining) + state.rollover;
        state.remaining = 0; state.rollover = 0;
        const net = addon.basis === 'net' && inputs.netByPlayer;
        let won;
        if (net) {
          // Dev-91: lowest NET outright. A tie at the best net is no skin.
          const grossBy = new Map(inputs.scorecards.map(c => [norm(c.player), c]));
          const netCards = inputs.scorecards.map(c => ({ player: c.player, holes: (inputs.netByPlayer.get(norm(c.player)) || { holes: c.holes }).holes }));
          won = skinsWon(netCards, 'low', { net: true }).map(w => {
            const nc = inputs.netByPlayer.get(norm(w.player));
            const g = grossBy.get(norm(w.player));
            return { hole: w.hole, player: w.player, strokes: w.strokes, net: w.strokes,
              gross: g && Array.isArray(g.holes) ? g.holes[w.hole - 1] : null,
              received: nc ? nc.received[w.hole - 1] : 0 };
          });
        } else {
          won = skinsWon(inputs.scorecards, addon.compare || 'low');
        }
        let perSkin = 0, givenBackEach = 0, unalloc = 0;
        if (won.length) {
          perSkin = Math.floor(pot / won.length);
          won.forEach(w => L.credit(w.player, 'skins', perSkin));
          unalloc = pot - perSkin * won.length;
        } else {
          const gb = L.giveBack(pot);
          givenBackEach = gb.each; unalloc = gb.unallocated;
        }
        state.unallocated += unalloc;
        return { pot, won, per_skin: perSkin, given_back_each: givenBackEach, basis: net ? 'net' : (addon.basis || 'gross') };
      }
    }
  };

  // ── BestBall (Dev-93): better ball of partners ─────────────────────────
  // Each partner plays their own ball; a pair's score on a hole is the LOWER of its two scores.
  // This is the base mechanic only — the same per-pair hole scores later feed the Cup's
  // head-to-head layer (1 / ½ / 0 points). cards = one array of per-hole scores per partner
  // (number | null, already gross or net). Returns [{score, by:[partner index]} | null] per hole.
  function betterBallHoles(cards, holeCount) {
    const out = [];
    for (let h = 0; h < holeCount; h++) {
      const vals = cards.map((c, i) => ({ v: Array.isArray(c) ? c[h] : null, i })).filter(e => typeof e.v === 'number');
      if (!vals.length) { out.push(null); continue; }
      const best = Math.min(...vals.map(e => e.v));
      out.push({ score: best, by: vals.filter(e => e.v === best).map(e => e.i) });
    }
    return out;
  }
  // ── Scoring periods (Dev-93) ──────────────────────────────────────────────
  // A game's pot can be played as ONE contest over the whole round ('round') or cut into periods chosen at setup:
  // 'front_back' = Front 9 / Back 9, 'fbt' = Front 9 / Back 9 / Total 18, 'sixes' = holes 1-6 / 7-12 / 13-18.
  // Each period is its own pot (the per-player ante is split evenly across the periods). A period is won on
  // 'strokes' (lower total) or 'holes' (more holes won head to head, which needs two sides who played each other,
  // so it forces scope 'group'). A tied period is a push: everyone's ante comes back.
  // To offer another period (3 x 6, a back-9-only game, ...) add one entry here and one name to PERIOD_ORDER:
  // the picker, the plan, the pot split and the results text all read this table.
  const _SEG = {
    front: { key: 'front', label: 'Front 9', a: 0, b: 9 }, back: { key: 'back', label: 'Back 9', a: 9, b: 18 }, total: { key: 'total', label: 'Total', a: 0, b: 18 },
    s1: { key: 's1', label: 'Holes 1-6', a: 0, b: 6 }, s2: { key: 's2', label: 'Holes 7-12', a: 6, b: 12 }, s3: { key: 's3', label: 'Holes 13-18', a: 12, b: 18 }
  };
  const PERIODS = {
    round: { label: 'Entire round', summary: 'One pot for the whole round', phrase: 'one pot over the whole round', segs: [] },
    front_back: { label: 'Front / Back', summary: 'Front 9 and Back 9, each its own pot', phrase: 'Front 9 and Back 9', segs: [_SEG.front, _SEG.back] },
    fbt: { label: 'Front / Back / Total', summary: 'Front 9, Back 9 and Total, each its own pot', phrase: 'Front 9, Back 9 and Total', segs: [_SEG.front, _SEG.back, _SEG.total] },
    sixes: { label: '6 / 6 / 6', summary: 'Holes 1-6, 7-12 and 13-18, each its own pot', phrase: 'Holes 1-6, 7-12 and 13-18', segs: [_SEG.s1, _SEG.s2, _SEG.s3] }
  };
  const PERIOD_ORDER = ['round', 'front_back', 'fbt', 'sixes'];
  // The period a config asks for. Reads the new `period` field, falling back to the older `segments` field
  // ('total' was the old name for the whole round). Anything unknown plays as the whole round.
  function periodKey(cfg) {
    const raw = cfg && (cfg.period != null ? cfg.period : cfg.segments);
    const k = raw === 'total' ? 'round' : raw;
    return PERIODS[k] ? k : 'round';
  }
  function periodList() { return PERIOD_ORDER.map(k => ({ key: k, label: PERIODS[k].label, summary: PERIODS[k].summary, segments: PERIODS[k].segs.length })); }
  function fourballSegmentPlan(addon) {
    const a = addon || {};
    const pk = periodKey(a);
    const win_by = a.win_by === 'holes' ? 'holes' : 'strokes';
    const scope = win_by === 'holes' || a.scope === 'group' ? 'group' : 'field';
    return { period: pk, mode: pk === 'round' ? 'total' : pk, win_by, scope, segs: PERIODS[pk].segs };
  }
  // One segment between pairs. scoreArrs = one 18-slot better-ball array per pair (null = not played).
  function fourballSegmentResult(scoreArrs, seg, winBy) {
    const n = seg.b - seg.a;
    const info = scoreArrs.map(arr => {
      let played = 0, total = 0;
      for (let i = seg.a; i < seg.b; i++) if (typeof arr[i] === 'number') { played++; total += arr[i]; }
      return { played, total, complete: played === n };
    });
    const out = { info, status: 'pending', winner: null, won: null, halved: null };
    if (scoreArrs.length === 2) {
      let w0 = 0, w1 = 0, h = 0;
      for (let i = seg.a; i < seg.b; i++) {
        const x = scoreArrs[0][i], y = scoreArrs[1][i];
        if (typeof x !== 'number' || typeof y !== 'number') continue;
        if (x < y) w0++; else if (x > y) w1++; else h++;
      }
      out.won = [w0, w1]; out.halved = h;
    }
    if (winBy === 'holes') {
      if (scoreArrs.length !== 2 || !info.every(x => x.complete)) return out;
      if (out.won[0] === out.won[1]) out.status = 'push';
      else { out.status = 'won'; out.winner = out.won[0] > out.won[1] ? 0 : 1; }
      return out;
    }
    const elig = info.map((x, i) => ({ i, t: x.total })).filter(e => info[e.i].complete);
    if (elig.length < 2) return out;
    const low = Math.min(...elig.map(e => e.t));
    const best = elig.filter(e => e.t === low);
    if (best.length > 1) out.status = 'push';
    else { out.status = 'won'; out.winner = best[0].i; }
    return out;
  }

  // BestBall standalone: pairs are ranked on their better-ball total (lowest wins); the winning
  // pair(s) split a $/player carve, ties split, whole dollars rounded down, remainder reported.
  //   addon: { dollar_per_player, basis:'gross'|'net', net_mode:'own'|'low', pairs:[[a,b],…] }
  // net 'own'  = every player's own allowance-adjusted strokes (same rule as Skins Net);
  // net 'low'  = strokes come off the lowest handicap among the paired players.
  // A pair is ranked once every hole has at least one partner score (a pickup lets the other
  // partner's score stand alone); an incomplete pair is listed but cannot win. Like MiserBall it
  // can never take more than the pot has left (reported as `capped`).
  // Match Play segment between two players (Dev-94). scoreArrs = two 18-slot score arrays (net if the game is net).
  // Holes are compared in order; a side wins the moment it leads by more holes than are left (3&2). A segment that
  // is not decided early is won by whoever leads after the last hole, level = halved (a push). `won`/`halved`
  // stop counting at the point the match was decided.
  function matchSegmentResult(scoreArrs, seg) {
    const base = fourballSegmentResult(scoreArrs, seg, 'holes');
    const total = seg.b - seg.a;
    let lead = 0, scored = 0, w0 = 0, w1 = 0, halved = 0, decided = null;
    for (let i = seg.a; i < seg.b; i++) {
      const x = scoreArrs[0][i], y = scoreArrs[1][i];
      if (typeof x !== 'number' || typeof y !== 'number') continue;
      if (decided) { scored++; continue; }
      scored++;
      if (x < y) { w0++; lead++; } else if (x > y) { w1++; lead--; } else halved++;
      if (Math.abs(lead) > total - scored) decided = { left: total - scored, lead };
    }
    const out = Object.assign({}, base, { won: [w0, w1], halved, thru: scored, lead: decided ? decided.lead : lead });
    if (decided) {
      out.status = 'won'; out.winner = decided.lead > 0 ? 0 : 1; out.decided = true;
      out.text = decided.left > 0 ? Math.abs(decided.lead) + '&' + decided.left : Math.abs(decided.lead) + ' UP';
    } else if (scored >= total) {
      out.decided = true;
      if (lead === 0) { out.status = 'push'; out.text = 'Halved'; } else { out.status = 'won'; out.winner = lead > 0 ? 0 : 1; out.text = Math.abs(lead) + ' UP'; }
    } else {
      out.status = 'pending'; out.decided = false;
      out.text = scored === 0 ? 'Not started' : (lead === 0 ? 'All square' : Math.abs(lead) + ' UP') + ' thru ' + scored;
    }
    return out;
  }

  // Hi-Lo (Dev-94): two pairs head to head, each partner plays their own ball. Every hole is worth 2 points:
  // 1 for the LOW ball (the better of a pair's two scores) and 1 for the HIGH ball (the worse of the two); the
  // lower of each pair's lows / highs takes that point, a tie in either leaves the point with nobody.
  // hiloHoles: per hole, a pair needs both partners' scores. Returns [{ score: low, high, by }] (null when a score is missing).
  function hiloHoles(cards, holeCount) {
    const out = [];
    for (let h = 0; h < holeCount; h++) {
      const v = cards.map(c => (Array.isArray(c) ? c[h] : null));
      if (v.length < 2 || !v.every(x => typeof x === 'number')) { out.push(null); continue; }
      const low = Math.min(...v), high = Math.max(...v);
      out.push({ score: low, high, by: v.map((x, i) => (x === low ? i : -1)).filter(i => i >= 0) });
    }
    return out;
  }
  // One segment between two pairs. sides = [{ lo:[18], hi:[18] }, { lo, hi }]. `won` = points for each side,
  // `halved` = points nobody got. Decided once every hole of the segment is in.
  function hiloSegmentResult(sides, seg) {
    const total = seg.b - seg.a;
    const pts = [0, 0];
    let scored = 0, nobody = 0;
    for (let i = seg.a; i < seg.b; i++) {
      const g = sides.map(s => [s.lo[i], s.hi[i]]);
      if (!g.every(p => typeof p[0] === 'number' && typeof p[1] === 'number')) continue;
      scored++;
      [0, 1].forEach(k => {
        if (g[0][k] < g[1][k]) pts[0]++; else if (g[0][k] > g[1][k]) pts[1]++; else nobody++;
      });
    }
    const lead = pts[0] - pts[1];
    const out = { info: pts.map(p => ({ played: scored, total: p, complete: scored === total })), status: 'pending', winner: null,
      won: pts, halved: nobody, thru: scored, lead, points: true };
    if (scored >= total) {
      out.decided = true;
      if (lead === 0) { out.status = 'push'; out.text = 'Halved'; }
      else { out.status = 'won'; out.winner = lead > 0 ? 0 : 1; out.text = Math.max(pts[0], pts[1]) + '–' + Math.min(pts[0], pts[1]); }
    } else {
      out.decided = false;
      out.text = scored === 0 ? 'Not started' : (lead === 0 ? 'All square' : Math.abs(lead) + ' UP') + ' thru ' + scored;
    }
    return out;
  }

  // ── Scramble helpers (v4.48.0, xMan Scramble: teams of 1 to 4) ───────────────────────────────────────
  // A team's strokes from its players' COURSE handicaps (or the strokes the host gave them). Three host-picked methods:
  //   ranked    the players ranked lowest handicap first, each takes a % of their own handicap (pct_1 = lowest ... pct_4).
  //             Usual defaults: 2-man 35/15, 3-man 20/15/10, 4-man 25/20/15/10, 1-man 100
  //   combined  allowance% of all the handicaps added together (default 25 / 15 / 18 for 2 / 3 / 4, 100 for 1)
  //   none      scratch
  const SCRAMBLE_PCTS = { 1: [100], 2: [35, 15], 3: [20, 15, 10], 4: [25, 20, 15, 10] };
  const SCRAMBLE_COMBINED = { 1: 100, 2: 25, 3: 15, 4: 18 };
  function scrambleSize(addon) { const n = Math.trunc(Number(addon && addon.team_size)); return n >= 1 && n <= 4 ? n : 2; }
  function scrambleMethod(addon) { return addon && addon.hcp_method === 'combined' ? 'combined' : addon && addon.hcp_method === 'none' ? 'none' : 'ranked'; }
  function scramblePcts(addon) {
    const n = scrambleSize(addon), a = addon || {};
    return SCRAMBLE_PCTS[n].map((d, i) => { const v = a['pct_' + (i + 1)]; return v != null && v !== '' && Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : d; });
  }
  function scrambleCombinedPct(addon) {
    const v = addon && addon.allowance;
    return v != null && v !== '' && Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : SCRAMBLE_COMBINED[scrambleSize(addon)];
  }
  function scrambleTeamStrokes(addon, hcps) {
    const hs = (hcps || []).map(Number).filter(Number.isFinite).sort((x, y) => x - y);
    if (!hs.length) return 0;
    const method = scrambleMethod(addon);
    if (method === 'none') return 0;
    if (method === 'combined') return Math.round(hs.reduce((t, v) => t + v, 0) * scrambleCombinedPct(addon) / 100);
    const pc = scramblePcts(addon);
    return Math.round(hs.reduce((t, v, i) => t + v * (pc[i] != null ? pc[i] : 0) / 100, 0));
  }
  // Stableford points for one hole from the score against par. 'bf' is BirdieFriends' own table (birdie 4, the "birdie premium");
  // 'standard' is the usual 3 / 4 / 5. Bogey 1, par 2, double bogey or worse 0 in both.
  function stablefordHolePoints(diff, scale) {
    if (!Number.isFinite(diff)) return null;
    if (diff >= 2) return 0;
    if (diff === 1) return 1;
    if (diff === 0) return 2;
    if (scale === 'standard') return diff === -1 ? 3 : diff === -2 ? 4 : 5;
    return diff === -1 ? 4 : diff === -2 ? 6 : 8;
  }
  const SCRAMBLE_SPLITS = { winner: [100], top2: [65, 35], top3: [50, 30, 20] };

  // Dev-94: the same engine now plays four formats, told apart by `kind`:
  //   'hilo'     (id hilo)      two pairs head to head, own balls: low ball vs low ball and high ball vs high ball, 1 point each
  //   'bestball' (id fourball)  pairs, the better ball of the two counts (unchanged)
  //   'altshot'  (id altshot)   pairs, ONE ball per pair so one score per hole; the pair's strokes are a % of the two
  //                              course handicaps added together (`allowance`, default 50)
  //   'scramble' (id scramble)  v4.48.0 Teams of 2: ONE ball per team (both hit, play the best shot, repeat), one score a hole,
  //                              whole round only. `scoring` 'strokes' (lowest total) or 'stableford' (most points; needs `pars`);
  //                              the team handicap is `hcp_method`: 'low_high' (low_pct of the lower + high_pct of the higher course
  //                              handicap, 35/15), 'combined' (allowance% of the two added, 25) or 'none'. `payout` winner/top2/top3.
  //   'match'    (id matchplay) head to head, one player a side, always hole by hole; the winner is announced the
  //                              moment the match is decided (3&2) but they may play on, and the money follows the
  //                              decided result. `matches: [[a,b],…]`. `allowance` is the % of each course handicap.
  // `net_mode` 'own' = everyone's own strokes ("Full"), 'low' = off the lowest in the match. A pot of $0 is allowed
  // for altshot and matchplay (bragging rights / the loser buys at the pub): nothing moves, the result still shows.
  function sideFormatCarve(kind, state, addon, inputs) {
      const L = state.ledger;
      const gid = kind === 'bestball' ? 'fourball' : kind === 'altshot' ? 'altshot' : kind === 'scramble' ? 'scramble' : kind === 'hilo' ? 'hilo' : 'matchplay';
      const perPlayerBalls = kind === 'bestball' || kind === 'hilo';   // each partner plays their own ball (no shared side score)
      const headToHead = kind === 'match' || kind === 'hilo';
      const ownAllowance = kind === 'altshot' || kind === 'match' || kind === 'scramble';
      const size = kind === 'match' ? 1 : kind === 'scramble' ? scrambleSize(addon) : 2;
      const cardBy = new Map((inputs.scorecards || []).map(c => [norm(c.player), c]));
      const pairsCfg = kind === 'match'
        ? [].concat(...(addon.matches || []).filter(m => Array.isArray(m) && m.length === 2).map(m => [[m[0]], [m[1]]]))
        : (addon.pairs || []).filter(p => Array.isArray(p) && p.length === size);
      const wantNet = addon.basis === 'net';
      const mode = addon.net_mode === 'low' ? 'low' : 'own';
      const netOk = wantNet && !!inputs.netByPlayer && !!inputs.hcSpecs;
      const strokesOf = nm => { const sp = netOk ? inputs.hcSpecs.get(norm(nm)) : null; return sp && Number.isFinite(Number(sp.strokes)) ? Math.trunc(Number(sp.strokes)) : 0; };
      let lowStrokes = 0;
      if (netOk && mode === 'low') {
        const ss = [];
        pairsCfg.forEach(p => p.forEach(nm => { if (cardBy.has(norm(nm))) ss.push(strokesOf(nm)); }));
        lowStrokes = ss.length ? Math.min(...ss) : 0;
      }
      // Hi-Lo is played foursome against foursome, so "off the low" means the lowest handicap in YOUR foursome
      const lowOf = nm => {
        if (kind !== 'hilo') return lowStrokes;
        const i = pairsCfg.findIndex(p => p.some(x => norm(x) === norm(nm)));
        if (i < 0) return lowStrokes;
        const base = i - (i % 2), ss = [];
        [pairsCfg[base], pairsCfg[base + 1]].forEach(p => (p || []).forEach(x => { if (cardBy.has(norm(x))) ss.push(strokesOf(x)); }));
        return ss.length ? Math.min(...ss) : 0;
      };
      const gross = c => (Array.isArray(c.holes) ? c.holes : []).map(v => (typeof v === 'number' && v > 0 ? v : null));
      // Alternate Shot / Match Play strokes: a % of the course handicap (index players), the given strokes otherwise.
      const pct = ownAllowance && addon.allowance != null && addon.allowance !== '' && Number.isFinite(Number(addon.allowance)) ? Number(addon.allowance) : (kind === 'altshot' ? 50 : kind === 'scramble' ? scrambleCombinedPct(addon) : null);
      const specOf = nm => (netOk && inputs.hcSpecs.get(norm(nm))) || {};
      const courseOf = nm => { const sp = specOf(nm); return sp.kind === 'index' && Number.isFinite(Number(sp.course_hcp)) ? Number(sp.course_hcp) : null; };
      const playerStrokes = nm => { const c = courseOf(nm); return pct != null && c != null ? Math.round(c * pct / 100) : strokesOf(nm); };
      const sideStrokes = side => {
        if (kind === 'scramble') return scrambleTeamStrokes(addon, side.map(nm => (courseOf(nm) != null ? courseOf(nm) : strokesOf(nm))));
        if (kind !== 'altshot') return side.reduce((a, nm) => a + playerStrokes(nm), 0);
        const sum = side.reduce((a, nm) => a + (courseOf(nm) != null ? courseOf(nm) : strokesOf(nm)), 0);
        return Math.round(sum * (pct != null ? pct : 100) / 100);
      };
      const sideCard = side => {
        const cs = side.map(nm => cardBy.get(norm(nm))).filter(Boolean);
        if (!cs.length) return null;
        if (size === 1) return cs[0];
        // one ball per side: the side's score on a hole is whatever its card(s) carry (both partners' cards carry the same score)
        const n = Math.max(...cs.map(c => (c.holes || []).length));
        const holes = Array.from({ length: n }, (_, h) => { const v = cs.map(c => c.holes && c.holes[h]).find(x => typeof x === 'number' && x > 0); return v == null ? null : v; });
        return { player: side.join(' & '), holes, hole_count: cs[0].hole_count, hole_half: cs[0].hole_half };
      };
      const sideEff = (side, i) => {
        const mine = sideStrokes(side);
        if (mode !== 'low') return mine;
        const field = kind !== 'match' && fourballSegmentPlan(addon).scope === 'field';
        const base = i - (i % 2);
        const grp = (field ? pairsCfg : [pairsCfg[base], pairsCfg[base + 1]]).filter(sd => sd && sideCard(sd));
        return mine - (grp.length ? Math.min(...grp.map(sideStrokes)) : 0);
      };
      const sideNet = (side, i) => { const c = sideCard(side); return c ? netCard(c, Object.assign({}, specOf(side[0]), { strokes: sideEff(side, i) }), inputs.hcSI) : null; };
      const sideHoles = (side, i) => {
        const c = sideCard(side); if (!c) return null;
        return netOk ? sideNet(side, i).holes : gross(c);
      };
      const holesFor = nm => {
        const c = cardBy.get(norm(nm));
        if (!c) return null;
        if (!netOk) return gross(c);
        if (mode === 'own') { const nb = inputs.netByPlayer.get(norm(nm)); return nb ? nb.holes : gross(c); }
        const sp = inputs.hcSpecs.get(norm(nm)) || {};
        return netCard(c, Object.assign({}, sp, { strokes: strokesOf(nm) - lowOf(nm) }), inputs.hcSI).holes;
      };
      // Which holes each player got a stroke on (after Off the low), so results can show who benefited and where.
      const marksFor = nm => {
        const c = cardBy.get(norm(nm)); if (!c) return null;
        const eff = strokesOf(nm) - (mode === 'low' ? lowOf(nm) : 0);
        const nc = netCard(c, Object.assign({}, inputs.hcSpecs.get(norm(nm)) || {}, { strokes: eff }), inputs.hcSI);
        const off = c.hole_count === 9 && c.hole_half === 'back' ? 9 : 0;
        const got = {}; nc.received.forEach((k, i) => { if (k) got[off + i + 1] = k; });
        return { player: L.canon(nm), strokes: eff, got };
      };
      const sideMarks = (side, i) => {
        const nc = sideNet(side, i); if (!nc) return null;
        const c = sideCard(side); const off = c.hole_count === 9 && c.hole_half === 'back' ? 9 : 0;
        const got = {}; nc.received.forEach((k, h) => { if (k) got[off + h + 1] = k; });
        return { player: side.map(nm => L.canon(nm)).join(' & '), strokes: nc.strokes, got };
      };
      const stroke_marks = !netOk ? null : perPlayerBalls
        ? [...new Set(pairsCfg.flat().map(norm))].map(k => pairsCfg.flat().find(n => norm(n) === k)).map(marksFor).filter(Boolean)
        : pairsCfg.map(sideMarks).filter(Boolean);
      // Scramble can score Stableford: points a hole from the team's (net or gross) score against par. Pars are frozen into the
      // config at setup; without them nobody can finish, so the pot is given back and the result says why (par_missing).
      const stable = kind === 'scramble' && addon.scoring === 'stableford';
      const scale = addon.scale === 'standard' ? 'standard' : 'bf';
      const stablePars = stable && Array.isArray(addon.pars) && addon.pars.length === 18 && addon.pars.every(p => Number(p) >= 3) ? addon.pars.map(Number) : null;
      const rows = pairsCfg.map((pr, si) => {
        const names = pr.map(nm => L.canon(nm));
        const arrs = perPlayerBalls ? pr.map(holesFor).filter(a => a) : [sideHoles(pr, si)].filter(a => a);
        const cards = pr.map(nm => cardBy.get(norm(nm))).filter(Boolean);
        const expected = cards.some(c => c.hole_count === 9) ? 9 : 18;
        const off = cards.some(c => c.hole_count === 9 && c.hole_half === 'back') ? 9 : 0;
        const bb = arrs.length ? (kind === 'hilo' ? (arrs.length === 2 ? hiloHoles(arrs, expected) : []) : betterBallHoles(arrs, expected)) : [];
        const played = bb.filter(Boolean).length;
        const complete = arrs.length > 0 && played === expected && (!stable || !!stablePars);
        if (stable) {
          const pts = bb.map((h, i) => (h && stablePars ? stablefordHolePoints(h.score - stablePars[off + i], scale) : null));
          return {
            pair: names, complete, played,
            total: complete ? pts.reduce((a, v) => a + v, 0) : null,
            holes: bb.map((h, i) => ({ hole: off + i + 1, score: pts[i], shot: h ? h.score : null, par: stablePars ? stablePars[off + i] : null, by: h ? h.by.map(ix => names[ix]) : [] }))
          };
        }
        return {
          pair: names, complete, played,
          total: complete ? bb.reduce((a, h) => a + h.score, 0) : null,
          holes: bb.map((h, i) => ({ hole: off + i + 1, score: h ? h.score : null, ...(kind === 'hilo' ? { high: h ? h.high : null } : {}), by: h ? h.by.map(ix => names[ix]) : [] }))
        };
      });
      if (kind === 'scramble' && Array.isArray(addon.names)) {   // team names ride along, parallel to `pairs` as saved
        const key = pr => pr.map(norm).sort().join('|'), nameBy = new Map();
        (addon.pairs || []).forEach((pr, i) => { const nm = addon.names[i]; if (Array.isArray(pr) && typeof nm === 'string' && nm.trim()) nameBy.set(key(pr), nm.trim()); });
        rows.forEach((r, i) => { const nm = nameBy.get(key(pairsCfg[i])); if (nm) r.name = nm; });
      }
      let plan = fourballSegmentPlan(kind === 'scramble' ? {} : addon);   // a scramble is one whole-round contest for the field
      const nineRound = pairsCfg.some(pr => pr.some(nm => { const c = cardBy.get(norm(nm)); return c && c.hole_count === 9; }));
      const nineOff = pairsCfg.some(pr => pr.some(nm => { const c = cardBy.get(norm(nm)); return c && c.hole_count === 9 && c.hole_half === 'back'; })) ? 9 : 0;
      if (headToHead) {
        // always hole by hole between the two sides of a match; the whole-round match is one segment
        const whole = nineRound ? [{ key: 'match', label: 'Match', a: nineOff, b: nineOff + 9 }] : [{ key: 'match', label: 'Match', a: 0, b: 18 }];
        plan = { period: plan.period, mode: plan.period === 'round' || nineRound ? 'match' : plan.period, win_by: kind === 'hilo' ? 'points' : 'holes', scope: 'group', segs: plan.period === 'round' || nineRound ? whole : plan.segs };
      }
      // participants: the whole round antes into BestBall; Alternate Shot and Match Play only the people in a side
      const nPlay = kind === 'bestball' ? L.n : pairsCfg.length * size;
      const everyoneIn = kind === 'bestball' ? L.players.slice() : pairsCfg.flat().map(nm => L.canon(nm));
      const giveBackTo = (names, amt) => { const back = names.length ? Math.floor(amt / names.length) : 0; names.forEach(nm => L.credit(nm, 'given_back', back)); return { each: back, unallocated: amt - back * names.length }; };
      if (plan.mode !== 'total' && (headToHead || !nineRound) && rows.length >= 2) {
        const scoresOf = r => { const a = new Array(18).fill(null); r.holes.forEach(h => { if (h.score != null) a[h.hole - 1] = h.score; }); return a; };
        const arrs = rows.map(scoresOf);
        const hiArrs = kind === 'hilo' ? rows.map(r => { const a = new Array(18).fill(null); r.holes.forEach(h => { if (h.high != null) a[h.hole - 1] = h.high; }); return a; }) : null;
        const idxs = rows.map((_, i) => i);
        const groupIdx = plan.scope === 'group' ? idxs.reduce((acc, i) => { (i % 2 === 0 ? acc.push([i]) : acc[acc.length - 1].push(i)); return acc; }, []) : [idxs];
        const configuredPot2 = (Number(addon.dollar_per_player) || 0) * nPlay;
        const pot2 = Math.min(configuredPot2, Math.max(0, state.remaining));
        const capped2 = pot2 < configuredPot2;
        const ratio = configuredPot2 > 0 ? pot2 / configuredPot2 : 0;
        const perSeg = ((Number(addon.dollar_per_player) || 0) / plan.segs.length) * ratio;
        state.remaining -= pot2;
        let used = 0, unalloc2 = 0;
        const wonBy = new Map();
        const groups = groupIdx.map((gi, gn) => {
          const gPlayers = plan.scope === 'group' ? gi.length * size : nPlay;
          const gNames = plan.scope === 'group' ? gi.reduce((a, i) => a.concat(rows[i].pair), []) : everyoneIn;
          const segsOut = plan.segs.map(sg => {
            const pot = Math.floor(perSeg * gPlayers);
            const res = kind === 'hilo' ? hiloSegmentResult(gi.map(i => ({ lo: arrs[i], hi: hiArrs[i] })), sg) : kind === 'match' ? matchSegmentResult(gi.map(i => arrs[i]), sg) : fourballSegmentResult(gi.map(i => arrs[i]), sg, plan.win_by);
            const seg = { key: sg.key, label: sg.label, from: sg.a + 1, to: sg.b, pot, status: res.status, winner: null,
              ...(res.won ? (res.points ? { points: res.won, nobody: res.halved } : { holes_won: res.won, halved: res.halved }) : {}),
              ...(res.text ? { result: res.text, decided: !!res.decided, thru: res.thru } : {}),
              totals: res.info.map(x => (x.complete ? x.total : null)),
          by: rows.map((r, i) => ({ player: r.player, total: res.info[i] && res.info[i].complete ? res.info[i].total : null })).sort((a, b) => (a.total == null) - (b.total == null) || (res.points ? b.total - a.total : a.total - b.total)) };
            used += pot;
            if (res.status === 'won') {
              const wr = rows[gi[res.winner]];
              seg.winner = wr.pair;
              const each = Math.floor(pot / size);
              wr.pair.forEach(nm => L.credit(nm, gid, each));
              unalloc2 += pot - each * size;
              seg.per_player = each;
              const k = wr.pair.join('|'); wonBy.set(k, (wonBy.get(k) || { pair: wr.pair, n: 0 })); wonBy.get(k).n++;
            } else {
              // push (tie) or not finishable yet: every player in the contest gets this segment's ante back
              const back = gNames.length ? Math.floor(pot / gNames.length) : 0;
              gNames.forEach(nm => L.credit(nm, 'given_back', back));
              unalloc2 += pot - back * gNames.length;
              seg.given_back_each = back;
            }
            return seg;
          });
          return { group: gn + 1, pairs: gi.map(i => rows[i].pair), segments: segsOut };
        });
        unalloc2 += Math.max(0, pot2 - used);
        state.unallocated += unalloc2;
        return Object.assign({
          pairs: rows.map(r => r.pair), pot: pot2, basis: netOk ? 'net' : 'gross', ...(netOk ? { net_mode: mode, stroke_marks } : {}),
          ...(kind !== 'bestball' ? { format: kind, unit: kind === 'match' ? 'match' : kind === 'hilo' ? 'pair' : 'ball', ...(pct != null && netOk ? { allowance: pct } : {}) } : {}),
          ...(wantNet && !netOk ? { net_missing: true } : {}),
          standings: rows.map((r, i) => Object.assign({}, r, { scores: arrs[i], total: r.complete ? r.total : null }))
            .sort((a, b) => (a.total == null) - (b.total == null) || a.total - b.total),
          segments: { mode: plan.mode, win_by: plan.win_by, scope: plan.scope, per_segment: perSeg, groups },
          winners: [...wonBy.values()].map(w => w.pair), per_pair: null, per_player: null, given_back_each: 0
        }, capped2 ? { capped: true, configured_pot: configuredPot2 } : {});
      }
      const cmpTotal = stable ? ((a, b) => b.total - a.total) : ((a, b) => a.total - b.total);   // Stableford: most points wins
      const ranked = rows.filter(r => r.complete).sort(cmpTotal);
      ranked.forEach(r => {
        r.place = ranked.findIndex(x => x.total === r.total) + 1;
        r.tied = ranked.filter(x => x.total === r.total).length > 1;
      });
      const winners = ranked.filter(r => r.place === 1);
      const configuredPot = (Number(addon.dollar_per_player) || 0) * nPlay;
      const pot = Math.min(configuredPot, Math.max(0, state.remaining));
      const capped = pot < configuredPot;
      state.remaining -= pot;
      let perPair = 0, perPlayer = 0, givenBackEach = 0, unalloc = 0;
      let placesOut = null;
      if (kind === 'scramble' && winners.length) {
        // Winner takes all, or the pot over the first places (ties share the places they cover). Places nobody finished are
        // spread over the places that were; everything rounds DOWN to whole dollars and the remainder is reported, not moved.
        const splits = (SCRAMBLE_SPLITS[addon.payout] || SCRAMBLE_SPLITS.winner).slice(0, ranked.length);
        const splitSum = splits.reduce((t, v) => t + v, 0);
        placesOut = [];
        let i = 0;
        while (i < ranked.length && i < splits.length) {
          const grp = ranked.filter(r => r.total === ranked[i].total);
          const share = splits.slice(i, i + grp.length).reduce((t, v) => t + v, 0);
          const each = Math.floor(Math.floor(pot * share / splitSum) / grp.length);
          const eachPlayer = Math.floor(each / size);
          grp.forEach(r => r.pair.forEach(nm => L.credit(nm, gid, eachPlayer)));
          placesOut.push({ place: i + 1, tied: grp.length > 1, pairs: grp.map(r => r.pair), total: grp[0].total, per_pair: each, per_player: eachPlayer });
          i += grp.length;
        }
        unalloc = pot - placesOut.reduce((t, p) => t + p.per_player * size * p.pairs.length, 0);
        perPair = placesOut[0].per_pair; perPlayer = placesOut[0].per_player;
      } else if (winners.length) {
        perPair = Math.floor(pot / winners.length);
        perPlayer = Math.floor(perPair / size);
        winners.forEach(w => w.pair.forEach(nm => L.credit(nm, gid, perPlayer)));
        unalloc = pot - perPlayer * size * winners.length;
      } else {
        const gb = kind === 'bestball' ? L.giveBack(pot) : giveBackTo(everyoneIn, pot);
        givenBackEach = gb.each; unalloc = gb.unallocated;
      }
      state.unallocated += unalloc;
      return Object.assign({
        pairs: rows.map(r => r.pair), pot, basis: netOk ? 'net' : 'gross', ...(netOk ? { net_mode: mode, stroke_marks } : {}),
        ...(kind !== 'bestball' ? { format: kind, unit: kind === 'match' ? 'match' : kind === 'hilo' ? 'pair' : 'ball', ...(pct != null && netOk ? { allowance: pct } : {}) } : {}),
        ...(wantNet && !netOk ? { net_missing: true } : {}),
        standings: rows.slice().sort((a, b) => (a.total == null) - (b.total == null) || (a.total == null ? 0 : cmpTotal(a, b))),
        winners: winners.map(w => w.pair), per_pair: perPair, per_player: perPlayer, given_back_each: givenBackEach,
        ...(kind === 'scramble' ? { scoring: stable ? 'stableford' : 'strokes', ...(stable ? { scale } : {}),
          hcp_method: scrambleMethod(addon), team_size: size,
          payout: SCRAMBLE_SPLITS[addon.payout] ? addon.payout : 'winner', ...(placesOut ? { places: placesOut } : {}),
          ...(stable && !stablePars ? { par_missing: true } : {}) } : {})
      }, capped ? { capped: true, configured_pot: configuredPot } : {});
  }
  ADDONS.fourball = { id: 'fourball', order: 25, entity: 'pair', carve: (state, addon, inputs) => sideFormatCarve('bestball', state, addon, inputs) };
  ADDONS.altshot = { id: 'altshot', order: 25.2, entity: 'pair', carve: (state, addon, inputs) => sideFormatCarve('altshot', state, addon, inputs) };
  ADDONS.scramble = { id: 'scramble', order: 25.1, entity: 'pair', carve: (state, addon, inputs) => sideFormatCarve('scramble', state, addon, inputs) };
  ADDONS.hilo = { id: 'hilo', order: 25.3, entity: 'pair', carve: (state, addon, inputs) => sideFormatCarve('hilo', state, addon, inputs) };
  ADDONS.matchplay = { id: 'matchplay', order: 25.4, entity: 'individual', carve: (state, addon, inputs) => sideFormatCarve('match', state, addon, inputs) };

  // ── Low Score (Dev-93): an individual game over a scoring period ─────────────────────
  // Every player plays their own ball. In each scoring period the lowest total (gross, or net on own strokes)
  // wins that period's pot. 'round' = one contest over the whole round: the lowest total wins, a tie is a push.
  // With a period (Front / Back, Front / Back / Total, 6 / 6 / 6) the per-player ante is split across the periods;
  // a period's pot is that share x every player in the game, won outright by the lowest total, and a tied period
  // is a push (everyone's share of the ante comes back). A player who has not finished a period cannot win it.
  // Ties are "no blood" by default: a tie for low in the whole-round game is a push too and every ante comes back.
  // (A shared pool or a split can be offered later as a tie rule; nothing else here needs to change.)
  //   addon: { dollar_per_player, basis:'gross'|'net', period }
  // Like BestBall it can never take more than the pot has left (reported as `capped`).
  ADDONS.lowscore = {
    id: 'lowscore', order: 26, entity: 'individual',
    carve(state, addon, inputs) {
      const L = state.ledger;
      const cardBy = new Map((inputs.scorecards || []).map(c => [norm(c.player), c]));
      const wantNet = addon.basis === 'net';
      const netOk = wantNet && !!inputs.netByPlayer;
      const gross = c => (Array.isArray(c.holes) ? c.holes : []).map(v => (typeof v === 'number' && v > 0 ? v : null));
      const pk = periodKey(addon);
      const nineRound = [...cardBy.values()].some(c => c.hole_count === 9);
      const plan = nineRound ? { period: 'round', segs: [] } : { period: pk, segs: PERIODS[pk].segs };
      const expected = nineRound ? 9 : 18;
      const rows = L.players.filter(nm => cardBy.has(norm(nm))).map(nm => {
        const c = cardBy.get(norm(nm));
        const arr = netOk ? (inputs.netByPlayer.get(norm(nm)) || { holes: gross(c) }).holes : gross(c);
        const off = c.hole_count === 9 && c.hole_half === 'back' ? 9 : 0;
        const slots = new Array(18).fill(null);
        arr.slice(0, expected).forEach((v, i) => { if (typeof v === 'number') slots[off + i] = v; });
        const played = arr.slice(0, expected).filter(v => typeof v === 'number').length;
        const complete = played === expected;
        return { player: L.canon(nm), slots, played, complete, total: complete ? arr.slice(0, expected).reduce((a, v) => a + v, 0) : null,
          holes: arr.slice(0, expected).map((v, i) => ({ hole: off + i + 1, score: typeof v === 'number' ? v : null })) };
      });
      const dpp = Number(addon.dollar_per_player) || 0;
      const configuredPot = dpp * L.n;
      const pot = Math.min(configuredPot, Math.max(0, state.remaining));
      const capped = pot < configuredPot;
      const ratio = configuredPot > 0 ? pot / configuredPot : 0;
      state.remaining -= pot;
      const stroke_marks = netOk ? rows.map(r => {
        const c = cardBy.get(norm(r.player)); const nb = c && netCard(c, inputs.hcSpecs && inputs.hcSpecs.get(norm(r.player)), inputs.hcSI);
        const off = c && c.hole_count === 9 && c.hole_half === 'back' ? 9 : 0; const got = {};
        if (nb) nb.received.forEach((k, i) => { if (k) got[off + i + 1] = k; });
        return { player: r.player, strokes: nb ? nb.strokes : 0, got };
      }) : null;
      const head = { pot, basis: netOk ? 'net' : 'gross', ...(netOk ? { net_mode: 'own', stroke_marks } : {}), ...(wantNet && !netOk ? { net_missing: true } : {}), period: plan.period };
      const tail = capped ? { capped: true, configured_pot: configuredPot } : {};
      const strip = r => ({ player: r.player, complete: r.complete, played: r.played, total: r.total, holes: r.holes });
      if (plan.period === 'round' || rows.length < 2) {
        const ranked = rows.filter(r => r.complete).sort((a, b) => a.total - b.total);
        ranked.forEach(r => { r.place = ranked.findIndex(x => x.total === r.total) + 1; r.tied = ranked.filter(x => x.total === r.total).length > 1; });
        const lead = ranked.filter(r => r.place === 1);
        const winners = lead.length === 1 ? lead : []; // no blood: a tie for low is a push
        let perPlayer = 0, givenBackEach = 0, unalloc = 0;
        if (winners.length) {
          perPlayer = pot;
          L.credit(winners[0].player, 'lowscore', perPlayer);
        } else { const gb = L.giveBack(pot); givenBackEach = gb.each; unalloc = gb.unallocated; }
        state.unallocated += unalloc;
        return Object.assign({ ...head,
          standings: rows.map(r => Object.assign(strip(r), { place: r.place == null ? null : r.place, tied: !!r.tied })).sort((a, b) => (a.total == null) - (b.total == null) || a.total - b.total),
          winners: winners.map(w => w.player), ...(lead.length > 1 ? { push: true } : {}), per_player: perPlayer, given_back_each: givenBackEach }, tail);
      }
      const perSeg = (dpp / plan.segs.length) * ratio;
      const segPot = Math.floor(perSeg * L.n);
      let unalloc = Math.max(0, pot - segPot * plan.segs.length);
      const everyone = L.players.slice();
      const segsOut = plan.segs.map(sg => {
        const res = fourballSegmentResult(rows.map(r => r.slots), sg, 'strokes');
        const seg = { key: sg.key, label: sg.label, from: sg.a + 1, to: sg.b, pot: segPot, status: res.status, winner: null,
          totals: res.info.map(x => (x.complete ? x.total : null)),
          by: rows.map((r, i) => ({ player: r.player, total: res.info[i] && res.info[i].complete ? res.info[i].total : null })).sort((a, b) => (a.total == null) - (b.total == null) || a.total - b.total) };
        if (res.status === 'won') {
          seg.winner = [rows[res.winner].player];
          L.credit(rows[res.winner].player, 'lowscore', segPot);
          seg.per_player = segPot;
        } else {
          const back = everyone.length ? Math.floor(segPot / everyone.length) : 0;
          everyone.forEach(nm => L.credit(nm, 'given_back', back));
          unalloc += segPot - back * everyone.length;
          seg.given_back_each = back;
        }
        return seg;
      });
      state.unallocated += unalloc;
      const winners = [...new Set(segsOut.filter(x => x.winner).map(x => x.winner[0]))];
      return Object.assign({ ...head,
        standings: rows.map(strip).sort((a, b) => (a.total == null) - (b.total == null) || a.total - b.total),
        segments: { mode: plan.period, win_by: 'strokes', scope: 'field', per_segment: perSeg, segments: segsOut },
        winners, per_player: null, given_back_each: 0 }, tail);
    }
  };

  // ── Game definitions (Dev-93, spec §13) ────────────────────────────────
  // ONE definition per game. The carve/compute logic above is untouched; this
  // layer attaches everything ELSE a game needs so no other file has to
  // describe it again:
  //   kind     'addon' (many per round, carved from the pot) | 'base' (one per round)
  //   meta     { label, icon, seal, info } — all UI copy (portal reads it from here)
  //   input    what must be captured: 'strokes' | 'hole_result' | 'none'
  //   net      true when the game can be played Net (reads strokes via netCard)
  //   config   field schema — drives the form, the saved shape and Worker validation:
  //            { key, type:'money'|'int'|'holes'|'pars'|'enum', label, default,
  //              min?, positive?, values?, required? }
  //   fixedCost(cfg, ctx{players}) -> $ this game sets aside before the residual game
  //   fixtures [{ name, round:{dollar_per_player, addons, handicap?}, inputs, expect }]
  //            run automatically by test_game_registry.mjs
  // A new game is "done" when it has a definition, fixtures, and the loop passes.
  function defineGame(id, def) {
    const target = ADDONS[id] || BASE_GAMES[id];
    if (!target) throw new Error('defineGame: unknown game ' + id);
    Object.assign(target, def);
    return target;
  }
  const _P = (name, holes, extra) => Object.assign({ player: name, holes }, extra || {});
  const _H = (...v) => { const a = v.slice(); while (a.length < 18) a.push(null); return a; };

  defineGame('cttp', {
    kind: 'addon', input: 'none', net: false,
    meta: { traits: { unit: 'player', allowance: 'none', individualScores: true }, label: 'CTP', uiOrder: 2, icon: '🎯', seal: 'CTP',
      info: 'Closest to the Pin on the chosen holes (usually the par 3s). Whoever is closest on a hole wins that hole\'s fixed $ prize, taken from the pot. Claim it in the Live Panel; the newest claim leads. An unclaimed hole\'s money rolls into Skins.' },
    config: [
      { key: 'dollar_per_hole', type: 'money', label: '$ per hole', default: 0, positive: true, required: true },
      { key: 'hole_mode', type: 'enum', label: 'Hole mode', values: ['all_par3', 'custom'], default: 'all_par3', lenient: true },  // lenient = an unknown value is cleaned to the default, not rejected (the Worker always did this)
      { key: 'holes', type: 'holes', label: 'Holes', default: [], required: true }
    ],
    fixedCost: cfg => (Number(cfg.dollar_per_hole) || 0) * ((cfg.holes || []).length),
    fixtures: [{
      name: 'two holes, one claimed, one unclaimed rolls to skins',
      round: { dollar_per_player: 10, addons: [
        { id: 'cttp', entity: 'individual', dollar_per_hole: 3, holes: [3, 7] },
        { id: 'skins', entity: 'individual', basis: 'gross', compare: 'low' }] },
      inputs: { scorecards: [_P('Ann', _H(4, 4, 3)), _P('Bob', _H(5, 4, 4)), _P('Cy', _H(5, 5, 5)), _P('Di', _H(6, 5, 5))],
        ctpLeaders: { 3: { player: 'Ann', dist: 6 } } },
      // pot 40: CTP set-aside 6, skins pot 34 + 3 unclaimed = 37 over 2 skins = 18 each, $1 left over
      expect: { payouts: { Ann: 3 + 36, Bob: 0, Cy: 0, Di: 0 }, unallocated: 1, results: { cttp: { unclaimed_to_skins: 3 }, skins: { per_skin: 18 } } }
    }]
  });

  defineGame('birdieball', {
    kind: 'addon', input: 'none', net: false,
    meta: { traits: { unit: 'player', allowance: 'none', individualScores: true }, label: 'MiserBall', uiOrder: 3, icon: '🐉', seal: 'BIRDIEBALL',
      info: 'Everyone starts with one ball. Keep it all round and you win: everyone who still has theirs at the end splits the pot. If everybody loses theirs, the last MiserBall standing (the one lost latest) wins. Lose yours? Tap "I lost it" in the Live Panel so the group knows, and confirm on your scorecard.' },
    config: [{ key: 'dollar_per_player', type: 'money', label: '$ per player', default: 0, positive: true, required: true }],
    fixedCost: (cfg, ctx) => (Number(cfg.dollar_per_player) || 0) * ((ctx && ctx.players) || 0),
    // A per-player rate above the whole buy-in is impossible at any headcount.
    maxPerPlayer: cfg => Number(cfg.dollar_per_player) || 0,
    fixtures: [{
      name: 'two keepers split the ball pot',
      round: { dollar_per_player: 10, addons: [
        { id: 'birdieball', entity: 'individual', dollar_per_player: 2 },
        { id: 'skins', entity: 'individual', basis: 'gross', compare: 'low' }] },
      inputs: { scorecards: [_P('Ann', _H(4, 4)), _P('Bob', _H(5, 4)), _P('Cy', _H(5, 5)), _P('Di', _H(6, 5))],
        bbAnswers: [{ player_name: 'Ann', kept: true }, { player_name: 'Bob', kept: true },
          { player_name: 'Cy', kept: false, lost_hole: 4, lost_stroke: 1 }, { player_name: 'Di', kept: false, lost_hole: 9, lost_stroke: 2 }] },
      // pot 40: ball pot 8 split by 2 keepers = 4 each; skins 32 to Ann (1 skin)
      expect: { payouts: { Ann: 36, Bob: 4, Cy: 0, Di: 0 }, unallocated: 0, results: { birdieball: { mode: 'kept', per_winner: 4 }, skins: { per_skin: 32 } } }
    }]
  });

  const _ALL = v => Array.from({ length: 18 }, () => v);
  const _SPLIT = (a, b) => Array.from({ length: 18 }, (_, i) => (i < 9 ? a : b));
  defineGame('fourball', {
    kind: 'addon', input: 'strokes', net: true, entity: 'pair',
    released: true,
    meta: { traits: { unit: 'pair', allowance: 'round', individualScores: true, sides: true }, label: 'BestBall', icon: '🤝', seal: 'BESTBALL', uiOrder: 5, group: 'format',
      info: 'Played in pairs. Everyone plays their own ball and the pair counts the better of its two scores on each hole (gross unless the host set it to Net). The pair with the lowest total wins and splits the BestBall pot; tied pairs split it. If a partner picks up, the other\'s score counts alone. The pot can also be split into segments (Front 9, Back 9 and Total, or holes 1-6, 7-12 and 13-18), each its own pot won on strokes or holes won; a tied segment is a push.' },
    config: [
      { key: 'dollar_per_player', type: 'money', label: '$ per player', default: 0, positive: true, required: true },
      { key: 'basis', type: 'enum', label: 'Gross or Net', values: ['gross', 'net'], default: 'gross' },
      { key: 'net_mode', type: 'enum', label: 'Net strokes', values: ['own', 'low'], default: 'own' },
      { key: 'period', type: 'enum', label: 'Scoring period', values: PERIOD_ORDER.slice(), default: 'round' },
      { key: 'segments', type: 'enum', label: 'Pot split (older name for the period)', values: ['total', 'fbt', 'sixes'], default: 'total' },
      { key: 'win_by', type: 'enum', label: 'Segment won by', values: ['strokes', 'holes'], default: 'strokes' },
      { key: 'scope', type: 'enum', label: 'Who competes', values: ['field', 'group'], default: 'field' },
      { key: 'pairs', type: 'pairs', label: 'Pairs', default: [], required: true }
    ],
    fixedCost: (cfg, ctx) => (Number(cfg.dollar_per_player) || 0) * ((ctx && ctx.players) || 0),
    maxPerPlayer: cfg => Number(cfg.dollar_per_player) || 0,
    fixtures: [{
      name: 'gross: the pair with the lower better-ball total wins the carve; Skins gets the rest',
      round: { dollar_per_player: 10, addons: [
        { id: 'fourball', entity: 'pair', dollar_per_player: 5, basis: 'gross', pairs: [['Ann', 'Bob'], ['Cy', 'Di']] },
        { id: 'skins', entity: 'individual', basis: 'gross', compare: 'low' }] },
      // Ann 4s, Bob 5s -> better ball 4 x18 = 72. Cy 5s, Di 4 on 1-9 then 6 -> 4 x9 + 5 x9 = 81. Pair 1 wins the $20 carve ($10 each).
      // Skins pot 20: #1-9 Ann 4 ties Di 4 (no skin); #10-18 Ann 4 is outright low (9 skins) -> $2 each = $18, $2 left over.
      inputs: { scorecards: [_P('Ann', _ALL(4)), _P('Bob', _ALL(5)), _P('Cy', _ALL(5)), _P('Di', _SPLIT(4, 6))] },
      expect: { payouts: { Ann: 28, Bob: 10, Cy: 0, Di: 0 }, unallocated: 2, results: { fourball: { per_pair: 20, per_player: 10 }, skins: { per_skin: 2 } } }
    }, {
      name: 'gross tie: tied pairs split the carve',
      round: { dollar_per_player: 10, addons: [
        { id: 'fourball', entity: 'pair', dollar_per_player: 10, basis: 'gross', pairs: [['Ann', 'Bob'], ['Cy', 'Di']] }] },
      // Ann 6s / Bob 5s -> 5 x18 = 90. Cy 5s / Di 6s -> 90. Tied: the $40 pot splits $20 a pair, $10 a player.
      inputs: { scorecards: [_P('Ann', _ALL(6)), _P('Bob', _ALL(5)), _P('Cy', _ALL(5)), _P('Di', _ALL(6))] },
      expect: { payouts: { Ann: 10, Bob: 10, Cy: 10, Di: 10 }, unallocated: 0, results: { fourball: { per_pair: 20, per_player: 10 } } }
    }, {
      name: 'net (own strokes): Bob\'s 9 strokes turn the same gross tie into a win for pair 1',
      round: { dollar_per_player: 10, handicap: { mode: 'net', allowance: 95, stroke_index: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
          players: { Ann: { kind: 'given', strokes: 0 }, Bob: { kind: 'given', strokes: 9 }, Cy: { kind: 'given', strokes: 0 }, Di: { kind: 'given', strokes: 0 } } },
        addons: [{ id: 'fourball', entity: 'pair', dollar_per_player: 10, basis: 'net', net_mode: 'own', pairs: [['Ann', 'Bob'], ['Cy', 'Di']] }] },
      // Bob gets a stroke on holes 1-9: net 4 there, 5 elsewhere. Pair 1 better ball = 4 x9 + 5 x9 = 81 (Ann's 6s never count). Pair 2 = 90.
      // Pair 1 takes the whole $40 carve: $20 each.
      inputs: { scorecards: [_P('Ann', _ALL(6)), _P('Bob', _ALL(5)), _P('Cy', _ALL(5)), _P('Di', _ALL(6))] },
      expect: { payouts: { Ann: 20, Bob: 20, Cy: 0, Di: 0 }, unallocated: 0, results: { fourball: { per_pair: 40, per_player: 20 } } }
    }, {
      name: 'segments (Front/Back/Total, strokes): each segment is its own pot, a tied Total is a push',
      round: { dollar_per_player: 15, addons: [
        { id: 'fourball', entity: 'pair', dollar_per_player: 15, basis: 'gross', segments: 'fbt', win_by: 'strokes', scope: 'group', pairs: [['Ann', 'Bob'], ['Cy', 'Di']] }] },
      // Ann/Bob better ball 4 on the front, 5 on the back (81). Cy/Di 5 on the front, 4 on the back (81).
      // Front: Ann&Bob 36 vs 45 -> win $20 ($10 each). Back: Cy&Di 36 vs 45 -> win $20. Total 81 vs 81: push, everyone gets the $5 ante back.
      inputs: { scorecards: [_P('Ann', _SPLIT(4, 5)), _P('Bob', _ALL(6)), _P('Cy', _SPLIT(5, 4)), _P('Di', _ALL(6))] },
      expect: { payouts: { Ann: 15, Bob: 15, Cy: 15, Di: 15 }, unallocated: 0 }
    }, {
      name: 'segments (6/6/6, holes won): two foursomes are separate matches with their own pots',
      round: { dollar_per_player: 12, addons: [
        { id: 'fourball', entity: 'pair', dollar_per_player: 12, basis: 'gross', segments: 'sixes', win_by: 'holes', scope: 'group',
          pairs: [['Ann', 'Bob'], ['Cy', 'Di'], ['Ed', 'Flo'], ['Gus', 'Hal']] }] },
      // Group 1: Ann/Bob 4s vs Cy/Di 5s -> Ann&Bob win every segment: $4 ante x 4 players = $16 pot each, $8 a player, 3 segments = $24 each.
      // Group 2: all 5s -> every segment is halved, a push: everyone gets the $12 back.
      inputs: { scorecards: [_P('Ann', _ALL(4)), _P('Bob', _ALL(6)), _P('Cy', _ALL(5)), _P('Di', _ALL(6)),
        _P('Ed', _ALL(5)), _P('Flo', _ALL(5)), _P('Gus', _ALL(5)), _P('Hal', _ALL(5))] },
      expect: { payouts: { Ann: 24, Bob: 24, Cy: 0, Di: 0, Ed: 12, Flo: 12, Gus: 12, Hal: 12 }, unallocated: 0 }
    }, {
      name: 'period Front / Back (strokes): two pots, each pair wins one',
      round: { dollar_per_player: 20, addons: [
        { id: 'fourball', entity: 'pair', dollar_per_player: 20, basis: 'gross', period: 'front_back', win_by: 'strokes', scope: 'group', pairs: [['Ann', 'Bob'], ['Cy', 'Di']] }] },
      // The $20 ante is $10 a segment; each segment pot is $10 x 4 players = $40, split by the winning pair ($20 a player).
      // Front: Ann&Bob better ball 4s (36) vs Cy&Di 5s (45). Back: Cy&Di 4s (36) vs Ann&Bob 5s (45).
      inputs: { scorecards: [_P('Ann', _SPLIT(4, 5)), _P('Bob', _ALL(6)), _P('Cy', _SPLIT(5, 4)), _P('Di', _ALL(6))] },
      expect: { payouts: { Ann: 20, Bob: 20, Cy: 20, Di: 20 }, unallocated: 0 }
    }, {
      name: 'segments across the whole field (strokes): the best pair in the field takes the segment',
      round: { dollar_per_player: 6, addons: [
        { id: 'fourball', entity: 'pair', dollar_per_player: 6, basis: 'gross', segments: 'fbt', win_by: 'strokes', scope: 'field',
          pairs: [['Ann', 'Bob'], ['Cy', 'Di'], ['Ed', 'Flo'], ['Gus', 'Hal']] }] },
      // Each segment's pot is $2 x 8 players = $16. Ed/Flo (3s) are best everywhere: they win all three segments, $8 a player x 3 = $24 each.
      inputs: { scorecards: [_P('Ann', _ALL(5)), _P('Bob', _ALL(5)), _P('Cy', _ALL(4)), _P('Di', _ALL(4)),
        _P('Ed', _ALL(3)), _P('Flo', _ALL(3)), _P('Gus', _ALL(5)), _P('Hal', _ALL(5))] },
      expect: { payouts: { Ann: 0, Bob: 0, Cy: 0, Di: 0, Ed: 24, Flo: 24, Gus: 0, Hal: 0 }, unallocated: 0 }
    }]
  });

  defineGame('altshot', {
    kind: 'addon', input: 'strokes', net: true, entity: 'pair',
    released: true, moneyOptional: true,
    meta: { traits: { unit: 'ball', allowance: 'own', individualScores: false, sides: true, sideForm: true }, label: 'Alternate Shot', tab: 'A-S', short: 'One ball per pair', icon: '🔁', seal: 'ALT SHOT', uiOrder: 5.2, group: 'format',
      info: 'Played in pairs with ONE ball per pair, partners taking turns hitting it, so each pair posts one score a hole. The pair with the lowest total wins (or choose holes won in a head-to-head). Net uses a share of the two handicaps added together (50% is the usual); the host can change it. The pot can be left at $0 for bragging rights.' },
    config: [
      { key: 'dollar_per_player', type: 'money', label: '$ per player', default: 0 },
      { key: 'basis', type: 'enum', label: 'Gross or Net', values: ['gross', 'net'], default: 'gross' },
      { key: 'net_mode', type: 'enum', label: 'Net strokes', values: ['own', 'low'], default: 'low' },
      { key: 'allowance', type: 'int', label: 'Handicap allowance %', default: 50, min: 1 },
      { key: 'period', type: 'enum', label: 'Scoring period', values: PERIOD_ORDER.slice(), default: 'round' },
      { key: 'win_by', type: 'enum', label: 'Won by', values: ['strokes', 'holes'], default: 'strokes' },
      { key: 'scope', type: 'enum', label: 'Who competes', values: ['field', 'group'], default: 'field' },
      { key: 'pairs', type: 'pairs', label: 'Pairs', default: [], required: true }
    ],
    fixedCost: cfg => (Number(cfg.dollar_per_player) || 0) * 2 * ((cfg.pairs || []).length),
    maxPerPlayer: cfg => Number(cfg.dollar_per_player) || 0,
    fixtures: [{
      name: 'gross: the pair with the lower one-ball total takes the pot, only the four in the game ante',
      round: { dollar_per_player: 10, addons: [
        { id: 'altshot', entity: 'pair', dollar_per_player: 10, basis: 'gross', pairs: [['Ann', 'Bob'], ['Cy', 'Di']] }] },
      // both partners' cards carry the pair's score: Ann & Bob 4s (72), Cy & Di 5s (90). The $40 pot goes to Ann & Bob: $20 each.
      inputs: { scorecards: [_P('Ann', _ALL(4)), _P('Bob', _ALL(4)), _P('Cy', _ALL(5)), _P('Di', _ALL(5))] },
      expect: { payouts: { Ann: 20, Bob: 20, Cy: 0, Di: 0 }, unallocated: 0, results: { altshot: { pot: 40, per_player: 20 } } }
    }, {
      name: 'net: half of the two course handicaps added together',
      round: { dollar_per_player: 10, handicap: { mode: 'net', allowance: 95, stroke_index: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
          players: { Ann: { kind: 'index', index: 10, course_hcp: 10, strokes: 10 }, Bob: { kind: 'index', index: 20, course_hcp: 20, strokes: 19 },
            Cy: { kind: 'index', index: 10, course_hcp: 10, strokes: 10 }, Di: { kind: 'index', index: 10, course_hcp: 10, strokes: 10 } } },
        addons: [{ id: 'altshot', entity: 'pair', dollar_per_player: 10, basis: 'net', net_mode: 'own', allowance: 50, pairs: [['Ann', 'Bob'], ['Cy', 'Di']] }] },
      // Ann & Bob: 50% of 30 = 15 strokes (holes 1-15 net 4, 16-18 net 5 = 75). Cy & Di: 50% of 20 = 10 strokes (80). Ann & Bob win the $40.
      inputs: { scorecards: [_P('Ann', _ALL(5)), _P('Bob', _ALL(5)), _P('Cy', _ALL(5)), _P('Di', _ALL(5))] },
      expect: { payouts: { Ann: 20, Bob: 20, Cy: 0, Di: 0 }, unallocated: 0, results: { altshot: { pot: 40, per_player: 20 } } }
    }, {
      name: '$0 pot: the result is still worked out, nothing moves',
      round: { dollar_per_player: 0, addons: [
        { id: 'altshot', entity: 'pair', dollar_per_player: 0, basis: 'gross', pairs: [['Ann', 'Bob'], ['Cy', 'Di']] }] },
      inputs: { scorecards: [_P('Ann', _ALL(4)), _P('Bob', _ALL(4)), _P('Cy', _ALL(5)), _P('Di', _ALL(5))] },
      expect: { payouts: { Ann: 0, Bob: 0, Cy: 0, Di: 0 }, unallocated: 0, results: { altshot: { pot: 0 } } }
    }]
  });

  defineGame('scramble', {
    kind: 'addon', input: 'strokes', net: true, entity: 'pair',
    released: true, moneyOptional: true,
    meta: { traits: { unit: 'ball', allowance: 'own', individualScores: false, sides: true, sideForm: true }, label: 'Scramble', tab: 'Scramble', short: 'Scramble for teams of 1 to 4, one score per team', icon: '🦃', seal: 'SCRAMBLE', uiOrder: 5.25, group: 'format',
      info: 'Teams of 1 to 4 players play ONE ball: everyone hits, the team takes the best shot, everyone plays from there, until it is in the hole. Each team posts one score a hole. Score it by strokes (lowest total wins) or Stableford points (most points wins). Net uses a team handicap: the players are ranked lowest handicap first and each takes a share of their own (2-man 35% and 15%, 3-man 20/15/10, 4-man 25/20/15/10 are the usual, all editable), or a % of all the handicaps added together, or none. Pay the winner, or the top 2 or 3 teams. The pot can be left at $0 for bragging rights.' },
    config: [
      { key: 'dollar_per_player', type: 'money', label: '$ per player', default: 0 },
      { key: 'scoring', type: 'enum', label: 'Scoring', values: ['strokes', 'stableford'], default: 'strokes' },
      { key: 'scale', type: 'enum', label: 'Stableford points', values: ['bf', 'standard'], default: 'bf' },
      { key: 'basis', type: 'enum', label: 'Gross or Net', values: ['gross', 'net'], default: 'net' },
      { key: 'net_mode', type: 'enum', label: 'Net strokes', values: ['own', 'low'], default: 'own' },
      { key: 'team_size', type: 'int', label: 'Players per team', default: 2, min: 1, max: 4 },
      { key: 'hcp_method', type: 'enum', label: 'Team handicap', values: ['ranked', 'combined', 'none'], default: 'ranked' },
      { key: 'pct_1', type: 'int', label: 'Lowest handicap %', default: 35, min: 0 },
      { key: 'pct_2', type: 'int', label: '2nd lowest handicap %', default: 15, min: 0 },
      { key: 'pct_3', type: 'int', label: '3rd lowest handicap %', default: 10, min: 0 },
      { key: 'pct_4', type: 'int', label: 'Highest handicap %', default: 10, min: 0 },
      { key: 'allowance', type: 'int', label: 'Combined handicap %', default: 25, min: 1 },
      { key: 'payout', type: 'enum', label: 'Pays', values: ['winner', 'top2', 'top3'], default: 'winner' },
      { key: 'pars', type: 'pars', label: 'Par by hole (Stableford)', default: [], min: 3, max: 6, integer: true },
      { key: 'pairs', type: 'pairs', sizeKey: 'team_size', minPairs: 0, label: 'Teams', default: [] },   // may be saved empty: a team event is set up before anyone has signed up, and the locked teams are filled in later
      { key: 'names', type: 'strings', label: 'Team names', default: [], max: 40 }
    ],
    fixedCost: cfg => (Number(cfg.dollar_per_player) || 0) * scrambleSize(cfg) * ((cfg.pairs || []).length),
    maxPerPlayer: cfg => Number(cfg.dollar_per_player) || 0,
    fixtures: [{
      name: 'strokes, gross: the team with the lower one-ball total takes the pot',
      round: { dollar_per_player: 10, addons: [
        { id: 'scramble', entity: 'pair', dollar_per_player: 10, basis: 'gross', pairs: [['Ann', 'Bob'], ['Cy', 'Di']] }] },
      inputs: { scorecards: [_P('Ann', _ALL(4)), _P('Bob', _ALL(4)), _P('Cy', _ALL(5)), _P('Di', _ALL(5))] },
      expect: { payouts: { Ann: 20, Bob: 20, Cy: 0, Di: 0 }, unallocated: 0, results: { scramble: { pot: 40, per_player: 20 } } }
    }, {
      name: 'net: 35% of the lower plus 15% of the higher course handicap',
      round: { dollar_per_player: 10, handicap: { mode: 'net', allowance: 100, stroke_index: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
          players: { Ann: { kind: 'index', index: 10, course_hcp: 10, strokes: 10 }, Bob: { kind: 'index', index: 20, course_hcp: 20, strokes: 20 },
            Cy: { kind: 'index', index: 10, course_hcp: 10, strokes: 10 }, Di: { kind: 'index', index: 10, course_hcp: 10, strokes: 10 } } },
        addons: [{ id: 'scramble', entity: 'pair', dollar_per_player: 10, basis: 'net', net_mode: 'own', hcp_method: 'ranked', pairs: [['Ann', 'Bob'], ['Cy', 'Di']] }] },
      // Ann & Bob: 35% of 10 + 15% of 20 = 6.5 -> 7 strokes (holes 1-7 net 4, 8-18 net 5 = 83). Cy & Di: 35% of 10 + 15% of 10 = 5 strokes (85). Ann & Bob win.
      inputs: { scorecards: [_P('Ann', _ALL(5)), _P('Bob', _ALL(5)), _P('Cy', _ALL(5)), _P('Di', _ALL(5))] },
      expect: { payouts: { Ann: 20, Bob: 20, Cy: 0, Di: 0 }, unallocated: 0, results: { scramble: { pot: 40, per_player: 20 } } }
    }, {
      name: 'Stableford, gross: most points wins (BirdieFriends table, birdie 4)',
      round: { dollar_per_player: 10, addons: [
        { id: 'scramble', entity: 'pair', dollar_per_player: 10, basis: 'gross', scoring: 'stableford', pars: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
          pairs: [['Ann', 'Bob'], ['Cy', 'Di']] }] },
      // Ann & Bob par every hole = 36 points. Cy & Di birdie one hole and bogey one: 4 + 1 + 16 x 2 = 37 points, so they win.
      inputs: { scorecards: [_P('Ann', _ALL(4)), _P('Bob', _ALL(4)), _P('Cy', _ALL(4).map((v, i) => (i === 0 ? 3 : i === 1 ? 5 : v))), _P('Di', _ALL(4).map((v, i) => (i === 0 ? 3 : i === 1 ? 5 : v)))] },
      expect: { payouts: { Ann: 0, Bob: 0, Cy: 20, Di: 20 }, unallocated: 0, results: { scramble: { pot: 40, per_player: 20 } } }
    }, {
      name: 'top 3 split 50/30/20 with only two teams: the pot spreads over the places that exist',
      round: { dollar_per_player: 10, addons: [
        { id: 'scramble', entity: 'pair', dollar_per_player: 10, basis: 'gross', payout: 'top3', pairs: [['Ann', 'Bob'], ['Cy', 'Di']] }] },
      // 50:30 over two places = 62.5% / 37.5% of the $40 pot: $25 and $15 a team -> $12 and $7 a player; $2 left over (rounds down)
      inputs: { scorecards: [_P('Ann', _ALL(4)), _P('Bob', _ALL(4)), _P('Cy', _ALL(5)), _P('Di', _ALL(5))] },
      expect: { payouts: { Ann: 12, Bob: 12, Cy: 7, Di: 7 }, unallocated: 2, results: { scramble: { pot: 40 } } }
    }, {
      name: '$0 pot: the result is still worked out, nothing moves',
      round: { dollar_per_player: 0, addons: [
        { id: 'scramble', entity: 'pair', dollar_per_player: 0, basis: 'gross', pairs: [['Ann', 'Bob'], ['Cy', 'Di']] }] },
      inputs: { scorecards: [_P('Ann', _ALL(4)), _P('Bob', _ALL(4)), _P('Cy', _ALL(5)), _P('Di', _ALL(5))] },
      expect: { payouts: { Ann: 0, Bob: 0, Cy: 0, Di: 0 }, unallocated: 0, results: { scramble: { pot: 0 } } }
    }]
  });

  defineGame('hilo', {
    kind: 'addon', input: 'strokes', net: true, entity: 'pair',
    released: true, moneyOptional: true,
    meta: { traits: { unit: 'pair', allowance: 'round', individualScores: true, sides: true, sideForm: true, headToHead: true }, label: 'Hi-Lo', tab: 'Hi-Lo', short: 'Low ball + high ball, 2 points a hole', icon: '⚖️', seal: 'HI-LO', uiOrder: 5.3, group: 'format',
      info: 'Two pairs play each other, every player on their own ball. Each hole is worth 2 points: 1 for the LOW ball (the better score of each pair) and 1 for the HIGH ball (the worse score of each pair). The lower low takes its point and the lower high takes its point; if they tie, nobody gets it. The pair with more points wins; level is a push and the antes come back. Partners stay the same all round. Gross or Net (Full or off the low). The pot can be played for the whole round, Front / Back, Front / Back / Total or 6 / 6 / 6, and can be left at $0.' },
    config: [
      { key: 'dollar_per_player', type: 'money', label: '$ per player', default: 0 },
      { key: 'basis', type: 'enum', label: 'Gross or Net', values: ['gross', 'net'], default: 'gross' },
      { key: 'net_mode', type: 'enum', label: 'Net strokes', values: ['own', 'low'], default: 'own' },
      { key: 'period', type: 'enum', label: 'Scoring period', values: PERIOD_ORDER.slice(), default: 'round' },
      { key: 'pairs', type: 'pairs', evenPairs: true, label: 'Pairs', default: [], required: true }
    ],
    fixedCost: cfg => (Number(cfg.dollar_per_player) || 0) * 2 * ((cfg.pairs || []).length),
    maxPerPlayer: cfg => Number(cfg.dollar_per_player) || 0,
    fixtures: [{
      name: 'gross: Ann & Bob take both points on every hole, so they win the $40',
      round: { dollar_per_player: 10, addons: [
        { id: 'hilo', entity: 'pair', dollar_per_player: 10, basis: 'gross', pairs: [['Ann', 'Bob'], ['Cy', 'Di']] }] },
      // Ann 4 / Bob 5 vs Cy 5 / Di 6: low 4 beats 5, high 5 beats 6 -> 2 points a hole, 36-0.
      inputs: { scorecards: [_P('Ann', _ALL(4)), _P('Bob', _ALL(5)), _P('Cy', _ALL(5)), _P('Di', _ALL(6))] },
      expect: { payouts: { Ann: 20, Bob: 20, Cy: 0, Di: 0 }, unallocated: 0, results: { hilo: { pot: 40 } } }
    }, {
      name: 'a split: each pair wins one point a hole (low for one, high for the other) so the match is level and every ante comes back',
      round: { dollar_per_player: 10, addons: [
        { id: 'hilo', entity: 'pair', dollar_per_player: 10, basis: 'gross', pairs: [['Ann', 'Bob'], ['Cy', 'Di']] }] },
      // Ann 3 / Bob 7 (low 3, high 7) vs Cy 4 / Di 5 (low 4, high 5): Ann & Bob take the low, Cy & Di the high.
      inputs: { scorecards: [_P('Ann', _ALL(3)), _P('Bob', _ALL(7)), _P('Cy', _ALL(4)), _P('Di', _ALL(5))] },
      expect: { payouts: { Ann: 10, Bob: 10, Cy: 10, Di: 10 }, unallocated: 0, results: { hilo: { pot: 40 } } }
    }, {
      name: 'ties give nobody the point: tied lows and a better high still decides the match',
      round: { dollar_per_player: 10, addons: [
        { id: 'hilo', entity: 'pair', dollar_per_player: 10, basis: 'gross', pairs: [['Ann', 'Bob'], ['Cy', 'Di']] }] },
      // Lows tie at 4, highs 5 vs 6: Ann & Bob get the high point only, 18-0.
      inputs: { scorecards: [_P('Ann', _ALL(4)), _P('Bob', _ALL(5)), _P('Cy', _ALL(4)), _P('Di', _ALL(6))] },
      expect: { payouts: { Ann: 20, Bob: 20, Cy: 0, Di: 0 }, unallocated: 0, results: { hilo: { pot: 40 } } }
    }, {
      name: 'net, off the low: the strokes come off the lowest handicap and swing the points',
      round: { dollar_per_player: 10, handicap: { mode: 'net', allowance: 100, stroke_index: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
          players: { Ann: { kind: 'given', strokes: 0 }, Bob: { kind: 'given', strokes: 18 }, Cy: { kind: 'given', strokes: 0 }, Di: { kind: 'given', strokes: 0 } } },
        addons: [{ id: 'hilo', entity: 'pair', dollar_per_player: 10, basis: 'net', net_mode: 'low', pairs: [['Ann', 'Bob'], ['Cy', 'Di']] }] },
      // Bob gets a stroke every hole: net 4. Ann 5 / Bob 4 (low 4, high 5) vs Cy 5 / Di 5 (low 5, high 5): Ann & Bob win the low, tie the high.
      inputs: { scorecards: [_P('Ann', _ALL(5)), _P('Bob', _ALL(5)), _P('Cy', _ALL(5)), _P('Di', _ALL(5))] },
      expect: { payouts: { Ann: 20, Bob: 20, Cy: 0, Di: 0 }, unallocated: 0, results: { hilo: { pot: 40 } } }
    }, {
      name: 'periods (Front / Back): each half is its own pot and its own points',
      round: { dollar_per_player: 20, addons: [
        { id: 'hilo', entity: 'pair', dollar_per_player: 20, basis: 'gross', period: 'front_back', pairs: [['Ann', 'Bob'], ['Cy', 'Di']] }] },
      // $10 a segment, $40 pot each. Front: Ann/Bob 4,5 vs Cy/Di 5,6. Back: Cy/Di 4,5 vs Ann/Bob 5,6.
      inputs: { scorecards: [_P('Ann', _SPLIT(4, 5)), _P('Bob', _SPLIT(5, 6)), _P('Cy', _SPLIT(5, 4)), _P('Di', _SPLIT(6, 5))] },
      expect: { payouts: { Ann: 20, Bob: 20, Cy: 20, Di: 20 }, unallocated: 0 }
    }, {
      name: '$0 pot: the match is still scored, nothing moves',
      round: { dollar_per_player: 0, addons: [
        { id: 'hilo', entity: 'pair', dollar_per_player: 0, basis: 'gross', pairs: [['Ann', 'Bob'], ['Cy', 'Di']] }] },
      inputs: { scorecards: [_P('Ann', _ALL(4)), _P('Bob', _ALL(5)), _P('Cy', _ALL(5)), _P('Di', _ALL(6))] },
      expect: { payouts: { Ann: 0, Bob: 0, Cy: 0, Di: 0 }, unallocated: 0, results: { hilo: { pot: 0 } } }
    }]
  });

  defineGame('matchplay', {
    kind: 'addon', input: 'strokes', net: true, entity: 'individual',
    released: true, moneyOptional: true,
    meta: { traits: { unit: 'match', allowance: 'own', individualScores: false, sides: true, sideForm: true, headToHead: true }, label: 'Match Play', tab: 'Match', short: 'Head to head, hole by hole', icon: '⚔️', seal: 'MATCH PLAY', uiOrder: 5.4, group: 'format',
      info: 'Head to head, hole by hole: the lower score wins the hole, and the match goes to whoever is ahead when there are not enough holes left to catch up (3&2). The winner is announced then, but they may play on. A match level after the last hole is halved and each player gets their money back. Net strokes are a % of each course handicap (100% is full), either full or off the lower handicap in the match. The pot can be left at $0.' },
    config: [
      { key: 'dollar_per_player', type: 'money', label: '$ per player', default: 0 },
      { key: 'basis', type: 'enum', label: 'Gross or Net', values: ['gross', 'net'], default: 'gross' },
      { key: 'net_mode', type: 'enum', label: 'Net strokes', values: ['own', 'low'], default: 'own' },
      { key: 'allowance', type: 'int', label: 'Handicap allowance %', default: 100, min: 1 },
      { key: 'period', type: 'enum', label: 'Scoring period', values: PERIOD_ORDER.slice(), default: 'round' },
      { key: 'matches', type: 'pairs', minPairs: 1, label: 'Matches', default: [], required: true }
    ],
    fixedCost: cfg => (Number(cfg.dollar_per_player) || 0) * 2 * ((cfg.matches || []).length),
    maxPerPlayer: cfg => Number(cfg.dollar_per_player) || 0,
    fixtures: [{
      name: 'gross: Ann is 10 up after ten holes, the match is hers and she takes the $20',
      round: { dollar_per_player: 10, addons: [
        { id: 'matchplay', entity: 'individual', dollar_per_player: 10, basis: 'gross', matches: [['Ann', 'Bob']] }] },
      inputs: { scorecards: [_P('Ann', _ALL(4)), _P('Bob', _ALL(5))] },
      expect: { payouts: { Ann: 20, Bob: 0 }, unallocated: 0, results: { matchplay: { pot: 20, per_player: null } } }
    }, {
      name: 'a halved match gives both antes back',
      round: { dollar_per_player: 10, addons: [
        { id: 'matchplay', entity: 'individual', dollar_per_player: 10, basis: 'gross', matches: [['Ann', 'Bob']] }] },
      inputs: { scorecards: [_P('Ann', _ALL(4)), _P('Bob', _ALL(4))] },
      expect: { payouts: { Ann: 10, Bob: 10 }, unallocated: 0, results: { matchplay: { pot: 20 } } }
    }, {
      name: 'net, off the low: the higher handicap gets the difference (10 strokes) and wins ten holes',
      round: { dollar_per_player: 10, handicap: { mode: 'net', allowance: 95, stroke_index: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
          players: { Ann: { kind: 'index', index: 10, course_hcp: 10, strokes: 10 }, Bob: { kind: 'index', index: 20, course_hcp: 20, strokes: 19 } } },
        addons: [{ id: 'matchplay', entity: 'individual', dollar_per_player: 10, basis: 'net', net_mode: 'low', allowance: 100, matches: [['Ann', 'Bob']] }] },
      inputs: { scorecards: [_P('Ann', _ALL(5)), _P('Bob', _ALL(5))] },
      expect: { payouts: { Ann: 0, Bob: 20 }, unallocated: 0, results: { matchplay: { pot: 20 } } }
    }, {
      name: 'two matches are separate pots; a $0 side game would not matter here',
      round: { dollar_per_player: 5, addons: [
        { id: 'matchplay', entity: 'individual', dollar_per_player: 5, basis: 'gross', matches: [['Ann', 'Bob'], ['Cy', 'Di']] }] },
      inputs: { scorecards: [_P('Ann', _ALL(4)), _P('Bob', _ALL(5)), _P('Cy', _ALL(6)), _P('Di', _ALL(5))] },
      expect: { payouts: { Ann: 10, Bob: 0, Cy: 0, Di: 10 }, unallocated: 0, results: { matchplay: { pot: 20 } } }
    }, {
      name: '$0 pot: the match is still decided, nothing moves',
      round: { dollar_per_player: 0, addons: [
        { id: 'matchplay', entity: 'individual', dollar_per_player: 0, basis: 'gross', matches: [['Ann', 'Bob']] }] },
      inputs: { scorecards: [_P('Ann', _ALL(4)), _P('Bob', _ALL(5))] },
      expect: { payouts: { Ann: 0, Bob: 0 }, unallocated: 0, results: { matchplay: { pot: 0 } } }
    }]
  });

  defineGame('lowscore', {
    kind: 'addon', input: 'strokes', net: true, entity: 'individual',
    released: true,
    meta: { traits: { unit: 'player', allowance: 'round', individualScores: true }, label: 'Individual Low Score', icon: '🎯', seal: 'LOW SCORE · SOLO', uiOrder: 6, group: 'format',
      info: 'Everyone plays their own ball and the lowest score wins. Choose the scoring period: the whole round, Front and Back, Front, Back and Total, or 6 / 6 / 6. Each period is its own pot, the ante is split across them, and the lowest total in a period takes that pot. A tie for low is a push and the antes come back. Gross unless the host set it to Net.' },
    config: [
      { key: 'dollar_per_player', type: 'money', label: '$ per player', default: 0, positive: true, required: true },
      { key: 'basis', type: 'enum', label: 'Gross or Net', values: ['gross', 'net'], default: 'gross' },
      { key: 'period', type: 'enum', label: 'Scoring period', values: PERIOD_ORDER.slice(), default: 'round' }
    ],
    fixedCost: (cfg, ctx) => (Number(cfg.dollar_per_player) || 0) * ((ctx && ctx.players) || 0),
    maxPerPlayer: cfg => Number(cfg.dollar_per_player) || 0,
    fixtures: [{
      name: 'whole round (gross): the lowest total takes the pot, Skins gets the rest',
      round: { dollar_per_player: 12, addons: [
        { id: 'lowscore', entity: 'individual', dollar_per_player: 5, basis: 'gross' },
        { id: 'skins', entity: 'individual', basis: 'gross', compare: 'low' }] },
      // Ann 4s = 72, Bob 5s = 90, Cy 5s = 90. Ann takes the $15 Low Score pot ($5 x 3). Skins gets the $21 left: Ann wins all 18 holes, $1 each = $18, $3 left over.
      inputs: { scorecards: [_P('Ann', _ALL(4)), _P('Bob', _ALL(5)), _P('Cy', _ALL(5))] },
      expect: { payouts: { Ann: 33, Bob: 0, Cy: 0 }, unallocated: 3, results: { lowscore: { per_player: 15 } } }
    }, {
      name: 'whole round tie: no blood, a tie for low is a push and every ante comes back',
      round: { dollar_per_player: 10, addons: [{ id: 'lowscore', entity: 'individual', dollar_per_player: 10, basis: 'gross' }] },
      // Ann and Bob both 72, Cy 90. Nobody wins outright: each player gets the $10 ante back.
      inputs: { scorecards: [_P('Ann', _ALL(4)), _P('Bob', _ALL(4)), _P('Cy', _ALL(5))] },
      expect: { payouts: { Ann: 10, Bob: 10, Cy: 10 }, unallocated: 0 }
    }, {
      name: 'period Front / Back / Total: three pots, a tied Total is a push',
      round: { dollar_per_player: 15, addons: [{ id: 'lowscore', entity: 'individual', dollar_per_player: 15, basis: 'gross', period: 'fbt' }] },
      // $5 a period, each pot $5 x 3 players = $15. Ann 4 on the front / 6 on the back (90), Bob 6 front / 4 back (90), Cy 5s (90).
      // Front: Ann 36 wins $15. Back: Bob 36 wins $15. Total: all three on 90, a push: each gets the $5 back.
      inputs: { scorecards: [_P('Ann', _SPLIT(4, 6)), _P('Bob', _SPLIT(6, 4)), _P('Cy', _ALL(5))] },
      expect: { payouts: { Ann: 20, Bob: 20, Cy: 5 }, unallocated: 0 }
    }]
  });

  defineGame('birdiepay', {
    kind: 'addon', input: 'strokes', net: true,
    meta: { traits: { unit: 'player', allowance: 'round', individualScores: true }, label: 'Birdie Payouts', uiOrder: 4, icon: '🐤', seal: 'BIRDIE PAY',
      info: 'A flat $ for every birdie or better, paid to whoever made it, from the same pot before Skins (gross unless the host set it to Net, where a par with a stroke counts). An eagle still pays one birdie. Nothing to enter: it\'s worked out from the scorecards when the round closes.' },
    config: [
      { key: 'dollar_per_birdie', type: 'money', label: '$ per birdie', default: 0, positive: true, required: true },
      { key: 'pars', type: 'pars', label: 'Par by hole', default: [], required: true, min: 3, max: 6, integer: true },
      { key: 'pars_by_player', type: 'parsmap', label: 'Par by hole for players on a different tee', default: {}, min: 3, max: 6, integer: true }
    ],
    fixedCost: () => 0,   // sized by birdies made, capped to the pot at close — never a fixed set-aside
    fixtures: [{
      name: 'one birdie and one eagle each pay the flat amount',
      round: { dollar_per_player: 10, addons: [
        { id: 'birdiepay', entity: 'individual', dollar_per_birdie: 3, pars: [4, 4, 3, 5, 4, 4, 3, 5, 4, 4, 4, 3, 5, 4, 4, 3, 5, 4] },
        { id: 'skins', entity: 'individual', basis: 'gross', compare: 'low' }] },
      inputs: { scorecards: [_P('Ann', _H(3, 4, 3)), _P('Bob', _H(4, 4, 1)), _P('Cy', _H(5, 5, 4)), _P('Di', _H(5, 6, 4))] },
      // Ann birdies #1, Bob aces the par-3 #3 (still ONE payout): 2 x $3 = 6; skins 34 over 2 skins = 17 each
      expect: { payouts: { Ann: 20, Bob: 20, Cy: 0, Di: 0 }, unallocated: 0, results: { birdiepay: { count: 2, paid_each: 3, total_paid: 6 }, skins: { per_skin: 17 } } }
    }]
  });

  defineGame('skins', {
    kind: 'addon', input: 'strokes', net: true, residual: true,
    meta: { traits: { unit: 'player', allowance: 'round', individualScores: true }, label: 'Skins', uiOrder: 1, icon: '⛳', seal: 'SKINS',
      info: 'Every hole is its own prize. The lowest score on a hole, outright, wins that skin (gross unless the host set it to Net); a tie wins nothing. Skins split whatever is left of the pot after CTP, MiserBall and Birdie Payouts, shared by the skins won.' },
    config: [{ key: 'basis', type: 'enum', label: 'Gross or Net', values: ['gross', 'net'], default: 'gross' }],
    fixedCost: () => 0,   // the residual game: takes whatever the others leave
    fixtures: [{
      name: 'outright low wins, a tie wins nothing',
      round: { dollar_per_player: 10, addons: [{ id: 'skins', entity: 'individual', basis: 'gross', compare: 'low' }] },
      inputs: { scorecards: [_P('Ann', _H(3, 4, 5)), _P('Bob', _H(4, 4, 5)), _P('Cy', _H(5, 5, 6)), _P('Di', _H(6, 6, 6))] },
      // pot 40, one outright skin (#1; #2 and #3 tie) takes it all
      expect: { payouts: { Ann: 40, Bob: 0, Cy: 0, Di: 0 }, unallocated: 0, results: { skins: { per_skin: 40 } } }
    }]
  });

  // ── Pair recommender (Dev-93) ──────────────────────────────────────────
  // Suggests partners for BestBall from known handicap data. Balanced: the strongest player is
  // paired with the weakest, the next strongest with the next weakest, so every pair's combined
  // handicap lands close together (the usual fair way to make teams). players = [{name, hcp}],
  // hcp = a handicap Index or strokes (lower = better) or null/undefined when unknown. A player
  // with no handicap is treated as the group's average and listed in `guessed` (with no data at
  // all, players are paired in alphabetical order). An odd player out is left in `unpaired`
  // (the middle of the ranking, so no pair is lopsided). Deterministic: ties break on name.
  function recommendPairs(players) {
    const list = (players || []).filter(p => p && p.name).map(p => ({ name: String(p.name), hcp: Number.isFinite(Number(p.hcp)) && p.hcp !== null && p.hcp !== '' ? Number(p.hcp) : null }));
    const known = list.filter(p => p.hcp !== null);
    const avg = known.length ? known.reduce((a, p) => a + p.hcp, 0) / known.length : 0;
    const guessed = list.filter(p => p.hcp === null).map(p => p.name).sort((a, b) => a.localeCompare(b));
    const ranked = list.map(p => ({ name: p.name, hcp: p.hcp === null ? avg : p.hcp, guessed: p.hcp === null }))
      .sort((a, b) => a.hcp - b.hcp || a.name.localeCompare(b.name));
    const unpaired = [];
    if (ranked.length % 2 === 1) unpaired.push(ranked.splice(Math.floor(ranked.length / 2), 1)[0].name);
    const pairs = [], spreads = [];
    for (let i = 0, j = ranked.length - 1; i < j; i++, j--) {
      pairs.push([ranked[i].name, ranked[j].name]);
      spreads.push(Math.round((ranked[i].hcp + ranked[j].hcp) * 10) / 10);
    }
    return { pairs, unpaired, guessed, combined: spreads, usedHandicaps: known.length > 0 };
  }

  // ── Registry helpers — what every other file calls instead of re-describing a game ──
  const KIND_ORDER = ['addon', 'base'];
  function getGame(id) { return ADDONS[id] || BASE_GAMES[id] || null; }
  function listGames(kind) {
    const src = kind === 'base' ? BASE_GAMES : ADDONS;
    return Object.keys(src).filter(id => src[id].meta).sort((a, b) => (src[a].order || 0) - (src[b].order || 0));
  }
  // UI helpers: the portal builds its pickers, (i) panels and event-card seal from these, so a game's
  // label/icon/rules text/seal live ONLY in its definition. Order is the order hosts see them.
  function gamesInUiOrder() {
    return listGames('addon').filter(id => ADDONS[id].released !== false).sort((x, y) => groupRank(x) - groupRank(y) || (ADDONS[x].meta.uiOrder || 99) - (ADDONS[y].meta.uiOrder || 99));
  }
  // Dev-93: the picker groups games — 'format' (how the round is scored: BestBall, later Foursomes / Match Play)
  // above 'side' (side bets that work on any scorecards: Skins, CTP, MiserBall, Birdie Payouts). Default is 'side'.
  const GAME_GROUPS = [['format', 'Format'], ['side', 'Side games']];
  function gameGroup(id) { return ADDONS[id] && ADDONS[id].meta && ADDONS[id].meta.group === 'format' ? 'format' : 'side'; }
  function groupRank(id) { return gameGroup(id) === 'format' ? 0 : 1; }
  function gamesUiMeta() {
    const out = {};
    gamesInUiOrder().forEach(id => { out[id] = { label: ADDONS[id].meta.label, icon: ADDONS[id].meta.icon, group: gameGroup(id) }; });
    return out;
  }
  function gamesInfo() {
    const out = {};
    gamesInUiOrder().forEach(id => { out[id] = ADDONS[id].meta.info; });
    return out;
  }
  function gamesSealLabels() {
    const out = {};
    gamesInUiOrder().forEach(id => { out[id] = ADDONS[id].meta.seal; });
    return out;
  }
  function defaultConfig(id) {
    const g = getGame(id);
    const out = {};
    ((g && g.config) || []).forEach(f => { out[f.key] = Array.isArray(f.default) ? f.default.slice() : f.default; });
    return out;
  }
  // Validates a config against a field schema. Pure and dependency-free ON PURPOSE:
  // the Worker embeds this exact function's source (generated by
  // source/tests/sync_worker_schemas.mjs), so the form and the server cannot disagree.
  function validateFields(fields, cfg) {
    const errors = [];
    cfg = cfg || {};
    (fields || []).forEach(f => {
      const v = cfg[f.key];
      if (v === undefined || v === null) { if (f.required) errors.push(f.label + ' is required'); return; }
      if (f.type === 'money' || f.type === 'int') {
        const n = Number(v);
        if (!Number.isFinite(n)) errors.push(f.label + ' must be a number');
        else if (f.type === 'int' && !Number.isInteger(n)) errors.push(f.label + ' must be a whole number');
        else if (f.positive && !(n > 0)) errors.push(f.label + ' must be more than 0');
        else if (f.min != null && n < f.min) errors.push(f.label + ' must be at least ' + f.min);
        else if (f.max != null && n > f.max) errors.push(f.label + ' must be at most ' + f.max);
      } else if (f.type === 'holes') {
        if (!Array.isArray(v) || !v.length) errors.push(f.label + ': pick at least one hole');
        else if (!v.every(h => Number.isInteger(h) && h >= 1 && h <= 18) || new Set(v).size !== v.length) errors.push(f.label + ' must be unique holes 1-18');
      } else if (f.type === 'pars') {
        const lo = f.min != null ? f.min : 1, hi = f.max != null ? f.max : Infinity;
        if (!Array.isArray(v) || v.length !== 18 || !v.every(p => Number(p) >= lo && Number(p) <= hi && (!f.integer || Number.isInteger(Number(p))))) {
          errors.push(f.label + ' needs 18 par values' + (f.min != null ? ' (' + lo + '-' + hi + ')' : ''));
        }
      } else if (f.type === 'parsmap') {
        // { playerName: [18 pars] } — optional extra pars for players on a different tee
        const lo = f.min != null ? f.min : 1, hi = f.max != null ? f.max : Infinity;
        const okOne = a => Array.isArray(a) && a.length === 18 && a.every(p => Number(p) >= lo && Number(p) <= hi && (!f.integer || Number.isInteger(Number(p))));
        if (typeof v !== 'object' || Array.isArray(v) || !Object.keys(v).every(k => okOne(v[k]))) errors.push(f.label + ' needs 18 par values (' + lo + '-' + hi + ') per player');
      } else if (f.type === 'pairs') {
        // [[nameA, nameB], ...]: at least two pairs, two different names each, nobody in two pairs
        const names = [];
        const sz = f.sizeKey && Number.isInteger(Number(cfg[f.sizeKey])) && Number(cfg[f.sizeKey]) >= 1 && Number(cfg[f.sizeKey]) <= 4 ? Number(cfg[f.sizeKey]) : 2;
        const wellFormed = Array.isArray(v) && v.length >= (f.minPairs != null ? f.minPairs : 2) && (!f.evenPairs || v.length % 2 === 0) && v.every(pr => Array.isArray(pr) && pr.length === sz &&
          pr.every(n => typeof n === 'string' && n.trim()) && new Set(pr.map(n => n.trim().toLowerCase())).size === sz);
        if (wellFormed) v.forEach(pr => pr.forEach(n => names.push(n.trim().toLowerCase())));
        if (!wellFormed) errors.push(f.label + ' needs ' + (f.evenPairs ? 'two pairs for every foursome' : 'at least ' + ((f.minPairs || 2) === 1 ? 'one ' : 'two ') + (sz === 2 ? 'pairs' : 'teams')) + ' of ' + (sz === 1 ? 'one player' : sz + ' different players'));
        else if (new Set(names).size !== names.length) errors.push(f.label + ': a player can only be on one ' + (sz === 2 ? 'pair' : 'team'));
      } else if (f.type === 'strings') {
        if (!Array.isArray(v) || !v.every(x => typeof x === 'string' && x.trim().length <= (f.max || 60))) errors.push(f.label + ' must be short text (up to ' + (f.max || 60) + ' characters each)');
      } else if (f.type === 'enum') {
        if (!f.lenient && !(f.values || []).includes(v)) errors.push(f.label + ' must be one of ' + (f.values || []).join('/'));
      }
    });
    return { ok: errors.length === 0, errors };
  }
  // Keeps only the declared fields, in schema order, coerced to their type — the shape that is
  // stored. An enum value outside its list falls back to the default.
  function cleanFields(fields, cfg) {
    const out = {};
    cfg = cfg || {};
    (fields || []).forEach(f => {
      const v = cfg[f.key];
      if (v === undefined || v === null) return;
      if (f.type === 'money' || f.type === 'int') out[f.key] = Number(v);
      else if (f.type === 'holes') out[f.key] = v.slice().sort((a, b) => a - b);
      else if (f.type === 'pars') out[f.key] = v.map(Number);
      else if (f.type === 'parsmap') { const m = {}; Object.keys(v).forEach(k => { m[String(k).trim()] = v[k].map(Number); }); if (Object.keys(m).length) out[f.key] = m; }
      else if (f.type === 'pairs') out[f.key] = v.map(pr => pr.map(n => String(n).trim()));
      else if (f.type === 'strings') out[f.key] = v.map(x => String(x).trim().slice(0, f.max || 60));
      else if (f.type === 'enum') out[f.key] = (f.values || []).includes(v) ? v : f.default;
      else out[f.key] = v;
    });
    return out;
  }
  function validateGameConfig(id, cfg) {
    const g = getGame(id);
    if (!g) return { ok: false, errors: ['unknown game ' + id] };
    return validateFields(g.config, cfg);
  }
  function cleanGameConfig(id, cfg) {
    const g = getGame(id);
    return g ? cleanFields(g.config, cfg) : null;
  }
  // The schema table the Worker embeds: every add-on's label + field list.
  function gameSchemas() {
    const out = {};
    listGames('addon').forEach(id => { out[id] = { label: ADDONS[id].meta.label, config: ADDONS[id].config, ...(ADDONS[id].moneyOptional ? { moneyOptional: true } : {}) }; });
    return out;
  }
  // Generic pot-fit guard: every selected game declares its own fixed set-aside,
  // so the guard never hard-codes CTP + MiserBall. configs = { gameId: cfg }.
  // problem wording matches the Dev-89 portal text exactly.
  function potFit(configs, dollarPerPlayer, players) {
    const dpp = Number(dollarPerPlayer) || 0;
    const n = Math.max(0, Math.floor(Number(players) || 0));
    const parts = [];
    let problem = null;
    listGames('addon').forEach(id => {
      const g = ADDONS[id];
      if (!configs || !configs[id] || !g.fixedCost) return;
      const cost = g.fixedCost(configs[id], { players: n }) || 0;
      if (cost > 0) parts.push({ id, label: g.meta.label, cost });
      const rate = g.maxPerPlayer ? g.maxPerPlayer(configs[id]) : 0;
      if (!problem && dpp > 0 && rate > dpp) {
        problem = `${g.meta.label} ($${rate.toFixed(2)}/player) is more than the whole $${dpp.toFixed(2)} each player puts in`;
      }
    });
    const fixedCost = parts.reduce((a, p) => a + p.cost, 0);
    const pot = dpp * n;
    if (!problem && dpp > 0 && n > 0 && fixedCost > pot) {
      problem = `${parts.map(p => p.label).join(' + ')} come to $${fixedCost.toFixed(2)}, more than the $${pot.toFixed(2)} pot (${n} confirmed × $${dpp.toFixed(2)}) — lower a rate or raise $ per Player`;
    }
    return { parts, fixedCost, pot, problem };
  }

  // ── Base-game registry (Phase A: only what Gatherings uses) ─────────────
  // scorecard_only: no competition of its own — the round exists to carry
  // cards; any money comes from add-ons. Phase B registers stableford,
  // scramble_pair and points_by_score_type from BFE-Admin's ENGINES.
  const BASE_GAMES = {
    scorecard_only: { id: 'scorecard_only' }
  };
  defineGame('scorecard_only', {
    kind: 'base', input: 'strokes', net: false, entity: 'individual', order: 0,
    meta: { label: 'Scorecards only', icon: '📋', seal: '', info: 'No competition of its own: the round carries scorecards, and any money comes from the add-on games.' },
    config: [], fixtures: []
  });

  // ── Round Config v1 from a Gathering's bfe_gathering_games row ─────────
  // (spec §2a.5). Legacy rows are adapted, never migrated. An add-on is
  // only present when its game is on AND (for cttp/birdieball) its config
  // exists — the same gate the Dev-87 engine used.
  function gatheringConfigFromLegacy(row) {
    const games = (row && Array.isArray(row.games)) ? row.games : [];
    const addons = [];
    if (games.includes('cttp') && row.cttp_config) {
      addons.push({ id: 'cttp', entity: 'individual', dollar_per_hole: row.cttp_config.dollar_per_hole, holes: row.cttp_config.holes || [] });
    }
    if (games.includes('birdieball') && row.birdieball_config) {
      addons.push({ id: 'birdieball', entity: 'individual', dollar_per_player: row.birdieball_config.dollar_per_player });
    }
    // Dev-91: optional net setup frozen at game setup —
    //   handicap_config: { allowance, skins_basis, birdiepay_basis, stroke_index:[18],
    //                      players: { name: {tee, kind:'index'|'given'|'gross', strokes, stroke_index?} } }
    // No handicap_config (every pre-Dev-91 row) = gross everywhere, byte-identical.
    const hcc = row && row.handicap_config && typeof row.handicap_config === 'object' ? row.handicap_config : null;
    const basisOf = k => (hcc && hcc[k] === 'net' ? 'net' : 'gross');
    if (games.includes('birdiepay') && row.birdiepay_config) {
      const b = { id: 'birdiepay', entity: 'individual', dollar_per_birdie: row.birdiepay_config.dollar_per_birdie, pars: row.birdiepay_config.pars || [] };
      if (row.birdiepay_config.pars_by_player && typeof row.birdiepay_config.pars_by_player === 'object') b.pars_by_player = row.birdiepay_config.pars_by_player;
      if (basisOf('birdiepay_basis') === 'net') b.basis = 'net';
      addons.push(b);
    }
    // Dev-93: BestBall arrives through the generic game_configs column (no legacy column of its own).
    const fbc = row && row.game_configs && typeof row.game_configs === 'object' ? row.game_configs.fourball : null;
    if (games.includes('fourball') && fbc) {
      addons.push({ id: 'fourball', entity: 'pair', dollar_per_player: fbc.dollar_per_player, basis: fbc.basis === 'net' ? 'net' : 'gross',
        net_mode: fbc.net_mode === 'low' ? 'low' : 'own', pairs: Array.isArray(fbc.pairs) ? fbc.pairs : [],
        ...(periodKey(fbc) !== 'round' ? { period: periodKey(fbc), win_by: fbc.win_by === 'holes' ? 'holes' : 'strokes', scope: fbc.win_by === 'holes' || fbc.scope === 'group' ? 'group' : 'field' } : {}) });
    }
    // Dev-94: Alternate Shot and Match Play ride the same generic column.
    const asc = row && row.game_configs && typeof row.game_configs === 'object' ? row.game_configs.altshot : null;
    if (games.includes('altshot') && asc) {
      addons.push({ id: 'altshot', entity: 'pair', dollar_per_player: Number(asc.dollar_per_player) || 0, basis: asc.basis === 'net' ? 'net' : 'gross',
        net_mode: asc.net_mode === 'own' ? 'own' : 'low', allowance: asc.allowance != null ? Number(asc.allowance) : 50, pairs: Array.isArray(asc.pairs) ? asc.pairs : [],
        ...(periodKey(asc) !== 'round' ? { period: periodKey(asc) } : {}), win_by: asc.win_by === 'holes' ? 'holes' : 'strokes', scope: asc.win_by === 'holes' || asc.scope === 'group' ? 'group' : 'field' });
    }
    // v4.48.0: Scramble (Teams of 2) rides the generic column too.
    const scc = row && row.game_configs && typeof row.game_configs === 'object' ? row.game_configs.scramble : null;
    if (games.includes('scramble') && scc) {
      addons.push({ id: 'scramble', entity: 'pair', dollar_per_player: Number(scc.dollar_per_player) || 0, basis: scc.basis === 'gross' ? 'gross' : 'net',
        net_mode: scc.net_mode === 'low' ? 'low' : 'own', scoring: scc.scoring === 'stableford' ? 'stableford' : 'strokes', scale: scc.scale === 'standard' ? 'standard' : 'bf',
        hcp_method: scrambleMethod(scc), team_size: scrambleSize(scc), allowance: scrambleCombinedPct(scc),
        ...Object.fromEntries([1, 2, 3, 4].filter(i => scc['pct_' + i] != null && Number.isFinite(Number(scc['pct_' + i]))).map(i => ['pct_' + i, Number(scc['pct_' + i])])),
        payout: ['winner', 'top2', 'top3'].includes(scc.payout) ? scc.payout : 'winner', pars: Array.isArray(scc.pars) ? scc.pars : [], pairs: Array.isArray(scc.pairs) ? scc.pairs : [], names: Array.isArray(scc.names) ? scc.names.map(x => String(x || '')) : [] });
    }
    const hlc = row && row.game_configs && typeof row.game_configs === 'object' ? row.game_configs.hilo : null;
    if (games.includes('hilo') && hlc) {
      addons.push({ id: 'hilo', entity: 'pair', dollar_per_player: Number(hlc.dollar_per_player) || 0, basis: hlc.basis === 'net' ? 'net' : 'gross',
        net_mode: hlc.net_mode === 'low' ? 'low' : 'own', pairs: Array.isArray(hlc.pairs) ? hlc.pairs : [],
        ...(periodKey(hlc) !== 'round' ? { period: periodKey(hlc) } : {}) });
    }
    const mpc = row && row.game_configs && typeof row.game_configs === 'object' ? row.game_configs.matchplay : null;
    if (games.includes('matchplay') && mpc) {
      addons.push({ id: 'matchplay', entity: 'individual', dollar_per_player: Number(mpc.dollar_per_player) || 0, basis: mpc.basis === 'net' ? 'net' : 'gross',
        net_mode: mpc.net_mode === 'low' ? 'low' : 'own', allowance: mpc.allowance != null ? Number(mpc.allowance) : 100, matches: Array.isArray(mpc.matches) ? mpc.matches : [],
        ...(periodKey(mpc) !== 'round' ? { period: periodKey(mpc) } : {}) });
    }
    const lsc = row && row.game_configs && typeof row.game_configs === 'object' ? row.game_configs.lowscore : null;
    if (games.includes('lowscore') && lsc) {
      addons.push({ id: 'lowscore', entity: 'individual', dollar_per_player: lsc.dollar_per_player, basis: lsc.basis === 'net' ? 'net' : 'gross',
        ...(periodKey(lsc) !== 'round' ? { period: periodKey(lsc) } : {}) });
    }
    if (games.includes('skins')) {
      addons.push({ id: 'skins', entity: 'individual', basis: basisOf('skins_basis'), compare: 'low' });
    }
    // v4.13.0 — `ranking: true` keeps the per-player strokes without making any game net, so the
    // Net/Gross ranking can be shown (for fun) while every game stays gross.
    const anyNet = addons.some(a => a.basis === 'net') || !!(hcc && hcc.ranking === true && hcc.players);
    return {
      v: 1,
      base: { game: 'scorecard_only', params: {} },
      entity: { level: 'individual', unit: 'player', derive: null },
      input: 'strokes',
      compare: 'low',
      handicap: anyNet
        ? { mode: 'net', allowance: !hcc || hcc.allowance == null ? 95 : Number(hcc.allowance), stroke_index: (hcc && hcc.stroke_index) || null, players: (hcc && hcc.players) || {} }
        : { mode: 'scratch' },
      holes: { layout: null, half: row && row.hole_half ? row.hole_half : null },
      addons,
      payout: { entry_per_player: Number(row && row.dollar_per_player) || 0 },
      legacy: { source: 'bfe_gathering_games', games: games }
    };
  }

  // ── Generic payout close for an individual-entity round ────────────────
  // config: Round Config v1. inputs: { scorecards, ctpLeaders, bbAnswers }.
  // Pot = entry_per_player × players who actually turned in a card.
  // Returns the results snapshot (same shape Dev-87 saved as payout_summary,
  // calc_version 1 — existing saved snapshots stay readable as-is).
  function computeRoundPayout(config, inputs) {
    inputs = inputs || {};
    const cards = (inputs.scorecards || []).filter(c => c && c.player);
    const players = cards.map(c => c.player);
    const ledger = makeLedger(players);
    const dpp = Number(config && config.payout && config.payout.entry_per_player) || 0;
    const totalPot = dpp * ledger.n;
    const state = { ledger, remaining: totalPot, unallocated: 0, rollover: 0 };
    const results = { cttp: null, birdieball: null, birdiepay: null, fourball: null, altshot: null, scramble: null, hilo: null, matchplay: null, lowscore: null, skins: null };
    const addons = ((config && config.addons) || [])
      .filter(a => ADDONS[a.id])
      .slice()
      .sort((a, b) => ADDONS[a.id].order - ADDONS[b.id].order);
    // Dev-91: net cards, built once and shared by every net-basis add-on.
    const hc = config && config.handicap;
    const netByPlayer = new Map();
    const missingStrokes = [];
    let hcSpecs = null;
    if (hc && hc.mode === 'net') {
      const specs = new Map(Object.entries(hc.players || {}).map(([k, v]) => [norm(k), v]));
      hcSpecs = specs;
      cards.forEach(c => {
        const spec = specs.get(norm(c.player));
        if (!spec) missingStrokes.push(c.player);
        netByPlayer.set(norm(c.player), netCard(c, spec, hc.stroke_index));
      });
    }
    const withCards = Object.assign({}, inputs, { scorecards: cards }, netByPlayer.size ? { netByPlayer, hcSpecs, hcSI: hc.stroke_index || null } : {});
    let residualRan = false;
    let unspentEach = 0;   // what each player gets back of money that no game took (the buy-in did not divide evenly across the pots)
    addons.forEach(a => {
      results[a.id] = ADDONS[a.id].carve(state, a, withCards);
      if (ADDONS[a.id].residual) residualRan = true;
    });
    if (!residualRan) {
      // No residual game to absorb the balance (incl. rollover) — give it back.
      const leftover = Math.max(0, state.remaining) + state.rollover;
      if (leftover > 0) { const gb = ledger.giveBack(leftover); state.unallocated += gb.unallocated; unspentEach = gb.each; }
    }
    const rows = [...ledger.rows.values()]
      .map(r => Object.assign({}, r, { total: r.skins + r.cttp + r.birdieball + (r.birdiepay || 0) + (r.fourball || 0) + (r.altshot || 0) + (r.scramble || 0) + (r.hilo || 0) + (r.matchplay || 0) + (r.lowscore || 0) + r.given_back }))
      .sort((a, b) => b.total - a.total || a.player.localeCompare(b.player));
    const games = (config && config.legacy && config.legacy.games) || addons.map(a => a.id);
    return {
      calc_version: 1,
      players_count: ledger.n, players, dollar_per_player: dpp, total_pot: totalPot,
      ...(unspentEach > 0 && (results.fourball || results.altshot || results.scramble || results.hilo || results.matchplay || results.lowscore) ? { unspent_each: unspentEach } : {}),   // only for the games with pots; every older shape is unchanged
      games, cttp: results.cttp, birdieball: results.birdieball,
      // birdiepay only appears in a snapshot when the game was on, so every pre-Dev-89 payout keeps its exact shape
      ...(results.birdiepay ? { birdiepay: results.birdiepay } : {}),
      ...(results.fourball ? { fourball: results.fourball } : {}),
      ...(results.altshot ? { altshot: results.altshot } : {}),
      ...(results.scramble ? { scramble: results.scramble } : {}),
      ...(results.hilo ? { hilo: results.hilo } : {}),
      ...(results.matchplay ? { matchplay: results.matchplay } : {}),
      ...(results.lowscore ? { lowscore: results.lowscore } : {}),
      skins: results.skins, payouts: rows,
      // handicap summary only appears when a net game ran — gross snapshots keep their exact shape
      ...(netByPlayer.size ? { rankings: buildRankings(cards, netByPlayer) } : {}),
      ...(netByPlayer.size ? { handicap: {
        allowance: hc.allowance,
        players: cards.map(c => {
          const spec = (hc.players || {})[Object.keys(hc.players || {}).find(k => norm(k) === norm(c.player))] || {};
          return { player: c.player, tee: spec.tee || null, kind: spec.kind || null, strokes: netByPlayer.get(norm(c.player)).strokes };
        }),
        missing: missingStrokes
      } } : {}),
      unallocated: Math.round(state.unallocated * 100) / 100
    };
  }

  // ── Gatherings Close & Calculate (Dev-87 contract, unchanged) ──────────
  function computeGatheringGamesPayout(row, scorecards, ctpLeaders, bbAnswers) {
    return computeRoundPayout(gatheringConfigFromLegacy(row), { scorecards, ctpLeaders, bbAnswers });
  }

  // ── BestBall live board (Dev-93) ───────────────────────────────────────
  // Where every pair stands RIGHT NOW from whatever scores are saved (partial cards welcome), using the
  // same better-ball / net logic the payout uses, so the live view can never disagree with the close.
  // pars (optional, 18) lets pairs on different holes be ranked fairly by score to par.
  // Returns null when the game has no BestBall.
  function fourballBoard(row, scorecards, pars, gameId) {
    const snap = computeGatheringGamesPayout(row, (scorecards || []).filter(c => c && c.player), {}, []);
    const f = snap && snap[gameId || 'fourball'];
    if (!f) return null;
    const parAt = h => (Array.isArray(pars) && Number.isFinite(Number(pars[h - 1])) ? Number(pars[h - 1]) : null);
    const rows = (f.standings || []).map(r => {
      const done = (r.holes || []).filter(x => x.score != null);
      const total = done.reduce((a, x) => a + x.score, 0);
      const parsOk = done.length > 0 && done.every(x => parAt(x.hole) != null);
      return {
        pair: r.pair, played: done.length, thru: done.length ? Math.max(...done.map(x => x.hole)) : 0,
        total, to_par: parsOk ? total - done.reduce((a, x) => a + parAt(x.hole), 0) : (done.length ? null : 0), complete: !!r.complete
      };
    });
    const useParLive = rows.every(r => r.to_par !== null);
    rows.sort((a, b) => useParLive
      ? (a.played === 0) - (b.played === 0) || a.to_par - b.to_par || b.played - a.played
      : (a.played === 0) - (b.played === 0) || a.total - b.total || b.played - a.played);
    let place = 0, prev = null;
    rows.forEach((r, i) => {
      const key = r.played === 0 ? 'none' : (useParLive ? r.to_par : r.total) + '|' + (useParLive ? '' : r.played);
      if (key !== prev) { place = i + 1; prev = key; }
      r.place = r.played === 0 ? null : place;
    });
    rows.forEach(r => { r.tied = r.place != null && rows.filter(x => x.place === r.place).length > 1; });
    return { basis: f.basis, net_mode: f.net_mode || null, net_missing: !!f.net_missing, ranked_by: useParLive ? 'to_par' : 'total', rows };
  }

  // ── BestBall match view (Dev-93) ────────────────────────────────────────
  // For the Live Actions screen: each foursome (two pairs head to head) hole by hole, with the running tally of
  // every segment. Read from the same payout result Close uses (so it cannot disagree), partial cards welcome.
  // In the original 'total' pot there are no segments to pay, but the strip still shows Front and Back.
  function fourballMatchView(fb, addon) {
    if (!fb) return null;
    const isMatch = !!(addon && Array.isArray(addon.matches));
    let plan = fourballSegmentPlan(addon);
    const isHilo = fb.format === 'hilo';
    if (isMatch || isHilo) plan = { period: plan.period, mode: plan.period === 'round' ? 'match' : plan.period, win_by: isHilo ? 'points' : 'holes', scope: 'group', segs: plan.period === 'round' ? [{ key: 'match', label: 'Match', a: 0, b: 18 }] : plan.segs };
    const sidesCfg = isMatch ? [].concat(...addon.matches.filter(m => Array.isArray(m) && m.length === 2).map(m => [[m[0]], [m[1]]])) : (addon && addon.pairs);
    const viewSegs = plan.mode === 'total' ? PERIODS.fbt.segs : plan.segs; // the one-pot game still shows Front and Back
    const byKey = new Map((fb.standings || []).map(r => [r.pair.map(norm).join('|'), r]));
    const scoresOf = (pr, field) => {
      const out = new Array(18).fill(null);
      const r = byKey.get(pr.map(norm).join('|'));
      if (r) (r.holes || []).forEach(h => { const v = field ? h[field] : h.score; if (v != null) out[h.hole - 1] = v; });
      return out;
    };
    const money = (fb.segments && fb.segments.groups) || [];
    const groups = fourballGroups(sidesCfg).map((g, gi) => {
      const pairs = g.pairs.map(pr => ({ names: pr, scores: scoresOf(pr) }));
      if (pairs.length < 2) return { n: g.n, pairs, solo: true };
      const A = pairs[0].scores, B = pairs[1].scores;
      if (isHilo) {
        // Hi-Lo: `a`/`b` are each pair's LOW ball, `ha`/`hb` its HIGH ball; pa/pb the points the pair took on the hole (0-2)
        const HA = scoresOf(pairs[0].names, 'high'), HB = scoresOf(pairs[1].names, 'high');
        const holes = A.map((a, i) => {
          const full = a != null && B[i] != null && HA[i] != null && HB[i] != null;
          const pa = full ? (a < B[i] ? 1 : 0) + (HA[i] < HB[i] ? 1 : 0) : null, pb = full ? (a > B[i] ? 1 : 0) + (HA[i] > HB[i] ? 1 : 0) : null;
          return { hole: i + 1, a, b: B[i], ha: HA[i], hb: HB[i], pa, pb, res: !full ? null : pa > pb ? 'A' : pa < pb ? 'B' : 'T' };
        });
        const sides = [{ lo: A, hi: HA }, { lo: B, hi: HB }];
        const segs = viewSegs.map(sg => {
          const r = hiloSegmentResult(sides, sg);
          const paid = ((money[gi] || {}).segments || []).find(x => x.key === sg.key) || null;
          const both = holes.slice(sg.a, sg.b).filter(h => h.res).length;
          return { key: sg.key, label: sg.label, from: sg.a + 1, to: sg.b, played: both, holes_won: r.won, points: r.won, halved: r.halved,
            strokes: [0, 0], lead: r.lead, leader: r.lead === 0 ? null : (r.lead > 0 ? 0 : 1), final: r.status !== 'pending',
            status: both === 0 ? 'not_started' : (r.status === 'pending' ? 'in_progress' : 'final'), pot: paid ? paid.pot : null, text: r.text, decided: !!r.decided };
        });
        return { n: g.n, pairs, holes, segs, strokes_lead: 0, hilo: true };
      }
      const holes = A.map((a, i) => ({ hole: i + 1, a, b: B[i], res: a == null || B[i] == null ? null : a < B[i] ? 'A' : a > B[i] ? 'B' : 'T' }));
      const segs = viewSegs.map(sg => {
        const r = isMatch ? matchSegmentResult([A, B], sg) : fourballSegmentResult([A, B], sg, plan.win_by);
        const both = holes.slice(sg.a, sg.b).filter(h => h.res).length;
        let sa = 0, sb = 0;
        holes.slice(sg.a, sg.b).forEach(h => { if (h.res) { sa += h.a; sb += h.b; } });
        const lead = isMatch ? r.lead : plan.win_by === 'holes' ? r.won[0] - r.won[1] : sb - sa; // positive = pair A ahead
        const paid = ((money[gi] || {}).segments || []).find(x => x.key === sg.key) || null;
        return { key: sg.key, label: sg.label, from: sg.a + 1, to: sg.b, played: both, holes_won: r.won, halved: r.halved,
          strokes: [sa, sb], lead, leader: lead === 0 ? null : (lead > 0 ? 0 : 1), final: r.status !== 'pending',
          status: both === 0 ? 'not_started' : (r.status === 'pending' ? 'in_progress' : 'final'), pot: paid ? paid.pot : null,
          ...(isMatch ? { text: r.text, decided: !!r.decided } : {}) };
      });
      let ta = 0, tb = 0; holes.forEach(h => { if (h.res) { ta += h.a; tb += h.b; } });
      return { n: g.n, pairs, holes, segs, strokes_lead: tb - ta };
    });
    return { mode: plan.mode, win_by: plan.win_by, scope: plan.scope, groups };
  }

  // ── Scorecard helpers ──────────────────────────────────────────────────
  // One latest card per player. Rows must arrive newest-first (GET
  // /scorecards orders captured_at DESC), so the first seen per player wins.
  function latestScorecardPerPlayer(rows) {
    const seen = new Set();
    const out = [];
    (rows || []).forEach(r => {
      const k = norm(r.player);
      if (!k || seen.has(k)) return;
      seen.add(k);
      out.push(r);
    });
    return out;
  }
  // Holes a card is missing a gross score on, within the round's hole count.
  function scorecardMissingHoles(card, holeCount) {
    const holes = Array.isArray(card.holes) ? card.holes : [];
    const missing = [];
    for (let i = 0; i < holeCount; i++) {
      if (!(typeof holes[i] === 'number' && holes[i] > 0)) missing.push(i + 1);
    }
    return missing;
  }


  // ── Live scoring helpers (Dev-93) ───────────────────────────────────────
  // A foursome is two pairs head to head. The host's BestBall pairs are taken two at a time in the order
  // they were set: pairs 1+2 are group 1, pairs 3+4 are group 2, and so on. A last odd pair is its own group.
  function fourballGroups(pairs) {
    const ps = (pairs || []).filter(p => Array.isArray(p) && (p.length === 2 || p.length === 1));
    const out = [];
    for (let i = 0; i < ps.length; i += 2) {
      const gp = ps.slice(i, i + 2);
      out.push({ n: out.length + 1, pairs: gp, players: gp.reduce((a, p) => a.concat(p), []) });
    }
    return out;
  }
  // Short unique initials for a list of names: "Brian Hager" -> BH. A clash gets more letters, then a number.
  function playerInitials(names) {
    const base = n => {
      const w = String(n || '').trim().split(/\s+/).filter(Boolean);
      if (!w.length) return '?';
      return w.length === 1 ? w[0].slice(0, 2).toUpperCase() : (w[0][0] + w[w.length - 1][0]).toUpperCase();
    };
    const out = [], used = new Set();
    (names || []).forEach(n => {
      let v = base(n);
      if (used.has(v)) {
        const w = String(n || '').trim().split(/\s+/).filter(Boolean);
        const longer = (w[0].slice(0, 2) + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase();
        if (!used.has(longer)) v = longer;
      }
      let k = 2; const root = v;
      while (used.has(v)) v = root + (k++);
      used.add(v); out.push(v);
    });
    return out;
  }
  // Merge what the server has with what this phone holds. A hole this phone changed and has not yet saved
  // (dirty) keeps the local value; every other hole takes the server's value when the server has one.
  function mergeHoleScores(local, remote, dirty) {
    const out = [];
    for (let i = 0; i < 18; i++) {
      const l = Array.isArray(local) ? local[i] : null, r = Array.isArray(remote) ? remote[i] : null;
      const isNum = v => typeof v === 'number' && v > 0;
      if (dirty && dirty[i + 1] != null) out.push(dirty[i + 1] === 0 ? null : dirty[i + 1]);
      else if (isNum(r)) out.push(r);
      else out.push(isNum(l) ? l : null);
    }
    return out;
  }

  // ── Suggested amounts (v4.9.14, Brian: "we figure it out for the host") ──
  // Pure: a buy-in, a headcount and the games ticked -> whole-dollar starting
  // amounts for the per-game fields. Brian's model: Skins is the residual and
  // aims for ~half the pot; BirdieBall ~20% of the buy-in per player; CTP's
  // purse ~30% of the pot spread over its holes; Birdie Payouts ~30% of the
  // buy-in per birdie (it also double-dips with skins, so it stays modest). Everything rounds
  // to the nearest whole dollar with a $1 floor ("players don't have change").
  // The guard that caps payouts at the pot still applies at close, so a wrong
  // guess can move money to Skins but never overpay. Designed for 4-8 players;
  // the caller passes max(4, confirmed Yes).
  // Handicap strokes per player and hole, from the saved game config alone (no scorecards needed), for the live
  // panels. `src` is a gathering row or its engine config. Follows BestBall's Off the low when that is chosen.
  // Returns [{ player, strokes, got: { hole: count }, known }]; known=false when no strokes were set for the player.
  function strokeMarksFor(src, names) {
    const config = src && src.addons ? src : (src ? gatheringConfigFromLegacy(src) : null);
    const hc = config && config.handicap;
    if (!hc || hc.mode !== 'net') return (names || []).map(player => ({ player, strokes: 0, got: {}, known: false }));
    const specs = new Map(Object.entries(hc.players || {}).map(([k, v]) => [norm(k), v]));
    const fb = (config.addons || []).find(a => a.id === 'fourball');
    const low = !!(fb && fb.basis === 'net' && fb.net_mode === 'low');
    const own = nm => { const sp = specs.get(norm(nm)); return sp && Number.isFinite(Number(sp.strokes)) ? Math.trunc(Number(sp.strokes)) : null; };
    let lowStrokes = 0;
    if (low) {
      const ss = [];
      (fb.pairs || []).forEach(pr => (pr || []).forEach(nm => { const v = own(nm); if (v != null) ss.push(v); }));
      lowStrokes = ss.length ? Math.min(...ss) : 0;
    }
    const paired = new Set(((fb && fb.pairs) || []).flat().map(norm));
    return (names || []).map(player => {
      const sp = specs.get(norm(player)); const base = own(player);
      if (base == null) return { player, strokes: 0, got: {}, known: false };
      const eff = base - (low && paired.has(norm(player)) ? lowStrokes : 0);
      const si = sp && Array.isArray(sp.stroke_index) && sp.stroke_index.length === 18 ? sp.stroke_index : (Array.isArray(hc.stroke_index) && hc.stroke_index.length === 18 ? hc.stroke_index : null);
      const got = {};
      if (si) si.forEach((r, i) => { const k = strokesOnHole(eff, r, 18); if (k) got[i + 1] = k; });
      return { player, strokes: eff, got, known: true };
    });
  }

  // ── What each game IS, for every screen (Dev-94 refactor) ───────────────────────────────
  // Screens read these instead of checking game ids:
  //   unit              who a result belongs to: 'player' | 'pair' (better ball) | 'ball' (one ball per team) | 'match' (head to head)
  //   sides             true = played hole by hole between sides (BestBall, Alternate Shot, Match Play): live scoring, hole strip, match story
  //   sideForm          true = set up on the generic side-game form (pairs / matches, allowance, periods, pot)
  //   allowance         'round' = uses the round's handicap allowance (the 95%), 'own' = has its own allowance and stroke rule, 'none' = no strokes
  //   individualScores  true = a player's own gross / net score matters to the game (so the Net / Gross ranking is meaningful)
  const TRAIT_DEFAULTS = { unit: 'player', sides: false, sideForm: false, allowance: 'none', individualScores: true };
  function gameTraits(id) { const m = (ADDONS[id] && ADDONS[id].meta) || {}; return Object.assign({}, TRAIT_DEFAULTS, m.traits || {}); }
  function gamesWith(pred) { return gamesInUiOrder().filter(id => pred(gameTraits(id), id)); }
  function sideGames() { return gamesWith(t => t.sides); }
  function sideFormGames() { return gamesWith(t => t.sideForm); }
  // The sides of a configured side game, flattened in play order: pairs as given, or each match's two players.
  function gameSides(id, addon) {
    if (!addon) return [];
    if (gameTraits(id).unit === 'match') return [].concat(...(addon.matches || []).filter(m => Array.isArray(m) && m.length === 2).map(m => [[m[0]], [m[1]]]));
    return (addon.pairs || []).filter(p => Array.isArray(p) && (p.length >= 1 && p.length <= 4));
  }

  // The strokes the games with their OWN allowance (Alternate Shot, Match Play) actually use, so every screen can show
  // the real numbers. These do NOT use the round's allowance % (the 95%). Each such game supplies `strokeRows(addon, h)`:
  //   altshot   a pair's strokes = allowance% (default 50) of the two COURSE handicaps added (given-kind: their given strokes)
  //   matchplay each player's strokes = allowance% (default 100) of their course handicap; 'low' = off the lower in the match
  // Returns [{ id, label, allowance, net_mode, rows: [{ names, strokes, got:{hole:k}, detail }] }] (net games only).
  function sideStrokeSets(src, opts) {
    const config = src && src.addons ? src : (src ? gatheringConfigFromLegacy(src) : null);
    const hc = config && config.handicap;
    if (!hc || hc.mode !== 'net') return [];
    const specs = new Map(Object.entries(hc.players || {}).map(([k, v]) => [norm(k), v]));
    const course = nm => { const sp = specs.get(norm(nm)); return sp && sp.kind === 'index' && Number.isFinite(Number(sp.course_hcp)) ? Number(sp.course_hcp) : null; };
    const given = nm => { const sp = specs.get(norm(nm)); return sp && Number.isFinite(Number(sp.strokes)) ? Math.trunc(Number(sp.strokes)) : 0; };
    const siOf = nm => { const sp = specs.get(norm(nm)) || {}; return Array.isArray(sp.stroke_index) && sp.stroke_index.length === 18 ? sp.stroke_index : (Array.isArray(hc.stroke_index) && hc.stroke_index.length === 18 ? hc.stroke_index : null); };
    const gotFor = (nm, k) => { const si = siOf(nm), got = {}; if (si) si.forEach((r, h) => { const x = strokesOnHole(k, r, 18); if (x) got[h + 1] = x; }); return got; };
    const pctOf = (a, dflt) => (a.allowance != null && a.allowance !== '' && Number.isFinite(Number(a.allowance)) ? Number(a.allowance) : dflt);
    const out = [];
    gamesWith((t, gid) => t.allowance === 'own' || (opts && opts.all && ADDONS[gid].strokeRows)).forEach(id => {
      const a = (config.addons || []).find(x => x.id === id);
      if (!a || a.basis !== 'net' || !ADDONS[id].strokeRows) return;
      const rows = ADDONS[id].strokeRows(a, { course, given, gotFor, pctOf, round1: v => Math.round(v * 10) / 10 });
      out.push({ id, label: ADDONS[id].meta.label, allowance: rows.pct, net_mode: a.net_mode === 'low' ? 'low' : 'own', rows: rows.rows });
    });
    return out;
  }
  ADDONS.altshot.strokeRows = (as, h) => {
    const pct = h.pctOf(as, 50);
    const pairs = (as.pairs || []).filter(pr => Array.isArray(pr) && pr.length === 2);
    const base = pairs.map(pr => { const parts = pr.map(n => h.course(n) != null ? h.course(n) : h.given(n)); return { sum: parts.reduce((t, v) => t + v, 0), parts }; });
    const own = base.map(b => Math.round(b.sum * pct / 100));
    const low = as.net_mode === 'low';
    const field = fourballSegmentPlan(as).scope === 'field';
    return { pct, rows: pairs.map((pr, i) => {
      const lowest = low ? Math.min(...(field ? own : [own[i - (i % 2)], own[i - (i % 2) + 1]]).filter(v => v != null)) : 0;
      const k = own[i] - lowest;
      return { names: pr, strokes: k, got: h.gotFor(pr[0], k), detail: `${pct}% of ${base[i].parts.map(h.round1).join(' + ')} = ${own[i]}${low ? `, off the low (${lowest}) = ${k}` : ''}` };
    }) };
  };
  // Scramble: a team's strokes from its players' course handicaps (ranked %s, a combined %, or none); 'low' = off the lowest team
  ADDONS.scramble.strokeRows = (sc, h) => {
    const method = scrambleMethod(sc), n = scrambleSize(sc);
    const pairs = (sc.pairs || []).filter(pr => Array.isArray(pr) && pr.length === n);
    const base = pairs.map(pr => pr.map(nm => (h.course(nm) != null ? h.course(nm) : h.given(nm))));
    const own = base.map(parts => scrambleTeamStrokes(sc, parts));
    const lowest = sc.net_mode === 'low' && own.length ? Math.min(...own) : 0;
    const pc = scramblePcts(sc), cp = scrambleCombinedPct(sc);
    return { pct: method === 'combined' ? cp : method === 'ranked' ? null : 0, rows: pairs.map((pr, i) => {
      const k = own[i] - lowest, sorted = base[i].slice().sort((a, b) => a - b);
      const how = method === 'none' ? 'No handicap' : method === 'combined' ? `${cp}% of ${base[i].map(h.round1).join(' + ')}` : sorted.map((v, j) => `${pc[j]}% of ${h.round1(v)}`).join(' + ');
      return { names: pr, strokes: k, got: h.gotFor(pr[0], k), detail: `${how} = ${own[i]}${lowest ? `, off the low (${lowest}) = ${k}` : ''}` };
    }) };
  };
  // Hi-Lo: each player's own strokes (the round's allowance), off the lowest handicap in the foursome when net_mode is 'low'
  ADDONS.hilo.strokeRows = (hl, h) => {
    const pairs = (hl.pairs || []).filter(pr => Array.isArray(pr) && pr.length === 2), low = hl.net_mode === 'low', rows = [];
    pairs.forEach((pr, i) => {
      const base = i - (i % 2), fs = [pairs[base], pairs[base + 1]].filter(Boolean).flat();
      const lowest = low ? Math.min(...fs.map(n => h.given(n))) : 0;
      pr.forEach(n => { const k = h.given(n) - lowest; rows.push({ names: [n], strokes: k, got: h.gotFor(n, k), detail: low ? `${h.given(n)} strokes, off the low (${lowest}) = ${k}` : `${h.given(n)} strokes` }); });
    });
    return { pct: null, rows };
  };
  ADDONS.matchplay.strokeRows = (mp, h) => {
    const pct = h.pctOf(mp, 100), low = mp.net_mode === 'low', rows = [];
    (mp.matches || []).filter(m => Array.isArray(m) && m.length === 2).forEach(m => {
      const own = m.map(n => h.course(n) != null ? Math.round(h.course(n) * pct / 100) : h.given(n));
      const lowest = low ? Math.min(...own) : 0;
      m.forEach((n, i) => { const k = own[i] - lowest;
        rows.push({ names: [n], strokes: k, got: h.gotFor(n, k),
          detail: h.course(n) != null ? `${pct}% of course hcp ${h.round1(h.course(n))} = ${own[i]}${low ? `, off the low = ${k}` : ''}` : `Strokes given${low ? `, off the low = ${k}` : ''}` }); });
    });
    return { pct, rows };
  };

  // ── Head-to-head results (Alternate Shot, Match Play): who beat whom, how, and the story ──────────
  // The match view for a saved result (Match Play's sides are single players, paired up in order).
  function sideMatchView(f, pairs) {
    pairs = pairs || (f && f.pairs) || [];
    const sg = f.segments, isM = f.format === 'match';
    const addon = isM
      ? { matches: pairs.reduce((a, p, i) => { if (i % 2) a[a.length - 1].push(p[0]); else a.push([p[0]]); return a; }, []).filter(m => m.length === 2), segments: sg ? sg.mode : 'round' }
      : { pairs, segments: sg ? sg.mode : 'round', win_by: sg ? sg.win_by : 'strokes', scope: sg ? sg.scope : 'field' };
    try { return fourballMatchView(f, addon); } catch (e) { return null; }
  }
  // How a match went, hole by hole. holes = [{ hole, res: 'A' | 'B' | 'T' | null }] in hole order (null = not played).
  function sideMatchStory(holes) {
    let a = 0, b = 0, t = 0, lead = 0, maxA = 0, maxB = 0, changes = 0, square = 0, last = 0, firstLead = null, lastChangeHole = null, played = 0;
    (holes || []).forEach((h, i) => {
      if (!h || !h.res) return;
      played++;
      if (h.pa != null) { a += h.pa; b += h.pb; lead += h.pa - h.pb; if (h.pa === h.pb) t++; }   // Hi-Lo: the story is told in points
      else if (h.res === 'A') { a++; lead++; } else if (h.res === 'B') { b++; lead--; } else t++;
      maxA = Math.max(maxA, lead); maxB = Math.max(maxB, -lead);
      if (lead === 0) square++;
      const sgn = Math.sign(lead);
      if (sgn !== 0) {
        if (firstLead == null) firstLead = { side: sgn > 0 ? 'A' : 'B', hole: h.hole || i + 1 };
        if (last !== 0 && sgn !== last) { changes++; lastChangeHole = h.hole || i + 1; }
        last = sgn;
      }
    });
    return { played, a, b, t, lead, maxA, maxB, changes, square, firstLead, lastChangeHole,
      neverTrailed: played && b === 0 ? 'A' : (played && a === 0 ? 'B' : (maxB === 0 && lead > 0 ? 'A' : (maxA === 0 && lead < 0 ? 'B' : null))) };
  }
  // One entry per head-to-head in a saved result: who beat whom and how, ready to show.
  function sideGroupResults(f) {
    const mv = sideMatchView(f); if (!mv) return [];
    const sg = f.segments, short = names => names.map(n => String(n).trim().split(/\s+/)[0]).join(' & ');
    return mv.groups.filter(g => !g.solo && g.pairs.length === 2).map((g, gi) => {
      const [pa, pb] = g.pairs, story = sideMatchStory(g.holes);
      const paid = sg && sg.groups && sg.groups[gi] ? sg.groups[gi].segments : null;
      const whole = paid && paid.length === 1 ? paid[0] : null;
      const win = x => (x && x.status === 'won' && x.winner) ? (x.winner.join('|') === pa.names.join('|') ? 0 : 1) : null;
      let big = '', small = '', winner = null, status = story.played ? 'inprogress' : 'notstarted';
      // the winner's number first, so "7 – 6" always reads as the winner's view
      const hilo = f.format === 'hilo';
      const holesFor = w => { const [x, y] = w === 1 ? [story.b, story.a] : [story.a, story.b]; return hilo ? `${x} – ${y}` : `${x} – ${y}${story.t ? `, ${story.t} halved` : ''}`; };
      if (whole) {
        winner = win(whole);
        status = whole.status === 'won' ? 'won' : whole.status === 'push' ? 'halved' : 'inprogress';
        big = hilo ? (status === 'halved' ? 'Halved' : status === 'won' ? `${holesFor(winner)}` : 'In progress')
          : whole.result ? (status === 'halved' ? 'Halved' : whole.result) : (status === 'won' ? `${Math.abs(story.lead)} UP` : status === 'halved' ? 'Halved' : 'In progress');
        small = hilo ? `Points · ${status === 'halved' ? holesFor(0) : 'low ball + high ball'}` : `Holes ${holesFor(winner)}`;
      } else if (!sg || !paid) {
        // one pot on total strokes: the result is the strokes, the holes are the story
        const [tA, tB] = [pa, pb].map(x => { const r = (f.standings || []).find(z => z.pair.join('|') === x.names.join('|')); return r && r.complete ? r.total : null; });
        if (tA != null && tB != null) {
          winner = tA < tB ? 0 : tA > tB ? 1 : null; status = winner == null ? 'halved' : 'won';
          const d = Math.abs(tA - tB);
          big = winner == null ? 'Tied' : `${d} stroke${d === 1 ? '' : 's'}`;
          small = `${winner === 1 ? tB : tA} vs ${winner === 1 ? tA : tB}${f.basis === 'net' ? ' net' : ''} · holes ${holesFor(winner)}`;
        } else { big = 'In progress'; small = story.played ? `Holes ${holesFor(winner)}` : ''; }
      } else {
        // period pots (front / back / total): the headline is who took more of them
        const wins = [0, 0]; paid.forEach(x => { const w = win(x); if (w != null) wins[w]++; });
        winner = wins[0] === wins[1] ? null : wins[0] > wins[1] ? 0 : 1;
        status = paid.every(x => x.status === 'pending') ? 'inprogress' : (winner == null ? 'halved' : 'won');
        const wf = winner === 1 ? [wins[1], wins[0]] : wins;
        big = `${wf[0]} – ${wf[1]}`; small = hilo ? `Pots won · points ${holesFor(winner)}` : `Pots won · holes ${holesFor(winner)}`;
      }
      const segs = (paid && paid.length > 1) ? paid.map(x => ({ label: x.label, text: x.result || (x.status === 'won' ? '' : x.status === 'push' ? 'Halved' : 'In progress'), winner: win(x), money: x.per_player ? x.per_player : null })) : [];
      const r = { hilo, names: [pa.names, pb.names], short: [short(pa.names), short(pb.names)], status, winner, big, small, story, segs,
        pot: whole ? whole.pot : (paid ? paid.reduce((t, x) => t + (x.pot || 0), 0) : null),
        perPlayer: whole ? (whole.per_player || null) : (!paid && winner != null && f.per_player ? f.per_player : null),
        decidedEarly: !!(whole && whole.status === 'won' && /&/.test(whole.result || '')) };
      r.tags = sideResultTags(r);
      return r;
    });
  }
  // The short story lines under a result ("Wire to wire", "Came back from 3 down"). Plain text with an icon; screens add the markup.
  function sideResultTags(r) {
    const st = r.story, tags = [], who = i => r.short[i];
    if (!st.played || r.status === 'notstarted') return tags;
    const w = r.winner;
    if (st.firstLead && st.changes === 0 && st.square <= 1 && w != null) tags.push({ icon: '🏁', text: `Wire to wire for ${who(w)}` });
    else if (w != null && st.neverTrailed === (w === 0 ? 'A' : 'B') && st.changes === 0) tags.push({ icon: '🛡️', text: `${who(w)} never trailed` });
    else if (w != null && (w === 0 ? st.maxB : st.maxA) >= 2) tags.push({ icon: '🔥', text: `${who(w)} came back from ${w === 0 ? st.maxB : st.maxA} ${r.hilo ? 'points ' : ''}down` });
    const big = Math.max(st.maxA, st.maxB);
    if (big >= 3) tags.push({ icon: '📈', text: `Biggest lead: ${who(st.maxA >= st.maxB ? 0 : 1)} ${big} ${r.hilo ? 'pts up' : 'UP'}` });
    if (st.changes >= 1) tags.push({ icon: '🔄', text: `Lead changed hands ${st.changes}×` });
    if (st.square >= 3) tags.push({ icon: '⚖️', text: `All square ${st.square} times` });
    if (r.decidedEarly) tags.push({ icon: '⏱️', text: `Decided early (${r.big})` });
    return tags;
  }

  // ── Roll the dice (Dev-94): a random, complete, valid game setup for a crew ─────────────────────────────────────────
  // Picks ONE format at equal odds from the ones that fit the crew, then 0..X side games, then rolls every variant of what it
  // picked (Gross / Net, Full / Off the low, scoring period, holes won vs strokes). Pure: pass `rng` (() => [0,1)) to test it.
  //   crew: { players, hasHcp, par3 }   players = confirmed count; hasHcp = most of them have a handicap on file (Net allowed);
  //   par3 = the venue's par-3 holes are known (CTP allowed); pars = the venue's hole pars are known (Birdie Payouts allowed).
  // Returns { main, sides: [ids], rolled: { [id]: variant } }. The caller adds pairs / matches and the money.
  const ROLL_FORMATS = ['fourball', 'altshot', 'hilo', 'matchplay', 'lowscore'];
  const ROLL_SIDES = ['skins', 'cttp', 'birdieball', 'birdiepay'];
  function rollFormatsFor(crew) {
    const n = Math.floor(Number(crew && crew.players) || 0), even = n % 2 === 0;
    return ROLL_FORMATS.filter(id => id === 'lowscore' ? n >= 2 : id === 'matchplay' ? n >= 2 && even : id === 'hilo' ? n >= 4 && n % 4 === 0 : n >= 4 && even);
  }
  function rollSidesFor(crew) { return ROLL_SIDES.filter(id => id === 'cttp' ? !!(crew && crew.par3) : id === 'birdiepay' ? !!(crew && (crew.pars !== undefined ? crew.pars : crew.par3)) : true); }   // CTP needs the par-3 holes, Birdie Payouts the venue's pars
  function rollVariant(id, crew, rnd) {
    const pick = list => list[Math.min(list.length - 1, Math.floor(rnd() * list.length))];
    const net = !!(crew && crew.hasHcp) && rnd() < 0.5;
    const v = { basis: net ? 'net' : 'gross' };
    if (id === 'skins' || id === 'birdiepay') return v;
    if (id === 'cttp' || id === 'birdieball') return {};
    v.period = pick(PERIOD_ORDER);
    if (id !== 'lowscore') v.net_mode = net ? pick(['own', 'low']) : 'own';
    if ((id === 'fourball' || id === 'altshot') && v.period !== 'round') v.win_by = pick(['strokes', 'holes']);
    return v;
  }
  function rollGameSetup(crew, rng) {
    const rnd = typeof rng === 'function' ? rng : Math.random;
    const formats = rollFormatsFor(crew), sides = rollSidesFor(crew);
    if (!formats.length) return null;
    const main = formats[Math.min(formats.length - 1, Math.floor(rnd() * formats.length))];
    const maxSides = Math.min(3, sides.length), k = Math.min(maxSides, Math.floor(rnd() * (maxSides + 1)));   // 0..3, equal odds
    const pool = sides.slice(), chosen = [];
    while (chosen.length < k && pool.length) chosen.push(pool.splice(Math.min(pool.length - 1, Math.floor(rnd() * pool.length)), 1)[0]);
    chosen.sort((a, b) => ROLL_SIDES.indexOf(a) - ROLL_SIDES.indexOf(b));
    const rolled = {};
    [main].concat(chosen).forEach(id => { rolled[id] = rollVariant(id, crew, rnd); });
    return { main, sides: chosen, rolled, formats, sideOptions: sides };
  }
  // Random draw (Dev-94): shuffle the crew into pairs (or 1 v 1 matches) and measure how lopsided it came out. Pair 2k plays pair 2k+1
  // (and in Hi-Lo they share a foursome). A player with no handicap counts as the crew average. `lopsided` means the handicap gap in some
  // match is big enough that Gross would be a wipeout, so the caller switches the game to Net, off the low (the stronger side gives strokes).
  const DRAW_LOPSIDED = { pairs: 6, matches: 5 };   // combined-handicap gap (pairs) / handicap gap (1 v 1) from which the draw is flagged
  function rollDraw(players, kind, rng) {
    const rnd = typeof rng === 'function' ? rng : Math.random;
    const list = (players || []).filter(p => p && p.name).map(p => ({ name: String(p.name), hcp: p.hcp !== null && p.hcp !== undefined && p.hcp !== '' && Number.isFinite(Number(p.hcp)) ? Number(p.hcp) : null }));
    const known = list.filter(p => p.hcp !== null), avg = known.length ? known.reduce((a, p) => a + p.hcp, 0) / known.length : 0;
    const deck = list.slice();
    for (let i = deck.length - 1; i > 0; i--) { const j = Math.min(i, Math.floor(rnd() * (i + 1))); const t = deck[i]; deck[i] = deck[j]; deck[j] = t; }
    const items = [], hc = [];
    for (let i = 0; i + 1 < deck.length; i += 2) { items.push([deck[i].name, deck[i + 1].name]); hc.push([deck[i].hcp === null ? avg : deck[i].hcp, deck[i + 1].hcp === null ? avg : deck[i + 1].hcp]); }
    const m = kind === 'matches', gaps = [];
    if (m) hc.forEach(h => gaps.push(Math.round(Math.abs(h[0] - h[1]) * 10) / 10));
    else for (let i = 0; i + 1 < hc.length; i += 2) gaps.push(Math.round(Math.abs(hc[i][0] + hc[i][1] - hc[i + 1][0] - hc[i + 1][1]) * 10) / 10);
    const maxGap = gaps.length ? Math.max.apply(null, gaps) : 0, threshold = m ? DRAW_LOPSIDED.matches : DRAW_LOPSIDED.pairs;
    return { items, gaps, maxGap, usedHandicaps: known.length > 0, threshold, lopsided: known.length > 0 && maxGap >= threshold, hcps: hc };
  }
  // Variant for a side game the host ticks AFTER the roll (so every checkbox is usable).
  function rollSideVariant(id, crew, rng) { return rollVariant(id, crew, typeof rng === 'function' ? rng : Math.random); }

  function suggestGameAmounts({ dollarPerPlayer, players, games, cttpHoles, periods }) {
    const B = Number(dollarPerPlayer) || 0;
    const n = Math.max(1, Math.floor(Number(players) || 0));
    const has = g => (games || []).includes(g);
    const dollars = x => Math.max(1, Math.round(x));
    const out = { players: n, pot: B * n, cttp: null, birdieball: null, birdiepay: null, fourball: null, altshot: null, hilo: null, matchplay: null, lowscore: null };
    if (!(B > 0)) return out;
    if (has('birdieball')) out.birdieball = { dollar_per_player: dollars(0.2 * B) };
    if (has('cttp')) {
      const holes = Math.max(1, Math.floor(Number(cttpHoles) || 3));
      let per = dollars((0.3 * B * n) / holes);
      // a purse that (with BirdieBall) would eat more than half the pot comes down, never below $1/hole
      const bbCost = out.birdieball ? out.birdieball.dollar_per_player * n : 0;
      while (per > 1 && per * holes + bbCost > 0.5 * B * n) per -= 1;
      out.cttp = { dollar_per_hole: per, holes };
    }
    if (has('birdiepay')) out.birdiepay = { dollar_per_birdie: dollars(0.3 * B) };
    // The buy-in is meant to be played for in full. BestBall and Low Score are the main events:
    //  - with Skins (or Birdie Payouts) ticked they take half and that game gets what is left, as before;
    //  - with neither, nothing would soak up the rest, so the mains take everything the fixed games (CTP, MiserBall) leave.
    // `periods` ({fourball: 3, lowscore: 1}) is how many pots each main is cut into: a main's total is a whole number of
    // dollars per period, so it is rounded down to a multiple of that and the spare dollars go to whichever main can take them.
    const mains = ['fourball', 'altshot', 'hilo', 'matchplay', 'lowscore'].filter(has);
    if (mains.length) {
      const cttpPer = out.cttp ? out.cttp.dollar_per_hole * out.cttp.holes / n : 0;
      const bbTarget = out.birdieball ? out.birdieball.dollar_per_player : 0;
      const leftoverGame = has('skins') || has('birdiepay');
      const main = leftoverGame ? 0.5 * B : Math.max(mains.length, B - cttpPer - bbTarget);
      const pn = g => Math.max(1, Math.floor(Number(periods && periods[g]) || 1));
      const lo = g => Math.max(pn(g), pn(g) * Math.floor(main / mains.length / pn(g)));
      const tot = {};
      mains.forEach(g => { tot[g] = lo(g); });
      if (!leftoverGame) {
        // Nothing (Skins, Birdie Payouts) takes what is left, so land the whole buy-in. Each main is a whole number per period:
        // try rounding each one down and up, and keep the combination that leaves MiserBall (the one game that can be any
        // dollar amount) closest to its target. $10 with a 3-period BestBall: $9 + $1 beats $6 + $4.
        let best = null;
        for (let mask = 0; mask < (1 << mains.length); mask++) {
          const t = {}; let sum = 0;
          mains.forEach((g, i) => { t[g] = lo(g) + ((mask >> i) & 1 ? pn(g) : 0); sum += t[g]; });
          const rest = B - cttpPer - sum;
          if (out.birdieball ? rest < 1 : rest < -1e-9) continue;
          const cost = (out.birdieball ? Math.abs(rest - bbTarget) : rest) + sum * 1e-6;
          if (!best || cost < best.cost) best = { t, rest, cost };
        }
        if (best) {
          mains.forEach(g => { tot[g] = best.t[g]; });
          if (out.birdieball) out.birdieball = { dollar_per_player: Math.round(best.rest) };
        }
      }
      let spare = Math.floor(main - mains.reduce((a, g) => a + tot[g], 0));
      if (!leftoverGame && !out.birdieball) spare = Math.floor(B - cttpPer - mains.reduce((a, g) => a + tot[g], 0));
      if (leftoverGame || !out.birdieball) {
        for (let moved = true; moved && spare > 0;) {
          moved = false;
          mains.forEach(g => { if (spare >= pn(g)) { tot[g] += pn(g); spare -= pn(g); moved = true; } });
        }
      }
      mains.forEach(g => { out[g] = { dollar_per_player: tot[g] }; });
      // What the games actually collect per player. When nothing (Skins, Birdie Payouts) soaks up the rest, a buy-in that does not
      // divide evenly (e.g. $10 over a 3-pot game = $9) is not all played for: `ante` is the amount really in the pots, `unspent`
      // the part that is not. Setup adopts `ante` as the buy-in so players are never told they put in money that no game takes.
      if (!leftoverGame) {
        const ante = cttpPer + (out.birdieball ? out.birdieball.dollar_per_player : 0) + mains.reduce((t, g) => t + tot[g], 0);
        out.ante = Math.round(ante * 100) / 100; out.unspent = Math.max(0, Math.round((B - ante) * 100) / 100);
      }
    }
    return out;
  }

  // ======================================================================================================
  // BF Cup (Dev-95): a two-sided, multi-round match-play event. Pure functions; nothing here knows a name,
  // a venue or a field size (spec §13.12: any host can set a team event up in BFE-A).
  //   cfg = { sides:[{key,name,captain?,players:[…]} x2], points:{win:1,half:0.5,loss:0},
  //           rounds:[{ key, name, segments:[{key,format:'altshot'|'bestball'|'singles',from:1,to:9}],
  //                     matches:[{ key, sides:[{side:'A',players:[…]},{side:'B',players:[…]}] }] }] }
  // Every SEGMENT of a match is its own match for points (a pair can win the foursomes and lose the fourball).
  // Scores come from `cards` = [{player, holes:[18 strokes]}], gross (the Cup is scratch). Foursomes carry ONE ball per
  // pair (read from whichever partner's card has it), fourball the better ball, singles the player's own score.
  // A match closes the moment a side leads by more holes than are left (3&2); holes played after that never count.
  // ======================================================================================================
  const CUP_FORMATS = { altshot: { size: 2, label: 'Foursomes' }, bestball: { size: 2, label: 'Fourball' }, singles: { size: 1, label: 'Singles' } };
  function cupPointsRule(cfg) {
    const p = (cfg && cfg.points) || {};
    const n = (v, d) => (v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);
    return { win: n(p.win, 1), half: n(p.half, 0.5), loss: n(p.loss, 0) };
  }
  // First half-point step strictly above half the total: 16 -> 8.5, 20 -> 10.5, 15 -> 8.
  function cupWinTarget(total) { return total / 2 + 0.5; }
  // What a field of N players makes: N/2 pairs-matches on the pair day (2 nines each) + N singles = N points a day.
  function cupPlanFor(totalPlayers) {
    const perSide = Math.floor(totalPlayers / 2);
    const satMatches = Math.floor(perSide / 2), sunMatches = perSide;
    const totalPoints = satMatches * 2 + sunMatches;
    return { perSide, satMatches, sunMatches, totalPoints, target: cupWinTarget(totalPoints) };
  }
  // Draft orders. Snake 1-2-2-1…: whoever picks first in `first`; alternating = A,B,A,B… (the Saturday matchup draw).
  function cupSnakeOrder(picks, first, other) { return Array.from({ length: picks }, (_, i) => (((i + 1) >> 1) & 1 ? other : first)); }
  function cupAlternatingOrder(count, first, other) { return Array.from({ length: count }, (_, i) => (i % 2 ? other : first)); }
  // One match segment, hole by hole from `from` to `to` (1-based). A, B = 18-slot score arrays (null = not played).
  // The count stops at the first hole where either score is missing.
  function cupMatchState(A, B, from, to) {
    const total = to - from + 1;
    let lead = 0, played = 0, closedAt = null, w0 = 0, w1 = 0, halved = 0, text = null, closeLead = 0;
    for (let h = from - 1; h < to; h++) {
      const x = A[h], y = B[h];
      if (typeof x !== 'number' || typeof y !== 'number') break;
      played++;
      if (closedAt != null) continue;                   // play-on holes never change a closed match
      if (x < y) { w0++; lead++; } else if (x > y) { w1++; lead--; } else halved++;
      const left = total - played;
      if (Math.abs(lead) > left) { closedAt = played; closeLead = lead; text = left > 0 ? Math.abs(lead) + '&' + left : Math.abs(lead) + ' UP'; }
    }
    const thru = closedAt != null ? closedAt : played;
    const out = { total, thru, closedAt, lead: closedAt != null ? closeLead : lead, won: [w0, w1], halved, status: 'pending', winner: null, text: null, decided: false };
    if (closedAt != null) { out.status = 'won'; out.winner = closeLead > 0 ? 0 : 1; out.text = text; out.decided = true; }
    else if (played >= total) { out.status = 'push'; out.text = 'Halved'; out.decided = true; }
    else out.text = played === 0 ? 'Not started' : (lead === 0 ? 'All square' : Math.abs(lead) + ' UP') + ' thru ' + played;
    return out;
  }
  // The 18-slot score array of one side of a match for a format.
  function cupSideScores(format, players, cardBy) {
    const cs = (players || []).map(p => cardBy.get(norm(p))).filter(Boolean);
    const out = new Array(18).fill(null);
    if (!cs.length) return out;
    for (let h = 0; h < 18; h++) {
      const v = cs.map(c => (Array.isArray(c.holes) ? c.holes[h] : null)).filter(x => typeof x === 'number' && x > 0);
      if (!v.length) continue;
      if (format === 'bestball') out[h] = Math.min(...v);
      else out[h] = v[0];                                // foursomes: the one shared ball; singles: the player's own
    }
    return out;
  }
  function cupCardMap(cards) { return new Map((cards || []).map(c => [norm(c.player), c])); }
  // Standings for the whole Cup. Returns the per-round / per-match / per-segment view the scoreboard, results page
  // and Live Panel all read, plus the side totals. Pending segments award nothing.
  function cupStandings(cfg, cards, opts) {
    const rule = cupPointsRule(cfg);
    const keys = (cfg.sides || []).map(s => s.key);
    const cardBy = cupCardMap(cards);
    const points = {}; keys.forEach(k => { points[k] = 0; });
    let total = 0, open = 0;
    const rounds = (cfg.rounds || []).map(r => {
      const matches = (r.matches || []).map(m => {
        const mp = {}; keys.forEach(k => { mp[k] = 0; });
        const segments = (r.segments || []).map(sg => {
          const fmt = sg.format;
          const ov = opts && opts.sideScores ? opts.sideScores(r, m, sg) : null;
          const sa = ov ? ov[0] : cupSideScores(fmt, m.sides[0].players, cardBy), sb = ov ? ov[1] : cupSideScores(fmt, m.sides[1].players, cardBy);
          const st = cupMatchState(sa, sb, sg.from, sg.to);
          const sideKeys = [m.sides[0].side, m.sides[1].side];
          // A captain or the host closed this match by hand (a concession, a match stopped for dark, ...): what is still open is decided now.
          const cl = cfg.closed && cfg.closed[r.key] && cfg.closed[r.key][m.key];
          if (cl && !st.decided) {
            if (cl.how === 'concede' && sideKeys.includes(cl.side)) { st.status = 'won'; st.winner = sideKeys.indexOf(cl.side) === 0 ? 1 : 0; st.text = 'Conceded'; st.decided = true; }
            else if (cl.how === 'standing' && st.thru > 0 && st.lead !== 0) { st.status = 'won'; st.winner = st.lead > 0 ? 0 : 1; st.text = Math.abs(st.lead) + ' UP'; st.decided = true; }
            else { st.status = 'push'; st.winner = null; st.text = 'Halved'; st.decided = true; }
          }
          const pts = { [sideKeys[0]]: 0, [sideKeys[1]]: 0 };
          if (st.status === 'won') { pts[sideKeys[st.winner]] = rule.win; pts[sideKeys[1 - st.winner]] = rule.loss; }
          else if (st.status === 'push') { pts[sideKeys[0]] = rule.half; pts[sideKeys[1]] = rule.half; }
          sideKeys.forEach(k => { mp[k] += pts[k]; points[k] += pts[k]; });
          total += Math.max(rule.win + rule.loss, 2 * rule.half);
          if (!st.decided) open++;
          return { key: sg.key, format: fmt, label: (CUP_FORMATS[fmt] || {}).label || fmt, from: sg.from, to: sg.to, status: st.status, decided: st.decided,
            winner: st.winner != null ? sideKeys[st.winner] : null, text: st.text, thru: st.thru, closedAt: st.closedAt, lead: st.lead, points: pts };
        });
        return { key: m.key, sides: m.sides, segments, points: mp, done: segments.every(s => s.decided) };
      });
      // A session whose matches are not drawn yet still counts toward the points on offer (the singles day before the draw): one match per
      // `size` players on a side, each segment worth a full match's points.
      if (!matches.length) {
        const f = CUP_FORMATS[((r.segments || [])[0] || {}).format], perSide = Math.max(0, ...(cfg.sides || []).map(sd => (sd.players || []).length));
        const exp = f && f.size ? Math.floor(perSide / f.size) * (r.segments || []).length : 0;
        total += exp * Math.max(rule.win + rule.loss, 2 * rule.half); open += exp;
      }
      return { key: r.key, name: r.name, matches, done: matches.length > 0 && matches.every(m => m.done) };
    });
    const target = cupWinTarget(total);
    const out = { points, total, target, open, rounds, state: 'live', winner: null, shared: false, clinched: null };
    keys.forEach(k => { if (points[k] >= target) out.clinched = k; });
    if (total > 0 && open === 0) {
      out.state = 'final';
      const best = Math.max(...keys.map(k => points[k]));
      const lead = keys.filter(k => points[k] === best);
      if (lead.length === 1) out.winner = lead[0]; else out.shared = true;
    }
    return out;
  }

  // ---- BF Cup team draft (Dev-95) ------------------------------------------------------------------------------
  // draft = { first:'A', pool:[names], stats:{name:{hcp,rank,avg,birdies}}, picks:[{n,side,player}] }. The captains are
  // not in the pool; they are on their own team from the start. Snake order (1-2-2-1…) starting with `first`.
  function cupDraftView(cfg) {
    const d = (cfg && cfg.draft) || {};
    const sides = (cfg && cfg.sides) || [];
    const keys = sides.map(sd => sd.key);
    const caps = new Set(sides.map(sd => norm(sd.captain)).filter(Boolean));
    const pool = (d.pool || []).filter(n => !caps.has(norm(n)));
    const picks = d.picks || [];
    const taken = new Set(picks.map(pk => norm(pk.player)));
    const first = keys.includes(d.first) ? d.first : keys[0];
    const other = keys.find(k => k !== first);
    const awaitingOrder = !!d.started && !keys.includes(d.first);      // a captain in control has not chosen who picks first yet
    const mode = d.mode === 'alternate' ? 'alternate' : 'snake';
    const order = mode === 'alternate' ? cupAlternatingOrder(pool.length, first, other) : cupSnakeOrder(pool.length, first, other);
    const teams = {};
    sides.forEach(sd => { teams[sd.key] = (sd.captain ? [sd.captain] : []).concat(picks.filter(pk => pk.side === sd.key).map(pk => pk.player)); });
    const remaining = pool.filter(n => !taken.has(norm(n)));
    const done = pool.length > 0 && remaining.length === 0;
    return { mode, first, order, pickNo: picks.length + 1, total: pool.length, onClock: done || !pool.length || awaitingOrder ? null : order[picks.length], teams, remaining, picks, done, awaitingOrder, control: keys.includes(d.control) ? d.control : null };
  }
  // "Captain in control": he chooses to Start (go first), Defer (the other side goes first) or flip a Coin toss. Pure; `rand` is a 0..1 number for the toss.
  // Returns { first, text } where first is the side that goes first (picks first in the draft, puts up first in the matchup draw).
  function cupOrderFirst(choice, control, keys, rand, names) {
    const other = (keys || []).find(k => k !== control);
    const nm = k => (names && names[k]) || k;
    if (choice === 'start') return { first: control, text: nm(control) + ' chose to go first' };
    if (choice === 'defer') return { first: other, text: nm(control) + ' deferred, so ' + nm(other) + ' goes first' };
    if (choice === 'toss') { const f = rand < 0.5 ? keys[0] : keys[1]; return { first: f, text: 'Coin toss for ' + nm(control) + ': ' + nm(f) + ' goes first' }; }
    return null;
  }
  // Pure: the draft after the side on the clock takes `player` (null + reason when not allowed).
  function cupDraftPick(cfg, player) {
    const v = cupDraftView(cfg);
    if (!v.onClock) return { ok: false, reason: 'The draft is not open' };
    const hit = v.remaining.find(n => norm(n) === norm(player));
    if (!hit) return { ok: false, reason: player + ' is not available' };
    let draft = Object.assign({}, cfg.draft, { picks: v.picks.concat([{ n: v.pickNo, side: v.onClock, player: hit }]) });
    // The last player has only one place to go: the side with the open slot takes him, no pick or confirm needed.
    const after = cupDraftView(Object.assign({}, cfg, { draft }));
    if (after.onClock && after.remaining.length === 1) draft = Object.assign({}, draft, { picks: draft.picks.concat([{ n: after.pickNo, side: after.onClock, player: after.remaining[0], auto: true }]) });
    return { ok: true, draft };
  }
  function cupDraftUndo(cfg) {
    let picks = ((cfg.draft || {}).picks || []).slice();
    const last = picks.pop();
    if (last && last.auto) picks.pop();      // an automatic last pick goes back together with the pick that caused it
    return Object.assign({}, cfg.draft, { picks, signoff: {} });      // any change to the picks clears the captains' sign-offs
  }
  // Pasted stats table (tab or comma separated, header row). Columns found by name:
  // Player/Name, Rank/Ranking, Avg(Points/Achievement), Birdie(s), HCP. Returns { stats, unmatched, matched } against `pool`.
  function cupParseStats(text, pool) {
    const rows = String(text || '').split(/\r?\n/).map(r => r.split(/\t|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(c => c.replace(/^"|"$/g, '').trim())).filter(r => r.some(c => c));
    // The GS "Raw Data" sheet has a title row above the header; find the header row (the one with a Player cell).
    const hi = Math.max(0, rows.findIndex(r => r.some(c => /^player$/i.test(c))));
    rows.splice(0, hi);
    if (rows.length < 2) return { stats: {}, matched: 0, unmatched: [] };
    const head = rows[0].map(h => h.toLowerCase());
    const col = re => head.findIndex(h => re.test(h));
    const iName = col(/player$|^player|name/), iRank = col(/rank/), iBird = col(/birdie/), iHcp = col(/hcp|handicap/);
    const iPlayed = col(/^played$/), iPerf = col(/^performance$/);
    const gs = iPlayed >= 0 && iPerf >= 0;      // GS raw sheet: "avg" becomes points over/under quota per round played
    const iAvg = gs ? -1 : col(/avg|average|achiev|points/);
    const num = v => { const n = parseFloat(String(v).replace(/[^0-9.+-]/g, '')); return Number.isFinite(n) ? n : null; };
    const stats = {}; const names = new Map((pool || []).map(n => [norm(n), n]));
    const unmatched = [];
    rows.slice(1).forEach(r => {
      const raw = r[iName >= 0 ? iName : 0]; if (!raw) return;
      const key = norm(raw);
      const canon = names.get(key);
      if (!canon && pool && pool.length) { unmatched.push(raw); return; }
      let avg = iAvg >= 0 ? num(r[iAvg]) : null, played = null;
      if (gs) { played = num(r[iPlayed]); const perf = num(r[iPerf]); avg = (played && perf != null) ? Math.round(perf / played * 100) / 100 : null; }
      stats[canon || raw] = { hcp: iHcp >= 0 && !gs ? num(r[iHcp]) : null, rank: iRank >= 0 ? num(r[iRank]) : null, avg, birdies: iBird >= 0 ? num(r[iBird]) : null };
      if (gs) stats[canon || raw].played = played;
    });
    return { stats, matched: Object.keys(stats).length, unmatched };
  }
  // Series stats from the published results data (the same ALL_SERIES_DATA My Game reads: {events:[{scores:{name:[18 stableford pts]}}], playerHistory:{name:{events:[{result,noHcp}]}}}).
  // Per pool player: avg = average points over/under quota per event, birdies = holes at 4+ points, rank = series rank by that average
  // (among everyone in the data), played = events. A player with no history is simply absent.
  function cupSeriesStats(data, pool) {
    const out = { stats: {}, matched: 0, missing: [] };
    if (!data || !data.playerHistory) return out;
    const hist = data.playerHistory, events = data.events || [];
    const avgOf = {};
    Object.keys(hist).forEach(n => { const r = ((hist[n] && hist[n].events) || []).filter(e => !e.noHcp && typeof e.result === 'number'); if (r.length) avgOf[n] = r.reduce((a, e) => a + e.result, 0) / r.length; });
    const order = Object.keys(avgOf).sort((a, b) => avgOf[b] - avgOf[a]);
    const byNorm = new Map(Object.keys(hist).map(n => [norm(n), n]));
    (pool || []).forEach(name => {
      const key = byNorm.get(norm(name));
      if (!key || avgOf[key] == null) { out.missing.push(name); return; }
      let birdies = 0, played = 0;
      events.forEach(e => { const sc = e.scores && e.scores[key]; if (sc) { played++; sc.forEach(p => { if (p >= 4) birdies++; }); } });
      out.stats[name] = { rank: order.indexOf(key) + 1, avg: Math.round(avgOf[key] * 100) / 100, birdies, played };
    });
    out.matched = Object.keys(out.stats).length;
    return out;
  }
  // The balance meter. Per side: average of each stat over the players that have it. Gap per metric and a verdict.
  // Lower handicap / better rank is better; higher avg points / more birdies is better.
  const CUP_BALANCE_LIMITS = { hcp: [0.75, 1.75], avg: [2, 4], birdies: [0.6, 1.2], rank: [1.5, 3] };   // [even up to, close up to]
  function cupBalance(teams, stats) {
    const keys = Object.keys(teams);
    const avgOf = (k, f) => { const v = (teams[k] || []).map(n => (stats && stats[n] ? stats[n][f] : null)).filter(x => typeof x === 'number'); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
    const sides = {};
    keys.forEach(k => { sides[k] = { players: (teams[k] || []).length, hcp: avgOf(k, 'hcp'), rank: avgOf(k, 'rank'), avg: avgOf(k, 'avg'), birdies: avgOf(k, 'birdies'),
      birdieTotal: (teams[k] || []).reduce((a, n) => a + ((stats && stats[n] && typeof stats[n].birdies === 'number') ? stats[n].birdies : 0), 0) }; });
    const metrics = {}; let worst = 0;
    ['hcp', 'avg', 'birdies', 'rank'].forEach(f => {
      const a = sides[keys[0]] && sides[keys[0]][f], b = sides[keys[1]] && sides[keys[1]][f];
      if (typeof a !== 'number' || typeof b !== 'number') { metrics[f] = null; return; }
      const gap = Math.abs(a - b), lim = CUP_BALANCE_LIMITS[f];
      const level = gap <= lim[0] ? 0 : gap <= lim[1] ? 1 : 2;
      const lowerBetter = f === 'hcp' || f === 'rank';
      const edge = gap === 0 ? null : (lowerBetter ? (a < b ? keys[0] : keys[1]) : (a > b ? keys[0] : keys[1]));
      metrics[f] = { gap: Math.round(gap * 100) / 100, level, edge };
      worst = Math.max(worst, level);
    });
    const have = Object.values(metrics).filter(Boolean).length;
    return { sides, metrics, verdict: have === 0 ? 'unknown' : ['even', 'close', 'tilted'][worst] };
  }
  // ── BF Cup Saturday pairs (Dev-95) ─────────────────────────────────────
  // Each captain splits his own side into pairs (Fourball / Foursomes partners). `cfg.pairs = {A:{list:[[a,b],...], locked}, B:{...}}`.
  // A side's pairs stay private to that captain (and the commissioner) until BOTH captains lock; then both are revealed for the matchup draw.
  // The Worker re-implements the membership checks (it cannot load this file); keep the two in step.
  function cupRosterOf(cfg, side) {
    const sd = ((cfg && cfg.sides) || []).find(x => x.key === side);
    if (sd && Array.isArray(sd.players) && sd.players.length) return sd.players.slice();
    return (cupDraftView(cfg).teams[side] || []).slice();
  }
  // Pure: checks a captain's pairs against his roster. Names come back in the roster's spelling.
  // lockable = every player is paired (a single odd player out is allowed) and there is at least one pair.
  function cupPairsStatus(roster, pairs) {
    const canon = new Map((roster || []).map(n => [norm(n), n]));
    const used = new Set(), out = [], errors = [];
    (pairs || []).forEach((pr, i) => {
      if (!Array.isArray(pr) || pr.length !== 2) { errors.push('Pair ' + (i + 1) + ' needs exactly two players'); return; }
      const names = pr.map(n => canon.get(norm(n)));
      if (names.some(n => !n)) { errors.push('Pair ' + (i + 1) + ' has someone who is not on this team'); return; }
      if (norm(names[0]) === norm(names[1])) { errors.push('Pair ' + (i + 1) + ' lists the same player twice'); return; }
      if (names.some(n => used.has(norm(n)))) { errors.push('A player is in two pairs'); return; }
      names.forEach(n => used.add(norm(n)));
      out.push(names);
    });
    const leftover = (roster || []).filter(n => !used.has(norm(n)));
    const lockable = errors.length === 0 && out.length > 0 && (leftover.length === 0 || (roster.length % 2 === 1 && leftover.length === 1));
    return { ok: errors.length === 0, errors, pairs: out, leftover, lockable };
  }
  // Pure: one pair's combined numbers. A total is null unless both players have that stat (a guess would mislead).
  function cupPairStats(pair, stats) {
    const get = (n, f) => (stats && stats[n] && typeof stats[n][f] === 'number') ? stats[n][f] : null;
    const sum = f => { const a = get(pair[0], f), b = get(pair[1], f); return a === null || b === null ? null : Math.round((a + b) * 100) / 100; };
    return { hcp: sum('hcp'), avg: sum('avg'), birdies: sum('birdies') };
  }
  // Pure: how far apart a side's own pairs are (combined HCP, highest minus lowest) so a captain can see if he is stacking one pair.
  function cupPairsSpread(pairs, stats) {
    const v = (pairs || []).map(pr => cupPairStats(pr, stats).hcp).filter(x => x !== null);
    return v.length > 1 ? Math.round((Math.max.apply(null, v) - Math.min.apply(null, v)) * 10) / 10 : null;
  }
  // Pure: the balanced suggestion (strongest with weakest) for a roster, from the draft stats.
  function cupPairsSuggest(roster, stats) {
    return recommendPairs((roster || []).map(n => ({ name: n, hcp: stats && stats[n] ? stats[n].hcp : null })));
  }
  function cupPairsRevealed(cfg) {
    const p = (cfg && cfg.pairs) || {};
    const keys = ((cfg && cfg.sides) || []).map(x => x.key);
    return keys.length === 2 && keys.every(k => p[k] && p[k].locked === true);
  }
  // Pure: what a viewer may see. The commissioner sees everything, a captain sees his own side, everyone else sees nothing until both are locked.
  function cupPairsVisible(cfg, viewerSide, isHost) {
    const p = (cfg && cfg.pairs) || {};
    const open = isHost || cupPairsRevealed(cfg);
    const out = {};
    Object.keys(p).forEach(k => { out[k] = (open || k === viewerSide) ? p[k] : { locked: p[k].locked === true, count: (p[k].list || []).length }; });
    return out;
  }
  // ── BF Cup Saturday matchup draw (Dev-95) ──────────────────────────────
  // After both captains lock their pairs, the captains build the matches one at a time, "put up and respond": the starting captain puts
  // up one of his pairs, the other captain answers with one of his to face it; then the roles swap, and so on. With N pairs a side that is
  // N-1 rounds of two steps, and the last two pairs meet automatically. `cfg.matchup = {started, first, log:[{n, side, pair}]}`.
  // The Worker re-implements the pick rule (it cannot load this file); keep the two in step.
  function cupPairsRound(cfg) {
    return ((cfg && cfg.rounds) || []).findIndex(r => { const f = CUP_FORMATS[((r.segments || [])[0] || {}).format]; return !!f && f.size === 2; });
  }
  const pairKey = pr => (pr || []).map(norm).sort().join('|');
  // The Saturday matchup draw, "put up and respond", where the PAIRS are formed as they are put up (no pre-built lists):
  // the first captain puts up a pair from his remaining players, the second answers with a pair from his, then they swap, and so on.
  // The last two players on each side meet automatically. cfg.matchup = { started, first, log:[{n, side, pair}], done }.
  function cupMatchupView(cfg) {
    const m = cfg && cfg.matchup;
    if (!m || !m.started) return { started: false };
    const keys = ((cfg.sides) || []).map(sd => sd.key);
    const first = keys.includes(m.first) ? m.first : keys[0], other = keys.find(k => k !== first);
    const rosters = {}; keys.forEach(k => { rosters[k] = cupRosterOf(cfg, k); });
    const N = rosters[first] ? rosters[first].length : 0;
    const even = N >= 2 && N % 2 === 0 && rosters[other].length === N;
    const n = even ? N / 2 : 0;                                  // pairs per side
    const log = m.log || [];
    const used = {}; keys.forEach(k => { used[k] = new Set(); });
    log.forEach(e => { if (used[e.side]) (e.pair || []).forEach(x => used[e.side].add(norm(x))); });
    const avail = {}; keys.forEach(k => { avail[k] = rosters[k].filter(x => !used[k].has(norm(x))); });   // players not yet in a pair
    const steps = Math.max(0, 2 * (n - 1)), done = even && log.length >= steps;
    const round = log.length >> 1, putter = round % 2 === 0 ? first : other, responder = putter === first ? other : first;
    const role = log.length % 2 === 0 ? 'put' : 'respond';
    const matches = [];
    for (let i = 0; i + 1 < log.length; i += 2) matches.push({ sides: [{ side: log[i].side, players: log[i].pair }, { side: log[i + 1].side, players: log[i + 1].pair }] });
    if (done && avail[first].length === 2 && avail[other].length === 2) matches.push({ sides: [{ side: first, players: avail[first].slice() }, { side: other, players: avail[other].slice() }] });
    const ordered = matches.map((mt, i) => ({ key: 'm' + (i + 1), sides: mt.sides.slice().sort((a, b) => keys.indexOf(a.side) - keys.indexOf(b.side)) }));
    return { started: true, first, other, n, log, role, onClock: done || !n ? null : (role === 'put' ? putter : responder), facing: role === 'respond' && !done ? log[log.length - 1].pair : null,
      avail, matches: ordered, done, even, rosters };
  }
  // Pure: the matchup after `side` takes a step with `pair` (two of his remaining players). Names come back in the roster's spelling.
  function cupMatchupPick(cfg, side, pair) {
    const v = cupMatchupView(cfg);
    if (!v.started) return { ok: false, reason: 'The matchup draw has not started' };
    if (!v.even || v.n < 1) return { ok: false, reason: 'Both teams need the same, even number of players to make pairs' };
    if (v.done) return { ok: false, reason: 'The matchups are already set' };
    if (v.onClock !== side) return { ok: false, reason: 'It is not your turn' };
    if (!Array.isArray(pair) || pair.length !== 2 || norm(pair[0]) === norm(pair[1])) return { ok: false, reason: 'A pair is two different players' };
    const canon = pair.map(x => v.avail[side].find(a => norm(a) === norm(x)));
    if (canon.some(c => !c)) return { ok: false, reason: 'Both players must still be unpaired' };
    return { ok: true, matchup: Object.assign({}, cfg.matchup, { log: v.log.concat([{ n: v.log.length + 1, side, pair: canon }]) }) };
  }

  // ── Sunday singles draw (Dev-95): "put up and respond" with single players. cfg.singles = { started, first, log:[{n, side, player}], done, choice }.
  // The side that LOST the pairs round is in control (Start / Defer / Coin toss); a tie goes to the captain who picked second in the team draft.
  // The result the finisher posted is in cfg.results[roundKey] = { points:{A,B} }. The last player on each side meets automatically.
  function cupSinglesRound(cfg) {
    return ((cfg && cfg.rounds) || []).findIndex(r => { const f = CUP_FORMATS[((r.segments || [])[0] || {}).format]; return !!f && f.size === 1; });
  }
  function cupSinglesControl(cfg) {
    const keys = ((cfg && cfg.sides) || []).map(sd => sd.key), d = (cfg && cfg.draft) || {};
    const ri = cupPairsRound(cfg), rd = ri >= 0 ? cfg.rounds[ri] : null;
    const res = rd && cfg.results && cfg.results[rd.key];
    const tieWinner = keys.find(k => k !== d.first) || keys[0];
    if (!res || !res.points || keys.length !== 2) return { ready: false, control: tieWinner, tie: false, points: null };
    const a = Number(res.points[keys[0]]), b = Number(res.points[keys[1]]);
    if (!(Number.isFinite(a) && Number.isFinite(b))) return { ready: false, control: tieWinner, tie: false, points: null };
    if (a === b) return { ready: true, control: tieWinner, tie: true, points: { [keys[0]]: a, [keys[1]]: b } };
    return { ready: true, control: a < b ? keys[0] : keys[1], tie: false, points: { [keys[0]]: a, [keys[1]]: b } };
  }
  function cupSinglesView(cfg) {
    const m = cfg && cfg.singles;
    if (!m || !m.started) return { started: false };
    const keys = ((cfg.sides) || []).map(sd => sd.key);
    const first = keys.includes(m.first) ? m.first : keys[0], other = keys.find(k => k !== first);
    const rosters = {}; keys.forEach(k => { rosters[k] = cupRosterOf(cfg, k); });
    const N = rosters[first] ? rosters[first].length : 0, equal = N >= 1 && rosters[other].length === N;
    const log = m.log || [];
    const used = {}; keys.forEach(k => { used[k] = new Set(); });
    log.forEach(e => { if (used[e.side]) used[e.side].add(norm(e.player)); });
    const avail = {}; keys.forEach(k => { avail[k] = rosters[k].filter(x => !used[k].has(norm(x))); });
    const steps = equal ? Math.max(0, 2 * (N - 1)) : 0, done = equal && log.length >= steps;
    const round = log.length >> 1, putter = round % 2 === 0 ? first : other, responder = putter === first ? other : first;
    const role = log.length % 2 === 0 ? 'put' : 'respond';
    const ms = [];
    for (let i = 0; i + 1 < log.length; i += 2) ms.push([{ side: log[i].side, players: [log[i].player] }, { side: log[i + 1].side, players: [log[i + 1].player] }]);
    if (done && avail[first].length === 1 && avail[other].length === 1) ms.push([{ side: first, players: avail[first].slice() }, { side: other, players: avail[other].slice() }]);
    const matches = ms.map((sd, i) => ({ key: 'm' + (i + 1), sides: sd.slice().sort((a, b) => keys.indexOf(a.side) - keys.indexOf(b.side)) }));
    return { started: true, first, other, n: N, log, role, onClock: done || !equal ? null : (role === 'put' ? putter : responder), facing: role === 'respond' && !done ? log[log.length - 1].player : null, avail, matches, done, equal, rosters };
  }
  function cupSinglesPick(cfg, side, player) {
    const v = cupSinglesView(cfg);
    if (!v.started) return { ok: false, reason: 'The singles draw has not started' };
    if (!v.equal) return { ok: false, reason: 'Both teams need the same number of players for singles' };
    if (v.done) return { ok: false, reason: 'The singles matchups are already set' };
    if (v.onClock !== side) return { ok: false, reason: 'It is not your turn' };
    const canon = v.avail[side].find(a => norm(a) === norm(player));
    if (!canon) return { ok: false, reason: 'That player is already in a match' };
    return { ok: true, singles: Object.assign({}, cfg.singles, { log: v.log.concat([{ n: v.log.length + 1, side, player: canon }]) }) };
  }
  // ── BF Cup handicaps (Dev-95) ──────────────────────────────────────────
  // "Off the low" at a partial allowance, one rule for every format: inside each match the lowest handicap plays to scratch and everyone
  // else gets `pct`% of the difference (rounded). Fourball works per player (the low of all four), Foursomes per pair on the pair's COMBINED
  // course handicap (one ball, a team handicap), Singles 1:1. cfg.handicap = {bestball, altshot, singles (each an allowance %), slope, rating, par}: 0 (or absent) = scratch for that format; without
  // slope/rating/par the handicap Index is used as the course handicap. Strokes land on holes by stroke index (cupHoleStrokes).
  function cupHandicapRule(cfg) {
    const h = (cfg && cfg.handicap) || {};
    const n = v => (v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
    const clamp = v => Math.min(100, Math.max(0, v));
    const legacy = n(h.pct);                                   // an older single allowance applies to any format without its own
    const by = {};
    ['bestball', 'altshot', 'singles'].forEach(f => { const v = n(h[f]); by[f] = clamp(v != null ? v : (legacy != null ? legacy : 0)); });
    const rule = { pct: Math.max(by.bestball, by.altshot, by.singles), by, slope: n(h.slope), rating: n(h.rating), par: n(h.par) };
    const tiers = cupTiersOf(h);
    if (tiers.length) rule.tiers = tiers;                      // only present when the Cup plays tees by handicap, so a one-tee Cup is unchanged
    return rule;
  }
  // Tee by handicap: cfg.handicap.tiers = [{ tee, label, maxHcp, slope, rating, par, strokeIndex[18], pars[18] }, ...], frozen into the Cup record by BFE-A.
  // A player plays the first tier whose maxHcp is above his Index (BFSeries: Green < 10, Combo < 18, Gold the rest); the last tier takes everyone above.
  function cupTiersOf(h) {
    const raw = h && Array.isArray(h.tiers) ? h.tiers : [];
    const nn = v => (v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
    const arr18 = (a, lo, hi) => (Array.isArray(a) && a.length === 18 && a.every(x => Number(x) >= lo && Number(x) <= hi) ? a.map(Number) : null);
    return raw.map(t => ({ tee: String(t.tee || t.label || ''), label: String(t.label || t.tee || ''), maxHcp: nn(t.maxHcp), slope: nn(t.slope), rating: nn(t.rating), par: nn(t.par), strokeIndex: arr18(t.strokeIndex, 1, 18), pars: arr18(t.pars, 3, 6) }))
      .filter(t => t.slope !== null && t.rating !== null && t.par !== null)
      .sort((a, b) => (a.maxHcp === null ? Infinity : a.maxHcp) - (b.maxHcp === null ? Infinity : b.maxHcp));
  }
  function cupTierFor(index, rule) {
    const ts = rule && rule.tiers, x = Number(index);
    if (!ts || !ts.length || index === null || index === '' || !Number.isFinite(x)) return null;
    return ts.find(t => t.maxHcp !== null && x < t.maxHcp) || ts[ts.length - 1];
  }
  function cupIndexOf(cfg, name) {
    const st = (cfg && cfg.draft && cfg.draft.stats) || {}, k = Object.keys(st).find(x => norm(x) === norm(name)), v = k !== undefined && st[k] ? Number(st[k].hcp) : NaN;
    return Number.isFinite(v) ? v : null;
  }
  // The hole stroke indexes that place a player's strokes: the ones of the tee his Index plays from. A pair (one ball) uses the higher-Index partner's tee,
  // the partner who is receiving the strokes. Without tiers, or without a known Index, it is the Cup's single tee (cfg.handicap.strokeIndex).
  function cupStrokeIndexFor(cfg, names) {
    const rule = cupHandicapRule(cfg), h = (cfg && cfg.handicap) || {};
    if (rule.tiers) {
      const idx = (names || []).map(n => cupIndexOf(cfg, n)).filter(v => v !== null);
      const t = idx.length ? cupTierFor(Math.max(...idx), rule) : null;
      if (t && t.strokeIndex) return t.strokeIndex;
    }
    return Array.isArray(h.strokeIndex) && h.strokeIndex.length === 18 ? h.strokeIndex : null;
  }
  function cupCourseHcp(index, rule) {
    if (!Number.isFinite(Number(index)) || index === null || index === '') return null;
    const r = cupTierFor(index, rule) || rule;
    return Math.round(r && r.slope && r.rating != null && r.par != null ? courseHandicap(index, r.slope, r.rating, r.par) : Number(index));
  }
  // match = {sides:[{side, players:[..]}, {…}]}; hcps = {name: course handicap}. Rows say what each player (Fourball, Singles) or pair (Foursomes) receives.
  function cupMatchStrokes(match, hcps, rule) {
    const by = (rule && rule.by) || { bestball: 0, altshot: 0, singles: 0 };
    const get = n => { const v = hcps && hcps[n]; return Number.isFinite(v) ? v : null; };
    const off = (vals, pct) => { const known = vals.filter(v => v !== null); const low = known.length ? Math.min(...known) : null; return vals.map(v => (v === null || low === null || !pct) ? 0 : Math.round((v - low) * pct / 100)); };
    const players = [].concat(...match.sides.map(sd => sd.players));
    const singles = match.sides.every(sd => sd.players.length === 1);
    const pv = off(players.map(get), singles ? by.singles : by.bestball);
    const rows = players.map((n, i) => ({ names: [n], strokes: pv[i], known: get(n) !== null }));
    const sums = match.sides.map(sd => { const v = sd.players.map(get); return v.some(x => x === null) ? null : v.reduce((a, b) => a + b, 0); });
    const tv = off(sums, by.altshot);
    const teams = match.sides.map((sd, i) => ({ names: sd.players.slice(), side: sd.side, strokes: tv[i], known: sums[i] !== null }));
    return { by, players: rows, teams };
  }
  // Pure: strokes per hole (index 0 = hole 1) for a player or pair getting `strokes`, from the 18 stroke indexes.
  function cupHoleStrokes(strokes, strokeIndex) {
    return Array.from({ length: 18 }, (_, i) => strokesOnHole(strokes, (strokeIndex || [])[i], 18));
  }
  // Pure: the plain-language line for a matchup card, only for the formats the round actually plays.
  function cupMatchStrokeText(match, hcps, rule, formats, sideName) {
    if (!rule || !rule.pct) return 'Scratch: no strokes';
    const pctOf = { altshot: rule.by.altshot, bestball: rule.by.bestball, singles: rule.by.singles };
    const st = cupMatchStrokes(match, hcps, rule), out = [];
    (formats || []).forEach(f => {
      if (!pctOf[f]) { out.push((CUP_FORMATS[f] || {}).label + ': scratch'); return; }
      if (f === 'altshot') { const t = st.teams.filter(x => x.strokes > 0)[0]; out.push('Foursomes: ' + (t ? (sideName ? sideName(t.side) : t.side) + ' gets ' + t.strokes : 'even')); }
      else if (f === 'bestball') { const g = st.players.filter(x => x.strokes > 0); out.push('Fourball: ' + (g.length ? g.map(x => x.names[0] + ' ' + x.strokes).join(', ') : 'even')); }
      else if (f === 'singles') { const g = st.players.filter(x => x.strokes > 0); out.push('Singles: ' + (g.length ? g.map(x => x.names[0] + ' ' + x.strokes).join(', ') : 'even')); }
    });
    return out.join(' · ');
  }

  // ---- BF Cup live scoring (Dev-95) ----------------------------------------------------------------------------
  // Scores live in the Cup record: cfg.scores[roundKey][matchKey] = { h:{ '1':{ name: gross } }, t:{ '1': ISO }, by:{ '1': name } }.
  // gross 0 = picked up. Foursomes keeps ONE team score under the pair's first player. Nets use the handicap strokes by hole.
  function cupHcpMap(cfg) {
    const rule = cupHandicapRule(cfg), st = (cfg && cfg.draft && cfg.draft.stats) || {}, out = {};
    Object.keys(st).forEach(n => { const c = cupCourseHcp(st[n] && st[n].hcp, rule); if (c !== null) out[n] = c; });
    return out;
  }
  function cupSegmentAt(round, hole) { return ((round && round.segments) || []).find(sg => hole >= sg.from && hole <= sg.to) || null; }
  // The two 18-slot NET score arrays of one segment (null = hole not played yet; 99 = the side picked up).
  function cupMatchNets(cfg, round, match, entry, seg) {
    const rule = cupHandicapRule(cfg), hc = cupHcpMap(cfg);
    const st = cupMatchStrokes(match, hc, rule), hs = (n, names) => cupHoleStrokes(n, cupStrokeIndexFor(cfg, names) || []);
    const H = (entry && entry.h) || {};
    const gv = (h, name) => { const e = H[String(h + 1)]; if (!e) return undefined; const k = Object.keys(e).find(x => norm(x) === norm(name)); return k === undefined ? undefined : Number(e[k]); };
    return [0, 1].map(i => {
      const sd = match.sides[i], out = new Array(18).fill(null);
      for (let h = seg.from - 1; h < seg.to; h++) {
        if (seg.format === 'altshot') {
          const g = gv(h, sd.players[0]); if (g === undefined) continue;
          const t = st.teams[i], arr = hs(t ? t.strokes : 0, sd.players);
          out[h] = g > 0 ? g - arr[h] : 99;
        } else {
          let best = null, seen = false;
          sd.players.forEach(p => {
            const g = gv(h, p); if (g === undefined) return; seen = true;
            const row = st.players.find(r => norm(r.names[0]) === norm(p)), a = hs(row ? row.strokes : 0, [p]);
            if (g > 0) best = best === null ? g - a[h] : Math.min(best, g - a[h]);
          });
          if (seen) out[h] = best === null ? 99 : best;
        }
      }
      return out;
    });
  }
  // One match: per segment the state + the hole list, the next hole to enter and the format in play there.
  function cupMatchLive(cfg, round, match, entry) {
    const H = (entry && entry.h) || {};
    const segs = (round.segments || []).map(sg => {
      const [A, B] = cupMatchNets(cfg, round, match, entry, sg);
      return { key: sg.key, format: sg.format, from: sg.from, to: sg.to, nets: [A, B], state: cupMatchState(A, B, sg.from, sg.to) };
    });
    const max = Math.max(0, ...(round.segments || []).map(sg => sg.to));
    let next = 1; while (next <= max && H[String(next)]) next++;
    const cl = cfg.closed && cfg.closed[round.key] && cfg.closed[round.key][match.key];
    const done = segs.length > 0 && segs.every(s => s.state.decided) || !!cl;
    return { closed: cl || null, segments: segs, next: Math.min(next, max), allEntered: next > max, done, format: ((cupSegmentAt(round, Math.min(next, max)) || {}).format) || null };
  }

  // Who plays together. A session's matches are cut into groups (foursomes) for scoring: pairs matches are a group of one
  // (the match IS the four players); singles matches go two to a group in draw order (matches 5 and 6 are Group 1). round.groupSize overrides.
  function cupGroupsOf(round) {
    const ms = (round && round.matches) || [], f = CUP_FORMATS[((round && round.segments || [])[0] || {}).format];
    const per = round && round.groupSize > 0 ? Math.floor(round.groupSize) : (f && f.size === 1 ? 2 : 1);
    const out = [];
    for (let i = 0; i < ms.length; i += per) out.push({ key: 'g' + (out.length + 1), matches: ms.slice(i, i + per) });
    return out;
  }
  // Match numbers run across the whole Cup in session order: "roundKey|matchKey" -> 1, 2, 3 ...
  function cupMatchNumbers(cfg) {
    const out = {}; let n = 0;
    ((cfg && cfg.rounds) || []).forEach(r => (r.matches || []).forEach(m => { out[r.key + '|' + m.key] = ++n; }));
    return out;
  }
  function cupLiveStandings(cfg) {
    const sc = (cfg && cfg.scores) || {};
    return cupStandings(cfg, [], { sideScores: (r, m, sg) => cupMatchNets(cfg, r, m, ((sc[r.key] || {})[m.key]) || null, sg) });
  }
  function cupTotalPoints(cfg) {
    const rule = cupPointsRule(cfg);
    return (cfg.rounds || []).reduce((t, r) => t + (r.matches || []).length * (r.segments || []).length, 0) * Math.max(rule.win + rule.loss, 2 * rule.half);
  }
  // Structural checks. A half-built lineup (captains still picking) is valid: `unassigned[round][side]` lists who has no match yet.
  function cupValidate(cfg) {
    const errors = [];
    const sides = cfg && cfg.sides;
    if (!Array.isArray(sides) || sides.length !== 2 || !sides[0].key || sides[0].key === sides[1].key) return { ok: false, errors: ['The Cup needs exactly two sides with different keys'], unassigned: {} };
    ['pct', 'bestball', 'altshot', 'singles'].forEach(k => { const v = cfg.handicap && cfg.handicap[k]; if (v != null && v !== '' && !(Number(v) >= 0 && Number(v) <= 100)) errors.push('Handicap allowance must be between 0 and 100'); });
    const sideOf = new Map();
    sides.forEach(sd => (sd.players || []).forEach(p => {
      const k = norm(p);
      if (sideOf.has(k)) errors.push(p + ' is on both sides'); else sideOf.set(k, sd.key);
    }));
    const unassigned = {};
    const roundList = cfg.rounds || [];
    roundList.forEach((r, ri) => {
      if (!r.sameAs) return;
      const j = roundList.findIndex(x => x.key === r.sameAs);
      if (j < 0 || j >= ri) { errors.push((r.name || r.key) + ': "same pairs as" must point to an earlier session'); return; }
      const sizeOf = rd => { const f = CUP_FORMATS[((rd.segments || [])[0] || {}).format]; return f ? f.size : null; };
      if (sizeOf(r) != null && sizeOf(roundList[j]) != null && sizeOf(r) !== sizeOf(roundList[j])) errors.push((r.name || r.key) + ': cannot share pairs with a session of a different side size');
    });
    roundList.forEach(r => {
      const segs = (r.segments || []).slice().sort((a, b) => a.from - b.from);
      let size = null;
      segs.forEach((sg, i) => {
        const f = CUP_FORMATS[sg.format];
        if (!f) errors.push((r.name || r.key) + ': unknown format ' + sg.format);
        else if (size == null) size = f.size; else if (size !== f.size) errors.push((r.name || r.key) + ': formats in one round must use the same side size');
        if (!(sg.from >= 1 && sg.to <= 18 && sg.from <= sg.to)) errors.push((r.name || r.key) + ': segment ' + sg.key + ' is outside holes 1-18');
        if (r.holes && r.holes.count === 9) {
          const lo = r.holes.half === 'back' ? 10 : 1;
          if (sg.from < lo || sg.to > lo + 8) errors.push((r.name || r.key) + ': a 9-hole round (' + (r.holes.half === 'back' ? 'back' : 'front') + ' nine) only has holes ' + lo + '-' + (lo + 8));
        }
        if (i > 0 && sg.from <= segs[i - 1].to) errors.push((r.name || r.key) + ': segments overlap');
      });
      const seen = new Set();
      (r.matches || []).forEach(m => {
        if (!m.sides || m.sides.length !== 2 || m.sides[0].side === m.sides[1].side) { errors.push((r.name || r.key) + ' ' + m.key + ': a match is one player/pair from each side'); return; }
        m.sides.forEach(ms => {
          if (size != null && (ms.players || []).length !== size) errors.push((r.name || r.key) + ' ' + m.key + ': needs ' + size + ' player(s) a side');
          (ms.players || []).forEach(p => {
            const k = norm(p);
            if (sideOf.get(k) !== ms.side) errors.push(p + ' is not on side ' + ms.side);
            if (seen.has(k)) errors.push(p + ' plays twice in ' + (r.name || r.key)); seen.add(k);
          });
        });
      });
      unassigned[r.key] = {};
      sides.forEach(sd => { unassigned[r.key][sd.key] = (sd.players || []).filter(p => !seen.has(norm(p))); });
    });
    return { ok: errors.length === 0, errors, unassigned };
  }

  return {
    ENGINE_VERSION,
    BASE_GAMES, ADDONS,
    getGame, listGames, recommendPairs, GAME_GROUPS, gamesInUiOrder, gamesUiMeta, gamesInfo, gamesSealLabels, defaultConfig, validateFields, cleanFields, validateGameConfig, cleanGameConfig, gameSchemas, potFit,
    skinsWon, betterBallHoles, scrambleTeamStrokes, scrambleSize, scramblePcts, scrambleCombinedPct, stablefordHolePoints,
    courseHandicap, playingHandicap, strokesOnHole, rankWithin, netCard,
    gatheringConfigFromLegacy,
    computeRoundPayout,
    computeGatheringGamesPayout, fourballBoard, fourballMatchView, matchSegmentResult, fourballSegmentPlan, PERIODS, PERIOD_ORDER, periodKey, periodList,
    latestScorecardPerPlayer,
    scorecardMissingHoles,
    fourballGroups, playerInitials, rollGameSetup, rollFormatsFor, rollSideVariant, rollDraw, mergeHoleScores,
    CUP_FORMATS, cupTiersOf, cupTierFor, cupIndexOf, cupStrokeIndexFor, cupPointsRule, cupWinTarget, cupPlanFor, cupSnakeOrder, cupAlternatingOrder, cupMatchState, cupSideScores, cupStandings, cupTotalPoints, cupValidate, cupDraftView, cupOrderFirst, cupDraftPick, cupDraftUndo, cupParseStats, cupSeriesStats, cupBalance, cupRosterOf, cupPairsStatus, cupPairStats, cupPairsSpread, cupPairsSuggest, cupPairsRevealed, cupPairsVisible, cupPairsRound, cupMatchupView, cupMatchupPick, cupSinglesRound, cupSinglesControl, cupSinglesView, cupSinglesPick, cupHandicapRule, cupHcpMap, cupSegmentAt, cupMatchNets, cupMatchLive, cupGroupsOf, cupMatchNumbers, cupLiveStandings, cupCourseHcp, cupMatchStrokes, cupHoleStrokes, cupMatchStrokeText, CUP_BALANCE_LIMITS,
    suggestGameAmounts, strokeMarksFor, sideStrokeSets, gameTraits, gamesWith, sideGames, sideFormGames, gameSides, sideMatchView, sideMatchStory, sideGroupResults, sideResultTags
  };
});
