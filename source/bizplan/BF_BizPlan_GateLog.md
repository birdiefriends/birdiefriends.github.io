# BirdieFriends — Business Plan Gate Log
*Tracks the six-gate viability framework · Update at the end of every session*
*Last updated: Session BP-5 · July 6, 2026*

---

## Framework Reminder

Each gate answers a viability question before the plan moves on. If a gate fails, the model pivots — not just the wording. Gates can be revisited; later gates often reshape earlier ones (Gate 4 economics typically forces Gate 2 revisions).

| Gate | Question | Status |
|------|----------|--------|
| 1. Problem/Market Fit | Is there a real, underserved problem worth solving commercially? | 🟢 Closed (pricing number settled BP-3) |
| 2. Product/Model Fit | Does the model (or blend) cohere as something worth building? Timeline to build is not yet a constraint — see note below. | 🟡 In progress |
| 3. Competitive & Moat | Why BF, why now, what's defensible? | 🟢 Directionally answered |
| 4. Unit Economics | Can this make money at a unit level? | 🟡 Napkin done, needs rigor |
| 5. Go-to-Market | How do you get the first paying customers in 6 months? | 🟡 In progress — two-phase BF-E/BF-C sequence identified |
| 6. Launch Plan & Milestones | What does launch-ready actually require? | ⚪ Not started |

Legend: ⚪ Not started · 🟡 In progress · 🟢 Closed/settled · 🔴 Blocked

**Note on Gate 2's original "6–12 months" framing (corrected BP-2):** The original Gate 2 question's timeline constraint was identified by the founder as a reflexive answer to a survey question — an emotional avoidance of an open-ended multi-year process, not a deliberate planning constraint. Founder is not yet invested in any timeline; this remains a feasibility and planning exercise. The framework question has been softened accordingly. **The actual staged process the founder expects this plan to follow:** (1) reach an intellectual conclusion on whether there's something worthy here at all; (2) if yes, identify possible paths to making it real; (3) only then do the actual commitment questions need answering; (4) at that point, risk-profile debate becomes the live, "interesting" conversation. Gates should not force-skip ahead to (3) or (4) before (1) and (2) are genuinely settled.

---

## Gate 1 — Problem/Market Fit

**Status: 🟢 Closed — pricing number, billing mechanics still pending below (see Open), but no longer blocking gate closure**

### Settled
- **Naming note (BP-3): "Organizer" → "Host."** The app now calls this role **Host** — this plan's terminology is updated to match. No conceptual change; same role, same function, same economics. (Wrangler/Connector remains a distinct, separate role — see Gate 2 segmentation.)
- **Customer:** The Host leads. Participants are the enrollment pipeline. Ambassadors are an optional distribution accelerant, not a dependency.
- **Anchor use case:** GLS-style private event/gathering, not the day-to-day subscription. Subscription is a future Layer 3, fed organically by event enrollment — founder has low confidence golfers will pay recurring fees directly.
- **Domain scope:** Golf-first, with an explicit master plan to diversify into other group-organizing use cases (corporate meetups, charity events, reunions) over time. Architecture should stay domain-flexible without requiring a rebuild.
- **Gathering spectrum identified:** Serious golf groups (BF Series) vs. social/mixed-skill trips (GLS) vs. bucket-list trips vs. non-golfer-inclusive corporate/charity events are emotionally and economically distinct products sharing the same scoring infrastructure.
- **Core value prop:** Gathering design (recommendation engine) + memorialization (digital + physical), not scoring software. Scoring is commodity infrastructure.
- **Pricing approach (settled — not the pricing number):** Low per-unit price, made up in volume, repeatability, and paid add-ons — not a high-margin-per-transaction model. Consistent with thesis 8 (low overhead, no venture-scale requirement) but sharper: the business is designed to feel cheap per-touch so adoption friction stays near zero, with margin coming from frequency + upsells rather than sticker price. The specific number is now settled at $5 — see "Settled (added BP-3)" below.
- **Isolated golfer persona identified (customer discovery):** See Vision doc, "Customer Discovery Threads" — a real recruitment narrative where a lonely, skill-insecure golfer is socially wrangled into a group and from there introduced to a Money Group ($MG). Distinct from the GLS proof point; broadens Gate 1's customer understanding beyond "the Host" to include the participant who gets found and pulled in.
- **Scope boundary (settled): BF is explicitly not in the tee-time reservation business.** Every golf course already runs its own reservation system; BF has no intention of replacing or competing with those. The Host secures tee times outside BF as a normal part of how golf already works — not a friction point unique to BF (see Gate 2 and Cross-Gate Risks Register for the corrected framing and the future API/partnership investment path).
- **Photo workflow model resolved (BZP#3 continued / Dev-53, 2026-07-01) — self-service, staged, Host-owned curation. Not "automated base tier vs. manual premium tier."** That original framing was a false binary. The settled model: (1) **capture is self-service and metadata-light** — for community Gatherings, a designated capturer tags story context live; for BF-anything (Series, Cup, WallyCup), any registered player can capture via the existing Live Panel eligibility gate — no new metadata-recovery automation needed, because a human tags the moment at the point of capture. (2) **Curation (cut/no-cut) stays a deliberate manual step, but never the founder's for Gatherings** — the community Host (e.g. Chooch) owns it there. For BF-anything, Brian is the Host by his own framing, so it's his step — kept deliberately small, not eliminated. Full design in `BF_EventSite_Schema.md` §9f (general self-service system: Section Manager, BF Upload, Timeline/Scrapbook) and §9g (first, deliberately small proof case: BF Series/Cup capture-first pilot, candidate launch 7/19 or 8/16/2026). **WallyCup identified as the eventual flagship-scale target** — full GLS-equivalent treatment, minus commercial pieces for the first pass — timed alongside the GS production re-architecture this plan already knows is needed (see Gate 4 architecture note).

### Settled (added BP-3)
- **Pricing number: flat $5/player/round** as the launch hypothesis — not tiered, not group-size-adjusted at the base-fee level (tiering/packages remain a separate later upsell layer, see Capability Inventory Event Package Tiers). $3 understood as the durable floor (still profitable, still trivial to the player). $4 is a plausible blended average once promotional/intro pricing is layered in later — not a separate decision, just an expected effect of discounting around the $5 anchor.
- **Reframing logic (BP-3):** this is a feasibility exercise with modest, low-investment, low-volume break-even goals — not a margin-optimization exercise. At even trivial early volume (10 players/month ≈ $300–500/month gross at $3–5/player), revenue already covers current operating costs (~$400/mo) with some margin, before any Ambassador-driven growth, recommendation engine, or scale effects. This means Gate 1's pricing question is not "is this viable" (yes, trivially) but sets up Gate 4's real open question: what the cost curve looks like under growth, not at launch (see Gate 4).

### Open
- Photo workflow **build cost/effort** still not estimated — the model itself is now settled (see Settled above); the BF Series/Cup pilot (schema §9g) is explicitly designed to surface a real cost/effort number before any WallyCup-scale investment decision.
- Participant billing mechanics: Host-collected vs. participant-direct-billed at registration (leaning toward participant-direct to remove Host friction and fraud exposure — not finalized)

### Legal Note (Critical — Carries Forward to Gates 4 & 6)
Distinguishing social gambling (legal pot-splitting, no house cut) from commercial gambling (a business entity taking a percentage of wagered funds) is essential. Resolution: **BF's platform fee must be structurally decoupled from any prize pool**, charged for event services (design, scoring, portal, memorialization), never as a percentage of money wagered. "VIG" is abandoned as both internal and external terminology due to gambling connotation — replaced with "platform fee" or "event services fee." BF Pay (pot management) is explicitly Phase 2, gated on fintech/gaming legal review (est. $500–1,500 attorney consultation, not a major engagement) before any build begins.

---

## Gate 2 — Product/Model Fit

**Status: 🟡 In progress**

### Settled
- **Hybrid model confirmed:** Event services (Layer 1) + Ambassador network (Layer 2) + future subscription (Layer 3, not a launch dependency).
- **Franchise vs. MLM — resolved into a named, standalone framework (refined BP-3): the Ambassador Model.** Original decision: franchise-style (one-level residual, territory/community-based) explicitly preferred over multi-level MLM, due to legal/reputational risk of multi-level residuals. **BP-3 refinement:** rather than describing BF's structure as "franchise-like, not MLM-like," it's cleaner — and more accurate — to name it as its own thing: **the Ambassador Model**. It borrows useful mechanics from both predecessors (franchise's one-level-deep discipline, MLM's idea that recruiters can be rewarded for recruiting other recruiters) without being bound by either's reputation or rules. This isn't rebranding to dodge stigma — it's recognizing BF is building a model that doesn't map cleanly onto either existing category, so it shouldn't be defined in opposition to one of them. **The actual discipline that mattered — one level deep, no multi-level residual stacking — carries forward unchanged** (see the new Ambassador-recruits-Ambassador stress-test item below); what changes is only the label and the framing, not the underlying constraint. Future plan language should default to "the Ambassador Model," reserving "franchise" and "MLM" only as reference points when explaining the concept to someone new, not as BF's self-description.
- **Ambassador reframe:** Not "entrepreneur," not "operator" — **Ambassador**. Community advocates who already love BF and get paid to share it, not a required sales channel. This changes recruiting psychology significantly (easier ask — "you'd recommend this anyway") and removes franchise-fee-upfront friction tested earlier in the conversation.
- **Lifetime attribution, not residual:** Ambassador compensation reframed from "residual" (which implies ongoing service/royalty) to **lifetime attribution credit** — a player is permanently tagged to the Ambassador who originated their enrollment, and future transactions by that player can trigger a payout to that Ambassador. Founder principle: "do the work once, get paid a lot, build your own ATM." Treated as a deliberate scaling and moat-building mechanism, not just a compensation nicety. **Mechanic and liability question resolved BP-3** — see the dedicated "Ambassador commission structure" bullet below for the settled two-piece structure (one-time origination + activity-gated recurring override).
- **BF Rewards confirmed as core**, not Phase 2 — physical/digital achievement recognition (CttP coins, skins medallions, season trophies) validated by the Garrett's Last Swing hat as an organic, pre-commercial proof point.
- **Network effect identified:** Ambassador-anchored communities create a future cross-community/cross-region competition layer — a real network effect moat that compounds as the Ambassador network grows. Not a launch requirement, but an important long-term differentiator to capture in the plan now.
- **Buyer segmentation framework — illustrative archetypes for planning, not a taxonomy imposed on users.** Per Vision Thesis 9, BF does not sort or require users into these categories; people arrive at roles for reasons (duty, accident, opportunity, necessity) the platform doesn't need to know. Two axes — population segments and cross-cutting roles:

  **Population segments**

  | Segment | Description | Primary value sought | Economic shape |
  |---|---|---|---|
  | Hosts (general) | Anyone responsible for herding a group — one-off corporate outing, charity scramble, reunion | Logistics relief | Free hook entry point; converts to paid via repeat use + add-ons |
  | Trip Groups | Occasion-driven gatherings — bachelor weekends, milestone trips, bucket-list golf (GLS-style) | Memorialization, emotional stakes | Premium tier upsell candidates, highest WTP per event |
  | League Players/Hosts | Recurring season groups (BF Series-style) | Structure, handicap tracking, repeatability | Steady recurring low-per-touch fee, volume base |

  **Cross-cutting roles** (can occur inside any population segment above; one person may hold several over time, or hold a role for reasons unrelated to the population they're in)

  | Role | Function | Compensation/value mechanism |
  |---|---|---|
  | Wrangler/Connector | Social organizer who notices someone isolated and pulls them into a group; distinct from Host's logistics-administrative function even though often the same person | Not directly monetized as a role — often *is* the Host, sometimes an informal node inside an existing League/Trip |
  | Money Group ($MG) | Runs stakes/pot, manually or via GS | Highest fee tolerance per round (fee is a rounding error against the pot); primary future BF Pay buyer |
  | Ambassador | Distribution/community role | Origination commission + lifetime attribution payout |

  Money Group was tested as a possible standalone population segment and rejected — it's a role that shows up inside Trips and League groups, not a separate population. Ambassador is likewise a role, not a population, drawn from any of the segments above.
- **Multiple entry vectors exist, not a single funnel:** Free Host tooling ("Schedule an Event"), direct-to-player marketing (Trips/SEO/app stores), and Ambassador-led community capture are three distinct, non-exclusive on-ramps — not stages of one funnel. Once anyone enters via any vector, the full capability set (memorialization, league structure, Ambassador economics, Trips) becomes organically exposed to them; that cross-exposure between vectors, not the entry vector itself, is the primary stickiness mechanism (e.g., an Ambassador-built league community gets exposed to Trips once players see BF's broader capability; a Trips-acquired group can convert into an ongoing league or spin off its own Ambassador). **Which vector(s) to prioritize and fund is a Gate 5 (Go-to-Market) decision, not a Gate 2 model decision** — Gate 2's job is only to confirm the architecture supports all three without conflict, which it does.
- **BF Pay legal review sequencing settled: gated on an explicit commercialization commitment, not on cost, time, or event volume.** Founder remains genuinely undecided whether to commercialize BF at all — platform development continues regardless, for personal/community use, as an intentional disconnect from the commercialization question. The legal review's low napkin cost ($500–1,500, see Gate 4) does not make it a trivial early step, because what it actually purchases isn't just legal clarity — it's a signal that the founder has decided to proceed commercially, which hasn't happened. **The business plan refinement process itself is the mechanism that will surface that decision** — as the plan matures and gates close, it will tell the founder much about how, or whether, to commercialize at all. The trigger is "the plan reaches a point of founder confidence," not a date, cost threshold, or volume threshold. Worth keeping explicit in future sessions: this BZP track is not just documentation of a decision already made — it is part of how the decision gets made, and "finishing the plan" should not be treated as a foregone conclusion that commercialization is happening.
- **Ambassador commission structure superseded — Community Remit Share replaces per-player lifetime attribution (settled BP-4), scoped to BF-C specifically (see "Two Products, Two Business Models" in Vision).** The BP-3 mechanic (20% one-time origination + 5% activity-gated recurring override on individually-attributed players) hit a hard mathematical ceiling: a per-player residual can't clear a meaningful monthly income target no matter how high the % goes, because any single home-course community's attributable revenue pool is too small. Founder's target framing: **$1,000/month should be an attainable, real number for an active Ambassador** — enough to meaningfully offset a golf habit, not a token gesture. The fix is a bigger base, not a bigger %. **Important scoping correction, same session:** this entire mechanic applies to BF-Competitive (BF-C) — communities requiring an Ambassador to physically organize them, locally. BF-Experiences (BF-E) is a separate, self-service business that doesn't need this mechanic to function; Thesis 4's original accelerant framing applies to BF-E untouched. Treating Community Remit Share as BF-wide economics (rather than BF-C-specific) is what made the Ambassador-role shift feel bigger and more unsettled than it needed to.

  **New mechanic — Community Remit Share:** An Ambassador who seeds a community earns **50% of that community's total "remit"** — all BF-payable-service revenue the community generates, not just personally-originated players. **Remit components:**
  | Service | Trigger | Notes |
  |---|---|---|
  | Round/event platform fee ($5/player/round) | Per event | Core, existing |
  | Event package upsells (photo/archive/rewards tiers) | Per event | Existing, see Capability Inventory |
  | BF Rewards fulfillment margin | Per event/season | Margin only, not COGS |
  | BF Pay settlement fees | Per event | Phase 2, legal-gated |
  | Membership tiers (new, see below) | Recognized monthly | The predictability floor |

  **Origination kept, stacked on top:** the original 20% one-time commission on a newly originated player's first booking remains, as an instant per-player bonus layered on top of the ongoing remit share. Modeled impact is financially near-negligible ($4–12/month per community) but recruiting-narrative-positive — "instant bonus plus ongoing share" is a stronger pitch than either piece alone, for a rounding-error cost.

  **Membership tiers — replaces the earlier flat community dues idea (settled BP-4), narrow reopening of the subscription question (see Vision, "What This Is Not"):** golf-club-membership framing, not a SaaS subscription, structured as three independent, separately-billed products:
  | Tier | Price | Grants |
  |---|---|---|
  | BF Member | Free | Join any non-competitive Gathering or BF event |
  | Competitive Member | $2/player/month | Required for BF Series / scored competitive play |
  | Host | $1/player/month | Ability to host any event (Gathering or BF-anything) |
  | Experiences | $5/player/round | Paid separately by everyone, any tier, per round played — unchanged |

  Competitive and Host are **mutually exclusive, independently-billed products** — a member can hold neither, either, or both (e.g., someone hosting their own BF Series pays both $2 and $1). Each has its own dues ledger entry and recognition schedule; they are never combined into a single line item.

  **Host tier includes a trial: 2 free lifetime Host credits, then subscription required.** Anyone can host up to 2 events before needing the $1/month subscription — deliberately unmetered by time (lifetime, not an annual reset) so it functions as a genuine "does this person want to be a real Host" test, not a recurring freebie. This balances the growth thesis (frictionless trial lowers the barrier to attempting a Gathering, which grows community size) against the Host fee's role as a binary commitment signal (see founder's framing: "if there's not enough value or frequency, they're not a BF customer"). Modeled trade-off: a small, deliberately-accepted revenue/ops cost (occasional one-month subscribe-then-cancel) against a meaningfully larger upside from increased event volume — event remit dominates the total remit pool, so even a modest lift in monthly Gatherings from easier onboarding outweighs the delayed Host dues.

  Billed and recognized per the same **Path B mechanic** used for the earlier flat-dues design: annual charge ($24/yr Competitive, $12/yr Host), recognized 1/12 monthly, Ambassador commission paid only on recognized/consumed months — never clawed back on cancellation, by construction. Requires the same small new build item — a dues ledger with per-player, per-product monthly recognition schedule plus a lifetime Host-credit counter (D1 schema addition, not a major lift) — logged in Capability Inventory roadmap.

  **Key finding — cadence matters as much as % or base (carried to Gate 4):** modeling shows the $1,000/month target is only reachable from a single community when that community runs **near-weekly** (BF Series-style recurring cadence), not occasional Gatherings-style trips. An infrequent community can't get an Ambassador to a meaningful income at any commission rate, because the underlying revenue pool stays too thin regardless of share — this is a structural finding, not a negotiable parameter. Strategic implication: Ambassador coaching/recruiting materials should explicitly frame "seed a recurring BF Series-style community" as the success path, not "run occasional gatherings."

  **Philosophy, not just mechanics (see Vision Thesis 10):** the 50% share is a deliberate altruistic stance — share profit generously with the people doing community work, run BF itself on thinner margins, make it up on volume and growth. BF's own break-even bar stays low enough (see Gate 4) that this costs founder upside, not business viability.

### Open
- **Reframed (BP-3): not multi-tenant — proximity-aware discovery, within ONE BirdieFriends.** Earlier "multi-tenant" language conflated two different things: (a) a real engineering need — Gatherings (Dev-49–52) already proves self-service hosting works; the open problem is how discovery/relevance scopes by a player's home course plus occasional travel, Craigslist-style, within one shared platform — and (b) a separate, genuinely different *future business idea* — selling isolated, brandable platform instances to other operators (franchise-of-instances) — which is parked as a future idea, not core to this plan (see Vision, "What This Is Not"). This plan assumes ONE BirdieFriends: single platform, single brand, single Ambassador economics layer, no per-community data isolation. Proximity-aware discovery is still a dev-session scoping task, not a bizplan-session task — Gate 2's job is just to confirm the model doesn't require true multi-tenancy to work, which it doesn't.
- **Execution capacity, distinct from model soundness:** two real execution gaps identified — architecture/dev-at-scale and community sweat-equity catalyst (see Cross-Gate Risks Register). These test whether the model can actually be *built and seeded*, not whether it's conceptually worthy — a different failure mode than anything else logged in Gate 2 so far. Not yet resolved; explicitly separate from the founder's personal financial investment decisions, which remain his own.
- **New (BP-3): Ambassador Model recruiting-layer mechanism — Ambassadors onboarding Ambassadors — logged as a stress-test item, not settled.** Founder proposes extending the Ambassador Model with a one-level Ambassador-recruits-Ambassador mechanism on top of the existing player-attribution structure, while preserving the one-level-deep discipline carried forward from the original franchise-vs-MLM decision (see "Franchise vs. MLM" above — now folded into the Ambassador Model framing). General payout framework as discussed, four variables:
  - **x%** — Ambassador (A) onboards a new player, first booking. *(This is the existing 20% origination commission — see "Ambassador commission structure" above — now framed as the general case.)*
  - **y%** — that same player's repeat/future bookings, ongoing. *(This is the existing 5% activity-gated recurring override.)*
  - **z%** — A onboards a new Ambassador (A2). *New payout type — not yet defined as one-time vs. recurring/activity-gated.*
  - **w%** — A2's own originated players generate revenue; some share rolls up to A, one level only (A2's own future sub-recruits, if any, do not roll up further — preserves the no-multi-level-residual principle). *New — not yet defined whether w% is taken from A2's gross, from A2's own x%/y% earnings (margin-on-margin), or from BF's residual cut after A2 is paid.*

  **Explicitly not settled — open questions to stress-test before this becomes a real mechanic:** (1) whether z% mirrors x% (one-time finder's fee) or y% (recurring, activity-gated) in shape; (2) what w% is actually computed against; (3) whether this changes Gate 4's existing napkin math — **now a bigger question post-BP-4**, since the base it would compress is the new 50% community remit share + 20% stacked origination, not the old 20%/5%; a second layer here would compound against a much larger existing Ambassador take, so the margin-compression effect on BF needs fresh modeling, not a reuse of pre-BP-4 numbers; (4) whether the one-level-deep discipline (see "Franchise vs. MLM" / Ambassador Model above) actually holds up once z%/w% are modeled with real numbers, or whether it needs adjustment — naming the model doesn't pre-validate the math. Founder's framing: interesting enough to model, not yet validated as worth doing.
- **Tee-time reservation: not a funnel barrier, corrected from earlier framing.** Every future BF user will already interact with a golf club to launch a BF event — the same way the founder works with BSGC, and the same way Matt scheduled and launched GLS independently of BF, with BF simply capturing it afterward. This is a normal external reality, not friction unique to BF. The actual open item is a *future* automation/partnership feature (fee-based reservation-system APIs, or a partnership with a reservation company) — parked as a future feature decision, not a current gap. See Cross-Gate Risks Register for the same pattern applied to GHIN handicap access (~$6k/yr — an economic barrier now, possibly not at scale).

---

## Gate 3 — Competitive & Moat

**Status: 🟢 Directionally answered, can be revisited with formal competitive research**

### Settled
- Technology is explicitly NOT defensible — quick market research shows dozens of tools attacking the group-organizing problem (Golf Genius, GhinManager, TheGrint, etc. — named as reference points, not yet researched in depth).
- The moat is the **distribution model**, not the tech: Ambassador network + accumulated outcome data (recommendation engine improves with every event) + brand equity on physical artifacts + eventual cross-community network effects.
- Hypothesis explicitly revised: "every golf club would benefit from BF" → "every club has 2–3 motivated organizer-types (Ambassador candidates) who would benefit," reflecting human nature and club bureaucracy/slowness as a sales barrier.
- **Second independent real-world validation point (alongside the GLS hat):** Founder's own customer-discovery anecdote — GolfScorer's pot/game management formalizes, in software, exactly what a manual Money Group ($MG) was already doing by hand on paper. Two separate proof points now exist that BF replicates a function a skilled human was already performing manually: GLS (memorialization side — the hat) and $MG (stakes/pot side — GS). This is a stronger Gate 3 moat argument than tech novelty: BF isn't introducing a new behavior, it's productizing behavior that already exists and is already valued enough that people do it by hand.
- **Competitor spot-check confirms the moat thesis (BP-4):** quick market scan of named group-organizing tools — ParUp Golf, Squabbit, Golf GameBook, Golf Genius, Unknown Golf, 18Birdies — shows all of them competing purely on tech (scheduling, live scoring, leaderboards). None pair the product with a paid human distribution layer tied to community trust. This is consistent with, not just assumed by, Thesis 1 (tech is not the moat) — worth a fuller competitive teardown eventually, but the directional read holds.

### Open
- Formal competitive landscape research not yet done — named competitors need closer investigation (positioning, pricing, gaps)
- No formal moat-strength test against a well-funded copycat scenario

---

## Gate 4 — Unit Economics

**Status: 🟡 Napkin-level done, needs rigor before Gate 6**

### Settled (Napkin Math — Session BP-1)
- GLS reference point: 32 players/rounds over the weekend; players tossed $40/person into a single round's pot (CttP & skins) without hesitation — used as evidence $3–5/player/round platform fee is not perceived as expensive.
- Revenue per event at $5/player/rd: 16 players × 2 rounds = **$160/event gross**; at $3 = **$96/event gross**.
- After 20% Ambassador origination commission: BF keeps **$128/event** (at $5) or **$77/event** (at $3).
- Estimated commercial monthly fixed costs: ~$400/mo (~$4,800/yr) — upgraded Jotform, real hosting, payment processing, amortized legal/admin.
- **Break-even: ~38 events/year (~3/month) at $5 pricing; ~63 events/year (~5/month) at $3 pricing.** Achievable with a small handful of active Ambassadors — does not require scale.
- Current personal fixed costs already being carried by founder: Jotform (~$120–340/yr), domain/hosting (~$20–50/yr), Claude subscription (~$240/yr) — roughly $400–630/yr baseline today.

### Settled (Napkin Math — Session BP-4, Community Remit Share)
**Superseded framing:** the BP-1 math above priced Ambassador commission at 20% of gross, off round-fee revenue only. BP-4's Community Remit Share (see Gate 2) moves to 50% of a broader remit (round fee + package upsells + rewards margin + recognized dues). Recomputed:
- **BF's own margin at 50% share, per $160 round-fee event:** BF keeps $80/event (vs. $128/event at the old 20% rate). Break-even shifts to **~5 events/month per community**, or **~2 medium-sized communities running less frequently** — still trivially achievable at hobby scale; the altruistic 50% share costs founder upside, not business viability (see Vision Thesis 10).
- **Full remit per 16-player event** (round fee + 30% package-upsell adoption + 20% rewards-margin adoption): **$272/event**, ~70% more pool than round fee alone.
- **Membership tier dues recomputed (BP-4 refinement — tiered Free/Competitive/Host replaces the earlier flat $2/mo dues idea, see Gate 2):** using a mid-adoption assumption (60% of members Competitive, 10% also/only Host):

  | Community | Members | Competitive dues (60% × $2) | Host dues (10% × $1) | Total dues/mo |
  |---|---|---|---|---|
  | Medium | 60 | $72 | $6 | $78 |
  | Large | 100 | $120 | $10 | $130 |

- **Ambassador income by community size and cadence** (full remit incl. tiered membership dues at mid-adoption, 50% share):

  | Community | Cadence | Event remit/mo | + Dues | Total remit | Ambassador @50% |
  |---|---|---|---|---|---|
  | Medium | 3 events/mo | $816 | $78 | $894 | $447 |
  | Large | 5 events/mo (near-weekly) | $1,700 | $130 | $1,830 | **$915** |

  A single large, near-weekly community lands within rounding of the **$1,000/month target** — the founder's stated bar for "a real, helpful number that pays for a golf habit." Medium/infrequent communities don't get there alone at any share %, confirming the cadence finding logged in Gate 2. Adoption-rate sensitivity (conservative 40%/optimistic 80% Competitive uptake) moves the Large-community total by roughly ±$45/month — a secondary lever, not the primary one; cadence and community size still dominate.
- **Dues recognition mechanics (Path B) eliminate clawback risk:** both Competitive and Host dues are charged once annually but recognized 1/12 monthly; Ambassador is paid only on recognized months, so a mid-year cancellation never requires clawing back commission already paid. The 2 free lifetime Host credits mean a small number of trial Hosts generate event remit without any Host dues at all until they convert — an accepted, deliberately small trade-off for lower onboarding friction (see Gate 2).

### Open
- **New (BP-5): BirdieFriends Engine GTM-readiness gap now blocks a rigorous BF-E/BF-C cost split** — see Cross-Gate Risks Register. Laptop-only accessibility (showstopper), no recommendation-engine capability, and unhardened/unscaled architecture beyond Dev-55's D1 migration all have unscoped build costs; these need at least a rough effort estimate before Gate 4 can produce separate BF-E/BF-C unit-economics models rather than a single blended one.
- **Reframed (BP-3): the live question is the scaling cost curve, not base viability.** Napkin math above already shows the business clears its cost floor at trivial volume (10 players/month covers current ~$400/mo fixed costs with margin, before Ambassadors or scale). What's unmodeled is what happens to that margin as volume grows — Ambassador commission %, payment processing fees, support load, and eventual infra/multi-tenant hosting costs are all currently near-zero at hobby scale and will not stay that way. This is the actual Gate 4 rigor task going forward, not re-litigating whether $3-5/player is viable (settled, see Gate 1).
- Founder's own time has not been assigned a notional value — flagged as a common founder blind spot, not yet addressed
- **Lifetime attribution liability — superseded by Community Remit Share (BP-4), income-adequacy question now resolved directionally.** The old per-player 5% override question ("is it a large-enough incentive") is moot — that mechanic is replaced (see Gate 2, Vision Thesis 4a). New open items in its place: (1) the $936–$950/month figures above rest on assumed community sizes (60/100 members) and event cadence (3/5 per month) that haven't been validated against a real BF community roster — worth checking against actual community sizes once one or two pilot communities are running; (2) package-upsell (30%) and rewards-margin (20%) adoption rates are estimates, not observed — real BF Series/Gathering data should replace these once available; (3) **Ambassador-recruits-Ambassador stress test (z%/w%, see Gate 2) now compounds against the larger 50%+20% base**, not the old 20%/5% — needs fresh modeling before adoption, previous napkin math no longer applies.
- **New build dependency: dues ledger.** Community/season dues (Gate 2) require a monthly-recognition schedule per player — a small but real D1 schema addition, not yet scoped as a dev-session task. Should be logged as a Gate 6 launch-readiness item.
- No real model yet for Ambassador commission sustainability beyond napkin stage
- Photo ingestion automation cost not yet estimated (build cost, not just legal/ops cost). **Update (2026-07-01):** the model/architecture question is resolved (see Gate 1, Settled) — this line now tracks only the unestimated build-cost number, which the BF Series/Cup pilot (schema §9g) is designed to surface before any WallyCup-scale investment.
- BF Rewards unit economics floated only directionally (e.g., ~$15–25 landed cost on a CttP coin, sellable ~$35–50) — not rigorously modeled

---

## Gate 5 — Go-to-Market

**Status: 🟡 In progress (first substantive content, BP-4)**

### Settled
- **Two-phase sequence, following directly from the BF-E/BF-C business-model split (see Vision, "Two Products, Two Business Models"):**
  1. **Phase 1 — BF-E launch.** Self-service, lower barrier, broader market. Real risks here are marketing acceptance (getting golfers to actually purchase/adopt) and competitive replication (Thesis 1 already concedes the tech isn't defensible) — not organizing effort. Founder's read after a market spot-check (see Gate 3): pieces of BF-E exist elsewhere, the full historic-package/memorialization combination does not, yet.
  2. **Phase 2 — BF-C launch, funded and seeded by Phase 1.** BF-C requires an Ambassador to physically organize a community, club by club — founder's explicit framing: "even if the Dev was done, finding A's one club at a time is the problem to solve." Phase 1 doesn't just fund Phase 2, it **solves Phase 2's hardest input**: BF-E usage data becomes an Ambassador-candidate discovery mechanism. Who hosts repeatedly, who pulls the most people in, who keeps a group returning is directly observable — the same "natural wrangler" pattern already identified in the isolated-golfer customer discovery thread, surfaced organically instead of guessed at through cold recruiting. BF-C then recruits from a warm, self-revealed pool rather than pitching strangers cold.
- **Sharper moat framing that falls out of the sequencing:** the race isn't "launch BF-E before competitors copy the feature set" (Thesis 1 already concedes that's unwinnable) — it's "use BF-E's easy-to-copy runway to find and seed the hard-to-copy asset (Ambassador-glued BF-C communities) before anyone else gets there."

### Open
- BF-E marketing/acceptance strategy — not yet scoped (pricing is settled at Gate 1, the *purchase decision* itself — messaging, channels, conversion — is not)
- Concrete mechanism for surfacing Ambassador candidates from BF-E usage data — directionally identified, not yet designed (what behavior/threshold flags someone as a candidate, how they're approached)
- Timing/overlap between Phase 1 and Phase 2 — sequential, or does Phase 2 recruiting start before Phase 1 is fully mature?
- No launch-readiness checklist yet for either phase (that's Gate 6)

---

## Gate 6 — Launch Plan & Milestones

**Status: ⚪ Not started**

Needs Gates 1–5 substantially closed first. Will define the concrete 6–12 month roadmap.

---

## Cross-Gate Risks Register

| Risk | Affects Gates | Status |
|------|---------------|--------|
| Gambling/legal characterization of platform fee | 1, 4, 6 | Mitigated via decoupling decision; attorney review still required pre-launch |
| BF Pay money transmission licensing | 1, 6 | Deferred to Phase 2; platform-as-facilitator model (Stripe Connect-style) identified as likely path, not yet confirmed by counsel |
| Ambassador lifetime attribution liability | 2, 4 | **Superseded BP-4:** per-player override mechanic replaced by Community Remit Share (50% of community remit + 20% stacked origination) — see Gate 2, Vision Thesis 4a. New risk surface: dues-recognition (Path B) mitigates clawback exposure by construction; remaining open task is validating assumed community-size/cadence figures against real data (see Gate 4) |
| Photo ingestion bottleneck at multi-event scale | 1, 4, 6 | **Design resolved (2026-07-01):** self-service capture via the existing Live Panel eligibility gate (no new access model) + Host-owned curation, staged from a small BF Series/Cup pilot to WallyCup at flagship scale — see schema §9f/§9g. Still not built or costed: status remains open on execution and cost, not on model. |
| Founder time/capacity as hidden cost | 4, 6 | Flagged, not addressed |
| **Architecture/dev-at-scale gap** | 2, 4, 5, 6 | Current platform is a working prototype that proves the concept (scoring, memorialization, live event flow — GLS-validated) but was not built for what Gates 1–2 now describe at scale (payment processing, automated photo ingestion, recommendation engine, BF Pay compliance surface). **Update (BP-3):** earlier framing of this as a "multi-tenant" gap was corrected — this plan assumes ONE BirdieFriends, not isolated per-community instances (see Vision, "What This Is Not"). Gatherings (Dev-49–52) already proves self-service hosting works within the single-platform model. The real remaining engineering question is proximity-aware discovery (home course + travel radius, Craigslist-style), a smaller and differently-shaped problem than true multi-tenancy. The franchise-of-instances idea that originally motivated "multi-tenant" language is parked as a separate future business idea, not part of this gap. Broader scale items (payments, automated ingestion, recommendation engine, BF Pay compliance) remain unaddressed. |
| **Community sweat-equity catalyst gap** | 2, 5, 6 | Ambassador model assumes Ambassadors emerge once the product exists, but the network has a cold-start problem — someone has to be the unglamorous first mover, physically present and building trust in golf communities before there's a network to point to as proof. GLS is real evidence the founder can do this once, organically, for friends; doing it repeatedly and deliberately as the actual growth engine is a different, larger commitment. Who does this long-term (founder, hire, partner) is unresolved. Explicitly separate from the founder's personal financial investment decisions, which remain his own and outside this plan's scope. |
| **Tee-time reservation: reality, not a barrier — has a future investment path** | 1, 2, 5 | BF is explicitly not in the tee-time reservation business — every course runs its own system, and BF has no intent to replace those. **Correction (BP-2):** this is not actually a funnel barrier today — every future BF user will already interact with a golf club to launch a BF event, the same way founder works with BSGC and Matt scheduled and launched GLS independently of BF, with BF simply capturing the event afterward. It's a normal external reality of how golf works, not friction unique to BF. The real decision is a **future automation/partnership feature**, not a current gap: some course reservation systems offer fee-based APIs, which could become a paid integration or a business partnership with a reservation company down the line. Parked as a future feature decision, not a launch dependency. |
| **GHIN integration: economic barrier today, possibly not at scale** | 1, 4, 6 | Official GHIN handicap access costs ~$6k/year — a real economic barrier at current scale (BF currently calculates handicaps internally, not via official GHIN integration). Same pattern as tee-time API access: a paid third-party integration that's uneconomic today but may become viable once BF has enough volume/communities to justify the cost, or could be passed through as a participant/Ambassador-tier cost at scale. Not a launch blocker; a future economics question tied to growth, not a current build task. |
| **BirdieFriends Engine GTM-readiness gap (new, BP-5)** | 2, 4, 6 | The Engine (dev name: GS) — the brain/heart infrastructure both BF-E and BF-C are built on (see Vision, Core Vision Statement) — has concrete, identified gaps standing between its current founder-operated dev state and anything commercially launchable: **(1) Showstopper — the Engine is currently accessible only from the founder's laptop.** No multi-device or multi-operator access exists; this alone blocks any self-service BF-E model or any GTM launch, independent of pricing or Ambassador economics. **(2) No recommendation engine capability yet exists** — event-format tuning (Thesis 2) is currently founder judgment, not a built capability of the Engine. **(3) Hardened, scalable architecture is still needed beyond what Dev-55's D1 migration addressed** — that migration moved player-personalization state (Parked events, Seen/NEW-badges, etc.) off localStorage for device-independence, but was scoped to that state specifically, not a full production-readiness pass on the Engine as a whole. **All three are tagged as launch-gate requirements** — not blockers to continued dev/personal use, which continues regardless (see Vision, Founder Context) — but required before any GTM commercialization decision, and directly blocking Gate 4's ability to cost a rigorous BF-E/BF-C split (build-cost/effort for closing these gaps is currently unscoped). Should anchor Gate 6's launch-readiness checklist once started; candidate for a dedicated Dev-session scoping audit (which components are GTM-ready vs. still dev-era shortcuts) before Gate 4 rigor proceeds. |
