# BF_WCRP_Memories_Spec.md — WCRP Memories Capture: Build Spec (Draft v1)

**Status:** §8 step 1 (schema/round-picker piece, §4a) built and shipped in Dev-79 (2026-09-07) — `tee_time` on `bfe_event_rounds`, Section 4's combined Jotform + Gatherings round-name picker with historic filtering, best-effort venue auto-match, a Jotform Date & Time parsing fix (was silently discarding time-of-day), and Setup's four manual "Load" buttons now auto-firing on page open instead of requiring a click each. Steps 2–7 (the BFE-backed flag, BFE_API memory routes, Live Panel repoint, the widget itself, EventCard icon disabling, curation view + Results wiring) are still design-only, carried to Dev-80. Companion to `BF_BFE_Memories_Plan.md` (the investigation/decision doc) — that doc covers the *why*, this one covers the *how*. Read `BF_WallyCup_Spec.md` first if you haven't already; this plugs into the same event structure.

**Framing, per Brian (9/5):** two separate memory systems, on purpose. EventCard Memories is organic/frequent/low-stakes — right for a single round. BFE events are productions — players travel further, stay longer, the whole thing is meant to be a keepsake. The build below treats WCRP Memories as its own system tailored to that, not a bolted-on variant of the EventCard flow.

---

## 1. Data model — new tables, owned by BFE_API

`bf_experiences_worker.js` currently has zero asset storage of its own. That's kept true here — these tables live in BFE's own D1, not `worker.js`'s. Nothing shared with the general photo pool, so "published only to the WCRP" is true by construction, not by convention.

```sql
CREATE TABLE bfe_event_memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES bfe_events(id),
  round_id INTEGER REFERENCES bfe_event_rounds(id),   -- NULL = pre-trip/post-trip/unresolved
  media_type TEXT NOT NULL,        -- 'photo' | 'video'
  r2_key TEXT NOT NULL,
  captured_by TEXT NOT NULL,       -- player_name; must resolve against bfe_event_roster
  caption TEXT,
  tagged_players TEXT,             -- JSON array of player_names, optional (see §5)
  section_label TEXT,              -- host-set override, e.g. "Saturday Night at the Pub" — see §4
  is_trophy_moment INTEGER DEFAULT 0,
  curation_status TEXT NOT NULL DEFAULT 'approved',   -- same reject-by-exception model as event_photos
  captured_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE bfe_event_memory_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES bfe_events(id),
  round_id INTEGER REFERENCES bfe_event_rounds(id),
  player TEXT NOT NULL,
  note TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Kept as two tables (not one with a `kind` discriminator) for the same reason `worker.js` keeps `event_photos`/`event_notes` separate — different shapes, and it matches the pattern already proven out.

**One small schema addition to `bfe_event_rounds`: `tee_time TEXT`.** Brian's 9/5 refinement (use tee time + last scorecard submitted as the two boundary points) needs no new stored *end* date — but the *start* (tee time) does need to live on the BFE side after all. See §4 for why: `BFE-Admin.html`'s results-page build runs standalone and has no access to the Portal's own event data. It doesn't need manual entry, though — see §4a: it can be pulled straight from Jotform the same way Section 3's registrant pull already works.

Files land in the existing `birdiefriends-photos` R2 bucket under a `bfe/<event_id>/<uuid>.<ext>` prefix — no second bucket needed, this is just namespacing.

## 2. BFE_API routes

Mirrors the shape of `worker.js`'s existing `/photos` routes so the portal-side JS is a close cousin of code that already works, not a new pattern:

- `POST /bfe/memories/upload` — multipart: `event_name`, `captured_by`, `file`, optional `caption`, `tagged_players` (JSON), `round_id` (sent explicitly by Live Panel when the live round is known; omitted otherwise). Server resolves `event_id` from `event_name`. When `round_id` isn't supplied, resolve it server-side (§4). Stores the object in R2, inserts the row, returns `{ ok, id, media_type }` — same response shape as the existing upload route.
- `GET /bfe/memories?event=<name>` — list, `curation_status='approved'` only for the public/player path; add `&pin=` for the commissioner path to see everything (matches the existing PIN convention).
- `GET /bfe/memories/serve/:id` — proxies the R2 object, same as `/photos/serve/:id`.
- `PATCH /bfe/memories/:id` — PIN-gated: curate (approve/reject), set `is_trophy_moment`, reassign `round_id`, or set a custom `section_label`. This is the "Host-added sections" mechanism the Results design reference already anticipates, ported from GS Photo Organizer's chapter-reassign pattern rather than invented fresh.
- `DELETE /bfe/memories/:id` — self (matches `captured_by`) or PIN, same ownership check `worker.js` already does for photos.
- `POST /bfe/memories/notes`, `GET /bfe/memories/notes?event=` — same shape as `event_notes`.

## 3. Eligibility and the widget

**Eligibility:** `currentPlayer` must appear in that event's `bfe_event_roster`, and today must fall within `event_date`–`event_end_date`. Recommend a small grace window (default ±1 day, configurable in Setup) rather than a hard cutoff — travel days are exactly the "transport, the house" moments this exists for, and arriving the night before shouldn't be locked out.

**Placement:** a persistent hero/banner on Home, parallel to how the live-round banner already works today but keyed to the event's whole date range instead of one round's tee-time window — visible to eligible players only, for the duration of the trip. Not nested inside any one round's card, since by design no single round card should feel like "the" current context between rounds. Tapping it opens the same style of sheet as EventCard's Photos sheet: Photo / Video / Upload-from-Gallery buttons plus a notes thread, reusing the `icon-action-row` component (already the intended-going-forward pattern per its own code comment) — just pointed at the new BFE routes instead of `GATHERINGS_API`.

**Nice-to-have worth calling out, not core to a first build:** because the roster is fixed and small (16 named players, known in advance — unlike the open-ended general photo pool), tagging who's *in* a shot from a name picker is cheap to add and fits the "produced keepsake" framing well. `tagged_players` is in the schema above so this can be added without a migration later, even if the picker UI itself waits.

## 4. Timeline auto-placement — revised per Brian's 9/5 refinement

Sharper than the "nearest preceding date" heuristic this section originally proposed, and it needs no new stored data. Two data points already exist for every round and bound its on-course window precisely:

- **Start** — the round's tee time. Already known wherever the Portal already knows it (that round's own card — same `evt.dt` Live Panel's `getLiveEvent()` already reads).
- **End** — the last scorecard submitted for that round. `bfe_scorecards` already has `captured_at` per player, upserted on submission, and `GET /scorecards?event=<round name>` already exists and is open (no PIN) — so `MAX(captured_at)` for a round is one query away today, no schema change.

`[tee time, MAX(scorecard captured_at)]` is the on-course window for that round. Across the 4 Wally Cup rounds that's 4 clear, non-overlapping windows. Any memory whose `captured_at` falls inside one classifies confidently as that round's on-course chapter. Anything outside all 4 — before Rd1 tees off, after the last Rd3 card comes in, or in the gap between rounds — is generic "Fun," not further subdivided for now. It doesn't need to be: every memory keeps its own `captured_at` regardless of bucket, so the timeline stays fully chronological relative to the golf either way. Brian's own call: finer-grained non-golf chapters (banquet, travel day, etc.) are a real future option through `section_label`/Setup, but not needed today.

This resolution can happen at read/render time (when the WCRP timeline or Results-page Photo Gallery is assembled) rather than needing to be locked in at upload time — recomputing it fresh each time means it's self-correcting if a late scorecard comes in, with no backfill step ever required. `round_id` stays on `bfe_event_memories` as a cache/override (Live Panel still sends it explicitly since it already knows which round is live, and it's what the commissioner curation view reassigns by hand), but it's no longer the only source of truth — the timestamp window is.

**Resolved (checked against `BFE-Admin.html` directly, 9/5):** the plumbing question this section originally left open is settled. `fetchResultsPageData()` — the function behind "Generate & publish" in Setup §10 — runs as its own standalone session; it fetches from the BFE Worker and the Portal's `/venues` endpoint only, and never touches the Portal's own `eventData`. So the Results-page build genuinely has no access to a round's tee time today. **Setup §4 (Rounds) needs a tee-time value per round row** — but per Brian's follow-up (§4a below), that's pulled from Jotform automatically, not hand-typed.

### 4a. Section 4's round-name field should be picker-driven, not typed — from BOTH event sources, not just Jotform

Brian flagged this independently, and it turns out to solve §4's tee-time question with almost no new code — but it needs two sources, not one, per his correction: not every Portal event is Jotform-driven. A host-created Gathering (per `BF_Gatherings_Spec.md`, "the umbrella term for any self-service-created event") lives natively in `GATHERINGS_API`'s own D1 `gatherings` table, with its own `event_time`/`title` — no Jotform submission exists for it at all. A picker that only reads Jotform would silently be unable to reference a Gathering-based round, which matters directly: it's the same category of event Brian floated earlier as a candidate for eventually getting the BFE scoring engine. Section 4 needs to be future-proof for that now rather than needing a second retrofit later.

Both sources already have exactly what's needed, and neither needs new backend work:

- **Jotform side** — `REQUEST_EVENT_FORM_ID`, the "Request Event" form (one submission per event, real Date & Time field, the same form behind every Series/Weekend EventCard). `fetchRequestEventDates()` already exists in `BFE-Admin.html`, already fetches it, and already returns `{ eventName: Date }`, correctly parsed. Today it's used for exactly one thing: hiding historic events from Section 3's registration dropdown.
- **Gathering side** — `GET /gatherings/all?pin=` on `GATHERINGS_API` already exists too (built for the commissioner Gatherings admin view): PIN-gated, returns every active Gathering with `title` and `event_time` among other fields. `BFE-Admin.html` already holds a commissioner PIN (the `hostPin` field used elsewhere on the page), so this is a fetch away, not a new capability.

So: merge both lists into one combined round-name picker (Jotform's Request Event names plus Gatherings' titles, each carrying its own resolved date), sorted together, most-recent-first. Selecting a name — from either source — stores its matched date as `tee_time` on that `bfe_event_rounds` row at Save. Section 3 already demonstrates the single-source version of this pattern (`loadJotformEventNames()` + `fetchRegistrantsFromJotform()`); Section 4 needs the two-source version, not a copy of Section 3's Jotform-only one. No new Jotform integration and no new Gatherings endpoint either — both fetches already exist in the codebase, just not wired to this field yet.

Host correction, not player correction, for the rare miss: rather than porting Live Panel's chip-picker into the widget (extra friction for a "quick photo at the pub" moment), fix an occasional wrong classification through the commissioner curation view's `round_id`/`section_label` override (§2) — same reject-by-exception philosophy already validated for photo curation generally.

## 5. EventCard changes

Disabling the 📷 Photos/Notes icons needs a real signal, not the existing `formatClass`-based `hasLivePanelSupport()` proxy (which its own code comment already flags as imprecise). Proposal: when the Portal builds `eventData`, cross-reference each card's name against BFE's event list the same way `bfeEventNameCandidates()` already does in reverse — a card is BFE-backed if `"<umbrella> - <its own name-suffix>"` resolves to a real `bfe_events`/`bfe_event_rounds` pair. Cache the resolved `bfeEventId`/`bfeRoundId` onto the card object once per load rather than re-resolving per render. `buildEventCard`'s icon-action-row then checks that field directly to omit Photos/Notes for BFE-backed cards, leaving every other card (Gatherings, Series, a non-WC scramble a host creates) untouched.

## 6. Live Panel repoint

For a BFE-backed live round, `livePanelUploadCore` posts to `POST /bfe/memories/upload` (with `round_id` known) instead of `GATHERINGS_API`'s `/photos/upload`. Everything else about the Live Panel UX — Open Camera zero-tap, the EXIF-guess dialog for manual Upload — stays as-is; only the destination changes. This is the piece that actually makes "published only to the WCRP" true, not just the widget's own captures.

## 7. Results page (WCRP)

`WallyCup_Results_Design_Reference.dc.html` §07 stops being a placeholder: `GET /bfe/memories?event=` returns everything, grouped by `round_id` (falling back to `section_label` for anything `NULL`/host-labeled), sorted by `captured_at` within each group — Rd1 / Rd2 / 2Man / Rd3 chapters auto-populate from real round IDs, "Pre-Trip"/"Post-Trip"/any custom section render as their own groups exactly as the placeholder text already promised.

## 8. Suggested build order

1. Schema: the two new tables, plus the `tee_time` field on `bfe_event_rounds`, populated via Section 4's new Jotform-backed round picker (§4a) rather than typed — a small, standalone fix worth doing regardless of the rest of this spec, and a one-time re-save of the live 2026 config to backfill its 4 rounds' tee times once it ships.
2. The precise BFE-backed flag on Portal `eventData` (§5) — small, and both §5 and §6 depend on it.
3. BFE_API routes (§2).
4. Live Panel repoint (§6) — do this alongside the widget, not after, so there's never a window where on-course capture writes to the old bucket while the widget writes to the new one.
5. The widget itself (§3).
6. EventCard icon disabling (§5) — last, since it's the one visible behavior change to existing cards and is easiest to verify once §2–§4 are confirmed working end to end.
7. Commissioner curation view (§2's PATCH route) and the Results page wiring (§7) — can trail slightly behind, since real memories need to exist before either has anything to show.

Nothing here is time-pressured against 9/11 per Brian's steer — sequencing above is for build sanity (don't ship a widget with nowhere correct to write), not a deadline.

## 9. Open calls before coding starts

- Grace window default (§3) — proposed ±1 day, adjustable per event in Setup.
- Whether the widget's notes thread keeps the same 200-character cap as `event_notes`, or gets more room given the "keepsake" framing.
- Player-tagging (§3's nice-to-have) — in scope for v1 or a fast-follow.
