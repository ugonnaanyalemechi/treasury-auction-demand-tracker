"""Thin shell: fetch one tenor, run build_dataset, write data.json.

Validation guards and the all-tenor production fetch are not wired in yet.
Run as: python -m pipeline.skeleton <tenor> [--out PATH]
"""

import argparse
import datetime

from pipeline.build import build_dataset
from pipeline.fetch import fetch_auctions_page
from pipeline.write import write_dataset

# To obtain previous auction records from 5 years ago
_HISTORY_DAYS = 365 * 5


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("tenor", help='original_security_term, e.g. "10-Year"')
    parser.add_argument("--out", default="data.json", help="output path")
    args = parser.parse_args()

    end_date = datetime.date.today()
    start_date = end_date - datetime.timedelta(days=_HISTORY_DAYS)

    payload = fetch_auctions_page(args.tenor, start_date, end_date)
    dataset = build_dataset(payload)
    write_dataset(dataset, args.out)

    print(f"Wrote {dataset['row_count']} auctions for {args.tenor} to {args.out}")


if __name__ == "__main__":
    main()
