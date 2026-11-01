// @ts-check
// Upcoming auctions list (issue #38). Renders into #upcoming, under the
// section's existing <h2>. Pure display: no scoring happens here.

import { el, MONTH_NAMES } from "./format.js";

/** @typedef {import("./types.js").UpcomingAuction} UpcomingAuction */

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * "2026-10-12" -> "Mon 12 Oct 2026". Uses UTC so the local time zone can
 * never shift the date. Returns the input unchanged if it is not an ISO date.
 * @param {string} iso
 */
function formatDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${weekday} ${d} ${MONTH_NAMES[m - 1]} ${y}`;
}

/**
 * "50000000000" -> "$50bn offered". Falls back to "size not announced" if the
 * amount is missing or not a number.
 * @param {string} amount  dollars, as a string
 */
function formatOffered(amount) {
  const dollars = Number(amount);
  if (amount == null || amount === "" || !Number.isFinite(dollars)) return "size not announced";
  const bn = dollars / 1e9;
  const text = Number.isInteger(bn) ? String(bn) : bn.toFixed(1);
  return `$${text}bn offered`;
}

/** @param {UpcomingAuction[]} upcoming */
export function render(upcoming) {
  const section = document.getElementById("upcoming");
  if (!section) return;

  // Own container, so repeated renders replace content and keep the <h2>.
  let body = section.querySelector(".upcoming-body");
  if (!body) {
    body = document.createElement("div");
    body.className = "upcoming-body";
    section.append(body);
  }

  const note = document.createElement("p");
  note.className = "upcoming-note";
  note.textContent =
    "Announced but not yet held. They are excluded from every score until results publish.";

  const rows = [...(upcoming ?? [])].sort((a, b) => a.auction_date.localeCompare(b.auction_date));

  if (rows.length === 0) {
    const empty = document.createElement("p");
    empty.className = "upcoming-empty";
    empty.textContent =
      "No auctions announced right now. New ones appear here once Treasury announces them.";
    body.replaceChildren(note, empty);
    return;
  }

  const list = document.createElement("ul");
  list.className = "upcoming-list";
  for (const auction of rows) {
    const item = document.createElement("li");
    item.className = "upcoming-row";
    // The tenor can be absent from older data.json files; omit it then.
    const date = formatDate(auction.auction_date);
    const what = auction.tenor ? `${date} · ${auction.tenor}` : date;
    item.append(el("span", "upcoming-what", what), el("span", "upcoming-amt", formatOffered(auction.offering_amt)));
    list.append(item);
  }
  body.replaceChildren(note, list);
}
