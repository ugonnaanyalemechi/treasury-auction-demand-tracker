from typing import Any

from pipeline.filters import exclude_floating_rate_notes, filter_included_securities
from pipeline.unheld import split_unheld_auctions

ROW_COUNT_TOLERANCE = 0.20


class DatasetValidationError(Exception):
    """Raised when a built dataset fails a guard and must not be published."""


def check_row_count(
    dataset: dict[str, Any], previous_dataset: dict[str, Any] | None
) -> str | None:
    """Describe the problem if row_count moved more than 20% since the last run.

    Returns None when the count is plausible or there is nothing to compare to.
    """
    if previous_dataset is None or previous_dataset["row_count"] == 0:
        return None
    current, previous = dataset["row_count"], previous_dataset["row_count"]
    if abs(current - previous) / previous > ROW_COUNT_TOLERANCE:
        return (
            f"row_count {current} deviates from previous run's {previous} "
            f"by more than {ROW_COUNT_TOLERANCE:.0%}"
        )
    return None


def check_newest_auction_date(
    dataset: dict[str, Any], previous_dataset: dict[str, Any] | None
) -> str | None:
    """Describe the problem if the newest auction date went backwards.

    Returns None when the newest date held or advanced, or when either dataset
    has no auctions to compare.
    """
    if previous_dataset is None:
        return None
    current = _newest_auction_date(dataset)
    previous = _newest_auction_date(previous_dataset)
    if current is None or previous is None:
        return None
    if current < previous:
        return (
            f"newest auction date {current} is older than previous run's {previous}"
        )
    return None


def _newest_auction_date(dataset: dict[str, Any]) -> str | None:
    # ISO dates, so string order is date order.
    return max((a["auction_date"] for a in dataset["auctions"]), default=None)


NULL_RATE_TOLERANCE = 0.05

# Fields read by the filters, which run before anything is split or scored.
_FILTER_FIELDS = (
    "inflation_index_security",
    "cash_management_bill_cmb",
    "floating_rate",
)
# Fields every held auction must carry a value for.
_COMMON_FIELDS = (
    "cusip",
    "auction_date",
    "security_type",
    "original_security_term",
    "reopening",
    "primary_dealer_accepted",
    "comp_accepted",
    "noncomp_accepted",
    "soma_accepted",
    "allocation_pctage",
    "bid_to_cover_ratio",
    "total_accepted",
    "offering_amt",
)
# Bills are quoted on a discount rate, notes and bonds on a yield, so the
# other pair is legitimately null and must not count against the null rate.
_BILL_FIELDS = ("high_discnt_rate", "avg_med_discnt_rate")
_COUPON_FIELDS = ("high_yield", "avg_med_yield")


def _is_null(value: Any) -> bool:
    return value is None or value == "null" or value == ""


def _absent_field_problems(auctions: list[dict[str, Any]]) -> list[str]:
    all_fields = (*_FILTER_FIELDS, *_COMMON_FIELDS, *_BILL_FIELDS, *_COUPON_FIELDS)
    return [
        f"field {field!r} is absent from the source data"
        for field in all_fields
        if any(field not in auction for auction in auctions)
    ]


def _held_in_scope(auctions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    held, _ = split_unheld_auctions(
        exclude_floating_rate_notes(filter_included_securities(auctions))
    )
    return held


def _null_rate_problems(held: list[dict[str, Any]]) -> list[str]:
    bills = [a for a in held if a["security_type"] == "Bill"]
    coupons = [a for a in held if a["security_type"] != "Bill"]
    checks = [
        *((field, held) for field in _COMMON_FIELDS),
        *((field, bills) for field in _BILL_FIELDS),
        *((field, coupons) for field in _COUPON_FIELDS),
    ]
    problems = []
    for field, applicable in checks:
        if not applicable:
            continue
        null_rate = sum(_is_null(a[field]) for a in applicable) / len(applicable)
        if null_rate > NULL_RATE_TOLERANCE:
            problems.append(
                f"field {field!r} is null on {null_rate:.0%} of held auctions, "
                f"above the {NULL_RATE_TOLERANCE:.0%} tolerance"
            )
    return problems


def check_required_fields(auctions: list[dict[str, Any]]) -> list[str]:
    """Describe every depended-upon field that is absent or too often null.

    Takes the raw auction records. A field counts as absent if any record
    lacks the key; the null rate is measured over held, in-scope auctions
    that the field applies to.
    """
    absent = _absent_field_problems(auctions)
    if absent:
        return absent
    held = _held_in_scope(auctions)
    if not held:
        return ["no held, in-scope auctions in the source data"]
    return _null_rate_problems(held)
