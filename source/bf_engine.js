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

  const ENGINE_VERSION = '1.3.2';

  const norm = s => String(s || '').trim().toLowerCase();

  // ── Hole-by-hole skins (the comparison half only — no money) ───────────
  // compare: 'low' (strokes — Gatherings) | 'high' (Stableford points —
  // BFE quota rounds, wired in Phase B). A skin is the OUTRIGHT best score
  // on a hole: a tie at the best = no skin, no carryover. A hole needs ≥2
  // entered scores to be a contest (blank/incomplete cards beat nobody).
  // cards: [{player, holes:[number|null, …]}]
  function skinsWon(cards, compare) {
    const dir = compare === 'high' ? 'high' : 'low';
    const list = (cards || []).filter(c => c && c.player);
    const holeCount = Math.max(0, ...list.map(c => Array.isArray(c.holes) ? c.holes.length : 0));
    const won = [];
    for (let h = 0; h < holeCount; h++) {
      const entries = list
        .map(c => ({ player: c.player, s: Array.isArray(c.holes) ? c.holes[h] : null }))
        .filter(e => typeof e.s === 'number' && (dir === 'low' ? e.s > 0 : e.s >= 0));
      if (entries.length < 2) continue;
      const best = dir === 'low' ? Math.min(...entries.map(e => e.s)) : Math.max(...entries.map(e => e.s));
      const at = entries.filter(e => e.s === best);
      if (at.length === 1) won.push(dir === 'low'
        ? { hole: h + 1, player: at[0].player, strokes: best }
        : { hole: h + 1, player: at[0].player, points: best });
    }
    return won;
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
        const birdies = [];
        if (havePars) {
          (inputs.scorecards || []).forEach(c => {
            const holes = Array.isArray(c.holes) ? c.holes : [];
            const off = (c.hole_count === 9 && c.hole_half === 'back') ? 9 : 0;
            holes.forEach((strokes, i) => {
              const par = Number(pars[off + i]);
              if (typeof strokes === 'number' && strokes > 0 && par > 0 && strokes <= par - 1) {
                birdies.push({ hole: off + i + 1, player: L.canon(c.player), strokes, par });
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
          no_par_data: !havePars, birdies
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
        const won = skinsWon(inputs.scorecards, addon.compare || 'low');
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
        return { pot, won, per_skin: perSkin, given_back_each: givenBackEach, basis: addon.basis || 'gross' };
      }
    }
  };

  // ── Base-game registry (Phase A: only what Gatherings uses) ─────────────
  // scorecard_only: no competition of its own — the round exists to carry
  // cards; any money comes from add-ons. Phase B registers stableford,
  // scramble_pair and points_by_score_type from BFE-Admin's ENGINES.
  const BASE_GAMES = {
    scorecard_only: { id: 'scorecard_only' }
  };

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
    if (games.includes('birdiepay') && row.birdiepay_config) {
      addons.push({ id: 'birdiepay', entity: 'individual', dollar_per_birdie: row.birdiepay_config.dollar_per_birdie, pars: row.birdiepay_config.pars || [] });
    }
    if (games.includes('skins')) {
      addons.push({ id: 'skins', entity: 'individual', basis: 'gross', compare: 'low' });
    }
    return {
      v: 1,
      base: { game: 'scorecard_only', params: {} },
      entity: { level: 'individual', unit: 'player', derive: null },
      input: 'strokes',
      compare: 'low',
      handicap: { mode: 'scratch' },
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
    const results = { cttp: null, birdieball: null, birdiepay: null, skins: null };
    const addons = ((config && config.addons) || [])
      .filter(a => ADDONS[a.id])
      .slice()
      .sort((a, b) => ADDONS[a.id].order - ADDONS[b.id].order);
    const withCards = Object.assign({}, inputs, { scorecards: cards });
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
      .map(r => Object.assign({}, r, { total: r.skins + r.cttp + r.birdieball + (r.birdiepay || 0) + r.given_back }))
      .sort((a, b) => b.total - a.total || a.player.localeCompare(b.player));
    const games = (config && config.legacy && config.legacy.games) || addons.map(a => a.id);
    return {
      calc_version: 1,
      players_count: ledger.n, players, dollar_per_player: dpp, total_pot: totalPot,
      games, cttp: results.cttp, birdieball: results.birdieball,
      // birdiepay only appears in a snapshot when the game was on, so every pre-Dev-89 payout keeps its exact shape
      ...(results.birdiepay ? { birdiepay: results.birdiepay } : {}),
      skins: results.skins, payouts: rows,
      unallocated: Math.round(state.unallocated * 100) / 100
    };
  }

  // ── Gatherings Close & Calculate (Dev-87 contract, unchanged) ──────────
  function computeGatheringGamesPayout(row, scorecards, ctpLeaders, bbAnswers) {
    return computeRoundPayout(gatheringConfigFromLegacy(row), { scorecards, ctpLeaders, bbAnswers });
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
  function suggestGameAmounts({ dollarPerPlayer, players, games, cttpHoles }) {
    const B = Number(dollarPerPlayer) || 0;
    const n = Math.max(1, Math.floor(Number(players) || 0));
    const has = g => (games || []).includes(g);
    const dollars = x => Math.max(1, Math.round(x));
    const out = { players: n, pot: B * n, cttp: null, birdieball: null, birdiepay: null };
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
    return out;
  }

  return {
    ENGINE_VERSION,
    BASE_GAMES, ADDONS,
    skinsWon,
    gatheringConfigFromLegacy,
    computeRoundPayout,
    computeGatheringGamesPayout,
    latestScorecardPerPlayer,
    scorecardMissingHoles,
    suggestGameAmounts
  };
});
