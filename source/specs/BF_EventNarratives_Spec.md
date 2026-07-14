# BF Event Narratives — Concept Spec

**Status:** Concept captured Dev-63 (2026-07-14), not yet built. Candidate focus for Dev-64+.
**Author:** Claude, in conversation with Brian.

## 1. The idea

Use the historical data BirdieFriends already accumulates per event (scores, quota
performance, skins, CTP, season-long trends) to auto-generate short, humorous written
narratives — one per player covering their event, plus one overall event story — so
events get "memorialized" in prose the same way the Photos tab memorializes them
visually, without anyone having to actually write anything.

Explicitly in scope per Brian: call out both positive and negative trends, but done
carefully/tastefully — good-natured golf-buddy ribbing, not a roast, and never
personal or mean.

## 2. Why this is feasible right now

The data this needs already exists and is already computed at publish time — this
isn't a new data-collection effort, it's a new *consumer* of data GS already has:

- **Per-event, per-player:** quota vs. actual (`diff`), tee flight, skins won, CTP
  wins, full hole-by-hole point sequence (so "eagled 14 and 15 back-to-back" or
  "started −4 through 6 then caught fire on the back" is derivable, not guessed).
- **Cross-event trends:** `playerHistory[name].events` already holds full season
  history per player — streak/trend lines ("3rd podium in a row," "first skin all
  season," "bounced back after a rough #3") are computable from data already stored,
  no new tracking needed.
- **Season-level context for the overall narrative:** standings movement, tightest
  race, biggest single-event swing, who's trending up/down.

## 3. Architecture — where the AI call actually happens

This is a static site with no backend, so an LLM call can't happen live on every page
view (slow, costly, no server to hold credentials against). It has to happen **once,
at Publish time**, in GS — the same moment `payoutSnapshot` gets frozen onto the event
record (Dev-63 pattern: generate once, freeze, never regenerate from a live page view).

**Credential handling — learn from a real precedent already in this codebase.** An
`ANTHROPIC_API_KEY` was previously wired into `launch_golf_scorer.py` for a since-retired
OCR feature, and was deliberately revoked and removed entirely during the Session 40
credential-hygiene pass (see `BF_Operations_Guide.md`, Session 40 entry) — the same
session that moved GitHub token usage out of scripts Claude runs and into Cloudflare's
secret store. Do not repeat the old pattern. The correct home for a narrative-generation
API key is a new PIN-gated Worker route (e.g. `POST /narrative/generate`), with the
Anthropic key held as a Cloudflare secret exactly like `GH_TOKEN`. GS calls the Worker;
the Worker calls Anthropic; the key never touches client-side JS or a laptop script.

**Call shape:** one batched call per publish — a single prompt listing every player's
stats for the event, asking for a JSON array of `{name, narrative}` back — plus one
call (or the same call) for the overall event story. Batching keeps cost down and, more
importantly, keeps tone consistent across the whole set rather than N independent calls
drifting in style relative to each other.

## 4. Tone — the part that needs real care

Real names, real public page, "call out negative trends" — this is the one place to
slow down rather than ship blind. Guardrails to build in from day one, not retrofit
after something lands wrong:

- A tight system prompt constrained to good-natured ribbing — the way a golf buddy
  would tease you, not a roast. Explicitly bars anything that reads as mean, personal,
  or that singles out one person's struggles repeatedly across events (a bad quota
  differential is fair game once; being "the guy who always shoots badly" every single
  event write-up is not).
- **A preview-before-publish step**, at least for the first several events: narratives
  generate and display in GS before Publish actually commits them, so Brian can
  regenerate or hand-edit anything that lands wrong before it's public. Automatic
  straight-to-publish is a later-maturity option once the tone is proven reliable, not
  a v1 default.
- Possible future addition, not v1: a per-player opt-out flag in Membership, in case
  someone genuinely doesn't want to be joked about publicly. Only build if it actually
  comes up — speculative otherwise.

## 5. Where it lives on the page

Fits the "story" framing already established for Photos (Pre-Competition / On the
Course / Post-Round). Likely its own tab on results.html: overall narrative up top,
per-player blurbs below, possibly paired with that player's photos for the event if
any exist (natural pairing with the existing Photos tab data).

## 6. Open questions for Dev-64 scoping

1. Anthropic API key — new one to be provisioned for this, held as a Worker secret?
2. Preview/approve step before publish, or fully automatic? (Recommendation above:
   preview first, at least initially.)
3. V1 scope — overall narrative only first, or overall + per-player together?
4. New Worker route needed: `POST /narrative/generate` (or similar), PIN-gated,
   holds the Anthropic key as a Cloudflare secret. Needs its own design pass on
   request/response shape once the above questions are answered.

Not scoped in this document: exact prompt text, exact JSON contract between GS and
the Worker, exact tab markup/CSS. This is a concept capture to unblock a proper design
session, not a build-ready spec — the discuss → document → build pattern this codebase
already uses for other features (see `BF_Gatherings_Spec.md` for the shape a build-ready
version of this doc should eventually take).
