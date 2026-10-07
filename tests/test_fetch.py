import datetime
import json
from pathlib import Path
from typing import Any

import pytest
import requests

from pipeline.build import build_dataset
from pipeline.fetch import (
    AUCTIONS_QUERY_URL,
    REQUESTED_FIELDS,
    fetch_auctions_full,
    fetch_auctions_page,
)

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "auctions_sample.json"


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


def test_fetch_auctions_full_requests_five_years_across_all_tenors(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[dict[str, Any]] = []

    def fake_get(url: str, **kwargs: Any) -> _FakeResponse:
        calls.append({"url": url, "params": kwargs["params"]})
        return _FakeResponse({"data": [], "meta": {}})

    monkeypatch.setattr(requests, "get", fake_get)

    fetch_auctions_full(datetime.date(2026, 10, 7))

    assert len(calls) == 1
    assert calls[0]["url"] == AUCTIONS_QUERY_URL
    assert calls[0]["params"]["filter"] == (
        "auction_date:gte:2021-10-08,auction_date:lte:2026-10-07"
    )


def test_fetch_auctions_full_requests_exactly_the_fields_the_transform_needs(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, Any] = {}

    def fake_get(url: str, **kwargs: Any) -> _FakeResponse:
        captured["params"] = kwargs["params"]
        return _FakeResponse({"data": [], "meta": {}})

    monkeypatch.setattr(requests, "get", fake_get)
    fetch_auctions_full(datetime.date(2026, 10, 7))
    requested = set(captured["params"]["fields"].split(","))

    full = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    trimmed = {
        "data": [{k: v for k, v in a.items() if k in requested} for a in full["data"]]
    }
    assert requested < set(full["data"][0]), "must be a strict subset of the record"

    expected = build_dataset(full)
    actual = build_dataset(trimmed)
    expected.pop("generated_at")
    actual.pop("generated_at")
    assert actual == expected


@pytest.mark.network
def test_fetch_auctions_full_network_canary() -> None:
    result = fetch_auctions_full(datetime.date.today())

    assert result["meta"]["total-pages"] == 1, "five years no longer fits one page"
    assert {a["original_security_term"] for a in result["data"]} >= {
        "17-Week",
        "10-Year",
    }
    assert set(result["data"][0]) == set(REQUESTED_FIELDS)
