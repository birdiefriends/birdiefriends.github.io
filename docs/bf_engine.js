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

  const ENGINE_VERSION = '1.16.3';

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
        return Object.assign({
          pot, mode, winners, per_winner: perWinner, given_back_each: givenBackEach,
          longest_hole: longest ? longest.lost_hole : null, longest_stroke: longest ? longest.lost_stroke : null
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
        const havePars = pars.length === 18 && pars.every(p => Number(p) > 0);
        const net = addon.basis === 'net';
        const birdies = [];
        if (havePars) {
          (inputs.scorecards || []).forEach(c => {
            const holes = Array.isArray(c.holes) ? c.holes : [];
            const off = (c.hole_count === 9 && c.hole_half === 'back') ? 9 : 0;
            // Dev-91: basis 'net' judges the birdie on gross − strokes received
            // (a par with a stroke is a net birdie; eagles are still ONE payout).
            const nc = net && inputs.netByPlayer ? inputs.netByPlayer.get(norm(c.player)) : null;
            holes.forEach((strokes, i) => {
              const par = Number(pars[off + i]);
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
          no_par_data: !havePars, birdies,
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

  // ── Fourball (Dev-93): better ball of partners ─────────────────────────
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

  // Fourball standalone: pairs are ranked on their better-ball total (lowest wins); the winning
  // pair(s) split a $/player carve, ties split, whole dollars rounded down, remainder reported.
  //   addon: { dollar_per_player, basis:'gross'|'net', net_mode:'own'|'low', pairs:[[a,b],…] }
  // net 'own'  = every player's own allowance-adjusted strokes (same rule as Skins Net);
  // net 'low'  = strokes come off the lowest handicap among the paired players.
  // A pair is ranked once every hole has at least one partner score (a pickup lets the other
  // partner's score stand alone); an incomplete pair is listed but cannot win. Like MiserBall it
  // can never take more than the pot has left (reported as `capped`).
  ADDONS.fourball = {
    id: 'fourball', order: 25, entity: 'pair',
    carve(state, addon, inputs) {
      const L = state.ledger;
      const cardBy = new Map((inputs.scorecards || []).map(c => [norm(c.player), c]));
      const pairsCfg = (addon.pairs || []).filter(p => Array.isArray(p) && p.length === 2);
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
      const gross = c => (Array.isArray(c.holes) ? c.holes : []).map(v => (typeof v === 'number' && v > 0 ? v : null));
      const holesFor = nm => {
        const c = cardBy.get(norm(nm));
        if (!c) return null;
        if (!netOk) return gross(c);
        if (mode === 'own') { const nb = inputs.netByPlayer.get(norm(nm)); return nb ? nb.holes : gross(c); }
        const sp = inputs.hcSpecs.get(norm(nm)) || {};
        return netCard(c, Object.assign({}, sp, { strokes: strokesOf(nm) - lowStrokes }), inputs.hcSI).holes;
      };
      // Which holes each player got a stroke on (after Off the low), so results can show who benefited and where.
      const marksFor = nm => {
        const c = cardBy.get(norm(nm)); if (!c) return null;
        const eff = strokesOf(nm) - (mode === 'low' ? lowStrokes : 0);
        const nc = netCard(c, Object.assign({}, inputs.hcSpecs.get(norm(nm)) || {}, { strokes: eff }), inputs.hcSI);
        const off = c.hole_count === 9 && c.hole_half === 'back' ? 9 : 0;
        const got = {}; nc.received.forEach((k, i) => { if (k) got[off + i + 1] = k; });
        return { player: L.canon(nm), strokes: eff, got };
      };
      const stroke_marks = netOk ? [...new Set(pairsCfg.flat().map(norm))].map(k => pairsCfg.flat().find(n => norm(n) === k)).map(marksFor).filter(Boolean) : null;
      const rows = pairsCfg.map(pr => {
        const names = pr.map(nm => L.canon(nm));
        const arrs = pr.map(holesFor).filter(a => a);
        const cards = pr.map(nm => cardBy.get(norm(nm))).filter(Boolean);
        const expected = cards.some(c => c.hole_count === 9) ? 9 : 18;
        const off = cards.some(c => c.hole_count === 9 && c.hole_half === 'back') ? 9 : 0;
        const bb = arrs.length ? betterBallHoles(arrs, expected) : [];
        const played = bb.filter(Boolean).length;
        const complete = arrs.length > 0 && played === expected;
        return {
          pair: names, complete, played,
          total: complete ? bb.reduce((a, h) => a + h.score, 0) : null,
          holes: bb.map((h, i) => ({ hole: off + i + 1, score: h ? h.score : null, by: h ? h.by.map(ix => names[ix]) : [] }))
        };
      });
      const plan = fourballSegmentPlan(addon);
      const nineRound = pairsCfg.some(pr => pr.some(nm => { const c = cardBy.get(norm(nm)); return c && c.hole_count === 9; }));
      if (plan.mode !== 'total' && !nineRound && rows.length >= 2) {
        const scoresOf = r => { const a = new Array(18).fill(null); r.holes.forEach(h => { if (h.score != null) a[h.hole - 1] = h.score; }); return a; };
        const arrs = rows.map(scoresOf);
        const idxs = rows.map((_, i) => i);
        const groupIdx = plan.scope === 'group' ? idxs.reduce((acc, i) => { (i % 2 === 0 ? acc.push([i]) : acc[acc.length - 1].push(i)); return acc; }, []) : [idxs];
        const configuredPot2 = (Number(addon.dollar_per_player) || 0) * L.n;
        const pot2 = Math.min(configuredPot2, Math.max(0, state.remaining));
        const capped2 = pot2 < configuredPot2;
        const ratio = configuredPot2 > 0 ? pot2 / configuredPot2 : 0;
        const perSeg = ((Number(addon.dollar_per_player) || 0) / plan.segs.length) * ratio;
        state.remaining -= pot2;
        let used = 0, unalloc2 = 0;
        const wonBy = new Map();
        const groups = groupIdx.map((gi, gn) => {
          const gPlayers = plan.scope === 'group' ? gi.length * 2 : L.n;
          const gNames = plan.scope === 'group' ? gi.reduce((a, i) => a.concat(rows[i].pair), []) : L.players.slice();
          const segsOut = plan.segs.map(sg => {
            const pot = Math.floor(perSeg * gPlayers);
            const res = fourballSegmentResult(gi.map(i => arrs[i]), sg, plan.win_by);
            const seg = { key: sg.key, label: sg.label, from: sg.a + 1, to: sg.b, pot, status: res.status, winner: null,
              ...(res.won ? { holes_won: res.won, halved: res.halved } : {}),
              totals: res.info.map(x => (x.complete ? x.total : null)),
          by: rows.map((r, i) => ({ player: r.player, total: res.info[i] && res.info[i].complete ? res.info[i].total : null })).sort((a, b) => (a.total == null) - (b.total == null) || a.total - b.total) };
            used += pot;
            if (res.status === 'won') {
              const wr = rows[gi[res.winner]];
              seg.winner = wr.pair;
              const each = Math.floor(pot / 2);
              wr.pair.forEach(nm => L.credit(nm, 'fourball', each));
              unalloc2 += pot - each * 2;
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
          ...(wantNet && !netOk ? { net_missing: true } : {}),
          standings: rows.map((r, i) => Object.assign({}, r, { scores: arrs[i], total: r.complete ? r.total : null }))
            .sort((a, b) => (a.total == null) - (b.total == null) || a.total - b.total),
          segments: { mode: plan.mode, win_by: plan.win_by, scope: plan.scope, per_segment: perSeg, groups },
          winners: [...wonBy.values()].map(w => w.pair), per_pair: null, per_player: null, given_back_each: 0
        }, capped2 ? { capped: true, configured_pot: configuredPot2 } : {});
      }
      const ranked = rows.filter(r => r.complete).sort((a, b) => a.total - b.total);
      ranked.forEach(r => {
        r.place = ranked.findIndex(x => x.total === r.total) + 1;
        r.tied = ranked.filter(x => x.total === r.total).length > 1;
      });
      const winners = ranked.filter(r => r.place === 1);
      const configuredPot = (Number(addon.dollar_per_player) || 0) * L.n;
      const pot = Math.min(configuredPot, Math.max(0, state.remaining));
      const capped = pot < configuredPot;
      state.remaining -= pot;
      let perPair = 0, perPlayer = 0, givenBackEach = 0, unalloc = 0;
      if (winners.length) {
        perPair = Math.floor(pot / winners.length);
        perPlayer = Math.floor(perPair / 2);
        winners.forEach(w => w.pair.forEach(nm => L.credit(nm, 'fourball', perPlayer)));
        unalloc = pot - perPlayer * 2 * winners.length;
      } else {
        const gb = L.giveBack(pot);
        givenBackEach = gb.each; unalloc = gb.unallocated;
      }
      state.unallocated += unalloc;
      return Object.assign({
        pairs: rows.map(r => r.pair), pot, basis: netOk ? 'net' : 'gross', ...(netOk ? { net_mode: mode, stroke_marks } : {}),
        ...(wantNet && !netOk ? { net_missing: true } : {}),
        standings: rows.slice().sort((a, b) => (a.total == null) - (b.total == null) || a.total - b.total),
        winners: winners.map(w => w.pair), per_pair: perPair, per_player: perPlayer, given_back_each: givenBackEach
      }, capped ? { capped: true, configured_pot: configuredPot } : {});
    }
  };

  // ── Low Score (Dev-93): an individual game over a scoring period ─────────────────────
  // Every player plays their own ball. In each scoring period the lowest total (gross, or net on own strokes)
  // wins that period's pot. 'round' = one contest over the whole round: the lowest total wins, a tie is a push.
  // With a period (Front / Back, Front / Back / Total, 6 / 6 / 6) the per-player ante is split across the periods;
  // a period's pot is that share x every player in the game, won outright by the lowest total, and a tied period
  // is a push (everyone's share of the ante comes back). A player who has not finished a period cannot win it.
  // Ties are "no blood" by default: a tie for low in the whole-round game is a push too and every ante comes back.
  // (A shared pool or a split can be offered later as a tie rule; nothing else here needs to change.)
  //   addon: { dollar_per_player, basis:'gross'|'net', period }
  // Like Fourball it can never take more than the pot has left (reported as `capped`).
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
    meta: { label: 'CTP', uiOrder: 2, icon: '🎯', seal: 'CTP',
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
    meta: { label: 'MiserBall', uiOrder: 3, icon: '🐦', seal: 'BIRDIEBALL',
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
    meta: { label: 'Fourball', icon: '🤝', seal: 'FOURBALL', uiOrder: 5, group: 'format',
      info: 'Played in pairs. Everyone plays their own ball and the pair counts the better of its two scores on each hole (gross unless the host set it to Net). The pair with the lowest total wins and splits the Fourball pot; tied pairs split it. If a partner picks up, the other\'s score counts alone. The pot can also be split into segments (Front 9, Back 9 and Total, or holes 1-6, 7-12 and 13-18), each its own pot won on strokes or holes won; a tied segment is a push.' },
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

  defineGame('lowscore', {
    kind: 'addon', input: 'strokes', net: true, entity: 'individual',
    released: true,
    meta: { label: 'Low Score', icon: '🎯', seal: 'LOW SCORE', uiOrder: 6, group: 'format',
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
    meta: { label: 'Birdie Payouts', uiOrder: 4, icon: '🐤', seal: 'BIRDIE PAY',
      info: 'A flat $ for every birdie or better, paid to whoever made it, from the same pot before Skins (gross unless the host set it to Net, where a par with a stroke counts). An eagle still pays one birdie. Nothing to enter: it\'s worked out from the scorecards when the round closes.' },
    config: [
      { key: 'dollar_per_birdie', type: 'money', label: '$ per birdie', default: 0, positive: true, required: true },
      { key: 'pars', type: 'pars', label: 'Par by hole', default: [], required: true, min: 3, max: 6, integer: true }
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
    meta: { label: 'Skins', uiOrder: 1, icon: '⛳', seal: 'SKINS',
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
  // Suggests partners for Fourball from known handicap data. Balanced: the strongest player is
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
  // Dev-93: the picker groups games — 'format' (how the round is scored: Fourball, later Foursomes / Match Play)
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
      } else if (f.type === 'holes') {
        if (!Array.isArray(v) || !v.length) errors.push(f.label + ': pick at least one hole');
        else if (!v.every(h => Number.isInteger(h) && h >= 1 && h <= 18) || new Set(v).size !== v.length) errors.push(f.label + ' must be unique holes 1-18');
      } else if (f.type === 'pars') {
        const lo = f.min != null ? f.min : 1, hi = f.max != null ? f.max : Infinity;
        if (!Array.isArray(v) || v.length !== 18 || !v.every(p => Number(p) >= lo && Number(p) <= hi && (!f.integer || Number.isInteger(Number(p))))) {
          errors.push(f.label + ' needs 18 par values' + (f.min != null ? ' (' + lo + '-' + hi + ')' : ''));
        }
      } else if (f.type === 'pairs') {
        // [[nameA, nameB], ...]: at least two pairs, two different names each, nobody in two pairs
        const names = [];
        const wellFormed = Array.isArray(v) && v.length >= 2 && v.every(pr => Array.isArray(pr) && pr.length === 2 &&
          pr.every(n => typeof n === 'string' && n.trim()) && pr[0].trim().toLowerCase() !== pr[1].trim().toLowerCase());
        if (wellFormed) v.forEach(pr => pr.forEach(n => names.push(n.trim().toLowerCase())));
        if (!wellFormed) errors.push(f.label + ' needs at least two pairs of two different players');
        else if (new Set(names).size !== names.length) errors.push(f.label + ': a player can only be in one pair');
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
      else if (f.type === 'pairs') out[f.key] = v.map(pr => pr.map(n => String(n).trim()));
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
    listGames('addon').forEach(id => { out[id] = { label: ADDONS[id].meta.label, config: ADDONS[id].config }; });
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
      if (basisOf('birdiepay_basis') === 'net') b.basis = 'net';
      addons.push(b);
    }
    // Dev-93: Fourball arrives through the generic game_configs column (no legacy column of its own).
    const fbc = row && row.game_configs && typeof row.game_configs === 'object' ? row.game_configs.fourball : null;
    if (games.includes('fourball') && fbc) {
      addons.push({ id: 'fourball', entity: 'pair', dollar_per_player: fbc.dollar_per_player, basis: fbc.basis === 'net' ? 'net' : 'gross',
        net_mode: fbc.net_mode === 'low' ? 'low' : 'own', pairs: Array.isArray(fbc.pairs) ? fbc.pairs : [],
        ...(periodKey(fbc) !== 'round' ? { period: periodKey(fbc), win_by: fbc.win_by === 'holes' ? 'holes' : 'strokes', scope: fbc.win_by === 'holes' || fbc.scope === 'group' ? 'group' : 'field' } : {}) });
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
    const results = { cttp: null, birdieball: null, birdiepay: null, fourball: null, lowscore: null, skins: null };
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
    addons.forEach(a => {
      results[a.id] = ADDONS[a.id].carve(state, a, withCards);
      if (ADDONS[a.id].residual) residualRan = true;
    });
    if (!residualRan) {
      // No residual game to absorb the balance (incl. rollover) — give it back.
      const leftover = Math.max(0, state.remaining) + state.rollover;
      if (leftover > 0) state.unallocated += ledger.giveBack(leftover).unallocated;
    }
    const rows = [...ledger.rows.values()]
      .map(r => Object.assign({}, r, { total: r.skins + r.cttp + r.birdieball + (r.birdiepay || 0) + (r.fourball || 0) + (r.lowscore || 0) + r.given_back }))
      .sort((a, b) => b.total - a.total || a.player.localeCompare(b.player));
    const games = (config && config.legacy && config.legacy.games) || addons.map(a => a.id);
    return {
      calc_version: 1,
      players_count: ledger.n, players, dollar_per_player: dpp, total_pot: totalPot,
      games, cttp: results.cttp, birdieball: results.birdieball,
      // birdiepay only appears in a snapshot when the game was on, so every pre-Dev-89 payout keeps its exact shape
      ...(results.birdiepay ? { birdiepay: results.birdiepay } : {}),
      ...(results.fourball ? { fourball: results.fourball } : {}),
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

  // ── Fourball live board (Dev-93) ───────────────────────────────────────
  // Where every pair stands RIGHT NOW from whatever scores are saved (partial cards welcome), using the
  // same better-ball / net logic the payout uses, so the live view can never disagree with the close.
  // pars (optional, 18) lets pairs on different holes be ranked fairly by score to par.
  // Returns null when the game has no Fourball.
  function fourballBoard(row, scorecards, pars) {
    const snap = computeGatheringGamesPayout(row, (scorecards || []).filter(c => c && c.player), {}, []);
    const f = snap && snap.fourball;
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

  // ── Fourball match view (Dev-93) ────────────────────────────────────────
  // For the Live Actions screen: each foursome (two pairs head to head) hole by hole, with the running tally of
  // every segment. Read from the same payout result Close uses (so it cannot disagree), partial cards welcome.
  // In the original 'total' pot there are no segments to pay, but the strip still shows Front and Back.
  function fourballMatchView(fb, addon) {
    if (!fb) return null;
    const plan = fourballSegmentPlan(addon);
    const viewSegs = plan.mode === 'total' ? PERIODS.fbt.segs : plan.segs; // the one-pot game still shows Front and Back
    const byKey = new Map((fb.standings || []).map(r => [r.pair.map(norm).join('|'), r]));
    const scoresOf = pr => {
      const out = new Array(18).fill(null);
      const r = byKey.get(pr.map(norm).join('|'));
      if (r) (r.holes || []).forEach(h => { if (h.score != null) out[h.hole - 1] = h.score; });
      return out;
    };
    const money = (fb.segments && fb.segments.groups) || [];
    const groups = fourballGroups(addon && addon.pairs).map((g, gi) => {
      const pairs = g.pairs.map(pr => ({ names: pr, scores: scoresOf(pr) }));
      if (pairs.length < 2) return { n: g.n, pairs, solo: true };
      const A = pairs[0].scores, B = pairs[1].scores;
      const holes = A.map((a, i) => ({ hole: i + 1, a, b: B[i], res: a == null || B[i] == null ? null : a < B[i] ? 'A' : a > B[i] ? 'B' : 'T' }));
      const segs = viewSegs.map(sg => {
        const r = fourballSegmentResult([A, B], sg, plan.win_by);
        const both = holes.slice(sg.a, sg.b).filter(h => h.res).length;
        let sa = 0, sb = 0;
        holes.slice(sg.a, sg.b).forEach(h => { if (h.res) { sa += h.a; sb += h.b; } });
        const lead = plan.win_by === 'holes' ? r.won[0] - r.won[1] : sb - sa; // positive = pair A ahead
        const paid = ((money[gi] || {}).segments || []).find(x => x.key === sg.key) || null;
        return { key: sg.key, label: sg.label, from: sg.a + 1, to: sg.b, played: both, holes_won: r.won, halved: r.halved,
          strokes: [sa, sb], lead, leader: lead === 0 ? null : (lead > 0 ? 0 : 1), final: r.status !== 'pending',
          status: both === 0 ? 'not_started' : (r.status === 'pending' ? 'in_progress' : 'final'), pot: paid ? paid.pot : null };
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
  // A foursome is two pairs head to head. The host's Fourball pairs are taken two at a time in the order
  // they were set: pairs 1+2 are group 1, pairs 3+4 are group 2, and so on. A last odd pair is its own group.
  function fourballGroups(pairs) {
    const ps = (pairs || []).filter(p => Array.isArray(p) && p.length === 2);
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
  // panels. `src` is a gathering row or its engine config. Follows Fourball's Off the low when that is chosen.
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

  function suggestGameAmounts({ dollarPerPlayer, players, games, cttpHoles }) {
    const B = Number(dollarPerPlayer) || 0;
    const n = Math.max(1, Math.floor(Number(players) || 0));
    const has = g => (games || []).includes(g);
    const dollars = x => Math.max(1, Math.round(x));
    const out = { players: n, pot: B * n, cttp: null, birdieball: null, birdiepay: null, fourball: null, lowscore: null };
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
    // Fourball is the main event: on its own the winning pair takes the whole pot; with side games ticked it
    // takes half and they share the rest (Skins gets whatever is left).
    // Low Score is a main event too; when both are ticked they share the main portion equally.
    const mains = ['fourball', 'lowscore'].filter(has);
    if (mains.length) {
      const main = ['cttp', 'birdieball', 'birdiepay', 'skins'].some(has) ? 0.5 * B : B;
      mains.forEach(g => { out[g] = { dollar_per_player: dollars(main / mains.length) }; });
    }
    return out;
  }

  return {
    ENGINE_VERSION,
    BASE_GAMES, ADDONS,
    getGame, listGames, recommendPairs, GAME_GROUPS, gamesInUiOrder, gamesUiMeta, gamesInfo, gamesSealLabels, defaultConfig, validateFields, cleanFields, validateGameConfig, cleanGameConfig, gameSchemas, potFit,
    skinsWon, betterBallHoles,
    courseHandicap, playingHandicap, strokesOnHole, rankWithin, netCard,
    gatheringConfigFromLegacy,
    computeRoundPayout,
    computeGatheringGamesPayout, fourballBoard, fourballMatchView, fourballSegmentPlan, PERIODS, PERIOD_ORDER, periodKey, periodList,
    latestScorecardPerPlayer,
    scorecardMissingHoles,
    fourballGroups, playerInitials, mergeHoleScores,
    suggestGameAmounts, strokeMarksFor
  };
});
