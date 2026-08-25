from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def write_dataset(dataset: dict[str, Any], path: str | Path) -> None:
    """Serialize a dataset to JSON at the given path, atomically."""
    destination = Path(path)
    destination.parent.mkdir(parents=True, exist_ok=True)

    tmp_path = destination.with_name(destination.name + ".tmp")
    tmp_path.write_text(json.dumps(dataset, indent=2))
    tmp_path.replace(destination)
