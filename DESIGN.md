---
name: NULLIUS
description: A verifying console for Ethereum — deep ink-violet ground, one ultramarine field for the live proof walk, bone plates for dense bytes.
colors:
  void: "#0b0918"
  void-lift: "#120e26"
  void-edge: "#201a44"
  ultra: "#2b1de8"
  citron: "#dfff37"
  vermilion: "#ff3b21"
  vermilion-dim: "#b32410"
  bone: "#eceef4"
  bone-lift: "#f7f8fb"
  bone-edge: "#d3d6e4"
  ink: "#0b0918"
  ink-on-bone-muted: "#575b76"
  ink-on-void: "#f2f3f8"
  ink-on-void-muted: "#9aa0be"
  ink-on-ultra: "#ffffff"
  ink-on-ultra-muted: "#c3bdff"
typography:
  display:
    fontFamily: "Anybody Variable, Anybody, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.035em"
    fontVariation: "'wdth' 125"
  title:
    fontFamily: "Anybody Variable, Anybody, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.03em"
    fontVariation: "'wdth' 112"
  body:
    fontFamily: "Familjen Grotesk Variable, Familjen Grotesk, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  label:
    fontFamily: "Familjen Grotesk Variable, Familjen Grotesk, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0.1em"
  data:
    fontFamily: "Spline Sans Mono Variable, Spline Sans Mono, ui-monospace, monospace"
    fontSize: "0.6875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "-0.02em"
    fontFeature: "'tnum' 1"
  figure:
    fontFamily: "Spline Sans Mono Variable, Spline Sans Mono, ui-monospace, monospace"
    fontSize: "1.25rem"
    fontWeight: 400
    lineHeight: 1.15
    letterSpacing: "-0.03em"
    fontFeature: "'tnum' 1"
rounded:
  none: "0px"
spacing:
  gap-1: "6px"
  gap-2: "10px"
  gap-3: "16px"
  gap-4: "24px"
components:
  region-plate:
    backgroundColor: "{colors.bone}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
  region-field:
    backgroundColor: "{colors.ultra}"
    textColor: "{colors.ink-on-ultra}"
    rounded: "{rounded.none}"
  region-field-rejected:
    backgroundColor: "{colors.vermilion-dim}"
    textColor: "{colors.ink-on-ultra}"
  region-void:
    backgroundColor: "{colors.void-lift}"
    textColor: "{colors.ink-on-void}"
  action:
    textColor: "{colors.citron}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "7px 13px"
  action-hover:
    backgroundColor: "{colors.citron}"
    textColor: "{colors.ink}"
  action-quiet:
    textColor: "{colors.ink-on-void}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "7px 13px"
  action-quiet-hover:
    backgroundColor: "{colors.void-edge}"
    textColor: "{colors.ink-on-void}"
  admitted-chip:
    textColor: "{colors.ink-on-void}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "3px 8px 3px 6px"
  reading-row:
    backgroundColor: "{colors.bone}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "10px 16px"
  reading-row-current:
    backgroundColor: "{colors.bone-lift}"
    textColor: "{colors.ink}"
  act-rail-item:
    backgroundColor: "{colors.void}"
    textColor: "{colors.ink-on-void-muted}"
    rounded: "{rounded.none}"
    padding: "16px 0"
    width: "60px"
  act-rail-item-current:
    backgroundColor: "{colors.void-lift}"
    textColor: "{colors.citron}"
  radar-table-header:
    backgroundColor: "{colors.bone}"
    textColor: "{colors.ink-on-bone-muted}"
    typography: "{typography.label}"
    padding: "6px 16px"
  select-field:
    backgroundColor: "{colors.void}"
    textColor: "{colors.ink-on-void}"
    rounded: "{rounded.none}"
    padding: "4px 6px"
---

# Design System: NULLIUS

## Overview

**Creative North Star: "Trie Space"**

**Provenance of this direction.** Concept seed key `b3b89ea7` (`--scope direction --mode operate`), reproducible with `node .claude/skills/impeccable/scripts/concept-seed.mjs --scope direction --mode operate --from b3b89ea7 --candidate-count 7`. Two earlier rolls (`4ec29c46` → Security Engraving, `b0fd9900` → Philosophical Transactions) were re-rolled by the user, and the third roll's grounded list was rebuilt under a user steer pinning the world to contemporary, technical, non-generic territory: *"keep it modern techy aesthtci stylish vibes but don't keep it too generic."* The direction is therefore user-steered rather than purely dealt, and that steer outranks the roll. The same key is recorded in the direction contract in `apps/web/index.html`.

The interface is the data structure. NULLIUS does not draw a dashboard about verification; it draws the verification. A proof walk is sixteen real branch slots per row with the taken slot lit, root at the top, descending — and when a provider forges a proof, the path stops on a numbered row and the break is drawn where it happened. Nothing here is a status widget standing in for a computation. Every mark on screen is computed from real bytes, so a forgery is a different object on the page, not the same object wearing a red badge.

The world is built from pigment and structure rather than from accent colour. Ground is a deep ink-violet void, never neutral black and never grey, and there is no glow anywhere — no blur, no coloured shadow, no neon bloom. That single decision is what separates this from the dark-plus-neon dashboard default it refuses. Above the void float exactly two other materials: one saturated ultramarine field, which owns the live walk at page scale, and bone plates, which carry the dense data. The inversion is deliberate: 66-character hashes, wei figures and relay tables are the hardest things on the page to read, so they sit on light plates inside an expressive dark frame instead of fighting it.

Density is high and unapologetic. This is a console, not a landing page: a fixed 100dvh frame, regions separated by 1px hairlines rather than by cards or padding, and each region scrolling inside itself. The type does the work of hierarchy — a variable-width display face that stretches and compresses, a quiet grotesque for prose, and a monospace that every machine-produced byte is obliged to wear. The console refuses the card grid explicitly: cards hide structure behind panels, and the structure is the argument.

**Key Characteristics:**

- Deep ink-violet ground (#0b0918) with zero glow, zero blur, zero drop shadow
- Exactly one saturated ultramarine field on screen, owning the live proof walk
- Bone plates carry all dense data; the dark frame carries the argument
- Citron is the only high-energy colour; vermilion appears only where something failed
- Square corners everywhere — `border-radius` occurs zero times in the build
- Hairline 1px separation instead of cards; state is a 2px inset rule, never a shadow
- Trust is drawn as four distinct shapes, so the taxonomy survives a greyscale screenshot
- Generated trie geometry as ambient ground, painted once and drifted, not decorated

## Colors

An ink-violet ground with one committed saturated field, one high-energy signal, one failure pigment, and a light plate family for data — five materials total, no gradient ramps, no tints in between.

### Primary
- **Committed Ultramarine** (`ultra`): The field colour. It is a background at region scale, not an accent — exactly one region wears it, and that region is the live proof walk. It also draws `proven` marks and the 2px inset rule on the selected register row when those sit on a bone plate, and the share bar in the radar table. It is never used for body text and never for a hairline.
- **Signal Citron** (`citron`): The only high-energy colour in the world, and it carries exactly two jobs. First, verification: a taken slot tick, the walk path itself, a lit node in the ambient ground. Second, the live locus of interaction: the focus-visible outline, `::selection`, the primary action's border and label, the current act in the rail, the leading tally cell's top rule, and the busy indicator. On dark grounds it also takes over `proven` marks from ultramarine, because ultramarine on void does not carry.

### Secondary
- **Contradiction Vermilion** (`vermilion`) and **Contradiction Vermilion Deep** (`vermilion-dim`): The failure pigment, spent only where the system is admitting something negative. Full vermilion draws the broken slot tick, the broken path, the drawn break marker, the `rejected` mark, a silent route's label, the filtering-relay inset rule, and the left border of every caveat. The deep variant is the same statement on a bone plate, where full vermilion is too loud: struck-through rejected values, filtering posture labels, the radar's filtered-share figure, read errors. When a verdict is `REJECTED`, `vermilion-dim` replaces ultramarine as the entire field background.

### Neutral
- **Ink Violet Void** (`void`): The ground and the act rail. The page background, and the one colour that is never allowed to become black or grey.
- **Ink Violet Lift** (`void-lift`): The one step up from ground. The admitted-assumptions bar, the lower sub-panels, hover and current states in the rail. This is the entire elevation vocabulary on the dark side.
- **Ink Violet Edge** (`void-edge`): Every hairline and grid gap on the dark side, the quiet action's border, the resting tally rule, and the select field's border.
- **Bone** (`bone`): The data plate. Register and radar regions, and the sticky radar table header.
- **Bone Lift** (`bone-lift`): Register row hover and current state — the only light-side elevation move.
- **Bone Edge** (`bone-edge`): Every hairline inside a bone plate, including row dividers and table rules.
- **Ink** (`ink`), **Muted Ink on Bone** (`ink-on-bone-muted`): Primary and secondary text on plates. The muted value carries labels, rubrics, provenance keys, and table headers — most of the plate's text is muted, and the value itself is full ink or mono.
- **Ink on Void** (`ink-on-void`), **Muted Ink on Void** (`ink-on-void-muted`): Primary and secondary text on the dark side; the muted value also colours the neutral `attested` and `unverifiable` marks there.
- **Ink on Ultra** (`ink-on-ultra`), **Muted Ink on Ultra** (`ink-on-ultra-muted`): White and a violet-tinted white for text inside the ultramarine field. The muted value carries the walk's node hashes, depth numerals, legend and prose.

### Named Rules

**The One Field Rule.** Exactly one region on screen wears saturated ultramarine, and it is always the region carrying the live computation. Ultramarine is a field, not an accent: if a second surface takes it, the page has two centres and neither is the walk.

**The Pigment Ground Rule.** The ground is ink-violet (#0b0918) and stays saturated. Never `#000`, never a grey. No glow, no blur, no coloured shadow, no bloom — the world is separated from the dark-neon default by pigment and structure, and reaching for a glow gives that separation away.

**The Single Signal Rule.** Citron carries verification and the live locus of interaction, and nothing else. It never fills a large area, never decorates a heading, and never marks a category. Its rarity is what makes a lit path read as proof.

**The Unearned Claim Rule.** Vermilion appears only where the system is admitting something negative: a proof that broke, a route that went silent, a relay that filters, or a caveat about a claim not yet earned. It is never a brand colour and never an emphasis colour.

**The Verdict-At-Field-Scale Rule.** A rejected verdict repaints the whole field surface (`vermilion-dim`) rather than adding a badge. Verdicts belong to the largest surface involved, because a verdict a reader can miss is a verdict the interface did not deliver.

**The Plate Inversion Rule.** Dense machine data — hashes, addresses, wei figures, relay tables — lives on bone plates. If a new surface carries a table or a hash column, it is a plate; if it carries an argument, a state, or a computation, it is void or field.

## Typography

**Display Font:** Anybody Variable (falling back to Anybody, then `system-ui`)
**Body Font:** Familjen Grotesk Variable (falling back to Familjen Grotesk, then `system-ui`)
**Label/Mono Font:** Spline Sans Mono Variable (falling back to Spline Sans Mono, then `ui-monospace`)

All three are self-hosted variable faces, imported through `@fontsource-variable` at the app entry. No webfont CDN, no system display face.

**Character:** Anybody is a variable-width technical display face and it is used as one — its width axis, not its weight, is the expressive channel. Against it, Familjen Grotesk is deliberately plain and quiet, and Spline Sans Mono is the obligation the data wears. The pairing reads as instrument panel rather than editorial: engineered, tightly tracked, no warmth asked for and none given.

### Hierarchy

- **Display** (800, 1.75rem, width 125%, tracking -0.035em, line-height 1): The wordmark only. One instance per page.
- **Title** (700, 1.25rem, width 112%, tracking -0.03em, line-height 1): Region headings. The width axis drops from the wordmark's 125% so region titles read as the same voice one level down.
- **Numeral** (700, 1.25rem, width 75%, tracking +0.06em): Act rail numerals — the same face compressed hard, the one place the width axis goes narrow. Distinct enough to read as a mechanical index rather than a heading.
- **Body** (400, 0.8125rem, line-height 1.55–1.65): All prose — walk narration, radar summary, caveats, admitted notes. Base body size is 0.9375rem but almost all real prose sits one step down at 0.8125rem, which is the size to reach for.
- **Label** (400, 0.6875rem, tracking 0.1–0.16em, uppercase): Region notes, table headers, provenance keys, trust words, tally keys, the admitted-bar lede. Tracking widens with the label's remoteness from its content — 0.1em inline, 0.16em for the vertical rail titles.
- **Data** (400, 0.6875rem, tabular figures, tracking -0.02em, mono): Timings, addresses, roots, receipt times.
- **SVG label** (`--svg-label`, 9 user-space units, mono): Node hashes and depth indices inside the walk. The one size deliberately off the screen ramp, because it is not a screen size — the walk's `viewBox` is 340 units wide and scales to its pane (~2.8× on a desktop console), so 9 units renders around 25 screen px. Any new text drawn inside an SVG viewBox uses this token rather than a rem step; a rem inside a scaled viewBox would fight the scaling instead of riding it.
- **Figure** (400, 1.25rem, tabular figures, tracking -0.03em, mono): The values that are the point — a register row's balance, the radar's filtered-share percentage.

### Named Rules

**The Width-Axis Rule.** Emphasis in the display face is carried by Anybody's width axis (125% wordmark / 112% region title / 75% act numeral), not by piling on weight or size. A new display element picks a width before it picks a size.

**The Two-Direction Tracking Rule.** Display type tightens (-0.03em to -0.035em); uppercase labels open (0.1em to 0.16em). Nothing sits in between at default tracking and pretends to be either.

**The Mono-For-Bytes Rule.** Every value a machine produced — hash, address, wei amount, millisecond, percentage, count, nullifier — is Spline Sans Mono with tabular figures. Every sentence a human wrote is Familjen Grotesk. The typeface is the reader's fastest cue for what is asserted versus what is measured, and mixing the two erases it.

**The Companion Label Rule.** Uppercase micro-labels sit baseline-aligned *beside* their heading in a flex row (region title + region note, sub title + sub note), never stacked above it. This world has no kickers and no eyebrows; an uppercase line above a heading is a different system.

## Layout

The frame is a fixed console, not a document. At the top level a CSS grid lays out four named areas — `head`, `admitted`, `stage`, `rail` — as `1fr` plus a 60px rail column, sized to `100dvh` with `overflow: hidden`, so the page itself never scrolls. The generated trie ground is `position: fixed` at `z-index: 0`; the console sits above it at `z-index: 1`.

The stage is a 2×2 grid: `register` (min 340px, 33% of the stage) beside `walk`, with `radar` beside `lower` underneath, at row proportions 1.3fr / 1fr. Regions are separated by a 1px grid `gap` with the stage's own background showing through as `void-edge` — the separation *is* the grid, so there are no card borders to reconcile. The `lower` region splits again into two equal sub-panels (flight recorder, quorum) on the same 1px gap.

Three region skins carry all surfaces: a bone plate (`.region--plate`), the ultramarine field (`.region--field`), and a lifted void panel (`.region--void`). Each is a column flexbox with a fixed head and a `flex: 1; min-height: 0; overflow: auto` body, and every one of them declares `min-width: 0` — without it the radar table's min-content width propagates up and widens the whole page.

The spacing rhythm is tight and four-valued: 6px, 10px, 16px, 24px. 10px is the workhorse (inline gaps, vertical row padding), 16px the standard horizontal region inset, 24px reserved for masthead and outer padding. Prose is capped by explicit measure between 52ch and 68ch depending on the column it sits in; the admitted-assumptions note is the widest at 68ch.

**Responsive.** Two breakpoints, both collapsing rather than rearranging. At **1080px** the stage becomes a single column in reading order (register, walk, radar, lower), the console releases `100dvh` for `min-height: 100dvh` with `overflow-x: clip`, regions release their internal scroll to the page, and the act rail rotates into a horizontal `position: sticky; bottom: 0` bar with its titles set horizontal and its current-marker moved from a left edge to a bottom edge. The radar region keeps `overflow-x: auto` so the table scrolls inside itself instead of forcing the page sideways. At **620px** the masthead wraps, the anchor block takes a full row, and the register row drops to two columns with the trust word moving under the value.

### Named Rules

**The Hairline Grid Rule.** Regions are divided by 1px grid gaps and 1px borders in `void-edge` (dark) or `bone-edge` (light). No card, no radius, no shadow, no padded gutter standing in for a rule.

**The Self-Scrolling Region Rule.** Above 1080px nothing scrolls except a region body; the console is a fixed instrument. Below it, the console becomes one page-scrolled column and the rail sticks to the bottom. There is no intermediate layout.

**The min-width: 0 Rule.** Every flex or grid child that can contain a hash, an address, or a table declares `min-width: 0`, and long values break with `word-break: break-all` or `overflow-wrap: anywhere`. Dense data must never be allowed to set the page's width.

## Elevation & Depth

There are no drop shadows. The build declares two lift tokens and uses neither; every `box-shadow` in the stylesheet is a 2px `inset` rule serving as a state marker. Depth is entirely tonal and structural: three ink-violet steps on the dark side (`void` ground → `void-lift` panel → `void-edge` hairline), two on the light side (`bone` plate → `bone-lift` hover), plus one z-layer of fixed generated geometry beneath everything. A plate reads as raised because it is a different material, not because it is casting light.

### Shadow Vocabulary

- **Current-row rule** (`box-shadow: inset 2px 0 0 var(--ultra)`): The selected register row. Ultramarine because the row's proof is what the field is currently drawing.
- **Filtering-relay rule** (`box-shadow: inset 2px 0 0 var(--vermilion)`): The first cell of a relay row whose operator publicly filters transactions.

### Named Rules

**The Flat-Console Rule.** No element casts a shadow. If a surface needs to read as raised, it changes material (void → void-lift, bone → bone-lift) or gains a hairline. The two `--lift-*` tokens are unused reserve and must not be introduced to solve a hierarchy problem that tone can solve.

**The Inset-State Rule.** Selection and posture are marked with a 2px inset rule on the leading edge, coloured by meaning (ultramarine for the active proof, citron for the current act, vermilion for a filtering route). The rail's current act draws the same 2px edge as an absolute pseudo-element, which flips from left edge to bottom edge below 1080px.

## Shapes

Every corner is square. `border-radius` appears zero times in the entire build, on plates, buttons, chips, table cells, inputs and marks alike — the only curves in the world are the bezier links in the generated trie ground and one 7px-radius circle in the rail's busy indicator, both of which are drawn geometry rather than UI chrome.

Form language is orthogonal and hairline. Strokes are 1px for structure (borders, grid gaps, table rules, ground links), 1.25px for authored mark geometry, and 1.5px for the walk's path, break marker and route marks. Marks are drawn on a 12×12 viewBox and inherit `currentColor`, so a mark's colour comes from its region rather than from its own definition.

Two textures exist, both meaning the same thing. A `repeating-linear-gradient` at -45° with a 1px light line every 3–4px hatches the admitted-assumption chips and the value of any unverifiable reading; an SVG `<pattern>` at the same angle hatches the interior of the `unverifiable` mark. Hatching is the only fill texture in the system.

### Named Rules

**The Square Corner Rule.** `border-radius: 0` is the world, not a default to override. A rounded corner anywhere reads as an imported component.

**The Hatch-Means-Missing Rule.** Diagonal hatching at -45° means *a proof would go here and does not*. It marks admitted assumptions and unverifiable values, and it may never be used as decoration or as a texture for something the system actually verified.

**The Three-Weight Stroke Rule.** 1px structure, 1.25px mark geometry, 1.5px path and route. New drawn elements pick one of the three rather than inventing a weight.

## Components

### Trust Marks (signature component family)

Four authored SVG glyphs on a 12×12 grid, one stroke weight (1.25), all `fill: none` + `currentColor`, all `aria-hidden` because a text trust word always sits beside them. They are drawn, never borrowed from an icon font or a glyph set.

- **Proven:** a solid filled 9×9 square — closed, complete.
- **Attested:** an open square with one to three interior witness ticks, count driven by the real number of corroborating providers (clamped 1–3).
- **Unverifiable:** a dashed square (`stroke-dasharray: 2 1.5`) with a hatched interior — a space where a proof would go.
- **Rejected:** a square broken open on one side with the break drawn as a crossed pair of strokes — a proof was offered and it failed.
- **Colour binding:** `proven` is ultramarine on a bone plate and citron on any void or sub-panel surface; `attested` and `unverifiable` are the muted ink of whichever ground they sit on; `rejected` is always vermilion.
- **RouteMark** is the same family for delivery channels, at 1.5px: a line into a filled dot (acknowledged), a line trailing into two dots (silent), a line stopped by a vertical bar (refused), a dashed line (submitted). These set colour inline rather than through a class.

**The Non-Colour Channel Rule.** Trust is never encoded by colour alone. Every trust level carries a distinct silhouette *and* a spelled-out word ("Proven" / "Reported" / "Unattested" / "Rejected"), and a rejected value additionally takes a strikethrough. Audit test: screenshot any surface in greyscale — if you cannot still tell the four levels apart, the surface is wrong. PRODUCT.md makes the three trust levels a product-level concept and requires unverifiable values to be visibly marked; the shape channel is how that requirement is met.

### The Walk (signature component)

The reason the world was chosen. Each row is one real trie node from the proof, in order, root at the top, on a 340-unit viewBox with 21px rows and a 10px top pad. A branch row draws all sixteen slots that actually exist in a Merkle-Patricia branch node as 2.5×10 ticks between x=42 and x=258, with the genuinely descended slot lit citron; extension and leaf rows draw a single bar spanning exactly the nibbles they consume. Row rules are near-invisible white (13% alpha) and lift to translucent citron (40%) for rows the path reached. Each row carries its depth numeral on the left and a `br`/`ex`/`lf` kind plus eight hex characters on the right, both at 9px mono.

The path is a citron `polyline` at 1.5px that animates its own measured length via a `--len` custom property. A mismatched node draws no rule and no tick — it states `≠ parent reference` in full-strength text instead, because a path segment through a node that did not verify would be a drawn lie. The break marker is two crossed vermilion strokes below the last node that genuinely verified, and the field behind it turns `vermilion-dim`.

### Buttons

Every interactive element in this system is a real `<button>` with the browser chrome stripped (`background: none; border: 0`), inheriting font and colour, and disabled buttons drop to 0.45 opacity with `not-allowed`.

- **Action (primary):** square, 7px/13px padding, 1px citron border and citron label on a transparent ground. Hover fills solid citron with ink text over 140ms. This is the only filled-on-hover control in the world.
- **Action quiet:** the same box with a `void-edge` border and `ink-on-void` label; hover fills `void-edge` and keeps its text colour. Used where several sibling choices exist and none should shout — the quorum's for/against/abstain triplet.
- **Focus:** universal `:focus-visible` outline, 2px citron with a 2px offset. Never removed, never restyled per component.

### Chips

- **Admitted-assumption chip:** an inline-flex box with a 1px `void-edge` border, hatched -45° ground, 0.6875rem label, and a 9×9 dashed-square SVG before the text. Border brightens to muted ink on hover and while expanded (`aria-expanded="true"`). A dormant boundary (`data-dormant="true"`) drops to 0.45 opacity rather than disappearing — the assumption is still admitted even when it is not currently load-bearing.

### Cards / Containers

There are no cards. Containers are the three region skins described in Layout, each square-cornered, borderless, and separated from its neighbours by the stage's 1px grid gap. Internal padding is 16px horizontal with a 16px/10px head and a 16px bottom.

- **Register reading row:** a full-width button laid out as a 3-column grid (18px mark / 1fr / auto) spanning two rows — mark, label, trust word on the first; the mono value and its rubric below. Hover and current state both go to `bone-lift`; current adds the 2px ultramarine inset. A rejected row strikes its value in `vermilion-dim`; an unverifiable row hatches behind it.
- **Receipt row:** a 14px/1fr/auto grid with a `void-edge` top border, route mark, label with dimmed channel and error text, and a mono time on the right. A silent route's label turns full vermilion.
- **Tally:** three equal cells, each a 2px `void-edge` top rule over a mono figure and an uppercase key; the leading cell's rule turns citron.
- **Caveat:** a 1px vermilion left border with 10px of padding on a 0.6875rem line. This is the standing form for any statement about what the system has *not* proven.
- **Provenance block:** a two-column `<dl>` on a bone plate — uppercase muted keys, mono full-ink values that break anywhere.

### Inputs / Fields

The system has one form control, the quorum's member `<select>`: mono face, `void` ground, `ink-on-void` text, 1px `void-edge` border, 4px/6px padding, square. It relies on the universal citron focus ring rather than a bespoke focus treatment. It is currently styled inline rather than through a class — new fields should follow these values but define them in the stylesheet.

### Navigation

- **Act rail:** a 60px `<nav>` on the void ground with a `void-edge` left border, filling the console's full height. Each act is an equal-flex button stacking a compressed display numeral over a `writing-mode: vertical-rl` uppercase title at 0.16em tracking, divided by hairlines. Resting state is muted ink; hover lifts to full ink on `void-lift`; `aria-current="true"` turns the label citron and draws a 2px citron left edge. The rail foot holds a single 18px circle that switches to a citron dashed stroke while the app is busy — the system's only loading indicator.
- Below 1080px the rail becomes a horizontal sticky bottom bar, titles turn horizontal, dividers move to the right edge, and the current marker becomes a 2px bottom edge.

### Trie Ground (signature component)

The world's material, generated rather than decorated. Seven levels of trie geometry are painted once into a canvas at capped DPR (max 2) sized to `max(1.35 × viewport height, 900px)`, using a seeded `mulberry32` PRNG so the field is identical on every load. Links are 1px bezier curves in a cool violet-white whose alpha decays with depth from 0.075 to a 0.014 floor; nodes are ~1px dots at the same decaying alpha, with roughly 4.5% of them lit citron at 0.16 alpha. Animation is a single `translate3d` parallax — ±10px on a 90-second cycle, ±6px on a 130-second one — so the cost is one paint plus a transform per frame rather than thousands of paths. Under `prefers-reduced-motion` the drift loop never starts and the field is simply static.

Its fan is capped at 4 → 3 → 2 children rather than the real 16, deliberately, so the ambient field stays legible; the honest sixteen appear only in the walk, where they are load-bearing.

### Motion

Two easings and three durations, all tokenized: `ease-out` (a long 0.16/1/0.3/1 settle) for state and background transitions, `ease-snap` for things landing; 140ms for hover and colour, 320ms for landing and field changes, 720ms for the path draw-in. Hover transitions are always the 140ms pair and always name their properties. The walk has exactly three animations: the path draws itself along its own measured length, each taken slot tick scales up from 0.2 with a `row.index × 55ms` stagger, and one authored moment — a vermilion gradient crossing the field once when a verdict turns rejected. `prefers-reduced-motion` collapses all three duration tokens to 1ms.

## Do's and Don'ts

### Do:

- **Do** keep exactly one ultramarine field on screen, and give it to the live computation (The One Field Rule).
- **Do** put every hash, address, wei figure and table on a bone plate; keep the argument, the state and the computation on void or field (The Plate Inversion Rule).
- **Do** spend citron only on verification and on the live locus of interaction — focus ring, primary action, current act (The Single Signal Rule).
- **Do** reserve vermilion for what failed or what the system has not earned, and carry any such statement in the standing caveat form: a 1px vermilion left border (The Unearned Claim Rule).
- **Do** give every trust state a distinct drawn silhouette *and* a spelled-out word, and test it in greyscale (The Non-Colour Channel Rule).
- **Do** set machine-produced values in Spline Sans Mono with tabular figures and human sentences in Familjen Grotesk (The Mono-For-Bytes Rule).
- **Do** reach for Anybody's width axis (125% / 112% / 75%) before reaching for weight or size (The Width-Axis Rule).
- **Do** separate surfaces with 1px hairlines in `void-edge` or `bone-edge`, and mark state with a 2px inset leading-edge rule (The Hairline Grid Rule, The Inset-State Rule).
- **Do** declare `min-width: 0` on any flex or grid child that can hold a hash or a table, and break long values (The min-width: 0 Rule).
- **Do** cap prose measure between 52ch and 68ch.
- **Do** draw new icons as SVG on the 12×12 grid at 1.25px in `currentColor`, `aria-hidden`, with a text label beside them.
- **Do** take every duration and easing from the motion tokens, so `prefers-reduced-motion` reaches it.

### Don't:

- **Don't** use `#000`, a neutral grey, or a glow, blur, bloom, or coloured shadow anywhere. The ground stays saturated ink-violet and the world stays flat (The Pigment Ground Rule, The Flat-Console Rule).
- **Don't** round a corner. `border-radius` does not occur in this build and should not start (The Square Corner Rule).
- **Don't** build a card grid. Structure is separated by hairlines and grid gaps; panels that hide structure are the thing this interface refuses.
- **Don't** communicate a verdict with a badge when a field is available — repaint the surface (The Verdict-At-Field-Scale Rule).
- **Don't** introduce the unused `--lift-1` / `--lift-2` shadows to solve a hierarchy problem; change material or add a hairline instead.
- **Don't** hatch anything the system actually verified. Hatching means a missing proof (The Hatch-Means-Missing Rule).
- **Don't** stack an uppercase micro-label above a heading. Labels sit baseline-aligned beside their title; this world has no kickers or eyebrows (The Companion Label Rule).
- **Don't** let citron fill a large area, tint a heading, or distinguish a category — it stops reading as proof the moment it is common.
- **Don't** write a literal duration into a keyframe or transition. Hardcoded timings escape the reduced-motion override.
- **Don't** style a new component with inline `style` props. Inline styling exists in the build and is a debt, not a pattern; new surfaces belong in the stylesheet.
- **Don't** draw a path, tick, or link through a node that did not verify. If a value is not proven, the drawing says so rather than completing the picture.
