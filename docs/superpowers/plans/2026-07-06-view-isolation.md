# View Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `website.html` into three routed, independently-editable views (Main, Enterprise, Card Tour) plus a shared isometric engine, with zero changes to any SVG-generating function or piece geometry.

**Architecture:** Pure static extraction — no build step. Large invariant chunks (the isometric engine, piece definitions, card-view markup/CSS, enterprise markup/CSS) are copied byte-for-byte via `sed -n 'START,ENDp'` line ranges from the current `website.html`, which is the only reliable way to move ~800 lines of dense, minified-style JS/CSS without transcription risk. Small connective pieces (page `<head>`s, nav links, one dead-code removal in `switchLayout`, one hoisting fix) are hand-specified in full below because they are genuinely new/changed, not moved.

**Tech Stack:** Plain HTML/CSS/JS, Tailwind CDN (Main only), Lucide CDN (Main + Card Tour only), Vercel static routing.

## Global Constraints

- Do not alter any function body under the `/* ===== ISO ENGINE ===== */`, `/* ===== PIECES =====`, `/* ===== FACILITY STATE =====`, `/* ===== WALKER SYSTEM =====`, `/* ===== SENSOR CONE SYSTEM =====`, `/* ===== CAMERA =====`, `/* ===== COORD MAPPING =====`, or `/* ===== RENDER =====` comment blocks in the current `website.html` (lines 842–1421). These move verbatim.
- No bundler/build step is introduced. Every new file is plain static HTML/CSS/JS.
- `backup/website.html` and `editor.html` are out of scope — do not touch them.
- All line numbers below refer to the **current, unmodified** `website.html` at the start of this plan. Re-run `grep -n "/\* ====="` if you need to re-verify a boundary before a step — do not eyeball-scroll.

---

### Task 1: Scaffold folders and extract `shared/iso-engine.js`

**Files:**
- Create: `shared/iso-engine.js`
- Read (source only, unmodified in this task): `website.html`

**Interfaces:**
- Produces: globals consumed by `views/main/main.js` in Task 2 — `PIECES`, `ORDER`, `HOTKEY` (var, initially `{}`), `PIECES_RETAIL/ORDER_RETAIL/HOTKEY_RETAIL`, `PIECES_IND/ORDER_IND/HOTKEY_IND`, `PIECES_CHEM/ORDER_CHEM/HOTKEY_CHEM`, `pieces`, `walkers`, `uid`, `currentTheme`, `floorColor`, `gridColor`, `canvas`, `curV`, `tarV`, `showGrid`, `editMode`, `editTool`, `hover`, `SENSOR_DEFS`, `sensorStates`, functions `isoX`, `isoY`, `VB`, `P`, `poly`, `ln`, `bil`, `boxFaces`, `box4`, `switchLayout(theme)`, `pieceAt`, `walkerAt`, `spawnWalker`, `recalcAllPaths`, `loadDefault/loadIndustrial/loadChemical`, `clientToSvg`, `svgToCell`, `render`.

- [ ] **Step 1: Create the folder skeleton**

```bash
mkdir -p shared views/main views/enterprise views/card-tour
```

- [ ] **Step 2: Extract the untouched engine body (lines 842–1421) verbatim**

```bash
sed -n '842,1421p' website.html > shared/iso-engine.js
```

- [ ] **Step 3: Fix a cross-file hoisting hazard — predeclare `HOTKEY`**

In the *original* single-script file, `var HOTKEY={...real hotkeys...}` (originally at line 1455) is hoisted to the top of that one `<script>` block, so by the time line 885's `var HOTKEY_RETAIL=Object.assign({},HOTKEY)` runs, `HOTKEY` already exists (as `undefined`), and `Object.assign({}, undefined)` evaluates to `{}`. Splitting into two separate `<script src>` files breaks this: `iso-engine.js` (loaded first) would reference `HOTKEY` before `main.js` (loaded second) has ever declared it, throwing `ReferenceError: HOTKEY is not defined`.

Fix by predeclaring `HOTKEY` as an empty object at the top of `iso-engine.js`, which reproduces the exact original runtime value (`Object.assign({}, {})` also equals `{}`) with no behavior change, and removes the crash.

In `shared/iso-engine.js`, find:
```js
/* ===== THEME SYSTEM ===== */
var currentTheme='retail';
```
Replace with:
```js
/* ===== THEME SYSTEM ===== */
var HOTKEY={};
var currentTheme='retail';
```

- [ ] **Step 4: Remove the dead Enterprise branch from `switchLayout`**

Enterprise is no longer a `switchLayout` target (it's a separate page now — see Task 4), so the `enterprise` branch, the `cardOverlay` guard, and the pre-branch content/enterprise-content visibility toggling are all dead code referencing elements that won't exist on the Main page anymore. The `retail`/`industrial`/`chemical` branches are copied with zero changes to their color-lookup or `load*()` calls.

In `shared/iso-engine.js`, find the full `switchLayout` function:
```js
function switchLayout(theme){
  currentTheme=theme;
  /* Always ensure card overlay is closed when switching facility themes */
  if(cardOverlay)cardOverlay.classList.remove('open');
  document.body.style.overflow='';
  /* Always clean up enterprise mode when switching away */
  if(theme!=='enterprise'){
    document.getElementById('content').style.display='';
    document.getElementById('enterprise-content').style.display='none';
    document.getElementById('iso-bg').style.display='';
    document.getElementById('legend').style.display='';
    document.documentElement.removeAttribute('data-facility');
  }
  if(theme==='industrial'){
    PIECES=PIECES_IND;ORDER=ORDER_IND;HOTKEY=HOTKEY_IND;
    floorColor=getComputedStyle(document.documentElement).getPropertyValue('--m-floor-industrial').trim();gridColor=getComputedStyle(document.documentElement).getPropertyValue('--m-grid-industrial').trim();
    loadIndustrial();
  }else if(theme==='chemical'){
    PIECES=PIECES_CHEM;ORDER=ORDER_CHEM;HOTKEY=HOTKEY_CHEM;
    floorColor=getComputedStyle(document.documentElement).getPropertyValue('--m-floor-chemical').trim();gridColor=getComputedStyle(document.documentElement).getPropertyValue('--m-grid-chemical').trim();
    loadChemical();
  }else if(theme==='enterprise'){
    PIECES=PIECES_ENTERPRISE;ORDER=ORDER_ENTERPRISE;HOTKEY=HOTKEY_ENTERPRISE;
    floorColor=getComputedStyle(document.documentElement).getPropertyValue('--m-floor-retail').trim();gridColor=getComputedStyle(document.documentElement).getPropertyValue('--m-grid-retail').trim();
    loadDefault();
    document.getElementById('content').style.display='none';
    document.getElementById('enterprise-content').style.display='block';
    document.getElementById('iso-bg').style.display='none';
    document.getElementById('legend').style.display='none';
    document.documentElement.setAttribute('data-facility',theme);
    document.querySelectorAll('.layout-tab').forEach(function(t){t.classList.toggle('active',t.dataset.theme===theme)});
    return;
  }else{
    PIECES=PIECES_RETAIL;ORDER=ORDER_RETAIL;HOTKEY=HOTKEY_RETAIL;
    floorColor=getComputedStyle(document.documentElement).getPropertyValue('--m-floor-retail').trim();gridColor=getComputedStyle(document.documentElement).getPropertyValue('--m-grid-retail').trim();
    loadDefault();
  }
  walkers=[];
  walkers.push(spawnWalker(2,6,0),spawnWalker(2,3,1),spawnWalker(1,1,2),spawnWalker(9,2,3));
  sensorStates=SENSOR_DEFS.map(function(){return{opacity:0,radius:0,tOp:0,tR:0}});
  document.querySelectorAll('.layout-tab').forEach(function(t){t.classList.toggle('active',t.dataset.theme===theme)});
  document.documentElement.setAttribute('data-facility',theme);
  if(editMode){buildPalette()}
  lucide.createIcons();
  onScroll();render();
}
```
Replace with:
```js
function switchLayout(theme){
  currentTheme=theme;
  if(theme==='industrial'){
    PIECES=PIECES_IND;ORDER=ORDER_IND;HOTKEY=HOTKEY_IND;
    floorColor=getComputedStyle(document.documentElement).getPropertyValue('--m-floor-industrial').trim();gridColor=getComputedStyle(document.documentElement).getPropertyValue('--m-grid-industrial').trim();
    loadIndustrial();
  }else if(theme==='chemical'){
    PIECES=PIECES_CHEM;ORDER=ORDER_CHEM;HOTKEY=HOTKEY_CHEM;
    floorColor=getComputedStyle(document.documentElement).getPropertyValue('--m-floor-chemical').trim();gridColor=getComputedStyle(document.documentElement).getPropertyValue('--m-grid-chemical').trim();
    loadChemical();
  }else{
    PIECES=PIECES_RETAIL;ORDER=ORDER_RETAIL;HOTKEY=HOTKEY_RETAIL;
    floorColor=getComputedStyle(document.documentElement).getPropertyValue('--m-floor-retail').trim();gridColor=getComputedStyle(document.documentElement).getPropertyValue('--m-grid-retail').trim();
    loadDefault();
  }
  walkers=[];
  walkers.push(spawnWalker(2,6,0),spawnWalker(2,3,1),spawnWalker(1,1,2),spawnWalker(9,2,3));
  sensorStates=SENSOR_DEFS.map(function(){return{opacity:0,radius:0,tOp:0,tR:0}});
  document.querySelectorAll('.layout-tab').forEach(function(t){t.classList.toggle('active',t.dataset.theme===theme)});
  document.documentElement.setAttribute('data-facility',theme);
  if(editMode){buildPalette()}
  lucide.createIcons();
  onScroll();render();
}
```

Note: `PIECES_ENTERPRISE`/`ORDER_ENTERPRISE`/`HOTKEY_ENTERPRISE` (declared a few lines above, in the untouched THEME SYSTEM preamble) are now unused globals. Leave their declarations as-is — they're inert data assignments inside the "don't touch" line range (lines 882–887), and removing them would mean editing code this task is supposed to leave alone.

- [ ] **Step 5: Sanity-check the file has no leftover references to removed identifiers**

```bash
grep -n "cardOverlay\|enterprise-content\|PIECES_ENTERPRISE" shared/iso-engine.js
```
Expected: only 2 matches, both inside the untouched preamble (`var PIECES_ENTERPRISE=...` and `var HOTKEY_ENTERPRISE=...`), and zero matches for `cardOverlay` or `enterprise-content`.

- [ ] **Step 6: Commit**

```bash
git add shared/iso-engine.js
git commit -m "$(cat <<'EOF'
Extract isometric engine into shared/iso-engine.js

Moves the untouched piece-rendering/render-loop code out of the
monolithic website.html so it can be shared by the Main view without
dragging in page-specific glue.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Extract `views/main/main.js`

**Files:**
- Create: `views/main/main.js`
- Read (source only): `website.html`

**Interfaces:**
- Consumes: everything listed as "Produces" in Task 1 (`shared/iso-engine.js` must be loaded before this file).
- Produces: `onScroll`, `getActiveSection`, `animate`, `enterEdit`, `exitEdit`, `buildPalette`, `setEditTool`, `iconFor`, `handleSubmit`, `showToast`, `toggleMode` — called from `views/main/index.html` inline `onclick` attributes in Task 4.

- [ ] **Step 1: Extract lines 1422–1655 verbatim as a starting point**

```bash
sed -n '1422,1655p' website.html > views/main/main.js
```

- [ ] **Step 2: Remove the Card View section (moves to `views/card-tour/card-tour.js` in Task 6)**

In `views/main/main.js`, delete everything from the `/* ===== CARD VIEW ===== */` comment through the blank line right before `/* ===== LIGHT / DARK MODE TOGGLE ===== */` — i.e. delete this whole block:
```js
/* ===== CARD VIEW ===== */
var cardView=document.getElementById('card-view');
var isoBg=document.getElementById('iso-bg');
var contentEl=document.getElementById('content');
var editBtn=document.getElementById('edit-btn');
var editHint=document.getElementById('editHint');
document.getElementById('enterprise-content').style.display='none';
var layoutTabs=document.getElementById('layout-tabs');

var _cvIo=null,_cvStickerIo=null;
function initCardView(){
  ... (full function body as read from website.html lines 1552-1620) ...
}
```
`isoBg`, `contentEl`, `editBtn`, `editHint` are harmless re-declarations of the same globals already declared in the `EDIT MODE` section a few lines above (kept) — deleting this block removes the duplicates along with the Card-View-only code. `layoutTabs` was declared but never read anywhere in the original file; it's fine for it to disappear along with this block.

- [ ] **Step 3: Remove `openProductTour`/`closeProductTour` and the overlay click-listener**

The "Product Tour" trigger becomes a plain link in Task 4 (`<a href="/card-tour">`), so no JS is needed to open it, and there's no in-page overlay left to close. Delete:
```js
var cardOverlay=document.getElementById('card-overlay');
function openProductTour(){
  if(!cardOverlay)return;
  cardOverlay.style.display='block';
  requestAnimationFrame(function(){
    requestAnimationFrame(function(){
      cardOverlay.classList.add('open');
    });
  });
  document.body.style.overflow='hidden';
  cardView.scrollTop=0;
  /* Delay reinit so layout is computed */
  setTimeout(function(){if(typeof reinitCardIO==='function')reinitCardIO()},80);
  lucide.createIcons();
}
function closeProductTour(){
  if(!cardOverlay)return;
  cardOverlay.classList.remove('open');
  setTimeout(function(){
    cardOverlay.style.display='none';
  },350);
  document.body.style.overflow='';
  onScroll();render();
}
```
and delete this line further down:
```js
if(cardOverlay){cardOverlay.addEventListener('click',function(e){if(e.target===cardOverlay||e.target.classList.contains('cv-backdrop'))closeProductTour()})}
```
(Leave the blank line and the `/* Close on backdrop click */` comment's surrounding code otherwise untouched — just remove this one statement.)

- [ ] **Step 4: Fix the now-dangling `closeProductTour()` call in the Escape-key handler**

Find:
```js
  if(e.key.toLowerCase()==='escape'){if(editMode){exitEdit();return}closeProductTour();return}
```
Replace with:
```js
  if(e.key.toLowerCase()==='escape'){if(editMode)exitEdit();return}
```

- [ ] **Step 5: Remove the `initCardView()` call from INIT**

Find:
```js
buildPalette();render();animate();setTimeout(onScroll,100);
initCardView();
```
Replace with:
```js
buildPalette();render();animate();setTimeout(onScroll,100);
```

- [ ] **Step 6: Verify no dangling references remain**

```bash
grep -n "cardOverlay\|cardView\|initCardView\|openProductTour\|closeProductTour\|enterprise-content\|layoutTabs" views/main/main.js
```
Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add views/main/main.js
git commit -m "$(cat <<'EOF'
Extract Main view's page glue into views/main/main.js

Drops the dead Enterprise-overlay and Card-Tour-overlay wiring now
that those are separate pages, and fixes the resulting dangling
references (Escape key, INIT).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Extract `shared/tokens.css` and `views/main/main.css`

**Files:**
- Create: `shared/tokens.css`
- Create: `views/main/main.css`
- Read (source only): `website.html`

**Interfaces:**
- Produces: CSS custom properties (`--m-bg`, `--m-text`, `--m-floor-retail`, etc.) and base classes (`.badge`, `.bullet`, `.reveal`, `#legend`, `#edit-panel`, `#edit-btn`, `.edit-hint`, `.toast`, `.layout-tabs`, `#mode-toggle`) consumed by `views/main/index.html` markup in Task 4.

- [ ] **Step 1: Extract the design tokens + base UI chrome (lines 14–95)**

```bash
sed -n '14,95p' website.html > shared/tokens.css
```

- [ ] **Step 2: Extract the Tailwind light-mode overrides (lines 313–347)**

```bash
sed -n '313,347p' website.html > views/main/main.css
```

- [ ] **Step 3: Verify both files parse as valid CSS (no stray `<style>` tags leaked in)**

```bash
grep -n "<style\|</style" shared/tokens.css views/main/main.css
```
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add shared/tokens.css views/main/main.css
git commit -m "$(cat <<'EOF'
Extract Main view's CSS into shared/tokens.css and views/main/main.css

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Build `views/main/index.html`

**Files:**
- Create: `views/main/index.html`
- Read (source only): `website.html`

**Interfaces:**
- Consumes: `/shared/tokens.css`, `views/main/main.css`, `/shared/iso-engine.js`, `views/main/main.js` (all produced in Tasks 1–3).

- [ ] **Step 1: Extract the body markup (lines 374–436) as a starting point**

```bash
sed -n '374,436p' website.html > /tmp/main-body.html
```

- [ ] **Step 2: Edit the Enterprise tab to be a real link**

In `/tmp/main-body.html`, find:
```html
  <button class="layout-tab" data-theme="enterprise" onclick="switchLayout('enterprise')"><i data-lucide="building-2" class="w-3 h-3 inline-block align-middle mr-1" style="vertical-align:-2px"></i>Enterprise</button>
```
Replace with:
```html
  <a href="/enterprise" class="layout-tab" data-theme="enterprise"><i data-lucide="building-2" class="w-3 h-3 inline-block align-middle mr-1" style="vertical-align:-2px"></i>Enterprise</a>
```

- [ ] **Step 3: Edit the Product Tour trigger to be a real link**

In `/tmp/main-body.html`, find:
```html
        <button onclick="openProductTour()" class="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium rounded-full px-7 py-3 transition-all text-sm"><i data-lucide="layout-grid" class="w-4 h-4"></i> Product Tour</button>
```
Replace with:
```html
        <a href="/card-tour" class="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium rounded-full px-7 py-3 transition-all text-sm"><i data-lucide="layout-grid" class="w-4 h-4"></i> Product Tour</a>
```

- [ ] **Step 4: Write the head and tail wrapper files**

```bash
cat > /tmp/main-head.html <<'EOF'
<!DOCTYPE html>
<html lang="en" data-mode="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SURDS Tech Solutions — Industrial HVAC Intelligence</title>
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://unpkg.com/lucide@latest"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
<script>
tailwind.config={theme:{extend:{colors:{brand:'#FF006E','brand-hover':'#E60063','brand-purple':'#6B2D8F',dark:{900:'#0A0A0A',800:'#050505'}},fontFamily:{inter:['Inter','sans-serif'],mono:['Space Mono','monospace']}}}}
</script>
<link rel="stylesheet" href="/shared/tokens.css">
<link rel="stylesheet" href="main.css">
</head>
<body>

EOF
cat > /tmp/main-tail.html <<'EOF'

<script>
lucide.createIcons();
</script>
<script src="/shared/iso-engine.js"></script>
<script src="main.js"></script>
</body>
</html>
EOF
```

- [ ] **Step 5: Assemble the full page**

```bash
cat /tmp/main-head.html /tmp/main-body.html /tmp/main-tail.html > views/main/index.html
```

- [ ] **Step 6: Verify the assembled file has both edits and no leftover `onclick` calls to removed functions**

```bash
grep -n "openProductTour\|switchLayout('enterprise')" views/main/index.html
```
Expected: no output.

```bash
grep -c "layout-tab" views/main/index.html
```
Expected: `4` (retail button, industrial button, chemical button, enterprise link all carry this class).

- [ ] **Step 7: Serve locally and smoke-test in a browser**

```bash
python3 -m http.server 8000
```
Open `http://localhost:8000/views/main/index.html` and confirm:
- Hero renders, dark/light toggle works
- Retail/Industrial/Chemical tabs switch the isometric background live
- Edit Layout tool opens and places pieces
- Clicking "Enterprise" navigates to `/views/enterprise/index.html` (404 is expected until Task 5 — that's fine, confirms the link fires)
- Clicking "Product Tour" navigates to `/views/card-tour/index.html` (404 expected until Task 6)

Stop the server with `Ctrl+C` when done.

- [ ] **Step 8: Commit**

```bash
git add views/main/index.html
git commit -m "$(cat <<'EOF'
Add views/main/index.html

Assembles the Main view from the extracted markup, wired to
shared/iso-engine.js and the new main.css/main.js, with the
Enterprise tab and Product Tour button converted to page links.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Build `views/enterprise/index.html` and `views/enterprise/enterprise.css`

**Files:**
- Create: `views/enterprise/index.html`
- Create: `views/enterprise/enterprise.css`
- Read (source only): `website.html`

**Interfaces:** none (fully self-contained page — no shared CSS/JS dependency, confirmed by inspection: the `.ent-*` rules hardcode all colors and don't reference `var(--m-*)` tokens, and the markup uses raw inline `<svg>` icons rather than Lucide placeholders).

- [ ] **Step 1: Extract the Enterprise CSS (lines 96–211)**

```bash
sed -n '96,211p' website.html > views/enterprise/enterprise.css
```

- [ ] **Step 2: Add a top-level reset and flip the default visibility**

The original `#enterprise-content{display:none;...}` relied on JS to flip it to `display:block` when the Enterprise theme was selected. On its own page it should just always be visible. Also add the one global reset rule this page needs (originally supplied by the site-wide `*{margin:0;padding:0;box-sizing:border-box}` in `website.html` line 51, which this page no longer loads).

In `views/enterprise/enterprise.css`, find:
```css
#enterprise-content{display:none;font-family:'Inter',sans-serif;background:#fff;color:#1a1a2e}
```
Replace with:
```css
*{margin:0;padding:0;box-sizing:border-box}
.ent-back{display:inline-block;padding:12px 20px;font-size:13px;font-weight:600;color:#0038A8;text-decoration:none}
.ent-back:hover{text-decoration:underline}
#enterprise-content{font-family:'Inter',sans-serif;background:#fff;color:#1a1a2e}
```

- [ ] **Step 3: Remove the dead nav-override rules**

These rules target `.layout-tabs`, `.layout-tab`, `#mode-toggle`, `#edit-btn`, `.legend-chip` under `[data-facility="enterprise"]` — none of those elements exist on this standalone page. Find and delete this whole block from `views/enterprise/enterprise.css`:
```css
/* Nav overrides in enterprise */
[data-facility="enterprise"] body{background:#fff!important}
[data-facility="enterprise"] .layout-tabs{background:rgba(255,255,255,.92);border-color:rgba(0,56,168,.1);backdrop-filter:blur(16px)}
[data-facility="enterprise"] .layout-tab{color:rgba(26,42,78,.45)!important}
[data-facility="enterprise"] .layout-tab:hover{color:#0038A8!important;background:rgba(0,56,168,.06)!important}
[data-facility="enterprise"] .layout-tab.active{color:#fff!important;background:rgba(255,0,110,.25)!important;border-color:rgba(255,0,110,.3)!important}
[data-facility="enterprise"] .layout-tab[data-theme="enterprise"]{color:#c9a227!important;border:1px solid transparent!important}
[data-facility="enterprise"] .layout-tab[data-theme="enterprise"]:hover{color:#f0d060!important;background:rgba(201,162,39,.12)!important}
[data-facility="enterprise"] .layout-tab[data-theme="enterprise"].active{color:#1a1a1a!important;background:linear-gradient(135deg,#f0d060,#c9a227)!important;border-color:rgba(201,162,39,.5)!important;box-shadow:0 0 12px rgba(201,162,39,.35)!important}
[data-facility="enterprise"] #mode-toggle{background:rgba(255,255,255,.92);border-color:rgba(0,56,168,.1);color:#0038A8}
[data-facility="enterprise"] #edit-btn{background:rgba(255,255,255,.9);border-color:rgba(0,56,168,.12);color:#0038A8}

/* Legend */
[data-facility="enterprise"] .legend-chip{background:rgba(255,255,255,.92);border-color:rgba(0,56,168,.08);color:#0038A8;backdrop-filter:blur(12px)}
```

- [ ] **Step 4: Extract the Enterprise body markup (lines 440–692)**

```bash
sed -n '440,692p' website.html > /tmp/enterprise-body.html
```

- [ ] **Step 5: Write the head and tail wrapper files**

```bash
cat > /tmp/enterprise-head.html <<'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SURDS Enterprise — Facility Intelligence Platform</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="enterprise.css">
</head>
<body>
<a href="/" class="ent-back">&larr; Back to SURDS</a>
<div id="enterprise-content">

EOF
cat > /tmp/enterprise-tail.html <<'EOF'

</div>
</body>
</html>
EOF
```

- [ ] **Step 6: Assemble the full page**

```bash
cat /tmp/enterprise-head.html /tmp/enterprise-body.html /tmp/enterprise-tail.html > views/enterprise/index.html
```

- [ ] **Step 7: Verify no leftover references to elements that don't exist on this page**

```bash
grep -n "layout-tab\|mode-toggle\|edit-btn\|legend-chip\|data-lucide" views/enterprise/index.html views/enterprise/enterprise.css
```
Expected: no output.

- [ ] **Step 8: Serve locally and smoke-test**

```bash
python3 -m http.server 8000
```
Open `http://localhost:8000/views/enterprise/index.html` and confirm it renders identically to the old `#enterprise-content` section (hero, feature tiles, industry solutions, testimonials, security/compliance, stats, CTA, footer), and that "← Back to SURDS" navigates to `http://localhost:8000/views/main/index.html` once Task 4 is in place (it already is).

- [ ] **Step 9: Commit**

```bash
git add views/enterprise/index.html views/enterprise/enterprise.css
git commit -m "$(cat <<'EOF'
Add views/enterprise/index.html as a standalone page

Drops the dead nav-override CSS that targeted Main-page-only elements
and adds a back-to-site link, since Enterprise is no longer an
in-page theme switch.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Build `views/card-tour/`

**Files:**
- Create: `views/card-tour/index.html`
- Create: `views/card-tour/card-tour.css`
- Create: `views/card-tour/card-tour.js`
- Read (source only): `website.html`

**Interfaces:** none (self-contained — confirmed by inspection: `#card-view`'s CSS defines its own `--mat`/`--paper`/etc. custom properties and doesn't reference any `var(--m-*)` token from `shared/tokens.css`).

- [ ] **Step 1: Extract the card-view CSS (lines 213–311) and overlay CSS (lines 350–369)**

```bash
sed -n '213,311p' website.html > views/card-tour/card-tour.css
sed -n '350,369p' website.html >> views/card-tour/card-tour.css
```

- [ ] **Step 2: Add a tiny top-level reset to prevent a flash of unstyled body background**

Prepend this line to the top of `views/card-tour/card-tour.css`:
```css
*{margin:0;padding:0;box-sizing:border-box}body{background:#221a11}
```

- [ ] **Step 3: Extract the card-tour body markup (lines 710–837 — the scroll-show + scenes, excluding the outer overlay wrapper which is rebuilt by hand in Step 6)**

```bash
sed -n '710,837p' website.html > /tmp/card-tour-body.html
```

- [ ] **Step 4: Extract the isometric-init JS (lines 1552–1620) into a temp file**

```bash
sed -n '1552,1620p' website.html > /tmp/card-tour-init.js
```

- [ ] **Step 5: Write the head/tail JS wrapper and assemble `card-tour.js`**

`initCardView()` reads the module-level `cardView` variable and calls `window.reinitCardIO` indirectly; on the standalone page there's no tab-switch to trigger a reinit, so it just needs to run once on load.

```bash
cat > /tmp/card-tour-js-head.js <<'EOF'
var cardView=document.getElementById('card-view');
var cardOverlay=document.getElementById('card-overlay');

EOF
cat > /tmp/card-tour-js-tail.js <<'EOF'

/* Restore saved dark/light mode so #card-close and .cv-backdrop match the Main page */
(function(){
  var saved=localStorage.getItem('surds-mode');
  if(saved)document.documentElement.setAttribute('data-mode',saved);
})();

initCardView();
EOF
cat /tmp/card-tour-js-head.js /tmp/card-tour-init.js /tmp/card-tour-js-tail.js > views/card-tour/card-tour.js
```

- [ ] **Step 6: Write the HTML head/tail wrapper files**

```bash
cat > /tmp/card-tour-head.html <<'EOF'
<!DOCTYPE html>
<html lang="en" data-mode="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SURDS Product Tour — Live Spatial Twin</title>
<script src="https://unpkg.com/lucide@latest"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="card-tour.css">
</head>
<body>
<div id="card-overlay" class="open">
<div class="cv-backdrop"></div>
<div id="card-view">
<div class="card-scroll-progress"></div>
<a id="card-close" href="/"><i data-lucide="x" class="w-5 h-5"></i></a>
<div style="position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:300;display:flex;gap:4px;padding:4px;border-radius:999px;background:var(--mat);border:1px solid rgba(244,234,208,.15);backdrop-filter:blur(12px)">
  <a href="/" style="padding:6px 16px;border-radius:999px;font-size:11px;font-weight:500;color:rgba(244,234,208,.5);background:transparent;border:1px solid transparent;text-decoration:none;font-family:'Space Mono',monospace;letter-spacing:.02em;display:inline-block">← Back</a>
  <button style="padding:6px 16px;border-radius:999px;font-size:11px;font-weight:500;color:var(--rust-2);background:rgba(194,64,42,.15);border:1px solid rgba(194,64,42,.3);cursor:default;font-family:'Space Mono',monospace;letter-spacing:.02em">Product Tour</button>
</div>

EOF
cat > /tmp/card-tour-tail.html <<'EOF'

</div>
</div>
<script>lucide.createIcons();</script>
<script src="card-tour.js"></script>
</body>
</html>
EOF
```

- [ ] **Step 7: Assemble the full page**

```bash
cat /tmp/card-tour-head.html /tmp/card-tour-body.html /tmp/card-tour-tail.html > views/card-tour/index.html
```

Notes on this markup vs. the original:
- `#card-close` changes from `<button onclick="closeProductTour()">` to `<a href="/">` — same visual position/styling (its CSS selector is `#card-close`, unaffected by tag name), now navigates home instead of closing an overlay.
- The mini "← Back" control changes from `<button onclick="switchLayout('retail')">` to `<a href="/">` — on the original page this button's only observable behavior was to change the underlying facility theme (it did not close the tour), which doesn't apply once Card Tour is its own page. Navigating home is the closest faithful equivalent of "Back".
- `#card-overlay` carries `class="open"` directly in markup instead of that class being toggled by `openProductTour()` — its CSS (`#card-overlay.open{opacity:1}` etc., copied verbatim in Step 1) already renders correctly whenever `.open` is present at load, so no CSS changes are needed for this.

- [ ] **Step 8: Verify no leftover references**

```bash
grep -n "closeProductTour\|switchLayout\|onclick=" views/card-tour/index.html views/card-tour/card-tour.js
```
Expected: no output.

- [ ] **Step 9: Serve locally and smoke-test**

```bash
python3 -m http.server 8000
```
Open `http://localhost:8000/views/card-tour/index.html` and confirm:
- The plan sticker, scroll-driven layer reveals (thermal/furniture/people/flow/activity/hvac/anomaly/edge), and sticker pop-ins all animate the same as the old overlay
- The scroll progress bar fills
- "← Back" and the X button both navigate to `/views/main/index.html`

- [ ] **Step 10: Commit**

```bash
git add views/card-tour/
git commit -m "$(cat <<'EOF'
Add views/card-tour/ as a standalone page

Card Tour no longer overlays the Main page; its close/back controls
now navigate home instead of toggling overlay visibility.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Wire up routing and retire the monolithic file

**Files:**
- Modify: `vercel.json`
- Delete: `website.html`

**Interfaces:** none (final integration task).

- [ ] **Step 1: Read the current routing config**

```bash
cat vercel.json
```
Expected current content:
```json
{
  "routes": [
    { "src": "/(.*)", "dest": "/website.html" }
  ]
}
```

- [ ] **Step 2: Replace with exact-path routes for the three views**

Replace the contents of `vercel.json` with:
```json
{
  "routes": [
    { "src": "/", "dest": "/views/main/index.html" },
    { "src": "/enterprise", "dest": "/views/enterprise/index.html" },
    { "src": "/card-tour", "dest": "/views/card-tour/index.html" }
  ]
}
```
Everything else (`/shared/*.js`, `/shared/*.css`, `/views/*/*.css`, `/views/*/*.js`) is not matched by any of these three exact-path routes, so Vercel falls through to normal filesystem serving — no catch-all rule needed.

- [ ] **Step 3: Remove the old monolithic file**

```bash
git rm website.html
```
`backup/website.html` is a separate, untouched file — confirm it's unaffected:
```bash
git status
```
Expected: `backup/website.html` does not appear in the change list.

- [ ] **Step 4: Commit**

```bash
git add vercel.json
git commit -m "$(cat <<'EOF'
Route Main/Enterprise/Card-Tour to their own files, retire website.html

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Full local verification pass

**Files:** none — verification only.

**Interfaces:** none.

- [ ] **Step 1: Serve the whole repo root as static files**

```bash
python3 -m http.server 8000
```

- [ ] **Step 2: Verify Main (`/views/main/index.html` — this is what `/` will serve on Vercel)**

Walk through, in the browser:
- [ ] Dark/light toggle switches and persists across a reload (localStorage)
- [ ] Retail tab: pieces render, walkers roam, sensor cones sweep
- [ ] Industrial tab: switches to steel-factory pieces, floor/grid colors change
- [ ] Chemical tab: switches to chemical-plant pieces
- [ ] "Edit Layout" opens the palette, placing/erasing a piece works, Escape exits edit mode
- [ ] Scrolling through the 8 sections triggers the reveal animations
- [ ] Submitting the contact form shows the "Assessment request sent!" toast
- [ ] "Enterprise" link navigates to the Enterprise page
- [ ] "Product Tour" link navigates to the Card Tour page

- [ ] **Step 3: Verify Enterprise (`/views/enterprise/index.html`)**

- [ ] Page renders fully (hero, 8 feature tiles, 3 industry-solution cards, 4 testimonials, 6 compliance items, 4 stats, CTA, footer)
- [ ] "← Back to SURDS" returns to Main

- [ ] **Step 4: Verify Card Tour (`/views/card-tour/index.html`)**

- [ ] Scrolling through steps 1–9 reveals each layer and updates the step badge text
- [ ] Sticker pop-in animations fire as each scene scrolls into view
- [ ] Scroll progress bar fills as you scroll
- [ ] "← Back" and the X button both return to Main

- [ ] **Step 5: Stop the server**

```bash
# Ctrl+C in the terminal running the http.server
```

No code changes in this task — if any check fails, go back to the relevant task above and fix it there, then re-run this whole verification pass.
