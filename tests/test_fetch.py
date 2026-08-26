import datetime
from typing import Any

import pytest
import requests

from pipeline.fetch import AUCTIONS_QUERY_URL, fetch_auctions_page


class _FakeResponse:
    def __init__(self, payload: dict[str, Any], status_code: int = 200) -> None:
        self._payload = payload
        self.status_code = status_code

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise requests.HTTPError(f"{self.status_code} error")

    def json(self) -> dict[str, Any]:
        return self._payload


def test_fetch_auctions_page_requests_the_given_tenor_and_date_range(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, Any] = {}

    def fake_get(url: str, **kwargs: Any) -> _FakeResponse:
        captured["url"] = url
        captured["params"] = kwargs["params"]
        return _FakeResponse({"data": [], "meta": {}})

    monkeypatch.setattr(requests, "get", fake_get)

    fetch_auctions_page(
        "10-Year", datetime.date(2024, 1, 1), datetime.date(2024, 12, 31)
    )

    assert captured["url"] == AUCTIONS_QUERY_URL
    assert captured["params"]["filter"] == (
        "original_security_term:eq:10-Year,"
        "auction_date:gte:2024-01-01,"
        "auction_date:lte:2024-12-31"
    )


def test_fetch_auctions_page_returns_the_response_payload_unchanged(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    payload = {"data": [{"cusip": "ABC"}], "meta": {"count": 1}}
    monkeypatch.setattr(requests, "get", lambda *a, **kw: _FakeResponse(payload))

    result = fetch_auctions_page(
        "10-Year", datetime.date(2024, 1, 1), datetime.date(2024, 12, 31)
    )

    assert result == payload


def test_fetch_auctions_page_propagates_http_errors(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        requests, "get", lambda *a, **kw: _FakeResponse({}, status_code=500)
    )

    with pytest.raises(requests.HTTPError):
        fetch_auctions_page(
            "10-Year", datetime.date(2024, 1, 1), datetime.date(2024, 12, 31)
        )


def test_fetch_auctions_page_propagates_connection_errors(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def raise_connection_error(*args: Any, **kwargs: Any) -> _FakeResponse:
        raise requests.ConnectionError("no network")

    monkeypatch.setattr(requests, "get", raise_connection_error)

    with pytest.raises(requests.ConnectionError):
        fetch_auctions_page(
            "10-Year", datetime.date(2024, 1, 1), datetime.date(2024, 12, 31)
        )


@pytest.mark.network
def test_fetch_auctions_page_network_canary() -> None:
    result = fetch_auctions_page(
        "10-Year", datetime.date(2024, 1, 1), datetime.date(2024, 3, 31)
    )

    assert result["data"], "expected at least one 10-Year auction in Q1 2024"
    record = result["data"][0]
    assert record["original_security_term"] == "10-Year"
    assert "auction_date" in record
