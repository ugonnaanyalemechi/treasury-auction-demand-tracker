// @ts-check
// Debt stat in the page header. Renders into #debt (issue #29).

import { el, formatIsoDate } from "./format.js";

/** @typedef {import("./types.js").Debt} Debt */

/**
 * "$40,305,316,210,829.72" -> "$40.31" (trillions, two decimals), or null.
 * @param {string} amount
 * @returns {string | null}
 */
function formatTrillions(amount) {
  const value = Number(amount.replace(/[$,]/g, ""));
  if (!Number.isFinite(value) || value <= 0) return null;
  return `$${(value / 1e12).toFixed(2)}`;
}

/**
 * Show total public debt and its as-of date. The pipeline omits `debt` when
 * the fetch fails, so a missing or unreadable value empties #debt, which also
 * hides its divider (see `.debt:empty`).
 * @param {Debt | undefined | null} debt
 */
export function render(debt) {
  const root = document.getElementById("debt");
  if (!root) return;
  root.replaceChildren();

  const raw = debt?.total_public_debt_outstanding;
  const big = typeof raw === "string" ? formatTrillions(raw) : null;
  const asOf = typeof debt?.as_of === "string" ? formatIsoDate(debt.as_of) : null;
  if (!raw || !big || !asOf) return;

  const figure = el("div", "debt-figure");
  figure.append(el("span", "debt-big", big), el("span", "debt-unit", "trillion"));

  root.append(
    el("div", "debt-label", "Total public debt outstanding"),
    figure,
    el("div", "debt-exact", `${raw} · as of ${asOf}`),
  );
}
