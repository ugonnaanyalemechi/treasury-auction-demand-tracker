from typing import Any


def filter_included_securities(
    auctions: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Drop TIPS and cash management bills; bills, notes, and bonds pass through."""
    return [
        auction
        for auction in auctions
        if auction["inflation_index_security"] == "No"
        and auction["cash_management_bill_cmb"] == "No"
    ]


def exclude_floating_rate_notes(
    auctions: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Drop FRNs, which share original_security_term with the 2-Year fixed Note."""
    return [auction for auction in auctions if auction["floating_rate"] == "No"]
