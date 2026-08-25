from __future__ import annotations

import pytest

from pipeline.metrics import compute_takedown

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
