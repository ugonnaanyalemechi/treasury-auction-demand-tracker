// @ts-check
// Tenor detail view: title, stats, and the big per-auction deviation chart.
// Renders into #detail. Issue #36 (big chart); #37 (small charts below it).
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

/**
 * Every live chart (the big one plus the small ones) with its resize
 * observer, so one call can tear them all down.
 * @type {{ u: UPlotInstance, ro: ResizeObserver }[]}
 */
let live = [];

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
        <h2 class="dt-title" id="dt-title" tabindex="-1"></h2>
        <div class="dt-sub"><span id="dt-count"></span><span class="dt-url" id="dt-url"></span></div>
        <a class="dt-back" href="#heatmap" id="dt-back">Back to heatmap</a>
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
    <!-- Issue #37: the three small cards render into this container on the
         same x-window as the big chart. -->
    <div class="dt-small" id="detail-small-charts" data-issue="37"></div>`;
  host.querySelector("#dt-back")?.addEventListener("click", (e) => {
    e.preventDefault();
    const row = document.querySelector('#heatmap .hm-pick[aria-pressed="true"]');
    if (!(row instanceof HTMLElement)) return;
    row.scrollIntoView({ behavior: scrollBehavior(), block: "center", inline: "nearest" });
    row.focus({ preventScroll: true });
  });
}

/** Smooth scrolling, except instant for people who ask for reduced motion. */
function scrollBehavior() {
  return matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

/**
 * After the user picks a tenor, bring the detail heading into view and move
 * focus to it so keyboard and screen-reader users land on the new content.
 * Call only from a user selection, never on page load or history navigation.
 */
export function revealDetail() {
  const heading = document.getElementById("dt-title");
  if (!heading) return;
  heading.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
  heading.focus({ preventScroll: true });
}

/** Tear down every previous chart so repeated renders do not leak. */
function destroyChart() {
  for (const { u, ro } of live) {
    ro.disconnect();
    u.destroy();
  }
  live = [];
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
  ctx.strokeStyle = token("--ink", 0.55);
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

const MONO = '10px "IBM Plex Mono", ui-monospace, monospace';

/**
 * Read a colour token from :root (style.css) at chart-build time, so the
 * canvas charts follow the CSS tokens instead of hard-coded colours.
 * @param {string} name  e.g. "--muted"
 * @param {number} [alpha]  optional opacity 0..1 (canvas has no color-mix)
 * @returns {string}
 */
function token(name, alpha) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const m = /^#([0-9a-f]{6})$/i.exec(raw);
  if (alpha === undefined || !m) return raw;
  const n = parseInt(m[1], 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function axisStyle() {
  return { stroke: token("--muted"), font: MONO, ticks: { show: false } };
}

/**
 * The shared time axis: one label every `everyN` months, same window for all
 * charts so their x-axes line up exactly.
 * @param {{start: number, end: number}} win
 * @param {number} everyN
 */
function monthAxis(win, everyN) {
  return {
    ...axisStyle(),
    size: 28,
    grid: { stroke: token("--grid"), width: 1, dash: [2, 3] },
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
  };
}

/**
 * Create the tooltip element for a chart host.
 * @returns {HTMLElement}
 */
function makeTip() {
  const tip = el("div", "dt-tip");
  tip.hidden = true;
  tip.innerHTML = '<div class="dt-tip-date"></div><div class="dt-tip-val"></div><div class="dt-tip-sub"></div>';
  return tip;
}

/**
 * Fill and place the tooltip above the point at (x, y), or hide it.
 * @param {UPlotInstance} u
 * @param {HTMLElement} tip
 * @param {{date: string, val: string, sub: string, x: number, y: number} | null} info
 */
function showTip(u, tip, info) {
  if (!info) {
    tip.hidden = true;
    return;
  }
  const [dateEl, valEl, subEl] = /** @type {HTMLElement[]} */ ([...tip.children]);
  dateEl.textContent = info.date;
  valEl.textContent = info.val;
  subEl.textContent = info.sub;
  tip.hidden = false;
  const w = u.over.clientWidth;
  tip.style.left = `${u.over.offsetLeft + Math.min(Math.max(u.valToPos(info.x, "x"), 100), w - 100)}px`;
  tip.style.top = `${u.over.offsetTop + u.valToPos(info.y, "y")}px`;
}

/**
 * Register a chart for teardown and keep it sized to its host.
 * @param {UPlotInstance} u
 * @param {HTMLElement} host
 * @param {() => number} height
 */
function track(u, host, height) {
  const ro = new ResizeObserver(() => {
    u.setSize({ width: Math.max(host.clientWidth, 200), height: height() });
  });
  ro.observe(host);
  live.push({ u, ro });
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

  const tip = makeTip();

  const height = () => (host.clientWidth < 600 ? 240 : 300);
  const everyN = host.clientWidth < 600 ? 6 : 3; // months between x labels

  const opts = {
    width: Math.max(host.clientWidth, 280),
    height: height(),
    legend: { show: false },
    padding: [8, 8, 0, 0],
    cursor: { y: false, drag: { x: false, y: false }, points: { size: 11, stroke: token("--ink"), width: 1.5, fill: "transparent" } },
    scales: {
      x: { time: true, range: () => [win.start, win.end] },
      y: { range: () => [-Y_LIMIT, Y_LIMIT] },
    },
    axes: [
      monthAxis(win, everyN),
      {
        ...axisStyle(),
        size: 38,
        splits: () => [-3, -2, -1, 0, 1, 2, 3],
        values: (/** @type {unknown} */ _u, /** @type {number[]} */ splits) =>
          splits.map((v) => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : "0")),
        grid: { stroke: token("--grid"), width: 1 },
      },
    ],
    series: [
      {},
      {
        label: `${tenor} deviation`,
        stroke: token("--muted", 0.6),
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
          u.ctx.strokeStyle = token("--muted");
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
            showTip(u, tip, null);
            return;
          }
          const a = scored[i];
          const v = values[i];
          showTip(u, tip, {
            date: longDate(a.auction_date),
            val: sigma(v),
            sub: [
              a.reopening ? "Reopening" : "New issue",
              Math.abs(v) > SCALE_BOUND ? "beyond ±3σ" : "",
              `takedown ${pct(a.takedown)}`,
            ].filter(Boolean).join(" · "),
            x: xs[i],
            y: clamped[i],
          });
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
  track(u, host, height);
}

/**
 * One small-multiple card's definition.
 * @typedef {object} SmallSpec
 * @property {string} title
 * @property {string} text  explanatory sentence(s)
 * @property {(a: Auction) => number} read  convert the raw field; NaN if invalid
 * @property {(v: number) => string} fmt  value text, also used in the tooltip
 * @property {(vals: number[]) => {min: number, max: number}} range  y range from the plotted values
 * @property {(min: number, max: number) => number[]} ticks
 * @property {(v: number) => string} axisFmt
 */

/**
 * Convert an API string (or number) to a finite number, else NaN. Only the
 * rendering layer does this; "" and null are NOT zero.
 * @param {unknown} raw
 */
function toNum(raw) {
  if (raw === null || raw === undefined || raw === "") return NaN;
  const n = Number(raw);
  return Number.isFinite(n) ? n : NaN;
}

/** @type {SmallSpec[]} */
const SMALL_SPECS = [
  {
    title: "Allocation at high yield",
    text: "Share of bids at the worst accepted yield that were filled. Near 100% means Treasury had to take nearly every bid at the clearing price.",
    read: (a) => toNum(a.allocation_pctage),
    fmt: (v) => `${v.toFixed(1)}%`,
    range: () => ({ min: 0, max: 100 }),
    ticks: () => [0, 50, 100],
    axisFmt: (v) => `${v}%`,
  },
  {
    title: "Bid dispersion",
    text: "High minus median yield, in basis points: how much bidders disagreed on value. Not a tail, which would need when-issued data.",
    read: (a) => toNum(a.bid_dispersion),
    fmt: (v) => `${v.toFixed(1)} bp`,
    range: (vals) => ({ min: 0, max: Math.max(2, 2 * Math.ceil(Math.max(...vals) / 2)) }),
    ticks: (min, max) => [min, Math.round(max / 2), max],
    axisFmt: (v) => `${v}bp`,
  },
  {
    title: "Bid-to-cover",
    text: "The number the press quotes. It counts bids that never fill, so it can look healthy after a weak auction.",
    read: (a) => toNum(a.bid_to_cover_ratio),
    fmt: (v) => `${v.toFixed(2)}×`,
    range: (vals) => {
      const min = Math.floor(Math.min(...vals) * 2) / 2;
      const max = Math.ceil(Math.max(...vals) * 2) / 2;
      return max > min ? { min, max } : { min, max: min + 0.5 };
    },
    ticks: (min, max) => [min, (min + max) / 2, max],
    axisFmt: (v) => `${v.toFixed(1)}×`,
  },
];

/**
 * Create one small chart on the shared x-window. Points with a missing or
 * invalid value are skipped, not plotted as zero.
 * @param {HTMLElement} host
 * @param {Auction[]} rows  the tenor's auctions in the window, oldest first
 * @param {{start: number, end: number}} win
 * @param {SmallSpec} spec
 * @param {string} tenor
 */
function buildSmallChart(host, rows, win, spec, tenor) {
  const pts = rows
    .map((a) => ({ a, v: spec.read(a) }))
    .filter((p) => Number.isFinite(p.v));
  if (!pts.length) {
    const msg = el("p", "dt-empty");
    msg.textContent = "No valid values for this tenor in the window.";
    host.append(msg);
    return;
  }
  const uPlot = /** @type {any} */ (window).uPlot;
  if (!uPlot) {
    host.textContent = "The charting library did not load, so the chart is unavailable.";
    return;
  }
  const xs = pts.map((p) => Date.parse(p.a.auction_date) / 1000);
  const ys = pts.map((p) => p.v);
  const { min, max } = spec.range(ys);
  const tip = makeTip();
  const height = () => 130;
  const everyN = host.clientWidth < 300 ? 6 : 3;

  const opts = {
    width: Math.max(host.clientWidth, 200),
    height: height(),
    legend: { show: false },
    padding: [8, 8, 0, 0],
    cursor: { y: false, drag: { x: false, y: false }, points: { size: 9, stroke: token("--ink"), width: 1.5, fill: "transparent" } },
    scales: {
      x: { time: true, range: () => [win.start, win.end] },
      y: { range: () => [min, max] },
    },
    axes: [
      monthAxis(win, everyN),
      {
        ...axisStyle(),
        size: 44,
        splits: () => spec.ticks(min, max),
        values: (/** @type {unknown} */ _u, /** @type {number[]} */ splits) => splits.map(spec.axisFmt),
        grid: { stroke: token("--grid"), width: 1 },
      },
    ],
    series: [
      {},
      {
        label: spec.title,
        stroke: token("--muted", 0.6),
        width: 1.1,
        points: { show: true, size: 5, fill: token("--ink"), stroke: token("--ink") },
      },
    ],
    hooks: {
      setCursor: [
        (/** @type {UPlotInstance} */ u) => {
          const i = u.cursor.idx;
          if (i === null || i === undefined || !pts[i]) {
            showTip(u, tip, null);
            return;
          }
          showTip(u, tip, {
            date: longDate(pts[i].a.auction_date),
            val: spec.fmt(ys[i]),
            sub: pts[i].a.reopening ? "Reopening" : "New issue",
            x: xs[i],
            y: ys[i],
          });
        },
      ],
    },
  };
  const u = /** @type {UPlotInstance} */ (new uPlot(opts, [xs, ys], host));
  host.append(tip);
  host.setAttribute("role", "img");
  host.setAttribute(
    "aria-label",
    `${tenor} ${spec.title.toLowerCase()} by auction, ${pts.length} values. Latest ${spec.fmt(ys[ys.length - 1])}.`,
  );
  track(u, host, height);
}

/**
 * Rebuild the three small cards for the selected tenor.
 * @param {HTMLElement} container
 * @param {Auction[]} rows
 * @param {{start: number, end: number}} win
 * @param {string} tenor
 */
function renderSmallCharts(container, rows, win, tenor) {
  container.replaceChildren();
  const latest = rows[rows.length - 1];
  for (const spec of SMALL_SPECS) {
    const card = el("div", "dt-card dt-mini");
    const head = el("div", "dt-card-head");
    const title = el("span", "dt-card-title");
    title.textContent = spec.title;
    const val = el("span", "dt-mini-val");
    const v = latest ? spec.read(latest) : NaN;
    val.textContent = Number.isFinite(v) ? spec.fmt(v) : "–";
    head.append(title, val);
    const text = el("p", "dt-mini-text");
    text.textContent = spec.text;
    const host = el("div", "dt-chart dt-mini-chart");
    card.append(head, text, host);
    container.append(card);
    buildSmallChart(host, rows, win, spec, tenor);
  }
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
    // Dark text only once the chip is light enough: it beats --ink from about 2 sigma up.
    chip.style.color = Math.abs(latest.deviation) / SCALE_BOUND > 2 / 3 ? "#111" : "var(--ink)";
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
  const win = chartWindow(auctions);
  renderSmallCharts(q("detail-small-charts"), rows, win, tenor);
  if (!scored.length) {
    empty.hidden = false;
    empty.textContent = rows.length
      ? `None of the ${rows.length} auctions in this window is scored yet (a score needs 12 prior auctions of the tenor), so there is nothing to plot.`
      : "There were no auctions of this tenor in the last 24 months.";
    return;
  }
  empty.hidden = true;
  buildChart(chartHost, scored, win, tenor);
}
