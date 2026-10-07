import datetime
import json
from pathlib import Path
from typing import Any

import pytest
import requests

from pipeline.fetch import AUCTIONS_QUERY_URL, DEBT_TO_PENNY_URL
from pipeline.refresh import refresh
from pipeline.validation import DatasetValidationError

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "auctions_sample.json"
TODAY = datetime.date(2026, 10, 7)
DEBT_RECORD = {"record_date": "2026-10-05", "tot_pub_debt_out_amt": "40249104431078.48"}


class _FakeResponse:
    def __init__(self, payload: dict[str, Any]) -> None:
        self._payload = payload

    def raise_for_status(self) -> None:
        pass

    def json(self) -> dict[str, Any]:
        return self._payload


@pytest.fixture(autouse=True)
def upstream(monkeypatch: pytest.MonkeyPatch) -> None:
    auctions = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))

    def fake_get(url: str, **kwargs: Any) -> _FakeResponse:
        if url == AUCTIONS_QUERY_URL:
            return _FakeResponse(auctions)
        assert url == DEBT_TO_PENNY_URL
        return _FakeResponse({"data": [DEBT_RECORD]})

    monkeypatch.setattr(requests, "get", fake_get)


def test_successful_refresh_writes_the_dataset_with_the_formatted_debt(
    tmp_path: Path,
) -> None:
    out = tmp_path / "data.json"

    refresh(out, TODAY)

    written = json.loads(out.read_text(encoding="utf-8"))
    assert written["auctions"]
    assert written["debt"] == {
        "total_public_debt_outstanding": "$40,249,104,431,078.48",
        "as_of": "2026-10-05",
    }


def test_guard_failure_raises_and_leaves_the_previous_data_json_untouched(
    tmp_path: Path,
) -> None:
    out = tmp_path / "data.json"
    refresh(out, TODAY)
    previous = json.loads(out.read_text(encoding="utf-8"))
    previous["row_count"] *= 3
    out.write_text(json.dumps(previous), encoding="utf-8")
    before = out.read_bytes()

    with pytest.raises(DatasetValidationError):
        refresh(out, TODAY)

    assert out.read_bytes() == before


def test_rerun_on_unchanged_upstream_data_leaves_the_file_byte_identical(
    tmp_path: Path,
) -> None:
    out = tmp_path / "data.json"
    refresh(out, TODAY)
    before = out.read_bytes()

    refresh(out, TODAY)

    assert out.read_bytes() == before


@pytest.mark.parametrize(
    "debt_response",
    [{"data": []}, {"data": [{"record_date": "2026-10-05", "tot_pub_debt_out_amt": "null"}]}],
    ids=["no-rows", "non-numeric-amount"],
)
def test_bad_debt_response_publishes_the_auctions_without_the_debt(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, debt_response: dict[str, Any]
) -> None:
    real_get = requests.get

    def fake_get(url: str, **kwargs: Any) -> _FakeResponse:
        if url == DEBT_TO_PENNY_URL:
            return _FakeResponse(debt_response)
        response: _FakeResponse = real_get(url, **kwargs)  # type: ignore[assignment]
        return response

    monkeypatch.setattr(requests, "get", fake_get)
    out = tmp_path / "data.json"

    refresh(out, TODAY)

    written = json.loads(out.read_text(encoding="utf-8"))
    assert written["auctions"]
    assert "debt" not in written


def test_unreachable_debt_endpoint_publishes_the_auctions_without_the_debt(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    real_get = requests.get

    def fake_get(url: str, **kwargs: Any) -> _FakeResponse:
        if url == DEBT_TO_PENNY_URL:
            raise requests.ConnectionError("no network")
        response: _FakeResponse = real_get(url, **kwargs)  # type: ignore[assignment]
        return response

    monkeypatch.setattr(requests, "get", fake_get)
    out = tmp_path / "data.json"

    refresh(out, TODAY)

    assert "debt" not in json.loads(out.read_text(encoding="utf-8"))
