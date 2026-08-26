from typing import Any


def compute_takedown(auction: dict[str, Any]) -> float:
    """Share of an auction's public demand absorbed by primary dealers."""
    primary_dealer_accepted = float(auction["primary_dealer_accepted"])
    comp_accepted = float(auction["comp_accepted"])
    noncomp_accepted = float(auction["noncomp_accepted"])
    return primary_dealer_accepted / (comp_accepted + noncomp_accepted)
