from typing import Any

from pipeline.validation import check_row_count


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
