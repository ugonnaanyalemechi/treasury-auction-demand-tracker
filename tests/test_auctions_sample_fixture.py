"""Guards the shared ~40-auction fixture against accidental edits.

The fixture is a captured, unmodified real Fiscal Data API response (see
SPEC.md's Fixtures section and issue #8). These tests assert the hazards
it must exercise are actually present, so a future edit that narrows the
fixture can't silently drop one without a test failing.
"""

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "auctions_sample.json"


@lru_cache
def _load_auctions() -> list[dict[str, Any]]:
    payload = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    auctions: list[dict[str, Any]] = payload["data"]
    return auctions


def test_fixture_has_roughly_forty_auctions() -> None:
    auctions = _load_auctions()
    assert 30 <= len(auctions) <= 50


def test_fixture_contains_a_2_year_fixed_note_and_a_2_year_frn() -> None:
    auctions = _load_auctions()
    two_year = [a for a in auctions if a["original_security_term"] == "2-Year"]

    assert any(a["floating_rate"] == "No" for a in two_year)
    assert any(a["floating_rate"] == "Yes" for a in two_year)


def test_fixture_contains_an_auction_with_a_large_soma_component() -> None:
    auctions = _load_auctions()

    def soma_ratio(auction: dict[str, Any]) -> float:
        try:
            offering = float(auction["offering_amt"])
            return float(auction["soma_accepted"]) / offering if offering else 0.0
        except ValueError:
            return 0.0

    assert any(soma_ratio(a) > 0.10 for a in auctions)


def test_fixture_contains_an_unheld_auction_with_null_results() -> None:
    auctions = _load_auctions()
    unheld = [a for a in auctions if a["primary_dealer_accepted"] == "null"]

    assert unheld
    for auction in unheld:
        assert auction["comp_accepted"] == "null"
        assert auction["noncomp_accepted"] == "null"


def test_fixture_contains_a_tenor_with_fewer_than_twelve_auctions() -> None:
    auctions = _load_auctions()
    counts: dict[str, int] = {}
    for auction in auctions:
        term = auction["original_security_term"]
        counts[term] = counts.get(term, 0) + 1

    assert counts
    assert any(count < 12 for count in counts.values())


def test_fixture_contains_a_reopening() -> None:
    auctions = _load_auctions()
    assert any(a["reopening"] == "Yes" for a in auctions)


def test_fixture_contains_a_bill_and_a_coupon_security() -> None:
    auctions = _load_auctions()
    assert any(a["security_type"] == "Bill" for a in auctions)
    assert any(a["security_type"] in ("Note", "Bond") for a in auctions)
