# BirdieFriends — Capability Inventory
*Business Plan Exhibit · Draft v0.7 · June 2026*

---

## Vision Statement
> BirdieFriends is a **gathering design platform** that turns shared golf experiences into permanent memories.
> The scoring engine is infrastructure. The recommendation engine is the product. The memorial artifact — digital and physical — is what people pay for and carry forward.
> *"BF is built for golfers who want their gatherings to mean something — not every golfer does, and that's okay."*

---

## ✅ Current Capabilities (Proven & Deployed)

### 🏌️ Gathering Design & Scoring
| Capability | Notes |
|-----------|-------|
| Stableford quota scoring | Handicap-adjusted, flight-based |
| Skins detection & tracking | Live, per-hole, bust logic |
| Closest to the Pin (CttP) | Live leaderboard, distance tracking, negative validation |
| 2-Man scramble format | GLS-proven for mixed-skill groups — key to inclusive gathering design |
| Handicap-based quota calculation | Slope-adjusted, NoHCP handling |
| Best 4 of 8 series formula | Season-long championship scoring |
| Flight standings | Auto-calculated, tie detection |
| Pot management | Collection tracking, payout calculation, skins distribution |
| Format recommendation | Commissioner-driven today; recommendation engine in roadmap |

### 📋 Event Operations
| Capability | Notes |
|-----------|-------|
| Player registration & self-service | Jotform-backed, mobile-friendly |
| Event capacity management | Cap enforcement, sub promotion |
| Groupings builder | Drag-drop, tee time calculator, publish to web |
| Live event banner | Auto-activates at tee time |
| Birdie alerts (push) | Real-time, skin detection logic |
| CttP live leaderboard | 60s auto-refresh |
| Overseer scorecard entry | Mobile, post-round |
| Registration lock | 48-hour pre-event enforcement |
| Fivesome warnings | Scoped to last registrant |

### 📱 Member & Community Platform
| Capability | Notes |
|-----------|-------|
| Member portal (PWA) | Mobile-first, installable on iOS/Android |
| Member profiles | Handicap history, event history |
| Push notifications | OneSignal, iOS PWA required |
| Announcement feed | Commissioner-controlled, KV-backed |
| Admin panel | Collapsible cards, subscriber management |
| Commissioner PIN controls | Remote feature flags via Cloudflare KV |
| Active/Inactive member management | Auto-check, inline toggle |
| Series standings page | Public, auto-published |
| Player transparency page (mygame.html) | Individual scoring history |

### 🎉 Event Memorialization
| Capability | Notes |
|-----------|-------|
| Event results portal | Scores, standings, payouts — web-published |
| Photo gallery | Chapter-based, lightbox, swipe navigation |
| Self-contained archive | Base64-embedded photos, complete records, permanent |
| Groupings archive | Embedded in results page, per-event history |
| Scorecard history | Full per-player breakdown (eagle/birdie/par/bogey bars) |
| Match play table | Head-to-head records |
| Branded event site | Custom design per event (GLS proof of concept ✅) |

> **Proof point:** Garrett's Last Swing hat — organizer-initiated physical memorialization, BF co-branded, organic. Happened before commercialization existed. This is the value proposition working in the wild.

### 🛠️ Platform Infrastructure
| Capability | Notes |
|-----------|-------|
| GitHub Pages hosting | Zero hosting cost today |
| Cloudflare Worker backend | API proxy, KV store, feature flags |
| Jotform data integration | Forms, submissions, member data |
| Claude-direct deploy | Platform-independent, phone/tablet/laptop |
| Auto-version management | Atomic deploys, rollback capable |
| Push notification infrastructure | OneSignal, server-side proxy |

---

## 🔜 Near-Term Roadmap (Planned or Specced)

| Capability | Layer | Status |
|-----------|-------|--------|
| Alerts / Inbox (per-player, dismissable) | Platform | Designed, not built |
| Self-service event creation | Operations | Specced |
| Cancelled event handling | Operations | Specced |
| Personalized push scoping | Platform | Specced |
| Re-register bug fix | Operations | Known issue |
| Live panel UX overhaul | Operations | Known issue |
| Photo upload-time metadata capture | Memorialization | Documented in schema |
| Official GHIN handicap integration | Platform | Future — ~$6k/yr economic barrier today, possibly viable at scale |
| Tee-time reservation API integration / course partnership | Operations | Future — some reservation systems offer fee-based APIs; not a launch dependency |

---

## 🚀 Commercial Roadmap

### 🎯 Gathering Design Engine
*The core differentiator — turns BF from a scoring tool into an experience design platform*

| Capability | Description | Priority |
|-----------|-------------|----------|
| Recommendation engine v1 | Intake questionnaire → format prescription tuned to group profile and occasion | 🔴 High |
| Format library | Curated formats with outcome guidance — scramble, best ball, quota, Nassau, Stableford, and more | 🔴 High |
| Group profile builder | Skill mix, social dynamic, betting culture, occasion type, group history | 🔴 High |
| Occasion templates | Bachelor trip, corporate outing, charity event, bucket list, reunion weekend, regular series | 🔴 High |
| Outcome data feedback loop | Every event run improves future recommendations — data moat builds over time | 🟡 Medium |

### 🛒 Event Services (Commercial)
*How BF gets paid — embedded naturally in event economics*

| Capability | Description | Priority |
|-----------|-------------|----------|
| Self-serve event booking | Public-facing, organizer books and pays online | 🔴 High |
| Per-player/per-round billing | Platform fee embedded in event cost — VIG model, participant-split | 🔴 High |
| Participant enrollment | Auto-enroll all attendees into BF ecosystem at event close | 🔴 High |
| Event package tiers | Base (scoring + portal) / Standard (+ photos) / Premium (+ rewards) | 🟡 Medium |
| Payment processing (Stripe) | Event booking, platform fee collection, participant billing | 🔴 High |

### 🎉 Memorialization (Enhanced)
*The artifact people pay for and carry forward*

| Capability | Description | Priority |
|-----------|-------------|----------|
| Automated photo ingestion | Mobile upload → auto chapter suggestion → archive build | 🔴 High |
| Shareable highlight cards | Social-ready achievement graphics — CttP, skins, champion | 🟡 Medium |
| Personalized scorecards | Printable/downloadable per-player keepsake | 🟡 Medium |

### 🏆 BF Rewards (Physical Memory Layer)
*The hat that Garrett ordered. Systematized.*

| Capability | Description | Priority |
|-----------|-------------|----------|
| Digital achievement system | Permanent badges — skins won, CttP, champion, season awards | 🔴 High |
| Physical artifact fulfillment | Engraved coins, pins, plaques — ordered through platform, ships to organizer | 🔴 High |
| Event branded merchandise | Hats, shirts — event-named, BF co-branded, organizer-customized | 🟡 Medium |
| Season trophy program | Series champion physical award — annual, perpetual | 🟡 Medium |

> **Positioning:** BF Rewards is not merchandise. It is the physical layer of the memorial product. Every artifact that leaves an event carries both the event brand and the BF mark — compounding brand equity with every gathering run on the platform.

### 💳 BF Pay (Phase 2 — Legal Prerequisite Required)
*Solving the hardest problem in recreational golf — pot management*

| Capability | Description | Priority |
|-----------|-------------|----------|
| Event treasury | Pot collection at registration, held in platform escrow | 🟡 Medium |
| Automated payout distribution | Scoring results → payment splits → Venmo/ACH/Stripe | 🟡 Medium |
| Skins & CttP settlement | Automatic calculation and distribution at event close | 🟡 Medium |
| ⚠️ Legal prerequisite | Fintech/gaming attorney review of fee structure and state licensing before any build | 🔴 Blocker |

> **Note:** BF is viable without BF Pay. It is significantly more valuable with it. The pain is real and proven — pot management was hand-built into GolfScorer and required repeated effort even for the platform's own founder. No good commercial solution exists today — the legal complexity is itself a moat signal.

### 🤝 Ambassador Network
*Community-driven distribution — social connectivity as the growth engine*

| Capability | Description | Priority |
|-----------|-------------|----------|
| Ambassador onboarding | Application, credentialing, community territory assignment | 🔴 High |
| Ambassador dashboard | Origination earnings, lifetime attribution payout tracking, community book of business | 🔴 High |
| Community management tools | Ambassador-owned group portal — their community, their brand, BF infrastructure | 🟡 Medium |
| Participant attribution tracking | Every enrolled participant permanently tagged to originating Ambassador — basis for lifetime attribution payouts | 🔴 High |
| Ambassador recruiting tools | BF-supplied materials, pitch deck, demo event capability | 🟡 Medium |
| Role succession / handoff | Mechanism for one person to step into a vacated Wrangler, Organizer, or Ambassador role (injury, burnout, life change) without losing group continuity or, where applicable, reassigning attribution. Surfaced via Gate 2 discussion (Vision Thesis 9) — not yet scoped technically or commercially. | 🟡 Medium |

> **Ambassador vs. Entrepreneur:** Ambassadors are community advocates — motivated organizers who love what BF does and get paid to share it with people they already know. They are not a sales channel dependency. BF sells directly to any organizer who finds it. Ambassadors accelerate reach into communities BF couldn't cost-effectively penetrate otherwise. The product doesn't need them. The network becomes dramatically more valuable with them.

### 🌐 Community Network (The Long Game)
*Where Ambassador-anchored communities become interconnected — the network effect*

| Capability | Description | Priority |
|-----------|-------------|----------|
| Cross-community events | Ambassador communities compete against each other — BF as neutral platform | 🟡 Medium |
| Cross-region competitions | Regional championships seeded from local community standings | 🟡 Medium |
| National leaderboards | Skill-adjusted rankings across all BF communities | 🟢 Future |
| Non-golf gathering expansion | Architecture supports any group-organizing use case | 🟢 Future |

> **The network flywheel:** Each Ambassador builds a community node. BF connects the nodes. Cross-community competition makes every node more valuable as the network grows. A competitor can replicate the scoring engine. They cannot replicate the network.

### ⚙️ Platform (Scale)
| Capability | Description | Priority |
|-----------|-------------|----------|
| Multi-tenant architecture | Each Ambassador/community has isolated, portable data. **Active dev experiment underway (parallel track, BP-2)** — validated by 3 BFs with expressed direct interest; previously infeasible under old Jotform single-tenant model, no longer blocked. Core to the "Tee off, play great" tagline. | 🔴 High |
| Production hosting migration | Off GitHub Pages onto scalable infrastructure | 🔴 High |
| Support model | FAQ, Ambassador as first-line support for their community | 🟡 Medium |
| Legal entity & terms of service | Commercial agreements, Ambassador contracts, user TOS | 🔴 High |

---

## Revenue Model Summary

| Stream | Mechanism | Phase |
|--------|-----------|-------|
| **Platform fee** | Flat $5/player/round, embedded in event cost ($3 floor, $4 likely blended average with promo pricing — settled BP-3) | Launch |
| **Event package upsell** | Photo, premium archive, rewards tiers | Launch |
| **BF Rewards** | Physical artifacts ordered at event close | Launch |
| **Ambassador origination** | Credit for bringing a player into the BF ecosystem | Launch |
| **Ambassador lifetime attribution** | 5% recurring override on an originated player's future bookings, conditioned on the Ambassador remaining active (~1 new group/month illustrative bar) — self-limiting, not unconditional (settled BP-3) | Launch |
| **BF Pay** | Treasury and settlement fees | Phase 2 |
| **Cross-community events** | Entry fees, sponsored competitions | Future |

---

## Priority Key
| Symbol | Meaning |
|--------|---------|
| 🔴 High | Required for commercial launch |
| 🟡 Medium | Important but not launch-blocking |
| 🟢 Future | Phase 2+ / post-proof |

---

*This document is a living asset. Updated each business planning session.*
*Last updated: Session BP-3 · June 30, 2026 · v0.7*
