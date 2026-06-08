# BF Next Session — Garrett's Last Swing Cleanup + Archive Feature
**Created:** 2026-06-08 (Session 30 close)
**Target:** Session 31
**Pages:** `garretts-last-swing.html` · `garretts-last-swing-gallery.html`

---

## Priority 1 — Results page clean rewrite

The current `garretts-last-swing.html` accumulated ~22 iterative edits across the session. It works but has dead code and formatting debt. Session 31 should do a clean rewrite from the final data, keeping the design intact.

### Known issues to fix in rewrite
- Dead photo overlay code (`#photo-overlay`, `po-img`, `po-filmstrip` CSS + HTML) — bubble was removed but overlay shell remains
- Table column widths: `table-layout:auto` applied but `vs Par` column still clips on some phones — test and fix
- Script block organization: render JS is at the bottom of body as a raw `<script>` block after the bubble JS remnants were cleaned up — consolidate into one clean block
- Photo pill buttons: confirm all 6 pills link to correct gallery chapter anchors (`#ch-rd1`, `#ch-rd2`, etc.)
- Full field results section: was removed in redesign — decision: keep out (gallery handles this) or add back as collapsible

### Data to preserve (all verified correct)
- Competition 1: Jon Hernandez wins at +6 (220 raw)
- Competition 2: Jason Dinkel wins at 2.5 pts
- Rd 1 Shore Gate P72, Rd 2 Cape May P71, Rd 3 Cape May P71
- All round scorecards, individual standings, match play points confirmed
- Skins: Garrett/Kyle 12 skins (H9+H14), Brian/Nate H11, Jon/Chase H15, Tim/Jason H17 — hole 18 pushed
- CttP: Nate H3, Aaron H6, Jon H8, Tim H13, Garrett H17
- Payouts: Skins $48/hole ($240 pot), CttP $44/hole ($220 pot)

---

## Priority 2 — Download / Archive feature

### The requirement
Every player should be able to download a copy of the results page that:
- Works completely offline, forever
- Requires no server, no internet, no BirdieFriends infrastructure
- Is self-contained in a single file
- Looks identical to the live page
- Survives 50+ years (plain HTML/CSS/JS — no frameworks, no CDN dependencies)

### Options to evaluate

**Option A — Single-file HTML with embedded assets (recommended)**
- All photos base64-encoded inline in the HTML
- Google Fonts replaced with system font stack fallback
- One `garretts-last-swing-archive.html` file, ~15-25MB
- User downloads it, opens it in any browser, forever
- Build: Python script that fetches all photos, base64-encodes, inlines into a template

**Option B — PDF export**
- Browser print → Save as PDF
- Loses interactivity (lightbox, filters, tabs)
- Good for a one-page summary, not the full experience
- Could be a companion to Option A

**Option C — ZIP package**
- HTML + all photos as separate files in a zip
- Works offline but requires extraction
- More complex for the average user

### Recommendation
Build Option A (single-file HTML) as the primary archive. Offer Option B (PDF) as a secondary "print summary" view.

### Implementation plan for Option A
1. Build `make_archive.py` script (runs in Claude's sandbox):
   - Reads `garretts-last-swing.html` from GitHub
   - Fetches all referenced `/gls-photo-*.jpg/webp/png` from GitHub
   - Base64-encodes each photo
   - Replaces `src="/gls-photo-xxx.jpg"` with `src="data:image/jpeg;base64,..."`
   - Replaces Google Fonts `<link>` with inline `@font-face` or system font fallback
   - Writes `garretts-last-swing-archive.html`
2. Deploy archive to `docs/garretts-last-swing-archive.html`
3. Add "⬇️ Download Archive" button to results page footer
4. Add same button to gallery page

### Font handling for archive
Replace:
```html
<link href="https://fonts.googleapis.com/css2?family=Pacifico&family=DM+Sans...">
```
With inline `@font-face` using base64-encoded WOFF2, or fall back to:
```css
font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
font-family: 'Pacifico', cursive; /* browsers have cursive fallback */
```

---

## Priority 3 — Gallery improvements

- Add beach photos (beach1.webp, beach2.webp) to Rd 1 chapter ✅ done Session 30
- Add ski shots (ski1.webp, ski2.webp) to Saturday celebration ✅ done Session 30
- "Got photos?" CTA at gallery bottom — consider wiring to an email or Jotform upload form
- Gallery photo count in header is hardcoded (32) — consider deriving from data array length

---

## Files to fetch at Session 31 start

In addition to the standard bootstrap, also fetch:
```
curl -sL https://raw.githubusercontent.com/birdiefriends/birdiefriends.github.io/main/docs/garretts-last-swing.html
curl -sL https://raw.githubusercontent.com/birdiefriends/birdiefriends.github.io/main/docs/garretts-last-swing-gallery.html
```

---

## Reference data

### Photo files in GitHub docs/
```
garretts-last-swing-photo.jpg   (hero group photo)
gls-photo-913.jpg through gls-photo-1024.jpg  (various)
gls-photo-beach1.webp, gls-photo-beach2.webp
gls-photo-ski1.webp, gls-photo-ski2.webp
gls-photo-955.webp (hat photo)
gls-photo-987.webp (Mud Hen bar)
gls-photo-1006.png (wide course shot)
```

### Jotform form used for scoring
- Form ID: 253134098686163
- Event filter: "Garrett's Last Swing - Rd1/Rd2/Rd3"
- API Key: dd0cb09a71eee7d0db3aa690e292660f

### Live URLs
- Results: https://birdiefriends.com/garretts-last-swing.html
- Gallery: https://birdiefriends.com/garretts-last-swing-gallery.html
- Archive (to build): https://birdiefriends.com/garretts-last-swing-archive.html
