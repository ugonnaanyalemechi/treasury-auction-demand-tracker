// @ts-check
// Pure helpers for keeping the selected tenor in the URL (issue #35).
// The URL form is lower-case, e.g. ?tenor=10-year. No DOM access here.

import { TENOR_ROWS } from "./heatmap.js";

/** @typedef {import("./types.js").Tenor} Tenor */

/** Selection used when the URL has no (valid) tenor. */
export const DEFAULT_TENOR = /** @type {Tenor} */ ("10-Year");

/**
 * Turn a ?tenor= value into a valid tenor, or null if it is missing or unknown.
 * Case-insensitive, so ?tenor=10-Year also works.
 * @param {string | null | undefined} value
 * @returns {Tenor | null}
 */
export function parseTenor(value) {
  if (!value) return null;
  const wanted = value.trim().toLowerCase();
  return TENOR_ROWS.find((t) => t.toLowerCase() === wanted) ?? null;
}

/**
 * The URL value for a tenor: "10-Year" becomes "10-year".
 * @param {Tenor} tenor
 */
export function formatTenor(tenor) {
  return tenor.toLowerCase();
}

/**
 * Selected tenor from a query string such as "?tenor=4-week"; the default
 * when absent or invalid.
 * @param {string} search
 * @returns {Tenor}
 */
export function tenorFromSearch(search) {
  return parseTenor(new URLSearchParams(search).get("tenor")) ?? DEFAULT_TENOR;
}
