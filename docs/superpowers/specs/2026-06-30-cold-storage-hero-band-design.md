---
name: cold-storage-hero-band
description: Add a full-width cold storage thermal SVG band between the hero and manifesto sections to demonstrate the product above the fold
metadata:
  type: project
---

# Cold Storage Hero Band

## Goal

The current hero section is dominated by the SURDS name in a large display font. A visitor cannot immediately understand what the product does. This adds a full-width animated SVG band — a cold storage facility rendered as a live thermal twin — directly below the hero text and above the `#idea` manifesto section. No existing content is moved or resized.

## Placement

Between `<section class="scene" id="top">` (hero) and `<section class="scene" id="idea">` in `index.html`. The band is a new `<section>` with no id (it is purely visual, not a nav target).

## Visual Structure

### Outer container

- Full viewport width, `height: clamp(340px, 50vh, 520px)`
- No horizontal padding — bleeds edge to edge
- Background: `var(--ink)` (same dark tone as sticker--ink) so the thermal colors pop
- Position relative, to anchor the floating callout stickers
- A thin `1px solid rgba(245,239,225,0.10)` top and bottom border to separate it from the cream sections above and below

### SVG plan (overhead cold storage, `viewBox="0 0 1200 480"`)

Three zones rendered left-to-right inside a single outer rectangle (walls at `stroke="#f4efe1"` opacity 0.25):

| Zone | x range | Floor fill | Temp label | Workers |
|------|---------|------------|------------|---------|
| Deep Freeze | 0–380 | `#0d1f2d` | `ZONE A · −18°C` | 1 |
| Chilled | 380–780 | `#111b1a` | `ZONE B · +4°C · HVAC 78%` | 2 |
| Receiving | 780–1200 | `#1a1610` | `RECEIVING · +18°C` | 3 |

Zone dividers: vertical dashed lines at x=380 and x=780, `stroke="rgba(245,239,225,0.18)"`, `stroke-dasharray="4 6"`.

**Racking (Deep Freeze and Chilled zones):** horizontal parallel lines at y=120, 160, 200, 240, 280, 320, 360 — representing shelf rows. `stroke="rgba(245,239,225,0.12)"`, `stroke-width="6"`, capped rectangles (rack ends marked with short verticals).

**Dock doors (Receiving zone, right wall):** three open rectangles at the right edge of the SVG, `width=40, height=60`, with hatch fill `stroke-opacity="0.3"`.

**AHU units:** one per zone, positioned along the top wall at x=190, x=580, x=990, y=60. Drawn as a `circle r=18` with an `×` inside, `stroke="#6f8f3e"` (grass). Duct lines run horizontally from each AHU down the top wall, `stroke="#6f8f3e"`, `stroke-width="2"`, `stroke-dasharray="6 4"` (same animated flow style as existing HVAC layer).

**Zone temperature labels:** `font-family="JetBrains Mono,monospace"`, `font-size="11"`, `fill="rgba(245,239,225,0.45)"`, positioned at top of each zone.

**HVAC scale labels (unoccupied zones):** Deep Freeze has `HVAC SCALED 20%` in `fill="#4d6628"`, same style as existing `hvac-lab`. Chilled has `HVAC 78%`.

### Human thermal signatures

Reuse the existing `#thb` radial gradient (`#ffd24a` → `#e0602a` → transparent). Each signature is a `<circle>` with `fill="url(#thb)"`:

| Worker | Zone | cx | cy | r | Animation |
|--------|------|----|----|---|-----------|
| W1 | Deep Freeze | 190 | 280 | 52 | `animateTransform` translate drift: (0,0)→(8,−6)→(0,0), dur=9s |
| W2 | Chilled | 520 | 200 | 52 | drift (0,0)→(−10,4)→(0,0), dur=11s |
| W3 | Chilled | 640 | 340 | 52 | drift (0,0)→(6,8)→(0,0), dur=8s |
| W4 | Receiving | 900 | 220 | 52 | drift, dur=7s |
| W5 | Receiving | 980 | 300 | 52 | drift, dur=10s |
| W6 | Receiving | 1050 | 240 | 52 | drift, dur=9s |

Each signature also has an opacity pulse: `0.75 → 1.0 → 0.75`, same duration as its translate. A small white dot (`r=3`) at the centroid marks the body centre.

**No face. No outline. Only heat.**

### Forklift

A `<rect width="16" height="9" rx="2" fill="rgba(245,239,225,0.55)"/>` animated with `<animateMotion>` along path `M 760 330 H 480 V 180 H 200`, dur=`10s`, `repeatCount="indefinite"`. A faint trail (same rect, opacity 0.1, offset 0.08s) follows behind.

### Floating callout stickers

Three absolutely-positioned stickers over the SVG. Same `.sticker` class and CSS variables as the rest of the site:

1. `sticker--ink` — top-left `(top:20px, left:24px)` — `<span class="tag">` with `<span class="glowdot"></span> Live thermal · 6 workers · 0% PII`
2. `sticker--amber` — bottom-right `(bottom:20px, right:24px)` — `HVAC auto-scaled in 2 unoccupied zones`
3. `sticker--grass` — top-right `(top:20px, right:24px)` — `−18°C deep freeze · sensor compensated`

Rotation values: `--r:-2deg`, `--r:3deg`, `--r:-3deg` respectively.

### Footer line

Below the SVG (inside the section, after the relative container):

```html
<div class="plan-foot" style="text-align:center;padding:10px 0 14px">
  SURDS · COLD STORAGE · LIVE SPATIAL TWIN
</div>
```

Uses the existing `.plan-foot` style from the scroll-show section.

## CSS changes

None required. The band reuses existing classes: `.sticker`, `.sticker--ink`, `.sticker--amber`, `.sticker--grass`, `.tag`, `.glowdot`, `.plan-foot`. The section itself needs only inline styles.

## JS changes

None. All animation is SVG-native (`animateTransform`, `animateMotion`, `animate`).

## What does not change

- The hero section (`#top`) — text, stickers, name size, thermal sticker — all unchanged
- The `#idea`, `#build`, `#features`, `#privacy`, `#talk` sections — unchanged
- `css/styles.css` — no additions required
- `js/app.js` — no additions required

## Constraints

- All animation must use declarative SVG (`<animate>`, `<animateTransform>`, `<animateMotion>`) — no JS needed
- No cameras, no faces, no identifiable shapes — only radial heat gradients
- Must remain legible and recognisable at viewport widths from 375px to 1600px (`preserveAspectRatio="xMidYMid meet"` on the SVG)
- Dark background inside the band only — surrounding sections keep the cream background
