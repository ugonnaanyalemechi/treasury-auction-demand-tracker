# Treasury Auction Demand Tracker

Tracks demand at U.S. Treasury auctions across the yield curve, to answer which tenors the market is absorbing well and which it isn't.

## Language

### Securities & Auctions

**Security**:
A specific Treasury debt instrument, uniquely identified by CUSIP. A Security can be sold across more than one Auction — an original issuance plus any Reopenings — so CUSIP alone does not identify a single Auction.
_Avoid_: Bond (as a catch-all — Bond is one Security Type, see below), Issue

**Auction**:
A single sale event for a Security, uniquely identified by the pair (CUSIP, auction date). This is the atomic unit the site scores.
_Avoid_: Sale, Issuance

**Tenor**:
The maturity bucket a Security belongs to at first issuance — e.g. "10-Year", "17-Week" — taken from `original_security_term`. This is the row label on the heatmap and the grouping key for Deviation. Never taken from `security_term`, which reports the *remaining* time to maturity on a Reopening (e.g. "9-Year 10-Month") and would silently fragment one Tenor into many.
_Avoid_: Term, Maturity, Duration

**Security Type**:
Treasury's own category for a Security: Bill, Note, or Bond. Distinct from Tenor — a Note can be a 2-Year, 3-Year, 5-Year, 7-Year, or 10-Year.
_Avoid_: Instrument type

**Reopening**:
An Auction that issues additional supply of an existing Security rather than creating a new one. Shares the original CUSIP. Included in this project's data, and flagged as such — not treated as a fresh Tenor data point.

**FRN (Floating Rate Note)**:
A Note whose rate resets periodically rather than being fixed at issuance. Distinguished from a fixed-rate Note of the same Tenor only by the `floating_rate` field — critically, the 2-Year FRN shares `original_security_term` ("2-Year") with the 2-Year fixed Note, so Tenor alone cannot separate them. Excluded from this project's scope entirely.
_Avoid_: Floater

**TIPS**:
A Security whose principal is indexed to inflation. Excluded from this project's scope — it prices an inflation view, not a borrowing-demand view, and auctions too infrequently per Tenor to support a Trailing Window.

**CMB (Cash Management Bill)**:
An irregular, short-notice Bill issued outside the regular auction calendar, sometimes for as little as a few days. Excluded from this project's scope.

**Unheld Auction**:
An Auction that has been announced but not yet held — results fields are absent (represented by the upstream API as the literal string `"null"`, not JSON null). Shown on the site as "upcoming"; never included in Auction records or any Trailing Window calculation.
_Avoid_: Announced auction (used interchangeably, but "Unheld" is canonical since it's the state that matters for filtering — an Auction can be announced *and* held)

### Demand Metrics

**Primary Dealer**:
One of the ~24 banks obligated to bid at every Auction, acting as buyer of last resort. A high Dealer Takedown means the open market did not want the Security and dealers absorbed the excess.

**Dealer Takedown**:
The share of an Auction's public demand absorbed by Primary Dealers: `primary_dealer_accepted / (comp_accepted + noncomp_accepted)`. SOMA is excluded from both sides of this ratio (see SOMA below). This project's headline demand metric.
_Avoid_: Dealer share, Takedown ratio

**SOMA**:
The Federal Reserve's Treasury holdings (System Open Market Account). When SOMA securities mature, the Fed rolls them into the new Auction without submitting a competitive bid — this is issued on top of the announced offering amount, not part of public demand. Excluded from both the numerator and denominator of Dealer Takedown so that Fed maturity scheduling cannot be mistaken for a change in investor appetite. Published as its own field so the ratio can be reconstructed under other definitions.
_Avoid_: Fed add-on, Fed holdings

**Trailing Window**:
The 12 most recent Auctions of the same Tenor, used as the baseline an Auction's Dealer Takedown is scored against. An Auction with fewer than 12 prior same-Tenor Auctions has no Deviation — never a partial-window value.
_Avoid_: Lookback period, Baseline

**Deviation**:
An Auction's Dealer Takedown expressed as a z-score against its Tenor's Trailing Window: `(takedown - mean) / stdev` of the prior 12 same-Tenor Auctions. This is what makes Auctions across different Tenors comparable on one chart — the site's core normalization. Positive Deviation means weaker demand (more dealer absorption than usual for that Tenor); negative means stronger.
_Avoid_: Z-score (technically correct but not how the site talks about it), Anomaly score

**Bid Dispersion**:
The spread between an Auction's high and median-or-average yield (or discount rate, for Bills), in basis points. Measures how much bidders disagreed with each other about the Security's value. Explicitly **not** a Tail — a true Tail compares the high yield to the pre-auction when-issued yield, which this project does not have access to.
_Avoid_: Tail, Tail proxy — both actively wrong; see the Tail entry below.

**Tail**:
The auction-result yield's surprise relative to the pre-auction when-issued market. This project does not compute a Tail — it lacks when-issued data — and publishes Bid Dispersion in its place under an honest name. Kept in the glossary specifically so "Tail" is never casually reused for Bid Dispersion.

**Allocation Percentage**:
The share of bids at the Auction's high (worst accepted) yield that were filled. Near 100% means Treasury had to accept nearly everyone at the worst price to place the issue.

**Bid-to-Cover**:
Total bids tendered divided by the amount offered. Shown as a supporting metric, not the headline — it counts bids that were never going to be filled, so it can look healthy even when an Auction went poorly.
