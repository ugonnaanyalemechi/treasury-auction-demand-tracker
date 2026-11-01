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

## Tokens (dark theme only)

The page is dark only (issue #40): no toggle, no light fallback. `color-scheme:
dark` is set on `:root` and in a `<meta name="color-scheme">` so native
controls and scrollbars are dark. Tokens are the design's `[data-theme="dark"]`
set, defined once on `:root`. `js/detail.js` reads them with `getComputedStyle`
at chart-build time for the uPlot canvases.

```css
:root {
  color-scheme: dark;
  --bg: #111317;       --surface: #181b20;
  --ink: #ecebe6;      --ink-2: #c9cbd0;     --muted: #979ca6;
  --rule: #2b2f37;     --grid: #23262d;      --chip: #22252b;
  --warn-bg: #3a2c0e;  --warn-ink: #f3cf86;  --warn-rule: #6b5220;
}
```

WCAG contrast (computed): --ink 15.58 on --bg, 14.46 on --surface; --ink-2
11.45 / 10.63; --muted 6.75 / 6.27 (all above AA 4.5). --warn-ink on --warn-bg
9.10.

Fonts (Google Fonts): IBM Plex Sans 400/500/600 (body), IBM Plex Mono
400/500/600 (numbers, labels, tabular data), Source Serif 4 600 (headings).
Eyebrow labels: Plex Mono 600 11px, uppercase, letter-spacing .12em, `--muted`.
Cards: `--surface` background, 1px `--rule` border, 6px radius.
Tooltip: `--ink` background, `--bg` text, 6px radius, 200px wide (a light
card on the dark page, as in the design; shadow is `rgba(0,0,0,.5)`).

## Heatmap colour scale (from the design)

```js
// v = mean deviation; clamp to +/-3
const c = Math.max(-3, Math.min(3, v)), t = Math.abs(c) / 3, red = c > 0;
const L = 0.27 + 0.45 * t;                        // lightness RISES with |v| on dark
const C = (red ? 0.19 : 0.15) * Math.min(1, t * 1.2);
const color = `oklch(${L.toFixed(3)} ${C.toFixed(3)} ${red ? 27 : 256})`;
```

(The light variant, `L = 0.975 - 0.53 * t`, is no longer used.)

Red = weaker demand (positive deviation), blue = stronger, near-background dark
at 0, lightest at +/-3. Greyscale luminance rises monotonically with |v|
(0.019, 0.07, 0.17, 0.33 at |v| = 0, 1, 2, 3). Off-scale (|mean| > 3): cell
keeps the endpoint colour plus a 6px `--scale-ink` (`#111`) dot centred in it (legend shows the same swatch, "Beyond ±3σ"). No scored auction:
diagonal hatch, `repeating-linear-gradient(135deg, var(--rule) 0 1.5px,
transparent 1.5px 5px)`. Chip text on a coloured deviation chip is `--scale-ink` (`#111`) when |v| > 2 (design uses
t > .55; at that point `#111` is only 3.2:1 and `--ink` 4.95:1, the two cross at
about 2 sigma), otherwise `var(--ink)`. Legend: a 10px gradient bar from -3σ to +3σ with
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
  shown with a 1px rule above and below its cells (issue #43 replaced the 2px
  ring). Row-label buttons are 32px tall, so phone rows are 32px. A caption
  ("Scroll left for earlier months") and a left fade (`.hm-cue`, `.hm-fade`,
  toggled by `is-start` from a scroll listener in `js/heatmap.js`) show that
  earlier months are off-screen and hide at the start of the scroll. The debt
  stat is a compact grid on phones (figure and label on one row).
- **Tooltip:** title `Tenor · Mon YYYY`, value `+1.23σ` (or "Not yet scored" /
  "No auction"), sub-line `N auctions · avg takedown 12.3% · click for detail`.
- **Cell accessible text:** `10-Year, Aug 2026: +1.23σ` plus ` (off-scale)`;
  empty cells say `not yet scored` (auctions held, no deviation) or `no auction`.
  Cells keep native table semantics (no `role`): that text is the cell content, visually hidden, so the row and column `th` still label it.
- **Detail view:** title (`10-Year Note`), `N auctions in 24 months · median
  takedown X%`, URL chip `?tenor=10-year`; stat trio (latest auction date,
  takedown, deviation as a colour chip). Large deviation chart (each dot one
  auction, dots coloured by the heatmap scale, triangles for beyond +/-3 sigma),
  then three cards: allocation at high yield, bid dispersion, bid-to-cover, each
  with a one-to-two-sentence explanation and the latest value. Bid dispersion
  text must say it is not a tail. Bid-to-cover text must say it counts bids that
  never fill. Issue #43 adds the window median beside the latest takedown and a
  computed verdict sentence under the stats (see the exception below). The
  small charts' x labels are every 6 months (every 12 under 300px wide).
- **Methodology (#43):** "How to read this" (takedown, deviation, red and blue)
  always shown; "How it is computed" in a `<details>` that starts closed at
  every width and is built once, so its state survives tenor selections.
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
| Dark theme (toggle, 1e) | Dark only (user decision, issue #40; supersedes light only for v1) | Dark is the chosen theme: dark tokens on `:root`, dark colour scale. The toggle and light set are dropped. |
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

## Exception: the heatmap takeaway is computed in JS (issue #41)

The spec keeps metric logic in Python. The one sentence under the heatmap
heading is built in the browser (`computeTakeaway` in `js/heatmap.js`) from
the already-binned cells, because it summarises the displayed grid and not a
new metric. Rules: for each tenor take its three newest months in the 24-month
window that contain at least one scored cell (months with none are skipped,
not counted as zero); average those monthly means; name at most the two
highest, only if at least +0.5σ; otherwise print "No tenor stands out as
unusually weak". Tenor names come from the data rows. Hand-checked against
an independent Python computation on the real `data.json`: all 14 tenors
match to six decimals (e.g. 20-Year +1.271750, 5-Year +0.701217, 7-Year
+0.620876, 2-Year -0.288311, 10-Year -1.643195).

## Exception: the detail verdict sentence is computed in JS (issue #43)

The second piece of browser-side logic, next to the takeaway above: `verdictSentence`
in `js/detail.js`, a pure exported function. It restates three numbers already
on screen for the selected tenor: the latest auction's takedown, the median
takedown of the tenor's auctions in the 24-month window (the same median shown
in the detail header; unscored auctions count), and the latest auction's
deviation. It adds no new metric. Rules: the words "above", "below" or "in
line with" come from comparing the takedown with the median at the displayed
one-decimal precision; the verdict comes only from the latest deviation
(>= +1 "weaker than usual", <= -1 "stronger than usual", otherwise "about
normal"; null prints "not yet scored" and gives no verdict). Because the median
spans 24 months and the deviation uses the 12 auctions before, they can
disagree; the sentence then switches from "so" to "but against the 12 auctions
before it". Thresholds apply to the deviation as displayed (rounded to two decimals):
30-Year is -0.9971 raw, shows -1.00σ, and so reads "stronger than usual",
never contradicting its chip.

Hand-checked against an independent Python computation on the real
`data.json` (all 14 tenors match; five shown, latest takedown / window median /
latest deviation):

| Tenor | Takedown | Median | Deviation | Verdict |
|---|---|---|---|---|
| 30-Year | 6.7750% | 11.6189% | -0.9971 (shows -1.00) | stronger than usual |
| 20-Year | 16.7422% | 12.3399% | +1.9143 | weaker than usual |
| 10-Year | 2.5231% | 10.4540% | -2.5831 | stronger than usual |
| 5-Year | 15.7021% | 11.2673% | +1.8207 | weaker than usual |
| 13-Week | 43.2529% | 34.4815% | +1.7417 | weaker than usual |
