"""Calendar-day handling for events whose clock time was left blank."""

import re

DATE_ONLY_RE = re.compile(r"^(\d{4})-(\d{2})-(\d{2})$")
# Noon UTC keeps the calendar day stable from UTC-12 through UTC+11.
DATE_ONLY_ANCHOR_HOUR = 12


def normalize_optional_event_datetime(value):
    """Return ``(value, has_time)`` for an event start or end.

    A blank value becomes ``(None, False)``. A ``YYYY-MM-DD`` string is stored
    at noon UTC so the calendar day does not shift across time zones, and
    ``has_time`` is False. Any other value is a real clock time.
    """
    if value is None:
        return None, False
    if isinstance(value, str):
        stripped = value.strip()
        if not stripped:
            return None, False
        match = DATE_ONLY_RE.match(stripped)
        if match:
            year, month, day = match.groups()
            return (
                f"{year}-{month}-{day}T{DATE_ONLY_ANCHOR_HOUR:02d}:00:00Z",
                False,
            )
        return stripped, True
    return value, True


def event_range_is_invalid(start, end, start_has_time, end_has_time):
    """True when the end is not after the start.

    Clock times must be strictly later. A date with no clock time compares by
    calendar day, so the same day is allowed.
    """
    if not start or not end:
        return False
    if start_has_time and end_has_time:
        return end <= start
    return end.date() < start.date()


def _mapping_copy(data):
    """Plain dict copy that keeps uploaded files from a multipart body."""
    if hasattr(data, "getlist") and hasattr(data, "keys"):
        copied = {}
        for key in data.keys():
            values = data.getlist(key)
            copied[key] = values if len(values) > 1 else data.get(key)
        return copied
    if isinstance(data, dict):
        return data.copy()
    return data
