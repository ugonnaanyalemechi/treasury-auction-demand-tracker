from datetime import date, timedelta
from typing import Any

import requests

AUCTIONS_QUERY_URL = (
    "https://api.fiscaldata.treasury.gov/services/api/fiscal_service"
    "/v1/accounting/od/auctions_query"
)

# Only what the filters, guards and metrics read; the full record has ~110.
REQUESTED_FIELDS = (
    "cusip",
    "auction_date",
    "security_type",
    "original_security_term",
    "reopening",
    "inflation_index_security",
    "cash_management_bill_cmb",
    "floating_rate",
    "offering_amt",
    "total_accepted",
    "primary_dealer_accepted",
    "comp_accepted",
    "noncomp_accepted",
    "soma_accepted",
    "allocation_pctage",
    "bid_to_cover_ratio",
    "high_discnt_rate",
    "avg_med_discnt_rate",
    "high_yield",
    "avg_med_yield",
)

# Five years of history, so trailing-window scores are warm on day one.
HISTORY_DAYS = 365 * 5


def fetch_auctions_full(end_date: date) -> dict[str, Any]:
    """Retrieve five years of auctions across every tenor, unmodified."""
    start_date = end_date - timedelta(days=HISTORY_DAYS)
    params: dict[str, str | int] = {
        "filter": (
            f"auction_date:gte:{start_date.isoformat()},"
            f"auction_date:lte:{end_date.isoformat()}"
        ),
        "fields": ",".join(REQUESTED_FIELDS),
        "page[size]": 10000,
    }
    response = requests.get(AUCTIONS_QUERY_URL, params=params, timeout=30)
    response.raise_for_status()
    payload: dict[str, Any] = response.json()
    return payload


def fetch_auctions_page(
    tenor: str, start_date: date, end_date: date
) -> dict[str, Any]:
    """Retrieve one tenor's auction records from Fiscal Data, unmodified."""
    params: dict[str, str | int] = {
        "filter": (
            f"original_security_term:eq:{tenor},"
            f"auction_date:gte:{start_date.isoformat()},"
            f"auction_date:lte:{end_date.isoformat()}"
        ),
        "page[size]": 10000,
    }
    response = requests.get(AUCTIONS_QUERY_URL, params=params, timeout=30)
    response.raise_for_status()
    payload: dict[str, Any] = response.json()
    return payload
