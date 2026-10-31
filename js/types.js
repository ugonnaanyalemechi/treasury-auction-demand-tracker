// @ts-check
// JSDoc typedefs for data.json. Types only; nothing runs here.
// Amounts and some ratios arrive as strings (e.g. "15923680000"); takedown,
// deviation and bid_dispersion are already numbers.

/**
 * The 14 tenors, bills then coupons.
 * @typedef {"4-Week" | "6-Week" | "8-Week" | "13-Week" | "17-Week" | "26-Week" | "52-Week" | "2-Year" | "3-Year" | "5-Year" | "7-Year" | "10-Year" | "20-Year" | "30-Year"} Tenor
 */

/**
 * One completed auction.
 * @typedef {object} Auction
 * @property {string} cusip
 * @property {string} auction_date  ISO date, "YYYY-MM-DD"
 * @property {string} security_type  "Bill", "Note" or "Bond"
 * @property {Tenor} tenor
 * @property {boolean} reopening
 * @property {number} takedown  dealer share of accepted amount, 0 to 1
 * @property {number | null} deviation  sigma vs prior 12 auctions; null if not yet scored
 * @property {number | null} bid_dispersion  high minus median yield, basis points
 * @property {string} primary_dealer_accepted  dollars
 * @property {string} comp_accepted  dollars
 * @property {string} noncomp_accepted  dollars
 * @property {string} allocation_pctage  percent
 * @property {string} bid_to_cover_ratio
 * @property {string} soma_accepted  dollars
 */

/**
 * One announced-but-not-yet-held auction.
 * @typedef {object} UpcomingAuction
 * @property {string} auction_date  ISO date
 * @property {Tenor} tenor
 * @property {string} offering_amt  dollars
 */

/**
 * @typedef {object} Debt
 * @property {string} total_public_debt_outstanding  e.g. "$40,305,316,210,829.72"
 * @property {string} as_of  ISO date
 */

/**
 * The whole data.json file.
 * @typedef {object} Dataset
 * @property {string} generated_at  ISO timestamp
 * @property {number} row_count
 * @property {Auction[]} auctions
 * @property {UpcomingAuction[]} upcoming
 * @property {Debt} debt
 */

/**
 * Shared UI state, owned by js/main.js.
 * @typedef {object} AppState
 * @property {Tenor} selectedTenor
 */

export {};
