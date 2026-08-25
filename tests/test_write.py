from __future__ import annotations

import json
from pathlib import Path

from pipeline.write import write_dataset


def test_write_dataset_writes_valid_json_readable_back_unchanged(
    tmp_path: Path,
) -> None:
    dataset = {"generated_at": "2026-08-25T00:00:00Z", "row_count": 2, "auctions": [1, 2]}
    path = tmp_path / "data.json"

    write_dataset(dataset, path)

    assert json.loads(path.read_text()) == dataset


def test_write_dataset_creates_missing_parent_directories(tmp_path: Path) -> None:
    dataset = {"row_count": 0}
    path = tmp_path / "nested" / "dir" / "data.json"

    write_dataset(dataset, path)

    assert json.loads(path.read_text()) == dataset
