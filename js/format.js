// @ts-check
// Small helpers shared by the section modules: month names, date text and one
// DOM element builder. No state and no page access beyond creating elements.

export const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * "2026-10-08" -> "8 Oct 2026". Parsed by hand so the viewer's time zone can
 * never shift the day. Returns null for anything that is not an ISO date.
 * @param {string} iso
 * @returns {string | null}
 */
export function formatIsoDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const month = MONTH_NAMES[Number(m[2]) - 1];
  if (!month) return null;
  return `${Number(m[3])} ${month} ${m[1]}`;
}

/**
 * "8 Oct 2026" for a Date, read in UTC.
 * @param {Date} d
 */
export function formatUtcDate(d) {
  return `${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * Create an element with an optional class and text.
 * @param {string} tag
 * @param {string} [className]
 * @param {string} [text]
 * @returns {HTMLElement}
 */
export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
