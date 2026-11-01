---
name: Treasury Auction Demand Tracker
description: A dark, calm data desk where one heatmap shows which part of the Treasury curve the market is not buying.
colors:
  night-desk: "#111317"
  ledger-panel: "#181b20"
  paper-ink: "#ecebe6"
  soft-ink: "#c9cbd0"
  quiet-slate: "#979ca6"
  hairline: "#2b2f37"
  grid-line: "#23262d"
  chip-fill: "#22252b"
  amber-alert-fill: "#3a2c0e"
  amber-alert-ink: "#f3cf86"
  amber-alert-rule: "#6b5220"
  weak-demand-red: "oklch(0.72 0.19 27)"
  strong-demand-blue: "oklch(0.72 0.15 256)"
  scale-midpoint: "oklch(0.27 0 0)"
typography:
  display:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "46px"
    fontWeight: 600
    lineHeight: 1.06
    letterSpacing: "-0.015em"
  headline:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.2
  title:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "34px"
    fontWeight: 600
    lineHeight: 1.1
  body:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "13.5px"
    fontWeight: 400
    lineHeight: 1.5
  figure:
    fontFamily: "IBM Plex Mono, ui-monospace, Menlo, monospace"
    fontSize: "52px"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "-0.03em"
  label:
    fontFamily: "IBM Plex Mono, ui-monospace, Menlo, monospace"
    fontSize: "11px"
    fontWeight: 600
    letterSpacing: "0.12em"
rounded:
  hairline: "2px"
  control: "3px"
  chip: "4px"
  button: "5px"
  card: "6px"
spacing:
  gutter-phone: "16px"
  gutter-desktop: "56px"
  section-y: "40px"
  cell-gap: "2px"
components:
  card:
    backgroundColor: "{colors.ledger-panel}"
    textColor: "{colors.paper-ink}"
    rounded: "{rounded.card}"
    padding: "20px 22px 14px"
  chip:
    backgroundColor: "{colors.chip-fill}"
    textColor: "{colors.soft-ink}"
    rounded: "{rounded.chip}"
    padding: "4px 7px"
  tooltip:
    backgroundColor: "{colors.paper-ink}"
    textColor: "{colors.night-desk}"
    rounded: "{rounded.card}"
    padding: "10px 12px"
  stale-banner:
    backgroundColor: "{colors.amber-alert-fill}"
    textColor: "{colors.amber-alert-ink}"
    padding: "14px 24px"
  heatmap-cell:
    backgroundColor: "{colors.ledger-panel}"
    rounded: "{rounded.hairline}"
    height: "26px"
---

# Design System: Treasury Auction Demand Tracker

## Overview

**Creative North Star: "The Night Desk"**

A late-evening data desk: a dark, quiet room where the only lit object is the curve. The page is a calm, exact record of who is buying U.S. government debt, written for a curious reader who is not a trader. Everything that is not data recedes: type is restrained, surfaces are flat, and colour is spent almost entirely on the heatmap and the charts, where it carries meaning.

The voice is calm and exact. Headlines are set in a serif for authority, figures and labels in a monospace so numbers align and read as measurements, and body copy in a plain sans. Explanation is short and plain, placed beside the number it explains rather than in a separate glossary. Depth comes from tonal layering and hairline rules, never from decoration.

**Key Characteristics:**
- Dark only. One theme, no toggle and no light fallback.
- Colour belongs to the data: a fixed ±3σ red↔blue scale, with lightness also carrying the signal.
- Flat and ruled: tonal surfaces plus 1px rules; shadow only on floating tooltips.
- Numbers in monospace, claims in serif, explanations in sans.
- Honest states: stale, loading, empty and failed are each drawn plainly, never hidden.

## Colors

A near-black blue-grey page with warm off-white text and one data palette (red for weak demand, blue for strong). Neutrals are low-chroma and slightly cool; the only warm colour outside the data is the amber used for stale-data warnings.

### Primary
- **Weak-Demand Red** (oklch(0.72 0.19 27)): the +3σ end of the scale. Dealers absorbed more than usual. Used only in heatmap cells, chart dots, the legend and the deviation chip.
- **Strong-Demand Blue** (oklch(0.72 0.15 256)): the −3σ end of the scale. Used only for the same data marks.

### Neutral
- **Night Desk** (#111317): the page background.
- **Ledger Panel** (#181b20): cards, empty heatmap cells and raised content.
- **Paper Ink** (#ecebe6): primary text, selected-row fill, and the tooltip background.
- **Soft Ink** (#c9cbd0): secondary text and row labels.
- **Quiet Slate** (#979ca6): captions, axis text, muted labels (6.75:1 on the page background).
- **Hairline** (#2b2f37): section rules and card borders.
- **Grid Line** (#23262d): chart grids, skeleton blocks, heatmap cell borders.
- **Chip Fill** (#22252b): code chips and the URL chip.

### Alert
- **Amber Alert** (fill #3a2c0e, ink #f3cf86, rule #6b5220): stale-data banner and footer only.

### Named Rules
**The Colour-Is-Data Rule.** Red and blue appear only on data marks. Never use them for buttons, links, borders or decoration.
**The Fixed-Scale Rule.** The scale is clamped at ±3σ and never auto-fitted, so a shade means the same thing permanently. Beyond-scale values keep the endpoint colour and get a dark dot.
**The Lightness-Carries-Signal Rule.** On the dark scale lightness rises with |value| (L = 0.27 + 0.45 × |v|/3), so the chart still reads in greyscale. Red and blue differ in hue only; direction in greyscale comes from position against the legend.

## Typography

**Display Font:** Source Serif 4 (with Georgia, serif)
**Body Font:** IBM Plex Sans (with system-ui, sans-serif)
**Label/Mono Font:** IBM Plex Mono (with ui-monospace, Menlo, monospace)

**Character:** A serif voice for the question the page asks, a plain sans for explanation, and a monospace that makes every figure feel measured.

### Hierarchy
- **Display** (600, 46px, 1.06, −0.015em): the page question; 30px on phones.
- **Title** (600, 34px, 1.1): the selected tenor's name in the detail view; 28px on phones.
- **Headline** (600, 22px, 1.2): section headings.
- **Body** (400, 13–16px, 1.5): explanations; the lede is 16px with a 58ch maximum line length (about 65 characters a line). The heatmap takeaway sentence is 15px; its σ figures are 14px mono.
- **Small steps in use:** 10px (hidden cell values, chart axis text), 11px (month and year headers, legend ticks, eyebrow, chips), 11.5px (tooltip lines, legend captions), 12px and 12.5px (notes, the σ gloss), 13px and 13.5px (banner, table and card text), 14px and 15px (card titles, small figures), 18px to 20px (error title, tooltip and stat values). Nothing below 10px, and nothing the reader must read below 11px.
- **Figure** (500, 52px, 1, −0.03em): the debt total; 44px on phones. Smaller figures use 500 at 15–20px.
- **Label** (600, 11px, 0.12em, uppercase, mono): eyebrow text above the title and the detail section.

### Named Rules
**The Mono-For-Measurement Rule.** Any number a reader might compare (values, dates, amounts, counts) is set in IBM Plex Mono.

## Layout

One scrolling column in spec order: header with debt stat, heatmap, tenor detail, upcoming auctions beside methodology, footer. Sections sit between hairline rules with 56px side gutters and about 40px vertical padding on desktop; 16px gutters on phones, below 760px, where multi-column areas collapse to one column.

The heatmap is a fixed grid of 14 tenor rows (long end on top) by 24 month columns with 2px gaps and 26px-tall cells. On phones it scrolls horizontally inside its container with a 60px sticky label column and abbreviated labels (`4 wk`, `10 yr`), opening at the newest months. The detail view stacks a wide deviation chart over three equal metric cards that become one column on phones. The page itself never scrolls sideways.

## Elevation & Depth

Flat by default. Depth is tonal (Night Desk page, Ledger Panel cards) and drawn with 1px hairlines. The single exception is the floating tooltip, which uses a dark ambient shadow so it separates from a dark page.

### Shadow Vocabulary
- **Tooltip lift** (`box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5)`): heatmap and chart tooltips only.
- **Selected-row ring** (`box-shadow: inset 0 0 0 2px var(--ink)`): marks the selected tenor's cells on phones. A state indicator, not elevation.

### Named Rules
**The Flat-By-Default Rule.** Nothing casts a shadow at rest. Shadows appear only on elements that float above the page.

## Shapes

Small, quiet corners and straight lines. Cards and tooltips use a 6px radius, chips and code blocks 4px, buttons 5px, row-label buttons, the deviation chip and focus rings 3px, heatmap cells and legend swatches 2px, and dots are circles. Triangles mark values beyond ±3σ on charts. Borders are 1px hairlines; no thick borders, no decorative side stripes.

## Components

### Heatmap
- **Cells:** 26px tall, 2px radius, filled from the deviation scale; empty cells show a diagonal hairline hatch; beyond-scale cells carry a centred 6px dark dot.
- **Row labels:** mono text buttons; the selected tenor is filled Paper Ink with Night Desk text and `aria-pressed`.
- **Legend:** a 10px gradient bar from −3σ to +3σ with "Stronger demand / Weaker demand" captions and swatches for "Beyond ±3σ" and "No scored auction".
- **Takeaway and gloss:** one computed sentence under the heading names at most two tenors (see design/NOTES.md); a one-line σ gloss sits under the legend.
- **Selection:** choosing a tenor scrolls the detail heading into view and focuses it; a "Back to heatmap" link in the detail header returns focus to the tenor's row label.
- **Behavior:** hover or focus shows the tooltip; arrow keys move between cells; Enter selects the tenor.

### Tooltip
Inverted (Paper Ink background, Night Desk text), 6px radius, 232px wide on the heatmap (200px on charts): a small title, a 19px mono value that never wraps, and a sub-caption. For a beyond-scale cell the value keeps its exact signed number and the sub-caption opens with "Beyond the scale: weaker than +3σ" (or "stronger than −3σ").

### Cards
Ledger Panel background, 1px Hairline border, 6px radius, 18–22px padding. Each detail card carries a title, the latest value in mono, a one- or two-sentence plain explanation, and a chart.

### Chips
Chip Fill background, Soft Ink mono text, 4px radius. Used for the `?tenor=` URL and code formulas. The deviation chip is filled with the scale colour; its text is dark above |2σ| and Paper Ink below, chosen for contrast.

### Stale Banner and Footer
Amber Alert fill, ink and rule, full width at the top plus a matching footer, with a circled "!" and the word "old" in text so the warning is never colour-only.

### Load and Error States
A skeleton in the exact shape of the heatmap (Grid Line blocks) while loading; on failure, a dashed-border plain message with the status and a "Try again" button (Paper Ink fill).

### Charts (uPlot)
Grid lines in Grid Line, zero line in Quiet Slate, axis text in mono 10px, each auction a dot in the scale colour; beyond-scale values are triangles clamped to the plot edge.

## Do's and Don'ts

### Do:
- **Do** keep red and blue exclusively for data marks and the legend.
- **Do** keep the scale clamped at ±3σ and mark beyond-scale values with a dark dot (cells) or a triangle (charts).
- **Do** set every comparable number in IBM Plex Mono.
- **Do** keep body and muted text at 4.5:1 or better on Night Desk and Ledger Panel.
- **Do** give every heatmap cell tenor, month and value as accessible text, and never let colour be the only encoding.
- **Do** state stale, loading, empty and failed states in words.
- **Do** place each metric's plain-language explanation beside it.

### Don't:
- **Don't** add a light theme, a theme toggle, or a light-coloured surface.
- **Don't** use red or blue for buttons, links, borders or any non-data decoration.
- **Don't** add drop shadows to cards or panels; only floating tooltips may cast one.
- **Don't** auto-fit the colour scale to the data.
- **Don't** call bid dispersion a "tail", or imply bid-to-cover is the headline measure.
- **Don't** use side-stripe borders, gradient text, or decorative glows.
