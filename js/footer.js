// @ts-check
// Data-as-of line and stale-data warning (issue #30). Renders into #footer and
// #stale-banner. The age check is the primary failure signal for the pipeline.

import { el, formatUtcDate } from "./format.js";

/** @typedef {import("./types.js").Dataset} Dataset */

/** Data older than this many days counts as stale (design 1f: "about 4 days"). */
const STALE_AFTER_DAYS = 4;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Age of the data in whole days, and whether that is stale. Pure: takes the
 * current time as an argument. An unparseable timestamp counts as stale.
 * @param {string} generatedAt ISO timestamp
 * @param {Date} now
 * @returns {{ days: number, stale: boolean }}
 */
export function dataAge(generatedAt, now) {
  const then = Date.parse(generatedAt);
  if (Number.isNaN(then)) return { days: NaN, stale: true };
  const ageMs = now.getTime() - then;
  return { days: Math.max(0, Math.floor(ageMs / MS_PER_DAY)), stale: ageMs > STALE_AFTER_DAYS * MS_PER_DAY };
}

/**
 * "8 Oct 2026, 23:04 UTC".
 * @param {Date} d
 */
function formatDateTime(d) {
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${formatUtcDate(d)}, ${hh}:${mm} UTC`;
}

/** @param {Dataset} dataset */
export function render(dataset) {
  const footer = document.getElementById("footer");
  const banner = document.getElementById("stale-banner");
  if (!footer || !banner) return;

  const generated = new Date(dataset.generated_at);
  const valid = !Number.isNaN(generated.getTime());
  const { days, stale } = dataAge(dataset.generated_at, new Date());
  const asOf = valid ? formatDateTime(generated) : "unknown";
  const count = `${dataset.row_count.toLocaleString("en-US")} auctions`;

  const age = valid ? `${days} ${days === 1 ? "day" : "days"} old` : "age unknown";
  const asOfText = stale ? `⚠ Data as of ${asOf}: ${age} · ${count}` : `Data as of ${asOf} · ${count}`;
  const right = stale
    ? "Source: U.S. Treasury Fiscal Data · expected: every weekday"
    : "Source: U.S. Treasury Fiscal Data · refreshes weekdays";

  footer.classList.toggle("is-stale", stale);
  footer.replaceChildren(el("span", "", asOfText), el("span", "", right));

  if (!stale) {
    banner.hidden = true;
    banner.replaceChildren();
    return;
  }
  const headline = valid ? `This data is ${days} ${days === 1 ? "day" : "days"} old` : "This data's age is unknown";
  const detail = valid
    ? `Last refreshed ${formatUtcDate(generated)}. Auctions held since then are not shown, and the latest column may be incomplete.`
    : "The refresh time is missing or unreadable. Auctions held recently may not be shown.";
  const body = document.createElement("div");
  body.className = "stale-text";
  body.append(el("strong", "", headline), el("span", "", detail));
  banner.replaceChildren(el("span", "stale-icon", "!"), body);
  banner.hidden = false;
}
