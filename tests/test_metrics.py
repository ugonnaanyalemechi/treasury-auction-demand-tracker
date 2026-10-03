import json
import statistics
from collections import Counter
from pathlib import Path

import pytest

from pipeline.metrics import (
    compute_bid_dispersion,
    compute_deviation,
    compute_takedown,
)

_FIXTURE_PATH = Path(__file__).parent / "fixtures" / "auctions_sample.json"

# Real 2-Year note auction, 2024-01-23 (CUSIP 91282CJV4), from Fiscal Data's
# auctions_query. Hand-computed: 8817250000 / (59460369400 + 539693200).
_KNOWN_AUCTION = {
    "cusip": "91282CJV4",
    "auction_date": "2024-01-23",
    "original_security_term": "2-Year",
    "primary_dealer_accepted": "8817250000",
    "comp_accepted": "59460369400",
    "noncomp_accepted": "539693200",
    "soma_accepted": "0",
}


def test_compute_takedown_matches_hand_computed_ratio_for_a_known_auction() -> None:
    assert compute_takedown(_KNOWN_AUCTION) == pytest.approx(0.14695401334464608)


def test_compute_takedown_is_invariant_to_soma_accepted() -> None:
    without_soma = {**_KNOWN_AUCTION, "soma_accepted": "0"}
    with_soma = {**_KNOWN_AUCTION, "soma_accepted": "15631526200"}

    assert compute_takedown(with_soma) == compute_takedown(without_soma)


def _auction(date: str, dealer: str, tenor: str = "10-Year") -> dict[str, str]:
    return {
        "cusip": f"CUSIP{tenor}{date}",
        "auction_date": date,
        "original_security_term": tenor,
        "primary_dealer_accepted": dealer,
        "comp_accepted": "100",
        "noncomp_accepted": "0",
        "soma_accepted": "0",
    }


def _history(count: int, tenor: str = "10-Year") -> list[dict[str, str]]:
    # Takedowns 0.10, 0.11, ... one auction per month, oldest first.
    return [
        _auction(f"2024-{month:02d}-01", str(10 + month), tenor)
        for month in range(1, count + 1)
    ]


def test_deviation_is_zscore_against_prior_twelve_same_tenor_auctions() -> None:
    prior = _history(12)
    current = _auction("2025-01-01", "30")
    # Prior takedowns are 0.11 .. 0.22: mean 0.165, sample stdev ~0.03606.
    expected = (0.30 - statistics.mean(range(11, 23)) / 100) / (
        statistics.stdev(range(11, 23)) / 100
    )

    result = compute_deviation(current, [*prior, current])

    assert result == pytest.approx(expected)


def test_deviation_uses_only_the_twelve_most_recent_prior_auctions() -> None:
    older = _auction("2023-01-01", "90")
    prior = _history(12)
    current = _auction("2025-01-01", "30")

    with_older = compute_deviation(current, [older, *prior, current])
    without_older = compute_deviation(current, [*prior, current])

    assert with_older == without_older


def test_deviation_ignores_other_tenors_and_later_auctions() -> None:
    prior = _history(12)
    current = _auction("2025-01-01", "30")
    noise = [
        *_history(12, tenor="5-Year"),
        _auction("2025-06-01", "99"),
    ]

    assert compute_deviation(current, [*prior, current, *noise]) == compute_deviation(
        current, [*prior, current]
    )


def test_deviation_is_none_with_fewer_than_twelve_prior_auctions() -> None:
    prior = _history(11)
    current = _auction("2025-01-01", "30")

    assert compute_deviation(current, [*prior, current]) is None


def test_deviation_is_none_for_fixture_tenors_with_under_twelve_auctions() -> None:
    payload = json.loads(_FIXTURE_PATH.read_text(encoding="utf-8"))
    auctions = payload["data"]
    tenor_counts = Counter(a["original_security_term"] for a in auctions)
    under_twelve = [t for t, n in tenor_counts.items() if n < 12]
    assert under_twelve, "fixture is expected to contain a tenor with under twelve auctions"

    for auction in auctions:
        if auction["original_security_term"] in under_twelve:
            assert compute_deviation(auction, auctions) is None


def test_deviation_is_none_when_trailing_window_has_no_variance() -> None:
    prior = [_auction(f"2024-{m:02d}-01", "10") for m in range(1, 13)]
    current = _auction("2025-01-01", "30")

    assert compute_deviation(current, [*prior, current]) is None


def _first_fixture_auction(security_type: str) -> dict[str, str]:
    payload = json.loads(_FIXTURE_PATH.read_text(encoding="utf-8"))
    return next(a for a in payload["data"] if a["security_type"] == security_type)


def test_bid_dispersion_for_a_coupon_uses_yields_in_basis_points() -> None:
    note = _first_fixture_auction("Note")
    # high_yield 4.0730 - avg_med_yield 3.989000 = 0.084 percentage points.
    assert note["avg_med_discnt_rate"] == "null"

    assert compute_bid_dispersion(note) == pytest.approx(8.4)


def test_bid_dispersion_for_a_bill_uses_discount_rates_in_basis_points() -> None:
    bill = _first_fixture_auction("Bill")
    # high_discnt_rate 3.715 - avg_med_discnt_rate 3.69 = 0.025 percentage points.
    assert bill["avg_med_yield"] == "null"

    assert compute_bid_dispersion(bill) == pytest.approx(2.5)
