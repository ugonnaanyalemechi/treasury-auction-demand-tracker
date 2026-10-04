import json
from pathlib import Path

from pipeline.passthrough import passthrough_fields

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "auctions_sample.json"


def _load_auctions() -> list[dict[str, str]]:
    payload = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    auctions: list[dict[str, str]] = payload["data"]
    return auctions


def test_allocation_and_bid_to_cover_are_carried_through_as_published() -> None:
    auction = _load_auctions()[0]

    fields = passthrough_fields(auction)

    assert fields["allocation_pctage"] == auction["allocation_pctage"] == "92.210000"
    assert (
        fields["bid_to_cover_ratio"] == auction["bid_to_cover_ratio"] == "2.330000"
    )


def test_soma_accepted_is_published_as_its_own_field_on_every_record() -> None:
    auctions = _load_auctions()
    assert {a["soma_accepted"] for a in auctions} - {"0"}, (
        "fixture is expected to contain a non-zero SOMA amount"
    )

    for auction in auctions:
        assert passthrough_fields(auction)["soma_accepted"] == auction["soma_accepted"]
