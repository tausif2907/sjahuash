import math

import pandas as pd
import pytest

from app.metrics import by_day, by_hour, summarize


def series(rows):
    """rows: (start_time, actual_mw, forecast_mw)"""
    df = pd.DataFrame(rows, columns=["start_time", "actual_mw", "forecast_mw"])
    df["start_time"] = pd.to_datetime(df["start_time"], utc=True)
    df["error_mw"] = df["actual_mw"] - df["forecast_mw"]
    return df


KNOWN = series(
    [
        ("2026-01-02T00:00Z", 100, 110),  # error -10
        ("2026-01-02T01:00Z", 200, 190),  # +10
        ("2026-01-02T02:00Z", 300, 330),  # -30
        ("2026-01-02T03:00Z", 400, 400),  # 0
    ]
)


def test_summarize_known_values():
    s = summarize(KNOWN)
    assert s["count"] == 4
    assert s["mae_mw"] == 12.5
    assert s["rmse_mw"] == pytest.approx(math.sqrt(275))
    assert s["bias_mw"] == -7.5
    assert s["nmae_pct"] == 5.0
    assert s["mean_actual_mw"] == 250
    assert s["mean_forecast_mw"] == 257.5
    # Linear-interpolated quantiles of [-30, -10, 0, 10].
    assert s["p10_mw"] == pytest.approx(-24)
    assert s["p50_mw"] == pytest.approx(-5)
    assert s["p90_mw"] == pytest.approx(7)
    assert s["worst_shortfall_mw"] == 30
    assert s["worst_surplus_mw"] == 10


def test_summarize_ignores_rows_without_forecast_or_actual():
    df = pd.concat(
        [
            KNOWN,
            series([("2026-01-02T00:30Z", 150, None), ("2026-01-02T04:00Z", None, 500)]),
        ]
    )
    assert summarize(df) == summarize(KNOWN)


def test_summarize_worst_values_floor_at_zero():
    s = summarize(series([("2026-01-02T00:00Z", 100, 90), ("2026-01-02T01:00Z", 120, 100)]))
    assert s["worst_shortfall_mw"] == 0
    assert s["worst_surplus_mw"] == 20


def test_summarize_empty():
    s = summarize(series([("2026-01-02T00:30Z", 150, None)]))
    assert s["count"] == 0
    assert s["mae_mw"] is None and s["p10_mw"] is None


def test_by_hour_groups_on_uk_clock_hour():
    df = series(
        [
            ("2026-01-02T05:00Z", 100, 110),
            ("2026-01-03T05:00Z", 100, 130),
            ("2026-07-02T05:00Z", 100, 100),  # 06:00 BST
        ]
    )
    hours = {h["hour"]: h for h in by_hour(df)}
    assert set(hours) == {5, 6}
    assert hours[5]["count"] == 2 and hours[5]["mae_mw"] == 20
    assert hours[6]["mae_mw"] == 0


def test_by_day_groups_on_uk_delivery_day():
    df = series(
        [
            ("2026-01-02T00:00Z", 100, 110),
            ("2026-01-02T23:00Z", 100, 90),
            ("2026-07-01T23:00Z", 100, 100),  # 00:00 BST on 2 Jul
        ]
    )
    days = by_day(df)
    assert [str(d["delivery_day"]) for d in days] == ["2026-01-02", "2026-07-02"]
    assert days[0]["count"] == 2 and days[0]["bias_mw"] == 0
