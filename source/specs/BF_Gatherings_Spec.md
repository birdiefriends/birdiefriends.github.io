# BF Gatherings — Capability Spec (Dev-42)

**Status:** In progress — D1 + Worker API (Dev-43) and Crew-member Portal UI (Dev-44) built and live. Remaining: Host Management panel, Crew onboarding (§5).
**Created:** 2026-06-19, Session Dev-42
**Author:** Brian Hager + Claude

---

## 1. Purpose

BirdieFriends already supports the full range of event shapes this spec needs to enable for Hosts — Brian builds all of them today, as Commissioner, through dev sessions with Claude:

- **Standing/recurring events with specific registration rules** — e.g. the Sat/Sun weekend games. Charlie's Tuesday league is the same shape, just owned by a different person.
- **Production-tier series** (BFSeries) — full scoring, standings, multi-event arc.
- **Specialty one-offs** (Turkey2man) — custom format, single occurrence.
- **Casual individual one-offs** — Brian creates these himself, frequently.

None of these event *types* are new. What's missing is a way for someone other than the Commissioner to create one — today that requires a dev session, because every event is hand-built. Dev-42 isn't inventing a new category of event; it's building a **self-service path with guardrails** so a Host can produce the same kinds of events Brian already produces, without needing Claude or a dev session to do it.

This reframes "Gathering": not a new lightweight event type alongside Series Events, but the umbrella term for **any self-service-created event**, regardless of which existing shape it resembles — built through guardrailed portal tooling instead of code.

This is explicitly **not** the BizPlan track's commercial multi-tenant effort (separate customer orgs, isolated data, new backend — the v4.0 "off Jotform" architectural shift defined in the Ops Guide). This is a self-service/guardrails capability inside the existing single-tenant platform. The BizPlan's "hundreds maybe thousands of discrete and possibly intertwining players/groups" problem is out of scope here; this spec is the smallest end of that spectrum — a single player creating a single gathering.

---

## 2. Terminology

| Term | Definition |
|---|---|
| **Commissioner** | Existing role. Full platform admin (currently Brian only, PIN-gated). Owns Series Events. |
| **Series Event** | Existing concept. Commissioner-created, scored, part of BFSeries (quota/skins/standings). |
| **Player** | Lowest common denominator. Anyone in the BF Player Domain. |
| **BF Player Domain** | The full existing roster across all events/series — the pool any Host draws an audience from. |
| **Gathering** | **New.** A self-service-created event — can resemble any existing shape (casual one-off, standing/recurring with registration rules, specialty format), just built by a Host through guardrailed tooling instead of a dev session. Distinguished from a Series Event by *who builds it and how*, not by what it looks like. |
| **Host** | **New.** The player who creates a Gathering. Not a granted role — anyone becomes a Host by creating one. |
| **Crew** | **New.** An optional, named, reusable list of players a Host can invite/broadcast to. Created ad hoc (picked at Gathering-creation time, not saved) or saved for reuse. |
| **My Gatherings** | **New.** A Host's home tab — Gatherings they're running (one-off + recurring) and their saved Crews. Parallels the existing **Schedule** tab (events *I'm registered for*), but for things *I'm running*. |

None of the new terms collide with existing code or docs (checked against Ops Guide / Session Starter — "roster," "gathering," "crew," "host" are all currently unused as defined terms).

---

## 3. Founding use cases

**Use case A — Pickup game (one-off, frequent, low friction)**
A player books a tee time, creates a Gathering, and invites a hand-picked group. Expected to happen often — creation needs to be fast. *Analog: the casual one-off events Brian already creates individually today.*

**Use case B — Charlie's Tuesday league (recurring, continuity)**
Charlie runs a standing Tuesday 3:00 PM game at Whitetail. His audience is a known subset of the BF Player Domain. He wants to save that list once (a Crew) and reuse it every week — each Tuesday is its own Gathering, one date each, created quickly because the Crew is already saved — plus occasionally run one-off Gatherings outside the regular Tuesday slot. *Analog: the standing Sat/Sun weekend events, which already have their own registration rules — same shape, different owner.*

**Use case C — "Need a 4th" (Allentown)**
Brian has a foursome at Allentown GS and needs one more player, same day. Today this is solved by frantic texting/calling — fast, but ad hoc and unscalable. This is the case that breaks a simple Crew-only model (the right 4th isn't necessarily in any saved Crew) and motivated the Fill List concept in §4 — reach has to extend past the Host's named list without becoming a domain-wide blast.

**Use case D — GLS (cautionary)**
Garrett's Last Swing was followed by the whole community via its results page and photo gallery — organically positive as a proof-of-concept, but in hindsight should likely have been private. The lesson: content generated from a Gathering (results, photos) needs to inherit access rules, not default open just because the event itself went well.

These cases together show that a Crew is not owned 1:1 by a Host or by an Event — it's an independent, optionally-reusable object — and that reach beyond a Crew is a real, frequent need (Use Case C), but must stay bounded rather than open to the whole domain (Use Case D). See §4.

---

## 4. Visibility & reach model

**No public broadcast exists.** Not discouraged, not defaulted-off — structurally absent. There is no path for a Gathering to be discoverable by the whole BF Player Domain. Reach is always:

> **Crew** (named, Host's explicit list) **∪ Fill List** (only if the Host opts in for this Gathering, filtered to matching availability) **− that Host's Exclusion List − players who've muted this Host**

If a player isn't in that set, the Gathering's event card never renders for them — no Discover tab, no browsing surface, nothing to stumble onto.

**Tier 1 — Crew (always available)**
The Host's own named list — saved (Charlie's case) or picked ad hoc per-Gathering (pickup game case). No extra step; this is the baseline.

**Tier 2 — Fill List (Host opts in per-Gathering)**
A domain-wide pool of players who've personally opted in to "ping me for open spots" — not tied to any one Host. Solves Use Case C (Allentown 4th) without becoming a blast: the *recipient* controls membership, not the Host. A Host with an open slot can choose to extend reach into this pool; it's never automatic.

**Exclusion runs both directions.**
- *Host → Player* (built above): a Host can silently keep specific players from ever seeing their Gatherings.
- *Player → Host* (new): a player can silently mute a specific Host — that Host's Gatherings stop reaching them via the Fill List, no explanation owed, same silent mechanism as the reverse direction. ("Exclude me from Charlie.")

Both directions are personal, asymmetric, and require no agreement from the other side — either party can end the match without the other knowing why.

**Fill List availability, not just opt-in.** A flat "ping me for anything" toggle creates its own noise problem once multiple Hosts are pinging the same pool — v1 needs at least a coarse signal so pings only reach players who'd plausibly say yes. Simplest version: a day-of-week availability set per Fill List member (e.g. "available Wed, Sat"). A Fill List ping for a Wednesday Gathering only reaches players who've marked Wednesday. This is intentionally coarse for v1 — see §11 for richer-granularity as a future question, not a v1 requirement.

**Note on the Commissioner's own broadcast capability:** the Lord's Valley Scramble example (broadcast to everyone, self-selected foursome, then needed a fill when a player dropped) is a real-world validation of this exact funnel pattern — but the initial "broadcast to everyone" step was the Commissioner's existing, unrestricted capability (§7), not a Host action. That distinction matters: the Commissioner is not bound by the Crew/Fill-List/Exclusion model described here — only Hosts are.

**"Spot goes unfilled" is an acceptable, expected outcome.** If Crew + Fill List doesn't produce enough players, that's fine — it keeps the system from pressuring Hosts toward wider reach than the community norm supports, and matches how this already works informally (frantic texting that doesn't pan out is normal, not a failure).

**Content inherits the same boundary.** Any results page, photo gallery, or scorecard generated from a Gathering is visible only to that Gathering's Crew ∪ Fill List participants by default (Use Case D — GLS). Making content public afterward, if ever wanted, is a separate explicit action — not a side effect of the event happening. (Mechanics of that "publish" action are out of scope for v1 — see §10.)

---

---

## 5. Host-initiated onboarding (new Crew members)

Surfaced late in planning, resolved in detail. A Host building a Crew will routinely want to add someone who isn't a BF member yet (Use Case A/C territory — "need a 4th," pickup games). This section defines how that works.

**Decision: a stub is a real Membership record, not a separate identity layer.** Earlier discussion floated a D1-only "guest table" with a later graduation path; rejected. Membership's actual field list is lean (First/Last/Nick Name, Cell, Email, Member Date, `bfw`, `active`, `pushId` — confirmed, no deeper profile exists today), so creating a minimal real Membership record costs little and avoids ever needing a separate identity system or a migration between two player concepts later. Once personalized, this person is a normal BF member — scoring, HCP, everything downstream already works, because nothing about them is special-cased.

**Flow:**
1. **Host adds a name not on the list.** Crew-builder picker → "Add new" → Host enters Name + Cell. Cell is required — it's both the de-dup anchor and the only channel available to reach someone with no PWA presence yet.
2. **De-dup runs before creation.** Cell is the strong match key, checked against *all* Membership records regardless of status (not just Active) — this is what catches the cross-Host case, e.g. Host A stubs "Jane" one week, Host B tries to invite a "Jane" with the same cell the next week. Name is a weak fallback only. A likely match surfaces to the Host for confirmation rather than silently merging or silently duplicating — a wrong auto-merge is worse than asking.
3. **New status value: `Pending`** (not `InActive`). Reusing `InActive` risks getting swept into the existing Active/InActive auto-reset backlog item, which wasn't written with "never-yet-real person" in mind. `Pending` sidesteps that, and naturally falls outside the existing notification filter (`bfw=Yes` + `active=Active` + `pushId` present) with zero changes to that logic.
4. **Pending entries stay out of the standard "Who are you?" picker** — confirmed against the live picker (screenshot), which already has a precedent for collapsing a status bucket out of the default view ("Show inactive players (41) ›"). Pending follows the same pattern: never in the visible, tappable list (a stranger self-selecting their own name from a list is a misclick-onto-someone-else's-identity risk, not just clutter), available in a similar named, collapsed bucket if a Host wants to glance at who's pending. Claiming never happens through the picker — only through the claim link (next).
5. **Claim link, not self-selection.** A short code in Worker KV (`invite:{code}` → the stub's Jotform submission ID) resolves to a new, minimal portal landing route with a pre-filled "confirm your info" screen. The person confirms name/cell, explicitly grants `bfw` consent (cannot be set by the Host on their behalf — this is a real consent boundary, not a UX nicety), and grants push permission. That write flips `Pending → Active` and writes `pushId`.
6. **First-contact delivery is manual for MLP, deliberately.** No SMS-sending infrastructure exists in the stack (OneSignal needs a `pushId` that doesn't exist yet for a Pending stub — chicken-and-egg), so getting the link to the new person is the Host texting/calling directly, or the new person calling the Commissioner if they're stuck on PWA install. Fine at ~30-player scale; automated delivery is a deferred idea, not an MLP requirement.

**Second entry point needs the same de-dup, or this doesn't hold.** The portal already has a generic self-serve path — *"📐 Not on the list? Join BirdieFriends"* — independent of anything built here (confirmed via live screenshot). A new person who finds the portal organically, rather than through a Host's claim link, must run through the same Cell-based de-dup check before a record is created — otherwise they fork a second, disconnected record instead of claiming the Host's stub, and the whole de-dup design in step 2 doesn't actually prevent duplicates. This is existing-code retrofit work, not new-code work, but it's required for this design to hold.

**Security note, consistent with §13:** stub creation and the claim-link confirmation are both writes into the live Membership roster — a meaningfully bigger trust boundary than anything else a Host does (everything else in MLP is scoped to the Host's own Gatherings; this reaches shared, platform-wide data). Both should route through a dedicated Worker endpoint, not a client-side Jotform write — same discipline already established for `/deploy`, scoped narrowly to just this one new path rather than waiting on the broader `JOTFORM_API_KEY` backlog item to be resolved first.

**Flagged, not resolved — picker narrowing at scale.** The "Who are you?" picker deliberately shows only Active members today, narrowing the selection domain — a real, deliberate design choice, not an oversight. It's valuable in places like live-action overseer flows (Birdie Alert/CttP, where someone's acting on behalf of players under time pressure and a short, accurate list matters most). Adding `Pending` as a third bucket doesn't break this, since Pending stays hidden by the same mechanism — but as the roster grows (more Pending stubs, more Hosts, eventually multi-club per §12) the active/inactive/pending narrowing logic will need real attention rather than continuing to work by accident. Not an MLP blocker; flagged for a future UX/data session.

---

## 6. Roles and tiering

Hosting is **open, not gated** — any player can create a Gathering. To preserve community quality without adding upfront friction, every player who creates their first Gathering is silently moved into a monitored tier:

- New field on the player record: `tier` — default `member`
- On first Gathering creation, `tier` flips to `host` — **silent, no UI change, no announcement**
- Purpose: gives commish tooling a hook to watch for deviant behavior (spam gatherings, abuse of broadcast) without restricting anyone upfront
- Long-term: this tier is also the natural seam for a future commercial conversion (paid Host tier), per the BizPlan track — not built now, just not architected against

---

## 7. Capability matrix

| Capability | Commissioner | Host |
|---|---|---|
| Create event | Any (Series Event) | Own Gatherings only |
| Delete/cancel | Any | Own only |
| Scope (size, venue, time) | Any | Own only |
| Communicate | All players | Crew, plus Fill List if opted in for that Gathering — never wider. See §4. |
| Score | Full GS | **Out of scope v1** — see §10 |
| Payout | — | **Out of scope v1** — see §10 |

---

## 8. Storage architecture — decided

Gatherings, Crews, and Gathering registrations will be built on **Cloudflare D1** (SQLite, natively bound to the Worker — no new vendor, no new domain to allowlist). This replaces the earlier KV-vs-Jotform framing.

**Why not KV:** KV is exact-key lookup only, no query layer. "Show me my gatherings sorted by registration volume" — a real, near-term need — isn't expressible in KV; it would force fetching every record and sorting in Worker JS by hand, a pattern that gets worse with every new "X by Y" feature. D1 makes this a SQL query (`JOIN` + `GROUP BY`) instead of bespoke application logic.

**Why not migrate the 4 existing Jotform forms too:** considered and explicitly declined for now.
- The Ops Guide already scoped a full Jotform departure as its own major-version trigger (v4.0), separate from feature work, because of blast radius — Membership/CttP/Series Scorecard/Event Registration are load-bearing for a live platform with real players mid-season.
- Real, ongoing value in keeping Jotform for the existing 4: a hosted, no-code UI to view or hand-edit a submission when something's wrong. D1 only gives a SQL console — any equivalent "click into this record and fix it" surface would have to be built.
- Gatherings is net-new data with zero migration risk, making it the lowest-risk place to prove D1 works before touching anything live.

**Net effect — this is additive, not a replacement:** Jotform keeps doing what it does today (Membership, CttP, Series Scorecard, Event Registration). KV keeps doing what it does today (flags, feed). D1 is a new, third store, scoped to Gatherings/Crews/registrations only.

**Parked for later:** migrating the 4 existing Jotform forms onto D1 (completing the v4.0 shift) is now a validated, lower-risk path rather than a leap — but still deliberately deferred. Candidate trigger: a winter offseason project, or a commercialization push that demands it. Not Dev-42, not assumed into any near-term session.

---

## 9. Data model (draft)

**What `player_id` actually is, everywhere it appears below:** every `player_id`/`host_id`/`excluded_player_id`/`muted_host_id` column in this section is the player's **Jotform Membership submission ID** — D1 has no native player table of its own (§5 resolved this; no separate identity layer, no D1-side `players` table). D1 can't enforce this as a real foreign key across systems, so the Worker is responsible for validity at write time. This also means a brand-new Crew member (§5's `Pending` stub) gets a real `player_id` the moment the stub is created — D1 references work identically for Pending and Active players, no special-casing needed in any table below.

**`gatherings`**
| Column | Notes |
|---|---|
| `id` | PK |
| `host_id` | FK → player |
| `title` | |
| `venue`, `event_time`, `size` | capacity |
| `crew_id` | FK → crews — the named list for this Gathering |
| `fill_list_enabled` | bool — Host's per-Gathering choice to extend reach into the Fill List (§4) |
| `status` | active / cancelled |

No `recurrence` field. Every Gathering is one date, one tee-time-group action — same as how tee time reservations actually work today (§11, Q3 resolved). "Recurring" isn't a data-model property; continuity (Charlie's Tuesday league) comes entirely from reusing a saved Crew to create a new Gathering quickly each time, not from a repeat rule on a single row.

No `visibility` field — there is no public/private toggle. Reach is always computed (§4), never stored as a single enum.

**`crews`**
| Column | Notes |
|---|---|
| `id` | PK |
| `host_id` | FK → player, owner |
| `name` | null if ad hoc/unsaved, set if saved for reuse |

**`crew_members`** (junction table)
| Column | Notes |
|---|---|
| `crew_id` | FK → crews |
| `player_id` | FK → player |

**`fill_list_members`** — domain-wide, player-controlled opt-in
| Column | Notes |
|---|---|
| `player_id` | FK → player |
| `opted_in_at` | timestamp |
| `available_days` | CSV/bitmask of weekdays, e.g. "Wed,Sat" — coarse v1 availability signal (§4) |

**`host_exclusions`** — Host-level, persistent, silent (§4)
| Column | Notes |
|---|---|
| `host_id` | FK → player |
| `excluded_player_id` | FK → player |

**`player_host_mutes`** — Player-level, persistent, silent — mirror of `host_exclusions` (§4)
| Column | Notes |
|---|---|
| `player_id` | FK → player, the one doing the muting |
| `muted_host_id` | FK → player, the Host being muted |

**`registrations`**
| Column | Notes |
|---|---|
| `id` | PK |
| `gathering_id` | FK → gatherings |
| `player_id` | FK → player |
| `status` | `yes` / `no` / `sub` — reusing the existing Event Registration vocabulary (§11 Q13), not a new state set |
| `registered_at` | timestamp |

**Player record addition** (still lives wherever the player record lives today — Membership/Jotform, not D1)
- `tier` — `member` | `host` (see §6)
- `active` — gains a third value, `Pending` (§5), alongside the existing `Active`/`InActive`

**Worker KV — claim-link shortcode (§5)**
| Key pattern | Value | Notes |
|---|---|---|
| `invite:{shortcode}` | Jotform Membership submission ID | Short, textable code resolving to a Pending stub. Same KV namespace as existing flags/feed — not a new store. |

Note: `crew_members` as a junction table (rather than a `playerIds[]` array) was a deliberate choice once D1 was selected — explicit list per Crew, not tag-based self-service membership (decided in §3/§9: a Host curates their own list rather than players opting themselves in). `fill_list_members` is the one deliberate exception — it's tag-based by design, because Fill List membership is the player's own choice, not the Host's.

---

## 10. Explicitly out of scope for v1

- Scoring (GS integration) — Charlie's first use case is registration-only
- Payout handling
- True multi-tenant SaaS (separate orgs, isolated data, new backend) — BizPlan-track concern, not this spec
- Tag-based/self-service Crew membership (players opting themselves into a group) — decided against; Crews are Host-curated lists
- Migrating the 4 existing Jotform forms (Membership, CttP, Series Scorecard, Event Registration) to D1 — deliberately parked, see §8. Candidate trigger: winter offseason project, or commercialization push.
- Any public/Discover browsing surface — architecturally rejected, not deferred. See §4.
- "Publish" action for making private Gathering content (results/photos) public after the fact — concept named in §4, mechanics not designed.

---

## 11. Open questions (next planning pass)

1. ~~Where does Gathering/Crew data live?~~ **Resolved — Cloudflare D1.** See §8.
2. ~~MVP feature list~~ **Resolved — renamed MLP (Minimum Lovable Product) per Brian's preferred framing.** Scope:
   - **In MLP:** Create Gathering (title, venue, date/time, size, Crew), Cancel Gathering, Notify Crew on create/cancel, Register/unregister via required Yes/No/Sub response (Crew members only — see §11 Q13, re-exposing existing Event Registration vocabulary, mandatory rather than optional for Crew outreach), saved/reusable Crews (confirmed — without this, Charlie re-picks the same names every Tuesday, which fails the "lovable" bar)
   - **Post-MLP:** Fill List + availability (§4), Exclusion List + Mute List (§4), Host tiering (§6 — cheap to include early if convenient, not required to ship), "duplicate my last Gathering" shortcut (§3 footnote)
   - Note: MLP can ship with Crew-only reach (no Fill List), since Crew ∪ Fill List − Exclusions − Mutes degrades gracefully to just Crew when Fill List doesn't exist yet — no contradiction with §4's no-public-broadcast rule.
3. ~~Recurrence mechanics~~ **Resolved — no recurrence engine.** Every Gathering is one date (matches how tee time reservations actually work). Continuity comes from Crew reuse, not a repeat rule. New, smaller question: should creating a new Gathering offer a "duplicate my last one" shortcut (pre-fill venue/time/size/Crew from a prior Gathering) as a pure UX convenience? Post-MLP per Q2.
4. ~~Event card / Schedule rendering~~ **Resolved — Worker-side, D1 query.** Gatherings slot into the existing My Events flow (swipe, register, calendar-add all stay as-is) — but the Worker endpoint behind My Events needs a Crew-membership join (`gatherings` → `crew_members` filtered by viewer) added, so a player only ever receives Gatherings they're actually in. Filtering client-side was rejected — it would mean Crew data for Gatherings a player *isn't* in still crosses the wire, undercutting the privacy model in §4. This is the concrete case D1 was chosen for in §8.
5. **Communication mechanics** — confirm Host pings to Crew reuse the same `osSendToPlayers` recipient-filtering work already flagged in the backlog (notification domain by type), rather than a parallel send path. MLP scope: Crew only.
6. **Which event tier does v1 cover?** Since Gatherings can in principle resemble anything from a casual one-off to a Production-tier series, v1 almost certainly can't guardrail all of them at once. Likely starting point: casual one-off + standing/registration-only (Use Cases A and B), deferring Production-tier self-service (full GS scoring/standings) — but this should be made explicit rather than assumed.
7. **D1 setup mechanics** — binding a new D1 database to the Worker, schema migration tooling/process, and whether `bf_deploy.py`/the deploy panel need new capability to manage D1 schema changes alongside the existing file-deploy flow. MLP only needs `gatherings`, `crews`, `crew_members`, `registrations` — the other 3 tables can be added in a later migration when their features ship.
8. **[Post-MLP] Fill List opt-in UI** — where/how does a player join the Fill List? Likely a simple profile-level toggle, not Gathering-specific, but needs a home in the portal (My Gatherings tab? Profile/settings?).
9. **[Post-MLP] Exclusion List UI** — how does a Host build/edit theirs? Reuse the existing slide-up player picker sheet (same pattern as Crew management) is the obvious candidate.
10. **[Post-MLP] Mute List UI** — player-facing mirror of the Exclusion List UI above: where does a player mute a specific Host? Likely lives in My Gatherings or Profile, needs a way to find/search Hosts to mute (probably search-by-name rather than a picker, since the player isn't selecting from a list they already manage).
11. **[Post-MLP] Availability granularity** — v1 lands on day-of-week only (§4). Worth a future pass on whether that's enough or whether time-of-day / explicit recurring patterns (e.g. "available Tuesday evenings only") are needed once real usage shows the day-level signal is too coarse.
12. **[Post-MLP] Fill List scale/fairness** — once there are many Hosts pinging the same Fill List, does a player get flooded by everyone's open-spot requests, even after availability filtering and mutes? May need its own rate consideration once Hosting is in real use — not a v1 blocker, but worth watching.
13. ~~"No" response~~ **Resolved — swipe IS the No action for Gatherings.** Yes/No/Sub already exist in the Event Registration Jotform field; No was hidden in the UI specifically because the old single-table Jotform model made a raw, never-registered "No" clutter the same view used to see who's actually coming — the established convention was to only ever show a No that followed a Yes (i.e. unregister), never a cold decline. D1 removes that constraint: "who's registered" becomes a simple `WHERE status = 'yes'` filter (§9), so storing every response — including a cold No that never passed through Yes — doesn't pollute anything. For Gatherings, swiping a Crew-invited card sets `registrations.status = 'no'`, whether or not the player had previously said Yes; this satisfies the "Crew outreach requires an answer" rule without a separate interaction. Series Event swipe behavior (silent personal hide, `bf_hidden_events_{player}`) is unaffected — this is Gathering-specific.

---

## 12. Multi-club dimension — resolved (deferred)

**Decision:** v1 carries no club concept at all. No `club_id`, no club table, no eligibility filtering. `venue` stays a plain text field. Fulfillment — whether a given player is appropriate to invite to a given venue (a guest at Moselem vs. anyone at BSGC) — is entirely the Host's manual judgment, not a system concern. BF doesn't model or enforce club policy in v1.

**Why this is fine, not a shortcut:** the Crew and Exclusion mechanisms already put the Host in full control of who gets invited — nothing about the existing model assumes or requires club-blindness to be safe. The Host already knows their own club's norms; the system doesn't need to know them too. Fill List availability/eligibility could theoretically become a problem cross-club (§4's original concern), but that only matters once Fill List usage at a private/member-guest venue is actually happening — not a v1 reality.

**Why this is explicitly deferred, not closed:** the real complexity here isn't "add a club field" — it's what happens if BF's reach grows past its current regional footprint. That's a materially bigger problem than this spec, and it's the same one already named in the Ops Guide as the v4.0 trigger (true multi-tenant, off Jotform). National/worldwide BF reach is a different order of magnitude than today's regional, single-club-cluster reality — multi-club and multi-tenant become the same conversation at that scale, not two separate ones. Revisit only if/when BF's community footprint actually expands beyond its current regional reach — not a near-term planning item.

**Status:** Resolved for v1 purposes. Not blocking anything in §11.

---

## 13. Flagged — operational fix scaling & Claude's role as proxy

Surfaced in discussion, not designed yet. Capturing so it's not lost.

**The gap:** unlike Jotform, D1 has no hosted record-editing UI (§8's tradeoff). Without it, "fix this player's registration" or "this Crew got corrupted" becomes a dev-session prompt to Claude rather than something Brian clicks into and resolves himself. At MLP's expected scale (a handful of Hosts) this is fine — possibly faster than a form UI. It stops being fine if Hosting volume grows the way Use Case C suggests it might: "ping Claude to fix it" turns into a queue, not a tool. Same shape of concern as §11 Q12 (Fill List noise scaling), one layer down in operations rather than UX.

**Two mitigations already available, not yet decided between:**
- Cloudflare's D1 dashboard has its own SQL console — a genuine self-serve fallback that doesn't route through Claude at all, just less friendly than Jotform's record UI.
- A future PIN-gated admin route on the Worker (same discipline already established for `/deploy` in Dev-39–41) for common fix patterns, rather than ad hoc one-off requests each time.

**Credential discipline carries forward from Dev-39–41.** Those sessions were hard but established the right architecture: Claude should not hold or use raw D1 credentials directly. Any "Claude fixes production data" pattern that becomes routine needs to go through a PIN-gated Worker route, the same as `/deploy` — not a standing exception to that discipline, however convenient it'd be in the moment.

**Brian's broader vision, named here for continuity:** proxy use cases where the community makes a request, and pieces of fulfilling it are handled by Claude under the covers — safely and ethically, within Claude's actual operating parameters, invisible to the requester. This spec's Gatherings work (Host self-service, guardrails instead of dev sessions) is a step toward that, but the proxy/agent pattern itself is a distinct, larger idea worth its own design conversation — not something to back into via ad hoc data-fix requests.

**Status:** Not blocking MLP. Worth a dedicated planning session once Host volume or the proxy concept itself is ready to be designed deliberately, rather than discovered under pressure during a live fix.

---

## 15. Addendum (Dev-43) — Gathering Panel is Host-only; Crew members use existing views

Clarified during D1/API planning, correcting an assumption made earlier in this session:
the Live-Panel-style pop-out (anchored off "+ New Gathering" / My Gatherings) is **Host
management surface only** — create, view responses, cancel. It is not shown to Crew
members at all.

**Crew members never see a new screen.** A Gathering they're invited to appears as a card
in the **existing** My Events, Parked, and Calendar views — identical mechanics to a
Series Event card, including swipe-as-No (§11 Q13). No new UI to learn on the invitee
side; the only new surface in the whole spec is the Host's own management panel.

**Implication for §3/§7 build-out:** the work isn't "build a Gathering view for Crew
members" — it's "extend My Events/Parked/Calendar's existing card-rendering logic to
also pull from `GET /gatherings?player_id=X` (Dev-43 API, see below) and render a
Gathering card the same way it renders a Series Event card, backed by `registrations`
instead of the Jotform Event Registration form." Smaller lift than initially framed;
no parallel UI system needed.

---

## 16. Worker API — D1-backed routes (Dev-43)

Implemented and deployed (`worker.js`, commit `de6c4ee757de5e69e83e7dd2f739fe380c4895ae`).
No PIN — hosting is open per §6; trust model matches existing Jotform client writes.

| Route | Purpose |
|---|---|
| `POST /gatherings` | Create a Gathering |
| `POST /gatherings/:id/cancel` | Cancel — host-only, verified server-side against `host_id` |
| `GET /gatherings?player_id=X` | Gatherings visible to a player — hosted by them + any they're a Crew member of. `status='active'` only — cancelled rows excluded, matching "past ones quietly disappear." This is the query both the Host Panel *and* My Events/Parked/Calendar (§15) consume. |
| `POST /crews` | Create a Crew (saved or ad hoc) + members, one call |
| `GET /crews?host_id=X` | A host's saved (named) Crews |
| `POST /registrations` | Upsert a player's yes/no/sub response — re-registering updates, not duplicates (`UNIQUE(gathering_id, player_id)`) |
| `GET /gatherings/:id/registrations` | Host's view of who's responded |
| `POST /gatherings/purge-test` | **(Dev-44)** True `DELETE` of a host's test Gatherings + their Crews, crew_members, and registrations — matched by title prefix (default `"TEST — "`). **PIN-gated**, unlike the routes above — deletion is destructive, so it carries the same discipline as `/deploy`/`/rollback` rather than the open-trust model the rest of this section uses. Deletes child rows before parents to satisfy D1's enforced foreign keys; a Crew is only deleted if no remaining Gathering still references it. |

Schema reference: `source/specs/BF_Gatherings_Schema.sql`. Tables: `gatherings`,
`crews`, `crew_members`, `registrations` (MLP scope only, per §11 Q7).

---

## 17. Portal UI — Crew-member side (Dev-44)

§15's build-out implemented: `eventData`/`regData` (the existing globals driving
Home/Parked/Schedule and the capacity engine) merge in Gatherings via `loadGatherings()`,
normalized to the same shape Jotform events use (`source:'gathering'` flag added for
branching). Capacity, register/unregister, and swipe each got a Gathering-specific
branch where Series-Event logic didn't apply (48hr-lock/fivesome skipped; swipe writes
`status:'no'` to D1 per §11 Q13 instead of/in addition to the local park).

**Schedule needed no extra code.** It was already generic over the shared arrays with
no Jotform-specific logic — Gatherings a player's registered for appear there for free.
The "Calendar/Schedule wiring" item implied by §15's "My Events/Parked/Calendar" phrasing
turned out to already be covered.

**Badge label:** "Gathering" → **"Host Gathering"** (Brian's call) — reads more clearly
as host-run rather than BF-run to the community.

**Admin test harness** (not part of MLP scope, but needed to test safely against live
D1): Dev Controls → Create/Delete Test Gathering. Isolation is Crew = [commissioner
only] — the same visibility filter real Gatherings use, so test data never reaches a
real player without needing a separate test/prod flag. Cleanup is a true delete (see
§16's `/gatherings/purge-test`), not a soft cancel — test runs leave zero residue.

**Not built this session:** the Host Management panel (the other half of §15/§3 —
create/view-responses/cancel UI for Hosts, Live-Panel-style). Brian hosts test
Gatherings via the admin test button for now, not a real Host UI.

---

## 14. Carry-forward

Storage (D1), the reach model (§4 funnel), Host-initiated onboarding (§5 — stub creation, de-dup, claim link, Pending status), the multi-club question (§12, deferred), MLP scope (§11 Q2), the rendering/query approach (§11 Q4), and the swipe/No interaction (§11 Q13) are all settled and built per §16/§17. Remaining for MLP completion:
- **Host Management panel** (§15/§3) — create/view-responses/cancel UI for Hosts. Crew-member rendering is done (§17); this is the only piece left before Gatherings is usable end-to-end by a real Host rather than via the admin test button.
- **#2 — Crew onboarding** (§5) — stub Membership creation, cell-based de-dup, `Pending` status, claim-link via KV. Flagged as the most security-sensitive piece in the whole spec (writes into the live, shared Membership roster); warrants its own dedicated session rather than a tail-end add-on.

§13 (operational fix scaling / Claude-as-proxy) and §5's picker-narrowing-at-scale note remain flagged for future sessions, neither blocking MLP.
