// @ts-check
// Monthly binning and the tenor-by-month heatmap. Issue #31 builds the binning
// and a plain table of mean values; #32-#34 add colour, mobile scroll,
// accessible text and selection. Renders into #heatmap.

/** @typedef {import("./types.js").Auction} Auction */
/** @typedef {import("./types.js").AppState} AppState */
/** @typedef {import("./types.js").Tenor} Tenor */

/**
 * @typedef {object} Month
 * @property {string} key    "YYYY-MM"
 * @property {number} year
 * @property {number} month  1 to 12
 */

/**
 * @typedef {object} Cell
 * @property {number | null} mean  mean of non-null deviations; null if none
 * @property {number} count        auctions held in the month (scored or not)
 * @property {number} scored       auctions with a non-null deviation
 * @property {number} takedown     mean takedown (0 to 1) over every auction in the month
 */

/**
 * @typedef {object} Binned
 * @property {Month[]} months  oldest first, length 24
 * @property {Tenor[]} tenors  rows top to bottom: 30-Year ... 4-Week
 * @property {Map<string, Cell>} cells  keyed by `${tenor}|${month.key}`
 */

const MONTH_COUNT = 24;
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Row order, long end on top (design/NOTES.md).
 * @type {Tenor[]}
 */
export const TENOR_ROWS = [
  "30-Year", "20-Year", "10-Year", "7-Year", "5-Year", "3-Year", "2-Year",
  "52-Week", "26-Week", "17-Week", "13-Week", "8-Week", "6-Week", "4-Week",
];

/**
 * Key used to look a cell up in Binned.cells.
 * @param {string} tenor
 * @param {string} monthKey "YYYY-MM"
 */
export function cellKey(tenor, monthKey) {
  return `${tenor}|${monthKey}`;
}

/**
 * Bin per-auction records into tenor x month cells. The 24 months end at the
 * month of the newest auction. A cell's mean skips null deviations; a cell
 * with no scored auction has mean null.
 * @param {Auction[]} auctions
 * @returns {Binned}
 */
export function binAuctions(auctions) {
  let newest = "";
  for (const a of auctions) if (a.auction_date > newest) newest = a.auction_date;
  const [lastYear, lastMonth] = newest.split("-").map(Number);

  /** @type {Month[]} */
  const months = [];
  for (let i = MONTH_COUNT - 1; i >= 0; i--) {
    // Month index counted from year 0, so subtraction wraps across years.
    const index = lastYear * 12 + (lastMonth - 1) - i;
    const year = Math.floor(index / 12);
    const month = (index % 12) + 1;
    months.push({ key: `${year}-${String(month).padStart(2, "0")}`, year, month });
  }

  /** @type {Map<string, {sum: number, scored: number, count: number, tkSum: number}>} */
  const acc = new Map();
  const first = months[0].key;
  for (const a of auctions) {
    const monthKey = a.auction_date.slice(0, 7);
    if (monthKey < first) continue;
    const key = cellKey(a.tenor, monthKey);
    let slot = acc.get(key);
    if (!slot) acc.set(key, (slot = { sum: 0, scored: 0, count: 0, tkSum: 0 }));
    slot.count += 1;
    slot.tkSum += a.takedown;
    if (a.deviation !== null) {
      slot.sum += a.deviation;
      slot.scored += 1;
    }
  }

  /** @type {Map<string, Cell>} */
  const cells = new Map();
  for (const [key, s] of acc) {
    cells.set(key, { mean: s.scored ? s.sum / s.scored : null, count: s.count, scored: s.scored, takedown: s.tkSum / s.count });
  }
  return { months, tenors: TENOR_ROWS, cells };
}

/** Fixed colour-scale bound, in standard deviations. Never auto-fitted. */
export const SCALE_BOUND = 3;

/**
 * Fill colour for a mean deviation (formula from design/NOTES.md). The value is
 * clamped to +/-SCALE_BOUND. Red is weaker demand (positive), blue stronger,
 * near-white at zero; lightness falls with |v| so it reads in greyscale.
 * @param {number} v
 * @returns {string} an oklch() colour
 */
export function deviationColor(v) {
  const c = Math.max(-SCALE_BOUND, Math.min(SCALE_BOUND, v));
  const t = Math.abs(c) / SCALE_BOUND;
  const red = c > 0;
  const L = 0.975 - 0.53 * t;
  const C = (red ? 0.19 : 0.15) * Math.min(1, t * 1.2);
  return `oklch(${L.toFixed(3)} ${C.toFixed(3)} ${red ? 27 : 256})`;
}

/**
 * Two-decimal text for a mean, never "-0.00".
 * @param {number} v
 */
export function formatMean(v) {
  const text = v.toFixed(2);
  return text === "-0.00" ? "0.00" : text;
}

/**
 * Signed two-decimal sigma text with a real minus sign: "+1.23σ", "−0.50σ".
 * @param {number} v
 */
export function formatSigma(v) {
  const text = formatMean(v);
  const n = Number(text);
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${text.replace("-", "")}σ`;
}

/** @param {Month} m  e.g. "Aug 2026" */
function monthLabel(m) {
  return `${MONTH_NAMES[m.month - 1]} ${m.year}`;
}

/**
 * Plain-language description of one cell, shared by the aria-label and the
 * tooltip so they cannot disagree.
 * @param {Tenor} tenor
 * @param {Month} m
 * @param {Cell | undefined} cell
 */
function describeCell(tenor, m, cell) {
  const count = cell ? cell.count : 0;
  const mean = cell ? cell.mean : null;
  const off = mean !== null && Math.abs(mean) > SCALE_BOUND;
  const value = mean !== null ? formatSigma(mean) : count ? "Not yet scored" : "No auction";
  const state = mean !== null ? value + (off ? " (off-scale)" : "") : value.toLowerCase();
  const sub = cell && count
    ? `${count} auction${count > 1 ? "s" : ""} · avg takedown ${(cell.takedown * 100).toFixed(1)}% · click for detail`
    : "Nothing auctioned this month";
  return {
    aria: `${tenor}, ${monthLabel(m)}: ${state}`,
    tip: [`${tenor} · ${monthLabel(m)}`, value + (off ? " off-scale" : ""), sub],
  };
}

/**
 * Tooltip and keyboard behaviour for the cells. One shared tooltip is placed
 * with position: fixed from the cell's bounding box, so a scrolling container
 * around the table cannot clip it.
 *
 * Tab order: row-label buttons stay tabbable. The cells add exactly one tab
 * stop (roving tabindex): the newest month of the selected tenor. Arrow keys
 * move between cells, Home/End jump along the row, Enter or Space selects the
 * tenor. This avoids 336 tab stops.
 * @param {HTMLElement} host
 * @param {HTMLTableElement} table
 * @param {Tenor} selected
 * @param {string} lastMonth
 */
function attachTooltip(host, table, selected, lastMonth) {
  host.querySelector(".hm-tip")?.remove();
  const tip = document.createElement("div");
  tip.className = "hm-tip";
  tip.setAttribute("aria-hidden", "true"); // each cell's aria-label already says it
  tip.hidden = true;
  const title = document.createElement("div");
  const value = document.createElement("div");
  const sub = document.createElement("div");
  title.className = "hm-tip-title";
  value.className = "hm-tip-value";
  sub.className = "hm-tip-sub";
  tip.append(title, value, sub);
  host.append(tip);

  /** @type {HTMLElement[][]} */
  const grid = [...table.tBodies[0].rows].map((r) =>
    /** @type {HTMLElement[]} */ ([...r.querySelectorAll(".hm-cell")]));
  const stop = grid.flat().find((c) => c.dataset.tenor === selected && c.dataset.month === lastMonth);
  if (stop) stop.tabIndex = 0;

  /** @param {HTMLElement} cell */
  function show(cell) {
    const [t, v, s] = JSON.parse(cell.dataset.tip ?? "[]");
    title.textContent = t;
    value.textContent = v;
    sub.textContent = s;
    tip.hidden = false;
    const r = cell.getBoundingClientRect();
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    const left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2));
    const top = r.top - h - 8 >= 0 ? r.top - h - 8 : r.bottom + 8;
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  }
  const hide = () => { tip.hidden = true; };

  table.addEventListener("pointerover", (e) => {
    const cell = e.target instanceof Element ? e.target.closest(".hm-cell") : null;
    if (cell instanceof HTMLElement) show(cell); else hide();
  });
  table.addEventListener("pointerleave", () => {
    const a = document.activeElement;
    // Keep the tooltip if a cell still has keyboard focus.
    if (!(a instanceof HTMLElement && a.matches(".hm-cell") && table.contains(a))) hide();
  });
  table.addEventListener("focusin", (e) => {
    const cell = e.target;
    if (!(cell instanceof HTMLElement) || !cell.matches(".hm-cell")) return;
    for (const c of grid.flat()) c.tabIndex = c === cell ? 0 : -1;
    show(cell);
  });
  table.addEventListener("focusout", hide);
  window.addEventListener("scroll", hide, { capture: true, passive: true });
  window.addEventListener("resize", hide);

  table.addEventListener("keydown", (e) => {
    const cell = e.target;
    if (!(cell instanceof HTMLElement) || !cell.matches(".hm-cell")) return;
    const row = grid.findIndex((r) => r.includes(cell));
    let r = row;
    let c = grid[row].indexOf(cell);
    if (e.key === "ArrowLeft") c -= 1;
    else if (e.key === "ArrowRight") c += 1;
    else if (e.key === "ArrowUp") r -= 1;
    else if (e.key === "ArrowDown") r += 1;
    else if (e.key === "Home") c = 0;
    else if (e.key === "End") c = grid[row].length - 1;
    else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      cell.click();
      return;
    } else return;
    e.preventDefault();
    grid[Math.max(0, Math.min(grid.length - 1, r))][Math.max(0, Math.min(grid[row].length - 1, c))].focus();
  });
}

/** Legend: gradient bar, end captions, and the two non-gradient swatches. */
function buildLegend() {
  const el = document.createElement("div");
  el.className = "hm-legend";
  const stops = [-3, -2, -1, 0, 1, 2, 3].map(deviationColor).join(", ");
  el.innerHTML = `
    <div class="hm-legend-bar" style="background: linear-gradient(90deg, ${stops})"></div>
    <div class="hm-legend-ticks"><span>−3σ</span><span>0</span><span>+3σ</span></div>
    <div class="hm-legend-caps"><span>← Stronger demand</span><span>Weaker demand →</span></div>
    <div class="hm-legend-keys">
      <span class="hm-key"><span class="hm-swatch is-off" style="background: ${deviationColor(SCALE_BOUND + 0.5)}"></span>Beyond ±3σ</span>
      <span class="hm-key"><span class="hm-swatch is-none"></span>No scored auction</span>
    </div>`;
  return el;
}

/**
 * Header cell for a month column: month name, with the 2-digit year under it
 * for January and the first column.
 * @param {Month} m
 * @param {boolean} isFirst
 */
function monthHeader(m, isFirst) {
  const th = document.createElement("th");
  th.scope = "col";
  th.dataset.month = m.key;
  const name = document.createElement("span");
  name.textContent = MONTH_NAMES[m.month - 1];
  th.append(name);
  if (m.month === 1 || isFirst) {
    const yr = document.createElement("span");
    yr.className = "hm-year";
    yr.textContent = `’${String(m.year).slice(2)}`;
    th.append(yr);
  }
  return th;
}

/**
 * @param {Auction[]} auctions
 * @param {AppState} state
 * @param {(tenor: Tenor) => void} [onSelect]  called when a row label is clicked
 */
export function render(auctions, state, onSelect) {
  const host = document.getElementById("heatmap");
  if (!host) return;
  const { months, tenors, cells } = binAuctions(auctions);
  // Selecting re-renders the whole table, which would drop keyboard focus.
  const active = document.activeElement;
  const refocus = active instanceof HTMLElement && host.contains(active) && active.matches(".hm-cell")
    ? { tenor: active.dataset.tenor, month: active.dataset.month }
    : null;

  const table = document.createElement("table");
  table.className = "hm-table";

  const head = table.createTHead().insertRow();
  const corner = document.createElement("th");
  corner.scope = "col";
  corner.className = "hm-corner";
  corner.textContent = "Tenor";
  head.append(corner);
  months.forEach((m, i) => head.append(monthHeader(m, i === 0)));

  const body = table.createTBody();
  for (const tenor of tenors) {
    const tr = body.insertRow();
    tr.dataset.tenor = tenor;
    const label = document.createElement("th");
    label.scope = "row";
    const pick = document.createElement("button");
    pick.type = "button";
    pick.className = "hm-pick";
    pick.textContent = tenor;
    pick.setAttribute("aria-pressed", String(tenor === state.selectedTenor));
    pick.addEventListener("click", () => onSelect?.(tenor));
    label.append(pick);
    if (tenor === state.selectedTenor) tr.classList.add("is-selected");
    tr.append(label);
    for (const m of months) {
      const cell = cells.get(cellKey(tenor, m.key));
      const td = tr.insertCell();
      td.className = "hm-cell";
      td.dataset.tenor = tenor;
      td.dataset.month = m.key;
      td.dataset.count = String(cell ? cell.count : 0);
      const text = describeCell(tenor, m, cell);
      td.setAttribute("role", "img");
      td.setAttribute("aria-label", text.aria);
      td.dataset.tip = JSON.stringify(text.tip);
      td.tabIndex = -1; // focusable for the tooltip; attachTooltip makes one cell a tab stop
      td.addEventListener("click", () => onSelect?.(tenor));
      if (cell && cell.mean !== null) {
        const value = document.createElement("span");
        value.className = "hm-value";
        value.textContent = formatMean(cell.mean);
        td.append(value);
        td.dataset.mean = String(cell.mean);
        td.style.background = deviationColor(cell.mean);
        if (Math.abs(cell.mean) > SCALE_BOUND) td.classList.add("is-off");
      } else {
        td.classList.add("is-empty");
      }
    }
  }

  attachTooltip(host, table, state.selectedTenor, months[months.length - 1].key);

  host.querySelector(".hm-wrap")?.remove();
  host.querySelector(".hm-legend")?.remove();
  const wrap = document.createElement("div");
  wrap.className = "hm-wrap";
  wrap.append(table);
  host.append(buildLegend(), wrap);
  if (refocus) {
    const again = [...table.querySelectorAll(".hm-cell")].find(
      (c) => c instanceof HTMLElement && c.dataset.tenor === refocus.tenor && c.dataset.month === refocus.month,
    );
    if (again instanceof HTMLElement) again.focus();
  }
}
