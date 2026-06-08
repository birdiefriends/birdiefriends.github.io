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

#### 9a. Photo Metadata Schema

Each photo carries structured metadata that pins it unambiguously to a moment on the event timeline. This is the contract for both gallery rendering and long-term archival legibility — a photo without metadata is just a file with a number.

```json
{
  "hero_group": "garretts-last-swing-photo.jpg",
  "gallery": [
    {
      "file": "gls-photo-966c.jpg",
      "slug_prefix": "gls",
      "captured_at": "2026-06-05T10:30:00",
      "day": "friday",
      "chapter": "rd1",
      "round": 1,
      "course": "shore_gate",
      "hole": null,
      "subjects": ["garrett_perschy"],
      "caption": "Garrett on the cart path — Shore Gate Rd 1",
      "role": "on_course",
      "full_width": true,
      "submitted_by": "brian_hager",
      "source_filename": "IMG_0966.jpg"
    }
  ],
  "chapters": [
    {
      "id": "thursday",
      "emoji": "🚗",
      "title": "Thursday — Arrival",
      "date_label": "Jun 5 · Evening",
      "photos": ["gls-photo-955.webp", "gls-photo-999.jpg", "gls-photo-1047.jpg"]
    },
    {
      "id": "rd1",
      "emoji": "🏌️",
      "title": "Friday — Rd 1 · Shore Gate GC",
      "date_label": "Jun 5 · 8 AM – 2 PM",
      "photos": ["gls-photo-beach1.webp", "gls-photo-beach2.webp", "gls-photo-913.jpg", "gls-photo-966c.jpg"]
    }
  ],
  "layout": "masonry_2col"
}
```

#### 9b. Metadata Field Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | string | ✅ | Deployed filename in `docs/`. Convention: `<slug>-photo-<id>.<ext>` |
| `source_filename` | string | ✅ | Original filename from camera roll (e.g. `IMG_0966.jpg`). Preserves traceability back to the source device. |
| `slug_prefix` | string | ✅ | Event slug abbreviation (e.g. `gls`). Ties the file to its event even if moved. |
| `captured_at` | ISO 8601 | recommended | Timestamp from EXIF or best estimate. Drives timeline ordering. |
| `day` | string | ✅ | `thursday`, `friday`, `saturday` — the event-relative day label. |
| `chapter` | string | ✅ | Gallery chapter ID this photo belongs to (e.g. `rd1`, `friday-night`, `saturday-after`). |
| `round` | int or null | recommended | `1`, `2`, `3`, or `null` for off-course moments. |
| `course` | string or null | recommended | Course ID if on-course (matches §2 Courses). |
| `hole` | int or null | optional | Hole number if identifiable. |
| `subjects` | string[] | recommended | Player IDs visible in the photo (matches §3 Players). Enables future per-person filtering. |
| `caption` | string | recommended | Human-readable description. Written by commissioner at upload time or session end. |
| `role` | enum | ✅ | See Role Registry below. |
| `full_width` | bool | optional | Whether to render as a hero/full-width tile in the gallery grid. Default false. |
| `submitted_by` | string | recommended | Player ID of whoever contributed the photo. |

#### 9c. Role Registry

| Role | Description |
|------|-------------|
| `hero_group` | The primary event group photo — used as the results page hero image |
| `gallery_lead` | First photo in a chapter; displayed full-width |
| `on_course` | Action or context shot taken during a round |
| `off_course` | Social/leisure shot — meals, travel, evening |
| `trophy_moment` | Award, celebration, or winner shot |
| `detail` | Object or scene (e.g. the hat, a scorecard, a view) |

#### 9d. Chapter Structure

Chapters are the gallery's navigation backbone. Each chapter maps a named moment in the event timeline to an ordered set of photos. Chapter IDs are stable references — the results page photo pills link to `#ch-<id>` anchors.

**Chapter ID naming convention:**
- Pre-event arrival: `thursday`, `friday-morning`, etc. — day-relative
- Rounds: `rd1`, `rd2`, `rd3`
- Post-round social: `friday-after`, `friday-night`, `saturday-after`
- Special: `highlight`, `champion`

Chapters should be defined in chronological order. New chapters can be added at any state without breaking existing links.

#### 9e. Upload Flow (current — Session 31)

Photos are currently uploaded manually via the GitHub API (Claude direct). The process:

1. Commissioner collects photos from group members after the event
2. Photos are renamed to `<slug>-photo-<id>.<ext>` where `<id>` is the source file number or a descriptive slug (e.g. `beach1`, `ski2`)
3. Claude crops, resizes where needed, and pushes to `docs/` via GitHub API
4. Chapter assignment and metadata are recorded in the gallery JS data structure
5. Source filename noted in session for traceability

**Known gap:** metadata currently lives only in the gallery JS — not in a queryable, portable format. A photo's chapter, caption, and subjects are implicit in the gallery code, not stored as a separate record.

#### 9f. Future: Photo Metadata Capture (planned)

The goal is for every photo to carry its timeline context from the moment of upload — not reconstructed afterward from memory. This requires a structured capture step at upload time.

**Planned upload flow:**

1. Any group member submits photos via a **Photo Upload form** in the portal (event-scoped, available during LIVE and FINAL states)
2. The form captures:
   - Photo file(s)
   - **Moment** — dropdown of chapter options for this event (e.g. "Friday Round 1", "Friday Evening", "Saturday Night")
   - **Who's in it** — multi-select from the event player roster
   - **Caption** (optional free text, ≤120 chars)
   - Submitter name (auto-filled from portal identity)
3. On submit: photo is staged to a `pending/` prefix in GitHub (not yet live), metadata written to Worker KV as `photo_meta::<slug>::<id>`
4. Commissioner reviews pending uploads in Admin, approves/rejects individually, assigns `full_width` and final chapter position
5. On approval: photo moves from `pending/` to `docs/`, gallery JS regenerated from KV metadata, site redeployed

**Metadata written to KV at upload:**
```json
{
  "file": "gls-photo-1047.jpg",
  "source_filename": "IMG_1047.jpg",
  "submitted_by": "brian_hager",
  "submitted_at": "2026-06-08T14:22:00Z",
  "chapter_hint": "thursday",
  "subjects": ["jon_hernandez", "jerry_snyder", "brian_hager"],
  "caption": "Boardwalk bar Thursday evening",
  "approved": false,
  "approved_by": null,
  "approved_at": null
}
```

**Key principle:** the submitter — who was there — provides the timeline context. The commissioner provides editorial control. Neither has to reconstruct from memory later.

*Photo storage convention: `docs/<slug>-photo-<id>.<ext>` in GitHub Pages repo. Pending: `docs/pending/<slug>-photo-<id>.<ext>`*

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
- **Photo upload with metadata capture** — portal form for group members to submit photos with timeline context (chapter, subjects, caption) at upload time; KV-backed pending queue; commissioner approval flow. Full spec in §9f.
- Worker-driven site auto-deploy on state change
- Payout engine as a Worker endpoint
- Competition registry as a versioned library in `source/`
- Gallery JS auto-generation from KV photo metadata (replaces hand-coded chapter arrays)

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
