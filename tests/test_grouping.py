import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from pipeline.grouping import group_by_tenor, tenor_of

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "auctions_sample.json"


@lru_cache
def _load_auctions() -> list[dict[str, Any]]:
    payload = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    auctions: list[dict[str, Any]] = payload["data"]
    return auctions


def test_groups_are_keyed_by_tenor() -> None:
    auctions = _load_auctions()

    groups = group_by_tenor(auctions)

    for tenor, members in groups.items():
        assert all(tenor_of(a) == tenor for a in members)
    assert sum(len(members) for members in groups.values()) == len(auctions)


def test_coupon_reopening_groups_under_original_tenor_not_remaining_term() -> None:
    auctions = _load_auctions()
    reopening = next(
        a
        for a in auctions
        if a["reopening"] == "Yes"
        and a["original_security_term"] == "10-Year"
        and a["security_term"] != "10-Year"
    )

    groups = group_by_tenor(auctions)

    assert reopening in groups["10-Year"]
    assert reopening["security_term"] not in groups


def test_bill_sold_on_a_longer_bills_cusip_groups_under_the_bill_auctioned() -> None:
    auctions = _load_auctions()
    # A 4-Week bill sold as a reopening of a CUSIP first issued as a 17-Week.
    four_week = next(
        a
        for a in auctions
        if a["security_type"] == "Bill"
        and a["original_security_term"] == "17-Week"
        and a["security_term"] == "4-Week"
    )

    groups = group_by_tenor(auctions)

    assert four_week in groups["4-Week"]
    assert four_week not in groups["17-Week"]
