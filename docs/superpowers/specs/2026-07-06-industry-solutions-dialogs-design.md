---
name: industry-solutions-dialogs
description: Add a "Learn More" button to each Industry Solutions card on the Enterprise page that opens a per-industry dialog with a media placeholder and expanded content
metadata:
  type: project
---

# Industry Solutions Dialogs

## Goal

The Enterprise page's "Industry Solutions" section (`views/enterprise/index.html`, the 3 `.ent-feature-card`s for Chemical & Process Plants, Pharma & Life Sciences, and Data Centers & IT Facilities) is static. The user wants each card to be clickable and open its own dialog, so real content (video or SVG, to be supplied later) can be dropped in per industry.

## Non-goals

- No changes to Platform Capabilities tiles, Testimonials, Security, Stats, or CTA sections.
- No real video/SVG content yet — dialogs ship with a clearly-labeled placeholder slot.
- No removal of existing bullet content from the cards — cards stay as-is, plus a new button.

## Design

- Each `.ent-feature-card` gets a "Learn More →" button appended after its `<ul>`.
- 3 `<dialog class="ent-dialog">` elements added near the end of `index.html` (before `</body>`), one per industry, each containing:
  - A close button (`×`)
  - The industry's `ent-fc-sub` label + `<h3>` title
  - A dashed-border media placeholder box with an icon + "Video/SVG coming soon" text — the slot for future real content
  - The same bullet list as its card (fuller read, not primarily a duplicate)
- A `<script>` block (inline at the end of `index.html`, since this page has no JS file yet) wires each "Learn More" button's `data-dialog-target` to that dialog's `showModal()`, and each dialog's close button + backdrop click to `close()`.
- CSS added to `enterprise.css`: `.ent-dialog` panel (white bg, rounded corners, `#0439A4` accents matching the site), `::backdrop` dimming, `.ent-dialog-media` placeholder box styling, and the "Learn More" button style (reusing the existing `ent-btn-outline` look at a smaller size).

### Files touched

- `views/enterprise/index.html` — add button per card, add 3 `<dialog>` blocks, add inline `<script>`.
- `views/enterprise/enterprise.css` — add dialog, backdrop, media-placeholder, and learn-more-button rules.

## Testing / verification

Manual, in-browser: each of the 3 buttons opens only its own dialog; ESC and backdrop click close it; no layout shift on the underlying card; placeholder box reads clearly as "content coming later."
