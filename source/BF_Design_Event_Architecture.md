# Design note: one event model for hosts, from a single round to a BFE event

Status: DRAFT for Brian's sign-off. Written 2026-11-03 (Dev-98) while designing BF Cup games and money (spec §13.15). Companion to `BF_Design_EventHome_Archive_2027.md`.

## Direction (Brian, 2026-11-03)
BirdieFriends evolves to a host-sustainable model for daily and BFE events. A single round with or without games (the event cards, Gatherings) is built, tested and in place. The BFE use cases (GLS, Wally Cup, BF Cup, and the BFSeries next year) have each been built their own way and need ONE architecture. The BF Cup is the vehicle: adjust it so it is the reference implementation of the target, not another variant.

## The target model (five layers; each can change without the others)
1. **Event** (the umbrella): type, name, host(s), access (host code, captain codes), roster and subs, status. A single round is an event with one round.
2. **Round**: venue, tees and tee policy, holes, date, base game (how it is scored: strokes, quota, match play), segments (formats inside a round, for Cup points).
3. **Round Config v1 (the contract between layers):** `{ payout.entry_per_player, addons:[ {id, ...schema fields} ] }`. This already exists and is what `computeRoundPayout` reads. A round's games and money are exactly this object.
4. **Capture** (where facts enter): scorecards, claims (CTP), answers (MiserBall), match results. Every source is adapted to the SAME input shape the engine reads (`scorecards`, `ctpLeaders`, `bbAnswers`). An adapter per source: Gathering scorecards (D1), Cup scores (Cup record), BFE Close Round (Jotform), the Golf Scorer (BFSeries).
5. **Engine and views:** `bf_engine.js` holds the rules once (registry: one definition per game, with its config schema, so forms are generated, not coded); every page is a view of one event record (the 2027 note).

## Where each use case stands today (from the docs; GLS and BFSeries to be confirmed with Brian)
| | Event record | Capture | Rules live in | Games and money | Views | Who can create |
|---|---|---|---|---|---|---|
| **Single round / Gathering** | `gatherings` + `bfe_gathering_games` (D1) | Live Score cards (D1), CTP in D1 | `bf_engine.js` (registry) | Round Config v1, Close & Calculate | My History, Live Panel | any host |
| **Wally Cup** | `bfe_events` (D1) | Jotform scorecard and CTP forms, Close Round | a second copy in BFE-Admin (`computeSkins`, `ENGINES`) | Section 6 proportional formula (podium 20 / CTP 15 / skins rest) | hand-finalized results page | commissioner |
| **GLS (Garrett's Last Swing)** | BFE event pages | hand-built pages and gallery | n/a to confirm | n/a to confirm | static pages, archive | commissioner |
| **BF Cup** | its own JSON record (`/bfe/cup`) | its own live panel (gross by hole) | `bf_engine.js` (Cup engine) | none yet | Cup page tabs (Score, Leaderboard, Teams, Handicaps) | commissioner creates, host code runs |
| **BFSeries (2027)** | Golf Scorer localStorage + published HTML | Golf Scorer | split: GS page code and `bf_engine.js` | per-event payouts, Season Pot | three generated pages | commissioner |

What the table says: three record stores, three capture paths, money rules in three places (the registry, BFE-Admin's own copy, the Golf Scorer), and creation is commissioner-only everywhere but a single round.

## How the BF Cup closes the gap (the Cup becomes the reference)
1. **Round-level games are Round Config v1** (`rounds[i].games`). No Cup money logic. The same object a Gathering round stores.
2. **One adapter per capture source, one input shape.** `cupRoundMoney(cfg, roundKey)` turns Cup scores into the engine's `scorecards`; the later Wally Cup and BFSeries adapters do the same job, then Section 6's formula and the Golf Scorer's payout call the registry instead of their own copies.
3. **Games form generated from the registry's config schema** on the BFE-A round row (section 4). Section 6 stays only for legacy engines and is retired when Wally-style rounds can be expressed as Round Config (needs `podium` and a quota base game in the registry: the "later" items already listed in the spec).
4. **The Cup page is the template for the event home:** tabs rendered from one record (Score, Leaderboard, Teams, Handicaps, Money, later Results and Archive).
5. **Per-event host authority** (host code) is the seed of host-created events; creation by any host is the follow-on (needs ownership, not just a PIN).

## Knowingly deferred (so the debt is written down)
- Three record stores and three capture paths stay until the event-home migration; Round Config v1 is the seam that makes the later move a storage change, not a rewrite.
- Who owns an event (tenancy), and host-created Cups.
- Collecting the buy-in (who has paid): payouts are calculated, cash is not tracked.
- Cross-round carry (Saturday's unclaimed CTP into Sunday's Skins) and Cup-match pots (a $ per match win): registry add-ons, after the Cup.
- Wally Cup / BFSeries money moving onto the registry (needs `podium`, quota base game).
- Round events versus the event-card "+ Games": BFE-backed cards are excluded from "+ Games" today; the event home removes the special case.

## Guardrails while building
No Cup-only payout logic; Cup-specific code is confined to the adapter and the one Worker action so a redesign can swap it out; a checkpoint after the Cup weekend reviews what real use showed before the next step.

## Stop conditions
If the Cup needs the engine core to change, or the BFE-A form cannot be generated from the game schemas without Cup-only code, stop and revisit: the seam is not clean.

**Deferred impact: BFE-A host UX (Brian, 2026-11-04).** BFE-A is an admin tool built for the commissioner; for hosts its UX is unusable and needs a complete redesign, not patches. First concrete symptom: the add-a-game dropdown reads as an already-added game until "+ Add game" is pressed. Design the host-facing event builder on the five layers above, with the Cup as the reference implementation.

**UX principle (Brian, 2026-11-04): capture appears where the event happens.** The Cup's CTP entry shows only on a CTP hole, inside the live scoring flow, and not as a dedicated always-there section of the panel. Brian prefers this: dynamic and contextual is cleaner than a standing section. It only works for live scoring (a round entered after the fact has no "current hole"), which he accepts. Apply the same rule to other capture adapters (e.g. a birdie or MiserBall prompt appearing on the hole it applies to) and design after-the-fact entry as a separate, deliberate path.

**Capture follows the event type (Brian, 2026-11-04; BF Cup is the test case).** One rule decides where a photo or video goes, whatever the entry point (the At the course rail, the card's photo sheet, the Live Panel): an ordinary event card keeps its own photos (Gatherings `event_photos`, shown in My History); a card that belongs to a BFE (multi-day: BF Cup, Wally Cup, a trip) goes to that BFE's memories (`bfe_event_memories`, tagged with the round name), so the whole weekend sits in one place. Found: the Live Panel already did this (Dev-80) but the rail and the card sheet always used Gatherings, so Cup photos would have scattered across the Day1 and Day2 cards. Now `bfeCaptureTarget(evt)` in the portal is the one resolver; the card photo sheet of a BFE card lists the whole event's memories. Not gated on `memories_capture_open` (same as the Live Panel); that switch still gates the Trip Memories Home banner. Still to do: BFE memories do not show in My History (only in the sheet and the Trip Memories modal); notes still go to the card's own thread; the Cup results and memories page is the proper home for the weekend package. Fallback if this misbehaves on the day: Brian's earlier plan (a results/memories page that reads both pipelines).

