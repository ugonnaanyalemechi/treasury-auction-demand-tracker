from collections import defaultdict
from typing import Any


def tenor_of(auction: dict[str, Any]) -> str:
    """The series an auction is labelled and scored within.

    Bills use security_term: Treasury sells short bills as reopenings of longer
    bills maturing the same day, so original_security_term would file a 4-Week
    under "17-Week". Notes and bonds use original_security_term: there,
    security_term is the remaining maturity ("29-Year 6-Month") and would
    fragment one tenor into many.
    """
    if auction["security_type"] == "Bill":
        return str(auction["security_term"])
    return str(auction["original_security_term"])


def group_by_tenor(
    auctions: list[dict[str, Any]],
) -> dict[str, list[dict[str, Any]]]:
    """Group auctions by tenor_of, the series each one is scored within."""
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for auction in auctions:
        groups[tenor_of(auction)].append(auction)
    return dict(groups)
