---
name: CRM-Next Landing
description: Warm paper Akari world for the CRM-Next marketing landing — washi ivory, bamboo ribs, ink, one vermilion stamp.
colors:
  washi-ivory: '#F6F1E7'
  flat-ash: '#EFE7D5'
  deep-flat: '#E9DFC9'
  lit-volume: '#FFFDF7'
  charcoal-ink: '#2A2723'
  ink-wash: '#6E6459'
  ink-faint: '#756A5D'
  bamboo: '#DCD2BE'
  rib: '#C9B992'
  vermilion-stamp: '#BC3A29'
  stamp-deep: '#8E2B1F'
  leaf-green: '#1E7F4F'
  amber-seal: '#8A5E0B'
  seal-red: '#A4262C'
  deep-teal: '#2F6B5E'
  lamp-glow: '#E2725B'
typography:
  display:
    fontFamily: 'Manrope, ui-sans-serif, system-ui, sans-serif'
    fontSize: 'clamp(2.25rem, 5vw, 3.75rem)'
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: '-0.01em'
  body:
    fontFamily: 'Golos Text, ui-sans-serif, system-ui, sans-serif'
    fontSize: '1rem'
    fontWeight: 400
    lineHeight: 1.75
  label:
    fontFamily: 'Golos Text, ui-sans-serif, system-ui, sans-serif'
    fontSize: '0.75rem'
    fontWeight: 600
    letterSpacing: '0.05em'
rounded:
  sm: '8px'
  md: '12px'
  lg: '16px'
  full: '9999px'
spacing:
  sm: '8px'
  md: '16px'
  lg: '24px'
  section: '56px'
components:
  button-trial:
    backgroundColor: '{colors.charcoal-ink}'
    textColor: '{colors.washi-ivory}'
    rounded: '{rounded.md}'
    padding: '16px 28px'
  button-trial-hover:
    backgroundColor: '#3A352F'
  button-ghost:
    backgroundColor: 'transparent'
    textColor: '{colors.charcoal-ink}'
    rounded: '{rounded.md}'
    padding: '16px 28px'
  nav-pill:
    backgroundColor: '{colors.vermilion-stamp}'
    textColor: '#ffffff'
    rounded: '{rounded.md}'
  chip-tone:
    rounded: '{rounded.full}'
    padding: '4px 10px'
  card-tray:
    backgroundColor: '{colors.lit-volume}'
    textColor: '{colors.charcoal-ink}'
    rounded: '{rounded.md}'
    padding: '16px 20px'
  ink-console:
    backgroundColor: '{colors.charcoal-ink}'
    textColor: '{colors.washi-ivory}'
    rounded: '{rounded.lg}'
    padding: '16px 20px'
---

# Design System: CRM-Next Landing

## Overview

**Creative North Star: "The Lit Paper Room"**

A sales office in daylight: warm washi paper, bamboo rib lines banding the page
into calm segments, charcoal ink for every word, and a single vermilion stamp
that marks only status — the active tab, the moving deal, the trial mindset.
Nothing glows, nothing floats in glass, no gradient pretends to be light; light
itself is a flat paper volume with the live funnel glowing inside it. Density is
embraced where managers read (tables, logs, kanban cells) and quiet is spent
between volumes. The page Persuades by demonstration: five live tabs prove the
mechanism instead of claiming it.

**Key Characteristics:**

- Warm paper ground, ink text, one stamp color with a job.
- Rib rules separate volumes; trays never nest.
- Humanist sans display with full Cyrillic; tabular figures for data.
- Motion demonstrates the mechanism (moves, arrivals, stamps), never decorates.

## Colors

Restrained paper neutrals plus one committed stamp accent; semantic seals stay
dark enough for white text on paper.

### Primary

- **Vermilion Stamp** (#BC3A29): status only — active nav pill, moving deal card
  border, checklist seals, links and marks. White text on it passes 5.6:1.
  Hover deepens toward Stamp Deep (#8E2B1F) via #A53224.

### Secondary (optional; single-accent system — omitted as a hue)

Neutral depth carries secondary surfaces; no second hue competes with the stamp.

### Neutral

- **Washi Ivory** (#F6F1E7): page ground.
- **Flat Ash** (#EFE7D5): unlit trays — kanban board, nav rail, inset rows.
- **Deep Flat** (#E9DFC9): hover washes, moon-ring fields.
- **Lit Volume** (#FFFDF7): lit cards, the hero moon, demo trays that are "on".
- **Charcoal Ink** (#2A2723): body text, trial buttons, header bar, ink console.
- **Ink Wash** (#6E6459): secondary text (5.1:1 on ivory).
- **Ink Faint** (#756A5D): muted meta text (4.7:1 on ivory, body-size minimum).
- **Bamboo** (#DCD2BE): default borders and hairlines.
- **Rib** (#C9B992): structural rules, volume separators, focus-visible rings.

### Seals (semantic, all carry white text)

- **Leaf Green** (#1E7F4F): qualified/won states, connected integrations.
- **Amber Seal** (#8A5E0B): warnings, at-risk accents.
- **Seal Red** (#A4262C): denied/error stamps, danger washes.
- **Deep Teal** (#2F6B5E): informational marks (Telegram channel, queues).

### Named Rules

**The Stamp Has One Job Rule.** Vermilion marks status and action-readiness
only. It never fills illustrations, gradients, or decorative shapes; rarity is
what makes the pill, the moving card, and the seals read as one language.
**The Lit Means Alive Rule.** Lit Volume (#FFFDF7) is reserved for surfaces
that are "on" — the hero moon, active demo trays. Unlit content stays flat ash.
A lit surface with nothing alive inside is a defect.

## Typography

**Display Font:** Manrope (with ui-sans-serif fallback)
**Body Font:** Golos Text (with ui-sans-serif fallback)
**Label/Mono Font:** system mono stack for keys, hashes, and measured values only

**Character:** Light-footed humanist sans throughout; display carries weight
(700–800) and tight tracking while body stays open at 1.75. Full Cyrillic in
both voices. Figures in data contexts always tabular.

### Hierarchy

- **Display** (700, clamp(2.25rem, 5vw, 3.75rem), 1.05): hero H1 and section H2s
  only; balanced wrapping, tracking −0.01em.
- **Headline** (700, 1.5rem, 1.2): volume titles (feature H4s), card titles.
- **Title** (700, 0.875rem, 1.4): preview headers, tray titles.
- **Body** (400, 1rem/0.875rem, 1.75): descriptions max ~68ch; meta lines 0.75rem.
- **Label** (600–700, 0.75rem, +0.05em, uppercase): data column names and seal
  text only — never above a heading as a kicker.

### Named Rules

**The Heading Speaks Rule.** No eyebrow label above a heading, ever. The
heading carries its own weight; delete the label.
**The Mono Is Data Rule.** Monospace appears only for code, keys, hashes, times,
and measured figures — never as a technical costume.

## Layout

Single centered column (max-w-7xl, 80rem), page padding 16px/24px, section
padding 56px/80px. Sticky features split 4/8 on desktop (nav rail sticky at
112px), single stacked column below 1024px. Volumes separated by 2px bamboo rib
rules with 40px of air above the rule; headings keep more space above than
below (40px over, 8px under). Anchor targets carry 112px of scroll margin to
clear the sticky header. Demo grids collapse whole: 3-column kanban and
split-view inbox stack to one column on small screens.

## Elevation & Depth

Hybrid: flat tonal layering for rest, warm offset shadows for lift. Shadows
always carry offset plus soft blur in a warm umber (74, 60, 40) — never a
zero-offset colored halo.

### Shadow Vocabulary

- **Resting tray** (`box-shadow: 0 1px 2px rgba(74,60,40,0.1), 0 2px 4px rgba(74,60,40,0.08)`): demo trays and lit volumes at rest.
- **Lifted action** (`box-shadow: 0 8px 16px rgba(74,60,40,0.12), 0 20px 40px -12px rgba(74,60,40,0.3)`): trial buttons, hero moon, moving deal card.
- **Stamp press** (`box-shadow: 0 1px 2px rgba(74,60,40,0.2)`): active nav pill — shallow, like ink pressed into paper.

### Named Rules

**The Offset Carries It Rule.** A shadow without offset is decoration. If a
surface needs presence without lift, use a darker flat tone instead.

## Shapes

Soft paper geometry: trays at 12px, rows and inputs at 8px, chips/pills/seals
fully round. Borders are 1px bamboo hairlines; structural separators are 2px
rib rules. The hero moon is a true ellipse (full radius on a non-square frame)
with a thin rib orbit ring — the world's single geometric signature. No
clipping masks, no cutouts, no hard offset block shadows.

## Components

### Buttons

- **Shape:** 12px radius, 16px/28px padding, bold 14px label naming the action.
- **Primary (trial):** charcoal ink fill (#2A2723), ivory text; hover warms to
  #3A352F. Restrained warm shadow.
- **Ghost:** transparent, ink text, 1px bamboo border at 30% ink; hover fills
  deep flat. Used for "дивитися можливості".
- **Focus:** 2px vermilion outline, 3px offset, everywhere.

### Chips

- **Style:** fully round, wash background, bold 11–12px label (tone wash + dark
  tone text, e.g. vermilion wash + stamp text).
- **State:** selected/active is a solid stamp fill with white text (nav pill);
  unselected stays wash or flat.

### Cards / Containers

- **Corner Style:** 12px trays, 8px inner rows.
- **Background:** lit volume for "on" trays, flat ash for unlit boards, ivory
  page ground beneath. Trays never nest: one tray per demo, hairline dividers
  inside.
- **Shadow Strategy:** resting tray at rest; lifted action for hero moon and
  trial buttons only.
- **Border:** 1px bamboo; moving deal card upgrades to a 2px stamp border.
- **Internal Padding:** 16–20px trays, 12–14px rows.

### Inputs / Fields

- **Style:** 8px radius, bamboo stroke, flat-ash fill, muted 12px hint text.
- **Focus:** bamboo stroke deepens to rib; vermilion ring only on the single
  primary capture (none on this landing today).
- **Error / Disabled:** seal-red wash + dark red text; disabled pathways use
  reduced opacity, never gray text below contrast.

### Navigation

- **Style:** ink bar on paper (charcoal fill, ivory links, bamboo hairline
  below); rail is a flat-ash tray with 14px medium links.
- **Default/hover/active:** muted ivory → ivory on hover; active is a solid
  vermilion pill (white text) that travels between items with a spring.
- **Mobile treatment:** single stacked column; rail goes static above the
  volumes; menu collapses to a details disclosure that closes on navigate.

### Ink Console (signature component)

Recessed terminal volume in solid ink (#2A2723) with ivory mono rows,
hairline white/10 dividers, and tone seals; a blinking ink caret keeps time.
Proof that dark volumes still belong to this world — as ink, never as glow.

## Do's and Don'ts

Concrete guardrails from the built landing and the locked Akari direction.

### Do:

- **Do** keep vermilion rare — status, active states, and seals total well
  under a tenth of any viewport.
- **Do** separate volumes with 2px rib rules and generous air above them.
- **Do** write headings that survive alone, balanced, at most ~20 words, no eyebrow above.
- **Do** use tabular figures for every sum, count, and timestamp.
- **Do** theme browser surfaces from the palette (vermilion selection and
  focus ring, ivory page wash behind the app root).
- **Do** animate the mechanism per demo volume with spring/ease-out from a
  visible resting state, gated on prefers-reduced-motion.

### Don't:

- **Don't** add neon, glow, glass blur, or gradient text — the brief bans all
  four and no surface earns them back.
- **Don't** nest cards or trays; one tray per demo, hairlines inside.
- **Don't** use monospace or uppercase tracking as decoration — data only.
- **Don't** invent testimonials, client logos, metrics, or capabilities the
  product does not have (no telephony, ever).
- **Don't** pick a new display face without full Cyrillic and a reason no
  humanist sans could satisfy.
