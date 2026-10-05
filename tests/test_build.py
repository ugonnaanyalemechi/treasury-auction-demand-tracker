import json
from pathlib import Path
from typing import Any

import pytest

from pipeline.build import build_dataset
from pipeline.metrics import compute_bid_dispersion, compute_deviation, compute_takedown

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "auctions_sample.json"

_RECORD_KEYS = {
    "cusip",
    "auction_date",
    "security_type",
    "tenor",
    "reopening",
    "takedown",
    "deviation",
    "bid_dispersion",
    "allocation_pctage",
    "bid_to_cover_ratio",
    "primary_dealer_accepted",
    "comp_accepted",
    "noncomp_accepted",
    "soma_accepted",
}


def _fixture_payload() -> dict[str, Any]:
    payload: dict[str, Any] = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    return payload


def test_full_fixture_is_assembled_into_the_published_shape() -> None:
    payload = _fixture_payload()
    raw = payload["data"]
    in_scope = [
        a
        for a in raw
        if a["inflation_index_security"] == "No"
        and a["cash_management_bill_cmb"] == "No"
        and a["floating_rate"] == "No"
    ]
    unheld = [a for a in in_scope if a["total_accepted"] == "null"]
    assert unheld, "fixture is expected to contain an unheld auction"

    dataset = build_dataset(payload)

    assert set(dataset) == {"generated_at", "row_count", "auctions", "upcoming"}
    assert isinstance(dataset["generated_at"], str)
    assert dataset["row_count"] == len(dataset["auctions"])
    assert dataset["row_count"] == len(in_scope) - len(unheld)
    assert all(set(record) == _RECORD_KEYS for record in dataset["auctions"])
    assert dataset["upcoming"] == [
        {"auction_date": a["auction_date"], "offering_amt": a["offering_amt"]}
        for a in unheld
    ]


def test_records_carry_values_computed_from_the_source_auction() -> None:
    payload = _fixture_payload()
    source = next(
        a
        for a in payload["data"]
        if a["security_type"] == "Bill"
        and a["floating_rate"] == "No"
        and a["total_accepted"] != "null"
    )

    dataset = build_dataset(payload)
    record = next(
        r
        for r in dataset["auctions"]
        if r["cusip"] == source["cusip"] and r["auction_date"] == source["auction_date"]
    )

    assert record["tenor"] == source["original_security_term"]
    assert record["security_type"] == "Bill"
    assert record["reopening"] == (source["reopening"] == "Yes")
    assert record["takedown"] == compute_takedown(source)
    assert record["bid_dispersion"] == compute_bid_dispersion(source)
    assert record["allocation_pctage"] == source["allocation_pctage"]
    assert record["soma_accepted"] == source["soma_accepted"]


def test_out_of_scope_and_unheld_auctions_are_absent_from_the_records() -> None:
    payload = _fixture_payload()
    out_of_scope = {
        a["cusip"]
        for a in payload["data"]
        if a["floating_rate"] == "Yes" or a["inflation_index_security"] == "Yes"
    }
    assert out_of_scope

    dataset = build_dataset(payload)

    assert not any(r["cusip"] in out_of_scope for r in dataset["auctions"])


def test_two_year_tenor_contains_only_fixed_rate_auctions() -> None:
    payload = _fixture_payload()
    fixed_two_year = [
        a
        for a in payload["data"]
        if a["original_security_term"] == "2-Year" and a["floating_rate"] == "No"
    ]

    dataset = build_dataset(payload)

    two_year = [r for r in dataset["auctions"] if r["tenor"] == "2-Year"]
    assert len(two_year) == len(fixed_two_year)


def test_deviation_is_null_for_tenors_with_under_twelve_priors_and_scored_after() -> None:
    payload = _fixture_payload()
    assert all(r["deviation"] is None for r in build_dataset(payload)["auctions"])

    history = [
        {
            **payload["data"][0],
            "cusip": f"SYNTH{month:02d}",
            "auction_date": f"2024-{month:02d}-01",
            "original_security_term": "SYNTH-Year",
            "floating_rate": "No",
            "inflation_index_security": "No",
            "cash_management_bill_cmb": "No",
            "primary_dealer_accepted": str(10 + month),
            "comp_accepted": "100",
            "noncomp_accepted": "0",
        }
        for month in range(1, 13)
    ]
    current = {
        **history[0],
        "cusip": "SYNTH13",
        "auction_date": "2025-01-01",
        "primary_dealer_accepted": "30",
    }

    dataset = build_dataset({"data": [*history, current]})

    scored = {r["cusip"]: r["deviation"] for r in dataset["auctions"]}
    assert scored["SYNTH12"] is None
    assert scored["SYNTH13"] == pytest.approx(compute_deviation(current, history))
    assert scored["SYNTH13"] is not None
