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

  /** @type {Map<string, {sum: number, scored: number, count: number}>} */
  const acc = new Map();
  const first = months[0].key;
  for (const a of auctions) {
    const monthKey = a.auction_date.slice(0, 7);
    if (monthKey < first) continue;
    const key = cellKey(a.tenor, monthKey);
    let slot = acc.get(key);
    if (!slot) acc.set(key, (slot = { sum: 0, scored: 0, count: 0 }));
    slot.count += 1;
    if (a.deviation !== null) {
      slot.sum += a.deviation;
      slot.scored += 1;
    }
  }

  /** @type {Map<string, Cell>} */
  const cells = new Map();
  for (const [key, s] of acc) {
    cells.set(key, { mean: s.scored ? s.sum / s.scored : null, count: s.count, scored: s.scored });
  }
  return { months, tenors: TENOR_ROWS, cells };
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
 */
export function render(auctions, state) {
  const host = document.getElementById("heatmap");
  if (!host) return;
  const { months, tenors, cells } = binAuctions(auctions);

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
    label.textContent = tenor;
    tr.append(label);
    for (const m of months) {
      const cell = cells.get(cellKey(tenor, m.key));
      const td = tr.insertCell();
      td.className = "hm-cell";
      td.dataset.tenor = tenor;
      td.dataset.month = m.key;
      td.dataset.count = String(cell ? cell.count : 0);
      if (cell && cell.mean !== null) {
        td.textContent = cell.mean.toFixed(2);
        td.dataset.mean = String(cell.mean);
      } else {
        td.classList.add("is-empty");
      }
    }
  }

  host.querySelector(".hm-wrap")?.remove();
  const wrap = document.createElement("div");
  wrap.className = "hm-wrap";
  wrap.append(table);
  host.append(wrap);
}
