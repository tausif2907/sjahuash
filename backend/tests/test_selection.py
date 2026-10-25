from datetime import date, time

import pandas as pd
import pytest
from conftest import make_snapshot

from app.selection import (
    Mode,
    build_series,
    decision_cutoffs,
    horizon_cutoffs,
    select_latest,
    target_grid,
)


def ts(*values):
    return pd.Series(pd.to_datetime(list(values), utc=True))


def iso(value):
    return None if pd.isna(value) else pd.Timestamp(value).strftime("%Y-%m-%dT%H:%M:%SZ")


# --- cutoffs -----------------------------------------------------------------


def test_decision_cutoff_is_gate_closure_on_previous_day_in_winter():
    cutoffs = decision_cutoffs(ts("2026-01-02T00:00Z", "2026-01-02T23:30Z"), time(9, 20))
    assert [iso(c) for c in cutoffs] == ["2026-01-01T09:20:00Z", "2026-01-01T09:20:00Z"]


def test_decision_cutoff_uses_uk_delivery_day_in_summer():
    # 23:30 UTC on 1 Jul is 00:30 BST on 2 Jul: it belongs to delivery day 2 Jul,
    # so its decision was made at 09:20 BST (08:20 UTC) on 1 Jul.
    cutoffs = decision_cutoffs(ts("2026-07-01T23:30Z", "2026-07-02T12:00Z"), time(9, 20))
    assert [iso(c) for c in cutoffs] == ["2026-07-01T08:20:00Z", "2026-07-01T08:20:00Z"]


def test_horizon_cutoff_subtracts_hours():
    cutoffs = horizon_cutoffs(ts("2026-01-02T12:00Z"), 4.5)
    assert iso(cutoffs[0]) == "2026-01-02T07:30:00Z"


# --- target grid -------------------------------------------------------------


def test_target_grid_is_half_hourly_and_end_inclusive():
    grid = target_grid(date(2026, 1, 1), date(2026, 1, 2))
    assert len(grid) == 96
    assert iso(grid.iloc[0]) == "2026-01-01T00:00:00Z"
    assert iso(grid.iloc[-1]) == "2026-01-02T23:30:00Z"


@pytest.mark.parametrize(("day", "periods"), [(date(2026, 3, 29), 46), (date(2026, 10, 25), 50)])
def test_target_grid_handles_clock_change_days(day, periods):
    assert len(target_grid(day, day)) == periods


# --- select_latest -----------------------------------------------------------


def forecasts_frame(rows):
    snapshot = make_snapshot([], rows)
    return snapshot.forecasts


def test_select_latest_takes_newest_run_at_or_before_cutoff():
    forecasts = forecasts_frame(
        [
            ("2026-01-02T12:00Z", "2026-01-01T04:30Z", 100),
            ("2026-01-02T12:00Z", "2026-01-01T07:30Z", 200),  # latest before cutoff
            ("2026-01-02T12:00Z", "2026-01-01T09:30Z", 300),  # after cutoff
            ("2026-01-02T13:00Z", "2026-01-01T09:20Z", 400),  # exactly at cutoff: allowed
        ]
    )
    targets = pd.DataFrame(
        {
            "start_time": ts("2026-01-02T12:00Z", "2026-01-02T13:00Z", "2026-01-02T14:00Z"),
            "cutoff": ts("2026-01-01T09:20Z", "2026-01-01T09:20Z", "2026-01-01T09:20Z"),
        }
    )

    out = select_latest(forecasts, targets)

    assert out["forecast_mw"].tolist()[:2] == [200, 400]
    assert pd.isna(out["forecast_mw"].iloc[2])  # no forecast for 14:00 at all
    assert [iso(p) for p in out["publish_time"]] == [
        "2026-01-01T07:30:00Z",
        "2026-01-01T09:20:00Z",
        None,
    ]


def test_select_latest_never_uses_a_run_for_a_different_target():
    forecasts = forecasts_frame([("2026-01-02T13:00Z", "2026-01-01T07:30Z", 999)])
    targets = pd.DataFrame(
        {"start_time": ts("2026-01-02T12:00Z"), "cutoff": ts("2026-01-01T09:20Z")}
    )
    assert pd.isna(select_latest(forecasts, targets)["forecast_mw"].iloc[0])


# --- build_series ------------------------------------------------------------


@pytest.fixture
def day_snapshot():
    actuals = [(t, 1000 + i) for i, t in enumerate(target_grid(date(2026, 1, 2), date(2026, 1, 2)))]
    forecasts = [
        ("2026-01-02T00:00Z", "2026-01-01T07:30Z", 1500),
        ("2026-01-02T00:00Z", "2026-01-01T09:30Z", 1200),
        ("2026-01-02T01:00Z", "2026-01-01T07:30Z", 900),
        ("2026-01-02T01:00Z", "2026-01-02T00:00Z", 1010),
    ]
    return make_snapshot(actuals, forecasts)


def test_build_series_decision_mode(day_snapshot):
    s = build_series(day_snapshot, date(2026, 1, 2), date(2026, 1, 2), Mode.DECISION)

    assert len(s) == 48
    first, half_past, second = s.iloc[0], s.iloc[1], s.iloc[2]
    assert first["forecast_mw"] == 1500  # the 09:30 run came after the 09:20 gate closure
    assert first["error_mw"] == 1000 - 1500  # negative: less wind than forecast
    assert first["horizon_h"] == 16.5
    assert pd.isna(half_past["forecast_mw"]) and half_past["actual_mw"] == 1001
    assert second["forecast_mw"] == 900
    assert iso(second["cutoff"]) == "2026-01-01T09:20:00Z"


def test_build_series_decision_mode_with_later_gate_closure(day_snapshot):
    s = build_series(
        day_snapshot, date(2026, 1, 2), date(2026, 1, 2), Mode.DECISION, gate_closure=time(9, 50)
    )
    assert s.iloc[0]["forecast_mw"] == 1200


def test_build_series_horizon_mode(day_snapshot):
    s = build_series(day_snapshot, date(2026, 1, 2), date(2026, 1, 2), Mode.HORIZON, horizon_h=1)
    # For 01:00 the cutoff is 00:00, which admits the run published at 00:00.
    assert s.iloc[2]["forecast_mw"] == 1010
    assert s.iloc[2]["horizon_h"] == 1


def test_build_series_horizon_mode_requires_horizon(day_snapshot):
    with pytest.raises(ValueError, match="horizon_h"):
        build_series(day_snapshot, date(2026, 1, 2), date(2026, 1, 2), Mode.HORIZON)
