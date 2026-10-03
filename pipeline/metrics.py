import statistics
from typing import Any


def compute_takedown(auction: dict[str, Any]) -> float:
    """Share of an auction's public demand absorbed by primary dealers."""
    primary_dealer_accepted = float(auction["primary_dealer_accepted"])
    comp_accepted = float(auction["comp_accepted"])
    noncomp_accepted = float(auction["noncomp_accepted"])
    return primary_dealer_accepted / (comp_accepted + noncomp_accepted)


TRAILING_WINDOW_SIZE = 12


def compute_deviation(
    auction: dict[str, Any], auctions: list[dict[str, Any]]
) -> float | None:
    """Z-score of an auction's takedown against its tenor's trailing window.

    The window is the 12 most recent earlier auctions sharing the auction's
    original_security_term. Returns None, never a partial-window score, when
    fewer than 12 exist or the window has no variance.
    """
    prior = sorted(
        (
            a
            for a in auctions
            if a["original_security_term"] == auction["original_security_term"]
            and a["auction_date"] < auction["auction_date"]
        ),
        key=lambda a: a["auction_date"],
    )[-TRAILING_WINDOW_SIZE:] # last 12 items
    if len(prior) < TRAILING_WINDOW_SIZE:
        return None

    takedowns = [compute_takedown(a) for a in prior]
    stdev = statistics.stdev(takedowns)
    if stdev == 0:
        return None
    return (compute_takedown(auction) - statistics.mean(takedowns)) / stdev


def compute_bid_dispersion(auction: dict[str, Any]) -> float:
    """Spread between an auction's high and median-or-average rate, in bp.

    Bills are quoted on a discount rate; notes and bonds on a yield.
    """
    if auction["security_type"] == "Bill":
        high, average = auction["high_discnt_rate"], auction["avg_med_discnt_rate"]
    else:
        high, average = auction["high_yield"], auction["avg_med_yield"]
    return (float(high) - float(average)) * 100
