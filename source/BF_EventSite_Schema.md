# BirdieFriends Event Site Schema
**Version:** 1.0  
**Created:** June 2026  
**Reference Implementation:** garretts-last-swing.html (Garrett's Last Swing · Cape May 2026)

---

## Overview

A BirdieFriends Event Site is a standalone, publicly accessible results page deployed to `birdiefriends.com/<event-slug>.html`. It is generated from a structured data contract and passes through three states: **SETUP → LIVE → FINAL**.

The site is the *output*. BirdieFriends portal handles *input* (on-course data capture). This schema defines the contract between them.

---

## State Flow

```
SETUP    →    LIVE    →    FINAL
 │              │              │
Load hard    Scorecards     All rounds
assets,      flowing in,    complete,
define       leaderboards   payouts
competitions  in-progress    calculated,
             badges live     gallery
                             published
```

State is stored in **Worker KV** under key `event::<slug>::state`.  
Transitions are triggered by the commissioner via Admin panel.

---

## Data Contract

### 1. Event Config (hard asset — load at SETUP)

```json
{
  "slug": "garretts-last-swing",
  "name": "Garrett's Last Swing",
  "tagline": "Cape May · 2026",
  "dates": ["2026-06-05", "2026-06-06", "2026-06-07"],
  "location": "Cape May, NJ",
  "state": "FINAL",
  "theme": {
    "primary": "#0f1e3c",
    "accent": "#c9a84c",
    "font_display": "Pacifico",
    "font_body": "DM Sans"
  }
}
```

---

### 2. Courses (hard asset — load at SETUP)

```json
[
  {
    "id": "shore_gate",
    "name": "Shore Gate GC",
    "par_total": 72,
    "par_holes": [4,4,4,4,3,5,4,3,5, 4,4,4,5,3,4,5,3,4],
    "par3_holes": [5,8,14,17]
  },
  {
    "id": "cape_may",
    "name": "Cape May National",
    "par_total": 71,
    "par_holes": [4,4,3,5,4,3,5,3,4, 5,4,4,3,5,4,4,3,4],
    "par3_holes": [3,6,8,13,17]
  }
]
```

---

### 3. Players (hard asset — load at SETUP)

```json
{
  "original": [
    { "name": "Garrett Perschy", "id": "garrett_perschy" },
    { "name": "Tim Wargo",       "id": "tim_wargo" },
    { "name": "Jon Hernandez",   "id": "jon_hernandez" },
    { "name": "Brian Hager",     "id": "brian_hager" },
    { "name": "Jason Dinkel",    "id": "jason_dinkel" },
    { "name": "Jerry Snyder",    "id": "jerry_snyder" },
    { "name": "Matt Falcone",    "id": "matt_falcone" },
    { "name": "Nate Breiner",    "id": "nate_breiner" }
  ],
  "pinch_hitters": [
    { "name": "Aaron Sebelin",  "rounds": [2],    "partner": "tim_wargo" },
    { "name": "Kyle Sebelin",   "rounds": [2,3],  "partner": "jon_hernandez" },
    { "name": "Chase Sebelin",  "rounds": [2,3],  "partner": "brian_hager" },
    { "name": "Mike Falcone",   "rounds": [2],    "partner": "matt_falcone" },
    { "name": "Justin Sebelin", "rounds": [3],    "partner": "jerry_snyder" }
  ]
}
```

---

### 4. Rounds (hard asset structure, data from Jotform)

```json
[
  {
    "round": 1,
    "course_id": "shore_gate",
    "jotform_form_id": "253134098686163",
    "jotform_event_filter": "Garrett's Last Swing - Rd1",
    "cart_groups": [
      ["garrett_perschy", "matt_falcone", "jon_hernandez", "jerry_snyder"],
      ["brian_hager", "jason_dinkel", "tim_wargo", "nate_breiner"]
    ],
    "pairings": [
      { "team": ["garrett_perschy", "matt_falcone"] },
      { "team": ["jon_hernandez", "jerry_snyder"] },
      { "team": ["brian_hager", "jason_dinkel"] },
      { "team": ["tim_wargo", "nate_breiner"] }
    ]
  }
]
```

*Scorecard data (hole-by-hole scores, front/back/total) is pulled live from Jotform using the form ID and event filter.*

---

### 5. Competitions (hard asset — define at SETUP)

Each event defines 1–N competitions. Each competition has a **type** drawn from the competition registry.

```json
[
  {
    "id": "the_victor",
    "label": "The Victor",
    "emoji": "🏆",
    "type": "scramble_individual_cumulative",
    "description": "Lowest individual score vs par across all rounds. Each player's score = their team's scramble score for that round.",
    "eligible": "original",
    "rounds": [1, 2, 3]
  },
  {
    "id": "match_play_champion",
    "label": "Match Play Champion",
    "emoji": "🥊",
    "type": "match_play_cart_group",
    "description": "Hole-by-hole match play between the two pairs within each cart group. Low score wins the hole. 1 pt per match win, 0.5 for tie.",
    "eligible": "original",
    "rounds": [1, 2, 3]
  }
]
```

---

### 6. Side Games (per-round, optional)

```json
[
  {
    "type": "skins",
    "round": 3,
    "eligible": "all_teams",
    "rules": {
      "format": "low_score_wins",
      "ties": "carry",
      "pot": { "players": 12, "buy_in": 20 }
    }
  },
  {
    "type": "cttp",
    "round": 3,
    "eligible": "all_players",
    "holes": [3, 6, 8, 13, 17],
    "rules": {
      "pot": { "players": 11, "buy_in": 20 }
    }
  }
]
```

---

### 7. Competition Registry (built-in types)

| Type | Description | Inputs needed |
|------|-------------|---------------|
| `scramble_individual_cumulative` | Each player accumulates their team's scramble score across rounds | Scorecards, course par |
| `match_play_cart_group` | Pair vs pair within each foursome, hole by hole | Scorecards, cart groups |
| `match_play_field` | All pairs compete across the full field | Scorecards, pairings |
| `skins_field` | Low score per hole wins, ties carry, one pot | Scorecards, course par, pot |
| `skins_cart_group` | Skins within each foursome separately | Scorecards, cart groups, pot |
| `cttp` | Closest to pin on par 3s | CttP entries, hole winners |
| `stableford_quota` | BFSeries format — quota-based points | Scorecards, handicaps, course slope |
| `custom` | Commissioner enters results manually | Manual input |

*New types are added to the registry as new events introduce them.*

---

### 8. Payout Engine

Payouts are derived automatically from side game results + pot config.

```json
{
  "skins": {
    "pot_total": 240,
    "unit": "per_winning_hole",
    "unit_value": 48,
    "payee_type": "team",
    "results": [
      { "payee": "Garrett / Kyle", "holes_won": 2, "payout": 96 },
      { "payee": "Brian / Nate",   "holes_won": 1, "payout": 48 },
      { "payee": "Jon / Chase",    "holes_won": 1, "payout": 48 },
      { "payee": "Tim / Jason",    "holes_won": 1, "payout": 48 }
    ]
  },
  "cttp": {
    "pot_total": 220,
    "unit": "per_hole",
    "unit_value": 44,
    "payee_type": "individual",
    "results": [
      { "payee": "Nate Breiner",    "hole": 3,  "payout": 44 },
      { "payee": "Aaron Sebelin",   "hole": 6,  "payout": 44 },
      { "payee": "Jon Hernandez",   "hole": 8,  "payout": 44 },
      { "payee": "Tim Wargo",       "hole": 13, "payout": 44 },
      { "payee": "Garrett Perschy", "hole": 17, "payout": 44 }
    ]
  }
}
```

---

### 9. Photos (hard asset — load at SETUP or FINAL)

```json
{
  "hero_group": "garretts-last-swing-photo.jpg",
  "gallery": [
    { "file": "gls-photo-955.webp", "role": "gallery_lead", "caption": "The hat" },
    { "file": "gls-photo-989.jpg",  "role": "cttp_hero" },
    { "file": "gls-photo-947.jpg",  "role": "on_course" },
    { "file": "gls-photo-937.jpg",  "role": "on_course" },
    { "file": "gls-photo-987.webp", "role": "off_course" }
  ],
  "layout": "masonry_2col"
}
```

*Photos are deployed to `docs/` via GitHub API. Path convention: `<slug>-photo-<id>.<ext>`*

---

### 10. Scoring Stats (derived — computed at FINAL)

Derived from hole-by-hole scorecard data vs course par per hole.

```json
{
  "per_player": [
    {
      "player_id": "jon_hernandez",
      "holes": 54,
      "eagle": 1, "birdie": 7, "par": 32,
      "bogey": 13, "double": 1, "worse": 0,
      "strokes": 220,
      "avg_per_hole": 4.07,
      "note": "scramble_team_credit"
    }
  ]
}
```

`note: scramble_team_credit` — both players on a scramble team receive identical stats per hole. This is a known characteristic of the format, displayed with a caveat on the site.

---

## Site Sections (render order)

| Section | SETUP | LIVE | FINAL |
|---------|-------|------|-------|
| Hero (title, pill, player chips) | ✅ | ✅ | ✅ |
| Group photo | ⬜ | ✅ | ✅ |
| Winner banners | ⬜ | ⬜ | ✅ |
| Competition leaderboards | ⬜ | ✅ in-progress | ✅ final |
| Full field results | ⬜ | ✅ partial | ✅ |
| Pinch Hitter cards | ✅ | ✅ | ✅ |
| Skins results | ⬜ | ✅ in-progress | ✅ |
| CttP results | ⬜ | ✅ in-progress | ✅ |
| Payout table | ⬜ | ⬜ | ✅ |
| Scoring breakdown | ⬜ | ⬜ | ✅ |
| Photo gallery | ⬜ | ⬜ | ✅ |
| Back to portal button | ✅ | ✅ | ✅ |

---

## Infrastructure Notes

- **Scorecard capture:** Jotform (existing) — form ID + event name filter
- **CttP capture:** Jotform or portal live panel (existing)
- **State storage:** Worker KV namespace `BF_EVENTS`
- **Site deploy:** GitHub API via `bf_deploy.py` or Worker `/deploy` endpoint (event sites are small enough for Worker deploy)
- **URL convention:** `birdiefriends.com/<slug>.html`
- **Portal link:** Auto-added to Results section in portal at SETUP
- **Photo storage:** `docs/<slug>-photo-<id>.<ext>` in GitHub Pages repo

---

## Variant Considerations

Games will vary event to event. The schema accommodates this via:

1. **Competition type registry** — new types added as new formats are played
2. **Side game config** — skins, CttP, and future variants (long drive, putting contest, etc.) are independently configurable per round
3. **Eligible players** — `"original"`, `"pinch_hitters"`, `"all_players"`, `"all_teams"` scoping per competition
4. **Custom competition** — escape hatch for one-off formats; commissioner enters results manually

The *site template* is stable. The *competition definitions* are the variable. New events reuse the same rendering infrastructure with different competition configs.

---

## Future Build Considerations

- Hard asset loader UI in portal Admin panel (course par, event config, player roster)
- Competition configurator UI (pick types, set pots, define cart groups)
- State transition controls in Admin (SETUP → LIVE → FINAL buttons)
- Photo batch uploader in Admin
- Worker-driven site auto-deploy on state change
- Payout engine as a Worker endpoint
- Competition registry as a versioned library in `source/`

*This is a parallel track to BirdieFriends core — shares infrastructure (Worker, KV, Jotform, GitHub API) but operates as a separate surface.*

---

## Reference Implementation

**Event:** Garrett's Last Swing · Cape May 2026  
**URL:** birdiefriends.com/garretts-last-swing.html  
**Session:** BirdieFriends Session 30 · June 7, 2026  
**Competitions:** scramble_individual_cumulative, match_play_cart_group  
**Side games:** skins_field (Rd 3), cttp (Rd 3)  
**Players:** 8 original + 5 pinch hitters  
**Rounds:** 3 (Shore Gate Rd 1, Cape May Rd 2, Cape May Rd 3)  
**Photos:** 18 (1 hero group + 17 gallery)  
**State reached:** FINAL  
