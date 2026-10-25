"""Response models: they validate what the API returns and document it at /docs."""

from __future__ import annotations

from datetime import date, datetime, time

from pydantic import BaseModel, Field

from app.selection import Mode


class Stats(BaseModel):
    count: int = Field(description="Hours with both an actual and a forecast")
    mean_actual_mw: float | None = None
    mean_forecast_mw: float | None = None
    mae_mw: float | None = Field(None, description="Mean absolute error")
    rmse_mw: float | None = Field(None, description="Root mean squared error")
    bias_mw: float | None = Field(None, description="Mean of actual - forecast")
    nmae_pct: float | None = Field(None, description="Total absolute error / total actual")
    p10_mw: float | None = Field(None, description="10th percentile of actual - forecast")
    p50_mw: float | None = None
    p90_mw: float | None = None
    worst_shortfall_mw: float | None = Field(None, description="Largest actual-below-forecast gap")
    worst_surplus_mw: float | None = Field(None, description="Largest actual-above-forecast gap")


class HourStats(Stats):
    hour: int = Field(description="UK clock hour of the target time, 0-23")


class DayStats(Stats):
    delivery_day: date


class HorizonStats(Stats):
    horizon_h: float


class Selection(BaseModel):
    """Echo of the resolved query, so the client knows exactly what it is looking at."""

    mode: Mode
    first_day: date
    last_day: date
    gate_closure: time | None = Field(None, description="Decision mode only (UK time, on D-1)")
    horizon_h: float | None = Field(None, description="Horizon mode only")


class SeriesPoint(BaseModel):
    start_time: datetime
    actual_mw: float | None
    forecast_mw: float | None
    error_mw: float | None = Field(description="actual - forecast; negative = less wind")
    publish_time: datetime | None = Field(description="When the selected forecast was published")
    horizon_h: float | None = Field(description="Hours between publish_time and start_time")
    cutoff: datetime = Field(description="Latest publish time allowed for this target")


class SeriesResponse(Selection):
    points: list[SeriesPoint]


class MetricsResponse(Selection):
    overall: Stats
    by_hour: list[HourStats]
    by_day: list[DayStats]


class HorizonProfileResponse(BaseModel):
    first_day: date
    last_day: date
    horizons: list[HorizonStats]


class Cleaning(BaseModel):
    """Counts from the ingestion run; None when the snapshot predates a field."""

    actual_raw_rows: int | None = None
    actual_missing_periods: int
    forecast_raw_rows: int | None = None
    forecast_dropped_negative_horizon: int | None = None
    forecast_dropped_outside_window: int | None = None
    hours_without_forecast: int
    max_forecast_horizon_h: float | None = None


class MetaResponse(BaseModel):
    source: str
    generated_at: datetime
    first_day: date
    last_day: date
    gate_closures: dict[str, time]
    default_gate_closure: time
    max_horizon_h: float
    actual_rows: int
    forecast_rows: int
    publish_runs: int
    cleaning: Cleaning
