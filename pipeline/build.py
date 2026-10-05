import datetime
from typing import Any

from pipeline.filters import exclude_floating_rate_notes, filter_included_securities
from pipeline.grouping import group_by_original_term
from pipeline.metrics import compute_bid_dispersion, compute_deviation, compute_takedown
from pipeline.passthrough import passthrough_fields
from pipeline.unheld import split_unheld_auctions

Dataset = dict[str, Any]


def build_dataset(
    raw_payload: dict[str, Any], previous_dataset: Dataset | None = None
) -> Dataset:
    """Turn a raw Fiscal Data auctions payload into the published dataset.

    previous_dataset is accepted for the validation guards (#18-#21) and is
    not used yet.
    """
    in_scope = exclude_floating_rate_notes(
        filter_included_securities(raw_payload["data"])
    )
    held, upcoming = split_unheld_auctions(in_scope)

    records = [
        _build_record(auction, tenor_auctions)
        for tenor_auctions in group_by_original_term(held).values()
        for auction in tenor_auctions
    ]
    records.sort(key=lambda record: (record["auction_date"], record["cusip"]))

    return {
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "row_count": len(records),
        "auctions": records,
        "upcoming": upcoming,
    }


def _build_record(
    auction: dict[str, Any], tenor_auctions: list[dict[str, Any]]
) -> dict[str, Any]:
    return {
        "cusip": auction["cusip"],
        "auction_date": auction["auction_date"],
        "security_type": auction["security_type"],
        # original_security_term, deliberately not security_term: the latter is
        # the remaining maturity on a reopening and would fragment one tenor.
        "tenor": auction["original_security_term"],
        "reopening": auction["reopening"] == "Yes",
        "takedown": compute_takedown(auction),
        "deviation": compute_deviation(auction, tenor_auctions),
        "bid_dispersion": compute_bid_dispersion(auction),
        "primary_dealer_accepted": auction["primary_dealer_accepted"],
        "comp_accepted": auction["comp_accepted"],
        "noncomp_accepted": auction["noncomp_accepted"],
        **passthrough_fields(auction),
    }
