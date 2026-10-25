"""Forecast accuracy statistics over a series built by app.selection.

Error is actual minus forecast, in MW. Negative means less wind than forecast: a
shortfall the buyer has to cover from the market. Positive means surplus wind.

MAPE is deliberately left out: it explodes when output is near zero. nMAE (total
absolute error over total actual output) is the scale-free measure instead.
"""

from __future__ import annotations

from typing import Any

import pandas as pd

from app import config
from app.selection import delivery_day


def summarize(series: pd.DataFrame) -> dict[str, Any]:
    """Headline statistics over every row that has both an actual and a forecast."""
    rows = series.dropna(subset=["actual_mw", "forecast_mw"])
    stats: dict[str, Any] = {"count": len(rows)}
    if rows.empty:
        return stats | dict.fromkeys(
            [
                "mean_actual_mw",
                "mean_forecast_mw",
                "mae_mw",
                "rmse_mw",
                "bias_mw",
                "nmae_pct",
                "p10_mw",
                "p50_mw",
                "p90_mw",
                "worst_shortfall_mw",
                "worst_surplus_mw",
            ]
        )

    err = rows["actual_mw"] - rows["forecast_mw"]
    total_actual = rows["actual_mw"].sum()
    return stats | {
        "mean_actual_mw": float(rows["actual_mw"].mean()),
        "mean_forecast_mw": float(rows["forecast_mw"].mean()),
        "mae_mw": float(err.abs().mean()),
        "rmse_mw": float((err**2).mean() ** 0.5),
        "bias_mw": float(err.mean()),
        "nmae_pct": float(err.abs().sum() / total_actual * 100) if total_actual else None,
        # P10 is the buffer figure: in 90% of hours the shortfall was no worse than -p10.
        "p10_mw": float(err.quantile(0.1)),
        "p50_mw": float(err.quantile(0.5)),
        "p90_mw": float(err.quantile(0.9)),
        "worst_shortfall_mw": float(max(-err.min(), 0)),
        "worst_surplus_mw": float(max(err.max(), 0)),
    }


def by_hour(series: pd.DataFrame) -> list[dict[str, Any]]:
    """Statistics for each UK clock hour of the day (0-23)."""
    hours = series["start_time"].dt.tz_convert(config.UK_TZ).dt.hour
    return [{"hour": int(h), **summarize(group)} for h, group in series.groupby(hours)]


def by_day(series: pd.DataFrame) -> list[dict[str, Any]]:
    """Statistics for each UK delivery day."""
    days = delivery_day(series["start_time"])
    return [{"delivery_day": day.date(), **summarize(group)} for day, group in series.groupby(days)]
