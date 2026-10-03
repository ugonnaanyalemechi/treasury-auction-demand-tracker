import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from pipeline.filters import exclude_floating_rate_notes, filter_included_securities

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "auctions_sample.json"


@lru_cache
def _load_auctions() -> list[dict[str, Any]]:
    payload = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    auctions: list[dict[str, Any]] = payload["data"]
    return auctions


def test_tips_records_are_excluded() -> None:
    auctions = _load_auctions()
    tips_cusips = {
        a["cusip"] for a in auctions if a["inflation_index_security"] == "Yes"
    }
    assert tips_cusips, "fixture is expected to contain at least one TIPS auction"

    result = filter_included_securities(auctions)

    assert not any(a["cusip"] in tips_cusips for a in result)
    assert all(a["inflation_index_security"] == "No" for a in result)


def test_cmb_records_are_excluded() -> None:
    auctions = _load_auctions()
    cmb_auction = dict(auctions[0])
    cmb_auction["cusip"] = "CMB_TEST_CUSIP"
    cmb_auction["cash_management_bill_cmb"] = "Yes"

    result = filter_included_securities([*auctions, cmb_auction])

    assert not any(a["cusip"] == "CMB_TEST_CUSIP" for a in result)
    assert all(a["cash_management_bill_cmb"] == "No" for a in result)


def test_bills_notes_and_bonds_pass_through() -> None:
    auctions = _load_auctions()
    expected_cusips = {
        a["cusip"]
        for a in auctions
        if a["inflation_index_security"] == "No"
        and a["cash_management_bill_cmb"] == "No"
    }
    assert expected_cusips, "fixture is expected to contain non-TIPS, non-CMB auctions"

    result = filter_included_securities(auctions)

    assert {a["cusip"] for a in result} == expected_cusips
    assert {a["security_type"] for a in result} <= {"Bill", "Note", "Bond"}


def test_floating_rate_records_are_excluded() -> None:
    auctions = _load_auctions()
    frn_cusips = {a["cusip"] for a in auctions if a["floating_rate"] == "Yes"}
    assert frn_cusips, "fixture is expected to contain at least one FRN auction"

    result = exclude_floating_rate_notes(auctions)

    assert not any(a["cusip"] in frn_cusips for a in result)
    assert all(a["floating_rate"] == "No" for a in result)


def test_two_year_series_contains_only_fixed_rate_auctions() -> None:
    auctions = _load_auctions()
    two_year = [a for a in auctions if a["original_security_term"] == "2-Year"]
    assert any(
        a["floating_rate"] == "Yes" for a in two_year
    ), "fixture is expected to contain a 2-Year FRN sharing the 2-Year term"
    assert any(a["floating_rate"] == "No" for a in two_year)

    result = exclude_floating_rate_notes(two_year)

    assert result
    assert all(a["floating_rate"] == "No" for a in result)
