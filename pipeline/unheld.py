from typing import Any

# Treasury publishes absent results as the literal string "null", not JSON null.
_UNHELD_MARKER = "null"


def split_unheld_auctions(
    auctions: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, str]]]:
    """Separate announced-but-unheld auctions from held ones.

    Returns (held, upcoming); upcoming carries only auction_date and offering_amt.
    """
    held: list[dict[str, Any]] = []
    upcoming: list[dict[str, str]] = []
    
    for auction in auctions:
        if auction["total_accepted"] == _UNHELD_MARKER:
            upcoming.append(
                {
                    "auction_date": auction["auction_date"],
                    "offering_amt": auction["offering_amt"],
                }
            )
        else:
            held.append(auction)
    return held, upcoming
