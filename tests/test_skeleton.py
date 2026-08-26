import datetime
from typing import Any

import pytest

from pipeline.skeleton import build_skeleton_dataset, start_date_for


def test_build_skeleton_dataset_produces_takedown_only_records() -> None:
    payload: dict[str, Any] = {
        "data": [
            {
                "auction_date": "2024-01-23",
                "original_security_term": "2-Year",
                "primary_dealer_accepted": "8817250000",
                "comp_accepted": "59460369400",
                "noncomp_accepted": "539693200",
            }
        ]
    }

    dataset = build_skeleton_dataset(payload)

    assert dataset["row_count"] == 1
    assert "generated_at" in dataset

    record = dataset["auctions"][0]
    assert record["auction_date"] == "2024-01-23"
    assert record["original_security_term"] == "2-Year"
    assert record["takedown"] == pytest.approx(0.14695401334464608)


def test_build_skeleton_dataset_has_no_metrics_other_than_takedown() -> None:
    payload: dict[str, Any] = {
        "data": [
            {
                "auction_date": "2024-01-23",
                "original_security_term": "2-Year",
                "primary_dealer_accepted": "8817250000",
                "comp_accepted": "59460369400",
                "noncomp_accepted": "539693200",
                "soma_accepted": "0",
                "allocation_pctage": "62.750000",
                "bid_to_cover_ratio": "2.570000",
            }
        ]
    }

    dataset = build_skeleton_dataset(payload)

    assert set(dataset["auctions"][0]) == {
        "auction_date",
        "original_security_term",
        "takedown",
    }


def test_start_date_for_does_not_crash_on_a_leap_day_end_date() -> None:
    start = start_date_for(datetime.date(2028, 2, 29), 2)
    assert isinstance(start, datetime.date)
    assert start < datetime.date(2028, 2, 29)
