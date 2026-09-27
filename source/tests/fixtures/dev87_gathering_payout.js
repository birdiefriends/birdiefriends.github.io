// FROZEN reference copy — computeGatheringGamesPayout, latestScorecardPerPlayer and
// scorecardMissingHoles exactly as shipped in portal.html v4.7.9 (Dev-87), before
// Dev-88 moved them into bf_engine.js. Used ONLY by test_engine_parity.mjs. Never edit.
function computeGatheringGamesPayout(config, scorecards, ctpLeaders, bbAnswers) {
  const games = (config && Array.isArray(config.games)) ? config.games : [];
  const dpp = Number(config && config.dollar_per_player) || 0;
  const cards = (scorecards || []).filter(c => c && c.player);
  const players = cards.map(c => c.player);
  const n = players.length;
  const norm = s => String(s || '').trim().toLowerCase();
  const canonical = new Map(players.map(p => [norm(p), p]));
  const totalPot = dpp * n;
  const payouts = new Map(players.map(p => [p, { player: p, skins: 0, cttp: 0, birdieball: 0, given_back: 0 }]));
  const credit = (name, field, amt) => {
    if (!(amt > 0)) return;
    const key = canonical.get(norm(name)) || name;
    if (!payouts.has(key)) payouts.set(key, { player: key, skins: 0, cttp: 0, birdieball: 0, given_back: 0 });
    payouts.get(key)[field] += amt;
  };
  const giveBack = (pot) => {
    if (!(pot > 0) || !n) return { each: 0, unallocated: Math.max(0, pot) };
    const each = Math.floor(pot / n);
    players.forEach(p => credit(p, 'given_back', each));
    return { each, unallocated: pot - each * n };
  };
  let remaining = totalPot;
  let unallocated = 0;

  // ── CTP ────────────────────────────────────────────────────────────────
  let cttp = null;
  let unclaimedCttp = 0;
  if (games.includes('cttp') && config.cttp_config) {
    const perHole = Number(config.cttp_config.dollar_per_hole) || 0;
    const holes = (config.cttp_config.holes || []).slice().sort((a, b) => a - b);
    const rows = holes.map(h => {
      const lead = ctpLeaders && (ctpLeaders[h] || ctpLeaders[String(h)]);
      if (lead && lead.player) {
        credit(lead.player, 'cttp', perHole);
        return { hole: h, player: canonical.get(norm(lead.player)) || lead.player, dist: lead.dist ?? null, paid: perHole };
      }
      unclaimedCttp += perHole;
      return { hole: h, player: null, dist: null, paid: 0 };
    });
    remaining -= perHole * holes.length;
    cttp = { per_hole: perHole, holes: rows, unclaimed_to_skins: unclaimedCttp };
  }

  // ── BirdieBall ─────────────────────────────────────────────────────────
  let birdieball = null;
  if (games.includes('birdieball') && config.birdieball_config) {
    const pot = (Number(config.birdieball_config.dollar_per_player) || 0) * n;
    remaining -= pot;
    // Only answers from players who actually played count.
    const answers = (bbAnswers || []).filter(a => canonical.has(norm(a.player_name)));
    const kept = answers.filter(a => a.kept);
    let mode, winners;
    if (kept.length) {
      mode = 'kept';
      winners = kept.map(a => canonical.get(norm(a.player_name)));
    } else {
      const lost = answers.filter(a => !a.kept && a.lost_hole != null);
      if (lost.length) {
        mode = 'longest';
        const score = a => (Number(a.lost_hole) || 0) * 100 + (Number(a.lost_stroke) || 0);
        const best = Math.max(...lost.map(score));
        winners = lost.filter(a => score(a) === best).map(a => canonical.get(norm(a.player_name)));
      } else {
        mode = 'none';
        winners = [];
      }
    }
    let perWinner = 0, bbUnalloc = 0, givenBackEach = 0;
    if (winners.length) {
      perWinner = Math.floor(pot / winners.length);
      winners.forEach(w => credit(w, 'birdieball', perWinner));
      bbUnalloc = pot - perWinner * winners.length;
    } else {
      const gb = giveBack(pot);
      givenBackEach = gb.each; bbUnalloc = gb.unallocated;
    }
    unallocated += bbUnalloc;
    const longest = mode === 'longest'
      ? answers.filter(a => winners.includes(canonical.get(norm(a.player_name))))[0]
      : null;
    birdieball = {
      pot, mode, winners, per_winner: perWinner, given_back_each: givenBackEach,
      longest_hole: longest ? longest.lost_hole : null, longest_stroke: longest ? longest.lost_stroke : null
    };
  }

  // ── Skins (gross) ──────────────────────────────────────────────────────
  let skins = null;
  if (games.includes('skins')) {
    const pot = Math.max(0, remaining) + unclaimedCttp;
    remaining = 0;
    const holeCount = Math.max(0, ...cards.map(c => Array.isArray(c.holes) ? c.holes.length : 0));
    const won = [];
    for (let h = 0; h < holeCount; h++) {
      const entries = cards
        .map(c => ({ player: c.player, s: Array.isArray(c.holes) ? c.holes[h] : null }))
        .filter(e => typeof e.s === 'number' && e.s > 0);
      // A skin needs a contest: with <2 scores entered on a hole (blank /
      // incomplete cards), nobody "beat" anybody — no skin. The Close
      // preview flags incomplete cards so the host can fix before closing.
      if (entries.length < 2) continue;
      const low = Math.min(...entries.map(e => e.s));
      const at = entries.filter(e => e.s === low);
      if (at.length === 1) won.push({ hole: h + 1, player: at[0].player, strokes: low });
    }
    let perSkin = 0, givenBackEach = 0, skUnalloc = 0;
    if (won.length) {
      perSkin = Math.floor(pot / won.length);
      won.forEach(w => credit(w.player, 'skins', perSkin));
      skUnalloc = pot - perSkin * won.length;
    } else {
      const gb = giveBack(pot);
      givenBackEach = gb.each; skUnalloc = gb.unallocated;
    }
    unallocated += skUnalloc;
    skins = { pot, won, per_skin: perSkin, given_back_each: givenBackEach, basis: 'gross' };
  } else {
    // No Skins game to absorb the balance (incl. unclaimed CTP) — give it back.
    const leftover = Math.max(0, remaining) + unclaimedCttp;
    if (leftover > 0) unallocated += giveBack(leftover).unallocated;
  }

  const rows = [...payouts.values()].map(r => ({ ...r, total: r.skins + r.cttp + r.birdieball + r.given_back }))
    .sort((a, b) => b.total - a.total || a.player.localeCompare(b.player));
  return {
    calc_version: 1,
    players_count: n, players, dollar_per_player: dpp, total_pot: totalPot,
    games, cttp, birdieball, skins, payouts: rows,
    unallocated: Math.round(unallocated * 100) / 100
  };
}
// Dev-87 — one latest card per player (GET /scorecards is already ordered
// captured_at DESC, so the first row seen per player is the newest — a
// Live Panel submit and a later Card Score Sheet fix collapse to the fix).
function latestScorecardPerPlayer(rows) {
  const seen = new Set();
  const out = [];
  (rows || []).forEach(r => {
    const k = String(r.player || '').trim().toLowerCase();
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
