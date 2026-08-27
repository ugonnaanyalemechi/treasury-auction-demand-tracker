"""Walking-skeleton script: fetch one tenor, compute takedown only, write data.json.

Deliberately shallow -- deviation, SOMA exclusion, bid dispersion, and the
validation guards are not implemented yet. Superseded by build_dataset (#17).
Run as: python -m pipeline.skeleton <tenor> [--out PATH]
"""

import argparse
import datetime
from typing import Any

from pipeline.fetch import fetch_auctions_page
from pipeline.metrics import compute_takedown
from pipeline.write import write_dataset

# Five years are fetched so trailing-window scores are warm on day one, even
# though only 24 months are displayed. See SPEC.md, "Data source".
_HISTORY_DAYS = 365 * 5


def build_skeleton_dataset(payload: dict[str, Any]) -> dict[str, Any]:
    """Assemble a minimal, takedown-only dataset from one fetch_auctions_page payload."""
    records = [
        {
            "auction_date": auction["auction_date"],
            "original_security_term": auction["original_security_term"],
            "takedown": compute_takedown(auction),
        }
        for auction in payload["data"]
    ]
    return {
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "row_count": len(records),
        "auctions": records,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("tenor", help='original_security_term, e.g. "10-Year"')
    parser.add_argument("--out", default="data.json", help="output path")
    args = parser.parse_args()

    end_date = datetime.date.today()
    start_date = end_date - datetime.timedelta(days=_HISTORY_DAYS)

    payload = fetch_auctions_page(args.tenor, start_date, end_date)
    dataset = build_skeleton_dataset(payload)
    write_dataset(dataset, args.out)

    print(f"Wrote {dataset['row_count']} auctions for {args.tenor} to {args.out}")


if __name__ == "__main__":
    main()
