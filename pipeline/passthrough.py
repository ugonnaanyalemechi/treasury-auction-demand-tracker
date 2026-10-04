from typing import Any

PASSTHROUGH_FIELDS = ("allocation_pctage", "bid_to_cover_ratio", "soma_accepted")


def passthrough_fields(auction: dict[str, Any]) -> dict[str, Any]:
    """Supporting fields copied unchanged from the source, under their published names."""
    return {field: auction[field] for field in PASSTHROUGH_FIELDS}
