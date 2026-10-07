import json
from pathlib import Path
from typing import Any

from pipeline.validation import (
    check_newest_auction_date,
    check_required_fields,
    check_row_count,
)


def _dataset(row_count: int) -> dict[str, Any]:
    return {"row_count": row_count, "auctions": []}


def test_row_count_within_tolerance_passes() -> None:
    assert check_row_count(_dataset(65), _dataset(60)) is None
    assert check_row_count(_dataset(55), _dataset(60)) is None
    assert check_row_count(_dataset(60), _dataset(60)) is None


def test_row_count_drop_beyond_twenty_percent_is_flagged() -> None:
    problem = check_row_count(_dataset(12), _dataset(60))

    assert problem is not None
    assert "12" in problem and "60" in problem


def test_row_count_jump_beyond_twenty_percent_is_flagged() -> None:
    assert check_row_count(_dataset(73), _dataset(60)) is not None


def test_exactly_twenty_percent_deviation_is_not_flagged() -> None:
    assert check_row_count(_dataset(72), _dataset(60)) is None
    assert check_row_count(_dataset(48), _dataset(60)) is None


def test_no_previous_dataset_means_nothing_to_compare() -> None:
    assert check_row_count(_dataset(60), None) is None
    assert check_row_count(_dataset(60), _dataset(0)) is None


def _dataset_newest(*auction_dates: str) -> dict[str, Any]:
    return {
        "row_count": len(auction_dates),
        "auctions": [{"auction_date": d} for d in auction_dates],
    }


def test_newest_auction_date_unchanged_or_advanced_passes() -> None:
    previous = _dataset_newest("2025-01-07", "2025-02-04")

    assert check_newest_auction_date(_dataset_newest("2025-01-07", "2025-02-04"), previous) is None
    assert check_newest_auction_date(_dataset_newest("2025-01-07", "2025-03-04"), previous) is None


def test_newest_auction_date_regression_is_flagged() -> None:
    previous = _dataset_newest("2025-01-07", "2025-02-04")

    problem = check_newest_auction_date(_dataset_newest("2025-01-07", "2025-01-21"), previous)

    assert problem is not None
    assert "2025-01-21" in problem and "2025-02-04" in problem


def test_newest_auction_date_has_nothing_to_compare_without_both_sides() -> None:
    assert check_newest_auction_date(_dataset_newest("2025-01-07"), None) is None
    assert check_newest_auction_date(_dataset_newest(), _dataset_newest("2025-01-07")) is None
    assert check_newest_auction_date(_dataset_newest("2025-01-07"), _dataset_newest()) is None


FIXTURE_PATH =Path(__file__).parent / "fixtures" / "auctions_sample.json"


def _fixture_auctions() -> list[dict[str, Any]]:
    payload = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    auctions: list[dict[str, Any]] = payload["data"]
    return auctions


def test_clean_fixture_has_no_field_problems() -> None:
    assert check_required_fields(_fixture_auctions()) == []


def test_a_field_missing_from_the_source_is_flagged() -> None:
    renamed = [
        {k: v for k, v in a.items() if k != "high_yield"} for a in _fixture_auctions()
    ]

    problems = check_required_fields(renamed)

    assert any("high_yield" in p and "absent" in p for p in problems)


def test_a_field_null_on_more_than_five_percent_of_held_auctions_is_flagged() -> None:
    degraded = [{**a, "allocation_pctage": "null"} for a in _fixture_auctions()]

    problems = check_required_fields(degraded)

    assert any("allocation_pctage" in p and "null" in p for p in problems)


def test_null_rate_at_or_below_five_percent_is_not_flagged() -> None:
    auctions = _fixture_auctions()
    held_cusips = [
        (a["cusip"], a["auction_date"])
        for a in auctions
        if a["total_accepted"] != "null"
        and a["floating_rate"] == "No"
        and a["inflation_index_security"] == "No"
    ]
    nulled = set(held_cusips[: len(held_cusips) // 20])  # 5% or less
    assert nulled
    degraded = [
        {**a, "bid_to_cover_ratio": "null"}
        if (a["cusip"], a["auction_date"]) in nulled
        else a
        for a in auctions
    ]

    assert check_required_fields(degraded) == []


def test_yield_nulls_on_bills_are_not_counted_against_the_yield_fields() -> None:
    auctions = _fixture_auctions()
    assert any(a["security_type"] == "Bill" and a["high_yield"] == "null" for a in auctions)

    assert not any("high_yield" in p for p in check_required_fields(auctions))


def test_source_with_no_held_in_scope_auctions_is_flagged() -> None:
    all_unheld = [{**a, "total_accepted": "null"} for a in _fixture_auctions()]

    assert check_required_fields(all_unheld) != []
    assert check_required_fields([]) != []
