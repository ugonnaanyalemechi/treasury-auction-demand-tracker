from typing import Any

ROW_COUNT_TOLERANCE = 0.20


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
