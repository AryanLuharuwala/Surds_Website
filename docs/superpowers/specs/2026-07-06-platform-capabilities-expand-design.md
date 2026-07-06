---
name: platform-capabilities-expand
description: Make the Enterprise page's Platform Capabilities tiles expand in place (hover on desktop, tap on mobile) to reveal more detail
metadata:
  type: project
---

# Platform Capabilities Expand-in-Place

## Goal

The Enterprise page's "Platform Capabilities" section (`views/enterprise/index.html`, `#ent-features`) shows 8 tiles in a 4-column grid, each with an icon, a title, and one sentence of description. The user wants more detail available without leaving the page or opening a full modal: hovering a tile on desktop (or tapping it on mobile, since there's no hover on touch) expands that tile in place to reveal additional detail, while the rest of the grid reflows around it.

## Non-goals

- No modal/overlay popup — this was considered and explicitly rejected in favor of expand-in-place.
- No changes to any other Enterprise section (Industry Solutions, Testimonials, Security, Stats, CTA, Footer).
- No changes to Main or Card Tour.

## Design

### Content

Each tile keeps its existing icon, title, and one-sentence description unchanged. Expanding a tile reveals 3 new bullet points beneath the existing description — the whole point of expanding is to show more than what's already visible, so new copy is written for each of the 8 capabilities:

1. **Real-Time Monitoring**
   - Sub-second polling across every connected sensor type
   - Automatic alerts when readings drift outside safe thresholds
   - Historical playback to review conditions at any past moment
2. **Predictive Analytics**
   - Learns each machine's normal vibration and thermal signature
   - Flags gradual degradation weeks before a breakdown
   - Prioritized maintenance queue ranked by failure risk
3. **Multi-Site Dashboard**
   - One login covers every facility in your portfolio
   - Drill from a company-wide map down to a single sensor
   - Side-by-side comparison across sites and shifts
4. **Automated Reporting**
   - Scheduled PDF/CSV delivery to stakeholders on autopilot
   - Pre-built templates for OSHA, ISO 27001, and ESG frameworks
   - Full audit trail of every report generated and sent
5. **Safety Compliance**
   - Continuous air-quality and gas-leak monitoring
   - Instant alerts routed to the on-site safety officer
   - Compliance checklist that updates itself in real time
6. **Energy Optimization**
   - Automatically shifts load away from peak utility rates
   - Scales HVAC down in unoccupied zones in real time
   - Simulates "what-if" scenarios before you commit to changes
7. **Team Access Control**
   - Granular, per-zone and per-report permissions
   - Single sign-on with your existing identity provider
   - Every access and change logged for audit review
8. **ESG & Carbon Tracking**
   - Real-time carbon footprint broken down by zone
   - Decarbonization roadmap with measurable milestones
   - Export-ready documentation for carbon-credit applications

### Layout and interaction

- The grid stays `.ent-tiles-grid{grid-template-columns:repeat(4,1fr)}` (2 columns at ≤1024px, 1 column at ≤640px — unchanged from today).
- An expanded tile gets `grid-column:span 2` (on the 4-column desktop grid) so it visibly grows and the remaining tiles reflow around it via normal CSS Grid flow. At the 2-column breakpoint, `span 2` already equals the full row width, which reads fine (the tile takes the whole row). At the 1-column mobile breakpoint, every tile is already full-width, so the span has no visual effect there — only the content reveal matters on mobile.
- The new bullet list is present in the DOM at all times but visually collapsed (`max-height:0;opacity:0;overflow:hidden`), transitioning open (`max-height` to a fixed comfortable value, `opacity:1`) when expanded. This keeps the transition smooth without JS having to measure content height.
- **Desktop:** expansion is triggered by CSS alone — `:hover` and `:focus-within` on the tile (so keyboard users tabbing to the tile's content get the same reveal, no mouse required).
- **Touch:** there's no hover, so a small script (`views/enterprise/enterprise.js`, Enterprise's first JS file) adds a click/tap handler per tile that toggles an `.is-expanded` class. Tapping an already-expanded tile collapses it; tapping a different tile collapses whichever was open and expands the new one, so a small screen never ends up with multiple tiles expanded at once. This click handler is harmless on desktop too (a desktop click would also toggle the class), but since desktop already expands on hover, the click behavior there is a minor bonus, not the primary trigger.
- No changes to icons, tile order, or the section heading/subheading.

### Files touched

- `views/enterprise/index.html` — add the 3-bullet list markup inside each `.ent-tile`, add `<script src="/views/enterprise/enterprise.js">` before `</body>`.
- `views/enterprise/enterprise.css` — add `.ent-tile` hover/focus-within/is-expanded rules, the collapsed/expanded bullet-list rules, and the `grid-column:span 2` expansion rule.
- `views/enterprise/enterprise.js` — new file, click-to-toggle logic for touch devices (small, single-purpose, no dependencies).

## Testing / verification

Manual, via headless-browser screenshots (no test suite in this repo):
- Desktop viewport: hover each tile, confirm it spans 2 columns, other tiles reflow, bullets reveal smoothly, un-hover collapses it back.
- Keyboard: tab to a tile, confirm `:focus-within` produces the same expansion.
- Mobile viewport (390px): tap a tile, confirm it expands (bullets reveal); tap a second tile, confirm the first collapses and the second expands.
