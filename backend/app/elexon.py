"""Thin client for the two Elexon BMRS stream endpoints this project uses.

FUELHH/stream   half-hourly outturn by fuel type, filtered by settlement date
                (the settlement-date and publish-date filters cannot be combined).
WINDFOR/stream  wind generation forecasts, filtered by publish time only.

Both return a bare JSON list, newest first. Requests are split into 7-day chunks
so a long window never depends on how much the API returns in a single call.
"""

from __future__ import annotations

import logging
from collections.abc import Iterator
from datetime import UTC, date, datetime, timedelta
from typing import Any

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from app.config import ELEXON_BASE_URL

log = logging.getLogger(__name__)

FUELHH_PATH = "/datasets/FUELHH/stream"
WINDFOR_PATH = "/datasets/WINDFOR/stream"
CHUNK_DAYS = 7


def date_chunks(start: date, end: date, days: int = CHUNK_DAYS) -> Iterator[tuple[date, date]]:
    """Split the inclusive range [start, end] into inclusive chunks of at most `days` days."""
    cur = start
    while cur <= end:
        last = min(cur + timedelta(days=days - 1), end)
        yield cur, last
        cur = last + timedelta(days=1)


def datetime_chunks(
    start: datetime, end: datetime, days: int = CHUNK_DAYS
) -> Iterator[tuple[datetime, datetime]]:
    """Split [start, end] into consecutive windows of at most `days` days.

    Neighbouring windows share their boundary instant, so callers must de-duplicate.
    """
    cur = start
    while cur < end:
        nxt = min(cur + timedelta(days=days), end)
        yield cur, nxt
        cur = nxt


def to_api_datetime(dt: datetime) -> str:
    return dt.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def make_session(retries: int = 5) -> requests.Session:
    """Session that retries rate limits and transient server errors with backoff."""
    retry = Retry(
        total=retries,
        backoff_factor=1,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=("GET",),
    )
    session = requests.Session()
    session.mount("https://", HTTPAdapter(max_retries=retry))
    session.headers["Accept"] = "application/json"
    return session


class ElexonClient:
    def __init__(
        self,
        session: requests.Session | None = None,
        base_url: str = ELEXON_BASE_URL,
        timeout: float = 60,
    ) -> None:
        self.session = session or make_session()
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    def _get(self, path: str, params: dict[str, Any]) -> list[dict[str, Any]]:
        resp = self.session.get(self.base_url + path, params=params, timeout=self.timeout)
        resp.raise_for_status()
        payload = resp.json()
        # Stream endpoints return a bare list; tolerate the {"data": [...]} envelope
        # the non-stream endpoints use, in case Elexon ever aligns them.
        if isinstance(payload, dict):
            payload = payload.get("data", [])
        log.info("GET %s %s -> %d rows", path, params, len(payload))
        return payload

    def fetch_actuals(
        self, first_day: date, last_day: date, fuel_type: str = "WIND"
    ) -> list[dict[str, Any]]:
        """Half-hourly outturn for settlement dates first_day..last_day, both inclusive."""
        rows: list[dict[str, Any]] = []
        for a, b in date_chunks(first_day, last_day):
            params = {
                "settlementDateFrom": a.isoformat(),
                "settlementDateTo": b.isoformat(),
                "fuelType": fuel_type,
            }
            rows.extend(self._get(FUELHH_PATH, params))
        return rows

    def fetch_forecasts(
        self, published_from: datetime, published_to: datetime
    ) -> list[dict[str, Any]]:
        """Every wind forecast run published between the two instants."""
        rows: list[dict[str, Any]] = []
        for a, b in datetime_chunks(published_from, published_to):
            params = {
                "publishDateTimeFrom": to_api_datetime(a),
                "publishDateTimeTo": to_api_datetime(b),
            }
            rows.extend(self._get(WINDFOR_PATH, params))
        return rows
