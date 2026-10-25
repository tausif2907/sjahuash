"""Which forecast counts for each target time.

Both views use one mechanism: give every target time T a cutoff, then take the
latest forecast run published at or before that cutoff.

- Decision mode: cutoff = day-ahead gate closure on D-1, where D is T's UK delivery
  day. This is the forecast a trader actually had when buying day-ahead.
- Horizon mode:  cutoff = T - H. The forecast available H hours ahead, used to show
  how accuracy decays as the look-ahead grows.

Forecasts are hourly and actuals half-hourly, so forecasts are matched to the actual
with the same startTime; half-hours past the hour carry an actual but no forecast.
"""

from __future__ import annotations

from datetime import date, time, timedelta
from enum import StrEnum

import pandas as pd

from app import config
from app.data import Snapshot

SERIES_COLUMNS = [
    "start_time",
    "actual_mw",
    "forecast_mw",
    "error_mw",
    "publish_time",
    "horizon_h",
    "cutoff",
]


class Mode(StrEnum):
    DECISION = "decision"
    HORIZON = "horizon"


def _utc_ns(s: pd.Series) -> pd.Series:
    # merge_asof needs identical key dtypes; parsing and arithmetic can yield different units.
    return s.astype("datetime64[ns, UTC]")


def delivery_day(times: pd.Series) -> pd.Series:
    """UK delivery date of each UTC target time, as a naive midnight timestamp."""
    return times.dt.tz_convert(config.UK_TZ).dt.tz_localize(None).dt.normalize()


def decision_cutoffs(target_times: pd.Series, gate_closure: time) -> pd.Series:
    """Gate closure on the UK day before each target's delivery day, in UTC."""
    local = (
        delivery_day(target_times)
        - pd.Timedelta(days=1)
        + pd.Timedelta(hours=gate_closure.hour, minutes=gate_closure.minute)
    )
    # Gate closures are mid-morning, never inside a DST change, so localising is unambiguous.
    return local.dt.tz_localize(config.UK_TZ).dt.tz_convert("UTC")


def horizon_cutoffs(target_times: pd.Series, horizon_h: float) -> pd.Series:
    return target_times - pd.Timedelta(hours=horizon_h)


def select_latest(forecasts: pd.DataFrame, targets: pd.DataFrame) -> pd.DataFrame:
    """For each (start_time, cutoff) target, the latest forecast published at or before cutoff.

    Adds forecast_mw, publish_time and horizon_h; they are missing where no run qualifies.
    """
    left = targets.assign(
        start_time=_utc_ns(targets["start_time"]), cutoff=_utc_ns(targets["cutoff"])
    )
    right = forecasts[["start_time", "publish_time", "horizon_h", "generation_mw"]].rename(
        columns={"generation_mw": "forecast_mw"}
    )
    right = right.assign(
        start_time=_utc_ns(right["start_time"]), publish_time=_utc_ns(right["publish_time"])
    )
    merged = pd.merge_asof(
        left.sort_values("cutoff"),
        right.sort_values("publish_time"),
        left_on="cutoff",
        right_on="publish_time",
        by="start_time",
        direction="backward",
    )
    return merged.sort_values("start_time").reset_index(drop=True)


def target_grid(first_day: date, last_day: date) -> pd.Series:
    """Every half-hour start (UTC) in UK delivery days first_day..last_day inclusive."""
    start = pd.Timestamp(first_day).tz_localize(config.UK_TZ)
    end = pd.Timestamp(last_day + timedelta(days=1)).tz_localize(config.UK_TZ)
    grid = pd.date_range(start, end, freq="30min", inclusive="left").tz_convert("UTC")
    return _utc_ns(pd.Series(grid, name="start_time"))


def build_series(
    snapshot: Snapshot,
    first_day: date,
    last_day: date,
    mode: Mode,
    *,
    horizon_h: float | None = None,
    gate_closure: time = config.DEFAULT_GATE_CLOSURE,
) -> pd.DataFrame:
    """Half-hourly actual vs selected forecast for the given UK delivery days.

    error_mw = actual - forecast: negative means less wind than forecast.
    """
    targets = target_grid(first_day, last_day).to_frame()
    if mode is Mode.DECISION:
        targets["cutoff"] = decision_cutoffs(targets["start_time"], gate_closure)
    else:
        if horizon_h is None:
            raise ValueError("horizon_h is required in horizon mode")
        targets["cutoff"] = horizon_cutoffs(targets["start_time"], horizon_h)

    selected = select_latest(snapshot.forecasts, targets)
    actuals = snapshot.actuals.rename(columns={"generation_mw": "actual_mw"})
    actuals = actuals.assign(start_time=_utc_ns(actuals["start_time"]))
    series = selected.merge(actuals[["start_time", "actual_mw"]], on="start_time", how="left")
    series["error_mw"] = series["actual_mw"] - series["forecast_mw"]
    return series[SERIES_COLUMNS]
