import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from pipeline.metrics import compute_deviation
from pipeline.unheld import split_unheld_auctions

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "auctions_sample.json"


@lru_cache
def _load_auctions() -> list[dict[str, Any]]:
    payload = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    auctions: list[dict[str, Any]] = payload["data"]
    return auctions


def _fixture_unheld() -> dict[str, Any]:
    unheld = [a for a in _load_auctions() if a["total_accepted"] == "null"]
    assert len(unheld) == 1, "fixture is expected to contain one unheld auction"
    return unheld[0]


def test_unheld_auctions_never_appear_in_the_held_records() -> None:
    held, _ = split_unheld_auctions(_load_auctions())

    assert _fixture_unheld() not in held
    assert all(a["total_accepted"] != "null" for a in held)
    assert len(held) == len(_load_auctions()) - 1


def test_unheld_auctions_are_carried_with_only_size_and_date() -> None:
    unheld = _fixture_unheld()

    _, upcoming = split_unheld_auctions(_load_auctions())

    assert upcoming == [
        {
            "auction_date": unheld["auction_date"],
            "offering_amt": unheld["offering_amt"],
        }
    ]


def test_unheld_auction_does_not_influence_a_trailing_average() -> None:
    unheld = _fixture_unheld()
    tenor = unheld["original_security_term"]

    def held_auction(date: str, dealer: str) -> dict[str, Any]:
        return {
            "auction_date": date,
            "original_security_term": tenor,
            "primary_dealer_accepted": dealer,
            "comp_accepted": "100",
            "noncomp_accepted": "0",
            "total_accepted": "100",
        }

    priors = [held_auction(f"2025-{m:02d}-01", str(10 + m)) for m in range(1, 13)]
    current = held_auction("2026-10-01", "30")
    assert priors[-1]["auction_date"] < unheld["auction_date"] < current["auction_date"]

    # Left in, the unheld auction would sit inside the trailing window.
    held, _ = split_unheld_auctions([*priors, unheld, current])

    assert compute_deviation(current, held) == compute_deviation(
        current, [*priors, current]
    )
