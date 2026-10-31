// @ts-check
// Entry point: loads data.json, owns the shared state, calls each section's
// render() in page order, and shows the loading and fetch-failed states.

import { render as renderHeader } from "./header.js";
import { render as renderHeatmap } from "./heatmap.js";
import { render as renderDetail } from "./detail.js";
import { render as renderUpcoming } from "./upcoming.js";
import { render as renderMethodology } from "./methodology.js";
import { render as renderFooter } from "./footer.js";

/** @typedef {import("./types.js").Dataset} Dataset */
/** @typedef {import("./types.js").AppState} AppState */

/** @type {AppState} */
const state = { selectedTenor: "10-Year" };

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
  const box = byId("load-error");
  const title = document.createElement("h2");
  title.textContent = "Couldn't load the auction data";

  const message = document.createElement("p");
  message.textContent =
    "The dataset didn't load, so no chart is shown rather than a partial or misleading one. This is usually temporary.";

  const detail = document.createElement("code");
  detail.textContent = `data.json · ${reason}`;

  const retry = document.createElement("button");
  retry.type = "button";
  retry.textContent = "Try again";
  retry.addEventListener("click", load);

  box.replaceChildren(title, message, detail, retry);
  setPageState("error");
}

/** Call every section's render() with its slice of the dataset. */
function renderAll() {
  if (!dataset) return;
  renderHeader(dataset.debt);
  renderHeatmap(dataset.auctions, state);
  renderDetail(dataset.auctions, state);
  renderUpcoming(dataset.upcoming);
  renderMethodology();
  renderFooter(dataset);
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
    renderAll();
    setPageState("ready");
  } catch (err) {
    console.error("Failed to load data.json", err);
    showError(err instanceof SyntaxError ? "invalid JSON" : "network error");
  }
}

buildSkeleton();
load();
