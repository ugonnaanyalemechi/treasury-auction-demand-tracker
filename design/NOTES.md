# Design notes

Source: Claude Design project `Demand Tracker.dc.html` (saved here as
`Demand-Tracker.dc.html`; its runtime `support.js` is the design tool's own
and must not be shipped). The design file is **reference only**: it is written
for a React-style design runtime. Reimplement it in vanilla JS/CSS.

**Precedence:** SPEC.md (and the issue text) beats the design where they
conflict. Where this file and an issue disagree, this file wins; it was
written after the issues and records deliberate decisions.

## Chosen direction

Base on **layout 1a** ("spec order"): header with debt stat, heatmap, tenor
detail inline below the heatmap, upcoming auctions + methodology side by side,
footer. Reasons: it is the only layout that follows the spec's page order
(header stat, heatmap, detail view, upcoming, methodology). Not used for v1:
1b (detail expands under the clicked row), 1c (side panel and per-auction
table). The 1c per-auction table is a possible later addition.

Also from the design, to implement: **1d** mobile heatmap, **1f** stale-data
banner and footer, **1g** loading skeleton, **1h** fetch-failed state.

## Tokens (light theme only)

```css
:root {
  --bg: #f6f5f1;       --surface: #ffffff;
  --ink: #15171c;      --ink-2: #3a3e47;     --muted: #646a75;
  --rule: #dedbd3;     --grid: #ebe9e3;      --chip: #efede7;
  --warn-bg: #fbefd5;  --warn-ink: #6b4500;  --warn-rule: #e8c98a;
}
```

Fonts (Google Fonts): IBM Plex Sans 400/500/600 (body), IBM Plex Mono
400/500/600 (numbers, labels, tabular data), Source Serif 4 600 (headings).
Eyebrow labels: Plex Mono 600 11px, uppercase, letter-spacing .12em, `--muted`.
Cards: `--surface` background, 1px `--rule` border, 6px radius.
Tooltip: `--ink` background, `--bg` text, 6px radius, 200px wide.

## Heatmap colour scale (from the design)

```js
// v = mean deviation; clamp to +/-3
const c = Math.max(-3, Math.min(3, v)), t = Math.abs(c) / 3, red = c > 0;
const L = 0.975 - 0.53 * t;                       // lightness falls with |v|
const C = (red ? 0.19 : 0.15) * Math.min(1, t * 1.2);
const color = `oklch(${L.toFixed(3)} ${C.toFixed(3)} ${red ? 27 : 256})`;
```

Red = weaker demand (positive deviation), blue = stronger, near-white at 0.
Off-scale (|mean| > 3): cell keeps the endpoint colour plus a 6px white dot
centred in it (legend shows the same swatch, "Beyond ±3σ"). No scored auction:
diagonal hatch, `repeating-linear-gradient(135deg, var(--rule) 0 1.5px,
transparent 1.5px 5px)`. Legend: a 10px gradient bar from -3σ to +3σ with
"Stronger demand" / "Weaker demand" captions.

## Layout details

- **Desktop heatmap:** grid `76px repeat(24, 1fr)`, 2px gaps, cells 26px tall.
  Header row shows the month (Jan..Dec) with the 2-digit year under January
  and the first column. Row label is a button; selected row has `--ink`
  background and `--bg` text.
- **Row order:** long end on top (30-Year first) down to 4-Week, sorted by term
  length descending. This is the design's choice; SPEC.md does not set an
  order, so it overrides the earlier "short to long" wording in the issues.
- **Mobile heatmap (1d):** grid `60px repeat(24, 26px)`, scrolls horizontally in
  its container, tenor label column `position: sticky; left: 0`, abbreviated
  labels (`4 wk`, `10 yr`), initially scrolled to the right edge, selected row
  shown with an inset ring on its cells. Methodology becomes a `<details>`.
- **Tooltip:** title `Tenor · Mon YYYY`, value `+1.23σ` (or "Not yet scored" /
  "No auction"), sub-line `N auctions · avg takedown 12.3% · click for detail`.
- **Cell accessible text:** `10-Year, Aug 2026: +1.23σ` plus ` (off-scale)`;
  empty cells say `not yet scored` (auctions held, no deviation) or `no auction`.
  Cells are `role="img"` with `aria-label` and `title`.
- **Detail view:** title (`10-Year Note`), `N auctions in 24 months · median
  takedown X%`, URL chip `?tenor=10-year`; stat trio (latest auction date,
  takedown, deviation as a colour chip). Large deviation chart (each dot one
  auction, dots coloured by the heatmap scale, triangles for beyond +/-3 sigma),
  then three cards: allocation at high yield, bid dispersion, bid-to-cover, each
  with a one-to-two-sentence explanation and the latest value. Bid dispersion
  text must say it is not a tail. Bid-to-cover text must say it counts bids that
  never fill.
- **Selection:** one state, selected tenor, default `10-Year`. URL form is
  lower-case, `?tenor=10-year`.
- **Header:** eyebrow, serif H1 "Which part of the curve is the market not
  buying?", one-paragraph explainer, and the debt block: `$40.27 trillion` big,
  then exact figure and `as of 6 Oct 2026` in small mono.
- **Upcoming:** rows of `Mon 12 Oct 2026` and `$xxbn offered`, plus a note that
  they are excluded from every score.
- **Stale (1f):** at more than about 4 days old, a `role="alert"` banner at the
  top ("This data is N days old") and a warning-coloured footer.
- **Loading (1g):** skeleton in the exact shape of the heatmap. **Failed (1h):**
  plain message, `data.json` + HTTP status, a "Try again" button, no chart.
- **Footer:** `Data as of 8 Oct 2026, 23:04 UTC · 1,827 auctions` and
  `Source: U.S. Treasury Fiscal Data · refreshes weekdays`.

## Conflicts with the spec, and how they are resolved

| Design | Spec / decision | Resolution |
|---|---|---|
| Dark theme (toggle, 1e) | Light only for v1 (user decision) | Drop dark theme and the toggle. |
| Debt "over the past year" figure (`+$2.19T`) is a **mock**; `data.json` has no history | Story 2 deferred past v1; header shows level and date only | Omit the change figure entirely. |
| Upcoming rows show date and amount only | `upcoming` now also carries `tenor` (issue #26, done) | Show date, tenor, amount. |
| Detail charts hand-drawn as inline SVG | SPEC: charting via a library loaded by the browser | Pick a small library (issue #36), then style it to match: tokens, dot colours, triangle markers beyond +/-3, hover text. The heatmap itself stays plain DOM, as in the design. |
| Editorial type (Source Serif, Plex) | Earlier chat preference was a terminal/finance look; the design came later | Follow the design. |
| Stale state also shows a banner | Spec only requires the footer line to warn | Keep the banner (design 1f); it is a cheap, clearer signal. |
| Design runtime (`support.js`, `<x-dc>`, `{{ }}` templates) | Vanilla JS, no framework, no build | Reimplement; do not copy the runtime. |
| Binning in the design JS (`prep()`) | Same approach as SPEC (monthly binning at render time) | Reuse the logic as a model: mean of non-null deviations per tenor-month, last 24 months ending at the newest auction month. |

## File layout (so parallel work does not collide)

No build step; ES modules loaded by `<script type="module">`:

```
index.html        shell, section containers, no logic
style.css         tokens + all styles
js/main.js        load data.json, shared state (selected tenor), render order
js/header.js      debt stat           (issue #29)
js/footer.js      data-as-of + stale  (issue #30)
js/heatmap.js     binning + render    (issues #31-#34)
js/detail.js      charts              (issues #36-#37)
js/upcoming.js    upcoming list       (issue #38)
js/methodology.js methodology         (issue #39)
js/types.js       JSDoc typedefs for data.json
```

Each module exports one `render(...)` function taking its slice of the
dataset. Serve locally with `python -m http.server` (fetching `data.json`
needs http, not `file://`).
