// @ts-check
// Tenor detail view: title, stats, and the big per-auction deviation chart.
// Renders into #detail. Issue #36 (big chart); #37 fills #detail-small-charts.
//
// CHARTING LIBRARY CHOICE: uPlot 1.6.31, loaded from jsDelivr (pinned) in
// index.html as a classic script exposing window.uPlot. Why: the SPEC wants a
// browser-loaded library and no build step. uPlot is ~50 KB (about 21 KB
// gzipped) against roughly 200 KB for Chart.js, is built for time series
// (x is a real time axis, so #37's small charts can share it exactly), has a
// `draw` hook that gives raw canvas access (needed for the design's
// per-point colour from deviationColor and the triangle markers, which no
// library offers out of the box), and a cursor/`setCursor` hook for a custom
// tooltip. cdnjs does not carry uPlot, so jsDelivr (also allowed) is used.

import { binAuctions, deviationColor, SCALE_BOUND, formatMean } from "./heatmap.js";

/** @typedef {import("./types.js").Auction} Auction */
/** @typedef {import("./types.js").AppState} AppState */

/**
 * Minimal declaration of the parts of a uPlot instance used here.
 * @typedef {object} UPlotInstance
 * @property {() => void} destroy
 * @property {(o: {width: number, height: number}) => void} setSize
 * @property {(v: number, scale: string, canvasPx?: boolean) => number} valToPos
 * @property {CanvasRenderingContext2D} ctx
 * @property {{left: number, top: number, width: number, height: number}} bbox
 * @property {{idx: number | null | undefined}} cursor
 * @property {HTMLElement} over
 */

/** Y range of the plot: a little beyond +/-3 so edge markers are visible. */
const Y_LIMIT = 3.4;

/** @type {UPlotInstance | null} */
let chart = null;
/** @type {ResizeObserver | null} */
let resizer = null;

/**
 * The shared x-axis range (unix seconds, UTC): the first day of the first
 * heatmap month to the first day after the last. #37's small charts import
 * this so all four charts line up exactly.
 * @param {Auction[]} auctions
 * @returns {{ start: number, end: number }}
 */
export function chartWindow(auctions) {
  const { months } = binAuctions(auctions);
  const first = months[0];
  const last = months[months.length - 1];
  return {
    start: Date.UTC(first.year, first.month - 1, 1) / 1000,
    end: Date.UTC(last.year, last.month, 1) / 1000,
  };
}

/**
 * Auctions of one tenor inside the 24-month window, oldest first.
 * @param {Auction[]} auctions
 * @param {string} tenor
 */
export function tenorAuctions(auctions, tenor) {
  const { start } = chartWindow(auctions);
  return auctions
    .filter((a) => a.tenor === tenor && Date.parse(a.auction_date) / 1000 >= start)
    .sort((a, b) => (a.auction_date < b.auction_date ? -1 : a.auction_date > b.auction_date ? 1 : 0));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * @param {string} iso "YYYY-MM-DD"
 * @returns {string} e.g. "8 Oct 2026"
 */
function longDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/**
 * Signed two-decimal sigma text with a true minus sign, e.g. "+1.23σ".
 * @param {number} v
 */
function sigma(v) {
  const t = formatMean(v);
  if (t === "0.00") return "0.00σ";
  return (v > 0 ? "+" : "−") + t.replace("-", "") + "σ";
}

/** @param {number} v */
function pct(v) {
  return `${(v * 100).toFixed(1)}%`;
}

/** @param {number[]} xs */
function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return 0;
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * @param {string} tag
 * @param {string} [className]
 */
function el(tag, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

/**
 * Build the static shell once; render() only updates it.
 * @param {HTMLElement} host
 */
function ensureShell(host) {
  if (host.querySelector(".dt-head")) return;
  host.innerHTML = `
    <div class="dt-head">
      <div class="dt-titleblock">
        <div class="eyebrow">Tenor detail</div>
        <h2 class="dt-title" id="dt-title"></h2>
        <div class="dt-sub"><span id="dt-count"></span><span class="dt-url" id="dt-url"></span></div>
      </div>
      <div class="dt-stats">
        <div class="dt-stat"><span class="dt-stat-label">Latest auction</span><span class="dt-stat-val" id="dt-date"></span></div>
        <div class="dt-stat"><span class="dt-stat-label">Dealer takedown</span><span class="dt-stat-val" id="dt-takedown"></span></div>
        <div class="dt-stat"><span class="dt-stat-label">Deviation</span><span class="dt-stat-val dt-chip" id="dt-dev"></span></div>
      </div>
    </div>
    <div class="dt-card">
      <div class="dt-card-head">
        <span class="dt-card-title">Dealer takedown deviation</span>
        <span class="dt-card-note">σ vs. the 12 prior auctions of this tenor · each dot is one auction · ▲▼ beyond ±3σ · ↑ weaker demand</span>
      </div>
      <div class="dt-chart" id="dt-chart"></div>
      <p class="dt-empty" id="dt-empty" hidden></p>
    </div>
    <!-- Issue #37: the three small charts (allocation at high yield, bid
         dispersion, bid-to-cover) render into this container. Use
         chartWindow() from this module for the same x-axis range. -->
    <div class="dt-small" id="detail-small-charts" data-issue="37"></div>`;
}

/** Tear down the previous chart so repeated renders do not leak. */
function destroyChart() {
  resizer?.disconnect();
  resizer = null;
  chart?.destroy();
  chart = null;
}

/**
 * Draw the coloured dots and the clamped triangles on the chart canvas.
 * @param {UPlotInstance} u
 * @param {number[]} xs
 * @param {number[]} values  true (unclamped) deviations
 */
function drawMarkers(u, xs, values) {
  const ctx = u.ctx;
  const px = devicePixelRatio;
  const s = 5 * px;
  ctx.save();
  ctx.lineWidth = 0.8 * px;
  ctx.strokeStyle = "rgba(21,23,28,0.6)";
  values.forEach((v, i) => {
    const cx = u.valToPos(xs[i], "x", true);
    const cy = u.valToPos(Math.max(-Y_LIMIT, Math.min(Y_LIMIT, v)), "y", true);
    ctx.fillStyle = deviationColor(v);
    ctx.beginPath();
    if (Math.abs(v) > SCALE_BOUND) {
      // Triangle: points up for weaker demand (+), down for stronger (-).
      const dir = v > 0 ? -1 : 1;
      ctx.moveTo(cx, cy + dir * s);
      ctx.lineTo(cx + s, cy - dir * s * 0.7);
      ctx.lineTo(cx - s, cy - dir * s * 0.7);
      ctx.closePath();
    } else {
      ctx.arc(cx, cy, 3 * px, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.stroke();
  });
  ctx.restore();
}

/**
 * Create the uPlot chart for one tenor.
 * @param {HTMLElement} host
 * @param {Auction[]} scored  auctions with a non-null deviation, oldest first
 * @param {{start: number, end: number}} win
 * @param {string} tenor
 */
function buildChart(host, scored, win, tenor) {
  const uPlot = /** @type {any} */ (window).uPlot;
  if (!uPlot) {
    host.textContent = "The charting library did not load, so the chart is unavailable.";
    return;
  }
  const xs = scored.map((a) => Date.parse(a.auction_date) / 1000);
  const values = scored.map((a) => /** @type {number} */ (a.deviation));
  // The line is drawn from clamped values so it stays inside the plot.
  const clamped = values.map((v) => Math.max(-Y_LIMIT, Math.min(Y_LIMIT, v)));

  const tip = el("div", "dt-tip");
  tip.hidden = true;
  tip.innerHTML = '<div class="dt-tip-date"></div><div class="dt-tip-val"></div><div class="dt-tip-sub"></div>';

  const height = () => (host.clientWidth < 600 ? 240 : 300);
  const mono = '10px "IBM Plex Mono", ui-monospace, monospace';
  const axisStyle = { stroke: "#646a75", font: mono, ticks: { show: false } };
  const everyN = host.clientWidth < 600 ? 6 : 3; // months between x labels

  const opts = {
    width: Math.max(host.clientWidth, 280),
    height: height(),
    legend: { show: false },
    padding: [8, 8, 0, 0],
    cursor: { y: false, drag: { x: false, y: false }, points: { size: 11, stroke: "#15171c", width: 1.5, fill: "transparent" } },
    scales: {
      x: { time: true, range: () => [win.start, win.end] },
      y: { range: () => [-Y_LIMIT, Y_LIMIT] },
    },
    axes: [
      {
        ...axisStyle,
        size: 28,
        grid: { stroke: "#ebe9e3", width: 1, dash: [2, 3] },
        splits: () => {
          /** @type {number[]} */
          const out = [];
          const d = new Date(win.start * 1000);
          let y = d.getUTCFullYear();
          let m = d.getUTCMonth();
          for (;;) {
            const t = Date.UTC(y, m, 1) / 1000;
            if (t >= win.end) break;
            if (m % everyN === 0) out.push(t);
            if (++m > 11) { m = 0; y++; }
          }
          return out;
        },
        values: (/** @type {unknown} */ _u, /** @type {number[]} */ splits) =>
          splits.map((t) => {
            const d = new Date(t * 1000);
            const name = MONTHS[d.getUTCMonth()];
            return d.getUTCMonth() === 0 ? `${name} ’${String(d.getUTCFullYear()).slice(2)}` : name;
          }),
      },
      {
        ...axisStyle,
        size: 38,
        splits: () => [-3, -2, -1, 0, 1, 2, 3],
        values: (/** @type {unknown} */ _u, /** @type {number[]} */ splits) =>
          splits.map((v) => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : "0")),
        grid: { stroke: "#ebe9e3", width: 1 },
      },
    ],
    series: [
      {},
      {
        label: `${tenor} deviation`,
        stroke: "rgba(100,106,117,0.6)",
        width: 1.1,
        points: { show: false },
      },
    ],
    hooks: {
      draw: [
        (/** @type {UPlotInstance} */ u) => {
          // Stronger zero line, drawn under the markers.
          const y0 = u.valToPos(0, "y", true);
          u.ctx.save();
          u.ctx.strokeStyle = "#646a75";
          u.ctx.lineWidth = devicePixelRatio;
          u.ctx.beginPath();
          u.ctx.moveTo(u.bbox.left, y0);
          u.ctx.lineTo(u.bbox.left + u.bbox.width, y0);
          u.ctx.stroke();
          u.ctx.restore();
          drawMarkers(u, xs, values);
        },
      ],
      setCursor: [
        (/** @type {UPlotInstance} */ u) => {
          const i = u.cursor.idx;
          if (i === null || i === undefined || !scored[i]) {
            tip.hidden = true;
            return;
          }
          const a = scored[i];
          const v = values[i];
          const [dateEl, valEl, subEl] = /** @type {HTMLElement[]} */ ([...tip.children]);
          dateEl.textContent = longDate(a.auction_date);
          valEl.textContent = sigma(v);
          subEl.textContent = [
            a.reopening ? "Reopening" : "New issue",
            Math.abs(v) > SCALE_BOUND ? "beyond ±3σ" : "",
            `takedown ${pct(a.takedown)}`,
          ].filter(Boolean).join(" · ");
          tip.hidden = false;
          const x = u.valToPos(xs[i], "x");
          const y = u.valToPos(clamped[i], "y");
          const w = u.over.clientWidth;
          tip.style.left = `${u.over.offsetLeft + Math.min(Math.max(x, 100), w - 100)}px`;
          tip.style.top = `${u.over.offsetTop + y}px`;
        },
      ],
    },
  };

  const u = /** @type {UPlotInstance} */ (new uPlot(opts, [xs, clamped], host));
  host.append(tip);
  host.setAttribute("role", "img");
  host.setAttribute(
    "aria-label",
    `${tenor} deviation by auction, ${scored.length} scored auctions. Latest ${sigma(values[values.length - 1])}.`,
  );
  chart = u;
  resizer = new ResizeObserver(() => {
    const width = Math.max(host.clientWidth, 280);
    u.setSize({ width, height: height() });
  });
  resizer.observe(host);
}

/**
 * @param {Auction[]} auctions
 * @param {AppState} state
 */
export function render(auctions, state) {
  const host = document.getElementById("detail");
  if (!host) return;
  ensureShell(host);
  destroyChart();

  const q = (/** @type {string} */ id) => /** @type {HTMLElement} */ (host.querySelector(`#${id}`));
  const tenor = state.selectedTenor;
  const rows = tenorAuctions(auctions, tenor);
  const latest = rows[rows.length - 1];
  const scored = rows.filter((a) => a.deviation !== null);

  q("dt-title").textContent = `${tenor} ${latest?.security_type ?? ""}`.trim();
  q("dt-count").textContent = rows.length
    ? `${rows.length} auctions in 24 months · median takedown ${pct(median(rows.map((a) => a.takedown)))}`
    : "No auctions in the last 24 months";
  q("dt-url").textContent = `?tenor=${tenor.toLowerCase()}`;
  q("dt-date").textContent = latest ? longDate(latest.auction_date) : "–";
  q("dt-takedown").textContent = latest ? pct(latest.takedown) : "–";

  const chip = q("dt-dev");
  if (latest && latest.deviation !== null) {
    chip.textContent = sigma(latest.deviation);
    chip.style.background = deviationColor(latest.deviation);
    chip.style.color = Math.abs(latest.deviation) / SCALE_BOUND > 0.55 ? "#fff" : "var(--ink)";
  } else {
    chip.textContent = "n/a";
    chip.style.background = "var(--chip)";
    chip.style.color = "var(--muted)";
  }

  const chartHost = q("dt-chart");
  chartHost.replaceChildren();
  chartHost.removeAttribute("role");
  chartHost.removeAttribute("aria-label");
  const empty = q("dt-empty");
  if (!scored.length) {
    empty.hidden = false;
    empty.textContent = rows.length
      ? `None of the ${rows.length} auctions in this window is scored yet (a score needs 12 prior auctions of the tenor), so there is nothing to plot.`
      : "There were no auctions of this tenor in the last 24 months.";
    return;
  }
  empty.hidden = true;
  buildChart(chartHost, scored, chartWindow(auctions), tenor);
}
