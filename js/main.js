// @ts-check
// Entry point: loads data.json, owns the shared state, calls each section's
// render() in page order, and shows the loading and fetch-failed states.

import { render as renderHeader } from "./header.js";
import { render as renderHeatmap } from "./heatmap.js";
import { render as renderDetail, revealDetail } from "./detail.js";
import { render as renderUpcoming } from "./upcoming.js";
import { render as renderMethodology } from "./methodology.js";
import { render as renderFooter } from "./footer.js";
import { tenorFromSearch, formatTenor } from "./url-state.js";
import { el } from "./format.js";

/** @typedef {import("./types.js").Dataset} Dataset */
/** @typedef {import("./types.js").AppState} AppState */

/** @type {AppState} */
const state = { selectedTenor: tenorFromSearch(location.search) };

/** @type {Dataset | null} */
let dataset = null;

/**
 * Look up an element that index.html is required to contain.
 * @param {string} id
 * @returns {HTMLElement}
 */
function byId(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`index.html is missing #${id}`);
  return el;
}

/** @param {"loading" | "ready" | "error"} value */
function setPageState(value) {
  byId("app").dataset.state = value;
}

/** Skeleton shaped like the heatmap: a label column plus 24 month columns, 14 rows. */
function buildSkeleton() {
  const grid = byId("skeleton-grid");
  grid.replaceChildren();
  for (let row = 0; row < 14; row++) {
    for (let col = 0; col < 25; col++) {
      const cell = document.createElement("div");
      cell.className = col === 0 ? "skeleton-cell is-label" : "skeleton-cell";
      grid.append(cell);
    }
  }
}

/**
 * Show the fetch-failed state (design 1h). Shows no chart, only the reason.
 * @param {string} reason e.g. "HTTP 404" or "network error"
 */
function showError(reason) {
  const retry = /** @type {HTMLButtonElement} */ (el("button", "", "Try again"));
  retry.type = "button";
  retry.addEventListener("click", load);
  fillError(
    "Couldn't load the auction data",
    "The dataset didn't load, so no chart is shown rather than a partial or misleading one. This is usually temporary.",
    `data.json · ${reason}`,
    retry,
  );
}

/**
 * Show the render-failed state: the data arrived but drawing it threw. There
 * is no retry button, because fetching the same data again would fail the
 * same way; this is a fault in the page or the data, not the connection.
 * @param {unknown} err
 */
function showRenderError(err) {
  console.error("Failed to render the page", err);
  const why = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  fillError(
    "Couldn't draw the auction data",
    "The data loaded, but this page failed while drawing it, so no chart is shown rather than a partial or misleading one. This is a fault in the page or the data, not your connection, and reloading is unlikely to help.",
    `render · ${why}`,
  );
}

/**
 * Fill the error box and switch the page to the error state.
 * @param {string} heading
 * @param {string} message
 * @param {string} detail  technical reason, set in a code chip
 * @param {HTMLElement} [action]
 */
function fillError(heading, message, detail, action) {
  byId("load-error").replaceChildren(
    el("h2", "", heading),
    el("p", "", message),
    el("code", "", detail),
    ...(action ? [action] : []),
  );
  setPageState("error");
}

/**
 * Select a tenor from a click: push a history entry so back/forward work.
 * @param {import("./types.js").Tenor} tenor
 */
function selectTenor(tenor) {
  if (tenor !== state.selectedTenor) {
    state.selectedTenor = tenor;
    history.pushState(null, "", `?tenor=${formatTenor(tenor)}`);
    renderAll();
  }
  // Only a user selection reaches here (not page load or popstate), so it is
  // the one place that scrolls to and focuses the detail. Re-picking the
  // current tenor still jumps there, so a click never looks dead.
  revealDetail();
}

// Back/forward: re-read the URL (an unknown value falls back to the default).
window.addEventListener("popstate", () => {
  state.selectedTenor = tenorFromSearch(location.search);
  renderAll();
});

/**
 * Call every section's render() with its slice of the dataset. A throw here
 * is a render error, reported as such and never as a failed fetch.
 */
function renderAll() {
  if (!dataset) return;
  try {
    renderHeader(dataset.debt);
    renderHeatmap(dataset.auctions, state, selectTenor);
    renderDetail(dataset.auctions, state);
    renderUpcoming(dataset.upcoming);
    renderMethodology();
    renderFooter(dataset);
  } catch (err) {
    showRenderError(err);
  }
}

/** Fetch data.json and render, or show the error state. Also used by "Try again". */
async function load() {
  setPageState("loading");
  try {
    const response = await fetch("data.json", { cache: "no-cache" });
    if (!response.ok) {
      showError(`HTTP ${response.status}`);
      return;
    }
    dataset = /** @type {Dataset} */ (await response.json());
  } catch (err) {
    console.error("Failed to load data.json", err);
    showError(err instanceof SyntaxError ? "invalid JSON" : "network error");
    return;
  }
  // Show the page before rendering: sections hidden by the loading state have
  // no layout, so charts and the heatmap scroll would read a width of 0.
  // Rendering is synchronous, so nothing half-drawn is ever painted.
  setPageState("ready");
  renderAll();
}

buildSkeleton();
load();
