# View Isolation Refactor

## Problem

`website.html` (1657 lines) bundles four distinct things into one file: the main
marketing site, the Enterprise alt-layout, the Card Tour overlay, and the
isometric SVG engine (shared piece definitions + renderer used by the
Retail/Industrial/Chemical facility tabs). This makes it hard to edit or swap
any one view without touching the others, and the file is too large to hold in
context comfortably.

## Goal

Split the three top-level views (Main, Enterprise, Card Tour) into their own
files/folders, each reachable at its own route, while leaving the isometric
engine's logic (SVG generation functions, piece definitions, render/animation
loop) completely untouched — only its file location changes.

## Non-goals

- No changes to any SVG-drawing function, piece geometry, or the isometric
  render/walker logic.
- No build step / bundler is introduced — this stays plain static HTML/CSS/JS
  served by Vercel, matching the current deployment model.
- No homepage-swap mechanism — each view gets a fixed route.
- `editor.html` (the standalone Scene Builder dev tool) is out of scope; it
  isn't part of the routed site and isn't touched.

## Design

### Folder structure

```
/views/
  main/
    index.html      — hero, facility tabs (Retail/Industrial/Chemical), mode
                       toggle, sections, contact form
    main.css
    main.js         — current inline <script> content minus the isometric engine
  enterprise/
    index.html      — the Uncountable-style alt page (currently #enterprise-content)
    enterprise.css
  card-tour/
    index.html      — the sticker/scroll product-tour page (currently
                       #card-overlay / #card-view)
    card-tour.css
    card-tour.js
/shared/
  iso-engine.js     — untouched: isoX/isoY/boxFaces/box4/render, walker system,
                       and the PIECES_RETAIL/PIECES_IND/PIECES_CHEM definitions.
                       Loaded only by main/index.html.
  tokens.css        — dark/light CSS custom properties + base resets
  common.js         — small reused bits: toast(), mode-toggle, reveal-on-scroll
                       IntersectionObserver
```

### Routing

`vercel.json` replaces the current catch-all (`/(.*)` → `/website.html`) with
three exact-path routes. Everything else (css/js/assets under `/views/` and
`/shared/`) falls through to normal filesystem serving:

```json
{
  "routes": [
    { "src": "/", "dest": "/views/main/index.html" },
    { "src": "/enterprise", "dest": "/views/enterprise/index.html" },
    { "src": "/card-tour", "dest": "/views/card-tour/index.html" }
  ]
}
```

### Navigation changes

These are the only functional edits — everything else is a straight move of
existing markup/CSS/JS into new files:

- Main's "Enterprise" facility tab: `onclick="switchLayout('enterprise')"` →
  `<a href="/enterprise">` styled the same as the other tabs.
- Main's "Product Tour" trigger: `onclick="openProductTour()"` (which opened
  `#card-overlay` in place) → `<a href="/card-tour">`.
- Enterprise page: add a small "back to site" link → `/`.
- Card Tour page: `#card-close` button becomes a link back to `/` instead of
  calling `closeProductTour()`.
- Retail/Industrial/Chemical tabs are unchanged — they remain live,
  client-side switching within `main/index.html`, backed by `shared/iso-engine.js`.

### Removed dead paths

Once Enterprise and Card Tour are separate pages, the JS that toggled
`#content`/`#enterprise-content`/`#iso-bg`/`#legend` visibility for the
Enterprise case in `switchLayout()`, and the `openProductTour`/
`closeProductTour` overlay logic, are no longer needed in `main.js` and are
deleted. This is a structural consequence of the split, not a behavior change
to anything the user said not to touch.

### File disposition

- `website.html` is replaced by the three view files above. Git history
  retains the original.
- `backup/website.html` is left untouched as the existing safety copy.
- `editor.html` is left untouched (out of scope).

## Testing / verification

Since this is a static site with no test suite, verification is manual:
serve the folder locally, and for each route confirm:

- `/` — dark/light toggle, all three facility tabs render/switch correctly,
  edit-layout tool still works, contact form still shows the toast.
- `/enterprise` — renders identically to today's `#enterprise-content`, back
  link returns to `/`.
- `/card-tour` — renders identically to today's card-view overlay, animations/
  scroll-driven reveals still work, close link returns to `/`.
