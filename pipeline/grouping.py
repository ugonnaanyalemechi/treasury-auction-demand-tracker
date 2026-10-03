from collections import defaultdict
from typing import Any


def group_by_original_term(
    auctions: list[dict[str, Any]],
) -> dict[str, list[dict[str, Any]]]:
    """Group by original_security_term so reopenings keep their original tenor."""
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for auction in auctions:
        groups[auction["original_security_term"]].append(auction)
    return dict(groups)
