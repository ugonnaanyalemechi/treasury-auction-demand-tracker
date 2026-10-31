// @ts-check
// Debt stat in the page header. Renders into #debt (issue #29).

/** @typedef {import("./types.js").Debt} Debt */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * "2026-10-06" -> "6 Oct 2026". Parsed by hand so the viewer's timezone
 * can never shift the day. Returns null for anything that isn't a date.
 * @param {string} iso
 * @returns {string | null}
 */
function formatAsOf(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const month = MONTHS[Number(m[2]) - 1];
  if (!month) return null;
  return `${Number(m[3])} ${month} ${m[1]}`;
}

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
 * @param {string} className
 * @param {string} text
 * @param {string} [tag]
 * @returns {HTMLElement}
 */
function el(className, text, tag = "div") {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
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
  const asOf = typeof debt?.as_of === "string" ? formatAsOf(debt.as_of) : null;
  if (!raw || !big || !asOf) return;

  const figure = el("debt-figure", "");
  figure.append(el("debt-big", big, "span"), el("debt-unit", "trillion", "span"));

  root.append(
    el("debt-label", "Total public debt outstanding"),
    figure,
    el("debt-exact", `${raw} · as of ${asOf}`),
  );
}
