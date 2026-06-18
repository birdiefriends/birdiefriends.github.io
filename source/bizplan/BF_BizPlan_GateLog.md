# BirdieFriends — Business Plan Gate Log
*Tracks the six-gate viability framework · Update at the end of every session*
*Last updated: Session BP-1 · June 18, 2026*

---

## Framework Reminder

Each gate answers a viability question before the plan moves on. If a gate fails, the model pivots — not just the wording. Gates can be revisited; later gates often reshape earlier ones (Gate 4 economics typically forces Gate 2 revisions).

| Gate | Question | Status |
|------|----------|--------|
| 1. Problem/Market Fit | Is there a real, underserved problem worth solving commercially? | 🟡 Nearly closed |
| 2. Product/Model Fit | Which model (or blend) matches what's buildable in 6–12 months? | 🟡 In progress |
| 3. Competitive & Moat | Why BF, why now, what's defensible? | 🟢 Directionally answered |
| 4. Unit Economics | Can this make money at a unit level? | 🟡 Napkin done, needs rigor |
| 5. Go-to-Market | How do you get the first paying customers in 6 months? | ⚪ Not started |
| 6. Launch Plan & Milestones | What does launch-ready actually require? | ⚪ Not started |

Legend: ⚪ Not started · 🟡 In progress · 🟢 Closed/settled · 🔴 Blocked

---

## Gate 1 — Problem/Market Fit

**Status: 🟡 Nearly closed — ready to write up as formal section**

### Settled
- **Customer:** The organizer leads. Participants are the enrollment pipeline. Ambassadors are an optional distribution accelerant, not a dependency.
- **Anchor use case:** GLS-style private event/gathering, not the day-to-day subscription. Subscription is a future Layer 3, fed organically by event enrollment — founder has low confidence golfers will pay recurring fees directly.
- **Domain scope:** Golf-first, with an explicit master plan to diversify into other "organize cockroaches" use cases (corporate meetups, charity events, reunions) over time. Architecture should stay domain-flexible without requiring a rebuild.
- **Gathering spectrum identified:** Serious golf groups (BF Series) vs. social/mixed-skill trips (GLS) vs. bucket-list trips vs. non-golfer-inclusive corporate/charity events are emotionally and economically distinct products sharing the same scoring infrastructure.
- **Core value prop:** Gathering design (recommendation engine) + memorialization (digital + physical), not scoring software. Scoring is commodity infrastructure.

### Open
- Final pricing decision: $3 vs $5 vs tiered per-player/per-round (leaning $5, based on GLS pot behavior — see Gate 4)
- Photo workflow: automated base tier vs. manual premium tier (cost/build tradeoff, not yet resolved)
- Participant billing mechanics: organizer-collected vs. participant-direct-billed at registration (leaning toward participant-direct to remove organizer friction and fraud exposure — not finalized)

### Legal Note (Critical — Carries Forward to Gates 4 & 6)
Distinguishing social gambling (legal pot-splitting, no house cut) from commercial gambling (a business entity taking a percentage of wagered funds) is essential. Resolution: **BF's platform fee must be structurally decoupled from any prize pool**, charged for event services (design, scoring, portal, memorialization), never as a percentage of money wagered. "VIG" is abandoned as both internal and external terminology due to gambling connotation — replaced with "platform fee" or "event services fee." BF Pay (pot management) is explicitly Phase 2, gated on fintech/gaming legal review (est. $500–1,500 attorney consultation, not a major engagement) before any build begins.

---

## Gate 2 — Product/Model Fit

**Status: 🟡 In progress**

### Settled
- **Hybrid model confirmed:** Event services (Layer 1) + Ambassador network (Layer 2) + future subscription (Layer 3, not a launch dependency).
- **Franchise vs. MLM:** Franchise-style model (one-level residual, territory/community-based) explicitly preferred over multi-level MLM structure, due to legal/reputational risk of multi-level residuals. Residual depth should stay one level deep.
- **Ambassador reframe:** Not "entrepreneur," not "operator" — **Ambassador**. Community advocates who already love BF and get paid to share it, not a required sales channel. This changes recruiting psychology significantly (easier ask — "you'd recommend this anyway") and removes franchise-fee-upfront friction tested earlier in the conversation.
- **Lifetime attribution, not residual:** Ambassador compensation reframed from "residual" (which implies ongoing service/royalty) to **lifetime attribution credit** — a player is permanently tagged to the Ambassador who originated their enrollment, and every future transaction by that player triggers a payout to that Ambassador, regardless of elapsed time or whether the Ambassador did any additional work. Founder principle: "do the work once, get paid a lot, build your own ATM." This is treated as a deliberate scaling and moat-building mechanism, not just a compensation nicety — it creates compounding incentive for Ambassadors to keep growing the community. **Flagged open question (not settled):** whether attribution is permanent for the life of the player or can expire/be reassigned under certain conditions (long inactivity, regional moves, etc.). The principle is settled; the mechanics and liability profile are not — see Gate 4.
- **BF Rewards confirmed as core**, not Phase 2 — physical/digital achievement recognition (CttP coins, skins medallions, season trophies) validated by the Garrett's Last Swing hat as an organic, pre-commercial proof point.
- **Network effect identified:** Ambassador-anchored communities create a future cross-community/cross-region competition layer — a real network effect moat that compounds as the Ambassador network grows. Not a launch requirement, but an important long-term differentiator to capture in the plan now.

### Open
- BF Pay sequencing relative to launch — confirmed Phase 2/legal-gated, but exact trigger point (e.g., "after N events" or "after legal review regardless of volume") not yet defined
- Whether Ambassador commission structure (20% origination + residual %) needs adjustment once Gate 4 economics are modeled rigorously
- Multi-tenant architecture requirements — not yet scoped technically

---

## Gate 3 — Competitive & Moat

**Status: 🟢 Directionally answered, can be revisited with formal competitive research**

### Settled
- Technology is explicitly NOT defensible — quick market research shows dozens of tools attacking the "cockroach organization" problem (Golf Genius, GhinManager, TheGrint, etc. — named as reference points, not yet researched in depth).
- The moat is the **distribution model**, not the tech: Ambassador network + accumulated outcome data (recommendation engine improves with every event) + brand equity on physical artifacts + eventual cross-community network effects.
- Hypothesis explicitly revised: "every golf club would benefit from BF" → "every club has 2–3 motivated organizer-types (Ambassador candidates) who would benefit," reflecting human nature and club bureaucracy/slowness as a sales barrier.

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

### Open
- Founder's own time has not been assigned a notional value — flagged as a common founder blind spot, not yet addressed
- **Lifetime attribution payout liability not yet modeled.** If attribution is truly permanent, every Ambassador-originated player generates a perpetual claim against future revenue from that player, compounding as the Ambassador base and enrolled-player base both grow. This needs rigorous modeling before any Ambassador agreement formalizes the "permanent" version of the principle — possible mitigations to explore: time-bounded attribution windows, declining-percentage schedules, or inactivity-based expiration. The scaling/moat benefit of permanence is real and intentional (see Vision doc 4a) — the question is how to capture that benefit without an unbounded liability.
- No real model yet for Ambassador commission sustainability beyond napkin stage
- Photo ingestion automation cost not yet estimated (build cost, not just legal/ops cost)
- BF Rewards unit economics floated only directionally (e.g., ~$15–25 landed cost on a CttP coin, sellable ~$35–50) — not rigorously modeled

---

## Gate 5 — Go-to-Market

**Status: ⚪ Not started**

Nothing formally addressed yet beyond the Ambassador-as-accelerant concept captured in Gate 2. Needs its own session.

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
| Ambassador lifetime attribution liability | 2, 4 | Principle settled (intentional moat/scaling mechanism); permanence vs. expiration mechanics not yet modeled — needs rigor before formalizing any Ambassador agreement |
| Photo ingestion bottleneck at multi-event scale | 1, 4, 6 | Known constraint, automation not yet built or costed |
| Founder time/capacity as hidden cost | 4, 6 | Flagged, not addressed |
