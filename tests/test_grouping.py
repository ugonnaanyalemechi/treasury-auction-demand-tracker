import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from pipeline.grouping import group_by_original_term

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "auctions_sample.json"


@lru_cache
def _load_auctions() -> list[dict[str, Any]]:
    payload = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    auctions: list[dict[str, Any]] = payload["data"]
    return auctions


def test_groups_are_keyed_by_original_security_term() -> None:
    auctions = _load_auctions()

    groups = group_by_original_term(auctions)

    for term, members in groups.items():
        assert all(a["original_security_term"] == term for a in members)
    assert sum(len(members) for members in groups.values()) == len(auctions)


def test_reopening_groups_under_original_tenor_not_remaining_term() -> None:
    auctions = _load_auctions()
    reopening = next(
        a
        for a in auctions
        if a["reopening"] == "Yes"
        and a["original_security_term"] == "10-Year"
        and a["security_term"] != "10-Year"
    )

    groups = group_by_original_term(auctions)

    assert reopening in groups["10-Year"]
    assert reopening["security_term"] not in groups
