"""Production refresh: fetch everything, build, validate, write data.json.

Raises, and leaves any existing data.json untouched, if a guard fails.
Run as: python -m pipeline.refresh [--out PATH]
"""

import argparse
import datetime
import json
import sys
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

import requests

from pipeline.build import build_dataset
from pipeline.fetch import fetch_auctions_full, fetch_debt_to_penny
from pipeline.write import write_dataset


def refresh(out_path: str | Path, today: datetime.date) -> None:
    out = Path(out_path)
    previous = json.loads(out.read_text(encoding="utf-8")) if out.exists() else None
    dataset = build_dataset(fetch_auctions_full(today), previous)
    debt = _debt_stat()
    if debt is not None:
        dataset["debt"] = debt
    if previous is not None and _without_timestamp(previous) == _without_timestamp(
        dataset
    ):
        return  # Nothing but generated_at changed; keep the file so no commit follows.
    write_dataset(dataset, out)


def _debt_stat() -> dict[str, str] | None:
    """The header debt stat, or None if it can't be had.

    The debt is a nicety beside the auctions, so a bad response must not
    block publishing validated auction data.
    """
    try:
        record = fetch_debt_to_penny()
        return {
            "total_public_debt_outstanding": (
                f"${Decimal(record['tot_pub_debt_out_amt']):,.2f}"
            ),
            "as_of": record["record_date"],
        }
    except (requests.RequestException, KeyError, IndexError, InvalidOperation) as error:
        print(f"Warning: omitting debt stat: {error!r}", file=sys.stderr)
        return None


def _without_timestamp(dataset: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in dataset.items() if k != "generated_at"}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", default="data.json", help="output path")
    args = parser.parse_args()
    refresh(args.out, datetime.date.today())


if __name__ == "__main__":
    main()
