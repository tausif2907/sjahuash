"""Loads the committed snapshot written by app.ingest into memory once per process."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date
from functools import lru_cache
from pathlib import Path
from typing import Any

import pandas as pd

from app import config


@dataclass(frozen=True)
class Snapshot:
    actuals: pd.DataFrame  # start_time, generation_mw (half-hourly, UTC)
    forecasts: pd.DataFrame  # start_time, publish_time, horizon_h, generation_mw (UTC)
    meta: dict[str, Any]

    @property
    def first_day(self) -> date:
        return pd.Timestamp(self.meta["target_window"]["start"]).tz_convert(config.UK_TZ).date()

    @property
    def last_day(self) -> date:
        end = pd.Timestamp(self.meta["target_window"]["end_exclusive"]) - pd.Timedelta(seconds=1)
        return end.tz_convert(config.UK_TZ).date()


def read_snapshot(data_dir: Path) -> Snapshot:
    actuals = pd.read_csv(data_dir / config.ACTUALS_FILE, usecols=["start_time", "generation_mw"])
    forecasts = pd.read_csv(data_dir / config.FORECASTS_FILE)
    for df in (actuals, forecasts):
        for col in ("start_time", "publish_time"):
            if col in df:
                df[col] = pd.to_datetime(df[col], utc=True)
    meta = json.loads((data_dir / config.META_FILE).read_text())
    return Snapshot(actuals=actuals, forecasts=forecasts, meta=meta)


@lru_cache(maxsize=1)
def get_snapshot() -> Snapshot:
    """FastAPI dependency; tests override it with a small in-memory snapshot."""
    return read_snapshot(config.DATA_DIR)
