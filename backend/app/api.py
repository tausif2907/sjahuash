"""HTTP layer: validates query parameters, then delegates to selection and metrics."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, time
from typing import Annotated, Any

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query

from app import config, metrics
from app.data import Snapshot, get_snapshot
from app.schemas import (
    HorizonProfileResponse,
    MetaResponse,
    MetricsResponse,
    SeriesResponse,
)
from app.selection import Mode, build_series

router = APIRouter(prefix="/api")

SnapshotDep = Annotated[Snapshot, Depends(get_snapshot)]
StartDay = Annotated[
    date | None, Query(description="First UK delivery day (default: first day in the data)")
]
EndDay = Annotated[
    date | None, Query(description="Last UK delivery day, inclusive (default: last day)")
]


def resolve_days(snapshot: Snapshot, start: date | None, end: date | None) -> tuple[date, date]:
    first = start or snapshot.first_day
    last = end or snapshot.last_day
    if first > last:
        raise HTTPException(422, "start must not be after end")
    if first < snapshot.first_day or last > snapshot.last_day:
        raise HTTPException(
            422, f"data covers delivery days {snapshot.first_day} to {snapshot.last_day}"
        )
    return first, last


@dataclass(frozen=True)
class SelectionQuery:
    snapshot: Snapshot
    first_day: date
    last_day: date
    mode: Mode
    horizon_h: float | None
    gate_closure: time

    def series(self) -> pd.DataFrame:
        return build_series(
            self.snapshot,
            self.first_day,
            self.last_day,
            self.mode,
            horizon_h=self.horizon_h,
            gate_closure=self.gate_closure,
        )

    def echo(self) -> dict[str, Any]:
        decision = self.mode is Mode.DECISION
        return {
            "mode": self.mode,
            "first_day": self.first_day,
            "last_day": self.last_day,
            "gate_closure": self.gate_closure if decision else None,
            "horizon_h": None if decision else self.horizon_h,
        }


def selection_query(
    snapshot: SnapshotDep,
    start: StartDay = None,
    end: EndDay = None,
    mode: Annotated[
        Mode,
        Query(
            description="decision: forecast available at gate closure on D-1; "
            "horizon: forecast available horizon_h hours ahead"
        ),
    ] = Mode.DECISION,
    horizon_h: Annotated[
        float | None, Query(ge=0, le=config.MAX_HORIZON_H, description="Required for horizon mode")
    ] = None,
    gate_closure: Annotated[
        time, Query(description="Decision time on D-1, UK local (HH:MM)")
    ] = config.DEFAULT_GATE_CLOSURE,
) -> SelectionQuery:
    first, last = resolve_days(snapshot, start, end)
    if mode is Mode.HORIZON and horizon_h is None:
        raise HTTPException(422, "horizon_h is required when mode=horizon")
    return SelectionQuery(snapshot, first, last, mode, horizon_h, gate_closure)


SelectionDep = Annotated[SelectionQuery, Depends(selection_query)]


def _records(df: pd.DataFrame) -> list[dict[str, Any]]:
    """DataFrame rows as dicts, with NaN/NaT turned into None for JSON."""
    return df.astype(object).where(df.notna(), None).to_dict("records")


@router.get("/health")
def health(snapshot: SnapshotDep) -> dict[str, Any]:
    return {"status": "ok", "snapshot_generated_at": snapshot.meta["generated_at"]}


@router.get("/meta", response_model=MetaResponse)
def meta(snapshot: SnapshotDep) -> dict[str, Any]:
    """What the snapshot covers and which options the analysis endpoints accept."""
    return {
        "source": snapshot.meta["source"],
        "generated_at": snapshot.meta["generated_at"],
        "first_day": snapshot.first_day,
        "last_day": snapshot.last_day,
        "gate_closures": config.GATE_CLOSURES,
        "default_gate_closure": config.DEFAULT_GATE_CLOSURE,
        "max_horizon_h": config.MAX_HORIZON_H,
        "actual_rows": snapshot.meta["actuals"]["rows"],
        "forecast_rows": snapshot.meta["forecasts"]["rows"],
        "publish_runs": snapshot.meta["forecasts"]["publish_runs"],
        "cleaning": {
            "actual_raw_rows": snapshot.meta["actuals"].get("raw_rows"),
            "actual_missing_periods": len(snapshot.meta["actuals"].get("missing_periods", [])),
            "forecast_raw_rows": snapshot.meta["forecasts"].get("raw_rows"),
            "forecast_dropped_negative_horizon": snapshot.meta["forecasts"].get(
                "dropped_negative_horizon"
            ),
            "forecast_dropped_outside_window": snapshot.meta["forecasts"].get(
                "dropped_outside_window"
            ),
            "hours_without_forecast": len(
                snapshot.meta["forecasts"].get("target_hours_without_forecast", [])
            ),
            "max_forecast_horizon_h": snapshot.meta["forecasts"].get("horizon_h_max"),
        },
    }


@router.get("/series", response_model=SeriesResponse)
def series(query: SelectionDep) -> dict[str, Any]:
    """Half-hourly actual generation with the selected forecast on each hour."""
    return {**query.echo(), "points": _records(query.series())}


@router.get("/metrics", response_model=MetricsResponse)
def metrics_summary(query: SelectionDep) -> dict[str, Any]:
    """Accuracy of the selected forecasts: overall, by hour of day and by delivery day."""
    s = query.series()
    return {
        **query.echo(),
        "overall": metrics.summarize(s),
        "by_hour": metrics.by_hour(s),
        "by_day": metrics.by_day(s),
    }


@router.get("/metrics/by-horizon", response_model=HorizonProfileResponse)
def metrics_by_horizon(
    snapshot: SnapshotDep,
    start: StartDay = None,
    end: EndDay = None,
    max_h: Annotated[int, Query(ge=1, le=config.MAX_HORIZON_H)] = 48,
    step_h: Annotated[int, Query(ge=1, le=24)] = 1,
) -> dict[str, Any]:
    """How accuracy changes with look-ahead: horizon-mode statistics for 0..max_h hours."""
    first, last = resolve_days(snapshot, start, end)
    horizons = [
        {
            "horizon_h": h,
            **metrics.summarize(build_series(snapshot, first, last, Mode.HORIZON, horizon_h=h)),
        }
        for h in range(0, max_h + 1, step_h)
    ]
    return {"first_day": first, "last_day": last, "horizons": horizons}
