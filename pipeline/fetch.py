from __future__ import annotations

from datetime import date
from typing import Any

import requests

AUCTIONS_QUERY_URL = (
    "https://api.fiscaldata.treasury.gov/services/api/fiscal_service"
    "/v1/accounting/od/auctions_query"
)


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
