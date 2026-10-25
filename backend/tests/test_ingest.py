import json
from datetime import UTC, date, datetime

import pandas as pd
import pytest

from app import config
from app.ingest import clean_actuals, clean_forecasts, parse_args, run

START = datetime(2026, 1, 1, tzinfo=UTC)
END = datetime(2026, 1, 1, 2, tzinfo=UTC)  # two hours: 4 half-hours, 2 whole hours


def actual(start, generation=1000, fuel="WIND", published=None, period=1):
    return {
        "dataset": "FUELHH",
        "publishTime": published or start,
        "startTime": start,
        "settlementDate": start[:10],
        "settlementPeriod": period,
        "fuelType": fuel,
        "generation": generation,
    }


def forecast(start, published, generation=1000):
    return {
        "dataset": "WINDFOR",
        "publishTime": published,
        "startTime": start,
        "generation": generation,
    }


# --- actuals -----------------------------------------------------------------


def test_clean_actuals_keeps_wind_in_window_sorted():
    rows = [
        actual("2026-01-01T01:30:00Z", 4000, period=4),
        actual("2026-01-01T00:00:00Z", 1000, period=1),
        actual("2026-01-01T00:30:00Z", 2000, period=2),
        actual("2026-01-01T01:00:00Z", 3000, period=3),
        actual("2026-01-01T00:00:00Z", 999, fuel="CCGT"),
        actual("2025-12-31T23:30:00Z", 5, period=48),  # before window
        actual("2026-01-01T02:00:00Z", 6, period=5),  # end is exclusive
    ]

    df, stats = clean_actuals(rows, START, END)

    assert df["generation_mw"].tolist() == [1000, 2000, 3000, 4000]
    assert list(df.columns) == [
        "start_time",
        "settlement_date",
        "settlement_period",
        "generation_mw",
        "publish_time",
    ]
    assert str(df["start_time"].dt.tz) == "UTC"
    assert stats["dropped_other_fuel"] == 1
    assert stats["dropped_outside_window"] == 2
    assert stats["missing_periods"] == []
    assert stats["rows"] == 4


def test_clean_actuals_keeps_latest_publish_for_duplicate_period():
    rows = [
        actual("2026-01-01T00:00:00Z", 1000, published="2026-01-01T00:30:00Z"),
        actual("2026-01-01T00:00:00Z", 1100, published="2026-01-01T01:00:00Z"),
    ]
    df, stats = clean_actuals(rows, START, END)
    assert df["generation_mw"].tolist() == [1100]
    assert stats["dropped_duplicates"] == 1


def test_clean_actuals_reports_missing_half_hours():
    rows = [actual("2026-01-01T00:00:00Z"), actual("2026-01-01T01:30:00Z")]
    _, stats = clean_actuals(rows, START, END)
    assert stats["missing_periods"] == ["2026-01-01T00:30:00Z", "2026-01-01T01:00:00Z"]


def test_clean_actuals_handles_empty_input():
    df, stats = clean_actuals([], START, END)
    assert df.empty
    assert stats["rows"] == 0
    assert len(stats["missing_periods"]) == 4


# --- forecasts ---------------------------------------------------------------


def test_clean_forecasts_drops_negative_horizon_and_computes_horizon():
    rows = [
        forecast("2026-01-01T00:00:00Z", "2025-12-31T09:30:00Z", 1000),  # 14.5 h ahead
        forecast("2026-01-01T01:00:00Z", "2026-01-01T01:00:00Z", 1100),  # 0 h: kept
        forecast("2026-01-01T00:00:00Z", "2026-01-01T00:30:00Z", 1200),  # published after target
    ]

    df, stats = clean_forecasts(rows, START, END)

    assert df["horizon_h"].tolist() == [14.5, 0.0]
    assert df["generation_mw"].tolist() == [1000, 1100]
    assert stats["dropped_negative_horizon"] == 1
    assert stats["horizon_h_max"] == 14.5
    assert stats["target_hours_without_forecast"] == []


def test_clean_forecasts_filters_window_dedupes_and_sorts():
    rows = [
        forecast("2026-01-01T01:00:00Z", "2025-12-31T22:30:00Z"),
        forecast("2026-01-01T00:00:00Z", "2025-12-31T22:30:00Z"),
        forecast("2026-01-01T00:00:00Z", "2025-12-31T18:30:00Z"),
        forecast("2026-01-01T00:00:00Z", "2025-12-31T18:30:00Z"),  # duplicate run row
        forecast("2025-12-31T23:00:00Z", "2025-12-31T18:30:00Z"),  # target before window
        forecast("2026-01-01T02:00:00Z", "2025-12-31T18:30:00Z"),  # end exclusive
    ]

    df, stats = clean_forecasts(rows, START, END)

    assert [(_iso(r.start_time), _iso(r.publish_time)) for r in df.itertuples()] == [
        ("2026-01-01T00:00:00Z", "2025-12-31T18:30:00Z"),
        ("2026-01-01T00:00:00Z", "2025-12-31T22:30:00Z"),
        ("2026-01-01T01:00:00Z", "2025-12-31T22:30:00Z"),
    ]
    assert stats["dropped_outside_window"] == 2
    assert stats["dropped_duplicates"] == 1
    assert stats["publish_runs"] == 2


def test_clean_forecasts_reports_hours_without_any_forecast():
    rows = [forecast("2026-01-01T00:00:00Z", "2025-12-31T22:30:00Z")]
    _, stats = clean_forecasts(rows, START, END)
    assert stats["target_hours_without_forecast"] == ["2026-01-01T01:00:00Z"]


def test_clean_forecasts_handles_empty_input():
    df, stats = clean_forecasts([], START, END)
    assert df.empty
    assert stats["horizon_h_max"] is None


# --- end to end with a fake client ------------------------------------------


class FakeClient:
    def __init__(self):
        self.calls = {}

    def fetch_actuals(self, first_day, last_day):
        self.calls["actuals"] = (first_day, last_day)
        return [
            actual("2026-01-01T00:00:00Z", 1000, period=1),
            actual("2026-01-01T00:30:00Z", 2000, period=2),
            actual("2026-01-01T01:00:00Z", 3000, period=3),
            actual("2026-01-01T01:30:00Z", 4000, period=4),
        ]

    def fetch_forecasts(self, published_from, published_to):
        self.calls["forecasts"] = (published_from, published_to)
        return [
            forecast("2026-01-01T00:00:00Z", "2025-12-31T09:30:00Z", 1500),
            forecast("2026-01-01T01:00:00Z", "2025-12-31T09:30:00Z", 2500),
            forecast("2025-12-31T09:00:00Z", "2025-12-31T09:30:00Z", 9),  # negative horizon
        ]


def test_run_requests_padded_windows_and_writes_snapshot(tmp_path):
    client = FakeClient()

    meta = run(client, tmp_path, START, END)

    # Settlement dates padded a day each side; forecasts looked back FORECAST_LOOKBACK.
    assert client.calls["actuals"] == (date(2025, 12, 31), date(2026, 1, 1))
    assert client.calls["forecasts"] == (START - config.FORECAST_LOOKBACK, END)

    actuals_csv = (tmp_path / config.ACTUALS_FILE).read_text()
    assert actuals_csv.splitlines()[0] == (
        "start_time,settlement_date,settlement_period,generation_mw,publish_time"
    )
    assert actuals_csv.splitlines()[1].startswith("2026-01-01T00:00:00Z,2026-01-01,1,1000,")
    assert "\r\n" not in actuals_csv

    forecasts = pd.read_csv(tmp_path / config.FORECASTS_FILE)
    assert forecasts["generation_mw"].tolist() == [1500, 2500]
    assert forecasts["horizon_h"].tolist() == [14.5, 15.5]

    on_disk = json.loads((tmp_path / config.META_FILE).read_text())
    assert on_disk == meta
    assert meta["target_window"] == {
        "start": "2026-01-01T00:00:00Z",
        "end_exclusive": "2026-01-01T02:00:00Z",
    }
    assert meta["forecasts"]["dropped_negative_horizon"] == 1


# --- CLI ---------------------------------------------------------------------


def test_parse_args_defaults_cover_configured_window():
    args = parse_args([])
    assert args.start == config.TARGET_START.date()
    assert args.end == date(2026, 2, 1)


def test_parse_args_rejects_reversed_range():
    with pytest.raises(SystemExit):
        parse_args(["--start", "2026-01-10", "--end", "2026-01-01"])


def _iso(ts):
    return pd.Timestamp(ts).strftime("%Y-%m-%dT%H:%M:%SZ")
