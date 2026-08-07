---
name: Elchi
description: A free Korea ↔ Uzbekistan parcel board dressed as par-avion stationery.
colors:
  paper: "#EDE9DC"
  card: "#FCFBF6"
  ink: "#1B2A4A"
  blue: "#2A4B8D"
  red: "#B53333"
  gold: "#C79A3E"
  gold-lit: "#D9AC50"
  gold-deep: "#816428"
  edge: "#E9E5D8"
  rule: "#E4E0D2"
  body: "#5A6272"
  faint: "#64686F"
  faint-on-ink: "#9FA4AF"
  field: "#D8D3C4"
  green: "#047857"
  green-deep: "#065F46"
typography:
  display:
    fontFamily: "Inter Tight, ui-sans-serif, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  headline:
    fontFamily: "Inter Tight, ui-sans-serif, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Inter Tight, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1.25
  body:
    fontFamily: "Inter Tight, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14.5px"
    fontWeight: 400
    lineHeight: 1.5
  meta:
    fontFamily: "Inter Tight, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.3
  label:
    fontFamily: "Space Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "10.5px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "1px"
  stub:
    fontFamily: "Space Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.025em"
rounded:
  stamp: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  pill: "9999px"
spacing:
  hair: "4px"
  tight: "8px"
  snug: "12px"
  base: "20px"
  roomy: "24px"
components:
  card-feed:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "20px"
    height: "220px"
  stamp-traveler:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.card}"
    rounded: "{rounded.stamp}"
    padding: "6px 8px"
    typography: "{typography.label}"
  stamp-request:
    backgroundColor: "{colors.red}"
    textColor: "{colors.card}"
    rounded: "{rounded.stamp}"
    padding: "6px 8px"
    typography: "{typography.label}"
  button-open:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
    typography: "{typography.label}"
  button-open-hover:
    backgroundColor: "{colors.gold-lit}"
  button-submit:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.card}"
    rounded: "{rounded.md}"
    padding: "14px 16px"
  button-submit-hover:
    backgroundColor: "{colors.ink}"
  button-ghost:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "12px 24px"
    typography: "{typography.label}"
  input-text:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "12px"
  chip-unselected:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "8px 15px"
    typography: "{typography.stub}"
  chip-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.card}"
    rounded: "{rounded.pill}"
    padding: "8px 15px"
    typography: "{typography.stub}"
  sheet:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "0 24px 32px"
    width: "560px"
---

# Design System: Elchi

## Overview

**Creative North Star: "The Airmail Board"**

Elchi looks like a par-avion envelope pinned to a wall. The page is cream stock, the type is
navy ink, and the one piece of ornament in the whole product — a diagonal blue-and-red weave —
is the airmail border lifted off the edge of an international letter. Every post is a small
card of lighter stock sitting on that page, wearing a rubber-stamp chip in the corner that says
what kind of thing it is. Nothing else decorates. The board is a place where two strangers read
one fact each and then leave.

The system is deliberately post-industrial rather than product-shiny. Mono type does the
labelling — small, uppercase, wide-tracked, the way a form or a customs declaration labels its
fields — while the sans carries everything a human actually reads. Density is high but not
tight: cards are a fixed 220px in a single 680px column, so scanning down the feed is a rhythm,
not a hunt. The interface is quiet on purpose; the only saturated colour on screen is the stamp
and the one gold button that opens a post.

This world was arrived at by subtraction, and the subtractions are load-bearing history. An
earlier version had a navy boarding-pass stub with dashed perforation and two punch notches on
every card; it ate a quarter of a 375px screen and it is gone. The stamp chips used to be
tilted; the tilt threw their baseline off against the card's straight rules and it is gone.
Announcements — a third post type with a solid gold stripe — are gone. What survived is the
weave, the stamp, and the paper. **Confirmed anti-reference: the removed stub, perforation,
notches and tilted stamps. Do not reintroduce ticket ornament.**

**Key Characteristics:**
- Cream paper (`#EDE9DC`) under near-white card stock (`#FCFBF6`), navy ink on both.
- One ornament: the -45° blue/red/cream airmail weave, at the page top and on every card's left
  edge.
- Rubber-stamp chips carry post type by colour: navy-blue = traveler, brick-red = request.
- Mono for labels and machine facts, sans for human copy. No third font.
- Gold is a background and a stamp, never a text colour on light stock.
- Fixed-height cards in one narrow column; symmetric treatment for both post types.
- Every text pairing is measured against WCAG AA on the background it actually lands on.

## Colors

A stationery palette: aged cream, navy ink, and two postal saturates, with gold reserved for the
single action that matters.

### Primary
- **Envoy Navy** (`ink`): the ink of the whole board — body headings, card titles, the dark
  chips, the theme-color meta. Also the shadow hue: every elevation value is navy at low alpha,
  never neutral black.
- **Airmail Blue** (`blue`): the traveler stamp, one of the two weave threads, and links. It is
  the "someone is flying" colour.

### Secondary
- **Postal Red** (`red`): the request stamp, the second weave thread, error text, and the fill
  of the intro note card. It is the "someone has a parcel" colour and it is also the error
  colour — these never collide because errors never appear on a card.

### Tertiary
- **Stamp Gold** (`gold`) / **Stamp Gold, Lit** (`gold-lit`): the open-post button and accents.
  **Background only.**
- **Deep Gold** (`gold-deep`): the same hue rebuilt as *text* on light stock.

### Neutral
- **Aged Cream** (`paper`): page background. Deliberately darker than a naive off-white so a
  card reads as a thing sitting on the page rather than a lighter patch of it.
- **Letter Stock** (`card`): card and sheet background — and light text on navy.
- **Envelope Edge** (`edge`): card borders.
- **Ruled Line** (`rule`): dividers, footer rules, secondary borders.
- **Written Grey** (`body`): body copy.
- **Docket Grey** (`faint`): meta lines, placeholders, form labels.
- **Docket Grey on Ink** (`faint-on-ink`): the same muted role on navy. A light-on-dark twin,
  because one value cannot clear AA in both directions.
- **Field Edge** (`field`): input borders and the sheet's drag handle.
- **Dispatch Green** (`green`) / **Dispatch Green, Deep** (`green-deep`): the phone/call
  affordance only.

### Named Rules

**The Measured Pairing Rule.** Every text colour clears WCAG AA (4.5:1) against the background
it actually lands on, and the measured ratio is written into the comment beside the token in
`src/index.css`. A colour that cannot clear AA in both roles ships as two tokens rather than
being compromised into a muddy middle that serves neither. `gold`/`gold-deep` and
`faint`/`faint-on-ink` exist for exactly this reason.

**The Gold-Is-A-Stamp Rule.** `gold` is 2.50:1 on card stock. It may be a fill, a chip, or a
button background. It may never be text or a border carrying meaning on paper or card. Use
`gold-deep` when the colour must be read.

**The Two Threads Rule.** Blue and red are the two post types, and the weave is both of them at
once. Never introduce a third stamp colour without a third post type to justify it — the gold
stripe died with the announcement type and is not available for reuse.

## Typography

**Display / Body Font:** Inter Tight (falling back to `ui-sans-serif`, `system-ui`)
**Label / Mono Font:** Space Mono (falling back to `ui-monospace`, `SFMono-Regular`)

**Character:** A tight grotesque doing all human reading, against a typewriter mono doing all
machine labelling. The pairing is a customs form: the fields are stamped, the content is
written. The mono is never used for a sentence; the sans is never used for a field label.

### Hierarchy
- **Display** (700, 19px, 1.25, tracking-tight): the route line on a card at `sm` and up —
  "Koreya ✈ O'zbekiston".
- **Headline** (700, 17px, 1.25, tracking-tight): the same route line below `sm`.
- **Title** (700, 15px, 1.25): the hard facts under the route — the flight date, the cargo
  weight. Always `ink`, always bold, so the two scan as one class of information.
- **Body** (400, 14–14.5px, 1.5): the note preview and sheet copy, in `body` grey. Clamped to
  two lines on a card.
- **Meta** (400, 13px): the author line in a card footer, in `faint`.
- **Label** (700, 10.5px, +1px tracking, uppercase, mono): stamp chips, form field labels,
  section headers inside the composer.
- **Stub** (400, 11–12px, +0.025em, mono): the city line on a card, chip text, counters — the
  small machine-set facts that are not labels.

### Named Rules

**The Two-Register Rule.** Mono means "the system is telling you a fact or naming a field".
Sans means "a person wrote this". A mono sentence or a sans field label is a bug, not a style
choice.

**The Uzbek-Only Rule.** No copy is hardcoded in a component. All strings resolve through
`src/translations.ts`, including month names (`t.months`) — three components previously kept
private copies of those and drifted.

## Layout

One column, 680px maximum, centred, with a 20px horizontal inset at every width (`max-w-[680px]
mx-auto px-5`). There is no multi-column feed at any breakpoint; the board is a list and reads
like one on a phone and a desktop alike.

Cards are a pinned 220px tall. The height is not incidental: cards stack in a single column, and
a card that sizes to its own text makes that column ragged. The note preview's two-line clamp
was measured against this height (218px of content inside the 220px shell at 375px width), so
the two numbers move together.

Inside a card there is one inset on all four sides — 20px, rising to 24px from `sm` — matching
the intro note's horizontal rhythm, because posts and notes stack directly on each other and
copy starting at a different inset reads as a misalignment. Vertical rhythm between stacked
children is a single 8px gap declared once on the container. **Children carry no vertical
margins of their own.** The left airmail stripe is 8px wide and absolutely positioned, eating
the first 8px of the left inset, so copy clears it by 12px (16px from `sm`).

Only one breakpoint does real work: `sm` (640px), which nudges type up and insets out. Modals
and sheets are bottom-anchored, capped at 560px wide and 88–90vh tall, and slide up.

### Named Rules

**The Fixed Pass Rule.** A feed card is 220px. Adding a row inside one means re-measuring the
note clamp, not letting the card grow.

**The One Inset Rule.** Spacing between siblings is declared once on the parent. A child that
sets `mt-*` or `mb-*` inside a card is re-opening a bug that has already been fixed twice.

## Elevation & Depth

Depth is **ambient, not structural.** Nothing on this board floats to signal hierarchy; borders
and tonal steps (`paper` → `card`, separated by `edge`) do all the separating. The shadows exist
to say "this is stock resting on paper", and they come in exactly two steps: rest and lift.
Both are navy-tinted, never neutral black, and both are wide and very soft — a 28–40px blur at
negative spread, so what you see is a diffusion under the card rather than an edge.

### Shadow Vocabulary
- **Rest** (`--shadow-card`: `0 1px 2px rgba(27,42,74,0.04), 0 10px 28px -18px rgba(27,42,74,0.18)`):
  every card and note at rest.
- **Lift** (`--shadow-card-hover`: `0 2px 6px rgba(27,42,74,0.06), 0 18px 40px -20px rgba(27,42,74,0.28)`):
  the hover state, paired with a 4px upward translate over 300ms.

### Named Rules

**The Token-Or-Nothing Rule.** Elevation ships as a `@theme` token applied through a utility.
An inline `style={{ boxShadow }}` silently beats the Tailwind hover class sitting next to it —
that is exactly why the hover shadow did not render for a period, and why both card components
were converted. Never reintroduce an inline shadow object.

**The Two-Step Rule.** There are two elevations. A third one is a new idea about hierarchy, and
this system does not express hierarchy through depth.

## Shapes

Soft-rectangular throughout, with radius encoding scale rather than emphasis: 4px on a stamp
chip (the smallest thing, and the one meant to look printed rather than drawn), 6px on a small
button, 8px on inputs and mid buttons, 12px on cards and grouped containers, 16px on the top
corners of a bottom sheet, and full-pill on selectable chips and icon buttons.

Borders are the primary separator: a 1px `edge` hairline around every card, a 1px `rule` line
above every card footer, a 1px `field` stroke on every input. The airmail stripe is the one
non-rectilinear element in the system, and even it is clipped to the card's left radius.

There are no diagonals, no clipped corners, no organic shapes, and no illustration. The one
diagonal in the product is the 45° weave, and it is a texture, not a silhouette.

### Named Rules

**The Ghost Ornament Rule.** The perforation, the punch notches and the navy stub are removed
and stay removed. Ticket-shaped ornament is an anti-reference here, not a motif to extend.

## Components

Character across the board: **refined and restrained.** Controls announce themselves through
precision — a hairline, a correct inset, an exact tracking value — not through weight or
motion. Nothing bounces; nothing is chunky.

### Buttons
- **Shape:** small radius on inline actions (6px), medium on form actions (8px), large on ghost
  actions (12px).
- **Open-post (gold):** `gold` fill, `ink` text, mono label at 10.5px with wide tracking, 8×12px
  padding, small shadow. Sits in every card footer. Hover swaps to `gold-lit` on a colour
  transition only — no lift, no scale.
- **Submit (blue):** full-width, `blue` fill, `card` text, 14px vertical padding, 8px radius.
  Hover deepens to `ink`.
- **Ghost:** `card` fill with a `field` hairline, `ink` text, mono. Hover moves the border and
  the text to `blue`. Carries `active:scale-[0.98]` — the one press affordance in the system.
- **Disabled:** 60% opacity and `cursor-not-allowed`; no colour change.

### Chips
- **Style:** full-pill, mono, 8×15px padding, `card` fill with a `field` hairline.
- **Selected:** inverts to `ink` fill with `card` text. Selection is a fill inversion, never a
  border weight change.

### Cards / Containers
- **Corner style:** 12px.
- **Background:** `card` on a `paper` page.
- **Shadow strategy:** Rest at rest, Lift on hover (see Elevation).
- **Border:** 1px `edge`, plus a 1px `rule` right-edge on the airmail stripe.
- **Internal padding:** 20px, 24px from `sm`, all four sides.
- **Hover:** 4px translate up over 300ms, together with the Lift shadow. The whole card is the
  click target.

### Inputs / Fields
- **Style:** `card` fill, 1px `field` stroke, 8px radius, 12px padding, 14px text, no default
  outline.
- **Label:** mono, 10.5–11px, uppercase, wide tracking, in `faint` or `blue` depending on
  whether it labels a field or opens a section.
- **Focus:** border moves to `blue`. There is no ring and no glow.
- **Error:** border moves to `red`; the message sits below in `red` at 12px semibold with an
  icon.

### Navigation
There is effectively none. A single sticky header carries the airmail stripe, the wordmark and
the session control inside the same 680px column; everything else is the feed, a floating "+",
and bottom sheets.

### Signature Component: the Feed Card

The board's one distinctive object. A 220px `card` rectangle with an 8px airmail weave down its
left edge, a coloured stamp chip and the route on a shared top row, the hard facts (city line,
date, weight) beneath, a two-line note preview, and a ruled footer holding the author on the
left and the gold open button on the right. Both post types use the identical shell; only the
stamp colour and its icon differ.

## Do's and Don'ts

### Do:
- **Do** take every colour and shadow from `src/index.css` `@theme`. Sixteen colours and two
  shadows are the whole system.
- **Do** ship a second token when one value cannot clear AA in both of its roles, and write the
  measured ratio into the comment beside it.
- **Do** keep both post types structurally identical. Colour and icon are the only permitted
  difference.
- **Do** declare sibling spacing once on the container (`gap-2`).
- **Do** re-measure the note clamp when adding any row to a feed card.
- **Do** route every string through `src/translations.ts`, including month names.
- **Do** keep the airmail weave as the sole ornament, at the page top and the card's left edge.

### Don't:
- **Don't** write a hex literal in a component. `#F6EFE2` inside `NoteCard.tsx` is the one
  surviving violation and is a defect, not a precedent.
- **Don't** use `style={{ boxShadow }}`. An inline shadow silently beats the Tailwind hover
  class beside it.
- **Don't** use `gold` as text or as a meaningful border on `paper` or `card`. Use `gold-deep`.
- **Don't** reintroduce ticket ornament: the navy stub, the dashed perforation, the punch
  notches, or tilted stamp chips.
- **Don't** give a feed card a variable height, or let a child inside one set its own vertical
  margin.
- **Don't** add a third stamp colour without a third post type.
- **Don't** design any surface that shows a contact handle in a list, a preview, a hover, or an
  aggregate. Handles arrive one at a time, authenticated.
- **Don't** introduce a third typeface, or set a sentence in the mono.
