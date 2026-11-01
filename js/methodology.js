// @ts-check
// Methodology text (issue #39); renders into #methodology. The copy is static,
// so nothing from data.json is used. On a phone the body collapses into a
// <details> (design 1d); on desktop it is always open.

const README_URL =
  "https://github.com/ugonnaanyalemechi/treasury-auction-demand-tracker#readme";

/**
 * One block of the methodology. `formula` is shown in a code chip.
 * @typedef {{ title: string, formula?: string, text: string }} Item
 */

/** @type {Item[]} */
const ITEMS = [
  {
    title: "Dealer takedown",
    formula: "dealer accepted ÷ (competitive + non-competitive accepted)",
    text: "Primary dealers must bid at every auction, so a high share means the open market held back.",
  },
  {
    title: "Fed rollovers excluded",
    text: "SOMA (Federal Reserve) holdings that mature are rolled into the new auction without a competitive bid. They are left out of both the numerator and the denominator, so the Fed's maturity calendar can't pass for a change in investor appetite. The amounts are still published in data.json.",
  },
  {
    title: "Deviation",
    formula: "(takedown − mean of prior 12) ÷ stdev of prior 12",
    text: "Each auction is scored against the previous 12 auctions of the same tenor, so bills and bonds sit on one scale. Positive means weaker demand, negative stronger. With fewer than 12 prior auctions there is no score (null), never a partial one.",
  },
  {
    title: "Tenor labels",
    text: "Bills are labelled by their own term (4-Week, 17-Week, …), because Treasury sells short bills as reopenings of longer bills maturing the same day, and the original term would file a 4-Week under 17-Week. Notes and bonds are labelled by their original term (10-Year), not the remaining time to maturity shown on a reopening (9-Year 10-Month), which would split one tenor into many.",
  },
  {
    title: "Scope",
    text: "Bills, fixed-rate notes and bonds, reopenings included. Excluded: TIPS (they price inflation, not borrowing demand, and are too infrequent to score), floating-rate notes (they share a term with the 2-Year note) and cash management bills (irregular and short-notice).",
  },
  {
    title: "Bid dispersion is not a tail",
    text: "It is the high yield minus the median or average yield (discount rate for bills), in basis points: how much bidders disagreed. A true tail compares the high yield with the when-issued yield before the auction, and this site has no when-issued data.",
  },
  {
    title: "Bid-to-cover is secondary",
    text: "It counts bids that were never going to fill, so it can look healthy even when an auction went poorly. It is shown as support, not as the headline.",
  },
  {
    title: "Colour scale",
    text: "Fixed at ±3 standard deviations for every month and tenor, so colours mean the same thing everywhere. Beyond ±3 the cell keeps the end colour and gets a dark dot. Colour is never the only signal: values are always available as numbers too.",
  },
  {
    title: "Refresh and staleness",
    text: "The data is rebuilt every weekday evening (about 23:00 UTC) from U.S. Treasury Fiscal Data. If it is more than about 4 days old, a warning banner and a warning-coloured footer say so.",
  },
];

/**
 * @param {Item} item
 * @returns {HTMLElement}
 */
function buildItem(item) {
  const box = document.createElement("div");
  box.className = "meth-item";

  const title = document.createElement("strong");
  title.textContent = item.title;
  box.append(title);

  if (item.formula) {
    const code = document.createElement("code");
    code.textContent = item.formula;
    box.append(code);
  }

  const text = document.createElement("span");
  text.textContent = item.text;
  box.append(text);
  return box;
}

export function render() {
  const root = document.getElementById("methodology");
  if (!root) return;
  const heading = document.getElementById("methodology-title");

  const body = document.createElement("div");
  body.className = "meth-grid";
  body.append(...ITEMS.map(buildItem));

  const link = document.createElement("a");
  link.href = README_URL;
  link.textContent = "Full reasoning in the README →";
  link.className = "meth-link";
  link.target = "_blank";
  link.rel = "noopener";

  const details = document.createElement("details");
  details.className = "meth-details";
  const summary = document.createElement("summary");
  summary.textContent = "Show methodology";
  details.append(summary, body, link);

  // Desktop: always open. Phone: collapsed, the reader can open it.
  const phone = window.matchMedia("(max-width: 760px)");
  details.open = !phone.matches;
  phone.addEventListener("change", (e) => {
    details.open = !e.matches;
  });

  root.replaceChildren(...(heading ? [heading] : []), details);
}
