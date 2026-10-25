from datetime import date

import pytest
from conftest import make_snapshot
from fastapi.testclient import TestClient

from app.data import get_snapshot
from app.main import app
from app.selection import target_grid


@pytest.fixture
def client():
    grid = target_grid(date(2026, 1, 2), date(2026, 1, 3))
    actuals = [(t, 1000) for t in grid]
    forecasts = [
        ("2026-01-02T00:00Z", "2026-01-01T07:30Z", 1500),
        ("2026-01-02T00:00Z", "2026-01-01T09:30Z", 1200),
        ("2026-01-02T00:00Z", "2026-01-01T22:30Z", 1100),
        ("2026-01-03T00:00Z", "2026-01-02T07:30Z", 800),
    ]
    snapshot = make_snapshot(actuals, forecasts, date(2026, 1, 2), date(2026, 1, 3))
    app.dependency_overrides[get_snapshot] = lambda: snapshot
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_health(client):
    assert client.get("/api/health").json() == {
        "status": "ok",
        "snapshot_generated_at": "2026-10-01T00:00:00Z",
    }


def test_meta_reports_window_and_options(client):
    body = client.get("/api/meta").json()
    assert body["first_day"] == "2026-01-02"
    assert body["last_day"] == "2026-01-03"
    assert body["gate_closures"] == {"EPEX": "09:20:00", "N2EX": "09:50:00"}
    assert body["default_gate_closure"] == "09:20:00"
    assert body["publish_runs"] == 4
    assert body["cleaning"]["actual_missing_periods"] == 0
    assert body["cleaning"]["hours_without_forecast"] == 0


def test_series_defaults_to_decision_mode_over_whole_window(client):
    body = client.get("/api/series").json()
    assert body["mode"] == "decision"
    assert body["gate_closure"] == "09:20:00"
    assert body["horizon_h"] is None
    assert len(body["points"]) == 96

    first = body["points"][0]
    assert first == {
        "start_time": "2026-01-02T00:00:00Z",
        "actual_mw": 1000,
        "forecast_mw": 1500,
        "error_mw": -500,
        "publish_time": "2026-01-01T07:30:00Z",
        "horizon_h": 16.5,
        "cutoff": "2026-01-01T09:20:00Z",
    }
    assert body["points"][1]["forecast_mw"] is None


def test_series_gate_closure_changes_selected_run(client):
    body = client.get("/api/series", params={"end": "2026-01-02", "gate_closure": "09:50"}).json()
    assert body["points"][0]["forecast_mw"] == 1200


def test_series_horizon_mode(client):
    body = client.get("/api/series", params={"mode": "horizon", "horizon_h": 1}).json()
    assert body["horizon_h"] == 1
    assert body["gate_closure"] is None
    assert body["points"][0]["forecast_mw"] == 1100


@pytest.mark.parametrize(
    ("params", "detail"),
    [
        ({"mode": "horizon"}, "horizon_h is required"),
        ({"start": "2026-01-01"}, "data covers delivery days 2026-01-02 to 2026-01-03"),
        ({"end": "2026-01-04"}, "data covers delivery days"),
        ({"start": "2026-01-03", "end": "2026-01-02"}, "start must not be after end"),
    ],
)
def test_series_rejects_bad_queries(client, params, detail):
    resp = client.get("/api/series", params=params)
    assert resp.status_code == 422
    assert detail in resp.json()["detail"]


@pytest.mark.parametrize(
    "params", [{"mode": "sideways"}, {"horizon_h": -1}, {"gate_closure": "25:00"}]
)
def test_series_rejects_invalid_parameter_values(client, params):
    assert client.get("/api/series", params=params).status_code == 422


def test_metrics_summary(client):
    body = client.get("/api/metrics").json()
    assert body["overall"]["count"] == 2
    assert body["overall"]["bias_mw"] == (-500 + 200) / 2
    assert [d["delivery_day"] for d in body["by_day"]] == ["2026-01-02", "2026-01-03"]
    assert body["by_hour"][0]["hour"] == 0
    assert len(body["by_hour"]) == 24


def test_metrics_by_horizon(client):
    body = client.get("/api/metrics/by-horizon", params={"max_h": 24, "step_h": 6}).json()
    assert [h["horizon_h"] for h in body["horizons"]] == [0, 6, 12, 18, 24]
    # Runs are 14.5-16.5 h ahead of their midnight targets (plus one 1.5 h ahead), so both
    # targets are covered up to 12 h and neither from 18 h on.
    assert [h["count"] for h in body["horizons"]] == [2, 2, 2, 0, 0]
    assert body["horizons"][-1]["mae_mw"] is None
