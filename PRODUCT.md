# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

A curious general reader who keeps hearing that U.S. government debt is approaching $40 trillion and wants to understand what that means for the government's ability to keep borrowing. They are not a trader: they want to know who is actually buying the debt and whether that is changing. Terms such as "primary dealer" need a one-line plain explanation; exact figures and definitions stay one step deeper for readers who want to check. The builder is also a reader: this is primarily a learning project, so every decision should be explainable.

## Product Purpose

A single-page public site that scores every regular U.S. Treasury auction by how much of it primary dealers (the buyers of last resort) were left holding, so weak demand is visible at a glance and comparable across the whole curve. It answers: which specific tenors are seeing weaker interest, and is demand migrating toward the short end? Success is a reader who can name which part of the curve is struggling, and can see why the number is trustworthy.

## Positioning

The only free, public view that covers every regular tenor, including the short-dated bills Treasury increasingly relies on (existing free trackers show only the 10-year and 30-year), and that scores each auction against its own tenor's trailing history so a 12% dealer share is read correctly as normal for a bond and alarming for a bill. Federal Reserve rollovers are excluded from the demand measure and reported separately.

## Operating Context

- Source: U.S. Treasury Fiscal Data (`auctions_query` and `debt_to_penny`). A scheduled GitHub Actions job refreshes `data.json` on weekdays and commits it; the static site on GitHub Pages reads that file. There is no server and no database.
- The page states when its data was generated and shows a visible warning once the data is more than about four days old. This is the primary failure signal.
- All metric logic lives in Python behind one tested function; the frontend only renders per-auction records, bins them by month, and draws them. Vanilla JavaScript, no framework, no build step.
- Terms used on the page: dealer takedown, deviation (a z-score against the previous 12 auctions of the same tenor), SOMA (Fed rollovers), bid dispersion (explicitly not a "tail"), bid-to-cover, tenor, reopening.

## Capabilities and Constraints

- Scope: bills, fixed-rate notes and bonds, reopenings included and flagged. Excluded: TIPS, floating rate notes, cash management bills.
- 14 tenors: 4, 6, 8, 13, 17, 26 and 52-week bills; 2, 3, 5, 7, 10, 20 and 30-year notes and bonds.
- Heatmap: tenors by month over the last 24 months, coloured by mean deviation with fixed bounds at ±3 standard deviations (never auto-fitted); beyond-scale cells are marked.
- Detail view for one selected tenor (kept in the URL): deviation per auction plus allocation at the high yield, bid dispersion and bid-to-cover.
- Upcoming (announced, unheld) auctions are listed separately and never enter any score.
- No composite or weighted index, no true auction "tail" (needs when-issued yields), no supply panel, and no debt-change figure in v1 (deferred; the header shows level and as-of date only).
- Must work on a phone: the heatmap scrolls sideways with pinned tenor labels and opens on the newest months.
- Hosted on the default GitHub Pages URL; no custom domain.

## Evidence on Hand

- Real data: `data.json` (about 1,800 per-auction records over five years, with the two newest years displayed). Never invent auctions, values or statistics.
- `README.md`, `CONTEXT.md` (glossary of every term above) and `design/NOTES.md`.
- No testimonials, user counts, traffic or press exist; do not fabricate any.

## Product Principles

1. **Say what a number means before showing it.** Each metric carries its plain-language reading and its limits (bid-to-cover can look healthy after a weak auction; bid dispersion is not a tail).
2. **Never let the chart lie.** Fixed scale bounds, off-scale cells marked, empty cells distinguishable from zero, and stale data flagged rather than quietly served.
3. **Same tenor, same yardstick.** Compare each auction only with its own tenor's history; separate instruments are never mixed.
4. **Show the work.** Underlying components are published alongside derived ratios and the methodology is on the page, so a sceptical reader can recompute.
5. **Degrade honestly.** A failed refresh or fetch is stated plainly, with the last good data still shown when it exists.

## Accessibility & Inclusion

WCAG 2.2 AA, plus the project's own rules: colour is never the only encoding; the colour scale is colourblind-safe (no red-versus-green) and lightness also carries the signal so it survives greyscale and print; every heatmap cell carries tenor, month and value as accessible text; everything is keyboard operable; readable on a phone.
