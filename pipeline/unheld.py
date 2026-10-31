from typing import Any

from pipeline.grouping import tenor_of

# Treasury publishes absent results as the literal string "null", not JSON null.
_UNHELD_MARKER = "null"


def split_unheld_auctions(
    auctions: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, str]]]:
    """Separate announced-but-unheld auctions from held ones.

    Returns (held, upcoming); upcoming carries only auction_date, tenor and offering_amt.
    """
    held: list[dict[str, Any]] = []
    upcoming: list[dict[str, str]] = []

    for auction in auctions:
        if auction["total_accepted"] == _UNHELD_MARKER:
            upcoming.append(
                {
                    "auction_date": auction["auction_date"],
                    "tenor": tenor_of(auction),
                    "offering_amt": auction["offering_amt"],
                }
            )
        else:
            held.append(auction)
    return held, upcoming
